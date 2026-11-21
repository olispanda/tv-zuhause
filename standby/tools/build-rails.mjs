// Build-time: extract the Zürich rail network from OpenFreeMap vector tiles (OpenMapTiles schema)
// and write a small routing graph to app/standby/data/rails.json. Run: node build-rails.mjs
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { writeFileSync } from 'node:fs';

const BBOX = [8.27, 47.27, 8.80, 47.50];   // west, south, east, north (a bit larger than the visible map)
const Z = 14;
const SKIP_SERVICE = new Set(['yard', 'siding', 'spur']);
const SNAP_M = 6, JOIN_M = 25;

const lon2x = (lon) => Math.floor((lon + 180) / 360 * 2 ** Z);
const lat2y = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** Z);
const M_LAT = 111320, M_LON = 111320 * Math.cos(47.38 * Math.PI / 180);
const dist = (a, b) => Math.hypot((a[0] - b[0]) * M_LON, (a[1] - b[1]) * M_LAT);

const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const template = tj.tiles[0];
const jobs = [];
for (let x = lon2x(BBOX[0]); x <= lon2x(BBOX[2]); x++) for (let y = lat2y(BBOX[3]); y <= lat2y(BBOX[1]); y++) jobs.push([x, y]);
console.log('tiles', jobs.length);

const lines = [];
async function fetchTile([x, y]) {
  const url = template.replace('{z}', Z).replace('{x}', x).replace('{y}', y);
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const tile = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
  const layer = tile.layers.transportation;
  if (!layer) return;
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i), p = f.properties;
    if (p.class !== 'rail' || SKIP_SERVICE.has(p.service)) continue;
    const gj = f.toGeoJSON(x, y, Z).geometry;
    const parts = gj.type === 'LineString' ? [gj.coordinates] : gj.type === 'MultiLineString' ? gj.coordinates : [];
    for (const c of parts) lines.push({ c, tunnel: p.brunnel === 'tunnel' });
  }
}
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(fetchTile));
console.log('line parts', lines.length);

// Nodes: snap vertices to a grid and merge near neighbours.
const nodes = [], grid = new Map(), cell = (p) => Math.round(p[0] * M_LON / SNAP_M) + ':' + Math.round(p[1] * M_LAT / SNAP_M);
function nodeFor(p) {
  const cx = Math.round(p[0] * M_LON / SNAP_M), cy = Math.round(p[1] * M_LAT / SNAP_M);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const hit = grid.get((cx + dx) + ':' + (cy + dy));
    if (hit !== undefined && dist(nodes[hit].p, p) <= SNAP_M) return hit;
  }
  nodes.push({ p, adj: new Map() });
  grid.set(cell(p), nodes.length - 1);
  return nodes.length - 1;
}
function link(a, b, tunnel) {
  if (a === b) return;
  const d = dist(nodes[a].p, nodes[b].p), cur = nodes[a].adj.get(b);
  if (!cur || cur.d > d) { nodes[a].adj.set(b, { d, t: tunnel }); nodes[b].adj.set(a, { d, t: tunnel }); }
}
for (const l of lines) {
  let prev = nodeFor(l.c[0]);
  for (let i = 1; i < l.c.length; i++) { const n = nodeFor(l.c[i]); link(prev, n, l.tunnel); prev = n; }
}
// Join dangling ends (tile clipping, simplified T-junctions) onto the nearest track segment,
// splitting that segment at the projected point.
function project(p, a, b) {
  const ax = (a[0] - p[0]) * M_LON, ay = (a[1] - p[1]) * M_LAT, bx = (b[0] - p[0]) * M_LON, by = (b[1] - p[1]) * M_LAT;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return { t, d: Math.hypot(ax + t * dx, ay + t * dy), q: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] };
}
function unlink(a, b) { nodes[a].adj.delete(b); nodes[b].adj.delete(a); }
let joined = 0;
for (let pass = 0; pass < 2; pass++) {
  const ends = [];
  nodes.forEach((n, i) => { if (n.adj.size === 1) ends.push(i); });
  for (const i of ends) {
    const n = nodes[i];
    if (n.adj.size !== 1) continue;
    const own = [...n.adj.keys()][0], tunnel = n.adj.get(own).t;
    // walk a few hops back along the own line so we don't snap onto ourselves
    const nearOwn = new Set([i, own]);
    let prev = i, cur = own;
    for (let k = 0; k < 6 && nodes[cur].adj.size === 2; k++) { const nx = [...nodes[cur].adj.keys()].find((x) => x !== prev); prev = cur; cur = nx; nearOwn.add(cur); }
    let best = null;
    nodes.forEach((m, a) => {
      if (Math.abs(m.p[1] - n.p[1]) * M_LAT > 400) return;
      m.adj.forEach((e, b) => {
        if (b < a || nearOwn.has(a) && nearOwn.has(b)) return;
        const pr = project(n.p, m.p, nodes[b].p);
        if (pr.d < JOIN_M && (!best || pr.d < best.pr.d)) best = { a, b, pr, e };
      });
    });
    if (!best) continue;
    let target;
    if (best.pr.t < 0.05) target = best.a; else if (best.pr.t > 0.95) target = best.b;
    else {
      nodes.push({ p: best.pr.q, adj: new Map() }); target = nodes.length - 1;
      unlink(best.a, best.b); link(best.a, target, best.e.t); link(target, best.b, best.e.t);
    }
    link(i, target, tunnel); joined++;
  }
}
// Attach remaining fragments to the main network at their closest point (max 120 m).
function components() {
  const comp = new Array(nodes.length).fill(-1), sizes = [];
  for (let i = 0; i < nodes.length; i++) if (comp[i] < 0) {
    const s = [i]; comp[i] = sizes.length; let n = 0;
    while (s.length) { const v = s.pop(); n++; nodes[v].adj.forEach((_, w) => { if (comp[w] < 0) { comp[w] = sizes.length; s.push(w); } }); }
    sizes.push(n);
  }
  return { comp, sizes };
}
let merged = 0;
for (let round = 0; round < 20; round++) {
  const { comp, sizes } = components(), main = sizes.indexOf(Math.max(...sizes));
  let best = null;
  nodes.forEach((n, i) => {
    if (comp[i] === main || sizes[comp[i]] < 8) return;
    nodes.forEach((m, j) => {
      if (comp[j] !== main || Math.abs(m.p[1] - n.p[1]) * M_LAT > 120) return;
      const d = dist(n.p, m.p);
      if (d < 120 && (!best || d < best.d)) best = { i, j, d };
    });
  });
  if (!best) break;
  link(best.i, best.j, false); merged++;
}
console.log('nodes', nodes.length, 'joined ends', joined, 'merged fragments', merged);

const out = {
  source: 'OpenFreeMap / OpenMapTiles, © OpenStreetMap contributors', bbox: BBOX,
  nodes: nodes.map((n) => [+n.p[0].toFixed(6), +n.p[1].toFixed(6)]),
  edges: []
};
nodes.forEach((n, i) => n.adj.forEach((e, j) => { if (i < j) out.edges.push([i, j, Math.round(e.d), e.t ? 1 : 0]); }));
writeFileSync(new URL('../../app/standby/data/rails.json', import.meta.url), JSON.stringify(out));
console.log('edges', out.edges.length);
