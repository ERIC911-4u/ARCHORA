// js/workspace/shortcuts.js — keyboard shortcuts + reference dialog. Avoids browser-reserved combinations (Ctrl+W/T/N/R…).
import { el, openModal } from '../ui.js';

export const SHORTCUT_GROUPS = [
  ['File & edit', [['Ctrl/Cmd + S', 'Save'], ['Ctrl/Cmd + Z', 'Undo'], ['Ctrl/Cmd + Shift + Z  or  Ctrl + Y', 'Redo'], ['Ctrl/Cmd + C / V', 'Copy / Paste'], ['Ctrl/Cmd + D', 'Duplicate'], ['Delete / Backspace', 'Delete selection']]],
  ['Tools', [['V', 'Select / move'], ['W', 'Wall'], ['D', 'Door'], ['N', 'Window'], ['E', 'Erase'], ['R', 'Rotate selected furniture 90°'], ['Esc', 'Cancel the current operation / clear selection']]],
  ['View', [['F', 'Fit to view'], ['G', 'Toggle grid'], ['Space + drag', 'Pan the 2D plan (also middle mouse)'], ['Scroll', 'Zoom'], ['?', 'Show this reference']]],
  ['Drawing walls', [['Click', 'Place a point; click the start point or double-click to finish'], ['Type 4500 + Enter', 'Exact length in the current unit'], ['Right-click', 'Finish the wall chain']]]
];

export function showShortcuts() {
  openModal({
    title: 'Keyboard shortcuts',
    body: el('div', { class: 'ws-keys' }, SHORTCUT_GROUPS.map(([title, rows]) => el('section', {}, el('h3', { text: title }), el('dl', {}, rows.flatMap(([k, d]) => [el('dt', {}, el('kbd', { text: k })), el('dd', { text: d })]))))),
    actions: [{ label: 'Close', variant: 'primary' }]
  });
}

/** h: { undo, redo, save, copy, paste, duplicate, del, rotate, escape, fit, toggleGrid, tool(patch), help }. Returns a dispose function. */
export function installShortcuts(h) {
  const TOOLS = { v: { tool: 'move', placeItem: null }, w: 'wall', d: 'door', n: 'window', e: { tool: 'eraser', placeItem: null } };
  function onKey(e) {
    const t = e.target;
    if (document.querySelector('.modal-backdrop')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey; const key = e.key.toLowerCase();
    if (mod) {
      const m = { s: h.save, z: e.shiftKey ? h.redo : h.undo, y: h.redo, c: h.copy, v: h.paste, d: h.duplicate }[key];
      if (m) { e.preventDefault(); m(); } return;
    }
    if (e.altKey) return;
    if (e.key === 'Escape') { h.escape(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); h.del(); return; }
    if (e.key === '?') { h.help(); return; }
    if (key === 'g') { h.toggleGrid(); return; }
    if (key === 'f') { e.preventDefault(); h.fit(); return; }
    if (key === 'r') { h.rotate(); return; }
    if (TOOLS[key]) { e.preventDefault(); h.tool(TOOLS[key]); }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
