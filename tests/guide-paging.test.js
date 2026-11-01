import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guidePageTop} from '../src/guide-paging.js';
const grid={top:288,height:480,scrollHeight:2352,headerHeight:48,rowHeight:72};
test('guide advances one visible page of complete rows',()=>{
 assert.equal(guidePageTop(grid,1),720);
 assert.equal(guidePageTop({...grid,top:720},-1),288);
});
test('guide paging stops at top and bottom without wrapping',()=>{
 assert.equal(guidePageTop({...grid,top:0},-1),0);
 assert.equal(guidePageTop({...grid,top:1850},1),1872);
 assert.equal(guidePageTop({...grid,scrollHeight:400,top:0},1),0);
});
