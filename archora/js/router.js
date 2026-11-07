// js/router.js — hash router with sliding page transitions.
// New page slides in from the right on link navigation and from the left on browser back,
// the old page slides out with a slight parallax. Reduced motion or missing GSAP: instant switch.
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLIDE = { duration: 0.55, ease: 'power3.inOut', parallax: 18, leavingOpacity: 0.35 };

function compileRoute(route) {
  const keys = [];
  const pattern = route.path.replace(/\/:([A-Za-z0-9_]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; });
  return { ...route, keys, regex: new RegExp('^' + pattern + '$') };
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch (error) { return value; }
}

function readPathFromHash() {
  let raw = window.location.hash.replace(/^#/, '').split('?')[0];
  if (!raw.startsWith('/')) raw = '/' + raw;
  if (raw.length > 1 && raw.endsWith('/')) raw = raw.slice(0, -1);
  return raw;
}

function createContainer(name) {
  const node = document.createElement('div');
  node.className = `page page--${name}`;
  return node;
}

function renderErrorState(container, message) {
  const wrapper = document.createElement('section');
  wrapper.className = 'state-message';
  const heading = document.createElement('h1'); heading.textContent = 'Something went wrong';
  const text = document.createElement('p'); text.textContent = message;
  const link = document.createElement('a'); link.className = 'btn btn--primary'; link.href = '#/home'; link.textContent = 'Back to Home';
  wrapper.append(heading, text, link);
  container.replaceChildren(wrapper);
}

export function createRouter({ outlet, routes, notFound, onRouteChange }) {
  const compiledRoutes = routes.map(compileRoute);
  const scrollPositions = new Map();
  let current = null;           // { route, params, page, path, container }
  let transition = null;        // { leaving, entering, timeline } while a slide is running
  let navigationToken = 0;      // increments on every navigation (cancels stale ones)
  let userClickedLink = false;  // true when navigation came from a link click
  let started = false;

  function matchPath(path) {
    for (const route of compiledRoutes) {
      const result = route.regex.exec(path);
      if (result) {
        const params = {};
        route.keys.forEach((key, index) => { params[key] = safeDecode(result[index + 1]); });
        return { route, params };
      }
    }
    return { route: notFound, params: {} };
  }

  function updateNavState(navName) {
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const isActive = link.dataset.nav === navName;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  }

  function runUnmount(entry) {
    try { entry.page.unmount?.(); } catch (error) { console.error('[router] unmount failed:', error); }
  }

  function resetEntering(node) {
    node.classList.remove('page--entering');
    node.style.transform = '';
    node.style.opacity = '';
  }

  /** Finishes a running slide immediately: unmounts and removes the old page. */
  function settleTransition() {
    if (!transition) return;
    const t = transition;
    transition = null;
    if (t.timeline) t.timeline.kill();
    if (window.gsap) window.gsap.killTweensOf([t.leaving.container, t.entering]);
    runUnmount(t.leaving);
    t.leaving.container.remove();
    resetEntering(t.entering);
    outlet.classList.remove('is-transitioning');
  }

  function finishTransition(t) {
    if (transition === t) settleTransition();
  }

  function teardownCurrent() {
    if (!current) return;
    runUnmount(current);
    current.container.remove();
    current = null;
  }

  /** Removes anything in the outlet that is not the current page (stray error boxes etc.). */
  function sweep() {
    [...outlet.children].forEach((node) => { if (!current || node !== current.container) node.remove(); });
  }

  function showFatal(message) {
    settleTransition();
    teardownCurrent();
    sweep();
    document.body.dataset.layout = 'default';
    const box = createContainer('error');
    outlet.appendChild(box);
    renderErrorState(box, message);
  }

  async function handleRoute() {
    const path = readPathFromHash();
    if (path === '/') { window.location.replace('#/home'); return; }
    if (current && current.path === path) return;

    const myToken = ++navigationToken;
    const isLinkNavigation = userClickedLink;
    userClickedLink = false;
    if (current) scrollPositions.set(current.path, window.scrollY);

    const { route, params } = matchPath(path);

    // Load the module while the old page stays visible (no blank screen).
    let pageModule;
    try {
      pageModule = await route.load();
    } catch (error) {
      if (myToken !== navigationToken) return;
      console.error('[router] failed to load page:', error);
      showFatal('This page could not be loaded. Check the browser console for details.');
      return;
    }
    if (myToken !== navigationToken) return;

    settleTransition(); // finish any slide that is still running

    const prev = current;
    const page = pageModule.default;
    const leavingScrollY = window.scrollY;
    const animate = !!prev && !!window.gsap && !prefersReducedMotion();
    const direction = isLinkNavigation ? 1 : -1; // forward: from right, browser back: from left
    const container = createContainer(route.name);

    document.body.dataset.layout = page.layout || 'default';
    document.body.dataset.route = route.name;
    document.title = page.title ? `${page.title} — ARCHORA` : 'ARCHORA — 3D Architecture Studio';
    updateNavState(route.nav || route.name);

    if (!animate) {
      if (prev) teardownCurrent();
      sweep();
    } else {
      prev.container.classList.add('page--leaving');
      prev.container.setAttribute('aria-hidden', 'true');
      prev.container.setAttribute('inert', '');
      outlet.classList.add('is-transitioning');
      container.classList.add('page--entering');
      window.gsap.set(container, { xPercent: direction * 100 });
    }

    const t = animate ? { leaving: prev, entering: container, timeline: null } : null;
    if (t) transition = t;

    outlet.appendChild(container);
    current = { route, params, page, path, container };

    try {
      await page.mount(container, { params, path, router: api });
    } catch (error) {
      console.error('[router] mount failed:', error);
      renderErrorState(container, 'This page hit an error while loading.');
    }

    // Scroll: restore on back/forward, reset to top on link clicks.
    const saved = scrollPositions.get(path);
    window.scrollTo(0, !isLinkNavigation && saved ? saved : 0);

    if (t && transition === t) {
      // Keep the old page visually in place even though the window scroll changed.
      prev.container.style.top = `${window.scrollY - leavingScrollY}px`;
      t.timeline = window.gsap.timeline({ defaults: { duration: SLIDE.duration, ease: SLIDE.ease }, onComplete: () => finishTransition(t) })
        .to(container, { xPercent: 0 }, 0)
        .to(prev.container, { xPercent: -direction * SLIDE.parallax, opacity: SLIDE.leavingOpacity }, 0);
    } else if (!prev && window.gsap && !prefersReducedMotion()) {
      window.gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'opacity' });
    }

    outlet.focus({ preventScroll: true });
    onRouteChange?.({ route, params, path });
  }

  const onHashChange = () => { handleRoute(); };

  function onDocumentClick(event) {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#/"]') : null;
    if (link) userClickedLink = true;
  }

  function start() {
    if (started) return;
    started = true;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onDocumentClick, true);
    handleRoute();
  }

  function destroy() {
    if (!started) return;
    started = false;
    window.removeEventListener('hashchange', onHashChange);
    document.removeEventListener('click', onDocumentClick, true);
    settleTransition();
    teardownCurrent();
    sweep();
  }

  function navigate(path) {
    userClickedLink = true;
    if (readPathFromHash() === path) return;
    window.location.hash = '#' + path;
  }

  const api = { start, destroy, navigate, getCurrent: () => current };
  return api;
}