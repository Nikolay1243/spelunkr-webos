// webOS adapter around the original website. Keep UI and playback state upstream.
const nativeLocation = window.location;
const appURL = new URL(nativeLocation.href);
const historyPush = history.pushState.bind(history);
const historyReplace = history.replaceState.bind(history);
const SITE = 'https://spelunkr.tv';
// This flat-panel webOS app does not use the website's 640×480 CRT adapter.
// Clear stale modes on every launch, independently of previous migrations.
try{localStorage.removeItem('spelunkr-crt');}catch{}
document.documentElement.classList.remove('crt','crt-stretched','crt-centered');
for(const property of ['--crt-sx','--crt-sy','--crt-ox','--crt-oy'])document.documentElement.style.removeProperty(property);

function route() {
  const hash = new URLSearchParams(nativeLocation.hash.slice(1));
  return {path:hash.get('route') || '/', fragment:hash.get('fragment') || ''};
}
function virtualURL() {const r=route();return new URL(r.path + nativeLocation.search + r.fragment,SITE);}
function localURL(input) {
  const target=new URL(input || virtualURL().href,virtualURL());
  if(target.origin!==SITE)throw new Error('Cannot route another origin inside Spelunkr');
  const local=new URL(appURL);local.search=target.search;
  const query=new URLSearchParams(local.search);query.set('tv','1');query.delete('crt');local.search=query.toString();
  const fragment=new URLSearchParams();fragment.set('route',target.pathname);
  if(target.hash)fragment.set('fragment',target.hash);
  local.hash=fragment.toString();return local.href;
}
for(const [name,original]of [['pushState',historyPush],['replaceState',historyReplace]]) {
  history[name]=function(state,title,url){return original(state,title,url==null?undefined:localURL(url));};
}
const siteLocation={};
for(const property of ['href','pathname','search','hash','origin','hostname','host','protocol','port']){
  Object.defineProperty(siteLocation,property,{get:()=>virtualURL()[property],...(property==='hash'?{set:value=>{const next=virtualURL();next.hash=value;historyReplace(history.state,'',localURL(next.href));}}:{})});
}
siteLocation.reload=()=>nativeLocation.reload();
function navigate(input,replace=false){
  const target=new URL(input,virtualURL());
  if(target.origin!==SITE){nativeLocation.assign(target.href);return;}
  history[replace?'replaceState':'pushState'](null,'',target.href);
  window.dispatchEvent(new CustomEvent('spelunkr:navigate'));
}
siteLocation.assign=input=>navigate(input);
siteLocation.replace=input=>navigate(input,true);
import { startDiscordSignIn } from './sign-in.js';
import { claimOAuthReturn } from './oauth-return.js';
window.SpelunkrWebOS={location:siteLocation,signIn:startDiscordSignIn};
window.SpelunkrWebOS.ready=claimOAuthReturn(callback=>historyReplace(history.state,'',localURL(callback.href)));
window.SpelunkrApp={leave:()=>window.close()};
// TV mode is upstream's own mode, rather than a separate reproduction of its UI.
document.documentElement.classList.add('tv');
historyReplace(history.state,'',localURL(virtualURL().href));
// Capture LG codes that arrive with an unrecognized key string. The upstream site
// already handles D-pad, OK, Back (461), and normalized media/channel key names.
function returnToWatch() {
  const watch=document.querySelector('.stage--guide .guide-ctrl-watch');
  if(!watch)return false;watch.click();return true;
}
import './header-navigation.js';
import { PlayerRemote } from './remote-controls.js';
import { HoldProgress } from './hold-progress.js';
const holdProgress=new HoldProgress();
const remote=new PlayerRemote({
  onHoldStart:duration=>holdProgress.show(duration),
  onHoldEnd:()=>holdProgress.hide(),
  getPlayer:()=>window.SpelunkrWebOS.player,
  isWatching:()=>!!document.querySelector('.stage--watch') && !document.querySelector('[role="dialog"],.cc-panel') && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'),
  shortOK:target=>{
    const focused=target?.isConnected?target.closest?.('button,a[href],[role="button"]'):null;
    if(focused&&focused.getClientRects().length){focused.click();return;}
    // An unfocused menu OK establishes focus; it never toggles a hidden menu.
    const first=document.querySelector('.stage--watch .dvr-pause-btn,.stage--watch .dvr-guide-btn');
    if(first){first.setAttribute('data-remote-ring','');first.focus();}

  }
});
window.SpelunkrWebOS.remote=remote;
window.addEventListener('keydown',event=>remote.keydown(event),true);
window.addEventListener('keyup',event=>remote.keyup(event),true);
window.addEventListener('click',event=>remote.click(event),true);
window.addEventListener('blur',()=>remote.cancel());
document.addEventListener('visibilitychange',()=>{if(document.hidden)remote.cancel();});
window.addEventListener('keydown',event=>{
  if(event.__webosShortOK||document.querySelector('[role="dialog"]'))return;
  if(event.key==='Enter' && document.querySelector('.stage--guide')){
    const focused=document.activeElement;
    if((focused===document.body || focused?.matches('.grid-row.highlighted')) && returnToWatch()){
      event.preventDefault();event.stopImmediatePropagation();
    }
  }
},true);
document.addEventListener('click',event=>{
  const row=event.target.closest?.('.grid-row.highlighted');
  if(row && !event.target.closest('button,a') && document.querySelector('.stage--guide') && returnToWatch()){
    event.preventDefault();event.stopImmediatePropagation();
  }
},true);
import { normalizedRemoteKey } from './remote-keys.js';
import { pageGuide } from './guide-paging.js';
window.addEventListener('keydown',event=>{
  const key=normalizedRemoteKey(event);if(!key||event.__webosNormalized)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(['ChannelUp','ChannelDown'].includes(key) && document.querySelector('.stage--guide')){
    if(!document.querySelector('[role="dialog"]'))pageGuide(document.querySelector('.app--guide .tv-grid'),key==='ChannelUp'?-1:1);
    return;
  }
  const normalized=new KeyboardEvent('keydown',{key,code:key,bubbles:true,cancelable:true,repeat:event.repeat});
  Object.defineProperty(normalized,'__webosNormalized',{value:true});
  (document.activeElement || document.body).dispatchEvent(normalized);
},true);
// Root-relative assets and fetches belong to the original site, while its SPA
// history is held in this package. Internal links stay in the same player.
document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.target==='_blank')return;
  const target=new URL(anchor.href,virtualURL());
  if(target.origin===SITE){event.preventDefault();navigate(target.href);}
});

import { fitVideo } from './video-layout.js';
const tracked=new WeakSet();
function watchVideo(video){
  if(tracked.has(video))return;tracked.add(video);
  const container=video.parentElement;
  let lastFit="";
  const resize=()=>{
    const fit=fitVideo(container.clientWidth,container.clientHeight,video.videoWidth,video.videoHeight);
    if(!fit)return;
    const key=[fit.width,fit.height,fit.left,fit.top].join(",");
    if(key===lastFit)return;lastFit=key;
    // LG's hardware video plane can stretch a 100%-sized element despite
    // object-fit:contain. Give that plane an actual box of the correct ratio.
    Object.assign(video.style,{position:'absolute',inset:'auto',width:fit.width+'px',height:fit.height+'px',left:fit.left+'px',top:fit.top+'px',objectFit:'contain'});
  };
  const observer=new ResizeObserver(resize);observer.observe(container);
  for(const event of ['loadedmetadata','resize','loadeddata'])video.addEventListener(event,resize);
  video.addEventListener('emptied',()=>{
    lastFit='';
    for(const property of ['position','inset','width','height','left','top','object-fit'])video.style.removeProperty(property);
  });
  window.addEventListener('resize',resize);
  document.addEventListener('fullscreenchange',resize);
  resize();
}
const mutations=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType!==1)continue;
    if(node.matches('video.stage-video,video.clip-player-video'))watchVideo(node);
    else node.querySelectorAll('video.stage-video,video.clip-player-video').forEach(watchVideo);
  }
});
mutations.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)document.querySelectorAll('video,audio').forEach(media=>media.pause());
});
