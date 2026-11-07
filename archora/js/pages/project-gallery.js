// js/pages/project-gallery.js
import { el, prefersReducedMotion, createProjectImage, createFooter } from '../ui.js';
import { PROJECT_CATEGORIES, getProjectsByCategory } from '../projects.js';

let currentCategory = 'All';
let grid = null;

export default {
  title: 'Projects', layout: 'default',
  mount(container) {
    const count = el('p', { class: 'filter-count', role: 'status' });
    grid = el('div', { class: 'project-grid' });
    const filterButtons = PROJECT_CATEGORIES.map((category) => el('button', { type: 'button', class: 'chip', text: category, 'aria-pressed': String(category === currentCategory), onclick: () => { currentCategory = category; render(); } }));
    function render() {
      filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === currentCategory)));
      const projects = getProjectsByCategory(currentCategory);
      count.textContent = `Showing ${projects.length} of ${getProjectsByCategory('All').length} projects`;
      const cards = projects.map((project) => el('article', { class: 'project-card' },
        el('a', { class: 'project-card__link', href: `#/projects/${project.id}` },
          el('div', { class: 'project-card__media' }, createProjectImage(project, project.image, project.imageAlt, 'project-card__img')),
          el('div', { class: 'project-card__body' },
            el('p', { class: 'project-card__meta', text: `${project.location} · ${project.year}` }),
            el('h2', { class: 'project-card__title', text: project.title }),
            el('p', { class: 'project-card__text', text: project.description }),
            el('span', { class: 'tag', text: project.category })))));
      grid.replaceChildren(...cards);
      const gsap = window.gsap;
      if (gsap && !prefersReducedMotion()) gsap.from(cards, { opacity: 0, y: 24, duration: 0.5, stagger: 0.06, ease: 'power2.out', clearProps: 'all' });
    }
    container.append(
      el('section', { class: 'page-head' }, el('div', { class: 'container' }, el('p', { class: 'eyebrow', text: 'Portfolio' }), el('h1', { class: 'page-title', text: 'Projects' }),
        el('p', { class: 'lead', text: 'A selection of fictional portfolio examples created to demonstrate ARCHORA. The pictures are illustrations drawn for this demo. None of these buildings or clients are real.' }))),
      el('section', { class: 'section' }, el('div', { class: 'container' }, el('div', { class: 'filter-bar', role: 'group', 'aria-label': 'Filter projects by category' }, filterButtons, count), grid)),
      createFooter());
    render();
  },
  unmount() { if (window.gsap && grid) window.gsap.killTweensOf(grid.children); grid = null; }
};