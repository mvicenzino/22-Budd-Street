import * as THREE from 'three';
import {mergeStatic} from './merge.js';
import {BASEMENT_PLAN as P,mirrorBasementRect} from './basement-plan.js';

// A spatial proposal within the existing basement envelope. The original windows,
// stair, joists, and boiler remain owned by the interior model.
export function buildBasementProposal({group,box,beam,toilet,mat,palette,trim,steel,porcelain,wallMaterial}) {
  const floor=P.floor,ceiling=P.ceiling,height=ceiling-floor,thick=P.wallThickness;
  // Build in the original local orientation, then reflect the complete proposal into
  // the rear-right corner. Window apertures remain specific to the actual right wall.
  const [x0,z0,x1,z1]=mirrorBasementRect(P.bathroom.rect);
  const bathroomBounds={x0,x1,z0,z1};
  const opening={x0:-P.bathroom.door[1],x1:-P.bathroom.door[0],head:2.03};
  const bathroomPaint=mat('#E3E0D7',{roughness:.85});
  const ceilingPaint=mat('#f7f5ee',{roughness:.88});
  const grout=mat('#bfb8aa',{roughness:.92});
  const floorTiles=['#d9d4c9','#d5d0c5','#ddd8ce'].map(color=>mat(color,{roughness:.61}));
  const wetTile=mat('#e4e0d6',{roughness:.48});
  const wetGrout=mat('#cbc5b9',{roughness:.86});
  const shadow=mat('#565954',{roughness:.74});
  const oak=palette.woodLight.clone();oak.color.set('#bea27b');oak.roughness=.56;oak.userData.basementOwned=true;
  const mirrorFinish=mat('#b6c5c3',{metalness:.88,roughness:.11,side:THREE.DoubleSide});
  const glass=new THREE.MeshPhysicalMaterial({color:'#e2efed',roughness:.09,metalness:.04,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
  glass.userData.basementOwned=true;
  const warmLED=mat('#fff4dd',{emissive:'#ffe7b8',emissiveIntensity:.9,roughness:.35});
  const linen=mat('#e9e4d8',{roughness:.98});
  const proposal=new THREE.Group();proposal.name='Basement proposal';
  proposal.userData.dynamic=true;proposal.userData.basementProposal=true;proposal.scale.x=-1;group.add(proposal);
  const named=(name,parent=proposal)=>{
    const child=new THREE.Group();child.name=name;child.userData.dynamic=true;child.userData.basementProposal=true;parent.add(child);return child;
  };
  const bathroom=named('Basement bathroom');
  const shower=named('Basement shower',bathroom);
  const vanity=named('Basement vanity',bathroom);
  const utility=named('Basement utility enclosure');
  const ceilings=named('Basement proposal ceilings');
  const add=(geometry,material,position,parent,scale)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
    if(scale)mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const roundBeam=(a,b,radius,material,parent)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    const mesh=add(new THREE.CylinderGeometry(radius,radius,direction.length(),16),material,start.add(end).multiplyScalar(.5).toArray(),parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;
  };
  const strip=(x0,x1,z0,z1,y,h,material,parent)=>box(x1-x0,h,z1-z0,(x0+x1)/2,y,(z0+z1)/2,material,parent);

  // Two new partitions; the front partition contains the open pocket-door cavity.
  const rightFaces=[wallMaterial,bathroomPaint,trim,trim,wallMaterial,bathroomPaint];
  const frontFaces=[wallMaterial,wallMaterial,trim,trim,wallMaterial,bathroomPaint];
  box(thick,height,2.81,-1.49,floor,-2.445,rightFaces,bathroom);
  strip(opening.x1,-1.49,-1.10,-.98,floor,height,frontFaces,bathroom);
  // Park left in local space: the installed door slides right toward the driveway wall.
  strip(-3.85,opening.x0,-1.10,-1.067,floor,opening.head,bathroomPaint,bathroom);
  strip(-3.85,opening.x0,-1.013,-.98,floor,opening.head,wallMaterial,bathroom);
  strip(-3.85,opening.x0,-1.10,-.98,floor+opening.head,height-opening.head,frontFaces,bathroom);
  strip(opening.x0,opening.x1,-1.10,-.98,floor+opening.head,height-opening.head,frontFaces,bathroom);
  const pocket=named('Basement bathroom pocket door',bathroom);
  const pocketWidth=Math.min(.90,opening.x1-opening.x0-.014);
  box(pocketWidth,opening.head-.025,.036,opening.x0-pocketWidth/2,floor+.014,-1.04,trim,pocket);
  box(.009,.16,.04,opening.x0-.0045,floor+.86,-1.04,steel,pocket);
  for(const x of [opening.x0-.026,opening.x1+.026]){
    box(.046,opening.head,.017,x,floor,-.968,trim,bathroom);
    box(.046,opening.head,.017,x,floor,-1.112,trim,bathroom);
  }
  box(opening.x1-opening.x0+.094,.035,.017,(opening.x0+opening.x1)/2,floor+opening.head-.004,-.968,trim,bathroom);
  box(opening.x1-opening.x0+.094,.035,.017,(opening.x0+opening.x1)/2,floor+opening.head-.004,-1.112,trim,bathroom);

  // Thin Classic Gray liners retain both real cellar-window apertures.
  for(const [z0,z1]of[[-3.85,-2.68],[-1.88,-1.10]])strip(-3.85,-3.834,z0,z1,floor,height,bathroomPaint,bathroom);
  strip(-3.85,-3.834,-2.68,-1.88,floor,.225-floor,bathroomPaint,bathroom);
  strip(-3.85,-3.834,-2.68,-1.88,.675,ceiling-.675,bathroomPaint,bathroom);
  const rearWindow=[-3.02,-2.22];
  for(const [x0,x1]of[[-3.85,rearWindow[0]],[rearWindow[1],-1.55]])strip(x0,x1,-3.85,-3.834,floor,height,bathroomPaint,bathroom);
  strip(...rearWindow,-3.85,-3.834,floor,.225-floor,bathroomPaint,bathroom);
  strip(...rearWindow,-3.85,-3.834,.675,ceiling-.675,bathroomPaint,bathroom);
  // A continuous tile plane and narrow joints avoid a noisy checkerboard effect.
  strip(bathroomBounds.x0,bathroomBounds.x1,bathroomBounds.z0,bathroomBounds.z1,floor+.005,.016,grout,bathroom);
  let row=0;
  for(let z=-3.85;z<-1.1;z+=.60,row++){
    let column=0;
    for(let x=-3.85;x<-1.55;x+=.60,column++){
      const x1=Math.min(-1.55,x+.60),z1=Math.min(-1.10,z+.60);
      strip(x+.0018,x1-.0018,z+.0018,z1-.0018,floor+.021,.004,floorTiles[(row+column*2)%floorTiles.length],bathroom);
    }
  }
  box(.015,.084,2.69,-1.561,floor+.025,-2.475,trim,bathroom);
  strip(-2.80,-1.57,-3.833,-3.814,floor+.025,.084,trim,bathroom);
  for(const [x0,x1]of[[-3.834,opening.x0-.05],[opening.x1+.05,-1.565]])strip(x0,x1,-1.122,-1.107,floor+.025,.084,trim,bathroom);

  // A 36 × 60 inch walk-in shower, with a full-width open end and a low tray.
  const [sx0,sz0,sx1,sz1]=mirrorBasementRect(P.shower.rect);
  strip(sx0,sx1,sz0,sz1,floor+.005,.03,porcelain,shower);
  strip(sx0+.018,sx1-.018,sz0+.018,sz1-.018,floor+.035,.002,wetTile,shower);
  // Both wet walls respect their cellar windows. Only the rear section outside its
  // aperture receives full-height tile; tile below either sill stops at y=.22.
  strip(-3.832,-3.812,sz0,sz1,floor+.03,1.49,wetTile,shower);
  const rearTileSegments=[
    [sx0,Math.min(sx1,rearWindow[0]),1.84],
    [Math.max(sx0,rearWindow[0]),Math.min(sx1,rearWindow[1]),1.49],
    [Math.max(sx0,rearWindow[1]),sx1,1.84],
  ].filter(([a,b])=>b>a);
  for(const [a,b,h]of rearTileSegments)strip(a,b,-3.832,-3.812,floor+.03,h,wetTile,shower);
  for(let h=.33;h<1.52;h+=.30){
    strip(-3.811,-3.810,sz0,sz1,floor+h,.002,wetGrout,shower);
    strip(sx0,sx1,-3.811,-3.810,floor+h,.002,wetGrout,shower);
  }
  for(const [a,b,h]of rearTileSegments)if(h>1.80)strip(a,b,-3.811,-3.810,floor+1.83,.002,wetGrout,shower);
  for(let z=sz0+.305;z<sz1;z+=.305)box(.001,1.49,.002,-3.810,floor+.03,z,wetGrout,shower);
  for(let x=sx0+.305;x<sx1;x+=.305)box(.002,x>=rearWindow[0]&&x<=rearWindow[1]?1.49:1.84,.001,x,floor+.03,-3.810,wetGrout,shower);
  for(let x=sx0+.115;x<sx1-.02;x+=.115)box(.0015,.001,sz1-sz0-.04,x,floor+.037,(sz0+sz1)/2,wetGrout,shower);
  for(let z=sz0+.127;z<sz1-.02;z+=.127)box(sx1-sx0-.04,.001,.0015,(sx0+sx1)/2,floor+.037,z,wetGrout,shower);
  const showerGlass=box(.008,1.84,sz1-sz0,sx1,floor+.038,(sz0+sz1)/2,glass,shower);showerGlass.castShadow=false;
  roundBeam([sx1,floor+1.883,sz0],[sx1,floor+1.883,sz1],.008,steel,shower);
  for(const z of [sz0+.10,(sz0+sz1)/2,sz1-.10])box(.028,.035,.039,sx1,floor+.037,z,steel,shower);
  const showerX=(sx0+sx1)/2;
  roundBeam([showerX,floor+.96,-3.758],[showerX,floor+1.915,-3.758],.011,steel,shower);
  roundBeam([showerX,floor+1.915,-3.758],[showerX,floor+1.915,-3.47],.011,steel,shower);
  add(new THREE.CylinderGeometry(.132,.132,.018,32),steel,[showerX,floor+1.902,-3.47],shower);
  add(new THREE.CylinderGeometry(.121,.121,.003,32),shadow,[showerX,floor+1.891,-3.47],shower);
  const valve=add(new THREE.CylinderGeometry(.056,.056,.024,24),steel,[showerX,floor+1.02,-3.788],shower);valve.rotation.x=Math.PI/2;
  roundBeam([showerX,floor+1.02,-3.755],[showerX+.061,floor+1.055,-3.747],.009,steel,shower);
  for(const y of [floor+1.14,floor+1.74])roundBeam([showerX,y,-3.812],[showerX,y,-3.755],.015,steel,shower);
  box(.34,.005,.047,showerX,floor+.038,-3.70,steel,shower);
  for(let i=-4;i<=4;i++)box(.019,.001,.003,showerX+i*.033,floor+.043,-3.70,shadow,shower);

  // Reuse the home's rounded porcelain fixture at the measured proposal position.
  const wc=toilet(-2.08,-3.39,floor+.01);
  if(wc){wc.name='Basement toilet';wc.userData.dynamic=true;wc.userData.basementProposal=true;bathroom.add(wc);mergeStatic(wc);}
  // Keep the relocated entry unobstructed: the towel rail is on the partition beside the WC.
  for(const z of [-2.88,-2.50])beam([-1.562,floor+1.02,z],[-1.61,floor+1.02,z],.014,steel,bathroom);
  roundBeam([-1.61,floor+1.02,-2.88],[-1.61,floor+1.02,-2.50],.009,steel,bathroom);
  box(.015,.35,.245,-1.625,floor+.675,-2.69,linen,bathroom);
  box(.018,.009,.235,-1.628,floor+.69,-2.69,trim,bathroom);

  // 30 × 20 inch floating oak vanity, facing the center of the room (-X).
  const [vx0,vz0,vx1,vz1]=mirrorBasementRect(P.vanity.rect);
  const vx=(vx0+vx1)/2,vz=(vz0+vz1)/2,depth=vx1-vx0,width=vz1-vz0;
  box(depth-.03,.034,width-.024,vx,floor+.30,vz,oak,vanity);
  for(const z of [vz-width/2+.012,vz+width/2-.012])box(depth-.025,.445,.024,vx,floor+.334,z,oak,vanity);
  box(.020,.445,width-.032,-1.566,floor+.334,vz,oak,vanity);
  for(const [bottom,h]of[[.335,.213],[.555,.220]])box(.024,h,width-.038,vx-depth/2+.012,floor+bottom,vz,oak,vanity);
  box(.013,.014,width-.065,vx-depth/2-.003,floor+.546,vz,shadow,vanity);
  for(let z=vz-width/2+.067;z<vz+width/2-.04;z+=.051){
    box(.002,.197,.0018,vx-depth/2-.0008,floor+.343,z,shadow,vanity);
    box(.002,.204,.0018,vx-depth/2-.0008,floor+.563,z,shadow,vanity);
  }
  const top=new THREE.Shape();
  top.moveTo(-.26,-.39);top.lineTo(.26,-.39);top.lineTo(.26,.39);top.lineTo(-.26,.39);top.closePath();
  const hole=new THREE.Path();hole.absellipse(-.015,0,.164,.232,0,Math.PI*2,true);top.holes.push(hole);
  const worktop=add(new THREE.ExtrudeGeometry(top,{depth:.026,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,steps:1}),porcelain,[vx,floor+.797,vz],vanity);
  worktop.rotation.x=-Math.PI/2;
  const basinProfile=[[0,0],[.055,.004],[.145,.024],[.217,.077],[.242,.093],[.24,.103],[.23,.099],[.202,.072],[.128,.025],[.045,.013],[0,.013]];
  add(new THREE.LatheGeometry(basinProfile.map(([r,y])=>new THREE.Vector2(r,y)),40),porcelain,[vx-.015,floor+.725,vz],vanity,[.70,1,1]);
  add(new THREE.CylinderGeometry(.015,.015,.003,16),steel,[vx-.015,floor+.741,vz],vanity);
  roundBeam([-1.614,floor+.832,vz],[-1.614,floor+1.009,vz],.014,steel,vanity);
  roundBeam([-1.614,floor+1.009,vz],[-1.791,floor+1.009,vz],.014,steel,vanity);
  roundBeam([-1.791,floor+1.009,vz],[-1.791,floor+.984,vz],.014,steel,vanity);
  roundBeam([-1.614,floor+.866,vz+.06],[-1.614,floor+.94,vz+.06],.008,steel,vanity);
  const mirror=add(new THREE.CircleGeometry(.301,64),mirrorFinish,[-1.575,floor+1.42,vz],vanity,[1,1.27,1]);mirror.rotation.y=-Math.PI/2;mirror.castShadow=false;
  const mirrorRim=add(new THREE.RingGeometry(.300,.313,64),steel,[-1.578,floor+1.42,vz],vanity,[1,1.27,1]);mirrorRim.rotation.y=-Math.PI/2;
  box(.050,.024,.56,-1.609,floor+1.86,vz,steel,vanity);
  box(.056,.009,.52,-1.612,floor+1.852,vz,warmLED,vanity).castShadow=false;
  add(new THREE.CylinderGeometry(.028,.031,.095,18),porcelain,[-1.715,floor+.878,vz-.305],vanity);
  box(.045,.012,.014,-1.727,floor+.926,vz-.305,steel,vanity);

  // The central utility enclosure contains the existing equipment; no equipment is invented here.
  box(.12,height,2.70,-1.49,floor,.31,wallMaterial,utility);
  box(.12,height,2.70,1.31,floor,.31,wallMaterial,utility);
  box(2.92,height,.12,-.09,floor,-1.04,wallMaterial,utility);
  const serviceHalf=.762;
  strip(-1.55,-serviceHalf,1.60,1.72,floor,height,wallMaterial,utility);
  strip(serviceHalf,1.37,1.60,1.72,floor,height,wallMaterial,utility);
  strip(-serviceHalf,serviceHalf,1.60,1.72,floor+2.03,height-2.03,wallMaterial,utility);
  for(const x of [-serviceHalf-.025,serviceHalf+.025])box(.047,2.03,.022,x,floor,1.734,trim,utility);
  box(serviceHalf*2+.096,.033,.022,0,floor+2.026,1.734,trim,utility);
  const doors=[];
  for(const side of [-1,1]){
    const door=named(side<0?'Basement utility right door':'Basement utility left door',utility);
    door.position.set(side*serviceHalf,floor,1.741);door.rotation.y=side*THREE.MathUtils.degToRad(165);
    const direction=-side,leafWidth=serviceHalf-.008,cx=direction*leafWidth/2;
    box(leafWidth,2.005,.037,cx,.015,0,trim,door);
    box(leafWidth-.12,.70,.012,cx,.12,.024,ceilingPaint,door);
    box(leafWidth-.12,.91,.012,cx,.92,.024,ceilingPaint,door);
    const handleX=direction*(leafWidth-.095);
    roundBeam([handleX,.925,-.012],[handleX,.925,.067],.016,steel,door);
    roundBeam([handleX,.925,.067],[handleX-direction*.095,.925,.067],.012,steel,door);
    for(const y of [.23,1.03,1.79])roundBeam([0,y-.028,0],[0,y+.028,0],.009,steel,door);
    mergeStatic(door);doors.push(door);
  }
  // Only the two proposed rooms receive ceiling panels; the surrounding joists remain exposed.
  box(2.30,.024,2.75,-2.70,ceiling-.024,-2.475,ceilingPaint,ceilings);
  box(2.80,.024,2.70,-.09,ceiling-.024,.31,ceilingPaint,ceilings);
  add(new THREE.CylinderGeometry(.13,.13,.012,32),trim,[-2.68,ceiling-.030,-1.86],ceilings);
  add(new THREE.CylinderGeometry(.116,.116,.002,32),warmLED,[-2.68,ceiling-.037,-1.86],ceilings).castShadow=false;
  box(.40,.010,.40,.10,ceiling-.036,.74,trim,ceilings);
  box(.36,.003,.36,.10,ceiling-.039,.74,warmLED,ceilings).castShadow=false;

  for(const part of [pocket,shower,vanity,bathroom,utility,ceilings])mergeStatic(part);
  return {proposal,bathroom,shower,vanity,utility,ceilings,doors,pocket};
}
