/* Live aircraft around Zürich HB from adsb.fi, falling back to adsb.lol (ADS-B, free, no key). */
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
    EC35: 'Airbus H135', EC45: 'Airbus H145', H145: 'Airbus H145', A139: 'AW139', C172: 'Cessna 172',
    A318: 'Airbus A318', A332: 'Airbus A330-200', A339: 'Airbus A330-900', A346: 'Airbus A340-600', A35K: 'Airbus A350-1000',
    A310: 'Airbus A310', B737: 'Boeing 737-700', B739: 'Boeing 737-900', B39M: 'Boeing 737 MAX 9', B3XM: 'Boeing 737 MAX 10',
    B744: 'Boeing 747-400', B748: 'Boeing 747-8', B752: 'Boeing 757-200', B764: 'Boeing 767-400', B77L: 'Boeing 777-200LR',
    B778: 'Boeing 777-8', B779: 'Boeing 777-9', B78X: 'Boeing 787-10', E170: 'Embraer E170', E175: 'Embraer E175',
    E75L: 'Embraer E175', E145: 'Embraer ERJ-145', E35L: 'Embraer Legacy 600', E55P: 'Embraer Phenom 300', E50P: 'Embraer Phenom 100',
    CRJ7: 'CRJ-700', CRJX: 'CRJ-1000', AT72: 'ATR 72', AT75: 'ATR 72-500', AT45: 'ATR 42-500', AT46: 'ATR 42-600',
    DH8C: 'Dash 8-300', SB20: 'Saab 2000', SF34: 'Saab 340', F100: 'Fokker 100', BA46: 'BAe 146', RJ85: 'Avro RJ85',
    RJ1H: 'Avro RJ100', SU95: 'Sukhoi Superjet 100', C25A: 'Cessna Citation CJ2', C25B: 'Cessna Citation CJ3',
    C25C: 'Cessna Citation CJ4', C525: 'Cessna CitationJet', C56X: 'Cessna Citation Excel', C68A: 'Cessna Citation Latitude',
    C700: 'Cessna Citation Longitude', C510: 'Cessna Citation Mustang', C182: 'Cessna 182', C152: 'Cessna 152', C208: 'Cessna Caravan',
    GLF4: 'Gulfstream IV', GLF5: 'Gulfstream V', GLF6: 'Gulfstream G650', GA6C: 'Gulfstream G600', GLEX: 'Bombardier Global Express',
    GL5T: 'Bombardier Global 5000', GL7T: 'Bombardier Global 7500', CL35: 'Bombardier Challenger 350', CL60: 'Bombardier Challenger 600',
    LJ45: 'Learjet 45', LJ75: 'Learjet 75', F2TH: 'Dassault Falcon 2000', FA7X: 'Dassault Falcon 7X', FA8X: 'Dassault Falcon 8X',
    F900: 'Dassault Falcon 900', FA50: 'Dassault Falcon 50', PRM1: 'Beechcraft Premier', BE20: 'Beechcraft King Air 200',
    B350: 'Beechcraft King Air 350', BE9L: 'Beechcraft King Air 90', BE36: 'Beechcraft Bonanza', HDJT: 'HondaJet',
    SR22: 'Cirrus SR22', SR20: 'Cirrus SR20', SF50: 'Cirrus Vision Jet', P28A: 'Piper PA-28', PA46: 'Piper Malibu',
    DA40: 'Diamond DA40', DA42: 'Diamond DA42', DA62: 'Diamond DA62', TBM9: 'Daher TBM 900', TBM8: 'Daher TBM 850',
    PC6T: 'Pilatus PC-6', PC7: 'Pilatus PC-7', PC9: 'Pilatus PC-9', PC21: 'Pilatus PC-21', C130: 'Lockheed C-130 Hercules',
    C30J: 'Lockheed C-130J', A400: 'Airbus A400M', F18: 'F/A-18 Hornet', F35: 'F-35 Lightning II', TIGR: 'F-5 Tiger',
    EC30: 'Airbus H130', EC20: 'Airbus H120', EC55: 'Airbus H155', EC75: 'Airbus H175', AS50: 'Airbus H125 Écureuil',
    AS32: 'Super Puma', AS3B: 'Super Puma', EC25: 'Airbus H225', A109: 'AW109', A169: 'AW169', B06: 'Bell 206',
    B407: 'Bell 407', B429: 'Bell 429', R44: 'Robinson R44', R22: 'Robinson R22', R66: 'Robinson R66', K126: 'Kamov',
    BE40: 'Beechjet 400', GLID: 'Segelflugzeug', BALL: 'Ballon'
  };

  /* Sources from config: each remembers when it was last asked and until when it is paused. */
  var sources = (C.adsbSources || []).map(function (s) { return { name: s.name, api: s.api, minPollSec: s.minPollSec || 0, pauseSec: s.pauseSec || 300, last: 0, pausedUntil: 0 }; });
  var source = null;

  function allPaused() {
    var now = Date.now();
    return sources.length > 0 && sources.every(function (x) { return now < x.pausedUntil; });
  }

  /* Seconds until the rate limit resets, from the response headers (null if unknown). */
  function resetSec(r) {
    var v = parseInt(r.headers.get('x-ratelimit-reset') || r.headers.get('retry-after') || '', 10);
    return v > 0 ? Math.min(v, 86400) : null;
  }

  function pick(now) {
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      if (now < s.pausedUntil) continue;
      return now - s.last >= s.minPollSec * 1000 ? s : null;   // not due yet: wait for it instead of falling through
    }
    return null;
  }

  function poll() {
    var s = pick(Date.now());
    if (!s) return;
    s.last = Date.now();
    var url = s.api + '/v2/lat/' + HB.p[1] + '/lon/' + HB.p[0] + '/dist/' + C.planeRadiusNm;
    return fetch(url).then(function (r) {
      if (!r.ok) {
        s.pausedUntil = Date.now() + ((r.status === 429 && resetSec(r)) || s.pauseSec) * 1000;
        throw new Error(s.name + ': HTTP ' + r.status);
      }
      return r.json();
    }, function (err) { s.pausedUntil = Date.now() + 60000; throw err; }).then(function (d) {
      var now = Date.now();
      source = s.name;
      (d.ac || d.aircraft || []).forEach(function (a) {   // adsb.lol: ac, adsb.fi: aircraft (same readsb fields)
        if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return;   // aircraft on the ground (taxiing, at the gate) are kept and drawn small
        var cs = (a.flight || '').trim(), p = planes[a.hex] || (planes[a.hex] = { hex: a.hex, trail: [] });
        p.callsign = cs || a.r || a.hex.toUpperCase();
        p.airline = AIRLINES[cs.slice(0, 3)] || '';
        p.type = TYPES[a.t] || a.t || '';
        p.typeCode = a.t || '';
        p.military = !!(a.dbFlags & 1);
        p.flagged = !!(a.dbFlags & 2);   // adsb.lol "interesting": curated list, mostly government/VIP aircraft
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
    var R = C.rare || {}, cs = (p.callsign || '').toUpperCase();
    var state = (R.stateCallsigns || []).some(function (pre) { return cs.indexOf(pre) === 0; });
    if (state || (R.stateFlagged && p.flagged)) return 'Staatsflug';
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
      return { hex: p.hex, callsign: p.callsign, airline: p.airline, type: p.type, typeCode: p.typeCode, reg: p.reg, altM: p.altM, climb: p.climb, kmh: p.kmh,
        track: p.track, p: [lon, lat], km: km, ground: p.ground, heli: !!p.heli, over: (p.wasOver = !p.ground && km <= C.overflightKm + (p.wasOver ? 0.8 : 0)), rare: rareReason(p), trail: p.trail.concat([[lon, lat]]) };
    });
  }

  return { start: start, positions: positions, status: function () { return { lastUpdate: lastUpdate, error: lastError, paused: allPaused(), source: source }; } };
})();
