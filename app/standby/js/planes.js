/* Live aircraft around Zürich HB from adsb.lol (ADS-B, free, no key). */
window.Planes = (function () {
  'use strict';
  var C = window.HBConfig, HB = C.hb;
  var planes = {}, lastUpdate = 0, lastError = null;
  var KN = 0.514444, FT = 0.3048;

  var AIRLINES = {
    SWR: 'SWISS', EDW: 'Edelweiss', OAW: 'Helvetic', DLH: 'Lufthansa', AUA: 'Austrian', BAW: 'British Airways', AFR: 'Air France',
    KLM: 'KLM', UAE: 'Emirates', QTR: 'Qatar Airways', ETD: 'Etihad', THY: 'Turkish Airlines', EZY: 'easyJet', EJU: 'easyJet Europe',
    EZS: 'easyJet Switzerland', RYR: 'Ryanair', IBE: 'Iberia', VLG: 'Vueling', SAS: 'SAS', FIN: 'Finnair', TAP: 'TAP Air Portugal',
    UAL: 'United', DAL: 'Delta', AAL: 'American', ACA: 'Air Canada', SIA: 'Singapore Airlines', CPA: 'Cathay Pacific', ELY: 'El Al',
    EWG: 'Eurowings', CFG: 'Condor', BEL: 'Brussels Airlines', LOT: 'LOT', AEE: 'Aegean', ITY: 'ITA Airways', WZZ: 'Wizz Air',
    CTN: 'Croatia Airlines', SXS: 'SunExpress', PGT: 'Pegasus', AZA: 'ITA Airways', ICE: 'Icelandair', NAX: 'Norwegian', REGA: 'Rega'
  };
  var TYPES = {
    A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', A320: 'Airbus A320', A321: 'Airbus A321', A319: 'Airbus A319', A333: 'Airbus A330-300',
    A343: 'Airbus A340-300', A359: 'Airbus A350-900', A388: 'Airbus A380', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
    B77W: 'Boeing 777-300ER', B772: 'Boeing 777-200', B789: 'Boeing 787-9', B788: 'Boeing 787-8', B38M: 'Boeing 737 MAX 8',
    B738: 'Boeing 737-800', B763: 'Boeing 767-300', E190: 'Embraer E190', E195: 'Embraer E195', E295: 'Embraer E195-E2',
    E290: 'Embraer E190-E2', DH8D: 'Dash 8-400', AT76: 'ATR 72-600', CRJ9: 'CRJ-900', PC12: 'Pilatus PC-12', PC24: 'Pilatus PC-24',
    EC35: 'Airbus H135', EC45: 'Airbus H145', H145: 'Airbus H145', A139: 'AW139', C172: 'Cessna 172'
  };

  function poll() {
    var url = C.adsbApi + '/v2/lat/' + HB.p[1] + '/lon/' + HB.p[0] + '/dist/' + C.planeRadiusNm;
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      var now = Date.now();
      (d.ac || []).forEach(function (a) {
        if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return;   // aircraft on the ground (taxiing, at the gate) are kept and drawn small
        var cs = (a.flight || '').trim(), p = planes[a.hex] || (planes[a.hex] = { hex: a.hex, trail: [] });
        p.callsign = cs || a.r || a.hex.toUpperCase();
        p.airline = AIRLINES[cs.slice(0, 3)] || '';
        p.type = TYPES[a.t] || a.t || '';
        p.typeCode = a.t || '';
        p.military = !!(a.dbFlags & 1);
        p.heli = a.category === 'A7' || /^(EC|H1|A1[0-9]{2}|AS3|R44|R22|B06|B407|B429)/.test(a.t || '');
        p.reg = a.r || '';
        p.ground = a.alt_baro === 'ground';
        p.altM = p.ground ? 0 : typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * FT) : null;
        p.climb = a.baro_rate || 0;
        p.kmh = a.gs ? Math.round(a.gs * KN * 3.6) : null;
        p.track = typeof a.track === 'number' ? a.track : (p.track || 0);
        p.speed = a.gs ? a.gs * KN : 0;
        p.lat = a.lat; p.lon = a.lon; p.t = now - (a.seen_pos || 0) * 1000; p.seen = now;
        if (p.ground) p.trail = []; else { p.trail.push([a.lon, a.lat]); if (p.trail.length > 24) p.trail.shift(); }
      });
      Object.keys(planes).forEach(function (k) { if (now - planes[k].seen > 60000) delete planes[k]; });
      lastUpdate = now; lastError = null;
    }).catch(function (err) { lastError = String(err.message || err); });
  }

  function start() { poll(); setInterval(poll, C.planePollSec * 1000); }

  /* Why an aircraft counts as rare ('' if it doesn't). */
  function rareReason(p) {
    var R = C.rare || {};
    if (R.military && p.military) return 'Militär';
    if ((R.aircraftTypes || []).indexOf(p.typeCode) >= 0) return 'Seltener Flugzeugtyp';
    if (R.helicopters && p.heli) return 'Helikopter';
    return '';
  }

  /* Dead-reckoned positions between polls for smooth movement. */
  function positions(nowMs) {
    return Object.keys(planes).map(function (k) {
      var p = planes[k], dt = Math.min(20, Math.max(0, (nowMs - p.t) / 1000)), d = p.speed * dt, rad = p.track * Math.PI / 180;
      var lon = p.lon + d * Math.sin(rad) / (111320 * Math.cos(p.lat * Math.PI / 180)), lat = p.lat + d * Math.cos(rad) / 111320;
      var km = Rails.dist([lon, lat], (C.home || HB).p) / 1000;
      return { hex: p.hex, callsign: p.callsign, airline: p.airline, type: p.type, reg: p.reg, altM: p.altM, climb: p.climb, kmh: p.kmh,
        track: p.track, p: [lon, lat], km: km, ground: p.ground, over: (p.wasOver = !p.ground && km <= C.overflightKm + (p.wasOver ? 0.8 : 0)), rare: rareReason(p), trail: p.trail.concat([[lon, lat]]) };
    });
  }

  return { start: start, positions: positions, status: function () { return { lastUpdate: lastUpdate, error: lastError }; } };
})();
