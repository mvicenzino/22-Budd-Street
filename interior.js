// Walkthrough of the house interior: builds every level inside the exterior shell, drives a
// street-view style camera (stand at a node, drag to look, click an arrow to step), and applies
// the interior design choices (flooring, furniture style and placement, rugs, wall colors, kitchen).
import * as THREE from 'three';
import {INNER, EYE, LEVELS, OPENINGS, PARTITIONS, STAIR, LOFT_STAIR, ROOMS, NODES} from './plan.js';
import {mergeStatic} from './merge.js';
import {FLOORING, WALL_COLORS, RUGS, KITCHEN_FLOORS, COUNTERS, loadDesign, saveDesign, createDesignPanel} from './design.js';

const $ = s => document.querySelector(s);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const shortest = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
const yawBetween = (a, b) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
const T = .14; // partition thickness
const F = LEVELS.first, S = LEVELS.second, L = LEVELS.loft;
const byId = list => Object.fromEntries(list.map(i => [i.id, i]));
const FLOOR_BY_ID = byId(FLOORING), WALL_BY_ID = byId(WALL_COLORS), RUG_BY_ID = byId(RUGS), KFLOOR_BY_ID = byId(KITCHEN_FLOORS), COUNTER_BY_ID = byId(COUNTERS);

// Small deterministic random source so generated textures look the same on every visit.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createInterior({scene, camera, renderer, host, controls, doors, glassLower, hemisphere, exteriorPose, onEnter, onExit}) {
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: .88, ...o});
  const ceilingPaint = mat('#faf8f3'), trim = mat('#f7f6ed', {roughness: .6}), slope = mat('#faf8f3', {side: THREE.DoubleSide});
  const cabinet = mat('#ebe8df', {roughness: .5}), steel = mat('#b9c0c4', {metalness: .65, roughness: .3}), black = mat('#2b2f31', {roughness: .5});
  const porcelain = mat('#f4f4f1', {roughness: .3}), leaf = mat('#4f7a4a'), tile = mat('#e4e6e3', {roughness: .4});
  const carpet = mat('#c9bfae'), paneGlass = mat('#7f9a9e', {metalness: .2, roughness: .2, transparent: true, opacity: .5});
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const texture = canvas => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; return t; };

  // Furniture palette: one shared material per role, recolored by the furniture style.
  const palette = {
    wood: mat('#7d5b3f', {roughness: .55}), woodLight: mat('#a88760', {roughness: .6}), rustic: mat('#7a6650', {roughness: .7}),
    fabric: mat('#8f9ca4'), cushion: mat('#d8d3c6'), sectional: mat('#cbc2b1', {roughness: .95}), pillow: mat('#a9b2a8', {roughness: .95}),
    linen: mat('#e9e4d8'), quilt: mat('#7c8b9a'), quiltWarm: mat('#b98c6b'), frame: mat('#2b2f31', {roughness: .5}),
  };
  const STYLE_COLORS = {
    traditional: {wood: '#7d5b3f', woodLight: '#a88760', rustic: '#7a6650', fabric: '#8f9ca4', cushion: '#d8d3c6', sectional: '#cbc2b1', pillow: '#a9b2a8', linen: '#e9e4d8', quilt: '#7c8b9a', quiltWarm: '#b98c6b', frame: '#2b2f31'},
    modern: {wood: '#2e3033', woodLight: '#cbb392', rustic: '#3a3c3f', fabric: '#4d5359', cushion: '#e7e4dd', sectional: '#585d63', pillow: '#c9b79a', linen: '#f2f1ee', quilt: '#3f464c', quiltWarm: '#8a7b6a', frame: '#1e2022'},
    coastal: {wood: '#d9cfbf', woodLight: '#e4dccd', rustic: '#cbbfae', fabric: '#cfc5b2', cushion: '#f3f1ea', sectional: '#e2dccf', pillow: '#9fb8c4', linen: '#f7f5f0', quilt: '#9fb8c4', quiltWarm: '#d8c9b0', frame: '#8a8f93'},
    farmhouse: {wood: '#7a6650', woodLight: '#b39a78', rustic: '#6b5642', fabric: '#b8ad9c', cushion: '#ebe5d8', sectional: '#d5cbba', pillow: '#a8543d', linen: '#efe9dd', quilt: '#a8543d', quiltWarm: '#c9b18f', frame: '#3b3a37'},
  };
  function applyStyle(id) {
    const colors = STYLE_COLORS[id] || STYLE_COLORS.traditional;
    for (const [role, color] of Object.entries(colors)) palette[role].color.set(color);
  }

  const group = new THREE.Group();
  group.name = 'Interior';
  scene.add(group);
  let parentGroup = group; // where box() puts new meshes; room builders retarget this

  function box(w, h, d, x, yBottom, z, m, parent = parentGroup) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, yBottom + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function beam(a, b, size, m, parent = parentGroup) {
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
  // Neutral plank texture; the wood shade comes from the material color so flooring swaps are free.
  function plankTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d'), rnd = seeded(7);
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, 1024, 1024);
    const rows = 8, h = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      const tone = 216 + Math.floor(rnd() * 30);
      g.fillStyle = `rgb(${tone},${tone - 2},${tone - 5})`;
      g.fillRect(0, r * h, 1024, h - 4);
      g.fillStyle = 'rgba(60,40,25,.5)';
      g.fillRect(0, r * h + h - 4, 1024, 4);
      g.fillRect(Math.floor(rnd() * 1024), r * h, 4, h);
      g.strokeStyle = 'rgba(90,60,35,.16)';
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(0, r * h + 12 + i * 18);
        g.lineTo(1024, r * h + 8 + i * 18 + Math.floor(rnd() * 5));
        g.stroke();
      }
    }
    const t = texture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 7.5);
    return t;
  }
  const floorMat = new THREE.MeshStandardMaterial({map: plankTexture(), roughness: .55, color: FLOORING[0].color});
  const slabMats = [trim, trim, floorMat, ceilingPaint, trim, trim];
  const W = INNER.x * 2 + .2, D = INNER.z * 2 + .2;
  function slab(y0, y1, hole, mats = slabMats) {
    const h = y1 - y0;
    if (!hole) return box(W, h, D, 0, y0, 0, mats);
    const [x0, z0, x1, z1] = hole;
    box(x0 + W / 2, h, D, (x0 - W / 2) / 2, y0, 0, mats);
    box(W / 2 - x1, h, D, (x1 + W / 2) / 2, y0, 0, mats);
    box(x1 - x0, h, D / 2 - z1, (x0 + x1) / 2, y0, (z1 + D / 2) / 2, mats);
    box(x1 - x0, h, z0 + D / 2, (x0 + x1) / 2, y0, (z0 - D / 2) / 2, mats);
  }
  slab(F.y - .1, F.y, null);
  slab(F.ceil, S.y, [STAIR.x0, STAIR.upperZ1, STAIR.x1, STAIR.landingZ1]);
  slab(S.ceil, L.y, [LOFT_STAIR.x0, LOFT_STAIR.z1, LOFT_STAIR.x1, LOFT_STAIR.z0]);

  // ---- Rooms own their wall paint -----------------------------------------------------------
  const roomById = byId(ROOMS);
  const roomPaint = {};
  const paintFor = id => roomPaint[id] ||= mat(WALL_COLORS[0].color);
  const defaultPaint = paintFor('other');
  function roomAt(level, x, z) {
    const r = ROOMS.find(r => r.level === level && !r.outside && x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3]);
    return r ? paintFor(r.id) : defaultPaint;
  }

  // ---- Walls ---------------------------------------------------------------------------
  function segment(axis, coord, a0, a1, y0, y1, m, thick = T) {
    if (a1 - a0 < .005 || y1 - y0 < .005) return;
    return axis === 'x'
      ? box(a1 - a0, y1 - y0, thick, (a0 + a1) / 2, y0, coord, m)
      : box(thick, y1 - y0, a1 - a0, coord, y0, (a0 + a1) / 2, m);
  }
  const baseboard = (axis, coord, a0, a1, side, floorY) => segment(axis, coord + side * .025, a0, a1, floorY, floorY + .11, trim, .05);
  function casing(axis, faceCoord, side, a0, a1, y0, y1, withSill) {
    const c = faceCoord + side * .02, w = .085;
    segment(axis, c, a0 - w, a0, y0 - (withSill ? 0 : .02), y1 + w, trim, .045);
    segment(axis, c, a1, a1 + w, y0 - (withSill ? 0 : .02), y1 + w, trim, .045);
    segment(axis, c, a0 - w, a1 + w, y1, y1 + w, trim, .045);
    if (withSill) segment(axis, faceCoord + side * .05, a0 - .12, a1 + .12, y0 - .05, y0, trim, .13);
  }
  // A partition: each piece is painted per side with the color of the room it faces.
  function wall(level, axis, coord, c0, c1, openings, floorY, ceilY) {
    const sorted = [...openings].sort((p, q) => p.a0 - q.a0);
    const mats = (a0, a1) => {
      const mid = (a0 + a1) / 2, off = T / 2 + .06;
      const plus = axis === 'x' ? roomAt(level, mid, coord + off) : roomAt(level, coord + off, mid);
      const minus = axis === 'x' ? roomAt(level, mid, coord - off) : roomAt(level, coord - off, mid);
      return axis === 'x' ? [trim, trim, trim, trim, plus, minus] : [plus, minus, trim, trim, trim, trim];
    };
    let cursor = c0;
    for (const o of sorted) {
      const head = o.y1 == null ? ceilY : floorY + o.y1;
      segment(axis, coord, cursor, o.a0, floorY, ceilY, mats(cursor, o.a0));
      segment(axis, coord, o.a0, o.a1, head, ceilY, mats(o.a0, o.a1));
      if (o.y1 != null) for (const side of [-1, 1]) casing(axis, coord + side * T / 2, side, o.a0, o.a1, floorY, head, false);
      cursor = o.a1;
    }
    segment(axis, coord, cursor, c1, floorY, ceilY, mats(cursor, c1));
    for (const side of [-1, 1]) {
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
    wall(p.level, p.axis, p.coord, p.c0, p.c1, p.openings, lv.y, lv.ceil);
  }

  // Inside faces of the exterior shell: a thin painted liner per room, cut around windows and doors,
  // plus casings, sills and baseboards.
  const shellFaces = [
    {key: 'front', axis: 'x', face: INNER.z, side: -1},
    {key: 'rear', axis: 'x', face: -INNER.z, side: 1},
    {key: 'left', axis: 'z', face: -INNER.x, side: 1},
    {key: 'right', axis: 'z', face: INNER.x, side: -1},
  ];
  for (const [levelKey, lv] of Object.entries(LEVELS)) {
    if (lv === L) continue;
    for (const f of shellFaces) {
      const limit = f.axis === 'x' ? INNER.x : INNER.z;
      const ops = OPENINGS[f.key].filter(o => o.y1 > lv.y && o.y0 < lv.ceil);
      const roomEdges = ROOMS.filter(r => r.level === levelKey).flatMap(r => f.axis === 'x' ? [r.rect[0], r.rect[2]] : [r.rect[1], r.rect[3]]);
      const edges = [...new Set([-limit, limit, ...ops.flatMap(o => [o.a0, o.a1]), ...roomEdges])].filter(a => a >= -limit && a <= limit).sort((p, q) => p - q);
      const linerCoord = f.face + f.side * .006;
      for (let i = 0; i < edges.length - 1; i++) {
        const a0 = edges[i], a1 = edges[i + 1], mid = (a0 + a1) / 2;
        const m = f.axis === 'x' ? roomAt(levelKey, mid, f.face + f.side * .1) : roomAt(levelKey, f.face + f.side * .1, mid);
        let cursor = lv.y;
        for (const o of ops.filter(o => o.a0 <= a0 + .001 && o.a1 >= a1 - .001).sort((p, q) => p.y0 - q.y0)) {
          segment(f.axis, linerCoord, a0, a1, cursor, Math.max(cursor, Math.min(o.y0, lv.ceil)), m, .012);
          cursor = Math.max(cursor, o.y1);
        }
        segment(f.axis, linerCoord, a0, a1, cursor, lv.ceil, m, .012);
      }
      for (const o of ops) casing(f.axis, f.face, f.side, o.a0, o.a1, o.kind === 'door' ? lv.y : o.y0, o.y1, o.kind === 'window');
      let from = -limit;
      for (const o of ops.filter(o => o.kind === 'door').sort((p, q) => p.a0 - q.a0)) {
        baseboard(f.axis, f.face, from, o.a0, f.side, lv.y);
        from = o.a1;
      }
      baseboard(f.axis, f.face, from, limit, f.side, lv.y);
    }
  }

  // ---- Loft: knee walls, sloped ceiling, gable ends with the small gable windows -------------
  {
    const kx = L.kneeX, y0 = L.y, top = L.kneeTop, ridge = L.ceil, zi = INNER.z - .05, loftPaint = paintFor('loft');
    for (const s of [-1, 1]) {
      box(.12, top - y0, zi * 2, s * kx, y0, 0, loftPaint);
      face(s < 0
        ? [[-kx, top, zi], [0, ridge, zi], [0, ridge, -zi], [-kx, top, -zi]]
        : [[kx, top, -zi], [0, ridge, -zi], [0, ridge, zi], [kx, top, zi]], slope).receiveShadow = false;
    }
    for (const s of [-1, 1]) {
      const z = s * zi, pts = [[-kx, y0, z], [-kx, top, z], [0, ridge, z], [kx, top, z], [kx, y0, z]];
      const gable = face(s > 0 ? pts : pts.slice().reverse(), loftPaint);
      gable.receiveShadow = false;
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
  function railing(x, z0, z1, y, m = palette.wood) {
    box(.09, 1.02, .09, x, y, z0, m);
    box(.09, 1.02, .09, x, y, z1, m);
    beam([x, y + .92, z0], [x, y + .92, z1], .06, m);
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / .18));
    for (let i = 1; i < n; i++) box(.03, .86, .03, x, y, z0 + (z1 - z0) * i / n, trim);
  }
  function flight(x0, x1, zStart, zEnd, yStart, yEnd, steps, base, railSide, fill = palette.woodLight) {
    const w = x1 - x0, cx = (x0 + x1) / 2, run = (zStart - zEnd) / steps, rise = (yEnd - yStart) / steps;
    for (let i = 0; i < steps; i++) {
      const z = zStart - run / 2 - i * run, top = yStart + (i + 1) * rise;
      box(w, top - base, run, cx, base, z, fill);
      box(w, .035, run + .04, cx, top, z - .02, palette.wood);
    }
    if (railSide) {
      const rx = railSide < 0 ? x0 - .03 : x1 + .03;
      box(.09, 1.02, .09, rx, yStart, zStart + .05, palette.wood);
      beam([rx, yStart + .92, zStart + .05], [rx, yEnd + .92, zEnd], .06, palette.wood);
      for (let i = 0; i < steps; i++) box(.03, .86, .03, rx, yStart + (i + 1) * rise, zStart - run / 2 - i * run, trim);
    }
  }
  flight(STAIR.x0, STAIR.x1, STAIR.lowerZ0, STAIR.lowerZ1, F.y, STAIR.landingY, 6, F.y, -1);
  box(STAIR.x1 - STAIR.x0, STAIR.landingY - F.y, STAIR.lowerZ1 - STAIR.landingZ1, (STAIR.x0 + STAIR.x1) / 2, F.y, (STAIR.lowerZ1 + STAIR.landingZ1) / 2, palette.woodLight);
  box(STAIR.x1 - STAIR.x0, .035, STAIR.lowerZ1 - STAIR.landingZ1, (STAIR.x0 + STAIR.x1) / 2, STAIR.landingY, (STAIR.lowerZ1 + STAIR.landingZ1) / 2, palette.wood);
  railing(STAIR.x0 - .03, STAIR.lowerZ1, STAIR.landingZ1 + .05, STAIR.landingY);
  flight(STAIR.x0, STAIR.x1, STAIR.landingZ1, STAIR.upperZ1, STAIR.landingY, S.y, 10, STAIR.landingY, 0);
  railing(STAIR.x0 - .03, -.37 - .05, STAIR.upperZ1 + .3, S.y);
  flight(LOFT_STAIR.x0, LOFT_STAIR.x1, LOFT_STAIR.z0, LOFT_STAIR.z1, S.y, L.y, 13, S.y, -1, paintFor('hall2')); // enclosed underside reads as wall
  railing(LOFT_STAIR.x0 - .03, LOFT_STAIR.z0 + .05, LOFT_STAIR.z1 + .35, L.y);
  railing(LOFT_STAIR.x1 + .03, LOFT_STAIR.z0 + .05, LOFT_STAIR.z1 + .35, L.y);
  beam([LOFT_STAIR.x0 - .03, L.y + .92, LOFT_STAIR.z0 + .05], [LOFT_STAIR.x1 + .03, L.y + .92, LOFT_STAIR.z0 + .05], .06, palette.wood);

  // ---- Furniture helpers -----------------------------------------------------------------
  function sofa(x, z, len, angle, y = F.y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parentGroup.add(g);
    box(len, .42, .9, 0, 0, 0, palette.fabric, g);
    box(len, .5, .22, 0, .3, -.34, palette.fabric, g);
    for (const s of [-1, 1]) box(.2, .3, .9, s * (len / 2 - .1), .42, 0, palette.fabric, g);
    const n = Math.round(len / .8);
    for (let i = 0; i < n; i++) box(len / n - .06, .16, .62, -len / 2 + .1 + (i + .5) * (len - .2) / n, .42, .08, palette.cushion, g);
  }
  function chair(x, z, angle, y = F.y, m = palette.wood) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parentGroup.add(g);
    for (const sx of [-.19, .19]) for (const sz of [-.19, .19]) box(.035, .44, .035, sx, 0, sz, m, g);
    box(.44, .04, .44, 0, .44, 0, m, g);
    box(.42, .48, .035, 0, .48, -.2, m, g);
  }
  function armchair(x, z, angle, y = F.y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parentGroup.add(g);
    box(.85, .4, .85, 0, 0, 0, palette.fabric, g);
    box(.85, .48, .2, 0, .3, -.32, palette.fabric, g);
    for (const s of [-1, 1]) box(.16, .26, .8, s * .34, .4, 0, palette.fabric, g);
    box(.5, .14, .58, 0, .4, .06, palette.cushion, g);
  }
  function lamp(x, z, y = F.y) {
    box(.3, .03, .3, x, y, z, palette.frame);
    box(.03, 1.5, .03, x, y, z, palette.frame);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, .3, 20, 1, true), mat('#efe8d8', {side: THREE.DoubleSide}));
    shade.position.set(x, y + 1.6, z);
    parentGroup.add(shade);
  }
  function plant(x, z, y = F.y) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .32, 14), mat('#b4a48d'));
    pot.position.set(x, y + .16, z);
    pot.castShadow = true;
    parentGroup.add(pot);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 1), leaf);
      const a = i * 1.1;
      l.position.set(x + Math.cos(a) * .17, y + .5 + (i % 3) * .14, z + Math.sin(a) * .17);
      l.scale.set(1, .6, 1);
      parentGroup.add(l);
    }
  }
  // Bed inside [x0,z0,x1,z1]; `head` is the wall side the headboard is on: 'x-', 'x+', 'z-' or 'z+'.
  function bed(x0, z0, x1, z1, head, cover, y = S.y) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const alongX = head[0] === 'x', sign = head[1] === '-' ? 1 : -1;
    box(w - .1, .3, d - .1, cx, y, cz, palette.wood);
    box(w, .22, d, cx, y + .3, cz, palette.linen);
    box(alongX ? w - .9 : w - .16, .12, alongX ? d - .16 : d - .9, cx + (alongX ? sign * .35 : 0), y + .52, cz + (alongX ? 0 : sign * .35), cover);
    const hx = alongX ? (sign > 0 ? x0 + .04 : x1 - .04) : cx, hz = alongX ? cz : (sign > 0 ? z0 + .04 : z1 - .04);
    box(alongX ? .08 : w, 1.1, alongX ? d : .08, hx, y, hz, palette.wood);
    for (const s of [-1, 1]) {
      const px = alongX ? hx + sign * .32 : cx + s * (w / 2 - .3);
      const pz = alongX ? cz + s * (d / 2 - .3) : hz + sign * .32;
      box(alongX ? .45 : .5, .14, alongX ? .5 : .45, px, y + .52, pz, palette.linen);
    }
  }
  function nightstand(x, z, y = S.y) {
    box(.45, .55, .42, x, y, z, palette.wood);
    box(.18, .02, .18, x, y + .55, z, palette.frame);
    box(.03, .28, .03, x, y + .57, z, palette.frame);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, .16, 16, 1, true), mat('#efe8d8', {side: THREE.DoubleSide}));
    shade.position.set(x, y + .95, z);
    parentGroup.add(shade);
  }
  function dresser(x, z, w, d, y = S.y, angle = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parentGroup.add(g);
    box(w, .95, d, 0, 0, 0, palette.wood, g);
    for (let i = 0; i < 3; i++) box(w - .12, .02, .02, 0, .18 + i * .28, d / 2 + .01, trim, g);
  }
  function toilet(x, z, y) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parentGroup.add(g);
    box(.38, .4, .5, 0, 0, 0, porcelain, g);
    box(.34, .5, .18, 0, .4, -.18, porcelain, g);
    box(.42, .04, .5, 0, .4, .02, porcelain, g);
  }
  function drum(x, y, z, r = .24) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .16, 24, 1, true), mat('#efe6d3', {side: THREE.DoubleSide}));
    d.position.set(x, y, z);
    parentGroup.add(d);
  }

  // Rugs: a bordered canvas per rug design, cached.
  const rugMaterials = {};
  function rugMaterial(id) {
    const r = RUG_BY_ID[id];
    if (!r || id === 'none') return null;
    if (rugMaterials[id]) return rugMaterials[id];
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d'), rnd = seeded(id.length * 31);
    g.fillStyle = r.border;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = r.field;
    g.fillRect(36, 36, 440, 440);
    g.strokeStyle = r.border;
    g.lineWidth = 6;
    g.strokeRect(60, 60, 392, 392);
    if (r.pattern) {
      g.fillStyle = r.border;
      for (let i = 0; i < 120; i++) {
        const x = 80 + rnd() * 350, y = 80 + rnd() * 350, s = 6 + rnd() * 14;
        g.globalAlpha = .35;
        g.fillRect(x, y, s, s * .6);
      }
      g.globalAlpha = 1;
      g.beginPath();
      g.ellipse(256, 256, 120, 90, 0, 0, Math.PI * 2);
      g.stroke();
    }
    return rugMaterials[id] = new THREE.MeshStandardMaterial({map: texture(c), roughness: .95});
  }
  function rug(w, d, x, z, y, material) {
    if (material) box(w, .02, d, x, y, z, material);
  }

  // ---- Countertop and kitchen floor materials ------------------------------------------------
  const counterMaterials = {}, kitchenFloorMaterials = {};
  function counterMaterial(id) {
    const c = COUNTER_BY_ID[id] || COUNTER_BY_ID.alabaster;
    if (counterMaterials[c.id]) return counterMaterials[c.id];
    if (c.kind === 'plain') return counterMaterials[c.id] = mat(c.base, {roughness: .3});
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d'), rnd = seeded(c.id.length * 977);
    g.fillStyle = c.base;
    g.fillRect(0, 0, 512, 512);
    if (c.kind === 'marble') {
      g.strokeStyle = c.vein;
      for (let i = 0; i < c.veins; i++) {
        g.globalAlpha = .35 + rnd() * .4;
        g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath();
        let x = rnd() * 512, y = rnd() * 512;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          const nx = x + (rnd() - .5) * 220, ny = y + (rnd() - .5) * 220;
          g.quadraticCurveTo(x + (rnd() - .5) * 120, y + (rnd() - .5) * 120, nx, ny);
          x = nx; y = ny;
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    } else {
      const n = Math.round(9000 * c.density);
      for (let i = 0; i < n; i++) {
        g.fillStyle = c.speck[i % c.speck.length];
        g.globalAlpha = .5 + rnd() * .5;
        const s = 1 + rnd() * 3;
        g.fillRect(rnd() * 512, rnd() * 512, s, s);
      }
      g.globalAlpha = 1;
    }
    const t = texture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return counterMaterials[c.id] = new THREE.MeshStandardMaterial({map: t, roughness: c.kind === 'marble' ? .25 : .35});
  }
  function kitchenFloorMaterial(id) {
    if (kitchenFloorMaterials[id]) return kitchenFloorMaterials[id];
    if (id === 'checker') {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g = cv.getContext('2d');
      g.fillStyle = '#ebe7dc';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#1d1d1f';
      g.fillRect(0, 0, 128, 128);
      g.fillRect(128, 128, 128, 128);
      const t = texture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.center.set(.5, .5);
      t.rotation = Math.PI / 4;
      t.repeat.set((INNER.x + .33) / .6, (INNER.z - .38) / .6);
      return kitchenFloorMaterials[id] = new THREE.MeshStandardMaterial({map: t, roughness: .35});
    }
    const t = floorMat.map.clone();
    t.repeat.set(1.5, 3.4);
    t.needsUpdate = true;
    return kitchenFloorMaterials[id] = new THREE.MeshStandardMaterial({map: t, roughness: .55, color: (FLOOR_BY_ID[id] || FLOORING[0]).color});
  }

  // ---- Static fixtures ------------------------------------------------------------------
  toilet(.09, -3.45, F.y); // powder room, entered from the dining room
  {
    // Hall bathroom: tub, toilet, vanity.
    box(2.2, .02, 1.72, 2.75, S.y, -2.99, tile);
    box(.7, .55, 1.5, 2.0, S.y, -3.05, porcelain);
    box(.56, .02, 1.36, 2.0, S.y + .55, -3.05, mat('#d5e4e8', {roughness: .2}));
    box(.03, .5, .03, 2.0, S.y + .55, -3.75, steel);
    toilet(3.5, -3.5, S.y);
    box(.5, .82, .5, 3.55, S.y, -2.55, cabinet);
    box(.52, .04, .52, 3.55, S.y + .82, -2.55, mat('#d6d2c8', {roughness: .35}));
    box(.03, .55, .5, 3.8, S.y + 1.2, -2.55, steel);
  }
  {
    // Front-left bedroom closets, from the photos: a double-door closet with two hanging rods and
    // shoe shelving on the right, and a built-in with five drawers under a two-door cabinet of shelves.
    const y = S.y, front = .35 - T / 2, brass = mat('#c9a955', {metalness: .8, roughness: .3});
    const panelDoor = (hingeX, width, sign, angle, height = 2.0, bottom = 0) => {
      const g = new THREE.Group();
      g.position.set(hingeX, y + bottom, front);
      g.rotation.y = angle;
      parentGroup.add(g);
      box(width, height, .035, sign * width / 2, 0, 0, trim, g);
      box(width - .16, height * .38, .012, sign * width / 2, height * .55, .022, cabinet, g);
      box(width - .16, height * .38, .012, sign * width / 2, height * .06, .022, cabinet, g);
      box(.03, .03, .03, sign * (width - .07), height * .48, .035, brass, g);
    };
    // Closet A: doors open, rods and shoes inside.
    panelDoor(-3.6, .44, 1, -1.65);
    panelDoor(-2.7, .44, -1, 1.65);
    for (const [ry, colors] of [[1.72, ['#e8e2d5', '#dfe5ea', '#2f3236']], [.98, ['#7c8fb0', '#c9c4bb', '#5a4b42']]]) {
      beam([-3.72, y + ry, -.02], [-3.05, y + ry, -.02], .025, steel);
      colors.forEach((c, i) => box(.05, .78, .34, -3.62 + i * .19, y + ry - .8, -.02, mat(c, {roughness: .9})));
    }
    box(.02, 2.0, .55, -3.02, y, .0, trim);
    for (let i = 0; i < 7; i++) box(.3, .02, .52, -2.86, y + .15 + i * .3, .0, trim);
    for (let i = 0; i < 6; i++) box(.22, .09, .28, -2.86 + (i % 2 ? .04 : -.04), y + .17 + i * .3, .02, mat(['#eeeeea', '#5a4636', '#2b2b2d'][i % 3]));
    // Second closet: doors slightly ajar, rod inside.
    panelDoor(-1.6, .49, 1, -.25);
    panelDoor(-.6, .49, -1, .25);
    beam([-1.55, y + 1.72, -.02], [-.65, y + 1.72, -.02], .025, steel);
    ['#d9dde0', '#9aa5b5', '#4a4f57', '#e6e0d3'].forEach((c, i) => box(.05, .78, .34, -1.45 + i * .21, y + .92, -.02, mat(c, {roughness: .9})));
    // Closet B: built-in drawers and cabinet, left cabinet door open.
    const bx = -2.15, bw = .78;
    box(bw, 2.0, .04, bx, y, front - .02, cabinet);
    for (let i = 0; i < 5; i++) {
      box(bw - .07, .19, .02, bx, y + .04 + i * .225, front + .01, trim);
      box(bw - .25, .13, .01, bx, y + .07 + i * .225, front + .021, cabinet);
      box(.025, .025, .025, bx, y + .13 + i * .225, front + .03, brass);
    }
    box(bw, .04, .02, bx, y + 1.17, front + .01, trim);
    box(.02, .82, .56, bx - bw / 2, y + 1.22, .0, trim);
    box(.02, .82, .56, bx + bw / 2, y + 1.22, .0, trim);
    for (let i = 0; i < 4; i++) box(bw - .03, .02, .52, bx, y + 1.22 + i * .26, .0, trim);
    for (let i = 0; i < 3; i++) for (const dx of [-.18, .14]) box(.26, .08, .34, bx + dx, y + 1.25 + i * .26, .0, mat(['#3a4b6a', '#6b7688', '#e6dfd0'][(i + (dx > 0)) % 3], {roughness: .9}));
    panelDoor(bx - bw / 2, bw / 2 - .01, 1, -1.5, .82, 1.22);
    panelDoor(bx + bw / 2, bw / 2 - .01, -1, 0, .82, 1.22);
  }
  beam([-.1, S.y + 1.7, -3.2], [1.4, S.y + 1.7, -3.2], .03, steel); // upstairs closet rod

  // ---- Room builders: furniture, rugs and layouts, rebuilt when a design choice changes ----------
  const roomGroups = {};
  const roomDefaults = {
    living: {wall: 'dove', rug: 'cream', layout: 'windows', layouts: {windows: 'Sectional under the front windows', side: 'Sectional on the side wall', classic: 'Sofa and two armchairs'}},
    hall: {wall: 'dove', rug: 'sand'},
    dining: {wall: 'dove', rug: 'sand', layout: 'centered', layouts: {centered: 'Table centered', window: 'Table along the window wall'}},
    kitchen: {wall: 'dove'},
    rear: {wall: 'dove'},
    porch: {wall: 'dove'},
    hall2: {wall: 'dove', rug: 'sand'},
    bedBack: {wall: 'dove', rug: 'sand', layout: 'left', layouts: {left: 'Bed on the left wall', back: 'Bed on the back wall'}},
    bedFrontL: {wall: 'dove', rug: 'blue', layout: 'left', layouts: {left: 'Bed on the left wall', front: 'Bed under the front windows'}},
    bedFrontR: {wall: 'dove', rug: 'sand', layout: 'right', layouts: {right: 'Bed on the driveway wall', front: 'Bed under the front windows'}},
    bath: {wall: 'mist'},
    loft: {wall: 'dove', rug: 'blue', layout: 'back', layouts: {back: 'Bed at the back gable', front: 'Bed at the front gable'}},
  };
  const builders = {
    living(layout, rugMat) {
      const cx = -1.6;
      if (layout === 'classic') {
        rug(3.3, 2.5, cx, 1.6, F.y, rugMat);
        sofa(-3.3, 1.6, 2.1, Math.PI / 2);
        box(1.1, .04, .6, -2.35, F.y + .4, 1.6, palette.wood);
        for (const sx of [-.5, .5]) for (const sz of [-.25, .25]) box(.04, .4, .04, -2.35 + sx, F.y, 1.6 + sz, palette.wood);
        armchair(-.6, .6, -Math.PI / 2 + .35);
        armchair(-.6, 3.0, -Math.PI / 2 - .35);
        box(1.5, .5, .42, .55, F.y, -.03, palette.wood);
        box(1.15, .65, .04, .55, F.y + .6, -.06, black);
        lamp(-3.5, 3.5);
        plant(1.55, 3.5);
        drum(cx, F.ceil - .2, 1.8);
        return;
      }
      rug(3.6, 2.9, cx, 1.8, F.y, rugMat);
      const seat = (x0, z0, x1, z1, backSide) => {
        const w = x1 - x0, d = z1 - z0, sx = (x0 + x1) / 2, sz = (z0 + z1) / 2;
        box(w, .4, d, sx, F.y, sz, palette.sectional);
        box(w - .04, .14, d - .3, sx + (backSide === 'x-' ? .14 : 0), F.y + .4, sz + (backSide === 'z+' ? -.14 : 0), palette.sectional);
        if (backSide === 'z+') box(w, .5, .24, sx, F.y + .32, z1 - .12, palette.sectional);
        if (backSide === 'x-') box(.24, .5, d, x0 + .12, F.y + .32, sz, palette.sectional);
      };
      if (layout === 'side') {
        // Sectional along the left wall, chaise toward the front windows, TV on the hallway wall.
        seat(-3.8, .0, -2.85, 3.2, 'x-');
        seat(-2.85, 2.25, -1.75, 3.2, 'z+');
        box(.95, .3, .22, -2.3, F.y + .4, 3.2 - .11, palette.sectional);
        box(.22, .3, .95, -2.85 + .11, F.y + .4, .45, palette.sectional);
        for (const z of [.5, 1.4, 2.3]) box(.14, .42, .5, -3.65, F.y + .55, z, palette.pillow);
        box(1.1, .12, 1.1, -1.5, F.y + .34, 1.3, palette.rustic);
        box(1.0, .34, 1.0, -1.5, F.y, 1.3, palette.rustic);
        box(1.8, .5, .42, .55, F.y, -.03, palette.rustic);
        box(1.6, .92, .04, .55, F.y + 1.05, -.06, black);
        box(1.2, .06, .1, .55, F.y + .52, -.04, black);
        lamp(1.65, 3.5);
        plant(-3.5, 3.55);
        drum(cx, F.ceil - .2, 1.8);
        return;
      }
      seat(-3.6, 2.9, -.4, 3.85, 'z+');
      box(.22, .3, .95, -.4 - .11, F.y + .4, 3.37, palette.sectional);
      seat(-3.6, 1.9, -2.65, 2.9, 'x-');
      box(.95, .3, .22, -3.12, F.y + .4, 1.9 + .11, palette.sectional);
      for (const x of [-3.1, -2.25, -1.35, -.65]) box(.5, .42, .14, x, F.y + .55, 3.7, palette.pillow);
      box(.5, .42, .14, -3.4, F.y + .55, 2.4, palette.pillow);
      box(1.1, .12, 1.1, -1.4, F.y + .34, 1.3, palette.rustic);
      box(1.0, .34, 1.0, -1.4, F.y, 1.3, palette.rustic);
      box(1.8, .5, .42, .55, F.y, -.03, palette.rustic);
      box(1.6, .92, .04, .55, F.y + 1.05, -.06, black);
      box(1.2, .06, .1, .55, F.y + .52, -.04, black);
      lamp(1.65, 3.5);
      plant(-3.5, .1);
      drum(cx, F.ceil - .2, 1.8);
    },
    hall(_, rugMat) { rug(.8, 2.6, 2.47, 1.6, F.y, rugMat); },
    dining(layout, rugMat) {
      const along = layout === 'window';
      const tx = along ? -2.95 : -2.2, tz = along ? -2.1 : -2.3, tw = along ? .95 : 1.7, td = along ? 1.7 : .95;
      rug(along ? 2.2 : 2.6, along ? 2.6 : 2.2, tx + (along ? .3 : 0), tz, F.y, rugMat);
      box(tw, .05, td, tx, F.y + .72, tz, palette.wood);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.06, .72, .06, tx + sx * (tw / 2 - .13), F.y, tz + sz * (td / 2 - .13), palette.wood);
      if (along) for (const z of [-2.55, -1.65]) chair(tx + .8, z, -Math.PI / 2);
      else for (const x of [-2.65, -1.75]) { chair(x, -1.65, Math.PI); chair(x, -2.95, 0); }
      plant(-3.55, -.65);
      box(.01, .95, .01, tx, F.ceil - .95, tz, black);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, .24, 24, 1, true), mat('#3a3f42', {side: THREE.DoubleSide}));
      shade.position.set(tx, F.ceil - 1.05, tz);
      parentGroup.add(shade);
    },
    kitchen(_, __, k) {
      const appliance = steel, navyLike = counterMaterial(k.counter), grate = mat('#2a2c2e', {roughness: .7});
      const ovenGlass = mat('#3a4247', {metalness: .3, roughness: .25}), knob = mat('#d8d9d6', {roughness: .4, metalness: .3});
      const rear = -INNER.z, right = INNER.x, depth = .6, h = .9, upperBottom = 1.5, upperTop = 2.4, upperDepth = .33;
      const kx0 = .5, sideEnd = -1.0;
      box(right + .32, .012, INNER.z - .32, (right - .32) / 2, F.y, (rear - .32) / 2, kitchenFloorMaterial(k.floor)).castShadow = false;
      // Beadboard backsplash, cut around the window over the sink.
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
      const bead = texture(beadCanvas);
      bead.wrapS = bead.wrapT = THREE.RepeatWrapping;
      const beadboard = len => { const t = bead.clone(); t.repeat.set(len / .32, 1); t.needsUpdate = true; return new THREE.MeshStandardMaterial({map: t, roughness: .6}); };
      const winX = [2.25, 3.05], sill = 2.15 - F.y;
      box(winX[0] - kx0, upperBottom - h, .02, (kx0 + winX[0]) / 2, F.y + h, rear + .01, beadboard(winX[0] - kx0));
      box(right - winX[1], upperBottom - h, .02, (winX[1] + right) / 2, F.y + h, rear + .01, beadboard(right - winX[1]));
      box(winX[1] - winX[0], sill - h, .02, (winX[0] + winX[1]) / 2, F.y + h, rear + .01, beadboard(winX[1] - winX[0]));
      box(.02, upperBottom - h, sideEnd - rear, right - .01, F.y + h, (rear + sideEnd) / 2, beadboard(sideEnd - rear));
      const rangeX = [.95, 1.71], dishX = [1.71, 2.31], sinkX = [2.31, 3.11];
      const baseCab = (x0, x1) => {
        box(x1 - x0, h - .1, depth, (x0 + x1) / 2, F.y + .1, rear + depth / 2, cabinet);
        box(x1 - x0, .1, depth - .08, (x0 + x1) / 2, F.y, rear + depth / 2 + .04, grate);
        box(.02, .02, .02, (x0 + x1) / 2, F.y + .62, rear + depth + .01, knob);
      };
      baseCab(kx0, rangeX[0]);
      baseCab(sinkX[0], sinkX[1]);
      baseCab(sinkX[1], right);
      box(right - rangeX[1] + .02, .04, depth + .03, (rangeX[1] + right) / 2, F.y + h, rear + depth / 2 + .015, navyLike);
      box(rangeX[0] - kx0 + .02, .04, depth + .03, (kx0 + rangeX[0]) / 2, F.y + h, rear + depth / 2 + .015, navyLike);
      box(depth, h - .1, sideEnd - rear - depth, right - depth / 2, F.y + .1, (rear + depth + sideEnd) / 2, cabinet);
      box(depth - .08, .1, sideEnd - rear - depth, right - depth / 2 - .04, F.y, (rear + depth + sideEnd) / 2, grate);
      box(depth + .03, .04, sideEnd - rear - depth + .02, right - depth / 2 - .015, F.y + h, (rear + depth + sideEnd) / 2, navyLike);
      for (const z of [-2.9, -1.8]) box(.02, .02, .02, right - depth - .01, F.y + .62, z, knob);
      box(.5, .3, .38, right - .3, F.y + h + .04, -2.75, appliance); // microwave
      box(.36, .2, .01, right - .55, F.y + h + .09, -2.75, ovenGlass);
      // Sink under the rear window.
      box(.56, .18, .42, (sinkX[0] + sinkX[1]) / 2, F.y + h - .14, rear + depth / 2, steel);
      box(.44, .14, .32, (sinkX[0] + sinkX[1]) / 2, F.y + h - .1, rear + depth / 2, mat('#9da4a7', {metalness: .6, roughness: .35}));
      box(.02, .22, .02, (sinkX[0] + sinkX[1]) / 2, F.y + h + .04, rear + .12, steel);
      box(.02, .02, .18, (sinkX[0] + sinkX[1]) / 2, F.y + h + .25, rear + .2, steel);
      // Dishwasher.
      box(dishX[1] - dishX[0] - .02, h - .04, depth, (dishX[0] + dishX[1]) / 2, F.y + .02, rear + depth / 2, appliance);
      box(dishX[1] - dishX[0] - .1, .05, .01, (dishX[0] + dishX[1]) / 2, F.y + h - .1, rear + depth + .005, grate);
      box(dishX[1] - dishX[0] - .02, .04, depth + .03, (dishX[0] + dishX[1]) / 2, F.y + h, rear + depth / 2 + .015, navyLike);
      // Four-burner range.
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
      // French-door refrigerator in its alcove on the dining-room wall, facing the kitchen.
      const aZ = [-2.6, -1.75], aX = .5, az = (aZ[0] + aZ[1]) / 2, fw = aZ[1] - aZ[0] - .06, fx = -.33 + .38;
      box(.72, 1.78, fw, fx, F.y, az, appliance);
      box(.01, .01, fw - .04, fx + .365, F.y + .68, az, grate);           // freezer drawer line
      box(.01, 1.08, .01, fx + .365, F.y + .7, az, grate);                 // split between the doors
      for (const s of [-1, 1]) box(.025, .7, .025, fx + .385, F.y + .88, az + s * .07, knob);
      box(.4, .025, .025, fx + .385, F.y + .4, az, knob);
      box(aX + .33, upperTop - 1.85, aZ[1] - aZ[0] - .02, (aX - .33) / 2, F.y + 1.85, az, cabinet);
      box(.02, .02, .02, aX + .01, F.y + 1.95, az, knob);
      box(aX + .33, F.ceil - F.y - upperTop, aZ[1] - aZ[0] + .1, (aX - .33) / 2, F.y + upperTop, az, paintFor('kitchen'));
      box(.06, F.ceil - F.y - upperTop, aZ[1] - aZ[0] + .16, aX + .01, F.y + upperTop, az, trim);
      // Upper cabinets and hood.
      const upper = (x0, x1, y0 = upperBottom) => {
        box(x1 - x0, upperTop - y0, upperDepth, (x0 + x1) / 2, F.y + y0, rear + upperDepth / 2, cabinet);
        box(.005, upperTop - y0 - .08, .01, (x0 + x1) / 2, F.y + y0 + .04, rear + upperDepth + .003, mat('#d9d6cc'));
        for (const dx of [-.06, .06]) box(.02, .02, .02, (x0 + x1) / 2 + dx, F.y + y0 + .1, rear + upperDepth + .01, knob);
      };
      upper(kx0, rangeX[0]);
      upper(rangeX[0], rangeX[1], 1.75);
      box(rangeX[1] - rangeX[0], .12, upperDepth + .1, rx, F.y + 1.62, rear + (upperDepth + .1) / 2, appliance);
      upper(rangeX[1], winX[0] - .02);
      upper(winX[1] + .02, right);
      box(upperDepth, upperTop - upperBottom, sideEnd - rear - upperDepth, right - upperDepth / 2, F.y + upperBottom, (rear + upperDepth + sideEnd) / 2, cabinet);
      for (const z of [-3.2, -2.0]) for (const dz of [-.06, .06]) box(.02, .02, .02, right - upperDepth - .01, F.y + upperBottom + .1, z + dz, knob);
      box(right - kx0, .06, upperDepth + .02, (right + kx0) / 2, F.y + upperTop, rear + upperDepth / 2, cabinet);
      // Optional small island in the middle of the room.
      if (k.island === 'small') {
        box(1.2, h - .1, .7, 1.9, F.y + .1, -2.1, cabinet);
        box(1.12, .1, .62, 1.9, F.y, -2.1, grate);
        box(1.3, .04, .8, 1.9, F.y + h, -2.1, navyLike);
        for (const dx of [-.3, .3]) box(.02, .02, .02, 1.9 + dx, F.y + .62, -2.1 + .36, knob);
        for (const dx of [-.3, .3]) {
          box(.36, .04, .36, 1.9 + dx, F.y + .66, -2.7, palette.wood);
          for (const sx of [-.14, .14]) for (const sz of [-.14, .14]) box(.03, .66, .03, 1.9 + dx + sx, F.y, -2.7 + sz, palette.wood);
        }
      }
    },
    hall2(_, rugMat) { rug(2.2, .8, 1.3, -1.25, S.y, rugMat); plant(3.6, -1.9, S.y); },
    bedBack(layout, rugMat) {
      rug(2.4, 2.4, -2.1, -2.1, S.y, rugMat);
      if (layout === 'back') { bed(-2.9, -3.8, -1.3, -1.8, 'z-', palette.quilt); nightstand(-3.3, -3.5); nightstand(-.9, -3.5); dresser(-3.55, -1.0, 1.1, .5, S.y, Math.PI / 2); }
      else { bed(-3.8, -3.8, -2.2, -1.8, 'x-', palette.quilt); nightstand(-3.55, -1.5); dresser(-1.2, -3.6, 1.1, .5); }
    },
    bedFrontL(layout, rugMat) {
      rug(2.6, 2.4, -2.1, 2.3, S.y, rugMat);
      if (layout === 'front') { bed(-3.2, 1.9, -1.6, 3.8, 'z+', palette.quiltWarm); nightstand(-3.55, 3.55); nightstand(-1.25, 3.55); dresser(-3.55, 1.3, 1.1, .5, S.y, Math.PI / 2); }
      else { bed(-3.8, 1.6, -1.8, 3.2, 'x-', palette.quiltWarm); nightstand(-3.55, 3.5); nightstand(-3.55, 1.3); dresser(.35, 3.0, 1.1, .5, S.y, Math.PI / 2); }
    },
    bedFrontR(layout, rugMat) {
      rug(2.0, 2.0, 2.0, 2.6, S.y, rugMat);
      if (layout === 'front') { bed(1.4, 2.15, 3.0, 3.85, 'z+', palette.quilt); nightstand(1.05, 3.55); dresser(3.5, 2.75, 1, .45, S.y, -Math.PI / 2); }
      else { bed(1.7, 2.3, 3.8, 3.8, 'x+', palette.quilt); nightstand(1.45, 3.5); dresser(2.72, 1.2, 1, .45, S.y, -Math.PI / 2); }
    },
    bath() {},
    loft(layout, rugMat) {
      if (layout === 'front') {
        rug(1.9, 1.6, -.4, -1.5, L.y + .02, rugMat);
        bed(-1.3, 1.8, .3, 3.8, 'z+', palette.quiltWarm, L.y);
        nightstand(.7, 3.5, L.y);
        box(1.1, .04, .55, -.8, L.y + .72, -3.45, palette.wood);
        for (const sx of [-.5, .5]) for (const sz of [-.22, .22]) box(.04, .72, .04, -.8 + sx, L.y, -3.45 + sz, palette.wood);
        chair(-.8, -2.85, 0, L.y);
        lamp(-1.5, -1, L.y);
        return;
      }
      rug(1.9, 1.6, -.4, 2.3, L.y + .02, rugMat);
      bed(-1.3, -3.8, .3, -1.8, 'z-', palette.quiltWarm, L.y);
      nightstand(.7, -3.5, L.y);
      box(1.1, .04, .55, -.8, L.y + .72, 3.45, palette.wood);
      for (const sx of [-.5, .5]) for (const sz of [-.22, .22]) box(.04, .72, .04, -.8 + sx, L.y, 3.45 + sz, palette.wood);
      chair(-.8, 2.85, Math.PI, L.y);
      lamp(-1.5, 1, L.y);
    },
  };

  const design = loadDesign();
  const roomChoice = (id, key) => (design.rooms[id] || {})[key] || roomDefaults[id]?.[key];
  function rebuildRoom(id) {
    let g = roomGroups[id];
    if (!g) {
      g = new THREE.Group();
      g.name = 'Furniture · ' + id;
      g.userData.dynamic = true; // merged on its own, never into the static interior
      group.add(g);
      roomGroups[id] = g;
    }
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    g.clear();
    parentGroup = g;
    builders[id](roomChoice(id, 'layout'), rugMaterial(roomChoice(id, 'rug') || 'none'), design.kitchen);
    parentGroup = group;
    mergeStatic(g);
  }
  function applyWalls() {
    for (const r of ROOMS) paintFor(r.id).color.set((WALL_BY_ID[roomChoice(r.id, 'wall')] || WALL_COLORS[0]).color);
    defaultPaint.color.set(WALL_COLORS[0].color);
  }
  function applyAll() {
    floorMat.color.set((FLOOR_BY_ID[design.flooring] || FLOORING[0]).color);
    applyStyle(design.style);
    applyWalls();
    for (const id of Object.keys(builders)) rebuildRoom(id);
  }
  applyAll();

  // Warm room lights plus a soft fill; only meaningful once the camera is inside.
  const lights = [];
  const addLight = (x, y, z, max) => {
    const l = new THREE.PointLight('#ffe0bd', 0, 10, 2);
    l.position.set(x, y, z);
    l.userData.max = max;
    group.add(l);
    lights.push(l);
  };
  for (const [x, z] of [[2.45, 2.0], [-1.0, 1.7], [-2.1, -2.1], [1.8, -2.0]]) addLight(x, F.ceil - .3, z, 22);
  for (const [x, z] of [[1.5, -1.25], [-2.1, -2.1], [-1.6, 2.2], [2.0, 2.2], [2.75, -3.0]]) addLight(x, S.ceil - .3, z, 13);
  addLight(-.4, L.y + 2.1, 0, 18);
  const fill = new THREE.AmbientLight('#fff4e6', 0);
  fill.userData.max = .6;
  group.add(fill);
  lights.push(fill);

  // ---- Navigation graph --------------------------------------------------------------
  const nodeById = byId(NODES);
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
    if (!d) return;
    // A French pair is two hinges that swing in mirror.
    (Array.isArray(d) ? d : [d]).forEach((hinge, i) => { hinge.rotation.y = (i === 1 ? -1 : 1) * 1.75 * k; });
  }
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
    designPanel.setRoom(node.room, roomName(node));
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

  // ---- Room list, design panel, entering and leaving ---------------------------------------------
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
  const designPanel = createDesignPanel({
    root: $('#design-panel'), design, roomDefaults: id => roomDefaults[id] || {wall: 'dove'},
    hooks: {
      flooring: id => { floorMat.color.set(FLOOR_BY_ID[id].color); if (design.kitchen.floor !== 'checker') rebuildRoom('kitchen'); saveDesign(design); },
      style: id => { applyStyle(id); saveDesign(design); },
      wall: () => { applyWalls(); saveDesign(design); },
      rug: id => { rebuildRoom(id); saveDesign(design); },
      layout: id => { rebuildRoom(id); saveDesign(design); },
      kitchen: () => { rebuildRoom('kitchen'); saveDesign(design); },
      reset: () => { applyAll(); saveDesign(design); },
    },
  });
  for (const tab of document.querySelectorAll('.panel-tabs button')) tab.onclick = () => {
    for (const t of document.querySelectorAll('.panel-tabs button')) t.setAttribute('aria-pressed', String(t === tab));
    $('#room-chips').hidden = tab.dataset.tab !== 'rooms';
    $('#design-panel').hidden = tab.dataset.tab !== 'design';
  };

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
