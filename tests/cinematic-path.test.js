import test from 'node:test';
import assert from 'node:assert/strict';
import {filmPose,filmChapter,FILM_STATIONS,FILM_DURATION} from '../cinematic-path.js';
import {PARTITIONS,OPENINGS,SHELL} from '../plan.js';

test('cinematic path is deterministic, bounded and continuous with stable endpoints',()=>{
  assert.deepEqual(filmPose(-1),filmPose(0));assert.deepEqual(filmPose(99),filmPose(FILM_DURATION));
  for(const station of FILM_STATIONS)assert.deepEqual(filmPose(station.t).position,station.p);
  for(let t=0;t<FILM_DURATION;t+=.01){
    const a=filmPose(t),b=filmPose(t+.01);
    assert.ok([...a.position,...a.target,a.fov].every(Number.isFinite));
    assert.ok(Math.hypot(...a.position.map((v,i)=>b.position[i]-v))<.025,'camera speed remains comfortable');
    assert.ok(Math.hypot(...a.position.map((v,i)=>a.target[i]-v))>.6,'camera never looks through its own position');
  }
});
test('film camera crosses first-floor walls only through openings with head clearance',()=>{
  const walls=[...PARTITIONS.filter(w=>w.level==='first'),{axis:'x',coord:SHELL.z,c0:-SHELL.x,c1:SHELL.x,openings:OPENINGS.front.map(o=>({...o,y1:o.y1-1.1}))}];
  for(let t=0;t<FILM_DURATION;t+=.005){
    const p=filmPose(t).position;
    for(const w of walls){
      const perpendicular=w.axis==='x'?p[2]:p[0],along=w.axis==='x'?p[0]:p[2];
      if(Math.abs(perpendicular-w.coord)>.08||along<w.c0||along>w.c1)continue;
      assert.ok(w.openings.some(o=>along>o.a0+.09&&along<o.a1-.09&&p[1]<1.1+(o.y1??2.75)-.08),`wall collision at ${t.toFixed(2)}s`);
    }
  }
});
test('door opens before the camera reaches it and all four film chapters appear',()=>{
  for(let t=0;t<FILM_DURATION;t+=.02)if(filmPose(t).position[2]<4.15)assert.equal(filmPose(t).door,1);
  assert.deepEqual([0,8,12,19].map(t=>filmChapter(t).number),['01','02','03','04']);
});
