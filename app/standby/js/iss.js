/* International Space Station: live position from wheretheiss.at (free, no key, CORS ok).
   A pass counts when the ISS rises higher than iss.minElevation above the horizon at home.
   Passes missed while the standby page wasn't running (TV off, page suspended, network gap) are
   computed afterwards from the ISS orbital elements (TLE) with satellite.js (SGP4). */
window.ISS = (function () {
  'use strict';
  var C = window.HBConfig, CFG = C.iss || {}, R = 6371, DEG = Math.PI / 180;
  var now = null, pass = null, done = [], lastError = null, timer = null;
  var lastOk = null, gapFrom = null, filling = false, tle = null, tleAt = 0;
  var DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  var GAP_MS = 120000, STEP_MS = 20000, SLICE = 720, TLE_MAX_AGE = 6 * 3600000;

  /* Elevation (degrees above the horizon) and azimuth of a point at altKm above the ground point [lat, lon], seen from home. */
  function look(lat, lon, altKm) {
    var h = (C.home || C.hb).p, la1 = h[1] * DEG, la2 = lat * DEG, dl = (lon - h[0]) * DEG;
    var cosT = Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl), t = Math.acos(Math.max(-1, Math.min(1, cosT)));
    var el = altKm === Infinity ? 90 - t / DEG : Math.atan2(cosT - R / (R + altKm), Math.sin(t)) / DEG;
    var az = Math.atan2(Math.sin(dl) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl)) / DEG;
    return { el: el, az: (az + 360) % 360, km: t * R };
  }
  function dir(az) { return DIRS[Math.round(az / 45) % 8]; }
  function minEl() { return CFG.minElevation || 25; }
  function keepMs() { return ((C.rare || {}).logHours || 24) * 3600000; }

  /* Low-precision sub-solar point (about 0.01°, plenty for "is it dark at home / is the ISS in sunlight"). */
  function subSolar(ms) {
    var d = ms / 86400000 - 10957.5, g = (357.529 + 0.98560028 * d) * DEG;
    var L = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG, e = (23.439 - 0.00000036 * d) * DEG;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / DEG, gmst = 280.46061837 + 360.98564736629 * d;
    return { lat: Math.asin(Math.sin(e) * Math.sin(L)) / DEG, lon: ((ra - gmst) % 360 + 540) % 360 - 180 };
  }
  /* ISS outside the Earth's (cylindrical) shadow. */
  function sunlit(lat, lon, altKm, sun) {
    var r = R + altKm, a = lat * DEG, b = lon * DEG, c = sun.lat * DEG, d = sun.lon * DEG;
    var dot = r * (Math.cos(a) * Math.cos(b) * Math.cos(c) * Math.cos(d) + Math.cos(a) * Math.sin(b) * Math.cos(c) * Math.sin(d) + Math.sin(a) * Math.sin(c));
    return dot > 0 || r * r - dot * dot > R * R;
  }

  /* ---------- Missed passes, computed from the orbit ---------- */
  function getTle(t) {
    if (tle && t - tleAt < TLE_MAX_AGE) return Promise.resolve(tle);
    return fetch(CFG.tleApi).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      tle = window.satellite.twoline2satrec(d.line1, d.line2); tleAt = t;
      return tle;
    });
  }
  /* Scans [from, to] in STEP_MS steps, a slice per timer tick so the map animation stays smooth.
     Only passes that ended before `to` are reported; a pass still running is left to the live poll. */
  function scan(rec, from, to, onDone) {
    var S = window.satellite, t = from, cur = null, found = [];
    function slice() {
      for (var n = 0; n < SLICE && t <= to; n++, t += STEP_MS) {
        var date = new Date(t), pv = S.propagate(rec, date);
        if (!pv || !pv.position) continue;
        var g = S.eciToGeodetic(pv.position, S.gstime(date)), lat = g.latitude / DEG, lon = g.longitude / DEG, l = look(lat, lon, g.height);
        if (l.el >= minEl()) {
          var sun = subSolar(t), vis = look(sun.lat, sun.lon, Infinity).el < -6 && sunlit(lat, lon, g.height, sun);
          if (!cur) cur = { start: t, maxEl: 0, from: dir(l.az), visible: false, calc: true };
          if (l.el > cur.maxEl) cur.maxEl = l.el;
          cur.to = dir(l.az); cur.visible = cur.visible || vis; cur.t = t;
        } else if (cur) { found.push(cur); cur = null; }
      }
      if (t <= to) setTimeout(slice, 0); else onDone(found);
    }
    slice();
  }
  function fillGap(t) {
    if (filling || gapFrom === null || !CFG.tleApi || !window.satellite) return;
    var from = Math.max(gapFrom, t - keepMs());
    filling = true;
    getTle(t).then(function (rec) {
      scan(rec, from, t, function (found) { done = done.concat(found); gapFrom = null; filling = false; });
    }).catch(function () { filling = false; });   // gap stays open; retried on the next poll
  }

  function poll() {
    fetch(CFG.api).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      var t = Date.now(), l = look(d.latitude, d.longitude, d.altitude), sun = look(d.solar_lat, d.solar_lon, Infinity).el;
      // Naked-eye visible: ISS in sunlight while it's dark at home (sun at least 6° below the horizon).
      now = { el: l.el, az: l.az, dir: dir(l.az), km: l.km, altKm: Math.round(d.altitude), kmh: Math.round(d.velocity), visible: d.visibility === 'daylight' && sun < -6 };
      if (l.el >= minEl()) {
        if (!pass) pass = { start: t, maxEl: 0, from: now.dir, visible: false };
        if (l.el > pass.maxEl) pass.maxEl = l.el;
        pass.to = now.dir; pass.visible = pass.visible || now.visible; pass.t = t;
      } else if (pass) { done.push(pass); pass = null; }
      // Time not covered by the live poll (first start, TV off, suspended page, network outage).
      var since = lastOk === null ? t - keepMs() : lastOk;
      if (t - since > GAP_MS) gapFrom = gapFrom === null ? since : Math.min(gapFrom, since);
      lastOk = t; lastError = null;
      fillGap(t);
      schedule(l.km < 3000 ? 5 : CFG.pollSec || 30);   // poll faster while the ISS approaches (it moves ~7.7 km/s)
    }).catch(function (err) { lastError = String(err.message || err); schedule(CFG.pollSec || 30); });
  }
  function schedule(sec) { clearTimeout(timer); timer = setTimeout(poll, sec * 1000); }

  return {
    start: function () { if (CFG.api) poll(); },
    /* Current state: { now, pass (running, or null), finished (passes ended since the last call; computed ones carry calc: true) }. */
    status: function () { var f = done; done = []; return { now: now, pass: pass, finished: f, error: lastError }; }
  };
})();
