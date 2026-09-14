import * as THREE from 'three';
import {SHELL} from './plan.js';
import {mergeStatic} from './merge.js';

const foot = .3048;
export const DEFAULT_PORCH_EXTENSION = {enabled:false, width:5, length:8, roof:true};
export function porchExtensionOptions(value = {}) {
  const bounded = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value * 2) / 2)) : fallback;
  return {
    enabled:value?.enabled === true,
    width:bounded(value?.width, 5, 4, 6),
    length:bounded(value?.length, 8, 6, 9),
    roof:value?.roof !== false,
  };
}

// A raised return beside the front room. It ends ahead of the lower side entry.
// Independent merged groups preserve the original house when comparing options.
export function createPorchExtension({home, floor, rail, trim, roof, originalRoof, rightShrub, downspout}) {
  const group = new THREE.Group();
  group.name = 'Wraparound porch';
  group.userData.dynamic = true;
  group.visible = false;
  home.add(group);
  let roofGroup, dimensions;
  const roofFinish = roof.clone();
  roofFinish.side = THREE.DoubleSide;
  roofFinish.map = roof.map.clone();
  roofFinish.map.repeat.set(2, 1.5);
  roofFinish.bumpMap = roofFinish.map;
  roofFinish.bumpScale = .006;
  const soffitFinish = trim.clone();
  soffitFinish.side = THREE.DoubleSide;

  function box(w, h, d, x, y, z, material, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function beam(a, b, width, material, parent = group) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const mesh = box(width, delta.length(), width, 0, 0, 0, material, parent);
    mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  function panel(points, material, parent, side = false) {
    const vertices = [], uv = [];
    for (let i = 1; i < points.length - 1; i++) for (const point of [points[0], points[i], points[i + 1]]) {
      vertices.push(...point);
      uv.push(...(side ? [point[2] / 8.8, point[0] / 2.95] : [point[0] / 8.8, point[2] / 2.95]));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  function guard(x1, z1, x2, z2) {
    beam([x1, 1.96, z1], [x2, 1.96, z2], .075, rail);
    beam([x1, 1.20, z1], [x2, 1.20, z2], .065, rail);
    const count = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / .18);
    for (let i = 0; i <= count; i++) box(.035, .72, .035, x1 + (x2 - x1) * i / count, 1.58, z1 + (z2 - z1) * i / count, rail);
  }
  function lattice(x1, z1, x2, z2) {
    const count = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / .23);
    for (let i = 0; i <= count; i++) box(.035, .74, .035, x1 + (x2 - x1) * i / count, .50, z1 + (z2 - z1) * i / count, trim);
    for (const y of [.19, .38, .57, .76]) beam([x1, y, z1], [x2, y, z2], .028, trim);
  }
  function build(options) {
    group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    group.clear();
    const outer = SHELL.x + options.width * foot;
    const back = SHELL.z - options.length * foot;
    const front = SHELL.z + 2.175;
    const frontJoint = SHELL.z - .075;
    dimensions = {outer, back, front};
    // The two slabs meet the existing deck edge exactly, leaving its stairs open.
    box(outer - 4.15, .23, front - frontJoint, (outer + 4.15) / 2, 1, (front + frontJoint) / 2, floor);
    box(outer - SHELL.x - .04, .23, frontJoint - back, (outer + SHELL.x + .04) / 2, 1, (frontJoint + back) / 2, floor);
    box(outer - 4.15, .19, .18, (outer + 4.15) / 2, .98, front + .015, trim);
    box(.16, .19, front - back, outer - .02, .98, (front + back) / 2, trim);
    box(outer - SHELL.x, .19, .14, (outer + SHELL.x) / 2, .98, back + .015, trim);
    const edge = outer - .16, railFront = front - .175, railBack = back + .15;
    guard(3.95, railFront, edge, railFront);
    guard(edge, railFront, edge, railBack);
    guard(SHELL.x + .15, railBack, edge, railBack);
    lattice(4.18, front - .07, outer - .09, front - .07);
    lattice(outer - .09, front - .07, outer - .09, back + .08);
    // Keep the house-side basement window open behind the slatted perimeter.
    for (const z of [railFront, SHELL.z - .15, railBack]) {
      box(.20, 1.03, .20, edge, .515, z, trim);
      box(.29, .13, .29, edge, .065, z, trim);
      box(.18, .96, .18, edge, 1.58, z, rail);
      box(.23, .055, .23, edge, 2.08, z, rail);
    }
    box(.15, .96, .15, SHELL.x + .15, 1.58, railBack, rail);
    mergeStatic(group);

    roofGroup = new THREE.Group();
    roofGroup.name = 'Wraparound porch roof';
    group.add(roofGroup);
    // Replace the complete front canopy with two joined planes and a hip at the
    // corner. This avoids two intersecting roof slabs over the new connection.
    const inner = SHELL.x - .325, roofBack = back - .22, roofFront = SHELL.z + 2.625, roofOuter = outer + .30;
    const high = 4.0385, low = 3.8615;
    const frontPlane = [[-4.4, high, inner], [inner, high, inner], [roofOuter, low, roofFront], [-4.4, low, roofFront]];
    const sidePlane = [[inner, high, roofBack], [roofOuter, low, roofBack], [roofOuter, low, roofFront], [inner, high, inner]];
    for (const points of [frontPlane, sidePlane]) {
      panel(points, roofFinish, roofGroup, points === sidePlane);
      panel(points.map(([x, y, z]) => [x, y - .12, z]), soffitFinish, roofGroup);
    }
    const perimeter = [[-4.4, high, inner], [inner, high, inner], [inner, high, roofBack], [roofOuter, low, roofBack], [roofOuter, low, roofFront], [-4.4, low, roofFront]];
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
      panel([a, b, [b[0], b[1] - .14, b[2]], [a[0], a[1] - .14, a[2]]], soffitFinish, roofGroup);
    }
    beam([inner, high + .022, inner], [roofOuter, low + .022, roofFront], .045, roofFinish, roofGroup);
    for (const z of [railFront, SHELL.z - .15, railBack]) {
      box(.22, 2.7, .22, edge, 2.4, z, rail, roofGroup);
      box(.32, .14, .32, edge, 1.12, z, rail, roofGroup);
      box(.28, .08, .28, edge, 3.71, z, trim, roofGroup);
    }
    // Upper house downspout discharges onto the new canopy; water leaves at its outer corner.
    box(.075, 2.57, .075, 4.12, 5.365, SHELL.z - .15, trim, roofGroup);
    box(.075, 3.70, .075, roofOuter + .015, 1.93, railFront, trim, roofGroup);
    beam([roofOuter + .015, .16, railFront], [roofOuter + .23, .12, railFront], .075, trim, roofGroup);
    mergeStatic(roofGroup);
  }

  let previous = '';
  function update(value, planned) {
    const options = porchExtensionOptions(value);
    const next = `${options.width}:${options.length}`;
    if (previous !== next) { build(options); previous = next; }
    const active = planned && options.enabled;
    group.visible = active;
    roofGroup.visible = options.roof;
    for (const mesh of originalRoof) mesh.visible = !(active && options.roof);
    rightShrub.visible = !active;
    downspout.visible = !(active && options.roof);
    return dimensions;
  }
  return {group, update};
}
