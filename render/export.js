import * as THREE from 'three';
import {FILM_CHAPTERS,FILM_DURATION,filmChapter,filmPose} from '../cinematic-path.js';

// Loaded only with ?render=1 by scripts/render-film.mjs. No uploads or server-side writes.
export async function createExport({scene,camera,renderer,post,cinema}) {
  if(!cinema.start({manual:true}))throw new Error('The scene is busy');
  document.body.dataset.export='true';
  document.getElementById('loading').hidden=true;
  const deadline=performance.now()+15000;
  while(!scene.background?.isTexture){if(performance.now()>deadline)throw new Error('Sky texture did not load');await new Promise(r=>setTimeout(r,50));}
  let tracer=null,traceScene=null,traceRenderer=null;
  let traceResources=[];
  const filmCanvas=document.createElement('canvas'),ink=filmCanvas.getContext('2d');
  const data=()=>renderer.domElement.toDataURL('image/png').split(',')[1];
  function configure(width,height){
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    post.setQuality({name:'high',samples:4,aoScale:1});
    post.aoMaterial.defines.AO_SAMPLES=48;post.aoMaterial.needsUpdate=true;
    filmCanvas.width=width;filmCanvas.height=height;
  }
  function raster(time,titles=false){
    cinema.seek(time);post.render(scene,camera);
    if(renderer.getContext().isContextLost())throw new Error('The video renderer lost its graphics context');
    if(!titles)return data();
    const w=filmCanvas.width,h=filmCanvas.height,s=w/1920,chapter=filmChapter(time);
    ink.globalAlpha=1;
    ink.drawImage(renderer.domElement,0,0,w,h);
    // The post compositor already fades the scene; only the typography needs its own fade.
    ink.globalAlpha=filmPose(time).opacity??1;
    const shade=ink.createLinearGradient(0,h*.57,0,h);shade.addColorStop(0,'#13251a00');shade.addColorStop(1,'#13251aa6');
    ink.fillStyle=shade;ink.fillRect(0,0,w,h);
    ink.fillStyle='#f9f6e9';ink.font=`${44*s}px Georgia`;ink.fillText('22',64*s,76*s);
    ink.font=`${12*s}px Arial`;ink.letterSpacing=`${3*s}px`;ink.fillText('BUDD STREET',132*s,67*s);
    ink.font=`${12*s}px Arial`;ink.fillText(chapter.number+' / A WALK THROUGH HOME',64*s,h-176*s);
    ink.letterSpacing='0px';ink.font=`${56*s}px Georgia`;ink.fillText(chapter.title,62*s,h-111*s);
    ink.font=`${18*s}px Arial`;ink.fillText(chapter.subtitle,64*s,h-66*s);
    ink.fillStyle='#f1efdb66';ink.fillRect(64*s,h-32*s,w-128*s,2*s);ink.fillStyle='#f1efdb';ink.fillRect(64*s,h-32*s,(w-128*s)*time/FILM_DURATION,2*s);
    ink.globalAlpha=1;
    return filmCanvas.toDataURL('image/png').split(',')[1];
  }
  async function prepareTrace(time){
    disposeTrace();
    cinema.seek(time);
    const {WebGLPathTracer}=await import('./pathtracer.js');
    traceScene=scene.clone(true);
    const skyCanvas=document.createElement('canvas');skyCanvas.width=1024;skyCanvas.height=512;
    const skyInk=skyCanvas.getContext('2d');skyInk.drawImage(scene.background.image,0,0,1024,512);
    const pixels=skyInk.getImageData(0,0,1024,512).data,linear=new Float32Array(pixels.length);
    for(let i=0;i<pixels.length;i++){const v=pixels[i]/255;linear[i]=i%4===3?1:v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}
    const sky=new THREE.DataTexture(linear,1024,512,THREE.RGBAFormat,THREE.FloatType);sky.mapping=THREE.EquirectangularReflectionMapping;sky.needsUpdate=true;
    traceResources.push(sky);
    traceScene.environment=sky;traceScene.background=sky;
    traceScene.environmentIntensity=1.8;
    traceScene.fog=null;
    const materials=new Map(),practicalLights=[];
    traceScene.updateMatrixWorld(true);
    traceScene.traverse(o=>{
      if(o.isPointLight&&o.userData.max){
        const position=o.getWorldPosition(new THREE.Vector3());
        practicalLights.push({position,color:o.color.clone(),power:o.userData.max});
      }
      if(o.isPointLight||o.isAmbientLight||o.isHemisphereLight)o.visible=false;
      if(!o.isMesh)return;
      if(!o.layers.test(camera.layers)||o.material?.isMeshBasicMaterial){o.visible=false;return;}
      const physical=m=>{
        if(materials.has(m))return materials.get(m);
        const clone=m.clone();
        traceResources.push(clone);
        // Use the geometric floor normal; the raster normal map can self-shadow in the tracer.
        if(m.clearcoat>0){clone.normalMap=null;clone.clearcoat=0;clone.side=THREE.DoubleSide;}
        // Architectural glazing should transmit light in the export, not occlude it.
        if(m.transparent&&m.opacity<.65){clone.color.set('#fafcfb');clone.metalness=0;clone.roughness=.14;clone.opacity=.08;clone.depthWrite=false;}
        materials.set(m,clone);return clone;
      };
      o.material=Array.isArray(o.material)?o.material.map(physical):physical(o.material);
    });
    // Broad sources follow the existing fixtures on every floor, including the basement.
    for(const {position,color,power}of practicalLights){
      const light=new THREE.RectAreaLight(color,power*65/12,.55,.55);
      light.position.copy(position);light.lookAt(position.x,position.y-1,position.z);traceScene.add(light);
    }
    traceRenderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});
    traceRenderer.setSize(renderer.domElement.width,renderer.domElement.height,false);
    traceRenderer.toneMapping=renderer.toneMapping;traceRenderer.toneMappingExposure=renderer.toneMappingExposure;traceRenderer.outputColorSpace=renderer.outputColorSpace;
    tracer=new WebGLPathTracer(traceRenderer);
    tracer.renderDelay=0;tracer.minSamples=1;tracer.fadeDuration=0;tracer.dynamicLowRes=false;tracer.rasterizeScene=false;
    tracer.bounces=5;tracer.filterGlossyFactor=.5;tracer.tiles.set(1,1);tracer.stableNoise=true;
    tracer.textureSize.set(512,512);
    tracer.renderToCanvasCallback=(_target,renderer,quad)=>{
      renderer.setRenderTarget(null);renderer.setScissorTest(false);
      quad.material.depthTest=false;quad.material.depthWrite=false;
      renderer.clear();quad.render(renderer);
    };
    tracer.setScene(traceScene,camera);
  }
  function disposeTrace(){
    // v0.0.23's dispose() references an undefined _renderQuad. Releasing this dedicated
    // context frees every tracer GPU allocation without touching the interactive renderer.
    traceRenderer?.dispose();traceRenderer?.forceContextLoss();
    traceResources.forEach(resource=>resource.dispose());traceResources=[];
    tracer=null;traceScene=null;traceRenderer=null;
  }
  return {
    duration:FILM_DURATION,
    configure,
    info(){const gl=renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return {duration:FILM_DURATION,chapters:FILM_CHAPTERS,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'WebGL2'};},
    raster,
    async traceStart(time){await prepareTrace(time);},
    traceSamples(count){
      for(let i=0;i<count;i++)tracer.renderSample();
      const pixel=new Float32Array(4);
      traceRenderer.readRenderTargetPixels(tracer.target,Math.floor(tracer.target.width/2),Math.floor(tracer.target.height/2),1,1,pixel);
      if(traceRenderer.getContext().isContextLost()||!Array.from(pixel).every(Number.isFinite))throw new Error('The lighting render did not produce a valid frame');
      return {samples:tracer.samples,compiling:tracer.isCompiling};
    },
    traceImage(){tracer.renderSample();traceRenderer.getContext().finish();return traceRenderer.domElement.toDataURL('image/png').split(',')[1];},
    traceDispose:disposeTrace,
  };
}
