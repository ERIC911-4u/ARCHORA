// js/thumbnails.js — catalog thumbnails rendered from the SAME 3D builders (picture always matches the object).
import * as THREE from 'three';
import { createItem } from './catalog.js';
import { buildItemMesh, disposeGroup } from './furniture.js';

let renderer = null; let scene = null; let camera = null; let failed = false;
const cache = new Map();

function ensure() {
  if (renderer) return true;
  if (failed) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(144, 144, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#bdb5a6', 1.7));
    const light = new THREE.DirectionalLight('#ffffff', 2.2); light.position.set(3, 5, 4); scene.add(light);
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    return true;
  } catch (error) { failed = true; return false; }
}

/** Returns a PNG data URL for an item type, or null if WebGL is unavailable. */
export function getItemThumbnail(type) {
  if (cache.has(type)) return cache.get(type);
  if (!ensure()) return null;
  let url = null;
  try {
    const group = buildItemMesh(createItem(type, { id: 'thumb' }));
    scene.add(group); group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.2);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 0.95;
    camera.position.copy(center).add(new THREE.Vector3(0.75, 0.55, 0.95).normalize().multiplyScalar(dist));
    camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix(); camera.lookAt(center);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
    scene.remove(group); disposeGroup(group);
  } catch (error) { console.error('[thumbnails] failed for', type, error); }
  cache.set(type, url);
  return url;
}