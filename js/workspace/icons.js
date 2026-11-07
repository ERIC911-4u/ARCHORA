// js/workspace/icons.js — ARCHORA's own stroke icon set (24×24, currentColor). One place, no external requests.
const P = {
  select: 'M5 3l14 7-6 2-2 6z', move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6', floor: 'M3 17l9-5 9 5-9 5zM3 12l9-5 9 5', room: 'M4 4h16v16H4zM4 12h8v8', roof: 'M2 12l10-8 10 8M5 10v10h14V10',
  stairs: 'M3 20h5v-5h5v-5h5V5h3', railing: 'M3 9h18M5 9v11M12 9v11M19 9v11', door: 'M6 21V4h12v17M3 21h18M14 12.5v.01', sliding: 'M3 5h18v16H3zM12 5v16M7 11l-2 2 2 2M17 11l2 2-2 2',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16', arch: 'M5 21V10a7 7 0 0114 0v11M3 21h18', sofa: 'M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3zM6 18v2M18 18v2',
  kitchen: 'M4 3h16v18H4zM4 9h16M8 6h.01M12 6h.01M8 14h8v4H8z', bath: 'M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4zM6 12V6a2 2 0 014 0M7 19l-1 2M17 19l1 2', lamp: 'M9 3h6l3 9H6zM12 12v7M8 21h8',
  decor: 'M4 4h16v16H4zM8 15l3-4 3 3 2-2 2 3', appliance: 'M6 3h12v18H6zM6 9h12M9 6h.01M9 12v3', garden: 'M12 21v-8M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zM12 15c3 0 5-2 5-5-3 0-5 2-5 5z',
  tree: 'M12 22v-7M12 15a6 6 0 100-12 6 6 0 000 12z', plant: 'M12 21v-9M12 12c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5zM8 21h8',
  pool: 'M3 15c2 0 2 1.5 4.5 1.5S10 15 12 15s2.5 1.5 4.5 1.5S19 15 21 15M3 19c2 0 2 1.5 4.5 1.5S10 19 12 19s2.5 1.5 4.5 1.5S19 19 21 19M8 14V5a2 2 0 014 0M14 14V5a2 2 0 014 0M8 8h6',
  driveway: 'M6 21L9 3M18 21L15 3M12 6v2M12 12v2M12 18v2', outdoor: 'M4 10h16M5 10v6M19 10v6M4 14h16M7 16v4M17 16v4', fence: 'M4 21V8l2-2 2 2v13M10 21V8l2-2 2 2v13M16 21V8l2-2 2 2v13M3 12h18M3 17h18',
  landscape: 'M3 20l6-9 4 5 3-4 5 8z', dimension: 'M3 8v8M21 8v8M3 12h18M7 9l-3 3 3 3M17 9l3 3-3 3', grid: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16', erase: 'M4 16l9-9a2 2 0 013 0l3 3a2 2 0 010 3l-6 6H8zM12 20h8',
  save: 'M5 3h11l4 4v14H5zM8 3v6h8V3M8 21v-7h8v7', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3', copy: 'M8 8h12v12H8zM4 16V4h12',
  paste: 'M9 4h6v3H9zM6 5H5v16h14V5h-1M9 12h6M9 16h6', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6', tools: 'M14.5 6.5a4 4 0 004.9 4.9l-8.9 8.9a2.5 2.5 0 01-3.5-3.5l8.9-8.9a4 4 0 00-1.4-1.4z',
  view: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', render: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8z', library: 'M4 4h6v16H4zM14 4h6v16h-6zM7 8h.01',
  import: 'M12 3v12M7 10l5 5 5-5M4 19h16', export: 'M12 15V3M7 8l5-5 5 5M4 19h16', share: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', chevron: 'M6 9l6 6 6-6', menu: 'M4 6h16M4 12h16M4 18h16',
  cube: 'M12 3l9 5v8l-9 5-9-5V8zM12 12l9-4M12 12L3 8M12 12v9', plan: 'M4 4h16v16H4zM4 10h8M12 10v10', home: 'M3 11l9-8 9 8M5 10v10h14V10', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', check: 'M5 12l5 5 9-10',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', close: 'M6 6l12 12M18 6L6 18', rotate: 'M20 12a8 8 0 11-3-6.2M20 4v5h-5', search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  hand: 'M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2 7-6 7-3 0-4-2-6-5l-2-3a1.5 1.5 0 012.5-1.5L8 13', file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8z', snap: 'M12 4v4M12 16v4M4 12h4M16 12h4M12 12h.01',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.5 9a2.5 2.5 0 114 1.9c-.9.6-1.5 1-1.5 2.1M12 17h.01'
};
const NS = 'http://www.w3.org/2000/svg';
export function icon(name, size = 20) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', P[name] || P.select); svg.append(p); return svg;
}
export const hasIcon = (name) => name in P;
