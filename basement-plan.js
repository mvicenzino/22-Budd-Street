// Concept dimensions in metres, referenced to the existing model, not a site survey.
export const BASEMENT_PLAN = {
  bathroom: {rect: [-3.85, -3.85, -1.55, -1.10], door: [-3.5572, -2.6428], wallX: -1.49, wallZ: -1.04},
  utility: {rect: [-1.43, -.98, 1.25, 1.60], door: [-.762, .762], wallZ: 1.66},
  shower: {rect: [-3.8, -3.8, -2.8856, -2.276]},
  vanity: {rect: [-2.058, -2.181, -1.55, -1.419]},
  boiler: {rect: [-.35, -.45, .35, .45]},
  service: {rect: [-.6, .45, .6, 1.3644]},
  water: {existing: [-3.35, -3.25], proposed: [-.7, -3.35]},
  wallThickness: .12, floor: -1.3, ceiling: .78,
};

// Solid wall spans at eye level; doors are deliberately omitted for route validation.
export const BASEMENT_WALLS = [
  [-1.55, -3.85, -1.43, -1.04],
  [-3.85, -1.10, -3.5572, -.98], [-2.6428, -1.10, -1.49, -.98],
  [-1.55, -1.04, -1.43, 1.72], [1.25, -1.04, 1.37, 1.72],
  [-1.49, -1.10, 1.31, -.98],
  [-1.49, 1.60, -.762, 1.72], [.762, 1.60, 1.31, 1.72],
];
