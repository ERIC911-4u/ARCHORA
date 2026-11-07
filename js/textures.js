// js/textures.js — procedural canvas textures (no Three.js). Used by 3D materials AND UI previews.
import { getMaterial } from './catalog.js';

function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (h, f) => { const [r, g, b] = rgb(h); const c = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + f)))); return `rgb(${c(r)},${c(g)},${c(b)})`; };
const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const fill = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
function speckle(c, S, r, n, max = 0.1) { for (let i = 0; i < n; i += 1) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${(r() * max).toFixed(3)})`; c.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); } }
function blobs(c, S, r, n, col, a) { for (let i = 0; i < n; i += 1) { const x = r() * S; const y = r() * S; const rad = 40 + r() * 110; const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, S, S); } }

const P = {
  planks(c, S, r, b) {
    const rows = 8; const h = S / rows;
    for (let i = 0; i < rows; i += 1) {
      let x = -r() * S * 0.5;
      while (x < S) {
        const len = S * (0.45 + r() * 0.5);
        fill(c, shade(b, (r() - 0.5) * 0.16), x, i * h, len, h);
        c.strokeStyle = shade(b, -0.4); c.lineWidth = 1;
        for (let g = 0; g < 8; g += 1) { c.globalAlpha = 0.05 + r() * 0.12; const y = i * h + r() * h; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 4, x + len * 0.6, y + (r() - 0.5) * 4, x + len, y + (r() - 0.5) * 3); c.stroke(); }
        c.globalAlpha = 1; fill(c, 'rgba(0,0,0,.35)', x, i * h, 1.5, h); x += len;
      }
      fill(c, 'rgba(0,0,0,.3)', 0, i * h, S, 1.5);
    }
  },
  chevron(c, S, r, b) {
    const band = S / 4;
    for (let k = 0; k < 4; k += 1) {
      c.save(); c.beginPath(); c.rect(k * band, 0, band, S); c.clip();
      c.translate(k * band + band / 2, S / 2); c.rotate((k % 2 ? -1 : 1) * Math.PI / 4);
      for (let row = -16; row < 16; row += 1) {
        let x = -S - r() * 120;
        while (x < S) { fill(c, shade(b, (r() - 0.5) * 0.18), x, row * 40, 118.5, 38.5); x += 120; }
      }
      c.restore();
    }
  },
  tiles(c, S, r, b) {
    const n = 4; const t = S / n;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) fill(c, shade(b, (r() - 0.5) * 0.08), i * t, j * t, t, t);
    speckle(c, S, r, 2500, 0.08);
    for (let i = 0; i <= n; i += 1) { fill(c, shade(b, -0.18), i * t - 1.5, 0, 3, S); fill(c, shade(b, -0.18), 0, i * t - 1.5, S, 3); }
  },
  marble(c, S, r, b) {
    fill(c, b, 0, 0, S, S); blobs(c, S, r, 14, rgb(shade(b, -0.1).replace(/[^\d,]/g, '').split(',').length ? '200,196,188' : '200,196,188'), 0.22);
    const vein = lum(b) > 0.5 ? '110,106,100' : '225,225,230';
    for (let v = 0; v < 16; v += 1) {
      let x = r() * S; let y = r() * S; let a = r() * Math.PI; c.beginPath(); c.moveTo(x, y);
      const steps = 24 + Math.floor(r() * 20);
      for (let s = 0; s < steps; s += 1) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * (10 + r() * 14); y += Math.sin(a) * (10 + r() * 14); c.lineTo(x, y); }
      c.strokeStyle = `rgba(${vein},${0.15 + r() * 0.35})`; c.lineWidth = 0.5 + r() * 1.8; c.stroke();
    }
  },
  concrete(c, S, r, b) {
    fill(c, b, 0, 0, S, S); blobs(c, S, r, 10, r() < 0.5 ? '255,255,255' : '60,58,54', 0.1); speckle(c, S, r, 3500, 0.1);
    fill(c, 'rgba(0,0,0,.16)', S / 2 - 1, 0, 2, S); fill(c, 'rgba(0,0,0,.16)', 0, S / 2 - 1, S, 2);
  },
  terrazzo(c, S, r, b) {
    fill(c, b, 0, 0, S, S);
    const pal = ['#B9674A', '#2E2F2C', '#A8A49B', '#F3F0E8', '#8A5E3B', '#7A8452'];
    for (let i = 0; i < 260; i += 1) {
      const x = r() * S; const y = r() * S; const s = 3 + r() * 8; c.fillStyle = pal[Math.floor(r() * pal.length)]; c.globalAlpha = 0.9; c.beginPath();
      for (let k = 0; k < 5; k += 1) { const a = (k / 5) * Math.PI * 2 + r(); const rr = s * (0.6 + r() * 0.5); const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
      c.closePath(); c.fill();
    }
    c.globalAlpha = 1; speckle(c, S, r, 800, 0.06);
  },
  checker(c, S, r, b, o) {
    const n = 8; const t = S / n; const dark = o.dark || '#222222';
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) fill(c, (i + j) % 2 ? dark : shade(b, (r() - 0.5) * 0.04), i * t, j * t, t, t);
    speckle(c, S, r, 1200, 0.05);
  },
  mosaic(c, S, r, b) {
    const n = 16; const t = S / n;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) fill(c, shade(b, (r() - 0.5) * 0.22), i * t, j * t, t, t);
    for (let i = 0; i <= n; i += 1) { fill(c, 'rgba(90,100,100,.45)', i * t - 0.75, 0, 1.5, S); fill(c, 'rgba(90,100,100,.45)', 0, i * t - 0.75, S, 1.5); }
  },
  carpet(c, S, r, b) {
    fill(c, b, 0, 0, S, S);
    for (let i = 0; i < 5000; i += 1) { c.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${(r() * 0.12).toFixed(3)})`; c.lineWidth = 1; const x = r() * S; const y = r() * S; const a = r() * 6.28; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); c.stroke(); }
  },
  plaster(c, S, r, b) { fill(c, b, 0, 0, S, S); blobs(c, S, r, 16, '120,110,95', 0.08); blobs(c, S, r, 10, '255,255,255', 0.12); speckle(c, S, r, 2500, 0.06); },
  brick(c, S, r, b) {
    const ch = 32; const bl = 128; const mortar = lum(b) > 0.6 ? '#BDB7AA' : '#C9C3B5';
    fill(c, mortar, 0, 0, S, S);
    for (let row = 0; row < S / ch; row += 1) {
      const off = row % 2 ? bl / 2 : 0;
      for (let x = -bl; x < S + bl; x += bl) fill(c, shade(b, (r() - 0.5) * 0.22), x + off + 2, row * ch + 2, bl - 4, ch - 4);
    }
    speckle(c, S, r, 1500, 0.07);
  },
  slats(c, S, r, b) {
    const w = 32; fill(c, '#1E1A16', 0, 0, S, S);
    for (let i = 0; i < S / w; i += 1) {
      fill(c, shade(b, (r() - 0.5) * 0.14), i * w + 2, 0, w - 4, S);
      c.strokeStyle = shade(b, -0.4); c.lineWidth = 1;
      for (let g = 0; g < 6; g += 1) { c.globalAlpha = 0.1 + r() * 0.15; const x = i * w + 4 + r() * (w - 8); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - 0.5) * 4, S); c.stroke(); }
      c.globalAlpha = 1;
    }
  },
  stone(c, S, r, b) {
    const rows = 8; const h = S / rows; fill(c, shade(b, -0.25), 0, 0, S, S);
    for (let row = 0; row < rows; row += 1) {
      let x = 0;
      while (x < S - 1) { let w = 80 + r() * 120; if (S - x - w < 70) w = S - x; fill(c, shade(b, (r() - 0.5) * 0.28), x + 2, row * h + 2, w - 4, h - 4); x += w; }
    }
    speckle(c, S, r, 2500, 0.1);
  },
  subway(c, S, r, b) {
    const tw = 64; const th = 32; fill(c, '#D5D2CA', 0, 0, S, S);
    for (let row = 0; row < S / th; row += 1) { const off = row % 2 ? tw / 2 : 0; for (let x = -tw; x < S + tw; x += tw) fill(c, shade(b, (r() - 0.5) * 0.03), x + off + 1.5, row * th + 1.5, tw - 3, th - 3); }
  },
  stripes(c, S, r, b) { for (let i = 0; i < S / 32; i += 1) fill(c, i % 2 ? shade(b, -0.07) : b, i * 32, 0, 32, S); speckle(c, S, r, 1200, 0.05); },
  panels(c, S, r, b) {
    fill(c, b, 0, 0, S, S); const n = 4; const t = S / n;
    for (let i = 0; i < n; i += 1) {
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.strokeRect(i * t + 14, 14, t - 28, S - 28);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.strokeRect(i * t + 17, 17, t - 34, S - 34);
    }
  },
  weave(c, S, r, b) {
    fill(c, b, 0, 0, S, S);
    for (let i = 0; i < S; i += 3) { fill(c, i % 6 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)', 0, i, S, 1); fill(c, i % 6 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)', i, 0, 1, S); }
    speckle(c, S, r, 2000, 0.06);
  },
  velvet(c, S, r, b) { fill(c, b, 0, 0, S, S); blobs(c, S, r, 24, '0,0,0', 0.07); blobs(c, S, r, 18, '255,255,255', 0.06); speckle(c, S, r, 4000, 0.05); },
  boucle(c, S, r, b) {
    fill(c, b, 0, 0, S, S);
    for (let i = 0; i < 1800; i += 1) { c.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${(0.05 + r() * 0.14).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(r() * S, r() * S, 2 + r() * 3, r() * 6.28, r() * 6.28 + 3.5); c.stroke(); }
  },
  leather(c, S, r, b) {
    fill(c, b, 0, 0, S, S); speckle(c, S, r, 5000, 0.07);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
    for (let i = 0; i < 700; i += 1) { const x = r() * S; const y = r() * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); c.stroke(); }
  },
  woodgrain(c, S, r, b, o) {
    const k = o.contrast || 1; fill(c, b, 0, 0, S, S);
    for (let i = 0; i < 70; i += 1) {
      const y0 = r() * S; c.strokeStyle = `rgba(0,0,0,${(0.05 + r() * 0.14 * k).toFixed(3)})`; c.lineWidth = 0.5 + r() * 2; c.beginPath(); c.moveTo(0, y0);
      for (let x = 0; x <= S; x += 32) c.lineTo(x, y0 + Math.sin(x / 70 + i) * (3 + r() * 3));
      c.stroke();
    }
    speckle(c, S, r, 800, 0.05);
  },
  grass(c, S, r, b) {
    fill(c, b, 0, 0, S, S); blobs(c, S, r, 16, '40,80,30', 0.16); blobs(c, S, r, 10, '190,210,110', 0.1);
    for (let i = 0; i < 5200; i += 1) {
      const x = r() * S; const y = r() * S; const l = 4 + r() * 9; const a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      c.strokeStyle = shade(b, (r() - 0.5) * 0.5); c.globalAlpha = 0.45; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.globalAlpha = 1;
  },
  pavers(c, S, r, b) {
    const n = 4; const t = S / n; fill(c, shade(b, -0.28), 0, 0, S, S);
    for (let j = 0; j < n; j += 1) for (let i = 0; i < n; i += 1) {
      const off = j % 2 ? t / 2 : 0; const x = ((i * t + off) % S);
      fill(c, shade(b, (r() - 0.5) * 0.14), x + 2, j * t + 2, t - 4, t - 4);
      if (x + t > S) fill(c, shade(b, (r() - 0.5) * 0.14), x - S + 2, j * t + 2, t - 4, t - 4);
    }
    speckle(c, S, r, 3500, 0.09);
  },
  gravel(c, S, r, b, o) {
    fill(c, shade(b, -0.12), 0, 0, S, S); const n = o.fine ? 9000 : 2600; const max = o.fine ? 2.2 : 6;
    for (let i = 0; i < n; i += 1) {
      const rad = 1 + r() * max; c.fillStyle = shade(b, (r() - 0.5) * 0.45); c.beginPath(); c.ellipse(r() * S, r() * S, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, 6.3); c.fill();
    }
  },
  asphalt(c, S, r, b) {
    fill(c, b, 0, 0, S, S); blobs(c, S, r, 10, '255,255,255', 0.05); speckle(c, S, r, 9000, 0.14);
    for (let i = 0; i < 4; i += 1) { c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; c.beginPath(); let x = r() * S; let y = r() * S; c.moveTo(x, y); for (let k = 0; k < 8; k += 1) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); }
  },
  water(c, S, r, b) {
    const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, shade(b, 0.12)); g.addColorStop(1, shade(b, -0.14)); c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i += 1) { c.strokeStyle = `rgba(255,255,255,${(0.05 + r() * 0.16).toFixed(3)})`; c.lineWidth = 1 + r() * 2; const x = r() * S; const y = r() * S; c.beginPath(); c.ellipse(x, y, 14 + r() * 40, 3 + r() * 8, 0, 0, 6.3); c.stroke(); }
  },
  brushed(c, S, r, b) { fill(c, b, 0, 0, S, S); for (let i = 0; i < 700; i += 1) fill(c, `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${(r() * 0.07).toFixed(3)})`, 0, r() * S, S, 1); }
};

/** Returns a canvas with the painted texture, or null for flat-color materials. */
export function paintMaterialCanvas(def, size = 512) {
  if (!def || def.kind === 'flat' || !P[def.kind]) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  P[def.kind](canvas.getContext('2d'), size, rng(hash(def.id)), def.base, def.opts || {});
  return canvas;
}

const previewCache = new Map();
/** Data URL preview drawn with the SAME painter as the 3D material. */
export function getMaterialPreview(id, { size = 72, tint = null } = {}) {
  const key = `${id}|${size}|${tint || ''}`;
  if (previewCache.has(key)) return previewCache.get(key);
  const def = getMaterial(id);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ctx = out.getContext('2d');
  const source = paintMaterialCanvas(def, 512);
  if (source) ctx.drawImage(source, 0, 0, size, size);
  else { ctx.fillStyle = def ? def.base : '#cccccc'; ctx.fillRect(0, 0, size, size); }
  if (tint && /^#[0-9a-f]{6}$/i.test(tint)) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(0, 0, size, size); }
  const url = out.toDataURL('image/png');
  previewCache.set(key, url);
  return url;
}