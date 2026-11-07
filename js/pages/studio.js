// js/pages/studio.js — ARCHORA workspace: one project, two views (2D plan · 3D model) over the shared design state.
// Layout: top bar · tool panel · stage (2D SVG plan / 3D scene) · inspector · status bar. All behaviour lives in js/workspace/* and js/plan2d/*.
import { el, showToast, confirmDialog, openModal } from '../ui.js';
import { getState, getUi, setUi, subscribe, subscribeUi, replaceState, cloneState, markSaved, isDirty, undo, redo } from '../state.js';
import { saveDesign, downloadDesignJson, parseImportedJson } from '../storage.js';
import { createCustomizer } from '../customizer.js';
import { TEMPLATES } from '../templates.js';
import * as actions from '../actions.js';
import { createPlan2D } from '../plan2d/view.js';
import { icon } from '../workspace/icons.js';
import { createTopbar } from '../workspace/topbar.js';
import { createToolPanel, findTool } from '../workspace/toolpanel.js';
import { createStatusBar, describeSelection } from '../workspace/statusbar.js';
import { createLibrary } from '../workspace/library.js';
import { openContextMenu } from '../workspace/menu.js';
import { installShortcuts, showShortcuts } from '../workspace/shortcuts.js';
import { copySelection, pasteClipboard, duplicateSelection, deleteSelection } from '../workspace/clipboard.js';
import { openExportDialog } from '../workspace/export.js';

let session = null;

const HINTS = {
  move: { '2d': 'Click to select · drag to move · drag handles to resize · Space or middle mouse to pan · scroll to zoom', '3d': 'Drag to orbit · scroll to zoom · click to select · drag gold dots to resize' },
  select: { '2d': 'Select only: click to select, nothing moves', '3d': 'Select only: click to select, nothing moves' },
  'draw-wall': { '2d': 'Wall: click the start point, then each corner. Type an exact length (e.g. 4500 in mm) and press Enter. Esc or right-click to finish', '3d': 'Wall: click the start point, then each corner. Esc to finish' },
  'draw-slab': { '2d': 'Area: click one corner, then the opposite corner. Esc cancels', '3d': 'Area: click one corner, then the opposite corner. Esc cancels' },
  'place-opening': { '2d': 'Click on a wall to place the opening. Esc cancels', '3d': 'Click on a wall to place the opening. Esc cancels' },
  'place-item': { '2d': 'Click in the plan to place the item. Shift keeps placing. Esc cancels', '3d': 'Click in the view to place the item. Shift keeps placing. Esc cancels' },
  eraser: { '2d': 'Eraser: click an object to delete it', '3d': 'Eraser: click an object to delete it' },
  pan: { '2d': 'Pan: drag to move the plan', '3d': 'Drag to orbit' }
};

export default {
  title: 'Studio', layout: 'workspace',

  mount(container) {
    const s = { alive: true, disposers: [], scene: null, plan: null, customizer: null, flashTimer: 0 };
    session = s;

    /* ---------- stage ---------- */
    const planHost = el('div', { class: 'ax-canvas ax-canvas--plan' });
    const sceneHost = el('div', { class: 'ax-canvas ax-canvas--scene' });
    const loading = el('div', { class: 'ax-loading', role: 'status', hidden: true }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { text: 'Loading 3D engine…' }));
    const hint = el('p', { class: 'ax-hint', role: 'status' });
    const stage = el('main', { class: 'ax__stage', 'aria-label': 'Design canvas' }, planHost, sceneHost, loading, hint);

    const flash = (message) => {
      hint.textContent = message; hint.dataset.flash = 'true'; clearTimeout(s.flashTimer);
      s.flashTimer = setTimeout(() => { hint.dataset.flash = 'false'; syncHint(); }, 2600);
    };
    const syncHint = () => { if (hint.dataset.flash === 'true') return; const ui = getUi(); hint.textContent = (HINTS[ui.tool] || HINTS.move)[ui.viewMode]; };

    /* ---------- status bar ---------- */
    const statusbar = createStatusBar();

    /* ---------- 2D plan ---------- */
    s.plan = createPlan2D({ host: planHost, onCursor: (p) => statusbar.setCursor(p), onZoom: (z) => statusbar.setZoom(z), onHint: flash });

    /* ---------- actions shared by menus, shortcuts and buttons ---------- */
    const is3d = () => getUi().viewMode === '3d';
    const fit = () => { if (is3d()) { if (s.scene) s.scene.resetCamera(); } else s.plan.fit(); };
    const zoom = (f) => { if (!is3d()) s.plan.zoomBy(f); };
    const del = () => { if (!getUi().selection) { flash('Select something to delete.'); return; } deleteSelection(actions); };
    const rotate = () => { const sel = getUi().selection; if (sel && sel.kind === 'item') actions.rotateItem(sel.id, 90); };
    const toolById = (id) => { const t = findTool(id); if (t && t.patch) setUi(t.patch); };
    const tool = (v) => (typeof v === 'string' ? toolById(v) : setUi(v));

    function save() {
      const st = getState();
      if (!st.id) { document.dispatchEvent(new CustomEvent('archora:save-design')); return; }
      const result = saveDesign({ id: st.id, name: st.name, config: cloneState() });
      if (!result.ok) { showToast(result.error || 'Saving failed.', 'error'); return; }
      markSaved({ id: result.design.id, name: result.design.name, updatedAt: result.design.updatedAt });
      showToast(`Saved “${result.design.name}”`, 'success');
    }
    const saveAs = () => document.dispatchEvent(new CustomEvent('archora:save-design'));

    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'aria-label': 'Import design JSON file', tabindex: '-1' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0]; fileInput.value = '';
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('That file is too large to be an ARCHORA project (2 MB limit).', 'error'); return; }
      let text = ''; try { text = await file.text(); } catch (error) { showToast('The file could not be read.', 'error'); return; }
      const result = parseImportedJson(text);
      if (!result.ok) { showToast(result.error, 'error'); return; }
      if (isDirty() && !(await confirmDialog({ title: 'Replace current design?', message: 'Importing will replace your unsaved changes.', confirmLabel: 'Import' }))) return;
      replaceState(result.config); showToast('Project imported', 'success'); fit();
    });

    function newDesign() {
      let modal = null;
      const choose = async (t) => {
        if (isDirty() && !(await confirmDialog({ title: 'Replace current design?', message: 'Unsaved changes will be lost.', confirmLabel: 'Replace', danger: true }))) return;
        modal.close(); replaceState(t.build()); setUi({ tool: 'move', placeItem: null }); fit(); showToast(`Started: ${t.name}`, 'success');
      };
      const cards = TEMPLATES.map((t) => el('button', { type: 'button', class: 'option', onclick: () => choose(t) },
        el('span', { class: 'option__text' }, el('span', { class: 'option__title', text: t.name }), el('span', { class: 'option__sub', text: t.description }))));
      modal = openModal({ title: 'Start a new design', body: el('div', { class: 'option-list' }, cards), actions: [{ label: 'Cancel', variant: 'ghost' }] });
    }

    /* ---------- library drawer ---------- */
    const library = createLibrary({ onClose: () => toolpanel.update() });
    stage.append(library.element);
    let libraryToolId = null;
    const openLibrary = (scope, toolId) => { libraryToolId = toolId || null; library.open(scope); toolpanel.update(); };

    /* ---------- inspector (shared customizer) ---------- */
    const inspTabs = el('nav', { class: 'ax-insp__tabs', 'aria-label': 'Property sections' });
    const inspPanel = el('div', { class: 'ax-insp__panel', id: 'ax-inspector-panel', role: 'region', 'aria-label': 'Properties' });
    const inspector = el('aside', { class: 'ax__inspector', 'aria-label': 'Properties inspector' }, inspTabs, inspPanel);

    /* ---------- top bar + tool panel ---------- */
    const root = el('div', { class: 'ax', dataset: { inspector: 'closed' } });
    const toggleInspector = () => { root.dataset.inspector = root.dataset.inspector === 'open' ? 'closed' : 'open'; };
    const topbar = createTopbar({
      newDesign, importFile: () => fileInput.click(), exportJson: () => { downloadDesignJson(cloneState(), getState().name); showToast('Project exported as JSON', 'success'); },
      exportImage: () => openExportDialog({ plan: s.plan, scene: s.scene, initialView: getUi().viewMode }),
      save, saveAs, copy: copySelection, paste: pasteClipboard, duplicate: duplicateSelection, del, fit, zoom, tool, help: showShortcuts,
      openLibrary: () => openLibrary(null, null), toggleInspector
    });
    const toolpanel = createToolPanel({ openLibrary, showSection: (id) => { if (s.customizer) s.customizer.showSection(id); root.dataset.inspector = 'open'; }, activeLibrary: () => (library.isOpen ? libraryToolId : null) });

    /* ---------- floating view controls ---------- */
    const fbtn = (name, label, onClick) => el('button', { type: 'button', class: 'ax-btn', title: label, 'aria-label': label, onclick: onClick }, icon(name, 18));
    const zoomLabel = el('span', { class: 'ax-float__zoom', 'aria-live': 'off' });
    const camBtn = (label, view) => el('button', { type: 'button', class: 'ax-btn ax-btn--text', title: `${label} camera`, onclick: () => s.scene && s.scene.setView(view) }, el('span', { class: 'ax-btn__t', style: 'display:inline', text: label }));
    const floatBar = el('div', { class: 'ax-float', role: 'toolbar', 'aria-label': 'View controls' });
    function renderFloat() {
      const mode = getUi().viewMode; if (floatBar.dataset.mode === mode) return; floatBar.dataset.mode = mode;
      if (mode === '2d') floatBar.replaceChildren(fbtn('minus', 'Zoom out', () => zoom(0.8)), zoomLabel, fbtn('plus', 'Zoom in', () => zoom(1.25)), fbtn('fit', 'Fit plan to view (F)', fit));
      else floatBar.replaceChildren(camBtn('Perspective', 'perspective'), camBtn('Top', 'top'), camBtn('Front', 'front'), camBtn('Interior', 'interior'), fbtn('fit', 'Reset camera (F)', fit));
    }
    stage.append(floatBar);
    const syncZoom = () => { zoomLabel.textContent = `${s.plan.zoomPercent()}%`; };

    /* ---------- 3D scene (lazy: only loaded when first needed) ---------- */
    let sceneLoading = null;
    async function ensureScene() {
      if (s.scene) return s.scene; if (sceneLoading) return sceneLoading;
      loading.hidden = false;
      sceneLoading = (async () => {
        try {
          const mod = await import('../scene.js'); if (!s.alive) return null;
          if (!mod.isWebGLAvailable()) throw new Error('webgl');
          s.scene = mod.getStudioScene(); s.scene.mount(sceneHost); loading.hidden = true; return s.scene;
        } catch (error) {
          console.error('[studio] 3D init failed:', error); loading.hidden = true;
          if (s.alive) sceneHost.replaceChildren(el('div', { class: 'ax-fallback' }, el('h2', { text: error && error.message === 'webgl' ? '3D view unavailable' : '3D engine failed to load' }),
            el('p', { text: error && error.message === 'webgl' ? 'This browser or device does not support WebGL. The 2D plan still works.' : 'Three.js could not be loaded. The 2D plan still works.' })));
          return null;
        }
      })();
      return sceneLoading;
    }

    /* ---------- view mode ---------- */
    function applyMode() {
      const mode = getUi().viewMode; stage.dataset.mode = mode;
      planHost.hidden = mode !== '2d'; sceneHost.hidden = mode !== '3d';
      if (mode === '3d') ensureScene().then((sc) => { if (sc && s.alive) sc.requestRender(); });
      renderFloat(); syncHint(); syncZoom();
    }

    /* ---------- context menu ---------- */
    function contextMenu(x, y) {
      const sel = getUi().selection; if (!sel) return;
      const movable = ['item', 'fwall', 'slab'].includes(sel.kind);
      const section = (id) => () => { if (s.customizer) s.customizer.showSection(id); root.dataset.inspector = 'open'; };
      const target = { item: 'furniture', fwall: 'build', fopening: 'build', slab: 'build', room: 'room', wall: 'walls', opening: 'walls' }[sel.kind];
      openContextMenu(x, y, [
        { header: describeSelection(sel) },
        { label: 'Edit properties', onClick: section(target) },
        { label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !movable, onClick: duplicateSelection },
        { label: 'Rotate 90°', shortcut: 'R', disabled: sel.kind !== 'item', onClick: rotate },
        { label: 'Change material / finish', disabled: !['wall', 'fwall', 'room', 'slab'].includes(sel.kind), onClick: section(sel.kind === 'room' ? 'floor' : sel.kind === 'wall' ? 'walls' : 'build') },
        { separator: true },
        { label: 'Delete', shortcut: 'Del', onClick: del }
      ]);
    }
    planHost.addEventListener('plan2d:context', (e) => contextMenu(e.detail.x, e.detail.y));
    sceneHost.addEventListener('contextmenu', (e) => { if (getUi().selection && getUi().tool === 'move') { e.preventDefault(); contextMenu(e.clientX, e.clientY); } });

    /* ---------- assemble ---------- */
    root.append(topbar.element, el('div', { class: 'ax__body' }, toolpanel.element, stage, inspector), statusbar.element, fileInput);
    container.append(root);
    s.customizer = createCustomizer({ sidebar: inspTabs, panel: inspPanel, status: statusbar.extra });
    s.plan.mount();

    const syncAll = () => { statusbar.update(); applyMode(); syncZoom(); };
    syncAll();
    s.disposers.push(subscribe(statusbar.update), subscribeUi(syncAll), installShortcuts({
      undo, redo, save, copy: copySelection, paste: pasteClipboard, duplicate: duplicateSelection, del, rotate, help: showShortcuts, fit,
      toggleGrid: () => setUi({ showGrid: !getUi().showGrid }), tool,
      escape: () => {
        if (library.isOpen) { library.close(); return; }
        if (s.plan.handleEscape()) return;
        if (s.scene && s.scene.handleEscape()) return;
        const ui = getUi();
        if (ui.tool !== 'move') { setUi({ tool: 'move', placeItem: null }); return; }
        setUi({ selection: null });
      }
    }));
    s.disposers.push(() => { topbar.destroy(); toolpanel.destroy(); });
    requestAnimationFrame(() => { if (s.alive) { s.plan.fit(); syncZoom(); } });
  },

  unmount() {
    const s = session; if (!s) return;
    session = null; s.alive = false; clearTimeout(s.flashTimer);
    s.disposers.forEach((fn) => { try { fn(); } catch (error) { console.error(error); } });
    if (s.plan) s.plan.unmount();
    if (s.scene) s.scene.unmount();
    if (s.customizer) s.customizer.destroy();
  }
};
