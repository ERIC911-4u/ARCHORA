// js/scene.js — singleton Three.js scene for the house-plan editor (2 floors, walls with openings, dimensions, drag/resize).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  SIDES, SIDE_NAMES, OPENING_TYPES, sideLength, getItemDef, getItemSize, getItemName, itemFootprint,
  clampItemToRoom, interiorSize, formatLength, formatArea, getSlabKind, wallLength
} from './catalog.js';
import { getSurfaceMaterial, getSolidMaterial, LIGHTING_RENDER, temperatureTint } from './materials.js';
import { buildItemMesh, disposeGroup } from './furniture.js';
import { getState, getUi, setUi, subscribe, subscribeUi, levelElevation } from './state.js';
import * as actions from './actions.js';

const CM = 0.01;
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const INNER = { n: 1, s: -1, w: -1, e: 1 };

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (error) { return false; }
}

let instance = null;
export const getStudioScene = () => instance || (instance = createStudioScene());

function createStudioScene() {
  let renderer; let canvas; let scene; let camera; let controls; let hemi; let ambient; let sun; let root; let overlay; let roofGroup; let gridObj = null;
  let labelLayer; let initialized = false; let host = null; let resizeObserver = null; let rafId = 0; let lastTime = 0;
  let needsRender = true; let viewTween = null; let needsInitialView = true; let prevViewMode = '3d';
  let config = getState(); let ui = getUi(); let bounds = null; let gridKey = ''; let roofKey = '';
  let handles = []; let labelDefs = []; let drag = null; let downInfo = null; let hoverAt = 0; let unsubs = [];
  let preview; let previewLabel; let previewPos = null; let drawState = null; let lastTool = 'move'; let previewAt = 0;
  const labelPool = []; const levelGroups = []; const roomObjs = new Map(); const fwallObjs = new Map(); const slabObjs = new Map(); const itemObjs = new Map(); const skinMats = new Map();
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const tmp = new THREE.Vector3();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const requestRender = () => { needsRender = true; };
  const elevOf = (level) => levelElevation(config, level) * CM;
  const snapv = (v) => { const s = ui.snap || 10; return Math.round(v / s) * s; };
  const select = (selection) => setUi({ selection }, 'select');

  /* ---------- helpers ---------- */
  function computeBounds() {
    const rects = [];
    config.rooms.forEach((r) => rects.push([r.x, r.z, r.x + r.w, r.z + r.d]));
    config.slabs.forEach((t) => rects.push([t.x, t.z, t.x + t.w, t.z + t.d]));
    config.walls.forEach((w) => rects.push([Math.min(w.x1, w.x2), Math.min(w.z1, w.z2), Math.max(w.x1, w.x2), Math.max(w.z1, w.z2)]));
    if (!rects.length) return { minX: 0, maxX: 6, minZ: 0, maxZ: 5, cx: 3, cz: 2.5, spanX: 6, spanZ: 5, height: 3 };
    const minX = Math.min(...rects.map((r) => r[0])) * CM; const maxX = Math.max(...rects.map((r) => r[2])) * CM;
    const minZ = Math.min(...rects.map((r) => r[1])) * CM; const maxZ = Math.max(...rects.map((r) => r[3])) * CM;
    return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, spanX: maxX - minX, spanZ: maxZ - minZ, height: Math.max(elevOf(config.levels.length), 2.5) };
  }

  function getVoids(room) {
    const out = [];
    config.items.forEach((it) => {
      if (it.level !== room.level - 1 || !getItemDef(it.type)?.voidAbove) return;
      const fp = itemFootprint(it);
      const x0 = Math.max(it.x - fp.w / 2, room.x + 1); const x1 = Math.min(it.x + fp.w / 2, room.x + room.w - 1);
      const z0 = Math.max(it.z - fp.d / 2, room.z + 1); const z1 = Math.min(it.z + fp.d / 2, room.z + room.d - 1);
      if (x1 - x0 > 20 && z1 - z0 > 20) out.push({ x0, x1, z0, z1 });
    });
    return out;
  }

  function effectiveOpenings(room, side) {
    const len = sideLength(room, side);
    const list = room.walls[side].openings.map((o) => ({ ...o, ref: { roomId: room.id, side, openingId: o.id } }));
    const horizontal = side === 'n' || side === 's'; const opp = OPP[side];
    const line = side === 'n' ? room.z : side === 's' ? room.z + room.d : side === 'w' ? room.x : room.x + room.w;
    const a0 = horizontal ? room.x : room.z;
    config.rooms.forEach((o) => {
      if (o.id === room.id || o.level !== room.level) return;
      const oLine = opp === 'n' ? o.z : opp === 's' ? o.z + o.d : opp === 'w' ? o.x : o.x + o.w;
      if (Math.abs(oLine - line) > 1) return;
      const b0 = horizontal ? o.x : o.z; const bl = horizontal ? o.w : o.d;
      if (Math.min(a0 + len, b0 + bl) - Math.max(a0, b0) <= 10) return;
      o.walls[opp].openings.forEach((op) => {
        const c = op.center + (b0 - a0);
        if (c - op.width / 2 >= -1 && c + op.width / 2 <= len + 1) list.push({ ...op, center: c, ref: { roomId: o.id, side: opp, openingId: op.id } });
      });
    });
    return list;
  }

  function mergeOpenings(list, cut) {
    const out = [];
    list.map((o) => ({ ...o, y1: Math.min(o.sill + o.height, cut - 4) }))
      .filter((o) => o.y1 - o.sill >= 8 && o.sill < cut - 8)
      .sort((a, b) => (a.center - a.width / 2) - (b.center - b.width / 2))
      .forEach((o) => { const last = out[out.length - 1]; if (last && o.center - o.width / 2 < last.center + last.width / 2 + 2) return; out.push(o); });
    return out;
  }

  const cutHeight = (H) => (ui.wallMode === 'cutaway' ? Math.min(H, 120) : H);
  const roomKey = (room) => {
    const H = config.levels[room.level].height;
    const eff = {}; SIDES.forEach((s) => { eff[s] = effectiveOpenings(room, s); });
    return JSON.stringify({ room, H, mode: ui.wallMode, eff, voids: getVoids(room) });
  };
  const skinMaterial = (id, color) => {
    const key = `${id}|${color}`;
    if (!skinMats.has(key)) { const m = getSurfaceMaterial(id, color, 'world').clone(); m.side = THREE.DoubleSide; skinMats.set(key, m); }
    return skinMats.get(key);
  };

  /* ---------- room geometry ---------- */
  function wallFrame(room, side) {
    const f = new THREE.Group();
    f.position.set((side === 'e' ? room.x + room.w : room.x) * CM, 0, (side === 's' ? room.z + room.d : room.z) * CM);
    if (side === 'e' || side === 'w') f.rotation.y = -Math.PI / 2;
    return f;
  }

  function addOpeningVisuals(frame, o, t) {
    const y0 = Math.max(o.sill, 0) * CM; const y1 = o.y1 * CM; const x0 = (o.center - o.width / 2) * CM; const x1 = (o.center + o.width / 2) * CM;
    const w = x1 - x0; const h = y1 - y0; const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const ft = 0.045; const fd = t * CM + 0.02;
    const dark = getSolidMaterial('#2B2B29', { roughness: 0.5, metalness: 0.5 });
    const data = { kind: o.fKind || 'opening', ...o.ref };
    const bar = (bw, bh, bx, by) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, fd), dark); m.position.set(bx, by, 0); m.castShadow = true; frame.add(m); };
    const pane = (pw, ph, mat, z = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat); m.position.set(cx, cy, z); m.userData = data; m.renderOrder = 3; frame.add(m); return m; };
    if (o.type === 'arch') { pane(w, h, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); return; }
    bar(ft, h, x0 + ft / 2, cy); bar(ft, h, x1 - ft / 2, cy); bar(w, ft, cx, y1 - ft / 2);
    if (o.type !== 'door') bar(w, ft, cx, y0 + ft / 2);
    if (o.type === 'door') {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - ft * 2, h - ft, 0.04), getSolidMaterial('#8A5E3B', { roughness: 0.6 }));
      leaf.position.set(cx, y0 + (h - ft) / 2, 0); leaf.userData = data; leaf.castShadow = true; frame.add(leaf);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.1), getSolidMaterial('#C9A06A', { roughness: 0.3, metalness: 0.8 }));
      handle.position.set(x1 - ft - 0.1, y0 + 1.0, 0.04); frame.add(handle);
      return;
    }
    pane(w - ft * 2, h - ft * 2, getSolidMaterial('#BFD8E6', { roughness: 0.05, transparent: true, opacity: 0.22 }));
    if (o.type === 'sliding' || w > 1.0) bar(ft * 0.8, h, cx, cy);
    if (o.type === 'window' && h > 1.0) bar(w, ft * 0.7, cx, cy);
  }

  function wallBody(frame, len, t, cut, ops, wall, data, signs) {
    const shape = new THREE.Shape();
    shape.moveTo(-t / 2, 0); shape.lineTo(len + t / 2, 0); shape.lineTo(len + t / 2, cut); shape.lineTo(-t / 2, cut); shape.closePath();
    ops.forEach((o) => {
      const a = o.center - o.width / 2; const b = o.center + o.width / 2; const y0 = Math.max(o.sill, 0.5);
      const p = new THREE.Path(); p.moveTo(a, y0); p.lineTo(b, y0); p.lineTo(b, o.y1); p.lineTo(a, o.y1); p.closePath(); shape.holes.push(p);
    });
    const coreGeo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }); coreGeo.translate(0, 0, -t / 2); coreGeo.scale(CM, CM, CM);
    const core = new THREE.Mesh(coreGeo, getSolidMaterial('#E7E2D8', { roughness: 0.95 }));
    core.castShadow = true; core.receiveShadow = true; core.userData = data; frame.add(core);
    const skinGeo = new THREE.ShapeGeometry(shape); skinGeo.scale(CM, CM, CM);
    const mat = skinMaterial(wall.material, wall.color);
    signs.forEach((sg) => { const skin = new THREE.Mesh(skinGeo, mat); skin.position.z = sg * (t * CM / 2 + 0.003); skin.receiveShadow = true; skin.userData = data; frame.add(skin); });
    ops.forEach((o) => addOpeningVisuals(frame, o, t));
  }

  function buildWall(room, side, cut) {
    const wall = room.walls[side]; const len = sideLength(room, side);
    const ops = mergeOpenings(effectiveOpenings(room, side), cut);
    const frame = wallFrame(room, side);
    wallBody(frame, len, wall.thickness, cut, ops, wall, { kind: 'wall', roomId: room.id, side }, [INNER[side]]);
    return frame;
  }

  function buildFreeWall(w) {
    const H = w.height ?? config.levels[w.level].height; const cut = cutHeight(H); const len = wallLength(w);
    const ops = mergeOpenings(w.openings.map((o) => ({ ...o, fKind: 'fopening', ref: { wallId: w.id, openingId: o.id } })), cut);
    const frame = new THREE.Group();
    frame.position.set(w.x1 * CM, 0, w.z1 * CM); frame.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
    wallBody(frame, len, w.thickness, cut, ops, w, { kind: 'fwall', wallId: w.id }, [1, -1]);
    return frame;
  }

  const SLAB_BODY = { floor: '#CFCAC0', terrace: '#BDB5A6', lawn: '#74634C', paving: '#A9A396', gravel: '#9C9686', driveway: '#3D3E40', water: '#D9D5CB' };
  function buildSlab(s, idx) {
    const kd = getSlabKind(s.kind); const group = new THREE.Group(); const data = { kind: 'slab', slabId: s.id };
    const rect = (x, z, w, d) => { const sh = new THREE.Shape(); sh.moveTo(x, -z); sh.lineTo(x + w, -z); sh.lineTo(x + w, -(z + d)); sh.lineTo(x, -(z + d)); sh.closePath(); return sh; };
    const water = kd.id === 'water' && s.w > 44 && s.d > 44; const off = idx * 0.03; const rim = 14;
    const topY = (water ? -2 : kd.top) + off;
    const outer = rect(s.x, s.z, s.w, s.d);
    if (water) { const hole = new THREE.Path(); hole.moveTo(s.x + rim, -(s.z + rim)); hole.lineTo(s.x + s.w - rim, -(s.z + rim)); hole.lineTo(s.x + s.w - rim, -(s.z + s.d - rim)); hole.lineTo(s.x + rim, -(s.z + s.d - rim)); hole.closePath(); outer.holes.push(hole); }
    const flat = (shape, y, mat) => { const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.scale(CM, CM, CM); const m = new THREE.Mesh(g, mat); m.position.y = y * CM; m.receiveShadow = true; m.userData = data; return m; };
    const box = (shape, depth, yTop, mat) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, yTop - depth - 0.3, 0); g.scale(CM, CM, CM); const m = new THREE.Mesh(g, mat); m.castShadow = !kd.outdoor; m.receiveShadow = true; m.userData = data; return m; };
    const bodyMat = getSolidMaterial(SLAB_BODY[kd.id] || '#CFCAC0', { roughness: 0.95 });
    const surface = getSurfaceMaterial(s.material, s.color || '#FFFFFF', 'world');
    if (water) {
      group.add(flat(outer, topY, bodyMat), box(outer, kd.thick, topY, bodyMat));
      group.add(box(rect(s.x, s.z, s.w, s.d), kd.thick - 6, kd.top + off - 0.3, bodyMat), flat(rect(s.x + rim, s.z + rim, s.w - rim * 2, s.d - rim * 2), kd.top + off, surface));
    } else group.add(flat(outer, topY, surface), box(outer, kd.thick, topY, bodyMat));
    return group;
  }

  function buildRoom(room) {
    const H = config.levels[room.level].height; const cut = cutHeight(H);
    const group = new THREE.Group(); group.userData.roomId = room.id;
    const shape = new THREE.Shape();
    shape.moveTo(room.x, -room.z); shape.lineTo(room.x + room.w, -room.z); shape.lineTo(room.x + room.w, -(room.z + room.d)); shape.lineTo(room.x, -(room.z + room.d)); shape.closePath();
    getVoids(room).forEach((v) => {
      const p = new THREE.Path(); p.moveTo(v.x0, -v.z0); p.lineTo(v.x1, -v.z0); p.lineTo(v.x1, -v.z1); p.lineTo(v.x0, -v.z1); p.closePath(); shape.holes.push(p);
    });
    const floorGeo = new THREE.ShapeGeometry(shape); floorGeo.rotateX(-Math.PI / 2); floorGeo.scale(CM, CM, CM);
    const floor = new THREE.Mesh(floorGeo, getSurfaceMaterial(room.floorMaterial, room.floorColor || '#FFFFFF', 'world'));
    floor.receiveShadow = true; floor.userData = { kind: 'floor', roomId: room.id };
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false }); slabGeo.rotateX(-Math.PI / 2); slabGeo.translate(0, -20.3, 0); slabGeo.scale(CM, CM, CM);
    const slab = new THREE.Mesh(slabGeo, getSolidMaterial('#CFCAC0', { roughness: 0.9 })); slab.castShadow = true; slab.receiveShadow = true;
    group.add(floor, slab);
    SIDES.forEach((side) => { if (room.walls[side].visible) group.add(buildWall(room, side, cut)); });
    return group;
  }

  function removeFrom(map, id) {
    const o = map.get(id); if (!o) return;
    o.group.parent?.remove(o.group); disposeGroup(o.group); map.delete(id);
  }
  const removeRoom = (id) => removeFrom(roomObjs, id);

  /* ---------- items ---------- */
  const itemKey = (i) => `${i.type}|${i.size ? `${i.size.w}x${i.size.d}x${i.size.h}` : ''}|${i.color}|${i.material}|${i.trim}`;
  function placeItem(group, item) {
    const def = getItemDef(item.type); const size = getItemSize(item);
    const y = item.y ?? (def.mount === 'ceiling' ? config.levels[item.level].height - size.h : def.y);
    group.position.set(item.x * CM, y * CM, item.z * CM);
    group.rotation.y = THREE.MathUtils.degToRad(item.rot);
    group.visible = item.visible;
  }

  /* ---------- reconcile ---------- */
  function ensureLevels() {
    while (levelGroups.length < config.levels.length) { const g = new THREE.Group(); root.add(g); levelGroups.push(g); }
    while (levelGroups.length > config.levels.length) { const g = levelGroups.pop(); root.remove(g); }
  }

  function reconcile() {
    ensureLevels();
    const seenRooms = new Set();
    config.rooms.forEach((room) => {
      seenRooms.add(room.id);
      const key = roomKey(room); const ex = roomObjs.get(room.id);
      if (ex && ex.key === key && ex.level === room.level) return;
      if (ex) removeRoom(room.id);
      const group = buildRoom(room); levelGroups[room.level].add(group);
      roomObjs.set(room.id, { group, key, level: room.level });
    });
    [...roomObjs.keys()].forEach((id) => { if (!seenRooms.has(id)) removeRoom(id); });

    const seenW = new Set();
    config.walls.forEach((w) => {
      seenW.add(w.id);
      const key = JSON.stringify({ w, H: config.levels[w.level].height, mode: ui.wallMode }); const ex = fwallObjs.get(w.id);
      if (ex && ex.key === key) return;
      removeFrom(fwallObjs, w.id);
      const group = buildFreeWall(w); levelGroups[w.level].add(group); fwallObjs.set(w.id, { group, key, level: w.level });
    });
    [...fwallObjs.keys()].forEach((id) => { if (!seenW.has(id)) removeFrom(fwallObjs, id); });
    const seenS = new Set();
    config.slabs.forEach((sl, idx) => {
      seenS.add(sl.id);
      const key = JSON.stringify({ sl, idx }); const ex = slabObjs.get(sl.id);
      if (ex && ex.key === key) return;
      removeFrom(slabObjs, sl.id);
      const group = buildSlab(sl, idx); levelGroups[sl.level].add(group); slabObjs.set(sl.id, { group, key, level: sl.level });
    });
    [...slabObjs.keys()].forEach((id) => { if (!seenS.has(id)) removeFrom(slabObjs, id); });

    const seenItems = new Set();
    config.items.forEach((item) => {
      seenItems.add(item.id);
      const key = itemKey(item); let ex = itemObjs.get(item.id);
      if (!ex || ex.key !== key || ex.item.level !== item.level) {
        if (ex) { ex.group.parent?.remove(ex.group); disposeGroup(ex.group); }
        const group = buildItemMesh(item); levelGroups[item.level].add(group);
        ex = { group, key, item }; itemObjs.set(item.id, ex);
      }
      ex.item = item; placeItem(ex.group, item);
    });
    [...itemObjs.keys()].forEach((id) => { if (!seenItems.has(id)) { const ex = itemObjs.get(id); ex.group.parent?.remove(ex.group); disposeGroup(ex.group); itemObjs.delete(id); } });

    levelGroups.forEach((g, L) => {
      g.position.y = elevOf(L);
      g.visible = ui.levelView === 'all' || (ui.levelView === 'active' && L === ui.level) || (ui.levelView === 'below' && L <= ui.level);
    });
  }

  function updateRoof() {
    const top = config.levels.length - 1;
    const key = JSON.stringify({ s: ui.showRoof, r: config.rooms.filter((r) => r.level === top).map((r) => [r.x, r.z, r.w, r.d]), h: config.levels[top].height, top });
    if (key === roofKey) return;
    roofKey = key;
    if (roofGroup) { roofGroup.parent?.remove(roofGroup); disposeGroup(roofGroup); roofGroup = null; }
    if (!ui.showRoof) return;
    roofGroup = new THREE.Group();
    config.rooms.filter((r) => r.level === top).forEach((r) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry((r.w + 30) * CM, 0.15, (r.d + 30) * CM), getSolidMaterial('#8F8B82', { roughness: 0.9 }));
      m.position.set((r.x + r.w / 2) * CM, config.levels[top].height * CM + 0.075, (r.z + r.d / 2) * CM); m.castShadow = true; roofGroup.add(m);
    });
    levelGroups[top].add(roofGroup);
  }

  function updateGrid() {
    const span = Math.ceil(Math.max(bounds.spanX, bounds.spanZ) + 6);
    const key = `${ui.showGrid}|${span}|${bounds.cx.toFixed(2)}|${bounds.cz.toFixed(2)}|${elevOf(ui.level).toFixed(2)}`;
    if (key === gridKey) return;
    gridKey = key;
    if (gridObj) { root.remove(gridObj); gridObj.geometry.dispose(); gridObj.material.dispose(); gridObj = null; }
    if (!ui.showGrid) return;
    gridObj = new THREE.GridHelper(span, span * 2, '#8F8C84', '#B9B5AA');
    gridObj.material.transparent = true; gridObj.material.opacity = 0.35;
    gridObj.position.set(bounds.cx, elevOf(ui.level) + 0.004, bounds.cz); root.add(gridObj);
  }

  function updateLights() {
    const def = LIGHTING_RENDER[config.lighting.preset] || LIGHTING_RENDER.daylight; const tint = temperatureTint(config.lighting.temperature); const b = config.lighting.brightness;
    scene.background.set(def.background);
    hemi.color.set(def.hemiSky).multiply(tint); hemi.groundColor.set(def.hemiGround).multiply(tint); hemi.intensity = def.hemi * b;
    ambient.color.set('#FFFFFF').multiply(tint); ambient.intensity = def.ambient * b;
    sun.color.set(def.sunColor).multiply(tint); sun.intensity = def.sun * b;
    const span = Math.max(bounds.spanX, bounds.spanZ, 8); const dir = new THREE.Vector3(...def.sunPosition).normalize();
    sun.position.set(bounds.cx + dir.x * span * 1.6, dir.y * span * 1.6, bounds.cz + dir.z * span * 1.6);
    sun.target.position.set(bounds.cx, 0, bounds.cz); sun.target.updateMatrixWorld();
    const half = span * 0.9 + 4; Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: span * 5 }); sun.shadow.camera.updateProjectionMatrix();
    renderer.toneMappingExposure = def.exposure;
  }

  /* ---------- overlay: dimension lines, labels, handles ---------- */
  function wallPoint(room, side, u, y, base) {
    const e = base + y * CM;
    if (side === 'n') return new THREE.Vector3((room.x + u) * CM, e, room.z * CM);
    if (side === 's') return new THREE.Vector3((room.x + u) * CM, e, (room.z + room.d) * CM);
    if (side === 'w') return new THREE.Vector3(room.x * CM, e, (room.z + u) * CM);
    return new THREE.Vector3((room.x + room.w) * CM, e, (room.z + u) * CM);
  }

  function rebuildOverlay() {
    overlay.traverse((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
    overlay.clear(); handles = []; labelDefs = [];
    const L = ui.level; const base = elevOf(L); const yy = base + 0.03; const units = ui.units; const sel = ui.selection;
    const dark = []; const gold = [];
    const P = (x, z, y = yy) => new THREE.Vector3(x * CM, y, z * CM);
    const seg = (arr, a, b) => arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const dim = (arr, ax, az, bx, bz, nx, nz) => { seg(arr, P(ax, az), P(bx, bz)); [[ax, az], [bx, bz]].forEach(([x, z]) => seg(arr, P(x - nx * 8, z - nz * 8), P(x + nx * 8, z + nz * 8))); };
    const label = (pos, lines, cls = 'dim-label dim-label--dim') => labelDefs.push({ pos, lines, cls });

    config.rooms.filter((r) => r.level === L).forEach((room) => {
      const t = (s) => (room.walls[s].visible ? room.walls[s].thickness : 0);
      const x0 = room.x + t('w') / 2; const x1 = room.x + room.w - t('e') / 2; const z0 = room.z + t('n') / 2; const z1 = room.z + room.d - t('s') / 2;
      const inner = interiorSize(room); const isSel = sel?.kind === 'room' && sel.id === room.id; const arr = isSel ? gold : dark;
      if (ui.showDimensions) {
        dim(arr, x0 + 15, z0 + 22, x1 - 15, z0 + 22, 0, 1); dim(arr, x0 + 22, z0 + 15, x0 + 22, z1 - 15, 1, 0);
        label(P((x0 + x1) / 2, z0 + 22, yy + 0.02), [formatLength(inner.w, units)]);
        label(P(x0 + 22, (z0 + z1) / 2, yy + 0.02), [formatLength(inner.d, units)]);
        label(P((x0 + x1) / 2, (z0 + z1) / 2, yy + 0.02), [room.name, `${formatLength(inner.w, units)} × ${formatLength(inner.d, units)}`, formatArea(inner.w * inner.d)], 'dim-label dim-label--room');
      }
      if (isSel) {
        const c = [P(room.x, room.z), P(room.x + room.w, room.z), P(room.x + room.w, room.z + room.d), P(room.x, room.z + room.d)];
        for (let k = 0; k < 4; k += 1) seg(gold, c[k], c[(k + 1) % 4]);
        [['n', room.x + room.w / 2, room.z], ['s', room.x + room.w / 2, room.z + room.d], ['w', room.x, room.z + room.d / 2], ['e', room.x + room.w, room.z + room.d / 2]].forEach(([edge, hx, hz]) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: '#E0B15A', depthTest: false, transparent: true }));
          m.position.copy(P(hx, hz, yy + 0.1)); m.renderOrder = 21; m.userData = { kind: 'handle', roomId: room.id, edge }; overlay.add(m); handles.push(m);
        });
      }
    });

    if (sel?.kind === 'item') {
      const it = config.items.find((i) => i.id === sel.id);
      if (it && it.level === L) {
        const sz = getItemSize(it); const th = (it.rot * Math.PI) / 180; const c = Math.cos(th); const s = Math.sin(th);
        const corner = (lx, lz) => P(it.x + lx * c + lz * s, it.z - lx * s + lz * c);
        const cs = [corner(-sz.w / 2, -sz.d / 2), corner(sz.w / 2, -sz.d / 2), corner(sz.w / 2, sz.d / 2), corner(-sz.w / 2, sz.d / 2)];
        for (let k = 0; k < 4; k += 1) seg(gold, cs[k], cs[(k + 1) % 4]);
        label(P(it.x, it.z, yy + Math.min(sz.h, 200) * CM + 0.15), [getItemName(it.type), `${formatLength(sz.w, units)} × ${formatLength(sz.d, units)} × ${formatLength(sz.h, units)}`], 'dim-label');
        const room = config.rooms.find((r) => r.level === L && it.x >= r.x && it.x <= r.x + r.w && it.z >= r.z && it.z <= r.z + r.d);
        if (room) {
          const fp = itemFootprint(it); const hf = (s2) => (room.walls[s2].visible ? room.walls[s2].thickness / 2 : 0);
          const bx0 = it.x - fp.w / 2; const bx1 = it.x + fp.w / 2; const bz0 = it.z - fp.d / 2; const bz1 = it.z + fp.d / 2;
          const wx0 = room.x + hf('w'); const wx1 = room.x + room.w - hf('e'); const wz0 = room.z + hf('n'); const wz1 = room.z + room.d - hf('s');
          [[bx0 - wx0, bx0, it.z, wx0, it.z], [wx1 - bx1, bx1, it.z, wx1, it.z], [bz0 - wz0, it.x, bz0, it.x, wz0], [wz1 - bz1, it.x, bz1, it.x, wz1]].forEach(([d, ax, az, bx, bz]) => {
            if (d > 1) { seg(gold, P(ax, az), P(bx, bz)); label(P((ax + bx) / 2, (az + bz) / 2, yy + 0.02), [formatLength(d, units)]); }
          });
        }
      }
    }

    if (sel && (sel.kind === 'wall' || sel.kind === 'opening')) {
      const room = config.rooms.find((r) => r.id === sel.id);
      if (room && room.level === L) {
        const len = sideLength(room, sel.side); const H = cutHeight(config.levels[L].height); const W = room.walls[sel.side];
        if (sel.kind === 'wall') {
          const c = [[0, 0], [len, 0], [len, H], [0, H]].map(([u, y]) => wallPoint(room, sel.side, u, y, base));
          for (let k = 0; k < 4; k += 1) seg(gold, c[k], c[(k + 1) % 4]);
          label(wallPoint(room, sel.side, len / 2, H, base).setY(base + H * CM + 0.2), [`${SIDE_NAMES[sel.side]} wall · ${room.name}`, `${formatLength(len, units)} × ${formatLength(W.thickness, units)} thick`], 'dim-label');
        } else {
          const o = W.openings.find((x) => x.id === sel.openingId);
          if (o) {
            const a = o.center - o.width / 2; const b = o.center + o.width / 2; const y1 = Math.min(o.sill + o.height, H);
            const c = [[a, o.sill], [b, o.sill], [b, y1], [a, y1]].map(([u, y]) => wallPoint(room, sel.side, u, y, base));
            for (let k = 0; k < 4; k += 1) seg(gold, c[k], c[(k + 1) % 4]);
            const name = OPENING_TYPES.find((x) => x.id === o.type)?.name ?? o.type;
            label(wallPoint(room, sel.side, o.center, y1, base).setY(base + y1 * CM + 0.2), [name, `${formatLength(o.width, units)} × ${formatLength(o.height, units)}`, `sill ${formatLength(o.sill, units)}`], 'dim-label');
            const yMid = o.sill + o.height / 2;
            seg(gold, wallPoint(room, sel.side, 0, yMid, base), wallPoint(room, sel.side, a, yMid, base));
            seg(gold, wallPoint(room, sel.side, b, yMid, base), wallPoint(room, sel.side, len, yMid, base));
            if (a > 1) label(wallPoint(room, sel.side, a / 2, yMid, base), [formatLength(a, units)]);
            if (len - b > 1) label(wallPoint(room, sel.side, (b + len) / 2, yMid, base), [formatLength(len - b, units)]);
          }
        }
      }
    }

    config.walls.filter((w) => w.level === L).forEach((w) => {
      const len = wallLength(w); const ux = (w.x2 - w.x1) / len; const uz = (w.z2 - w.z1) / len;
      const isSel = (sel?.kind === 'fwall' || sel?.kind === 'fopening') && sel.id === w.id;
      const H = cutHeight(w.height ?? config.levels[L].height);
      if (ui.showDimensions || isSel) label(P((w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2, yy + 0.04), [formatLength(len, units)]);
      if (!isSel) return;
      const nx = (-uz * w.thickness) / 2; const nz = (ux * w.thickness) / 2;
      const c = [P(w.x1 + nx, w.z1 + nz), P(w.x2 + nx, w.z2 + nz), P(w.x2 - nx, w.z2 - nz), P(w.x1 - nx, w.z1 - nz)];
      const top = c.map((v) => v.clone().setY(base + H * CM));
      for (let k = 0; k < 4; k += 1) { seg(gold, c[k], c[(k + 1) % 4]); seg(gold, top[k], top[(k + 1) % 4]); seg(gold, c[k], top[k]); }
      [[1, w.x1, w.z1], [2, w.x2, w.z2]].forEach(([end, hx, hz]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: '#E0B15A', depthTest: false, transparent: true }));
        m.position.copy(P(hx, hz, yy + 0.1)); m.renderOrder = 21; m.userData = { kind: 'whandle', wallId: w.id, end }; overlay.add(m); handles.push(m);
      });
      const at = (u, y) => new THREE.Vector3((w.x1 + ux * u) * CM, base + y * CM, (w.z1 + uz * u) * CM);
      if (sel.kind === 'fwall') label(at(len / 2, H).setY(base + H * CM + 0.2), [`Wall · ${formatLength(len, units)} × ${formatLength(w.thickness, units)} thick`, w.height ? `height ${formatLength(w.height, units)}` : 'full height'], 'dim-label');
      else {
        const o = w.openings.find((x) => x.id === sel.openingId);
        if (o) {
          const a = o.center - o.width / 2; const b = o.center + o.width / 2; const y1 = Math.min(o.sill + o.height, H);
          const q = [at(a, o.sill), at(b, o.sill), at(b, y1), at(a, y1)];
          for (let k = 0; k < 4; k += 1) seg(gold, q[k], q[(k + 1) % 4]);
          const name = OPENING_TYPES.find((x) => x.id === o.type)?.name ?? o.type;
          label(at(o.center, y1).setY(base + y1 * CM + 0.2), [name, `${formatLength(o.width, units)} × ${formatLength(o.height, units)}`, `sill ${formatLength(o.sill, units)}`], 'dim-label');
        }
      }
    });

    if (sel?.kind === 'slab') {
      const sl = config.slabs.find((t) => t.id === sel.id);
      if (sl && sl.level === L) {
        const ty = base + getSlabKind(sl.kind).top * CM + 0.03;
        const c = [P(sl.x, sl.z, ty), P(sl.x + sl.w, sl.z, ty), P(sl.x + sl.w, sl.z + sl.d, ty), P(sl.x, sl.z + sl.d, ty)];
        for (let k = 0; k < 4; k += 1) seg(gold, c[k], c[(k + 1) % 4]);
        label(P(sl.x + sl.w / 2, sl.z + sl.d / 2, ty + 0.1), [sl.name, `${formatLength(sl.w, units)} × ${formatLength(sl.d, units)}`, formatArea(sl.w * sl.d)], 'dim-label dim-label--room');
        [['n', sl.x + sl.w / 2, sl.z], ['s', sl.x + sl.w / 2, sl.z + sl.d], ['w', sl.x, sl.z + sl.d / 2], ['e', sl.x + sl.w, sl.z + sl.d / 2]].forEach(([edge, hx, hz]) => {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: '#E0B15A', depthTest: false, transparent: true }));
          m.position.copy(P(hx, hz, ty + 0.1)); m.renderOrder = 21; m.userData = { kind: 'shandle', slabId: sl.id, edge }; overlay.add(m); handles.push(m);
        });
      }
    }

    const mk = (arr, color) => {
      if (!arr.length) return;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 })); l.renderOrder = 20; overlay.add(l);
    };
    mk(dark, '#171816'); mk(gold, '#E0B15A');

    while (labelPool.length < labelDefs.length) { const d = document.createElement('div'); labelLayer.appendChild(d); labelPool.push(d); }
    labelPool.forEach((d, i) => {
      const def = labelDefs[i];
      if (!def) { d.style.display = 'none'; return; }
      d.className = def.cls;
      d.replaceChildren(...def.lines.flatMap((text, k) => { if (def.cls.includes('--room') && k === 0) { const b = document.createElement('b'); b.textContent = text; return [b]; } return [document.createTextNode(text), document.createElement('br')]; }).slice(0, -0 || undefined));
    });
  }

  function updateLabels() {
    if (!host) return;
    const w = host.clientWidth; const h = host.clientHeight;
    if (previewLabel) {
      if (previewPos) {
        tmp.copy(previewPos).project(camera);
        if (tmp.z > 1 || tmp.z < -1) previewLabel.style.display = 'none';
        else { previewLabel.style.display = ''; previewLabel.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`; }
      } else previewLabel.style.display = 'none';
    }
    labelDefs.forEach((def, i) => {
      const d = labelPool[i]; if (!d) return;
      tmp.copy(def.pos).project(camera);
      if (tmp.z > 1 || tmp.z < -1) { d.style.display = 'none'; return; }
      d.style.display = '';
      d.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    });
  }

  /* ---------- camera ---------- */
  function currentRoom() {
    const sel = ui.selection;
    return (sel && sel.kind !== 'item' && config.rooms.find((r) => r.id === sel.id)) || config.rooms.find((r) => r.level === ui.level) || config.rooms[0];
  }
  function viewFor(name) {
    const b = bounds; const span = Math.max(b.spanX, b.spanZ, 5); const h = b.height;
    if (name === 'front') return { pos: new THREE.Vector3(b.cx, h * 0.5 + 0.5, b.maxZ + span * 1.7), target: new THREE.Vector3(b.cx, h * 0.45, b.cz), fov: 36 };
    if (name === 'top') return { pos: new THREE.Vector3(b.cx, span * 1.5 + h, b.cz + 0.01), target: new THREE.Vector3(b.cx, elevOf(ui.level), b.cz), fov: 35 };
    if (name === 'interior') {
      const r = currentRoom(); const e = elevOf(r ? r.level : 0);
      if (!r) return viewFor('perspective');
      return { pos: new THREE.Vector3((r.x + r.w * 0.88) * CM, e + 1.55, (r.z + r.d * 0.92) * CM), target: new THREE.Vector3((r.x + r.w / 2) * CM, e + 1.0, (r.z + r.d / 2) * CM), fov: 72 };
    }
    return { pos: new THREE.Vector3(b.cx + span * 0.8, h + span * 0.55, b.cz + span * 1.05), target: new THREE.Vector3(b.cx, h * 0.3, b.cz), fov: 40 };
  }
  function setView(name, { instant = false } = {}) {
    if (!initialized) return;
    const v = viewFor(name); const aspect = camera.aspect || 1.6;
    if (name !== 'interior' && aspect < 1.3) v.pos.sub(v.target).multiplyScalar(Math.min(2.4, 1.3 / aspect)).add(v.target);
    if (instant || reduced()) {
      viewTween = null; camera.position.copy(v.pos); controls.target.copy(v.target); camera.fov = v.fov; camera.updateProjectionMatrix(); controls.update(); requestRender(); return;
    }
    viewTween = { t: 0, duration: 0.9, fromPos: camera.position.clone(), toPos: v.pos, fromTarget: controls.target.clone(), toTarget: v.target, fromFov: camera.fov, toFov: v.fov };
  }
  function updateTween(delta) {
    if (!viewTween) return;
    viewTween.t = Math.min(1, viewTween.t + delta / viewTween.duration);
    const e = viewTween.t < 0.5 ? 4 * viewTween.t ** 3 : 1 - ((-2 * viewTween.t + 2) ** 3) / 2;
    camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, e); controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, e);
    camera.fov = viewTween.fromFov + (viewTween.toFov - viewTween.fromFov) * e; camera.updateProjectionMatrix();
    if (viewTween.t >= 1) viewTween = null;
    requestRender();
  }
  function applyViewMode() {
    const plan = ui.viewMode === 'plan';
    controls.enableRotate = !plan; controls.screenSpacePanning = plan;
    controls.mouseButtons.LEFT = plan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = plan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    if (ui.viewMode !== prevViewMode) { prevViewMode = ui.viewMode; setView(plan ? 'top' : 'perspective'); }
  }

  /* ---------- sync ---------- */
  function sync() {
    if (!initialized) return;
    config = getState(); ui = getUi(); bounds = computeBounds();
    if (ui.tool !== lastTool) { lastTool = ui.tool; drawState = null; clearPreview(); }
    if (canvas && !drag) canvas.style.cursor = TOOL_CURSOR[ui.tool] || '';
    reconcile(); updateRoof(); updateGrid(); updateLights(); applyViewMode(); rebuildOverlay(); requestRender();
  }

  /* ---------- interaction ---------- */
  const DRAW_TOOLS = ['draw-wall', 'draw-slab', 'place-opening', 'place-item', 'eraser'];
  const TOOL_CURSOR = { 'draw-wall': 'crosshair', 'draw-slab': 'crosshair', 'place-opening': 'crosshair', 'place-item': 'copy', eraser: 'not-allowed' };
  function setPointer(e) { const r = canvas.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1; }
  function classify(obj) {
    for (let n = obj; n; n = n.parent) { const u = n.userData; if (u.kind) return u; if (u.itemId) return { kind: 'item', itemId: u.itemId }; }
    return null;
  }
  function levelTargets() {
    const targets = [];
    const add = (map) => map.forEach((v) => { if (v.level === ui.level && levelGroups[v.level].visible) targets.push(v.group); });
    add(roomObjs); add(fwallObjs); add(slabObjs);
    itemObjs.forEach((v) => { if (v.item.level === ui.level && v.group.visible && levelGroups[v.item.level].visible) targets.push(v.group); });
    return targets;
  }
  function pick(e) {
    setPointer(e); raycaster.setFromCamera(pointer, camera);
    if (handles.length) { const h = raycaster.intersectObjects(handles, false); if (h.length) return { ...h[0].object.userData }; }
    for (const hit of raycaster.intersectObjects(levelTargets(), true)) { const info = classify(hit.object); if (info) return { ...info }; }
    return null;
  }
  function groundPoint(e) {
    setPointer(e); raycaster.setFromCamera(pointer, camera);
    const p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevOf(ui.level)), p) ? p : null;
  }
  const toSelection = (h) => {
    if (h.kind === 'floor') return { kind: 'room', id: h.roomId };
    if (h.kind === 'wall') return { kind: 'wall', id: h.roomId, side: h.side };
    if (h.kind === 'opening') return { kind: 'opening', id: h.roomId, side: h.side, openingId: h.openingId };
    if (h.kind === 'item') return { kind: 'item', id: h.itemId };
    if (h.kind === 'slab') return { kind: 'slab', id: h.slabId };
    if (h.kind === 'fwall') return { kind: 'fwall', id: h.wallId };
    if (h.kind === 'fopening') return { kind: 'fopening', id: h.wallId, openingId: h.openingId };
    return null;
  };

  /* ----- snapping and geometry helpers for tools ----- */
  function snapTargets(excludeWall) {
    const L = ui.level; const out = [];
    config.rooms.forEach((r) => { if (r.level === L) out.push([r.x, r.z], [r.x + r.w, r.z], [r.x, r.z + r.d], [r.x + r.w, r.z + r.d]); });
    config.walls.forEach((w) => { if (w.level === L && w.id !== excludeWall) out.push([w.x1, w.z1], [w.x2, w.z2]); });
    config.slabs.forEach((t) => { if (t.level === L) out.push([t.x, t.z], [t.x + t.w, t.z], [t.x, t.z + t.d], [t.x + t.w, t.z + t.d]); });
    if (drawState?.first) out.push([drawState.first.x, drawState.first.z]);
    return out;
  }
  function toolPoint(e, from = null, excludeWall = null) {
    const pt = groundPoint(e); if (!pt) return null;
    const x = pt.x / CM; const z = pt.z / CM;
    let best = null; let bd = 22;
    snapTargets(excludeWall).forEach(([tx, tz]) => { const d = Math.hypot(tx - x, tz - z); if (d < bd) { bd = d; best = [tx, tz]; } });
    if (best) return { x: best[0], z: best[1], snapped: true };
    let sx = snapv(x); let sz = snapv(z);
    if (from && ui.ortho) {
      const dx = Math.abs(x - from.x); const dz = Math.abs(z - from.z);
      if (dz < Math.max(12, dx * 0.15)) sz = from.z; else if (dx < Math.max(12, dz * 0.15)) sx = from.x;
    }
    return { x: sx, z: sz, snapped: false };
  }
  function wallGeom(ref) {
    if (ref.type === 'room') {
      const r = config.rooms.find((x) => x.id === ref.roomId); if (!r) return null;
      const horizontal = ref.side === 'n' || ref.side === 's';
      return { len: sideLength(r, ref.side), H: config.levels[r.level].height, level: r.level, pt: (u, y, base) => wallPoint(r, ref.side, u, y, base), along: (px, pz) => (horizontal ? px - r.x : pz - r.z) };
    }
    const w = config.walls.find((x) => x.id === ref.wallId); if (!w) return null;
    const len = wallLength(w); const ux = (w.x2 - w.x1) / len; const uz = (w.z2 - w.z1) / len;
    return { len, H: w.height ?? config.levels[w.level].height, level: w.level, pt: (u, y, base) => new THREE.Vector3((w.x1 + ux * u) * CM, base + y * CM, (w.z1 + uz * u) * CM), along: (px, pz) => (px - w.x1) * ux + (pz - w.z1) * uz };
  }
  function openingTarget(e) {
    setPointer(e); raycaster.setFromCamera(pointer, camera);
    const targets = []; roomObjs.forEach((v) => { if (v.level === ui.level) targets.push(v.group); }); fwallObjs.forEach((v) => { if (v.level === ui.level) targets.push(v.group); });
    for (const hit of raycaster.intersectObjects(targets, true)) {
      const u = classify(hit.object); if (!u) continue;
      let ref = null;
      if (u.kind === 'wall' || u.kind === 'opening') ref = { type: 'room', roomId: u.roomId, side: u.side };
      else if (u.kind === 'fwall' || u.kind === 'fopening') ref = { type: 'free', wallId: u.wallId };
      if (!ref) continue;
      const g = wallGeom(ref); if (!g) continue;
      const def = OPENING_TYPES.find((o) => o.id === ui.placeOpening) || OPENING_TYPES[0];
      const width = Math.min(def.width, g.len - 20);
      const along = g.along(hit.point.x / CM, hit.point.z / CM);
      const center = Math.min(g.len - width / 2 - 5, Math.max(width / 2 + 5, Math.round(along / 5) * 5));
      return { ref, g, def, width, center };
    }
    return null;
  }
  function wallSnap(px, pz, depth) {
    const L = ui.level;
    const r = config.rooms.find((x) => x.level === L && px >= x.x && px <= x.x + x.w && pz >= x.z && pz <= x.z + x.d);
    if (r) {
      const half = (side) => (r.walls[side].visible ? r.walls[side].thickness / 2 : 0);
      const dist = { n: pz - r.z, s: r.z + r.d - pz, w: px - r.x, e: r.x + r.w - px };
      const side = Object.keys(dist).sort((a, b) => dist[a] - dist[b])[0];
      if (dist[side] < 150) {
        if (side === 'n') return { x: snapv(px), z: r.z + half('n') + depth / 2, rot: 0 };
        if (side === 's') return { x: snapv(px), z: r.z + r.d - half('s') - depth / 2, rot: 180 };
        if (side === 'w') return { x: r.x + half('w') + depth / 2, z: snapv(pz), rot: 90 };
        return { x: r.x + r.w - half('e') - depth / 2, z: snapv(pz), rot: 270 };
      }
    }
    let best = null; let bd = 70;
    config.walls.forEach((w) => {
      if (w.level !== L) return;
      const len = wallLength(w); const ux = (w.x2 - w.x1) / len; const uz = (w.z2 - w.z1) / len;
      const u = Math.min(len, Math.max(0, (px - w.x1) * ux + (pz - w.z1) * uz)); const cx = w.x1 + ux * u; const cz = w.z1 + uz * u;
      const d = Math.hypot(px - cx, pz - cz);
      if (d < bd) { bd = d; const side = (px - cx) * -uz + (pz - cz) * ux >= 0 ? 1 : -1; best = { cx, cz, nx: -uz * side, nz: ux * side, t: w.thickness }; }
    });
    if (!best) return null;
    const off = best.t / 2 + depth / 2;
    return { x: Math.round((best.cx + best.nx * off) * 10) / 10, z: Math.round((best.cz + best.nz * off) * 10) / 10, rot: Math.round((((Math.atan2(best.nx, best.nz) * 180) / Math.PI) + 360) % 360) };
  }
  function itemTarget(e) {
    const pt = groundPoint(e); const def = ui.placeItem ? getItemDef(ui.placeItem) : null; if (!pt || !def) return null;
    const px = pt.x / CM; const pz = pt.z / CM;
    if (def.mount === 'wall') { const s = wallSnap(px, pz, def.size.d); if (s) return s; }
    let x = snapv(px); let z = snapv(pz);
    const room = config.rooms.find((r) => r.level === ui.level && x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d);
    if (room) { const c = clampItemToRoom({ type: def.id, rot: 0, size: null, x, z }, room); x = c.x; z = c.z; }
    return { x, z, rot: 0 };
  }

  /* ----- live preview while a tool is active ----- */
  function clearPreview() {
    if (!preview) return;
    preview.traverse((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); }); preview.clear(); previewPos = null;
    if (previewLabel) previewLabel.style.display = 'none';
    requestRender();
  }
  function updatePreview(e) {
    if (!preview) return;
    preview.traverse((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); }); preview.clear(); previewPos = null;
    const L = ui.level; const base = elevOf(L); const units = ui.units; const tool = ui.tool;
    const lines = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#E0B15A', depthTest: false, transparent: true })); l.renderOrder = 22; preview.add(l); };
    const ghost = (geo, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#E0B15A', transparent: true, opacity: 0.35, depthWrite: false })); m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 22; preview.add(m); };
    const dot = (x, z, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true })); m.position.set(x * CM, base + 0.06, z * CM); m.renderOrder = 23; preview.add(m); };
    const seg = (a, b) => [a.x, a.y, a.z, b.x, b.y, b.z];
    if (tool === 'draw-wall') {
      const from = drawState?.start || null; const p = toolPoint(e, from); if (!p) return;
      dot(p.x, p.z, p.snapped ? '#7FD18B' : '#E0B15A');
      if (from) {
        const len = Math.hypot(p.x - from.x, p.z - from.z);
        if (len > 1) {
          const ps = ui.wallPreset; const H = ps.height ?? config.levels[L].height; const hh = cutHeight(H) * CM;
          ghost(new THREE.BoxGeometry(len * CM, hh, ps.thickness * CM), ((from.x + p.x) / 2) * CM, base + hh / 2, ((from.z + p.z) / 2) * CM, -Math.atan2(p.z - from.z, p.x - from.x));
          previewPos = new THREE.Vector3(((from.x + p.x) / 2) * CM, base + hh + 0.25, ((from.z + p.z) / 2) * CM);
          previewLabel.textContent = formatLength(len, units);
        }
      }
    } else if (tool === 'draw-slab') {
      const from = drawState?.start || null; const p = toolPoint(e); if (!p) return;
      dot(p.x, p.z, p.snapped ? '#7FD18B' : '#E0B15A');
      if (from) {
        const w = Math.abs(p.x - from.x); const d = Math.abs(p.z - from.z);
        if (w > 1 && d > 1) {
          ghost(new THREE.BoxGeometry(w * CM, 0.04, d * CM), ((from.x + p.x) / 2) * CM, base + 0.05, ((from.z + p.z) / 2) * CM);
          previewPos = new THREE.Vector3(((from.x + p.x) / 2) * CM, base + 0.3, ((from.z + p.z) / 2) * CM);
          previewLabel.textContent = `${formatLength(w, units)} × ${formatLength(d, units)} · ${formatArea(w * d)}`;
        }
      }
    } else if (tool === 'place-opening') {
      const t = openingTarget(e); if (!t) return;
      const a = t.center - t.width / 2; const b = t.center + t.width / 2; const y1 = Math.min(t.def.sill + t.def.height, cutHeight(t.g.H));
      const q = [t.g.pt(a, t.def.sill, base), t.g.pt(b, t.def.sill, base), t.g.pt(b, y1, base), t.g.pt(a, y1, base)];
      const pts = []; for (let k = 0; k < 4; k += 1) pts.push(...seg(q[k], q[(k + 1) % 4])); lines(pts);
      previewPos = t.g.pt(t.center, y1, base).setY(base + y1 * CM + 0.2); previewLabel.textContent = `${t.def.name} · ${formatLength(t.width, units)}`;
    } else if (tool === 'place-item') {
      const t = itemTarget(e); if (!t) return;
      const def = getItemDef(ui.placeItem); const th = (t.rot * Math.PI) / 180; const c = Math.cos(th); const s2 = Math.sin(th);
      const corner = (lx, lz) => new THREE.Vector3((t.x + lx * c + lz * s2) * CM, base + 0.05, (t.z - lx * s2 + lz * c) * CM);
      const cs = [corner(-def.size.w / 2, -def.size.d / 2), corner(def.size.w / 2, -def.size.d / 2), corner(def.size.w / 2, def.size.d / 2), corner(-def.size.w / 2, def.size.d / 2)];
      const pts = []; for (let k = 0; k < 4; k += 1) pts.push(...seg(cs[k], cs[(k + 1) % 4])); lines(pts);
      previewPos = new THREE.Vector3(t.x * CM, base + 0.4, t.z * CM); previewLabel.textContent = getItemName(def.id);
    }
    requestRender();
  }

  /* ----- click handling for tools ----- */
  function eraseAt(e) {
    const h = pick(e); if (!h) return;
    if (h.kind === 'item') actions.deleteItem(h.itemId);
    else if (h.kind === 'opening') actions.deleteOpening(h.roomId, h.side, h.openingId);
    else if (h.kind === 'fopening') actions.deleteFreeOpening(h.wallId, h.openingId);
    else if (h.kind === 'fwall') actions.deleteFreeWall(h.wallId);
    else if (h.kind === 'slab') actions.deleteSlab(h.slabId);
  }
  function handleToolClick(e) {
    const L = ui.level; const tool = ui.tool;
    if (tool === 'draw-wall') {
      const p = toolPoint(e, drawState?.start || null); if (!p) return;
      if (!drawState) drawState = { start: null, first: null };
      if (!drawState.start) { drawState.start = { x: p.x, z: p.z }; drawState.first = { x: p.x, z: p.z }; updatePreview(e); return; }
      const st = drawState.start;
      if (Math.hypot(p.x - st.x, p.z - st.z) < 15) { drawState = null; clearPreview(); return; }
      const id = actions.addFreeWall(L, st.x, st.z, p.x, p.z, ui.wallPreset);
      const closed = drawState.first && Math.hypot(p.x - drawState.first.x, p.z - drawState.first.z) < 1;
      if (closed || !id) { drawState = null; clearPreview(); } else drawState.start = { x: p.x, z: p.z };
      if (id) select({ kind: 'fwall', id });
    } else if (tool === 'draw-slab') {
      const p = toolPoint(e); if (!p) return;
      if (!drawState?.start) { drawState = { start: { x: p.x, z: p.z }, first: null }; updatePreview(e); return; }
      const st = drawState.start; const w = Math.abs(p.x - st.x); const d = Math.abs(p.z - st.z);
      if (w < 20 || d < 20) return;
      const id = actions.addSlab(L, ui.slabKind, Math.min(st.x, p.x), Math.min(st.z, p.z), w, d, { material: ui.slabMaterial || undefined });
      drawState = null; clearPreview();
      if (id) select({ kind: 'slab', id });
    } else if (tool === 'place-opening') {
      const t = openingTarget(e); if (!t) return;
      if (t.ref.type === 'room') { const id = actions.addOpeningAt(t.ref.roomId, t.ref.side, ui.placeOpening, t.center); if (id) select({ kind: 'opening', id: t.ref.roomId, side: t.ref.side, openingId: id }); }
      else { const id = actions.addFreeOpening(t.ref.wallId, ui.placeOpening, t.center); if (id) select({ kind: 'fopening', id: t.ref.wallId, openingId: id }); }
    } else if (tool === 'place-item') {
      const t = itemTarget(e); if (!t || !ui.placeItem) return;
      const id = actions.placeItem(ui.placeItem, L, t.x, t.z, t.rot);
      if (id) { clearPreview(); if (e.shiftKey) select({ kind: 'item', id }); else setUi({ selection: { kind: 'item', id }, tool: 'move', placeItem: null }, 'select'); }
    } else if (tool === 'eraser') eraseAt(e);
  }
  function handleEscape() {
    if (drawState) { drawState = null; clearPreview(); return true; }
    return false;
  }

  /* ----- pointer events ----- */
  function startDrag(e, d) { drag = d; e.stopImmediatePropagation(); controls.enabled = false; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } canvas.style.cursor = 'grabbing'; }
  function onPointerDown(e) {
    if (e.button !== 0) return;
    config = getState(); ui = getUi();
    if (DRAW_TOOLS.includes(ui.tool)) { downInfo = { x: e.clientX, y: e.clientY, hit: true, tool: true }; return; }
    const hit = pick(e); downInfo = { x: e.clientX, y: e.clientY, hit: !!hit };
    if (!hit) return;
    const sel = ui.selection;
    const wasSelected = !!sel && ((hit.kind === 'floor' && sel.kind === 'room' && sel.id === hit.roomId) || (hit.kind === 'slab' && sel.kind === 'slab' && sel.id === hit.slabId) || (hit.kind === 'fwall' && sel.kind === 'fwall' && sel.id === hit.wallId));
    if (!['handle', 'whandle', 'shandle'].includes(hit.kind)) select(toSelection(hit));
    const pt = groundPoint(e); if (!pt || ui.tool !== 'move') return;
    const px = pt.x / CM; const pz = pt.z / CM;
    if (hit.kind === 'handle') {
      const r = config.rooms.find((x) => x.id === hit.roomId);
      startDrag(e, { type: 'handle', id: hit.roomId, edge: hit.edge, start: { x: r.x, z: r.z, w: r.w, d: r.d } });
    } else if (hit.kind === 'shandle') {
      const t = config.slabs.find((x) => x.id === hit.slabId);
      if (t) startDrag(e, { type: 'shandle', id: t.id, edge: hit.edge, start: { x: t.x, z: t.z, w: t.w, d: t.d } });
    } else if (hit.kind === 'whandle') {
      startDrag(e, { type: 'whandle', id: hit.wallId, end: hit.end });
    } else if (hit.kind === 'item') {
      const it = config.items.find((x) => x.id === hit.itemId);
      startDrag(e, { type: 'item', id: it.id, ox: it.x - px, oz: it.z - pz, moved: false });
    } else if (hit.kind === 'opening') {
      const r = config.rooms.find((x) => x.id === hit.roomId); const o = r.walls[hit.side].openings.find((x) => x.id === hit.openingId);
      const along = hit.side === 'n' || hit.side === 's' ? px - r.x : pz - r.z;
      if (o) startDrag(e, { type: 'opening', roomId: r.id, side: hit.side, id: o.id, off: o.center - along });
    } else if (hit.kind === 'fopening') {
      const g = wallGeom({ type: 'free', wallId: hit.wallId }); const o = config.walls.find((x) => x.id === hit.wallId)?.openings.find((x) => x.id === hit.openingId);
      if (g && o) startDrag(e, { type: 'fopening', wallId: hit.wallId, id: o.id, off: o.center - g.along(px, pz) });
    } else if (hit.kind === 'floor' && wasSelected) {
      const r = config.rooms.find((x) => x.id === hit.roomId);
      startDrag(e, { type: 'room', id: r.id, ox: r.x - px, oz: r.z - pz });
    } else if (hit.kind === 'slab' && wasSelected) {
      const t = config.slabs.find((x) => x.id === hit.slabId);
      if (t) startDrag(e, { type: 'slab', id: t.id, ox: t.x - px, oz: t.z - pz });
    } else if (hit.kind === 'fwall' && wasSelected) {
      const w = config.walls.find((x) => x.id === hit.wallId);
      if (w) startDrag(e, { type: 'fwall', id: w.id, sx: px, sz: pz, orig: { x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2 } });
    }
  }

  function onPointerMove(e) {
    if (!drag) {
      config = getState(); ui = getUi();
      if (DRAW_TOOLS.includes(ui.tool)) {
        if (e.pointerType === 'mouse' && e.buttons === 0 && performance.now() - previewAt > 28) { previewAt = performance.now(); updatePreview(e); }
        return;
      }
      if (e.pointerType === 'mouse' && e.buttons === 0 && performance.now() - hoverAt > 70) {
        hoverAt = performance.now();
        const h = pick(e); canvas.style.cursor = h ? (['handle', 'whandle', 'shandle'].includes(h.kind) ? 'nwse-resize' : ui.tool === 'move' ? 'grab' : 'pointer') : '';
      }
      return;
    }
    const pt = groundPoint(e); if (!pt) return;
    config = getState(); ui = getUi();
    const px = pt.x / CM; const pz = pt.z / CM;
    if (drag.type === 'item') {
      const it = config.items.find((x) => x.id === drag.id); if (!it) return;
      const x = snapv(px + drag.ox); const z = snapv(pz + drag.oz);
      const room = config.rooms.find((r) => r.level === it.level && x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d);
      const next = room ? clampItemToRoom({ ...it, x, z }, room) : { x, z };
      actions.moveItem(drag.id, next.x, next.z);
    } else if (drag.type === 'room') {
      actions.moveRoom(drag.id, snapv(px + drag.ox), snapv(pz + drag.oz));
    } else if (drag.type === 'opening') {
      const r = config.rooms.find((x) => x.id === drag.roomId); const o = r?.walls[drag.side].openings.find((x) => x.id === drag.id); if (!o) return;
      const len = sideLength(r, drag.side); const along = drag.side === 'n' || drag.side === 's' ? px - r.x : pz - r.z;
      actions.setOpening(r.id, drag.side, o.id, { center: Math.round(Math.min(len - o.width / 2, Math.max(o.width / 2, snapv(along + drag.off)))) });
    } else if (drag.type === 'fopening') {
      const g = wallGeom({ type: 'free', wallId: drag.wallId }); const o = config.walls.find((x) => x.id === drag.wallId)?.openings.find((x) => x.id === drag.id); if (!g || !o) return;
      actions.setFreeOpening(drag.wallId, o.id, { center: Math.round(Math.min(g.len - o.width / 2, Math.max(o.width / 2, snapv(g.along(px, pz) + drag.off)))) });
    } else if (drag.type === 'handle') {
      const s = drag.start; let { x, z, w, d } = s;
      if (drag.edge === 'e') w = Math.max(150, snapv(px) - s.x);
      if (drag.edge === 's') d = Math.max(150, snapv(pz) - s.z);
      if (drag.edge === 'w') { const nx = Math.min(snapv(px), s.x + s.w - 150); w = s.x + s.w - nx; x = nx; }
      if (drag.edge === 'n') { const nz = Math.min(snapv(pz), s.z + s.d - 150); d = s.z + s.d - nz; z = nz; }
      actions.resizeRoom(drag.id, { x, z, w, d });
    } else if (drag.type === 'shandle') {
      const s = drag.start; let { x, z, w, d } = s; const MIN = 20;
      if (drag.edge === 'e') w = Math.max(MIN, snapv(px) - s.x);
      if (drag.edge === 's') d = Math.max(MIN, snapv(pz) - s.z);
      if (drag.edge === 'w') { const nx = Math.min(snapv(px), s.x + s.w - MIN); w = s.x + s.w - nx; x = nx; }
      if (drag.edge === 'n') { const nz = Math.min(snapv(pz), s.z + s.d - MIN); d = s.z + s.d - nz; z = nz; }
      actions.resizeSlab(drag.id, { x, z, w, d });
    } else if (drag.type === 'slab') {
      actions.moveSlab(drag.id, snapv(px + drag.ox), snapv(pz + drag.oz));
    } else if (drag.type === 'whandle') {
      const w = config.walls.find((x) => x.id === drag.id); if (!w) return;
      const other = drag.end === 1 ? { x: w.x2, z: w.z2 } : { x: w.x1, z: w.z1 };
      const p = toolPoint(e, other, w.id); if (!p || Math.hypot(p.x - other.x, p.z - other.z) < 20) return;
      actions.setFreeWallPoints(w.id, drag.end === 1 ? { x1: p.x, z1: p.z } : { x2: p.x, z2: p.z });
    } else if (drag.type === 'fwall') {
      const s = ui.snap || 10; const dx = Math.round((px - drag.sx) / s) * s; const dz = Math.round((pz - drag.sz) / s) * s;
      const o = drag.orig; actions.setFreeWallPoints(drag.id, { x1: o.x1 + dx, z1: o.z1 + dz, x2: o.x2 + dx, z2: o.z2 + dz });
    }
  }

  function onPointerUp(e) {
    if (drag) {
      drag = null; controls.enabled = true; canvas.style.cursor = '';
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    } else if (downInfo?.tool) {
      if (e.type === 'pointerup' && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 5) { config = getState(); ui = getUi(); handleToolClick(e); }
    } else if (downInfo && !downInfo.hit && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) < 5) {
      select(null);
    }
    downInfo = null;
  }

  /* ---------- lifecycle ---------- */
  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas = renderer.domElement; canvas.classList.add('studio-canvas'); canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive 3D house plan. Drag to orbit, scroll or pinch to zoom, click objects to select them.');
    scene = new THREE.Scene(); scene.background = new THREE.Color('#DDE7EC');
    camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);
    controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 1; controls.maxDistance = 80; controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.addEventListener('change', requestRender); controls.addEventListener('start', () => { viewTween = null; });
    hemi = new THREE.HemisphereLight('#ffffff', '#c8bfae', 1); ambient = new THREE.AmbientLight('#ffffff', 0.2); sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.castShadow = true; const ms = window.matchMedia('(pointer: coarse)').matches ? 2048 : 4096; sun.shadow.mapSize.set(ms, ms);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(hemi, ambient, sun, sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), getSolidMaterial('#CFC9BB', { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.215; ground.receiveShadow = true; scene.add(ground);
    root = new THREE.Group(); scene.add(root); overlay = new THREE.Group(); scene.add(overlay); preview = new THREE.Group(); scene.add(preview);
    labelLayer = document.createElement('div'); labelLayer.className = 'label-layer';
    previewLabel = document.createElement('div'); previewLabel.className = 'dim-label dim-label--tool'; previewLabel.style.display = 'none'; labelLayer.appendChild(previewLabel);
    canvas.addEventListener('pointerdown', onPointerDown, { capture: true }); canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', (e) => { if (drawState) { e.preventDefault(); handleEscape(); } });
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault()); canvas.addEventListener('webglcontextrestored', requestRender);
    initialized = true;
  }

  function onResize() {
    if (!host) return;
    const w = host.clientWidth; const h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (needsInitialView) { needsInitialView = false; setView(ui.viewMode === 'plan' ? 'top' : 'perspective', { instant: true }); }
    requestRender();
  }

  function frame(time) {
    rafId = requestAnimationFrame(frame);
    const delta = Math.min((time - lastTime) / 1000, 0.1); lastTime = time;
    updateTween(delta);
    const moved = controls.update();
    if (moved || needsRender) { renderer.render(scene, camera); updateLabels(); needsRender = false; }
  }

  function mount(container) {
    if (!initialized) init();
    host = container; container.append(canvas, labelLayer);
    resizeObserver?.disconnect(); resizeObserver = new ResizeObserver(onResize); resizeObserver.observe(container);
    prevViewMode = getUi().viewMode;
    unsubs = [subscribe(sync), subscribeUi(sync)];
    sync(); onResize();
    if (!rafId) { lastTime = performance.now(); rafId = requestAnimationFrame(frame); }
  }

  function unmount() {
    if (rafId) cancelAnimationFrame(rafId); rafId = 0;
    unsubs.forEach((fn) => fn()); unsubs = [];
    resizeObserver?.disconnect(); resizeObserver = null;
    if (drag) { drag = null; controls.enabled = true; }
    drawState = null; clearPreview();
    canvas?.remove(); labelLayer?.remove(); host = null;
  }

  return {
    mount, unmount, setView, requestRender, handleEscape,
    resetCamera: () => setView(getUi().viewMode === 'plan' ? 'top' : 'perspective'),
    /** Renders the current camera at `longEdge` px (viewport aspect kept, GPU limit respected) without editor overlays. Returns a PNG data URL or null. Real-time render, not ray-traced. */
    capturePng({ longEdge = 1920, background = null } = {}) {
      if (!initialized || !host) return null;
      const hw = host.clientWidth; const hh = host.clientHeight; if (!hw || !hh) return null;
      const cap = Math.min(renderer.capabilities.maxTextureSize || 4096, 8192); const k = Math.min(longEdge, cap) / Math.max(hw, hh);
      const w = Math.max(16, Math.round(hw * k)); const h = Math.max(16, Math.round(hh * k));
      const prevBg = scene.background; const prevPR = renderer.getPixelRatio();
      try {
        if (background) scene.background = new THREE.Color(background);
        overlay.visible = false; preview.visible = false;
        renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        return canvas.toDataURL('image/png');
      } catch (error) { console.error('[scene] capture failed:', error); return null; }
      finally {
        scene.background = prevBg; overlay.visible = true; preview.visible = true;
        renderer.setPixelRatio(prevPR); renderer.setSize(hw, hh, false); camera.aspect = hw / hh; camera.updateProjectionMatrix(); requestRender();
      }
    },
    captureThumbnail() {
      if (!initialized) return null;
      try { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.72); } catch (error) { return null; }
    }
  };
}