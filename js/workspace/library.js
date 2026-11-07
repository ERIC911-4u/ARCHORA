// js/workspace/library.js — Asset Library drawer: category filters, search, sort, favorites, recently used, click-to-place.
import { el } from '../ui.js';
import { setUi, getUi } from '../state.js';
import { ITEMS, ITEM_CATEGORIES, getItemSize } from '../catalog.js';
import { getItemThumbnail } from '../thumbnails.js';
import { icon } from './icons.js';

const KEYS = { fav: 'archora.assets.fav', recent: 'archora.assets.recent' };
const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 40) : []; } catch (e) { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: favourites just won't persist */ } };

export function createLibrary({ onClose }) {
  let scope = { title: 'Asset Library', cats: ITEM_CATEGORIES.map((c) => c.id) }; let query = ''; let tab = 'all'; let sort = 'name'; let cat = 'all'; let fav = read(KEYS.fav); let recent = read(KEYS.recent);
  const queue = []; let pumping = false;
  const root = el('aside', { class: 'ws-lib', 'aria-label': 'Asset library', hidden: true });
  const title = el('h2', { class: 'ws-lib__title' });
  const search = el('input', { type: 'search', class: 'ws-input', placeholder: 'Search assets…', 'aria-label': 'Search assets', autocomplete: 'off' });
  const tabs = el('div', { class: 'ws-seg', role: 'tablist' });
  const chips = el('div', { class: 'ws-lib__chips' });
  const sortSel = el('select', { class: 'ws-input ws-input--sm', 'aria-label': 'Sort assets' }, [['name', 'Name'], ['size', 'Footprint']].map(([v, t]) => el('option', { value: v, text: t })));
  const grid = el('div', { class: 'ws-lib__grid', role: 'list' });
  const count = el('p', { class: 'ws-lib__count', role: 'status' });
  root.append(el('header', { class: 'ws-lib__head' }, title, el('button', { type: 'button', class: 'ws-iconbtn', 'aria-label': 'Close library', title: 'Close', onclick: () => api.close() }, icon('close', 16))), search, tabs, chips, el('div', { class: 'ws-lib__row' }, count, sortSel), grid);

  const pump = () => {
    if (pumping) return; pumping = true;
    const step = () => { let n = 0; while (queue.length && n < 3) { const job = queue.shift(); if (job.img.isConnected) { const url = getItemThumbnail(job.id); if (url) job.img.src = url; else job.img.replaceWith(el('span', { class: 'ws-lib__noimg', text: 'No preview' })); } n += 1; } if (queue.length) requestAnimationFrame(step); else pumping = false; };
    requestAnimationFrame(step);
  };
  const inScope = (d) => (scope.cats.includes(d.category) || (scope.extra || []).includes(d.id)) && (!scope.match || scope.match(d) || (scope.extra || []).includes(d.id));
  function list() {
    let items = ITEMS.filter(inScope);
    if (cat !== 'all') items = items.filter((d) => d.category === cat);
    if (tab === 'fav') items = items.filter((d) => fav.includes(d.id)); if (tab === 'recent') items = recent.map((id) => items.find((d) => d.id === id)).filter(Boolean);
    const q = query.trim().toLowerCase(); if (q) items = items.filter((d) => `${d.name} ${d.id} ${d.category}`.toLowerCase().includes(q));
    if (tab !== 'recent') items = [...items].sort((a, b) => (sort === 'size' ? b.size.w * b.size.d - a.size.w * a.size.d : a.name.localeCompare(b.name)));
    return items;
  }
  function renderTabs() { tabs.replaceChildren(...[['all', 'All'], ['fav', `Favorites (${fav.length})`], ['recent', 'Recent']].map(([id, t]) => el('button', { type: 'button', role: 'tab', class: 'ws-seg__btn', 'aria-selected': String(tab === id), text: t, onclick: () => { tab = id; renderAll(); } }))); }
  function renderChips() {
    const present = ITEM_CATEGORIES.filter((c) => ITEMS.some((d) => d.category === c.id && inScope(d)));
    chips.hidden = present.length < 2; chips.replaceChildren(...[{ id: 'all', name: 'All' }, ...present].map((c) => el('button', { type: 'button', class: 'ws-chip', 'aria-pressed': String(cat === c.id), text: c.name, onclick: () => { cat = c.id; renderAll(); } })));
  }
  function renderGrid() {
    const items = list(); queue.length = 0; count.textContent = `${items.length} asset${items.length === 1 ? '' : 's'}`;
    if (!items.length) { grid.replaceChildren(el('p', { class: 'ws-lib__empty', text: tab === 'fav' ? 'No favorites yet. Click the star on an asset.' : tab === 'recent' ? 'Nothing placed yet.' : 'No assets match your search.' })); return; }
    const current = getUi().placeItem;
    grid.replaceChildren(...items.map((d) => {
      const img = el('img', { alt: '', width: '72', height: '72', class: 'ws-lib__thumb' }); queue.push({ id: d.id, img });
      const s = getItemSize({ type: d.id }); const isFav = fav.includes(d.id);
      const star = el('button', { type: 'button', class: 'ws-lib__star', 'aria-label': `${isFav ? 'Remove' : 'Add'} ${d.name} ${isFav ? 'from' : 'to'} favorites`, 'aria-pressed': String(isFav), title: 'Favorite', onclick: (e) => { e.stopPropagation(); fav = isFav ? fav.filter((x) => x !== d.id) : [d.id, ...fav]; write(KEYS.fav, fav); renderAll(); } }, icon('star', 14));
      const card = el('div', { class: 'ws-lib__card', role: 'listitem' }, el('button', { type: 'button', class: 'ws-lib__item', 'aria-pressed': String(current === d.id), title: `${d.name} — click, then click in the plan to place`, onclick: () => { recent = [d.id, ...recent.filter((x) => x !== d.id)].slice(0, 24); write(KEYS.recent, recent); setUi({ tool: 'place-item', placeItem: d.id }); renderGrid(); } }, img, el('span', { class: 'ws-lib__name', text: d.name }), el('span', { class: 'ws-lib__dim', text: `${s.w} × ${s.d} × ${s.h} cm` })), star);
      return card;
    })); pump();
  }
  function renderAll() { title.textContent = scope.title; renderTabs(); renderChips(); renderGrid(); }
  search.addEventListener('input', () => { query = search.value; renderGrid(); }); sortSel.addEventListener('change', () => { sort = sortSel.value; renderGrid(); });
  const api = {
    element: root,
    open(next) { scope = next ? { ...next } : { title: 'Asset Library', cats: ITEM_CATEGORIES.map((c) => c.id) }; cat = 'all'; query = ''; search.value = ''; tab = 'all'; root.hidden = false; renderAll(); search.focus({ preventScroll: true }); },
    close() { root.hidden = true; onClose && onClose(); },
    get isOpen() { return !root.hidden; },
    refresh() { if (!root.hidden) renderGrid(); }
  };
  return api;
}
