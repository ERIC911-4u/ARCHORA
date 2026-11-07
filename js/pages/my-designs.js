// js/pages/my-designs.js
import { el, showToast, confirmDialog, promptDialog, createFooter } from '../ui.js';
import { listDesigns, renameDesign, deleteDesign, duplicateDesign, saveDesign, downloadDesignJson, parseImportedJson, isStorageAvailable } from '../storage.js';
import { replaceState, isDirty } from '../state.js';
import { getStyleName, formatArea } from '../catalog.js';
import { createPlanPreview } from '../planview.js';

let listEl = null;
const formatDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

export default {
  title: 'My Designs', layout: 'default',
  mount(container, { router }) {
    listEl = el('div', { class: 'design-grid' });
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'aria-label': 'Import design JSON file' });

    async function openInStudio(design) {
      if (isDirty() && !(await confirmDialog({ title: 'Replace current design?', message: 'Opening this design replaces your current unsaved changes.', confirmLabel: 'Open design' }))) return;
      replaceState(design.config, { saved: true });
      router.navigate('/studio');
    }

    function card(design) {
      const c = design.config; const area = c.rooms.reduce((sum, r) => sum + r.w * r.d, 0);
      return el('article', { class: 'design-card' },
        el('div', { class: 'design-card__media' }, createPlanPreview(c, { textures: true })),
        el('div', { class: 'design-card__body' },
          el('h2', { class: 'design-card__title', text: design.name }),
          el('dl', { class: 'design-card__meta' },
            el('div', {}, el('dt', { text: 'Floors' }), el('dd', { text: String(c.levels.length) })),
            el('div', {}, el('dt', { text: 'Rooms' }), el('dd', { text: String(c.rooms.length) })),
            el('div', {}, el('dt', { text: 'Style' }), el('dd', { text: getStyleName(c.style) })),
            el('div', {}, el('dt', { text: 'Area' }), el('dd', { text: formatArea(area) })),
            el('div', {}, el('dt', { text: 'Saved' }), el('dd', { text: formatDate(design.updatedAt) }))),
          el('div', { class: 'design-card__actions' },
            el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Open in Studio', onclick: () => openInStudio(design) }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Rename', onclick: async () => {
              const name = await promptDialog({ title: 'Rename design', label: 'Design name', value: design.name, confirmLabel: 'Rename' });
              if (!name) return;
              const r = renameDesign(design.id, name);
              if (r.ok) { showToast('Design renamed', 'success'); render(); } else showToast(r.error, 'error');
            } }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Duplicate', onclick: () => { const r = duplicateDesign(design.id); if (r.ok) { showToast('Design duplicated', 'success'); render(); } else showToast(r.error, 'error'); } }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Export', onclick: () => downloadDesignJson(design.config, design.name) }),
            el('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: async () => {
              if (!(await confirmDialog({ title: 'Delete design?', message: `“${design.name}” will be permanently deleted.`, confirmLabel: 'Delete', danger: true }))) return;
              const r = deleteDesign(design.id);
              if (r.ok) { showToast('Design deleted', 'success'); render(); } else showToast(r.error, 'error');
            } }))));
    }

    function render() {
      const designs = listDesigns();
      if (!designs.length) {
        listEl.replaceChildren(el('div', { class: 'empty-state' }, el('h2', { text: 'No saved designs yet' }),
          el('p', { text: 'Open the 3D Studio, shape your house, then press “Save Design”. Your designs are stored in this browser.' }), el('a', { class: 'btn btn--primary', href: '#/studio', text: 'Open the 3D Studio' })));
        return;
      }
      listEl.replaceChildren(...designs.map(card));
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0]; fileInput.value = '';
      if (!file) return;
      const parsed = parseImportedJson(await file.text());
      if (!parsed.ok) { showToast(parsed.error, 'error'); return; }
      const r = saveDesign({ name: parsed.config.name, config: parsed.config });
      if (r.ok) { showToast('Design imported to your library', 'success'); render(); } else showToast(r.error, 'error');
    });

    container.append(
      el('section', { class: 'page-head' }, el('div', { class: 'container page-head__row' },
        el('div', {}, el('p', { class: 'eyebrow', text: 'Library' }), el('h1', { class: 'page-title', text: 'My Designs' }), el('p', { class: 'lead', text: 'Designs saved in this browser. The previews are floor plans drawn from each saved design.' })),
        el('div', { class: 'page-head__actions' }, el('button', { type: 'button', class: 'btn btn--outline', text: 'Import JSON', onclick: () => fileInput.click() }), el('a', { class: 'btn btn--primary', href: '#/studio', text: 'New 3D design' }), fileInput))),
      el('section', { class: 'section' }, el('div', { class: 'container' }, isStorageAvailable() ? null : el('p', { class: 'notice notice--warn', text: 'Browser storage is unavailable, so designs cannot be saved or listed.' }), listEl)),
      createFooter());
    render();
  },
  unmount() { listEl = null; }
};