// Page by whole channel rows, excluding the sticky time header.
export function guidePageTop({top,height,scrollHeight,headerHeight=0,rowHeight=0},direction){
  const usable=Math.max(1,height-headerHeight);
  const page=rowHeight>0?Math.max(rowHeight,Math.floor(usable/rowHeight)*rowHeight):usable;
  return Math.max(0,Math.min(Math.max(0,scrollHeight-height),top+direction*page));
}
export function pageGuide(grid,direction){
  if(!grid)return;
  const rows=[...grid.querySelectorAll('.grid-row[data-channel]:not([aria-disabled="true"])')];
  const headerHeight=grid.querySelector('.grid-time-header')?.getBoundingClientRect().height || 0;
  const rowHeight=rows[0]?.getBoundingClientRect().height || 0;
  const oldTop=grid.scrollTop;
  const top=guidePageTop({top:oldTop,height:grid.clientHeight,scrollHeight:grid.scrollHeight,headerHeight,rowHeight},direction);
  grid.scrollTo({top,behavior:'auto'});
  if(top===oldTop||!rows.length)return;
  const box=grid.getBoundingClientRect();
  const visible=rows.map((row,index)=>({row,index,rect:row.getBoundingClientRect()}))
    .filter(({rect})=>rect.top>=box.top+headerHeight-1 && rect.bottom<=box.bottom+1);
  if(!visible.length)return;
  const current=rows.findIndex(row=>row.classList.contains('highlighted'));
  const moved=rowHeight>0?Math.round((top-oldTop)/rowHeight):direction;
  const index=Math.max(visible[0].index,Math.min(visible[visible.length-1].index,Math.max(0,current)+moved));
  // Use upstream selection so the channel details and OK action
  // agree with the new highlight; playback remains on the active channel. Never click the existing row (it opens Watch).
  if(index!==current)rows[index].click();
}
