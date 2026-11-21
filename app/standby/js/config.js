/* Standby map – settings. Everything tunable lives here. */
window.HBConfig = {
  // Visible area: Dietikon – Uster, Flughafen (incl. runways) – Adliswil.
  // Fixed camera: zoom 11.5 with HB at this stage pixel covers that area on the full 1920×1080 screen.
  view: { zoom: 11.5, hbAt: [1010, 610] },
  hb: { id: '8503000', name: 'Zürich HB', p: [8.540212, 47.378176] },
  // Flughafen Zürich: marker at the terminal (Airside Center), same white style as HB and Zuhause.
  airport: { name: 'Flughafen', p: [8.5617, 47.4504] },
  // Zuhause: private, comes from js/local-config.js (not in Git – see local-config.example.js).
  // Aircraft overflights are measured from here; without it, from Zürich HB and no home marker is drawn.
  home: (window.HBLocalConfig && window.HBLocalConfig.home) || null,

  // Live train data: transport.opendata.ch (free, no key; fair use – keep polling modest).
  transportApi: 'https://transport.opendata.ch/v1/stationboard',
  hbPollSec: 60,            // HB departures (realtime delays/platforms)
  // All stations in and just around the map (data/stations.json, built by tools/resolve-stations.mjs)
  // plus far feeders (Bern, Aarau, Baden, Zug, Winterthur) for non-stop long-distance trains.
  // Each board is fetched in rotation every boardPollSec, starting boardBackMin in the past.
  stationsUrl: 'data/stations.json',
  boardPollSec: 600,
  boardBackMin: 15,
  // Trains are kept when at least one stop lies in this area (map view plus a margin).
  trainArea: [8.27, 47.27, 8.80, 47.50],
  // Where lines to far-away stations leave the rail network (data/rails.json), by compass bearing from HB (degrees).
  gateways: [
    { from: 345, to: 35, p: [8.513, 47.502], name: 'Bülach' },
    { from: 35, to: 80, p: [8.724, 47.500], name: 'Winterthur' },
    { from: 80, to: 125, p: [8.800, 47.310], name: 'Wetzikon' },
    { from: 125, to: 160, p: [8.660, 47.275], name: 'Meilen' },
    { from: 160, to: 200, p: [8.559, 47.265], name: 'Thalwil' },
    { from: 200, to: 240, p: [8.441, 47.265], name: 'Affoltern a. A.' },
    { from: 240, to: 290, p: [8.270, 47.349], name: 'Heitersberg' },
    { from: 290, to: 320, p: [8.262, 47.427], name: 'Baden' },
    { from: 320, to: 345, p: [8.394, 47.502], name: 'Furttal' }
  ],
  quietHours: { from: '01:30', to: '05:00' },   // no train polling during the night break

  // Live aircraft (ADS-B, free, no key), tried in order. A source that answers 429 or fails is paused
  // (until its rate-limit reset, else pauseSec) and the next one is used. minPollSec keeps a source inside its quota:
  // adsb.fi allows about 1 request/second; adsb.lol only 500 per day and IP, so it is a slow fallback.
  // The browser preview goes through the local proxy (standby/tools/serve.py), as neither sends CORS headers.
  adsbSources: (function (local) {
    return [
      { name: 'adsb.fi', api: local ? '/proxy/adsbfi' : 'https://opendata.adsb.fi/api', minPollSec: 0, pauseSec: 300 },
      { name: 'adsb.lol', api: local ? '/proxy/adsb' : 'https://api.adsb.lol', minPollSec: 180, pauseSec: 900 }
    ];
  })(location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)),
  planePollSec: 10,
  planeRadiusNm: 12,
  overflightKm: 2.5,       // 'Überflug Zuhause' if closer than this (horizontal)

  // Map tiles (free, no key) and terrain for the subtle relief.
  tiles: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',

  // Animation: target frame rate. If the TV can't keep up, the map lowers it by itself (down to minFps)
  // and raises it again when there is headroom – see the HBPerf readout in the browser console.
  fps: 25,
  minFps: 8,

  // The only trains that count as rare: highlighted on the map and shown as an overview card.
  // Matched (case-insensitive) against category, train number, line, destination and operator.
  // Note: such special runs only show up if the operator publishes them in the public timetable – often they don't.
  highlight: [
    { label: 'Blauer Pfeil', match: ['blauer pfeil', 'blue arrow'] },
    { label: 'Messzug', match: ['messzug', 'funkmesszug', 'diagnosezug', 'messfahrt'] },
    { label: 'Churchill-Pfeil', match: ['churchill'] },   // a nostalgia train, named specifically
    { label: 'Nostalgiezug', match: ['nostalgie', 'dampf', 'oldtimer', 'stehwagen', 'erlebniszug'],
      operators: ['sbb historic', 'historic', 'dampfbahn', 'dvzo'] }
  ],

  // UI font (Google Fonts family). Try others in the browser with ?font=Inter etc. – see fonts.html.
  font: 'Space Grotesk',

  // "Seltenes" – shown as an overview card under the clock and highlighted on the map while in view.
  rare: {
    trainCategories: [],     // no whole categories – only the highlight list above counts as rare
    aircraftTypes: ['A388', 'B744', 'B748', 'B74F', 'A124', 'A225', 'C17', 'A400', 'C130', 'C30J', 'BLCF', 'A3ST', 'CONC', 'DC3', 'JU52'],
    helicopters: true,       // e.g. Rega, police
    military: true,          // ADS-B military flag
    // State/government flights: callsign prefixes of air forces' VIP squadrons and government fleets.
    stateCallsigns: ['SUI',            // Schweizer Luftwaffe / Lufttransportdienst des Bundes
      'GAF', 'GNY',                    // Deutschland: Luftwaffe (Flugbereitschaft), Marine
      'CTM', 'FAF', 'FNY',             // Frankreich: COTAM, Armée de l'air, Marine
      'IAM', 'AME', 'BAF', 'NAF',      // Italien, Spanien, Belgien, Niederlande
      'RRR', 'KRF', 'HAF', 'PLF',      // UK: RAF, Royal Flight; Griechenland; Polen
      'SAM', 'RCH', 'CFC', 'ASY',      // USA: Special Air Mission, Reach; Kanada; Australien
      'NATO', 'UNO'],
    stateFlagged: true,      // adsb.lol "interesting" flag (curated government/VIP aircraft)
    // Small list top right: state flights and military aircraft seen in the map during the last logHours.
    logReasons: ['Staatsflug', 'Militär'],
    logHours: 24
  },

  // ISS passes over home (wheretheiss.at, free, no key). Counted when it rises above minElevation degrees;
  // shown as a special card while overhead and kept in the list top right for rare.logHours.
  iss: { api: 'https://api.wheretheiss.at/v1/satellites/25544', minElevation: 25, pollSec: 30 },

  // Two dark themes, switched by the sun at home: 'day' while the sun is above dayFromSun degrees
  // (-6 = civil dusk), 'night' otherwise. Preview one in the browser with ?theme=day or ?theme=night.
  dayFromSun: -6,
  themes: {
    // Nacht – Graphit & Gold: anthracite map, white rails; trains gold/amber/champagne, aircraft ivory.
    night: {
      map: { bg: '#121315', residential: '#17181b', wood: '#141517', grass: '#16171a', park: '#1b1c1f', water: '#1f2226', waterLine: '#2c3036',
        building: '#1e1f23', minor: '#222327', street: '#2b2c30', main: '#3a3b40', motorway: '#55565c',
        rail: '#e4e5e8', railTunnel: '#606168', railGlow: '#ffffff', aeroArea: '#1e1f23', taxiway: '#2a2b2f', runway: '#3a3b40',
        shadow: '#050506', highlight: '#2a2b30', accent: '#0c0c0e' },
      colors: { sbahn: '#f2c14e', long: '#ff9b3d', regio: '#e8d6a0', home: '#c9a24a', plane: '#f4f1ea', special: '#fff3c4', hb: '#ffffff' },
      halo: '#121315',
      ui: { '--bg': '#121315', '--surface': '#1c1d21', '--surface-high': '#2a2b30', '--outline': 'rgba(242, 193, 78, 0.16)',
        '--on-surface': '#f4efe3', '--on-surface-var': '#b3a989', '--ok': '#f2c14e', '--home': '#c9a24a', '--ink': '#121315',
        '--wash': '18, 19, 21', '--log-bg': 'rgba(28, 29, 33, 0.85)', '--attr': 'rgba(179, 169, 137, 0.5)' }
    },
    // Tag – Petrol & Koralle: deep-sea petrol map, turquoise rails; trains coral/raspberry/peach, aircraft sun-yellow.
    day: {
      map: { bg: '#0d2027', residential: '#11272f', wood: '#0f242b', grass: '#10262d', park: '#143039', water: '#1a4450', waterLine: '#24596a',
        building: '#163039', minor: '#19343d', street: '#1d4149', main: '#265460', motorway: '#336b77',
        rail: '#7fd1c7', railTunnel: '#2f5f66', railGlow: '#b8fff4', aeroArea: '#163039', taxiway: '#1d414b', runway: '#2a5662',
        shadow: '#04121a', highlight: '#1f4652', accent: '#0a1a20' },
      colors: { sbahn: '#ff8a6b', long: '#ff5c7a', regio: '#ffc08a', home: '#7fd1c7', plane: '#ffe78a', special: '#ffd6e0', hb: '#ffffff' },
      halo: '#0d2027',
      ui: { '--bg': '#0d2027', '--surface': '#132c34', '--surface-high': '#1c3d47', '--outline': 'rgba(127, 209, 199, 0.18)',
        '--on-surface': '#e9f6f3', '--on-surface-var': '#8fb8b4', '--ok': '#7fd1c7', '--home': '#7fd1c7', '--ink': '#0d2027',
        '--wash': '13, 32, 39', '--log-bg': 'rgba(19, 44, 52, 0.85)', '--attr': 'rgba(143, 184, 180, 0.5)' }
    }
  }
};
