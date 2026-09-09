import * as THREE from 'three';
import {OrbitControls} from './OrbitControls.js';
import {SHELL,OPENINGS,FEATURES,FOUNDATION} from './plan.js';
import {createInterior} from './interior.js';
import {mergeStatic} from './merge.js';
import {createPostPipeline,skyEnvironment} from './post.js';
const $=s=>document.querySelector(s);
$('#photos').onclick=()=>$('#gallery').showModal();$('#close').onclick=()=>$('#gallery').close();
try{start()}catch(e){$('#error').hidden=false;console.error(e)}
function start(){
const host=$('#scene'),scene=new THREE.Scene();scene.background=new THREE.Color('#e7edf0');scene.fog=new THREE.Fog('#e7edf0',55,115);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.appendChild(renderer.domElement);
// Image-based lighting from a procedural sky, plus the AO/tone-mapping pipeline that draws every frame.
scene.environment=skyEnvironment(renderer);scene.environmentIntensity=.35;const post=createPostPipeline(renderer);
const camera=new THREE.PerspectiveCamera(40,1,.1,180),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=9;controls.maxDistance=65;controls.maxPolarAngle=Math.PI/2-.025;controls.target.set(0,3,0);controls.enablePan=true;
const hemisphere=new THREE.HemisphereLight('#e4f2ff','#8a8d72',2);scene.add(hemisphere);const sun=new THREE.DirectionalLight('#fff4df',3);sun.position.set(-14,25,16);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:90});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=2;scene.add(sun);
const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.85,...o});const white=mat('#eeeee4'),siding=mat('#d9dbcf'),trim=mat('#f7f6ed'),red=mat('#78332e'),wood=mat('#815142'),stone=mat('#a49172'),dark=mat('#383e3c'),glass=mat('#52696b',{metalness:.25,roughness:.28}),roof=mat('#72685b'),grass=mat('#7c906a'),asphalt=mat('#53595b'),screen=mat('#343e3b',{transparent:true,opacity:.53,side:THREE.DoubleSide,depthWrite:false});
const sidingSeams=white.clone(),shutterFinish=red.clone(),paint=mat('#f3efe6'),glassLower=mat('#7f9a9e',{metalness:.2,roughness:.2,transparent:true,opacity:.55,depthWrite:false});
const home=new THREE.Group();scene.add(home);
function box(w,h,d,x,y,z,m=white,parent=home){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a}
function beam(a,b,width,m,parent=home){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const mesh=box(width,d.length(),width,0,0,0,m,parent);mesh.position.copy(av.add(bv).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh}
function face(points,m,parent=home){const g=new THREE.BufferGeometry();const verts=[];for(let i=1;i<points.length-1;i++)verts.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
// Main body: front faces +Z; driveway is +X.
const FZ=SHELL.z,FX=SHELL.x,concrete=mat('#b5b2ab',{roughness:.95});
// Exterior walls are a hollow shell with real window and door openings so the interior walkthrough can see out.
function shellWall(axis,coord,c0,c1,allOpenings,faces,y0=SHELL.base,y1=SHELL.top,thick=SHELL.thick){const openings=allOpenings.filter(o=>o.y1>y0&&o.y0<y1);const emit=(a0,a1,b0,b1)=>{if(a1-a0<.005||b1-b0<.005)return;axis==='x'?box(a1-a0,b1-b0,thick,(a0+a1)/2,(b0+b1)/2,coord,faces):box(thick,b1-b0,a1-a0,coord,(b0+b1)/2,(a0+a1)/2,faces)};
// Split the wall into vertical strips at every opening edge, then fill each strip around the openings that span it.
const edges=[...new Set([c0,c1,...openings.flatMap(o=>[o.a0,o.a1])])].filter(a=>a>=c0&&a<=c1).sort((p,q)=>p-q);
for(let i=0;i<edges.length-1;i++){const xa=edges[i],xb=edges[i+1];let cursor=y0;for(const o of openings.filter(o=>o.a0<=xa+.001&&o.a1>=xb-.001).sort((p,q)=>p.y0-q.y0)){emit(xa,xb,cursor,Math.min(o.y0,y1));cursor=Math.max(cursor,o.y1)}emit(xa,xb,cursor,y1)}}
function shellSeams(axis,coord,c0,c1,openings){for(let y=1;y<6.8;y+=.15){let spans=[[c0,c1]];for(const o of openings){if(y<o.y0||y>o.y1)continue;spans=spans.flatMap(([a,b])=>b<=o.a0||a>=o.a1?[[a,b]]:[[a,Math.min(b,o.a0)],[Math.max(a,o.a1),b]].filter(([p,q])=>q-p>.01))}for(const [a,b]of spans)axis==='x'?box(b-a,.025,.03,(a+b)/2,y,coord,sidingSeams):box(.03,.025,b-a,coord,y,(a+b)/2,sidingSeams)}}
const inset=SHELL.thick/2;
shellWall('x',SHELL.z-inset,-SHELL.x,SHELL.x,OPENINGS.front,[trim,trim,trim,trim,siding,paint]);
shellWall('x',-SHELL.z+inset,-SHELL.x,SHELL.x,OPENINGS.rear,[trim,trim,trim,trim,paint,siding]);
shellWall('z',SHELL.x-inset,-SHELL.z+SHELL.thick,SHELL.z-SHELL.thick,OPENINGS.right,[siding,paint,trim,trim,trim,trim]);
shellWall('z',-SHELL.x+inset,-SHELL.z+SHELL.thick,SHELL.z-SHELL.thick,OPENINGS.left,[paint,siding,trim,trim,trim,trim]);
for(const [axis,coord,c0,c1,ops,faces]of [['x',FZ-inset,-FX,FX,OPENINGS.front,[stone,stone,stone,stone,stone,concrete]],['x',-FZ+inset,-FX,FX,OPENINGS.rear,[stone,stone,stone,stone,concrete,stone]],['z',FX-inset,-FZ+SHELL.thick,FZ-SHELL.thick,OPENINGS.right,[stone,concrete,stone,stone,stone,stone]],['z',-FX+inset,-FZ+SHELL.thick,FZ-SHELL.thick,OPENINGS.left,[concrete,stone,stone,stone,stone,stone]]])shellWall(axis,coord,c0,c1,ops,faces,FOUNDATION.bottom,FOUNDATION.top);
const doubleSiding=mat('#d9dbcf',{side:THREE.DoubleSide}),doubleRoof=mat('#72685b',{side:THREE.DoubleSide});
for(const z of [-FZ,FZ]){face([[-4,6.8,z],[4,6.8,z],[0,9.6,z]],doubleSiding);for(let y=6.9;y<9.5;y+=.15){let w=8*(9.6-y)/2.8;box(w,.025,.025,0,y,z,sidingSeams)}}
shellSeams('x',FZ+.02,-4,4,OPENINGS.front);shellSeams('x',-FZ-.02,-4,4,OPENINGS.rear);shellSeams('z',4.02,-FZ,FZ,OPENINGS.right);shellSeams('z',-4.02,-FZ,FZ,OPENINGS.left);
for(const x of [-4.06,4.06])for(const z of [-FZ-.01,FZ+.01])box(.11,5.9,.11,x,3.85,z,trim);
const RZ=FZ+.35;face([[-4.4,6.75,RZ],[-4.4,6.75,-RZ],[0,9.75,-RZ],[0,9.75,RZ]],doubleRoof);face([[0,9.75,RZ],[0,9.75,-RZ],[4.4,6.75,-RZ],[4.4,6.75,RZ]],doubleRoof);
for(const z of [-RZ,RZ]){beam([-4.4,6.73,z],[0,9.73,z],.13,trim);beam([0,9.73,z],[4.4,6.73,z],.13,trim)}
for(const x of [-4.35,4.35])box(.15,.15,RZ*2,x,6.71,0,trim);
// Roof courses, chimney, gutters.
for(let t=.15;t<1;t+=.065){for(const sign of [-1,1])box(.028,.02,RZ*2-.05,sign*4.4*t,9.75-3*t+.015,0,roof)}
box(.65,1.85,.65,1.7,8.9,-1.3,mat('#856858'));box(.82,.14,.82,1.7,9.86,-1.3,stone);
for(let y=8.15;y<9.8;y+=.16)box(.67,.018,.67,1.7,y,-1.3,stone);
function windowAt(x,y,z,w=1,h=1.35,angle=0,shutters=false){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;home.add(g);for(const yy of [h/2+.04,-h/2-.04])box(w+.16,.08,.11,0,yy,0,trim,g);for(const xx of [-w/2-.04,w/2+.04])box(.08,h,.11,xx,0,0,trim,g);box(w,h,.045,0,0,.07,y<7?glassLower:glass,g);for(const xx of [-w/2,w/2])box(.045,h,.075,xx,0,.10,white,g);box(w,.065,.09,0,0,.10,white,g);for(const xx of [-w/6,w/6])box(.018,h,.03,xx,0,.10,white,g);for(const yy of [-h/3,h/3])box(w,.018,.03,0,yy,.10,white,g);box(w+.23,.065,.19,0,-h/2-.08,.04,trim,g);if(shutters)for(const side of [-1,1]){box(.31,h+.1,.09,side*(w/2+.28),0,.01,shutterFinish,g);for(let yy=-h/2;yy<h/2;yy+=.09)box(.26,.018,.03,side*(w/2+.28),yy,.07,shutterFinish,g)}return g}
// Windows and doors are placed from the measured plan (FEATURES); shell openings match them.
const wallPose={front:f=>[f.a,FZ+.05,0],rear:f=>[f.a,-FZ-.05,Math.PI],left:f=>[-FX-.09,f.a,-Math.PI/2],right:f=>[FX+.09,f.a,Math.PI/2]};
for(const f of FEATURES){if(f.kind!=='window'&&f.kind!=='gable'&&f.kind!=='cellar')continue;const [x,z,angle]=wallPose[f.wall](f);windowAt(x,f.y,z,f.w,f.h,angle);
if(f.shutters)box(.28,f.h+.15,.08,x+f.shutters*(f.w/2+.28),f.y,FZ+.08,shutterFinish);}
for(const center of [-1.95,1.85]){for(const x of [center-1.08,center+1.08]){box(.31,1.45,.09,x,5.2,FZ+.08,shutterFinish);for(let y=4.53;y<5.9;y+=.085)box(.27,.017,.025,x,y,FZ+.14,shutterFinish)}}
function door(x,y,z,angle=0,w=.95,h=2.15,finish=white){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;home.add(g);for(const xx of [-w/2-.0375,w/2+.0375])box(.075,h+.13,.12,xx,0,0,trim,g);box(w+.15,.075,.12,0,h/2+.0275,0,trim,g);const hinge=new THREE.Group();hinge.userData.dynamic=true;hinge.position.set(-w/2,0,.08);g.add(hinge);box(w,h,.05,w/2,0,0,finish,hinge);box(w-.17,h*.64,.035,w/2,h*.12,.04,glassLower,hinge);box(w-.17,.06,.03,w/2,-h*.2,.065,finish,hinge);box(.06,.06,.06,w*.85,-.05,.09,stone,hinge);return hinge}
const frontFeature=FEATURES.find(f=>f.kind==='door'),frontDoor=door(frontFeature.a,frontFeature.y,FZ+.06,0,frontFeature.w,frontFeature.h,mat('#17191b'));
function frenchDoor(x,y,z,angle=0,w=1.7,h=2.1){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;home.add(g);for(const xx of [-w/2-.0375,w/2+.0375])box(.075,h+.13,.12,xx,0,0,trim,g);box(w+.15,.075,.12,0,h/2+.0275,0,trim,g);
const pw=w/2-.012,stile=.09,top=.1,bottom=.24,gw=pw-2*stile,gh=h-top-bottom,gy=(bottom-top)/2;
return [-1,1].map(side=>{const hinge=new THREE.Group();hinge.userData.dynamic=true;hinge.position.set(side*-w/2,0,.08);g.add(hinge);const cx=side*pw/2;
box(pw,h,.045,cx,0,0,glassLower,hinge);for(const sx of [-1,1])box(stile,h,.05,cx+sx*(pw/2-stile/2),0,0,white,hinge);box(pw,top,.05,cx,h/2-top/2,0,white,hinge);box(pw,bottom,.05,cx,-h/2+bottom/2,0,white,hinge);
for(let i=1;i<3;i++)box(.022,gh,.052,cx-gw/2+gw*i/3,gy,0,white,hinge);for(let j=1;j<5;j++)box(gw,.022,.052,cx,gy-gh/2+gh*j/5,0,white,hinge);
box(.05,.05,.05,cx-side*(pw/2-.12),-.05,.06,stone,hinge);return hinge})}
// Four windows on left; driveway has an elevated small kitchen window and basement entrance.
const sideFeature=FEATURES.find(f=>f.kind==='sidedoor');const sideDoor=door(FX+.09,sideFeature.y,sideFeature.a,Math.PI/2,sideFeature.w,sideFeature.h);
const rearFeature=FEATURES.find(f=>f.kind==='french'),rearDoor=frenchDoor(rearFeature.a,rearFeature.y,-FZ-.05,Math.PI,rearFeature.w,rearFeature.h);
// Front porch and entry stairs. Dedicated finishes keep the rear porch unchanged.
const porchFloorFinish=wood.clone(),porchStepFinish=red.clone(),porchRailFinish=trim.clone(),stairRailFinish=red.clone();
const PZ=FZ-4.25;box(8.3,.23,2.25,0,1,5.3+PZ,porchFloorFinish);box(8.35,.19,.18,0,.98,6.44+PZ,trim);
for(const x of [-3.9,0,3.9]){box(.22,2.7,.22,x,2.4,6.25+PZ,porchRailFinish);box(.32,.14,.32,x,1.12,6.25+PZ,porchRailFinish)}
box(8.85,.15,2.9,0,3.83,5.4+PZ,trim);const porchRoof=box(8.8,.08,2.95,0,3.95,5.4+PZ,roof);porchRoof.rotation.x=.06;
function rail(x1,z1,x2,z2,y=1.13){beam([x1,y+.83,z1],[x2,y+.83,z2],.075,porchRailFinish);beam([x1,y+.07,z1],[x2,y+.07,z2],.065,porchRailFinish);const n=Math.ceil(Math.hypot(x2-x1,z2-z1)/.18);for(let i=0;i<=n;i++)box(.035,.72,.035,x1+(x2-x1)*i/n,y+.45,z1+(z2-z1)*i/n,porchRailFinish)}
rail(-3.9,6.25+PZ,1.3,6.25+PZ);rail(-3.9,4.35+PZ,-3.9,6.25+PZ);
for(let i=0;i<6;i++)box(2.25,(6-i)*.17,.31,frontFeature.a,(6-i)*.085,6.58+PZ+i*.3,porchStepFinish);
for(const x of [frontFeature.a-1.18,frontFeature.a+1.15]){box(.11,.95,.11,x,.57,8.13+PZ,stairRailFinish);beam([x,1.92,6.37+PZ],[x,1.07,8.16+PZ],.09,stairRailFinish)}

// Two porch lounge chairs and a table, clear of the entry walkway.
const furnitureFrame=mat('#282d2d'),cushion=mat('#e2ded2'),tableWood=mat('#a78761');
function porchChair(x,z,angle){const g=new THREE.Group();g.position.set(x,1.12,z);g.rotation.y=angle;home.add(g);
 for(const xx of [-.36,.36])for(const zz of [-.33,.33])box(.055,.43,.055,xx,.215,zz,furnitureFrame,g);
 box(.8,.08,.78,0,.43,0,furnitureFrame,g);box(.69,.13,.68,0,.535,.015,cushion,g);
 for(const xx of [-.39,.39]){box(.055,.42,.055,xx,.63,-.32,furnitureFrame,g);box(.055,.3,.055,xx,.6,.30,furnitureFrame,g);box(.09,.055,.83,xx,.78,0,tableWood,g);}
 const back=box(.74,.65,.09,0,.88,-.36,furnitureFrame,g);back.rotation.x=-.12;
 const pad=box(.65,.52,.11,0,.88,-.29,cushion,g);pad.rotation.x=-.12;
}
porchChair(-2.75,5.15+PZ,-.08);porchChair(-.65,5.15+PZ,.08);
const table=new THREE.Group();table.position.set(-1.7,1.12,5.2+PZ);home.add(table);
for(const x of [-.25,.25])for(const z of [-.25,.25])box(.045,.52,.045,x,.26,z,furnitureFrame,table);
box(.65,.07,.65,0,.55,0,tableWood,table);

// Open lattice under front porch.
for(let x=-3.9;x<1.3;x+=.23)box(.045,.82,.055,x,.49,6.32+PZ,mat('#59715f'));for(let y=.15;y<.95;y+=.18)box(5.2,.035,.055,-1.3,y,6.32+PZ,white);
// Rear screened porch offset toward left side; driveway-side steps.
box(6.9,.2,3.1,-.65,1,(-5.85-PZ),wood);const posts=[[-4.05,(-4.4-PZ)],[-4.05,(-7.4-PZ)],[-2.65,(-7.4-PZ)],[-1.25,(-7.4-PZ)],[.15,(-7.4-PZ)],[1.55,(-7.4-PZ)],[2.8,(-7.4-PZ)],[2.8,(-4.4-PZ)]];
for(const [x,z]of posts){box(.085,3,.085,x,2.45,z,trim);box(.13,.9,.13,x,.5,z,wood)}
box(7.15,.15,3.45,-.65,4.02,(-5.83-PZ),trim);const backroof=box(7.2,.08,3.5,-.65,4.12,(-5.83-PZ),roof);backroof.rotation.x=-.06;
box(6.8,2.83,.025,-.65,2.48,(-7.4-PZ),screen);for(const x of [-4.05,2.8])box(.025,2.83,3,x,2.48,(-5.85-PZ),screen);
for(const y of [1.12,2.13,3.72]){box(6.9,.07,.07,-.65,y,(-7.42-PZ),trim);for(const x of [-4.05,2.8])box(.07,.07,3,x,y,(-5.9-PZ),trim)}
for(const z of [(-5.35-PZ),(-6.35-PZ)])for(const x of [-4.05,2.8])box(.065,2.95,.065,x,2.5,z,trim);
// Rear screen door close to driveway.
for(const x of [1.83,2.68])box(.075,2.25,.09,x,2.2,(-7.44-PZ),trim);box(.91,.075,.09,2.25,3.29,(-7.44-PZ),trim);
for(let i=0;i<6;i++)box(1.1,(6-i)*.17,.29,2.25,(6-i)*.085,(-7.56-PZ)-i*.28,red);for(const x of [1.66,2.85])beam([x,1.96,(-7.4-PZ)],[x,1.02,(-9-PZ)],.075,red);
// Downspouts and foundation mortar joints.
for(const [x,z]of [[4.12,FZ-.15],[-4.12,-FZ+.15]])box(.075,6.5,.075,x,3.4,z,trim);
for(let y=.15;y<.9;y+=.22){for(const z of [FZ+.005,-FZ-.005])box(8,.02,.03,0,y,z,stone);for(const x of [FX+.005,-FX-.005])box(.03,.02,FZ*2,x,y,0,stone)} // mortar courses on the foundation above grade
// Contextual property, kept schematic because no survey was supplied.
// Lawn in four strips around the foundation so the basement below grade stays open.
const gx=FX+.08,gz=FZ+.08;box(22-gx,.2,53,(22+gx)/2,-.16,-8,grass,scene);box(22-gx,.2,53,-(22+gx)/2,-.16,-8,grass,scene);box(gx*2,.2,26.5-gz-8,0,-.16,(18.5+gz)/2,grass,scene);box(gx*2,.2,26.5+8-gz,0,-.16,-(34.5+gz)/2,grass,scene);box(44,.12,6.3,0,-.01,12.4,asphalt,scene);box(44,.12,1.3,0,.035,8.7,mat('#b9b7ac'),scene);box(2.25,.05,1.15,2.65,.06,8.1,mat('#b9b7ac'),scene);box(3.15,.045,30,6,.025,-5.9,asphalt,scene);
for(let x=-21;x<21;x+=3.4)box(1.7,.01,.09,x,.06,12.5,mat('#d7cda2'),scene);
// Detached barn from earlier exterior references.
const barn=new THREE.Group();barn.position.set(5,0,-19);scene.add(barn);box(5.6,2.8,4.3,0,1.4,0,siding.clone(),barn);for(const z of [-2.15,2.15])face([[-2.8,2.8,z],[2.8,2.8,z],[0,4.2,z]],doubleSiding.clone(),barn);face([[-3,2.8,2.4],[-3,2.8,-2.4],[0,4.3,-2.4],[0,4.3,2.4]],doubleRoof,barn);face([[0,4.3,2.4],[0,4.3,-2.4],[3,2.8,-2.4],[3,2.8,2.4]],doubleRoof,barn);for(const x of [-1.23,1.23]){box(2.35,2.4,.08,x,1.2,2.2,red,barn);box(.6,.6,.11,x,1.85,2.27,glass,barn);for(const dx of [-.32,.32])box(.055,.68,.055,x+dx,1.85,2.34,trim,barn)}for(const x of [-2.6,0,2.6])box(.09,2.5,.12,x,1.25,2.25,trim,barn);
function shrub(x,z,s=1){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(s,2),mat('#486446'));mesh.scale.set(1,.8,.85);mesh.position.set(x,s*.6,z);mesh.castShadow=true;scene.add(mesh)}
for(const [x,z,s]of [[-2.5,7.1+PZ,.8],[-3.9,7+PZ,.9],[4.3,5.6+PZ,1.05],[-5.2,-1,.75],[-5.2,-3,.75],[-5.2,1,.75]])shrub(x,z,s);
const fence=mat('#465854');for(let z=-24;z<=7;z+=2.6)box(.055,1.3,.055,9,.65,z,fence,scene);for(const y of [.18,1.22])box(.045,.035,31,9,y,-8.5,fence,scene);
// Neutral tree volumes provide context without concealing the house.
for(const [x,z,s]of [[-11,-14,2.8],[12,-22,3.1],[-12,-25,3.5],[13,-11,2.5]]){box(.35,5,.35,x,2.5,z,wood,scene);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(s,2),mat('#6f8669',{transparent:true,opacity:.75}));crown.position.set(x,6,z);crown.scale.y=1.2;scene.add(crown)}

// Future backyard is a single visibility group; approximate 20 x 20 ft patio.
const futureYard=new THREE.Group();futureYard.name='Future backyard';futureYard.visible=false;scene.add(futureYard);
const paverColors=['#a5aaa8','#969e9d','#b2b6b0','#8e9697'].map(c=>mat(c));
const patioSurface=new THREE.Group(),patioPath=new THREE.Group(),plantGroup=new THREE.Group();
patioSurface.name='Patio surface';patioPath.name='Stone paths';plantGroup.name='Added plants';futureYard.add(patioSurface,patioPath,plantGroup);
function outdoorChair(x,z,angle=0,lounge=false){const g=new THREE.Group();g.position.set(x,.15,z);g.rotation.y=angle;futureYard.add(g);const w=lounge?.7:.52,d=lounge?.7:.53;
for(const xx of [-w/2,w/2])for(const zz of [-d/2,d/2])box(.045,.4,.045,xx,.2,zz,furnitureFrame,g);
box(w+.05,.06,d+.05,0,.43,0,furnitureFrame,g);box(w-.03,.1,d-.03,0,.51,0,cushion,g);
box(w+.05,.55,.06,0,.75,-d/2,furnitureFrame,g);box(w-.04,.43,.09,0,.75,-d/2+.045,cushion,g);
for(const xx of [-w/2,w/2]){box(.05,.3,.05,xx,.58,d/2,furnitureFrame,g);box(.075,.05,d+.1,xx,.74,0,tableWood,g);}}
// Dining table and four chairs, close to the house with a clear route from the steps.
box(1.55,.08,.85,-1.3,.92,-10.7,tableWood,futureYard);
for(const x of [-1.93,-.67])for(const z of [-11.01,-10.39])box(.055,.73,.055,x,.515,z,furnitureFrame,futureYard);
outdoorChair(-1.78,-11.53);outdoorChair(-.83,-11.53);outdoorChair(-1.78,-9.86,Math.PI);outdoorChair(-.83,-9.86,Math.PI);
// Freestanding gas grill: stainless hood, side shelves, cabinet, knobs, and wheels.
const steel=mat('#aeb8ba',{metalness:.72,roughness:.3});const grill=new THREE.Group();grill.position.set(2.15,.15,-11.6);grill.rotation.y=-Math.PI/2;futureYard.add(grill);
box(.88,.6,.55,0,.4,0,dark,grill);box(.82,.48,.59,0,.98,0,steel,grill);box(.9,.12,.6,0,.72,0,steel,grill);
for(const x of [-.62,.62])box(.35,.05,.53,x,.77,0,steel,grill);
beam([-.3,1.03,.36],[.3,1.03,.36],.035,dark,grill);
for(const x of [-.27,0,.27]){const knob=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.025,12),dark);knob.rotation.x=Math.PI/2;knob.position.set(x,.75,.32);grill.add(knob);}
for(const x of [-.34,.34])for(const z of [-.2,.2]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.055,16),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.09,z);grill.add(wheel);}
// Unlit stainless fire pit and two lounge chairs on the far side of the patio.
const pit=new THREE.Group();pit.position.set(-.6,.15,-13.65);futureYard.add(pit);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.33,.43,40,1,true),steel);barrel.position.y=.25;barrel.castShadow=true;pit.add(barrel);
const rim=new THREE.Mesh(new THREE.TorusGeometry(.345,.025,10,48),steel);rim.rotation.x=Math.PI/2;rim.position.y=.465;pit.add(rim);
const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.315,.28,.05,32),dark);bowl.position.y=.13;pit.add(bowl);
outdoorChair(-2,-13.8,Math.PI/2,true);outdoorChair(.9,-13.8,-Math.PI/2,true);

const furnitureItems=futureYard.children.filter(o=>![patioSurface,patioPath,plantGroup].includes(o)).map(o=>({o,original:o.position.clone()}));
const cornerCurves=[.18,.18,.18,.18];
const planting=[];let nextPlantId=1;
const plantNames={shrub:'Evergreen shrub',hydrangea:'White flowering shrub',grass:'Ornamental grass',purple:'Purple flowers',yellow:'Yellow flowers'};
const leaf=mat('#42764c'),grassLeaf=mat('#748b45'),mulch=mat('#655141'),whiteFlower=mat('#f4efe2'),purpleFlower=mat('#9c66bb'),yellowFlower=mat('#efbf3b');
function clearGeometry(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose()});g.clear()}
function shapeMesh(points,y,m,parent){if(points.length<3)return;const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p[0],p[1])));const geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geo,m);mesh.position.y=y;mesh.receiveShadow=true;parent.add(mesh);return mesh}
const joint=mat('#69716d',{side:THREE.DoubleSide});paverColors.forEach(m=>m.side=THREE.DoubleSide);
function outline(w,d,kind){if(kind==='rectangle')return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
if(kind==='oval')return Array.from({length:64},(_,i)=>[Math.cos(i*Math.PI/32)*w/2,Math.sin(i*Math.PI/32)*d/2]);
const points=[];for(let c=0;c<4;c++){const r=Math.min(w,d)*(kind==='custom'?cornerCurves[c]:.16),cx=(c===0||c===3?1:-1)*(w/2-r),cz=(c<2?1:-1)*(d/2-r);for(let i=0;i<=16;i++){const t=c*Math.PI/2+i*Math.PI/32;points.push([cx+r*Math.cos(t),cz+r*Math.sin(t)])}}return points}

function clipPolygon(poly,boundary){let result=poly;for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length],input=result;result=[];if(!input.length)break;
const cross=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);let prev=input.at(-1),pv=cross(prev);
for(const cur of input){const cv=cross(cur);if((cv>=0)!==(pv>=0)){const t=pv/(pv-cv);result.push([prev[0]+t*(cur[0]-prev[0]),prev[1]+t*(cur[1]-prev[1])])}if(cv>=0)result.push(cur);prev=cur;pv=cv;}}return result}
function stoneWalk(a,b,size){const delta=new THREE.Vector3().subVectors(b,a),len=delta.length();if(len<.05)return;const g=new THREE.Group();g.position.copy(a.clone().add(b).multiplyScalar(.5));g.rotation.y=Math.atan2(delta.x,delta.z);patioPath.add(g);box(1.1,.07,len,0,.06,0,joint,g);const n=Math.ceil(len/size);for(let i=0;i<n;i++)for(let j=0;j<2;j++)box(.535,.035,len/n-.015,(j-.5)*.55,.112,-len/2+(i+.5)*len/n,paverColors[(i+j)%4],g)}
function plantAt(item,x,z){const g=new THREE.Group();g.name=plantNames[item.type];g.position.set(x,0,z);plantGroup.add(g);
function ball(r,px,py,pz,m,sx=1,sy=1,sz=1){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),m);mesh.position.set(px,py,pz);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;g.add(mesh)}
const bed=new THREE.Mesh(new THREE.CylinderGeometry(.54,.54,.045,24),mulch);bed.position.y=.035;g.add(bed);
if(item.type==='shrub'||item.type==='hydrangea'){ball(.47,0,.5,0,leaf,1,1.05,1);if(item.type==='hydrangea')for(let i=0;i<7;i++){const t=i*2.4;ball(.16,Math.cos(t)*.33,.65+(i%2)*.19,Math.sin(t)*.33,whiteFlower)}}
else if(item.type==='grass'){for(let i=0;i<15;i++){const t=i*2.4;beam([0,.05,0],[Math.cos(t)*.4,.55+(i%4)*.13,Math.sin(t)*.4],.025,grassLeaf,g)}}
else for(let i=0;i<9;i++){const t=i*2.4,x=Math.cos(t)*.31,z=Math.sin(t)*.31,y=.32+(i%3)*.08;beam([x,0,z],[x,y,z],.016,leaf,g);for(let j=0;j<5;j++){const a=j*Math.PI*.4;ball(.06,x+Math.cos(a)*.065,y,z+Math.sin(a)*.065,item.type==='purple'?purpleFlower:yellowFlower)}ball(.032,x,y+.02,z,yellowFlower)}
}
function rebuildPlants(w,d,center,shape){clearGeometry(plantGroup);const counts={left:0,right:0,far:0};for(const item of planting){const slot=counts[item.side]++,t=(slot-1.5)*1.05;let x,z;
if(item.side==='far'){x=(slot<2?-1:1)*(1.25+(slot%2)*1.05);z=center-d/2-.75}else{x=(item.side==='left'?-1:1)*(w/2+.75);z=center+t}plantAt(item,x,z)}
$('#plant-count').textContent=planting.length?`${planting.length} added plant${planting.length===1?'':'s'}`:'No added plants';const list=$('#plant-list');list.replaceChildren();for(const item of planting){const row=document.createElement('div');row.className='plant-row';const label=document.createElement('span');label.textContent=plantNames[item.type]+' · '+item.side;const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+plantNames[item.type]+' from '+item.side+' edge');remove.onclick=()=>{planting.splice(planting.indexOf(item),1);rebuildPatio()};row.append(label,remove);list.append(row)}}
function rebuildPatio(){const wf=Number($('#patio-width').value),df=Number($('#patio-depth').value),w=wf*.3048,d=df*.3048,kind=$('#patio-shape').value,center=-9.07-d/2;
clearGeometry(patioSurface);clearGeometry(patioPath);const border=outline(w,d,kind),world=border.map(p=>[p[0],p[1]+center]);shapeMesh(world,.10,joint,patioSurface);
const stoneSize=$('#stone-size').value,sw=stoneSize==='small'?.3048:.6096,sd=stoneSize==='large'?.9144:sw;
for(let x=-w/2,col=0;x<w/2;x+=sw,col++)for(let z=-d/2,row=0;z<d/2;z+=sd,row++){const clipped=clipPolygon([[x+.008,z+.008],[Math.min(x+sw,w/2)-.008,z+.008],[Math.min(x+sw,w/2)-.008,Math.min(z+sd,d/2)-.008],[x+.008,Math.min(z+sd,d/2)-.008]],border);shapeMesh(clipped.map(p=>[p[0],p[1]+center]),.135,paverColors[(col+row*3)%4],patioSurface)}
stoneWalk(new THREE.Vector3(0,0,center-d/2+.15),new THREE.Vector3(5,0,-16.85),sd);
if(kind!=='rectangle')stoneWalk(new THREE.Vector3(2.25,0,-9),new THREE.Vector3(2.25,0,center),sd);
const fit=kind==='oval'?.73:kind==='rectangle'?1:.82;for(const {o,original}of furnitureItems){o.position.x=original.x*w/6.1*fit;o.position.z=center+(original.z+12.12)*d/6.1*fit}
const area=Math.abs(border.reduce((sum,p,i)=>{const q=border[(i+1)%border.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2/.3048**2;$('#width-value').textContent=wf+' ft';$('#depth-value').textContent=df+' ft';$('#patio-area').textContent=Math.round(area)+' sq ft patio';rebuildPlants(w,d,center,kind);drawCurveEditor()}
for(const id of ['patio-width','patio-depth','patio-shape','stone-size'])$('#'+id).addEventListener('input',()=>{futureMode=true;applyFuture();rebuildPatio()});
$('#add-plant').onclick=()=>{const side=$('#plant-side').value;if(planting.filter(p=>p.side===side).length>=4){$('#plant-count').textContent='This edge has four plants. Choose another edge or remove one.';return}futureMode=true;applyFuture();planting.push({id:nextPlantId++,type:$('#plant-type').value,side});rebuildPatio();$('#future-back').click()};$('#clear-plants').onclick=()=>{planting.length=0;rebuildPatio()};
let futureMode=false,selectedPaint='white';
const porchSelection={floor:'existing',steps:'existing',rails:'existing'};
const porchPalette={white:'#eeeee4',light:'#b9bec0',medium:'#8a9195',charcoal:'#393f43',greige:'#b5ac9c',cedar:'#aa7952'};
const paintNames={white:'White',light:'Light gray',medium:'Medium gray',dark:'Dark gray',greige:'Gray/beige'};
function applyFuture(){
for(const [key,material,original]of [['floor',porchFloorFinish,'#815142'],['steps',porchStepFinish,'#78332e'],['rails',porchRailFinish,'#f7f6ed']])material.color.set(futureMode&&porchSelection[key]!=='existing'?porchPalette[porchSelection[key]]:original);
stairRailFinish.color.set(futureMode&&porchSelection.rails!=='existing'?porchPalette[porchSelection.rails]:'#78332e');
document.querySelectorAll('[data-porch]').forEach(b=>b.setAttribute('aria-pressed',String(porchSelection[b.dataset.porch]===b.dataset.finish)));
const palette={white:'#eeefe9',light:'#b9bec0',medium:'#8a9195',dark:'#555d63',greige:'#b5ac9c'},c=palette[selectedPaint];
document.querySelectorAll('[data-paint]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paint===selectedPaint)));
siding.color.set(futureMode?c:'#d9dbcf');doubleSiding.color.copy(siding.color);sidingSeams.color.set(futureMode?c:'#eeeee4');if(futureMode)sidingSeams.color.multiplyScalar(.91);
shutterFinish.color.set(futureMode?'#15191c':'#78332e');futureYard.visible=futureMode;$('#future-options').hidden=false;$('#future').setAttribute('aria-pressed',String(futureMode));$('#future').textContent=futureMode?'Current model':'Future state';$('#mode-label').textContent=futureMode?'Future state · '+paintNames[selectedPaint]+' · black shutters':'Current model · photo-based exterior study';}
$('#future').onclick=()=>{stop();futureMode=!futureMode;applyFuture()};document.querySelectorAll('[data-paint]').forEach(b=>b.onclick=()=>{futureMode=true;selectedPaint=b.dataset.paint;applyFuture()});
document.querySelectorAll('[data-porch]').forEach(b=>b.onclick=()=>{futureMode=true;porchSelection[b.dataset.porch]=b.dataset.finish;applyFuture()});
$('#steps-closeup').onclick=()=>{stop();target.set(2.3,1.2,6.7+PZ);theta=.38;distance=10;elevation=.32;setCamera();$('#viewname').textContent='Porch steps · color preview';$('#height').value=18};
$('#porch-closeup').onclick=()=>{stop();target.set(0,2.1,5.2+PZ);theta=.18;distance=15;elevation=.24;setCamera();$('#viewname').textContent='Front porch · finish preview';$('#height').value=14};
$('#future-back').onclick=()=>{stop();futureMode=true;applyFuture();target.set(0,2,-9);theta=3.8;distance=31;elevation=.57;setCamera();$('#viewname').textContent='Future backyard · patio & path to shed';$('#height').value=Math.round(elevation*180/Math.PI)};

const svgNS='http://www.w3.org/2000/svg';
const curveHandles=[];
const cornerNames=['Front right','Front left','Back left','Back right'];
function drawCurveEditor(){
 const kind=$('#patio-shape').value;
 const points=outline(180,180,kind);$('#curve-outline').setAttribute('d','M'+points.map(p=>(120+p[0])+','+(120+p[1])).join(' L')+' Z');
 curveHandles.forEach((h,i)=>{const r=kind==='rectangle'?0:kind==='oval'?.49:kind==='rounded'?.16:cornerCurves[i];const sx=i===0||i===3?1:-1,sy=i<2?1:-1;h.setAttribute('cx',120+sx*(90-r*180*.707));h.setAttribute('cy',120+sy*(90-r*180*.707));h.setAttribute('aria-valuenow',Math.round(r*100));});
}
function changeCurve(i,value){if($('#patio-shape').value!=='custom'){const kind=$('#patio-shape').value;cornerCurves.fill(kind==='rectangle'?0:kind==='oval'?.49:.16)}cornerCurves[i]=Math.max(0,Math.min(.49,value));$('#patio-shape').value='custom';futureMode=true;applyFuture();rebuildPatio();}
for(let i=0;i<4;i++){
 const h=document.createElementNS(svgNS,'circle');h.setAttribute('r','10');h.setAttribute('tabindex','0');h.setAttribute('role','slider');h.setAttribute('aria-label',cornerNames[i]+' corner rounding');h.setAttribute('aria-valuemin','0');h.setAttribute('aria-valuemax','49');$('#curve-handles').append(h);curveHandles.push(h);
 let dragging=false;
 const drag=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('#curve-map').getScreenCTM().inverse());const sx=i===0||i===3?1:-1,sy=i<2?1:-1;changeCurve(i,((90-sx*(p.x-120))+(90-sy*(p.y-120)))/(360*.707))};
 h.addEventListener('pointerdown',e=>{e.preventDefault();dragging=true;h.setPointerCapture(e.pointerId);$('#future-back').click();drag(e)});
 h.addEventListener('pointermove',e=>{if(dragging)drag(e)});
 h.addEventListener('pointerup',()=>dragging=false);h.addEventListener('pointercancel',()=>dragging=false);
 h.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key))return;e.preventDefault();changeCurve(i,Number(h.getAttribute('aria-valuenow'))/100+(['ArrowUp','ArrowRight'].includes(e.key)?.02:-.02))});
}
document.querySelectorAll('[data-curve]').forEach(b=>b.onclick=()=>{cornerCurves.fill(Number(b.dataset.curve));$('#patio-shape').value='custom';futureMode=true;applyFuture();rebuildPatio();$('#future-back').click()});
rebuildPatio();
let touring=false,theta=.65,last=performance.now(),elapsed=0;const target=new THREE.Vector3(0,3,0);let distance=25,elevation=.45;
function setCamera(){camera.position.set(target.x+Math.sin(theta)*distance*Math.cos(elevation),target.y+distance*Math.sin(elevation),target.z+Math.cos(theta)*distance*Math.cos(elevation));controls.target.copy(target);controls.update()}
function stop(){touring=false;$('#tour').textContent='▶ Start walk-around';$('#tour').setAttribute('aria-pressed','false');$('#tourstatus').textContent='360° exterior tour'}
function reset(){stop();theta=.65;distance=25;elevation=.45;target.set(0,3,0);setCamera();$('#height').value=27}reset();
const names={front:'Front porch',right:'Driveway side',back:'Rear screened porch',left:'Left side',site:'Whole property · approximate layout'};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{stop();let v=b.dataset.view;target.set(0,3,v==='site'?-7:(v==='back'&&futureMode?-8:0));theta=({front:0,right:Math.PI/2,back:Math.PI,left:-Math.PI/2,site:.6})[v];distance=v==='site'?47:(v==='back'&&futureMode?32:25);elevation=v==='site'?.7:(v==='back'&&futureMode?.55:.35);setCamera();$('#viewname').textContent=names[v];$('#height').value=elevation*180/Math.PI});
$('#reset').onclick=reset;$('#height').oninput=e=>{stop();const offset=camera.position.clone().sub(controls.target);theta=Math.atan2(offset.x,offset.z);distance=offset.length();target.copy(controls.target);elevation=Number(e.target.value)*Math.PI/180;setCamera()};
$('#tour').onclick=()=>{if(touring){stop();return}touring=true;elapsed=0;theta=0;target.set(0,2.4,0);distance=24;elevation=.22;$('#tour').textContent='Ⅱ Pause walk-around';$('#tour').setAttribute('aria-pressed','true');setCamera()};controls.addEventListener('start',stop);
const porchPose=()=>{const t=new THREE.Vector3(0,2.1,5.2+PZ),th=.18,d=15,el=.24;return {position:new THREE.Vector3(t.x+Math.sin(th)*d*Math.cos(el),t.y+d*Math.sin(el),t.z+Math.cos(th)*d*Math.cos(el)),target:t}};
const interior=createInterior({scene,camera,renderer,host,controls,doors:{front:frontDoor,rear:rearDoor},glassLower,hemisphere,exteriorPose:porchPose,onEnter:stop,onExit:()=>{target.set(0,2.1,5.2+PZ);theta=.18;distance=15;elevation=.24;setCamera();$('#viewname').textContent='Front porch';$('#height').value=14}});
$('#enter').onclick=()=>{stop();interior.enter()};
mergeStatic(home);mergeStatic(interior.group);
host.addEventListener('keydown',e=>{if(interior.active)return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))return;e.preventDefault();if(e.key===' '){$('#tour').click();return}stop();const off=camera.position.clone().sub(controls.target);theta=Math.atan2(off.x,off.z);distance=off.length();elevation=Math.asin(off.y/distance);target.copy(controls.target);if(e.key==='ArrowLeft')theta-=.12;if(e.key==='ArrowRight')theta+=.12;if(e.key==='ArrowUp')elevation=Math.min(1.3,elevation+.06);if(e.key==='ArrowDown')elevation=Math.max(.06,elevation-.06);setCamera()});
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();post.resize()}new ResizeObserver(resize).observe(host);resize();
if(location.search.includes('debug'))window.budd={scene,renderer,camera,interior};
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.05);last=now;if(interior.active){interior.update();post.render(scene,camera);return}if(touring){elapsed+=dt;theta=elapsed/48*Math.PI*2;setCamera();$('#tourstatus').textContent=`${Math.min(100,Math.round(elapsed/48*100))}% · full circuit`;if(elapsed>=48)stop()}controls.update();const off=camera.position.clone().sub(controls.target);const a=(Math.atan2(off.x,off.z)+Math.PI*2)%(Math.PI*2);const label=a<Math.PI/4||a>7*Math.PI/4?'FRONT':a<3*Math.PI/4?'DRIVEWAY SIDE':a<5*Math.PI/4?'REAR':'LEFT SIDE';$('#bearing').textContent=label;if(touring)$('#viewname').textContent=label.toLowerCase().replace(/^./,s=>s.toUpperCase());post.render(scene,camera)}requestAnimationFrame(loop);
}
