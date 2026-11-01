import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayerRemote} from '../src/remote-controls.js';
function setup(){
 let visible=false,watching=true,time=0,serial=0;const timers=new Map(),calls=[];
 const remote=new PlayerRemote({isWatching:()=>watching,getPlayer:()=>({isMenuVisible:()=>visible,showMenu:()=>{visible=true;calls.push('show');},guide:()=>{watching=false;calls.push('guide');},spelunk:()=>calls.push('spelunk')}),shortOK:()=>calls.push('short'),now:()=>time,setTimer:(fn,ms)=>{timers.set(++serial,{fn,at:time+ms});return serial;},clearTimer:id=>timers.delete(id)});
 const event=(key,extra={})=>({key,target:{},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
 const advance=ms=>{time+=ms;for(const [id,timer]of timers)if(timer.at<=time){timers.delete(id);timer.fn();}};
 return {remote,event,advance,calls,setVisible:v=>visible=v,setWatching:v=>watching=v};
}
test('Up and Down show menu without reaching the upstream channel-switch handler',()=>{
 const t=setup();for(const key of ['ArrowUp','ArrowDown']){const e=t.event(key);t.remote.keydown(e);assert.ok(e.prevented&&e.stopped);}assert.deepEqual(t.calls,['show','show']);
 const ch=t.event('Unidentified',{keyCode:427});t.remote.keydown(ch);assert.equal(ch.prevented,undefined);
});
test('Back shows hidden controls, then returns to guide; held Back cannot skip both steps',()=>{
 const t=setup();t.remote.keydown(t.event('GoBack',{keyCode:461}));t.remote.keydown(t.event('GoBack',{keyCode:461,repeat:true}));assert.deepEqual(t.calls,['show']);
 t.remote.keydown(t.event('GoBack',{keyCode:461}));assert.deepEqual(t.calls,['show','guide']);
});
test('short OK activates a visible menu control on release',()=>{
 const t=setup();t.setVisible(true);t.remote.keydown(t.event('Enter'));t.advance(200);assert.deepEqual(t.calls,[]);t.remote.keyup(t.event('Enter'));t.advance(800);assert.deepEqual(t.calls,['short']);
});
test('held OK spelunks once, ignores repeats, and suppresses release click and short action',()=>{
 const t=setup();t.remote.keydown(t.event('Enter'));t.advance(1999);assert.deepEqual(t.calls,[]);t.advance(1);t.remote.keydown(t.event('Enter',{repeat:true}));t.advance(1000);assert.deepEqual(t.calls,['spelunk']);
 t.remote.keyup(t.event('Enter'));const click=t.event('click');t.remote.click(click);assert.ok(click.prevented);t.advance(351);const later=t.event('click');t.remote.click(later);assert.equal(later.prevented,undefined);assert.deepEqual(t.calls,['spelunk']);
});
test('guide/dialog context keeps native navigation and blur cancels a pending hold',()=>{
 const t=setup();t.remote.keydown(t.event('Enter'));t.remote.cancel();t.advance(1000);t.remote.keyup(t.event('Enter'));assert.deepEqual(t.calls,[]);
 t.setWatching(false);const e=t.event('ArrowUp');t.remote.keydown(e);assert.equal(e.prevented,undefined);
});

test('default timers do not bind browser timer functions to the remote controller',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const source=await readFile(new URL('../src/remote-controls.js',import.meta.url),'utf8');
 let callback,cleared=false;
 const context={setTimeout:function(fn){assert.equal(this,undefined);callback=fn;return 1;},clearTimeout:function(){assert.equal(this,undefined);cleared=true;}};
 runInNewContext(source.replace('export class PlayerRemote','class PlayerRemote')+';globalThis.Controller=PlayerRemote;',context);
 let spelunks=0;
 const remote=new context.Controller({getPlayer:()=>({isMenuVisible:()=>false,spelunk:()=>spelunks++}),isWatching:()=>true,shortOK:()=>assert.fail('hold must not short-click')});
 const event={key:'Enter',preventDefault(){},stopImmediatePropagation(){}};
 remote.keydown(event);callback();remote.keyup(event);
 assert.equal(spelunks,1);assert.ok(cleared);
});

test('releasing an incomplete hold cancels it without activating the short OK action',()=>{
 const t=setup();let shown=0,hidden=0;t.remote.onHoldStart=ms=>{shown++;assert.equal(ms,2000);};t.remote.onHoldEnd=()=>hidden++;
 t.remote.keydown(t.event('Enter'));t.advance(1500);t.remote.keyup(t.event('Enter'));t.advance(3000);
 assert.equal(shown,1);assert.equal(hidden,1);assert.deepEqual(t.calls,[]);
});
test('another key cancels the hold indicator and pending Spelunk',()=>{
 const t=setup();let hidden=0;t.remote.onHoldEnd=()=>hidden++;
 t.remote.keydown(t.event('Enter'));t.advance(1000);t.remote.keydown(t.event('GoBack',{keyCode:461}));t.advance(4000);
 assert.ok(hidden>0);assert.deepEqual(t.calls,['show']);
});


test('a quick OK while the overlay is hidden does not open or activate it',()=>{
 const t=setup();t.remote.keydown(t.event('Enter'));t.advance(100);t.remote.keyup(t.event('Enter'));t.advance(2500);assert.deepEqual(t.calls,[]);
});
test('holding OK while the overlay is visible never starts the Spelunk timer',()=>{
 const t=setup();t.setVisible(true);let shown=0;t.remote.onHoldStart=()=>shown++;
 t.remote.keydown(t.event('Enter'));t.advance(3000);t.remote.keyup(t.event('Enter'));
 assert.equal(shown,0);assert.deepEqual(t.calls,[]);
});
test('a hidden-video hold is canceled if the overlay becomes visible before completion',()=>{
 const t=setup();t.remote.keydown(t.event('Enter'));t.advance(1000);t.setVisible(true);t.advance(1000);t.remote.keyup(t.event('Enter'));assert.deepEqual(t.calls,[]);
});
