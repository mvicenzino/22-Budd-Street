// Building envelope and room plans traced from the three floor-plan drawings.
// The exterior (app.js) uses SHELL + OPENINGS to punch real holes in the walls;
// the walkthrough (interior.js) uses everything below to build rooms and nodes.
// Units are metres. Front of the house faces +Z; the driveway is +X.

export const SHELL = {x: 4, z: 4.25, thick: .3, base: .9, top: 6.8};
export const INNER = {x: SHELL.x - SHELL.thick, z: SHELL.z - SHELL.thick}; // inside face of the shell
export const EYE = 1.55; // camera height above the floor

// Finished floor and ceiling heights per level. The loft ceiling is the interior ridge.
export const LEVELS = {
  first: {name: 'First floor', y: 1.1, ceil: 3.85},
  second: {name: 'Second floor', y: 4.15, ceil: 6.75},
  loft: {name: 'Loft', y: 6.85, ceil: 9.5, kneeX: 2, kneeTop: 8.25},
};
const F = LEVELS.first, S = LEVELS.second, L = LEVELS.loft;

// Openings per exterior wall. `a` runs along the wall (x for front/rear, z for sides).
export const OPENINGS = {
  front: [
    {a0: -2.8, a1: -1.9, y0: 1.425, y1: 2.975, kind: 'window'},
    {a0: -1.7, a1: -.8, y0: 1.425, y1: 2.975, kind: 'window'},
    {a0: -.6, a1: .3, y0: 1.425, y1: 2.975, kind: 'window'},
    {a0: 2.025, a1: 2.975, y0: SHELL.base, y1: 3.165, kind: 'door'},
    {a0: -2.735, a1: -1.925, y0: 4.525, y1: 5.875, kind: 'window'},
    {a0: -1.775, a1: -.965, y0: 4.525, y1: 5.875, kind: 'window'},
    {a0: .965, a1: 1.775, y0: 4.525, y1: 5.875, kind: 'window'},
    {a0: 1.925, a1: 2.735, y0: 4.525, y1: 5.875, kind: 'window'},
  ],
  rear: [
    {a0: -1.85, a1: -.15, y0: SHELL.base, y1: 3.1, kind: 'door'},
    {a0: 2.35, a1: 3.25, y0: 1.9, y1: 3.2, kind: 'window'},
    {a0: -2.6, a1: -1.7, y0: 4.675, y1: 5.825, kind: 'window'},
    {a0: 2.3, a1: 3.2, y0: 4.675, y1: 5.825, kind: 'window'},
  ],
  left: [
    {a0: -2.84, a1: -1.86, y0: 1.6, y1: 3.1, kind: 'window'},
    {a0: 1.86, a1: 2.84, y0: 1.6, y1: 3.1, kind: 'window'},
    {a0: -2.84, a1: -1.86, y0: 4.5, y1: 5.9, kind: 'window'},
    {a0: 1.86, a1: 2.84, y0: 4.5, y1: 5.9, kind: 'window'},
  ],
  right: [
    {a0: -2.84, a1: -1.86, y0: 2.26, y1: 3.34, kind: 'window'},
    {a0: 1.86, a1: 2.84, y0: 1.6, y1: 3.1, kind: 'window'},
    {a0: -2.84, a1: -1.86, y0: 4.5, y1: 5.9, kind: 'window'},
    {a0: 1.86, a1: 2.84, y0: 4.5, y1: 5.9, kind: 'window'},
  ],
};

// Main stair: lower flight from the hallway up to a landing at the side door,
// then an upper flight along the driveway wall to the second-floor hall.
export const STAIR = {x0: 2.94, x1: INNER.x, lowerZ0: 3.38, lowerZ1: 1.6, landingZ1: -.38, upperZ1: -2.2, landingY: F.y + 1};
// Loft stair rises from the front-right bedroom toward the rear, arriving in the loft.
export const LOFT_STAIR = {x0: 1, x1: 1.75, z0: 1.1, z1: -.85};

// Interior partitions per level. `axis` is the direction the wall runs; `coord` is its fixed position.
// Openings without `door` are cased; `y1` is the head height above the level's floor (omit for full height).
export const PARTITIONS = [
  // First floor
  {level: 'first', axis: 'x', coord: -.38, c0: -INNER.x, c1: 1.92, openings: [{a0: -2.98, a1: -.94, y1: 2.2}]},          // living | dining
  {level: 'first', axis: 'z', coord: 1.92, c0: -.38, c1: INNER.z, openings: [{a0: 1.45, a1: 3.17, y1: 2.2}]},             // living | hallway
  {level: 'first', axis: 'z', coord: -.33, c0: -INNER.z, c1: -.38, openings: [{a0: -1.95, a1: -.7, y1: 2.2}]},            // dining | kitchen
  {level: 'first', axis: 'x', coord: -.38, c0: 1.92, c1: INNER.x, openings: [{a0: 1.92, a1: 2.94, y1: 2.2}]},             // hallway | kitchen, landing wall
  {level: 'first', axis: 'z', coord: 2.87, c0: STAIR.upperZ1, c1: -.38, openings: []},                                    // upper flight enclosure
  {level: 'first', axis: 'x', coord: -1, c0: 1.2, c1: 1.92, openings: []},                                                // pantry closet
  {level: 'first', axis: 'z', coord: 1.2, c0: -1, c1: -.38, openings: []},
  {level: 'first', axis: 'z', coord: .5, c0: -INNER.z, c1: -2.95, openings: [{a0: -3.7, a1: -3.1, y1: 2.05, door: true}]}, // half bath
  {level: 'first', axis: 'x', coord: -2.95, c0: -.33, c1: .5, openings: []},
  {level: 'first', axis: 'x', coord: 3.4, c0: 2.94, c1: INNER.x, openings: []},                                           // hall closet
  {level: 'first', axis: 'z', coord: 2.94, c0: 3.4, c1: INNER.z, openings: [{a0: 3.45, a1: 3.9, y1: 2.05, door: true}]},
  // Second floor
  {level: 'second', axis: 'x', coord: -.27, c0: -INNER.x, c1: -.1, openings: []},                                        // back bedroom | closets
  {level: 'second', axis: 'x', coord: .8, c0: -INNER.x, c1: -.1, openings: [{a0: -3.4, a1: -2.4, y1: 2.05}, {a0: -1.4, a1: -.4, y1: 2.05}]}, // closet fronts
  {level: 'second', axis: 'z', coord: -1.9, c0: -.27, c1: .8, openings: []},                                             // closet divider
  {level: 'second', axis: 'x', coord: -.27, c0: -.1, c1: INNER.x, openings: [{a0: .1, a1: .75, y1: 2.05, door: true}, {a0: LOFT_STAIR.x0 - .05, a1: LOFT_STAIR.x1 + .05}, {a0: 2.1, a1: 2.7, y1: 2.05, door: true}]}, // hall | front bedrooms
  {level: 'second', axis: 'z', coord: -.1, c0: -INNER.z, c1: .8, openings: [{a0: -1.9, a1: -1.25, y1: 2.05, door: true}]}, // back bedroom | hall, vestibule
  {level: 'second', axis: 'z', coord: .9, c0: -.27, c1: INNER.z, openings: []},                                          // front left | front right
  {level: 'second', axis: 'x', coord: -2.4, c0: -.1, c1: INNER.x, openings: [{a0: 1, a1: 1.5, y1: 2.05, door: true}, {a0: 2, a1: 2.6, y1: 2.05, door: true}]}, // hall | closet, bath
  {level: 'second', axis: 'z', coord: 1.9, c0: -INNER.z, c1: -2.4, openings: []},                                        // closet | bath
];

// Rooms as drawn. Rectangles are [x0, z0, x1, z1]. `minor` rooms are drawn on the map without a label.
export const ROOMS = [
  {id: 'porch', level: 'first', name: 'Front porch', rect: [-4.15, 4.25, 4.15, 6.4], outside: true},
  {id: 'hall', level: 'first', name: 'Hallway', rect: [1.92, -.38, INNER.x, INNER.z]},
  {id: 'living', level: 'first', name: 'Living room', rect: [-INNER.x, -.38, 1.92, INNER.z]},
  {id: 'dining', level: 'first', name: 'Dining room', rect: [-INNER.x, -INNER.z, -.33, -.38]},
  {id: 'kitchen', level: 'first', name: 'Kitchen', rect: [-.33, -INNER.z, INNER.x, -.38]},
  {id: 'rear', level: 'first', name: 'Screened porch', rect: [-4.1, -7.4, 2.8, -4.25], outside: true},
  {id: 'hall2', level: 'second', name: 'Upstairs hall', rect: [-.1, -2.4, INNER.x, -.27]},
  {id: 'bath', level: 'second', name: 'Hall bathroom', rect: [1.9, -INNER.z, INNER.x, -2.4]},
  {id: 'closet2', level: 'second', name: 'Closet', rect: [-.1, -INNER.z, 1.9, -2.4], minor: true},
  {id: 'bedBack', level: 'second', name: 'Back bedroom', rect: [-INNER.x, -INNER.z, -.1, -.27]},
  {id: 'closets', level: 'second', name: 'Closets', rect: [-INNER.x, -.27, -.1, .8], minor: true},
  {id: 'bedFrontL', level: 'second', name: 'Front bedroom left', rect: [-INNER.x, .8, .9, INNER.z]},
  {id: 'bedFrontR', level: 'second', name: 'Front bedroom right', rect: [.9, -.27, INNER.x, INNER.z]},
  {id: 'loft', level: 'loft', name: 'Loft bedroom', rect: [-L.kneeX, -INNER.z, L.kneeX, INNER.z]},
];

// Street-view style nodes: where you can stand, and where you can step to from there.
// `look` is a point the camera settles on after arriving. `door` names a hinged door that
// swings open before the trip. `via` lists waypoints [x, z, floorY] for trips along stairs.
const mainStairUp = [[3.32, 3.25, F.y], [3.32, .5, STAIR.landingY], [3.32, -2.35, S.y], [2.5, -2.1, S.y]];
const loftStairUp = [[1.37, 1.45, S.y], [1.37, -1.15, L.y]];
const reverse = via => [...via].reverse();
export const NODES = [
  {id: 'porch', room: 'porch', x: 2.5, z: 6.3, floor: 1.115, links: [{to: 'hall', door: 'front'}]},
  {id: 'hall', room: 'hall', x: 2.3, z: 2.1, links: [{to: 'porch', door: 'front'}, {to: 'living'}, {to: 'kitchen'}, {to: 'hall2', via: mainStairUp, label: 'Upstairs'}]},
  {id: 'living', room: 'living', x: -.6, z: 2.2, look: [-3.1, 1.4], links: [{to: 'hall'}, {to: 'dining'}]},
  {id: 'dining', room: 'dining', x: -1.5, z: -1.1, look: [-2.3, -2.6], links: [{to: 'living'}, {to: 'kitchen'}, {to: 'rear', door: 'rear'}]},
  {id: 'kitchen', room: 'kitchen', x: 2.2, z: -1.6, look: [2, -3.9], links: [{to: 'hall'}, {to: 'dining'}]},
  {id: 'rear', room: 'rear', x: -.65, z: -5.9, links: [{to: 'dining', door: 'rear'}]},
  {id: 'hall2', room: 'hall2', x: 1.5, z: -1.5, look: [-1, -1.5], links: [{to: 'hall', via: reverse(mainStairUp), label: 'Downstairs'}, {to: 'bedBack'}, {to: 'bedFrontL'}, {to: 'bedFrontR', via: [[2.4, -1, S.y]]}, {to: 'bath'}]},
  {id: 'bedBack', room: 'bedBack', x: -1.2, z: -1.9, look: [-2.85, -2.9], links: [{to: 'hall2'}]},
  {id: 'bedFrontL', room: 'bedFrontL', x: -.6, z: 2.3, look: [-2.65, 2.3], links: [{to: 'hall2'}]},
  {id: 'bedFrontR', room: 'bedFrontR', x: 2, z: 1.5, look: [2.65, 3.05], links: [{to: 'hall2', via: [[2.4, -1, S.y]]}, {to: 'loft', via: loftStairUp, label: 'Up to loft'}]},
  {id: 'bath', room: 'bath', x: 2.8, z: -2.9, look: [2.25, -3.3], links: [{to: 'hall2'}]},
  {id: 'loft', room: 'loft', x: -.6, z: -.5, look: [-.3, 3.9], links: [{to: 'bedFrontR', via: reverse(loftStairUp), label: 'Down to bedroom'}]},
];
