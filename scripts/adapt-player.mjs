// Small, checked adaptations of the pinned original client. Fail on upstream drift.
function replaceOnce(source,anchor,replacement){
  if(source.split(anchor).length!==2)throw new Error('Original player changed: review the webOS player adapter before building');
  return source.replace(anchor,replacement);
}
export function adaptPlayer(source) {
  source=replaceOnce(source,'tu.current=eu,C(()=>{const b=B=>tu.current(B)',
    'tu.current=eu,window.SpelunkrWebOS.player={isMenuVisible:()=>q.current,showMenu:be,hideMenu:()=>ne(!0),spelunk:()=>f&&f(),guide:()=>_&&_()},C(()=>{const b=B=>tu.current(B)');
  // The site already owns distinct active (I) and guide-selected (U) IDs. Keep
  // its preview pinned to I instead of following U after the preview debounce.
  source=replaceOnce(source,'function JE({channel:e,channelNumber:t,',
    'function JE({channel:e,channelNumber:t,webosPlayingChannel=null,');
  source=replaceOnce(source,'const G=z.current,le=O&&!r&&',
    'const G=(!r&&webosPlayingChannel)||z.current,le=O&&!r&&');
  source=replaceOnce(source,'a(JE,{channel:Be,channelNumber:Sn,',
    'a(JE,{channel:Be,channelNumber:Sn,webosPlayingChannel:Ws(I),');
  source=replaceOnce(source,'const Be=Ws(U),pt=m2(),',
    'const Be=Ws(U),webosGuide=(window.SpelunkrWebOS.guide={activeChannel:I,selectedChannel:U,tuneSelected:()=>Y(U)}),pt=m2(),');
  source=replaceOnce(source,'activeId:$?U:null,highlightedId:U,',
    'activeId:I,highlightedId:U,');
  source=replaceOnce(source,'const Vb=Kb(),$e=Cn&&an?Ub(Cn,an):null;',
    'const Vb=Kb(),$e=Cn&&an?Ub(Cn,an):null;window.SpelunkrWebOS.auth=$e;');
  source=replaceOnce(source,'async function TT(){if(!$e)return{error:{message:"Supabase not configured"}};const{data:e,error:t}=await $e.auth.signInWithOAuth({provider:"discord",options:{redirectTo:window.location.origin,scopes:"identify guilds.join"}});return{data:e,error:t}}',
    'async function TT(){return window.SpelunkrWebOS.signIn($e)}');
  // This app always uses the normal flat-TV layout. Do not let persisted CRT
  // modes or query links re-enable a differently scaled 640×480 interface.
  source=replaceOnce(source,'function Ok(e,t){const n=String(e||"");',
    'function Ok(e,t){return null;const n=String(e||"");');
  source=replaceOnce(source,'function Uk({mode:e=null,channel:t=null,watching:n=!1}){',
    'function Uk({mode:e=null,channel:t=null,watching:n=!1}){return null;');
  // The site's pull animation measures and animates layout on every frame.
  // Snap the TV video plane to its final size instead of repeatedly resizing it.
  source=replaceOnce(source,'Ck(K,r,!O);','Ck(K,r,!1);');
  const hideLabel='...vc(!Qt,Rr.titleOn,Rr.titleOff),children:Rr.key';
  if(source.split(hideLabel).length!==3)throw new Error('Original comment toggle changed: review its label and state');
  source=source.replaceAll(hideLabel,'...vc(!Qt,Rr.titleOn,Rr.titleOff),children:Qt?"Comments & reactions: On":"Comments & reactions: Off"');
  return source;
}
