// js/projects.js — fictional demonstration projects. Illustrations are drawn in code from each project's own data,
// so every picture matches its description. No external images are used.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const R = (x, y, w, h, f, o = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${o}/>`;
const P = (pts, f, o = '') => `<polygon points="${pts}" fill="${f}" ${o}/>`;
const C = (x, y, r, f, o = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${o}/>`;
const T = (x, y, size, fill, text, o = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="Georgia, serif" ${o}>${esc(text)}</text>`;
const L = (x1, y1, x2, y2, stroke, w = 2, o = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" ${o}/>`;
const glass = (x, y, w, h, n = 3, frame = '#2B2B29') => R(x, y, w, h, '#BFD8E6') + R(x + w * 0.05, y + h * 0.08, w * 0.3, h * 0.3, '#FFFFFF', 'opacity=".25"')
  + Array.from({ length: n + 1 }, (_, i) => R(x + (w * i) / n - 3, y, 6, h, frame)).join('') + R(x, y - 3, w, 6, frame) + R(x, y + h - 3, w, 6, frame);
const lines = (x, y, w, h, step, stroke) => { let s = ''; for (let yy = y + step; yy < y + h; yy += step) s += L(x, yy, x + w, yy, stroke, 2); return s; };
const tree = (x, y, h, f = '#4F6B4A') => R(x - 6, y - h * 0.45, 12, h * 0.45, '#6B4A32') + C(x, y - h * 0.62, h * 0.34, f) + C(x - h * 0.2, y - h * 0.5, h * 0.24, f) + C(x + h * 0.2, y - h * 0.5, h * 0.24, f);
const palm = (x, y, h) => {
  const cx = x + 8; const cy = y - h;
  let s = `<path d="M${x} ${y} Q${x + 18} ${y - h / 2} ${cx} ${cy}" stroke="#6B4A32" stroke-width="10" fill="none"/>`;
  [-150, -110, -70, -30, 10, 50, 170].forEach((a) => { s += `<ellipse cx="${cx + 55}" cy="${cy}" rx="60" ry="11" fill="#3F7D3A" transform="rotate(${a} ${cx} ${cy})"/>`; });
  return s;
};

const SCENES = {
  solstice: () => [
    R(0, 0, 1600, 1000, '#F0DCC0'), C(1250, 250, 90, '#E8B766'),
    P('0,620 300,470 620,560 980,430 1300,520 1600,440 1600,1000 0,1000', '#9DA98C'), P('0,700 400,600 900,660 1300,590 1600,650 1600,1000 0,1000', '#7E9070'), R(0, 800, 1600, 200, '#6F7F5E'),
    R(300, 560, 520, 200, '#8A5E3B'), glass(340, 600, 440, 140, 4), P('250,560 880,560 840,525 290,525', '#2E2F2C'),
    R(760, 650, 460, 150, '#8A5E3B'), glass(800, 685, 380, 100, 3), P('710,650 1270,650 1230,620 750,620', '#2E2F2C'),
    R(700, 800, 720, 22, '#C9A06A'), R(900, 830, 520, 60, '#6FB7C9'), R(900, 830, 520, 8, '#A7D8E4'),
    palm(1480, 820, 300), palm(230, 800, 260), palm(150, 830, 200)
  ].join(''),
  concrete: () => [
    R(0, 0, 1600, 1000, '#D8DDE0'), R(0, 780, 1600, 220, '#8F9A86'),
    R(240, 470, 520, 330, '#A09E98'), lines(240, 470, 520, 330, 30, 'rgba(0,0,0,.10)'), R(240, 450, 520, 24, '#7E7C76'),
    R(840, 350, 520, 450, '#8E8C86'), lines(840, 350, 520, 450, 30, 'rgba(0,0,0,.10)'), R(840, 330, 520, 24, '#6E6C66'),
    glass(300, 540, 300, 170, 3), glass(900, 420, 120, 300, 1), glass(1100, 420, 200, 160, 2), glass(1100, 620, 200, 130, 2),
    tree(800, 800, 300), tree(790, 800, 180, '#5E7D55'), R(780, 790, 40, 14, '#6B4A32')
  ].join(''),
  coastal: () => [
    R(0, 0, 1600, 1000, '#CFE3EE'), C(1300, 200, 80, '#FFF1C9'), R(0, 620, 1600, 150, '#5EA2B8'), R(0, 640, 1600, 6, '#8CC3D4'), R(0, 770, 1600, 230, '#E4D5B5'),
    R(300, 520, 1000, 230, '#F7F5EF'), glass(380, 560, 640, 170, 4, '#FFFFFF'), R(1080, 560, 160, 170, '#E6E1D6'),
    R(230, 470, 1140, 50, '#FFFFFF'), R(230, 520, 1140, 10, '#D9D5CB'),
    [250, 560, 870, 1180].map((x) => R(x, 530, 14, 220, '#FFFFFF')).join(''), R(220, 750, 1160, 16, '#D9D2C2'),
    palm(1480, 830, 300), palm(150, 840, 240)
  ].join(''),
  forest: () => {
    let trees = '';
    for (let i = 0; i < 15; i += 1) trees += tree(60 + i * 110, 790, 300 + ((i * 37) % 90), i % 2 ? '#4F6B4A' : '#3E5A3A');
    let posts = ''; for (let i = 0; i < 6; i += 1) posts += R(300 + i * 190, 545, 18, 235, '#6B4A32');
    let slats = ''; for (let i = 0; i < 12; i += 1) slats += R(1040 + i * 20, 560, 8, 200, '#8A5E3B');
    return [
      R(0, 0, 1600, 1000, '#DCE8DA'), trees, R(0, 780, 1600, 220, '#7E9070'),
      R(318, 545, 960, 215, '#F6E6C0', 'opacity=".6"'), slats,
      P('220,520 800,330 1380,520', '#8A5E3B'), P('260,520 800,360 1340,520 1340,545 260,545', '#6B4A32'), posts, R(260, 760, 1080, 26, '#C9A06A'),
      [420, 640, 860].map((x) => R(x, 690, 120, 14, '#8A5E3B') + R(x + 10, 704, 8, 56, '#6B4A32') + R(x + 102, 704, 8, 56, '#6B4A32')).join(''),
      [480, 700, 920].map((x) => C(x, 600, 14, '#FFE9A8') + L(x, 545, x, 590, '#6B4A32', 3)).join('')
    ].join('');
  },
  urban: () => [
    R(0, 0, 1600, 1000, '#F3F0E8'), R(0, 760, 1600, 240, '#C9A06A'), lines(0, 760, 1600, 240, 40, 'rgba(0,0,0,.12)'),
    R(900, 120, 600, 520, '#CFE0EA'), [[930, 380, 70, 260], [1020, 300, 90, 340], [1130, 420, 60, 220], [1210, 340, 100, 300], [1330, 400, 80, 240]].map(([x, y, w, h]) => R(x, y, w, h, '#9DB1BD')).join(''),
    [900, 1050, 1200, 1350, 1500].map((x) => R(x - 3, 120, 6, 520, '#2B2B29')).join(''), R(900, 637, 600, 6, '#2B2B29'),
    R(80, 120, 120, 640, '#8A5E3B'), lines(80, 120, 120, 640, 26, 'rgba(0,0,0,.2)'),
    R(250, 750, 520, 36, '#D6C3A5'), R(300, 540, 420, 70, '#7A7468'), R(300, 600, 420, 110, '#8C8579'), R(280, 590, 40, 120, '#7A7468'), R(700, 590, 40, 120, '#7A7468'),
    R(430, 700, 190, 42, '#C9A06A'), R(450, 742, 12, 18, '#6B4A32'), R(588, 742, 12, 18, '#6B4A32'),
    R(980, 640, 420, 120, '#EDEBE6'), R(980, 700, 420, 60, '#8A5E3B'),
    [1040, 1190, 1340].map((x) => L(x, 120, x, 440, '#2B2B29', 3) + C(x, 470, 34, '#F3E7D0') + C(x, 470, 34, '#FFE9A8', 'opacity=".5"')).join(''),
    [1030, 1170, 1310].map((x) => C(x, 660, 22, '#8A5E3B') + R(x - 3, 660, 6, 100, '#2B2B29')).join('')
  ].join(''),
  courtyard: () => [
    R(0, 0, 1600, 1000, '#E6EBEF'), R(0, 780, 1600, 220, '#CBB992'),
    R(500, 470, 600, 310, '#F5EFE0'), P('470,470 1130,470 1080,380 520,380', '#B9674A'),
    [0, 1, 2, 3].map((i) => `<path d="M${560 + i * 140} 780 V600 Q${600 + i * 140} 540 ${640 + i * 140} 600 V780 Z" fill="#6B5A44"/>`).join(''),
    R(120, 520, 420, 260, '#F5EFE0'), P('90,520 540,520 500,430 130,430', '#B9674A'), glass(170, 570, 140, 150, 2, '#6B4A32'), glass(350, 570, 140, 150, 2, '#6B4A32'),
    R(1060, 520, 420, 260, '#F5EFE0'), P('1060,520 1510,520 1470,430 1100,430', '#B9674A'), glass(1110, 570, 140, 150, 2, '#6B4A32'), glass(1290, 570, 140, 150, 2, '#6B4A32'),
    R(540, 770, 520, 14, '#B3A27C'), tree(800, 790, 360, '#5E7D55'), tree(640, 790, 150, '#6F8F63'), tree(960, 790, 150, '#6F8F63')
  ].join('')
};

const svgDoc = (inner, mark = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">${inner}${mark ? T(40, 972, 26, 'rgba(23,24,22,.6)', 'Illustration · fictional project') : ''}</svg>`;
const toUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function planSvg(p) {
  const s = 12; const ox = 200; const oy = 170;
  const rooms = p.plan.map(([label, x, y, w, h, kind]) => {
    const fill = kind === 'pool' ? '#BFE0EA' : kind === 'outdoor' ? '#D3E3CB' : '#E4DFD3';
    const stroke = kind ? '#5F5C55' : '#171816'; const dash = kind ? 'stroke-dasharray="16 10"' : '';
    return R(ox + x * s, oy + y * s, w * s, h * s, fill, `stroke="${stroke}" stroke-width="6" ${dash}`) + T(ox + (x + w / 2) * s, oy + (y + h / 2) * s + 12, 34, '#171816', label, 'text-anchor="middle"');
  }).join('');
  const head = T(200, 100, 54, '#171816', p.title) + T(200, 140, 26, '#5F5C55', `${p.location} · schematic plan, not to scale`);
  const north = `${C(1460, 200, 44, 'none', 'stroke="#171816" stroke-width="4"')}${P('1460,166 1478,214 1460,204 1442,214', '#171816')}${T(1460, 270, 26, '#171816', 'N', 'text-anchor="middle"')}`;
  return svgDoc(R(0, 0, 1600, 1000, '#F3F0E8') + head + north + rooms, false);
}

function boardSvg(p) {
  const n = p.materials.length; const size = 300; const gap = 60; const total = n * size + (n - 1) * gap; const x0 = (1600 - total) / 2;
  const sw = p.materials.map((m, i) => R(x0 + i * (size + gap), 300, size, size, m.color, 'stroke="#171816" stroke-opacity=".25" stroke-width="3"') + T(x0 + i * (size + gap) + size / 2, 660, 34, '#171816', m.name, 'text-anchor="middle"')).join('');
  return svgDoc(R(0, 0, 1600, 1000, '#F3F0E8') + T(x0, 150, 54, '#171816', p.title) + T(x0, 200, 26, '#5F5C55', 'Material palette') + sw, false);
}

// Realistic architectural photography for project thumbnails
const REAL_IMAGES = {
  solstice:
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',

  concrete:
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85',

  coastal:
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=85',

  forest:
    'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85',

  urban:
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',

  courtyard:
    'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1600&q=85'
};

export const PROJECT_CATEGORIES = ['All', 'Residential', 'Commercial', 'Interior'];

export const PROJECTS = [
  {
    id: 'the-solstice-house', title: 'The Solstice House', location: 'Bali, Indonesia', year: 2025, category: 'Residential', style: 'Tropical Modern', studioStyle: 'tropical-modern', scene: 'solstice',
    description: 'A hillside villa where every room opens toward the afternoon light.',
    concept: 'The house follows the path of the sun. Deep eaves shade the living spaces at noon, while the western terrace is left open to catch the golden hour.',
    architecture: 'Long timber-framed volumes step down the slope and connect through shaded walkways. Large sliding glass panels dissolve the boundary between living room, garden and pool.',
    materials: [{ name: 'Teak timber', color: '#8A5E3B' }, { name: 'Volcanic stone', color: '#5A5750' }, { name: 'Low-iron glass', color: '#BFD8E6' }, { name: 'Lime plaster', color: '#EDE6D8' }],
    plan: [['Living', 8, 14, 34, 26], ['Kitchen', 42, 14, 20, 26], ['Bedroom 1', 62, 14, 18, 26], ['Bedroom 2', 80, 14, 14, 26], ['Terrace', 8, 40, 54, 8, 'outdoor'], ['Pool', 46, 50, 40, 8, 'pool']],
    imageAlt: 'Illustration of a timber villa with deep eaves, glass walls and a pool on a tropical hillside',
    metadata: { area: '420 m²', bedrooms: 4, status: 'Fictional concept' }
  },
  {
    id: 'the-concrete-retreat', title: 'The Concrete Retreat', location: 'Bandung, Indonesia', year: 2024, category: 'Residential', style: 'Industrial', studioStyle: 'industrial', scene: 'concrete',
    description: 'A quiet family home in exposed concrete, softened by planting and warm timber.',
    concept: 'Raw concrete is treated as a calm backdrop rather than a statement. Light, shadow and greenery give the material its character.',
    architecture: 'Two cast-in-place volumes enclose a sheltered courtyard. Steel-framed windows and dark metal details contrast with the soft texture of the board-formed walls.',
    materials: [{ name: 'Board-formed concrete', color: '#A09E98' }, { name: 'Blackened steel', color: '#2B2B29' }, { name: 'Reclaimed wood', color: '#8A5E3B' }, { name: 'Clear glass', color: '#BFD8E6' }],
    plan: [['Living', 6, 8, 36, 24], ['Kitchen', 6, 32, 36, 18], ['Courtyard', 42, 8, 16, 42, 'outdoor'], ['Bedroom 1', 58, 8, 36, 20], ['Bedroom 2', 58, 28, 36, 22]],
    imageAlt: 'Illustration of two exposed-concrete volumes around a courtyard tree with steel-framed windows',
    metadata: { area: '310 m²', bedrooms: 3, status: 'Fictional concept' }
  },
  {
    id: 'the-coastal-residence', title: 'The Coastal Residence', location: 'Lombok, Indonesia', year: 2026, category: 'Residential', style: 'Modern Minimalist', studioStyle: 'modern-minimalist', scene: 'coastal',
    description: 'A white, wind-swept house designed for slow days by the sea.',
    concept: 'Simple geometry and a pale palette let the horizon do the work. Cross-ventilation replaces mechanical cooling wherever possible.',
    architecture: 'A single-storey pavilion with a floating roof plane, a deep veranda and a continuous glass facade facing the ocean.',
    materials: [{ name: 'White render', color: '#F7F5EF' }, { name: 'Pale limestone', color: '#D9D4C7' }, { name: 'Bleached oak', color: '#E2CFA9' }, { name: 'Brushed aluminium', color: '#C9C9C6' }],
    plan: [['Living', 8, 10, 38, 26], ['Kitchen', 46, 10, 20, 26], ['Bedroom 1', 66, 10, 26, 14], ['Bedroom 2', 66, 24, 26, 12], ['Veranda', 8, 36, 84, 10, 'outdoor']],
    imageAlt: 'Illustration of a white single-storey house with a floating roof, glass facade and veranda beside the sea',
    metadata: { area: '280 m²', bedrooms: 3, status: 'Fictional concept' }
  },
  {
    id: 'the-forest-pavilion', title: 'The Forest Pavilion', location: 'Bogor, Indonesia', year: 2025, category: 'Commercial', style: 'Tropical Modern', studioStyle: 'tropical-modern', scene: 'forest',
    description: 'An open-air cafe and event pavilion set among mature trees.',
    concept: 'The building steps back so the trees stay in charge. Visitors move from shaded entry to open terrace without crossing a single closed door.',
    architecture: 'A lightweight timber structure under a broad, gently pitched roof. Operable screens adjust for rain, sun and evening events.',
    materials: [{ name: 'Laminated timber', color: '#8A5E3B' }, { name: 'Bamboo screens', color: '#C9B27A' }, { name: 'Local stone', color: '#8F8C84' }, { name: 'Metal roof', color: '#5F5C55' }],
    plan: [['Cafe hall', 10, 10, 50, 30], ['Bar', 60, 10, 16, 16], ['Restrooms', 60, 26, 16, 14], ['Terrace', 10, 40, 66, 10, 'outdoor'], ['Event lawn', 78, 10, 16, 40, 'outdoor']],
    imageAlt: 'Illustration of an open timber pavilion with a broad pitched roof among tall trees, lit from within',
    metadata: { area: '540 m²', capacity: '120 guests', status: 'Fictional concept' }
  },
  {
    id: 'the-urban-residence', title: 'The Urban Residence', location: 'Jakarta, Indonesia', year: 2024, category: 'Interior', style: 'Modern Minimalist', studioStyle: 'modern-minimalist', scene: 'urban',
    description: 'A compact city apartment reorganized around light, storage and calm.',
    concept: 'In a dense city, space is the luxury. Built-in joinery hides everyday clutter, leaving open, uninterrupted rooms.',
    architecture: 'An interior renovation that merges kitchen, dining and living into one flowing space, with a warm timber spine running through the plan.',
    materials: [{ name: 'Oak veneer', color: '#C9A06A' }, { name: 'Micro-cement', color: '#B5B2AA' }, { name: 'Frosted glass', color: '#CFE0EA' }, { name: 'Matte black hardware', color: '#2B2B29' }],
    plan: [['Living / Dining', 6, 8, 48, 28], ['Kitchen', 54, 8, 20, 28], ['Bedroom', 6, 36, 36, 16], ['Bath', 42, 36, 14, 16], ['Study', 56, 36, 18, 16]],
    imageAlt: 'Illustration of an open-plan apartment interior with a timber spine wall, sofa, kitchen island and city view',
    metadata: { area: '96 m²', bedrooms: 2, status: 'Fictional concept' }
  },
  {
    id: 'the-courtyard-house', title: 'The Courtyard House', location: 'Yogyakarta, Indonesia', year: 2023, category: 'Residential', style: 'Scandinavian', studioStyle: 'scandinavian', scene: 'courtyard',
    description: 'A modern take on the inward-facing courtyard home.',
    concept: 'Rooms wrap around a planted court that brings light, air and quiet to every space, a familiar idea reimagined with a light, natural palette.',
    architecture: 'Single-storey wings with clay-tile roofs surround a central garden. Light oak and cream plaster keep the interiors bright and soft.',
    materials: [{ name: 'Light oak', color: '#E2CFA9' }, { name: 'Cream plaster', color: '#F5EFE0' }, { name: 'Clay roof tiles', color: '#B9674A' }, { name: 'Natural linen', color: '#E8E1D0' }],
    plan: [['Living / Dining', 8, 6, 84, 14], ['Bedrooms', 8, 20, 22, 30], ['Bedrooms', 70, 20, 22, 30], ['Kitchen & entry', 8, 50, 84, 8], ['Courtyard', 30, 20, 40, 30, 'outdoor']],
    imageAlt: 'Illustration of single-storey clay-roofed wings around a central courtyard garden with a tree',
    metadata: { area: '350 m²', bedrooms: 4, status: 'Fictional concept' }
  }

].map((p) => ({
  ...p,
  fictional: true,
  image: REAL_IMAGES[p.scene] || toUri(svgDoc(SCENES[p.scene]())),

  gallery: [
    {
      src: toUri(planSvg(p)),
      caption: 'Schematic floor plan (not to scale)',
      alt: `Schematic floor plan of ${p.title}`
    },
    {
      src: toUri(boardSvg(p)),
      caption: 'Material palette',
      alt: `Material palette of ${p.title}: ${p.materials.map((m) => m.name).join(', ')}`
    }
  ]
}));

export const getProjectById = (id) =>
  PROJECTS.find((p) => p.id === id) || null;

export const getProjectsByCategory = (category) =>
  (!category || category === 'All'
    ? PROJECTS
    : PROJECTS.filter((p) => p.category === category));

export const getFeaturedProjects = (count = 3) =>
  PROJECTS.slice(0, count);

export const getFallbackImage = (project) =>
  (project && project.image) ||
  toUri(svgDoc(R(0, 0, 1600, 1000, '#D6C3A5')));