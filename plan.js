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
  basement: {name: 'Basement', y: -1.3, ceil: 1.0}, // 25'8" x 25'7" unfinished, joists under the first floor
};
export const GRADE = .1; // side-door landing height, at grade
const F = LEVELS.first, S = LEVELS.second, L = LEVELS.loft, B = LEVELS.basement;

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
  {wall: 'right', kind: 'sidedoor', a: .47, y: 1.15, w: .87, h: 2.1}, // side door onto the grade-level landing
  // Cellar windows in the foundation
  {wall: 'rear', kind: 'cellar', a: -2.4, y: .45, w: .8, h: .45},
  {wall: 'rear', kind: 'cellar', a: 2.62, y: .45, w: .8, h: .45},
  {wall: 'left', kind: 'cellar', a: -2, y: .45, w: .8, h: .45},
  {wall: 'left', kind: 'cellar', a: 2.05, y: .45, w: .8, h: .45},
  {wall: 'right', kind: 'cellar', a: -2.28, y: .45, w: .8, h: .45},
  {wall: 'right', kind: 'cellar', a: 2.4, y: .45, w: .8, h: .45},
];
export const FOUNDATION = {bottom: B.y - .15, top: SHELL.base};

// Openings the shell walls are cut around, derived from the features above.
export const OPENINGS = {front: [], rear: [], left: [], right: []};
for (const f of FEATURES) {
  if (f.kind === 'gable') continue;
  const isDoor = f.kind === 'door' || f.kind === 'french' || f.kind === 'sidedoor';
  OPENINGS[f.wall].push({a0: f.a - f.w / 2, a1: f.a + f.w / 2, y0: isDoor && f.kind !== 'sidedoor' ? SHELL.base : f.y - f.h / 2, y1: f.y + f.h / 2, kind: isDoor ? 'door' : 'window'});
}

// Stair column against the driveway wall (2'10" wide). One straight flight rises from the hallway
// to the second floor; beneath it the side door opens onto a grade-level landing, with a short flight
// up into the kitchen corner and the basement flight down toward the front.
export const STAIR = {x0: 2.98, x1: INNER.x, upBottomZ: 2.2, upTopZ: -.7, landingZ0: .05, landingZ1: .9, landingY: GRADE, shortTopZ: -.95, downBottomZ: 2.0};
// Loft stair (2'9" wide): behind a door in the upstairs hall wall, climbing toward the front inside
// an enclosed box that protrudes into the front-right bedroom; the loft is reached only from the hall.
export const LOFT_STAIR = {x0: .65, x1: 1.45, z0: -.3, z1: 1.55, door: [.68, 1.42]};

// Interior partitions per level. `axis` is the direction the wall runs; `coord` is its fixed position.
// Openings without `door` are cased; `y1` is the head height above the level's floor (omit for full height).
export const PARTITIONS = [
  // First floor
  {level: 'first', axis: 'x', coord: -.32, c0: -INNER.x, c1: 1.95, openings: [{a0: -2.7, a1: -.85, y1: 2.2}]},            // living | dining
  {level: 'first', axis: 'z', coord: 1.95, c0: -.32, c1: INNER.z, openings: [{a0: 0, a1: 3, y1: 2.2}]},                     // living | hallway
  {level: 'first', axis: 'z', coord: -.32, c0: -INNER.z, c1: -.32, openings: [{a0: -3.6, a1: -2.9, y1: 2.05, door: true, swing: 1}, {a0: -1.75, a1: -.9, y1: 2.2}]}, // dining | kitchen, powder room door
  {level: 'first', axis: 'x', coord: -.32, c0: 1.95, c1: INNER.x, openings: [{a0: 1.95, a1: 2.8, y1: 2.2}, {a0: STAIR.x0, a1: INNER.x}]}, // hallway | kitchen corridor; the stairwell column is open
  {level: 'first', axis: 'z', coord: .5, c0: -INNER.z, c1: -2.6, openings: []},                                             // powder room (2'9" x 4'2")
  {level: 'first', axis: 'x', coord: -2.6, c0: -.32, c1: .5, openings: []},                                                 // powder room front, fridge alcove side
  {level: 'first', axis: 'x', coord: -1.75, c0: -.32, c1: .5, openings: []},                                                // fridge alcove return, beside the dining entrance
  {level: 'first', axis: 'x', coord: 3.15, c0: 3.1, c1: INNER.x, openings: []},                                             // hall closet (2'9")
  {level: 'first', axis: 'z', coord: 3.1, c0: 3.15, c1: INNER.z, openings: [{a0: 3.25, a1: 3.75, y1: 2.05, door: true, swing: -1}]},
  // Second floor
  {level: 'second', axis: 'x', coord: -.37, c0: -INNER.x, c1: -.32, openings: []},                                         // back bedroom | closets
  {level: 'second', axis: 'x', coord: .35, c0: -INNER.x, c1: -.32, openings: [{a0: -3.6, a1: -2.7, y1: 2.05}, {a0: -2.55, a1: -1.75, y1: 2.05}, {a0: -1.6, a1: -.6, y1: 2.05}]}, // closet fronts: doors, built-in, doors
  {level: 'second', axis: 'z', coord: -2.62, c0: -.37, c1: .35, openings: []},                                              // closet dividers
  {level: 'second', axis: 'z', coord: -1.68, c0: -.37, c1: .35, openings: []},
  {level: 'second', axis: 'z', coord: -.32, c0: -.37, c1: .35, openings: []},                                               // closets | vestibule
  {level: 'second', axis: 'x', coord: -.37, c0: -.32, c1: INNER.x, openings: [{a0: -.25, a1: .45, y1: 2.05, door: true, swing: 1}, {a0: LOFT_STAIR.door[0], a1: LOFT_STAIR.door[1], y1: 2.05, door: true, hinged: 'loft'}, {a0: 2.1, a1: 2.7, y1: 2.05, door: true, swing: 1}, {a0: STAIR.x0, a1: INNER.x}]}, // hall | front bedrooms: loft stair door, bedroom door, stairwell open
  {level: 'second', axis: 'z', coord: -.32, c0: -INNER.z, c1: -.37, openings: [{a0: -3.65, a1: -2.95, y1: 2.05, door: true, swing: 1}, {a0: -1.95, a1: -1.2, y1: 2.05, door: true, swing: -1}]}, // back bedroom | walk-in closet door, hall door
  {level: 'second', axis: 'z', coord: .62, c0: -.37, c1: INNER.z, openings: []},                                            // front left | front right
  {level: 'second', axis: 'z', coord: LOFT_STAIR.x1 + .07, c0: -.37, c1: LOFT_STAIR.z1 + .07, openings: []},                // loft stair box inside the front-right bedroom
  {level: 'second', axis: 'x', coord: LOFT_STAIR.z1 + .07, c0: .62, c1: LOFT_STAIR.x1 + .07, openings: []},
  {level: 'second', axis: 'x', coord: -2.12, c0: -.32, c1: INNER.x, openings: [{a0: .95, a1: 1.45, y1: 2.05, door: true, swing: 1}, {a0: 2.4, a1: 3, y1: 2.05, door: true, swing: -1}]}, // hall | linen closet, bath
  {level: 'second', axis: 'x', coord: -2.76, c0: .62, c1: 1.58, openings: []},                                              // linen closet (3'2") carved from the walk-in
  {level: 'second', axis: 'z', coord: .62, c0: -2.76, c1: -2.12, openings: []},
  {level: 'second', axis: 'z', coord: 1.58, c0: -INNER.z, c1: -2.12, openings: []},                                         // walk-in closet | bath
  {level: 'second', axis: 'z', coord: STAIR.x0, c0: -.37, c1: 2.1, openings: []},                                           // stair column | front-right bedroom (7'5")
  {level: 'second', axis: 'x', coord: 1.25, c0: STAIR.x0, c1: INNER.x, openings: []},                                        // stairwell | bedroom closet
  {level: 'second', axis: 'x', coord: 2.1, c0: STAIR.x0, c1: INNER.x, openings: [{a0: 3.2, a1: 3.7, y1: 2.05, door: true, swing: 1}]}, // bedroom closet door (3'2")
];

// Rooms as measured. Rectangles are [x0, z0, x1, z1]. `minor` rooms are drawn on the map without a
// label and take default paint; they are listed before the room they sit inside so lookups find them first.
export const ROOMS = [
  {id: 'porch', level: 'first', name: 'Front porch', rect: [-4.15, SHELL.z, 4.15, SHELL.z + 2.15], outside: true},
  {id: 'hallCloset', level: 'first', name: 'Closet', rect: [3.1, 3.15, INNER.x, INNER.z], minor: true},
  {id: 'landing', level: 'first', name: 'Side door landing', rect: [STAIR.x0, -.32, INNER.x, STAIR.upBottomZ], minor: true},
  {id: 'hall', level: 'first', name: 'Hallway', rect: [1.95, -.32, INNER.x, INNER.z]},
  {id: 'living', level: 'first', name: 'Living room', rect: [-INNER.x, -.32, 1.95, INNER.z]},
  {id: 'powder', level: 'first', name: 'Powder room', rect: [-.32, -INNER.z, .5, -2.6], minor: true},
  {id: 'dining', level: 'first', name: 'Dining room', rect: [-INNER.x, -INNER.z, -.32, -.32]},
  {id: 'kitchen', level: 'first', name: 'Kitchen', rect: [-.32, -INNER.z, INNER.x, -.32]},
  {id: 'rear', level: 'first', name: 'Sunroom', rect: [-4.1, -SHELL.z - 3.15, 2.8, -SHELL.z], outside: true},
  {id: 'linen', level: 'second', name: 'Linen', rect: [.62, -2.76, 1.58, -2.12], minor: true},
  {id: 'walkin', level: 'second', name: 'Walk-in closet', rect: [-.32, -INNER.z, 1.58, -2.12]},
  {id: 'bath', level: 'second', name: 'Hall bathroom', rect: [1.58, -INNER.z, INNER.x, -2.12]},
  {id: 'hall2', level: 'second', name: 'Upstairs hall', rect: [-.32, -2.12, INNER.x, -.37]},
  {id: 'stairwell', level: 'second', name: 'Stair', rect: [STAIR.x0, -.37, INNER.x, 1.25], minor: true},
  {id: 'loftstair', level: 'second', name: 'Stair', rect: [.62, -.37, LOFT_STAIR.x1 + .07, LOFT_STAIR.z1 + .07], minor: true},
  {id: 'closet3', level: 'second', name: 'Closet', rect: [STAIR.x0, 1.25, INNER.x, 2.1], minor: true},
  {id: 'closets', level: 'second', name: 'Closets', rect: [-INNER.x, -.37, -.32, .35], minor: true},
  {id: 'bedBack', level: 'second', name: 'Back bedroom', rect: [-INNER.x, -INNER.z, -.32, -.37]},
  {id: 'bedFrontL', level: 'second', name: 'Front bedroom left', rect: [-INNER.x, -.37, .62, INNER.z]},
  {id: 'bedFrontR', level: 'second', name: 'Front bedroom right', rect: [.62, -.37, INNER.x, INNER.z]},
  {id: 'loft', level: 'loft', name: 'Loft bedroom', rect: [-L.kneeX, -INNER.z, L.kneeX, INNER.z]},
  {id: 'basement', level: 'basement', name: 'Basement', rect: [-INNER.x, -INNER.z, INNER.x, INNER.z]},
];

// Street-view style nodes: where you can stand, and where you can step to from there.
// `look` is a point the camera settles on after arriving. `door` names a hinged door that
// swings open before the trip. `via` lists waypoints [x, z, floorY] for trips along stairs
// or around corners.
const stairX = (STAIR.x0 + STAIR.x1) / 2, loftX = (LOFT_STAIR.x0 + LOFT_STAIR.x1) / 2;
const mainStairUp = [[stairX, STAIR.upBottomZ + .2, F.y], [stairX, STAIR.upTopZ - .3, S.y]];
const toLanding = [[stairX, STAIR.shortTopZ - .2, F.y]];
const toBasement = [[stairX, STAIR.downBottomZ + .3, B.y]];
const loftStairUp = [[loftX, LOFT_STAIR.z0 - .35, S.y], [loftX, LOFT_STAIR.z1 + .3, L.y]];
const reverse = via => [...via].reverse();
export const NODES = [
  {id: 'porch', room: 'porch', x: 2.72, z: SHELL.z + 2.05, floor: 1.115, links: [{to: 'hall', door: 'front'}]},
  {id: 'hall', room: 'hall', x: 2.45, z: 2.6, look: [2.4, -.3], links: [{to: 'porch', door: 'front'}, {to: 'living'}, {to: 'kitchenEntry', label: 'Kitchen'}, {to: 'hall2', via: mainStairUp, label: 'Upstairs'}]},
  {id: 'living', room: 'living', x: -.1, z: 1.6, look: [-2.2, 3.4], links: [{to: 'hall'}, {to: 'dining'}]},
  {id: 'dining', room: 'dining', x: -1.5, z: -1.1, look: [-2.1, -2.6], links: [{to: 'living'}, {to: 'kitchenWork', via: [[.9, -1.5, F.y]], label: 'Kitchen'}, {to: 'rear', door: 'rear'}]},
  {id: 'kitchenEntry', room: 'kitchen', name: 'Kitchen entrance', x: 2.6, z: -.7, look: [2.2, -3.4], links: [{to: 'hall'}, {to: 'kitchen', label: 'By the stools'}, {to: 'kitchenSink', label: 'To the sink'}, {to: 'landing', via: toLanding, door: 'cellar', label: 'Down to side door'}]},
  {id: 'kitchen', room: 'kitchen', name: 'Kitchen, by the stools', x: 2.6, z: -1.75, look: [1.4, -3.4], links: [{to: 'kitchenEntry', label: 'Back to the entrance'}, {to: 'kitchenSink', label: 'To the sink'}, {to: 'kitchenWork', label: 'Over by the range'}, {to: 'landing', via: [[2.55, -1.15, F.y], ...toLanding], door: 'cellar', label: 'Down to side door'}]},
  {id: 'kitchenSink', room: 'kitchen', name: 'Kitchen, at the sink', x: 2.7, z: -2.55, look: [2.7, -3.85], links: [{to: 'kitchen', label: 'By the stools'}, {to: 'kitchenWork', label: 'Over by the range'}, {to: 'kitchenEntry', label: 'Back to the entrance'}]},
  {id: 'kitchenWork', room: 'kitchen', name: 'Kitchen, by the range', x: 1.35, z: -2.5, look: [1.3, -3.85], pitch: -.1, links: [{to: 'kitchenSink', label: 'To the sink'}, {to: 'kitchen', label: 'By the stools'}, {to: 'dining', via: [[.9, -1.5, F.y]]}]},
  {id: 'landing', room: 'landing', x: stairX, z: (STAIR.landingZ0 + STAIR.landingZ1) / 2, floor: GRADE, look: [3.3, -1.2], links: [{to: 'kitchenEntry', via: reverse(toLanding), door: 'cellar', label: 'Up to kitchen'}, {to: 'basement', via: toBasement, label: 'Down to basement'}]},
  {id: 'basement', room: 'basement', name: 'Basement, by the stairs', x: 1.9, z: 1.5, look: [-2, -1.5], links: [{to: 'landing', via: reverse(toBasement), label: 'Up to side door'}, {to: 'basementRear'}]},
  {id: 'basementRear', room: 'basement', name: 'Basement, far corner', x: -1.6, z: -1.8, look: [2.5, 2.5], links: [{to: 'basement'}]},
  {id: 'rear', room: 'rear', x: -1.9, z: -SHELL.z - 1.4, links: [{to: 'dining', door: 'rear'}]},
  {id: 'hall2', room: 'hall2', x: 2.2, z: -1.25, look: [-.3, -1.25], links: [{to: 'hall', via: reverse(mainStairUp), label: 'Downstairs'}, {to: 'bedBack'}, {to: 'bedFrontL', via: [[.1, -1, S.y], [.15, .6, S.y]]}, {to: 'bedFrontR', via: [[2.4, -.8, S.y]]}, {to: 'bath'}, {to: 'loft', via: loftStairUp, door: 'loft', label: 'Up to loft'}, {to: 'walkin', via: [[-.6, -1.6, S.y], [-.6, -3.2, S.y]]}]},
  {id: 'bedBack', room: 'bedBack', x: -1.5, z: -1.6, look: [-3, -2.8], links: [{to: 'hall2'}, {to: 'walkin', via: [[-.6, -3.2, S.y]]}]},
  {id: 'walkin', room: 'walkin', x: .3, z: -3.1, look: [1.4, -3.5], links: [{to: 'bedBack', via: [[-.6, -3.2, S.y]]}]},
  {id: 'bedFrontL', room: 'bedFrontL', x: -1.2, z: 2.2, look: [-2.8, 2.4], links: [{to: 'hall2', via: [[.15, .6, S.y], [.1, -1, S.y]]}]},
  {id: 'bedFrontR', room: 'bedFrontR', x: 2.1, z: 1.6, look: [2.75, 3.05], links: [{to: 'hall2', via: [[2.4, -.8, S.y]]}]},
  {id: 'bath', room: 'bath', x: 3.25, z: -2.45, look: [1.9, -3.3], links: [{to: 'hall2'}]},
  {id: 'loft', room: 'loft', x: -.4, z: 1.7, look: [-.3, -3.8], links: [{to: 'hall2', via: reverse(loftStairUp), door: 'loft', label: 'Down to the hall'}]},
];
