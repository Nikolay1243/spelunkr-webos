import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const shim = await readFile(new URL('../src/legacy-shims.js', import.meta.url), 'utf8');

// A bare context -- no structuredClone, no crypto -- i.e. Chromium 79 on webOS 6.
// Fixtures are built inside that context so each object lives in the same realm
// as the shim, the way it does in the packaged bundle.
function chromium79() {
  const sandbox = {};
  runInNewContext(shim, sandbox);
  return sandbox;
}

test('provides structuredClone with deep-copy semantics', () => {
  const global = chromium79();
  assert.equal(typeof global.structuredClone, 'function');

  const source = runInNewContext(`({
    channel: {id: 'g4-icons', number: 55, tags: ['2003', 'xbox']},
    cues: [{at: 0, text: 'x'}],
    when: new Date(1600000000000),
    nothing: null,
    count: 3
  })`, global);
  const clone = global.structuredClone(source);

  assert.deepStrictEqual(clone, source);
  assert.notEqual(clone, source);
  assert.notEqual(clone.channel, source.channel);
  assert.notEqual(clone.channel.tags, source.channel.tags);
  assert.notEqual(clone.when, source.when);

  clone.channel.tags.push('mutated');
  clone.cues[0].text = 'mutated';
  // Values, not identities: the fixtures below are built in a vm realm, so
  // prototype-sensitive deep comparisons are not meaningful here.
  assert.equal(source.channel.tags.length, 2);
  assert.equal(source.channel.tags[0], '2003');
  assert.equal(source.channel.tags[1], 'xbox');
  assert.equal(source.cues[0].text, 'x');
});

test('structuredClone survives cycles instead of recursing forever', () => {
  const global = chromium79();
  const source = runInNewContext(`(() => {
    const node = {name: 'root', child: {name: 'leaf'}};
    node.child.parent = node;
    return node;
  })()`, global);

  const clone = global.structuredClone(source);
  assert.equal(clone.name, 'root');
  assert.equal(clone.child.parent, clone);
  assert.notEqual(clone.child.parent, source);
});

test('structuredClone keeps Map and Set contents', () => {
  const global = chromium79();
  const source = runInNewContext(`({
    map: new Map([['a', {deep: 1}]]),
    set: new Set(['x', 'y'])
  })`, global);

  const clone = global.structuredClone(source);
  assert.equal(clone.map.get('a').deep, 1);
  assert.notEqual(clone.map.get('a'), source.map.get('a'));
  assert.deepStrictEqual(Array.from(clone.set), ['x', 'y']);
});

test('keeps a native structuredClone when the browser has one', () => {
  const native = () => 'native';
  const sandbox = {structuredClone: native};
  runInNewContext(shim, sandbox);
  assert.equal(sandbox.structuredClone, native);
});

test('provides a v4 crypto.randomUUID that does not repeat', () => {
  const global = chromium79();
  assert.equal(typeof global.crypto.randomUUID, 'function');

  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const seen = new Set();
  for (let index = 0; index < 500; index += 1) {
    const id = global.crypto.randomUUID();
    assert.match(id, pattern);
    seen.add(id);
  }
  assert.equal(seen.size, 500);
});

test('keeps a native crypto.randomUUID when the browser has one', () => {
  const native = () => '2a4f6a1e-0000-4000-8000-000000000000';
  const sandbox = {crypto: {randomUUID: native}};
  runInNewContext(shim, sandbox);
  assert.equal(sandbox.crypto.randomUUID, native);
});
