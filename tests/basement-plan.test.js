import test from 'node:test';
import assert from 'node:assert/strict';
import {BASEMENT_PLAN as P, BASEMENT_WALLS} from '../basement-plan.js';
import {NODES} from '../plan.js';
import {migrateDesign} from '../design.js';
import {filmPose} from '../cinematic-path.js';

const inside = (x,z,r,pad=0) => x>r[0]-pad && x<r[2]+pad && z>r[1]-pad && z<r[3]+pad;
const obstacles = [...BASEMENT_WALLS, P.boiler.rect, P.shower.rect, P.vanity.rect];
const clear = (x,z,label) => {
  for(const rect of obstacles) assert.ok(!inside(x,z,rect,.1), `${label}: obstacle at ${x.toFixed(2)}, ${z.toFixed(2)}`);
  assert.ok(Math.hypot(x-1.72,z+.8)>.2, `${label}: existing steel column`);
};

test('basement walking paths pass through actual openings and avoid equipment and column', () => {
  for(const node of NODES.filter(n=>n.room==='basement')) {
    clear(node.x,node.z,node.id);
    for(const link of node.links) {
      const dest=NODES.find(n=>n.id===link.to);
      if(dest.room!=='basement')continue;
      const points=[[node.x,node.z],...(link.via||[]).map(p=>p.slice(0,2)),[dest.x,dest.z]];
      for(let i=1;i<points.length;i++) for(let t=0;t<=1;t+=.01) {
        const [a,b]=[points[i-1],points[i]];
        clear(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,`${node.id} → ${link.to}`);
      }
    }
  }
});

test('basement film cameras remain outside proposed walls and fixtures', () => {
  for(let time=76;time<=90;time+=.01) {
    const {position:[x,,z]}=filmPose(time);
    clear(x,z,`film ${time.toFixed(2)}s`);
  }
});

test('bath fixtures and service reservation fit the stated concept dimensions', () => {
  const inch=.0254, shower=P.shower.rect;
  assert.ok(Math.abs(shower[2]-shower[0]-36*inch)<1e-6);
  assert.ok(Math.abs(shower[3]-shower[1]-60*inch)<1e-6);
  assert.ok(Math.abs(P.bathroom.door[1]-P.bathroom.door[0]-36*inch)<1e-6);
  assert.ok(Math.abs(P.utility.door[1]-P.utility.door[0]-60*inch)<1e-6);
  // Deliberately show a generous planning reserve, not a manufacturer-specific approval.
  assert.ok(P.service.rect[3]-P.service.rect[1]>=36*inch-1e-6);
  assert.ok(P.service.rect[3]<P.utility.rect[3]);
  const wcX=-2.08,wcFront=-3.13;
  assert.ok(P.bathroom.rect[2]-wcX>=15*inch);
  assert.ok(wcX-shower[2]>=15*inch);
  assert.ok(P.vanity.rect[1]-wcFront>=21*inch);
});


test('obsolete basement studies migrate without discarding finishes or other rooms', () => {
  for (const layout of ['family','office']) {
    const before={version:5,basement:{floor:'epoxy'},rooms:{basement:{layout,wall:'seapearl'},living:{layout:'side',wall:'navy'}}};
    const after=migrateDesign(before);
    assert.equal(after.rooms.basement.layout,'unfinished');
    assert.equal(after.basement.floor,'epoxy');
    assert.equal(after.rooms.basement.wall,'seapearl');
    assert.deepEqual(after.rooms.living,before.rooms.living);
    assert.equal(before.rooms.basement.layout,layout);
  }
  assert.equal(migrateDesign({version:6,rooms:{basement:{layout:'bathroom'}}}).rooms.basement.layout,'bathroom');
});
