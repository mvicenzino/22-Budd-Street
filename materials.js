import * as THREE from 'three';

// Small deterministic microtextures keep the static model self-contained and offline-ready.
export function surfaceTexture(renderer, kind, repeat) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const data = context.createImageData(256, 256);
  let seed = 7309;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    const noise = random();
    let value = 212 + noise * 34;
    if (kind === 'roof') value -= y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 1 ? 48 : 0;
    if (kind === 'lawn') value = 210 + noise * 35 + 9 * Math.sin(x * .13) * Math.sin(y * .11);
    if (kind === 'oak') value = 228 + noise * 9 + 7 * Math.sin(y * 1.3 + Math.sin(x * .045) * 2) + 4 * Math.sin(y * .21 + Math.sin(x * .02));
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
    data.data[i + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
