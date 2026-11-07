// js/materials.js — Three.js materials (shared + cached) and lighting parameters.
import * as THREE from 'three';
import { getMaterial } from './catalog.js';
import { paintMaterialCanvas } from './textures.js';

const textures = new Map(); const surfaces = new Map(); const solids = new Map();

/** mode 'world': UV in centimeters (floors/walls). mode 'item': UV 0..1 repeated 2x (furniture). */
export function getTexture(id, mode = 'world') {
  const key = `${id}|${mode}`;
  if (textures.has(key)) return textures.get(key);
  const def = getMaterial(id);
  const canvas = paintMaterialCanvas(def, 512);
  let tex = null;
  if (canvas) {
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    if (mode === 'world') tex.repeat.set(1 / def.tileCm, 1 / def.tileCm); else tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  }
  textures.set(key, tex);
  return tex;
}
export function getSurfaceMaterial(id, tint = '#FFFFFF', mode = 'world') {
  const key = `${id}|${tint}|${mode}`;
  if (surfaces.has(key)) return surfaces.get(key);
  const def = getMaterial(id) || getMaterial('paint');
  const mat = new THREE.MeshStandardMaterial({ map: getTexture(def.id, mode), color: tint, roughness: def.roughness, metalness: def.metalness });
  surfaces.set(key, mat);
  return mat;
}
export function getSolidMaterial(color, { roughness = 0.6, metalness = 0, transparent = false, opacity = 1 } = {}) {
  const key = `${color}|${roughness}|${metalness}|${transparent}|${opacity}`;
  if (solids.has(key)) return solids.get(key);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity, depthWrite: !transparent });
  solids.set(key, mat);
  return mat;
}

export const LIGHTING_RENDER = {
  daylight: { background: '#DDE7EC', hemiSky: '#FFFFFF', hemiGround: '#C8BFAE', hemi: 1.1, ambient: 0.18, sunColor: '#FFF3DC', sun: 3.2, sunPosition: [-8, 6, 3], lampColor: '#FFD9A0', lamp: 0, exposure: 1.0 },
  'warm-evening': { background: '#2B2420', hemiSky: '#FFD7A8', hemiGround: '#3A2A20', hemi: 0.55, ambient: 0.28, sunColor: '#FF9A55', sun: 1.4, sunPosition: [-9, 2.6, 2], lampColor: '#FFB66B', lamp: 16, exposure: 1.05 },
  neutral: { background: '#E6E4DF', hemiSky: '#FFFFFF', hemiGround: '#D2CEC4', hemi: 1.0, ambient: 0.22, sunColor: '#FFFFFF', sun: 2.2, sunPosition: [3, 9, 6], lampColor: '#FFE4B8', lamp: 5, exposure: 1.0 }
};
const WARM = new THREE.Color('#FFB27A'); const COOL = new THREE.Color('#B9D4FF');
export function temperatureTint(t) {
  const tint = new THREE.Color(1, 1, 1);
  if (t < 0.5) tint.lerp(WARM, (0.5 - t) * 2 * 0.8); else tint.lerp(COOL, (t - 0.5) * 2 * 0.7);
  return tint;
}