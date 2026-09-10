import test from 'node:test';
import assert from 'node:assert/strict';
import {filmPose,filmChapter,FILM_SHOTS,FILM_CHAPTERS,FILM_DURATION} from '../cinematic-path.js';
import {PARTITIONS,OPENINGS,SHELL,LEVELS} from '../plan.js';

test('film covers all four floors and agreed room paint chapters',()=>{
  assert.equal(FILM_DURATION,90);
  assert.deepEqual([...new Set(FILM_CHAPTERS.map(c=>c.floor))],['first','second','loft','basement']);
  for(const chapter of FILM_CHAPTERS){
    assert.equal(filmChapter(chapter.time),chapter);
    assert.equal(filmPose(chapter.time+.8).floor,chapter.floor);
  }
  assert.ok(FILM_CHAPTERS.some(c=>c.subtitle==='Powder room · Classic Gray OC-23'));
  assert.ok(FILM_CHAPTERS.some(c=>c.subtitle==='Upstairs bathroom · Classic Gray OC-23'));
  assert.ok(FILM_CHAPTERS.some(c=>c.subtitle==='Sunroom · Seapearl OC-19'));
});
test('each cinematic shot is deterministic, bounded and moves at a comfortable speed',()=>{
  assert.deepEqual(filmPose(-1),filmPose(0));assert.deepEqual(filmPose(999),filmPose(FILM_DURATION));
  assert.deepEqual(filmPose(NaN),filmPose(0));
  for(const shot of FILM_SHOTS){
    const start=shot.stations[0].t,end=shot.stations.at(-1).t;
    for(const station of shot.stations.slice(0,-1))assert.deepEqual(filmPose(station.t).position,station.p);
    for(let t=start;t<end-.02;t+=.01){
      const a=filmPose(t),b=filmPose(t+.01);
      assert.ok([...a.position,...a.target,a.fov,a.opacity].every(Number.isFinite));
      assert.ok(Math.hypot(...a.position.map((v,i)=>b.position[i]-v))<.025,`camera speed at ${t}`);
      assert.ok(Math.hypot(...a.position.map((v,i)=>a.target[i]-v))>.6,'look direction stays stable');
      assert.ok(a.opacity>=0&&a.opacity<=1);
    }
  }
});
test('all room edits are concealed and settle to an unobstructed image',()=>{
  for(const shot of FILM_SHOTS.slice(1)){
    const cut=shot.stations[0].t;
    assert.equal(filmPose(cut).opacity,0);
    assert.ok(filmPose(cut-.001).opacity<.00001);
    assert.ok(filmPose(cut+.001).opacity<.00001);
    assert.equal(filmPose(cut+.7).opacity,1);
  }
  assert.equal(filmPose(0).opacity,1);assert.equal(filmPose(FILM_DURATION).opacity,1);
});
test('film cameras stay clear of floor partitions and ceiling planes',()=>{
  for(let t=0;t<FILM_DURATION;t+=.01){
    const pose=filmPose(t),p=pose.position,level=LEVELS[pose.floor];
    const walls=PARTITIONS.filter(w=>w.level===pose.floor);
    if(pose.floor==='first')walls.push({axis:'x',coord:SHELL.z,c0:-SHELL.x,c1:SHELL.x,openings:OPENINGS.front.map(o=>({...o,y1:o.y1-level.y}))});
    assert.ok(p[1]>level.y+.9&&p[1]<level.ceil-.15,`floor/ceiling clearance at ${t}`);
    for(const w of walls){
      const perpendicular=w.axis==='x'?p[2]:p[0],along=w.axis==='x'?p[0]:p[2];
      if(Math.abs(perpendicular-w.coord)>.08||along<w.c0||along>w.c1)continue;
      assert.ok(w.openings.some(o=>along>o.a0+.09&&along<o.a1-.09&&p[1]<level.y+(o.y1??2.75)-.08),`wall collision at ${t.toFixed(2)}s: ${JSON.stringify(w)}`);
    }
  }
});
test('entrance door opens before the camera crosses its threshold',()=>{
  for(let t=0;t<20;t+=.02)if(filmPose(t).position[2]<4.15)assert.equal(filmPose(t).door,1);
});
