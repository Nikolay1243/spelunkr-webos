import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parse} from 'acorn';
import {adaptPlayer} from '../scripts/adapt-player.mjs';
const snapshot=JSON.parse(await readFile(new URL('../vendor/site/snapshot.json',import.meta.url)));
const source=await readFile(new URL('../vendor/site'+snapshot.main,import.meta.url),'utf8');
const adapted=adaptPlayer(source);
const ast=parse(adapted,{ecmaVersion:2022,sourceType:'module'});
function load(name){const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return runInNewContext('('+adapted.slice(node.start,node.end)+')');}
test('stored and URL CRT modes cannot change the flat-TV layout',()=>{
 const mode=load('Ok');
 for(const stored of ['stretched','centered',null])for(const query of ['?tv=1','?tv=1&crt=stretched','?tv=1&crt=centered'])assert.equal(mode(query,stored),null);
});
test('the original CRT component renders no button or panel',()=>{
 const component=load('Uk');assert.equal(component({mode:'centered',channel:'test',watching:true}),null);
});
