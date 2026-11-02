/**
 * Channel coalescing: one tune per burst instead of one per press.
 *
 * The client handles CH+/CH- itself and tunes once for every press, so mashing
 * the button five times queues five tunes: ~5s each, and the picture is stuck on
 * the tuning slate for half a minute.
 *
 * The app can address a channel directly, though: the guide rows are in the DOM
 * even while watching (`.grid-row[data-channel]`), clicking a row selects it, and
 * `SpelunkrWebOS.guide.tuneSelected()` tunes the selection. So a burst of N presses
 * becomes: select active+N, tune once.
 *
 * Falls back to the original key event whenever the guide rows or the bridge are
 * not available, so behaviour can only get better, not stuck.
 */
(function () {
  'use strict';

  var DEBOUNCE_MS = 260;
  var pending = 0;
  var timer = null;

  function say(state) {
    window.__spelunkrChannelBurst = state;
  }

  function isChannelKey(event) {
    var k = event.key || '';
    return event.keyCode === 33 || event.keyCode === 34 || k === 'ChannelUp' || k === 'ChannelDown';
  }

  function up(event) {
    return event.keyCode === 33 || event.key === 'ChannelUp';
  }

  function isWatching() {
    var app = document.querySelector('.app');
    return !!app && String(app.className).indexOf('app--watch') !== -1;
  }

  function rows() {
    var list = [];
    var nodes = document.querySelectorAll('.grid-row[data-channel]');
    for (var i = 0; i < nodes.length; i += 1) list.push(nodes[i]);
    return list;
  }

  function activeIndex(list) {
    var guide = window.SpelunkrWebOS && window.SpelunkrWebOS.guide;
    var id = guide ? (guide.activeChannel || guide.selectedChannel) : null;
    if (typeof id === 'string') {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].getAttribute('data-channel') === id) return i;
      }
    }
    for (var j = 0; j < list.length; j += 1) {
      if (String(list[j].className).indexOf('highlighted') !== -1) return j;
    }
    return -1;
  }

  function fallbackToVendor(delta) {
    // We swallowed the key, so replay it if the direct path is unavailable:
    // slow (one tune per press) but correct, and never a dead button.
    var keyCode;
    var name;
    if (delta > 0) { keyCode = 33; name = 'ChannelUp'; } else { keyCode = 34; name = 'ChannelDown'; }
    var count = Math.abs(delta);
    say('fallback:replay:' + count);
    setTimeout(function () {
      for (var i = 0; i < count; i += 1) {
        var e = new KeyboardEvent('keydown', { key: name, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true });
        document.dispatchEvent(e);
        document.dispatchEvent(new KeyboardEvent('keyup', { key: name, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true }));
      }
    }, 60);
  }

  function apply(delta) {
    var list = rows();
    var guide = window.SpelunkrWebOS && window.SpelunkrWebOS.guide;
    if (!list.length || !guide || typeof guide.tuneSelected !== 'function') { fallbackToVendor(delta); return 'fallback:no-api'; }

    var from = activeIndex(list);
    if (from < 0) { fallbackToVendor(delta); return 'fallback:no-active'; }

    var to = ((from + delta) % list.length + list.length) % list.length;
    if (to === from) return 'noop';

    try {
      list[to].click();
    } catch (err) {
      fallbackToVendor(delta);
      return 'fallback:click';
    }

    var target = list[to].getAttribute('data-channel');
    // let selection propagate before tuning, exactly like an arrow + OK would
    setTimeout(function () {
      try {
        window.SpelunkrWebOS.guide.tuneSelected();
        say('tuned:' + target);
      } catch (err) {
        say('failed:tune:' + (err && err.message ? err.message : 'error'));
      }
    }, 90);
    return 'select:' + target;
  }

  function settle() {
    timer = null;
    var delta = pending;
    pending = 0;
    if (!delta) return;
    say(apply(delta));
  }

  function onKeyDown(event) {
    if (!isChannelKey(event)) return;
    if (!isWatching()) return;   // never touch keys outside watch mode
    if (event.repeat) {
      // a held button is a burst too; never let the vendor start a tune per repeat
      pending += up(event) ? 1 : -1;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!timer) timer = setTimeout(settle, DEBOUNCE_MS);
      return;
    }

    pending += up(event) ? 1 : -1;
    event.preventDefault();
    event.stopImmediatePropagation();
    say('burst:' + pending);
    if (timer) clearTimeout(timer);
    timer = setTimeout(settle, DEBOUNCE_MS);
  }

  // The Magic Remote wheel drives the same burst path as the CH rocker, so a
  // fast spin tunes once instead of once per notch.
  function channelStep(delta) {
    if (!delta) return;
    pending += delta;
    say('burst:' + pending);
    if (timer) clearTimeout(timer);
    timer = setTimeout(settle, DEBOUNCE_MS);
  }
  window.SpelunkrWebOS = window.SpelunkrWebOS || {};
  window.SpelunkrWebOS.channelStep = channelStep;

  window.addEventListener('keydown', onKeyDown, true);
  say('armed');
}());
