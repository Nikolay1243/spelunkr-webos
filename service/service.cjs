// A bounded, app-scoped OAuth navigation helper. It never logs tokens or
// credentials, and only observes the requesting Spelunkr web app target.
const Service=require('webos-service');
const http=require('http');
const crypto=require('crypto');
const WebSocket=require('ws');
const {APP,validAuthorize,isPackagedApp,callbackURL}=require('./auth-policy.cjs');
const service=new Service(APP+'.auth');
let running=null,pendingReturn=null,phase="idle";
service.register("status",message=>message.respond(message.sender===APP?{returnValue:true,phase,running:!!running,pending:!!pendingReturn}:{returnValue:false,errorText:"App-only diagnostics."}));
function bus(uri,payload){return new Promise((resolve,reject)=>service.call(uri,payload,message=>message.payload.returnValue?resolve(message.payload):reject(Error('App lifecycle request failed: '+message.payload.errorCode))));}
async function relaunch(command,nonce){
 // Close only the app-owned page; dev/closeByAppId is denied to app services.
 phase='closing';
 await command('Page.close');
 await new Promise(resolve=>setTimeout(resolve,350));
 phase='launching';
 await bus('luna://com.webos.applicationManager/launch',{id:APP,params:nonce?{oauthNonce:nonce}:{}});
}
service.register('claim',message=>{
 if(message.sender!==APP||!pendingReturn||message.payload.nonce!==pendingReturn.nonce||Date.now()>pendingReturn.expires){message.respond({returnValue:false,errorText:'No pending sign-in for this app.'});return;}
 const value=pendingReturn;pendingReturn=null;phase='claimed';
 message.respond({returnValue:true,callback:value.callback});value.finish();
});
function targets(){return new Promise((resolve,reject)=>{
 const request=http.get('http://127.0.0.1:9998/json/list',response=>{let body='';response.on('data',chunk=>{body+=chunk;if(body.length>1000000)request.destroy();});response.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(Error('Debugger response unavailable'));}});});
 request.setTimeout(4000,()=>request.destroy(Error('Debugger unavailable')));request.on('error',reject);
});}
service.register('begin',message=>{
 if(message.sender!==APP){message.respond({returnValue:false,errorText:'Only Spelunkr may start sign-in.'});return;}
 if(!validAuthorize(message.payload.url)){message.respond({returnValue:false,errorText:'Invalid Discord sign-in request.'});return;}
 if(running){message.respond({returnValue:false,errorText:'A sign-in is already in progress.'});return;}
 phase='connecting';
 const session={closed:false,socket:null,activity:null,timer:null};running=session;
 function finish(){
  if(session.closed)return;session.closed=true;clearTimeout(session.timer);session.socket?.close();
  if(session.activity)service.activityManager.complete(session.activity,()=>{});running=null;if(pendingReturn?.finish===finish)pendingReturn=null;
 }
 service.activityManager.create('Spelunkr Discord sign-in',activity=>{session.activity=activity;if(session.closed)service.activityManager.complete(activity,()=>{});});
 session.timer=setTimeout(finish,10*60*1000);
 (async()=>{
  const list=await targets();const target=list.find(t=>isPackagedApp(t.url));
  if(!target)throw Error('Packaged app not available');
  const address=new URL(target.webSocketDebuggerUrl);
  if(!['localhost','127.0.0.1'].includes(address.hostname)||address.port!=='9998')throw Error('Invalid app debugger address');
  address.hostname='127.0.0.1';
  const socket=new WebSocket(address.href,{maxPayload:1024*1024});session.socket=socket;
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  let serial=0,returning=false,recoveryTimer=null;const pending=new Map();
  function command(method,params={}){return new Promise((resolve,reject)=>{
   const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error('App navigation timeout'));},5000);
   pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });}
  function returnCallback(callback){
   if(returning||session.closed)return;returning=true;clearTimeout(recoveryTimer);phase='callback';
   const nonce=crypto.randomBytes(24).toString('hex');
   pendingReturn={nonce,callback:callback.href,expires:Date.now()+60000,finish};
   clearTimeout(session.timer);session.timer=setTimeout(finish,60000);
   relaunch(command,nonce).catch(()=>{phase='return-failed';finish();});
  }
  function recoverWebsiteSession(){
   if(returning||session.closed)return;
   // The website can consume and clear a fragment before WAM reports it. Read
   // the existing client's session only in this app's exact callback origin.
   const expression=`(async()=>{if(location.origin!=='https://spelunkr.tv')return null;const entry=document.querySelector('script[type="module"][src]');if(!entry||new URL(entry.src).origin!==location.origin)return null;const module=await import(entry.src);const client=Object.values(module).find(value=>value&&value.auth&&typeof value.auth.getSession==='function');if(!client)return null;const {data}=await client.auth.getSession();const s=data.session;if(!s)return null;const p=new URLSearchParams({access_token:s.access_token,refresh_token:s.refresh_token,expires_in:String(s.expires_in||3600),expires_at:String(s.expires_at||Math.floor(Date.now()/1000)+3600),token_type:s.token_type||'bearer'});if(s.provider_token)p.set('provider_token',s.provider_token);return 'https://spelunkr.tv/#'+p.toString();})()`;
   command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}).then(result=>{
    const callback=callbackURL(result?.result?.value);if(callback)returnCallback(callback);
    else if(!returning&&!session.closed)recoveryTimer=setTimeout(recoverWebsiteSession,800);
   }).catch(()=>{if(!returning&&!session.closed)recoveryTimer=setTimeout(recoverWebsiteSession,800);});
  }
  socket.on('message',raw=>{
   let data;try{data=JSON.parse(raw);}catch{return;}
   if(data.id){const request=pending.get(data.id);if(!request)return;clearTimeout(request.timer);pending.delete(data.id);data.error?request.reject(Error('App debugger request failed')):request.resolve(data.result);return;}
   if(data.method==='Runtime.bindingCalled'&&data.params.name==='__spelunkrAuthCancel'&&!returning){returning=true;clearTimeout(recoveryTimer);phase='canceling';relaunch(command).then(()=>{phase='canceled';finish();},()=>{phase='cancel-failed';finish();});return;}
   if(returning)return;
   let url=null;
   if(data.method==='Page.frameNavigated'&&!data.params.frame.parentId){const frame=data.params.frame;url=frame.url+(frame.urlFragment||'');}
   if(data.method==='Page.navigatedWithinDocument')url=data.params.url;
   if(!url)return;
   const callback=callbackURL(url);if(callback){returnCallback(callback);return;}
   try{if(new URL(url).origin==='https://spelunkr.tv'){phase='website-return';clearTimeout(recoveryTimer);recoveryTimer=setTimeout(recoverWebsiteSession,300);}}catch{}
  });
  socket.on('close',()=>{if(!returning)finish();});socket.on('error',()=>{if(!returning)finish();});
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Runtime.addBinding',{name:'__spelunkrAuthCancel'});
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`if(self===top)window.addEventListener('keydown',function(e){if(e.keyCode===461){e.preventDefault();e.stopImmediatePropagation();window.__spelunkrAuthCancel("cancel");}},true);`});
  phase='waiting-for-discord';
  message.respond({returnValue:true,started:true});
  await command('Page.navigate',{url:message.payload.url});
 })().catch(()=>{try{message.respond({returnValue:false,errorText:'TV sign-in helper could not connect. Developer/debug mode is required.'});}catch{}finish();});
});
