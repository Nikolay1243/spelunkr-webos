import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWheel,consumeWheel,wheelAction,WHEEL_STEP} from '../src/wheel-steps.js';

test('wheel deltas normalize to "down is positive"',()=>{
 assert.equal(normalizeWheel({deltaY:120}),120);
 assert.equal(normalizeWheel({deltaY:-120}),-120);
 assert.equal(normalizeWheel({deltaMode:1,deltaY:3}),48);          // 3 lines
 assert.equal(normalizeWheel({wheelDelta:-120}),120);             // legacy: up is positive
 assert.equal(normalizeWheel({wheelDelta:120}),-120);
 assert.equal(normalizeWheel({deltaY:0}),0);
 assert.equal(normalizeWheel(null),0);
});

test('the default step matches one wheel notch',()=>{
 assert.equal(WHEEL_STEP,100);
 assert.equal(consumeWheel(0,100).notches,1);
 assert.equal(consumeWheel(0,120).notches,1);       // LG sends 100-120 per notch
 assert.equal(consumeWheel(0,240).notches,2);       // a fast spin
});

test('a notch only fires once the accumulated delta is big enough',()=>{
 let state=consumeWheel(0,20);
 assert.equal(state.notches,0);
 assert.equal(state.rest,20);
 state=consumeWheel(state.rest,20);
 assert.equal(state.notches,0);                     // still under one notch
 assert.equal(state.rest,40);
 assert.equal(consumeWheel(state.rest,60).notches,1);
});

test('sign carries through, so scrolling up goes back',()=>{
 assert.equal(consumeWheel(0,-80,40).notches,-2);
 assert.equal(consumeWheel(0,-100).notches,-1);
});

test('reversing direction drops the leftover from the other way',()=>{
 // 70 down then 100 up should act on the up notch, not be eaten by the leftover
 assert.equal(consumeWheel(70,-100,100).notches,-1);
 assert.equal(consumeWheel(-70,100,100).notches,1);
});

test('watching adjusts volume, scrolling down is quieter',()=>{
 const down=wheelAction({notches:1,watching:true});
 assert.equal(down.kind,'volume');
 assert.equal(down.key,'ArrowDown');
 assert.equal(down.step,-0.05);
 const up=wheelAction({notches:-1,watching:true});
 assert.equal(up.key,'ArrowUp');
 assert.equal(up.step,0.05);
 // a violent spin must not slam the volume to an extreme
 assert.ok(Math.abs(wheelAction({notches:9,watching:true}).step)<=0.1501);
 assert.ok(wheelAction({notches:9,watching:true}).count<=6);
 // channel changes belong to the left/right buttons, not the wheel
 assert.notEqual(down.kind,'channel');
});

test('the guide moves the highlight',()=>{
 assert.deepEqual(wheelAction({notches:1,guideOpen:true}),{kind:'guide',key:'ArrowDown'});
 assert.deepEqual(wheelAction({notches:-1,guideOpen:true}),{kind:'guide',key:'ArrowUp'});
});

test('nothing happens with no notch, a dialog, or no known screen',()=>{
 assert.equal(wheelAction({notches:0,guideOpen:true}),null);
 assert.equal(wheelAction({notches:1,watching:true,dialogOpen:true}),null);
 assert.equal(wheelAction({notches:1}),null);
});
