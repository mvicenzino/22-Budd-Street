import {filmPose,filmChapter,FILM_DURATION} from './cinematic-path.js';

export function createCinema({interior,post,scene,camera,renderer,stopExterior}) {
  const $=s=>document.querySelector(s), panel=$('#cinema-controls'), toggle=$('#cinema-play'), seek=$('#cinema-seek');
  let active=false,playing=false,seconds=0,last=0,returnFocus=null;
  function paint() {
    interior.cinemaFrame(filmPose(seconds));
    const chapter=filmChapter(seconds);
    $('#cinema-number').textContent=chapter.number+' / A WALK THROUGH HOME';
    $('#cinema-title').textContent=chapter.title;
    $('#cinema-subtitle').textContent=chapter.subtitle;
    seek.value=seconds;
    seek.setAttribute('aria-valuetext',`${Math.round(seconds)} of ${FILM_DURATION} seconds`);
    $('#cinema-time').textContent=`${String(Math.floor(seconds)).padStart(2,'0')} / ${FILM_DURATION}s`;
    toggle.textContent=playing?'Pause':'Play';
    toggle.setAttribute('aria-pressed',String(playing));
  }
  function pause() { playing=false; if(active) paint(); }
  function start({manual=false}={}) {
    if(active) return true;
    if(!interior.beginCinema()) return false;
    returnFocus=document.activeElement;
    window.dispatchEvent(new Event('cinemastart'));
    stopExterior();
    active=true;seconds=0;last=0;playing=!manual&&!$('#reduce-motion').checked;
    panel.hidden=false;
    $('#cinema-exit').focus({preventScroll:true});
    paint();
    return true;
  }
  function close() {
    if(!active) return;
    active=false;playing=false;panel.hidden=true;
    interior.endCinema();
    returnFocus?.focus({preventScroll:true});
  }
  $('#cinema-open').onclick=()=>start();
  $('#cinema-exit').onclick=close;
  toggle.onclick=()=>{if(seconds>=FILM_DURATION) seconds=0;playing=!playing;last=0;paint();};
  $('#cinema-restart').onclick=()=>{seconds=0;playing=!$('#reduce-motion').checked;last=0;paint();};
  seek.oninput=()=>{const next=Number(seek.value);pause();seconds=next;paint();};
  document.addEventListener('keydown',event=>{
    if(!active)return;
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.code==='Space'&&!['BUTTON','INPUT'].includes(event.target.tagName)){event.preventDefault();toggle.click();}
  });
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)pause();});
  window.addEventListener('walkthroughchange',event=>{$('#cinema-open').disabled=event.detail.busy||event.detail.state==='entering'||event.detail.state==='exiting';});
  function update(now) {
    if(!active)return false;
    if(playing&&last){seconds=Math.min(FILM_DURATION,seconds+Math.min(.1,(now-last)/1000));if(seconds>=FILM_DURATION)playing=false;}
    last=now;paint();post.render(scene,camera);return true;
  }
  return {get active(){return active;},start,close,update,seek(time){seconds=Math.max(0,Math.min(FILM_DURATION,time));paint();}};
}
