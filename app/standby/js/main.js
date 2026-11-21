/* Zürich HB Live – map setup, animation loop and tiles. */
(function () {
  'use strict';
  var C = window.HBConfig, HB = C.hb, COL = C.colors;
  var stage = document.getElementById('stage'), $ = function (id) { return document.getElementById(id); };
  var TZ = 'Europe/Zurich', last = { trains: [], planes: [] };

  /* UI font: config.font, or ?font=Family for comparing in the browser preview. */
  (function () {
    var m = /[?&]font=([^&]+)/.exec(location.search), fam = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : C.font;
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
    container: 'map', style: HBMapStyle(C), interactive: false, attributionControl: false, fadeDuration: 0,
    center: HB.p, zoom: C.view.zoom
  });
  // Shift the camera so HB sits at view.hbAt instead of the screen centre.
  map.jumpTo({ center: map.unproject([1920 - C.view.hbAt[0], 1080 - C.view.hbAt[1]]) });
  window.HBMap = map;

  /* ---------- Map layers for live data ---------- */
  function planeIcon() {
    var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'); g.translate(s / 2, s / 2); g.scale(s / 26, s / 26); g.translate(-12, -12);
    g.fillStyle = '#fff'; g.fill(new Path2D('M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z'));
    return g.getImageData(0, 0, s, s);
  }
  var empty = { type: 'FeatureCollection', features: [] };
  var kindColor = ['case', ['get', 'named'], COL.special, ['match', ['get', 'kind'], 'sbahn', COL.sbahn, 'long', COL.long, COL.regio]];

  map.on('load', function () {
    map.addImage('plane', planeIcon(), { sdf: true, pixelRatio: 2 });
    map.addSource('trails', { type: 'geojson', data: empty });
    map.addSource('trains', { type: 'geojson', data: empty });
    map.addSource('planes', { type: 'geojson', data: empty });

    TrainIcons.add(map);
    map.addLayer({ id: 'train-glow', type: 'circle', source: 'trains', filter: ['==', ['get', 'tunnel'], 0],
      paint: { 'circle-radius': ['case', ['get', 'special'], 34, 15], 'circle-color': kindColor, 'circle-opacity': ['case', ['get', 'special'], 0.4, 0.14], 'circle-blur': 0.7 } });
    map.addLayer({ id: 'train-icon', type: 'symbol', source: 'trains', layout: {
      'icon-image': ['concat', ['case', ['any', ['get', 'special'], ['==', ['get', 'kind'], 'long']], 'train-long', 'train-short'], ['case', ['==', ['get', 'tunnel'], 1], '-tunnel', '']],
      'icon-size': ['case', ['get', 'special'], 1.3, 0.85], 'symbol-sort-key': ['case', ['get', 'special'], 1, 0], 'icon-rotate': ['get', 'bearing'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': kindColor, 'icon-halo-color': '#1c1930', 'icon-halo-width': ['case', ['==', ['get', 'tunnel'], 1], 0.8, 1.6], 'icon-halo-blur': 0.3,
        'icon-opacity': ['case', ['==', ['get', 'tunnel'], 1], 0.85, 1] } });
    // Highlighted train (e.g. Churchill-Pfeil): always labelled, larger, above everything else.
    map.addLayer({ id: 'train-special-label', type: 'symbol', source: 'trains', filter: ['get', 'special'], layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 20, 'text-anchor': 'left', 'text-offset': [1.6, 0],
      'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': kindColor, 'text-halo-color': '#1c1930', 'text-halo-width': 2 } });
    map.addLayer({ id: 'train-label', type: 'symbol', source: 'trains', filter: ['!', ['get', 'special']], layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 14,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.3,
      'text-optional': true, 'text-padding': 3 }, paint: { 'text-color': kindColor, 'text-halo-color': '#1c1930', 'text-halo-width': 1.6 } });
    map.addLayer({ id: 'plane-trail', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COL.plane, 'line-width': 2, 'line-opacity': 0.35 } });
    map.addLayer({ id: 'plane', type: 'symbol', source: 'planes', layout: {
      'icon-image': 'plane', 'icon-size': ['case', ['get', 'over'], 1.25, ['get', 'ground'], 0.55, 0.9], 'symbol-sort-key': ['case', ['get', 'ground'], 0, 1], 'icon-rotate': ['get', 'track'], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
      'text-field': ['case', ['get', 'ground'], '', ['concat', ['get', 'callsign'], '\n', ['get', 'alt']]], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-line-height': 1.15,
      'text-anchor': 'left', 'text-offset': [1.4, 0], 'text-optional': true },
      paint: { 'icon-color': COL.plane, 'icon-opacity': ['case', ['get', 'ground'], 0.55, 1], 'icon-halo-color': '#1c1930', 'icon-halo-width': 1.5, 'text-color': COL.plane, 'text-halo-color': '#1c1930', 'text-halo-width': 1.6 } });

    var el = document.createElement('div');
    el.className = 'hb-marker';
    el.innerHTML = '<div class="pulse"></div><div class="ring"></div><div class="name">Zürich HB</div>';
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(HB.p).addTo(map);

    // Zuhause – the most important point on the map; aircraft overflights are measured from here.
    if (C.home) addHome();

    Rails.load('data/rails.json').then(function () { Trains.start(); Planes.start(); frame(); setInterval(ui, 1000); ui(); });
  });
  function addHome() {
    var home = document.createElement('div');
    home.className = 'hb-marker home-marker';   // same white style as the HB marker
    home.innerHTML = '<div class="pulse"></div><div class="ring"></div><div class="name"><span class="material-symbols-rounded" aria-hidden="true">home</span>' + C.home.name + '</div>';
    new maplibregl.Marker({ element: home, anchor: 'center' }).setLngLat(C.home.p).addTo(map);
  }

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
      return feature(a.p, { callsign: a.typeCode || a.callsign, alt: typeof a.altM === 'number' ? fmtInt(a.altM) + ' m' : '', track: a.track, over: a.over, ground: !!a.ground }); }) });
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
  var cardEls = {}, cardSeen = {}, LINGER_MS = 30000;
  function renderCards(cards) {
    var box = $('events'), keep = {}, now = Date.now(), live = {};
    cards.forEach(function (c) { live[c.key] = 1; cardSeen[c.key] = now; });
    Object.keys(cardEls).forEach(function (k) {   // recently ended events keep their card (in place, unchanged)
      if (!live[k] && now - cardSeen[k] < LINGER_MS) cards.push({ key: k, frozen: true });
    });
    cards = cards.slice(0, 3);
    cards.forEach(function (c, i) {
      keep[c.key] = 1;
      var el = cardEls[c.key];
      if (!el) {
        el = cardEls[c.key] = document.createElement('section'); el.className = 'tile tile-air';
        el.style.background = c.color; el.style.color = ink(c.color);
      }
      if (c.frozen) { keep[c.key] = 1; if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null); return; }
      var html = '<header class="tile-head"><span class="material-symbols-rounded air-icon">' + c.icon + '</span><h2>' + esc(c.title) + '</h2></header>' +
        '<div class="air-body"><div class="flight">' + esc(c.big) + '</div><div class="flight-sub">' + esc(c.sub) + '</div><div class="facts">' + c.facts + '</div></div>';
      if (el._html !== html) { el._html = html; el.innerHTML = html; }
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    });
    Object.keys(cardEls).forEach(function (k) { if (!keep[k]) { box.removeChild(cardEls[k]); delete cardEls[k]; delete cardSeen[k]; } });
  }
  function ink(hex) {   // dark text on bright colours, white on deep ones
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#242038' : '#ffffff';
  }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function ui() {
    var now = new Date();
    $('clock').textContent = now.toLocaleTimeString('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

    var ts = Trains.status(), ps = Planes.status(), chip = $('liveChip');
    chip.className = 'live' + (ts.quiet ? ' is-quiet' : ts.error || ps.error ? ' is-warn' : '');
    $('liveText').textContent = ts.quiet ? 'Betriebspause' : ts.error ? 'Fahrplan: keine Verbindung' : ps.error ? 'Flugdaten: keine Verbindung'
      : ts.lastUpdate ? 'Live' : 'Verbinde …';

    // Overview cards for rare events: aircraft over home, rare aircraft or rare trains in view.
    var planes = last.planes.slice().sort(function (a, b) { return a.km - b.km; }), cards = [], seen = {};
    var flying = planes.filter(function (a) { return !a.ground && inView(a.p); }).length, parked = planes.filter(function (a) { return a.ground && inView(a.p); }).length;
    function fact(v, unit) { return '<div class="fact"><b>' + esc(v) + '</b><span>' + esc(unit) + '</span></div>'; }
    planes.forEach(function (a) {
      if (!a.over && !(a.rare && inView(a.p))) return;
      cards.push({ key: 'p' + a.hex, color: COL.plane, icon: 'flight', title: a.over ? 'Überflug Zuhause' + (a.rare ? ' · ' + a.rare : '') : a.rare, big: a.type || a.callsign,
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

    var count = { sbahn: 0, long: 0, regio: 0 };
    last.trains.forEach(function (t) { count[t.kind]++; });
    $('legend').innerHTML =
      '<span class="leg">' + TrainIcons.legend(COL.sbahn) + 'S-Bahn<b>' + count.sbahn + '</b></span>' +
      '<span class="leg">' + TrainIcons.legend(COL.long) + 'Fernverkehr<b>' + count.long + '</b></span>' +
      '<span class="leg">' + TrainIcons.legend(COL.regio) + 'Regio<b>' + count.regio + '</b></span>' +
      '<span class="leg">' + TrainIcons.legend('#a3adb8', true) + 'im Tunnel</span>' +
      '<span class="leg"><svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>Flugzeuge<b>' + flying + '</b>' + (parked ? '<span class="leg-sub">+ ' + parked + ' am Boden</span>' : '') + '</span>';
  }
})();
