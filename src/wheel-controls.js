// Magic Remote wheel -> volume while watching, guide scrolling in the guide.
//
// webOS delivers the wheel as a DOM `wheel`/`mousewheel` event rather than a key,
// so the app's key handling never saw it and the wheel did nothing at all.
// Channel changes belong to the left/right buttons, not to the wheel.
import { normalizeWheel, consumeWheel, wheelAction, WHEEL_STEP } from './wheel-steps.js';

(function () {
  'use strict';

  var accumulated = 0;
  var stats = { events: 0, guide: 0, volume: 0, ignored: 0, notches: 0, last: 0, mode: 0, why: '' };

  function say() {
    window.__spelunkrWheel = {
      events: stats.events, guide: stats.guide, volume: stats.volume,
      ignored: stats.ignored, notches: stats.notches, rest: Math.round(accumulated),
      last: stats.last, deltaMode: stats.mode, why: stats.why
    };
  }

  function watching() {
    var app = document.querySelector('.app');
    return !!app && String(app.className).indexOf('app--watch') !== -1;
  }
  function guideOpen() {
    return !!document.querySelector('.app--guide, .stage--guide');
  }

  // Only a real text field should swallow the wheel. The player keeps the volume
  // range input focused, which is not a reason to ignore the wheel.
  function dialogOpen() {
    if (document.querySelector('[role="dialog"], .cc-panel')) return 'dialog';
    var active = document.activeElement;
    if (active && active.matches && active.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, [contenteditable="true"]')) return 'text-input';
    return '';
  }

  // Without the player API (the repackage build) the volume slider is the only
  // handle on the app's own volume state. React tracks values through the native
  // setter, so that is what has to be used before firing `input`.
  function sliderVolume(step) {
    var slider = document.querySelector('input.player-volume-slider');
    if (!slider) return false;
    var next = Math.max(0, Math.min(1, parseFloat(slider.value) + step));
    var native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (native && native.set) native.set.call(slider, String(next));
    else slider.value = String(next);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function key(name) {
    var event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    Object.defineProperty(event, '__webosWheel', { value: true });
    (document.activeElement || document.body).dispatchEvent(event);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
  }

  function onWheel(event) {
    var deltaY = normalizeWheel(event);
    if (!deltaY) return;
    stats.events += 1;
    stats.last = Math.round(deltaY);
    stats.mode = event.deltaMode || 0;

    var consumed = consumeWheel(accumulated, deltaY, WHEEL_STEP);
    accumulated = consumed.rest;
    if (!consumed.notches) { say(); return; }

    var blocked = dialogOpen();
    var action = wheelAction({
      notches: consumed.notches,
      watching: watching(),
      guideOpen: guideOpen(),
      dialogOpen: !!blocked
    });
    if (!action) {
      stats.ignored += 1;
      stats.why = blocked || 'no-screen';
      say();
      return;
    }

    // The page must not scroll underneath the player as well.
    event.preventDefault();
    stats.notches += Math.abs(consumed.notches);
    if (action.kind === 'volume') {
      stats.volume += 1;
      var player = window.SpelunkrWebOS && window.SpelunkrWebOS.player;
      if (player && typeof player.changeVolume === 'function') {
        // The player's own volume state, so its slider and OSD stay in sync.
        player.changeVolume(action.step);
      } else if (!sliderVolume(action.step)) {
        // Last resort: the player's own ArrowUp/ArrowDown handling.
        for (var i = 0; i < action.count; i += 1) key(action.key);
      }
    } else {
      stats.guide += 1;
      key(action.key);
    }
    say();
  }

  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('mousewheel', onWheel, { capture: true, passive: false });
  say();
}());
