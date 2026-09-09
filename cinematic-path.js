// A time-based camera track shared by the interactive film and deterministic video export.
// Stations pass through the real front door and cased openings; no cuts through partitions.
export const FILM_DURATION = 20;
export const FILM_STATIONS = [
  {t:0, p:[2.72,2.65,5.4], look:[2.5,2.48,2.3]},
  {t:2, p:[2.72,2.65,4.45], look:[2.45,2.48,1.7]},
  {t:4, p:[2.5,2.65,2.75], look:[.1,2.25,1.8]},
  {t:6, p:[1.25,2.62,2.05], look:[-1.65,2.1,2.65]},
  {t:8, p:[-.05,2.62,1.55], look:[-1.9,2.05,2.65]},
  {t:9, p:[-.2,2.62,1.4], look:[-1.9,2.1,2.3]},
  {t:11, p:[-1.5,2.65,.15], look:[-1.8,2.2,-1.6]},
  {t:12, p:[-1.5,2.65,-.8], look:[-.4,2.15,-1.35]},
  {t:13.5, p:[-.75,2.65,-1.3], look:[1.35,2.22,-2.2]},
  {t:15, p:[.6,2.65,-1.3], look:[1.9,2.2,-3.35]},
  {t:17, p:[1.25,2.65,-2.15], look:[2.45,2.15,-3.65]},
  {t:20, p:[1.35,2.65,-2.5], look:[2.2,2.2,-3.75]},
];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
// Monotone Hermite tangents prevent overshoot around doorway edges.
function tangent(index, key, axis) {
  if (index === 0 || index === FILM_STATIONS.length - 1) return 0;
  const a=FILM_STATIONS[index-1], b=FILM_STATIONS[index], c=FILM_STATIONS[index+1];
  const left=(b[key][axis]-a[key][axis])/(b.t-a.t), right=(c[key][axis]-b[key][axis])/(c.t-b.t);
  return left*right <= 0 ? 0 : 2*left*right/(left+right);
}
export function filmPose(seconds) {
  const time=clamp(seconds,0,FILM_DURATION);
  let i=0; while(i<FILM_STATIONS.length-2 && time>FILM_STATIONS[i+1].t) i++;
  const a=FILM_STATIONS[i], b=FILM_STATIONS[i+1], span=b.t-a.t, u=(time-a.t)/span;
  const h00=2*u*u*u-3*u*u+1, h10=u*u*u-2*u*u+u, h01=-2*u*u*u+3*u*u, h11=u*u*u-u*u;
  const sample=key=>a[key].map((v,axis)=>h00*v+h10*span*tangent(i,key,axis)+h01*b[key][axis]+h11*span*tangent(i+1,key,axis));
  return {position:sample('p'),target:sample('look'),fov:57,door:clamp(time/1.4,0,1)};
}
export function filmChapter(seconds) {
  if(seconds<4.5) return {number:'01',title:'An invitation inside',subtitle:'22 Budd Street'};
  if(seconds<10) return {number:'02',title:'Room to settle in',subtitle:'Living room · Pale Oak OC-20'};
  if(seconds<14.4) return {number:'03',title:'A connected home',subtitle:'Dining room · Pale Oak OC-20'};
  return {number:'04',title:'The heart of the house',subtitle:'Kitchen · Seapearl OC-19'};
}
