// js/workspace/export.js — image / vector export of the actual design (never the surrounding interface).
import { el, openModal, showToast } from '../ui.js';
import { getState, getUi } from '../state.js';
import { LEVEL_NAMES } from '../catalog.js';

const slug = (s) => String(s || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const loadImage = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('The image could not be rendered.')); img.src = src; });
const toBlob = (canvas, type, q) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, q));

/** Rasterises an image source (SVG/PNG data URL) to the target pixel size. `background` null keeps transparency. */
async function rasterize(src, width, height, { type, quality, background }) {
  const img = await loadImage(src); const c = el('canvas', { width: String(width), height: String(height) }); const g = c.getContext('2d');
  if (background) { g.fillStyle = background; g.fillRect(0, 0, width, height); }
  g.drawImage(img, 0, 0, width, height); return toBlob(c, type, quality);
}

export function openExportDialog({ plan, scene, initialView }) {
  const select = (id, label, options, value) => {
    const s = el('select', { id, class: 'ws-input' }, options.map(([v, t]) => el('option', { value: v, text: t }))); s.value = value;
    return { s, row: el('div', { class: 'field' }, el('label', { class: 'field__label', for: id, text: label }), s) };
  };
  const hasScene = !!scene;
  const view = select('ex-view', 'View', [['2d', '2D floor plan (active floor)'], ...(hasScene ? [['3d', '3D view (current camera)']] : [])], initialView === '3d' && hasScene ? '3d' : '2d');
  const format = select('ex-format', 'Format', [['png', 'PNG image'], ['jpeg', 'JPEG image'], ['svg', 'SVG vector']], 'png');
  const size = select('ex-size', 'Resolution (long edge)', [['1280', '1280 px — preview'], ['1920', '1920 px — Full HD'], ['3840', '3840 px — 4K'], ['7680', '7680 px — large print']], '1920');
  const bg = select('ex-bg', 'Background', [['white', 'White'], ['transparent', 'Transparent (PNG / SVG)'], ['dark', 'Charcoal']], 'white');
  const qLabel = el('span', { class: 'field__hint', text: '92%' });
  const quality = el('input', { type: 'range', id: 'ex-q', min: '50', max: '100', step: '1', value: '92' });
  quality.addEventListener('input', () => { qLabel.textContent = `${quality.value}%`; });
  const qRow = el('div', { class: 'field' }, el('label', { class: 'field__label', for: 'ex-q', text: 'JPEG quality' }), el('div', { class: 'row' }, quality, qLabel));
  const note = el('p', { class: 'panel__desc' });
  const sync = () => {
    const is3d = view.s.value === '3d';
    format.s.querySelector('option[value="svg"]').disabled = is3d; if (is3d && format.s.value === 'svg') format.s.value = 'png';
    const f = format.s.value; size.row.hidden = f === 'svg'; qRow.hidden = f !== 'jpeg';
    const noAlpha = f === 'jpeg' || is3d; bg.s.querySelector('option[value="transparent"]').disabled = noAlpha; if (noAlpha && bg.s.value === 'transparent') bg.s.value = 'white';
    note.textContent = is3d ? 'Renders the 3D scene at the chosen size from the camera you see now. This is a real-time viewport render, not a ray-traced image.' : `Exports the ${LEVEL_NAMES[getUi().level]} plan with dimensions and labels, without the editor interface.`;
  };
  [view.s, format.s].forEach((n) => n.addEventListener('change', sync)); sync();

  async function run() {
    const name = slug(getState().name); const f = format.s.value; const px = Number(size.s.value);
    const bgColor = { white: '#FFFFFF', dark: '#23272D', transparent: null }[bg.s.value];
    try {
      if (view.s.value === '2d') {
        const out = plan.exportSvg({ background: bgColor || 'none' });
        if (f === 'svg') { download(new Blob([out.svg], { type: 'image/svg+xml' }), `archora-${name}-plan.svg`); return; }
        const k = px / Math.max(out.width, out.height); const w = Math.round(out.width * k); const h = Math.round(out.height * k);
        const blob = await rasterize(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(out.svg)}`, w, h, { type: f === 'jpeg' ? 'image/jpeg' : 'image/png', quality: Number(quality.value) / 100, background: bgColor });
        download(blob, `archora-${name}-plan.${f === 'jpeg' ? 'jpg' : 'png'}`);
      } else {
        const url = scene.capturePng({ longEdge: px, background: bgColor });
        if (!url) throw new Error('The 3D view could not be captured. Open the 3D view first.');
        const img = await loadImage(url);
        const blob = f === 'png' ? await (await fetch(url)).blob() : await rasterize(url, img.naturalWidth, img.naturalHeight, { type: 'image/jpeg', quality: Number(quality.value) / 100, background: bgColor || '#FFFFFF' });
        download(blob, `archora-${name}-3d.${f === 'jpeg' ? 'jpg' : 'png'}`);
      }
      showToast('Image exported', 'success');
    } catch (error) { console.error('[export]', error); showToast(error.message || 'Export failed.', 'error'); }
  }
  openModal({
    title: 'Export image', body: el('div', { class: 'panel-stack' }, view.row, format.row, size.row, qRow, bg.row, note),
    actions: [{ label: 'Cancel', variant: 'ghost' }, { label: 'Export', variant: 'primary', onClick: () => { run(); } }]
  });
}
