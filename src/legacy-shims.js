/**
 * Runtime shims for webOS 6.x (LG C1 and older — Chromium 79).
 *
 * `target: 'chrome79'` in scripts/build.mjs degrades the *syntax* the packaged
 * client uses (nullish coalescing, optional chaining, class fields) to ES2019
 * form. It cannot polyfill APIs that simply do not exist in that browser, and
 * the client calls two of them:
 *
 *   structuredClone    — Chrome 98
 *   crypto.randomUUID  — Chrome 92
 *
 * Both shims are no-ops when the real implementation exists (webOS 9.x ships
 * Chromium 110+). This module is imported first in the build entry so the shims
 * are installed before any bundled application code runs.
 */

if (typeof globalThis.structuredClone !== 'function') {
  // Deep clone for plain data (the app clones channel/guide records). Types are
  // detected with Object.prototype.toString so a value that crossed a realm (or a
  // future nested context) is still recognised.
  var sp_tag = function (value) { return Object.prototype.toString.call(value); };
  var sp_clone = function (value, seen) {
    if (value === null || typeof value !== 'object') return value;
    var tag = sp_tag(value);
    if (tag === '[object Date]') return new Date(value.getTime());
    if (tag === '[object RegExp]') return new RegExp(value.source, value.flags);
    if (tag === '[object Map]') {
      var map = new Map();
      value.forEach(function (entryValue, entryKey) {
        map.set(sp_clone(entryKey, seen), sp_clone(entryValue, seen));
      });
      return map;
    }
    if (tag === '[object Set]') {
      var set = new Set();
      value.forEach(function (entryValue) {
        set.add(sp_clone(entryValue, seen));
      });
      return set;
    }
    if (tag === '[object ArrayBuffer]' || (typeof ArrayBuffer === 'function' && ArrayBuffer.isView(value))) {
      return value.slice ? value.slice(0) : value;
    }
    var known = seen && seen.get(value);
    if (known) return known;
    var copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
    if (seen) seen.set(value, copy);
    for (var key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) copy[key] = sp_clone(value[key], seen);
    }
    return copy;
  };
  globalThis.structuredClone = function structuredClone(value) {
    return sp_clone(value, typeof WeakMap === 'function' ? new WeakMap() : null);
  };
}

if (typeof globalThis.crypto !== 'object' || globalThis.crypto === null) {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = function randomUUID() {
    var bytes = new Uint8Array(16);
    if (typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (var index = 0; index < 16; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    var hex = '';
    for (var byte = 0; byte < 16; byte += 1) hex += (bytes[byte] + 0x100).toString(16).slice(1);
    return (
      hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' + hex.slice(20)
    );
  };
}
