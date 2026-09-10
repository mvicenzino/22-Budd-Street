import {LEVELS} from './plan.js';

// Keep the paneled doors fully open during exploration. The narrow rooms need
// a specific swing so the leaf does not cut across the existing camera path.
export function openDoorPlacement({axis, coord, a0, a1, floorY, head, side, wallThickness=.14}) {
  const hallCloset = floorY === LEVELS.first.y && axis === 'z' && coord === 3.1;
  const powder = floorY === LEVELS.first.y && axis === 'z' && coord === -.32 && a0 === -3.6;
  const backBedroom = floorY === LEVELS.second.y && axis === 'z' && coord === -.32 && a0 === -1.95;
  const angle = Math.PI / 2 * (hallCloset ? 1 : side);
  const along = powder ? a1 - .015 : a0 + .015;
  // This bedroom also provides the route to the walk-in closet: fold its leaf
  // back against the bedroom wall, clear of both the doorway and the camera arc.
  const face = backBedroom ? coord - wallThickness / 2 - .06 : coord;
  return {
    position: [axis === 'x' ? along : face, floorY, axis === 'x' ? face : along],
    rotation: axis === 'x' ? -angle : backBedroom ? Math.PI / 2 : powder ? Math.PI / 2 - angle : angle - Math.PI / 2,
    width: a1 - a0 - .03,
    height: head - floorY - .02,
  };
}
