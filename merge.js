// Merges the static meshes under a group into one mesh per material, so a scene built from
// thousands of small boxes costs a few dozen draw calls instead of thousands.
// Skips meshes with per-face material arrays and anything under a group marked
// `userData.dynamic` (hinged doors), which must keep moving independently.
import * as THREE from 'three';

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const merged = [];

  // Appends one mesh's vertices (a subset of its index range) to the bucket for `material`.
  function append(o, material, indexStart, indexCount) {
    const key = material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + o.renderOrder;
    let b = buckets.get(key);
    if (!b) {
      b = {material, castShadow: o.castShadow, receiveShadow: o.receiveShadow, renderOrder: o.renderOrder, position: [], normal: [], uv: [], index: [], count: 0};
      buckets.set(key, b);
    }
    const g = o.geometry, local = new THREE.Matrix4().multiplyMatrices(rootInverse, o.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(local);
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(local);
      b.position.push(v.x, v.y, v.z);
      if (nor) {
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        b.normal.push(v.x, v.y, v.z);
      } else b.normal.push(0, 1, 0);
      if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
    }
    const end = indexStart + indexCount;
    if (g.index) for (let i = indexStart; i < end; i++) b.index.push(g.index.getX(i) + b.count);
    else for (let i = indexStart; i < end; i++) b.index.push(i + b.count);
    b.count += pos.count;
  }

  root.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
    const g = o.geometry, total = g.index ? g.index.count : g.attributes.position.count;
    if (Array.isArray(o.material)) {
      // Per-face materials: each geometry group goes to its own material's bucket.
      for (const grp of g.groups) append(o, o.material[grp.materialIndex], grp.start, grp.count === Infinity ? total - grp.start : grp.count);
    } else append(o, o.material, 0, total);
    merged.push(o);
  });

  for (const o of merged) {
    o.parent.remove(o);
    o.geometry.dispose();
  }
  for (const b of buckets.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setIndex(b.index);
    const mesh = new THREE.Mesh(g, b.material);
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = b.receiveShadow;
    mesh.renderOrder = b.renderOrder;
    root.add(mesh);
  }
  return buckets.size;
}
