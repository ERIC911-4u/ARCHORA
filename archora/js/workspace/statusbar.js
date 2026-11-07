// js/workspace/statusbar.js — bottom status bar: tool, cursor, selection, units, zoom, grid, snap, render, save state.
import { el } from '../ui.js';
import { getState, getUi, findRoom, findItem, findFreeWall, findSlab, isDirty } from '../state.js';
import { getItemDef, formatLength } from '../catalog.js';
import { TOOL_LABEL } from './tools.js';

const UNIT_LABEL = { mm: 'Millimeters', cm: 'Centimeters', m: 'Meters', ft: 'Feet / inches' };

/** Human-readable description of the current selection (also used by the context menu). */
export function describeSelection(sel, st = getState(), units = getUi().units) {
  if (!sel) return 'Nothing selected';
  const room = sel.kind === 'room' || sel.kind === 'wall' || sel.kind === 'opening' ? findRoom(st, sel.id) : null;
  switch (sel.kind) {
    case 'room': return room ? `Room · ${room.name}` : 'Room';
    case 'wall': return room ? `Wall · ${room.name} (${{ n: 'north', e: 'east', s: 'south', w: 'west' }[sel.side]})` : 'Wall';
    case 'opening': return room ? `Opening · ${room.name}` : 'Opening';
    case 'item': { const it = findItem(st, sel.id); return it ? `${getItemDef(it.type)?.name || it.type}` : 'Item'; }
    case 'slab': { const sl = findSlab(st, sel.id); return sl ? `${sl.name} · ${formatLength(sl.w, units)} × ${formatLength(sl.d, units)}` : 'Area'; }
    case 'fwall': { const w = findFreeWall(st, sel.id); return w ? `Wall · ${formatLength(Math.hypot(w.x2 - w.x1, w.z2 - w.z1), units)}` : 'Wall'; }
    case 'fopening': return 'Opening';
    default: return 'Selection';
  }
}

export function createStatusBar() {
  const root = el('footer', { class: 'ax__status', 'aria-label': 'Status bar' });
  const seg = (label, cls = '') => { const v = el('span', { class: 'ax-seg__v' }); const n = el('span', { class: `ax-seg ${cls}` }, el('span', { class: 'ax-seg__l', text: label }), v); return { n, v }; };
  const S = { tool: seg('Tool'), cursor: seg('Cursor', 'ax-seg--cursor'), sel: seg('Selected', 'ax-seg--grow'), units: seg('Units'), zoom: seg('Zoom'), grid: seg('Grid'), snap: seg('Snap'), render: seg('View') };
  const extra = el('div', { class: 'ax__status-extra', 'aria-label': 'Design summary' });
  root.append(...Object.values(S).map((x) => x.n), extra);
  let cursor = null; let zoom = null; let savedFlag = 'saved';
  function update() {
    const ui = getUi(); const st = getState();
    S.tool.v.textContent = TOOL_LABEL[ui.tool] || ui.tool;
    S.cursor.v.textContent = cursor ? `${formatLength(cursor.x, ui.units)}, ${formatLength(cursor.y, ui.units)}` : '—';
    S.sel.v.textContent = describeSelection(ui.selection, st, ui.units);
    S.units.v.textContent = UNIT_LABEL[ui.units];
    S.zoom.n.hidden = ui.viewMode !== '2d'; S.zoom.v.textContent = zoom === null ? '—' : `${zoom}%`;
    S.grid.v.textContent = ui.showGrid ? (ui.viewMode === '2d' ? `On · ${formatLength(ui.snap, ui.units)}` : 'On') : 'Off';
    const active = Object.values(ui.snapModes).filter(Boolean).length;
    S.snap.v.textContent = `${ui.snap} cm · ${active} mode${active === 1 ? '' : 's'}`;
    S.render.v.textContent = ui.viewMode === '2d' ? '2D plan (vector)' : '3D real-time';
    root.dataset.dirty = String(isDirty()); root.dataset.saved = savedFlag;
  }
  return { element: root, extra, update, setCursor(p) { cursor = p; update(); }, setZoom(z) { if (z !== zoom) { zoom = z; update(); } } };
}
