// Walkthrough of the house interior: builds every level inside the exterior shell and drives a
// street-view style camera (stand at a node, drag to look, click an arrow to step).
import * as THREE from 'three';
import {INNER, EYE, LEVELS, OPENINGS, PARTITIONS, STAIR, LOFT_STAIR, ROOMS, NODES} from './plan.js';

const $ = s => document.querySelector(s);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const shortest = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
const yawBetween = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
const T = .14; // partition thickness
const F = LEVELS.first, S = LEVELS.second, L = LEVELS.loft;

export function createInterior({scene, camera, renderer, host, controls, doors, glassLower, hemisphere, exteriorPose, onEnter, onExit}) {
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: .88, ...o});
  const paint = mat('#f3efe6'), ceilingPaint = mat('#faf8f3'), trim = mat('#f7f6ed', {roughness: .6});
  const walnut = mat('#7d5b3f', {roughness: .55}), oak = mat('#a88760', {roughness: .6}), fabric = mat('#8f9ca4');
  const cushion = mat('#d8d3c6'), cabinet = mat('#ebe8df', {roughness: .5}), counter = mat('#d6d2c8', {roughness: .35});
  const steel = mat('#b9c0c4', {metalness: .65, roughness: .3}), black = mat('#2b2f31', {roughness: .5});
  const porcelain = mat('#f4f4f1', {roughness: .3}), leaf = mat('#4f7a4a'), rugBlue = mat('#6c7d8a'), rugSand = mat('#c2ad8d');
  const linen = mat('#e9e4d8'), quilt = mat('#7c8b9a'), quiltWarm = mat('#b98c6b'), tile = mat('#e4e6e3', {roughness: .4});
  const carpet = mat('#c9bfae'), slope = mat('#faf8f3', {side: THREE.DoubleSide}), paneGlass = mat('#7f9a9e', {metalness: .2, roughness: .2, transparent: true, opacity: .5});

  const group = new THREE.Group();
  group.name = 'Interior';
  scene.add(group);

  function box(w, h, d, x, yBottom, z, m, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, yBottom + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function beam(a, b, size, m, parent = group) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), d = bv.clone().sub(av);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, d.length(), size), m);
    mesh.position.copy(av.clone().add(bv).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function face(points, m) {
    const g = new THREE.BufferGeometry(), verts = [];
    for (let i = 1; i < points.length - 1; i++) verts.push(...points[0], ...points[i], ...points[i + 1]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // ---- Floors and ceilings -------------------------------------------------------------
  function plankTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#a57f57';
    g.fillRect(0, 0, 1024, 1024);
    const rows = 8, h = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      const tone = 150 + ((r * 37) % 23);
      g.fillStyle = `rgb(${tone + 15},${tone - 25},${tone - 60})`;
      g.fillRect(0, r * h, 1024, h - 4);
      g.fillStyle = 'rgba(70,45,25,.45)';
      g.fillRect(0, r * h + h - 4, 1024, 4);
      g.fillRect((r * 397) % 1024, r * h, 4, h);
      g.strokeStyle = 'rgba(90,60,35,.18)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.lineWidth = 2;
        g.moveTo(0, r * h + 12 + i * 18);
        g.lineTo(1024, r * h + 8 + i * 18 + ((r + i) % 3) * 2);
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 7.5);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const floorMat = new THREE.MeshStandardMaterial({map: plankTexture(), roughness: .55});
  const slabMats = [trim, trim, floorMat, ceilingPaint, trim, trim];
  const W = INNER.x * 2 + .2, D = INNER.z * 2 + .2;
  // A slab spanning the footprint, optionally with a rectangular hole [x0, z0, x1, z1].
  function slab(y0, y1, hole, mats = slabMats) {
    const h = y1 - y0;
    if (!hole) return box(W, h, D, 0, y0, 0, mats);
    const [x0, z0, x1, z1] = hole;
    box(x0 + W / 2, h, D, (x0 - W / 2) / 2, y0, 0, mats);
    box(W / 2 - x1, h, D, (x1 + W / 2) / 2, y0, 0, mats);
    box(x1 - x0, h, D / 2 - z1, (x0 + x1) / 2, y0, (z1 + D / 2) / 2, mats);
    box(x1 - x0, h, z0 + D / 2, (x0 + x1) / 2, y0, (z0 - D / 2) / 2, mats);
  }
  const mainWell = [STAIR.x0, STAIR.upperZ1, STAIR.x1, -.27];
  const loftWell = [LOFT_STAIR.x0, LOFT_STAIR.z1, LOFT_STAIR.x1, LOFT_STAIR.z0];
  slab(F.y - .1, F.y, null);
  slab(F.ceil, S.y, mainWell);
  slab(S.ceil, L.y, loftWell);

  // ---- Walls ---------------------------------------------------------------------------
  function segment(axis, coord, a0, a1, y0, y1, m, thick = T) {
    if (a1 - a0 < .005 || y1 - y0 < .005) return;
    return axis === 'x'
      ? box(a1 - a0, y1 - y0, thick, (a0 + a1) / 2, y0, coord, m)
      : box(thick, y1 - y0, a1 - a0, coord, y0, (a0 + a1) / 2, m);
  }
  const baseboard = (axis, coord, a0, a1, side, floorY) => segment(axis, coord + side * .025, a0, a1, floorY, floorY + .11, trim, .05);
  // Casing on one face of a wall around an opening; `side` is the direction the face looks.
  function casing(axis, faceCoord, side, a0, a1, y0, y1, withSill) {
    const c = faceCoord + side * .02, w = .085;
    segment(axis, c, a0 - w, a0, y0 - (withSill ? 0 : .02), y1 + w, trim, .045);
    segment(axis, c, a1, a1 + w, y0 - (withSill ? 0 : .02), y1 + w, trim, .045);
    segment(axis, c, a0 - w, a1 + w, y1, y1 + w, trim, .045);
    if (withSill) segment(axis, faceCoord + side * .05, a0 - .12, a1 + .12, y0 - .05, y0, trim, .13);
  }
  function wall(axis, coord, c0, c1, openings, sides, floorY, ceilY) {
    const sorted = [...openings].sort((p, q) => p.a0 - q.a0);
    let cursor = c0;
    for (const o of sorted) {
      const head = o.y1 == null ? ceilY : floorY + o.y1;
      segment(axis, coord, cursor, o.a0, floorY, ceilY, paint);
      segment(axis, coord, o.a0, o.a1, head, ceilY, paint);
      if (o.y1 != null) for (const side of sides) casing(axis, coord + side * T / 2, side, o.a0, o.a1, floorY, head, false);
      cursor = o.a1;
    }
    segment(axis, coord, cursor, c1, floorY, ceilY, paint);
    for (const side of sides) {
      let from = c0;
      for (const o of sorted) {
        baseboard(axis, coord + side * T / 2, from, o.a0, side, floorY);
        from = o.a1;
      }
      baseboard(axis, coord + side * T / 2, from, c1, side, floorY);
    }
  }
  for (const p of PARTITIONS) {
    const lv = LEVELS[p.level];
    wall(p.axis, p.coord, p.c0, p.c1, p.openings, [-1, 1], lv.y, lv.ceil);
  }

  // Inside faces of the exterior shell, per level: casings, sills, baseboards.
  const shellFaces = [
    {key: 'front', axis: 'x', face: INNER.z, side: -1},
    {key: 'rear', axis: 'x', face: -INNER.z, side: 1},
    {key: 'left', axis: 'z', face: -INNER.x, side: 1},
    {key: 'right', axis: 'z', face: INNER.x, side: -1},
  ];
  for (const lv of [F, S]) for (const f of shellFaces) {
    const limit = f.axis === 'x' ? INNER.x : INNER.z;
    const ops = OPENINGS[f.key].filter(o => o.y1 > lv.y && o.y0 < lv.ceil);
    for (const o of ops) casing(f.axis, f.face, f.side, o.a0, o.a1, o.kind === 'door' ? lv.y : o.y0, o.y1, o.kind === 'window');
    let from = -limit;
    for (const o of ops.filter(o => o.kind === 'door').sort((p, q) => p.a0 - q.a0)) {
      baseboard(f.axis, f.face, from, o.a0, f.side, lv.y);
      from = o.a1;
    }
    baseboard(f.axis, f.face, from, limit, f.side, lv.y);
  }

  // ---- Loft: knee walls, sloped ceiling, gable ends with the small gable windows -------------
  {
    const kx = L.kneeX, y0 = L.y, top = L.kneeTop, ridge = L.ceil, zi = INNER.z - .05;
    for (const s of [-1, 1]) {
      box(.12, top - y0, zi * 2, s * kx, y0, 0, paint);
      face(s < 0
        ? [[-kx, top, zi], [0, ridge, zi], [0, ridge, -zi], [-kx, top, -zi]]
        : [[kx, top, -zi], [0, ridge, -zi], [0, ridge, zi], [kx, top, zi]], slope).receiveShadow = false;
    }
    for (const s of [-1, 1]) {
      const z = s * zi, pts = [[-kx, y0, z], [-kx, top, z], [0, ridge, z], [kx, top, z], [kx, y0, z]];
      face(s > 0 ? pts : pts.slice().reverse(), slope).receiveShadow = false;
      for (const x of [-.47, .47]) {
        const w = .72, h = 1.1, y = 8.15, zz = z - s * .06;
        for (const yy of [y + h / 2 + .04, y - h / 2 - .04]) box(w + .16, .08, .06, x, yy - .04, zz, trim);
        for (const xx of [x - w / 2 - .04, x + w / 2 + .04]) box(.08, h, .06, xx, y - h / 2, zz, trim);
        box(w, h, .02, x, y - h / 2, zz, paneGlass);
        box(.03, h, .03, x, y - h / 2, zz - s * .02, trim);
        box(w, .03, .03, x, y - .015, zz - s * .02, trim);
        box(w + .24, .05, .14, x, y - h / 2 - .05, zz - s * .04, trim);
      }
    }
    box(kx * 2, .02, zi * 2, 0, y0, 0, carpet).receiveShadow = false;
  }

  // ---- Stairs ---------------------------------------------------------------------------
  function railing(x, z0, z1, y, m = walnut) {
    box(.09, 1.02, .09, x, y, z0, m);
    box(.09, 1.02, .09, x, y, z1, m);
    beam([x, y + .92, z0], [x, y + .92, z1], .06, m);
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / .18));
    for (let i = 1; i < n; i++) box(.03, .86, .03, x, y, z0 + (z1 - z0) * i / n, trim);
  }
  // A straight flight rising toward -z; solid below each tread down to `base`.
  function flight(x0, x1, zStart, zEnd, yStart, yEnd, steps, base, railSide) {
    const w = x1 - x0, cx = (x0 + x1) / 2, run = (zStart - zEnd) / steps, rise = (yEnd - yStart) / steps;
    for (let i = 0; i < steps; i++) {
      const z = zStart - run / 2 - i * run, top = yStart + (i + 1) * rise;
      box(w, top - base, run, cx, base, z, oak);
      box(w, .035, run + .04, cx, top, z - .02, walnut);
    }
    if (railSide) {
      const rx = railSide < 0 ? x0 - .03 : x1 + .03;
      box(.09, 1.02, .09, rx, yStart, zStart + .05, walnut);
      beam([rx, yStart + .92, zStart + .05], [rx, yEnd + .92, zEnd], .06, walnut);
      for (let i = 0; i < steps; i++) box(.03, .86, .03, rx, yStart + (i + 1) * rise, zStart - run / 2 - i * run, trim);
    }
  }
  // Main stair: lower flight, landing, upper flight, with rails on the open hallway side.
  flight(STAIR.x0, STAIR.x1, STAIR.lowerZ0, STAIR.lowerZ1, F.y, STAIR.landingY, 7, F.y, -1);
  box(STAIR.x1 - STAIR.x0, STAIR.landingY - F.y, STAIR.lowerZ1 - STAIR.landingZ1, (STAIR.x0 + STAIR.x1) / 2, F.y, (STAIR.lowerZ1 + STAIR.landingZ1) / 2, oak);
  box(STAIR.x1 - STAIR.x0, .035, STAIR.lowerZ1 - STAIR.landingZ1, (STAIR.x0 + STAIR.x1) / 2, STAIR.landingY, (STAIR.lowerZ1 + STAIR.landingZ1) / 2, walnut);
  railing(STAIR.x0 - .03, STAIR.lowerZ1, STAIR.landingZ1 + .05, STAIR.landingY);
  flight(STAIR.x0, STAIR.x1, STAIR.landingZ1, STAIR.upperZ1, STAIR.landingY, S.y, 10, STAIR.landingY, 0);
  railing(STAIR.x0 - .03, -.27 - .05, STAIR.upperZ1 + .35, S.y); // second-floor guard along the well
  // Loft stair: steep attic flight from the front-right bedroom, guarded in the loft.
  flight(LOFT_STAIR.x0, LOFT_STAIR.x1, LOFT_STAIR.z0, LOFT_STAIR.z1, S.y, L.y, 13, S.y, -1);
  railing(LOFT_STAIR.x0 - .03, LOFT_STAIR.z0 + .05, LOFT_STAIR.z1 + .35, L.y);
  railing(LOFT_STAIR.x1 + .03, LOFT_STAIR.z0 + .05, LOFT_STAIR.z1 + .35, L.y);
  beam([LOFT_STAIR.x0 - .03, L.y + .92, LOFT_STAIR.z0 + .05], [LOFT_STAIR.x1 + .03, L.y + .92, LOFT_STAIR.z0 + .05], .06, walnut);

  // ---- Furnishings (conceptual) -------------------------------------------------------
  function sofa(x, z, len, angle, y = F.y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    group.add(g);
    box(len, .42, .9, 0, 0, 0, fabric, g);
    box(len, .5, .22, 0, .3, -.34, fabric, g);
    for (const s of [-1, 1]) box(.2, .3, .9, s * (len / 2 - .1), .42, 0, fabric, g);
    const n = Math.round(len / .8);
    for (let i = 0; i < n; i++) box(len / n - .06, .16, .62, -len / 2 + .1 + (i + .5) * (len - .2) / n, .42, .08, cushion, g);
  }
  function chair(x, z, angle, y = F.y, m = walnut) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    group.add(g);
    for (const sx of [-.19, .19]) for (const sz of [-.19, .19]) box(.035, .44, .035, sx, 0, sz, m, g);
    box(.44, .04, .44, 0, .44, 0, m, g);
    box(.42, .48, .035, 0, .48, -.2, m, g);
  }
  function armchair(x, z, angle, y = F.y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    group.add(g);
    box(.85, .4, .85, 0, 0, 0, fabric, g);
    box(.85, .48, .2, 0, .3, -.32, fabric, g);
    for (const s of [-1, 1]) box(.16, .26, .8, s * .34, .4, 0, fabric, g);
    box(.5, .14, .58, 0, .4, .06, cushion, g);
  }
  function lamp(x, z, y = F.y) {
    box(.3, .03, .3, x, y, z, black);
    box(.03, 1.5, .03, x, y, z, black);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, .3, 20, 1, true), mat('#efe8d8', {side: THREE.DoubleSide}));
    shade.position.set(x, y + 1.6, z);
    group.add(shade);
  }
  function plant(x, z, y = F.y) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .32, 14), mat('#b4a48d'));
    pot.position.set(x, y + .16, z);
    pot.castShadow = true;
    group.add(pot);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 1), leaf);
      const a = i * 1.1;
      l.position.set(x + Math.cos(a) * .17, y + .5 + (i % 3) * .14, z + Math.sin(a) * .17);
      l.scale.set(1, .6, 1);
      group.add(l);
    }
  }
  // Bed inside [x0,z0,x1,z1]; `head` is the wall side the headboard is on: 'x-', 'x+', 'z-' or 'z+'.
  function bed(x0, z0, x1, z1, head, cover, y = S.y) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const alongX = head[0] === 'x', sign = head[1] === '-' ? 1 : -1; // pillows sit next to the headboard
    box(w - .1, .3, d - .1, cx, y, cz, walnut);
    box(w, .22, d, cx, y + .3, cz, linen);
    box(alongX ? w - .9 : w - .16, .12, alongX ? d - .16 : d - .9, cx + (alongX ? sign * .35 : 0), y + .52, cz + (alongX ? 0 : sign * .35), cover);
    const hx = alongX ? (sign > 0 ? x0 + .04 : x1 - .04) : cx, hz = alongX ? cz : (sign > 0 ? z0 + .04 : z1 - .04);
    box(alongX ? .08 : w, 1.1, alongX ? d : .08, hx, y, hz, walnut);
    for (const s of [-1, 1]) {
      const px = alongX ? hx + sign * .32 : cx + s * (w / 2 - .3);
      const pz = alongX ? cz + s * (d / 2 - .3) : hz + sign * .32;
      box(alongX ? .45 : .5, .14, alongX ? .5 : .45, px, y + .52, pz, linen);
    }
  }
  function nightstand(x, z, y = S.y) {
    box(.45, .55, .42, x, y, z, walnut);
    box(.18, .02, .18, x, y + .55, z, black);
    box(.03, .28, .03, x, y + .57, z, black);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, .16, 16, 1, true), mat('#efe8d8', {side: THREE.DoubleSide}));
    shade.position.set(x, y + .95, z);
    group.add(shade);
  }
  function dresser(x, z, w, d, y = S.y, angle = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    group.add(g);
    box(w, .95, d, 0, 0, 0, walnut, g);
    for (let i = 0; i < 3; i++) box(w - .12, .02, .02, 0, .18 + i * .28, d / 2 + .01, trim, g);
  }
  function toilet(x, z, y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    group.add(g);
    box(.38, .4, .5, 0, 0, 0, porcelain, g);
    box(.34, .5, .18, 0, .4, -.18, porcelain, g);
    box(.42, .04, .5, 0, .4, .02, porcelain, g);
  }

  // First floor: living room. Sectional along the street-facing wall under the front windows with a
  // chaise on the left end, and the large TV on the dining-room wall opposite.
  {
    const cream = mat('#cbc2b1', {roughness: .95}), pillow = mat('#a9b2a8', {roughness: .95}), rug = mat('#d3cbbb', {roughness: .95});
    const rustic = mat('#7a6650', {roughness: .7});
    box(3.6, .02, 2.9, -1.6, F.y, 1.9, rug);
    const seat = (x0, z0, x1, z1, backSide) => {
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(w, .4, d, cx, F.y, cz, cream);
      box(w - .04, .14, d - .3, cx, F.y + .4, cz + (backSide === 'z+' ? -.14 : 0), cream);
      if (backSide === 'z+') box(w, .5, .24, cx, F.y + .32, z1 - .12, cream);
      if (backSide === 'x-') box(.24, .5, d, x0 + .12, F.y + .32, cz, cream);
    };
    seat(-3.55, 3, -.35, 3.95, 'z+');                       // main run against the front wall
    box(.22, .3, .95, -.35 - .11, F.y + .4, 3.47, cream);   // right arm
    seat(-3.55, 2, -2.6, 3, 'x-');                          // chaise turning into the room
    box(.95, .3, .22, -3.07, F.y + .4, 2.0 + .11, cream);   // chaise end
    for (const x of [-3.05, -2.2, -1.3, -.6]) box(.5, .42, .14, x, F.y + .55, 3.8, pillow);
    box(.5, .42, .14, -3.35, F.y + .55, 2.5, pillow);
    box(1.1, .12, 1.1, -1.2, F.y + .34, 1.5, rustic);      // square coffee table
    box(1.0, .34, 1.0, -1.2, F.y, 1.5, rustic);
    box(1.8, .5, .42, .3, F.y, -.09, rustic);               // media console on the dining-room wall
    box(1.6, .92, .04, .3, F.y + 1.05, -.12, black);        // large TV
    box(1.2, .06, .1, .3, F.y + .52, -.1, black);           // soundbar
    lamp(1.5, 3.5);
    plant(-3.35, .3);
    {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .16, 24, 1, true), mat('#efe6d3', {side: THREE.DoubleSide}));
      drum.position.set(-1.2, F.ceil - .2, 1.8);
      group.add(drum);
    }
  }
  // Hallway
  box(.85, .02, 2.4, 2.45, F.y, 2.7, rugSand);
  box(.3, .8, .95, 2.15, F.y, .6, walnut);
  box(.03, .7, .7, 2.02, F.y + 1.15, .6, steel);
  // Dining room
  box(2.6, .02, 2.2, -2.3, F.y, -2.6, rugSand);
  box(1.7, .05, .95, -2.3, F.y + .72, -2.6, walnut);
  for (const sx of [-.72, .72]) for (const sz of [-.35, .35]) box(.06, .72, .06, -2.3 + sx, F.y, -2.6 + sz, walnut);
  for (const x of [-2.75, -1.85]) {
    chair(x, -1.95, Math.PI);
    chair(x, -3.25, 0);
  }
  plant(-3.35, -3.55);
  box(.01, .95, .01, -2.3, F.ceil - .95, -2.6, black);
  {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, .24, 24, 1, true), mat('#3a3f42', {side: THREE.DoubleSide}));
    shade.position.set(-2.3, F.ceil - 1.05, -2.6);
    group.add(shade);
  }
  // Kitchen, from the floor plan and photos: white cabinets and appliances, navy counters, beadboard
  // backsplash, black-and-white checkerboard floor. The fridge sits in an alcove on the dining-room wall
  // beside the dining entrance. Along the rear wall: counter, range, dishwasher, then the sink under the
  // rear window; the counter turns the corner along the driveway wall.
  {
    const appliance = mat('#fafbfa', {roughness: .35, metalness: .08}), navy = mat('#27325f', {roughness: .3}), grate = mat('#2a2c2e', {roughness: .7});
    const ovenGlass = mat('#3a4247', {metalness: .3, roughness: .25}), knob = mat('#e8e7e2', {roughness: .5});
    const rear = -INNER.z, right = INNER.x, depth = .6, h = .9, upperBottom = 1.5, upperTop = 2.4, upperDepth = .33;
    const kx0 = .35, sideEnd = -2.3; // counters start at the powder room wall; the side run stops at the stair enclosure
    // Floor: diagonal checkerboard tile over the kitchen footprint.
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileCanvas.height = 256;
    const tg = tileCanvas.getContext('2d');
    tg.fillStyle = '#ebe7dc';
    tg.fillRect(0, 0, 256, 256);
    tg.fillStyle = '#1d1d1f';
    tg.fillRect(0, 0, 128, 128);
    tg.fillRect(128, 128, 128, 128);
    const tile = new THREE.CanvasTexture(tileCanvas);
    tile.colorSpace = THREE.SRGBColorSpace;
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    tile.center.set(.5, .5);
    tile.rotation = Math.PI / 4;
    tile.repeat.set((right + .33) / .6, (INNER.z - .38) / .6);
    tile.anisotropy = renderer.capabilities.getMaxAnisotropy();
    box(right + .33, .012, INNER.z - .38, (right - .33) / 2, F.y, (rear - .38) / 2, new THREE.MeshStandardMaterial({map: tile, roughness: .35})).castShadow = false;
    // Beadboard backsplash between the counter and the uppers.
    const beadCanvas = document.createElement('canvas');
    beadCanvas.width = 256;
    beadCanvas.height = 64;
    const bg = beadCanvas.getContext('2d');
    bg.fillStyle = '#f4f2ea';
    bg.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 32) {
      bg.fillStyle = 'rgba(0,0,0,.14)';
      bg.fillRect(x, 0, 3, 64);
      bg.fillStyle = 'rgba(255,255,255,.7)';
      bg.fillRect(x + 3, 0, 2, 64);
    }
    const bead = new THREE.CanvasTexture(beadCanvas);
    bead.colorSpace = THREE.SRGBColorSpace;
    bead.wrapS = bead.wrapT = THREE.RepeatWrapping;
    const beadboard = len => new THREE.MeshStandardMaterial({map: (() => { const t = bead.clone(); t.repeat.set(len / .32, 1); t.needsUpdate = true; return t; })(), roughness: .6});
    const winX = [2.35, 3.25], sill = 2.15 - F.y; // rear window over the sink, in floor-relative height
    box(winX[0] - kx0, upperBottom - h, .02, (kx0 + winX[0]) / 2, F.y + h, rear + .01, beadboard(winX[0] - kx0));
    box(right - winX[1], upperBottom - h, .02, (winX[1] + right) / 2, F.y + h, rear + .01, beadboard(right - winX[1]));
    box(winX[1] - winX[0], sill - h, .02, (winX[0] + winX[1]) / 2, F.y + h, rear + .01, beadboard(winX[1] - winX[0]));
    box(.02, upperBottom - h, sideEnd - rear, right - .01, F.y + h, (rear + sideEnd) / 2, beadboard(sideEnd - rear));
    // Base run along the rear wall, split into the fridge bay, range, dishwasher and sink base.
    const rangeX = [1, 1.76], dishX = [1.76, 2.36], sinkX = [2.36, 3.26];
    const baseCab = (x0, x1) => {
      box(x1 - x0, h - .1, depth, (x0 + x1) / 2, F.y + .1, rear + depth / 2, cabinet);
      box(x1 - x0, .1, depth - .08, (x0 + x1) / 2, F.y, rear + depth / 2 + .04, grate);
      box(.02, .02, .02, (x0 + x1) / 2, F.y + .62, rear + depth + .01, knob);
    };
    baseCab(kx0, rangeX[0]);
    baseCab(sinkX[0], sinkX[1]);
    baseCab(sinkX[1], right);
    box(right - rangeX[1] + .02, .04, depth + .03, (rangeX[1] + right) / 2, F.y + h, rear + depth / 2 + .015, navy);
    box(rangeX[0] - kx0 + .02, .04, depth + .03, (kx0 + rangeX[0]) / 2, F.y + h, rear + depth / 2 + .015, navy);
    // Side run along the driveway wall with the microwave.
    box(depth, h - .1, sideEnd - rear - depth, right - depth / 2, F.y + .1, (rear + depth + sideEnd) / 2, cabinet);
    box(depth - .08, .1, sideEnd - rear - depth, right - depth / 2 - .04, F.y, (rear + depth + sideEnd) / 2, grate);
    box(depth + .03, .04, sideEnd - rear - depth + .02, right - depth / 2 - .015, F.y + h, (rear + depth + sideEnd) / 2, navy);
    for (const z of [-3.0, -2.6]) box(.02, .02, .02, right - depth - .01, F.y + .62, z, knob);
    box(.5, .3, .38, right - .3, F.y + h + .04, -2.75, appliance);
    box(.36, .2, .01, right - .55, F.y + h + .09, -2.75, ovenGlass);
    // Sink under the rear window.
    box(.56, .18, .42, (sinkX[0] + sinkX[1]) / 2, F.y + h - .14, rear + depth / 2, porcelain);
    box(.44, .14, .32, (sinkX[0] + sinkX[1]) / 2, F.y + h - .1, rear + depth / 2, mat('#e3e5e2', {roughness: .3}));
    box(.02, .22, .02, (sinkX[0] + sinkX[1]) / 2, F.y + h + .04, rear + .12, steel);
    box(.02, .02, .18, (sinkX[0] + sinkX[1]) / 2, F.y + h + .25, rear + .2, steel);
    // Dishwasher: white front with a control strip.
    box(dishX[1] - dishX[0] - .02, h - .04, depth, (dishX[0] + dishX[1]) / 2, F.y + .02, rear + depth / 2, appliance);
    box(dishX[1] - dishX[0] - .1, .05, .01, (dishX[0] + dishX[1]) / 2, F.y + h - .1, rear + depth + .005, grate);
    box(dishX[1] - dishX[0] - .02, .04, depth + .03, (dishX[0] + dishX[1]) / 2, F.y + h, rear + depth / 2 + .015, navy);
    // Four-burner range next to the fridge bay.
    const rx = (rangeX[0] + rangeX[1]) / 2, rw = rangeX[1] - rangeX[0];
    box(rw, h + .02, depth + .05, rx, F.y, rear + depth / 2 + .02, appliance);
    box(rw - .04, .02, depth - .08, rx, F.y + h + .02, rear + depth / 2 + .02, grate);
    for (const dx of [-.19, .19]) for (const dz of [-.14, .14]) {
      box(.2, .012, .2, rx + dx, F.y + h + .04, rear + depth / 2 + .02 + dz, grate);
      box(.07, .008, .07, rx + dx, F.y + h + .052, rear + depth / 2 + .02 + dz, black);
    }
    box(rw, .16, .08, rx, F.y + h + .02, rear + .05, appliance);
    box(.3, .06, .01, rx, F.y + h + .07, rear + .095, ovenGlass);
    box(rw - .16, .34, .01, rx, F.y + .28, rear + depth + .06, ovenGlass);
    box(rw - .1, .03, .04, rx, F.y + .7, rear + depth + .07, knob);
    for (let i = 0; i < 4; i++) box(.045, .045, .03, rangeX[0] + .12 + i * .17, F.y + .78, rear + depth + .07, knob);
    // Refrigerator in its alcove on the dining-room wall, facing the kitchen, cabinet and soffit above.
    const aZ = [-2.9, -2.15], aX = .5, az = (aZ[0] + aZ[1]) / 2;
    box(.72, 1.7, aZ[1] - aZ[0] - .06, -.33 + .38, F.y, az, appliance);
    box(.01, .01, aZ[1] - aZ[0] - .1, -.33 + .745, F.y + 1.2, az, grate);
    for (const y of [.55, 1.35]) box(.025, .32, .025, -.33 + .76, F.y + y, aZ[1] - .1, knob);
    box(aX + .33, upperTop - 1.8, aZ[1] - aZ[0] - .02, (aX - .33) / 2, F.y + 1.8, az, cabinet);
    box(.02, .02, .02, aX + .01, F.y + 1.9, az, knob);
    box(aX + .33, F.ceil - F.y - upperTop, aZ[1] - aZ[0] + .1, (aX - .33) / 2, F.y + upperTop, az, paint);
    box(.06, F.ceil - F.y - upperTop, aZ[1] - aZ[0] + .16, aX + .01, F.y + upperTop, az, trim);
    // Upper cabinets: over the range (with a hood), beside the window, and along the driveway wall.
    const upper = (x0, x1, y0 = upperBottom) => {
      box(x1 - x0, upperTop - y0, upperDepth, (x0 + x1) / 2, F.y + y0, rear + upperDepth / 2, cabinet);
      box(.005, upperTop - y0 - .08, .01, (x0 + x1) / 2, F.y + y0 + .04, rear + upperDepth + .003, mat('#d9d6cc'));
      for (const dx of [-.06, .06]) box(.02, .02, .02, (x0 + x1) / 2 + dx, F.y + y0 + .1, rear + upperDepth + .01, knob);
    };
    upper(kx0, rangeX[0]);
    upper(rangeX[0], rangeX[1], 1.75);
    box(rangeX[1] - rangeX[0], .12, upperDepth + .1, rx, F.y + 1.62, rear + (upperDepth + .1) / 2, appliance);
    upper(rangeX[1], 2.33);
    upper(3.27, right);
    box(upperDepth, upperTop - upperBottom, sideEnd - rear - upperDepth, right - upperDepth / 2, F.y + upperBottom, (rear + upperDepth + sideEnd) / 2, cabinet);
    for (const z of [-3.5, -2.85]) for (const dz of [-.06, .06]) box(.02, .02, .02, right - upperDepth - .01, F.y + upperBottom + .1, z + dz, knob);
    box(right - kx0, .06, upperDepth + .02, (right + kx0) / 2, F.y + upperTop, rear + upperDepth / 2, cabinet); // crown
  }
  toilet(.0, -3.5, F.y); // powder room, entered from the dining room

  // Second floor: back bedroom
  box(2.4, .02, 2.6, -2.2, S.y, -2.3, rugSand);
  bed(-3.65, -3.9, -2.05, -1.9, 'x-', quilt);
  nightstand(-3.4, -1.6);
  dresser(-1.4, -3.65, 1.1, .5);
  // Front bedroom left, with its two closets
  box(2.6, .02, 2.4, -2.3, S.y, 2.5, rugBlue);
  bed(-3.65, 1.5, -1.65, 3.1, 'x-', quiltWarm);
  nightstand(-3.4, 3.4);
  nightstand(-3.4, 1.2);
  dresser(.6, 3.1, 1.1, .5, S.y, Math.PI / 2);
  for (const x of [-2.9, -.9]) beam([x - .45, S.y + 1.7, .3], [x + .45, S.y + 1.7, .3], .03, steel);
  // Front bedroom right
  box(2.2, .02, 2.2, 2.6, S.y, 2.8, rugSand);
  bed(1.65, 2.3, 3.65, 3.8, 'x+', quilt);
  nightstand(3.4, 2);
  dresser(1.15, 3.6, 1, .45, S.y, 0);
  // Hall bathroom
  box(1.75, .02, 1.5, 2.8, S.y, -3.15, tile);
  box(.7, .55, 1.45, 2.25, S.y, -3.2, porcelain);
  box(.56, .02, 1.3, 2.25, S.y + .55, -3.2, mat('#d5e4e8', {roughness: .2}));
  box(.03, .5, .03, 2.25, S.y + .55, -3.85, steel);
  toilet(3.35, -3.6, S.y);
  box(.5, .82, .5, 3.4, S.y, -2.8, cabinet);
  box(.52, .04, .52, 3.4, S.y + .82, -2.8, counter);
  box(.03, .55, .5, 3.68, S.y + 1.2, -2.8, steel);
  // Upstairs hall and closets
  box(.85, .02, 2, 1.6, S.y, -1.35, rugSand);
  plant(-.05, .4, S.y);
  for (const x of [.6, 1.3]) beam([x - .3, S.y + 1.7, -3.2], [x + .3, S.y + 1.7, -3.2], .03, steel);
  // Loft
  box(1.9, .02, 1.6, -.5, L.y + .02, 2.4, rugBlue); // sits on the carpet
  bed(-1.6, -3.85, .1, -1.85, 'z-', quiltWarm, L.y);
  nightstand(.5, -3.55, L.y);
  box(1.1, .04, .55, -.9, L.y + .72, 3.45, walnut);
  for (const sx of [-.5, .5]) for (const sz of [-.22, .22]) box(.04, .72, .04, -.9 + sx, L.y, 3.45 + sz, walnut);
  chair(-.9, 2.85, Math.PI, L.y);
  lamp(-1.7, 1, L.y);

  // Warm room lights plus a soft fill; only meaningful once the camera is inside.
  const lights = [];
  const addLight = (x, y, z, max) => {
    const l = new THREE.PointLight('#ffe0bd', 0, 10, 2);
    l.position.set(x, y, z);
    l.userData.max = max;
    group.add(l);
    lights.push(l);
  };
  for (const [x, z] of [[2.7, 2.2], [-1.2, 1.6], [-2.3, -2.6], [1.6, -2.2]]) addLight(x, F.ceil - .3, z, 22);
  for (const [x, z] of [[1.5, -1.4], [-1.9, -2.1], [-1.4, 2.3], [2.4, 1.9], [2.8, -3.1]]) addLight(x, S.ceil - .3, z, 13);
  addLight(-.4, L.y + 2.1, 0, 18);
  const fill = new THREE.AmbientLight('#fff4e6', 0);
  fill.userData.max = .6;
  group.add(fill);
  lights.push(fill);

  // ---- Navigation graph --------------------------------------------------------------
  const roomById = Object.fromEntries(ROOMS.map(r => [r.id, r]));
  const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]));
  const floorOf = n => n.floor ?? LEVELS[roomById[n.room].level].y;
  const levelOf = n => roomById[n.room].level;
  const roomName = n => roomById[n.room].name;
  function pathTo(fromId, toId) {
    const prev = {[fromId]: null}, queue = [fromId];
    while (queue.length) {
      const id = queue.shift();
      if (id === toId) break;
      for (const l of nodeById[id].links) if (!(l.to in prev)) { prev[l.to] = id; queue.push(l.to); }
    }
    if (!(toId in prev)) return [];
    const path = [];
    for (let id = toId; prev[id] !== null; id = prev[id]) path.unshift(nodeById[prev[id]].links.find(l => l.to === id));
    return path;
  }

  // ---- Arrows and labels -------------------------------------------------------------
  const arrowShape = new THREE.Shape([[0, .3], [.3, -.03], [.14, -.03], [.14, -.3], [-.14, -.3], [-.14, -.03], [-.3, -.03]].map(p => new THREE.Vector2(...p)));
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  arrowGeo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(.38, .46, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: .9, depthWrite: false});
  const ringMat = new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: .55, depthWrite: false});
  const arrows = new THREE.Group();
  arrows.visible = false;
  scene.add(arrows);
  const hotspots = $('#hotspots');
  let arrowItems = [];

  function placeArrows(node) {
    arrows.clear();
    hotspots.replaceChildren();
    arrowItems = node.links.map(link => {
      const to = nodeById[link.to];
      const first = link.via ? {x: link.via[0][0], z: link.via[0][1]} : to;
      const dx = first.x - node.x, dz = first.z - node.z, dist = Math.hypot(dx, dz), reach = Math.min(2.1, Math.max(.9, dist * .55));
      const g = new THREE.Group();
      g.position.set(node.x + dx / dist * reach, floorOf(node) + .02, node.z + dz / dist * reach);
      g.rotation.y = yawBetween(node, first);
      const a = new THREE.Mesh(arrowGeo, arrowMat), r = new THREE.Mesh(ringGeo, ringMat);
      a.renderOrder = r.renderOrder = 5;
      g.add(a, r);
      arrows.add(g);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'hotspot';
      label.textContent = link.label || roomName(to);
      label.onclick = () => walkTo(to.id);
      hotspots.append(label);
      return {link, g, label};
    });
  }
  function projectLabels() {
    const v = new THREE.Vector3(), w = host.clientWidth, h = host.clientHeight;
    for (const item of arrowItems) {
      v.copy(item.g.position).setY(item.g.position.y + .75).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      item.label.hidden = !visible;
      if (visible) item.label.style.transform = `translate(calc(${(v.x + 1) / 2 * w}px - 50%), calc(${(1 - v.y) / 2 * h}px - 50%))`;
    }
  }

  // ---- Minimap: one map per level, showing the current level -----------------------------
  const minimap = $('#minimap');
  const K = 14, mapX = x => (x + 5) * K, mapZ = z => (z + 8.5) * K;
  minimap.setAttribute('viewBox', `0 0 ${10 * K} ${16 * K}`);
  const svg = (tag, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const shortName = name => name.replace('Front bedroom ', 'Bed ').replace('Back bedroom', 'Back bed').replace('Loft bedroom', 'Loft')
    .replace(' room', '').replace('Upstairs ', '').replace('Hall bathroom', 'Bath').replace('Screened porch', 'Porch').replace('Front porch', 'Porch');
  const roomShapes = {}, levelLayers = {};
  for (const key of Object.keys(LEVELS)) {
    const layer = svg('g', {class: 'map-level', display: 'none'});
    minimap.append(layer);
    levelLayers[key] = layer;
    const title = svg('text', {x: 5 * K, y: 12, class: 'map-title'});
    title.textContent = LEVELS[key].name;
    layer.append(title);
    for (const r of ROOMS.filter(r => r.level === key)) {
      const [x0, z0, x1, z1] = r.rect;
      const rect = svg('rect', {x: mapX(x0), y: mapZ(z0), width: (x1 - x0) * K, height: (z1 - z0) * K, class: 'map-room' + (r.outside ? ' map-outside' : '') + (r.minor ? ' map-minor' : '')});
      layer.append(rect);
      roomShapes[r.id] = rect;
      if (r.minor) continue;
      const t = svg('text', {x: mapX((x0 + x1) / 2), y: mapZ((z0 + z1) / 2) + 3, class: 'map-label'});
      t.textContent = shortName(r.name);
      layer.append(t);
    }
    for (const n of NODES.filter(n => levelOf(n) === key)) layer.append(svg('circle', {cx: mapX(n.x), cy: mapZ(n.z), r: 2.2, class: 'map-node'}));
  }
  const cone = svg('path', {d: 'M0 0 L-9 -17 A19 19 0 0 1 9 -17 Z', class: 'map-cone'});
  const you = svg('circle', {cx: 0, cy: 0, r: 3.2, class: 'map-you'});
  const youGroup = svg('g', {});
  youGroup.append(cone, you);
  minimap.append(youGroup);
  function updateMinimap() {
    youGroup.setAttribute('transform', `translate(${mapX(camera.position.x)} ${mapZ(camera.position.z)}) rotate(${-yaw * 180 / Math.PI})`);
  }
  function showLevel(key) {
    for (const [k, layer] of Object.entries(levelLayers)) layer.setAttribute('display', k === key ? 'inline' : 'none');
  }
  function markRoom(id) {
    for (const [rid, el] of Object.entries(roomShapes)) el.classList.toggle('map-current', rid === id);
  }

  // ---- Camera state and input --------------------------------------------------------
  let state = 'outside', current = null, yaw = 0, pitch = 0, fov = 62;
  const queue = [];
  const tween = (duration, step, done) => queue.push({duration, step, done, t: 0});
  const applyLook = () => { camera.rotation.set(pitch, yaw, 0, 'YXZ'); };
  const busy = () => queue.length > 0;

  const doorState = {front: 0, rear: 0};
  function setDoor(name, k) {
    const d = doors[name];
    if (d) d.rotation.y = 1.75 * k;
  }
  // One straight move between two eye positions, turning to face the direction of travel first.
  function moveSegment(from, dest, duration, door) {
    const dx = dest.x - from.x, dz = dest.z - from.z, dy = dest.y - from.y, flat = Math.hypot(dx, dz);
    const needsDoor = door && doorState[door] < 1;
    const doorStart = needsDoor ? doorState[door] : 1, hold = needsDoor ? .5 : 0;
    const total = duration + hold;
    let startYaw, startPitch, targetYaw, targetPitch;
    tween(total, (_, raw) => {
      if (startYaw === undefined) {
        startYaw = yaw;
        startPitch = pitch;
        targetYaw = flat > .05 ? shortest(yaw, Math.atan2(-dx, -dz)) : yaw;
        targetPitch = Math.atan2(dy, Math.max(flat, .3)) * .55;
      }
      const time = raw * total;
      if (needsDoor) {
        doorState[door] = Math.min(1, doorStart + time / .8);
        setDoor(door, ease(doorState[door]));
      }
      const move = ease(Math.min(1, Math.max(0, (time - hold) / duration)));
      const turn = ease(Math.min(1, time / .5));
      yaw = lerp(startYaw, targetYaw, turn);
      pitch = lerp(startPitch, targetPitch, turn);
      camera.position.set(lerp(from.x, dest.x, move), lerp(from.y, dest.y, move), lerp(from.z, dest.z, move));
      applyLook();
    });
  }
  // A trip along one link: straight, or through the link's waypoints (stairs).
  function travel(link, fromNode, pace = 1) {
    const to = nodeById[link.to];
    const points = [{x: fromNode.x, y: floorOf(fromNode) + EYE, z: fromNode.z}];
    for (const [x, z, floorY] of link.via || []) points.push({x, y: floorY + EYE, z});
    points.push({x: to.x, y: floorOf(to) + EYE, z: to.z});
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      moveSegment(a, b, Math.min(2.4, Math.max(.7, len * .45)) * pace, i === 1 ? link.door : null);
    }
    queue[queue.length - 1].done = () => arrive(to);
  }
  function arrive(node) {
    current = node;
    yaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    markRoom(node.room);
    showLevel(levelOf(node));
    if (state !== 'inside' || busy()) return;
    const targetYaw = node.look ? shortest(yaw, yawBetween(node, {x: node.look[0], z: node.look[1]})) : yaw;
    const startYaw = yaw, startPitch = pitch, targetPitch = -.12;
    tween(Math.abs(targetYaw - startYaw) > .05 ? .8 : .3, t => {
      yaw = lerp(startYaw, targetYaw, t);
      pitch = lerp(startPitch, targetPitch, t);
      applyLook();
    }, () => settle(node));
  }
  function settle(node) {
    placeArrows(node);
    arrows.visible = true;
    $('#viewname').textContent = roomName(node) + ' · ' + LEVELS[levelOf(node)].name.toLowerCase();
    $('#interior-status').textContent = 'Click an arrow to step forward · drag to look around';
    for (const chip of document.querySelectorAll('#room-chips button')) chip.setAttribute('aria-pressed', String(chip.dataset.node === node.id));
  }
  function walkTo(id) {
    if (state !== 'inside' || busy() || !current || id === current.id) return;
    const path = pathTo(current.id, id);
    if (!path.length) return;
    arrows.visible = false;
    hotspots.replaceChildren();
    let from = current;
    for (const link of path) {
      travel(link, from, path.length > 1 ? .8 : 1);
      from = nodeById[link.to];
    }
    $('#viewname').textContent = 'Walking to the ' + roomName(nodeById[id]).toLowerCase();
  }

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null, dragging = false, hovered = null;
  function pick(e) {
    const r = host.getBoundingClientRect();
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(arrows.children, true)[0];
    return hit ? arrowItems.find(i => i.g === hit.object.parent) : null;
  }
  host.addEventListener('pointerdown', e => {
    if (state !== 'inside') return;
    down = {x: e.clientX, y: e.clientY, yaw, pitch};
    dragging = false;
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', e => {
    if (state !== 'inside') return;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 4) dragging = true;
      if (dragging && !busy()) {
        const k = fov / host.clientHeight * Math.PI / 180;
        yaw = down.yaw + dx * k;
        pitch = Math.max(-1.05, Math.min(1.05, down.pitch + dy * k));
        applyLook();
      }
      return;
    }
    const item = busy() ? null : pick(e);
    if (item !== hovered) {
      hovered?.g.scale.setScalar(1);
      hovered = item;
      hovered?.g.scale.setScalar(1.18);
      host.style.cursor = hovered ? 'pointer' : 'grab';
    }
  });
  host.addEventListener('pointerup', e => {
    if (state !== 'inside' || !down) return;
    const wasDrag = dragging;
    down = null;
    dragging = false;
    if (wasDrag || busy()) return;
    const item = pick(e);
    if (item) walkTo(item.link.to);
  });
  host.addEventListener('pointercancel', () => { down = null; dragging = false; });
  host.addEventListener('wheel', e => {
    if (state !== 'inside') return;
    e.preventDefault();
    fov = Math.max(34, Math.min(88, fov + e.deltaY * .04));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, {passive: false});
  host.addEventListener('keydown', e => {
    if (state !== 'inside' || busy()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      yaw += e.key === 'ArrowLeft' ? .14 : -.14;
      applyLook();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const facing = e.key === 'ArrowUp' ? yaw : yaw + Math.PI;
      let best = null, bestDiff = 1.25;
      for (const link of current.links) {
        const first = link.via ? {x: link.via[0][0], z: link.via[0][1]} : nodeById[link.to];
        const d = yawBetween(current, first) - facing, diff = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        if (diff < bestDiff) { best = link; bestDiff = diff; }
      }
      if (best) walkTo(best.to);
    }
  });

  // ---- Room list, entering and leaving ---------------------------------------------------
  const chips = $('#room-chips');
  for (const [key, lv] of Object.entries(LEVELS)) {
    const h = document.createElement('h3');
    h.textContent = lv.name;
    chips.append(h);
    for (const n of NODES.filter(n => levelOf(n) === key)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.node = n.id;
      b.textContent = roomName(n);
      b.onclick = () => walkTo(n.id);
      chips.append(b);
    }
  }
  $('#exit-interior').onclick = () => exit();

  const groundOutside = hemisphere.groundColor.clone(), groundInside = new THREE.Color('#d8d2c6');
  function slerpTo(duration, position, quaternion, fovTo, glassTo, lightTo, done) {
    const p0 = camera.position.clone(), q0 = camera.quaternion.clone(), f0 = camera.fov, g0 = glassLower.opacity, l0 = lights[0].intensity / lights[0].userData.max, c0 = hemisphere.groundColor.clone();
    tween(duration, t => {
      camera.position.lerpVectors(p0, position, t);
      camera.quaternion.slerpQuaternions(q0, quaternion, t);
      camera.fov = lerp(f0, fovTo, t);
      camera.updateProjectionMatrix();
      glassLower.opacity = lerp(g0, glassTo, t);
      for (const l of lights) l.intensity = lerp(l0, lightTo, t) * l.userData.max;
      hemisphere.groundColor.lerpColors(c0, lightTo ? groundInside : groundOutside, t);
    }, done);
  }
  const quaternionFor = (y, p) => new THREE.Quaternion().setFromEuler(new THREE.Euler(p, y, 0, 'YXZ'));

  function enter() {
    if (state !== 'outside') return;
    state = 'entering';
    controls.enabled = false;
    document.body.dataset.mode = 'interior';
    $('#interior-transport').hidden = false;
    minimap.removeAttribute('hidden');
    $('#viewname').textContent = 'Stepping inside';
    $('#mode-label').textContent = 'Walkthrough · conceptual interiors traced from the floor plans';
    host.style.cursor = 'grab';
    host.focus({preventScroll: true});
    onEnter?.();
    const porch = nodeById.porch, hall = nodeById.hall;
    yaw = yawBetween(porch, hall);
    pitch = 0;
    fov = 62;
    slerpTo(1.7, new THREE.Vector3(porch.x, floorOf(porch) + EYE, porch.z), quaternionFor(yaw, pitch), fov, .22, 1, () => {
      applyLook();
      current = porch;
      markRoom('porch');
      showLevel('first');
      travel(porch.links[0], porch);
      queue[queue.length - 1].done = () => {
        state = 'inside';
        arrive(hall);
      };
    });
  }

  function exit() {
    if (state !== 'inside' || busy()) return;
    state = 'exiting';
    arrows.visible = false;
    hotspots.replaceChildren();
    $('#viewname').textContent = 'Heading back outside';
    let from = current;
    for (const link of pathTo(current.id, 'porch')) {
      travel(link, from, .75);
      from = nodeById[link.to];
    }
    const closeDoors = () => tween(.7, t => {
      for (const name of Object.keys(doorState)) if (doorState[name] > 0) setDoor(name, ease(doorState[name] * (1 - t)));
    }, () => {
      for (const name of Object.keys(doorState)) doorState[name] = 0;
      const pose = exteriorPose();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pose.position, pose.target, camera.up));
      slerpTo(1.5, pose.position, q, 40, .55, 0, () => {
        state = 'outside';
        document.body.dataset.mode = '';
        $('#interior-transport').hidden = true;
        minimap.setAttribute('hidden', '');
        host.style.cursor = '';
        controls.enabled = true;
        onExit?.();
      });
    });
    if (queue.length) queue[queue.length - 1].done = () => { arrive(nodeById.porch); closeDoors(); };
    else closeDoors();
  }

  let clock = performance.now();
  function update() {
    // Animations run on wall-clock time so they finish on schedule even when the tab is throttled.
    const now = performance.now(), dt = Math.min(1, (now - clock) / 1000);
    clock = now;
    const q = queue[0];
    if (q) {
      q.t += dt;
      const k = Math.min(1, q.t / q.duration);
      q.step(ease(k), k);
      if (k >= 1) { queue.shift(); q.done?.(); }
    }
    if (state !== 'outside') {
      projectLabels();
      updateMinimap();
    }
  }

  return {get active() { return state !== 'outside'; }, group, enter, exit, update};
}
