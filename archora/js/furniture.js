// js/furniture.js — procedural furniture. Units: meters. Origin = center of the footprint on the floor, front faces +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getItemDef, getItemSize } from './catalog.js';
import { getSurfaceMaterial, getSolidMaterial } from './materials.js';

const DARK = '#2B2B29'; const WHITE = '#F2F0EA';
function mesh(geo, mat, x, y, z, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m; }
// Box with bottom at y.
function B(g, w, h, d, mat, x = 0, y = 0, z = 0, r = 0) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const geo = rr > 0.003 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
  const m = mesh(geo, mat, x, y + h / 2, z); g.add(m); return m;
}
function Cy(g, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z); g.add(m); return m; }
function Sp(g, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) { const m = mesh(new THREE.SphereGeometry(r, 14, 10), mat, x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; }
function Gl(g, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), getSolidMaterial('#BFD8E6', { roughness: 0.05, transparent: true, opacity: 0.28 }));
  m.position.set(x, y + h / 2, z); g.add(m); return m;
}
const legs = (g, w, d, h, mat, inset = 0.08, r = 0.022) => [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => Cy(g, r, r * 0.75, h, mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 10)));
const solid = (color, o) => getSolidMaterial(color, o);

// Cylinder between two points (meters).
function Rod(g, a, b, r, mat, seg = 8) {
  const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b); const dir = vb.clone().sub(va); const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
// Wheel with its axis along x, center at (x, r, z).
function Wheel(g, x, z, r, wd, tire, rim) {
  const t = mesh(new THREE.CylinderGeometry(r, r, wd, 22), tire, x, r, z); t.rotation.z = Math.PI / 2; g.add(t);
  const h = mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, wd + 0.006, 14), rim, x, r, z); h.rotation.z = Math.PI / 2; g.add(h);
}
const rnd = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

const artCache = new Map();
function artTexture(n) {
  if (artCache.has(n)) return artCache.get(n);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d'); const pal = [['#E8DCC8', '#B9674A', '#2E2F2C', '#A5B39B'], ['#F3F0E8', '#7A8FA6', '#D6C3A5', '#8A5E3B'], ['#2E2F2C', '#E0B15A', '#F3F0E8', '#B9674A']][(n - 1) % 3];
  c.fillStyle = pal[0]; c.fillRect(0, 0, 256, 256);
  c.fillStyle = pal[1]; c.beginPath(); c.arc(90, 120, 70, 0, 6.3); c.fill();
  c.fillStyle = pal[2]; c.fillRect(130, 40, 90, 170);
  c.fillStyle = pal[3]; c.beginPath(); c.moveTo(20, 230); c.lineTo(130, 150); c.lineTo(240, 230); c.closePath(); c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; artCache.set(n, t); return t;
}

const BUILDERS = {
  sofa(g, c) {
    const { w, d, h, P, T } = c; const seats = c.p.seats || 3; const leg = 0.1; const arm = Math.min(0.22, w * 0.12); const bh = h * 0.3;
    B(g, w, bh, d, P, 0, leg, 0, 0.05);
    B(g, w - arm * 2, h - leg - bh, d * 0.22, P, 0, leg + bh, -d / 2 + d * 0.11, 0.06);
    [-1, 1].forEach((s) => B(g, arm, h * 0.55 - leg, d, P, s * (w / 2 - arm / 2), leg, 0, 0.06));
    const cw = (w - arm * 2) / seats;
    for (let i = 0; i < seats; i += 1) B(g, cw - 0.02, 0.14, d * 0.7, P, -(w - arm * 2) / 2 + cw * (i + 0.5), leg + bh, d * 0.1, 0.05);
    legs(g, w, d, leg, T, 0.1);
  },
  sofaL(g, c) {
    const { w, d, h, P, T } = c; const leg = 0.1; const bh = h * 0.3;
    B(g, w, bh, d * 0.5, P, 0, leg, -d / 4, 0.05); B(g, w * 0.38, bh, d * 0.5, P, w * 0.31, leg, d / 4, 0.05);
    B(g, w, h - leg - bh, 0.18, P, 0, leg + bh, -d / 2 + 0.09, 0.06);
    B(g, 0.2, h * 0.55 - leg, d * 0.5, P, -w / 2 + 0.1, leg, -d / 4, 0.06);
    B(g, w * 0.6, 0.14, d * 0.42, P, -w * 0.2, leg + bh, -d / 4 + 0.05, 0.05); B(g, w * 0.34, 0.14, d * 0.46, P, w * 0.31, leg + bh, d / 4, 0.05);
    legs(g, w, d, leg, T, 0.1);
  },
  armchair(g, c) {
    const { w, d, h, P, T } = c; const lounge = c.p.lounge; const leg = lounge ? 0.16 : 0.12;
    B(g, w, 0.2, d, P, 0, leg, 0, 0.05);
    const back = B(g, w, h - leg - 0.2, 0.16, P, 0, leg + 0.2, -d / 2 + 0.08, 0.06); if (lounge) back.rotation.x = -0.25;
    [-1, 1].forEach((s) => B(g, 0.12, 0.22, d, P, s * (w / 2 - 0.06), leg + 0.2, 0, 0.04));
    legs(g, w, d, leg, T, 0.08);
  },
  chair(g, c) {
    const { w, d, h, P, T } = c; const sh = h * 0.5; const up = c.p.upholstered;
    B(g, w, up ? 0.08 : 0.04, d * 0.9, P, 0, sh - (up ? 0.08 : 0.04), 0.02, 0.02);
    B(g, w, h - sh, 0.04, P, 0, sh, -d / 2 + 0.03, 0.02);
    legs(g, w, d, sh - 0.08, up ? T : P, 0.04, 0.018);
  },
  stool(g, c) {
    const { w, h, P, T } = c; const bar = c.p.bar;
    Cy(g, w / 2, w / 2, 0.04, P, 0, h - 0.04, 0, 24);
    [0, 1, 2].forEach((i) => { const a = (i * Math.PI * 2) / 3; const l = Cy(g, 0.014, 0.012, h - 0.04, T, Math.cos(a) * w * 0.28, 0, Math.sin(a) * w * 0.28, 8); l.rotation.z = Math.cos(a) * 0.08; l.rotation.x = Math.sin(a) * 0.08; });
    if (bar) Cy(g, w * 0.3, w * 0.3, 0.015, T, 0, h * 0.3, 0, 20);
  },
  bench(g, c) { const { w, d, h, P, T } = c; B(g, w, 0.06, d, P, 0, h - 0.06, 0, 0.02); B(g, 0.05, h - 0.06, d * 0.9, T, -w / 2 + 0.1, 0, 0); B(g, 0.05, h - 0.06, d * 0.9, T, w / 2 - 0.1, 0, 0); },
  ottoman(g, c) { const { w, d, h, P, T } = c; B(g, w, h - 0.06, d, P, 0, 0.06, 0, 0.08); legs(g, w, d, 0.06, T, 0.07, 0.02); },
  officeChair(g, c) {
    const { w, d, h, P, T } = c;
    Cy(g, 0.02, 0.02, h * 0.4, T, 0, 0.05, 0, 10);
    for (let i = 0; i < 5; i += 1) { const a = (i * Math.PI * 2) / 5; const arm = B(g, w * 0.5, 0.025, 0.04, T, Math.cos(a) * w * 0.25, 0.04, Math.sin(a) * w * 0.25); arm.rotation.y = -a; }
    B(g, w * 0.8, 0.08, d * 0.8, P, 0, h * 0.45, 0, 0.03);
    B(g, w * 0.75, h * 0.42, 0.07, P, 0, h * 0.52, -d * 0.36, 0.03);
  },
  table(g, c) {
    const { w, d, h, P, T } = c;
    if (c.p.shape === 'round') { Cy(g, w / 2, w / 2, 0.04, P, 0, h - 0.04, 0, 36); Cy(g, 0.04, 0.05, h - 0.04, T, 0, 0, 0, 12); Cy(g, w * 0.28, w * 0.28, 0.02, T, 0, 0, 0, 24); }
    else { B(g, w, 0.04, d, P, 0, h - 0.04, 0, 0.01); legs(g, w, d, h - 0.04, T, 0.05, 0.02); }
  },
  desk(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, 0.04, d, P, 0, h - 0.04, 0, 0.01); B(g, 0.04, h - 0.04, d * 0.95, P, -w / 2 + 0.03, 0, 0); B(g, w * 0.3, h - 0.04, d * 0.9, P, w / 2 - w * 0.15 - 0.01, 0, 0);
    B(g, w * 0.6, h * 0.35, 0.02, P, -w * 0.12, h * 0.5, -d / 2 + 0.04); B(g, 0.1, 0.012, 0.02, T, w / 2 - w * 0.15, h * 0.8, d / 2 - 0.045);
  },
  bed(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, 0.2, d, T, 0, 0.1, 0, 0.02);
    B(g, w - 0.06, 0.22, d - 0.1, solid(WHITE, { roughness: 0.9 }), 0, 0.3, 0.03, 0.06);
    B(g, w, h - 0.2, 0.1, P, 0, 0.2, -d / 2 + 0.05, 0.05);
    [-1, 1].forEach((s) => B(g, w * 0.4, 0.12, 0.35, solid('#FFFFFF', { roughness: 0.9 }), s * w * 0.24, 0.52, -d / 2 + 0.3, 0.05));
    B(g, w - 0.04, 0.05, d * 0.5, P, 0, 0.52, d * 0.2, 0.02);
    legs(g, w, d, 0.1, T, 0.05, 0.03);
  },
  cabinet(g, c) {
    const { w, d, h, P, T } = c; const leg = 0.1;
    B(g, w, h - leg, d, P, 0, leg, 0, 0.01);
    if (c.p.drawers) for (let i = 1; i <= c.p.drawers; i += 1) { const y = leg + ((h - leg) * i) / (c.p.drawers + 1); B(g, w * 0.9, 0.006, 0.004, T, 0, y, d / 2 + 0.002); B(g, 0.08, 0.012, 0.015, T, 0, y - 0.05, d / 2 + 0.008); }
    if (c.p.doors) { const n = c.p.doors; for (let i = 1; i < n; i += 1) B(g, 0.006, h - leg - 0.06, 0.004, T, -w / 2 + (w * i) / n, leg + 0.03, d / 2 + 0.002); for (let i = 0; i < n; i += 1) B(g, 0.012, 0.1, 0.015, T, -w / 2 + (w * (i + 0.5)) / n, h * 0.5, d / 2 + 0.008); }
    legs(g, w, d, leg, T, 0.05, 0.015);
  },
  wardrobe(g, c) {
    const { w, d, h, P, T } = c; const n = c.p.doors || 2;
    B(g, w, h - 0.05, d, P, 0, 0.05, 0, 0.01); B(g, w, 0.05, d * 0.9, T, 0, 0, 0);
    for (let i = 1; i < n; i += 1) B(g, 0.006, h - 0.15, 0.004, T, -w / 2 + (w * i) / n, 0.08, d / 2 + 0.002);
    for (let i = 0; i < n; i += 1) B(g, 0.015, 0.25, 0.02, T, -w / 2 + (w * (i + 0.5)) / n + 0.05, h * 0.5, d / 2 + 0.01);
  },
  dresser(g, c) {
    const { w, d, h, P, T } = c; const leg = 0.1;
    B(g, w, h - leg, d, P, 0, leg, 0, 0.01);
    [1, 2].forEach((i) => B(g, w * 0.92, 0.006, 0.004, T, 0, leg + ((h - leg) * i) / 3, d / 2 + 0.002));
    [0, 1, 2].forEach((i) => { B(g, 0.1, 0.014, 0.02, T, 0, leg + ((h - leg) * (i + 0.5)) / 3, d / 2 + 0.01); });
    legs(g, w, d, leg, T, 0.05, 0.018);
  },
  bookshelf(g, c) {
    const { w, d, h, P, T } = c; const t = 0.025; const n = c.p.low ? 2 : c.p.slatted ? 4 : 5;
    B(g, t, h, d, P, -w / 2 + t / 2, 0, 0); B(g, t, h, d, P, w / 2 - t / 2, 0, 0); B(g, w, h, 0.012, c.p.slatted ? T : P, 0, 0, -d / 2 + 0.006);
    for (let i = 0; i <= n; i += 1) B(g, w - t * 2, t, d - 0.01, P, 0, ((h - t) * i) / n, 0.004);
    const cols = ['#B9674A', '#7A8FA6', '#D6C3A5', '#4F6B4A', '#8A5E3B'];
    if (!c.p.slatted) for (let s = 0; s < n; s += 1) for (let k = 0; k < 4; k += 1) B(g, 0.04, ((h - t) / n) * 0.7, d * 0.65, solid(cols[(s + k) % cols.length], { roughness: 0.8 }), -w * 0.3 + k * 0.06 + s * 0.02, ((h - t) * s) / n + t, 0.01);
  },
  tvUnit(g, c) {
    const { w, d, h, P, T } = c; const leg = 0.12;
    B(g, w, h - leg, d, P, 0, leg, 0, 0.01); [1, 2].forEach((i) => B(g, 0.006, h - leg - 0.06, 0.004, T, -w / 2 + (w * i) / 3, leg + 0.03, d / 2 + 0.002));
    legs(g, w, d, leg, T, 0.06, 0.016);
  },
  kitchenBase(g, c) {
    const { w, d, h, P, T } = c; const app = c.p.appliance; const top = solid('#E9E6DF', { roughness: 0.25 });
    B(g, w - 0.01, h - 0.04 - 0.08, d - 0.02, app ? c.A : P, 0, 0.08, 0.01, 0.005); B(g, w, 0.04, d, top, 0, h - 0.04, 0); B(g, w - 0.02, 0.08, d - 0.1, T, 0, 0, -0.02);
    if (app === 'washer') { Cy(g, 0.2, 0.2, 0.02, solid('#222426', { roughness: 0.2 }), 0, 0.28, d / 2 - 0.01, 24).rotation.x = Math.PI / 2; }
    else B(g, w * 0.4, 0.012, 0.015, T, 0, h - 0.14, d / 2 + 0.005);
  },
  kitchenSink(g, c) {
    const { w, d, h, P, T } = c; const top = solid('#E9E6DF', { roughness: 0.25 });
    B(g, w - 0.01, h - 0.12, d - 0.02, P, 0, 0.08, 0.01, 0.005); B(g, w, 0.04, d, top, 0, h - 0.04, 0); B(g, w - 0.02, 0.08, d - 0.1, T, 0, 0, -0.02);
    B(g, w * 0.55, 0.012, d * 0.55, solid('#8E9396', { roughness: 0.3, metalness: 0.8 }), -w * 0.1, h, 0.02);
    Cy(g, 0.012, 0.012, 0.22, solid('#C9C9C6', { roughness: 0.2, metalness: 0.9 }), w * 0.24, h, -d * 0.3, 10);
  },
  kitchenCooktop(g, c) {
    const { w, d, h, P, T } = c; const top = solid('#E9E6DF', { roughness: 0.25 });
    B(g, w - 0.01, h - 0.12, d - 0.02, P, 0, 0.08, 0.01, 0.005); B(g, w, 0.04, d, top, 0, h - 0.04, 0); B(g, w - 0.02, 0.08, d - 0.1, T, 0, 0, -0.02);
    B(g, w * 0.85, 0.008, d * 0.8, solid('#1A1B1C', { roughness: 0.15 }), 0, h, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => Cy(g, 0.07, 0.07, 0.008, solid('#3A3B3D', { roughness: 0.3, metalness: 0.5 }), sx * w * 0.2, h + 0.008, sz * d * 0.18, 20));
  },
  kitchenTower(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w - 0.01, h - 0.08, d - 0.02, P, 0, 0.08, 0.01, 0.005); B(g, w - 0.02, 0.08, d - 0.1, T, 0, 0, -0.02);
    B(g, w * 0.7, h * 0.18, 0.012, solid('#1A1B1C', { roughness: 0.15 }), 0, h * 0.42, d / 2 - 0.005); B(g, w * 0.6, 0.014, 0.02, c.A, 0, h * 0.4, d / 2 + 0.01);
  },
  island(g, c) {
    const { w, d, h, P, T } = c; const top = solid('#E9E6DF', { roughness: 0.25 });
    B(g, w - 0.1, h - 0.04 - 0.08, d - 0.1, P, 0, 0.08, 0, 0.01); B(g, w, 0.05, d, top, 0, h - 0.05, 0, 0.01); B(g, w - 0.12, 0.08, d - 0.14, T, 0, 0, 0);
    [1, 2].forEach((i) => B(g, 0.006, h - 0.2, 0.004, T, -w / 2 + 0.05 + ((w - 0.1) * i) / 3, 0.12, d / 2 - 0.048));
  },
  wallCabinet(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, h, d, P, 0, 0, 0, 0.01); B(g, 0.006, h - 0.04, 0.004, T, 0, 0.02, d / 2 + 0.002); B(g, 0.012, 0.12, 0.015, T, 0.04, h * 0.2, d / 2 + 0.008);
  },
  rangeHood(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, h * 0.35, d, c.A, 0, 0, 0, 0.01); B(g, w * 0.4, h * 0.65, d * 0.5, c.A, 0, h * 0.35, -d * 0.2); B(g, w * 0.8, 0.01, d * 0.7, T, 0, 0.002, 0);
  },
  fridge(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, h, d, P, 0, 0, 0, 0.02); B(g, w * 0.96, 0.008, 0.006, T, 0, h * 0.34, d / 2 + 0.003);
    B(g, 0.025, h * 0.22, 0.03, T, -w * 0.4, h * 0.55, d / 2 + 0.015, 0.01); B(g, 0.025, h * 0.14, 0.03, T, -w * 0.4, h * 0.14, d / 2 + 0.015, 0.01);
  },
  toilet(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w * 0.9, h * 0.5, d * 0.28, P, 0, h * 0.45, -d * 0.36, 0.02); Cy(g, w * 0.45, w * 0.35, h * 0.45, P, 0, 0, d * 0.05, 24).scale.z = 1.4;
    const seat = Cy(g, w * 0.46, w * 0.46, 0.025, solid('#F8F7F3', { roughness: 0.3 }), 0, h * 0.45, d * 0.05, 24); seat.scale.z = 1.4;
    B(g, 0.06, 0.02, 0.03, T, 0, h * 0.97, -d * 0.36);
  },
  vanity(g, c) {
    const { w, d, h, P, T } = c; const top = solid('#E9E6DF', { roughness: 0.25 });
    B(g, w, h - 0.05 - 0.1, d, P, 0, 0.1, 0, 0.01); B(g, w, 0.04, d, top, 0, h - 0.04, 0);
    Sp(g, w * 0.28, solid('#FAFAF8', { roughness: 0.2 }), 0, h - 0.01, 0.02, 1, 0.22, 0.8);
    Cy(g, 0.012, 0.012, 0.16, solid('#C9C9C6', { roughness: 0.2, metalness: 0.9 }), 0, h, -d * 0.35, 10); legs(g, w, d, 0.1, T, 0.05, 0.015);
  },
  bathtub(g, c) {
    const { w, d, h, P } = c; const t = 0.06;
    B(g, w, h, t, P, 0, 0, -d / 2 + t / 2, 0.02); B(g, w, h, t, P, 0, 0, d / 2 - t / 2, 0.02);
    B(g, t, h, d - t * 2, P, -w / 2 + t / 2, 0, 0); B(g, t, h, d - t * 2, P, w / 2 - t / 2, 0, 0); B(g, w - t * 2, 0.1, d - t * 2, P, 0, 0, 0);
    B(g, w - t * 2.4, 0.01, d - t * 2.4, solid('#CFE6EE', { roughness: 0.1 }), 0, h * 0.62, 0);
    Cy(g, 0.012, 0.012, 0.2, solid('#C9C9C6', { roughness: 0.2, metalness: 0.9 }), -w / 2 + 0.12, h, 0, 10);
  },
  shower(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, 0.06, d, P, 0, 0, 0, 0.01); Gl(g, w, h - 0.06, 0.012, 0, 0.06, d / 2 - 0.006); Gl(g, 0.012, h - 0.06, d, w / 2 - 0.006, 0.06, 0);
    B(g, w, 0.03, 0.03, T, 0, h - 0.03, d / 2 - 0.015); B(g, 0.03, 0.03, d, T, w / 2 - 0.015, h - 0.03, 0);
    Cy(g, 0.012, 0.012, 0.9, solid('#C9C9C6', { roughness: 0.2, metalness: 0.9 }), -w / 2 + 0.08, 1.2, -d / 2 + 0.05, 10); Cy(g, 0.1, 0.1, 0.012, solid('#C9C9C6', { roughness: 0.2, metalness: 0.9 }), -w / 2 + 0.08, 2.0, -d / 2 + 0.1, 16);
  },
  mirror(g, c) {
    const { w, d, h, T } = c; const glass = solid('#CFD8DC', { roughness: 0.04, metalness: 1 });
    if (c.p.round) { Cy(g, w / 2, w / 2, d, T, 0, 0, 0, 36).rotation.x = Math.PI / 2; const m = Cy(g, w / 2 - 0.02, w / 2 - 0.02, d + 0.004, glass, 0, 0, 0, 36); m.rotation.x = Math.PI / 2; m.position.y = h / 2; g.children[g.children.length - 2].position.y = h / 2; }
    else { B(g, w, h, d, T, 0, 0, 0, 0.005); B(g, w - 0.05, h - 0.05, d + 0.004, glass, 0, 0.025, 0); }
  },
  floorLamp(g, c) {
    const { w, d, h, P, T } = c; const bright = new THREE.MeshStandardMaterial({ color: P.color, emissive: '#FFD9A0', emissiveIntensity: 0.25, roughness: 0.9, side: THREE.DoubleSide });
    Cy(g, w * 0.3, w * 0.34, 0.03, T, 0, 0, 0, 28);
    if (c.p.arc) { Cy(g, 0.012, 0.012, h * 0.7, T, -w * 0.3, 0, 0, 8); B(g, w * 0.6, 0.02, 0.02, T, 0, h * 0.7, 0); Cy(g, 0.1, 0.18, 0.2, bright, w * 0.3, h * 0.7 - 0.2, 0, 28); }
    else { Cy(g, 0.012, 0.012, h * 0.85, T, 0, 0.03, 0, 8); const sh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.2, w * 0.38, h * 0.2, 28, 1, true), bright); sh.position.y = h * 0.88; g.add(sh); }
  },
  tableLamp(g, c) {
    const { w, h, P, T } = c; const bright = new THREE.MeshStandardMaterial({ color: P.color, emissive: '#FFD9A0', emissiveIntensity: 0.25, roughness: 0.9, side: THREE.DoubleSide });
    Cy(g, w * 0.3, w * 0.34, 0.04, T, 0, 0, 0, 20); Cy(g, 0.012, 0.012, h * 0.5, T, 0, 0.04, 0, 8);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.5, h * 0.42, 24, 1, true), bright); sh.position.y = h * 0.78; g.add(sh);
  },
  pendant(g, c) {
    const { w, h, P, T } = c; const bright = new THREE.MeshStandardMaterial({ color: P.color, emissive: '#FFD9A0', emissiveIntensity: 0.35, roughness: 0.8, side: THREE.DoubleSide });
    Cy(g, 0.006, 0.006, h * 0.6, T, 0, h * 0.4, 0, 6);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.15, w * 0.5, h * 0.3, 28, 1, true), bright); sh.position.y = h * 0.25; g.add(sh);
    Sp(g, 0.04, solid('#FFF2D0', { roughness: 0.4 }), 0, h * 0.2, 0);
  },
  chandelier(g, c) {
    const { w, h, T } = c; Cy(g, 0.006, 0.006, h * 0.5, T, 0, h * 0.5, 0, 6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.4, 0.01, 8, 36), T); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.4; g.add(ring);
    for (let i = 0; i < 6; i += 1) { const a = (i * Math.PI * 2) / 6; Sp(g, 0.035, solid('#FFF2D0', { roughness: 0.4 }), Math.cos(a) * w * 0.4, h * 0.4, Math.sin(a) * w * 0.4); }
  },
  sconce(g, c) {
    const { w, d, h, P, T } = c; B(g, w * 0.5, h * 0.6, 0.015, T, 0, h * 0.2, -d / 2 + 0.01);
    const bright = new THREE.MeshStandardMaterial({ color: P.color, emissive: '#FFD9A0', emissiveIntensity: 0.3, roughness: 0.9, side: THREE.DoubleSide });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.45, h * 0.5, 16, 1, true), bright); sh.position.set(0, h * 0.55, -d / 2 + 0.07); g.add(sh);
  },
  rug(g, c) {
    const { w, d, h, P } = c;
    if (c.p.round) { Cy(g, w / 2, w / 2, h, P, 0, 0, 0, 48); } else B(g, w, h, d, P, 0, 0, 0);
    g.children.forEach((m) => { m.castShadow = false; });
  },
  painting(g, c) {
    const { w, d, h, T } = c; B(g, w, h, d, T, 0, 0, 0);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: artTexture(c.p.art || 1), roughness: 0.8 }));
    art.position.set(0, h / 2, d / 2 + 0.001); g.add(art);
    if (c.p.art === 3) { const m2 = art.clone(); m2.scale.set(0.001, 0.001, 0.001); }
  },
  clock(g, c) {
    const { w, d, h, T } = c; const face = Cy(g, w / 2, w / 2, d, T, 0, 0, 0, 32); face.rotation.x = Math.PI / 2; face.position.y = h / 2;
    const dial = Cy(g, w / 2 - 0.012, w / 2 - 0.012, d + 0.004, solid('#F3F0E8', { roughness: 0.6 }), 0, 0, 0, 32); dial.rotation.x = Math.PI / 2; dial.position.y = h / 2;
    B(g, 0.006, w * 0.35, 0.004, T, 0, h / 2, d / 2 + 0.004); const m = B(g, w * 0.25, 0.006, 0.004, T, 0, h / 2, d / 2 + 0.006);
  },
  tv(g, c) { const { w, d, h, T } = c; B(g, w, h, d, T, 0, 0, 0, 0.005); B(g, w - 0.03, h - 0.03, 0.004, solid('#0E0F10', { roughness: 0.1, metalness: 0.2 }), 0, 0.015, d / 2); },
  curtain(g, c) {
    const { w, d, h, P, T } = c; const n = Math.max(6, Math.round(w / 0.1));
    Cy(g, 0.012, 0.012, w + 0.1, T, 0, h + 0.01, 0, 8).rotation.z = Math.PI / 2;
    for (let i = 0; i < n; i += 1) B(g, w / n * 0.9, h, d * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.3))), P, -w / 2 + (w * (i + 0.5)) / n, 0, 0, 0.01);
  },
  vase(g, c) {
    const { w, h, P } = c; const pts = [[0.35, 0], [0.5, 0.15], [0.5, 0.45], [0.28, 0.75], [0.3, 1]].map(([x, y]) => new THREE.Vector2(x * w, y * h * 0.8));
    const m = mesh(new THREE.LatheGeometry(pts, 20), P, 0, 0, 0); g.add(m);
    for (let i = 0; i < 3; i += 1) { const s = Cy(g, 0.004, 0.004, h * 0.5, solid('#6B4A32', { roughness: 0.9 }), (i - 1) * 0.02, h * 0.7, 0, 5); s.rotation.z = (i - 1) * 0.25; }
  },
  plant(g, c) {
    const { w, h, P, T } = c; const kind = c.p.kind; const potH = kind === 'small' || kind === 'cactus' ? h * 0.3 : h * 0.26;
    Cy(g, w * 0.4, w * 0.3, potH, T, 0, 0, 0, 24); Cy(g, w * 0.38, w * 0.38, 0.01, solid('#2E2219', { roughness: 1 }), 0, potH, 0, 20);
    const trunkH = h - potH - (kind === 'palm' ? 0.35 : 0.3);
    if (kind === 'cactus') { Cy(g, w * 0.22, w * 0.22, h - potH, P, 0, potH, 0, 14); B(g, w * 0.12, w * 0.12, w * 0.12, P, w * 0.28, potH + (h - potH) * 0.5, 0, 0.03); return; }
    if (kind !== 'small') Cy(g, 0.02, 0.026, trunkH, solid('#6B4A32', { roughness: 0.9 }), 0, potH, 0, 8);
    let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const count = kind === 'small' ? 10 : 16;
    for (let i = 0; i < count; i += 1) {
      const t = i / count; const a = i * 2.399 + rand() * 0.4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), P); leaf.castShadow = true; leaf.receiveShadow = true;
      if (kind === 'palm') { leaf.scale.set(0.5, 0.018, 0.1); leaf.position.set(Math.cos(a) * 0.34, h - 0.15 - (i % 3) * 0.05, Math.sin(a) * 0.34); leaf.rotation.set(0, -a, -0.45); }
      else if (kind === 'small') { leaf.scale.set(0.09, 0.015, 0.06); leaf.position.set(Math.cos(a) * 0.07, potH + 0.05 + t * 0.12, Math.sin(a) * 0.07); leaf.rotation.set(0, -a, 0.5); }
      else { leaf.scale.set(0.17, 0.02, 0.11); leaf.position.set(Math.cos(a) * (0.14 + 0.1 * (1 - t)), potH + trunkH * 0.5 + t * (trunkH * 0.55), Math.sin(a) * (0.14 + 0.1 * (1 - t))); leaf.rotation.set(0, -a, 0.35 + rand() * 0.2); }
      g.add(leaf);
    }
  },
  stairs(g, c) {
    const { w, d, h, P, T } = c; const n = Math.max(3, Math.round((h * 100) / 17.5)); const rise = h / n; const run = d / n;
    for (let i = 0; i < n; i += 1) { B(g, w, 0.04, run + 0.02, P, 0, rise * (i + 1) - 0.04, -d / 2 + run * (i + 0.5), 0.005); B(g, w - 0.02, rise - 0.04, 0.02, T, 0, rise * i, -d / 2 + run * i + 0.01); }
    [-1, 1].forEach((s) => { const st = B(g, 0.05, 0.22, Math.hypot(d, h), T, s * (w / 2 - 0.025), 0, 0); st.rotation.x = -Math.atan2(h, d); st.position.y = h / 2 - 0.05; });
  },
  railing(g, c) {
    const { w, d, h, T } = c; Gl(g, w, h - 0.12, 0.012, 0, 0.06, 0); B(g, w, 0.04, d, T, 0, h - 0.04, 0); B(g, w, 0.03, d, T, 0, 0, 0);
    [-1, 1].forEach((s) => B(g, 0.04, h, 0.04, T, s * (w / 2 - 0.02), 0, 0));
  },
  divider(g, c) {
    const { w, d, h, P, T } = c; const n = Math.round(w / 0.1);
    B(g, w, 0.04, d, T, 0, 0, 0); B(g, w, 0.04, d, T, 0, h - 0.04, 0);
    for (let i = 0; i < n; i += 1) B(g, 0.035, h - 0.08, d * 0.8, P, -w / 2 + (w * (i + 0.5)) / n, 0.04, 0);
  },
  fireplace(g, c) {
    const { w, d, h, P, T } = c;
    B(g, w, h, d, P, 0, 0, 0); B(g, w + 0.1, 0.05, d + 0.08, T, 0, h, 0); B(g, w * 0.5, h * 0.45, 0.02, solid('#161616', { roughness: 0.9 }), 0, 0.15, d / 2 + 0.001);
    B(g, w * 0.4, 0.03, 0.12, solid('#C25A2B', { roughness: 0.6 }), 0, 0.15, d / 2 - 0.08);
  },
  car(g, c) {
    const { w, d, h, P, A } = c; const suv = c.p.type === 'suv';
    const glass = solid('#18212A', { roughness: 0.08, metalness: 0.4 }); const tire = solid('#151515', { roughness: 0.9 });
    const clear = 0.17; const bodyH = h * (suv ? 0.44 : 0.38); const cabH = h - clear - bodyH; const cabL = d * (suv ? 0.62 : 0.5); const cabZ = suv ? -d * 0.05 : -d * 0.07;
    B(g, w, bodyH, d, P, 0, clear, 0, 0.14);
    B(g, w * 0.9, cabH, cabL, P, 0, clear + bodyH, cabZ, 0.14);
    B(g, w * 0.9 + 0.006, cabH * 0.66, cabL * 0.9, glass, 0, clear + bodyH + cabH * 0.1, cabZ, 0.04);
    B(g, w * 0.93, cabH * 0.66, cabL + 0.006, glass, 0, clear + bodyH + cabH * 0.1, cabZ, 0.04).scale.set(0.97, 1, 0.96);
    const lamp = solid('#F6F2D8', { roughness: 0.2 }); const tail = solid('#B3261E', { roughness: 0.35 });
    [-1, 1].forEach((s) => { B(g, 0.32, 0.09, 0.03, lamp, s * w * 0.3, clear + bodyH * 0.6, d / 2 - 0.005, 0.02); B(g, 0.3, 0.08, 0.03, tail, s * w * 0.3, clear + bodyH * 0.65, -d / 2 + 0.005, 0.02); });
    B(g, w * 0.5, 0.07, 0.03, glass, 0, clear + bodyH * 0.12, d / 2 - 0.004, 0.02);
    const r = suv ? 0.37 : 0.33;
    [-1, 1].forEach((s) => [-1, 1].forEach((f) => Wheel(g, s * (w / 2 - 0.1), f * d * 0.3, r, 0.24, tire, A)));
  },
  motorcycle(g, c) {
    const { w, d, h, P, T, A } = c; const tire = solid('#141414', { roughness: 0.9 }); const r = 0.32;
    Wheel(g, 0, d * 0.34, r, 0.12, tire, A); Wheel(g, 0, -d * 0.34, r, 0.14, tire, A);
    B(g, 0.22, 0.2, 0.5, P, 0, 0.55, d * 0.08, 0.07); B(g, 0.2, 0.09, 0.55, solid('#1B1B1B'), 0, 0.72, -d * 0.12, 0.04);
    B(g, 0.16, 0.2, 0.42, T, 0, 0.32, -d * 0.02, 0.03);
    Rod(g, [0, 0.32, d * 0.34], [0, h - 0.18, d * 0.26], 0.018, A); B(g, w, 0.035, 0.035, T, 0, h - 0.18, d * 0.26, 0.01);
    Rod(g, [0, 0.35, -d * 0.34], [0, 0.5, -d * 0.1], 0.02, T);
    B(g, 0.16, 0.14, 0.08, solid('#F6F2D8', { roughness: 0.2 }), 0, h - 0.3, d * 0.3, 0.03);
  },
  bicycle(g, c) {
    const { w, d, h, P, T } = c; const r = 0.34; const y = r;
    [d * 0.36, -d * 0.36].forEach((z) => { const t = mesh(new THREE.TorusGeometry(r, 0.014, 6, 28), T, 0, y, z); t.rotation.y = Math.PI / 2; g.add(t); });
    const bb = [0, 0.3, -d * 0.1]; const seat = [0, 0.75, -d * 0.2]; const head = [0, 0.75, d * 0.24]; const ra = [0, y, -d * 0.36]; const fa = [0, y, d * 0.36];
    Rod(g, bb, seat, 0.014, P); Rod(g, bb, head, 0.014, P); Rod(g, seat, head, 0.014, P); Rod(g, bb, ra, 0.011, P); Rod(g, seat, ra, 0.011, P); Rod(g, head, fa, 0.011, T);
    B(g, w, 0.025, 0.025, T, 0, h - 0.04, d * 0.24, 0.008); B(g, 0.1, 0.03, 0.2, solid('#1B1B1B'), 0, 0.77, -d * 0.2, 0.012);
  },
  tree(g, c) {
    const { w, h, P, T } = c; const kind = c.p.kind || 'round';
    if (kind === 'pine') {
      Cy(g, 0.06, 0.1, h * 0.2, T, 0, 0, 0, 10);
      [0, 1, 2, 3].forEach((i) => { const rr = w * 0.5 * (1 - i * 0.2); const hh = h * 0.34; const m = mesh(new THREE.ConeGeometry(rr, hh, 14), P, 0, h * 0.16 + i * h * 0.19 + hh / 2, 0); g.add(m); });
    } else if (kind === 'coconut') {
      const top = h * 0.88; Rod(g, [0, 0, 0], [0.18, top, 0.1], 0.1, T, 10);
      for (let i = 0; i < 9; i += 1) {
        const pivot = new THREE.Group(); pivot.position.set(0.18, top, 0.1); pivot.rotation.y = (i / 9) * Math.PI * 2;
        const tilt = new THREE.Group(); tilt.rotation.x = 0.55 + (i % 2) * 0.2; pivot.add(tilt);
        const len = w * 0.62; const leaf = mesh(new THREE.BoxGeometry(0.16, 0.015, len), P, 0, 0, len / 2); tilt.add(leaf); g.add(pivot);
      }
      [0, 1, 2].forEach((i) => Sp(g, 0.1, solid('#6B4F2A', { roughness: 0.8 }), 0.18 + Math.cos(i * 2.1) * 0.14, top - 0.08, 0.1 + Math.sin(i * 2.1) * 0.14));
    } else if (kind === 'frangi') {
      const th = h * 0.38; Rod(g, [0, 0, 0], [0, th, 0], 0.1, T, 10); Rod(g, [0, th * 0.7, 0], [-w * 0.25, th + 0.3, 0.1], 0.06, T); Rod(g, [0, th * 0.7, 0], [w * 0.25, th + 0.25, -0.1], 0.06, T);
      [[-0.28, 0.3, 0.1], [0.28, 0.25, -0.1], [0, 0.45, 0], [0.1, 0.3, 0.3], [-0.1, 0.3, -0.3]].forEach(([x, y, z]) => Sp(g, w * 0.26, P, x * w, th + y, z * w, 1, 0.65, 1));
      for (let i = 0; i < 22; i += 1) Sp(g, 0.045, solid(i % 3 ? '#F7ECEF' : '#F4D6DE', { roughness: 0.7 }), (rnd(i) - 0.5) * w * 0.8, th + 0.2 + rnd(i + 40) * 0.5, (rnd(i + 80) - 0.5) * w * 0.8);
    } else {
      const th = h * 0.38; Cy(g, 0.07, 0.12, th, T, 0, 0, 0, 10); Rod(g, [0, th * 0.8, 0], [w * 0.2, th + 0.35, 0.1], 0.04, T);
      [[0, 0.55, 0, 0.48], [-0.28, 0.3, 0.08, 0.32], [0.28, 0.34, -0.06, 0.34], [0.05, 0.28, 0.28, 0.3], [-0.05, 0.3, -0.28, 0.3]].forEach(([x, y, z, rr]) => Sp(g, w * rr, P, x * w, th + y * (h - th), z * w, 1, 0.86, 1));
    }
  },
  bush(g, c) {
    const { w, h, P } = c;
    [[0, 0, 0, 0.5], [-0.28, 0, 0.1, 0.34], [0.28, 0, -0.08, 0.36], [0.05, 0, 0.3, 0.3]].forEach(([x, , z, r]) => Sp(g, w * r, P, x * w, h * 0.45, z * w, 1, h / (w * 0.9), 1));
  },
  hedge(g, c) {
    const { w, h, d, P } = c; B(g, w, h, d, P, 0, 0, 0, 0.1);
    for (let i = 0; i < 6; i += 1) Sp(g, d * 0.45, P, -w / 2 + (w * (i + 0.5)) / 6, h, (rnd(i) - 0.5) * 0.05, 1, 0.6, 1);
  },
  flowerBed(g, c) {
    const { w, d, h, P } = c; B(g, w, h * 0.5, d, solid('#4A3426', { roughness: 1 }), 0, 0, 0, 0.03); B(g, w * 0.96, 0.02, d * 0.9, P, 0, h * 0.5, 0, 0.01);
    const cols = ['#E26D8B', '#F2C14E', '#F5F5F0', '#9B6BD3', '#E8794A'];
    for (let i = 0; i < 28; i += 1) Sp(g, 0.035, solid(cols[i % cols.length], { roughness: 0.7 }), (rnd(i) - 0.5) * (w - 0.1), h * 0.5 + 0.06 + rnd(i + 9) * 0.12, (rnd(i + 31) - 0.5) * (d - 0.1));
  },
  gardenLamp(g, c) {
    const { w, h, T } = c; Cy(g, 0.018, 0.022, h - 0.2, T, 0, 0, 0, 8); B(g, w * 0.7, 0.04, w * 0.7, T, 0, h - 0.2, 0, 0.01);
    B(g, w * 0.5, 0.14, w * 0.5, solid('#FFF1BF', { roughness: 0.3, transparent: true, opacity: 0.9 }), 0, h - 0.16, 0, 0.02); B(g, w * 0.8, 0.03, w * 0.8, T, 0, h - 0.02, 0, 0.01);
  },
  pergola(g, c) {
    const { w, d, h, P } = c;
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => B(g, 0.14, h, 0.14, P, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07))));
    [-1, 1].forEach((sx) => B(g, 0.12, 0.16, d, P, sx * (w / 2 - 0.06), h - 0.16, 0));
    for (let i = 0; i < 9; i += 1) B(g, w + 0.2, 0.06, 0.07, P, 0, h - 0.06, -d / 2 + 0.1 + ((d - 0.2) * i) / 8);
  },
  parasol(g, c) {
    const { w, h, P, T } = c; const wood = solid('#8A5E3B', { roughness: 0.7 });
    Cy(g, 0.4, 0.4, 0.04, wood, 0, 0.7, 0, 24); Cy(g, 0.04, 0.05, 0.7, T, 0, 0, 0, 10); Cy(g, 0.2, 0.2, 0.03, T, 0, 0, 0, 16);
    Cy(g, 0.018, 0.018, h - 0.7, T, 0, 0.74, 0, 8);
    const cone = mesh(new THREE.ConeGeometry(w / 2, 0.3, 24), P, 0, h - 0.15, 0); g.add(cone);
    [-1, 1].forEach((s) => { Cy(g, 0.19, 0.19, 0.04, wood, s * 0.75, 0.42, 0, 16); Cy(g, 0.02, 0.02, 0.42, T, s * 0.75, 0, 0, 8); });
  },
  gate(g, c) {
    const { w, h, d, P, T } = c;
    [-1, 1].forEach((s) => B(g, 0.22, h + 0.1, 0.22, P, s * (w / 2 - 0.11), 0, 0));
    B(g, w - 0.44, 0.06, d, T, 0, 0.12, 0); B(g, w - 0.44, 0.06, d, T, 0, h - 0.08, 0);
    const n = Math.round(w / 0.12); for (let i = 0; i < n; i += 1) B(g, 0.025, h - 0.2, 0.025, T, -w / 2 + 0.22 + ((w - 0.44) * (i + 0.5)) / n, 0.14, 0);
  },
  mailbox(g, c) { const { w, d, h, P, T } = c; Cy(g, 0.025, 0.025, h - 0.28, T, 0, 0, 0, 8); B(g, w, 0.22, d, P, 0, h - 0.3, 0, 0.03); B(g, w * 0.6, 0.015, 0.01, solid('#151515'), 0, h - 0.2, d / 2); },
  waterTank(g, c) {
    const { w, h, P, T } = c; [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => Cy(g, 0.03, 0.03, h * 0.18, T, sx * w * 0.3, 0, sz * w * 0.3, 8)));
    Cy(g, w / 2, w / 2, h * 0.78, P, 0, h * 0.18, 0, 28); Sp(g, w * 0.5, P, 0, h * 0.96, 0, 1, 0.22, 1); Cy(g, 0.12, 0.12, 0.06, T, 0, h * 0.97, 0, 14);
  },
  stepStone(g, c) { const { w, d, h, P } = c; B(g, w, h, d, P, 0, 0, 0, Math.min(0.03, h / 2.2)); },
  fountain(g, c) {
    const { w, h, P } = c; const water = solid('#5FA6C4', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 });
    Cy(g, w / 2, w / 2, h * 0.28, P, 0, 0, 0, 32); Cy(g, w / 2 - 0.05, w / 2 - 0.05, 0.01, water, 0, h * 0.27, 0, 32);
    Cy(g, 0.07, 0.09, h * 0.5, P, 0, 0.1, 0, 14); Cy(g, w * 0.22, w * 0.18, h * 0.08, P, 0, h * 0.55, 0, 24); Sp(g, 0.07, P, 0, h * 0.7, 0);
  },
  squatToilet(g, c) {
    const { w, d, h, P } = c; B(g, w, h, d, P, 0, 0, 0, 0.03);
    const dark = solid('#2B2B29', { roughness: 0.6 }); B(g, w * 0.4, 0.004, d * 0.55, dark, 0, h, d * 0.1, 0.01);
    [-1, 1].forEach((s) => B(g, 0.12, 0.012, 0.22, P, s * w * 0.28, h, -d * 0.18, 0.004));
  },
  washbasin(g, c) {
    const { w, d, h, P, A } = c; B(g, w, h, d, P, 0, 0, 0, 0.04); B(g, w * 0.7, 0.01, d * 0.6, solid('#E4E6E4', { roughness: 0.2 }), 0, h, 0.03, 0.01);
    Cy(g, 0.012, 0.012, 0.1, A, 0, h, -d / 2 + 0.05, 8); B(g, 0.015, 0.015, 0.08, A, 0, h + 0.09, -d / 2 + 0.09);
  },
  airCon(g, c) {
    const { w, d, h, P, T } = c; B(g, w, h, d, P, 0, 0, 0, 0.05); B(g, w * 0.92, 0.02, 0.05, T, 0, 0.02, d / 2 - 0.01, 0.005);
    B(g, 0.05, 0.012, 0.004, solid('#7FD18B', { roughness: 0.4 }), w * 0.38, h * 0.62, d / 2 + 0.001);
  },
  ceilingFan(g, c) {
    const { w, h, T } = c; const wood = solid('#8A5E3B', { roughness: 0.6 });
    Cy(g, 0.012, 0.012, h * 0.5, T, 0, h * 0.5, 0, 6); Cy(g, 0.1, 0.1, 0.1, T, 0, h * 0.28, 0, 18); Sp(g, 0.07, solid('#F6F2D8', { roughness: 0.3 }), 0, h * 0.2, 0, 1, 0.6, 1);
    for (let i = 0; i < 4; i += 1) { const p = new THREE.Group(); p.rotation.y = (i * Math.PI) / 2; p.position.y = h * 0.34; p.add(mesh(new THREE.BoxGeometry(0.13, 0.012, w * 0.45), wood, 0, 0, w * 0.3)); g.add(p); }
  },
  piano(g, c) {
    const { w, d, h, P, T } = c; const white = solid('#F2F0EA', { roughness: 0.3 });
    B(g, w, h * 0.86, d - 0.14, P, 0, 0.1, -0.07, 0.01); B(g, w, 0.04, d, P, 0, 0.72, 0.0, 0.005); B(g, w * 0.96, 0.025, 0.14, white, 0, 0.76, d / 2 - 0.1);
    for (let i = 0; i < 18; i += 1) if (i % 7 !== 2 && i % 7 !== 6) B(g, 0.014, 0.02, 0.08, solid('#161616'), -w * 0.46 + (w * 0.92 * (i + 0.7)) / 18, 0.785, d / 2 - 0.13);
    [-1, 1].forEach((s) => B(g, 0.07, 0.1, d - 0.2, T, s * (w / 2 - 0.05), 0, -0.04)); B(g, w * 0.6, 0.26, 0.015, T, 0, 0.9, -d / 2 + 0.12);
  },
  aquarium(g, c) {
    const { w, d, h, P, T } = c; B(g, w, h * 0.42, d, P, 0, 0, 0, 0.01); const gh = h * 0.5;
    Gl(g, w - 0.04, gh, d - 0.04, 0, h * 0.42, 0); B(g, w - 0.04, gh * 0.8, d - 0.045, solid('#5FA6C4', { transparent: true, opacity: 0.3, roughness: 0.1 }), 0, h * 0.42, 0);
    B(g, w, 0.03, d, T, 0, h - 0.06, 0); B(g, w - 0.05, 0.03, d - 0.05, solid('#C9B98F', { roughness: 1 }), 0, h * 0.42, 0);
    for (let i = 0; i < 6; i += 1) Cy(g, 0.008, 0.012, 0.12 + rnd(i) * 0.1, solid('#3F7F45'), (rnd(i + 9) - 0.5) * (w - 0.2), h * 0.44, (rnd(i + 20) - 0.5) * (d - 0.1), 5);
    for (let i = 0; i < 4; i += 1) Sp(g, 0.02, solid('#E8794A', { roughness: 0.4 }), (rnd(i + 3) - 0.5) * (w - 0.2), h * 0.62 + rnd(i) * 0.1, (rnd(i + 15) - 0.5) * (d - 0.1), 1.6, 1, 0.8);
  },
  crib(g, c) {
    const { w, d, h, P } = c; const white = solid('#EDE8DD', { roughness: 0.9 });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => B(g, 0.045, h, 0.045, P, sx * (w / 2 - 0.0225), 0, sz * (d / 2 - 0.0225))));
    B(g, w - 0.09, 0.08, d - 0.09, white, 0, 0.3, 0, 0.03); [-1, 1].forEach((sz) => B(g, w, 0.5, 0.03, P, 0, 0.3, sz * (d / 2 - 0.015)));
    [-1, 1].forEach((sx) => { B(g, 0.035, 0.035, d, P, sx * (w / 2 - 0.0175), h - 0.04, 0); for (let i = 0; i < 12; i += 1) B(g, 0.015, 0.5, 0.015, P, sx * (w / 2 - 0.0175), 0.34, -d / 2 + 0.07 + ((d - 0.14) * i) / 11); });
  },
  bunkBed(g, c) {
    const { w, d, h, P } = c; const mat = solid('#EDE8DD', { roughness: 0.95 });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => B(g, 0.07, h, 0.07, P, sx * (w / 2 - 0.035), 0, sz * (d / 2 - 0.035))));
    [0.25, 1.0].forEach((y) => { B(g, w, 0.05, d, P, 0, y, 0, 0.01); B(g, w - 0.1, 0.16, d - 0.1, mat, 0, y + 0.05, 0, 0.04); });
    [-1, 1].forEach((sx) => B(g, 0.03, 0.3, d * 0.62, P, sx * (w / 2 - 0.035), 1.21, -d * 0.18));
    [-1, 1].forEach((s) => B(g, 0.035, 1.2, 0.035, P, s * 0.17, 0.1, d / 2 - 0.05)); for (let i = 0; i < 5; i += 1) B(g, 0.34, 0.03, 0.03, P, 0, 0.3 + i * 0.2, d / 2 - 0.05);
  }
};

/** Builds the 3D model of an item. Origin: center of its footprint on the floor (meters). */
export function buildItemMesh(item) {
  const def = getItemDef(item.type);
  const size = getItemSize(item);
  const group = new THREE.Group();
  const c = {
    w: size.w / 100, d: size.d / 100, h: size.h / 100, p: def.params || {},
    P: getSurfaceMaterial(item.material, item.color, 'item'),
    T: getSolidMaterial(item.trim, { roughness: 0.45, metalness: 0.5 }),
    A: getSurfaceMaterial('metal-brushed', '#D9D9D6', 'item')
  };
  (BUILDERS[def.builder] || BUILDERS.ottoman)(group, c);
  group.userData.itemId = item.id;
  return group;
}

/** Frees geometries of a built item (materials and textures are shared and cached). */
export function disposeGroup(group) { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }