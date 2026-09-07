// Building envelope and room plans, traced from the Pillar To Post measured floor plans
// (22 Budd Street, 1st/2nd/3rd floor, +/-5%). Feet and inches converted to metres.
// The exterior (app.js) uses SHELL + FEATURES to build walls with real openings;
// the walkthrough (interior.js) uses everything below to build rooms and nodes.
// Front of the house faces +Z; the driveway is +X; origin is the centre of the footprint.

export const SHELL = {x: 4, z: 4, thick: .15, base: .9, top: 6.8}; // 25'3" interior square plus walls
export const INNER = {x: SHELL.x - SHELL.thick, z: SHELL.z - SHELL.thick}; // 3.85: inside face of the shell
export const EYE = 1.55; // camera height above the floor

// Finished floor and ceiling heights per level. The loft ceiling is the interior ridge.
export const LEVELS = {
  first: {name: 'First floor', y: 1.1, ceil: 3.85},
  second: {name: 'Second floor', y: 4.15, ceil: 6.75},
  loft: {name: 'Loft', y: 6.85, ceil: 9.5, kneeX: 1.88, kneeTop: 8.3}, // 12'4" wide under the roof
};
const F = LEVELS.first, S = LEVELS.second, L = LEVELS.loft;

// Exterior windows and doors. `a` is the centre along the wall (x for front/rear, z for sides),
// `y` the centre height, `w`/`h` the opening size. `pair` groups the paired upstairs windows that
// share one set of outer shutters (value = pair centre); `shutters` (-1 or 1) draws one shutter on that side.
export const FEATURES = [
  // Front (street)
  {wall: 'front', kind: 'window', a: -2.3, y: 2.2, w: .9, h: 1.55, shutters: -1},
  {wall: 'front', kind: 'window', a: -1.15, y: 2.2, w: .9, h: 1.55},
  {wall: 'front', kind: 'window', a: -.1, y: 2.2, w: .9, h: 1.55, shutters: 1},
  {wall: 'front', kind: 'door', a: 2.72, y: 2.09, w: .85, h: 2.15},
  {wall: 'front', kind: 'window', a: -2.43, y: 5.2, w: .81, h: 1.35, pair: -1.95},
  {wall: 'front', kind: 'window', a: -1.47, y: 5.2, w: .81, h: 1.35, pair: -1.95},
  {wall: 'front', kind: 'window', a: 1.37, y: 5.2, w: .81, h: 1.35, pair: 1.85},
  {wall: 'front', kind: 'window', a: 2.33, y: 5.2, w: .81, h: 1.35, pair: 1.85},
  {wall: 'front', kind: 'gable', a: -.47, y: 8.15, w: .72, h: 1.1},
  {wall: 'front', kind: 'gable', a: .47, y: 8.15, w: .72, h: 1.1},
  // Rear (screened porch side)
  {wall: 'rear', kind: 'window', a: -3.05, y: 2.4, w: .6, h: 1.3},
  {wall: 'rear', kind: 'french', a: -1.9, y: 2.05, w: 1.5, h: 2.1},
  {wall: 'rear', kind: 'window', a: 2.65, y: 2.7, w: .8, h: 1.1}, // kitchen window over the sink
  {wall: 'rear', kind: 'window', a: -2.15, y: 5.25, w: .9, h: 1.15},
  {wall: 'rear', kind: 'window', a: 2.7, y: 5.25, w: .9, h: 1.15},
  {wall: 'rear', kind: 'gable', a: -.47, y: 8.15, w: .72, h: 1.1},
  {wall: 'rear', kind: 'gable', a: .47, y: 8.15, w: .72, h: 1.1},
  // Left side
  {wall: 'left', kind: 'window', a: -2.1, y: 2.35, w: .98, h: 1.5},
  {wall: 'left', kind: 'window', a: 1.9, y: 2.35, w: .98, h: 1.5},
  {wall: 'left', kind: 'window', a: -2.1, y: 5.2, w: .98, h: 1.4},
  {wall: 'left', kind: 'window', a: 1.9, y: 5.2, w: .98, h: 1.4},
  // Right side (driveway)
  {wall: 'right', kind: 'window', a: -2.1, y: 2.8, w: .98, h: 1.08}, // elevated kitchen window
  {wall: 'right', kind: 'window', a: 2.5, y: 2.35, w: .98, h: 1.5},
  {wall: 'right', kind: 'window', a: -1.4, y: 5.2, w: .98, h: 1.4},
  {wall: 'right', kind: 'window', a: 2.45, y: 5.2, w: .98, h: 1.4},
  {wall: 'right', kind: 'sidedoor', a: .47, y: 1.15, w: .87, h: 2.1}, // landing / basement entrance
];

// Openings the shell walls are cut around, derived from the features above.
export const OPENINGS = {front: [], rear: [], left: [], right: []};
for (const f of FEATURES) {
  if (f.kind === 'gable' || f.kind === 'sidedoor') continue;
  const isDoor = f.kind === 'door' || f.kind === 'french';
  OPENINGS[f.wall].push({a0: f.a - f.w / 2, a1: f.a + f.w / 2, y0: isDoor ? SHELL.base : f.y - f.h / 2, y1: f.y + f.h / 2, kind: isDoor ? 'door' : 'window'});
}

// Main stair, in the hallway against the driveway wall: lower flight up to a landing at the side
// door, then a steep upper flight to the second-floor hall (the two drawings disagree slightly).
export const STAIR = {x0: 2.98, x1: INNER.x, lowerZ0: 2.2, lowerZ1: 1.1, landingZ1: .6, upperZ1: -.9, landingY: F.y + 1.05};
// Loft stair (2'9" wide): rises from the front-right bedroom toward the rear into the loft.
export const LOFT_STAIR = {x0: .65, x1: 1.45, z0: .8, z1: -.9};

// Interior partitions per level. `axis` is the direction the wall runs; `coord` is its fixed position.
// Openings without `door` are cased; `y1` is the head height above the level's floor (omit for full height).
export const PARTITIONS = [
  // First floor
  {level: 'first', axis: 'x', coord: -.32, c0: -INNER.x, c1: 1.95, openings: [{a0: -2.7, a1: -.85, y1: 2.2}]},            // living | dining
  {level: 'first', axis: 'z', coord: 1.95, c0: -.32, c1: INNER.z, openings: [{a0: 0, a1: 3, y1: 2.2}]},                     // living | hallway
  {level: 'first', axis: 'z', coord: -.32, c0: -INNER.z, c1: -.32, openings: [{a0: -3.6, a1: -2.9, y1: 2.05, door: true}, {a0: -1.75, a1: -.9, y1: 2.2}]}, // dining | kitchen, powder room door
  {level: 'first', axis: 'x', coord: -.32, c0: 1.95, c1: INNER.x, openings: [{a0: 1.95, a1: 2.8, y1: 2.2}]},                // hallway | kitchen corridor, landing wall
  {level: 'first', axis: 'z', coord: STAIR.x0, c0: STAIR.upperZ1, c1: -.32, openings: []},                                  // upper flight enclosure
  {level: 'first', axis: 'x', coord: -.9, c0: 1.05, c1: 1.7, openings: []},                                                 // pantry closet
  {level: 'first', axis: 'z', coord: 1.05, c0: -.9, c1: -.32, openings: []},
  {level: 'first', axis: 'z', coord: 1.7, c0: -.9, c1: -.32, openings: []},
  {level: 'first', axis: 'z', coord: .5, c0: -INNER.z, c1: -2.6, openings: []},                                             // powder room (2'9" x 4'2")
  {level: 'first', axis: 'x', coord: -2.6, c0: -.32, c1: .5, openings: []},                                                 // powder room front, fridge alcove side
  {level: 'first', axis: 'x', coord: -1.75, c0: -.32, c1: .5, openings: []},                                                // fridge alcove return, beside the dining entrance
  {level: 'first', axis: 'x', coord: 3.15, c0: 3.1, c1: INNER.x, openings: []},                                             // hall closet (2'9")
  {level: 'first', axis: 'z', coord: 3.1, c0: 3.15, c1: INNER.z, openings: [{a0: 3.25, a1: 3.75, y1: 2.05, door: true}]},
  // Second floor
  {level: 'second', axis: 'x', coord: -.37, c0: -INNER.x, c1: -.32, openings: []},                                         // back bedroom | closets
  {level: 'second', axis: 'x', coord: .35, c0: -INNER.x, c1: -.32, openings: [{a0: -3.6, a1: -2.7, y1: 2.05}, {a0: -2.55, a1: -1.75, y1: 2.05}, {a0: -1.6, a1: -.6, y1: 2.05}]}, // closet fronts: doors, built-in, doors
  {level: 'second', axis: 'z', coord: -2.62, c0: -.37, c1: .35, openings: []},                                              // closet dividers
  {level: 'second', axis: 'z', coord: -1.68, c0: -.37, c1: .35, openings: []},
  {level: 'second', axis: 'z', coord: -.32, c0: -.37, c1: .35, openings: []},                                               // closets | vestibule
  {level: 'second', axis: 'x', coord: -.37, c0: -.32, c1: INNER.x, openings: [{a0: -.25, a1: .45, y1: 2.05, door: true}, {a0: LOFT_STAIR.x0 - .03, a1: LOFT_STAIR.x1 + .05}, {a0: 2.1, a1: 2.7, y1: 2.05, door: true}, {a0: STAIR.x0, a1: INNER.x}]}, // hall | front bedrooms, stairwell open
  {level: 'second', axis: 'z', coord: -.32, c0: -INNER.z, c1: -.37, openings: [{a0: -1.95, a1: -1.2, y1: 2.05, door: true}]}, // back bedroom | closet and hall
  {level: 'second', axis: 'z', coord: .62, c0: -.37, c1: INNER.z, openings: []},                                            // front left | front right
  {level: 'second', axis: 'x', coord: -2.12, c0: -.32, c1: INNER.x, openings: [{a0: .45, a1: 1.15, y1: 2.05, door: true}, {a0: 2.4, a1: 3, y1: 2.05, door: true}]}, // hall | closet, bath
  {level: 'second', axis: 'z', coord: 1.64, c0: -INNER.z, c1: -2.12, openings: []},                                         // closet | bath
  {level: 'second', axis: 'z', coord: STAIR.x0, c0: -.37, c1: 2.1, openings: []},                                           // stair column | front-right bedroom (7'5")
  {level: 'second', axis: 'x', coord: .9, c0: STAIR.x0, c1: INNER.x, openings: []},                                         // stairwell | bedroom closet
  {level: 'second', axis: 'x', coord: 2.1, c0: STAIR.x0, c1: INNER.x, openings: [{a0: 3.2, a1: 3.7, y1: 2.05, door: true}]}, // bedroom closet door (3'2")
];

// Rooms as measured. Rectangles are [x0, z0, x1, z1]. `minor` rooms are drawn on the map without a
// label and take default paint; they are listed before the room they sit inside so lookups find them first.
export const ROOMS = [
  {id: 'porch', level: 'first', name: 'Front porch', rect: [-4.15, SHELL.z, 4.15, SHELL.z + 2.15], outside: true},
  {id: 'hallCloset', level: 'first', name: 'Closet', rect: [3.1, 3.15, INNER.x, INNER.z], minor: true},
  {id: 'hall', level: 'first', name: 'Hallway', rect: [1.95, -.32, INNER.x, INNER.z]},
  {id: 'living', level: 'first', name: 'Living room', rect: [-INNER.x, -.32, 1.95, INNER.z]},
  {id: 'powder', level: 'first', name: 'Powder room', rect: [-.32, -INNER.z, .5, -2.6], minor: true},
  {id: 'dining', level: 'first', name: 'Dining room', rect: [-INNER.x, -INNER.z, -.32, -.32]},
  {id: 'kitchen', level: 'first', name: 'Kitchen', rect: [-.32, -INNER.z, INNER.x, -.32]},
  {id: 'rear', level: 'first', name: 'Screened porch', rect: [-4.1, -SHELL.z - 3.15, 2.8, -SHELL.z], outside: true},
  {id: 'closet2', level: 'second', name: 'Closet', rect: [-.32, -INNER.z, 1.64, -2.12], minor: true},
  {id: 'bath', level: 'second', name: 'Hall bathroom', rect: [1.64, -INNER.z, INNER.x, -2.12]},
  {id: 'hall2', level: 'second', name: 'Upstairs hall', rect: [-.32, -2.12, INNER.x, -.37]},
  {id: 'stairwell', level: 'second', name: 'Stair', rect: [STAIR.x0, -.37, INNER.x, .9], minor: true},
  {id: 'closet3', level: 'second', name: 'Closet', rect: [STAIR.x0, .9, INNER.x, 2.1], minor: true},
  {id: 'closets', level: 'second', name: 'Closets', rect: [-INNER.x, -.37, -.32, .35], minor: true},
  {id: 'bedBack', level: 'second', name: 'Back bedroom', rect: [-INNER.x, -INNER.z, -.32, -.37]},
  {id: 'bedFrontL', level: 'second', name: 'Front bedroom left', rect: [-INNER.x, -.37, .62, INNER.z]},
  {id: 'bedFrontR', level: 'second', name: 'Front bedroom right', rect: [.62, -.37, INNER.x, INNER.z]},
  {id: 'loft', level: 'loft', name: 'Loft bedroom', rect: [-L.kneeX, -INNER.z, L.kneeX, INNER.z]},
];

// Street-view style nodes: where you can stand, and where you can step to from there.
// `look` is a point the camera settles on after arriving. `door` names a hinged door that
// swings open before the trip. `via` lists waypoints [x, z, floorY] for trips along stairs
// or around corners.
const stairX = (STAIR.x0 + STAIR.x1) / 2, loftX = (LOFT_STAIR.x0 + LOFT_STAIR.x1) / 2;
const mainStairUp = [[stairX, STAIR.lowerZ0 - .1, F.y], [stairX, (STAIR.lowerZ1 + STAIR.landingZ1) / 2, STAIR.landingY], [stairX, STAIR.upperZ1 - .15, S.y]];
const loftStairUp = [[loftX, LOFT_STAIR.z0 + .35, S.y], [loftX, LOFT_STAIR.z1 - .25, L.y]];
const reverse = via => [...via].reverse();
export const NODES = [
  {id: 'porch', room: 'porch', x: 2.72, z: SHELL.z + 2.05, floor: 1.115, links: [{to: 'hall', door: 'front'}]},
  {id: 'hall', room: 'hall', x: 2.45, z: 2.6, look: [2.4, -.3], links: [{to: 'porch', door: 'front'}, {to: 'living'}, {to: 'kitchen', via: [[2.4, -.6, F.y]]}, {to: 'hall2', via: mainStairUp, label: 'Upstairs'}]},
  {id: 'living', room: 'living', x: -.1, z: 1.6, look: [-2.2, 3.4], links: [{to: 'hall'}, {to: 'dining'}]},
  {id: 'dining', room: 'dining', x: -1.5, z: -1.1, look: [-2.1, -2.6], links: [{to: 'living'}, {to: 'kitchen'}, {to: 'rear', door: 'rear'}]},
  {id: 'kitchen', room: 'kitchen', x: 2.2, z: -1.15, look: [2.5, -3.85], links: [{to: 'hall', via: [[2.4, -.6, F.y]]}, {to: 'dining'}]},
  {id: 'rear', room: 'rear', x: -1.9, z: -SHELL.z - 1.4, links: [{to: 'dining', door: 'rear'}]},
  {id: 'hall2', room: 'hall2', x: 2.2, z: -1.25, look: [-.3, -1.25], links: [{to: 'hall', via: reverse(mainStairUp), label: 'Downstairs'}, {to: 'bedBack'}, {to: 'bedFrontL', via: [[.1, -1, S.y], [.15, .6, S.y]]}, {to: 'bedFrontR', via: [[2.4, -.8, S.y]]}, {to: 'bath'}]},
  {id: 'bedBack', room: 'bedBack', x: -1.5, z: -1.6, look: [-3, -2.8], links: [{to: 'hall2'}]},
  {id: 'bedFrontL', room: 'bedFrontL', x: -1.2, z: 2.2, look: [-2.8, 2.4], links: [{to: 'hall2', via: [[.15, .6, S.y], [.1, -1, S.y]]}]},
  {id: 'bedFrontR', room: 'bedFrontR', x: 1.9, z: 1.6, look: [2.75, 3.05], links: [{to: 'hall2', via: [[2.4, -.8, S.y]]}, {to: 'loft', via: loftStairUp, label: 'Up to loft'}]},
  {id: 'bath', room: 'bath', x: 3.25, z: -2.45, look: [1.9, -3.3], links: [{to: 'hall2'}]},
  {id: 'loft', room: 'loft', x: -.4, z: -1.6, look: [-.3, 3.8], links: [{to: 'bedFrontR', via: reverse(loftStairUp), label: 'Down to bedroom'}]},
];
