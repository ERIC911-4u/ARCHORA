// js/profile.js — owner/CEO profile: defaults, validation, localStorage, photo processing, vCard, backup, contact helpers.
const STORAGE_KEY = 'archora.profile.v1';
const MAX_PHOTO_CHARS = 250000;
const MAX_JSON_BYTES = 600 * 1024;

export const AVAILABILITY = [{ id: 'open', label: 'Open for new projects' }, { id: 'limited', label: 'Limited availability' }, { id: 'closed', label: 'Not taking new projects' }];
export const getAvailabilityLabel = (id) => AVAILABILITY.find((a) => a.id === id)?.label ?? AVAILABILITY[0].label;

export const DEFAULT_PROFILE = Object.freeze({
  name: 'Eric Putra Yudhistiro', role: 'Founder, Owner & Chief Executive Officer', headline: 'Leading the ARCHORA 3D Architecture Studio',
  location: '', availability: 'open', workingHours: '',
  bio: [
    'Eric Putra Yudhistiro is the owner and CEO of ARCHORA. He leads the studio’s design direction, product vision and the way people explore and customize their own spaces.',
    'Under his leadership, ARCHORA brings architectural thinking to everyday interiors: light first, honest materials and calm, generous rooms.'
  ],
  languages: [], expertise: [], services: [], experience: [], education: [], stats: [], linkedin: '', instagram: '', website: '', email: '', phone: '', photo: null
});
export const getDefaultProfile = () => JSON.parse(JSON.stringify(DEFAULT_PROFILE));

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[0-9+\-() ]{3,30}$/;
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max) : '');

function cleanUrl(value, hostSuffix) {
  let v = text(value, 200);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (hostSuffix && !(url.hostname === hostSuffix || url.hostname.endsWith(`.${hostSuffix}`))) return '';
    url.protocol = 'https:';
    return url.href;
  } catch (error) { return ''; }
}
function cleanInstagram(value) {
  let v = text(value, 100).replace(/^@/, '');
  if (!v) return '';
  const match = v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  if (match) v = match[1];
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : '';
}
const tags = (value, max, maxLen) => (Array.isArray(value) ? value : String(value || '').split(/[,\n]/)).map((t) => text(t, maxLen)).filter(Boolean).slice(0, max);
const pairs = (value, max) => (Array.isArray(value) ? value : []).map((e) => ({ title: text(e?.title, 50), text: text(e?.text, 180) })).filter((e) => e.title).slice(0, max);
const entries = (value, max) => (Array.isArray(value) ? value : []).map((e) => ({ period: text(e?.period, 30), title: text(e?.title, 70), org: text(e?.org, 70), text: text(e?.text, 240) })).filter((e) => e.title).slice(0, max);
const statList = (value) => (Array.isArray(value) ? value : []).map((e) => ({ value: text(e?.value, 12), label: text(e?.label, 30) })).filter((e) => e.value && e.label).slice(0, 4);

function clean(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const email = text(src.email, 80); const phone = text(src.phone, 30);
  const photo = typeof src.photo === 'string' && src.photo.startsWith('data:image/jpeg;base64,') && src.photo.length <= MAX_PHOTO_CHARS ? src.photo : null;
  return {
    name: text(src.name, 60) || DEFAULT_PROFILE.name, role: text(src.role, 80) || DEFAULT_PROFILE.role,
    headline: typeof src.headline === 'string' ? text(src.headline, 120) : DEFAULT_PROFILE.headline,
    location: text(src.location, 80), availability: AVAILABILITY.some((a) => a.id === src.availability) ? src.availability : 'open', workingHours: text(src.workingHours, 60),
    bio: Array.isArray(src.bio) ? src.bio.map((p) => text(p, 600)).filter(Boolean).slice(0, 6) : [...DEFAULT_PROFILE.bio],
    languages: tags(src.languages, 6, 24), expertise: tags(src.expertise, 10, 30), services: pairs(src.services, 6),
    experience: entries(src.experience, 8), education: entries(src.education, 4), stats: statList(src.stats),
    linkedin: cleanUrl(src.linkedin, 'linkedin.com'), instagram: cleanInstagram(src.instagram), website: cleanUrl(src.website),
    email: EMAIL_PATTERN.test(email) ? email : '', phone: PHONE_PATTERN.test(phone) ? phone : '', photo
  };
}

export const parseBio = (value) => String(value || '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
export const bioToText = (bio) => bio.join('\n\n');
const toRaw = (values) => ({ ...values, bio: parseBio(values?.bioText) });
export const previewProfile = (values) => clean(toRaw(values));

export function validateProfileInput(values) {
  const v = values || {};
  if (!text(v.name, 60)) return { ok: false, error: 'Please enter a name.' };
  const paragraphs = parseBio(v.bioText);
  if (paragraphs.length > 6) return { ok: false, error: 'The biography can have at most 6 paragraphs.' };
  if (paragraphs.some((p) => p.length > 600)) return { ok: false, error: 'Each biography paragraph can have at most 600 characters.' };
  const countTags = (value) => (Array.isArray(value) ? value : String(value || '').split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean).length;
  if (countTags(v.expertise) > 10) return { ok: false, error: 'Expertise can have at most 10 items.' };
  if (countTags(v.languages) > 6) return { ok: false, error: 'Languages can have at most 6 items.' };
  const email = text(v.email, 80);
  if (email && !EMAIL_PATTERN.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  const phone = text(v.phone, 30);
  if (phone && !PHONE_PATTERN.test(phone)) return { ok: false, error: 'Phone can only contain digits, spaces and + - ( ).' };
  if (text(v.linkedin, 200) && !cleanUrl(v.linkedin, 'linkedin.com')) return { ok: false, error: 'LinkedIn must be a valid link on linkedin.com.' };
  if (text(v.instagram, 100) && !cleanInstagram(v.instagram)) return { ok: false, error: 'Instagram must be a username (letters, numbers, . and _) or an instagram.com link.' };
  if (text(v.website, 200) && !cleanUrl(v.website)) return { ok: false, error: 'Website must be a valid link.' };
  return { ok: true, profile: clean(toRaw(v)) };
}

export function getProfile() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? clean(JSON.parse(raw)) : clean(DEFAULT_PROFILE); }
  catch (error) { console.error('[profile] read failed:', error); return clean(DEFAULT_PROFILE); }
}
export function saveProfile(profile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean(profile))); return { ok: true }; }
  catch (error) { console.error('[profile] save failed:', error); return { ok: false, error: 'Could not save: browser storage is full or unavailable.' }; }
}

export function profileCompleteness(profile) {
  const checks = [['Photo', !!profile.photo], ['Headline', !!profile.headline], ['Location', !!profile.location], ['Biography', profile.bio.length > 0], ['Expertise (3 or more)', profile.expertise.length >= 3],
    ['Services', profile.services.length > 0], ['Experience', profile.experience.length > 0], ['Education', profile.education.length > 0], ['Email', !!profile.email], ['Phone', !!profile.phone], ['A social or website link', !!(profile.linkedin || profile.instagram || profile.website)]];
  const done = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

export function getSocialLinks(profile) {
  const links = [];
  if (profile.linkedin) links.push({ label: 'LinkedIn', text: 'LinkedIn', href: profile.linkedin });
  if (profile.instagram) links.push({ label: 'Instagram', text: `@${profile.instagram}`, href: `https://instagram.com/${profile.instagram}` });
  if (profile.website) links.push({ label: 'Website', text: new URL(profile.website).hostname.replace(/^www\./, ''), href: profile.website });
  return links;
}

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
function downloadText(filename, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function buildVCard(profile, pageUrl = '') {
  const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const parts = profile.name.split(/\s+/); const family = parts.length > 1 ? parts[parts.length - 1] : ''; const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(profile.name)}`, `N:${esc(family)};${esc(given)};;;`, 'ORG:ARCHORA', `TITLE:${esc(profile.role)}`];
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(profile.email)}`);
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${esc(profile.phone)}`);
  const url = profile.website || pageUrl; if (url) lines.push(`URL:${esc(url)}`);
  if (profile.location) lines.push(`NOTE:${esc(`Based in ${profile.location}`)}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}
export const downloadVCard = (profile) => downloadText(`${slug(profile.name)}.vcf`, 'text/vcard;charset=utf-8', buildVCard(profile, window.location.href.split('#')[0]));
export const downloadProfileJson = (profile) => downloadText(`archora-profile-${slug(profile.name)}.json`, 'application/json', JSON.stringify({ app: 'ARCHORA-profile', version: 2, exportedAt: new Date().toISOString(), profile }, null, 2));
export function parseProfileJson(content) {
  try {
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_JSON_BYTES) return { ok: false, error: 'The file is empty or too large.' };
    const data = JSON.parse(content);
    const candidate = data && data.app === 'ARCHORA-profile' && data.profile ? data.profile : data;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !('name' in candidate)) return { ok: false, error: 'This file does not look like an ARCHORA profile.' };
    return { ok: true, profile: clean(candidate) };
  } catch (error) { return { ok: false, error: 'This file is not valid JSON.' }; }
}

export function fileToPhotoDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith('image/')) { reject(new Error('Please choose an image file (JPG, PNG or WebP).')); return; }
    if (file.size > 10 * 1024 * 1024) { reject(new Error('The image is larger than 10 MB.')); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      try {
        const W = 400; const H = 500; const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d'); const target = W / H; const ratio = img.naturalWidth / img.naturalHeight;
        let sw = img.naturalWidth; let sh = img.naturalHeight; let sx = 0; let sy = 0;
        if (ratio > target) { sw = img.naturalHeight * target; sx = (img.naturalWidth - sw) / 2; } else { sh = img.naturalWidth / target; sy = (img.naturalHeight - sh) / 2; }
        ctx.fillStyle = '#171816'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        let quality = 0.85; let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > MAX_PHOTO_CHARS && quality > 0.4) { quality -= 0.1; data = canvas.toDataURL('image/jpeg', quality); }
        URL.revokeObjectURL(url);
        if (data.length > MAX_PHOTO_CHARS) reject(new Error('The image is too detailed to store. Try a smaller photo.')); else resolve(data);
      } catch (error) { URL.revokeObjectURL(url); reject(new Error('This image could not be processed.')); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')); };
    img.src = url;
  });
}

export function phoneToWhatsapp(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2); else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}
export const buildMailtoUrl = (to, { subject, body }) => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export function buildWhatsappUrl(phone, message) { const number = phoneToWhatsapp(phone); return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : ''; }