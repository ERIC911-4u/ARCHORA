// js/workspace/topbar.js — top toolbar: logo, File/Edit/View/Tools/Settings menus, edit actions, view + floor switch, project name, save state.
import { el } from '../ui.js';
import { getState, getUi, setUi, subscribe, subscribeUi, undo, redo, canUndo, canRedo, isDirty, setDesignName, SNAP_OPTIONS, UNITS, SNAP_MODES } from '../state.js';
import { renameDesign } from '../storage.js';
import { LEVEL_NAMES } from '../catalog.js';
import { icon } from './icons.js';
import { openMenu } from './menu.js';
import { canCopy, hasClipboard } from './clipboard.js';

/** ctx: { newDesign, importFile, exportJson, exportImage, save, saveAs, copy, paste, duplicate, del, fit, zoom(f), tool(id|patch), help, openLibrary, toggleInspector } */
export function createTopbar(ctx) {
  const syncs = [];
  const ibtn = (name, label, onClick, { kbd = '', text = '' } = {}) => el('button', { type: 'button', class: `ax-btn${text ? ' ax-btn--text' : ''}`, title: kbd ? `${label} (${kbd})` : label, 'aria-label': label, onclick: onClick }, icon(name, 18), text ? el('span', { class: 'ax-btn__t', text }) : null);
  const menuBtn = (label, entries) => el('button', { type: 'button', class: 'ax-menubtn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => openMenu(e.currentTarget, entries()) }, el('span', { text: label }), icon('chevron', 12));
  const T = (id) => () => ctx.tool(id);

  const fileMenu = () => [
    { label: 'New design…', onClick: ctx.newDesign }, { label: 'Open saved designs', onClick: () => { location.hash = '#/my-designs'; } }, { separator: true },
    { label: 'Save', shortcut: 'Ctrl+S', onClick: ctx.save }, { label: 'Save as new copy…', onClick: ctx.saveAs }, { separator: true },
    { label: 'Import project (JSON)…', onClick: ctx.importFile }, { label: 'Export project (JSON)', onClick: ctx.exportJson }, { label: 'Export image / SVG…', onClick: ctx.exportImage }, { separator: true },
    { label: 'Home', onClick: () => { location.hash = '#/home'; } }, { label: 'Projects gallery', onClick: () => { location.hash = '#/projects'; } }
  ];
  const editMenu = () => [
    { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !canUndo(), onClick: undo }, { label: 'Redo', shortcut: 'Ctrl+Shift+Z', disabled: !canRedo(), onClick: redo }, { separator: true },
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: !canCopy(), onClick: ctx.copy }, { label: 'Paste', shortcut: 'Ctrl+V', disabled: !hasClipboard(), onClick: ctx.paste },
    { label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !canCopy(), onClick: ctx.duplicate }, { label: 'Delete', shortcut: 'Del', disabled: !getUi().selection, onClick: ctx.del }, { separator: true },
    { label: 'Clear selection', shortcut: 'Esc', disabled: !getUi().selection, onClick: () => setUi({ selection: null }) }
  ];
  const viewMenu = () => {
    const ui = getUi(); const lv = (id, label) => ({ label, checked: ui.levelView === id, onClick: () => setUi({ levelView: id }) });
    return [
      { label: 'Grid', shortcut: 'G', checked: ui.showGrid, onClick: () => setUi({ showGrid: !ui.showGrid }) }, { label: 'Dimensions & labels', checked: ui.showDimensions, onClick: () => setUi({ showDimensions: !ui.showDimensions }) },
      { label: 'Roof slab (3D)', checked: ui.showRoof, onClick: () => setUi({ showRoof: !ui.showRoof }) }, { separator: true },
      { header: 'Floors shown (3D)' }, lv('all', 'All floors'), lv('active', 'Active floor only'), lv('below', 'Up to active floor'), { separator: true },
      { header: 'Wall height (3D)' }, { label: 'Cutaway walls', checked: ui.wallMode === 'cutaway', onClick: () => setUi({ wallMode: 'cutaway' }) }, { label: 'Full-height walls', checked: ui.wallMode === 'full', onClick: () => setUi({ wallMode: 'full' }) }, { separator: true },
      { label: 'Fit to view', shortcut: 'F', onClick: ctx.fit }, { label: 'Zoom in (2D)', onClick: () => ctx.zoom(1.25) }, { label: 'Zoom out (2D)', onClick: () => ctx.zoom(0.8) }
    ];
  };
  const toolsMenu = () => [['Select / move', 'V', 'select'], ['Wall', 'W', 'wall'], ['Floor area', '', 'floor'], ['Door', 'D', 'door'], ['Window', 'N', 'window'], ['Erase', 'E', 'erase']].map(([label, shortcut, id]) => ({ label, shortcut, onClick: T(id) }))
    .concat([{ separator: true }, { label: 'Pan (hold Space, or middle mouse)', onClick: () => setUi({ tool: 'pan', placeItem: null }) }, { separator: true }, { label: 'Keyboard shortcuts', shortcut: '?', onClick: ctx.help }]);
  const settingsMenu = () => {
    const ui = getUi();
    return [
      { header: 'Units' }, ...UNITS.map(([id, label]) => ({ label, checked: ui.units === id, onClick: () => setUi({ units: id }) })), { separator: true },
      { header: 'Grid / snap step' }, ...SNAP_OPTIONS.map((v) => ({ label: `${v} cm`, checked: ui.snap === v, onClick: () => setUi({ snap: v }) })), { separator: true },
      { header: 'Snapping' }, ...SNAP_MODES.map(([id, label]) => ({ label, checked: ui.snapModes[id], onClick: () => setUi({ snapModes: { ...ui.snapModes, [id]: !ui.snapModes[id] } }) })),
      { label: 'Lock to 45° while drawing', checked: ui.ortho, onClick: () => setUi({ ortho: !ui.ortho }) }
    ];
  };

  const undoBtn = ibtn('undo', 'Undo', undo, { kbd: 'Ctrl+Z' }); const redoBtn = ibtn('redo', 'Redo', redo, { kbd: 'Ctrl+Shift+Z' });
  const copyBtn = ibtn('copy', 'Copy', ctx.copy, { kbd: 'Ctrl+C' }); const pasteBtn = ibtn('paste', 'Paste', ctx.paste, { kbd: 'Ctrl+V' }); const delBtn = ibtn('trash', 'Delete selection', ctx.del, { kbd: 'Del' });
  syncs.push(() => { undoBtn.disabled = !canUndo(); redoBtn.disabled = !canRedo(); copyBtn.disabled = !canCopy(); pasteBtn.disabled = !hasClipboard(); delBtn.disabled = !getUi().selection; });

  const seg = (items, get, set, label) => {
    const box = el('div', { class: 'ws-seg', role: 'group', 'aria-label': label });
    const btns = items.map(([id, text, title]) => el('button', { type: 'button', class: 'ws-seg__btn', title, 'aria-pressed': 'false', text, onclick: () => set(id) }));
    box.append(...btns); syncs.push(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(get() === items[i][0])))); return box;
  };
  const viewSeg = seg([['2d', '2D', 'Floor-plan drafting view'], ['3d', '3D', 'Perspective 3D view']], () => getUi().viewMode, (v) => setUi({ viewMode: v }), 'View mode');
  const levelBox = el('div', { class: 'ws-seg', role: 'group', 'aria-label': 'Floor' });
  function renderLevels() {
    const count = getState().levels.length; const key = `${count}|${getUi().level}`; if (levelBox.dataset.k === key) return; levelBox.dataset.k = key;
    levelBox.replaceChildren(...getState().levels.map((_, i) => el('button', { type: 'button', class: 'ws-seg__btn', 'aria-pressed': String(i === getUi().level), title: LEVEL_NAMES[i], text: i === 0 ? 'G' : `${i}F`, onclick: () => setUi({ level: i }) })));
  }
  syncs.push(renderLevels);

  const nameInput = el('input', { type: 'text', class: 'ax-name', maxlength: '40', 'aria-label': 'Project name', title: 'Project name', autocomplete: 'off' });
  nameInput.addEventListener('change', () => { const v = nameInput.value.trim(); if (!v) { nameInput.value = getState().name; return; } setDesignName(v); const id = getState().id; if (id) renameDesign(id, v); });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); e.stopPropagation(); });
  const saveState = el('span', { class: 'ax-save', role: 'status' });
  syncs.push(() => {
    if (document.activeElement !== nameInput) nameInput.value = getState().name;
    const dirty = isDirty(); const saved = !!getState().id;
    saveState.dataset.state = dirty ? 'dirty' : saved ? 'saved' : 'new';
    saveState.textContent = dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Not saved yet';
  });

  const root = el('header', { class: 'ax__top', role: 'toolbar', 'aria-label': 'Main toolbar' },
    el('a', { class: 'ax-brand', href: '#/home', 'aria-label': 'ARCHORA home', title: 'ARCHORA home' }, el('span', { class: 'ax-brand__mark', 'aria-hidden': 'true' }), el('span', { class: 'ax-brand__t', text: 'ARCHORA' })),
    el('nav', { class: 'ax-menus', 'aria-label': 'Menus' }, menuBtn('File', fileMenu), menuBtn('Edit', editMenu), menuBtn('View', viewMenu), menuBtn('Tools', toolsMenu)),
    el('span', { class: 'ax-sep' }), undoBtn, redoBtn, copyBtn, pasteBtn, delBtn, el('span', { class: 'ax-sep' }),
    ibtn('library', 'Asset library', ctx.openLibrary, { text: 'Assets' }), ibtn('import', 'Import project (JSON)', ctx.importFile), ibtn('export', 'Export image / SVG…', ctx.exportImage),
    el('span', { class: 'ax-spacer' }),
    el('div', { class: 'ax-project' }, nameInput, saveState), viewSeg, levelBox,
    el('button', { type: 'button', class: 'ax-menubtn ax-menubtn--icon', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Settings: units and snapping', 'aria-label': 'Settings', onclick: (e) => openMenu(e.currentTarget, settingsMenu()) }, icon('settings', 18)),
    ibtn('help', 'Keyboard shortcuts', ctx.help),
    el('button', { type: 'button', class: 'ax-save-btn', title: 'Save (Ctrl+S)', onclick: ctx.save }, icon('save', 16), el('span', { text: 'Save' })),
    el('button', { type: 'button', class: 'ax-btn ax-inspector-toggle', title: 'Show or hide properties', 'aria-label': 'Toggle properties panel', onclick: ctx.toggleInspector }, icon('layers', 18)));
  const update = () => syncs.forEach((fn) => fn()); update();
  const unsubs = [subscribe(update), subscribeUi(update)];
  return { element: root, update, destroy() { unsubs.forEach((u) => u()); } };
}
