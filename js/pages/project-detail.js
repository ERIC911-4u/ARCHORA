// js/pages/project-detail.js
import { el, createProjectImage, createFooter, confirmDialog, showToast } from '../ui.js';
import { getProjectById } from '../projects.js';
import { getStyleName } from '../catalog.js';
import { applyStyle } from '../actions.js';
import { isDirty } from '../state.js';

export default {
  title: 'Project', layout: 'default',
  mount(container, { params, router }) {
    const project = getProjectById(params.id);
    if (!project) {
      container.append(el('section', { class: 'state-message' }, el('h1', { text: 'Project not found' }), el('p', { text: `We could not find a project called “${params.id}”.` }), el('a', { class: 'btn btn--primary', href: '#/projects', text: 'Back to Projects' })), createFooter());
      document.title = 'Project not found — ARCHORA';
      return;
    }
    document.title = `${project.title} — ARCHORA`;
    const applyBtn = el('button', { type: 'button', class: 'btn btn--outline', text: `Try the ${getStyleName(project.studioStyle)} style`,
      onclick: async () => {
        if (isDirty() && !(await confirmDialog({ title: 'Replace current design?', message: 'Applying this style changes the finishes of your current unsaved design (you can undo in the Studio).', confirmLabel: 'Apply style' }))) return;
        applyStyle(project.studioStyle);
        showToast(`Style applied: ${getStyleName(project.studioStyle)}`, 'success');
        router.navigate('/studio');
      } });
    const meta = [['Location', project.location], ['Year', String(project.year)], ['Category', project.category], ['Style', project.style]];
    Object.entries(project.metadata).forEach(([k, v]) => meta.push([k.charAt(0).toUpperCase() + k.slice(1), String(v)]));
    container.append(
      el('section', { class: 'detail-hero' },
        createProjectImage(project, project.image, project.imageAlt, 'detail-hero__img', true), el('div', { class: 'detail-hero__overlay' }),
        el('div', { class: 'container detail-hero__content' },
          el('a', { class: 'link-arrow link-arrow--back', href: '#/projects', text: 'Back to Projects' }),
          el('h1', { class: 'page-title', text: project.title }),
          el('p', { class: 'detail-hero__sub', text: `${project.location} · ${project.year} · ${project.category}` }))),
      el('section', { class: 'section' }, el('div', { class: 'container detail-grid' },
        el('div', {},
          el('h2', { class: 'section__title', text: 'Design concept' }), el('p', { class: 'lead', text: project.concept }),
          el('h2', { class: 'section__title section__title--sm', text: 'Architecture' }), el('p', { text: project.architecture }),
          el('h2', { class: 'section__title section__title--sm', text: 'Materials' }),
          el('ul', { class: 'material-list' }, project.materials.map((m) => { const dot = el('span', { class: 'material-chip__dot', 'aria-hidden': 'true' }); dot.style.setProperty('--dot', m.color); return el('li', { class: 'material-chip' }, dot, m.name); }))),
        el('aside', { class: 'detail-meta' },
          el('dl', {}, meta.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v })))),
          el('p', { class: 'panel__note', text: 'Fictional portfolio example. The images are illustrations drawn for this demo, not photographs of a real building.' }),
          el('div', { class: 'detail-meta__actions' }, el('a', { class: 'btn btn--primary', href: '#/studio', text: 'Start Designing' }), applyBtn)))),
      el('section', { class: 'section section--tint' }, el('div', { class: 'container' },
        el('h2', { class: 'section__title', text: 'Plan and materials' }),
        el('div', { class: 'gallery-strip' }, project.gallery.map((g) => el('figure', {}, createProjectImage(project, g.src, g.alt, 'gallery-strip__img'), el('figcaption', { text: g.caption })))))),
      createFooter());
  },
  unmount() {}
};