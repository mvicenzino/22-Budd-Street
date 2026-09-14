import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const target = new URL(process.env.BASE_URL || 'http://127.0.0.1:4173/');
target.searchParams.set('debug', '1');
const output = resolve(process.env.QA_SCREENSHOTS || '../porch-qa');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport:{width:1280, height:720}}), errors=[];
page.setDefaultTimeout(45000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
page.on('response', response => {
  if(response.status()>=400 && new URL(response.url()).origin===target.origin) errors.push(`${response.status()} ${response.url()}`);
});
const frames = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const screenshot = async name => { await frames(); await page.screenshot({path:resolve(output,`${name}.png`)}); };
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('budd-porch-extension-v1')));
async function ready() {
  await page.locator('#loading').waitFor({state:'hidden'});
  await page.waitForFunction(() => !!window.budd?.scene);
  assert.equal(await page.locator('#error').isVisible(),false);
}
async function configuration() {
  if(!await page.locator('#configuration-panel').isVisible()) await page.locator('#config-open').click();
  if(!await page.locator('#porch-extension-options').evaluate(element => element.open)) await page.locator('#porch-extension-options > summary').click();
}
async function showExtension() {
  await page.locator('#porch-extension-view').click();
  assert.equal(await page.locator('#configuration-panel').isVisible(),false,'View button closes the drawer');
  await frames();
}
async function sceneState() {
  await frames();
  return page.evaluate(() => {
    const scene=window.budd.scene;
    const visible=object => { if(!object)return false;for(let current=object;current;current=current.parent)if(!current.visible)return false;return true; };
    const extension=scene.getObjectByName('Wraparound porch'), roof=scene.getObjectByName('Wraparound porch roof'), bush=scene.getObjectByName('Right porch shrub');
    const leftRail=scene.getObjectByName('Original left porch rail'),plants={};
    scene.traverse(object=>{if(object.userData.porchPlant)plants[object.name]=visible(object);});
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    let meshes=0;
    extension?.traverse(object => {
      if(!object.isMesh || !object.geometry)return;
      meshes++;
      if(!visible(object))return;
      // Measure the deck/posts/guard footprint separately from the roof overhang.
      for(let ancestor=object;ancestor;ancestor=ancestor.parent)if(ancestor===roof)return;
      object.geometry.computeBoundingBox();
      const box=object.geometry.boundingBox;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
        const point=object.position.clone().set(x,y,z).applyMatrix4(object.matrixWorld).toArray();
        point.forEach((value,index)=>{bounds.min[index]=Math.min(bounds.min[index],value);bounds.max[index]=Math.max(bounds.max[index],value);});
      }
    });
    return {exists:!!extension,shown:visible(extension),roof:visible(roof),bush:visible(bush),downspout:visible(scene.getObjectByName('Driveway downspout')),leftRail:visible(leftRail),plants,meshes,bounds,futureYard:visible(scene.getObjectByName('Future backyard'))};
  });
}
async function assertVisibility(shown,roof) {
  const state=await sceneState();
  assert.ok(state.exists,'The optional porch retains its named group after static merging');
  assert.equal(state.shown,shown,'Extension visibility matches the selected view');
  assert.equal(state.bush,true,'The driveway-side shrub stays in place');
  assert.equal(state.downspout,true,'The driveway-side downspout remains visible');
  assert.equal(state.leftRail,!shown,'The original left-side rail opens the connection and returns in the original view');
  assert.equal(Object.keys(state.plants).length,6,'All six original shrubs remain independently identifiable');
  assert.equal(state.plants['Porch shrub 1'],!shown,'The left-front shrub is removed only with the extension');
  for(const name of ['Porch shrub 0','Porch shrub 3','Porch shrub 4']) assert.equal(state.plants[name],true,`${name} stays outside the porch footprint`);
  if(!shown) assert.ok(Object.values(state.plants).every(Boolean),'The original view restores every shrub');
  assert.equal(state.roof,shown&&roof,'Roof visibility follows its option and parent');
  if(shown) {
    assert.ok(state.meshes>0,'The extension contains rendered geometry');
    assert.ok(state.bounds.max[0]<0,'The entire added deck is on the left side, away from the driveway');
  }
  return state;
}
async function extent(selector,key) {
  await page.locator(selector).press(key);
  await frames();
}
try {
  await page.goto(target.href); await ready();
  await page.locator('#render-settings summary').click();
  await page.locator('#render-quality').selectOption('balanced');
  await page.locator('#reduce-motion').check();
  await page.locator('#render-settings summary').click();
  await configuration();
  assert.equal(await page.locator('#porch-extension-enabled').isChecked(),false);
  assert.equal(await page.locator('#porch-extension-width').isDisabled(),true);
  assert.equal(await page.locator('#porch-extension-roof').isChecked(),true);
  await assertVisibility(false,false);
  await page.locator('#config-close').click(); await screenshot('before');

  await configuration(); await page.locator('#porch-extension-enabled').check();
  assert.match(await page.locator('#porch-extension-options').textContent(),/left.side/i,'Configuration identifies the corrected side');
  assert.equal(await page.locator('#porch-extension-width').isEnabled(),true);
  assert.equal(await page.locator('#future').getAttribute('aria-pressed'),'true');
  assert.equal(Number(await page.locator('#porch-extension-width').inputValue()),5);
  assert.equal(Number(await page.locator('#porch-extension-length').inputValue()),8);
  const originalEnabled=await assertVisibility(true,true);
  await showExtension(); await screenshot('after');
  await page.locator('[data-view="front"]').click(); await screenshot('front');
  await page.locator('[data-view="left"]').click(); await screenshot('left');
  await page.locator('[data-view="right"]').click(); await screenshot('right');
  for(let index=0;index<3;index++) {
    await page.locator('#future').click(); await assertVisibility(false,false);
    assert.equal(await page.locator('#porch-extension-enabled').isChecked(),true,'Original view preserves the selected extension');
    await page.locator('#future').click();
    const state=await assertVisibility(true,true);
    assert.equal(state.meshes,originalEnabled.meshes,'Compare toggles do not accumulate duplicate porch geometry');
  }

  await configuration();
  await extent('#porch-extension-width','Home'); await extent('#porch-extension-length','Home');
  assert.equal(Number(await page.locator('#porch-extension-width').inputValue()),4);
  assert.equal(Number(await page.locator('#porch-extension-length').inputValue()),6);
  const small=await assertVisibility(true,true);
  assert.equal(small.plants['Porch shrub 5'],true,'The shortest return preserves the next side shrub');
  await extent('#porch-extension-width','End'); await extent('#porch-extension-length','End');
  assert.equal(Number(await page.locator('#porch-extension-width').inputValue()),6);
  assert.equal(Number(await page.locator('#porch-extension-length').inputValue()),9);
  const large=await assertVisibility(true,true);
  assert.ok(small.bounds.min[0]-large.bounds.min[0]>.55,'Width expands the actual footprint farther to the left');
  assert.ok(small.bounds.min[2]-large.bounds.min[2]>.85,'Length changes the actual side return');
  assert.equal(large.plants['Porch shrub 5'],false,'The longest return removes the side shrub where its footprint overlaps');
  await extent('#porch-extension-width','ArrowLeft'); await extent('#porch-extension-length','ArrowLeft');
  if(!await page.locator('#porch-options').evaluate(element=>element.open)) await page.locator('#porch-options > summary').click();
  await page.locator('[data-porch="floor"][data-finish="cedar"]').click();
  await page.locator('[data-porch="rails"][data-finish="charcoal"]').click();
  const finishes=await page.evaluate(()=>{
    const extension=window.budd.scene.getObjectByName('Wraparound porch');
    const names=['Porch decking','Porch posts and rails'];
    return names.map(name=>{
      const inside=new Map(),outside=new Map();
      window.budd.scene.traverse(object=>{
        if(!object.isMesh)return;
        let inExtension=false;
        for(let ancestor=object;ancestor;ancestor=ancestor.parent)if(ancestor===extension)inExtension=true;
        for(const material of Array.isArray(object.material)?object.material:[object.material]) {
          if(material?.name===name)(inExtension?inside:outside).set(material.uuid,material.color.getHexString());
        }
      });
      return {name,shared:[...inside.keys()].some(id=>outside.has(id)),colors:[...inside.values()]};
    });
  });
  assert.ok(finishes.every(finish=>finish.shared),'Original porch and addition share their finish materials');
  assert.ok(finishes[0].colors.every(color=>color==='aa7952'),'Deck finish updates on the addition');
  assert.ok(finishes[1].colors.every(color=>color==='393f43'),'Rail finish updates on the addition');
  await page.locator('#porch-extension-roof').uncheck();
  await assertVisibility(true,false);
  const summary=await page.locator('#porch-extension-summary').textContent();
  assert.match(summary,/5\.5/); assert.match(summary,/8\.5/);
  await showExtension(); await screenshot('roofless');

  const selection=await saved();
  assert.equal(selection.enabled,true); assert.equal(selection.width,5.5); assert.equal(selection.length,8.5); assert.equal(selection.roof,false);
  await page.reload(); await ready();
  assert.deepEqual(await saved(),selection,'Reload retains the chosen dimensions and roof');
  assert.equal(await page.locator('#porch-extension-enabled').isChecked(),true);
  assert.equal(await page.locator('#future').getAttribute('aria-pressed'),'true');
  await assertVisibility(true,false);
  await configuration(); await page.locator('#porch-extension-enabled').uncheck();
  const disabled=await assertVisibility(false,false);
  assert.equal(disabled.futureYard,true,'Disabling the addition preserves other planned exterior changes');
  assert.equal(await page.locator('#porch-extension-width').isDisabled(),true);
  await page.locator('#porch-extension-enabled').check(); await assertVisibility(true,false);
  assert.equal(Number(await page.locator('#porch-extension-width').inputValue()),5.5);
  assert.equal(Number(await page.locator('#porch-extension-length').inputValue()),8.5);

  await page.setViewportSize({width:390,height:844});
  await page.locator('#porch-extension-enabled').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'The phone layout has no horizontal overflow');
  for(const selector of ['#porch-extension-enabled','#porch-extension-width','#porch-extension-length','#porch-extension-view']) {
    const bounds=await page.locator(selector).boundingBox();
    assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=391,`${selector} fits the phone drawer`);
  }
  await screenshot('mobile-controls');
  await page.locator('#porch-extension-roof').check(); await showExtension();
  await assertVisibility(true,true); await screenshot('mobile');
  await configuration(); await page.locator('#future-compare').click();
  await assertVisibility(false,false);
  await page.locator('#future-compare').click(); await assertVisibility(true,true);
  await page.locator('#porch-extension-enabled').uncheck();
  await page.reload(); await ready();
  assert.equal(await page.locator('#porch-extension-enabled').isChecked(),false,'Explicitly disabling stays disabled after reload');
  await assertVisibility(false,false);
  assert.deepEqual(errors,[],'No browser errors or failed local assets');
  console.log('PASS: left-side porch geometry, clear driveway, original rail/plant restoration, footprint-based shrub removal, compare, dimensions, roof, finishes, persistence, and desktop/phone controls.');
} catch(error) {
  await screenshot('failure').catch(()=>{});
  console.error('Last porch scene state:',await sceneState().catch(()=>null));
  throw error;
} finally { await browser.close(); }
