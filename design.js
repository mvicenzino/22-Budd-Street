// Interior design catalog, saved choices, and the Design panel UI.
// interior.js applies the choices to the 3D rooms; this module only knows about options and DOM.

export const FLOORING = [
  {id: 'natural', name: 'Natural oak', color: '#c9a074'},
  {id: 'white', name: 'White oak', color: '#dcc7aa'},
  {id: 'honey', name: 'Honey oak', color: '#c98d4f'},
  {id: 'golden', name: 'Golden oak', color: '#b97a3c'},
  {id: 'gray', name: 'Gray-washed oak', color: '#a89e90'},
  {id: 'walnut', name: 'Walnut stain', color: '#7a5738'},
];

export const STYLES = [
  {id: 'traditional', name: 'Traditional', note: 'walnut wood, blue-gray upholstery'},
  {id: 'modern', name: 'Modern', note: 'black frames, light oak, charcoal upholstery'},
  {id: 'coastal', name: 'Coastal', note: 'whitewashed wood, sand and sky tones'},
  {id: 'farmhouse', name: 'Farmhouse', note: 'rustic wood, cream and greige'},
];

export const WALL_COLORS = [
  {id: 'dove', name: 'White Dove', color: '#f3efe6'},
  {id: 'paleoak', name: 'Pale Oak', color: '#e3dccf'},
  {id: 'seasalt', name: 'Sea Salt', color: '#d7dfd4'},
  {id: 'mist', name: 'Silver Mist', color: '#d4d9da'},
  {id: 'sage', name: 'Sage', color: '#b8c1b0'},
  {id: 'blush', name: 'Blush', color: '#ecd9d0'},
  {id: 'butter', name: 'Butter', color: '#f1e6c2'},
  {id: 'warmgray', name: 'Warm Gray', color: '#cfc9c0'},
  {id: 'navy', name: 'Hale Navy', color: '#45526a'},
];

export const RUGS = [
  {id: 'none', name: 'No rug'},
  {id: 'cream', name: 'Cream wool', field: '#d6cebf', border: '#bfb3a0'},
  {id: 'blue', name: 'Blue Persian', field: '#6c7d8a', border: '#3f4c58', pattern: true},
  {id: 'sand', name: 'Sand jute', field: '#c2ad8d', border: '#a68f6e'},
  {id: 'sage', name: 'Sage', field: '#a3b19e', border: '#7f8d7a'},
  {id: 'charcoal', name: 'Charcoal', field: '#565a5e', border: '#3a3d40'},
  {id: 'terracotta', name: 'Terracotta kilim', field: '#b8694a', border: '#7e4530', pattern: true},
];

export const KITCHEN_FLOORS = [{id: 'checker', name: 'Checkerboard (existing)', color: '#d9d5c8'}, ...FLOORING];

export const COUNTERS = [
  {id: 'alabaster', name: 'Alabaster quartz', base: '#f4f2ed', vein: '#cfcac0', kind: 'marble', veins: 5},
  {id: 'marble', name: 'White marble', base: '#f1f0ec', vein: '#9a9ea3', kind: 'marble', veins: 8},
  {id: 'navy', name: 'Navy laminate (existing)', base: '#27325f', kind: 'plain'},
  {id: 'quartz', name: 'White quartz', base: '#ececea', speck: ['#d9d9d6', '#c8c8c4'], kind: 'granite', density: .35},
  {id: 'graygranite', name: 'Gray granite', base: '#8d8f90', speck: ['#3d3f42', '#c9cacb', '#6b6d70'], kind: 'granite', density: 1},
  {id: 'blackgranite', name: 'Black granite', base: '#232527', speck: ['#4a4d50', '#8a8d90', '#1a1b1d'], kind: 'granite', density: 1},
  {id: 'browngranite', name: 'Brown granite', base: '#6b4f3b', speck: ['#2f2118', '#b08a65', '#8c6a4c'], kind: 'granite', density: 1},
];

export const ISLANDS = [{id: 'none', name: 'No island'}, {id: 'small', name: 'Small island'}];

export const DEFAULT_DESIGN = {flooring: 'natural', style: 'traditional', kitchen: {floor: 'checker', counter: 'alabaster', island: 'none'}, rooms: {}};
const STORAGE_KEY = 'budd-street-design';

export function loadDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') return {...DEFAULT_DESIGN, ...saved, kitchen: {...DEFAULT_DESIGN.kitchen, ...(saved.kitchen || {})}, rooms: {...(saved.rooms || {})}};
  } catch {}
  return {...DEFAULT_DESIGN, kitchen: {...DEFAULT_DESIGN.kitchen}, rooms: {}};
}
export function saveDesign(design) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(design)); } catch {}
}

// Builds the Design panel inside `root`. `hooks` receive user choices; `setRoom` is called by the
// walkthrough whenever the visitor arrives somewhere so the per-room controls follow them.
export function createDesignPanel({root, design, roomDefaults, hooks}) {
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  };
  const swatch = (item, pressed, onPick, label = item.name) => {
    const b = el('button', {type: 'button', class: 'paint-swatch', 'aria-pressed': String(pressed), 'aria-label': label, 'data-id': item.id},
      el('span', {class: 'paint-chip', style: `--paint:${item.color}`, 'aria-hidden': 'true'}, el('span', {class: 'paint-check', text: '✓'})),
      el('span', {text: item.name}));
    b.onclick = () => onPick(item.id);
    return b;
  };
  const pressOnly = (container, id) => container.querySelectorAll('[data-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));

  const floorRow = el('div', {class: 'paint-swatches design-floor'});
  for (const f of FLOORING) floorRow.append(swatch(f, design.flooring === f.id, id => { design.flooring = id; pressOnly(floorRow, id); hooks.flooring(id); }));

  const styleRow = el('div', {class: 'style-options'});
  for (const s of STYLES) {
    const b = el('button', {type: 'button', 'data-id': s.id, 'aria-pressed': String(design.style === s.id)}, el('strong', {text: s.name}), el('small', {text: s.note}));
    b.onclick = () => { design.style = s.id; pressOnly(styleRow, s.id); hooks.style(s.id); };
    styleRow.append(b);
  }

  const roomTitle = el('div', {class: 'design-room-title', text: 'This room'});
  const wallRow = el('div', {class: 'paint-swatches design-walls'});
  const rugSelect = el('select', {id: 'rug-select'});
  for (const r of RUGS) rugSelect.append(el('option', {value: r.id, text: r.name}));
  const layoutSelect = el('select', {id: 'layout-select'});
  const rugRow = el('label', {class: 'design-row'}, el('span', {text: 'Rug'}), rugSelect);
  const layoutRow = el('label', {class: 'design-row'}, el('span', {text: 'Furniture placement'}), layoutSelect);
  const reset = el('button', {type: 'button', id: 'design-reset', text: 'Reset all design choices'});

  // Kitchen-only controls: floor, countertop and island.
  const kitchenFloorRow = el('div', {class: 'paint-swatches design-floor'});
  for (const f of KITCHEN_FLOORS) kitchenFloorRow.append(swatch(f, design.kitchen.floor === f.id, id => { design.kitchen.floor = id; pressOnly(kitchenFloorRow, id); hooks.kitchen(design.kitchen); }));
  const counterRow = el('div', {class: 'paint-swatches design-counters'});
  for (const c of COUNTERS) counterRow.append(swatch({id: c.id, name: c.name, color: c.base}, design.kitchen.counter === c.id, id => { design.kitchen.counter = id; pressOnly(counterRow, id); hooks.kitchen(design.kitchen); }));
  const islandRow = el('div', {class: 'style-options design-island'});
  for (const i of ISLANDS) {
    const b = el('button', {type: 'button', 'data-id': i.id, 'aria-pressed': String(design.kitchen.island === i.id)}, el('strong', {text: i.name}));
    b.onclick = () => { design.kitchen.island = i.id; pressOnly(islandRow, i.id); hooks.kitchen(design.kitchen); };
    islandRow.append(b);
  }
  const kitchenSection = el('div', {class: 'design-kitchen'},
    el('div', {class: 'paint-label design-sub', text: 'Kitchen floor'}), kitchenFloorRow,
    el('div', {class: 'paint-label design-sub', text: 'Countertops'}), counterRow,
    el('div', {class: 'paint-label design-sub', text: 'Island'}), islandRow);

  let currentRoom = null;
  const roomState = id => (design.rooms[id] ||= {});
  for (const w of WALL_COLORS) wallRow.append(swatch(w, false, id => {
    if (!currentRoom) return;
    roomState(currentRoom).wall = id;
    pressOnly(wallRow, id);
    hooks.wall(currentRoom, id);
  }));
  rugSelect.onchange = () => { if (!currentRoom) return; roomState(currentRoom).rug = rugSelect.value; hooks.rug(currentRoom, rugSelect.value); };
  layoutSelect.onchange = () => { if (!currentRoom) return; roomState(currentRoom).layout = layoutSelect.value; hooks.layout(currentRoom, layoutSelect.value); };
  reset.onclick = () => {
    design.flooring = DEFAULT_DESIGN.flooring;
    design.style = DEFAULT_DESIGN.style;
    design.rooms = {};
    design.kitchen = {...DEFAULT_DESIGN.kitchen};
    pressOnly(floorRow, design.flooring);
    pressOnly(styleRow, design.style);
    pressOnly(kitchenFloorRow, design.kitchen.floor);
    pressOnly(counterRow, design.kitchen.counter);
    pressOnly(islandRow, design.kitchen.island);
    hooks.reset();
    if (currentRoom) setRoom(currentRoom);
  };

  root.append(
    el('div', {class: 'paint-label', text: 'Wood flooring'}), floorRow,
    el('div', {class: 'paint-label', text: 'Furniture style'}), styleRow,
    roomTitle,
    el('div', {class: 'paint-label design-sub', text: 'Wall color'}), wallRow,
    rugRow, layoutRow, kitchenSection,
    el('p', {class: 'design-note', text: 'Choices are saved in this browser. Walk to a room to design it.'}),
    reset,
  );

  function setRoom(id, name) {
    currentRoom = id;
    const defaults = roomDefaults(id), state = design.rooms[id] || {};
    roomTitle.textContent = name ? `This room · ${name}` : 'This room';
    pressOnly(wallRow, state.wall || defaults.wall);
    rugRow.hidden = !defaults.rug;
    if (defaults.rug) rugSelect.value = state.rug || defaults.rug;
    layoutSelect.replaceChildren();
    const layouts = defaults.layouts || {};
    layoutRow.hidden = !Object.keys(layouts).length;
    for (const [key, label] of Object.entries(layouts)) layoutSelect.append(el('option', {value: key, text: label}));
    if (!layoutRow.hidden) layoutSelect.value = state.layout || defaults.layout;
    kitchenSection.hidden = id !== 'kitchen';
  }
  return {setRoom};
}
