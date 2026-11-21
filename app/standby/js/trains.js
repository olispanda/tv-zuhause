/* Live trains in the map area from transport.opendata.ch station boards.
   Every station in and around the map (data/stations.json) is polled in rotation; every train with
   a stop in the area is kept. Positions are interpolated on the real rail network between the
   realtime stop times (timetable + live delay). Swap-in point for a GPS feed (e.g. geOps): positions(). */
window.Trains = (function () {
  'use strict';
  var C = window.HBConfig, HB = C.hb, AREA = C.trainArea;
  var journeys = {}, hbBoard = [], stations = [], stationP = {}, stationName = {}, lastUpdate = 0, lastError = null, rot = 0, requests = 0;
  var FIELDS = ['name', 'category', 'number', 'to', 'operator', 'stop/station/id', 'stop/station/name', 'stop/station/coordinate', 'stop/departure', 'stop/platform', 'stop/delay',
    'stop/prognosis/departure', 'stop/prognosis/platform', 'passList/station/id', 'passList/station/name', 'passList/station/coordinate',
    'passList/arrival', 'passList/departure', 'passList/prognosis/arrival', 'passList/prognosis/departure'];

  var LONG = { IC: 1, ICE: 1, EC: 1, IR: 1, TGV: 1, RJ: 1, RJX: 1, EN: 1, NJ: 1, ICN: 1, EXT: 1 };
  function kind(cat) { return cat === 'S' || cat === 'SN' ? 'sbahn' : LONG[cat] ? 'long' : 'regio'; }
  function label(j) { var n = String(j.number || '').replace(/^0+(?=\d)/, ''); return j.category === 'S' || j.category === 'SN' ? j.category + n : j.category + ' ' + n; }
  function ts(s) { return s ? Date.parse(s.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) / 1000 : null; }
  function coord(st) { return st && st.coordinate && st.coordinate.x ? [st.coordinate.y, st.coordinate.x] : st && stationP[st.id] || null; }
  function inArea(p) { return p && p[0] > AREA[0] && p[0] < AREA[2] && p[1] > AREA[1] && p[1] < AREA[3]; }

  function quiet() {
    var t = new Date().toLocaleTimeString('de-CH', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' });
    return C.quietHours.from < C.quietHours.to ? t >= C.quietHours.from && t < C.quietHours.to : t >= C.quietHours.from || t < C.quietHours.to;
  }

  /* Boards start a few minutes in the past so trains already between stations are included. */
  function since(minutes) {
    return new Date(Date.now() - minutes * 60000).toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 16);
  }
  function board(id, limit, backMinutes) {
    var q = 'id=' + id + '&limit=' + limit + '&transportations[]=train&datetime=' + encodeURIComponent(since(backMinutes)) +
      FIELDS.map(function (f) { return '&fields[]=stationboard/' + f; }).join('');
    requests++;
    return fetch(C.transportApi + '?' + q).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { return d.stationboard || []; });
  }

  /* Stop list of one board entry: the board station itself, then the following stops. */
  function stopsOf(e) {
    var s = e.stop, pr = s.prognosis || {};
    var first = { id: s.station.id, name: s.station.name || stationName[s.station.id], p: coord(s.station), arr: null, dep: ts(pr.departure || s.departure) };
    return [first].concat((e.passList || []).slice(1).filter(function (x) { return x.station && x.station.id; }).map(function (x) {
      var xp = x.prognosis || {}, arr = ts(xp.arrival || x.arrival), dep = ts(xp.departure || x.departure);
      if (arr && dep && dep < arr) dep = x.departure ? Math.max(arr, ts(x.departure)) : arr;   // terminal stops carry a bogus departure forecast
      return { id: x.station.id, name: x.station.name || stationName[x.station.id], p: coord(x.station), arr: arr, dep: dep };
    }));
  }

  /* Merge stop points into a journey keyed by train number; the latest fetch wins. */
  function upsert(e, pts) {
    var key = e.category + e.name, j = journeys[key];
    if (!j) j = journeys[key] = { key: key, category: e.category, number: e.number, label: label(e), kind: kind(e.category), to: e.to, operator: e.operator || '', name: e.name || '', pts: {} };
    if (e.operator) j.operator = e.operator;
    pts.forEach(function (p) {
      var cur = j.pts[p.id];
      if (!cur) { j.pts[p.id] = p; return; }
      if (p.arr) cur.arr = p.arr;
      if (p.dep) cur.dep = p.dep;
      if (!cur.p && p.p) cur.p = p.p;
      if (!cur.name && p.name) cur.name = p.name;
    });
    if (e.to) j.to = e.to;
    j.tl = null;
  }
  function take(list) {
    list.forEach(function (e) {
      if (!e.stop || !e.stop.station) return;
      var pts = stopsOf(e);
      if (pts.some(function (p) { return inArea(p.p); })) upsert(e, pts);
    });
  }

  function pollHB() {
    if (quiet()) return Promise.resolve();
    return board(HB.id, 80, 12).then(function (list) {
      take(list);
      hbBoard = list.map(function (e) {
        var s = e.stop, pr = s.prognosis || {}, dep = ts(pr.departure || s.departure);
        return { key: e.category + e.name, label: label(e), kind: kind(e.category), to: e.to, planned: ts(s.departure), dep: dep,
          delay: s.delay || 0, platform: pr.platform || s.platform || '', platformChanged: !!(pr.platform && pr.platform !== s.platform) };
      });
      lastUpdate = Date.now(); lastError = null;
    }).catch(function (err) { lastError = String(err.message || err); });
  }

  function pollNext() {
    if (quiet() || !stations.length) return Promise.resolve();
    var st = stations[rot++ % stations.length];
    return board(st.id, 60, C.boardBackMin).then(take).catch(function (err) { lastError = String(err.message || err); });
  }

  function start() {
    pollHB();
    setInterval(pollHB, C.hbPollSec * 1000);
    fetch(C.stationsUrl).then(function (r) { return r.json(); }).then(function (list) {
      list.forEach(function (s) { stationP[s.id] = s.p; stationName[s.id] = s.name; });
      stations = list.filter(function (s) { return s.id !== HB.id; });   // HB has its own faster board
      // Startup: every board once, staggered; then one board every boardPollSec / n seconds.
      stations.forEach(function (_, i) { setTimeout(pollNext, 350 * (i + 1)); });
      setTimeout(function () { setInterval(pollNext, C.boardPollSec * 1000 / stations.length); }, 350 * (stations.length + 1));
    }).catch(function (err) { lastError = 'Bahnhofsliste: ' + (err.message || err); });
  }

  function ease(f) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, f))); }

  /* Ordered stop list with dwell times filled in (cached until the journey changes). */
  function timeline(j) {
    if (j.tl) return j.tl;
    var pts = Object.keys(j.pts).map(function (k) { var s = j.pts[k]; return { id: s.id, name: s.name, p: s.p, arr: s.arr, dep: s.dep }; })
      .filter(function (p) { return p.p && (p.arr || p.dep); });
    pts.forEach(function (p) {
      if (!p.arr) p.arr = p.dep - (p.id === HB.id ? 90 : 30);
      if (!p.dep) p.dep = p.arr + (p.id === HB.id ? 120 : 0);
    });
    pts.sort(function (a, b) { return a.arr - b.arr; });
    j.tl = pts;
    return pts;
  }

  /* Where a standing train sits: on the track where its next run starts (else where the previous one ended),
     so it does not hop between the station coordinate and the track when it departs or arrives. */
  function standingPose(pts, i) {
    var a = pts[i], r, at, end;
    if (pts[i + 1]) {
      r = Rails.route(a.id, a.p, pts[i + 1].id, pts[i + 1].p);
      if (!r.lead) { at = Rails.along(r, Math.min(30, r.len)); end = Rails.along(r, 0); }
    }
    if (!end && i > 0) {
      r = Rails.route(pts[i - 1].id, pts[i - 1].p, a.id, a.p);
      if (!r.tail) { at = Rails.along(r, Math.max(0, r.len - 30)); end = Rails.along(r, r.len); }
    }
    return end && at ? { p: end.p, bearing: at.bearing } : { p: a.p, bearing: 0 };
  }

  /* A run is drawn only when it touches the map and its rail route is plausible. Runs between two stations
     outside the map (e.g. Ziegelbrücke – Näfels) would otherwise be routed through the map's exit points
     and race across the screen. */
  function drawable(a, b, r) {
    var far = !Rails.inside(a.p, 800) && !Rails.inside(b.p, 800);
    return !far && r.coords.length > 1 && r.lead + r.len + r.tail <= Rails.dist(a.p, b.p) * 2.5 + 1500;
  }

  /* Current positions of all trains inside the covered area (smoothed, see glide). */
  function positions(nowSec) {
    var out = [];
    Object.keys(journeys).forEach(function (k) {
      var j = journeys[k], pts = timeline(j);
      if (!pts.length) return;
      if (nowSec > pts[pts.length - 1].dep + 600) { delete journeys[k]; delete shown[k]; return; }
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i];
        if (nowSec >= a.arr && nowSec <= a.dep) {
          if (Rails.inside(a.p, 0)) {
            if (!a.pose) a.pose = standingPose(pts, i);
            out.push(mark(j, a.pose.p, 0, a.id === HB.id ? 'hb' : 'stop', a.pose.bearing));
          }
          return;
        }
        var b = pts[i + 1];
        if (b && nowSec > a.dep && nowSec < b.arr) {
          var r = Rails.route(a.id, a.p, b.id, b.p), total = r.lead + r.len + r.tail;
          if (!drawable(a, b, r)) return;
          var at = Rails.along(r, ease((nowSec - a.dep) / (b.arr - a.dep)) * total - r.lead);
          if (at) out.push(mark(j, at.p, at.tunnel, b.id === HB.id ? 'in' : a.id === HB.id ? 'out' : 'run', at.bearing));
          return;
        }
      }
    });
    return glide(out, nowSec);
  }

  /* New realtime data (a delay update, a merged stop) can move a train's computed position at once.
     Instead of jumping, the marker glides to the new position over GLIDE_SEC while it keeps moving. */
  var shown = {}, GLIDE_SEC = 4;
  function glide(list, nowSec) {
    list.forEach(function (m) {
      var s = shown[m.key];
      if (s && nowSec - s.t < 5) {
        var dt = Math.max(0, nowSec - s.t), left = s.off ? Math.max(0, 1 - (nowSec - s.offT) / GLIDE_SEC) : 0;
        var prev = s.off && left > 0 ? [s.raw[0] + s.off[0] * left, s.raw[1] + s.off[1] * left] : s.raw, shownPrev = s.p;
        if (Rails.dist(m.p, prev) > 60 + 70 * dt) { s.off = [shownPrev[0] - m.p[0], shownPrev[1] - m.p[1]]; s.offT = nowSec; left = 1; }
        s.raw = m.p;
        if (s.off && left > 0) m.p = [m.p[0] + s.off[0] * left, m.p[1] + s.off[1] * left];
        else s.off = null;
        s.p = m.p; s.t = nowSec;
      } else shown[m.key] = { raw: m.p, p: m.p, t: nowSec, off: null };
    });
    return list;
  }
  /* Highlight rules from config (e.g. the Churchill-Pfeil). Returns the rule label or ''. */
  function special(j) {
    var rules = C.highlight || [], text = [j.category, j.number, j.name, j.label, j.to, j.operator].join(' ').toLowerCase(), op = String(j.operator || '').toLowerCase();
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if ((r.match || []).some(function (m) { return text.indexOf(m.toLowerCase()) >= 0; }) ||
          (r.operators || []).some(function (m) { return op && op.indexOf(m.toLowerCase()) >= 0; })) return r.label;
    }
    return '';
  }
  function rare(j) { return ((C.rare || {}).trainCategories || []).indexOf(j.category) >= 0; }
  function mark(j, p, tunnel, phase, bearing) {
    var sp = special(j), rr = !!sp || rare(j);
    return { key: j.key, label: sp || j.label, kind: j.kind, special: rr, rareName: sp, category: j.category, operator: j.operator || '',
      to: j.to, p: p, tunnel: tunnel, phase: phase, bearing: bearing };
  }
  /* Next stop (name, time) of a train – for the overview card. */
  function nextStop(key, nowSec) {
    var j = journeys[key]; if (!j) return null;
    var pts = timeline(j);
    for (var i = 0; i < pts.length; i++) if (pts[i].dep >= nowSec && pts[i].name) return { name: pts[i].name, t: pts[i].arr > nowSec ? pts[i].arr : pts[i].dep };
    return null;
  }

  function departures(nowSec, n) {
    return hbBoard.filter(function (d) { return d.dep >= nowSec - 30; }).sort(function (a, b) { return a.dep - b.dep; }).slice(0, n);
  }

  return { nextStop: nextStop, start: start, positions: positions, departures: departures,
    status: function () { return { lastUpdate: lastUpdate, error: lastError, quiet: quiet(), journeys: Object.keys(journeys).length, requests: requests }; },
    debug: function () { return Object.keys(journeys).map(function (k) { return { key: k, label: journeys[k].label, pts: timeline(journeys[k]).map(function (p) { return [p.id, p.p ? 1 : 0, p.arr && new Date(p.arr * 1000).toTimeString().slice(0, 5), p.dep && new Date(p.dep * 1000).toTimeString().slice(0, 5)]; }) }; }); } };
})();
