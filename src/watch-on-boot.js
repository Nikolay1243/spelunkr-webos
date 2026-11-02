/**
 * Watch on boot: a TV app should come up on the picture.
 *
 * The client boots into its website home layout, where the player is a ~544x408
 * preview tile in the upper-left and the channel plays inside that tile. On a TV
 * that reads as a broken, half-size picture, and a channel change shows the tuning
 * slate in the corner of that tile instead of on screen.
 *
 * The client already has the affordance to go full-screen: the preview tile is
 * `.stage-video-wrap.clickable` and clicking it switches the app to `app--watch`.
 * This promotes to that mode once, shortly after playback starts, and never fights
 * the user: it stands down if they are already watching, if they navigate away,
 * or if the first attempt does not take.
 */
(function () {
  'use strict';

  var POLL_MS = 700;
  var GIVE_UP_MS = 15000;
  var SETTLE_MS = 1500;   // let the app render before the first attempt
  var RETRY_MS = 1200;    // spacing between attempts
  var started = Date.now();
  var attempts = 0;
  var lastAttemptAt = 0;
  var done = false;
  var timer = null;

  function say(state) {
    window.__spelunkrAutoWatch = state;
  }

  function appClass() {
    var app = document.querySelector('.app');
    return app ? String(app.className) : '';
  }

  function isWatch() {
    return appClass().indexOf('app--watch') !== -1;
  }

  function onGuideRoute() {
    // only promote the root/watch experience, never a deep link
    var hash = String(location.hash || '');
    return hash === '' || hash === '#/' || /route=%2F(&|$)/.test(hash);
  }

  function stop(state) {
    done = true;
    if (timer) clearInterval(timer);
    if (state === 'already-watch' && attempts > 0) state = 'promoted:' + attempts;
    say(state);
  }

  function tick() {
    if (done) return;
    var now = Date.now();

    if (now - started > GIVE_UP_MS) return stop('skipped:timeout');
    if (isWatch()) return stop('already-watch');
    if (!onGuideRoute()) return stop('skipped:route');

    // Wait for the app to render its player, but do NOT require playback: on some
    // boots the channel only starts once watch mode is entered, and requiring a
    // playing video left the app sitting on the guide.
    var tile = document.querySelector('.stage-video-wrap.clickable') ||
               document.querySelector('.stage-video-wrap');
    if (!tile || !document.querySelector('video')) return;
    if (now - started < SETTLE_MS) return;

    if (attempts >= 3) return stop('skipped:no-effect');
    if (now - lastAttemptAt < RETRY_MS) return;

    attempts += 1;
    lastAttemptAt = now;
    try {
      tile.click();
    } catch (err) {
      return stop('failed:' + (err && err.message ? err.message : 'click'));
    }
    say('promoting:' + attempts);
  }

  // Stand down the moment the user takes over: they either already went
  // full-screen themselves or deliberately opened the guide.
  function onUserKey() {
    if (done) return;
    setTimeout(function () {
      if (done) return;
      stop(isWatch() ? 'user:watch' : 'user:key');
    }, 1200);
  }

  function start() {
    timer = setInterval(tick, POLL_MS);
    document.addEventListener('keydown', onUserKey, true);
    tick();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
}());
