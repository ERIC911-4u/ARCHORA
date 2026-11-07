// js/main.js — application bootstrap: router, header behavior, save dialog.
import { createRouter } from './router.js';
import { subscribe, getState, markSaved, isDirty, cloneState } from './state.js';
import { saveDesign, isStorageAvailable } from './storage.js';
import { el, openModal, showToast } from './ui.js';

const notFoundPage = {
  title: 'Page not found', layout: 'default',
  mount(container) {
    container.replaceChildren(el('section', { class: 'state-message' }, el('h1', { text: 'Page not found' }),
      el('p', { text: 'The page you are looking for does not exist.' }), el('a', { class: 'btn btn--primary', href: '#/home', text: 'Back to Home' })));
  },
  unmount() {}
};

const routes = [
  { name: 'home', nav: 'home', path: '/home', load: () => import('./pages/home.js') },
  { name: 'studio', nav: 'studio', path: '/studio', load: () => import('./pages/studio.js') },
  { name: 'projects', nav: 'projects', path: '/projects', load: () => import('./pages/project-gallery.js') },
  { name: 'project-detail', nav: 'projects', path: '/projects/:id', load: () => import('./pages/project-detail.js') },
  { name: 'my-designs', nav: 'my-designs', path: '/my-designs', load: () => import('./pages/my-designs.js') },
  { name: 'about', nav: 'about', path: '/about', load: () => import('./pages/about.js') }
];

const navToggle = document.getElementById('nav-toggle');
function setNavOpen(open) {
  document.body.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
navToggle.addEventListener('click', () => setNavOpen(!document.body.classList.contains('nav-open')));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setNavOpen(false); });

const unsavedDot = document.getElementById('unsaved-dot');
const updateUnsaved = (dirty) => { unsavedDot.hidden = !dirty; };
subscribe((state, meta) => updateUnsaved(meta.dirty));
updateUnsaved(isDirty());
window.addEventListener('beforeunload', (event) => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });

function openSaveDialog() {
  const state = getState();
  const input = el('input', { type: 'text', id: 'save-name', class: 'field__input', maxlength: '60', autocomplete: 'off', placeholder: 'e.g. Two-storey family house', value: state.name === 'Untitled Design' ? '' : state.name });
  const error = el('p', { class: 'field__error', role: 'alert', hidden: true });
  const copyCheckbox = state.id ? el('input', { type: 'checkbox', id: 'save-copy' }) : null;
  const storageNote = isStorageAvailable() ? null : el('p', { class: 'field__error', text: 'Browser storage seems unavailable. Saving may fail.' });
  const body = el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'save-name', text: 'Design name' }), input, error, storageNote,
    copyCheckbox ? el('label', { class: 'field__check' }, copyCheckbox, ' Save as a new copy') : null);
  const modal = openModal({
    title: 'Save design', body,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      { label: 'Save design', variant: 'primary', onClick: () => {
        const name = input.value.trim();
        if (!name) { error.textContent = 'Please enter a design name.'; error.hidden = false; input.focus(); return false; }
        const overwriteId = state.id && !(copyCheckbox && copyCheckbox.checked) ? state.id : null;
        const result = saveDesign({ id: overwriteId, name, config: cloneState() });
        if (!result.ok) { showToast(result.error, 'error'); return false; }
        markSaved({ id: result.design.id, name: result.design.name, updatedAt: result.design.updatedAt });
        showToast(`Saved “${result.design.name}”`, 'success');
        return undefined;
      } }
    ]
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); modal.dialog.querySelector('.btn--primary').click(); } });
}
document.getElementById('save-design-btn').addEventListener('click', openSaveDialog);
document.addEventListener('archora:save-design', openSaveDialog);

const router = createRouter({
  outlet: document.getElementById('app-main'), routes,
  notFound: { name: 'not-found', nav: '', path: '*', load: async () => ({ default: notFoundPage }) },
  onRouteChange: () => setNavOpen(false)
});
router.start();