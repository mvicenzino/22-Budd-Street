import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FILM_CHAPTERS, FILM_DURATION, filmChapter, filmPose} from '../cinematic-path.js';
import {TOUR_STOPS} from '../navigation.js';
import {LEVELS, NODES, ROOMS} from '../plan.js';
import {HOUSE_PALETTE, defaultWall} from '../paint-plan.js';

// Use visitors' controls in a fresh browser, leaving existing tabs and saved choices alone.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const screenshotDir = process.env.QA_SCREENSHOTS && resolve(process.env.QA_SCREENSHOTS);
if (screenshotDir) await mkdir(screenshotDir, {recursive:true});
const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport:{width:1280, height:720}}), errors = [];
page.setDefaultTimeout(45000);
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => {
  if (response.status() >= 400 && new URL(response.url()).origin === new URL(baseURL).origin) errors.push(`${response.status()} ${response.url()}`);
});
await page.addInitScript(() => {
  window.__walkthroughQA = null;
  window.addEventListener('walkthroughchange', event => { window.__walkthroughQA = event.detail; });
});
const byId = Object.fromEntries(NODES.map(n => [n.id,n]));
const roomById = Object.fromEntries(ROOMS.map(r => [r.id,r]));
const paintById = Object.fromEntries(HOUSE_PALETTE.map(p => [p.id,p]));
const renderedFrames = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const snapshot = async name => {
  if (screenshotDir) { await renderedFrames(); await page.screenshot({path:resolve(screenshotDir, `${name}.png`)}); }
};
async function visibleScene() {
  // Read after a render, before the browser discards the WebGL drawing buffer.
  // A visible canvas element alone would miss a blank frame after resizing.
  const pixels = await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
    const canvas = document.querySelector('#scene canvas'), gl = canvas.getContext('webgl2');
    const edge = 128, data = new Uint8Array(edge*edge*4);
    gl.readPixels(Math.floor((canvas.width-edge)/2), Math.floor((canvas.height-edge)/2), edge, edge, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let opaque = 0, sum = 0, squares = 0;
    for (let i=0; i<data.length; i+=4) {
      const brightness=(data[i]+data[i+1]+data[i+2])/3;
      if (data[i+3] > 250) opaque++;
      sum+=brightness; squares+=brightness*brightness;
    }
    const count=edge*edge, mean=sum/count;
    done({opaque:opaque/count, mean, variance:squares/count-mean*mean});
  }))));
  assert.ok(pixels.opaque > .99 && pixels.mean > 15 && pixels.variance > 3, `The exterior contains rendered geometry: ${JSON.stringify(pixels)}`);
}
async function ready() {
  await page.locator('#loading').waitFor({state:'hidden'});
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.ok(await page.locator('#scene canvas').isVisible(), 'The 3D canvas is visible');
}
async function settings(callback) {
  if (!await page.locator('#render-settings').evaluate(e => e.open)) await page.locator('#render-settings summary').click();
  await callback();
  await page.locator('#render-settings summary').click();
}
async function waitRoom(id) {
  await page.waitForFunction(expected => {
    const state = window.__walkthroughQA;
    return state?.state === 'inside' && state.current === expected && !state.busy;
  }, id);
  const n = byId[id], room = roomById[n.room];
  assert.equal(await page.locator('#viewname').textContent(), n.name || room.name);
  assert.ok((await page.locator('#chapter-label').textContent()).includes(LEVELS[room.level].name.toUpperCase()));
  assert.ok((await page.locator('#mode-label').textContent()).includes(paintById[defaultWall(n.room)].code), `${room.name} shows its agreed paint`);
}
async function overview(id) {
  await page.locator('#overview-toggle').click();
  await page.waitForFunction(() => window.__walkthroughQA?.overview === true);
  assert.ok((await page.locator('#viewname').textContent()).includes('overview'));
  await page.locator('#overview-toggle').click();
  await page.waitForFunction(() => window.__walkthroughQA?.overview === false);
  await waitRoom(id);
}
async function noOverflow(selectors) {
  const viewport = page.viewportSize();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, 'No horizontal page overflow');
  for (const selector of selectors) {
    const b = await page.locator(selector).boundingBox();
    assert.ok(b && b.x >= -1 && b.y >= -1 && b.x+b.width <= viewport.width+1 && b.y+b.height <= viewport.height+1, `${selector} fits the viewport`);
  }
}
async function waitOutside() { await page.waitForFunction(() => window.__walkthroughQA?.state === 'outside'); }
try {
  await page.goto(baseURL); await ready();
  await settings(async () => {
    await page.locator('#render-quality').selectOption('balanced');
    await page.locator('#reduce-motion').check();
  });
  await page.reload(); await ready();
  assert.equal(await page.locator('#render-quality').inputValue(), 'balanced', 'Render quality persists');
  assert.equal(await page.locator('#reduce-motion').isChecked(), true, 'Reduced motion persists');
  assert.equal(await page.locator('body').getAttribute('data-render-quality'), 'balanced');
  const initialView = await page.locator('#viewname').textContent();
  await page.locator('#cinema-open').click();
  assert.equal(await page.locator('#cinema-play').textContent(), 'Play', 'Reduced motion starts paused');
  assert.equal(Number(await page.locator('#cinema-seek').getAttribute('max')), FILM_DURATION);
  const chapterOptions = await page.locator('#cinema-chapter option').allTextContents();
  assert.equal(chapterOptions.length, FILM_CHAPTERS.length);
  const seenFloors = new Set();
  for (let i=0; i<chapterOptions.length; i++) {
    await page.locator('#cinema-chapter').selectOption(String(i));
    const seconds = Number(await page.locator('#cinema-seek').inputValue()), chapter = filmChapter(seconds);
    assert.equal(chapter.number, FILM_CHAPTERS[i].number);
    assert.equal(await page.locator('#cinema-title').textContent(), chapter.title);
    assert.equal(await page.locator('#cinema-subtitle').textContent(), chapter.subtitle);
    assert.equal(await page.locator('#cinema-play').textContent(), 'Play');
    assert.ok(filmPose(seconds).opacity > .999, 'A paused chapter opens on its visible room');
    seenFloors.add(chapter.floor);
    await snapshot(`chapter-${String(i+1).padStart(2,'0')}`);
  }
  assert.deepEqual([...seenFloors].sort(), ['basement','first','loft','second']);
  await page.locator('#cinema-chapter').selectOption('0');
  await page.locator('#cinema-next').click(); assert.equal(await page.locator('#cinema-chapter').inputValue(), '1');
  await page.locator('#cinema-previous').click(); assert.equal(await page.locator('#cinema-chapter').inputValue(), '0');
  await page.locator('#cinema-seek').press('End');
  assert.equal(Number(await page.locator('#cinema-seek').inputValue()), FILM_DURATION);
  assert.equal(await page.locator('#cinema-play').textContent(), 'Replay');
  await page.locator('#cinema-play').click();
  await page.waitForFunction(() => Number(document.querySelector('#cinema-seek').value) > .2);
  await page.locator('#cinema-play').click();
  assert.ok(Number(await page.locator('#cinema-seek').inputValue()) < 3, 'Replay starts from the beginning');
  await page.locator('#cinema-restart').click();
  assert.equal(Number(await page.locator('#cinema-seek').inputValue()), 0);
  assert.equal(await page.locator('#cinema-play').textContent(), 'Play');
  // Exit at an edit's fully dark frame; exploration must restore the scene.
  await page.locator('#cinema-seek').evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', {bubbles:true}));
  }, FILM_CHAPTERS.find(c => c.floor === 'second').time);
  await page.locator('#cinema-exit').click();
  assert.equal(await page.locator('#viewname').textContent(), initialView);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cinema-open');
  if (screenshotDir) await page.screenshot({path:resolve(screenshotDir, 'immediate-exit.png')});
  await visibleScene();
  await snapshot('outside-after-dark-transition');
  console.log(`PASS: all ${chapterOptions.length} cinematic chapters, four floors, seeking, chapter buttons, reduced motion and replay.`);

  await page.locator('#enter').click(); await waitRoom(TOUR_STOPS[0]);
  const visitedLevels = new Set();
  for (let i=0; i<TOUR_STOPS.length; i++) {
    const id = TOUR_STOPS[i];
    if (i) await page.locator('#next-room').click();
    await waitRoom(id);
    assert.equal(await page.locator('#tour-progress').textContent(), `ROOM ${String(i+1).padStart(2,'0')} / ${String(TOUR_STOPS.length).padStart(2,'0')}`);
    const level = roomById[byId[id].room].level;
    if (!visitedLevels.has(level)) { await overview(id); visitedLevels.add(level); }
  }
  assert.deepEqual([...visitedLevels].sort(), ['basement','first','loft','second']);
  assert.equal(await page.locator('#next-room').isDisabled(), true);
  await page.locator('#guided-tour').click(); await waitRoom(TOUR_STOPS[0]);
  await page.locator('#guided-tour').click();
  assert.equal(await page.locator('#guided-tour').getAttribute('aria-pressed'), 'false');
  await page.locator('#guided-tour').click(); await waitRoom(TOUR_STOPS[1]);
  await page.locator('#guided-tour').click();
  assert.equal(await page.locator('#guided-tour').getAttribute('aria-pressed'), 'false');
  console.log(`PASS: all ${TOUR_STOPS.length} guided stops, four floor plans, paint labels and automatic tour restart/advance/pause.`);

  await page.locator('#interior-panel-open').click();
  await page.getByRole('button', {name:'Loft',exact:true}).click();
  await page.locator('[data-node="loft"]').click(); await waitRoom('loft');
  assert.equal(await page.locator('#interior-transport').isVisible(), false);
  // Reset, then adjust a peninsula option: the new value must reach the saved design.
  await page.locator('#interior-panel-open').click();
  await page.getByRole('button', {name:'First floor',exact:true}).click();
  await page.locator('[data-node="kitchenWork"]').click(); await waitRoom('kitchenWork');
  await page.locator('#interior-panel-open').click();
  await page.locator('[data-tab="design"]').click();
  const peninsulaLength = page.locator('.design-choices').nth(1);
  await peninsulaLength.locator('[data-id="48"]').click();
  await page.locator('#design-reset').click();
  await peninsulaLength.locator('[data-id="42"]').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('budd-street-design')).kitchen.peninsula.length), 42, 'Peninsula remains editable after a design reset');
  await page.locator('#design-reset').click();
  await page.locator('#interior-panel-close').click();
  await page.locator('#exit-interior').click(); await waitOutside();

  await page.setViewportSize({width:390,height:844});
  await page.locator('#cinema-open').click();
  await noOverflow(['#cinema-exit','#cinema-play','#cinema-seek','#cinema-chapter','#cinema-next']);
  await page.locator('#cinema-chapter').selectOption(String(chapterOptions.length-1));
  await snapshot('phone-cinema');
  await page.locator('#cinema-seek').press('End');
  assert.equal(Number(await page.locator('#cinema-seek').inputValue()), FILM_DURATION);
  const focusable = '#cinema-controls :is(a[href],button,input,select):not([disabled])';
  await page.locator(focusable).last().focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.querySelector('#cinema-controls').contains(document.activeElement)), true);
  await page.keyboard.press('Escape'); assert.ok(await page.locator('#cinema-open').isVisible());
  await page.locator('#enter').click(); await waitRoom('hall');
  await noOverflow(['#next-room','#guided-tour','#interior-panel-open']);
  await snapshot('phone-explore');
  await page.locator('#exit-interior').click(); await waitOutside();
  await settings(async () => { await page.locator('#reduce-motion').uncheck(); });
  await page.locator('#cinema-open').click();
  await page.waitForFunction(() => Number(document.querySelector('#cinema-seek').value) > .25);
  assert.equal(await page.locator('#cinema-play').textContent(), 'Pause');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, [], 'No browser errors or failed local asset requests');
  console.log('PASS: direct floor navigation, design reset/edit, phone layout, focus containment, Escape and automatic playback; no browser errors.');
} catch (error) {
  console.error('Last walkthrough state:', await page.evaluate(() => window.__walkthroughQA).catch(() => null));
  if (screenshotDir) await snapshot('failure').catch(() => {});
  throw error;
} finally { await browser.close(); }
