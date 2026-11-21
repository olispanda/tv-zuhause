/* Rail network (data/rails.json, built by tools/build-rails.mjs) and routing between stations. */
window.Rails = (function () {
  'use strict';
  var M_LAT = 111320, M_LON = 111320 * Math.cos(47.38 * Math.PI / 180);
  var nodes = [], adj = [], bbox = null, cache = {};

  function dist(a, b) { return Math.hypot((a[0] - b[0]) * M_LON, (a[1] - b[1]) * M_LAT); }

  function load(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (g) {
      nodes = g.nodes; bbox = g.bbox;
      adj = nodes.map(function () { return []; });
      g.edges.forEach(function (e) { adj[e[0]].push([e[1], e[2], e[3]]); adj[e[1]].push([e[0], e[2], e[3]]); });
    });
  }

  function inside(p, marginM) {
    var mx = (marginM || 0) / M_LON, my = (marginM || 0) / M_LAT;
    return p[0] > bbox[0] + mx && p[0] < bbox[2] - mx && p[1] > bbox[1] + my && p[1] < bbox[3] - my;
  }

  /* Candidate graph nodes for a station. A far-away station maps to the graph node closest to it,
     which is where its line leaves the covered area; `extra` is the straight-line remainder. */
  function anchors(p) {
    var list = [], best = -1, bd = Infinity;
    if (inside(p, 800)) {
      // Off-network distance costs 4x so the route starts at the track right next to the station.
      nodes.forEach(function (q, i) { var d = dist(p, q); if (d < 250) list.push([i, d * 4]); if (d < bd) { bd = d; best = i; } });
      if (!list.length) list.push([best, bd * 4]);
      return { list: list, extra: 0 };
    }
    // Far away: enter/leave the map through the gateway line in that direction.
    var hb = window.HBConfig.hb.p, brg = (Math.atan2((p[0] - hb[0]) * M_LON, (p[1] - hb[1]) * M_LAT) * 180 / Math.PI + 360) % 360;
    var gw = window.HBConfig.gateways.filter(function (g) { return g.from < g.to ? brg >= g.from && brg < g.to : brg >= g.from || brg < g.to; })[0];
    var via = gw ? gw.p : p;
    nodes.forEach(function (q, i) { var d = dist(via, q); if (d < bd) { bd = d; best = i; } });
    return { list: [[best, 0]], extra: dist(nodes[best], p) * 1.15 };
  }

  /* Binary heap Dijkstra from a set of sources to the cheapest of a set of targets. */
  function dijkstra(src, dst) {
    var n = nodes.length, D = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), heap = [];
    var goal = {}, best = Infinity, bestNode = -1;
    dst.forEach(function (t) { goal[t[0]] = t[1]; });
    function push(d, v) { heap.push([d, v]); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } }
      return top;
    }
    src.forEach(function (s) { if (s[1] < D[s[0]]) { D[s[0]] = s[1]; push(s[1], s[0]); } });
    while (heap.length) {
      var it = pop(), d = it[0], v = it[1];
      if (d > D[v]) continue;
      if (d >= best) break;
      if (goal[v] !== undefined && d + goal[v] < best) { best = d + goal[v]; bestNode = v; }
      for (var k = 0; k < adj[v].length; k++) {
        var w = adj[v][k][0], nd = d + adj[v][k][1];
        if (nd < D[w]) { D[w] = nd; prev[w] = v; push(nd, w); }
      }
    }
    if (bestNode < 0) return null;
    var path = []; for (var v2 = bestNode; v2 >= 0; v2 = prev[v2]) path.push(v2);
    return path.reverse();
  }

  function pathLength(path) { var s = 0; for (var i = 1; i < path.length; i++) s += dist(nodes[path[i - 1]], nodes[path[i]]); return s; }
  function edgeTunnel(a, b) { var l = adj[a]; for (var i = 0; i < l.length; i++) if (l[i][0] === b) return l[i][2]; return 0; }

  /* Route between two stations: polyline with cumulative lengths and tunnel flags per segment.
     lead/tail = straight-line distance outside the covered area before/after the polyline. */
  function route(aKey, aP, bKey, bP) {
    var key = aKey + '>' + bKey;
    if (cache[key]) return cache[key];
    var A = anchors(aP), B = anchors(bP), path = dijkstra(A.list, B.list), r;
    var straight = dist(aP, bP);
    if (path && !A.extra && !B.extra && pathLength(path) > straight * 2.5 + 500) path = null;   // gap in the network: avoid absurd detours
    if (!path || path.length < 2) r = { coords: [aP, bP], cum: [0, straight], tunnel: [0], len: straight, lead: 0, tail: 0 };
    else {
      var coords = path.map(function (i) { return nodes[i]; }), cum = [0], tunnel = [];
      for (var i = 1; i < path.length; i++) { cum.push(cum[i - 1] + dist(coords[i - 1], coords[i])); tunnel.push(edgeTunnel(path[i - 1], path[i])); }
      r = { coords: coords, cum: cum, tunnel: tunnel, len: cum[cum.length - 1], lead: A.extra, tail: B.extra };
    }
    cache[key] = r;
    return r;
  }

  /* Point at distance s along a route polyline (null outside the polyline). */
  function along(r, s) {
    if (s < 0 || s > r.len || r.coords.length < 2) return null;
    var lo = 0, hi = r.cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (r.cum[mid] <= s) lo = mid; else hi = mid; }
    var seg = r.cum[hi] - r.cum[lo], f = seg ? (s - r.cum[lo]) / seg : 0, a = r.coords[lo], b = r.coords[hi];
    return { p: [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])], tunnel: r.tunnel[lo] || 0, bearing: Math.atan2((b[0] - a[0]) * M_LON, (b[1] - a[1]) * M_LAT) * 180 / Math.PI };
  }

  return { load: load, route: route, along: along, dist: dist, inside: inside };
})();
