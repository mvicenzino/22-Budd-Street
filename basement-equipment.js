import * as THREE from 'three';
import {mergeStatic} from './merge.js';
import {BASEMENT_PLAN as P} from './basement-plan.js';

// Equipment is schematic: positions follow the owner's description, sizes await a survey.
export function buildBasementEquipment({group, box, mat, steel, proposed = false}) {
  const y = P.floor;
  const named = name => { const g = new THREE.Group(); g.name = name; g.userData.dynamic = true; group.add(g); return g; };
  const boiler = named('Basement boiler'), water = named('Basement water equipment');
  const casing = mat('#596361', {roughness:.46}), dark = mat('#303835', {roughness:.6});
  const copper = mat('#a66d48', {metalness:.65, roughness:.34});
  const tank = mat('#b8c9ca', {metalness:.2, roughness:.45});
  const cylinder = (g, radius, height, x, bottom, z, material) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material);
    o.position.set(x, bottom + height / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o;
  };
  const pipe = (g, from, to, radius, material) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), v = b.clone().sub(a);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, v.length(), 12), material);
    o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.normalize());
    g.add(o); return o;
  };
  box(.76,.07,.96,0,y,0,dark,boiler);
  box(.7,1.0,.9,0,y+.07,0,casing,boiler);
  box(.61,.7,.025,0,y+.22,.463,dark,boiler);
  box(.20,.13,.025,.13,y+.79,.484,steel,boiler);
  for (const x of [-.25,.25]) box(.025,.025,.012,x,y+.3,.484,steel,boiler);
  for (let i=0;i<6;i++) box(.38,.012,.01,-.06,y+.4+i*.044,.485,steel,boiler);
  // Flue and hydronic lines are diagrammatic; their real routing remains subject to HVAC review.
  pipe(boiler,[0,y+1.07,-.20],[0,.77,-.20],.095,steel);
  for(const x of [-.29,.29]) {
    pipe(boiler,[x,y+.98,-.32],[x,.45,-.32],.023,copper);
    pipe(boiler,[x,.45,-.32],[x,.45,-.85],.023,copper);
    cylinder(boiler,.065,.045,x,y+1.28,-.32,dark);
  }
  const [waterX,waterZ] = proposed ? P.water.proposed : P.water.existing;
  water.position.set(waterX,0,waterZ);
  water.rotation.y = proposed ? P.water.proposedRotation : 0;
  // Turn the companion filter along the utility wall, clear of the boiler's front approach.
  const wx=0,wz=0;
  cylinder(water,.24,1.12,wx,y+.07,wz,tank);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.24,24,12),tank);
  cap.scale.y=.3; cap.position.set(wx,y+1.19,wz); water.add(cap);
  box(.40,.08,.40,wx,y,wz,dark,water);
  cylinder(water,.11,.62,wx+.38,y+.64,wz,mat('#d6d7cf'));
  box(.25,.12,.22,wx+.38,y+1.26,wz,dark,water);
  pipe(water,[wx,y+1.23,wz],[wx,.53,wz],.018,copper);
  pipe(water,[wx,.53,wz],[wx+.38,.53,wz],.018,copper);
  pipe(water,[wx+.38,.53,wz],[wx+.38,y+1.38,wz],.018,copper);
  for(const g of [boiler,water]) mergeStatic(g);
}
