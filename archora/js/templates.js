// js/templates.js — starting points for the 3D studio: blank plot, the original two-storey house, and an 8 × 15 m reference plan.
import { buildRoom, makeOpening, createItem } from './catalog.js';
import { createDefaultConfig, createBlankConfig } from './state.js';

const STYLE = 'modern-minimalist';

/** A one-storey 8 × 15 m house with garage and gardens, modelled on a typical minimalist Indonesian floor plan. */
export function createReferencePlan() {
  const room = (id, type, name, x, z, w, d, floor, openings) => {
    const r = buildRoom({ id, type, name, level: 0, x, z, w, d, style: STYLE });
    r.floorMaterial = floor;
    openings.forEach(([side, kind, center, o]) => r.walls[side].openings.push(makeOpening(id, side, kind, center, o || {})));
    return r;
  };
  const rooms = [
    room('room-km', 'bathroom', 'Bathroom', 150, 250, 150, 150, 'terracotta-tiles', [['e', 'door', 75, { width: 75 }]]),
    room('room-bed-2', 'bedroom', 'Bedroom 2', 0, 400, 300, 300, 'oak-planks', [['e', 'door', 230, {}], ['n', 'window', 60, { width: 90, height: 100, sill: 110 }]]),
    room('room-bed-1', 'bedroom', 'Bedroom 1', 0, 700, 300, 300, 'oak-planks', [['e', 'door', 60, {}], ['s', 'window', 60, { width: 90, height: 100, sill: 110 }]]),
    room('room-bed-3', 'bedroom', 'Bedroom 3', 500, 250, 300, 300, 'oak-planks', [['w', 'door', 250, {}], ['n', 'window', 150, { width: 160, height: 100, sill: 110 }]])
  ];
  const fw = (id, x1, z1, x2, z2, o = {}) => ({ id, level: 0, x1, z1, x2, z2, thickness: o.t ?? 15, height: o.h ?? null, material: o.m ?? 'paint', color: o.c ?? '#F3F0E8', openings: o.open || [] });
  const op = (id, type, center, o = {}) => ({ id, type, center, width: o.width ?? 90, height: o.height ?? 210, sill: o.sill ?? 0 });
  const boundary = { t: 15, h: 200, m: 'lime-plaster', c: '#E9E4D6' };
  const walls = [
    fw('fw-back', 0, 0, 800, 0, boundary), fw('fw-left-back', 0, 0, 0, 400, boundary), fw('fw-right-back', 800, 0, 800, 250, boundary),
    fw('fw-left-front', 0, 1000, 0, 1500, boundary), fw('fw-right-fence', 800, 1000, 800, 1500, { t: 12, h: 90, m: 'white-brick', c: '#FFFFFF' }),
    fw('fw-right-house', 800, 550, 800, 1000),
    fw('fw-kitchen-back', 300, 250, 500, 250, { open: [op('o-back-door', 'door', 155)] }),
    fw('fw-family-front', 600, 1000, 800, 1000, { open: [op('o-side-door', 'door', 150)] }),
    fw('fw-garage-side', 300, 1000, 300, 1500, { t: 10, h: 220, m: 'white-brick', c: '#FFFFFF' }),
    fw('fw-guest-front', 300, 1225, 600, 1225, { open: [op('o-front-window', 'window', 60, { width: 90, height: 120, sill: 90 }), op('o-front-door', 'door', 190, { width: 100 })] }),
    fw('fw-guest-right', 600, 1000, 600, 1225)
  ];
  const slab = (id, kind, name, x, z, w, d, material) => ({ id, level: 0, kind, name, x, z, w, d, material, color: null });
  const slabs = [
    slab('slab-lawn', 'lawn', 'Garden lawn', 0, 0, 800, 1500, 'grass-lawn'),
    slab('slab-garage', 'driveway', 'Garage', 0, 1000, 300, 500, 'asphalt'),
    slab('slab-living-a', 'floor', 'Kitchen and dining floor', 300, 250, 200, 750, 'stone-tiles'),
    slab('slab-living-b', 'floor', 'Family room floor', 500, 550, 300, 450, 'stone-tiles'),
    slab('slab-guest', 'floor', 'Guest room floor', 300, 1000, 300, 225, 'stone-tiles'),
    slab('slab-porch', 'terrace', 'Porch', 300, 1225, 300, 275, 'stone-tiles')
  ];
  let n = 0;
  const it = (type, x, z, rot = 0, extra = {}) => { n += 1; return createItem(type, { id: `ref-${n}`, level: 0, x, z, rot, style: STYLE, ...extra }); };
  const items = [
    it('toilet', 180, 291, 0), it('washbasin', 178, 335, 90), it('shower', 247, 347, 0),
    it('bed-single', 70, 510, 0), it('desk', 258, 470, 270), it('office-chair', 215, 470, 270), it('wardrobe-2door', 240, 662, 180),
    it('bed-single', 70, 810, 0), it('desk', 258, 770, 270), it('office-chair', 215, 770, 270), it('wardrobe-2door', 240, 962, 180),
    it('bed-single', 720, 365, 0), it('desk', 540, 330, 90), it('office-chair', 585, 330, 90), it('wardrobe-2door', 740, 512, 180),
    it('fridge', 345, 290, 0), it('kitchen-base', 455, 345, 90), it('kitchen-cooktop', 455, 405, 90), it('kitchen-sink', 455, 480, 90), it('kitchen-base', 455, 555, 90),
    it('dining-table-6', 445, 780, 90), it('dining-chair', 385, 745, 90), it('dining-chair', 385, 815, 90), it('dining-chair', 505, 745, 270), it('dining-chair', 505, 815, 270),
    it('sofa-3', 610, 770, 90), it('rug-rect', 690, 770, 90), it('coffee-table-rect', 690, 770, 90), it('tv-unit', 770, 770, 270), it('tv', 772, 770, 270),
    it('sofa-2', 545, 1095, 270), it('coffee-table-round', 440, 1100, 0), it('armchair', 350, 1050, 90), it('armchair', 350, 1150, 90), it('side-table', 545, 1185, 0),
    it('car-sedan', 150, 1250, 0), it('gate', 150, 1496, 0),
    it('tree-palm', 90, 110, 0), it('bush', 60, 210, 0), it('bush', 200, 70, 0), it('bush', 470, 70, 0), it('bush', 540, 115, 0), it('tree-frangipani', 640, 115, 0), it('flower-bed', 715, 60, 0),
    it('tree-frangipani', 735, 1340, 0), it('bush', 740, 1440, 0), it('bush', 700, 1260, 0), it('garden-lamp', 615, 1470, 0),
    ...[[670, 1250], [670, 1295], [670, 1340], [670, 1385], [670, 1430], [625, 1450], [580, 1450], [535, 1450], [490, 1450], [445, 1450], [400, 1450], [355, 1450]].map(([x, z]) => it('stepping-stone', x, z, 0))
  ];
  return {
    version: 3, id: null, name: 'Reference plan 8 × 15 m', updatedAt: null, style: STYLE,
    levels: [{ height: 300 }], rooms, items, walls, slabs, lighting: { preset: 'daylight', brightness: 1, temperature: 0.6 }
  };
}

export const TEMPLATES = [
  { id: 'blank', name: 'Blank plot', description: 'An empty 12 × 10 m lawn. Draw every wall, floor, door and window yourself.', build: createBlankConfig },
  { id: 'reference', name: 'Single-storey house, 8 × 15 m', description: '3 bedrooms, bathroom, open kitchen / dining / family room, guest room, garage, porch and gardens.', build: createReferencePlan },
  { id: 'default', name: 'Two-storey house', description: 'The original ARCHORA showcase house with six furnished rooms.', build: createDefaultConfig }
];
