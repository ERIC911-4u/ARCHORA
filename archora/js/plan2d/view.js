// js/plan2d/view.js — 2D CAD plan editor. Renders the SHARED design config (state.js) as SVG and edits it only through actions.js,
// so the 3D scene (which reads the same config) always matches. Units: cm; plan (x, y) = config (x, z).
import { getState, getUi, setUi, subscribe, subscribeUi, LIMITS } from '../state.js';
import * as actions from '../actions.js';
import { SIDES, OPENING_TYPES, getMaterial, getItemDef, getItemSize, interiorSize, getSlabKind, wallLength } from '../catalog.js';
import { detectRooms } from './rooms.js';
import { dist, round1, wallPolygon, roomSegs, wallSeg, nearestOnSegment, pointInRotRect, pickSegment, snapPoint, pointAtLength, polygonArea, fmtLen, parseLen, angleDeg, lerpPt } from './geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v)); n.append(...kids.flat().filter(Boolean)); return n; };
const PX_PER_CM_100 = 1; // 100 % zoom = 1 screen pixel per cm of plan
const COLORS = { wall: '#3A3F47', wallLow: '#7C828B', paper: '#FFFFFF', sel: '#1F6FEB', guide: '#E5484D', snap: '#12A594', grid: '#E3E6EA', gridMajor: '#CDD2D9', ghost: 'rgba(31,111,235,.35)' };
const roomFill = (r) => r.floorColor || getMaterial(r.floorMaterial)?.base || '#E8E4DA';
const slabFill = (s) => s.color || getMaterial(s.material)?.base || getSlabKind(s.kind).material && getMaterial(getSlabKind(s.kind).material)?.base || '#DDD';
const itemRect = (it) => { const { w, d } = getItemSize(it); return { w, d }; };

export function createPlan2D({ host, onCursor, onZoom, onHint }) {
  const svg = S('svg', { class: 'plan2d__svg', role: 'img', 'aria-label': '2D floor plan editor. Same project as the 3D view.' });
  const defs = S('defs'); const gridLayer = S('g'); const geo = S('g'); const screen = S('g', { 'pointer-events': 'none' });
  svg.append(defs, gridLayer, geo, screen);
  let view = { s: 0.4, tx: 0, ty: 0 }; let w = 800; let h = 600; let alive = false; let raf = 0; let dirtyGeo = true; let cfg = getState(); let ui = getUi();
  let hover = null; let cursor = null; let snapRes = null; let drag = null; let draw = null; let typed = ''; let spaceDown = false; let ro = null; let unsubs = []; let fitted = false;
  const level = () => ui.level;
  const toScreen = (p) => ({ x: p.x * view.s + view.tx, y: p.y * view.s + view.ty });
  const toWorld = (sx, sy) => ({ x: (sx - view.tx) / view.s, y: (sy - view.ty) / view.s });
  const evPt = (e) => { const r = svg.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  const evWorld = (e) => { const { sx, sy } = evPt(e); return toWorld(sx, sy); };
  const tolWorld = (px = 8) => px / view.s;
  const invalidate = () => { if (!raf && alive) raf = requestAnimationFrame(render); };
  const invalidateGeo = () => { dirtyGeo = true; invalidate(); };

  /* ---------- model helpers ---------- */
  function wallRefs(lv = level()) {
    const out = [];
    cfg.rooms.filter((r) => r.level === lv).forEach((r) => roomSegs(r).forEach((s) => { const wl = r.walls[s.side]; if (wl.visible) out.push({ ...s, thickness: wl.thickness, kind: 'wall', id: r.id, side: s.side, room: r, openings: wl.openings, wallRef: wl }); }));
    cfg.walls.filter((fw) => fw.level === lv).forEach((fw) => out.push({ ...wallSeg(fw), thickness: fw.thickness, kind: 'fwall', id: fw.id, free: fw, openings: fw.openings, height: fw.height }));
    return out;
  }
  let roomCache = { walls: null, lv: -1, rooms: [] };
  /** Rooms detected from closed free-wall loops on the active level (cached until the walls change). */
  function detected() {
    if (roomCache.walls !== cfg.walls || roomCache.lv !== level()) roomCache = { walls: cfg.walls, lv: level(), rooms: detectRooms(cfg.walls.filter((w) => w.level === level())) };
    return roomCache.rooms;
  }
  function snapSegs(excludeId = null) {
    const segs = wallRefs().filter((s) => s.id !== excludeId).map((s) => ({ a: s.a, b: s.b }));
    cfg.slabs.filter((sl) => sl.level === level()).forEach((sl) => roomSegs({ x: sl.x, z: sl.z, w: sl.w, d: sl.d }).forEach((s) => segs.push({ a: s.a, b: s.b })));
    return segs;
  }
  const snapAt = (p, extra = {}) => snapPoint(p, { step: ui.snap, tol: tolWorld(10), segs: snapSegs(extra.exclude), from: extra.from || null, modes: { ...ui.snapModes, ortho: !!(extra.from && ui.ortho) } });

  /* ---------- picking ---------- */
  function pick(p) {
    const tol = tolWorld(6); const lv = level();
    const items = cfg.items.filter((i) => i.level === lv && i.visible);
    for (let i = items.length - 1; i >= 0; i -= 1) { const it = items[i]; const { w: iw, d: id } = itemRect(it); if (pointInRotRect(p, it.x, it.z, iw, id, -it.rot)) return { kind: 'item', id: it.id }; }
    const refs = wallRefs();
    for (const r of refs) {
      const np = nearestOnSegment(p, r.a, r.b); if (np.d > r.thickness / 2 + tol) continue;
      const len = dist(r.a, r.b); const at = np.t * len;
      const o = r.openings.find((op) => at >= op.center - op.width / 2 - 2 && at <= op.center + op.width / 2 + 2);
      if (o) return r.kind === 'wall' ? { kind: 'opening', id: r.id, side: r.side, openingId: o.id } : { kind: 'fopening', id: r.id, openingId: o.id };
    }
    const hit = pickSegment(p, refs, tol);
    if (hit) return hit.seg.kind === 'wall' ? { kind: 'wall', id: hit.seg.id, side: hit.seg.side } : { kind: 'fwall', id: hit.seg.id };
    const room = cfg.rooms.find((r) => r.level === lv && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.z && p.y <= r.z + r.d);
    if (room) return { kind: 'room', id: room.id };
    const slab = [...cfg.slabs].reverse().find((sl) => sl.level === lv && p.x >= sl.x && p.x <= sl.x + sl.w && p.y >= sl.z && p.y <= sl.z + sl.d);
    return slab ? { kind: 'slab', id: slab.id } : null;
  }
  const sameSel = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.id === b.id && a.side === b.side && a.openingId === b.openingId);

  /* ---------- handles (screen space) ---------- */
  function handles() {
    const sel = ui.selection; if (!sel) return [];
    const out = [];
    if (sel.kind === 'fwall') { const fw = cfg.walls.find((x) => x.id === sel.id); if (fw) out.push({ id: 'p1', x: fw.x1, y: fw.z1, shape: 'circle' }, { id: 'p2', x: fw.x2, y: fw.z2, shape: 'circle' }); }
    if (sel.kind === 'room') { const r = cfg.rooms.find((x) => x.id === sel.id); if (r) { out.push({ id: 'nw', x: r.x, y: r.z }, { id: 'ne', x: r.x + r.w, y: r.z }, { id: 'se', x: r.x + r.w, y: r.z + r.d }, { id: 'sw', x: r.x, y: r.z + r.d }); } }
    if (sel.kind === 'slab') { const r = cfg.slabs.find((x) => x.id === sel.id); if (r) { out.push({ id: 'nw', x: r.x, y: r.z }, { id: 'ne', x: r.x + r.w, y: r.z }, { id: 'se', x: r.x + r.w, y: r.z + r.d }, { id: 'sw', x: r.x, y: r.z + r.d }); } }
    if (sel.kind === 'item') { const it = cfg.items.find((x) => x.id === sel.id); if (it) { const { d: id } = itemRect(it); const a = (-it.rot * Math.PI) / 180; const off = id / 2 + tolWorld(26); out.push({ id: 'rot', x: it.x + Math.sin(a) * off, y: it.z - Math.cos(a) * off, shape: 'rot' }); } }
    return out;
  }
  function pickHandle(sx, sy) { return handles().find((hd) => { const p = toScreen(hd); return Math.hypot(p.x - sx, p.y - sy) <= 9; }) || null; }

  /* ---------- rendering: geometry (world space) ---------- */
  function openingSymbol(r, o, ghost = false) {
    const g = S('g', ghost ? { opacity: 0.55 } : {});
    const len = dist(r.a, r.b); const ang = angleDeg(r.a, r.b); const t = r.thickness;
    const inner = S('g', { transform: `translate(${r.a.x} ${r.a.y}) rotate(${ang})` });
    const x0 = o.center - o.width / 2; const wd = o.width;
    inner.append(S('rect', { x: x0, y: -t / 2 - 0.3, width: wd, height: t + 0.6, fill: COLORS.paper }));
    const thin = { stroke: '#222', 'stroke-width': 1, fill: 'none', 'vector-effect': 'non-scaling-stroke' };
    if (o.type === 'window') { inner.append(S('line', { x1: x0, y1: -t / 2, x2: x0 + wd, y2: -t / 2, ...thin }), S('line', { x1: x0, y1: t / 2, x2: x0 + wd, y2: t / 2, ...thin }), S('line', { x1: x0, y1: 0, x2: x0 + wd, y2: 0, stroke: '#4A90C2', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' })); }
    else if (o.type === 'sliding') { inner.append(S('rect', { x: x0, y: -t / 2, width: wd / 2 + 2, height: t / 2, ...thin, fill: 'rgba(74,144,194,.25)' }), S('rect', { x: x0 + wd / 2 - 2, y: 0, width: wd / 2 + 2, height: t / 2, ...thin, fill: 'rgba(74,144,194,.25)' })); }
    else if (o.type === 'arch') { inner.append(S('line', { x1: x0, y1: -t / 2, x2: x0, y2: t / 2, ...thin }), S('line', { x1: x0 + wd, y1: -t / 2, x2: x0 + wd, y2: t / 2, ...thin }), S('line', { x1: x0, y1: 0, x2: x0 + wd, y2: 0, ...thin, 'stroke-dasharray': '4 3' })); }
    else { inner.append(S('line', { x1: x0, y1: t / 2, x2: x0, y2: t / 2 + wd, ...thin, 'stroke-width': 1.5 }), S('path', { d: `M ${x0} ${t / 2 + wd} A ${wd} ${wd} 0 0 1 ${x0 + wd} ${t / 2}`, ...thin, 'stroke-width': 0.8, 'stroke-dasharray': '3 2' })); }
    g.append(inner); return g;
  }
  function renderWalls(g, ghost) {
    const refs = wallRefs(ghost ? level() - 1 : level()); const col = (r) => (r.height && r.height < 150 ? COLORS.wallLow : COLORS.wall);
    refs.forEach((r) => { const ext = r.thickness / 2; g.append(S('polygon', { points: wallPolygon(r.a, r.b, r.thickness, ext).map((q) => `${q.x},${q.y}`).join(' '), fill: col(r), 'data-id': r.id })); });
    if (!ghost) refs.forEach((r) => r.openings.forEach((o) => g.append(openingSymbol(r, o))));
  }
  function renderGeometry() {
    geo.replaceChildren(); const lv = level();
    geo.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.s})`);
    if (lv > 0) { const gh = S('g', { opacity: 0.28 }); cfg.rooms.filter((r) => r.level === lv - 1).forEach((r) => gh.append(S('rect', { x: r.x, y: r.z, width: r.w, height: r.d, fill: '#9AA3AE' }))); renderWalls(gh, true); geo.append(gh); }
    cfg.slabs.filter((sl) => sl.level === lv).forEach((sl) => geo.append(S('rect', { x: sl.x, y: sl.z, width: sl.w, height: sl.d, fill: slabFill(sl), stroke: '#9AA0A6', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' })));
    cfg.rooms.filter((r) => r.level === lv).forEach((r) => geo.append(S('rect', { x: r.x, y: r.z, width: r.w, height: r.d, fill: roomFill(r) })));
    detected().forEach((r) => geo.append(S('polygon', { points: r.poly.map((q) => `${q.x},${q.y}`).join(' '), fill: 'rgba(11,102,212,.07)' })));
    renderWalls(geo, false);
    cfg.items.filter((i) => i.level === lv && i.visible).forEach((it) => {
      const { w: iw, d: id } = itemRect(it); const def = getItemDef(it.type);
      const g = S('g', { transform: `translate(${it.x} ${it.z}) rotate(${-it.rot})` });
      g.append(S('rect', { x: -iw / 2, y: -id / 2, width: iw, height: id, rx: Math.min(iw, id) * 0.06, fill: it.color, stroke: 'rgba(0,0,0,.55)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: def?.category === 'decor' ? 0.8 : 0.95 }),
        S('line', { x1: -iw / 2, y1: id / 2 - 0.5, x2: iw / 2, y2: id / 2 - 0.5, stroke: 'rgba(0,0,0,.6)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      geo.append(g);
    });
  }

  /* ---------- rendering: grid ---------- */
  function renderGrid() {
    gridLayer.replaceChildren(); if (!ui.showGrid) return;
    const step = [10, 50, 100, 500, 1000, 5000].find((st) => st * view.s >= 9) || 5000; // minor spacing ≥ ~9 px
    const major = step * 10;
    const draw1 = (st, col, wd) => {
      const p = S('path', { stroke: col, 'stroke-width': wd, fill: 'none', 'shape-rendering': 'crispEdges' }); let d = '';
      const x0 = Math.floor(-view.tx / view.s / st) * st; const x1 = (w - view.tx) / view.s; const y0 = Math.floor(-view.ty / view.s / st) * st; const y1 = (h - view.ty) / view.s;
      for (let x = x0; x <= x1; x += st) { const sx = Math.round(x * view.s + view.tx) + 0.5; d += `M${sx} 0V${h}`; }
      for (let y = y0; y <= y1; y += st) { const sy = Math.round(y * view.s + view.ty) + 0.5; d += `M0 ${sy}H${w}`; }
      p.setAttribute('d', d); gridLayer.append(p);
    };
    draw1(step, COLORS.grid, 1); draw1(major, COLORS.gridMajor, 1);
  }

  /* ---------- rendering: screen-space overlay (labels, handles, preview) ---------- */
  const label = (p, lines, cls = '') => { const t = S('text', { x: p.x, y: p.y, class: `plan2d__label ${cls}`, 'text-anchor': 'middle' }); lines.forEach((ln, i) => t.append(S('tspan', { x: p.x, dy: i === 0 ? 0 : 14 }, ln))); return t; };
  const chip = (p, text, cls = '') => { const wdt = text.length * 6.6 + 12; const g = S('g', { class: `plan2d__chip ${cls}` }); g.append(S('rect', { x: p.x - wdt / 2, y: p.y - 10, width: wdt, height: 20, rx: 3 }), S('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle' }, text)); return g; };
  function labelDefs() { // world-space label list (also used by SVG export)
    const out = []; const lv = level(); const u = ui.units;
    cfg.rooms.filter((r) => r.level === lv).forEach((r) => { const i = interiorSize(r); out.push({ x: r.x + r.w / 2, y: r.z + Math.min(70, r.d * 0.2), lines: [r.name, `${fmtLen(i.w, u)} × ${fmtLen(i.d, u)}`, `${(Math.round((i.w * i.d) / 100) / 100).toFixed(2)} m²`], kind: 'room' }); });
    detected().forEach((r, i) => out.push({ x: r.centroid.x, y: r.centroid.y, lines: [`Room ${i + 1}`, ...(r.isRect ? [`${fmtLen(r.w, u)} × ${fmtLen(r.d, u)}`] : []), `${(Math.round(r.area / 100) / 100).toFixed(2)} m²`], kind: 'room' }));
    cfg.slabs.filter((sl) => sl.level === lv && sl.kind !== 'lawn').forEach((sl) => out.push({ x: sl.x + sl.w / 2, y: sl.z + sl.d / 2, lines: [sl.name, `${(Math.round((sl.w * sl.d) / 100) / 100).toFixed(2)} m²`], kind: 'slab' }));
    if (ui.showDimensions) cfg.walls.filter((fw) => fw.level === lv).forEach((fw) => out.push({ x: (fw.x1 + fw.x2) / 2, y: (fw.z1 + fw.z2) / 2, lines: [fmtLen(wallLength(fw), u)], kind: 'dim', ang: angleDeg({ x: fw.x1, y: fw.z1 }, { x: fw.x2, y: fw.z2 }), off: fw.thickness / 2 }));
    if (ui.showDimensions) cfg.rooms.filter((r) => r.level === lv).forEach((r) => { out.push({ x: r.x + r.w / 2, y: r.z, lines: [fmtLen(r.w, u)], kind: 'dim', ang: 0, off: r.walls.n.thickness / 2 }, { x: r.x, y: r.z + r.d / 2, lines: [fmtLen(r.d, u)], kind: 'dim', ang: 90, off: r.walls.w.thickness / 2 }); });
    return out;
  }
  function renderScreen() {
    screen.replaceChildren(); const lv = level();
    labelDefs().forEach((l) => {
      const p = toScreen(l);
      if (l.kind === 'dim') { const rad = (l.ang * Math.PI) / 180; const off = l.off * view.s + 12; const q = { x: p.x + Math.sin(rad) * off, y: p.y - Math.cos(rad) * off }; if (view.s > 0.12) screen.append(chip(q, l.lines[0], 'plan2d__chip--dim')); }
      else if (view.s > 0.1) screen.append(label(p, l.kind === 'room' && view.s < 0.2 ? [l.lines[0]] : l.lines, `plan2d__label--${l.kind}`));
    });
    // item names when large enough on screen
    cfg.items.filter((i) => i.level === lv && i.visible).forEach((it) => { const { w: iw, d: id } = itemRect(it); if (Math.min(iw, id) * view.s > 34 && Math.max(iw, id) * view.s > 70) screen.append(label(toScreen({ x: it.x, y: it.z }), [getItemDef(it.type)?.name || it.type], 'plan2d__label--item')); });
    // selection
    const sel = ui.selection; const selStroke = { fill: 'none', stroke: COLORS.sel, 'stroke-width': 2 };
    if (sel) {
      if (sel.kind === 'item') { const it = cfg.items.find((x) => x.id === sel.id); if (it) { const { w: iw, d: id } = itemRect(it); const c = toScreen({ x: it.x, y: it.z }); const g = S('g', { transform: `translate(${c.x} ${c.y}) rotate(${-it.rot})` }); g.append(S('rect', { x: (-iw / 2) * view.s - 2, y: (-id / 2) * view.s - 2, width: iw * view.s + 4, height: id * view.s + 4, ...selStroke, 'stroke-dasharray': '5 3' })); screen.append(g); } }
      const pts = (a, b, t) => wallPolygon(a, b, t, t / 2).map((q) => { const s = toScreen(q); return `${s.x},${s.y}`; }).join(' ');
      if (sel.kind === 'fwall') { const fw = cfg.walls.find((x) => x.id === sel.id); if (fw) screen.append(S('polygon', { points: pts({ x: fw.x1, y: fw.z1 }, { x: fw.x2, y: fw.z2 }, fw.thickness), ...selStroke, fill: 'rgba(31,111,235,.18)' }), chip(toScreen({ x: (fw.x1 + fw.x2) / 2, y: (fw.z1 + fw.z2) / 2 + 0 }), fmtLen(wallLength(fw), ui.units), 'plan2d__chip--sel')); }
      if (sel.kind === 'wall') { const r = cfg.rooms.find((x) => x.id === sel.id); const sg = r && roomSegs(r).find((s) => s.side === sel.side); if (sg) screen.append(S('polygon', { points: pts(sg.a, sg.b, r.walls[sel.side].thickness), ...selStroke, fill: 'rgba(31,111,235,.18)' })); }
      if (sel.kind === 'opening' || sel.kind === 'fopening') { const r = wallRefs().find((x) => x.id === sel.id && (sel.kind === 'fopening' || x.side === sel.side)); const o = r && r.openings.find((x) => x.id === sel.openingId); if (o) { const len = dist(r.a, r.b); const a = lerpPt(r.a, r.b, (o.center - o.width / 2) / len); const b = lerpPt(r.a, r.b, (o.center + o.width / 2) / len); screen.append(S('polygon', { points: pts(a, b, r.thickness + 6), ...selStroke, fill: 'rgba(31,111,235,.25)' })); } }
      if (sel.kind === 'room' || sel.kind === 'slab') { const r = sel.kind === 'room' ? cfg.rooms.find((x) => x.id === sel.id) : cfg.slabs.find((x) => x.id === sel.id); if (r) { const a = toScreen({ x: r.x, y: r.z }); screen.append(S('rect', { x: a.x, y: a.y, width: r.w * view.s, height: r.d * view.s, ...selStroke, 'stroke-dasharray': '6 4' })); } }
      handles().forEach((hd) => { const p = toScreen(hd); if (hd.shape === 'rot') { const it = cfg.items.find((x) => x.id === sel.id); const c = toScreen({ x: it.x, y: it.z }); screen.append(S('line', { x1: c.x, y1: c.y, x2: p.x, y2: p.y, stroke: COLORS.sel, 'stroke-width': 1 }), S('circle', { cx: p.x, cy: p.y, r: 6, fill: '#fff', stroke: COLORS.sel, 'stroke-width': 2 })); } else if (hd.shape === 'circle') screen.append(S('circle', { cx: p.x, cy: p.y, r: 6, fill: '#fff', stroke: COLORS.sel, 'stroke-width': 2 })); else screen.append(S('rect', { x: p.x - 5, y: p.y - 5, width: 10, height: 10, fill: '#fff', stroke: COLORS.sel, 'stroke-width': 2 })); });
    }
    // hover highlight for non-select tools is handled by cursor; draw tool preview
    if (draw && draw.pts.length && cursor) {
      const last = draw.pts[draw.pts.length - 1]; const end = draw.end || cursor; const t = ui.wallPreset.thickness;
      const poly = (a, b) => wallPolygon(a, b, t, t / 2).map((q) => { const s = toScreen(q); return `${s.x},${s.y}`; }).join(' ');
      for (let i = 0; i < draw.pts.length - 1; i += 1) screen.append(S('polygon', { points: poly(draw.pts[i], draw.pts[i + 1]), fill: COLORS.ghost, stroke: COLORS.sel, 'stroke-width': 1 }));
      screen.append(S('polygon', { points: poly(last, end), fill: COLORS.ghost, stroke: COLORS.sel, 'stroke-width': 1.5 }));
      const len = dist(last, end); const mid = toScreen(lerpPt(last, end, 0.5));
      screen.append(chip({ x: mid.x, y: mid.y - 16 }, typed ? `${typed} ${ui.units}` : `${fmtLen(len, ui.units)} · ${Math.round(((angleDeg(last, end) % 360) + 360) % 360)}°`, typed ? 'plan2d__chip--typed' : 'plan2d__chip--sel'));
    }
    if (draw && draw.slab && cursor) { const a = draw.slab; const x = Math.min(a.x, cursor.x); const y = Math.min(a.y, cursor.y); const p = toScreen({ x, y }); screen.append(S('rect', { x: p.x, y: p.y, width: Math.abs(cursor.x - a.x) * view.s, height: Math.abs(cursor.y - a.y) * view.s, fill: COLORS.ghost, stroke: COLORS.sel, 'stroke-width': 1.5 }), chip(toScreen({ x: x + Math.abs(cursor.x - a.x) / 2, y: y + Math.abs(cursor.y - a.y) / 2 }), `${fmtLen(Math.abs(cursor.x - a.x), ui.units)} × ${fmtLen(Math.abs(cursor.y - a.y), ui.units)}`, 'plan2d__chip--sel')); }
    if (ui.tool === 'place-item' && ui.placeItem && cursor && !drag) { const def = getItemDef(ui.placeItem); if (def) { const p = toScreen(cursor); screen.append(S('rect', { x: p.x - (def.size.w * view.s) / 2, y: p.y - (def.size.d * view.s) / 2, width: def.size.w * view.s, height: def.size.d * view.s, fill: COLORS.ghost, stroke: COLORS.sel, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })); } }
    if (ui.tool === 'place-opening' && hover && hover.opening) { const o = hover.opening; const r = hover.ref; const len = dist(r.a, r.b); const a = lerpPt(r.a, r.b, (o.center - o.width / 2) / len); const b = lerpPt(r.a, r.b, (o.center + o.width / 2) / len); const pts2 = wallPolygon(a, b, r.thickness + 8, 0).map((q) => { const s = toScreen(q); return `${s.x},${s.y}`; }).join(' '); screen.append(S('polygon', { points: pts2, fill: hover.ok ? COLORS.ghost : 'rgba(229,72,77,.35)', stroke: hover.ok ? COLORS.sel : COLORS.guide })); }
    // snap feedback
    if (snapRes && cursor && (draw || ['draw-wall', 'draw-slab'].includes(ui.tool) || drag?.type === 'point')) {
      snapRes.guides.forEach((gd) => { const a = toScreen({ x: gd.x1, y: gd.y1 }); const b = toScreen({ x: gd.x2, y: gd.y2 }); screen.append(S('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: COLORS.guide, 'stroke-width': 1, 'stroke-dasharray': '5 4' })); });
      const p = toScreen(snapRes); const k = snapRes.kind;
      if (k === 'endpoint') screen.append(S('rect', { x: p.x - 6, y: p.y - 6, width: 12, height: 12, fill: 'none', stroke: COLORS.snap, 'stroke-width': 2 }));
      else if (k === 'midpoint') screen.append(S('path', { d: `M${p.x} ${p.y - 7}L${p.x + 7} ${p.y + 6}L${p.x - 7} ${p.y + 6}Z`, fill: 'none', stroke: COLORS.snap, 'stroke-width': 2 }));
      else if (k === 'intersection') screen.append(S('path', { d: `M${p.x - 6} ${p.y - 6}L${p.x + 6} ${p.y + 6}M${p.x + 6} ${p.y - 6}L${p.x - 6} ${p.y + 6}`, stroke: COLORS.snap, 'stroke-width': 2 }));
      else if (k === 'perpendicular') screen.append(S('path', { d: `M${p.x - 7} ${p.y + 7}V${p.y - 7}M${p.x - 7} ${p.y}H${p.x}V${p.y + 7}`, fill: 'none', stroke: COLORS.snap, 'stroke-width': 2 }));
      else screen.append(S('circle', { cx: p.x, cy: p.y, r: k === 'grid' ? 3 : 5, fill: k === 'grid' ? COLORS.sel : 'none', stroke: k === 'grid' ? 'none' : COLORS.snap, 'stroke-width': 2 }));
      if (k !== 'grid' && k !== 'free') screen.append(S('text', { x: p.x + 10, y: p.y - 10, class: 'plan2d__snaplabel' }, { endpoint: 'Endpoint', midpoint: 'Midpoint', intersection: 'Intersection', perpendicular: 'Perpendicular', align: 'Aligned', nearest: 'On wall' }[k]));
    }
  }

  function render() {
    raf = 0; if (!alive) return; cfg = getState(); ui = getUi();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (dirtyGeo) { renderGeometry(); dirtyGeo = false; } else geo.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.s})`);
    renderGrid(); renderScreen();
    onZoom && onZoom(Math.round((view.s / PX_PER_CM_100) * 100));
  }

  /* ---------- view control ---------- */
  function boundsOfPlan() {
    const xs = []; const ys = []; const lv = level();
    cfg.rooms.forEach((r) => { xs.push(r.x, r.x + r.w); ys.push(r.z, r.z + r.d); }); cfg.slabs.forEach((s) => { xs.push(s.x, s.x + s.w); ys.push(s.z, s.z + s.d); });
    cfg.walls.forEach((fw) => { xs.push(fw.x1, fw.x2); ys.push(fw.z1, fw.z2); }); cfg.items.forEach((i) => { xs.push(i.x); ys.push(i.z); });
    if (!xs.length) return { x0: 0, y0: 0, x1: 800, y1: 600, lv };
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  function fit() {
    const b = boundsOfPlan(); const pad = 60; const bw = Math.max(100, b.x1 - b.x0); const bh = Math.max(100, b.y1 - b.y0);
    view.s = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 1.5); view.tx = (w - bw * view.s) / 2 - b.x0 * view.s; view.ty = (h - bh * view.s) / 2 - b.y0 * view.s; fitted = true; invalidateGeo();
  }
  function zoomAt(factor, sx = w / 2, sy = h / 2) {
    const before = toWorld(sx, sy); view.s = Math.min(8, Math.max(0.02, view.s * factor)); view.tx = sx - before.x * view.s; view.ty = sy - before.y * view.s; invalidate(); dirtyGeo = true;
  }
  function onResize() { const r = host.getBoundingClientRect(); if (!r.width || !r.height) return; w = r.width; h = r.height; if (!fitted) fit(); invalidateGeo(); }

  /* ---------- tool actions ---------- */
  function finishDraw() { draw = null; typed = ''; snapRes = null; invalidate(); }
  function commitWall(a, b) {
    if (dist(a, b) < 20) return false;
    const id = actions.addFreeWall(level(), a.x, a.y, b.x, b.y, ui.wallPreset); return !!id;
  }
  function openingHover(p) {
    const refs = wallRefs(); const hit = pickSegment(p, refs, tolWorld(14)); if (!hit) return null;
    const def = OPENING_TYPES.find((o) => o.id === ui.placeOpening) || OPENING_TYPES[0]; const len = dist(hit.seg.a, hit.seg.b); const width = Math.min(def.width, len - 20);
    const center = Math.min(len - width / 2 - 5, Math.max(width / 2 + 5, Math.round((hit.t * len) / 5) * 5));
    const ok = hit.seg.openings.every((o) => Math.abs(o.center - center) >= (o.width + width) / 2 + 5) && width >= 40;
    return { ref: hit.seg, opening: { center, width }, ok };
  }
  function eraseAt(p) {
    const s = pick(p); if (!s) return;
    if (s.kind === 'item') actions.deleteItem(s.id); else if (s.kind === 'opening') actions.deleteOpening(s.id, s.side, s.openingId); else if (s.kind === 'fopening') actions.deleteFreeOpening(s.id, s.openingId);
    else if (s.kind === 'fwall') actions.deleteFreeWall(s.id); else if (s.kind === 'slab') actions.deleteSlab(s.id); else if (s.kind === 'room') actions.deleteRoom(s.id);
  }

  /* ---------- pointer handling ---------- */
  function onDown(e) {
    svg.focus({ preventScroll: true }); const { sx, sy } = evPt(e); const p = toWorld(sx, sy); cfg = getState(); ui = getUi();
    if (e.button === 1 || (e.button === 0 && spaceDown) || ui.tool === 'pan') { drag = { type: 'pan', sx, sy, tx: view.tx, ty: view.ty }; svg.setPointerCapture(e.pointerId); return; }
    if (e.button === 2) return; // context menu handled separately
    if (e.button !== 0) return;
    const tool = ui.tool;
    if (tool === 'draw-wall') {
      const sn = snapAt(p, { from: draw ? draw.pts[draw.pts.length - 1] : null }); const pt = { x: sn.x, y: sn.y };
      if (!draw) { draw = { pts: [pt] }; invalidate(); return; }
      const last = draw.pts[draw.pts.length - 1]; if (dist(last, pt) < 20) { return; }
      const closes = dist(pt, draw.pts[0]) < 1 && draw.pts.length > 1; commitWall(last, pt); draw.pts.push(pt); typed = ''; if (closes) finishDraw(); else invalidate(); return;
    }
    if (tool === 'draw-slab') {
      const sn = snapAt(p); const pt = { x: sn.x, y: sn.y };
      if (!draw) { draw = { pts: [], slab: pt }; invalidate(); return; }
      const a = draw.slab; const x = Math.min(a.x, pt.x); const y = Math.min(a.y, pt.y); const ww = Math.abs(pt.x - a.x); const dd = Math.abs(pt.y - a.y);
      if (ww >= 20 && dd >= 20) { const id = actions.addSlab(level(), ui.slabKind, x, y, ww, dd, { material: ui.slabMaterial }); if (id) setUi({ selection: { kind: 'slab', id } }); }
      finishDraw(); return;
    }
    if (tool === 'place-opening') {
      const hv = openingHover(p); if (!hv || !hv.ok) { onHint && onHint('Move onto a wall with enough free space.'); return; }
      const r = hv.ref; let id = null;
      if (r.kind === 'fwall') { id = actions.addFreeOpening(r.id, ui.placeOpening, hv.opening.center); if (id) setUi({ selection: { kind: 'fopening', id: r.id, openingId: id } }); }
      else { id = actions.addOpeningAt(r.id, r.side, ui.placeOpening, hv.opening.center); if (id) setUi({ selection: { kind: 'opening', id: r.id, side: r.side, openingId: id } }); }
      return;
    }
    if (tool === 'place-item') {
      if (!ui.placeItem) return; const sn = snapAt(p, {}); const id = actions.placeItem(ui.placeItem, level(), sn.kind === 'grid' || sn.kind === 'free' ? sn.x : p.x, sn.kind === 'grid' || sn.kind === 'free' ? sn.y : p.y, 0);
      if (id) { setUi(e.shiftKey ? { selection: { kind: 'item', id } } : { selection: { kind: 'item', id }, tool: 'move', placeItem: null }); }
      return;
    }
    if (tool === 'eraser') { eraseAt(p); return; }
    // select / move
    const hd = pickHandle(sx, sy);
    if (hd && ui.tool !== 'select') { drag = { type: 'handle', handle: hd.id, sel: ui.selection }; svg.setPointerCapture(e.pointerId); return; }
    const s = pick(p);
    if (!sameSel(s, ui.selection)) setUi({ selection: s });
    if (!s) { drag = { type: 'pan', sx, sy, tx: view.tx, ty: view.ty }; svg.setPointerCapture(e.pointerId); return; }
    if (tool === 'move') {
      cfg = getState(); const base = { type: 'move', sel: s, start: p, moved: false };
      if (s.kind === 'item') { const it = cfg.items.find((x) => x.id === s.id); base.orig = { x: it.x, y: it.z }; }
      else if (s.kind === 'fwall') { const fw = cfg.walls.find((x) => x.id === s.id); base.orig = { x1: fw.x1, z1: fw.z1, x2: fw.x2, z2: fw.z2 }; }
      else if (s.kind === 'room') { const r = cfg.rooms.find((x) => x.id === s.id); base.orig = { x: r.x, y: r.z }; }
      else if (s.kind === 'slab') { const r = cfg.slabs.find((x) => x.id === s.id); base.orig = { x: r.x, y: r.z }; }
      else if (s.kind === 'opening' || s.kind === 'fopening') base.orig = {};
      else return;
      drag = base; svg.setPointerCapture(e.pointerId);
    }
  }

  function onMove(e) {
    const { sx, sy } = evPt(e); const p = toWorld(sx, sy); cfg = getState(); ui = getUi(); cursor = p;
    if (drag?.type === 'pan') { view.tx = drag.tx + (sx - drag.sx); view.ty = drag.ty + (sy - drag.sy); invalidate(); onCursor && onCursor(p); return; }
    const tool = ui.tool;
    if (tool === 'draw-wall') {
      const from = draw ? draw.pts[draw.pts.length - 1] : null; snapRes = snapAt(p, { from }); cursor = { x: snapRes.x, y: snapRes.y };
      if (draw) { draw.end = { x: snapRes.x, y: snapRes.y }; if (typed) { const n = parseLen(typed, ui.units); if (n) draw.end = pointAtLength(from, draw.end, n); } }
    } else if (tool === 'draw-slab' || (tool === 'place-item')) { snapRes = snapAt(p); cursor = { x: snapRes.x, y: snapRes.y }; }
    else if (tool === 'place-opening') hover = openingHover(p);
    if (drag?.type === 'handle') dragHandle(p, e);
    else if (drag?.type === 'move') dragMove(p, e);
    onCursor && onCursor(cursor);
    if (!drag) { const hd = pickHandle(sx, sy); svg.style.cursor = tool === 'eraser' ? 'not-allowed' : ['draw-wall', 'draw-slab', 'place-item', 'place-opening'].includes(tool) ? 'crosshair' : hd ? 'pointer' : tool === 'pan' ? 'grab' : pick(p) ? (tool === 'move' ? 'move' : 'pointer') : 'default'; }
    invalidate();
  }

  function dragMove(p, e) {
    const s = drag.sel; const dx = p.x - drag.start.x; const dy = p.y - drag.start.y; if (!drag.moved && Math.hypot(dx, dy) * view.s < 3) return; drag.moved = true;
    const step = ui.snap || 1; const g = (v) => Math.round(v / step) * step;
    if (s.kind === 'item') actions.moveItem(s.id, round1(g(drag.orig.x + dx)), round1(g(drag.orig.y + dy)));
    else if (s.kind === 'fwall') { const o = drag.orig; const sx0 = g(o.x1 + dx) - o.x1; const sy0 = g(o.z1 + dy) - o.z1; actions.setFreeWallPoints(s.id, { x1: o.x1 + sx0, z1: o.z1 + sy0, x2: o.x2 + sx0, z2: o.z2 + sy0 }); }
    else if (s.kind === 'room') actions.moveRoom(s.id, g(drag.orig.x + dx), g(drag.orig.y + dy));
    else if (s.kind === 'slab') actions.moveSlab(s.id, g(drag.orig.x + dx), g(drag.orig.y + dy));
    else if (s.kind === 'opening' || s.kind === 'fopening') {
      const r = wallRefs().find((x) => x.id === s.id && (s.kind === 'fopening' || x.side === s.side)); if (!r) return; const len = dist(r.a, r.b); const o = r.openings.find((x) => x.id === s.openingId); if (!o) return;
      const np = nearestOnSegment(p, r.a, r.b); const c = Math.min(len - o.width / 2 - 5, Math.max(o.width / 2 + 5, Math.round((np.t * len) / 5) * 5));
      if (r.openings.some((x) => x.id !== o.id && Math.abs(x.center - c) < (x.width + o.width) / 2 + 2)) return;
      if (s.kind === 'fopening') actions.setFreeOpening(s.id, s.openingId, { center: c }); else actions.setOpening(s.id, s.side, s.openingId, { center: c });
    }
  }

  function dragHandle(p, e) {
    const sel = drag.sel; const hid = drag.handle; snapRes = null;
    if (sel.kind === 'fwall') {
      const fw = cfg.walls.find((x) => x.id === sel.id); if (!fw) return; const other = hid === 'p1' ? { x: fw.x2, y: fw.z2 } : { x: fw.x1, y: fw.z1 };
      const sn = snapAt(p, { exclude: fw.id, from: other }); snapRes = sn; cursor = { x: sn.x, y: sn.y }; if (dist(other, sn) < 20) return;
      actions.setFreeWallPoints(fw.id, hid === 'p1' ? { x1: sn.x, z1: sn.y } : { x2: sn.x, z2: sn.y });
    } else if (sel.kind === 'room' || sel.kind === 'slab') {
      const r = (sel.kind === 'room' ? cfg.rooms : cfg.slabs).find((x) => x.id === sel.id); if (!r) return; const step = ui.snap || 1; const gx = Math.round(p.x / step) * step; const gy = Math.round(p.y / step) * step;
      let x0 = r.x; let y0 = r.z; let x1 = r.x + r.w; let y1 = r.z + r.d; if (hid.includes('w')) x0 = gx; if (hid.includes('e')) x1 = gx; if (hid.includes('n')) y0 = gy; if (hid.includes('s')) y1 = gy;
      const min = sel.kind === 'room' ? 150 : 20; if (x1 - x0 < min || y1 - y0 < min) return; const patch = { x: Math.min(x0, x1), z: Math.min(y0, y1), w: x1 - x0, d: y1 - y0 };
      if (sel.kind === 'room') actions.resizeRoom(r.id, patch); else actions.resizeSlab(r.id, patch);
    } else if (sel.kind === 'item' && hid === 'rot') {
      const it = cfg.items.find((x) => x.id === sel.id); if (!it) return; let ang = (Math.atan2(p.x - it.x, -(p.y - it.z)) * 180) / Math.PI; ang = -ang; if (!e.altKey) ang = Math.round(ang / 15) * 15;
      actions.setItem(it.id, { rot: (((Math.round(ang) % 360) + 360) % 360) }, 'rot');
    }
  }

  function onUp(e) { if (drag) { try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ } } drag = null; snapRes = null; invalidate(); }
  function onWheel(e) { e.preventDefault(); const { sx, sy } = evPt(e); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy); }
  function onDbl() { if (draw && ui.tool === 'draw-wall') finishDraw(); }
  function onLeave() { cursor = null; hover = null; snapRes = null; onCursor && onCursor(null); invalidate(); }

  function onKey(e) {
    if (!alive) return; const tag = e.target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') { spaceDown = e.type === 'keydown'; if (spaceDown) e.preventDefault(); return; }
    if (e.type !== 'keydown') return;
    ui = getUi();
    if (draw && ui.tool === 'draw-wall') {
      if (/^[0-9.,]$/.test(e.key)) { typed += e.key; e.preventDefault(); const from = draw.pts[draw.pts.length - 1]; const n = parseLen(typed, ui.units); if (n && cursor) draw.end = pointAtLength(from, cursor, n); invalidate(); return; }
      if (e.key === 'Backspace' && typed) { typed = typed.slice(0, -1); e.preventDefault(); invalidate(); return; }
      if (e.key === 'Enter') {
        e.preventDefault(); const from = draw.pts[draw.pts.length - 1]; const n = typed ? parseLen(typed, ui.units) : null;
        if (typed && !n) { onHint && onHint('Enter a length greater than zero.'); return; }
        const end = n ? pointAtLength(from, cursor || { x: from.x + 1, y: from.y }, n) : null;
        if (end && (Math.abs(end.x) > LIMITS.coord || Math.abs(end.y) > LIMITS.coord)) { onHint && onHint(`That wall would leave the ${LIMITS.coord * 2 / 100} m working area. Enter a shorter length.`); return; }
        if (end) { if (commitWall(from, end)) { draw.pts.push(end); draw.end = null; typed = ''; invalidate(); } } else finishDraw(); return;
      }
    }
  }
  /** Esc: cancel typed length, then the current drawing. Returns true when something was cancelled. */
  function handleEscape() { if (typed) { typed = ''; invalidate(); return true; } if (draw) { finishDraw(); return true; } return false; }

  function onContext(e) {
    e.preventDefault(); ui = getUi();
    if (draw) { finishDraw(); return; }
    const { sx, sy } = evPt(e); const p = toWorld(sx, sy); const s = pick(p); if (s && !sameSel(s, ui.selection)) setUi({ selection: s });
    host.dispatchEvent(new CustomEvent('plan2d:context', { detail: { x: e.clientX, y: e.clientY, selection: s }, bubbles: true }));
  }

  /* ---------- export ---------- */
  function exportSvg({ background = '#FFFFFF', margin = 60 } = {}) {
    cfg = getState(); ui = getUi(); const b = boundsOfPlan(); const x0 = b.x0 - margin; const y0 = b.y0 - margin; const ww = b.x1 - b.x0 + margin * 2; const hh = b.y1 - b.y0 + margin * 2;
    const saved = { ...view }; view = { s: 1, tx: 0, ty: 0 }; renderGeometry(); const body = geo.cloneNode(true); body.setAttribute('transform', ''); view = saved; dirtyGeo = true; invalidate();
    const fs = Math.max(10, Math.min(ww, hh) / 60); const labels = S('g', { 'font-family': 'Inter, Arial, sans-serif', 'text-anchor': 'middle', fill: '#1B1F24' });
    labelDefs().forEach((l) => { l.lines.forEach((ln, i) => { let x = l.x; let y = l.y + i * fs * 1.25; if (l.kind === 'dim') { const rad = (l.ang * Math.PI) / 180; x += Math.sin(rad) * (l.off + fs); y -= Math.cos(rad) * (l.off + fs); } labels.append(S('text', { x, y, 'font-size': l.kind === 'room' && i === 0 ? fs * 1.1 : fs, 'font-weight': l.kind === 'room' && i === 0 ? 600 : 400 }, ln)); }); });
    const out = S('svg', { xmlns: NS, viewBox: `${x0} ${y0} ${ww} ${hh}`, width: ww, height: hh }); out.append(S('rect', { x: x0, y: y0, width: ww, height: hh, fill: background }), body, labels);
    return { svg: new XMLSerializer().serializeToString(out), width: ww, height: hh };
  }

  /* ---------- lifecycle ---------- */
  function mount() {
    if (alive) return; alive = true; host.append(svg); svg.setAttribute('tabindex', '0');
    svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false }); svg.addEventListener('dblclick', onDbl); svg.addEventListener('pointerleave', onLeave); svg.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    ro = new ResizeObserver(onResize); ro.observe(host);
    unsubs = [subscribe(() => { cfg = getState(); invalidateGeo(); }), subscribeUi(() => { ui = getUi(); if (ui.tool !== 'draw-wall' && ui.tool !== 'draw-slab' && draw) draw = null; invalidateGeo(); })];
    cfg = getState(); ui = getUi(); onResize(); invalidateGeo();
  }
  function unmount() {
    if (!alive) return; alive = false; cancelAnimationFrame(raf); raf = 0; ro?.disconnect(); unsubs.forEach((fn) => fn()); unsubs = [];
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); svg.remove(); draw = null; drag = null; typed = '';
  }
  return { mount, unmount, fit, zoomBy: (f) => zoomAt(f), zoomPercent: () => Math.round((view.s / PX_PER_CM_100) * 100), exportSvg, finishDraw, handleEscape, element: svg };
}
