// The helper retains a callback in RAM and hands it only to this app using a
// random, single-use claim. No session credentials appear in launch parameters.
function launchNonce(){try{return JSON.parse(window.PalmSystem?.launchParams||'{}').oauthNonce || null;}catch{return null;}}
export function claimOAuthReturn(applyCallback){
 const nonce=launchNonce();if(!nonce)return Promise.resolve();
 if(!/^[a-f0-9]{48}$/.test(nonce)||typeof window.PalmServiceBridge!=='function')return Promise.resolve();
 return new Promise(resolve=>{
  const bridge=new window.PalmServiceBridge();const timer=setTimeout(()=>{bridge.cancel();resolve();},8000);
  bridge.onservicecallback=raw=>{
   let result;try{result=JSON.parse(raw);}catch{return;}
   clearTimeout(timer);
   if(result.returnValue&&typeof result.callback==='string'){
    try{const url=new URL(result.callback);if(url.origin==='https://spelunkr.tv'&&url.pathname==='/')applyCallback(url);}catch{}
   }
   resolve();
  };
  bridge.call('luna://tv.spelunkr.webos.auth/claim',JSON.stringify({nonce}));
 });
}
