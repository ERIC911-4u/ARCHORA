// js/planview.js — 2D floor-plan preview (SVG) drawn from a design config, so the picture always matches the design.
import { SIDES, getMaterial, getItemSize, getRoomTypeName } from './catalog.js';
import { getMaterialPreview } from './textures.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  n.append(...kids);
  return n;
};
let counter = 0;

function levelGroup(config, level, fillFor) {
  const g = svgEl('g');
  (config.slabs || []).filter((t) => t.level === level).forEach((t) => g.append(svgEl('rect', { x: t.x, y: t.z, width: t.w, height: t.d, fill: t.color || getMaterial(t.material)?.base || '#D9D4C7', stroke: 'rgba(0,0,0,.15)', 'stroke-width': 1.5 })));
  config.rooms.filter((r) => r.level === level).forEach((room) => g.append(svgEl('rect', { x: room.x, y: room.z, width: room.w, height: room.d, fill: fillFor(room) })));
  (config.walls || []).filter((w) => w.level === level).forEach((w) => {
    g.append(svgEl('line', { x1: w.x1, y1: w.z1, x2: w.x2, y2: w.z2, stroke: w.height && w.height < 150 ? '#77766F' : '#3A3B38', 'stroke-width': w.thickness, 'stroke-linecap': 'square' }));
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1) || 1;
    w.openings.forEach((o) => { const a = (o.center - o.width / 2) / len; const b = (o.center + o.width / 2) / len; g.append(svgEl('line', { x1: w.x1 + (w.x2 - w.x1) * a, y1: w.z1 + (w.z2 - w.z1) * a, x2: w.x1 + (w.x2 - w.x1) * b, y2: w.z1 + (w.z2 - w.z1) * b, stroke: o.type === 'window' || o.type === 'sliding' ? '#9CC7D6' : '#F3F0E8', 'stroke-width': w.thickness + 1 })); });
  });
  config.items.filter((i) => i.level === level && i.visible).forEach((it) => {
    const { w, d } = getItemSize(it);
    if (w < 12 && d < 12) return;
    g.append(svgEl('rect', { x: it.x - w / 2, y: it.z - d / 2, width: w, height: d, fill: it.color, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5, transform: `rotate(${it.rot} ${it.x} ${it.z})`, opacity: 0.92 }));
  });
  config.rooms.filter((r) => r.level === level).forEach((room) => {
    SIDES.forEach((side) => {
      const wall = room.walls[side]; if (!wall.visible) return;
      const t = wall.thickness; const horizontal = side === 'n' || side === 's';
      const line = side === 'n' ? room.z : side === 's' ? room.z + room.d : side === 'w' ? room.x : room.x + room.w;
      const x = horizontal ? room.x - t / 2 : line - t / 2; const y = horizontal ? line - t / 2 : room.z - t / 2;
      g.append(svgEl('rect', { x, y, width: horizontal ? room.w + t : t, height: horizontal ? t : room.d + t, fill: '#3A3B38' }));
      wall.openings.forEach((o) => {
        const a = o.center - o.width / 2;
        g.append(svgEl('rect', {
          x: horizontal ? room.x + a : line - t / 2 - 0.5, y: horizontal ? line - t / 2 - 0.5 : room.z + a,
          width: horizontal ? o.width : t + 1, height: horizontal ? t + 1 : o.width, fill: o.type === 'window' || o.type === 'sliding' ? '#9CC7D6' : '#F3F0E8'
        }));
      });
    });
    g.append(svgEl('text', { x: room.x + room.w / 2, y: room.z + room.d / 2, 'text-anchor': 'middle', 'font-size': Math.max(26, Math.min(room.w, room.d) / 9), 'font-family': 'Inter, sans-serif', fill: '#171816', opacity: 0.8 }, room.name || getRoomTypeName(room.type)));
  });
  return g;
}

/** Returns an <svg> showing every floor of the design side by side. With textures:true floors use the real material textures. */
export function createPlanPreview(config, { textures = false } = {}) {
  const levels = config.levels.length; const prefix = `fp${++counter}`;
  const rooms = [...config.rooms, ...(config.slabs || []).map((t) => ({ x: t.x, z: t.z, w: t.w, d: t.d })), ...(config.walls || []).map((w) => ({ x: Math.min(w.x1, w.x2), z: Math.min(w.z1, w.z2), w: Math.abs(w.x2 - w.x1), d: Math.abs(w.z2 - w.z1) }))];
  if (!rooms.length) return svgEl('svg', { viewBox: '0 0 400 250', class: 'plan-preview', role: 'img', 'aria-label': 'Empty design' }, svgEl('rect', { width: 400, height: 250, fill: '#E4DFD3' }));
  const minX = Math.min(...rooms.map((r) => r.x)) - 30; const maxX = Math.max(...rooms.map((r) => r.x + r.w)) + 30;
  const minZ = Math.min(...rooms.map((r) => r.z)) - 70; const maxZ = Math.max(...rooms.map((r) => r.z + r.d)) + 30;
  const w = maxX - minX; const h = maxZ - minZ; const gap = 80; const totalW = w * levels + gap * (levels - 1);
  const svg = svgEl('svg', { viewBox: `0 0 ${totalW} ${h}`, class: 'plan-preview', role: 'img', preserveAspectRatio: 'xMidYMid meet', 'aria-label': `Floor plan preview with ${config.rooms.length} rooms on ${levels} floor${levels > 1 ? 's' : ''}` });
  const defs = svgEl('defs'); const patterns = new Set();
  const fillFor = (room) => {
    const mat = getMaterial(room.floorMaterial);
    if (room.floorColor) return room.floorColor;
    if (!textures || !mat) return mat?.base || '#D9D4C7';
    const id = `${prefix}-${mat.id}`;
    if (!patterns.has(id)) {
      patterns.add(id);
      const image = svgEl('image', { width: mat.tileCm, height: mat.tileCm }); image.setAttribute('href', getMaterialPreview(mat.id, { size: 96 }));
      defs.append(svgEl('pattern', { id, patternUnits: 'userSpaceOnUse', width: mat.tileCm, height: mat.tileCm }, image));
    }
    return `url(#${id})`;
  };
  svg.append(defs, svgEl('rect', { width: totalW, height: h, fill: '#E4DFD3' }));
  for (let L = 0; L < levels; L += 1) {
    const g = svgEl('g', { transform: `translate(${L * (w + gap) - minX} ${-minZ})` });
    g.append(svgEl('text', { x: minX + 10, y: minZ + 45, 'font-size': 38, 'font-family': 'Inter, sans-serif', fill: '#5F5C55', 'letter-spacing': 2 }, L === 0 ? 'GROUND FLOOR' : 'FIRST FLOOR'));
    g.append(levelGroup(config, L, fillFor));
    svg.append(g);
  }
  return svg;
}