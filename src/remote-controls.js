// Defer short OK until release, so a hold never performs a short action first.
export class PlayerRemote {
  constructor({getPlayer,isWatching,shortOK,channelStep=()=>{},now=Date.now,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),holdMs=2000,shortTapMs=300,onHoldStart=()=>{},onHoldEnd=()=>{}}) {
    Object.assign(this,{getPlayer,isWatching,shortOK,channelStep,now,setTimer,clearTimer,holdMs,shortTapMs,onHoldStart,onHoldEnd});
    this.press=null;this.suppressClickUntil=0;
  }
  consume(event){event.preventDefault();event.stopImmediatePropagation();}
  isOK(event){return event.key==='Enter'||event.keyCode===13;}
  keydown(event){
    if(event.__webosShortOK)return;
    // Wheel-generated arrow presses belong to the player (volume), not to the menu.
    if(event.__webosWheel)return;
    if(this.isOK(event)&&this.press){this.consume(event);return;}
    if(this.press&&!this.isOK(event))this.cancel();
    if(!this.isWatching())return;
    const player=this.getPlayer();if(!player)return;
    const key=event.key;
    if(['ArrowUp','Up','ArrowDown','Down'].includes(key)||[38,40].includes(event.keyCode)){
      this.consume(event);player.showMenu();return;
    }
    if(event.keyCode===461||['Escape','GoBack','BrowserBack'].includes(key)){
      this.consume(event);if(event.repeat)return;
      if(player.isMenuVisible())player.guide();else player.showMenu();
      return;
    }
    // Left/Right change channel, like a TV's channel rocker. Held repeats are
    // ignored so a sticky button cannot spin through the whole lineup; a burst of
    // presses still becomes one tune through the coalescer.
    if(['ArrowLeft','Left','ArrowRight','Right'].includes(key)||[37,39].includes(event.keyCode)){
      this.consume(event);if(event.repeat)return;
      const step=key==='ArrowRight'||key==='Right'||event.keyCode===39?1:-1;
      this.channelStep(step);
      return;
    }
    if(!this.isOK(event))return;
    this.consume(event);if(event.repeat)return;
    const press={target:event.target,long:false,menu:player.isMenuVisible(),startedAt:this.now()};this.press=press;
    if(press.menu)return;
    press.timer=this.setTimer(()=>{
      if(this.press!==press)return;
      if(!this.isWatching()||this.getPlayer()?.isMenuVisible()){this.cancel();return;}
      press.long=true;this.suppressClickUntil=Infinity;
      this.onHoldEnd(true);this.getPlayer()?.spelunk();
    },this.holdMs);
    this.onHoldStart(this.holdMs);
  }
  keyup(event){
    if(event.__webosShortOK||!this.isOK(event)||!this.press)return;
    this.consume(event);const press=this.press;this.press=null;this.clearTimer(press.timer);this.onHoldEnd(press.long);
    if(press.long)this.suppressClickUntil=this.now()+350;
    else if(press.menu&&this.isWatching()&&this.getPlayer()?.isMenuVisible()&&this.now()-press.startedAt<this.shortTapMs)this.shortOK(press.target);
  }
  click(event){if(this.now()<this.suppressClickUntil)this.consume(event);}
  cancel(){if(this.press)this.clearTimer(this.press.timer);this.press=null;this.suppressClickUntil=0;this.onHoldEnd(false);}
}
