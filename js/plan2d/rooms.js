// js/plan2d/rooms.js — room detection from closed wall loops (pure geometry, no DOM).
// Walls are split at every junction/crossing into a planar graph; bounded faces of that graph are rooms.
// Interior polygons are inset by half of each wall's thickness, so areas are the real clear floor areas.
import { dist, segmentIntersection, nearestOnSegment, polygonArea, round1 } from './geometry.js';

const EPS = 1.5; // cm — endpoints closer than this are the same junction

/** walls: [{ id, x1, z1, x2, z2, thickness }] (cm). Returns [{ id, poly, centerline, area, centroid, bbox, isRect, w, d, wallIds }] (area in cm²). */
export function detectRooms(walls, { minArea = 2500 } = {}) {
  const segs = walls.map((w) => ({ id: w.id, a: { x: w.x1, y: w.z1 }, b: { x: w.x2, y: w.z2 }, t: w.thickness })).filter((s) => dist(s.a, s.b) > EPS);
  const nodes = [];
  const nodeAt = (p) => { let i = nodes.findIndex((n) => dist(n, p) <= EPS); if (i < 0) { nodes.push({ x: p.x, y: p.y }); i = nodes.length - 1; } return i; };
  const edges = new Map(); // "u-v" (u<v) -> { u, v, t, id }
  segs.forEach((s, i) => {
    const ts = [0, 1];
    segs.forEach((o, j) => {
      if (i === j) return;
      [o.a, o.b].forEach((p) => { const np = nearestOnSegment(p, s.a, s.b); if (np.d <= EPS && np.t > 0 && np.t < 1) ts.push(np.t); });
      const ip = segmentIntersection(s.a, s.b, o.a, o.b);
      if (ip) { const np = nearestOnSegment(ip, s.a, s.b); if (np.t > 0 && np.t < 1) ts.push(np.t); }
    });
    ts.sort((p, q) => p - q);
    const pts = ts.map((t) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }));
    for (let k = 0; k < pts.length - 1; k += 1) {
      const u = nodeAt(pts[k]); const v = nodeAt(pts[k + 1]); if (u === v) continue;
      const key = u < v ? `${u}-${v}` : `${v}-${u}`; if (!edges.has(key)) edges.set(key, { u, v, t: s.t, id: s.id });
    }
  });
  // adjacency, then prune dead ends (spurs never bound a room)
  const adj = nodes.map(() => new Set()); edges.forEach((e) => { adj[e.u].add(e.v); adj[e.v].add(e.u); });
  const thick = new Map(); edges.forEach((e) => { thick.set(`${e.u}-${e.v}`, e); thick.set(`${e.v}-${e.u}`, e); });
  for (let changed = true; changed;) { changed = false; adj.forEach((set, n) => { if (set.size === 1) { const [m] = set; set.clear(); adj[m].delete(n); changed = true; } }); }
  const ang = (u, v) => Math.atan2(nodes[v].y - nodes[u].y, nodes[v].x - nodes[u].x);
  const order = adj.map((set, u) => [...set].sort((p, q) => ang(u, p) - ang(u, q)));
  const seen = new Set(); const rooms = [];
  adj.forEach((set, u0) => set.forEach((v0) => {
    if (seen.has(`${u0}>${v0}`)) return;
    const loop = []; let u = u0; let v = v0; let guard = 0;
    while (!seen.has(`${u}>${v}`) && guard++ < 10000) {
      seen.add(`${u}>${v}`); loop.push([u, v]);
      const around = order[v]; const back = around.indexOf(u); const w = around[(back - 1 + around.length) % around.length]; u = v; v = w;
    }
    if (loop.length < 3 || u !== u0 || v !== v0) return;
    const centre = loop.map(([a]) => ({ x: nodes[a].x, y: nodes[a].y })); const signed = polygonArea(centre, true);
    if (signed <= 0) return; // outer face (negative orientation)
    const hs = loop.map(([a, b]) => thick.get(`${a}-${b}`).t / 2);
    const poly = insetPolygon(centre, hs) || centre; const area = polygonArea(poly); if (area < minArea) return;
    rooms.push(describe(poly, centre, area, loop.map(([a, b]) => thick.get(`${a}-${b}`).id)));
  }));
  rooms.sort((p, q) => p.bbox.y0 - q.bbox.y0 || p.bbox.x0 - q.bbox.x0);
  return rooms;
}

/** Offsets every edge of a CCW polygon inward by hs[i] and re-intersects neighbours (mitre joins). Returns null if it degenerates. */
export function insetPolygon(pts, hs) {
  const n = pts.length; const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n]; const len = dist(p, q); const dx = (q.x - p.x) / len; const dy = (q.y - p.y) / len;
    return { px: p.x - dy * hs[i], py: p.y + dx * hs[i], dx, dy };
  });
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = lines[(i - 1 + n) % n]; const b = lines[i]; const den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < 1e-6) { out.push({ x: b.px, y: b.py }); continue; }
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den; out.push({ x: round1(a.px + a.dx * t), y: round1(a.py + a.dy * t) });
  }
  return polygonArea(out, true) > 0 ? out : null;
}

function describe(poly, centerline, area, wallIds) {
  const xs = poly.map((p) => p.x); const ys = poly.map((p) => p.y); const bbox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const isRect = poly.length === 4 && poly.every((p, i) => { const q = poly[(i + 1) % 4]; return Math.abs(p.x - q.x) < 0.6 || Math.abs(p.y - q.y) < 0.6; });
  let cx = 0; let cy = 0; let a2 = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; const c = p.x * q.y - q.x * p.y; a2 += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c; });
  const centroid = a2 ? { x: cx / (3 * a2), y: cy / (3 * a2) } : { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 };
  return { id: `rm-${Math.round(centroid.x)}-${Math.round(centroid.y)}`, poly, centerline, area, centroid, bbox, isRect, w: bbox.x1 - bbox.x0, d: bbox.y1 - bbox.y0, wallIds: [...new Set(wallIds)] };
}
