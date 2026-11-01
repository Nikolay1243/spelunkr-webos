import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitVideo} from '../src/video-layout.js';
test('4:3 tape has a 1440×1080 hardware plane, centered with side bars on a 1080p TV',()=>{
 assert.deepEqual(fitVideo(1920,1080,640,480),{width:1440,height:1080,left:240,top:0});
});
test('wide tape fits without cropping and adapts to the original guide preview',()=>{
 assert.deepEqual(fitVideo(1920,1080,1920,1080),{width:1920,height:1080,left:0,top:0});
 const fit=fitVideo(720,405,640,480);assert.deepEqual(fit,{width:540,height:405,left:90,top:0});
});
test('metadata unavailable or collapsed containers do not produce invalid sizing',()=>{
 assert.equal(fitVideo(1920,1080,0,0),null);assert.equal(fitVideo(0,0,640,480),null);
});
