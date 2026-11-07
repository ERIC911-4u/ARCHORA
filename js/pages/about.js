// js/pages/about.js
import { el, openModal, showToast, createFooter, prefersReducedMotion } from '../ui.js';
import {
  AVAILABILITY, getAvailabilityLabel, getDefaultProfile, getProfile, saveProfile, validateProfileInput, previewProfile, profileCompleteness,
  bioToText, fileToPhotoDataUrl, getSocialLinks, downloadVCard, downloadProfileJson, parseProfileJson, buildMailtoUrl, buildWhatsappUrl
} from '../profile.js';

const FALLBACK_PHOTO = 'assets/images/eric-putra-yudhistiro.jpg';
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const SUBJECTS = ['General question', 'Project inquiry', 'Collaboration', 'Other'];
const BLOCKS = [
  ['Studio philosophy', 'We believe good architecture is quiet. It frames daily life, lets light do the work and leaves room for the people who live there.'],
  ['Approach to materials', 'Timber, stone, plaster and concrete are chosen for how they age and feel. We keep palettes small and let texture carry the design.'],
  ['Light and space', 'A room is only as good as its light. We study how daylight enters, how it moves across surfaces and how it turns warm in the evening.']
];
const PRINCIPLES = ['Start with light', 'Use fewer, better materials', 'Connect inside and outside', 'Design for how people really live', 'Keep it calm'];
const initials = (name) => name.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 3).join('');

function openExternal(url, newTab = false) {
  const link = el('a', { href: url });
  if (newTab) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  link.style.display = 'none'; document.body.append(link); link.click(); link.remove();
}

function founderPortrait(profile) {
  const frame = el('div', { class: 'founder__portrait' });
  if (profile.photo) { frame.append(el('img', { class: 'founder__photo', src: profile.photo, alt: `Portrait of ${profile.name}` })); return frame; }
  frame.append(el('div', { class: 'founder__monogram', role: 'img', 'aria-label': `Monogram of ${profile.name}` }, el('span', { text: initials(profile.name) })));
  const img = el('img', { class: 'founder__photo', src: FALLBACK_PHOTO, alt: `Portrait of ${profile.name}`, decoding: 'async' });
  img.addEventListener('load', () => { frame.replaceChildren(img); }, { once: true });
  return frame;
}

function buildFounder(profile, { onContact, onEdit }) {
  const socials = getSocialLinks(profile);
  const meta = el('ul', { class: 'meta-row' }, el('li', {}, el('span', { class: `badge badge--${profile.availability}`, text: getAvailabilityLabel(profile.availability) })),
    profile.location ? el('li', { text: `Based in ${profile.location}` }) : null, profile.workingHours ? el('li', { text: profile.workingHours }) : null);
  return el('div', { class: 'container founder' }, founderPortrait(profile),
    el('div', { class: 'founder__body' },
      el('p', { class: 'eyebrow', text: 'Leadership' }), el('h2', { class: 'section__title', id: 'founder-title', text: profile.name }), el('p', { class: 'founder__role', text: profile.role }),
      profile.headline ? el('p', { class: 'founder__headline', text: profile.headline }) : null, meta,
      profile.stats.length ? el('dl', { class: 'stat-row' }, profile.stats.map((s) => el('div', { class: 'stat' }, el('dt', { class: 'stat__label', text: s.label }), el('dd', { class: 'stat__value', text: s.value })))) : null,
      profile.bio.map((p) => el('p', { text: p })),
      socials.length ? el('div', { class: 'social-row' }, socials.map((l) => el('a', { class: 'social-link', href: l.href, target: '_blank', rel: 'noopener noreferrer', text: l.text, 'aria-label': `${profile.name} on ${l.label} (opens in a new tab)` }))) : null,
      el('div', { class: 'founder__edit' },
        el('button', { type: 'button', class: 'btn btn--primary', text: 'Contact me', onclick: onContact }),
        el('button', { type: 'button', class: 'btn btn--outline', text: 'Save contact (vCard)', onclick: () => { downloadVCard(profile); showToast('Contact card downloaded', 'success'); } }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Copy page link', onclick: async () => { try { await navigator.clipboard.writeText(window.location.href); showToast('Page link copied', 'success'); } catch (error) { showToast('Could not copy automatically.', 'error'); } } }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Edit profile', onclick: onEdit }))));
}

const timeline = (list) => el('ol', { class: 'timeline' }, list.map((e) => el('li', { class: 'timeline__item' },
  e.period ? el('p', { class: 'timeline__period', text: e.period }) : null, el('h3', { class: 'timeline__title', text: e.title }),
  e.org ? el('p', { class: 'timeline__org', text: e.org }) : null, e.text ? el('p', { class: 'timeline__text', text: e.text }) : null)));

function buildProfessional(profile) {
  const out = []; const tagBlock = (title, list) => (list.length ? el('div', {}, el('h2', { class: 'section__title section__title--sm', text: title }), el('ul', { class: 'tag-list' }, list.map((t) => el('li', { class: 'tag', text: t })))) : el('div'));
  if (profile.expertise.length || profile.languages.length) out.push(el('section', { class: 'section' }, el('div', { class: 'container split' }, tagBlock('Expertise', profile.expertise), tagBlock('Languages', profile.languages))));
  if (profile.services.length) out.push(el('section', { class: 'section section--tint' }, el('div', { class: 'container' }, el('h2', { class: 'section__title', text: 'Services' }),
    el('div', { class: 'services-grid' }, profile.services.map((s) => el('article', { class: 'service' }, el('h3', { text: s.title }), s.text ? el('p', { text: s.text }) : null))))));
  if (profile.experience.length || profile.education.length) out.push(el('section', { class: 'section' }, el('div', { class: 'container split' },
    profile.experience.length ? el('div', {}, el('h2', { class: 'section__title', text: 'Experience' }), timeline(profile.experience)) : el('div'),
    profile.education.length ? el('div', {}, el('h2', { class: 'section__title', text: 'Education' }), timeline(profile.education)) : el('div'))));
  return out;
}

let widgetCounter = 0;
function listEditor({ addLabel, max, fields }) {
  const rows = el('div', { class: 'list-editor__rows' });
  const add = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: addLabel });
  const node = el('div', { class: 'list-editor' }, rows, add);
  const refreshAdd = () => { add.disabled = rows.children.length >= max; };
  function addRow(values = {}) {
    if (rows.children.length >= max) return;
    const inputs = {}; const row = el('div', { class: 'list-row' });
    fields.forEach((f) => {
      const id = `le-${++widgetCounter}`;
      const input = f.type === 'textarea' ? el('textarea', { id, class: 'field__input field__textarea field__textarea--sm', rows: '2', maxlength: String(f.max) })
        : el('input', { id, type: 'text', class: 'field__input', maxlength: String(f.max), placeholder: f.placeholder || '', autocomplete: 'off' });
      input.value = values[f.key] || ''; inputs[f.key] = input;
      row.append(el('div', { class: `field${f.wide ? ' field--wide' : ''}` }, el('label', { class: 'field__label', for: id, text: f.label }), input));
    });
    row.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm list-row__remove', text: 'Remove', onclick: () => { row.remove(); refreshAdd(); node.dispatchEvent(new Event('input', { bubbles: true })); } }));
    row._inputs = inputs; rows.append(row); refreshAdd();
  }
  add.addEventListener('click', () => { addRow(); const last = rows.lastElementChild; if (last) last.querySelector('input, textarea').focus(); node.dispatchEvent(new Event('input', { bubbles: true })); });
  return { node, getValue: () => [...rows.children].map((row) => Object.fromEntries(fields.map((f) => [f.key, row._inputs[f.key].value]))), setValue(items) { rows.replaceChildren(); (items || []).forEach(addRow); refreshAdd(); } };
}

function tabs(defs) {
  const list = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Profile sections' });
  const panels = defs.map((d, i) => el('div', { class: 'tab-panel', role: 'tabpanel', id: `panel-${d.id}`, 'aria-labelledby': `tab-${d.id}`, hidden: i !== 0 }, d.node));
  const buttons = defs.map((d, i) => {
    const b = el('button', { type: 'button', class: 'tab', role: 'tab', id: `tab-${d.id}`, 'aria-controls': `panel-${d.id}`, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1', text: d.label });
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + defs.length) % defs.length; select(next); buttons[next].focus(); });
    return b;
  });
  function select(index) { buttons.forEach((b, i) => { b.setAttribute('aria-selected', String(i === index)); b.tabIndex = i === index ? 0 : -1; }); panels.forEach((p, i) => { p.hidden = i !== index; }); }
  list.append(...buttons);
  return el('div', { class: 'tabs-wrap' }, list, ...panels);
}

function openProfileEditor(onSaved) {
  const current = getProfile(); let photo = current.photo;
  const field = (id, label, input, hint, wide = false) => el('div', { class: `field${wide ? ' field--wide' : ''}` }, el('label', { class: 'field__label', for: id, text: label }), input, hint ? el('p', { class: 'field__hint', text: hint }) : null);
  const txt = (id, max, extra = {}) => el('input', { type: 'text', id, class: 'field__input', maxlength: String(max), autocomplete: 'off', ...extra });
  const nameInput = txt('pf-name', 60); const roleInput = txt('pf-role', 80); const headlineInput = txt('pf-headline', 120, { placeholder: 'One line that describes what you do' });
  const locationInput = txt('pf-location', 80, { placeholder: 'City, Country' }); const hoursInput = txt('pf-hours', 60, { placeholder: 'e.g. Mon–Fri, 09:00–17:00 WIB' });
  const availabilitySelect = el('select', { id: 'pf-availability', class: 'select' }, AVAILABILITY.map((a) => el('option', { value: a.id, text: a.label })));
  const bioInput = el('textarea', { id: 'pf-bio', class: 'field__input field__textarea', rows: '6', maxlength: '3600' });
  const expertiseInput = txt('pf-expertise', 400, { placeholder: 'Architecture, Interior design, Project management' }); const languagesInput = txt('pf-languages', 160, { placeholder: 'Indonesian, English' });
  const emailInput = txt('pf-email', 80, { type: 'email', placeholder: 'name@example.com' }); const phoneInput = txt('pf-phone', 30, { type: 'tel', placeholder: '08xx xxxx xxxx or +62 8xx xxxx xxxx' });
  const linkedinInput = txt('pf-linkedin', 200, { placeholder: 'https://www.linkedin.com/in/your-name' }); const instagramInput = txt('pf-instagram', 100, { placeholder: '@username' }); const websiteInput = txt('pf-website', 200, { placeholder: 'https://example.com' });
  const error = el('p', { class: 'field__error', role: 'alert', hidden: true });
  const services = listEditor({ addLabel: 'Add service', max: 6, fields: [{ key: 'title', label: 'Service', max: 50, placeholder: 'e.g. Architectural design' }, { key: 'text', label: 'Description', max: 180, type: 'textarea', wide: true }] });
  const stats = listEditor({ addLabel: 'Add statistic', max: 4, fields: [{ key: 'value', label: 'Value', max: 12, placeholder: 'e.g. 10+' }, { key: 'label', label: 'Label', max: 30, placeholder: 'e.g. Years of experience' }] });
  const career = [{ key: 'period', label: 'Period', max: 30, placeholder: 'e.g. 2018 – 2022' }, { key: 'title', label: 'Title / degree', max: 70 }, { key: 'org', label: 'Organization / school', max: 70 }, { key: 'text', label: 'Details', max: 240, type: 'textarea', wide: true }];
  const experience = listEditor({ addLabel: 'Add experience', max: 8, fields: career }); const education = listEditor({ addLabel: 'Add education', max: 4, fields: career });
  const preview = el('div', { class: 'photo-edit__preview' });
  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'pf-photo', 'aria-label': 'Choose a profile photo' });
  const choose = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Choose photo', onclick: () => fileInput.click() });
  const remove = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Remove photo', onclick: () => { photo = null; refreshPreview(); updateCompleteness(); } });
  const meter = el('progress', { max: '100', value: '0', 'aria-label': 'Profile completeness' }); const meterText = el('p', { class: 'field__hint' });
  const collect = () => ({ name: nameInput.value, role: roleInput.value, headline: headlineInput.value, location: locationInput.value, workingHours: hoursInput.value, availability: availabilitySelect.value, bioText: bioInput.value,
    expertise: expertiseInput.value, languages: languagesInput.value, services: services.getValue(), stats: stats.getValue(), experience: experience.getValue(), education: education.getValue(),
    linkedin: linkedinInput.value, instagram: instagramInput.value, website: websiteInput.value, email: emailInput.value, phone: phoneInput.value, photo });
  const showError = (m) => { error.textContent = m; error.hidden = !m; };
  function refreshPreview() { if (photo) preview.replaceChildren(el('img', { src: photo, alt: 'Selected profile photo' })); else preview.replaceChildren(el('span', { text: initials(nameInput.value || getDefaultProfile().name) })); remove.disabled = !photo; }
  function updateCompleteness() { const r = profileCompleteness(previewProfile(collect())); meter.value = r.percent; meterText.textContent = r.missing.length ? `Profile completeness: ${r.percent}%. Still empty: ${r.missing.join(', ')}.` : 'Profile completeness: 100%.'; }
  function fill(p) {
    nameInput.value = p.name; roleInput.value = p.role; headlineInput.value = p.headline; locationInput.value = p.location; hoursInput.value = p.workingHours; availabilitySelect.value = p.availability; bioInput.value = bioToText(p.bio);
    expertiseInput.value = p.expertise.join(', '); languagesInput.value = p.languages.join(', '); services.setValue(p.services); stats.setValue(p.stats); experience.setValue(p.experience); education.setValue(p.education);
    linkedinInput.value = p.linkedin; instagramInput.value = p.instagram; websiteInput.value = p.website; emailInput.value = p.email; phoneInput.value = p.phone; photo = p.photo;
    showError(''); refreshPreview(); updateCompleteness();
  }
  fileInput.addEventListener('change', async () => { const f = fileInput.files && fileInput.files[0]; fileInput.value = ''; if (!f) return; try { photo = await fileToPhotoDataUrl(f); showError(''); refreshPreview(); updateCompleteness(); } catch (err) { showError(err.message); } });
  nameInput.addEventListener('input', () => { if (!photo) refreshPreview(); });
  const importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'aria-label': 'Import profile JSON file' });
  importInput.addEventListener('change', async () => { const f = importInput.files && importInput.files[0]; importInput.value = ''; if (!f) return; const r = parseProfileJson(await f.text()); if (!r.ok) { showError(r.error); return; } fill(r.profile); showToast('Profile loaded into the form. Press Save to keep it.', 'info'); });

  const panelProfile = el('div', { class: 'form-grid' }, el('div', { class: 'photo-edit field--wide' }, preview, el('div', {}, el('p', { class: 'field__label', text: 'Photo' }), el('div', { class: 'photo-edit__buttons' }, choose, remove, fileInput))),
    field('pf-name', 'Name', nameInput), field('pf-role', 'Title', roleInput), field('pf-headline', 'Headline', headlineInput, null, true), field('pf-location', 'Location', locationInput), field('pf-availability', 'Availability', availabilitySelect),
    field('pf-hours', 'Working hours', hoursInput, null, true), field('pf-bio', 'Biography', bioInput, 'Separate paragraphs with a blank line (max 6 paragraphs).', true));
  const panelExpertise = el('div', { class: 'form-grid' }, field('pf-expertise', 'Expertise', expertiseInput, 'Separate with commas (max 10).', true), field('pf-languages', 'Languages', languagesInput, 'Separate with commas (max 6).', true),
    el('div', { class: 'field--wide' }, el('p', { class: 'field__label', text: 'Highlights (numbers)' }), stats.node), el('div', { class: 'field--wide' }, el('p', { class: 'field__label', text: 'Services' }), services.node));
  const panelCareer = el('div', { class: 'form-grid' }, el('div', { class: 'field--wide' }, el('p', { class: 'field__label', text: 'Experience' }), experience.node), el('div', { class: 'field--wide' }, el('p', { class: 'field__label', text: 'Education' }), education.node));
  const panelContact = el('div', { class: 'form-grid' }, field('pf-email', 'Email (used by “Contact me”)', emailInput, null, true), field('pf-phone', 'Phone / WhatsApp (used by “Contact me”)', phoneInput, 'A leading 0 is treated as Indonesia (+62) for WhatsApp.', true),
    field('pf-linkedin', 'LinkedIn', linkedinInput, null, true), field('pf-instagram', 'Instagram', instagramInput), field('pf-website', 'Website', websiteInput),
    el('div', { class: 'field--wide photo-edit__buttons' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Export profile (JSON)', onclick: () => downloadProfileJson(previewProfile(collect())) }),
      el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Import profile (JSON)', onclick: () => importInput.click() }), importInput));
  const body = el('div', { class: 'profile-form' }, el('div', { class: 'completeness' }, meter, meterText),
    tabs([{ id: 'profile', label: 'Profile', node: panelProfile }, { id: 'expertise', label: 'Expertise', node: panelExpertise }, { id: 'career', label: 'Career', node: panelCareer }, { id: 'contact', label: 'Contact & links', node: panelContact }]),
    error, el('p', { class: 'field__hint', text: 'Saved in this browser only. Use Export to keep a backup file.' }));
  body.addEventListener('input', updateCompleteness);
  fill(current);
  openModal({
    title: 'Edit owner profile', body,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      { label: 'Reset to default', variant: 'ghost', onClick: () => { fill(getDefaultProfile()); return false; } },
      { label: 'Save profile', variant: 'primary', onClick: () => {
        const r = validateProfileInput(collect());
        if (!r.ok) { showError(r.error); return false; }
        const saved = saveProfile(r.profile);
        if (!saved.ok) { showError(saved.error); return false; }
        showToast('Profile saved', 'success'); onSaved(); return undefined;
      } }
    ]
  });
}

function buildContact(profile, onEditProfile) {
  const hasEmail = !!profile.email; const hasPhone = !!buildWhatsappUrl(profile.phone, 'x');
  const nameInput = el('input', { type: 'text', id: 'ct-name', class: 'field__input', maxlength: '60', autocomplete: 'name', required: true });
  const emailInput = el('input', { type: 'email', id: 'ct-email', class: 'field__input', maxlength: '80', autocomplete: 'email', required: true });
  const subjectSelect = el('select', { id: 'ct-subject', class: 'select' }, SUBJECTS.map((s) => el('option', { value: s, text: s })));
  const messageInput = el('textarea', { id: 'ct-message', class: 'field__input field__textarea', rows: '6', maxlength: '1000', required: true });
  const counter = el('p', { class: 'field__hint', text: '0 / 1000' }); const status = el('p', { class: 'form-status', role: 'status' });
  messageInput.addEventListener('input', () => { counter.textContent = `${messageInput.value.length} / 1000`; });
  const field = (id, label, input, extra) => el('div', { class: 'field' }, el('label', { class: 'field__label', for: id, text: label }), input, extra);
  const setStatus = (m, type = '') => { status.textContent = m; status.className = `form-status${type ? ` form-status--${type}` : ''}`; };
  function collect({ needEmail }) {
    const name = nameInput.value.trim(); const email = emailInput.value.trim(); const message = messageInput.value.trim();
    if (!name) { setStatus('Please enter your name.', 'error'); nameInput.focus(); return null; }
    if (needEmail && !EMAIL_PATTERN.test(email)) { setStatus('Please enter a valid email address.', 'error'); emailInput.focus(); return null; }
    if (message.length < 10) { setStatus('Please write a message of at least 10 characters.', 'error'); messageInput.focus(); return null; }
    return { name, email, message, subject: subjectSelect.value };
  }
  const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Send by email', disabled: !hasEmail });
  const whatsapp = el('button', { type: 'button', class: 'btn btn--outline', text: 'Chat on WhatsApp', disabled: !hasPhone });
  const copy = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Copy email', disabled: !hasEmail });
  const form = el('form', { class: 'contact-form', novalidate: true, 'aria-label': `Contact ${profile.name}` }, field('ct-name', 'Your name', nameInput), field('ct-email', 'Your email', emailInput), field('ct-subject', 'Subject', subjectSelect), field('ct-message', 'Message', messageInput, counter),
    el('div', { class: 'contact-actions' }, submit, whatsapp, copy), status, el('p', { class: 'field__hint', text: 'This form does not send messages by itself. It opens your email app or WhatsApp with the message ready to send.' }));
  form.addEventListener('submit', (e) => {
    e.preventDefault(); if (!hasEmail) return;
    const d = collect({ needEmail: true }); if (!d) return;
    openExternal(buildMailtoUrl(profile.email, { subject: `[ARCHORA] ${d.subject} from ${d.name}`, body: `${d.message}\n\n— ${d.name} (${d.email})` }));
    setStatus('Your email app should open now. Press send there to deliver the message.', 'success');
  });
  whatsapp.addEventListener('click', () => {
    const d = collect({ needEmail: false }); if (!d) return;
    const url = buildWhatsappUrl(profile.phone, `Hello ${profile.name}, I am ${d.name}. (${d.subject}) ${d.message}`);
    if (!url) { setStatus('The phone number in the profile is not valid for WhatsApp.', 'error'); return; }
    openExternal(url, true); setStatus('WhatsApp opened in a new tab.', 'success');
  });
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(profile.email); showToast('Email address copied', 'success'); } catch (error) { showToast('Could not copy automatically. Please copy it from the list.', 'error'); } });
  const link = (href, label, external = false) => el('a', { class: 'contact-link', href, text: label, target: external ? '_blank' : null, rel: external ? 'noopener noreferrer' : null });
  const row = (term, value) => el('div', {}, el('dt', { text: term }), el('dd', {}, value));
  const details = el('dl', { class: 'contact-list' }, row('Owner & CEO', profile.name), row('Email', hasEmail ? link(`mailto:${profile.email}`, profile.email) : 'hello@archora.example (placeholder)'),
    row('Phone', profile.phone ? link(`tel:${profile.phone.replace(/[^\d+]/g, '')}`, profile.phone) : '+62 000 0000 0000 (placeholder)'), row('Location', profile.location || 'Sample address, Indonesia (placeholder)'),
    profile.workingHours ? row('Working hours', profile.workingHours) : null, ...getSocialLinks(profile).map((l) => row(l.label, link(l.href, l.text, true))));
  const setup = (!hasEmail || !hasPhone) ? el('div', { class: 'notice' }, el('span', { text: `${!hasEmail ? 'Email is not set. ' : ''}${!hasPhone ? 'Phone is not set. ' : ''}` }), el('button', { type: 'button', class: 'link-button', text: 'Add it in Edit profile', onclick: onEditProfile })) : null;
  return el('div', { class: 'container contact-grid' }, el('div', {}, el('p', { class: 'eyebrow', text: 'Contact' }), el('h2', { class: 'section__title', id: 'contact-title', text: 'Contact me' }),
    el('p', { class: 'lead', text: `Have a project in mind or a question about the studio? Send ${profile.name.split(' ')[0]} a message.` }), details, setup), form);
}

export default {
  title: 'About', layout: 'default',
  mount(container) {
    const founderSection = el('section', { class: 'section', 'aria-labelledby': 'founder-title' });
    const professionalHolder = el('div', { class: 'professional' });
    const contactSection = el('section', { class: 'section section--tint', id: 'contact', 'aria-labelledby': 'contact-title' });
    function render() {
      const profile = getProfile(); const edit = () => openProfileEditor(render);
      const toContact = () => contactSection.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      founderSection.replaceChildren(buildFounder(profile, { onContact: toContact, onEdit: edit }));
      professionalHolder.replaceChildren(...buildProfessional(profile));
      contactSection.replaceChildren(buildContact(profile, edit));
    }
    container.append(
      el('section', { class: 'page-head' }, el('div', { class: 'container' }, el('p', { class: 'eyebrow', text: 'About' }), el('h1', { class: 'page-title', text: 'A studio for spaces that feel like yours.' }),
        el('p', { class: 'notice', text: 'ARCHORA is a demonstration project. Projects, prices and studio details on this site are sample content.' }))),
      founderSection, professionalHolder,
      el('section', { class: 'section section--tint' }, el('div', { class: 'container about-grid' }, BLOCKS.map(([t, p]) => el('article', { class: 'about-block' }, el('h2', { text: t }), el('p', { text: p }))))),
      el('section', { class: 'section' }, el('div', { class: 'container' }, el('h2', { class: 'section__title', text: 'Design principles' }), el('ol', { class: 'principle-list' }, PRINCIPLES.map((p) => el('li', { text: p }))))),
      contactSection,
      el('section', { class: 'section cta-band' }, el('div', { class: 'container cta-band__inner' }, el('h2', { class: 'section__title', text: 'See the ideas in 3D.' }), el('a', { class: 'btn btn--primary', href: '#/studio', text: 'Open the 3D Studio' }))),
      createFooter());
    render();
  },
  unmount() {}
};