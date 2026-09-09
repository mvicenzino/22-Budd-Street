import {TOUR_STOPS, renderQuality} from './navigation.js';
import {NODES, ROOMS} from './plan.js';

const $ = selector => document.querySelector(selector);
const key = 'budd-experience-v1';
const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]));
const roomById = Object.fromEntries(ROOMS.map(r => [r.id, r]));

export function createExperience({renderer, post, sun, interior, resize, stopExterior}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* Storage is optional. */ }
  const quality = $('#render-quality'), motion = $('#reduce-motion');
  quality.value = ['auto', 'high', 'balanced', 'light'].includes(saved.quality) ? saved.quality : 'auto';
  motion.checked = typeof saved.motion === 'boolean' ? saved.motion : matchMedia('(prefers-reduced-motion: reduce)').matches;
  const persist = () => { try { localStorage.setItem(key, JSON.stringify({quality: quality.value, motion: motion.checked})); } catch {} };
  let profile, previousFrame = 0, samples = 0, duration = 0, warmup = 90;
  const qualityNames = {high:'High', balanced:'Balanced', light:'Light'};
  function applyQuality(mode) {
    profile = renderQuality(mode, window.devicePixelRatio || 1, matchMedia('(max-width: 700px), (pointer: coarse)').matches);
    renderer.setPixelRatio(profile.pixelRatio);
    if (sun.shadow.mapSize.x !== profile.shadowSize) {
      sun.shadow.mapSize.setScalar(profile.shadowSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.needsUpdate = true;
    }
    resize();
    post.setQuality(profile);
    $('#quality-label').textContent = quality.value === 'auto' ? 'Quality · Auto' : 'Quality · ' + qualityNames[profile.name];
    $('#render-settings').title = quality.value === 'auto' ? 'Auto is using ' + qualityNames[profile.name].toLowerCase() + ' quality' : '';
    document.body.dataset.renderQuality = profile.name;
    warmup = 90; samples = 0; duration = 0; previousFrame = 0;
  }
  quality.addEventListener('change', () => { persist(); applyQuality(quality.value); });
  motion.addEventListener('change', () => { persist(); pause(); stopExterior(); $('#tour').disabled = motion.checked; });
  $('#tour').disabled = motion.checked;
  applyQuality(quality.value);

  const panel = $('#interior-transport'), opener = $('#interior-panel-open');
  function setPanel(open, focus = true) {
    panel.hidden = !open;
    opener.setAttribute('aria-expanded', String(open));
    if (focus) (open ? $('#interior-panel-close') : opener).focus({preventScroll:true});
  }
  opener.addEventListener('click', () => setPanel(panel.hidden));
  $('#interior-panel-close').addEventListener('click', () => setPanel(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#gallery').open) {
      if (!panel.hidden) setPanel(false);
      $('#render-settings').open = false;
      pause();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!$('#render-settings').contains(event.target)) $('#render-settings').open = false;
  });
  $('#gallery').addEventListener('click', event => {
    if (event.target !== $('#gallery')) return;
    const box = event.target.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
  });

  let playing = false, timer = null;
  let nav = interior.navigation;
  const indexFor = id => {
    const direct = TOUR_STOPS.indexOf(id);
    return direct >= 0 ? direct : Math.max(0, TOUR_STOPS.findIndex(stop => nodeById[stop].room === nodeById[id]?.room));
  };
  function pause() {
    playing = false;
    clearTimeout(timer); timer = null;
    $('#guided-tour').textContent = '▷ Play tour';
    $('#guided-tour').setAttribute('aria-pressed', 'false');
  }
  function visit(index) {
    if (nav.state !== 'inside' || nav.busy || index < 0 || index >= TOUR_STOPS.length) return;
    setPanel(false, false);
    interior.walkTo(TOUR_STOPS[index]);
  }
  function updateNavigation(status) {
    nav = status;
    const active = status.state === 'inside' && !status.busy;
    const index = indexFor(status.current);
    $('#previous-room').disabled = !active || index === 0;
    $('#next-room').disabled = !active || index === TOUR_STOPS.length - 1;
    $('#overview-toggle').disabled = !active;
    $('#exit-interior').disabled = !active;
    $('#guided-tour').disabled = status.state !== 'inside';
    for (const button of document.querySelectorAll('[data-node]')) button.disabled = !active;
    const next = TOUR_STOPS[index + 1];
    $('#next-room').textContent = next ? 'Next room →' : 'Tour complete';
    $('#next-room').title = next ? roomById[nodeById[next].room].name : 'You have reached the last room';
    $('#tour-progress').textContent = 'ROOM ' + String(index + 1).padStart(2, '0') + ' / ' + String(TOUR_STOPS.length).padStart(2, '0');
    clearTimeout(timer); timer = null;
    if (status.state === 'outside') { pause(); setPanel(false, false); }
    if (playing && active) {
      if (next) timer = setTimeout(() => visit(index + 1), 6500);
      else pause();
    }
  }
  $('#previous-room').onclick = () => { pause(); visit(indexFor(nav.current) - 1); };
  $('#next-room').onclick = () => { pause(); visit(indexFor(nav.current) + 1); };
  $('#guided-tour').onclick = () => {
    if (playing) { pause(); return; }
    playing = true;
    $('#guided-tour').textContent = 'Ⅱ Pause tour';
    $('#guided-tour').setAttribute('aria-pressed', 'true');
    if (indexFor(nav.current) === TOUR_STOPS.length - 1 && !nav.busy) visit(0);
    else updateNavigation(nav);
  };
  for (const selector of ['#scene', '#room-chips', '#design-panel', '#interior-panel-open', '#hotspots', '#overview-toggle', '#exit-interior', '#photos']) {
    $(selector).addEventListener('pointerdown', pause);
    $(selector).addEventListener('keydown', pause);
  }
  $('#scene').addEventListener('wheel', pause, {passive:true});
  window.addEventListener('walkthroughchange', event => updateNavigation(event.detail));
  document.addEventListener('visibilitychange', () => { previousFrame = 0; if (document.hidden) pause(); });
  updateNavigation(nav);

  // Sustained frame time, after shader warm-up, can step Auto down. Explicit settings stay fixed.
  function sample(now) {
    const frame = previousFrame ? now - previousFrame : 0;
    previousFrame = now;
    if (!frame || frame > 250) return;
    if (warmup > 0) { warmup--; return; }
    if (quality.value !== 'auto' || profile.name === 'light') return;
    duration += frame; samples++;
    if (samples >= 120) {
      const slow = duration / samples > 34;
      samples = 0; duration = 0;
      if (slow) applyQuality(profile.name === 'high' ? 'balanced' : 'light');
    }
  }
  return {sample};
}
