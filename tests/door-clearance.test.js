import test from 'node:test';
import assert from 'node:assert/strict';
import {openDoorPlacement} from '../door-placement.js';
import {PARTITIONS, LEVELS, NODES, ROOMS, EYE} from '../plan.js';
import {filmPose, FILM_DURATION} from '../cinematic-path.js';

const roomById = Object.fromEntries(ROOMS.map(room => [room.id, room]));
const nodeById = Object.fromEntries(NODES.map(node => [node.id, node]));
const panels = PARTITIONS.flatMap(partition => partition.openings.filter(opening => opening.door && !opening.hinged).map(opening => ({
  ...openDoorPlacement({...partition, ...opening, floorY:LEVELS[partition.level].y, head:LEVELS[partition.level].y+opening.y1, side:opening.swing || 1}),
  label:`${partition.level} ${partition.axis}=${partition.coord}, opening ${opening.a0}`,
})));
function distance(point, panel) {
  // Transform the camera point into the door's local rectangle. Include the
  // protruding panels/knobs, not just the flat slab, in the clearance envelope.
  const dx=point[0]-panel.position[0], dy=point[1]-panel.position[1], dz=point[2]-panel.position[2];
  const c=Math.cos(panel.rotation), s=Math.sin(panel.rotation);
  const x=dx*c-dz*s, z=dx*s+dz*c;
  return Math.hypot(Math.max(0,-x,x-panel.width), Math.max(0,-dy,dy-panel.height), Math.max(0,Math.abs(z)-.055));
}
const interpolate = (a,b,t) => a.map((value,index) => value+(b[index]-value)*t);
const standing = node => [node.x,(node.floor ?? LEVELS[roomById[node.room].level].y)+EYE,node.z];

test('open interior doors clear every visible cinematic camera position', () => {
  for(let seconds=0;seconds<=FILM_DURATION;seconds+=.01) {
    const pose=filmPose(seconds);
    if(pose.opacity < .1) continue;
    for(const panel of panels) assert.ok(distance(pose.position,panel) >= .09, `${panel.label} intersects the film at ${seconds.toFixed(2)}s`);
  }
});
test('open interior doors clear the existing room and stair routes', () => {
  for(const node of NODES) for(const link of node.links) {
    const points=[standing(node),...(link.via || []).map(([x,z,y]) => [x,y+EYE,z]),standing(nodeById[link.to])];
    for(let segment=1;segment<points.length;segment++) for(let t=0;t<=1;t+=.01) {
      const point=interpolate(points[segment-1],points[segment],t);
      for(const panel of panels) assert.ok(distance(point,panel) >= .09, `${panel.label} obstructs ${node.id} → ${link.to}`);
    }
  }
});
test('the powder room door preserves the cinematic view of the fixtures', () => {
  for(let seconds=27.65;seconds<30.35;seconds+=.05) {
    const pose=filmPose(seconds);
    // Include the tank behind the camera target: a door can leave the center
    // ray clear while still hiding most of the fixture.
    for(const target of [pose.target,[.09,LEVELS.first.y+.64,-3.63]]) for(let t=0;t<=1;t+=.01) for(const panel of panels) {
      assert.ok(distance(interpolate(pose.position,target,t),panel) > .01, `${panel.label} blocks the powder room at ${seconds.toFixed(2)}s`);
    }
  }
});
