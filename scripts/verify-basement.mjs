import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {NODES, ROOMS, LEVELS} from '../plan.js';
import {BASEMENT_PLAN as P} from '../basement-plan.js';

// Use a new, disposable browser profile; existing tabs and saved visitor choices stay untouched.
const baseURL = new URL(process.env.BASE_URL || 'http://127.0.0.1:4173/');
baseURL.searchParams.set('debug', '1');
baseURL.searchParams.delete('basement');
const proposalURL = new URL(baseURL); proposalURL.searchParams.set('basement', 'proposed');
const screenshotDir = resolve(process.env.QA_SCREENSHOTS || '../basement-qa');
await mkdir(screenshotDir, {recursive:true});
const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--use-gl=angle', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []), '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({viewport:{width:1280, height:800}});
const page = await context.newPage(), errors = [];
page.setDefaultTimeout(45000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => {
  if (response.status() >= 400 && new URL(response.url()).origin === baseURL.origin) errors.push(`${response.status()} ${response.url()}`);
});
await page.addInitScript(() => {
  window.__basementQA = null;
  window.addEventListener('walkthroughchange', event => { window.__basementQA = event.detail; });
});
const nodeById = Object.fromEntries(NODES.map(node => [node.id, node]));
const roomById = Object.fromEntries(ROOMS.map(room => [room.id, room]));
const proposedGroups = ['Basement bathroom', 'Basement utility enclosure', 'Basement shower', 'Basement vanity'];
const allGroups = [...proposedGroups, 'Basement boiler', 'Basement water equipment'];
const savedLayout = () => page.evaluate(() => JSON.parse(localStorage.getItem('budd-street-design'))?.rooms?.basement?.layout || 'unfinished');
const frames = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function snapshot(name) { await frames(); await page.screenshot({path:resolve(screenshotDir, `${name}.png`)}); }
async function ready() {
  await page.locator('#loading').waitFor({state:'hidden'});
  await page.waitForFunction(() => Boolean(window.budd?.scene && window.budd?.interior));
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.ok(await page.locator('#scene canvas').isVisible());
}
async function waitRoom(id) {
  await page.waitForFunction(expected => {
    const state = window.budd?.interior.navigation || window.__basementQA;
    return state?.state === 'inside' && state.current === expected && !state.busy && !state.overview;
  }, id);
  const node = nodeById[id];
  assert.equal(await page.locator('#viewname').textContent(), node.name || roomById[node.room].name);
  assert.ok((await page.locator('#chapter-label').textContent()).includes(LEVELS[roomById[node.room].level].name.toUpperCase()));
  const position = await page.evaluate(() => window.budd.camera.position.toArray());
  assert.ok(position.every(Number.isFinite), 'The settled camera has a finite position');
}
async function waitOutside() {
  await page.waitForFunction(() => window.budd?.interior.navigation.state === 'outside');
  assert.ok(await page.locator('#enter').isVisible());
}
async function openPanel(tab = 'design') {
  if (!await page.locator('#interior-transport').isVisible()) await page.locator('#interior-panel-open').click();
  await page.locator(`[data-tab="${tab}"]`).click();
}
async function closePanel() {
  if (await page.locator('#interior-transport').isVisible()) await page.locator('#interior-panel-close').click();
}
async function visit(id) {
  await openPanel('rooms');
  const level = roomById[nodeById[id].room].level;
  await page.locator('.floor-selector').getByRole('button', {name:LEVELS[level].name, exact:true}).click();
  await page.locator(`[data-node="${id}"]`).click();
  await waitRoom(id);
}
async function geometry() {
  return page.evaluate(async names => {
    const {Box3} = await import('./three.module.js');
    window.budd.scene.updateMatrixWorld(true);
    return Object.fromEntries(names.map(name => {
      const group = window.budd.scene.getObjectByName(name);
      const bounds = new Box3();
      let meshes = 0, triangles = 0;
      group?.traverse(object => {
        if (!object.isMesh) return;
        for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
        meshes++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
        bounds.union(new Box3().setFromObject(object, true));
      });
      return [name, {uuid:group?.uuid || null, meshes, triangles, bounds:bounds.isEmpty() ? null : {min:bounds.min.toArray(), max:bounds.max.toArray()}}];
    }));
  }, allGroups);
}
function assertEquipmentArrangement(existing, current, proposed = true) {
  const retained = proposed ? ['Basement boiler'] : ['Basement boiler', 'Basement water equipment'];
  for (const name of retained) {
    const before = existing[name].bounds, after = current[name].bounds;
    assert.ok(before && after, `${name} has measurable world geometry in both layouts`);
    for (const edge of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(before[edge][axis] - after[edge][axis]) < 1e-5, `${name} retains its position`);
    }
  }
  const water = current['Basement water equipment'].bounds;
  if (!proposed) {
    assert.ok(water.max[0] < 0 && water.max[2] < 0, 'Existing layout restores the water equipment at the rear-left wall');
    return;
  }
  const boiler = current['Basement boiler'].bounds;
  const [x0,z0,x1,z1] = P.utility.rect;
  assert.ok(water.min[0] > x0 && water.max[0] < x1 && water.min[2] > z0 && water.max[2] < z1, 'All relocated equipment fits within the clear utility walls');
  assert.ok(water.min[1] >= P.floor - .001 && water.max[1] < P.ceiling, 'Equipment fits below the utility ceiling');
  assert.ok(water.min[0] > boiler.max[0] + .2, 'Relocated water equipment clears the central boiler');
  assert.ok(water.min[0] > P.service.rect[2] + .1, 'Relocated equipment preserves the front service reserve and entry route');
  assert.ok(Math.abs((water.min[0] + water.max[0]) / 2 - P.water.proposed[0]) < .01, 'Equipment is turned along the right utility wall');
}
async function assertProposalWindows() {
  const probes = await page.evaluate(async () => {
    const {Raycaster, Vector3} = await import('./three.module.js');
    const proposal = window.budd.scene.getObjectByName('Basement proposal');
    if (!proposal) throw new Error('The proposed geometry is missing');
    window.budd.scene.updateMatrixWorld(true);
    const meshes = [];
    proposal.traverse(object => {
      if (!object.isMesh) return;
      for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
      meshes.push(object);
    });
    return [
      {name:'Right cellar window', from:[5,.45,-2.28], direction:[-1,0,0]},
      {name:'Rear cellar window above the shower', from:[2.94,.45,-5], direction:[0,0,1]},
    ].map(probe => {
      const ray = new Raycaster(new Vector3(...probe.from), new Vector3(...probe.direction), 0, 10);
      const hit = ray.intersectObjects(meshes, false)[0];
      return {name:probe.name, distance:hit?.distance ?? null, hit:hit?.object.name || hit?.object.parent?.name || null};
    });
  });
  for (const probe of probes) assert.ok(probe.distance === null || probe.distance > 1.2, `${probe.name} is not blocked by proposal walls or shower tile: ${JSON.stringify(probe)}`);
  return probes;
}
async function assertProposal(present) {
  const groups = await geometry();
  for (const name of proposedGroups) assert.equal(groups[name].meshes > 0, present, `${name} ${present ? 'is rendered' : 'is absent from the existing layout'}`);
  if (present) {
    for (const name of allGroups) assert.ok(groups[name].triangles > 0, `${name} contains visible geometry`);
    for (const name of ['Basement bathroom', 'Basement shower']) {
      const bounds = groups[name].bounds;
      assert.ok(bounds.min[0] > 0 && bounds.max[2] < 0, `${name} is actual rear-right world geometry: ${JSON.stringify(bounds)}`);
    }
    const enclosure = groups['Basement utility enclosure'].bounds, boiler = groups['Basement boiler'].bounds;
    assert.ok(boiler.min[0] < 0 && boiler.max[0] > 0 && boiler.min[2] < 0 && boiler.max[2] > 0, 'The boiler remains at the center of the basement');
    for (const axis of [0, 2]) assert.ok(enclosure.min[axis] <= boiler.min[axis] && enclosure.max[axis] >= boiler.max[axis], 'The actual utility enclosure surrounds the retained central boiler');
  }
  return groups;
}
async function chooseProposal(proposed) {
  await openPanel();
  await page.locator(proposed ? '#basement-proposed' : '#basement-existing').click();
  await page.waitForFunction(() => !window.budd.interior.navigation.busy);
  const value = proposed ? 'bathroom' : 'unfinished';
  assert.equal(await savedLayout(), value);
  assert.equal(await page.locator('#layout-select').inputValue(), value);
  assert.equal(await page.locator('#basement-proposed').getAttribute('aria-pressed'), String(proposed));
  assert.equal(await page.locator('#basement-existing').getAttribute('aria-pressed'), String(!proposed));
  assert.equal(await page.locator('#basement-proposal-details').isVisible(), proposed);
  return assertProposal(proposed);
}
async function inspect(view, id) {
  await openPanel(); await page.locator(`#basement-view-${view}`).click();
  await waitRoom(id); await closePanel(); await snapshot(`desktop-${view}`);
  // Use the room picker for the return: the "back" arrow can be behind the camera.
  await visit('basement');
}
async function noOverflow(selectors) {
  const viewport = page.viewportSize();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, 'No horizontal page overflow');
  for (const selector of selectors) {
    const control = page.locator(selector); await control.scrollIntoViewIfNeeded();
    const b = await control.boundingBox();
    assert.ok(b && b.x >= -1 && b.y >= -1 && b.x+b.width <= viewport.width+1 && b.y+b.height <= viewport.height+1, `${selector} fits the viewport`);
    assert.ok(b.height >= 43, `${selector} has a touch-sized target`);
  }
}

try {
  await page.goto(baseURL.href); await ready(); await waitOutside();
  assert.equal(await savedLayout(), 'unfinished', 'A new visitor keeps the existing basement');
  await assertProposal(false);
  await page.locator('#render-settings summary').click();
  await page.locator('#render-quality').selectOption('balanced');
  await page.locator('#reduce-motion').check();
  await page.locator('#render-settings summary').click();
  await page.locator('#enter').click(); await waitRoom('hall');
  await page.locator('#exit-interior').click(); await waitOutside();

  const initialDesign = await page.evaluate(() => localStorage.getItem('budd-street-design'));
  for (const legacy of ['family', 'office']) {
    await page.evaluate(layout => {
      const saved = JSON.parse(localStorage.getItem('budd-street-design')) || {};
      saved.version = 5; saved.flooring = 'walnut';
      saved.basement = {...saved.basement, floor:'epoxy'};
      saved.rooms = {...saved.rooms, basement:{wall:'seapearl', layout}};
      localStorage.setItem('budd-street-design', JSON.stringify(saved));
    }, legacy);
    await page.reload(); await ready(); await waitOutside();
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('budd-street-design')));
    assert.equal(migrated.version, 6);
    assert.equal(migrated.rooms.basement.layout, 'unfinished', `The retired ${legacy} preset migrates to Existing`);
    assert.equal(migrated.rooms.basement.wall, 'seapearl', 'Migration preserves the wall selection');
    assert.equal(migrated.basement.floor, 'epoxy', 'Migration preserves the basement floor');
    assert.equal(migrated.flooring, 'walnut', 'Migration preserves the house flooring');
    await assertProposal(false);
  }
  await page.evaluate(saved => {
    if (saved === null) localStorage.removeItem('budd-street-design');
    else localStorage.setItem('budd-street-design', saved);
  }, initialDesign);
  await page.reload(); await ready(); await waitOutside();
  console.log('PASS: retired family/office presets migrate to Existing while preserving paint and floor selections.');
  const existingGeometry = await geometry();

  await page.locator('#config-open').click();
  await page.locator('#basement-design-open').click(); await waitRoom('basement');
  await page.locator('#design-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#basement-proposed').getAttribute('aria-pressed'), 'true');
  assert.equal(await savedLayout(), 'bathroom');
  const firstBuild = await assertProposal(true);
  assertEquipmentArrangement(existingGeometry, firstBuild);
  const windowProbes = await assertProposalWindows();
  console.log('PASS: actual rear-right bathroom/shower bounds, relocated water equipment and unchanged boiler, central service enclosure and open cellar windows.', JSON.stringify(windowProbes));
  const options = await page.locator('#layout-select option').evaluateAll(nodes => nodes.map(node => node.value));
  assert.deepEqual([...options].sort(), ['bathroom', 'unfinished'], 'Only Existing and Proposed are offered');
  assert.match(await page.locator('#basement-proposal').textContent(), /7′6″ × 9′/);
  assert.match(await page.locator('.basement-water-note').textContent(), /water tank and equipment move inside the central boiler room/i);
  await snapshot('desktop-proposal-controls');
  const existingRebuild = await chooseProposal(false);
  assertEquipmentArrangement(existingGeometry, existingRebuild, false); await snapshot('desktop-existing');
  const secondBuild = await chooseProposal(true);
  assertEquipmentArrangement(existingGeometry, secondBuild);
  assert.notEqual(secondBuild['Basement bathroom'].uuid, firstBuild['Basement bathroom'].uuid, 'Selecting Proposed rebuilds the bathroom');
  await page.locator('#layout-select').selectOption('unfinished');
  assert.equal(await page.locator('#basement-proposal-details').isVisible(), false);
  await assertProposal(false); await chooseProposal(true);
  await closePanel(); await snapshot('desktop-proposed');
  console.log('PASS: normal exterior entry, unfinished default, direct basement entry, Existing/Proposed geometry, shared layout control and saved selections.');

  await inspect('bathroom', 'basementBathroom');
  await inspect('utility', 'basementUtility');
  await openPanel(); await page.locator('#basement-view-plan').click();
  await page.waitForFunction(() => window.budd.interior.navigation.overview === true);
  await closePanel();
  assert.match(await page.locator('#viewname').textContent(), /overview/i);
  await snapshot('desktop-floor-plan');
  await page.locator('#overview-toggle').click(); await waitRoom('basement');
  await visit('basementRear'); await snapshot('desktop-rear-service-area');
  await visit('basement'); await visit('landing'); await visit('kitchenEntry'); await visit('basement');
  console.log('PASS: bathroom/utility views and returns, floor-plan overview, rear route and staircase route in both directions.');

  await page.reload(); await ready(); await waitOutside();
  assert.equal(await savedLayout(), 'bathroom', 'The proposal persists after a normal reload');
  await assertProposal(true);
  await page.locator('#enter').click(); await waitRoom('hall');
  await visit('basement'); await openPanel();
  assert.equal(await page.locator('#basement-proposed').getAttribute('aria-pressed'), 'true');
  await chooseProposal(false);
  await page.reload(); await ready(); await waitOutside();
  assert.equal(await savedLayout(), 'unfinished', 'Existing also persists'); await assertProposal(false);
  await page.goto(proposalURL.href); await ready(); await waitRoom('basement');
  await page.locator('#design-panel').waitFor({state:'visible'});
  assert.equal(await savedLayout(), 'bathroom', 'The explicit deep link opens the proposal');
  assert.equal(await page.locator('#basement-proposed').getAttribute('aria-pressed'), 'true');
  await assertProposal(true);
  console.log('PASS: proposal/existing persistence and the explicit proposal deep link.');

  const planURL = new URL(await page.locator('.basement-plan-link').getAttribute('href'), page.url());
  await Promise.all([page.waitForURL(url => url.pathname === planURL.pathname), page.locator('.basement-plan-link').click()]);
  assert.ok(await page.getByRole('heading', {level:1}).isVisible(), 'The dimensioned plan loads');
  const planText = await page.locator('body').textContent();
  assert.match(planText, /basement/i); assert.match(planText, /shower/i);
  assert.ok(await page.locator('svg').count() > 0, 'The plan includes its diagram');
  await snapshot('dimensioned-plan');
  await page.goto(proposalURL.href); await ready(); await waitRoom('basement');

  await page.setViewportSize({width:390, height:844});
  await openPanel();
  await noOverflow(['#basement-existing', '#basement-proposed', '#basement-view-bathroom', '#basement-view-utility', '#basement-view-plan', '.basement-plan-link']);
  await page.locator('#basement-proposed').scrollIntoViewIfNeeded(); await snapshot('phone-proposal-controls');
  await page.locator('#basement-view-bathroom').click(); await waitRoom('basementBathroom');
  await closePanel(); await snapshot('phone-bathroom');
  await visit('basement'); await openPanel();
  await page.locator('#basement-view-utility').click(); await waitRoom('basementUtility');
  await closePanel(); await snapshot('phone-utility'); await visit('basement');
  await chooseProposal(false); await closePanel();
  await page.locator('#exit-interior').click(); await waitOutside();
  await page.locator('#enter').click(); await waitRoom('hall');
  await page.locator('#exit-interior').click(); await waitOutside();
  assert.deepEqual(errors, [], 'No browser errors or failed local requests');
  console.log(`PASS: dimensioned plan, phone controls and routes, unchanged normal entry. Screenshots: ${screenshotDir}`);
} catch (error) {
  console.error('Last URL:', page.url());
  console.error('Last basement state:', await page.evaluate(() => window.budd?.interior.navigation || window.__basementQA).catch(() => null));
  console.error('Saved layout:', await savedLayout().catch(() => null));
  if (errors.length) console.error('Browser errors:', errors);
  await snapshot('failure').catch(() => {});
  throw error;
} finally { await browser.close(); }
