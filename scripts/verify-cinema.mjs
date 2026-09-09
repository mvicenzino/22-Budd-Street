import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/');await page.locator('#loading').waitFor({state:'hidden'});
 await page.locator('#render-settings summary').click();await page.locator('#reduce-motion').check();await page.locator('#render-settings summary').click();
 await page.locator('#cinema-open').click();assert.equal(await page.locator('#cinema-play').textContent(),'Play');
 await page.locator('#cinema-seek').press('End');assert.equal(await page.locator('#cinema-title').textContent(),'The heart of the house');
 await page.locator('#cinema-play').click();await page.waitForTimeout(350);await page.locator('#cinema-play').click();
 assert.ok(Number(await page.locator('#cinema-seek').inputValue())<2,'Play at the end restarts the film');
 await page.locator('#cinema-seek').press('End');await page.locator('#cinema-restart').click();assert.equal(await page.locator('#cinema-seek').inputValue(),'0');
 await page.locator('#cinema-exit').click();assert.ok(await page.locator('#enter').isVisible());
 await page.locator('#enter').click();await page.waitForFunction(()=>document.getElementById('viewname').textContent==='Hallway');
 await page.locator('#next-room').click();await page.waitForFunction(()=>document.getElementById('viewname').textContent==='Living room');
 await page.locator('#overview-toggle').click();await page.waitForFunction(()=>document.getElementById('viewname').textContent.includes('overview'));
 await page.locator('#overview-toggle').click();await page.waitForFunction(()=>document.getElementById('viewname').textContent==='Living room');
 await page.locator('#exit-interior').click();await page.waitForFunction(()=>document.body.dataset.mode==='');
 await page.setViewportSize({width:390,height:844});await page.locator('#cinema-open').click();await page.locator('#cinema-seek').press('End');
 const bounds=await page.locator('#cinema-exit').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.keyboard.press('Escape');assert.ok(await page.locator('#cinema-open').isVisible());
 await page.locator('#render-settings summary').click();await page.locator('#reduce-motion').uncheck();
 assert.deepEqual(errors,[]);console.log('PASS: playback, seeking, replay, reduced motion, exit, room navigation, overview, keyboard exit and mobile controls.');
}finally{await browser.close();}
