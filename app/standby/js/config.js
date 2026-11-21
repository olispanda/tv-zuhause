/* Standby map – settings. Everything tunable lives here. */
window.HBConfig = {
  // Visible area: Dietikon – Uster, Flughafen (incl. runways) – Adliswil.
  // Fixed camera: zoom 11.5 with HB at this stage pixel covers that area on the full 1920×1080 screen.
  view: { zoom: 11.5, hbAt: [1010, 610] },
  hb: { id: '8503000', name: 'Zürich HB', p: [8.540212, 47.378176] },
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

  // Live aircraft: adsb.lol (free, no key). The browser preview goes through the local proxy (tools/serve.py).
  adsbApi: location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)/.test(location.hostname) ? '/proxy/adsb' : 'https://api.adsb.lol',
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
    military: true           // ADS-B military flag
  },

  // Accent colours: cool mint/turquoise contrast on the indigo base; rare highlights in warm cream.
  colors: {
    sbahn: '#5cf2b4', long: '#26d9e6', regio: '#1fb8a6', home: '#9067c6', plane: '#c8fff0', special: '#f7ece1', hb: '#ffffff'
  }
};
