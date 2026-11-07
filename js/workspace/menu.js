// js/workspace/menu.js — dropdown and context menus (keyboard accessible: arrows, Enter, Esc).
import { el } from '../ui.js';
let open = null;
export function closeMenu() { if (open) { open.cleanup(); open = null; } }

/** entries: [{ label, onClick, shortcut?, checked?, disabled?, separator?, header? }] */
function build(entries, close) {
  const menu = el('div', { class: 'ws-menu', role: 'menu' });
  entries.forEach((e) => {
    if (e.separator) { menu.append(el('div', { class: 'ws-menu__sep', role: 'separator' })); return; }
    if (e.header) { menu.append(el('div', { class: 'ws-menu__header', text: e.header })); return; }
    const b = el('button', { type: 'button', class: 'ws-menu__item', role: e.checked === undefined ? 'menuitem' : 'menuitemcheckbox', disabled: e.disabled ? true : null, 'aria-checked': e.checked === undefined ? null : String(!!e.checked) },
      el('span', { class: 'ws-menu__check', text: e.checked ? '✓' : '' }), el('span', { class: 'ws-menu__label', text: e.label }), e.shortcut ? el('span', { class: 'ws-menu__key', text: e.shortcut }) : null);
    b.addEventListener('click', () => { close(); e.onClick && e.onClick(); }); menu.append(b);
  });
  menu.addEventListener('keydown', (ev) => {
    const items = [...menu.querySelectorAll('.ws-menu__item:not(:disabled)')]; const i = items.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length]?.focus(); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  });
  return menu;
}
function show(menu, x, y, anchor) {
  document.body.append(menu); const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`; menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
  const onDoc = (ev) => { if (!menu.contains(ev.target) && !(anchor && anchor.contains(ev.target))) closeMenu(); };
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeMenu(); anchor?.focus(); } };
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0); document.addEventListener('keydown', onKey, true);
  open = { cleanup() { document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey, true); menu.remove(); anchor?.setAttribute('aria-expanded', 'false'); } };
  menu.querySelector('.ws-menu__item:not(:disabled)')?.focus();
}
export function openMenu(anchor, entries) {
  const was = open; closeMenu(); if (was && anchor.getAttribute('aria-expanded') === 'true') return;
  const r = anchor.getBoundingClientRect(); anchor.setAttribute('aria-expanded', 'true'); show(build(entries, closeMenu), r.left, r.bottom + 4, anchor);
}
export function openContextMenu(x, y, entries) { closeMenu(); show(build(entries, closeMenu), x, y, null); }
