/* Dark indigo base map (OpenMapTiles schema via OpenFreeMap). Colour stays quiet so the live
   accents (trains, aircraft, HB) carry the picture. */
window.HBMapStyle = function (C) {
  'use strict';
  // Base palette: coolors.co 242038-9067c6-8d86c9-cac4ce-f7ece1 (indigo, purple, lavender, lilac grey, cream).
  var T = {
    bg: '#1c1930', residential: '#242038', wood: '#211d36', grass: '#221e38', park: '#2a2442',
    water: '#3b2d6b', waterLine: '#4b3a85', building: '#2c2745',
    minor: '#2f2a48', street: '#433d66', main: '#6b64a3', motorway: '#8d86c9',
    rail: '#cac4ce', railTunnel: '#6f6a8a', railGlow: '#9067c6',
    halo: '#242038'
  };
  function road(id, classes, color, w0, w1, extra) {
    return Object.assign({
      id: id, type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, w0, 15, w1] }
    }, extra || {});
  }
  return {
    version: 8,
    glyphs: C.glyphs,
    sources: {
      omt: { type: 'vector', url: C.tiles, attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap' },
      dem: { type: 'raster-dem', tiles: [C.terrain], encoding: 'terrarium', tileSize: 256, maxzoom: 13, attribution: 'Terrain: Mapzen/AWS' }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': T.bg } },
      { id: 'residential', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]], paint: { 'fill-color': T.residential } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': T.wood } },
      { id: 'grass', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]], paint: { 'fill-color': T.grass, 'fill-opacity': 0.6 } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': T.park, 'fill-opacity': 0.8 } },
      { id: 'relief', type: 'hillshade', source: 'dem', paint: {
        'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#0f0d1a', 'hillshade-highlight-color': '#3a345a', 'hillshade-accent-color': '#1a1729' } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'],
        paint: { 'line-color': T.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 6] } },
      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': T.building, 'fill-opacity': 0.8 } },
      // Flughafen Zürich: apron and runways, quiet so the aircraft stay the accent.
      { id: 'aeroway-area', type: 'fill', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['get', 'class'], ['literal', ['apron', 'runway', 'taxiway']]]],
        paint: { 'fill-color': '#2c2745' } },
      { id: 'aeroway-taxiway', type: 'line', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'taxiway']],
        paint: { 'line-color': '#3a3459', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 4] } },
      { id: 'aeroway-runway', type: 'line', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']],
        paint: { 'line-color': '#4d466f', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 4, 15, 30] } },
      road('road-minor', ['minor', 'service'], T.minor, 0.3, 2),
      road('road-street', ['tertiary', 'secondary'], T.street, 0.7, 4),
      road('road-main', ['primary', 'trunk'], T.main, 1, 5.5),
      road('road-motorway', ['motorway'], T.motorway, 1.4, 7),
      { id: 'rail-tunnel', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['==', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.railTunnel, 'line-width': 1.4, 'line-dasharray': [2, 2] } },
      { id: 'rail-glow', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.railGlow, 'line-opacity': 0.22, 'line-blur': 3, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 12] } },
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 3.5] } }
      // No place or water names – the map stays label-free.
    ]
  };
};
