// js/state.js (v2) — house plan store with undo/redo + non-persistent UI store.
import {
  SIDES, ROOM_TYPE_IDS, OPENING_TYPES, OPENING_TYPE_IDS, SLAB_KINDS, SLAB_KIND_IDS, getSlabKind, isSlabMaterial, STYLE_IDS, LIGHTING_PRESET_IDS,
  getItemDef, getMaterial, getRoomType, buildRoom, furnishRoom, makeOpening, LAYOUTS
} from './catalog.js';

export const LIMITS = { rooms: 24, items: 400, walls: 160, slabs: 80, minRoom: 150, maxRoom: 1500, coord: 3000, wallMin: 5, wallMax: 40, minWall: 20, minSlab: 20, maxSlab: 3000 };
export const SNAP_OPTIONS = [1, 5, 10, 25, 50];
export const TOOLS = ['select', 'move', 'draw-wall', 'draw-slab', 'place-opening', 'place-item', 'eraser', 'pan'];
export const UNITS = [['mm', 'Millimeters'], ['cm', 'Centimeters'], ['m', 'Meters'], ['ft', 'Feet / inches']];
export const SNAP_MODES = [['grid', 'Grid'], ['endpoint', 'Endpoints'], ['midpoint', 'Midpoints'], ['intersection', 'Intersections'], ['nearest', 'Along walls'], ['perpendicular', 'Perpendicular'], ['align', 'Alignment guides']];
const SNAP_MODE_IDS = SNAP_MODES.map(([id]) => id);
export const DEFAULT_WALL_PRESET = { thickness: 15, height: null, material: 'paint', color: '#F3F0E8' };
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_LIGHTING = { preset: 'daylight', brightness: 1, temperature: 0.6 };
export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, min, max, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const snap = (v, step = 5) => Math.round(v / step) * step;
const round1 = (v) => Math.round(v * 10) / 10;
const pickColor = (v, fallback) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback);
const pickFrom = (list, v, fallback) => (list.includes(v) ? v : fallback);
const pickId = (v) => (typeof v === 'string' && /^[\w-]{1,48}$/.test(v) ? v : null);
const pickMaterial = (id, target, fallback) => (getMaterial(id)?.target === target ? id : fallback);
const cleanName = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : fallback);
function uniqueId(base, used) { let id = base; let n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id); return id; }

export function createDefaultConfig() {
  const style = 'modern-minimalist';
  const R = (o) => buildRoom({ ...o, style });
  const living = R({ id: 'room-living', type: 'living-room', level: 0, x: 0, z: 0, w: 600, d: 500 });
  const kitchen = R({ id: 'room-kitchen', type: 'kitchen', level: 0, x: 600, z: 0, w: 400, d: 500 });
  const hall0 = R({ id: 'room-hall-0', type: 'hallway', name: 'Entrance Hall', level: 0, x: 1000, z: 0, w: 200, d: 500 });
  const bed2 = R({ id: 'room-bed-2', type: 'bedroom', name: 'Bedroom 2', level: 1, x: 0, z: 0, w: 400, d: 500 });
  const master = R({ id: 'room-master', type: 'bedroom', name: 'Master Bedroom', level: 1, x: 400, z: 0, w: 600, d: 500 });
  const hall1 = R({ id: 'room-hall-1', type: 'hallway', name: 'Upper Hall', level: 1, x: 1000, z: 0, w: 200, d: 500 });
  const open = (room, list) => list.forEach(([side, type, center, o]) => room.walls[side].openings.push(makeOpening(room.id, side, type, center, o)));
  open(living, [['w', 'sliding', 250, { width: 300 }], ['s', 'window', 150, {}], ['s', 'window', 450, {}], ['e', 'arch', 250, { width: 160 }]]);
  open(kitchen, [['w', 'arch', 250, { width: 160 }], ['n', 'window', 184, { width: 90, height: 100, sill: 110 }], ['s', 'window', 200, {}]]);
  open(hall0, [['e', 'door', 440, { width: 100 }]]);
  open(bed2, [['w', 'window', 250, { width: 180 }], ['e', 'door', 200, {}]]);
  open(master, [['w', 'door', 200, {}], ['s', 'window', 150, {}], ['s', 'window', 450, {}], ['e', 'door', 450, {}]]);
  open(hall1, [['w', 'door', 450, {}], ['e', 'window', 250, { width: 100 }]]);
  const f = (room, prefix, layout) => furnishRoom(room, prefix, { style, layout });
  return {
    version: 3, id: null, name: 'Untitled Design', updatedAt: null, style,
    levels: [{ height: 300 }, { height: 280 }], walls: [], slabs: [],
    rooms: [living, kitchen, hall0, bed2, master, hall1],
    items: [...f(living, 'liv'), ...f(kitchen, 'kit'), ...f(hall0, 'h0', LAYOUTS['stair-hall-ground']), ...f(bed2, 'bd2', LAYOUTS['bedroom-compact']), ...f(master, 'mst'), ...f(hall1, 'h1', LAYOUTS['stair-hall-upper'])],
    lighting: { ...DEFAULT_LIGHTING }
  };
}

/** Empty plot: one lawn, no building. Everything is drawn by the user. */
export function createBlankConfig() {
  return {
    version: 3, id: null, name: 'Untitled Design', updatedAt: null, style: 'modern-minimalist',
    levels: [{ height: 300 }], rooms: [], items: [], walls: [],
    slabs: [{ id: 'slab-lot', level: 0, kind: 'lawn', name: 'Plot', x: 0, z: 0, w: 1200, d: 1000, material: 'grass-lawn', color: null }],
    lighting: { ...DEFAULT_LIGHTING }
  };
}

function normalizeOpening(raw, sideLen, used) {
  if (!isObj(raw)) return null;
  const type = pickFrom(OPENING_TYPE_IDS, raw.type, null);
  if (!type) return null;
  const def = OPENING_TYPES.find((o) => o.id === type);
  const width = Math.round(num(raw.width, 40, Math.max(40, sideLen - 20), Math.min(def.width, sideLen - 20)));
  const height = Math.round(num(raw.height, 40, 320, def.height));
  const sill = Math.round(num(raw.sill, 0, 250, def.sill));
  const center = Math.round(num(raw.center, width / 2, Math.max(width / 2, sideLen - width / 2), sideLen / 2));
  return { id: uniqueId(pickId(raw.id) || `o-${type}`, used), type, center, width, height, sill };
}
function normalizeWall(raw, sideLen, defaults) {
  const src = isObj(raw) ? raw : {};
  const used = new Set();
  const openings = (Array.isArray(src.openings) ? src.openings : []).map((o) => normalizeOpening(o, sideLen, used)).filter(Boolean).slice(0, 8);
  return {
    visible: typeof src.visible === 'boolean' ? src.visible : true,
    thickness: Math.round(num(src.thickness, LIMITS.wallMin, LIMITS.wallMax, 15)),
    material: pickMaterial(src.material, 'wall', defaults.material), color: pickColor(src.color, defaults.color), openings
  };
}
function normalizeRoom(raw, levelCount, used, index) {
  if (!isObj(raw)) return null;
  const level = Math.round(num(raw.level, 0, 1, 0));
  if (level >= levelCount) return null;
  const type = pickFrom(ROOM_TYPE_IDS, raw.type, 'living-room');
  const rt = getRoomType(type);
  const w = snap(num(raw.w, LIMITS.minRoom, LIMITS.maxRoom, rt.w));
  const d = snap(num(raw.d, LIMITS.minRoom, LIMITS.maxRoom, rt.d));
  const rawWalls = isObj(raw.walls) ? raw.walls : {};
  const walls = {};
  SIDES.forEach((side) => { walls[side] = normalizeWall(rawWalls[side], side === 'n' || side === 's' ? w : d, { material: 'paint', color: '#F3F0E8' }); });
  return {
    id: uniqueId(pickId(raw.id) || `room-${index + 1}`, used), level, type, name: cleanName(raw.name, rt.name),
    x: snap(num(raw.x, -LIMITS.coord, LIMITS.coord, 0)), z: snap(num(raw.z, -LIMITS.coord, LIMITS.coord, 0)), w, d,
    floorMaterial: pickMaterial(raw.floorMaterial, 'floor', 'oak-planks'), floorColor: raw.floorColor ? pickColor(raw.floorColor, null) : null, walls
  };
}
function normalizeFreeWall(raw, levelCount, used, index) {
  if (!isObj(raw)) return null;
  const level = Math.round(num(raw.level, 0, 1, 0));
  if (level >= levelCount) return null;
  const c = LIMITS.coord;
  const x1 = round1(num(raw.x1, -c, c, NaN)); const z1 = round1(num(raw.z1, -c, c, NaN));
  const x2 = round1(num(raw.x2, -c, c, NaN)); const z2 = round1(num(raw.z2, -c, c, NaN));
  if (![x1, z1, x2, z2].every(Number.isFinite)) return null;
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < LIMITS.minWall) return null;
  const oUsed = new Set();
  const openings = (Array.isArray(raw.openings) ? raw.openings : []).map((o) => normalizeOpening(o, len, oUsed)).filter(Boolean).slice(0, 12);
  const height = raw.height === null || raw.height === undefined ? null : Math.round(num(raw.height, 30, 450, 120));
  return {
    id: uniqueId(pickId(raw.id) || `fw-${index + 1}`, used), level, x1, z1, x2, z2,
    thickness: Math.round(num(raw.thickness, LIMITS.wallMin, LIMITS.wallMax, 15)), height,
    material: pickMaterial(raw.material, 'wall', 'paint'), color: pickColor(raw.color, '#F3F0E8'), openings
  };
}
function normalizeSlab(raw, levelCount, used, index) {
  if (!isObj(raw)) return null;
  const level = Math.round(num(raw.level, 0, 1, 0));
  if (level >= levelCount) return null;
  const kind = pickFrom(SLAB_KIND_IDS, raw.kind, 'floor');
  const kd = getSlabKind(kind);
  if (kd.outdoor && level > 0) return null;
  const mat = isSlabMaterial(raw.material) ? raw.material : kd.material;
  return {
    id: uniqueId(pickId(raw.id) || `slab-${index + 1}`, used), level, kind, name: cleanName(raw.name, kd.name),
    x: snap(num(raw.x, -LIMITS.coord, LIMITS.coord, 0), 5), z: snap(num(raw.z, -LIMITS.coord, LIMITS.coord, 0), 5),
    w: snap(num(raw.w, LIMITS.minSlab, LIMITS.maxSlab, 300), 5), d: snap(num(raw.d, LIMITS.minSlab, LIMITS.maxSlab, 300), 5),
    material: mat, color: raw.color ? pickColor(raw.color, null) : null
  };
}
function normalizeItem(raw, levelCount, used, index) {
  if (!isObj(raw) || !getItemDef(raw.type)) return null;
  const level = Math.round(num(raw.level, 0, 1, 0));
  if (level >= levelCount) return null;
  const def = getItemDef(raw.type);
  let size = null;
  if (isObj(raw.size)) size = { w: Math.round(num(raw.size.w, 5, 1000, def.size.w)), d: Math.round(num(raw.size.d, 1, 1000, def.size.d)), h: Math.round(num(raw.size.h, 1, 500, def.size.h)) };
  return {
    id: uniqueId(pickId(raw.id) || `item-${index + 1}`, used), level, type: raw.type,
    x: round1(num(raw.x, -LIMITS.coord, LIMITS.coord, 0)), z: round1(num(raw.z, -LIMITS.coord, LIMITS.coord, 0)),
    rot: round1((((Number(raw.rot) || 0) % 360) + 360) % 360),
    y: raw.y === null || raw.y === undefined ? null : round1(num(raw.y, 0, 450, 0)), size,
    color: pickColor(raw.color, def.color), material: pickMaterial(raw.material, 'item', def.material), trim: pickColor(raw.trim, def.trim),
    visible: typeof raw.visible === 'boolean' ? raw.visible : true
  };
}

const LEGACY_FLOORS = { 'natural-oak': 'oak-planks', 'dark-walnut': 'walnut-planks', 'light-stone': 'stone-tiles', marble: 'marble-white', 'polished-concrete': 'polished-concrete' };
function migrateLegacy(raw) {
  const base = createDefaultConfig();
  base.id = raw.id; base.name = raw.name; base.updatedAt = raw.updatedAt;
  base.style = pickFrom(STYLE_IDS, raw.style, base.style);
  if (isObj(raw.lighting)) base.lighting = { ...DEFAULT_LIGHTING, ...raw.lighting };
  const living = base.rooms.find((r) => r.id === 'room-living');
  if (LEGACY_FLOORS[raw.floor]) living.floorMaterial = LEGACY_FLOORS[raw.floor];
  const main = pickColor(raw.walls?.main, null); const accent = pickColor(raw.walls?.accent, null);
  SIDES.forEach((side) => { const color = side === 'n' ? accent : main; if (color) { living.walls[side].material = 'paint'; living.walls[side].color = color; } });
  const legacyMap = { sofa: 'sofa-3', coffeeTable: 'coffee-table-rect', rug: 'rug-rect', chair: 'armchair', lamp: 'floor-lamp', plant: 'plant-fiddle' };
  if (isObj(raw.furniture)) {
    Object.entries(legacyMap).forEach(([oldId, type]) => {
      const old = raw.furniture[oldId];
      if (!isObj(old)) return;
      base.items.filter((i) => i.type === type && i.level === 0).forEach((item) => {
        if (typeof old.visible === 'boolean') item.visible = old.visible;
        item.color = pickColor(old.color, item.color);
      });
    });
  }
  return base;
}

export function normalizeConfig(input) {
  if (!isObj(input)) throw new Error('Design data must be a JSON object.');
  let raw = input;
  if (!('rooms' in raw) && ('furniture' in raw || 'walls' in raw || 'floor' in raw)) raw = migrateLegacy(raw);
  if (!['rooms', 'items', 'levels', 'style', 'lighting'].some((k) => k in raw)) throw new Error('This file does not look like an ARCHORA design.');
  const fallback = ('rooms' in raw && 'items' in raw && 'levels' in raw) ? null : createDefaultConfig();
  const rawLevels = Array.isArray(raw.levels) ? raw.levels.slice(0, 2) : (fallback ? fallback.levels : [{ height: 300 }]);
  const levels = (rawLevels.length ? rawLevels : [{ height: 300 }]).map((lv, i) => ({ height: Math.round(num(isObj(lv) ? lv.height : NaN, 220, 450, i === 0 ? 300 : 280) / 5) * 5 }));
  const rawRooms = Array.isArray(raw.rooms) ? raw.rooms : (fallback ? fallback.rooms : []);
  const usedRooms = new Set();
  const rooms = rawRooms.slice(0, LIMITS.rooms).map((r, i) => normalizeRoom(r, levels.length, usedRooms, i)).filter(Boolean);
  const rawItems = Array.isArray(raw.items) ? raw.items : (fallback ? fallback.items : []);
  const usedItems = new Set();
  const items = rawItems.slice(0, LIMITS.items).map((it, i) => normalizeItem(it, levels.length, usedItems, i)).filter(Boolean);
  const usedW = new Set(); const usedS = new Set();
  const walls = (Array.isArray(raw.walls) ? raw.walls : []).slice(0, LIMITS.walls).map((w, i) => normalizeFreeWall(w, levels.length, usedW, i)).filter(Boolean);
  const slabs = (Array.isArray(raw.slabs) ? raw.slabs : []).slice(0, LIMITS.slabs).map((sl, i) => normalizeSlab(sl, levels.length, usedS, i)).filter(Boolean);
  const lighting = isObj(raw.lighting) ? raw.lighting : {};
  return {
    version: 3, id: pickId(raw.id), name: cleanName(raw.name, 'Untitled Design'),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : null,
    style: pickFrom(STYLE_IDS, raw.style, 'modern-minimalist'), levels, rooms, items, walls, slabs,
    lighting: {
      preset: pickFrom(LIGHTING_PRESET_IDS, lighting.preset, DEFAULT_LIGHTING.preset),
      brightness: num(lighting.brightness, 0.2, 1.5, DEFAULT_LIGHTING.brightness),
      temperature: num(lighting.temperature, 0, 1, DEFAULT_LIGHTING.temperature)
    }
  };
}

export const findRoom = (config, id) => config.rooms.find((r) => r.id === id) || null;
export const findItem = (config, id) => config.items.find((i) => i.id === id) || null;
export const findFreeWall = (config, id) => config.walls.find((w) => w.id === id) || null;
export const findSlab = (config, id) => config.slabs.find((sl) => sl.id === id) || null;
export const roomsOnLevel = (config, level) => config.rooms.filter((r) => r.level === level);
export const itemsOnLevel = (config, level) => config.items.filter((i) => i.level === level);
export const freeWallsOnLevel = (config, level) => config.walls.filter((w) => w.level === level);
export const slabsOnLevel = (config, level) => config.slabs.filter((sl) => sl.level === level);
export const levelElevation = (config, level) => config.levels.slice(0, level).reduce((sum, l) => sum + l.height, 0);

/* ---------- design store with undo / redo ---------- */
const HISTORY_LIMIT = 60;
let state = createDefaultConfig();
let baseline = fingerprint(state);
let past = []; let future = []; let lastKey = null; let lastTime = 0;
const listeners = new Set();

function fingerprint(config) { const { id, name, updatedAt, ...rest } = config; return JSON.stringify(rest); }
function emit(type) {
  pruneSelection();
  const meta = { type, dirty: isDirty(), canUndo: past.length > 0, canRedo: future.length > 0 };
  listeners.forEach((listener) => { try { listener(state, meta); } catch (error) { console.error('[state] listener failed:', error); } });
}
export const getState = () => state;
export const isDirty = () => fingerprint(state) !== baseline;
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
export const cloneState = () => JSON.parse(JSON.stringify(state));
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

/** Edit the design. `fn(draft)` mutates a deep copy. `coalesce` merges rapid edits into one undo step. */
export function mutate(fn, type = 'edit', { coalesce = null } = {}) {
  const draft = cloneState();
  const result = fn(draft);
  const next = normalizeConfig(result === undefined ? draft : result);
  if (JSON.stringify(next) === JSON.stringify(state)) return false;
  const now = Date.now();
  if (!(coalesce && coalesce === lastKey && now - lastTime < 1000)) { past.push(state); if (past.length > HISTORY_LIMIT) past.shift(); }
  lastKey = coalesce; lastTime = now; future = [];
  state = next;
  emit(type);
  return true;
}
export function undo() { if (!past.length) return false; future.push(state); state = past.pop(); lastKey = null; emit('undo'); return true; }
export function redo() { if (!future.length) return false; past.push(state); state = future.pop(); lastKey = null; emit('redo'); return true; }
export function replaceState(config, { saved = false } = {}) {
  state = normalizeConfig(config);
  if (saved) baseline = fingerprint(state);
  past = []; future = []; lastKey = null;
  setUi({ selection: null, level: 0 }, 'sync');
  emit('replace');
}
/** Rename the design. The name is not part of the geometry fingerprint, so this never marks the design as changed. */
export function setDesignName(name) {
  const clean = cleanName(name, state.name);
  if (clean === state.name) return false;
  state = { ...state, name: clean }; emit('rename'); return true;
}
export function markSaved({ id, name, updatedAt }) { state = normalizeConfig({ ...state, id, name, updatedAt }); baseline = fingerprint(state); emit('saved'); }
export function resetState(kind = 'default') {
  state = normalizeConfig(kind === 'blank' ? createBlankConfig() : createDefaultConfig()); baseline = fingerprint(state);
  past = []; future = []; lastKey = null;
  setUi({ selection: null, level: 0 }, 'sync');
  emit('reset');
}

/* ---------- UI store (not saved, not part of undo) ---------- */
const UI_DEFAULTS = { level: 0, viewMode: '2d', levelView: 'all', wallMode: 'cutaway', units: 'm', snap: 10, showDimensions: true, showGrid: true, showRoof: false, tool: 'move', selection: null, placeOpening: 'door', placeItem: null, slabKind: 'floor', slabMaterial: null, wallPreset: { ...DEFAULT_WALL_PRESET }, ortho: true, snapModes: Object.fromEntries(SNAP_MODE_IDS.map((id) => [id, true])) };
let ui = { ...UI_DEFAULTS };
const uiListeners = new Set();
export const getUi = () => ui;
export function subscribeUi(listener) { uiListeners.add(listener); return () => uiListeners.delete(listener); }

function validSelection(sel) {
  if (!isObj(sel)) return null;
  if (sel.kind === 'room' && findRoom(state, sel.id)) return { kind: 'room', id: sel.id };
  if (sel.kind === 'item' && findItem(state, sel.id)) return { kind: 'item', id: sel.id };
  if (sel.kind === 'slab' && findSlab(state, sel.id)) return { kind: 'slab', id: sel.id };
  if (sel.kind === 'fwall' && findFreeWall(state, sel.id)) return { kind: 'fwall', id: sel.id };
  if (sel.kind === 'fopening') { const fw = findFreeWall(state, sel.id); return fw && fw.openings.some((o) => o.id === sel.openingId) ? { kind: 'fopening', id: sel.id, openingId: sel.openingId } : null; }
  const room = findRoom(state, sel.id);
  if (!room || !SIDES.includes(sel.side)) return null;
  if (sel.kind === 'wall') return { kind: 'wall', id: sel.id, side: sel.side };
  if (sel.kind === 'opening' && room.walls[sel.side].openings.some((o) => o.id === sel.openingId)) return { kind: 'opening', id: sel.id, side: sel.side, openingId: sel.openingId };
  return null;
}
export function setUi(patch, type = 'ui') {
  const next = { ...ui, ...patch };
  next.level = Math.round(num(next.level, 0, state.levels.length - 1, 0));
  next.viewMode = pickFrom(['3d', '2d'], next.viewMode === 'plan' ? '2d' : next.viewMode, '2d');
  next.levelView = pickFrom(['all', 'active', 'below'], next.levelView, 'all');
  next.wallMode = pickFrom(['cutaway', 'full'], next.wallMode, 'cutaway');
  next.units = pickFrom(UNITS.map(([id]) => id), next.units, 'm');
  const sm = isObj(next.snapModes) ? next.snapModes : {};
  next.snapModes = Object.fromEntries(SNAP_MODE_IDS.map((id) => [id, sm[id] === undefined ? true : !!sm[id]]));
  next.snap = pickFrom(SNAP_OPTIONS, Number(next.snap), 10);
  next.tool = pickFrom(TOOLS, next.tool, 'move');
  next.placeOpening = pickFrom(OPENING_TYPE_IDS, next.placeOpening, 'door');
  next.placeItem = next.placeItem && getItemDef(next.placeItem) ? next.placeItem : null;
  next.slabKind = pickFrom(SLAB_KIND_IDS, next.slabKind, 'floor');
  next.slabMaterial = next.slabMaterial && isSlabMaterial(next.slabMaterial) ? next.slabMaterial : null;
  const wp = isObj(next.wallPreset) ? next.wallPreset : {};
  next.wallPreset = {
    thickness: Math.round(num(wp.thickness, LIMITS.wallMin, LIMITS.wallMax, 15)),
    height: wp.height === null || wp.height === undefined ? null : Math.round(num(wp.height, 30, 450, 120)),
    material: pickMaterial(wp.material, 'wall', 'paint'), color: pickColor(wp.color, '#F3F0E8')
  };
  next.ortho = !!next.ortho;
  next.showDimensions = !!next.showDimensions; next.showGrid = !!next.showGrid; next.showRoof = !!next.showRoof;
  next.selection = validSelection(next.selection);
  if (JSON.stringify(next) === JSON.stringify(ui)) return;
  ui = next;
  uiListeners.forEach((listener) => { try { listener(ui, type); } catch (error) { console.error('[ui] listener failed:', error); } });
}
function pruneSelection() { if (ui.selection && !validSelection(ui.selection)) setUi({ selection: null }, 'prune'); }