/* Day / night palette for the launcher, matching the two standby map themes (app/standby/js/config.js):
   day = Petrol & Koralle, night = Graphit & Gold. Switched by the sun like the map: 'day' while the sun is above
   -6 degrees (civil dusk) at Zürich HB (or CleanFrameLocal.location), otherwise 'night'. The palette is a class on <html>, so main.js can rewrite the
   stage's classes freely. Preview one in the browser with ?theme=day or ?theme=night. */
(function () {
  'use strict';
  var LOCAL = window.CleanFrameLocal || {}, PLACE = LOCAL.location && typeof LOCAL.location[0] === 'number' ? LOCAL.location : [8.540212, 47.378176];
  var LON = PLACE[0], LAT = PLACE[1], DAY_FROM_SUN = -6;
  var root = document.documentElement, current = null;
  var forced = (/[?&]theme=(day|night)/.exec(window.location.search) || [])[1] || null;

  function sunElevation(date, lon, lat) {   // degrees; NOAA low-precision formula, plenty for a day/night switch
    var rad = Math.PI / 180, d = date.getTime() / 86400000 - 10957.5;
    var g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = (gmst * 15 + lon) * rad - ra;
    return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
  }
  function pick() { return forced || (sunElevation(new Date(), LON, LAT) > DAY_FROM_SUN ? 'day' : 'night'); }
  function apply() {
    var name = pick();
    if (name === current) return;
    current = name;
    root.className = (' ' + root.className + ' ').replace(/\s(?:m3|pal-day|pal-night)(?=\s)/g, ' ').replace(/^\s+|\s+$/g, '') + ' m3 pal-' + name;
  }
  apply();
  window.setInterval(apply, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });

  var QA = window.ShoreQA = window.ShoreQA || {};
  QA.palette = { current: function () { return current; }, set: function (name) { forced = name === 'day' || name === 'night' ? name : null; apply(); } };
}());
