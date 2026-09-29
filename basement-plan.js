// Concept dimensions in metres, referenced to the existing model, not a site survey.
export const mirrorBasementRect = ([x0,z0,x1,z1]) => [-x1,z0,-x0,z1];
export const BASEMENT_PLAN = {
  bathroom: {rect: [1.55, -3.85, 3.85, -1.10], door: [1.7928, 2.7072], wallX: 1.49, wallZ: -1.04},
  utility: {rect: [-1.25, -.98, 1.43, 1.60], door: [-.762, .762], wallZ: 1.66},
  shower: {rect: [2.8856, -3.8, 3.8, -2.276]},
  vanity: {rect: [1.55, -2.181, 2.058, -1.419]},
  boiler: {rect: [-.35, -.45, .35, .45]},
  service: {rect: [-.6, .45, .6, 1.3644]},
  water: {existing: [-3.35, -3.25], proposed: [-3.35, -3.25]},
  wallThickness: .12, floor: -1.3, ceiling: .78,
};

// Solid wall spans at eye level; doors are deliberately omitted for route validation.
export const BASEMENT_WALLS = [
  [1.43, -3.85, 1.55, -1.04],
  [1.49, -1.10, 1.7928, -.98], [2.7072, -1.10, 3.85, -.98],
  [-1.37, -1.04, -1.25, 1.72], [1.43, -1.04, 1.55, 1.72],
  [-1.31, -1.10, 1.49, -.98],
  [-1.31, 1.60, -.762, 1.72], [.762, 1.60, 1.49, 1.72],
];
