// Keep the site's original header buttons and styling; make them reachable by D-pad.
function headerItems(){return [...document.querySelectorAll('.prevue-header-bar .header-nav a,.prevue-header-bar .header-nav button,.prevue-header-bar .header-signin,.prevue-header-bar .header-user-wrap>button')].filter(e=>e.getClientRects().length);}
function focus(element){if(!element)return;element.setAttribute('data-remote-ring','');element.focus();}
window.addEventListener('keydown',event=>{
 if(document.querySelector('[role="dialog"]')||event.ctrlKey||event.metaKey||event.altKey)return;
 const items=headerItems(),index=items.indexOf(document.activeElement);
 if(index>=0){
  if(['ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();event.stopImmediatePropagation();focus(items[(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length]);
  }else if(event.key==='ArrowDown'){
   event.preventDefault();event.stopImmediatePropagation();document.activeElement.removeAttribute('data-remote-ring');document.activeElement.blur();
  }
  return;
 }
 if(event.key==='ArrowUp'&&document.querySelector('.stage--guide')){
  const rows=[...document.querySelectorAll('.app--guide .grid-row[data-channel]:not([aria-disabled="true"])')];
  if(rows[0]?.classList.contains('highlighted')){event.preventDefault();event.stopImmediatePropagation();focus(items[0]);}
 }
 if((event.keyCode===461||['Escape','GoBack'].includes(event.key))&&!document.querySelector('.stage')&&window.SpelunkrWebOS.location.pathname!=='/'){
  event.preventDefault();event.stopImmediatePropagation();history.back();
 }
},true);
