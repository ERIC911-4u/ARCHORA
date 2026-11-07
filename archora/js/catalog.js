
// js/catalog.js (v2) — pure data and helpers. No Three.js and no state import.
// Units: all lengths are centimeters.
export const SIDES = ['n', 'e', 's', 'w'];
export const SIDE_NAMES = { n: 'North', e: 'East', s: 'South', w: 'West' };
export const LEVEL_NAMES = ['Ground floor', 'First floor'];

export const OPENING_TYPES = [
  { id: 'door', name: 'Door', width: 90, height: 210, sill: 0 },
  { id: 'window', name: 'Window', width: 150, height: 120, sill: 90 },
  { id: 'sliding', name: 'Sliding glass door', width: 240, height: 215, sill: 0 },
  { id: 'arch', name: 'Archway', width: 140, height: 220, sill: 0 }
];
export const OPENING_TYPE_IDS = OPENING_TYPES.map((o) => o.id);

const M = (id, name, target, kind, base, o = {}) => ({
  id, name, target, kind, base, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0,
  tileCm: o.tileCm ?? 100, price: o.price ?? 0, opts: o.opts || {}
});
// price = DEMO value in IDR per m². Not real market prices.
export const MATERIALS = [
  M('oak-planks', 'Natural Oak', 'floor', 'planks', '#C9A06A', { roughness: 0.62, tileCm: 120, price: 1850000 }),
  M('walnut-planks', 'Dark Walnut', 'floor', 'planks', '#4A3426', { roughness: 0.55, tileCm: 120, price: 2100000 }),
  M('ash-planks', 'Light Ash', 'floor', 'planks', '#E2CFA9', { roughness: 0.65, tileCm: 120, price: 1700000 }),
  M('chevron-oak', 'Chevron Oak', 'floor', 'chevron', '#B98E5A', { roughness: 0.6, tileCm: 90, price: 2600000 }),
  M('stone-tiles', 'Light Stone Tiles', 'floor', 'tiles', '#D9D4C7', { roughness: 0.8, tileCm: 120, price: 1600000 }),
  M('marble-white', 'White Marble', 'floor', 'marble', '#EDEBE6', { roughness: 0.18, metalness: 0.05, tileCm: 160, price: 3200000 }),
  M('marble-black', 'Black Marble', 'floor', 'marble', '#26272B', { roughness: 0.15, metalness: 0.05, tileCm: 160, price: 3600000 }),
  M('polished-concrete', 'Polished Concrete', 'floor', 'concrete', '#9A9892', { roughness: 0.45, metalness: 0.05, tileCm: 220, price: 1250000 }),
  M('terrazzo', 'Terrazzo', 'floor', 'terrazzo', '#E4DFD3', { roughness: 0.4, tileCm: 140, price: 2400000 }),
  M('checker-tiles', 'Checker Tiles', 'floor', 'checker', '#F1EFEA', { roughness: 0.35, tileCm: 80, price: 1900000, opts: { dark: '#2A2B2A' } }),
  M('mosaic-tiles', 'Mosaic Tiles', 'floor', 'mosaic', '#CFD6D3', { roughness: 0.3, tileCm: 50, price: 2200000 }),
  M('terracotta-tiles', 'Terracotta Tiles', 'floor', 'tiles', '#B9674A', { roughness: 0.85, tileCm: 90, price: 1500000 }),
  M('carpet-gray', 'Gray Carpet', 'floor', 'carpet', '#8D8D8A', { roughness: 1, tileCm: 100, price: 900000 }),
  M('paint', 'Paint (solid color)', 'wall', 'flat', '#FFFFFF', { roughness: 0.95, price: 65000 }),
  M('lime-plaster', 'Lime Plaster', 'wall', 'plaster', '#EDE6D8', { roughness: 0.95, tileCm: 150, price: 140000 }),
  M('exposed-concrete', 'Exposed Concrete', 'wall', 'concrete', '#A09E98', { roughness: 0.9, tileCm: 200, price: 260000 }),
  M('red-brick', 'Red Brick', 'wall', 'brick', '#A5523A', { roughness: 0.9, tileCm: 88, price: 330000 }),
  M('white-brick', 'White Brick', 'wall', 'brick', '#E8E4DB', { roughness: 0.9, tileCm: 88, price: 340000 }),
  M('wood-slats', 'Wood Slats', 'wall', 'slats', '#9A7448', { roughness: 0.7, tileCm: 100, price: 480000 }),
  M('stone-cladding', 'Stone Cladding', 'wall', 'stone', '#A8A49B', { roughness: 0.9, tileCm: 120, price: 520000 }),
  M('subway-tile', 'Subway Tile', 'wall', 'subway', '#F2F1EC', { roughness: 0.25, tileCm: 64, price: 380000 }),
  M('stripe-wallpaper', 'Striped Wallpaper', 'wall', 'stripes', '#E8E1D0', { roughness: 0.9, tileCm: 64, price: 180000 }),
  M('wall-panels', 'Wall Panels', 'wall', 'panels', '#E9E5DA', { roughness: 0.7, tileCm: 120, price: 420000 }),
  M('fabric-linen', 'Linen', 'item', 'weave', '#F2F0EA', { roughness: 0.95, tileCm: 30 }),
  M('fabric-velvet', 'Velvet', 'item', 'velvet', '#F4F4F4', { roughness: 0.85, tileCm: 40 }),
  M('fabric-boucle', 'Bouclé', 'item', 'boucle', '#F5F3EE', { roughness: 1, tileCm: 30 }),
  M('leather', 'Leather', 'item', 'leather', '#F0F0F0', { roughness: 0.55, tileCm: 40 }),
  M('wood-oak', 'Oak wood', 'item', 'woodgrain', '#F2F2F2', { roughness: 0.6, tileCm: 60 }),
  M('wood-walnut', 'Walnut wood', 'item', 'woodgrain', '#EDEDED', { roughness: 0.5, tileCm: 60, opts: { contrast: 1.4 } }),
  M('wood-painted', 'Painted wood', 'item', 'flat', '#FFFFFF', { roughness: 0.7 }),
  M('marble-top', 'Marble', 'item', 'marble', '#F4F3F0', { roughness: 0.2, tileCm: 80 }),
  M('metal-brushed', 'Brushed metal', 'item', 'brushed', '#E8E8E8', { roughness: 0.4, metalness: 0.8, tileCm: 40 }),
  M('metal-black', 'Black metal', 'item', 'flat', '#FFFFFF', { roughness: 0.4, metalness: 0.7 }),
  M('plastic-matte', 'Matte ceramic', 'item', 'flat', '#FFFFFF', { roughness: 0.5 }),
  M('grass-lawn', 'Lawn grass', 'outdoor', 'grass', '#5E8C45', { roughness: 1, tileCm: 200, price: 90000 }),
  M('grass-dry', 'Dry grass', 'outdoor', 'grass', '#9AA357', { roughness: 1, tileCm: 200, price: 80000 }),
  M('paving-stone', 'Paving stone', 'outdoor', 'pavers', '#B9B3A6', { roughness: 0.9, tileCm: 120, price: 350000 }),
  M('paving-brick', 'Brick paving', 'outdoor', 'pavers', '#A9573E', { roughness: 0.9, tileCm: 120, price: 300000 }),
  M('gravel', 'Gravel', 'outdoor', 'gravel', '#B7B0A0', { roughness: 1, tileCm: 100, price: 150000 }),
  M('sand', 'Sand', 'outdoor', 'gravel', '#DCCBA0', { roughness: 1, tileCm: 100, price: 120000, opts: { fine: true } }),
  M('asphalt', 'Asphalt / driveway', 'outdoor', 'asphalt', '#4C4D4E', { roughness: 0.95, tileCm: 200, price: 450000 }),
  M('deck-wood', 'Wood deck', 'outdoor', 'planks', '#9A6B43', { roughness: 0.7, tileCm: 120, price: 1400000 }),
  M('pool-water', 'Water', 'outdoor', 'water', '#3F8FB0', { roughness: 0.08, metalness: 0.1, tileCm: 160, price: 1800000 })
];
export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export const getMaterial = (id) => MATERIALS.find((m) => m.id === id) || null;
export const materialsFor = (target) => MATERIALS.filter((m) => m.target === target);
export const getMaterialName = (id) => getMaterial(id)?.name ?? id;

export const WALL_COLORS = [
  { id: 'warm-white', name: 'Warm White', hex: '#F3F0E8' }, { id: 'pure-white', name: 'Pure White', hex: '#FFFFFF' },
  { id: 'beige', name: 'Beige', hex: '#E3D5BC' }, { id: 'sand', name: 'Sand', hex: '#D6C3A5' },
  { id: 'sage-green', name: 'Sage Green', hex: '#A5B39B' }, { id: 'light-gray', name: 'Light Gray', hex: '#C9C7C1' },
  { id: 'charcoal', name: 'Charcoal', hex: '#2E2F2C' }, { id: 'terracotta', name: 'Terracotta', hex: '#B9674A' },
  { id: 'olive-green', name: 'Olive Green', hex: '#7A8452' }
];
export const ITEM_COLORS = ['#F3F0E8', '#D6C3A5', '#C9A06A', '#8A5E3B', '#4A3426', '#8C8579', '#A8A49B', '#2E2F2C', '#A5B39B', '#4F6B4A', '#B9674A', '#7A8FA6'];
export function getWallColorName(hex) {
  const match = WALL_COLORS.find((c) => c.hex.toUpperCase() === String(hex).toUpperCase());
  return match ? match.name : `Custom ${String(hex).toUpperCase()}`;
}

// Free-form floors / garden areas. top = height of the surface in cm (0 = house floor level), thick = body depth.
export const SLAB_KINDS = [
  { id: 'floor', name: 'Indoor floor', material: 'oak-planks', top: 1, thick: 20, outdoor: false },
  { id: 'terrace', name: 'Terrace / deck', material: 'deck-wood', top: 0.6, thick: 20, outdoor: false },
  { id: 'lawn', name: 'Garden lawn', material: 'grass-lawn', top: -3, thick: 25, outdoor: true },
  { id: 'paving', name: 'Paved path', material: 'paving-stone', top: -1.5, thick: 12, outdoor: true },
  { id: 'gravel', name: 'Gravel area', material: 'gravel', top: -2, thick: 15, outdoor: true },
  { id: 'driveway', name: 'Driveway / carport', material: 'asphalt', top: -1, thick: 15, outdoor: true },
  { id: 'water', name: 'Pond / pool', material: 'pool-water', top: -9, thick: 36, outdoor: true }
];
export const SLAB_KIND_IDS = SLAB_KINDS.map((k) => k.id);
export const getSlabKind = (id) => SLAB_KINDS.find((k) => k.id === id) || SLAB_KINDS[0];
export const slabMaterials = (kindId) => (getSlabKind(kindId).id === 'floor' ? materialsFor('floor') : [...materialsFor('outdoor'), ...materialsFor('floor')]);
export const isSlabMaterial = (id) => ['floor', 'outdoor'].includes(getMaterial(id)?.target);
export const wallLength = (w) => Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
export const WALL_PRESETS = [
  { id: 'wall', name: 'House wall', thickness: 15, height: null, material: 'paint', color: '#F3F0E8' },
  { id: 'thick', name: 'Thick brick wall', thickness: 25, height: null, material: 'red-brick', color: '#FFFFFF' },
  { id: 'partition', name: 'Thin partition', thickness: 10, height: null, material: 'paint', color: '#F3F0E8' },
  { id: 'fence', name: 'Garden fence (120 cm)', thickness: 10, height: 120, material: 'white-brick', color: '#FFFFFF' },
  { id: 'low', name: 'Low wall (90 cm)', thickness: 15, height: 90, material: 'stone-cladding', color: '#FFFFFF' },
  { id: 'high', name: 'Boundary wall (200 cm)', thickness: 15, height: 200, material: 'lime-plaster', color: '#FFFFFF' }
];

const ROLE_DEFAULTS = {
  vehicle: { color: '#8FA3B5', material: 'plastic-matte', trim: '#1E1F1E' },
  foliage: { color: '#4F7F45', material: 'plastic-matte', trim: '#7A5A3A' },
  upholstery: { color: '#8C8579', material: 'fabric-linen', trim: '#3B2F26' },
  wood: { color: '#C9A06A', material: 'wood-oak', trim: '#2B2B29' },
  metal: { color: '#2B2B29', material: 'metal-black', trim: '#2B2B29' },
  stone: { color: '#E9E6DF', material: 'marble-top', trim: '#2B2B29' },
  appliance: { color: '#D9D9D6', material: 'metal-brushed', trim: '#2B2B29' },
  ceramic: { color: '#F4F2EC', material: 'plastic-matte', trim: '#B8B4AA' },
  light: { color: '#F3E7D0', material: 'fabric-linen', trim: '#B08D63' },
  rug: { color: '#D6C3A5', material: 'fabric-boucle', trim: '#D6C3A5' },
  art: { color: '#D6C3A5', material: 'plastic-matte', trim: '#2B2B29' },
  plant: { color: '#4F6B4A', material: 'plastic-matte', trim: '#D9CFC0' }
};

export const ITEM_CATEGORIES = [
  { id: 'seating', name: 'Seating' }, { id: 'tables', name: 'Tables' }, { id: 'beds', name: 'Beds' },
  { id: 'storage', name: 'Storage' }, { id: 'kitchen', name: 'Kitchen' }, { id: 'bathroom', name: 'Bathroom' },
  { id: 'lighting', name: 'Lighting' }, { id: 'decor', name: 'Decor & Rugs' }, { id: 'plants', name: 'Plants' },
  { id: 'structure', name: 'Structure' }, { id: 'appliances', name: 'Appliances' },
  { id: 'garden', name: 'Garden & Outdoor' }, { id: 'vehicles', name: 'Vehicles' }
];

const I = (id, name, category, w, d, h, builder, o = {}) => {
  const role = ROLE_DEFAULTS[o.role || 'wood'];
  return {
    id, name, category, size: { w, d, h }, builder, params: o.params || {}, role: o.role || 'wood',
    color: role.color, material: role.material, trim: role.trim, mount: o.mount || 'floor', y: o.y || 0,
    price: o.price ?? 1000000, voidAbove: !!o.voidAbove
  };
};
export const ITEMS = [
  I('sofa-3', 'Sofa, 3-seater', 'seating', 230, 95, 85, 'sofa', { role: 'upholstery', params: { seats: 3 }, price: 9500000 }),
  I('sofa-2', 'Loveseat', 'seating', 170, 90, 85, 'sofa', { role: 'upholstery', params: { seats: 2 }, price: 7200000 }),
  I('sofa-l', 'L-shaped sofa', 'seating', 290, 170, 85, 'sofaL', { role: 'upholstery', price: 14500000 }),
  I('armchair', 'Armchair', 'seating', 78, 82, 85, 'armchair', { role: 'upholstery', price: 3800000 }),
  I('lounge-chair', 'Lounge chair', 'seating', 72, 80, 80, 'armchair', { role: 'upholstery', params: { lounge: true }, price: 4600000 }),
  I('dining-chair', 'Dining chair', 'seating', 45, 50, 88, 'chair', { role: 'wood', price: 900000 }),
  I('dining-chair-up', 'Upholstered dining chair', 'seating', 48, 54, 90, 'chair', { role: 'upholstery', params: { upholstered: true }, price: 1400000 }),
  I('bar-stool', 'Bar stool', 'seating', 38, 38, 75, 'stool', { role: 'wood', params: { bar: true }, price: 850000 }),
  I('stool', 'Stool', 'seating', 38, 38, 46, 'stool', { role: 'wood', price: 500000 }),
  I('bench', 'Bench', 'seating', 120, 40, 45, 'bench', { role: 'wood', price: 1600000 }),
  I('ottoman', 'Ottoman', 'seating', 60, 60, 42, 'ottoman', { role: 'upholstery', price: 1200000 }),
  I('office-chair', 'Office chair', 'seating', 62, 62, 95, 'officeChair', { role: 'upholstery', price: 2100000 }),
  I('coffee-table-rect', 'Coffee table, rectangular', 'tables', 120, 60, 40, 'table', { params: { shape: 'rect' }, price: 2800000 }),
  I('coffee-table-round', 'Coffee table, round', 'tables', 90, 90, 38, 'table', { params: { shape: 'round' }, price: 2600000 }),
  I('side-table', 'Side table', 'tables', 45, 45, 52, 'table', { params: { shape: 'round' }, price: 1200000 }),
  I('dining-table-6', 'Dining table, 6 seats', 'tables', 180, 90, 75, 'table', { params: { shape: 'rect' }, price: 6800000 }),
  I('dining-table-4', 'Dining table, 4 seats', 'tables', 140, 80, 75, 'table', { params: { shape: 'rect' }, price: 4900000 }),
  I('dining-table-round', 'Dining table, round', 'tables', 110, 110, 75, 'table', { params: { shape: 'round' }, price: 5200000 }),
  I('desk', 'Desk', 'tables', 140, 65, 75, 'desk', { price: 3200000 }),
  I('console-table', 'Console table', 'tables', 110, 35, 80, 'table', { params: { shape: 'rect' }, price: 2300000 }),
  I('bed-single', 'Bed, single', 'beds', 100, 200, 95, 'bed', { role: 'upholstery', price: 4500000 }),
  I('bed-double', 'Bed, double', 'beds', 140, 200, 100, 'bed', { role: 'upholstery', price: 6500000 }),
  I('bed-queen', 'Bed, queen', 'beds', 160, 205, 105, 'bed', { role: 'upholstery', price: 8200000 }),
  I('bed-king', 'Bed, king', 'beds', 180, 210, 110, 'bed', { role: 'upholstery', price: 9800000 }),
  I('nightstand', 'Nightstand', 'beds', 45, 40, 50, 'cabinet', { params: { drawers: 2 }, price: 1300000 }),
  I('wardrobe-2door', 'Wardrobe, 2 doors', 'storage', 100, 60, 210, 'wardrobe', { price: 5400000 }),
  I('wardrobe-3door', 'Wardrobe, 3 doors', 'storage', 150, 60, 210, 'wardrobe', { params: { doors: 3 }, price: 7600000 }),
  I('dresser', 'Dresser', 'storage', 120, 45, 85, 'dresser', { price: 4200000 }),
  I('bookshelf', 'Bookshelf', 'storage', 90, 32, 200, 'bookshelf', { price: 2900000 }),
  I('bookshelf-low', 'Low bookshelf', 'storage', 120, 32, 90, 'bookshelf', { params: { low: true }, price: 2200000 }),
  I('tv-unit', 'TV unit', 'storage', 180, 40, 50, 'tvUnit', { price: 3600000 }),
  I('sideboard', 'Sideboard', 'storage', 160, 45, 80, 'cabinet', { params: { doors: 4 }, price: 4800000 }),
  I('shoe-rack', 'Shoe rack', 'storage', 80, 32, 100, 'bookshelf', { params: { slatted: true }, price: 1400000 }),
  I('kitchen-base', 'Base cabinet', 'kitchen', 60, 60, 90, 'kitchenBase', { price: 1900000 }),
  I('kitchen-sink', 'Sink cabinet', 'kitchen', 90, 60, 90, 'kitchenSink', { price: 3400000 }),
  I('kitchen-cooktop', 'Cooktop cabinet', 'kitchen', 60, 60, 90, 'kitchenCooktop', { price: 4200000 }),
  I('kitchen-tower', 'Tall oven cabinet', 'kitchen', 60, 60, 210, 'kitchenTower', { price: 8500000 }),
  I('kitchen-island', 'Kitchen island', 'kitchen', 180, 90, 90, 'island', { price: 9200000 }),
  I('kitchen-wall-cabinet', 'Wall cabinet', 'kitchen', 60, 35, 70, 'wallCabinet', { mount: 'wall', y: 140, price: 1500000 }),
  I('range-hood', 'Range hood', 'kitchen', 60, 50, 60, 'rangeHood', { role: 'appliance', mount: 'wall', y: 150, price: 3100000 }),
  I('fridge', 'Refrigerator', 'kitchen', 70, 70, 180, 'fridge', { role: 'appliance', price: 11500000 }),
  I('dishwasher', 'Dishwasher', 'kitchen', 60, 60, 90, 'kitchenBase', { role: 'appliance', params: { appliance: 'dishwasher' }, price: 6800000 }),
  I('washing-machine', 'Washing machine', 'kitchen', 60, 60, 85, 'kitchenBase', { role: 'appliance', params: { appliance: 'washer' }, price: 5900000 }),
  I('toilet', 'Toilet', 'bathroom', 40, 65, 78, 'toilet', { role: 'ceramic', price: 2800000 }),
  I('vanity', 'Vanity with sink', 'bathroom', 90, 50, 85, 'vanity', { price: 3900000 }),
  I('bathtub', 'Bathtub', 'bathroom', 170, 75, 58, 'bathtub', { role: 'ceramic', price: 8800000 }),
  I('shower', 'Shower enclosure', 'bathroom', 90, 90, 210, 'shower', { role: 'ceramic', price: 6200000 }),
  I('bathroom-mirror', 'Bathroom mirror', 'bathroom', 60, 3, 80, 'mirror', { role: 'metal', mount: 'wall', y: 110, price: 900000 }),
  I('floor-lamp', 'Floor lamp', 'lighting', 40, 40, 160, 'floorLamp', { role: 'light', price: 850000 }),
  I('floor-lamp-arc', 'Arc floor lamp', 'lighting', 60, 40, 180, 'floorLamp', { role: 'light', params: { arc: true }, price: 1900000 }),
  I('table-lamp', 'Table lamp', 'lighting', 28, 28, 45, 'tableLamp', { role: 'light', price: 450000 }),
  I('pendant', 'Pendant light', 'lighting', 45, 45, 100, 'pendant', { role: 'light', mount: 'ceiling', price: 1100000 }),
  I('chandelier', 'Chandelier', 'lighting', 80, 80, 70, 'chandelier', { role: 'metal', mount: 'ceiling', price: 3800000 }),
  I('wall-sconce', 'Wall sconce', 'lighting', 15, 15, 30, 'sconce', { role: 'light', mount: 'wall', y: 160, price: 600000 }),
  I('rug-rect', 'Rug, rectangular', 'decor', 250, 170, 2, 'rug', { role: 'rug', price: 1900000 }),
  I('rug-round', 'Rug, round', 'decor', 200, 200, 2, 'rug', { role: 'rug', params: { round: true }, price: 1700000 }),
  I('rug-runner', 'Rug, runner', 'decor', 80, 220, 2, 'rug', { role: 'rug', price: 1100000 }),
  I('painting-large', 'Painting, large', 'decor', 100, 4, 70, 'painting', { role: 'art', mount: 'wall', y: 130, params: { art: 1 }, price: 1800000 }),
  I('painting-small', 'Painting, small', 'decor', 50, 4, 60, 'painting', { role: 'art', mount: 'wall', y: 130, params: { art: 2 }, price: 900000 }),
  I('painting-triptych', 'Painting, triptych', 'decor', 150, 4, 60, 'painting', { role: 'art', mount: 'wall', y: 130, params: { art: 3 }, price: 2400000 }),
  I('wall-mirror-round', 'Round wall mirror', 'decor', 70, 3, 70, 'mirror', { role: 'metal', mount: 'wall', y: 120, params: { round: true }, price: 1300000 }),
  I('wall-clock', 'Wall clock', 'decor', 30, 3, 30, 'clock', { role: 'metal', mount: 'wall', y: 170, price: 500000 }),
  I('tv', 'Television', 'decor', 125, 8, 72, 'tv', { role: 'metal', mount: 'wall', y: 100, price: 9800000 }),
  I('curtain', 'Curtains', 'decor', 200, 12, 250, 'curtain', { role: 'upholstery', mount: 'wall', y: 0, price: 1600000 }),
  I('vase', 'Vase', 'decor', 18, 18, 35, 'vase', { role: 'ceramic', price: 350000 }),
  I('plant-fiddle', 'Fiddle-leaf plant', 'plants', 55, 55, 150, 'plant', { role: 'plant', params: { kind: 'fiddle' }, price: 650000 }),
  I('plant-palm', 'Palm', 'plants', 80, 80, 180, 'plant', { role: 'plant', params: { kind: 'palm' }, price: 900000 }),
  I('plant-small', 'Small plant', 'plants', 30, 30, 45, 'plant', { role: 'plant', params: { kind: 'small' }, price: 250000 }),
  I('cactus', 'Cactus', 'plants', 25, 25, 55, 'plant', { role: 'plant', params: { kind: 'cactus' }, price: 200000 }),
  I('stairs', 'Straight staircase', 'structure', 100, 380, 300, 'stairs', { price: 18000000, voidAbove: true }),
  I('railing', 'Glass railing', 'structure', 100, 5, 100, 'railing', { role: 'metal', price: 2500000 }),
  I('divider', 'Slatted room divider', 'structure', 150, 8, 200, 'divider', { price: 3300000 }),
  I('fireplace', 'Fireplace', 'structure', 140, 40, 120, 'fireplace', { role: 'stone', price: 12500000 }),
  I('toilet-squat', 'Squat toilet', 'bathroom', 60, 50, 14, 'squatToilet', { role: 'ceramic', price: 900000 }),
  I('washbasin', 'Wall washbasin', 'bathroom', 50, 40, 20, 'washbasin', { role: 'ceramic', mount: 'wall', y: 85, price: 1200000 }),
  I('air-conditioner', 'Air conditioner', 'appliances', 90, 22, 30, 'airCon', { role: 'appliance', mount: 'wall', y: 215, price: 6500000 }),
  I('ceiling-fan', 'Ceiling fan', 'appliances', 110, 110, 30, 'ceilingFan', { role: 'metal', mount: 'ceiling', price: 1300000 }),
  I('piano', 'Upright piano', 'decor', 150, 60, 110, 'piano', { price: 21000000 }),
  I('aquarium', 'Aquarium', 'decor', 120, 40, 90, 'aquarium', { role: 'metal', price: 5200000 }),
  I('crib', 'Baby crib', 'beds', 70, 130, 90, 'crib', { price: 2600000 }),
  I('bunk-bed', 'Bunk bed', 'beds', 100, 200, 170, 'bunkBed', { role: 'upholstery', price: 7800000 }),
  I('car-sedan', 'Car, sedan', 'vehicles', 180, 450, 145, 'car', { role: 'vehicle', params: { type: 'sedan' }, price: 350000000 }),
  I('car-suv', 'Car, SUV', 'vehicles', 190, 470, 175, 'car', { role: 'vehicle', params: { type: 'suv' }, price: 480000000 }),
  I('motorcycle', 'Motorcycle', 'vehicles', 75, 200, 110, 'motorcycle', { role: 'vehicle', price: 28000000 }),
  I('bicycle', 'Bicycle', 'vehicles', 55, 175, 105, 'bicycle', { role: 'vehicle', price: 3500000 }),
  I('tree-round', 'Shade tree', 'garden', 260, 260, 420, 'tree', { role: 'foliage', params: { kind: 'round' }, price: 1500000 }),
  I('tree-frangipani', 'Frangipani tree', 'garden', 240, 240, 300, 'tree', { role: 'foliage', params: { kind: 'frangi' }, price: 1200000 }),
  I('tree-pine', 'Pine tree', 'garden', 180, 180, 450, 'tree', { role: 'foliage', params: { kind: 'pine' }, price: 1400000 }),
  I('tree-palm', 'Coconut palm', 'garden', 220, 220, 520, 'tree', { role: 'foliage', params: { kind: 'coconut' }, price: 1800000 }),
  I('bush', 'Bush', 'garden', 90, 90, 80, 'bush', { role: 'foliage', price: 300000 }),
  I('hedge', 'Hedge', 'garden', 200, 50, 90, 'hedge', { role: 'foliage', price: 700000 }),
  I('flower-bed', 'Flower bed', 'garden', 150, 60, 40, 'flowerBed', { role: 'foliage', price: 600000 }),
  I('garden-lamp', 'Garden lamp', 'garden', 30, 30, 90, 'gardenLamp', { role: 'light', price: 750000 }),
  I('pergola', 'Pergola', 'garden', 300, 300, 260, 'pergola', { price: 12500000 }),
  I('parasol', 'Parasol with table', 'garden', 200, 200, 230, 'parasol', { role: 'upholstery', price: 3900000 }),
  I('gate', 'Sliding gate', 'garden', 300, 10, 150, 'gate', { role: 'metal', price: 8500000 }),
  I('mailbox', 'Mailbox', 'garden', 30, 20, 120, 'mailbox', { role: 'metal', price: 450000 }),
  I('water-tank', 'Water tank', 'garden', 100, 100, 200, 'waterTank', { role: 'appliance', price: 3200000 }),
  I('stepping-stone', 'Stepping stone', 'garden', 45, 45, 4, 'stepStone', { role: 'stone', price: 120000 }),
  I('fountain', 'Fountain', 'garden', 120, 120, 110, 'fountain', { role: 'stone', price: 6500000 })
];
export const ITEM_IDS = ITEMS.map((i) => i.id);
export const getItemDef = (type) => ITEMS.find((i) => i.id === type) || null;
export const getItemName = (type) => getItemDef(type)?.name ?? type;
export const itemsByCategory = (categoryId) => ITEMS.filter((i) => i.category === categoryId);

export const STYLES = [
  {
    id: 'modern-minimalist', name: 'Modern Minimalist', description: 'Warm white walls, pale stone floors, minimal furniture, clean lines.',
    floors: { default: 'oak-planks', 'living-room': 'stone-tiles', kitchen: 'stone-tiles', 'dining-room': 'stone-tiles', bathroom: 'mosaic-tiles', hallway: 'terrazzo' },
    walls: { default: { material: 'paint', color: '#F3F0E8' }, bathroom: { material: 'subway-tile', color: '#FFFFFF' } },
    accent: { side: 'n', material: 'paint', color: '#A8A49B' }, lighting: 'daylight',
    theme: { upholstery: { color: '#8C8579', material: 'fabric-linen' }, wood: { color: '#D6C3A5', material: 'wood-oak' }, rug: { color: '#E4DDCF', material: 'fabric-boucle' }, plant: { color: '#4F6B4A', material: 'plastic-matte' }, light: { color: '#F3E7D0', material: 'fabric-linen' }, metal: { color: '#171816', material: 'metal-black' } }
  },
  {
    id: 'scandinavian', name: 'Scandinavian', description: 'Light ash and oak, cream walls, warm textiles and natural wood.',
    floors: { default: 'ash-planks', kitchen: 'ash-planks', bathroom: 'mosaic-tiles', hallway: 'oak-planks' },
    walls: { default: { material: 'paint', color: '#F5EFE0' }, bathroom: { material: 'subway-tile', color: '#FFFFFF' } },
    accent: { side: 'n', material: 'paint', color: '#D6C3A5' }, lighting: 'daylight',
    theme: { upholstery: { color: '#CFC5B4', material: 'fabric-boucle' }, wood: { color: '#E2CFA9', material: 'wood-oak' }, rug: { color: '#EDE6D6', material: 'fabric-boucle' }, plant: { color: '#5E7D55', material: 'plastic-matte' }, light: { color: '#F5EBD8', material: 'fabric-linen' }, metal: { color: '#3A3A38', material: 'metal-black' } }
  },
  {
    id: 'industrial', name: 'Industrial', description: 'Concrete and brick, charcoal accents, dark metal details.',
    floors: { default: 'polished-concrete', bedroom: 'oak-planks', bathroom: 'checker-tiles', hallway: 'polished-concrete' },
    walls: { default: { material: 'paint', color: '#A8A49B' }, bathroom: { material: 'subway-tile', color: '#FFFFFF' }, kitchen: { material: 'exposed-concrete', color: '#FFFFFF' } },
    accent: { side: 'n', material: 'red-brick', color: '#FFFFFF' }, lighting: 'neutral',
    theme: { upholstery: { color: '#4A3426', material: 'leather' }, wood: { color: '#6B4A32', material: 'wood-walnut' }, rug: { color: '#5A5750', material: 'fabric-boucle' }, plant: { color: '#3E5A3A', material: 'plastic-matte' }, light: { color: '#2E2F2C', material: 'fabric-linen' }, metal: { color: '#171816', material: 'metal-black' } }
  },
  {
    id: 'tropical-modern', name: 'Tropical Modern', description: 'Dark timber, terracotta, wood slats and plenty of greenery.',
    floors: { default: 'walnut-planks', kitchen: 'terracotta-tiles', bathroom: 'terracotta-tiles', hallway: 'terracotta-tiles' },
    walls: { default: { material: 'paint', color: '#F3F0E8' }, bathroom: { material: 'subway-tile', color: '#FFFFFF' } },
    accent: { side: 'n', material: 'wood-slats', color: '#FFFFFF' }, lighting: 'daylight',
    theme: { upholstery: { color: '#B7A888', material: 'fabric-linen' }, wood: { color: '#8A5E3B', material: 'wood-walnut' }, rug: { color: '#D6C3A5', material: 'fabric-boucle' }, plant: { color: '#3F7D3A', material: 'plastic-matte' }, light: { color: '#E8D9B8', material: 'fabric-linen' }, metal: { color: '#3A2E24', material: 'metal-black' } }
  }
];
export const STYLE_IDS = STYLES.map((s) => s.id);
export const getStyle = (id) => STYLES.find((s) => s.id === id) || STYLES[0];
export const getStyleName = (id) => getStyle(id).name;

export const LIGHTING_PRESETS = [
  { id: 'daylight', name: 'Daylight', temperature: 0.6 },
  { id: 'warm-evening', name: 'Warm Evening', temperature: 0.1 },
  { id: 'neutral', name: 'Neutral', temperature: 0.5 }
];
export const LIGHTING_PRESET_IDS = LIGHTING_PRESETS.map((p) => p.id);
export const getLightingName = (id) => LIGHTING_PRESETS.find((p) => p.id === id)?.name ?? id;
export const temperatureLabel = (t) => (t < 0.35 ? 'Warm' : t > 0.65 ? 'Cool' : 'Neutral');

export const ROOM_TYPES = [
  { id: 'living-room', name: 'Living Room', w: 600, d: 500 }, { id: 'bedroom', name: 'Bedroom', w: 500, d: 450 },
  { id: 'kitchen', name: 'Kitchen', w: 400, d: 500 }, { id: 'dining-room', name: 'Dining Room', w: 500, d: 400 },
  { id: 'bathroom', name: 'Bathroom', w: 300, d: 250 }, { id: 'study', name: 'Study', w: 350, d: 350 },
  { id: 'hallway', name: 'Hallway', w: 200, d: 400 },
  { id: 'family-room', name: 'Family Room', w: 500, d: 450 }, { id: 'garage', name: 'Garage', w: 300, d: 500 },
  { id: 'laundry', name: 'Laundry', w: 200, d: 250 }, { id: 'balcony', name: 'Balcony', w: 400, d: 200 }
];
export const ROOM_TYPE_IDS = ROOM_TYPES.map((r) => r.id);
export const getRoomType = (id) => ROOM_TYPES.find((r) => r.id === id) || ROOM_TYPES[0];
export const getRoomTypeName = (id) => getRoomType(id).name;

// rot: 0 faces south, 90 faces east, 180 faces north, 270 faces west. fx/fz = position as a fraction of the room.
const L = (type, fx, fz, rot = 0, y = null, extra = {}) => ({ type, fx, fz, rot, y, ...extra });
export const LAYOUTS = {
  'living-room': [L('tv-unit', 0.5, 0.07), L('tv', 0.5, 0.02, 0, 75), L('rug-rect', 0.5, 0.46), L('sofa-3', 0.5, 0.76, 180), L('coffee-table-rect', 0.5, 0.46), L('vase', 0.5, 0.46, 0, 40), L('armchair', 0.13, 0.46, 90), L('armchair', 0.87, 0.46, 270), L('floor-lamp', 0.94, 0.1), L('plant-fiddle', 0.07, 0.1), L('painting-large', 0.5, 0.99, 180), L('bookshelf', 0.97, 0.8, 270)],
  kitchen: [L('fridge', 0.115, 0.08), L('kitchen-base', 0.275, 0.08), L('kitchen-sink', 0.46, 0.08), L('kitchen-cooktop', 0.65, 0.08), L('kitchen-base', 0.8, 0.08), L('kitchen-wall-cabinet', 0.275, 0.05), L('range-hood', 0.65, 0.06), L('kitchen-wall-cabinet', 0.8, 0.05), L('kitchen-island', 0.5, 0.6), L('bar-stool', 0.36, 0.78), L('bar-stool', 0.64, 0.78), L('pendant', 0.4, 0.6), L('pendant', 0.6, 0.6), L('plant-small', 0.5, 0.6, 0, 90)],
  bedroom: [L('rug-rect', 0.5, 0.45), L('bed-queen', 0.5, 0.27), L('nightstand', 0.27, 0.08), L('nightstand', 0.73, 0.08), L('table-lamp', 0.27, 0.08, 0, 50), L('table-lamp', 0.73, 0.08, 0, 50), L('wardrobe-3door', 0.075, 0.72, 90), L('dresser', 0.925, 0.55, 270), L('painting-large', 0.5, 0.02, 0, 135), L('armchair', 0.9, 0.25, 225), L('plant-palm', 0.92, 0.92)],
  'bedroom-compact': [L('rug-rect', 0.5, 0.45, 0, null, { size: { w: 200, d: 140, h: 2 } }), L('bed-double', 0.5, 0.25), L('nightstand', 0.25, 0.08), L('nightstand', 0.75, 0.08), L('table-lamp', 0.25, 0.08, 0, 50), L('table-lamp', 0.75, 0.08, 0, 50), L('painting-large', 0.5, 0.02, 0, 135), L('wardrobe-2door', 0.5, 0.94, 180), L('plant-small', 0.9, 0.92)],
  'dining-room': [L('sideboard', 0.5, 0.075), L('painting-triptych', 0.5, 0.02), L('dining-table-6', 0.5, 0.5), L('dining-chair', 0.41, 0.325), L('dining-chair', 0.59, 0.325), L('dining-chair', 0.41, 0.675, 180), L('dining-chair', 0.59, 0.675, 180), L('dining-chair', 0.26, 0.5, 90), L('dining-chair', 0.74, 0.5, 270), L('pendant', 0.5, 0.5), L('plant-fiddle', 0.08, 0.1)],
  bathroom: [L('bathtub', 0.3, 0.17), L('toilet', 0.87, 0.6, 270), L('vanity', 0.3, 0.87, 180), L('bathroom-mirror', 0.3, 0.985, 180), L('plant-small', 0.9, 0.9)],
  study: [L('rug-rect', 0.5, 0.35, 0, null, { size: { w: 200, d: 140, h: 2 } }), L('desk', 0.5, 0.12), L('office-chair', 0.5, 0.3, 180), L('bookshelf', 0.05, 0.35, 90), L('bookshelf', 0.05, 0.65, 90), L('floor-lamp', 0.92, 0.1), L('plant-small', 0.9, 0.9), L('painting-small', 0.5, 0.02)],
  hallway: [L('console-table', 0.5, 0.94, 180), L('wall-mirror-round', 0.5, 0.985, 180), L('plant-small', 0.8, 0.85)],
  'family-room': [L('tv-unit', 0.5, 0.07), L('tv', 0.5, 0.02, 0, 75), L('rug-rect', 0.5, 0.5), L('sofa-l', 0.5, 0.62, 180), L('coffee-table-round', 0.5, 0.42)],
  garage: [L('car-sedan', 0.5, 0.5, 180)],
  laundry: [L('washing-machine', 0.25, 0.15), L('kitchen-base', 0.75, 0.12)],
  balcony: [L('armchair', 0.2, 0.5, 180), L('side-table', 0.5, 0.5), L('plant-fiddle', 0.9, 0.5)],
  'stair-hall-ground': [L('stairs', 0.5, 0.396), L('shoe-rack', 0.35, 0.95, 180), L('plant-small', 0.14, 0.78)],
  'stair-hall-upper': [L('railing', 0.25, 0.396, 90, null, { size: { w: 380, d: 5, h: 100 } }), L('railing', 0.75, 0.396, 90, null, { size: { w: 380, d: 5, h: 100 } }), L('railing', 0.5, 0.016, 0), L('plant-small', 0.15, 0.9)]
};

export const sideLength = (room, side) => (side === 'n' || side === 's' ? room.w : room.d);
export function interiorSize(room) {
  const t = (side) => (room.walls[side].visible ? room.walls[side].thickness : 0);
  return { w: room.w - (t('w') + t('e')) / 2, d: room.d - (t('n') + t('s')) / 2 };
}
export function getItemSize(item) {
  const base = getItemDef(item.type)?.size ?? { w: 50, d: 50, h: 50 };
  return { w: item.size?.w ?? base.w, d: item.size?.d ?? base.d, h: item.size?.h ?? base.h };
}
export function itemFootprint(item) {
  const { w, d } = getItemSize(item);
  const r = (item.rot * Math.PI) / 180; const c = Math.abs(Math.cos(r)); const s = Math.abs(Math.sin(r));
  return { w: w * c + d * s, d: w * s + d * c };
}
export function clampItemToRoom(item, room) {
  const fp = itemFootprint(item);
  const half = (side) => (room.walls[side].visible ? room.walls[side].thickness / 2 : 0);
  const minX = room.x + half('w') + fp.w / 2; const maxX = room.x + room.w - half('e') - fp.w / 2;
  const minZ = room.z + half('n') + fp.d / 2; const maxZ = room.z + room.d - half('s') - fp.d / 2;
  const x = minX > maxX ? room.x + room.w / 2 : Math.min(maxX, Math.max(minX, item.x));
  const z = minZ > maxZ ? room.z + room.d / 2 : Math.min(maxZ, Math.max(minZ, item.z));
  return { ...item, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}

export function createItem(type, o = {}) {
  const def = getItemDef(type);
  if (!def) throw new Error(`Unknown item type: ${type}`);
  const theme = o.style ? getStyle(o.style).theme[def.role] : null;
  return {
    id: o.id, level: o.level ?? 0, type, x: o.x ?? 0, z: o.z ?? 0, rot: o.rot ?? 0, y: o.y ?? null, size: o.size ?? null,
    color: o.color ?? theme?.color ?? def.color, material: o.material ?? theme?.material ?? def.material,
    trim: o.trim ?? theme?.trim ?? def.trim, visible: true
  };
}
export function makeOpening(roomId, side, type, center, o = {}) {
  const def = OPENING_TYPES.find((x) => x.id === type) || OPENING_TYPES[0];
  return { id: `${roomId}-${side}-${type}-${Math.round(center)}`, type, center, width: o.width ?? def.width, height: o.height ?? def.height, sill: o.sill ?? def.sill };
}
export function buildRoom({ id, type, level = 0, x = 0, z = 0, w, d, name, style = 'modern-minimalist' }) {
  const rt = getRoomType(type); const st = getStyle(style);
  const base = st.walls[type] || st.walls.default;
  const walls = {};
  SIDES.forEach((side) => { walls[side] = { visible: true, thickness: 15, material: base.material, color: base.color, openings: [] }; });
  if ((type === 'living-room' || type === 'bedroom') && st.accent) walls[st.accent.side] = { ...walls[st.accent.side], material: st.accent.material, color: st.accent.color };
  return { id, level, type, name: name || rt.name, x, z, w: w ?? rt.w, d: d ?? rt.d, floorMaterial: st.floors[type] || st.floors.default, floorColor: null, walls };
}
export function furnishRoom(room, prefix, { style = 'modern-minimalist', layout = null } = {}) {
  const entries = layout || LAYOUTS[room.type] || [];
  return entries.map((e, i) => clampItemToRoom(createItem(e.type, {
    id: `${prefix}-${i + 1}`, level: room.level, x: room.x + e.fx * room.w, z: room.z + e.fz * room.d, rot: e.rot, y: e.y, size: e.size, style
  }), room));
}

export const formatLength = (cm, units = 'm') => {
  if (units === 'mm') return `${Math.round(cm * 10)} mm`;
  if (units === 'cm') return `${Math.round(cm)} cm`;
  if (units === 'ft') { const inches = Math.round(cm / 2.54); return `${Math.floor(inches / 12)}′ ${inches % 12}″`; }
  return `${(cm / 100).toFixed(2)} m`;
};
export const formatArea = (cm2) => `${(cm2 / 10000).toFixed(1)} m²`;
export const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

// DEMO values only. Not a construction quotation.
export const SAMPLE_PRICES = { opening: { door: 3500000, window: 2800000, sliding: 7500000, arch: 1500000 } };
export function calculateEstimate(config) {
  let floorArea = 0, floorCost = 0, wallArea = 0, wallCost = 0, openings = 0, openingCost = 0;
  config.rooms.forEach((room) => {
    const area = (room.w * room.d) / 10000;
    floorArea += area; floorCost += area * (getMaterial(room.floorMaterial)?.price || 0);
    const height = config.levels[room.level]?.height ?? 280;
    SIDES.forEach((side) => {
      const wall = room.walls[side];
      if (!wall.visible) return;
      let cm2 = sideLength(room, side) * height;
      wall.openings.forEach((o) => { cm2 -= o.width * Math.min(o.height, height - o.sill); openings += 1; openingCost += SAMPLE_PRICES.opening[o.type] || 0; });
      const m2 = Math.max(0, cm2) / 10000;
      wallArea += m2; wallCost += m2 * (getMaterial(wall.material)?.price || 0);
    });
  });
  let fwArea = 0, fwCost = 0, slabArea = 0, slabCost = 0;
  (config.walls || []).forEach((w) => {
    const h = w.height ?? (config.levels[w.level]?.height ?? 280);
    let cm2 = wallLength(w) * h;
    w.openings.forEach((o) => { cm2 -= o.width * Math.min(o.height, h - o.sill); openings += 1; openingCost += SAMPLE_PRICES.opening[o.type] || 0; });
    const m2 = Math.max(0, cm2) / 10000; fwArea += m2; fwCost += m2 * 2 * (getMaterial(w.material)?.price || 0);
  });
  (config.slabs || []).forEach((sl) => { const a = (sl.w * sl.d) / 10000; slabArea += a; slabCost += a * (getMaterial(sl.material)?.price || 0); });
  const rows = [
    { label: `Flooring (${floorArea.toFixed(1)} m²)`, amount: Math.round(floorCost) },
    { label: `Wall finishes (${wallArea.toFixed(1)} m²)`, amount: Math.round(wallCost) },
    { label: `Doors and windows (${openings})`, amount: openingCost }
  ];
  if (fwArea) rows.push({ label: `Free-standing walls (${fwArea.toFixed(1)} m²)`, amount: Math.round(fwCost) });
  if (slabArea) rows.push({ label: `Custom floors and garden (${slabArea.toFixed(1)} m²)`, amount: Math.round(slabCost) });
  const counts = new Map();
  config.items.forEach((item) => { if (item.visible) counts.set(item.type, (counts.get(item.type) || 0) + 1); });
  counts.forEach((count, type) => { const def = getItemDef(type); rows.push({ label: `${def.name} × ${count}`, amount: def.price * count }); });
  return { rows, total: rows.reduce((sum, r) => sum + r.amount, 0), floorArea };
}