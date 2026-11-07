// js/actions.js — all edit operations on the house plan (every one is a single undoable step).
import { mutate, uid } from './state.js';
import {
  SIDES, OPENING_TYPES, getItemDef, getItemSize, getRoomType, getStyle, LIGHTING_PRESETS,
  buildRoom, furnishRoom, createItem, clampItemToRoom, sideLength, getSlabKind, wallLength
} from './catalog.js';

const inside = (item, r) => item.level === r.level && item.x >= r.x && item.x <= r.x + r.w && item.z >= r.z && item.z <= r.z + r.d;
const snap5 = (v) => Math.round(v / 5) * 5;

/* ----- items ----- */
export const moveItem = (id, x, z) => mutate((c) => { const i = c.items.find((t) => t.id === id); if (i) { i.x = x; i.z = z; } }, 'move-item', { coalesce: `item-${id}` });
export const setItem = (id, patch, coalesce = null) => mutate((c) => { const i = c.items.find((t) => t.id === id); if (i) Object.assign(i, patch); }, 'edit-item', { coalesce: coalesce ? `${coalesce}-${id}` : null });
export const rotateItem = (id, delta) => mutate((c) => { const i = c.items.find((t) => t.id === id); if (i) i.rot = (((i.rot + delta) % 360) + 360) % 360; }, 'rotate-item');
export const deleteItem = (id) => mutate((c) => { c.items = c.items.filter((i) => i.id !== id); }, 'delete-item');

export function addItem(type, { roomId = null, level = 0 } = {}) {
  let newId = null;
  mutate((c) => {
    if (!getItemDef(type)) return;
    const room = (roomId && c.rooms.find((r) => r.id === roomId)) || c.rooms.find((r) => r.level === level);
    const item = createItem(type, { id: uid('item'), level: room ? room.level : level, x: room ? room.x + room.w / 2 : 0, z: room ? room.z + room.d / 2 : 0, style: c.style });
    newId = item.id;
    c.items.push(room ? clampItemToRoom(item, room) : item);
  }, 'add-item');
  return newId;
}
export function duplicateItem(id) {
  let newId = null;
  mutate((c) => {
    const src = c.items.find((i) => i.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('item'); copy.x += 30; copy.z += 30;
    const room = c.rooms.find((r) => inside(src, r));
    newId = copy.id;
    c.items.push(room ? clampItemToRoom(copy, room) : copy);
  }, 'duplicate-item');
  return newId;
}

/* ----- rooms ----- */
export function addRoom(type, level) {
  let newId = null;
  mutate((c) => {
    const rt = getRoomType(type);
    const onLevel = c.rooms.filter((r) => r.level === level);
    const x = onLevel.length ? Math.max(...onLevel.map((r) => r.x + r.w)) : 0;
    const z = onLevel.length ? onLevel[0].z : 0;
    const sameType = c.rooms.filter((r) => r.type === type).length;
    const room = buildRoom({ id: uid('room'), type, level, x, z, name: sameType ? `${rt.name} ${sameType + 1}` : rt.name, style: c.style });
    newId = room.id;
    c.rooms.push(room);
    c.items.push(...furnishRoom(room, uid('f'), { style: c.style }));
  }, 'add-room');
  return newId;
}
export const deleteRoom = (id) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === id);
  if (!r) return;
  c.items = c.items.filter((i) => !inside(i, r));
  c.rooms = c.rooms.filter((t) => t.id !== id);
}, 'delete-room');
export function duplicateRoom(id) {
  let newId = null;
  mutate((c) => {
    const r = c.rooms.find((t) => t.id === id);
    if (!r) return;
    const edge = Math.max(...c.rooms.filter((t) => t.level === r.level).map((t) => t.x + t.w));
    const dx = edge - r.x;
    const copy = JSON.parse(JSON.stringify(r));
    copy.id = uid('room'); copy.name = `${r.name} copy`; copy.x += dx;
    SIDES.forEach((s) => copy.walls[s].openings.forEach((o) => { o.id = uid('open'); }));
    newId = copy.id;
    c.items.filter((i) => inside(i, r)).forEach((i) => { const n = JSON.parse(JSON.stringify(i)); n.id = uid('item'); n.x += dx; c.items.push(n); });
    c.rooms.push(copy);
  }, 'duplicate-room');
  return newId;
}
export const setRoom = (id, patch, coalesce = null) => mutate((c) => { const r = c.rooms.find((t) => t.id === id); if (r) Object.assign(r, patch); }, 'edit-room', { coalesce: coalesce ? `${coalesce}-${id}` : null });
export const moveRoom = (id, x, z) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === id);
  if (!r) return;
  const nx = snap5(x); const nz = snap5(z); const dx = nx - r.x; const dz = nz - r.z;
  c.items.forEach((i) => { if (inside(i, r)) { i.x += dx; i.z += dz; } });
  r.x = nx; r.z = nz;
}, 'move-room', { coalesce: `room-${id}` });
export const resizeRoom = (id, { x, z, w, d }) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === id);
  if (!r) return;
  const old = { ...r };
  const held = c.items.filter((i) => inside(i, old));
  r.x = snap5(x ?? r.x); r.z = snap5(z ?? r.z); r.w = snap5(w ?? r.w); r.d = snap5(d ?? r.d);
  held.forEach((i) => { const t = clampItemToRoom(i, r); i.x = t.x; i.z = t.z; });
}, 'resize-room', { coalesce: `room-${id}` });
export const refurnishRoom = (id) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === id);
  if (!r) return;
  c.items = c.items.filter((i) => !inside(i, r));
  c.items.push(...furnishRoom(r, uid('f'), { style: c.style }));
}, 'refurnish');
export const setFloorMaterial = (scope, roomId, level, material) => mutate((c) => {
  c.rooms.forEach((r) => { if (scope === 'house' || (scope === 'level' && r.level === level) || r.id === roomId) { r.floorMaterial = material; r.floorColor = null; } });
}, 'floor');

/* ----- walls and openings ----- */
export const setWall = (roomId, side, patch, coalesce = null) => mutate((c) => { const r = c.rooms.find((t) => t.id === roomId); if (r) Object.assign(r.walls[side], patch); }, 'edit-wall', { coalesce: coalesce ? `${coalesce}-${roomId}-${side}` : null });
export const applyWallToAll = (roomId, side) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === roomId);
  if (!r) return;
  const src = r.walls[side];
  SIDES.forEach((s) => { Object.assign(r.walls[s], { material: src.material, color: src.color, thickness: src.thickness }); });
}, 'wall-all');
export function addOpening(roomId, side, type) {
  let newId = null;
  mutate((c) => {
    const r = c.rooms.find((t) => t.id === roomId);
    const def = OPENING_TYPES.find((o) => o.id === type);
    if (!r || !def) return;
    const len = sideLength(r, side); const wall = r.walls[side];
    const width = Math.min(def.width, len - 40);
    let center = len / 2;
    for (let k = 0; k < 14; k += 1) {
      const cand = len / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (width + 30);
      if (cand - width / 2 >= 10 && cand + width / 2 <= len - 10 && wall.openings.every((o) => Math.abs(o.center - cand) >= (o.width + width) / 2 + 10)) { center = cand; break; }
    }
    const o = { id: uid('open'), type, center: Math.round(center), width, height: def.height, sill: def.sill };
    wall.openings.push(o); newId = o.id;
  }, 'add-opening');
  return newId;
}
export const setOpening = (roomId, side, openingId, patch) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === roomId);
  const o = r?.walls[side].openings.find((x) => x.id === openingId);
  if (o) Object.assign(o, patch);
}, 'edit-opening', { coalesce: `open-${openingId}` });
export const deleteOpening = (roomId, side, openingId) => mutate((c) => {
  const r = c.rooms.find((t) => t.id === roomId);
  if (r) r.walls[side].openings = r.walls[side].openings.filter((o) => o.id !== openingId);
}, 'delete-opening');

/* ----- levels and style ----- */
export const setStoreys = (count) => mutate((c) => {
  if (count === 2 && c.levels.length === 1) c.levels.push({ height: 280 });
  if (count === 1 && c.levels.length === 2) { c.levels = c.levels.slice(0, 1); c.rooms = c.rooms.filter((r) => r.level === 0); c.items = c.items.filter((i) => i.level === 0); c.walls = c.walls.filter((w) => w.level === 0); c.slabs = c.slabs.filter((t) => t.level === 0); }
}, 'storeys');
export const setLevelHeight = (level, height) => mutate((c) => {
  if (!c.levels[level]) return;
  c.levels[level].height = height;
  c.items.forEach((i) => { if (i.level === level && i.type === 'stairs') { const s = getItemSize(i); i.size = { w: s.w, d: s.d, h: height }; } });
}, 'level-height', { coalesce: `level-${level}` });
export const applyStyle = (styleId) => mutate((c) => {
  const st = getStyle(styleId);
  c.style = st.id;
  c.rooms.forEach((r) => {
    const base = st.walls[r.type] || st.walls.default;
    r.floorMaterial = st.floors[r.type] || st.floors.default; r.floorColor = null;
    SIDES.forEach((s) => { r.walls[s].material = base.material; r.walls[s].color = base.color; });
    if ((r.type === 'living-room' || r.type === 'bedroom') && st.accent) { r.walls[st.accent.side].material = st.accent.material; r.walls[st.accent.side].color = st.accent.color; }
  });
  c.items.forEach((i) => {
    const th = st.theme[getItemDef(i.type).role];
    if (th) { i.color = th.color; i.material = th.material; }
  });
  c.walls.forEach((w) => { if (w.height === null) { w.material = st.walls.default.material; w.color = st.walls.default.color; } });
  c.slabs.forEach((sl) => { if (sl.kind === 'floor') { sl.material = st.floors.default; sl.color = null; } });
  const lp = LIGHTING_PRESETS.find((p) => p.id === st.lighting);
  c.lighting = { preset: st.lighting, brightness: 1, temperature: lp ? lp.temperature : 0.5 };
}, 'style');
/* ----- placing items by click ----- */
export function placeItem(type, level, x, z, rot = 0) {
  let newId = null;
  mutate((c) => {
    if (!getItemDef(type) || c.items.length >= 400) return;
    const room = c.rooms.find((r) => r.level === level && x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d);
    const item = createItem(type, { id: uid('item'), level, x, z, rot, style: c.style });
    newId = item.id;
    c.items.push(room ? clampItemToRoom(item, room) : item);
  }, 'place-item');
  return newId;
}

/* ----- free-standing walls ----- */
const fitCenter = (len, openings, width, wanted) => {
  const ok = (cand) => cand - width / 2 >= 5 && cand + width / 2 <= len - 5 && openings.every((o) => Math.abs(o.center - cand) >= (o.width + width) / 2 + 5);
  const base = Math.round(wanted ?? len / 2);
  for (let k = 0; k < 80; k += 1) {
    const cand = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10;
    if (ok(cand)) return cand;
  }
  return null;
};
const snapPt = (v) => Math.round(v * 10) / 10;

export function addFreeWall(level, x1, z1, x2, z2, preset = {}) {
  let newId = null;
  mutate((c) => {
    if (c.walls.length >= 160 || Math.hypot(x2 - x1, z2 - z1) < 20) return;
    const w = { id: uid('fw'), level, x1: snapPt(x1), z1: snapPt(z1), x2: snapPt(x2), z2: snapPt(z2), thickness: preset.thickness ?? 15, height: preset.height ?? null, material: preset.material || 'paint', color: preset.color || '#F3F0E8', openings: [] };
    newId = w.id; c.walls.push(w);
  }, 'add-fwall');
  return newId;
}
export const setFreeWall = (id, patch, coalesce = null) => mutate((c) => { const w = c.walls.find((t) => t.id === id); if (w) Object.assign(w, patch); }, 'edit-fwall', { coalesce: coalesce ? `${coalesce}-${id}` : null });
export const setFreeWallPoints = (id, pts) => mutate((c) => {
  const w = c.walls.find((t) => t.id === id);
  if (!w) return;
  ['x1', 'z1', 'x2', 'z2'].forEach((k) => { if (pts[k] !== undefined) w[k] = snapPt(pts[k]); });
}, 'move-fwall', { coalesce: `fw-${id}` });
export const setFreeWallLength = (id, len) => mutate((c) => {
  const w = c.walls.find((t) => t.id === id);
  if (!w) return;
  const cur = wallLength(w); if (cur < 1) return;
  const k = Math.max(20, len) / cur; w.x2 = snapPt(w.x1 + (w.x2 - w.x1) * k); w.z2 = snapPt(w.z1 + (w.z2 - w.z1) * k);
}, 'fwall-length', { coalesce: `fwl-${id}` });
export const deleteFreeWall = (id) => mutate((c) => { c.walls = c.walls.filter((w) => w.id !== id); }, 'delete-fwall');
export function duplicateFreeWall(id) {
  let newId = null;
  mutate((c) => {
    const src = c.walls.find((w) => w.id === id); if (!src || c.walls.length >= 160) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('fw'); copy.x1 += 50; copy.x2 += 50; copy.z1 += 50; copy.z2 += 50; copy.openings.forEach((o) => { o.id = uid('open'); });
    newId = copy.id; c.walls.push(copy);
  }, 'duplicate-fwall');
  return newId;
}
export function addFreeOpening(wallId, type, wantedCenter = null) {
  let newId = null;
  mutate((c) => {
    const w = c.walls.find((t) => t.id === wallId); const def = OPENING_TYPES.find((o) => o.id === type);
    if (!w || !def || w.openings.length >= 12) return;
    const len = wallLength(w); const width = Math.min(def.width, len - 20);
    const center = fitCenter(len, w.openings, width, wantedCenter);
    if (center === null) return;
    const o = { id: uid('open'), type, center, width, height: def.height, sill: def.sill }; w.openings.push(o); newId = o.id;
  }, 'add-fopening');
  return newId;
}
export const setFreeOpening = (wallId, openingId, patch) => mutate((c) => {
  const o = c.walls.find((t) => t.id === wallId)?.openings.find((x) => x.id === openingId);
  if (o) Object.assign(o, patch);
}, 'edit-fopening', { coalesce: `open-${openingId}` });
export const deleteFreeOpening = (wallId, openingId) => mutate((c) => {
  const w = c.walls.find((t) => t.id === wallId); if (w) w.openings = w.openings.filter((o) => o.id !== openingId);
}, 'delete-fopening');

/** Adds a door/window to a wall of a room at a chosen position (click placement). */
export function addOpeningAt(roomId, side, type, wantedCenter) {
  let newId = null;
  mutate((c) => {
    const r = c.rooms.find((t) => t.id === roomId); const def = OPENING_TYPES.find((o) => o.id === type);
    if (!r || !def) return;
    const wall = r.walls[side]; const len = sideLength(r, side); const width = Math.min(def.width, len - 20);
    if (wall.openings.length >= 8) return;
    const center = fitCenter(len, wall.openings, width, wantedCenter);
    if (center === null) return;
    const o = { id: uid('open'), type, center, width, height: def.height, sill: def.sill }; wall.openings.push(o); newId = o.id;
  }, 'add-opening');
  return newId;
}

/* ----- free floors, lawns, ponds ----- */
export function addSlab(level, kind, x, z, w, d, o = {}) {
  let newId = null;
  mutate((c) => {
    if (c.slabs.length >= 80) return;
    const kd = getSlabKind(kind);
    if (kd.outdoor && level > 0) return;
    const n = c.slabs.filter((s) => s.kind === kd.id).length;
    const slab = { id: uid('slab'), level, kind: kd.id, name: n ? `${kd.name} ${n + 1}` : kd.name, x, z, w, d, material: o.material || kd.material, color: o.color || null };
    newId = slab.id; c.slabs.push(slab);
  }, 'add-slab');
  return newId;
}
export const setSlab = (id, patch, coalesce = null) => mutate((c) => {
  const s = c.slabs.find((t) => t.id === id); if (!s) return;
  if (patch.kind && patch.kind !== s.kind) { const kd = getSlabKind(patch.kind); if (kd.outdoor && s.level > 0) return; if (patch.material === undefined) patch = { ...patch, material: kd.material }; }
  Object.assign(s, patch);
}, 'edit-slab', { coalesce: coalesce ? `${coalesce}-${id}` : null });
export const moveSlab = (id, x, z) => mutate((c) => { const s = c.slabs.find((t) => t.id === id); if (s) { s.x = x; s.z = z; } }, 'move-slab', { coalesce: `slab-${id}` });
export const resizeSlab = (id, { x, z, w, d }) => mutate((c) => {
  const s = c.slabs.find((t) => t.id === id); if (!s) return;
  s.x = x ?? s.x; s.z = z ?? s.z; s.w = w ?? s.w; s.d = d ?? s.d;
}, 'resize-slab', { coalesce: `slab-${id}` });
export const deleteSlab = (id) => mutate((c) => { c.slabs = c.slabs.filter((t) => t.id !== id); }, 'delete-slab');
export function duplicateSlab(id) {
  let newId = null;
  mutate((c) => {
    const src = c.slabs.find((t) => t.id === id); if (!src || c.slabs.length >= 80) return;
    const copy = JSON.parse(JSON.stringify(src)); copy.id = uid('slab'); copy.name = `${src.name} copy`; copy.x += 50; copy.z += 50;
    newId = copy.id; c.slabs.push(copy);
  }, 'duplicate-slab');
  return newId;
}
/** Builds four free walls (e.g. a fence) around a slab. */
export const wallsAroundSlab = (id, preset = {}) => mutate((c) => {
  const s = c.slabs.find((t) => t.id === id); if (!s || c.walls.length > 156) return;
  const mk = (x1, z1, x2, z2) => ({ id: uid('fw'), level: s.level, x1, z1, x2, z2, thickness: preset.thickness ?? 15, height: preset.height ?? null, material: preset.material || 'paint', color: preset.color || '#F3F0E8', openings: [] });
  c.walls.push(mk(s.x, s.z, s.x + s.w, s.z), mk(s.x + s.w, s.z, s.x + s.w, s.z + s.d), mk(s.x + s.w, s.z + s.d, s.x, s.z + s.d), mk(s.x, s.z + s.d, s.x, s.z));
}, 'walls-around');
