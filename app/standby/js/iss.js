/* International Space Station: live position from wheretheiss.at (free, no key, CORS ok).
   A pass counts when the ISS rises higher than iss.minElevation above the horizon at home. */
window.ISS = (function () {
  'use strict';
  var C = window.HBConfig, CFG = C.iss || {}, R = 6371, DEG = Math.PI / 180;
  var now = null, pass = null, done = [], lastError = null, timer = null;
  var DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

  /* Elevation (degrees above the horizon) and azimuth of a point at altKm above the ground point [lat, lon], seen from home. */
  function look(lat, lon, altKm) {
    var h = (C.home || C.hb).p, la1 = h[1] * DEG, la2 = lat * DEG, dl = (lon - h[0]) * DEG;
    var cosT = Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl), t = Math.acos(Math.max(-1, Math.min(1, cosT)));
    var el = altKm === Infinity ? 90 - t / DEG : Math.atan2(cosT - R / (R + altKm), Math.sin(t)) / DEG;
    var az = Math.atan2(Math.sin(dl) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl)) / DEG;
    return { el: el, az: (az + 360) % 360, km: t * R };
  }
  function dir(az) { return DIRS[Math.round(az / 45) % 8]; }

  function poll() {
    fetch(CFG.api).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      var t = Date.now(), l = look(d.latitude, d.longitude, d.altitude), sun = look(d.solar_lat, d.solar_lon, Infinity).el;
      // Naked-eye visible: ISS in sunlight while it's dark at home (sun at least 6° below the horizon).
      now = { el: l.el, az: l.az, dir: dir(l.az), km: l.km, altKm: Math.round(d.altitude), kmh: Math.round(d.velocity), visible: d.visibility === 'daylight' && sun < -6 };
      if (l.el >= (CFG.minElevation || 25)) {
        if (!pass) pass = { start: t, maxEl: 0, from: now.dir, visible: false };
        if (l.el > pass.maxEl) pass.maxEl = l.el;
        pass.to = now.dir; pass.visible = pass.visible || now.visible; pass.t = t;
      } else if (pass) { done.push(pass); pass = null; }
      lastError = null;
      schedule(l.km < 3000 ? 5 : CFG.pollSec || 30);   // poll faster while the ISS approaches (it moves ~7.7 km/s)
    }).catch(function (err) { lastError = String(err.message || err); schedule(CFG.pollSec || 30); });
  }
  function schedule(sec) { clearTimeout(timer); timer = setTimeout(poll, sec * 1000); }

  return {
    start: function () { if (CFG.api) poll(); },
    /* Current state: { now, pass (running, or null), finished (passes ended since the last call) }. */
    status: function () { var f = done; done = []; return { now: now, pass: pass, finished: f, error: lastError }; }
  };
})();
