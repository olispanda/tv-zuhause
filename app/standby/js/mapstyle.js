/* Dark base map (OpenMapTiles schema via OpenFreeMap), coloured by the active theme. Colour stays quiet so the
   live accents (trains, aircraft, HB) carry the picture. */
window.HBMapStyle = function (C, theme) {
  'use strict';
  var T = theme;   // palette from HBConfig.themes[...].map
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
    transition: { duration: 4000, delay: 0 },   // theme switches fade slowly
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
        'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': T.shadow, 'hillshade-highlight-color': T.highlight, 'hillshade-accent-color': T.accent } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': T.water } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'],
        paint: { 'line-color': T.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 6] } },
      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': T.building, 'fill-opacity': 0.8 } },
      // Flughafen Zürich: apron and runways, quiet so the aircraft stay the accent.
      { id: 'aeroway-area', type: 'fill', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['get', 'class'], ['literal', ['apron', 'runway', 'taxiway']]]],
        paint: { 'fill-color': T.aeroArea } },
      { id: 'aeroway-taxiway', type: 'line', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'taxiway']],
        paint: { 'line-color': T.taxiway, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 4] } },
      { id: 'aeroway-runway', type: 'line', source: 'omt', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']],
        paint: { 'line-color': T.runway, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 4, 15, 30] } },
      road('road-minor', ['minor', 'service'], T.minor, 0.3, 2),
      road('road-street', ['tertiary', 'secondary'], T.street, 0.7, 4),
      road('road-main', ['primary', 'trunk'], T.main, 1, 5.5),
      road('road-motorway', ['motorway'], T.motorway, 1.4, 7),
      { id: 'rail-tunnel', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['==', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.railTunnel, 'line-width': 1.4, 'line-dasharray': [2, 2] } },
      { id: 'rail-glow', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.railGlow, 'line-opacity': 0.12, 'line-blur': 3, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 12] } },
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
        paint: { 'line-color': T.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 15, 3.5] } }
      // No place or water names – the map stays label-free.
    ]
  };
};
