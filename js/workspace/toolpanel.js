// js/workspace/toolpanel.js — left tool panel built from TOOL_GROUPS. Library tools open the asset drawer; the rest set real editor tools.
import { el } from '../ui.js';
import { getUi, setUi, subscribeUi } from '../state.js';
import { icon } from './icons.js';
import { TOOL_GROUPS } from './tools.js';

export const findTool = (id) => TOOL_GROUPS.flatMap((g) => g.tools).find((t) => t.id === id) || null;

/** hooks: { openLibrary(scope, toolId), showSection(id) } ; `activeLibrary()` returns the id of the open library tool (or null). */
export function createToolPanel({ openLibrary, showSection, activeLibrary }) {
  const root = el('nav', { class: 'ax__tools', 'aria-label': 'Tools' });
  const buttons = [];
  function activate(tool) {
    const ui = getUi();
    if (tool.toggle) { setUi({ [tool.toggle]: !ui[tool.toggle] }); return; }
    if (tool.section) { showSection(tool.section); return; }
    if (tool.library) { openLibrary(tool.library, tool.id); return; }
    setUi(tool.patch);
  }
  TOOL_GROUPS.forEach((g) => {
    const grid = el('div', { class: 'ax-tools__grid' });
    g.tools.forEach((t) => {
      const b = el('button', { type: 'button', class: 'ax-tool', title: t.title, 'aria-pressed': 'false', onclick: () => activate(t) }, icon(t.icon, 22), el('span', { class: 'ax-tool__l', text: t.label }), t.kbd ? el('kbd', { class: 'ax-tool__k', text: t.kbd }) : null);
      buttons.push({ b, t }); grid.append(b);
    });
    root.append(el('section', { class: 'ax-tools__group', 'aria-label': g.title }, el('h2', { class: 'ax-tools__title', text: g.title }), grid));
  });
  function update() {
    const ui = getUi(); const lib = activeLibrary();
    buttons.forEach(({ b, t }) => { const on = t.toggle ? !!ui[t.toggle] : t.library ? lib === t.id : t.isActive ? !!t.isActive(ui) : false; b.setAttribute('aria-pressed', String(on)); });
  }
  update(); const un = subscribeUi(update);
  return { element: root, update, activate, destroy() { un(); } };
}
