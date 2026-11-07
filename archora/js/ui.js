// js/ui.js — shared UI helpers: safe DOM builder, toasts, modals, images, footer.
import { getFallbackImage } from './projects.js';

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Safe element builder. Text is always inserted as text, never as HTML. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  appendChildren(node, children);
  return node;
}

/* ---------- toast ---------- */
function dismissToast(toast) {
  if (!toast.isConnected) return;
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) gsap.to(toast, { opacity: 0, y: 8, duration: 0.25, onComplete: () => toast.remove() });
  else toast.remove();
}
export function showToast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  while (region.children.length >= 3) region.firstElementChild.remove();
  const toast = el('div', { class: `toast toast--${type}` }, el('span', { text: message }));
  region.append(toast);
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) gsap.fromTo(toast, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
  setTimeout(() => dismissToast(toast), 3600);
}

/* ---------- modal ---------- */
let activeModal = null; let modalCounter = 0;

export function openModal({ title, body, actions = [], onClose }) {
  if (activeModal) activeModal.close();
  const root = document.getElementById('modal-root');
  const titleId = `modal-title-${++modalCounter}`;
  const previousFocus = document.activeElement;
  let closed = false;
  const actionsEl = el('div', { class: 'modal__actions' });
  const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    el('h2', { class: 'modal__title', id: titleId, text: title }), el('div', { class: 'modal__body' }, body), actionsEl);
  const backdrop = el('div', { class: 'modal-backdrop' }, dialog);

  function onKeydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); api.close(); return; }
    if (event.key !== 'Tab') return;
    const focusables = [...dialog.querySelectorAll('button, [href], input, select, textarea')].filter((n) => !n.disabled && !n.hidden && n.getClientRects().length > 0);
    if (!focusables.length) { event.preventDefault(); return; }
    const first = focusables[0]; const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const api = {
    dialog,
    close(value) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown);
      if (activeModal === api) activeModal = null;
      const finish = () => { backdrop.remove(); if (previousFocus && previousFocus.focus) previousFocus.focus(); if (onClose) onClose(value); };
      const gsap = window.gsap;
      if (gsap && !prefersReducedMotion()) gsap.to(backdrop, { opacity: 0, duration: 0.15, onComplete: finish }); else finish();
    }
  };

  actions.forEach((action) => {
    const button = el('button', { type: 'button', class: `btn btn--${action.variant || 'ghost'}`, text: action.label });
    button.addEventListener('click', () => {
      const result = action.onClick ? action.onClick(api) : undefined;
      if (result === false) return;
      api.close(action.value);
    });
    actionsEl.append(button);
  });

  backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) api.close(); });
  document.addEventListener('keydown', onKeydown);
  root.append(backdrop);
  activeModal = api;
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) {
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(dialog, { y: 16, scale: 0.98 }, { y: 0, scale: 1, duration: 0.25, ease: 'power2.out' });
  }
  (dialog.querySelector('input, select, textarea') || dialog).focus();
  return api;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title, body: el('p', { text: message }), onClose: (value) => resolve(value === true),
      actions: [{ label: 'Cancel', variant: 'ghost' }, { label: confirmLabel, variant: danger ? 'danger' : 'primary', value: true }]
    });
  });
}

export function promptDialog({ title, label, value = '', confirmLabel = 'Save', maxLength = 60 }) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', class: 'field__input', id: 'prompt-input', maxlength: String(maxLength), value, autocomplete: 'off' });
    const error = el('p', { class: 'field__error', role: 'alert', hidden: true });
    const body = el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'prompt-input', text: label }), input, error);
    let submitted = null;
    const modal = openModal({
      title, body, onClose: () => resolve(submitted),
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        { label: confirmLabel, variant: 'primary', onClick: () => {
          const trimmed = input.value.trim();
          if (!trimmed) { error.textContent = 'Please enter a name.'; error.hidden = false; input.focus(); return false; }
          submitted = trimmed.slice(0, maxLength);
          return undefined;
        } }
      ]
    });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); modal.dialog.querySelector('.btn--primary').click(); } });
  });
}

/* ---------- images ---------- */
export function createProjectImage(project, src, alt, className, eager = false) {
  const img = el('img', { class: className, src, alt, decoding: 'async', loading: eager ? 'eager' : 'lazy' });
  img.addEventListener('error', () => { img.src = getFallbackImage(project); }, { once: true });
  return img;
}

/* ---------- footer ---------- */
export function createFooter() {
  return el('footer', { class: 'site-footer' }, el('div', { class: 'container site-footer__inner' },
    el('p', { class: 'site-footer__brand', text: 'ARCHORA' }),
    el('p', { class: 'site-footer__note', text: 'ARCHORA is a demonstration project. All projects, studio details and prices shown are fictional.' })));
}