// js/plan2d/geometry.js — pure 2D geometry + snapping for the plan editor (no DOM, unit-tested).
// Units: centimetres. Plan axes: x → east, y(=z in the design config) → south. Coordinates keep 0.1 cm (1 mm) precision.
export const round1 = (v) => Math.round(v * 10) / 10;
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const angleDeg = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Nearest point on segment ab to p. Returns { x, y, t, d } with t in 0..1. */
export function nearestOnSegment(p, a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  const x = a.x + dx * t; const y = a.y + dy * t;
  return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
}

/** Intersection of segments ab and cd (null when parallel or not crossing). */
export function segmentIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }; const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Free wall → centre-line segment. */
export const wallSeg = (w) => ({ a: { x: w.x1, y: w.z1 }, b: { x: w.x2, y: w.z2 } });

/** Four centre-line segments of a rectangular room (n, e, s, w) — same order as SIDES. */
export function roomSegs(r) {
  const x0 = r.x; const y0 = r.z; const x1 = r.x + r.w; const y1 = r.z + r.d;
  return [
    { a: { x: x0, y: y0 }, b: { x: x1, y: y0 }, side: 'n' }, { a: { x: x1, y: y0 }, b: { x: x1, y: y1 }, side: 'e' },
    { a: { x: x0, y: y1 }, b: { x: x1, y: y1 }, side: 's' }, { a: { x: x0, y: y0 }, b: { x: x0, y: y1 }, side: 'w' }
  ];
}

/** Polygon (4 points) of a wall segment with thickness; ends extended by `ext` so corners close without gaps. */
export function wallPolygon(a, b, thickness, ext = 0) {
  const l = dist(a, b) || 1; const ux = (b.x - a.x) / l; const uy = (b.y - a.y) / l; const nx = -uy * (thickness / 2); const ny = ux * (thickness / 2);
  const ax = a.x - ux * ext; const ay = a.y - uy * ext; const bx = b.x + ux * ext; const by = b.y + uy * ext;
  return [{ x: ax + nx, y: ay + ny }, { x: bx + nx, y: by + ny }, { x: bx - nx, y: by - ny }, { x: ax - nx, y: ay - ny }];
}

export function polygonArea(pts, signed = false) {
  let s = 0; for (let i = 0; i < pts.length; i += 1) { const p = pts[i]; const q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; }
  return signed ? s / 2 : Math.abs(s) / 2;
}

/** Point lies within an axis-aligned rotated rectangle (centre cx,cy, size w×d, rotation deg). */
export function pointInRotRect(p, cx, cy, w, d, rotDeg) {
  const r = (-rotDeg * Math.PI) / 180; const dx = p.x - cx; const dy = p.y - cy;
  const x = dx * Math.cos(r) - dy * Math.sin(r); const y = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(x) <= w / 2 && Math.abs(y) <= d / 2;
}

/** Lock direction from `from` to p to the nearest multiple of 45° (keeps length). */
export function orthoLock(from, p) {
  const l = dist(from, p); if (l === 0) return { x: p.x, y: p.y };
  const a = Math.round(angleDeg(from, p) / 45) * 45; const r = (a * Math.PI) / 180;
  return { x: round1(from.x + Math.cos(r) * l), y: round1(from.y + Math.sin(r) * l) };
}

/** Point at exactly `length` from `from`, in the direction of `toward`. */
export function pointAtLength(from, toward, length) {
  const l = dist(from, toward); const ux = l ? (toward.x - from.x) / l : 1; const uy = l ? (toward.y - from.y) / l : 0;
  return { x: round1(from.x + ux * length), y: round1(from.y + uy * length) };
}

/**
 * Snapping engine. ctx = {
 *   step (cm, 0 = no grid), tol (cm, pick radius), from (optional start point of the segment being drawn),
 *   segs: [{a,b}] centre-lines to snap to, modes: { grid, endpoint, midpoint, intersection, nearest, perpendicular, align, ortho }
 * }
 * Returns { x, y, kind, guides: [{x1,y1,x2,y2}] } — kind ∈ endpoint|midpoint|intersection|perpendicular|align|nearest|grid|free.
 * Priority: endpoint > intersection > midpoint > perpendicular > align > nearest(on wall) > grid.
 */
export function snapPoint(p, ctx) {
  const { step = 10, tol = 10, from = null, segs = [] } = ctx; const m = { grid: true, endpoint: true, midpoint: true, intersection: true, nearest: true, perpendicular: true, align: true, ortho: false, ...(ctx.modes || {}) };
  let q = { ...p }; if (from && m.ortho) q = orthoLock(from, q);
  const within = (c) => Math.hypot(c.x - q.x, c.y - q.y) <= tol;
  const done = (pt, kind, guides = []) => ({ x: round1(pt.x), y: round1(pt.y), kind, guides });
  if (m.endpoint) { for (const s of segs) { if (within(s.a)) return done(s.a, 'endpoint'); if (within(s.b)) return done(s.b, 'endpoint'); } }
  if (m.intersection) {
    for (let i = 0; i < segs.length; i += 1) for (let j = i + 1; j < segs.length; j += 1) { const ip = segmentIntersection(segs[i].a, segs[i].b, segs[j].a, segs[j].b); if (ip && within(ip)) return done(ip, 'intersection'); }
  }
  if (m.midpoint) { for (const s of segs) { const mp = lerpPt(s.a, s.b, 0.5); if (within(mp)) return done(mp, 'midpoint'); } }
  if (from && m.perpendicular) {
    for (const s of segs) {
      const np = nearestOnSegment(from, s.a, s.b);
      if (np.t > 0.001 && np.t < 0.999 && within(np)) return done(np, 'perpendicular', [{ x1: from.x, y1: from.y, x2: np.x, y2: np.y }]);
    }
  }
  if (m.align) {
    // align with endpoints of other segments (same x or same y), plus the drawing start point
    const pts = [...segs.flatMap((s) => [s.a, s.b]), ...(from ? [from] : [])]; let ax = null; let ay = null;
    for (const c of pts) { if (ax === null && Math.abs(c.x - q.x) <= tol / 2) ax = c; if (ay === null && Math.abs(c.y - q.y) <= tol / 2) ay = c; }
    if (ax || ay) {
      const pt = { x: ax ? ax.x : q.x, y: ay ? ay.y : q.y }; const guides = [];
      if (ax) guides.push({ x1: ax.x, y1: ax.y, x2: pt.x, y2: pt.y }); if (ay) guides.push({ x1: ay.x, y1: ay.y, x2: pt.x, y2: pt.y });
      return done(pt, 'align', guides);
    }
  }
  if (m.nearest) {
    let best = null; for (const s of segs) { const np = nearestOnSegment(q, s.a, s.b); if (np.d <= tol / 2 && (!best || np.d < best.d)) best = np; }
    if (best) return done(best, 'nearest');
  }
  if (m.grid && step > 0) return done({ x: Math.round(q.x / step) * step, y: Math.round(q.y / step) * step }, 'grid');
  return done(q, 'free');
}

/** Find the closest wall segment to p within `tol`; segs carry any extra fields (ref, side…). Returns { seg, t, x, y, d } or null. */
export function pickSegment(p, segs, tol) {
  let best = null; for (const s of segs) { const np = nearestOnSegment(p, s.a, s.b); const lim = tol + (s.thickness || 0) / 2; if (np.d <= lim && (!best || np.d < best.d)) best = { seg: s, ...np }; }
  return best;
}

/** Cursor label for the length of a wall: exact, never rounded to the display unit more than the unit allows. */
export function fmtLen(cm, units = 'cm') {
  if (units === 'mm') return `${Math.round(cm * 10)} mm`;
  if (units === 'm') return `${(Math.round(cm * 10) / 1000).toFixed(3).replace(/0$/, '')} m`;
  if (units === 'ft') { const inches = cm / 2.54; const ft = Math.floor(inches / 12); const inch = Math.round((inches - ft * 12) * 10) / 10; return `${ft}′ ${inch}″`; }
  return `${(Math.round(cm * 10) / 10).toString()} cm`;
}
/** Parse a typed length in the given unit into cm. Accepts "4500", "4.5", "4,5". Returns null when invalid or ≤ 0. */
export function parseLen(text, units = 'cm') {
  const n = Number(String(text).trim().replace(',', '.')); if (!Number.isFinite(n) || n <= 0) return null;
  const f = { mm: 0.1, cm: 1, m: 100, ft: 30.48 }[units] ?? 1; return round1(n * f);
}
