/* Zürich HB Live – map setup, animation loop and tiles. */
(function () {
  'use strict';
  var C = window.HBConfig, HB = C.hb, COL;
  var stage = document.getElementById('stage'), $ = function (id) { return document.getElementById(id); };
  var TZ = 'Europe/Zurich', last = { trains: [], planes: [] };

  /* ---------- Theme: 'day' / 'night' by the sun at home (?theme=day|night forces one) ---------- */
  function sunElevation(date, lon, lat) {   // degrees; NOAA low-precision formula, plenty for a day/night switch
    var d = date.getTime() / 86400000 - 10957.5, g = (357.529 + 0.98560028 * d) * Math.PI / 180, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180, e = (23.439 - 0.00000036 * d) * Math.PI / 180;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = ((gmst * 15 + lon) * Math.PI / 180) - ra, la = lat * Math.PI / 180;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * 180 / Math.PI;
  }
  var forced = (/[?&]theme=(day|night)/.exec(location.search) || [])[1], themeName = null, theme;
  function pickTheme() {
    var h = (C.home || HB).p;
    return forced || (sunElevation(new Date(), h[0], h[1]) > (C.dayFromSun === undefined ? -6 : C.dayFromSun) ? 'day' : 'night');
  }
  function useTheme(name) {
    themeName = name; theme = C.themes[name]; COL = C.colors = theme.colors;
    var root = document.documentElement;
    Object.keys(theme.ui).forEach(function (k) { root.style.setProperty(k, theme.ui[k]); });
    Object.keys(COL).forEach(function (k) { root.style.setProperty('--' + k, COL[k]); });
    root.setAttribute('data-theme', name);
  }
  useTheme(pickTheme());

  /* UI font: config.font, or ?font=Family for comparing in the browser preview. */
  var uiFont = C.font;
  (function () {
    var m = /[?&]font=([^&]+)/.exec(location.search), fam = uiFont = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : C.font;
    if (fam !== 'Space Grotesk') {   // index.html already loads the default font
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fam).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
    document.documentElement.style.setProperty('--ui-font', "'" + fam + "'");
  })();

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'translate(' + (window.innerWidth - 1920 * s) / 2 + 'px,' + (window.innerHeight - 1080 * s) / 2 + 'px) scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();

  var map = new maplibregl.Map({
    container: 'map', style: HBMapStyle(C, theme.map), interactive: false, attributionControl: false, fadeDuration: 0,
    center: HB.p, zoom: C.view.zoom
  });
  // Shift the camera so HB sits at view.hbAt instead of the screen centre.
  map.jumpTo({ center: map.unproject([1920 - C.view.hbAt[0], 1080 - C.view.hbAt[1]]) });
  window.HBMap = map;

  /* ---------- Map layers for live data ---------- */
  var PLANE_PATH = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';
  // Helicopter seen from above, nose up: crossed main rotor, cabin, tail boom and tail rotor.
  var HELI_PATH = ['M3.76 2.18 4.68 1.26 20.24 16.82 19.32 17.74z', 'M19.32 1.26 20.24 2.18 4.68 17.74 3.76 16.82z',
    'M8.8 9.8a3.2 4.6 0 1 0 6.4 0a3.2 4.6 0 1 0-6.4 0z', 'M11.3 13.5h1.4V21h-1.4z', 'M9.6 19.6h4.8V21H9.6z'];
  function mapIcon(path) {
    var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'); g.translate(s / 2, s / 2); g.scale(s / 26, s / 26); g.translate(-12, -12);
    g.fillStyle = '#fff'; [].concat(path).forEach(function (d) { g.fill(new Path2D(d)); });   // parts filled one by one so overlaps don't cut holes
    return g.getImageData(0, 0, s, s);
  }
  var empty = { type: 'FeatureCollection', features: [] };
  function kindColor() { return ['case', ['get', 'named'], COL.special, ['match', ['get', 'kind'], 'sbahn', COL.sbahn, 'long', COL.long, COL.regio]]; }

  map.on('load', function () {
    map.addImage('plane', mapIcon(PLANE_PATH), { sdf: true, pixelRatio: 2 });
    map.addImage('heli', mapIcon(HELI_PATH), { sdf: true, pixelRatio: 2 });
    map.addSource('trails', { type: 'geojson', data: empty });
    map.addSource('trains', { type: 'geojson', data: empty });
    map.addSource('planes', { type: 'geojson', data: empty });

    TrainIcons.add(map);
    addCorner();
    map.addLayer({ id: 'train-glow', type: 'circle', source: 'trains', filter: ['==', ['get', 'tunnel'], 0],
      paint: { 'circle-radius': ['case', ['get', 'special'], 34, 15], 'circle-color': kindColor(), 'circle-opacity': ['case', ['get', 'special'], 0.4, 0.14], 'circle-blur': 0.7 } });
    map.addLayer({ id: 'train-icon', type: 'symbol', source: 'trains', layout: {
      'icon-image': ['concat', ['case', ['any', ['get', 'special'], ['==', ['get', 'kind'], 'long']], 'train-long', 'train-short'], ['case', ['==', ['get', 'tunnel'], 1], '-tunnel', '']],
      'icon-size': ['case', ['get', 'special'], 1.3, 0.85], 'symbol-sort-key': ['case', ['get', 'special'], 1, 0], 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': kindColor(), 'icon-halo-color': theme.halo, 'icon-halo-width': ['case', ['==', ['get', 'tunnel'], 1], 0.8, 1.6], 'icon-halo-blur': 0.3,
        'icon-opacity': ['case', ['==', ['get', 'tunnel'], 1], 0.85, 1] } });
    // Highlighted train (e.g. Churchill-Pfeil): always labelled, larger, above everything else.
    map.addLayer({ id: 'train-special-label', type: 'symbol', source: 'trains', filter: ['get', 'special'], layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 20, 'text-anchor': 'left', 'text-offset': [1.6, 0],
      'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': kindColor(), 'text-halo-color': theme.halo, 'text-halo-width': 2 } });
    map.addLayer({ id: 'train-label', type: 'symbol', source: 'trains', filter: ['!', ['get', 'special']], layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 14,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.3,
      'text-optional': true, 'text-padding': 3 }, paint: { 'text-color': kindColor(), 'text-halo-color': theme.halo, 'text-halo-width': 1.6 } });
    map.addLayer({ id: 'plane-trail', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COL.plane, 'line-width': 2, 'line-opacity': 0.35 } });
    map.addLayer({ id: 'plane', type: 'symbol', source: 'planes', layout: {
      'icon-image': ['case', ['get', 'heli'], 'heli', 'plane'], 'icon-size': ['case', ['get', 'over'], 1.25, ['get', 'ground'], 0.55, 0.9], 'symbol-sort-key': ['case', ['get', 'ground'], 0, 1], 'icon-rotate': ['get', 'track'], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
      'text-field': ['case', ['get', 'ground'], '', ['concat', ['get', 'callsign'], '\n', ['get', 'alt']]], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-line-height': 1.15,
      'text-anchor': 'left', 'text-offset': [1.4, 0], 'text-optional': true },
      paint: { 'icon-color': COL.plane, 'icon-opacity': ['case', ['get', 'ground'], 0.55, 1], 'icon-halo-color': theme.halo, 'icon-halo-width': 1.5, 'text-color': COL.plane, 'text-halo-color': theme.halo, 'text-halo-width': 1.6 } });

    addPlace(HB, 'train');

    // Zuhause – the most important point on the map; aircraft overflights are measured from here.
    if (C.home) addHome();
    if (C.airport) addPlace(C.airport, 'flight');

    Rails.load('data/rails.json').then(function () { Trains.start(); Planes.start(); ISS.start(); frame(); setInterval(ui, 1000); ui(); });
  });
  function addHome() { addPlace(C.home, 'home'); }

  /* ---------- Corner clock inside the map ----------
     The clock and its dark wash are drawn on a canvas that sits in the map as a raster layer below the
     trains and aircraft, so they pass over the time instead of disappearing behind it. The camera is fixed,
     so the canvas covers exactly the stage pixels 0…CORNER_W × 0…CORNER_H. The HTML clock (#clock) stays as
     the fallback until the map is ready; the live chip below it stays HTML. */
  var CORNER_W = 900, CORNER_H = 420, cornerCanvas = document.createElement('canvas'), cornerText = null, cornerReady = false;
  function clockText() { return new Date().toLocaleTimeString('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); }
  function drawCorner(text) {
    var r = Math.min(2, window.devicePixelRatio || 1), c = cornerCanvas, g, grad, i, cell = 0, x, w;
    if (c.width !== CORNER_W * r) { c.width = CORNER_W * r; c.height = CORNER_H * r; }
    g = c.getContext('2d');
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, CORNER_W, CORNER_H);
    // Wash: same as the former CSS radial-gradient(ellipse at 0 0, …) – farthest-corner ellipse with radii W·√2, H·√2.
    var wash = theme.ui['--wash'];
    g.save(); g.scale(1, CORNER_H / CORNER_W);
    grad = g.createRadialGradient(0, 0, 0, 0, 0, CORNER_W * Math.SQRT2);
    grad.addColorStop(0, 'rgba(' + wash + ',0.92)'); grad.addColorStop(0.4, 'rgba(' + wash + ',0.6)'); grad.addColorStop(0.72, 'rgba(' + wash + ',0)');
    g.fillStyle = grad; g.fillRect(0, 0, CORNER_W, CORNER_W);
    g.restore();
    // Time: 132px bold, tabular digits, -3px tracking, soft shadow – as .clock in style.css.
    g.font = '700 132px "' + uiFont + '", system-ui, sans-serif';
    g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0, 0, 0, 0.55)'; g.shadowBlur = 18 * r; g.shadowOffsetY = 2 * r;
    for (i = 0; i <= 9; i++) cell = Math.max(cell, g.measureText(String(i)).width);
    x = 48;
    for (i = 0; i < text.length; i++) {
      w = /\d/.test(text[i]) ? cell : g.measureText(text[i]).width;
      g.fillText(text[i], x + (w - g.measureText(text[i]).width) / 2, 36 + 64);
      x += w - 3;
    }
    cornerText = text;
    var src = cornerReady && map.getSource('corner');
    if (src) { src.play(); map.once('render', function () { src.pause(); }); }   // pause() uploads the new canvas once
  }
  function addCorner() {
    drawCorner(clockText());
    var px = function (x, y) { var l = map.unproject([x, y]); return [l.lng, l.lat]; };
    map.addSource('corner', { type: 'canvas', canvas: cornerCanvas, animate: false,
      coordinates: [px(0, 0), px(CORNER_W, 0), px(CORNER_W, CORNER_H), px(0, CORNER_H)] });
    map.addLayer({ id: 'corner', type: 'raster', source: 'corner', paint: { 'raster-fade-duration': 0 } });
    cornerReady = true;
    stage.className += ' clock-in-map';
    // The canvas only draws with the UI font once it is loaded.
    if (document.fonts && document.fonts.load) document.fonts.load('700 132px "' + uiFont + '"').then(function () { drawCorner(clockText()); });
  }
  // A named place with a Material Symbols glyph (train, home, flight): white ring + name pill.
  function addPlace(place, icon) {
    var el = document.createElement('div');
    el.className = 'hb-marker home-marker';
    el.innerHTML = '<div class="pulse"></div><div class="ring"></div><div class="name"><span class="material-symbols-rounded" aria-hidden="true">' + icon + '</span>' + place.name + '</div>';
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(place.p).addTo(map);
  }

  /* Switch theme live: repaint the base map (fades via the style transition), live layers, UI and cards. */
  function switchTheme(name) {
    useTheme(name);
    HBMapStyle(C, theme.map).layers.forEach(function (l) {
      Object.keys(l.paint || {}).forEach(function (k) { map.setPaintProperty(l.id, k, l.paint[k]); });
    });
    var kc = kindColor();
    map.setPaintProperty('train-glow', 'circle-color', kc);
    ['train-icon', 'train-special-label', 'train-label'].forEach(function (id) {
      map.setPaintProperty(id, id === 'train-icon' ? 'icon-color' : 'text-color', kc);
      map.setPaintProperty(id, id === 'train-icon' ? 'icon-halo-color' : 'text-halo-color', theme.halo);
    });
    map.setPaintProperty('plane-trail', 'line-color', COL.plane);
    ['icon-color', 'text-color'].forEach(function (k) { map.setPaintProperty('plane', k, COL.plane); });
    ['icon-halo-color', 'text-halo-color'].forEach(function (k) { map.setPaintProperty('plane', k, theme.halo); });
    Object.keys(cardEls).forEach(function (k) { cardEls[k].parentNode.removeChild(cardEls[k]); delete cardEls[k]; delete cardSeen[k]; });   // rebuilt in the new colours
    if (cornerReady) drawCorner(clockText());   // wash in the new theme colour
  }
  setInterval(function () { var n = pickTheme(); if (n !== themeName && map.isStyleLoaded()) switchTheme(n); }, 60000);
  window.HBTheme = function (name) { forced = name; switchTheme(name); };   // console helper for the preview

  /* ---------- Animation ---------- */
  function feature(p, props) { return { type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: props }; }
  /* Adaptive frame rate: count frames the map actually draws; if it falls clearly short of the target,
     step down (min C.minFps), and step back up after a calm period. */
  var perf = window.HBPerf = { target: C.fps, drawn: 0, measured: 0, calm: 0 }, trailsAt = 0;
  map.on('render', function () { perf.drawn++; });
  setInterval(function () {
    perf.measured = perf.drawn / 5; perf.drawn = 0;
    if (perf.measured < perf.target * 0.7 && perf.target > C.minFps) { perf.target = Math.max(C.minFps, perf.target - 5); perf.calm = 0; }
    else if (perf.measured >= perf.target * 0.95 && perf.target < C.fps && ++perf.calm >= 6) { perf.target = Math.min(C.fps, perf.target + 5); perf.calm = 0; }
  }, 5000);

  function frame() {
    var started = Date.now();
    var now = started, b = map.getBounds().toArray(), pad = 0.01;
    var trains = Trains.positions(now / 1000).filter(function (t) { return t.p[0] > b[0][0] - pad && t.p[0] < b[1][0] + pad && t.p[1] > b[0][1] - pad && t.p[1] < b[1][1] + pad; });
    var planes = Planes.positions(now);
    map.getSource('trains').setData({ type: 'FeatureCollection', features: trains.map(function (t) { return feature(t.p, { label: t.label, kind: t.kind, special: !!t.special, named: !!t.rareName, tunnel: t.tunnel, bearing: t.bearing || 0 }); }) });
    map.getSource('planes').setData({ type: 'FeatureCollection', features: planes.map(function (a) {
      return feature(a.p, { callsign: a.type || a.callsign, alt: typeof a.altM === 'number' ? fmtInt(a.altM) + ' m' : '', track: a.track, over: a.over, ground: !!a.ground, heli: !!a.heli }); }) });
    if (now - trailsAt > 1000) { trailsAt = now; map.getSource('trails').setData({ type: 'FeatureCollection', features: planes.filter(function (a) { return a.trail.length > 1; }).map(function (a) {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: a.trail }, properties: {} }; }) }); }   // trails change slowly
    last = { trains: trains, planes: planes };
    setTimeout(frame, Math.max(0, 1000 / perf.target - (Date.now() - started)));
  }

  /* ---------- Tiles ---------- */
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’'); }
  function hhmm(sec) { return new Date(sec * 1000).toLocaleTimeString('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); }
  function inView(p) { var b = map.getBounds(); return p[0] > b.getWest() && p[0] < b.getEast() && p[1] > b.getSouth() && p[1] < b.getNorth(); }
  /* Keyed card list: new cards slide in once, existing ones only update their content. */
  // A card stays at most MAX_CARD_MS from its first appearance (lingering included); an event that is still
  // going on after that stays hidden until it has ended, so the same card doesn't pop up again right away.
  var cardEls = {}, cardSeen = {}, cardFirst = {}, cardDone = {}, LINGER_MS = 30000, MAX_CARD_MS = 60000;
  function renderCards(cards) {
    var box = $('events'), keep = {}, now = Date.now(), live = {};
    cards.forEach(function (c) { live[c.key] = 1; cardSeen[c.key] = now; });
    Object.keys(cardDone).forEach(function (k) { if (!live[k]) delete cardDone[k]; });   // event over: may show again next time
    Object.keys(cardEls).forEach(function (k) {   // recently ended events keep their card (in place, unchanged)
      if (!live[k] && now - cardSeen[k] < LINGER_MS) cards.push({ key: k, frozen: true });
    });
    cards = cards.filter(function (c) {
      if (cardDone[c.key]) return false;
      if (!cardFirst[c.key] || now - cardFirst[c.key] < MAX_CARD_MS) return true;
      if (live[c.key]) cardDone[c.key] = 1;
      delete cardFirst[c.key];
      return false;
    });
    cards = cards.slice(0, 3);
    cards.forEach(function (c, i) {
      keep[c.key] = 1;
      if (!cardFirst[c.key]) cardFirst[c.key] = now;   // the minute starts when the card is actually on screen
      var el = cardEls[c.key];
      if (!el) {
        el = cardEls[c.key] = document.createElement('section'); el.className = 'tile tile-air' + (c.cls ? ' ' + c.cls : '');
        if (c.color) { el.style.background = c.color; el.style.color = ink(c.color); }
      }
      if (c.frozen) { keep[c.key] = 1; if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null); return; }
      var html = '<header class="tile-head">' + (c.iconHtml || '<span class="material-symbols-rounded air-icon">' + c.icon + '</span>') + '<h2>' + esc(c.title) + '</h2></header>' +
        '<div class="air-body"><div class="flight">' + esc(c.big) + '</div><div class="flight-sub">' + esc(c.sub) + '</div><div class="facts">' + c.facts + '</div></div>';
      if (el._html !== html) { el._html = html; el.innerHTML = html; }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    });
    Object.keys(cardEls).forEach(function (k) { if (!keep[k]) { box.removeChild(cardEls[k]); delete cardEls[k]; delete cardSeen[k]; delete cardFirst[k]; } });
  }
  function ink(hex) {   // dark text on bright colours, white on deep ones
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? theme.ui['--ink'] : '#ffffff';
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function ui() {
    var now = new Date();
    var time = clockText();
    $('clock').textContent = time;
    if (cornerReady && time !== cornerText) drawCorner(time);

    var ts = Trains.status(), ps = Planes.status(), chip = $('liveChip');
    chip.className = 'live' + (ts.quiet ? ' is-quiet' : ts.error || ps.error ? ' is-warn' : '');
    $('liveText').textContent = ts.quiet ? 'Betriebspause' : ts.error ? 'Fahrplan: keine Verbindung' : ps.error ? 'Flugdaten: keine Verbindung'
      : ts.lastUpdate ? 'Live' : 'Verbinde …';

    // Overview cards for rare events: aircraft over home, rare aircraft or rare trains in view.
    var planes = last.planes.slice().sort(function (a, b) { return a.km - b.km; }), cards = [], seen = {};
    function fact(v, unit) { return '<div class="fact"><b>' + esc(v) + '</b><span>' + esc(unit) + '</span></div>'; }
    // ISS passing over home: always the first card, in its own space style.
    var iss = ISS.status();
    if (iss.pass && iss.now) {
      cards.push({ key: 'iss', cls: 'tile-iss', iconHtml: ISS_ICON.replace('<svg', '<svg class="air-icon iss-icon"'),
        title: iss.now.visible ? 'ISS über uns · jetzt sichtbar!' : 'ISS über uns', big: 'Internationale Raumstation',
        sub: 'von ' + iss.pass.from + ' Richtung ' + iss.now.dir + ' · ' + iss.now.altKm + ' km hoch',
        facts: fact(Math.round(iss.now.el) + '°', 'über Horizont') + fact(iss.now.dir, 'Himmelsrichtung') + fact(fmtInt(iss.now.kmh), 'km/h') });
    }
    planes.forEach(function (a) {
      if (!a.over && !(a.rare && inView(a.p))) return;
      cards.push({ key: 'p' + a.hex, color: COL.plane, icon: 'flight', iconHtml: a.heli ? HELI_ICON : '', title: a.over ? 'Überflug Zuhause' + (a.rare ? ' · ' + a.rare : '') : a.rare, big: a.type || a.callsign,
        sub: [a.airline, a.callsign].filter(Boolean).join(' · ') || a.reg,
        facts: fact(typeof a.altM === 'number' ? fmtInt(a.altM) : '–', 'Meter' + (a.climb > 300 ? ' ↗' : a.climb < -300 ? ' ↘' : '')) + fact(a.kmh || '–', 'km/h') + fact(a.km.toFixed(1), 'km von zuhause') });
    });
    last.trains.forEach(function (t) {
      if (!t.special || seen[t.key]) return;
      seen[t.key] = 1;
      var nx = Trains.nextStop(t.key, now.getTime() / 1000);
      cards.push({ key: 't' + t.key, color: t.rareName ? COL.special : COL[t.kind], icon: 'train', title: t.rareName ? t.rareName + ' unterwegs' : 'Seltener Zug', big: t.rareName ? t.category : t.label,
        sub: '→ ' + t.to + (t.operator ? ' · ' + t.operator.split('-')[0].toUpperCase() : ''),
        facts: nx ? fact(nx.name, 'nächster Halt') + fact(hhmm(nx.t), 'Uhr') : fact(t.tunnel ? 'im Tunnel' : 'unterwegs', '') });
    });
    renderCards(cards);
    logRare(planes, iss, now.getTime());
  }

  /* ---------- Rare aircraft log (top right, last 24 h) ---------- */
  // Very rare aircraft (rare.logReasons: state flights, military) seen flying in the map view are noted
  // for rare.logHours. Kept in localStorage so a reload/restart of the TV doesn't lose them.
  var LOG_KEY = 'hb.rareLog', rareLog = loadLog(), logHtml = null, logSaved = 0;
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch (e) { return {}; } }
  function saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(rareLog)); } catch (e) { /* storage unavailable */ } }
  var HELI_ICON = '<svg class="air-icon heli-icon" viewBox="0 0 24 24" aria-hidden="true">' + HELI_PATH.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  var ISS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 9h4v6h-4zM11.25 3h1.5v18h-1.5zM1 7h7v4H1zM1 13h7v4H1zM16 7h7v4h-7zM16 13h7v4h-7zM8 11.25h8v1.5H8z"/></svg>';
  function logRare(planes, iss, nowMs) {
    var R = C.rare || {}, keepMs = (R.logHours || 24) * 3600000, changed = false;
    // ISS passes (running and finished) – one entry per pass.
    iss.finished.concat(iss.pass ? [iss.pass] : []).forEach(function (ps) {
      var k = 'iss-' + ps.start;
      if (!rareLog[k]) changed = true;
      rareLog[k] = { iss: true, first: ps.start, t: ps.t, name: 'ISS', maxEl: Math.round(ps.maxEl), visible: ps.visible, over: false };
    });
    planes.forEach(function (a) {
      if (!a.rare || a.ground || !inView(a.p) || (R.logReasons || []).indexOf(a.rare) < 0) return;
      var e = rareLog[a.hex];
      if (!e) { e = rareLog[a.hex] = { first: nowMs }; changed = true; }
      e.name = a.type || a.callsign; e.why = a.rare; e.over = e.over || !!a.over; e.t = nowMs;
    });
    Object.keys(rareLog).forEach(function (k) { if (nowMs - rareLog[k].t > keepMs) { delete rareLog[k]; changed = true; } });
    if (changed || nowMs - logSaved > 60000) { saveLog(); logSaved = nowMs; }

    var rows = Object.keys(rareLog).map(function (k) { return rareLog[k]; }).sort(function (x, y) { return y.t - x.t; }).slice(0, 6);
    var html = rows.length ? '<h3>Seltenes · letzte ' + (R.logHours || 24) + ' h</h3>' + rows.map(function (e) {
      if (e.iss) return '<div class="rare-row is-iss">' + ISS_ICON + '<b>ISS</b><span class="why">' + esc('max ' + e.maxEl + '°' + (e.visible ? ' · sichtbar' : '')) + '</span><time>' + hhmm(e.first / 1000) + '</time></div>';
      return '<div class="rare-row"><b>' + esc(e.name) + '</b><span class="why">' + esc(e.over ? 'Überflug' : e.why) + '</span><time>' + hhmm(e.first / 1000) + '</time></div>';
    }).join('') : '';
    if (html !== logHtml) { logHtml = html; var box = $('rareLog'); box.innerHTML = html; box.hidden = !html; }
  }
})();
