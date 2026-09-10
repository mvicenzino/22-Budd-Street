import {filmPose,filmChapter,FILM_CHAPTERS,FILM_DURATION} from './cinematic-path.js';

const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const clampTime=seconds=>Math.max(0,Math.min(FILM_DURATION,Number.isFinite(seconds)?seconds:0));
const floorNames={first:'First floor',second:'Second floor',loft:'Loft',basement:'Basement',outside:'Outside'};

export function createCinema({interior,post,scene,camera,renderer,stopExterior}) {
  const $=s=>document.querySelector(s),panel=$('#cinema-controls'),toggle=$('#cinema-play'),seek=$('#cinema-seek');
  const chapters=$('#cinema-chapter'),previous=$('#cinema-previous'),next=$('#cinema-next');
  const number=$('#cinema-number'),title=$('#cinema-title'),subtitle=$('#cinema-subtitle'),time=$('#cinema-time');
  let active=false,playing=false,seconds=0,last=0,returnFocus=null,paintedChapter=-1,paintedSecond=-1,paintedPlaying=null;
  const inertBefore=new Map();
  seek.max=String(FILM_DURATION);
  $('#cinema-duration').textContent=`${formatTime(FILM_DURATION)} · ALL FLOORS`;
  const groups=new Map();
  FILM_CHAPTERS.forEach((chapter,index)=>{
    const floor=floorNames[chapter.floor]||chapter.floor||'The house';
    if(!groups.has(floor)){
      const group=document.createElement('optgroup');group.label=floor;groups.set(floor,group);chapters.append(group);
    }
    const option=document.createElement('option');option.value=String(index);
    option.textContent=`${chapter.subtitle.split(' · ')[0]} — ${formatTime(chapter.time)}`;
    groups.get(floor).append(option);
  });
  const chapterIndex=()=>{
    const after=FILM_CHAPTERS.findIndex(chapter=>chapter.time>seconds);
    return after<0?FILM_CHAPTERS.length-1:Math.max(0,after-1);
  };
  function paint() {
    const pose=filmPose(seconds);
    post.setOpacity(pose.opacity);
    interior.cinemaFrame(pose);
    const index=chapterIndex(),chapter=filmChapter(seconds);
    if(index!==paintedChapter){
      number.textContent=`${chapter.number} / ${floorNames[chapter.floor]||chapter.floor||'A WALK THROUGH HOME'}`;
      title.textContent=chapter.title;subtitle.textContent=chapter.subtitle;
      chapters.value=String(index);
      $('#cinema-announcement').textContent=`${floorNames[chapter.floor]||chapter.floor||''}. ${chapter.subtitle}.`;
      paintedChapter=index;
    }
    seek.value=String(seconds);
    seek.style.setProperty('--progress',`${seconds/FILM_DURATION*100}%`);
    if(Math.floor(seconds)!==paintedSecond){
      time.textContent=`${formatTime(seconds)} / ${formatTime(FILM_DURATION)}`;
      seek.setAttribute('aria-valuetext',`${formatTime(seconds)} of ${formatTime(FILM_DURATION)}. ${chapter.subtitle}`);
      paintedSecond=Math.floor(seconds);
    }
    const playback=seconds>=FILM_DURATION?'Replay':playing?'Pause':'Play';
    if(playback!==paintedPlaying){
      toggle.textContent=playback;toggle.setAttribute('aria-pressed',String(playing));
      toggle.setAttribute('aria-label',`${playback} cinematic tour`);paintedPlaying=playback;
    }
    previous.disabled=index===0&&seconds===0;next.disabled=index===FILM_CHAPTERS.length-1;
  }
  function pause() {playing=false;last=0;if(active)paint();}
  function moveTo(value,{pausePlayback=false}={}) {
    seconds=clampTime(value);last=0;
    if(pausePlayback||seconds===FILM_DURATION)playing=false;
    paint();
  }
  function moveToChapter(index) {
    const chapter=FILM_CHAPTERS[index],end=FILM_CHAPTERS[index+1]?.time??FILM_DURATION;
    // A paused jump should show the room, after the brief transition from the preceding shot.
    moveTo(chapter.time+(playing?0:Math.min(.65,(end-chapter.time)/2)));
  }
  function isolateControls() {
    // Keep the canvas and the rest of the app out of keyboard and assistive-technology navigation.
    let current=panel;
    while(current.parentElement){
      for(const sibling of current.parentElement.children){
        if(sibling===current||!(sibling instanceof HTMLElement)||['SCRIPT','STYLE'].includes(sibling.tagName))continue;
        inertBefore.set(sibling,sibling.inert);sibling.inert=true;
      }
      if(current.parentElement===document.body)break;
      current=current.parentElement;
    }
  }
  function start({manual=false}={}) {
    if(active)return true;
    const focusBefore=document.activeElement;
    if(!interior.beginCinema())return false;
    returnFocus=focusBefore;
    window.dispatchEvent(new Event('cinemastart'));stopExterior();
    active=true;seconds=0;last=0;playing=!manual&&!$('#reduce-motion').checked;
    paintedChapter=-1;paintedSecond=-1;paintedPlaying=null;
    panel.hidden=false;isolateControls();paint();
    toggle.focus({preventScroll:true});
    return true;
  }
  function close() {
    if(!active)return;
    active=false;playing=false;panel.hidden=true;
    for(const [element,inert]of inertBefore)element.inert=inert;
    inertBefore.clear();interior.endCinema();post.setOpacity(1);
    const focus=returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:$('#cinema-open');
    focus?.focus({preventScroll:true});
  }
  $('#cinema-open').onclick=()=>start();$('#cinema-exit').onclick=close;
  toggle.onclick=()=>{if(seconds>=FILM_DURATION)seconds=0;playing=!playing;last=0;paint();};
  $('#cinema-restart').onclick=()=>{playing=!$('#reduce-motion').checked;moveTo(0);};
  previous.onclick=()=>{
    const index=chapterIndex();
    moveToChapter(seconds>FILM_CHAPTERS[index].time+2?index:Math.max(0,index-1));
  };
  next.onclick=()=>moveToChapter(Math.min(FILM_CHAPTERS.length-1,chapterIndex()+1));
  chapters.onchange=()=>moveToChapter(Number(chapters.value));
  seek.oninput=()=>moveTo(Number(seek.value),{pausePlayback:true});
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const focusable=[...panel.querySelectorAll('button:not(:disabled),a[href],input,select')].filter(element=>element.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first?.focus();}
      return;
    }
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.tagName==='SELECT')return;
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      const value=event.key==='Home'?0:event.key==='End'?FILM_DURATION:seconds+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?1:5);
      moveTo(value,{pausePlayback:true});
    }else if(event.code==='Space'&&!['BUTTON','A'].includes(event.target.tagName)){
      event.preventDefault();toggle.click();
    }
  });
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)pause();});
  window.addEventListener('walkthroughchange',event=>{$('#cinema-open').disabled=event.detail.busy||['entering','exiting'].includes(event.detail.state);});
  function update(now) {
    if(!active)return false;
    if(playing&&last){seconds=Math.min(FILM_DURATION,seconds+Math.min(.1,(now-last)/1000));if(seconds>=FILM_DURATION)playing=false;}
    last=now;paint();post.render(scene,camera);return true;
  }
  return {get active(){return active;},start,close,update,seek(value){moveTo(value);}};
}
