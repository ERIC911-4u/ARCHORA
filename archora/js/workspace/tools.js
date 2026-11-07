// js/workspace/tools.js — left tool panel definition. Every entry maps to behaviour that exists in the editors.
// Features without an implementation are NOT listed here (see ARCHORA_ROADMAP.md).
import { WALL_PRESETS } from '../catalog.js';

const preset = (id) => { const p = WALL_PRESETS.find((x) => x.id === id); return { thickness: p.thickness, height: p.height, material: p.material, color: p.color }; };
const slab = (kind) => ({ tool: 'draw-slab', slabKind: kind, slabMaterial: null, placeItem: null });
const opening = (type) => ({ tool: 'place-opening', placeOpening: type, placeItem: null });
const item = (type) => ({ tool: 'place-item', placeItem: type });
const cats = (...c) => ({ cats: c });

export const TOOL_GROUPS = [
  { id: 'architecture', title: 'Architecture', tools: [
    { id: 'select', label: 'Select', icon: 'move', title: 'Select and drag objects (V)', kbd: 'V', patch: { tool: 'move', placeItem: null }, isActive: (u) => u.tool === 'move' },
    { id: 'inspect', label: 'Select only', icon: 'select', title: 'Select without moving anything (prevents accidental drags)', patch: { tool: 'select', placeItem: null }, isActive: (u) => u.tool === 'select' },
    { id: 'wall', label: 'Wall', icon: 'wall', title: 'Draw walls: click points, or type an exact length and press Enter (W)', kbd: 'W', patch: { tool: 'draw-wall', placeItem: null, wallPreset: preset('wall') }, isActive: (u) => u.tool === 'draw-wall' && u.wallPreset.height === null },
    { id: 'floor', label: 'Floor', icon: 'floor', title: 'Draw an indoor floor area', patch: slab('floor'), isActive: (u) => u.tool === 'draw-slab' && u.slabKind === 'floor' },
    { id: 'room', label: 'Room', icon: 'room', title: 'Add a ready-made furnished room (opens the House panel)', section: 'house' },
    { id: 'roof', label: 'Roof', icon: 'roof', title: 'Show or hide the flat roof slab in 3D', toggle: 'showRoof' },
    { id: 'stairs', label: 'Staircase', icon: 'stairs', title: 'Place a staircase', patch: item('stairs'), isActive: (u) => u.tool === 'place-item' && u.placeItem === 'stairs' },
    { id: 'railing', label: 'Railing', icon: 'railing', title: 'Place a railing', patch: item('railing'), isActive: (u) => u.tool === 'place-item' && u.placeItem === 'railing' }
  ] },
  { id: 'openings', title: 'Openings', tools: [
    { id: 'door', label: 'Door', icon: 'door', title: 'Place a door on a wall (D)', kbd: 'D', patch: opening('door'), isActive: (u) => u.tool === 'place-opening' && u.placeOpening === 'door' },
    { id: 'sliding', label: 'Sliding door', icon: 'sliding', title: 'Place a sliding glass door', patch: opening('sliding'), isActive: (u) => u.tool === 'place-opening' && u.placeOpening === 'sliding' },
    { id: 'window', label: 'Window', icon: 'window', title: 'Place a window on a wall (N)', kbd: 'N', patch: opening('window'), isActive: (u) => u.tool === 'place-opening' && u.placeOpening === 'window' },
    { id: 'arch', label: 'Archway', icon: 'arch', title: 'Place an archway (opening without a door)', patch: opening('arch'), isActive: (u) => u.tool === 'place-opening' && u.placeOpening === 'arch' }
  ] },
  { id: 'interior', title: 'Interior', tools: [
    { id: 'furniture', label: 'Furniture', icon: 'sofa', title: 'Seating, tables, beds and storage', library: { title: 'Furniture', ...cats('seating', 'tables', 'beds', 'storage') } },
    { id: 'kitchen', label: 'Kitchen', icon: 'kitchen', title: 'Kitchen cabinets and fittings', library: { title: 'Kitchen', ...cats('kitchen') } },
    { id: 'bathroom', label: 'Bathroom', icon: 'bath', title: 'Toilets, basins, showers, baths', library: { title: 'Bathroom', ...cats('bathroom') } },
    { id: 'lighting', label: 'Lighting', icon: 'lamp', title: 'Lamps and chandeliers', library: { title: 'Lighting', ...cats('lighting') } },
    { id: 'decor', label: 'Decoration', icon: 'decor', title: 'Rugs, art, curtains, decor', library: { title: 'Decoration', ...cats('decor') } },
    { id: 'appliances', label: 'Appliances', icon: 'appliance', title: 'Air conditioners and fans', library: { title: 'Appliances', ...cats('appliances') } }
  ] },
  { id: 'exterior', title: 'Exterior', tools: [
    { id: 'lawn', label: 'Garden', icon: 'garden', title: 'Draw a lawn area', patch: slab('lawn'), isActive: (u) => u.tool === 'draw-slab' && u.slabKind === 'lawn' },
    { id: 'trees', label: 'Trees', icon: 'tree', title: 'Trees', library: { title: 'Trees', cats: ['garden'], match: (d) => d.id.startsWith('tree-') } },
    { id: 'plants', label: 'Plants', icon: 'plant', title: 'Plants, bushes, hedges, flower beds', library: { title: 'Plants', cats: ['plants'], extra: ['bush', 'hedge', 'flower-bed'] } },
    { id: 'pool', label: 'Pool / pond', icon: 'pool', title: 'Draw a swimming pool or pond', patch: slab('water'), isActive: (u) => u.tool === 'draw-slab' && u.slabKind === 'water' },
    { id: 'driveway', label: 'Driveway', icon: 'driveway', title: 'Draw a driveway or carport', patch: slab('driveway'), isActive: (u) => u.tool === 'draw-slab' && u.slabKind === 'driveway' },
    { id: 'outdoor', label: 'Outdoor items', icon: 'outdoor', title: 'Pergolas, parasols, lamps, gates, vehicles', library: { title: 'Outdoor', cats: ['garden', 'vehicles'], match: (d) => !d.id.startsWith('tree-') } },
    { id: 'fence', label: 'Fence', icon: 'fence', title: 'Draw a 120 cm garden fence', patch: { tool: 'draw-wall', placeItem: null, wallPreset: preset('fence') }, isActive: (u) => u.tool === 'draw-wall' && u.wallPreset.height === 120 },
    { id: 'landscape', label: 'Paving / path', icon: 'landscape', title: 'Draw a paved path', patch: slab('paving'), isActive: (u) => u.tool === 'draw-slab' && u.slabKind === 'paving' }
  ] },
  { id: 'annotation', title: 'Annotation', tools: [
    { id: 'dims', label: 'Dimensions', icon: 'dimension', title: 'Show wall and room dimensions', toggle: 'showDimensions' },
    { id: 'grid', label: 'Grid', icon: 'grid', title: 'Show the grid (G)', kbd: 'G', toggle: 'showGrid' },
    { id: 'erase', label: 'Erase', icon: 'erase', title: 'Click an object to delete it (E)', kbd: 'E', patch: { tool: 'eraser', placeItem: null }, isActive: (u) => u.tool === 'eraser' }
  ] }
];

export const TOOL_LABEL = { move: 'Select', select: 'Select only', 'draw-wall': 'Wall', 'draw-slab': 'Area', 'place-opening': 'Opening', 'place-item': 'Place item', eraser: 'Erase', pan: 'Pan' };
