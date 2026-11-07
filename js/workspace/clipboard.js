// js/workspace/clipboard.js — copy / paste / duplicate for items, free walls and areas (all through the shared state).
import { getState, getUi, mutate, setUi, uid } from '../state.js';
import { showToast } from '../ui.js';
let clip = null;
const OFFSET = 50;
const find = (c, sel) => (sel.kind === 'item' ? c.items.find((i) => i.id === sel.id) : sel.kind === 'fwall' ? c.walls.find((w) => w.id === sel.id) : sel.kind === 'slab' ? c.slabs.find((s) => s.id === sel.id) : null);
export const canCopy = () => { const s = getUi().selection; return !!(s && ['item', 'fwall', 'slab'].includes(s.kind)); };
export const hasClipboard = () => !!clip;
export function copySelection() {
  const sel = getUi().selection; const src = sel && find(getState(), sel);
  if (!src) { showToast('Select a piece of furniture, wall or area to copy.', 'info'); return false; }
  clip = { kind: sel.kind, data: JSON.parse(JSON.stringify(src)), pastes: 0 }; showToast('Copied', 'success'); return true;
}
export function pasteClipboard() {
  if (!clip) { showToast('Nothing to paste yet.', 'info'); return false; }
  clip.pastes += 1; const d = OFFSET * clip.pastes; let newId = null; const level = getUi().level;
  const ok = mutate((c) => {
    const n = JSON.parse(JSON.stringify(clip.data)); n.level = level;
    if (clip.kind === 'item') { if (c.items.length >= 400) return; n.id = uid('item'); n.x += d; n.z += d; c.items.push(n); }
    else if (clip.kind === 'fwall') { if (c.walls.length >= 160) return; n.id = uid('fw'); n.x1 += d; n.x2 += d; n.z1 += d; n.z2 += d; (n.openings || []).forEach((o) => { o.id = uid('open'); }); c.walls.push(n); }
    else { if (c.slabs.length >= 80) return; n.id = uid('slab'); n.x += d; n.z += d; n.name = `${n.name} copy`; c.slabs.push(n); }
    newId = n.id;
  }, 'paste');
  if (!ok || !newId) { showToast('Could not paste (limit reached or not allowed on this floor).', 'error'); return false; }
  setUi({ selection: clip.kind === 'item' ? { kind: 'item', id: newId } : clip.kind === 'fwall' ? { kind: 'fwall', id: newId } : { kind: 'slab', id: newId } }); return true;
}
export function duplicateSelection() { if (!copySelection()) return false; return pasteClipboard(); }
export function deleteSelection(actions) {
  const sel = getUi().selection; if (!sel) return false;
  const m = { item: () => actions.deleteItem(sel.id), opening: () => actions.deleteOpening(sel.id, sel.side, sel.openingId), fopening: () => actions.deleteFreeOpening(sel.id, sel.openingId), fwall: () => actions.deleteFreeWall(sel.id), slab: () => actions.deleteSlab(sel.id), room: () => actions.deleteRoom(sel.id) };
  if (!m[sel.kind]) { showToast('Walls that belong to a room cannot be deleted on their own. Hide the wall in the inspector or delete the room.', 'info'); return false; }
  m[sel.kind](); return true;
}
