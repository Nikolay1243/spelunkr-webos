import { writeFile } from 'node:fs/promises';
const debugHost='127.0.0.1:'+ (process.env.TV_DEBUG_PORT || '19223');
const tabs=await (await fetch('http://'+debugHost+'/json/list')).json();
const tab=tabs.find(t=>process.env.TV_TARGET_ID?t.id===process.env.TV_TARGET_ID:(t.url.includes('tv.spelunkr.webos') || t.url.startsWith('https://spelunkr.tv/')));
if(!tab)throw Error('Spelunkr is not running');
const socket=new WebSocket(tab.webSocketDebuggerUrl.replace('localhost:9998',debugHost));
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();
socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
function send(method,params={}){return new Promise(resolve=>{pending.set(++id,resolve);socket.send(JSON.stringify({id,method,params}));});}
const expression=process.argv[2] || `JSON.stringify({title:document.title,ready:document.readyState,state:history.state,rows:document.querySelectorAll('.grid-row[data-channel]').length,body:document.body.innerText.slice(0,1000),video:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,paused:v.paused,time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message}))})`;
console.log(JSON.stringify(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}),null,2));
if(process.env.SCREENSHOT){const result=await send('Page.captureScreenshot',{format:'png'});if(result.result?.data)await writeFile(process.env.SCREENSHOT,Buffer.from(result.result.data,'base64'));else console.log(result);}
socket.close();
