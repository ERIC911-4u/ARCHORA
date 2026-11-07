// js/customizer.js — Studio sidebar, properties panel and status bar. Every control edits the shared state via actions.js.
import { el, showToast, confirmDialog } from './ui.js';
import { getState, getUi, setUi, subscribe, subscribeUi, mutate, findRoom, findItem, findFreeWall, findSlab, freeWallsOnLevel, slabsOnLevel } from './state.js';
import * as actions from './actions.js';
import {
  SIDES, SIDE_NAMES, ROOM_TYPES, OPENING_TYPES, STYLES, LIGHTING_PRESETS, ITEM_CATEGORIES, WALL_COLORS, ITEM_COLORS, LEVEL_NAMES,
  materialsFor, itemsByCategory, getItemDef, getItemName, getItemSize, getStyleName, getLightingName, temperatureLabel,
  interiorSize, formatLength, formatArea, formatCurrency, calculateEstimate, getRoomTypeName, getMaterialName,
  SLAB_KINDS, getSlabKind, slabMaterials, WALL_PRESETS, wallLength
} from './catalog.js';
import { getMaterialPreview } from './textures.js';
import { getItemThumbnail } from './thumbnails.js';

const SECTIONS = [
  { id: 'house', label: 'House', desc: 'Floors, rooms and a quick overview. Click any room in the plan or 3D view to edit it.' },
  { id: 'build', label: 'Build', desc: 'Draw your own walls and floors and place doors and windows. No ready-made rooms needed.' },
  { id: 'garden', label: 'Garden', desc: 'Lawns, paths, ponds, fences, trees, plants and vehicles for the yard.' },
  { id: 'room', label: 'Room', desc: 'Name, type, position and size. Drag the handles in the plan or 3D view to resize.' },
  { id: 'walls', label: 'Walls', desc: 'Per-wall thickness, finish, color, doors and windows.' },
  { id: 'floor', label: 'Floor', desc: 'Textured floor finishes (drawn procedurally).' },
  { id: 'furniture', label: 'Furniture', desc: 'Add items, then drag them in the plan or 3D view, or fine-tune here.' },
  { id: 'style', label: 'Style', desc: 'Presets restyle walls, floors, furniture colors and lighting.' },
  { id: 'lighting', label: 'Lighting', desc: 'Presets, brightness and color temperature.' },
  { id: 'summary', label: 'Summary', desc: 'Dimensions, areas and an illustrative budget.' }
];

let idc = 0;

export function createCustomizer({ sidebar, panel, status }) {
  let activeId = 'house'; let section = null; let sectionKey = ''; let bindings = [];
  let wallSide = 'n'; let category = 'seating'; let gardenCat = 'garden'; let autoPlace = false; let floorScope = 'room'; let counter = 0; let lastSel = '';
  const disposers = [];
  const bind = (fn) => { bindings.push(fn); fn(); };
  const units = () => getUi().units;

  function currentRoom() {
    const st = getState(); const ui = getUi(); const sel = ui.selection;
    if (sel && sel.kind !== 'item') { const r = findRoom(st, sel.id); if (r) return r; }
    if (sel && sel.kind === 'item') {
      const it = findItem(st, sel.id);
      const r = it && st.rooms.find((x) => x.level === it.level && it.x >= x.x && it.x <= x.x + x.w && it.z >= x.z && it.z <= x.z + x.d);
      if (r) return r;
    }
    return st.rooms.find((x) => x.level === ui.level) || st.rooms[0] || null;
  }

  /* ---------- field builders ---------- */
  function numField(label, get, set, { min = 0, max = 10000, step = 1, hint = true } = {}) {
    const id = `nf-${++idc}`;
    const input = el('input', { type: 'number', id, class: 'field__input', min: String(min), max: String(max), step: String(step) });
    const hintEl = el('span', { class: 'field__hint' });
    const refresh = () => {
      const v = get(); if (v === undefined || v === null) return;
      if (document.activeElement !== input) input.value = String(Math.round(v * 10) / 10);
      hintEl.textContent = hint ? formatLength(v, units()) : '';
    };
    input.addEventListener('change', () => {
      const v = Number(input.value);
      if (input.value !== '' && Number.isFinite(v)) set(Math.min(max, Math.max(min, v)));
      refresh();
    });
    bind(refresh);
    return el('div', { class: 'num-field' }, el('label', { class: 'field__label', for: id, text: label }), input, hintEl);
  }

  function rangeField(label, get, set, { min, max, step, format }) {
    const id = `rf-${++idc}`;
    const input = el('input', { type: 'range', id, min: String(min), max: String(max), step: String(step) });
    const out = el('output', { class: 'range-out', for: id });
    input.addEventListener('input', () => set(Number(input.value)));
    bind(() => { const v = get(); if (document.activeElement !== input) input.value = String(v); out.textContent = format(v); });
    return el('div', { class: 'range-field' }, el('label', { for: id, text: label }), input, out);
  }

  function textField(label, get, set, max = 40) {
    const id = `tf-${++idc}`;
    const input = el('input', { type: 'text', id, class: 'field__input', maxlength: String(max), autocomplete: 'off' });
    input.addEventListener('change', () => { if (input.value.trim()) set(input.value.trim()); else input.value = get(); });
    bind(() => { if (document.activeElement !== input) input.value = get(); });
    return el('div', { class: 'field' }, el('label', { class: 'field__label', for: id, text: label }), input);
  }

  function colorField(label, get, set, swatches = []) {
    const id = `cf-${++idc}`;
    const picker = el('input', { type: 'color', id, class: 'color-input', 'aria-label': `${label} (custom)` });
    picker.addEventListener('input', () => set(picker.value.toUpperCase()));
    const buttons = swatches.map((hex) => {
      const b = el('button', { type: 'button', class: 'swatch', role: 'radio', 'aria-checked': 'false', 'aria-label': hex, title: hex, onclick: () => set(hex.toUpperCase()) });
      b.style.setProperty('--swatch', hex); b._hex = hex.toUpperCase(); return b;
    });
    bind(() => {
      const cur = String(get()).toUpperCase();
      buttons.forEach((b) => { const on = b._hex === cur; b.classList.toggle('is-selected', on); b.setAttribute('aria-checked', String(on)); });
      if (document.activeElement !== picker) picker.value = cur.toLowerCase();
    });
    return el('div', { class: 'field' }, el('p', { class: 'field__label', text: label }),
      el('div', { class: 'swatch-grid', role: 'radiogroup', 'aria-label': label }, buttons), el('div', { class: 'control-row' }, el('label', { for: id, text: 'Custom' }), picker));
  }

  function materialGrid(target, getId, setId, getTint) { return materialGridOf(materialsFor(target), getId, setId, getTint); }
  function materialGridOf(list, getId, setId, getTint) {
    const buttons = list.map((m) => {
      const img = el('img', { alt: '', width: '72', height: '72' });
      const b = el('button', { type: 'button', class: 'mat-card', role: 'radio', 'aria-checked': 'false', title: m.name, onclick: () => setId(m.id) }, img, el('span', { text: m.name }));
      b._id = m.id; b._img = img; return b;
    });
    bind(() => {
      const cur = getId(); const tint = getTint ? getTint() : null;
      buttons.forEach((b) => {
        b.setAttribute('aria-checked', String(b._id === cur));
        const url = getMaterialPreview(b._id, { size: 72, tint });
        if (b._img.src !== url) b._img.src = url;
      });
    });
    return el('div', { class: 'mat-grid', role: 'radiogroup' }, buttons);
  }

  const btn = (text, onClick, cls = 'btn btn--ghost btn--sm') => el('button', { type: 'button', class: cls, text, onclick: onClick });
  const block = (title, ...kids) => el('div', { class: 'panel-block' }, title ? el('h3', { text: title }) : null, ...kids);
  const empty = (text) => el('p', { class: 'panel__note', text });

  /* ---------- sections ---------- */
  function houseSection() {
    const ui = getUi(); const st = getState();
    const levelButtons = [1, 2].map((n) => {
      const b = btn(`${n} floor${n > 1 ? 's' : ''}`, async () => {
        if (n === 1 && getState().levels.length === 2 && !(await confirmDialog({ title: 'Remove the first floor?', message: 'All rooms and furniture on the first floor will be removed (you can undo).', confirmLabel: 'Remove', danger: true }))) return;
        actions.setStoreys(n);
      });
      b._n = n; return b;
    });
    bind(() => levelButtons.forEach((b) => b.classList.toggle('btn--primary', b._n === getState().levels.length)));
    const heights = st.levels.map((_, i) => numField(`${LEVEL_NAMES[i]} height`, () => getState().levels[i]?.height, (v) => actions.setLevelHeight(i, v), { min: 220, max: 450, step: 5 }));
    const typeSelect = el('select', { class: 'select', id: 'add-room-type', 'aria-label': 'Room type to add' }, ROOM_TYPES.map((r) => el('option', { value: r.id, text: r.name })));
    const addBtn = btn(`Add to ${LEVEL_NAMES[ui.level]}`, () => {
      const id = actions.addRoom(typeSelect.value, getUi().level);
      if (id) { setUi({ selection: { kind: 'room', id } }); showToast('Room added with default furniture', 'success'); }
    }, 'btn btn--primary btn--sm');
    const list = el('div', { class: 'room-list' }, st.rooms.filter((r) => r.level === ui.level).map((r) =>
      el('button', { type: 'button', class: 'room-btn', onclick: () => setUi({ selection: { kind: 'room', id: r.id } }) },
        el('span', { text: r.name }), el('small', { text: `${formatLength(r.w, units())} × ${formatLength(r.d, units())}` }))));
    bind(() => { const sel = getUi().selection; [...list.children].forEach((b, i) => { const r = getState().rooms.filter((x) => x.level === getUi().level)[i]; b.classList.toggle('is-selected', !!sel && !!r && sel.kind === 'room' && sel.id === r.id); }); });
    return el('div', { class: 'panel-stack' },
      block('Floors', el('div', { class: 'row' }, levelButtons), ...heights),
      block(`Rooms on ${LEVEL_NAMES[ui.level]}`, list.children.length ? list : empty('No rooms on this floor yet.'), el('div', { class: 'row' }, typeSelect, addBtn)),
      empty('Tip: click a floor to select a room, click it again and drag to move it. Gold dots resize the room. Click walls, doors or windows to edit them.'));
  }

  function roomSection() {
    const room = currentRoom(); if (!room) return empty('There are no rooms yet. Add one in the House tab.');
    const id = room.id; const get = () => findRoom(getState(), id);
    const typeSelect = el('select', { class: 'select', id: 'room-type', 'aria-label': 'Room type' }, ROOM_TYPES.map((r) => el('option', { value: r.id, text: r.name })));
    typeSelect.addEventListener('change', () => actions.setRoom(id, { type: typeSelect.value }));
    const area = el('p', { class: 'panel__note' });
    bind(() => { const r = get(); if (!r) return; typeSelect.value = r.type; const i = interiorSize(r); area.textContent = `Interior ${formatLength(i.w, units())} × ${formatLength(i.d, units())} = ${formatArea(i.w * i.d)} (walls measured from their centre line: ${formatLength(r.w, units())} × ${formatLength(r.d, units())})`; });
    return el('div', { class: 'panel-stack' },
      block(room.name,
        textField('Name', () => get()?.name ?? '', (v) => actions.setRoom(id, { name: v })),
        el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'room-type', text: 'Type' }), typeSelect),
        el('div', { class: 'num-grid' },
          numField('Width (cm)', () => get()?.w, (v) => actions.resizeRoom(id, { w: v }), { min: 150, max: 1500, step: 5 }),
          numField('Depth (cm)', () => get()?.d, (v) => actions.resizeRoom(id, { d: v }), { min: 150, max: 1500, step: 5 }),
          numField('Position X (cm)', () => get()?.x, (v) => actions.moveRoom(id, v, get().z), { min: -3000, max: 3000, step: 5 }),
          numField('Position Z (cm)', () => get()?.z, (v) => actions.moveRoom(id, get().x, v), { min: -3000, max: 3000, step: 5 })),
        area),
      block('Actions', el('div', { class: 'row' },
        btn('Duplicate', () => { const n = actions.duplicateRoom(id); if (n) setUi({ selection: { kind: 'room', id: n } }); }),
        btn('Furnish again', async () => { if (await confirmDialog({ title: 'Replace furniture?', message: `Furniture inside “${get().name}” will be replaced with the default layout for its type.`, confirmLabel: 'Replace' })) actions.refurnishRoom(id); }),
        btn('Delete room', async () => { if (await confirmDialog({ title: 'Delete room?', message: `“${get().name}” and the furniture inside it will be removed (you can undo).`, confirmLabel: 'Delete', danger: true })) actions.deleteRoom(id); }, 'btn btn--danger btn--sm'))));
  }

  function openingCard(roomId, side, o) {
    const getO = () => findRoom(getState(), roomId)?.walls[side].openings.find((x) => x.id === o.id);
    const sel = getUi().selection; const isSel = sel?.kind === 'opening' && sel.openingId === o.id;
    const typeSelect = el('select', { class: 'select', 'aria-label': 'Opening type' }, OPENING_TYPES.map((t) => el('option', { value: t.id, text: t.name })));
    typeSelect.addEventListener('change', () => actions.setOpening(roomId, side, o.id, { type: typeSelect.value }));
    bind(() => { const cur = getO(); if (cur) typeSelect.value = cur.type; });
    const set = (patch) => actions.setOpening(roomId, side, o.id, patch);
    return el('div', { class: `opening-card${isSel ? ' is-selected' : ''}` },
      el('div', { class: 'opening-card__head' }, typeSelect, btn('Delete', () => actions.deleteOpening(roomId, side, o.id), 'btn btn--danger btn--sm')),
      el('div', { class: 'num-grid' },
        numField('Position (cm)', () => getO()?.center, (v) => set({ center: v }), { min: 20, max: 1500, step: 5 }),
        numField('Width (cm)', () => getO()?.width, (v) => set({ width: v }), { min: 40, max: 500, step: 5 }),
        numField('Height (cm)', () => getO()?.height, (v) => set({ height: v }), { min: 40, max: 320, step: 5 }),
        numField('Sill (cm)', () => getO()?.sill, (v) => set({ sill: v }), { min: 0, max: 250, step: 5 })));
  }

  function wallsSection() {
    const room = currentRoom(); if (!room) return empty('There are no rooms yet.');
    const id = room.id; const side = wallSide; const get = () => findRoom(getState(), id)?.walls[side];
    const tabs = el('div', { class: 'side-tabs', role: 'group', 'aria-label': 'Choose wall' }, SIDES.map((s) =>
      el('button', { type: 'button', class: `btn btn--sm ${s === side ? 'btn--primary' : 'btn--ghost'}`, text: SIDE_NAMES[s], onclick: () => { wallSide = s; setUi({ selection: { kind: 'wall', id, side: s } }); refresh(true); } })));
    const visible = el('input', { type: 'checkbox', class: 'switch', id: 'wall-visible' });
    visible.addEventListener('change', () => actions.setWall(id, side, { visible: visible.checked }));
    bind(() => { const w = get(); if (w) visible.checked = w.visible; });
    const w0 = get();
    return el('div', { class: 'panel-stack' },
      block(`${room.name}: ${SIDE_NAMES[side]} wall`, tabs,
        el('label', { class: 'field__check' }, visible, ' Show this wall (turn off for open-plan spaces)'),
        numField('Thickness (cm)', () => get()?.thickness, (v) => actions.setWall(id, side, { thickness: Math.round(v) }, 'thick'), { min: 5, max: 40, step: 1 }),
        el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Finish (texture)' }), materialGrid('wall', () => get()?.material, (m) => actions.setWall(id, side, { material: m }), () => get()?.color)),
        colorField('Color / tint', () => get()?.color ?? '#FFFFFF', (c) => actions.setWall(id, side, { color: c }, 'wcolor'), WALL_COLORS.map((c) => c.hex)),
        el('div', { class: 'row' }, btn('Apply to all 4 walls', () => { actions.applyWallToAll(id, side); showToast('Applied to all walls of this room', 'success'); }))),
      block('Doors and windows',
        ...(w0.openings.length ? w0.openings.map((o) => openingCard(id, side, o)) : [empty('No openings on this wall. Shared walls also show the neighbour room’s openings.')]),
        el('div', { class: 'row' }, OPENING_TYPES.map((t) => btn(`+ ${t.name}`, () => { const n = actions.addOpening(id, side, t.id); if (n) setUi({ selection: { kind: 'opening', id, side, openingId: n } }); })))));
  }

  function floorSection() {
    const room = currentRoom(); if (!room) return empty('There are no rooms yet.');
    const id = room.id; const get = () => findRoom(getState(), id);
    const scope = el('select', { class: 'select', id: 'floor-scope', 'aria-label': 'Apply floor finish to' },
      [['room', 'This room only'], ['level', 'Whole floor'], ['house', 'Whole house']].map(([v, t]) => el('option', { value: v, text: t, selected: v === floorScope ? true : null })));
    scope.addEventListener('change', () => { floorScope = scope.value; });
    return el('div', { class: 'panel-stack' },
      block(`${room.name}: floor`,
        el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'floor-scope', text: 'Apply to' }), scope),
        materialGrid('floor', () => get()?.floorMaterial, (m) => actions.setFloorMaterial(floorScope, id, get().level, m), () => get()?.floorColor),
        colorField('Tint (optional)', () => get()?.floorColor ?? '#FFFFFF', (c) => actions.setRoom(id, { floorColor: c }, 'ftint'), []),
        el('div', { class: 'row' }, btn('Remove tint', () => actions.setRoom(id, { floorColor: null })))),
      empty('Floor textures are generated procedurally in the browser. They are not photographs.'));
  }

  function furnitureSection() {
    const ui = getUi(); const st = getState(); const sel = ui.selection;
    const room = currentRoom();
    const library = itemLibrary(ITEM_CATEGORIES, () => category, (c) => { category = c; refresh(true); }, `Add to ${room ? room.name : LEVEL_NAMES[ui.level]}`);
    if (!sel || sel.kind !== 'item') return el('div', { class: 'panel-stack' }, library, empty('Click a piece of furniture in the 3D view to edit its color, texture, size and position.'));

    const id = sel.id; const it0 = findItem(st, id); if (!it0) return library;
    const get = () => findItem(getState(), id); const set = (patch, key) => actions.setItem(id, patch, key);
    const visible = el('input', { type: 'checkbox', class: 'switch', id: 'item-visible' });
    visible.addEventListener('change', () => set({ visible: visible.checked }));
    bind(() => { const i = get(); if (i) visible.checked = i.visible; });
    const sizeOf = () => { const i = get(); return i ? getItemSize(i) : { w: 0, d: 0, h: 0 }; };
    const setSize = (k, v) => { const s = sizeOf(); set({ size: { w: s.w, d: s.d, h: s.h, [k]: Math.round(v) } }); };
    return el('div', { class: 'panel-stack' },
      block(getItemName(it0.type),
        el('label', { class: 'field__check' }, visible, ' Visible'),
        el('div', { class: 'num-grid' },
          numField('Position X (cm)', () => get()?.x, (v) => set({ x: v }, 'pos'), { min: -3000, max: 3000, step: 1 }),
          numField('Position Z (cm)', () => get()?.z, (v) => set({ z: v }, 'pos'), { min: -3000, max: 3000, step: 1 }),
          numField('Width (cm)', () => sizeOf().w, (v) => setSize('w', v), { min: 5, max: 1000 }),
          numField('Depth (cm)', () => sizeOf().d, (v) => setSize('d', v), { min: 1, max: 1000 }),
          numField('Height (cm)', () => sizeOf().h, (v) => setSize('h', v), { min: 1, max: 500 }),
          numField('Elevation (cm)', () => get()?.y ?? getItemDef(get().type).y, (v) => set({ y: v }), { min: 0, max: 450 })),
        rangeField('Rotation', () => get()?.rot ?? 0, (v) => set({ rot: v }, 'rot'), { min: 0, max: 359, step: 5, format: (v) => `${Math.round(v)}°` }),
        el('div', { class: 'row' }, btn('Rotate 90°', () => actions.rotateItem(id, 90)), btn('Reset size', () => set({ size: null })), btn('Duplicate', () => { const n = actions.duplicateItem(id); if (n) setUi({ selection: { kind: 'item', id: n } }); }), btn('Delete', () => actions.deleteItem(id), 'btn btn--danger btn--sm'))),
      block('Color and texture',
        colorField('Main color', () => get()?.color ?? '#FFFFFF', (c) => set({ color: c }, 'color'), ITEM_COLORS),
        el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Texture' }), materialGrid('item', () => get()?.material, (m) => set({ material: m }), () => get()?.color)),
        colorField('Accent / legs', () => get()?.trim ?? '#2B2B29', (c) => set({ trim: c }, 'trim'), ['#2B2B29', '#B08D63', '#C9C9C6', '#8A5E3B'])),
      library);
  }

  /* ---------- item library (click an item, then click in the 3D view) ---------- */
  function itemLibrary(cats, getCat, setCat, title) {
    const room = currentRoom();
    const chips = el('div', { class: 'filter-bar', role: 'group', 'aria-label': 'Item categories' }, cats.map((c) =>
      el('button', { type: 'button', class: 'chip', text: c.name, 'aria-pressed': String(c.id === getCat()), onclick: () => setCat(c.id) })));
    const grid = el('div', { class: 'item-grid' }, itemsByCategory(getCat()).map((def) => {
      const url = getItemThumbnail(def.id);
      const thumb = el('div', { class: 'item-card__thumb' }, url ? el('img', { src: url, alt: def.name, width: '72', height: '72' }) : el('span', { text: def.name[0] }));
      const card = el('button', {
        type: 'button', class: 'item-card', title: `${def.name} (${def.size.w} × ${def.size.d} × ${def.size.h} cm)`,
        onclick: () => {
          if (autoPlace) { const n = actions.addItem(def.id, { roomId: room?.id, level: getUi().level }); if (n) { setUi({ selection: { kind: 'item', id: n } }); showToast(`${def.name} added`, 'success'); } return; }
          setUi({ tool: 'place-item', placeItem: def.id, selection: null }); showToast(`Click in the 3D view to place the ${def.name.toLowerCase()}. Esc cancels.`, 'info');
        }
      }, thumb, el('span', { text: def.name }));
      card._id = def.id; return card;
    }));
    bind(() => { const ui = getUi(); [...grid.children].forEach((c) => c.classList.toggle('is-selected', ui.tool === 'place-item' && ui.placeItem === c._id)); });
    const auto = el('input', { type: 'checkbox', class: 'switch', id: `auto-place-${++idc}` }); auto.checked = autoPlace;
    auto.addEventListener('change', () => { autoPlace = auto.checked; });
    return block(title, chips, grid, el('label', { class: 'field__check' }, auto, ' Add straight into the room (no clicking)'),
      empty('Click an item, then click in the 3D view. Wall items such as TVs and mirrors snap to the nearest wall; hold Shift to place several.'));
  }

  /* ---------- Build: draw walls and floors, place doors and windows ---------- */
  const TOOL_HINTS = {
    move: 'Select and move: click to select, drag the gold handles to resize or move ends.',
    select: 'Select only: click objects without moving them.',
    'draw-wall': 'Draw wall: click the start, then each corner. Click the last point twice (or press Esc) to finish.',
    'draw-slab': 'Draw floor / garden: click one corner, then the opposite corner.',
    'place-opening': 'Place door / window: click on any wall. Drag it afterwards to slide it along the wall.',
    'place-item': 'Place item: click in the 3D view. Shift keeps placing more.',
    eraser: 'Eraser: click a wall, floor area, door, window or furniture to delete it.'
  };
  function toolButtons() {
    const defs = [
      ['Select / move', { tool: 'move' }], ['Draw wall', { tool: 'draw-wall' }], ['Draw floor', { tool: 'draw-slab', slabKind: 'floor', slabMaterial: null }],
      ...OPENING_TYPES.map((t) => [`+ ${t.name}`, { tool: 'place-opening', placeOpening: t.id }]), ['Eraser', { tool: 'eraser' }]
    ];
    const buttons = defs.map(([label, patch]) => { const b = btn(label, () => setUi(patch)); b._patch = patch; return b; });
    const hint = el('p', { class: 'panel__note' });
    bind(() => {
      const ui = getUi();
      buttons.forEach((b) => { const p = b._patch; const on = ui.tool === p.tool && (p.tool !== 'place-opening' || ui.placeOpening === p.placeOpening) && (p.tool !== 'draw-slab' || true); b.classList.toggle('btn--primary', on); b.setAttribute('aria-pressed', String(on)); });
      hint.textContent = TOOL_HINTS[ui.tool] || '';
    });
    const ortho = el('input', { type: 'checkbox', class: 'switch', id: 'ortho-lock' });
    ortho.addEventListener('change', () => setUi({ ortho: ortho.checked }));
    bind(() => { ortho.checked = getUi().ortho; });
    return block('Tools', el('div', { class: 'row row--wrap' }, buttons), hint, el('label', { class: 'field__check' }, ortho, ' Keep walls straight (snap to horizontal / vertical)'));
  }

  function wallPresetBlock() {
    const get = () => getUi().wallPreset; const set = (patch) => setUi({ wallPreset: { ...getUi().wallPreset, ...patch } });
    const presets = WALL_PRESETS.map((p) => btn(p.name, () => setUi({ wallPreset: { thickness: p.thickness, height: p.height, material: p.material, color: p.color } })));
    return block('New wall style',
      el('div', { class: 'row row--wrap' }, presets),
      el('div', { class: 'num-grid' },
        numField('Thickness (cm)', () => get().thickness, (v) => set({ thickness: Math.round(v) }), { min: 5, max: 40 }),
        numField('Height (cm, 0 = full)', () => get().height ?? 0, (v) => set({ height: v < 30 ? null : Math.round(v) }), { min: 0, max: 450, step: 5, hint: false })),
      el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Finish' }), materialGrid('wall', () => get().material, (m) => set({ material: m }), () => get().color)),
      colorField('Color / tint', () => get().color, (c) => set({ color: c }), WALL_COLORS.map((c) => c.hex)));
  }

  function slabKindBlock(kinds, title) {
    const buttons = kinds.map((k) => { const b = btn(k.name, () => setUi({ tool: 'draw-slab', slabKind: k.id, slabMaterial: null })); b._id = k.id; return b; });
    bind(() => { const ui = getUi(); buttons.forEach((b) => b.classList.toggle('btn--primary', ui.tool === 'draw-slab' && ui.slabKind === b._id)); });
    return block(title, el('div', { class: 'row row--wrap' }, buttons),
      el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Surface for the next area' }),
        materialGridOf(slabMaterials('lawn'), () => getUi().slabMaterial || getSlabKind(getUi().slabKind).material, (m) => setUi({ slabMaterial: m }), null)));
  }

  function freeOpeningCard(wallId, o) {
    const getO = () => findFreeWall(getState(), wallId)?.openings.find((x) => x.id === o.id);
    const sel = getUi().selection; const isSel = sel?.kind === 'fopening' && sel.openingId === o.id;
    const typeSelect = el('select', { class: 'select', 'aria-label': 'Opening type' }, OPENING_TYPES.map((t) => el('option', { value: t.id, text: t.name })));
    typeSelect.addEventListener('change', () => actions.setFreeOpening(wallId, o.id, { type: typeSelect.value }));
    bind(() => { const cur = getO(); if (cur) typeSelect.value = cur.type; });
    const set = (patch) => actions.setFreeOpening(wallId, o.id, patch);
    return el('div', { class: `opening-card${isSel ? ' is-selected' : ''}` },
      el('div', { class: 'opening-card__head' }, typeSelect, btn('Select', () => setUi({ selection: { kind: 'fopening', id: wallId, openingId: o.id } })), btn('Delete', () => actions.deleteFreeOpening(wallId, o.id), 'btn btn--danger btn--sm')),
      el('div', { class: 'num-grid' },
        numField('Position (cm)', () => getO()?.center, (v) => set({ center: v }), { min: 20, max: 3000, step: 5 }),
        numField('Width (cm)', () => getO()?.width, (v) => set({ width: v }), { min: 40, max: 500, step: 5 }),
        numField('Height (cm)', () => getO()?.height, (v) => set({ height: v }), { min: 40, max: 320, step: 5 }),
        numField('Sill (cm)', () => getO()?.sill, (v) => set({ sill: v }), { min: 0, max: 250, step: 5 })));
  }

  function freeWallEditor(id) {
    const get = () => findFreeWall(getState(), id); const w0 = get(); if (!w0) return null;
    const pt = (k, label) => numField(label, () => get()?.[k], (v) => actions.setFreeWallPoints(id, { [k]: v }), { min: -3000, max: 3000, step: 5 });
    return block(`Wall · ${formatLength(wallLength(w0), units())}`,
      numField('Length (cm)', () => { const w = get(); return w ? wallLength(w) : undefined; }, (v) => actions.setFreeWallLength(id, v), { min: 20, max: 4000, step: 5 }),
      el('div', { class: 'num-grid' }, numField('Thickness (cm)', () => get()?.thickness, (v) => actions.setFreeWall(id, { thickness: Math.round(v) }, 'thick'), { min: 5, max: 40 }),
        numField('Height (cm, 0 = full)', () => get()?.height ?? 0, (v) => actions.setFreeWall(id, { height: v < 30 ? null : Math.round(v) }, 'height'), { min: 0, max: 450, step: 5, hint: false }),
        pt('x1', 'Start X (cm)'), pt('z1', 'Start Z (cm)'), pt('x2', 'End X (cm)'), pt('z2', 'End Z (cm)')),
      el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Finish (both sides)' }), materialGrid('wall', () => get()?.material, (m) => actions.setFreeWall(id, { material: m }), () => get()?.color)),
      colorField('Color / tint', () => get()?.color ?? '#FFFFFF', (c) => actions.setFreeWall(id, { color: c }, 'wcolor'), WALL_COLORS.map((c) => c.hex)),
      el('p', { class: 'field__label', text: 'Doors and windows' }),
      ...(w0.openings.length ? w0.openings.map((o) => freeOpeningCard(id, o)) : [empty('No openings yet. Use the + buttons or the door / window tool and click on the wall.')]),
      el('div', { class: 'row row--wrap' }, OPENING_TYPES.map((t) => btn(`+ ${t.name}`, () => { const n = actions.addFreeOpening(id, t.id); if (n) setUi({ selection: { kind: 'fopening', id, openingId: n } }); }))),
      el('div', { class: 'row' }, btn('Duplicate', () => { const n = actions.duplicateFreeWall(id); if (n) setUi({ selection: { kind: 'fwall', id: n } }); }), btn('Delete wall', () => actions.deleteFreeWall(id), 'btn btn--danger btn--sm')));
  }

  function slabEditor(id) {
    const get = () => findSlab(getState(), id); const s0 = get(); if (!s0) return null;
    const kinds = SLAB_KINDS.filter((k) => !(k.outdoor && s0.level > 0));
    const kindSelect = el('select', { class: 'select', id: 'slab-kind', 'aria-label': 'Area type' }, kinds.map((k) => el('option', { value: k.id, text: k.name })));
    kindSelect.addEventListener('change', () => actions.setSlab(id, { kind: kindSelect.value }));
    bind(() => { const s = get(); if (s) kindSelect.value = s.kind; });
    const area = el('p', { class: 'panel__note' });
    bind(() => { const s = get(); if (s) area.textContent = `${formatLength(s.w, units())} × ${formatLength(s.d, units())} = ${formatArea(s.w * s.d)}`; });
    return block(s0.name,
      textField('Name', () => get()?.name ?? '', (v) => actions.setSlab(id, { name: v })),
      el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'slab-kind', text: 'Type' }), kindSelect),
      el('div', { class: 'num-grid' },
        numField('Width (cm)', () => get()?.w, (v) => actions.resizeSlab(id, { w: Math.round(v / 5) * 5 }), { min: 20, max: 3000, step: 5 }),
        numField('Depth (cm)', () => get()?.d, (v) => actions.resizeSlab(id, { d: Math.round(v / 5) * 5 }), { min: 20, max: 3000, step: 5 }),
        numField('Position X (cm)', () => get()?.x, (v) => actions.resizeSlab(id, { x: Math.round(v / 5) * 5 }), { min: -3000, max: 3000, step: 5 }),
        numField('Position Z (cm)', () => get()?.z, (v) => actions.resizeSlab(id, { z: Math.round(v / 5) * 5 }), { min: -3000, max: 3000, step: 5 })),
      area,
      el('div', { class: 'field' }, el('p', { class: 'field__label', text: 'Surface' }), materialGridOf(slabMaterials(s0.kind), () => get()?.material, (m) => actions.setSlab(id, { material: m, color: null }), () => get()?.color)),
      colorField('Tint (optional)', () => get()?.color ?? '#FFFFFF', (c) => actions.setSlab(id, { color: c }, 'stint'), []),
      el('div', { class: 'row row--wrap' }, btn('Remove tint', () => actions.setSlab(id, { color: null })), btn('Build walls around', () => { actions.wallsAroundSlab(id, getUi().wallPreset); showToast('Walls added around the area', 'success'); }),
        btn('Duplicate', () => { const n = actions.duplicateSlab(id); if (n) setUi({ selection: { kind: 'slab', id: n } }); }), btn('Delete', () => actions.deleteSlab(id), 'btn btn--danger btn--sm')));
  }

  function selectedFreeEditor() {
    const sel = getUi().selection; if (!sel) return null;
    if (sel.kind === 'fwall' || sel.kind === 'fopening') return freeWallEditor(sel.id);
    if (sel.kind === 'slab') return slabEditor(sel.id);
    return null;
  }

  function objectLists() {
    const ui = getUi(); const st = getState(); const sel = ui.selection;
    const walls = freeWallsOnLevel(st, ui.level); const slabs = slabsOnLevel(st, ui.level);
    const row = (label, small, selection, on) => el('button', { type: 'button', class: `room-btn${on ? ' is-selected' : ''}`, onclick: () => setUi({ selection, tool: 'move' }) }, el('span', { text: label }), el('small', { text: small }));
    return block(`On ${LEVEL_NAMES[ui.level]}`,
      el('p', { class: 'field__label', text: `Free walls (${walls.length})` }),
      walls.length ? el('div', { class: 'room-list' }, walls.map((w, i) => row(`Wall ${i + 1}`, formatLength(wallLength(w), units()), { kind: 'fwall', id: w.id }, sel?.id === w.id && (sel.kind === 'fwall' || sel.kind === 'fopening')))) : empty('No free walls yet.'),
      el('p', { class: 'field__label', text: `Floors and garden areas (${slabs.length})` }),
      slabs.length ? el('div', { class: 'room-list' }, slabs.map((t) => row(t.name, `${formatLength(t.w, units())} × ${formatLength(t.d, units())}`, { kind: 'slab', id: t.id }, sel?.kind === 'slab' && sel.id === t.id))) : empty('No areas yet.'));
  }

  function buildSection() {
    const picked = selectedFreeEditor();
    return el('div', { class: 'panel-stack' }, toolButtons(), picked, wallPresetBlock(),
      slabKindBlock(SLAB_KINDS.filter((k) => !(k.outdoor && getUi().level > 0)), 'New floor or area'), objectLists(),
      empty('Rooms from the House tab still work. Mix them freely with your own walls, floors and gardens.'));
  }

  function gardenSection() {
    const picked = selectedFreeEditor();
    const fences = WALL_PRESETS.filter((p) => p.height).map((p) => btn(p.name, () => setUi({ tool: 'draw-wall', wallPreset: { thickness: p.thickness, height: p.height, material: p.material, color: p.color } })));
    return el('div', { class: 'panel-stack' }, picked,
      slabKindBlock(SLAB_KINDS.filter((k) => k.outdoor || k.id === 'terrace'), 'Garden areas'),
      block('Fences and boundary walls', el('div', { class: 'row row--wrap' }, fences), empty('Pick a style, then click points on the ground to draw.')),
      itemLibrary(ITEM_CATEGORIES.filter((c) => ['garden', 'vehicles'].includes(c.id)), () => (['garden', 'vehicles'].includes(gardenCat) ? gardenCat : 'garden'), (c) => { gardenCat = c; refresh(true); }, 'Plants, outdoor items and vehicles'));
  }

  function styleSection() {
    const buttons = STYLES.map((s) => {
      const b = el('button', { type: 'button', class: 'option', role: 'radio', 'aria-checked': 'false', onclick: () => { actions.applyStyle(s.id); showToast(`Style applied: ${s.name}`, 'success'); } },
        el('span', { class: 'option__text' }, el('span', { class: 'option__title', text: s.name }), el('span', { class: 'option__sub', text: s.description })));
      b._id = s.id; return b;
    });
    bind(() => buttons.forEach((b) => { const on = getState().style === b._id; b.classList.toggle('is-selected', on); b.setAttribute('aria-checked', String(on)); }));
    return el('div', { class: 'panel-stack' }, el('div', { class: 'option-list', role: 'radiogroup', 'aria-label': 'Interior style' }, buttons),
      empty('Applying a style replaces wall finishes, floors, furniture colors/textures and lighting everywhere. Positions and sizes are kept. You can undo.'));
  }

  function lightingSection() {
    const buttons = LIGHTING_PRESETS.map((p) => {
      const b = el('button', { type: 'button', class: 'option', role: 'radio', 'aria-checked': 'false', onclick: () => mutate((c) => { c.lighting = { preset: p.id, brightness: 1, temperature: p.temperature }; }, 'lighting') },
        el('span', { class: 'option__text' }, el('span', { class: 'option__title', text: p.name })));
      b._id = p.id; return b;
    });
    bind(() => buttons.forEach((b) => { const on = getState().lighting.preset === b._id; b.classList.toggle('is-selected', on); b.setAttribute('aria-checked', String(on)); }));
    return el('div', { class: 'panel-stack' }, el('div', { class: 'option-list', role: 'radiogroup', 'aria-label': 'Lighting preset' }, buttons),
      rangeField('Brightness', () => getState().lighting.brightness, (v) => mutate((c) => { c.lighting.brightness = v; }, 'lighting', { coalesce: 'bright' }), { min: 0.2, max: 1.5, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }),
      rangeField('Warm ↔ Cool', () => getState().lighting.temperature, (v) => mutate((c) => { c.lighting.temperature = v; }, 'lighting', { coalesce: 'temp' }), { min: 0, max: 1, step: 0.01, format: temperatureLabel }));
  }

  function summarySection() {
    const st = getState(); const u = units();
    const rows = st.rooms.map((r) => { const i = interiorSize(r); return el('tr', {}, el('td', { text: r.name }), el('td', { text: LEVEL_NAMES[r.level] }), el('td', { text: `${formatLength(i.w, u)} × ${formatLength(i.d, u)}` }), el('td', { text: formatArea(i.w * i.d) })); });
    const est = calculateEstimate(st);
    const house = st.rooms.length ? { w: Math.max(...st.rooms.map((r) => r.x + r.w)) - Math.min(...st.rooms.map((r) => r.x)), d: Math.max(...st.rooms.map((r) => r.z + r.d)) - Math.min(...st.rooms.map((r) => r.z)) } : { w: 0, d: 0 };
    return el('div', { class: 'panel-stack' },
      block('House', el('dl', { class: 'summary-list' },
        el('dt', { text: 'Style' }), el('dd', { text: getStyleName(st.style) }), el('dt', { text: 'Floors' }), el('dd', { text: `${st.levels.length} (${st.levels.map((l) => formatLength(l.height, u)).join(' + ')})` }),
        el('dt', { text: 'Footprint (outer)' }), el('dd', { text: `${formatLength(house.w, u)} × ${formatLength(house.d, u)}` }), el('dt', { text: 'Total floor area' }), el('dd', { text: formatArea(est.floorArea * 10000) }),
        el('dt', { text: 'Furniture items' }), el('dd', { text: String(st.items.filter((i) => i.visible).length) }), el('dt', { text: 'Lighting' }), el('dd', { text: `${getLightingName(st.lighting.preset)}, ${Math.round(st.lighting.brightness * 100)}%, ${temperatureLabel(st.lighting.temperature)}` }))),
      block('Rooms', el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['Room', 'Floor', 'Interior', 'Area'].map((h) => el('th', { text: h })))), el('tbody', {}, rows))),
      el('div', { class: 'estimate' }, el('h3', { text: 'Illustrative budget' }),
        el('ul', { class: 'estimate__list' }, est.rows.map((r) => el('li', {}, el('span', { text: r.label }), el('span', { text: formatCurrency(r.amount) })))),
        el('p', { class: 'estimate__total' }, el('span', { text: 'Total' }), el('strong', { text: formatCurrency(est.total) })),
        empty('Demonstration values only. This is not a construction quotation.')));
  }

  const FACTORIES = { house: houseSection, build: buildSection, garden: gardenSection, room: roomSection, walls: wallsSection, floor: floorSection, furniture: furnitureSection, style: styleSection, lighting: lightingSection, summary: summarySection };

  /* ---------- rendering ---------- */
  const categoryButtons = {};
  SECTIONS.forEach((s) => { const b = el('button', { type: 'button', class: 'category', text: s.label, onclick: () => showSection(s.id) }); categoryButtons[s.id] = b; sidebar.append(b); });

  function keyFor(id) {
    const st = getState(); const ui = getUi(); const r = currentRoom();
    switch (id) {
      case 'house': return `${st.levels.length}|${ui.level}|${st.rooms.filter((x) => x.level === ui.level).map((x) => `${x.id}:${x.name}`).join(',')}`;
      case 'build': case 'garden': {
        const sel = ui.selection; const w = sel && (sel.kind === 'fwall' || sel.kind === 'fopening') ? findFreeWall(st, sel.id) : null;
        return `${id}|${ui.level}|${sel ? `${sel.kind}:${sel.id}:${sel.openingId || ''}` : ''}|${w ? w.openings.map((o) => o.id + o.type).join(',') : ''}|${st.walls.map((x) => x.id).join(',')}|${st.slabs.map((x) => `${x.id}:${x.kind}:${x.name}`).join(',')}|${gardenCat}`;
      }
      case 'room': return r ? r.id : 'none';
      case 'walls': return r ? `${r.id}|${wallSide}|${r.walls[wallSide].openings.map((o) => o.id + o.type).join(',')}|${ui.selection?.openingId || ''}` : 'none';
      case 'floor': return r ? `${r.id}|${floorScope}` : 'none';
      case 'furniture': return `${ui.selection?.kind === 'item' ? ui.selection.id : ''}|${category}|${r ? r.id : ''}|${autoPlace}`;
      case 'summary': counter += 1; return `s${counter}`;
      default: return id;
    }
  }

  function build() {
    const meta = SECTIONS.find((s) => s.id === activeId); const keep = panel.scrollTop;
    bindings = [];
    const node = FACTORIES[activeId]();
    panel.replaceChildren(el('h2', { class: 'panel__title', text: meta.label }), el('p', { class: 'panel__desc', text: meta.desc }), node);
    sectionKey = keyFor(activeId); panel.scrollTop = keep;
    Object.entries(categoryButtons).forEach(([k, b]) => { const on = k === activeId; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }

  function refresh(force = false) {
    const key = keyFor(activeId);
    if (force || key !== sectionKey || !section) { section = true; build(); } else bindings.forEach((fn) => fn());
  }

  function showSection(id) { activeId = id; panel.scrollTop = 0; refresh(true); }

  function chip(label, value) { return el('span', { class: 'status-chip' }, el('span', { class: 'status-chip__label', text: label }), el('span', { text: value })); }
  function renderStatus(meta) {
    const st = getState(); const ui = getUi(); const est = calculateEstimate(st);
    status.replaceChildren(chip('Floor', LEVEL_NAMES[ui.level]), chip('Rooms', String(st.rooms.length)), chip('Area', formatArea(est.floorArea * 10000)),
      chip('Items', String(st.items.length)), ...(st.walls.length || st.slabs.length ? [chip('Walls / areas', `${st.walls.length} / ${st.slabs.length}`)] : []), chip('Style', getStyleName(st.style)), chip('Est. (demo)', formatCurrency(est.total)),
      el('span', { class: `status-chip status-chip--state${meta.dirty ? ' is-dirty' : ''}`, text: meta.dirty ? 'Unsaved changes' : 'All changes saved' }));
  }

  disposers.push(subscribe((state, meta) => { refresh(); renderStatus(meta); }));
  disposers.push(subscribeUi((ui) => {
    const sel = ui.selection; const k = sel ? `${sel.kind}:${sel.id}:${sel.side || ''}:${sel.openingId || ''}` : '';
    if (k !== lastSel) {
      const prevItem = lastSel.startsWith('item:'); lastSel = k;
      if (sel) {
        if (sel.kind === 'item') { if (activeId !== 'furniture') activeId = 'furniture'; }
        else if (sel.kind === 'slab' || sel.kind === 'fwall' || sel.kind === 'fopening') { if (activeId !== 'garden') activeId = 'build'; }
        else if (sel.kind === 'wall' || sel.kind === 'opening') { wallSide = sel.side; activeId = 'walls'; }
        else if (sel.kind === 'room' && !['room', 'floor', 'house'].includes(activeId)) activeId = 'room';
      } else if (prevItem) { /* keep the current tab */ }
    }
    refresh(); renderStatus({ dirty: document.getElementById('unsaved-dot') ? !document.getElementById('unsaved-dot').hidden : false });
  }));

  showSection('house');
  renderStatus({ dirty: false });

  return {
    showSection,
    destroy() { disposers.forEach((fn) => fn()); sidebar.replaceChildren(); panel.replaceChildren(); status.replaceChildren(); }
  };
}