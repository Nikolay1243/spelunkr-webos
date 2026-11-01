import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizedRemoteKey} from '../src/remote-keys.js';
test('physical Magic Remote CH events captured on the TV switch channels',()=>{
 assert.equal(normalizedRemoteKey({key:'PageUp',keyCode:33}),'ChannelUp');
 assert.equal(normalizedRemoteKey({key:'PageDown',keyCode:34}),'ChannelDown');
 assert.equal(normalizedRemoteKey({key:'PageUp',keyCode:0}),'ChannelUp');
 assert.equal(normalizedRemoteKey({key:'PageDown',keyCode:0}),'ChannelDown');
});
test('D-pad stays separate from CH rocker and other media devices remain supported',()=>{
 for(const [key,keyCode]of [['ArrowUp',38],['ArrowDown',40]])assert.equal(normalizedRemoteKey({key,keyCode}),null);
 assert.equal(normalizedRemoteKey({key:'Unidentified',keyCode:427}),'ChannelUp');
 assert.equal(normalizedRemoteKey({key:'Unidentified',keyCode:428}),'ChannelDown');
 assert.equal(normalizedRemoteKey({key:'Unidentified',keyCode:415}),'MediaPlay');
});
