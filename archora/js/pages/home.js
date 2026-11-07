// js/pages/home.js
import { el, prefersReducedMotion, createProjectImage, createFooter } from '../ui.js';
import { getFeaturedProjects, getProjectById } from '../projects.js';
import { createDefaultConfig } from '../state.js';
import { STYLES, getStyle, getItemDef } from '../catalog.js';
import { createPlanPreview } from '../planview.js';

let ctx = null;

function projectCard(project) {
  return el('article', { class: 'project-card reveal' },
    el('a', { class: 'project-card__link', href: `#/projects/${project.id}` },
      el('div', { class: 'project-card__media' }, createProjectImage(project, project.image, project.imageAlt, 'project-card__img')),
      el('div', { class: 'project-card__body' },
        el('p', { class: 'project-card__meta', text: `${project.location} · ${project.year}` }),
        el('h3', { class: 'project-card__title', text: project.title }),
        el('p', { class: 'project-card__text', text: project.description }))));
}

function buildPreview() {
  let styleId = 'modern-minimalist';
  const stage = el('div', { class: 'preview__stage' });
  const desc = el('p', { class: 'panel__note' });
  const buttons = STYLES.map((s) => el('button', { type: 'button', class: 'chip', text: s.name, 'aria-pressed': 'false', onclick: () => { styleId = s.id; render(); } }));
  function render() {
    const cfg = createDefaultConfig(); const st = getStyle(styleId);
    cfg.rooms.forEach((r) => { r.floorMaterial = st.floors[r.type] || st.floors.default; });
    cfg.items.forEach((i) => { const th = st.theme[getItemDef(i.type).role]; if (th) i.color = th.color; });
    stage.replaceChildren(createPlanPreview(cfg, { textures: true }));
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(STYLES[i].id === styleId)));
    desc.textContent = `${st.description} Floors use the real procedural textures; furniture takes the style colors.`;
  }
  render();
  return el('div', { class: 'preview reveal' }, stage,
    el('div', { class: 'preview__controls' },
      el('h3', { text: 'Try a style' }),
      el('div', { class: 'filter-bar', role: 'group', 'aria-label': 'Interior style' }, buttons), desc,
      el('p', { class: 'panel__note', text: 'This is a 2D plan of the demo house. The 3D Studio adds walls, doors, windows, resizing, dimensions, 70+ furniture items and two floors.' }),
      el('a', { class: 'btn btn--light', href: '#/studio', text: 'Open the 3D Studio' })));
}

export default {
  title: 'Home', layout: 'default',
  mount(container) {
    const hero = getProjectById('the-solstice-house');
    const scrollButton = el('button', { type: 'button', class: 'hero__scroll', 'aria-label': 'Scroll to the next section' }, el('span', { text: 'Scroll' }), el('span', { class: 'hero__scroll-line', 'aria-hidden': 'true' }));
    const heroSection = el('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
      el('div', { class: 'hero__media' }, createProjectImage(hero, hero.image, hero.imageAlt, 'hero__image', true)),
      el('div', { class: 'hero__overlay' }),
      el('div', { class: 'hero__content' },
        el('p', { class: 'eyebrow hero__eyebrow', text: 'ARCHORA 3D Architecture Studio' }),
        el('h1', { class: 'hero__title', id: 'hero-title' }, 'Design Your Space.', el('br'), 'Define Your Living.'),
        el('p', { class: 'hero__lead', text: 'Explore architecture, customize interiors, and transform your ideas into spaces that feel uniquely yours.' }),
        el('div', { class: 'hero__actions' }, el('a', { class: 'btn btn--light', href: '#/studio', text: 'Start Designing in 3D' }), el('a', { class: 'btn btn--outline-light', href: '#/projects', text: 'Explore Projects' }))),
      el('dl', { class: 'hero__meta' },
        el('div', {}, el('dt', { text: 'Featured' }), el('dd', { text: hero.title })), el('div', {}, el('dt', { text: 'Location' }), el('dd', { text: hero.location })),
        el('div', {}, el('dt', { text: 'Status' }), el('dd', { text: 'Fictional illustration' }))),
      scrollButton);
    const intro = el('section', { class: 'section' }, el('div', { class: 'container split' },
      el('div', { class: 'reveal' }, el('p', { class: 'eyebrow', text: 'The studio' }), el('h2', { class: 'section__title', text: 'Architecture you can walk through, and make your own.' })),
      el('div', { class: 'reveal' },
        el('p', { class: 'lead', text: 'ARCHORA is a demonstration studio that brings architectural thinking to everyday interiors. Browse our portfolio, then step into a real-time 3D house and reshape it yourself.' }),
        el('p', { text: 'Every project and detail shown here is fictional demonstration content created for this application.' }))));
    const featured = el('section', { class: 'section section--tint' }, el('div', { class: 'container' },
      el('div', { class: 'section__head reveal' }, el('h2', { class: 'section__title', text: 'Featured projects' }), el('a', { class: 'link-arrow', href: '#/projects', text: 'View all projects' })),
      el('div', { class: 'project-grid' }, getFeaturedProjects(3).map(projectCard))));
    const principles = [['01', 'Light first', 'Space is shaped by how light enters, moves and fades through the day.'], ['02', 'Honest materials', 'Timber, stone and plaster are used for what they are, with texture over decoration.'], ['03', 'Calm by design', 'Fewer, better elements create rooms that feel generous and quiet.']];
    const philosophy = el('section', { class: 'section' }, el('div', { class: 'container' }, el('h2', { class: 'section__title reveal', text: 'Design philosophy' }),
      el('div', { class: 'principles' }, principles.map(([n, t, d]) => el('article', { class: 'principle reveal' }, el('p', { class: 'principle__num', text: n }), el('h3', { text: t }), el('p', { text: d }))))));
    const customize = el('section', { class: 'section section--dark' }, el('div', { class: 'container' }, el('div', { class: 'section__head reveal' }, el('h2', { class: 'section__title', text: 'Customize in real time' })), buildPreview()));
    const cta = el('section', { class: 'section cta-band' }, el('div', { class: 'container cta-band__inner reveal' }, el('h2', { class: 'section__title', text: 'Ready to design your home?' }), el('a', { class: 'btn btn--primary', href: '#/studio', text: 'Open the 3D Studio' })));
    container.append(heroSection, intro, featured, philosophy, customize, cta, createFooter());
    scrollButton.addEventListener('click', () => intro.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }));
    const gsap = window.gsap;
    if (!gsap || prefersReducedMotion()) return;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.hero__image', { scale: 1.12, duration: 1.8 }, 0).from('.hero__eyebrow', { y: 20, opacity: 0, duration: 0.7 }, 0.2)
        .from('.hero__title', { y: 40, opacity: 0, duration: 1 }, 0.35).from('.hero__lead', { y: 24, opacity: 0, duration: 0.8 }, 0.6)
        .from('.hero__actions', { y: 20, opacity: 0, duration: 0.7 }, 0.75).from('.hero__meta', { opacity: 0, duration: 0.8 }, 1);
      if (window.ScrollTrigger) {
        gsap.to('.hero__image', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.utils.toArray('.reveal').forEach((node) => gsap.from(node, { y: 36, opacity: 0, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: node, start: 'top 88%', once: true } }));
      }
    }, container);
  },
  unmount() { if (ctx) { ctx.revert(); ctx = null; } }
};