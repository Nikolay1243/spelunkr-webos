// Animate on the compositor so playback stays smooth during the hold.
export class HoldProgress {
  constructor(){this.element=null;this.animation=null;}
  show(duration){
    this.hide();
    if(!this.element){
      const element=document.createElement('div');element.id='webos-spelunk-hold';element.className='webos-spelunk-hold';
      element.setAttribute('role','status');element.setAttribute('aria-live','polite');
      const label=document.createElement('div');label.className='webos-spelunk-hold-label';label.textContent='Hold to spelunk';
      const bar=document.createElement('div');bar.className='webos-spelunk-hold-bar';bar.setAttribute('aria-hidden','true');
      const fill=document.createElement('div');fill.className='webos-spelunk-hold-fill';bar.append(fill);element.append(label,bar);
      document.body.append(element);this.element=element;this.fill=fill;
    }
    this.element.hidden=false;
    this.animation=this.fill.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration,easing:'linear',fill:'forwards'});
  }
  hide(){this.animation?.cancel();this.animation=null;if(this.element)this.element.hidden=true;}
}
