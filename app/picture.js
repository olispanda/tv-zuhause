/* Standby: after a period without remote input on the visible launcher, show the live Zürich HB map
   (standby/index.html) full-screen – or a single picture in 'picture' mode. Any key or click hides it again
   and is not passed to the launcher. The map is created on show and removed on hide, so it uses no network
   or CPU while the launcher is in use. Runs only while CleanFrame is visible; it cannot show anything in TV standby. */
(function () {
  'use strict';

  var CONFIG = {
    mode: 'map',                                      // 'map' (live Zürich HB map) or 'picture'
    idleMinutes: 5,                                   // minutes without a key press before standby starts
    map: 'standby/index.html',
    src: 'assets/picture/bild.jpg',                   // picture mode: own image (1920x1080 or 3840x2160)
    fallback: 'assets/wallpapers/alpine.jpg',         // picture mode: if bild.jpg is missing
    fadeMs: 1200, maxMinutes: 120
  };
  var QA = window.ShoreQA = window.ShoreQA || {};
  var minuteMs = QA.minuteMs || 60000;

  var layer = document.createElement('div'), content = null;
  var timer = 0, maxTimer = 0, shown = false;
  layer.id = 'picture';
  layer.className = 'picture';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.transitionDuration = CONFIG.fadeMs + 'ms';

  function makeContent() {
    if (CONFIG.mode === 'map') {
      var frame = document.createElement('iframe');
      frame.src = CONFIG.map;
      frame.setAttribute('tabindex', '-1');           // the launcher keeps focus, so the remote still reaches it
      frame.setAttribute('scrolling', 'no');
      return frame;
    }
    var img = document.createElement('img'), triedFallback = false;
    img.alt = '';
    img.onerror = function () { if (!triedFallback) { triedFallback = true; img.src = CONFIG.fallback; } };
    img.src = CONFIG.src;
    return img;
  }

  function screenSaver(on) {
    /* Keep Samsung's own screen saver from replacing the standby view while it is shown. */
    try {
      var common = window.webapis && window.webapis.appcommon;
      if (common && common.setScreenSaver) common.setScreenSaver(on ? common.AppCommonScreenSaverState.SCREEN_SAVER_ON : common.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
    } catch (e) { /* not available outside the TV */ }
  }
  function show() {
    if (shown || document.hidden) return;
    shown = true;
    content = makeContent();
    layer.appendChild(content);
    layer.className = 'picture is-shown';
    screenSaver(false);
    clearTimeout(maxTimer); maxTimer = setTimeout(hide, CONFIG.maxMinutes * minuteMs);
  }
  function hide() {
    if (!shown) return;
    shown = false;
    layer.className = 'picture';
    clearTimeout(maxTimer); maxTimer = 0;
    screenSaver(true);
    var old = content;
    content = null;
    // Remove after the fade so the map stops polling and rendering.
    setTimeout(function () { if (old && old.parentNode) old.parentNode.removeChild(old); }, CONFIG.fadeMs);
  }
  function arm() {
    clearTimeout(timer);
    timer = 0;
    if (!document.hidden) timer = setTimeout(show, CONFIG.idleMinutes * minuteMs);
  }
  function wake(ev) {
    if (shown) {
      /* The waking key only dismisses standby. */
      ev.preventDefault();
      ev.stopImmediatePropagation();
      hide();
    }
    arm();
  }

  /* Capture on window runs before the launcher's document listeners. */
  window.addEventListener('keydown', wake, true);
  window.addEventListener('click', wake, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) hide(); arm(); });

  function start() { (document.getElementById('stage') || document.body).appendChild(layer); arm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  QA.picture = {
    show: show, hide: hide,
    state: function () { return { shown: shown, mode: CONFIG.mode, loaded: !!content, idleMinutes: CONFIG.idleMinutes }; }
  };
})();
