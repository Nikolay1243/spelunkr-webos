const APP='tv.spelunkr.webos';
const AUTH='https://jbuopkuluyfjwgsrigry.supabase.co';
function validAuthorize(input){
 try{const u=new URL(input);return u.origin===AUTH&&u.pathname==='/auth/v1/authorize'&&u.searchParams.get('provider')==='discord'&&new URL(u.searchParams.get('redirect_to')).origin==='https://spelunkr.tv';}catch{return false;}
}
function isPackagedApp(input){
 try{const u=new URL(input);return u.protocol==='file:'&&u.pathname===`/media/developer/apps/usr/palm/applications/${APP}/index.html`;}catch{return false;}
}
function callbackURL(input){
 try{const u=new URL(input);if(u.origin!=='https://spelunkr.tv'||u.pathname!=='/')return null;
  const h=new URLSearchParams(u.hash.slice(1));
  return (h.has('access_token')&&h.has('refresh_token'))||u.searchParams.has('code')||h.has('error_description')?u:null;
 }catch{return null;}
}
module.exports={APP,validAuthorize,isPackagedApp,callbackURL};
