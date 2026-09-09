// Rendering polish: HDR scene pass, screen-space ambient occlusion, and a final composite with
// tone mapping and a soft vignette. Also builds the procedural sky environment used for reflections.
import * as THREE from 'three';

// Photographed sky (Poly Haven "Kloofendal 48d partly cloudy", CC0), used as the backdrop and,
// pre-filtered, as the light source for reflections. `sunAzimuth` is the compass angle of the
// scene's sun light so the photo's sun sits in the same direction.
export function loadSkyPhoto(renderer, scene, url, sunAzimuth) {
  new THREE.TextureLoader().load(url, tex => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    const PHOTO_SUN = .565; // azimuth of the sun in this panorama
    const rotation = sunAzimuth - PHOTO_SUN;
    scene.environment?.dispose();
    scene.environment = env;
    scene.environmentRotation.set(0, rotation, 0);
    scene.background = tex;
    scene.backgroundRotation.set(0, rotation, 0);
    scene.backgroundBlurriness = .015;
  });
}

// A gentle sky-and-ground gradient, used until the photo arrives.
export function skyEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#6f9dd1');
  sky.addColorStop(.42, '#cfe1f3');
  sky.addColorStop(.5, '#f3efe4');
  sky.addColorStop(.53, '#8f9a7c');
  sky.addColorStop(1, '#4e5a48');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  // A soft sun glow so glossy surfaces pick up a highlight.
  const glow = g.createRadialGradient(300, 150, 0, 300, 150, 140);
  glow.addColorStop(0, 'rgba(255,248,230,.95)');
  glow.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

const fullscreenVertex = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Ambient occlusion from the depth buffer alone: view-space position from depth, normals from
// derivatives, a small rotated hemisphere kernel, range-checked.
const aoFragment = /* glsl */`
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tDepth;
  uniform vec2 resolution;
  uniform float near, far, radius, intensity;
  uniform mat4 projection, inverseProjection;
  float readDepth(vec2 uv) { return unpackRGBAToDepth(texture2D(tDepth, uv)); }
  vec3 viewPos(vec2 uv) {
    float d = readDepth(uv);
    vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 v = inverseProjection * clip;
    return v.xyz / v.w;
  }
  float ign(vec2 p) { return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }
  void main() {
    float d = readDepth(vUv);
    if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
    vec3 p = viewPos(vUv);
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    float angle = ign(gl_FragCoord.xy) * 6.2831853;
    vec3 rnd = vec3(cos(angle), sin(angle), ign(gl_FragCoord.yx + 17.0) * 2.0 - 1.0);
    vec3 t = normalize(rnd - n * dot(rnd, n));
    vec3 b = cross(n, t);
    mat3 tbn = mat3(t, b, n);
    const int SAMPLES = AO_SAMPLES;
    float occlusion = 0.0;
    for (int i = 0; i < SAMPLES; i++) {
      float fi = float(i) + 0.5;
      float phi = fi * 2.3999632;
      float r = sqrt(fi / float(SAMPLES));
      vec3 s = tbn * vec3(cos(phi) * r * 0.85, sin(phi) * r * 0.85, 0.35 + 0.65 * (1.0 - r));
      vec3 sp = p + s * radius;
      vec4 clip = projection * vec4(sp, 1.0);
      vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
      float sceneZ = viewPos(suv).z;
      float rangeCheck = smoothstep(0.0, 1.0, radius / max(abs(p.z - sceneZ), 0.0001));
      occlusion += (sceneZ >= sp.z + 0.035 ? 1.0 : 0.0) * rangeCheck;
    }
    float ao = 1.0 - intensity * occlusion / float(SAMPLES);
    gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
  }`;

// Depth-aware Gaussian blur of the occlusion, run once horizontally and once vertically.
const blurFragment = /* glsl */`
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tAO, tDepth;
  uniform vec2 direction;
  uniform float cameraNear, cameraFar;
  float linearDepth(vec2 uv) {
    float d = unpackRGBAToDepth(texture2D(tDepth, uv));
    return perspectiveDepthToViewZ(d, cameraNear, cameraFar);
  }
  void main() {
    float d0 = linearDepth(vUv);
    float weights[5];
    weights[0] = 0.227; weights[1] = 0.194; weights[2] = 0.121; weights[3] = 0.054; weights[4] = 0.016;
    float sum = texture2D(tAO, vUv).r * weights[0], total = weights[0];
    for (int i = 1; i < 5; i++) {
      vec2 o = direction * float(i);
      for (int s = -1; s <= 1; s += 2) {
        vec2 uv = vUv + o * float(s);
        float d = linearDepth(uv);
        float w = weights[i] * exp(-abs(d - d0) / max(0.025, abs(d0) * 0.007));
        sum += texture2D(tAO, uv).r * w;
        total += w;
      }
    }
    gl_FragColor = vec4(vec3(sum / total), 1.0);
  }`;

// Multiply the blurred AO into the HDR colour, then tone-map, convert to sRGB and vignette.
const compositeFragment = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor, tAO;
  uniform float vignette;
  void main() {
    float ao = texture2D(tAO, vUv).r;
    vec4 color = texture2D(tColor, vUv);
    color.rgb *= ao;
    gl_FragColor = color;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec2 q = vUv - 0.5;
    gl_FragColor.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, dot(q, q) * 2.0);
  }`;

export function createPostPipeline(renderer, {aoRadius = .5, aoIntensity = .8, vignette = .12} = {}) {
  const size = new THREE.Vector2();
  const hdrType = renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const colorRT = new THREE.WebGLRenderTarget(1, 1, {type: hdrType, samples: Math.min(4, renderer.capabilities.maxSamples), colorSpace: THREE.LinearSRGBColorSpace});
  const depthRT = new THREE.WebGLRenderTarget(1, 1, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
  const aoRT = new THREE.WebGLRenderTarget(1, 1, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter});
  const blurRT = new THREE.WebGLRenderTarget(1, 1, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter});
  const depthMaterial = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
  const aoMaterial = new THREE.ShaderMaterial({
    defines: {AO_SAMPLES: 24},
    vertexShader: fullscreenVertex, fragmentShader: aoFragment, depthTest: false, depthWrite: false,
    uniforms: {tDepth: {value: depthRT.texture}, resolution: {value: new THREE.Vector2()}, near: {value: .1}, far: {value: 100}, radius: {value: aoRadius}, intensity: {value: aoIntensity}, projection: {value: new THREE.Matrix4()}, inverseProjection: {value: new THREE.Matrix4()}},
  });
  const blurMaterial = new THREE.ShaderMaterial({
    vertexShader: fullscreenVertex, fragmentShader: blurFragment, depthTest: false, depthWrite: false,
    uniforms: {tAO: {value: aoRT.texture}, tDepth: {value: depthRT.texture}, direction: {value: new THREE.Vector2()}, cameraNear: {value: .1}, cameraFar: {value: 180}},
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    vertexShader: fullscreenVertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false,
    uniforms: {tColor: {value: colorRT.texture}, tAO: {value: aoRT.texture}, vignette: {value: vignette}},
  });
  const quadScene = new THREE.Scene(), quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aoMaterial);
  quad.frustumCulled = false;
  quadScene.add(quad);
  let aoScale = .75;
  const OVERLAY = 1; // layer 1 holds overlays that must not occlude (navigation arrows)

  function resize() {
    renderer.getDrawingBufferSize(size);
    colorRT.setSize(size.x, size.y);
    depthRT.setSize(size.x, size.y);
    aoRT.setSize(Math.max(1, Math.round(size.x * aoScale)), Math.max(1, Math.round(size.y * aoScale)));
    blurRT.setSize(aoRT.width, aoRT.height);
    aoMaterial.uniforms.resolution.value.set(size.x, size.y);
  }
  function setQuality(profile) {
    const samples = Math.min(profile.samples, renderer.capabilities.maxSamples);
    if (colorRT.samples !== samples) { colorRT.samples = samples; colorRT.dispose(); }
    aoScale = profile.aoScale;
    aoMaterial.defines.AO_SAMPLES = profile.name === 'high' ? 32 : profile.name === 'light' ? 8 : 16;
    aoMaterial.needsUpdate = true;
    resize();
  }
  function render(scene, camera) {
    renderer.getDrawingBufferSize(size);
    if (colorRT.width !== size.x || colorRT.height !== size.y) resize();
    const background = scene.background, fog = scene.fog, override = scene.overrideMaterial;
    const layers = camera.layers.mask;
    const autoShadow = renderer.shadowMap.autoUpdate, updateShadow = renderer.shadowMap.needsUpdate;
    const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    // Glass must not turn into an opaque occluder when we override its material for depth.
    const transparent = [];
    scene.traverse(o => {
      if (o.isMesh && o.visible && !Array.isArray(o.material) && o.material.transparent && !o.material.depthWrite) {
        transparent.push(o); o.visible = false;
      }
    });
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    // 1. depth of everything except overlays
    camera.layers.set(0);
    scene.overrideMaterial = depthMaterial;
    scene.background = null;
    scene.fog = null;
    renderer.setRenderTarget(depthRT);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = override;
    transparent.forEach(o => { o.visible = true; });
    renderer.shadowMap.autoUpdate = autoShadow;
    renderer.shadowMap.needsUpdate = updateShadow;
    renderer.setClearColor(clear, alpha);
    scene.background = background;
    scene.fog = fog;
    camera.layers.mask = layers;
    camera.layers.enable(OVERLAY);
    // 2. HDR colour
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);
    // 3. ambient occlusion at half resolution
    aoMaterial.uniforms.near.value = camera.near;
    aoMaterial.uniforms.far.value = camera.far;
    aoMaterial.uniforms.projection.value.copy(camera.projectionMatrix);
    aoMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    quad.material = aoMaterial;
    renderer.setRenderTarget(aoRT);
    renderer.render(quadScene, quadCamera);
    // 4. blur the occlusion horizontally then vertically
    blurMaterial.uniforms.cameraNear.value = camera.near;
    blurMaterial.uniforms.cameraFar.value = camera.far;
    quad.material = blurMaterial;
    blurMaterial.uniforms.tAO.value = aoRT.texture;
    blurMaterial.uniforms.direction.value.set(1.5 / aoRT.width, 0);
    renderer.setRenderTarget(blurRT);
    renderer.render(quadScene, quadCamera);
    blurMaterial.uniforms.tAO.value = blurRT.texture;
    blurMaterial.uniforms.direction.value.set(0, 1.5 / aoRT.height);
    renderer.setRenderTarget(aoRT);
    renderer.render(quadScene, quadCamera);
    // 5. composite to the screen
    quad.material = compositeMaterial;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCamera);
    camera.layers.mask = layers;
  }
  return {render, resize, setQuality, OVERLAY, aoMaterial, compositeMaterial};
}
