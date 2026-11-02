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
// The upstream bundle is minified, so these tests find the adapted functions by
// shape rather than by name: names change with every upstream build.
function load(predicate,what){
 const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&predicate(n));
 if(!node)throw new Error('function not found: '+what);
 return runInNewContext('('+adapted.slice(node.start,node.end)+')');
}
const returnsNullEarly=node=>/^return null;/.test(adapted.slice(node.body.start+1,node.body.start+40));
test('stored and URL CRT modes cannot change the flat-TV layout',()=>{
 const mode=load(n=>n.params.length===2&&returnsNullEarly(n),'CRT query adapter');
 for(const stored of ['stretched','centered',null])for(const query of ['?tv=1','?tv=1&crt=stretched','?tv=1&crt=centered'])assert.equal(mode(query,stored),null);
});
test('the original CRT component renders no button or panel',()=>{
 const component=load(n=>n.params.length===1&&n.params[0].type==='ObjectPattern'&&n.params[0].properties.some(p=>p.key&&p.key.name==='mode')&&returnsNullEarly(n),'CRT layout adapter');
 assert.equal(component({mode:'centered',channel:'test',watching:true}),null);
});
