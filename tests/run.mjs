// Minimal dependency-free test runner:  node tests/run.mjs
import assert from 'node:assert/strict';
import * as G from '../js/plan2d/geometry.js';
import { normalizeConfig, createBlankConfig, createDefaultConfig, getState, mutate, undo, redo, resetState, getUi, setUi, setDesignName, isDirty, UNITS, SNAP_MODES } from '../js/state.js';
import * as A from '../js/actions.js';
import { formatLength } from '../js/catalog.js';

let pass = 0; const fails = [];
const test = (name, fn) => { try { fn(); pass += 1; console.log('  ok  ' + name); } catch (e) { fails.push(name); console.log('FAIL  ' + name + '\n      ' + e.message); } };

console.log('geometry');
test('dist / lerp / angle', () => { assert.equal(G.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5); assert.deepEqual(G.lerpPt({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5), { x: 5, y: 10 }); assert.equal(G.angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }), 90); });
test('segment intersection', () => { const p = G.segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }); assert.deepEqual(p, { x: 5, y: 5 }); assert.equal(G.segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), null); });
test('wall polygon area = length × thickness (+ extension)', () => { const poly = G.wallPolygon({ x: 0, y: 0 }, { x: 450, y: 0 }, 15, 0); assert.equal(G.polygonArea(poly), 450 * 15); assert.equal(G.polygonArea(G.wallPolygon({ x: 0, y: 0 }, { x: 450, y: 0 }, 15, 7.5)), 465 * 15); });
test('polygon area of a 4.5 m x 3 m room is 13.5 m²', () => assert.equal(G.polygonArea([{ x: 0, y: 0 }, { x: 450, y: 0 }, { x: 450, y: 300 }, { x: 0, y: 300 }]) / 10000, 13.5));
test('pointAtLength gives exact 4500 mm wall', () => { const p = G.pointAtLength({ x: 100, y: 100 }, { x: 999, y: 100 }, 450); assert.deepEqual(p, { x: 550, y: 100 }); });
test('orthoLock snaps to 45° steps', () => { const p = G.orthoLock({ x: 0, y: 0 }, { x: 100, y: 7 }); assert.equal(p.y, 0); assert.equal(Math.round(p.x), 100); });
test('point in rotated rect', () => { assert.ok(G.pointInRotRect({ x: 0, y: 40 }, 0, 0, 20, 100, 0)); assert.ok(!G.pointInRotRect({ x: 40, y: 0 }, 0, 0, 20, 100, 0)); assert.ok(G.pointInRotRect({ x: 40, y: 0 }, 0, 0, 20, 100, 90)); });
const segs = [{ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }, { a: { x: 400, y: 0 }, b: { x: 400, y: 300 } }];
test('snap: endpoint wins over grid', () => { const s = G.snapPoint({ x: 403, y: 4 }, { step: 50, tol: 10, segs }); assert.equal(s.kind, 'endpoint'); assert.deepEqual([s.x, s.y], [400, 0]); });
test('snap: midpoint', () => { const s = G.snapPoint({ x: 203, y: 2 }, { step: 0, tol: 10, segs }); assert.equal(s.kind, 'midpoint'); assert.equal(s.x, 200); });
test('snap: perpendicular from a start point', () => { const s = G.snapPoint({ x: 120, y: 3 }, { step: 0, tol: 10, segs: [segs[0]], from: { x: 120, y: 200 }, modes: { midpoint: false, align: false } }); assert.equal(s.kind, 'perpendicular'); assert.equal(s.x, 120); assert.equal(s.y, 0); });
test('snap: grid when nothing else is near', () => { const s = G.snapPoint({ x: 233, y: 187 }, { step: 25, tol: 5, segs: [], modes: { align: false } }); assert.deepEqual([s.kind, s.x, s.y], ['grid', 225, 175]); });
test('snap: modes can be disabled', () => { const s = G.snapPoint({ x: 403, y: 4 }, { step: 0, tol: 10, segs, modes: { endpoint: false, intersection: false, align: false, nearest: false, grid: false } }); assert.equal(s.kind, 'free'); });
test('snap: ortho lock when drawing', () => { const s = G.snapPoint({ x: 300, y: 9 }, { step: 0, tol: 2, segs: [], from: { x: 0, y: 0 }, modes: { ortho: true, grid: false, align: false } }); assert.equal(s.y, 0); });
test('pickSegment returns closest wall within tolerance', () => { const hit = G.pickSegment({ x: 200, y: 8 }, segs.map((s) => ({ ...s, thickness: 15 })), 5); assert.ok(hit); assert.equal(Math.round(hit.t * 100), 50); assert.equal(G.pickSegment({ x: 200, y: 80 }, segs, 5), null); });
test('length format/parse across units', () => { assert.equal(G.fmtLen(450, 'mm'), '4500 mm'); assert.equal(G.fmtLen(450, 'm'), '4.50 m'); assert.equal(G.parseLen('4500', 'mm'), 450); assert.equal(G.parseLen('4,5', 'm'), 450); assert.equal(G.parseLen('abc', 'cm'), null); assert.equal(G.parseLen('-3', 'cm'), null); assert.equal(formatLength(300, 'mm'), '3000 mm'); });

console.log('shared model (state + actions)');
test('legacy default design normalizes and keeps rooms', () => { const c = normalizeConfig(createDefaultConfig()); assert.equal(c.rooms.length, 6); assert.equal(c.levels.length, 2); });
test('corrupted data is rejected or sanitized', () => { assert.throws(() => normalizeConfig(null)); assert.throws(() => normalizeConfig({ foo: 1 })); const c = normalizeConfig({ rooms: [{ type: 'nope', w: 'x', level: 9 }], items: [{ type: 'ghost' }], levels: [{ height: 'abc' }], walls: [{ x1: 'a' }] }); assert.equal(c.items.length, 0); assert.equal(c.walls.length, 0); assert.equal(c.rooms.length, 0); });
test('addFreeWall creates exactly one wall with exact length', () => { resetState('blank'); const id = A.addFreeWall(0, 0, 0, 450, 0, {}); const w = getState().walls.find((x) => x.id === id); assert.ok(w); assert.equal(Math.hypot(w.x2 - w.x1, w.z2 - w.z1), 450); assert.equal(getState().walls.length, 1); });
test('setFreeWallLength resizes to the exact value', () => { resetState('blank'); const id = A.addFreeWall(0, 0, 0, 300, 0, {}); A.setFreeWallLength(id, 450); const w = getState().walls[0]; assert.equal(w.x2 - w.x1, 450); });
test('undo / redo restore the wall', () => { resetState('blank'); A.addFreeWall(0, 0, 0, 300, 0, {}); assert.equal(getState().walls.length, 1); undo(); assert.equal(getState().walls.length, 0); redo(); assert.equal(getState().walls.length, 1); });
test('opening is stored on the wall and clamped inside it', () => { resetState('blank'); const id = A.addFreeWall(0, 0, 0, 300, 0, {}); const oid = A.addFreeOpening(id, 'window', 150); const o = getState().walls[0].openings.find((x) => x.id === oid); assert.ok(o); assert.ok(o.center - o.width / 2 >= 0 && o.center + o.width / 2 <= 300); });
test('delete wall removes it and its openings', () => { resetState('blank'); const id = A.addFreeWall(0, 0, 0, 300, 0, {}); A.addFreeOpening(id, 'door', 100); A.deleteFreeWall(id); assert.equal(getState().walls.length, 0); });
test('item placement and move update shared state', () => { resetState('blank'); const id = A.placeItem('sofa-3', 0, 200, 200); A.moveItem(id, 300, 250); const it = getState().items.find((i) => i.id === id); assert.deepEqual([it.x, it.z], [300, 250]); });
test('export → normalize round trip is lossless for geometry', () => { resetState('blank'); const id = A.addFreeWall(0, 0, 0, 450, 0, { thickness: 20 }); A.addFreeOpening(id, 'door', 100); const json = JSON.stringify(getState()); const back = normalizeConfig(JSON.parse(json)); assert.deepEqual(back.walls, getState().walls); });


console.log('room detection');
import { detectRooms } from '../js/plan2d/rooms.js';
import { TOOL_GROUPS } from '../js/workspace/tools.js';
import { getItemDef } from '../js/catalog.js';
const W = (id, x1, z1, x2, z2, thickness = 15) => ({ id, x1, z1, x2, z2, thickness });
const rect = (x, z, w, d, t = 15, p = 'a') => [W(`${p}1`, x, z, x + w, z, t), W(`${p}2`, x + w, z, x + w, z + d, t), W(`${p}3`, x + w, z + d, x, z + d, t), W(`${p}4`, x, z + d, x, z, t)];
test('closed 4500 × 3000 mm loop is one room with the true clear area', () => {
  const r = detectRooms(rect(0, 0, 450, 300, 15)); assert.equal(r.length, 1);
  assert.equal(r[0].w, 435); assert.equal(r[0].d, 285); assert.ok(r[0].isRect); assert.equal(Math.round(r[0].area), 435 * 285);
});
test('open wall chain (gap) is not a room', () => { const w = rect(0, 0, 450, 300); w.pop(); assert.equal(detectRooms(w).length, 0); });
test('partition wall (T-junctions) splits one box into two rooms, no duplicates', () => {
  const r = detectRooms([...rect(0, 0, 600, 300), W('mid', 300, 0, 300, 300)]); assert.equal(r.length, 2);
  assert.equal(Math.round(r[0].area), Math.round(r[1].area)); assert.equal(Math.round(r[0].area), 285 * 285);
});
test('partition drawn through the box (crossing walls) still gives two rooms', () => { assert.equal(detectRooms([...rect(0, 0, 600, 300), W('mid', 300, -50, 300, 350)]).length, 2); });
test('dead-end spur does not create a room or change area', () => { const r = detectRooms([...rect(0, 0, 450, 300), W('spur', 200, 0, 200, 120)]); assert.equal(r.length, 1); assert.equal(Math.round(r[0].area), 435 * 285); });
test('L-shaped room: area of the inset polygon', () => {
  const pts = [[0, 0], [400, 0], [400, 200], [200, 200], [200, 400], [0, 400]]; const w = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return W(`l${i}`, p[0], p[1], q[0], q[1], 20); });
  const r = detectRooms(w); assert.equal(r.length, 1); assert.ok(!r[0].isRect);
  assert.equal(Math.round(r[0].area), 104400); // inset 10 cm: 380·180 + 180·200
});
test('two separate rooms side by side sharing one wall are detected once each', () => { assert.equal(detectRooms([...rect(0, 0, 300, 300, 15, 'a'), W('b2', 600, 0, 600, 300), W('b1', 300, 0, 600, 0), W('b3', 600, 300, 300, 300)]).length, 2); });
console.log('workspace tools');
test('every tool button maps to real editor behaviour', () => {
  TOOL_GROUPS.flatMap((g) => g.tools).forEach((t) => { assert.ok(t.patch || t.toggle || t.section || t.library, t.id); if (t.patch && t.patch.placeItem) assert.ok(getItemDef(t.patch.placeItem), `${t.id} → ${t.patch.placeItem}`); });
});

console.log('workspace UI state');
test('units: mm / cm / m / ft are accepted, unknown units fall back to metres', () => { UNITS.forEach(([id]) => { setUi({ units: id }); assert.equal(getUi().units, id); }); setUi({ units: 'furlong' }); assert.equal(getUi().units, 'm'); });
test('formatLength is exact in every unit (300 cm = 3000 mm = 3.00 m)', () => { assert.equal(formatLength(300, 'mm'), '3000 mm'); assert.equal(formatLength(300, 'cm'), '300 cm'); assert.equal(formatLength(300, 'm'), '3.00 m'); assert.equal(formatLength(30.48, 'ft'), '1′ 0″'); assert.equal(formatLength(450, 'mm'), '4500 mm'); });
test('snap modes default to on and can be toggled individually; junk is ignored', () => { assert.ok(SNAP_MODES.every(([id]) => getUi().snapModes[id] === true)); setUi({ snapModes: { ...getUi().snapModes, midpoint: false, bogus: true } }); assert.equal(getUi().snapModes.midpoint, false); assert.equal(getUi().snapModes.endpoint, true); assert.ok(!('bogus' in getUi().snapModes)); setUi({ snapModes: { ...getUi().snapModes, midpoint: true } }); });
test('view mode: 2d / 3d, legacy "plan" maps to 2d, junk falls back to 2d', () => { setUi({ viewMode: '3d' }); assert.equal(getUi().viewMode, '3d'); setUi({ viewMode: 'plan' }); assert.equal(getUi().viewMode, '2d'); setUi({ viewMode: 'xyz' }); assert.equal(getUi().viewMode, '2d'); });
test('pan tool is a valid tool', () => { setUi({ tool: 'pan' }); assert.equal(getUi().tool, 'pan'); setUi({ tool: 'move' }); });
test('renaming a design never marks it as changed and rejects empty names', () => { resetState('blank'); assert.ok(!isDirty()); assert.ok(setDesignName('Villa 1')); assert.equal(getState().name, 'Villa 1'); assert.ok(!isDirty()); assert.equal(setDesignName('   '), false); assert.equal(getState().name, 'Villa 1'); });
test('hostile import is sanitised: bad ids dropped, unknown style/colour replaced, no markup kept outside the name', () => {
  const c = normalizeConfig({ version: 3, name: 'x', style: '<script>alert(1)</script>', walls: [{ id: '"><svg onload=alert(1)>', x1: 0, z1: 0, x2: 300, z2: 0, level: 0, color: 'url(javascript:alert(1))' }] });
  assert.equal(c.style, 'modern-minimalist'); assert.ok(!/<script|javascript:|onload=/.test(JSON.stringify({ ...c, name: '' })));
});

console.log(`\n${pass} passed, ${fails.length} failed`); if (fails.length) process.exit(1);
