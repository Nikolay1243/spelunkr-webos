/**
 * Boot guard for the webOS package.
 *
 * The packaged app is a thin shell that loads a large bundled app.js. If that
 * bundle never boots, the TV shows nothing but the requestor's own placeholder
 * for ever: `script.onerror` does not fire for a *parse* error, and a runtime
 * throw before the first render is silent. That is indistinguishable from the TV
 * hanging, and from webOS 6 (Chromium 79) it is not a rare failure -- any bundle
 * built for a newer engine lands exactly there.
 *
 * This script is plain ES5, loaded before app.js, and does two things:
 *
 *   1. surfaces the failure on screen (message + what to do) instead of a frozen
 *      "PLEASE STAND BY";
 *   2. retries automatically (bounded, so a broken build cannot reload-loop) and
 *      reloads on OK/Back so a transient fault is one remote press away from a
 *      working channel.
 *
 * It stays out of the way when the app boots normally: the moment #app contains
 * anything other than the placeholder, the guard disarms.
 */
(function () {
  'use strict';

  // Visible marker: lets a bug report (or the inspector) prove whether this file
  // was even fetched and executed, which is the first thing to check when the
  // failure surface does not appear.
  window.__spelunkrBootGuard = 'armed';

  var PLACEHOLDER = 'PLEASE STAND BY';
  var BOOT_TIMEOUT_MS = 12000;
  var AUTO_RETRY_DELAY_MS = 6000;
  var MAX_AUTO_RETRIES = 2;
  var COUNTER_KEY = 'spelunkr-webos-boot-retries';

  var startedAt = Date.now();
  var armed = true;
  var timer = null;
  var retryTimer = null;
  var failure = null;

  function appEl() {
    return document.getElementById('app') || document.body;
  }

  function placeholderStillShowing() {
    var node = document.getElementById('app');
    if (!node) return false;
    var text = (node.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return text === '' || text.indexOf(PLACEHOLDER) !== -1;
  }

  function retries() {
    try { return parseInt(window.sessionStorage.getItem(COUNTER_KEY) || '0', 10) || 0; }
    catch (error) { return 0; }
  }

  function countRetry() {
    try { window.sessionStorage.setItem(COUNTER_KEY, String(retries() + 1)); } catch (error) {}
  }

  function disarm() {
    armed = false;
    window.__spelunkrBootGuard = 'disarmed';
    if (timer) { clearTimeout(timer); timer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }

  function reload(reason) {
    if (retries() >= MAX_AUTO_RETRIES + 1) {
      render('Too many restarts', 'Press OK to try once more, or Back to leave the app.');
      return;
    }
    countRetry();
    window.location.reload();
    return reason;
  }

  function describe(error) {
    if (!error) return 'the bundle did not start';
    if (error.name && error.message) return error.name + ': ' + error.message;
    return String(error);
  }

  function render(headline, hint, detail) {
    var node = appEl();
    node.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.setAttribute('style', [
      'position:fixed', 'inset:0', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:18px', 'text-align:center',
      'background:#1c0a57', 'color:#ffe200', 'font:24px/1.5 monospace', 'padding:64px',
    ].join(';'));

    var title = document.createElement('div');
    title.setAttribute('style', 'font-size:44px;letter-spacing:2px;font-weight:700');
    title.textContent = headline;
    wrap.appendChild(title);

    var body = document.createElement('div');
    body.setAttribute('style', 'max-width:1200px;color:#ffffff;opacity:.92');
    body.textContent = hint;
    wrap.appendChild(body);

    if (detail) {
      var pre = document.createElement('div');
      pre.setAttribute('style', 'max-width:1400px;color:#ffb3b3;font-size:18px;opacity:.85;word-break:break-word');
      pre.textContent = detail;
      wrap.appendChild(pre);
    }

    var keys = document.createElement('div');
    keys.setAttribute('style', 'margin-top:12px;font-size:20px;opacity:.8');
    keys.textContent = 'OK = retry    BACK = exit';
    wrap.appendChild(keys);

    node.appendChild(wrap);
  }

  function fail(reason, detail) {
    if (!armed) return;
    failure = reason;
    disarm();
    window.__spelunkrBootGuard = 'failed: ' + reason;
    render('SIGNAL LOST', reason, detail);

    var attempts = retries();
    if (attempts < MAX_AUTO_RETRIES) {
      var countdown = document.createElement('div');
      countdown.setAttribute('style', 'font-size:18px;opacity:.7');
      var text = document.createElement('span');
      countdown.appendChild(text);
      appEl().firstChild.appendChild(countdown);
      var left = Math.round(AUTO_RETRY_DELAY_MS / 1000);
      text.textContent = 'retrying in ' + left + 's';
      var ticker = setInterval(function () {
        left -= 1;
        if (left <= 0) { clearInterval(ticker); text.textContent = 'retrying…'; return; }
        text.textContent = 'retrying in ' + left + 's';
      }, 1000);
      retryTimer = setTimeout(function () { clearInterval(ticker); reload(reason); }, AUTO_RETRY_DELAY_MS);
    }
  }

  // A parse error in app.js arrives here with the message but no useful stack;
  // this is the case the TV used to swallow completely.
  window.addEventListener('error', function (event) {
    if (!armed) return;
    var source = event.filename || '';
    if (source && source.indexOf('app.js') === -1) return;
    if (!event.message && !event.error) return;
    fail('The app bundle failed to load', describe(event.error) + (event.message && !event.error ? ' (' + event.message + ')' : ''));
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    if (!armed) return;
    if (!placeholderStillShowing()) return;
    fail('The app stopped while starting', describe(event.reason));
  });

  function onKey(event) {
    if (!failure) return;
    var code = event.keyCode || event.which;
    if (code === 13) {             // OK on the Magic Remote
      event.preventDefault();
      event.stopPropagation();
      try { window.sessionStorage.setItem(COUNTER_KEY, '0'); } catch (error) {}
      window.location.reload();
    } else if (code === 461) {     // Back
      event.preventDefault();
      event.stopPropagation();
      try { window.history.back(); } catch (error) {}
      if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
    }
  }
  document.addEventListener('keydown', onKey, true);

  // Watchdog: the placeholder is still up after the boot budget, so nothing
  // rendered and the error path never fired (silent hang).
  timer = setTimeout(function () {
    if (!armed) return;
    if (!placeholderStillShowing()) { disarm(); return; }
    fail('The app did not start', 'The bundle loaded but never rendered. This usually means a script error before the first screen.');
  }, BOOT_TIMEOUT_MS);

  // Success path: hand over as soon as the app paints something of its own.
  var poll = setInterval(function () {
    if (Date.now() - startedAt > BOOT_TIMEOUT_MS * 4) { clearInterval(poll); return; }
    if (!armed) { clearInterval(poll); return; }
    if (!placeholderStillShowing()) { disarm(); clearInterval(poll); }
  }, 250);
})();
