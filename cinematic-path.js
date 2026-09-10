// Deterministic camera choreography shared by the live player and video renderer.
// The opening follows real doorways. Room studies use concealed edits between floors.
export const FILM_DURATION = 90;
export const FILM_CHAPTERS = [
  {time:0, number:'01', title:'An invitation inside', subtitle:'Foyer · Pale Oak OC-20', floor:'first'},
  {time:4.5, number:'02', title:'Room to settle in', subtitle:'Living room · Pale Oak OC-20', floor:'first'},
  {time:10, number:'03', title:'A connected home', subtitle:'Dining room · Pale Oak OC-20', floor:'first', sampleTime:11.8},
  {time:14.4, number:'04', title:'The heart of the house', subtitle:'Kitchen · Seapearl OC-19', floor:'first'},
  {time:20, number:'05', title:'A little closer to outside', subtitle:'Sunroom · Seapearl OC-19', floor:'first'},
  {time:27, number:'06', title:'The quiet details', subtitle:'Powder room · Classic Gray OC-23', floor:'first'},
  {time:31, number:'07', title:'Upstairs, a slower rhythm', subtitle:'Upstairs hall · Pale Oak OC-20', floor:'second'},
  {time:37, number:'08', title:'A restful retreat', subtitle:'Back bedroom · Pale Oak OC-20', floor:'second'},
  {time:44, number:'09', title:'Soft light, warm oak', subtitle:'Front left bedroom · Pale Oak OC-20', floor:'second'},
  {time:51, number:'10', title:'Space to make your own', subtitle:'Front right bedroom · Pale Oak OC-20', floor:'second'},
  {time:58, number:'11', title:'A calm beginning', subtitle:'Upstairs bathroom · Classic Gray OC-23', floor:'second'},
  {time:64, number:'12', title:'A room above it all', subtitle:'Loft · Pale Oak OC-20', floor:'loft'},
  {time:76, number:'13', title:'Room for possibilities', subtitle:'Basement · Seapearl OC-19', floor:'basement'},
  {time:83, number:'14', title:'A home to grow into', subtitle:'Basement · 22 Budd Street', floor:'basement'},
];
const station = (t,p,look) => ({t,p,look});
export const FILM_SHOTS = [
  {floor:'first',fov:57,stations:[
    station(0,[2.72,2.65,5.4],[2.5,2.48,2.3]),
    station(2,[2.72,2.65,4.45],[2.45,2.48,1.7]),
    station(4,[2.5,2.65,2.75],[.1,2.25,1.8]),
    station(6,[1.25,2.62,2.05],[-1.65,2.1,2.65]),
    station(8,[-.05,2.62,1.55],[-1.9,2.05,2.65]),
    station(9,[-.2,2.62,1.4],[-1.9,2.1,2.3]),
    station(11,[-1.5,2.65,.15],[-2.4,2.05,-2.6]),
    station(12,[-1.5,2.65,-.8],[-2.4,2.05,-2.6]),
    station(13.5,[-.75,2.65,-1.3],[.3,2.22,-2.1]),
    station(15,[.6,2.65,-1.3],[1.9,2.2,-3.35]),
    station(17,[1.25,2.65,-2.15],[2.45,2.15,-3.65]),
    station(20,[1.35,2.65,-2.5],[2.2,2.2,-3.75]),
  ]},
  {floor:'first',fov:65,stations:[
    station(20,[-2.8,2.58,-5.2],[.8,2,-5.45]),
    station(23.5,[-2.45,2.58,-5.6],[1.1,2.08,-4.85]),
    station(27,[-2.05,2.58,-5.8],[.65,2.2,-4.05]),
  ]},
  {floor:'first',fov:68,stations:[
    station(27,[-.64,2.55,-3.18],[.09,1.85,-3.42]),
    station(31,[-.49,2.55,-3.22],[.12,1.91,-3.48]),
  ]},
  {floor:'second',fov:61,stations:[
    station(31,[2.52,5.7,-1.16],[.2,5.35,-1.25]),
    station(34,[1.92,5.7,-1.27],[-.9,5.38,-1.55]),
    station(37,[1.35,5.7,-1.4],[-1.4,5.3,-1.6]),
  ]},
  {floor:'second',fov:62,stations:[
    station(37,[-.64,5.7,-1.56],[-2.75,5.04,-2.7]),
    station(40.5,[-.95,5.7,-1.35],[-2.7,5.03,-2.7]),
    station(44,[-1.44,5.7,-1.05],[-2.7,5.02,-2.85]),
  ]},
  {floor:'second',fov:63,stations:[
    station(44,[.15,5.7,1.02],[-2.5,5.04,2.65]),
    station(47.5,[-.4,5.7,1.45],[-2.65,5.02,2.75]),
    station(51,[-.92,5.7,1.68],[-2.7,5.12,2.75]),
  ]},
  {floor:'second',fov:68,stations:[
    station(51,[1.84,5.68,.35],[2.5,5.0,3.05]),
    station(54.5,[1.83,5.68,1.13],[2.65,5.01,3.14]),
    station(58,[1.78,5.68,1.85],[2.78,5.08,3.25]),
  ]},
  {floor:'second',fov:72,stations:[
    station(58,[2.72,5.62,-2.39],[2.64,4.89,-3.45]),
    station(61,[2.89,5.62,-2.46],[2.43,4.97,-3.43]),
    station(64,[3.03,5.62,-2.64],[2.16,5,-3.38]),
  ]},
  {floor:'loft',fov:65,stations:[
    station(64,[-.35,8.4,1.55],[-.4,7.76,-3.1]),
    station(70,[-.6,8.4,.68],[-.25,7.78,-3.3]),
    station(76,[-.75,8.4,-.22],[-.25,7.86,-3.45]),
  ]},
  {floor:'basement',fov:66,stations:[
    station(76,[1.9,.25,1.5],[-1.3,-.25,-2.2]),
    station(79.5,[1.25,.25,.84],[-1.7,-.25,-2.4]),
    station(83,[.52,.25,.12],[-1.8,-.22,-2.7]),
  ]},
  {floor:'basement',fov:66,stations:[
    station(83,[-1.6,.25,-1.8],[1.8,-.27,2.2]),
    station(86.5,[-1.1,.25,-1.98],[2,-.25,2.25]),
    station(90,[-.65,.25,-2.08],[2.05,-.23,2.3]),
  ]},
];
export const FILM_STATIONS = FILM_SHOTS.flatMap(shot=>shot.stations);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const smooth = x => x*x*x*(x*(x*6-15)+10);
function tangent(stations,index,key,axis) {
  if(index===0||index===stations.length-1)return 0;
  const a=stations[index-1],b=stations[index],c=stations[index+1];
  const left=(b[key][axis]-a[key][axis])/(b.t-a.t),right=(c[key][axis]-b[key][axis])/(c.t-b.t);
  return left*right<=0?0:2*left*right/(left+right);
}
export function filmPose(seconds) {
  const time=clamp(Number.isFinite(seconds)?seconds:0,0,FILM_DURATION);
  const shot=FILM_SHOTS.find(s=>time<s.stations.at(-1).t)||FILM_SHOTS.at(-1);
  const stations=shot.stations,start=stations[0].t,end=stations.at(-1).t;
  let i=0;while(i<stations.length-2&&time>stations[i+1].t)i++;
  const a=stations[i],b=stations[i+1],span=b.t-a.t,u=(time-a.t)/span;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u,h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  const sample=key=>a[key].map((v,axis)=>h00*v+h10*span*tangent(stations,i,key,axis)+h01*b[key][axis]+h11*span*tangent(stations,i+1,key,axis));
  // Fade fully to the same color on both sides of each edit. No interpolated camera jumps.
  const opacity=Math.min(start===0?1:smooth(clamp((time-start)/.65,0,1)),end===FILM_DURATION?1:smooth(clamp((end-time)/.65,0,1)));
  return {position:sample('p'),target:sample('look'),fov:shot.fov,floor:shot.floor,opacity,door:clamp(time/1.4,0,1),doors:{rear:time>=19?1:0,loft:time>=63?1:0,cellar:time>=75?1:0}};
}
export function filmChapter(seconds) {
  return FILM_CHAPTERS.findLast(chapter=>seconds>=chapter.time)||FILM_CHAPTERS[0];
}
