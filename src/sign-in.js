export async function startDiscordSignIn(client){
  if(!client)return {error:{message:'Sign-in is unavailable.'}};
  if(typeof window.PalmServiceBridge!=='function')return {error:{message:'Discord sign-in is available in the installed TV app.'}};
  const result=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:'https://spelunkr.tv/',scopes:'identify guilds.join',skipBrowserRedirect:true}});
  if(result.error||!result.data?.url)return result;
  try{
    await new Promise((resolve,reject)=>{
      const bridge=new window.PalmServiceBridge();
      const timer=setTimeout(()=>{bridge.cancel();reject(Error('TV sign-in helper timed out.'));},10000);
      bridge.onservicecallback=raw=>{
        let response;try{response=JSON.parse(raw);}catch{return;}
        clearTimeout(timer);
        if(response.returnValue&&response.started)resolve();else reject(Error(response.errorText||'TV sign-in could not start.'));
      };
      bridge.call('luna://tv.spelunkr.webos.auth/begin',JSON.stringify({url:result.data.url}));
    });
    return {data:result.data,error:null};
  }catch(error){return {data:null,error:{message:error.message}};}
}
