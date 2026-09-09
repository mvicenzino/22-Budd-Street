import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const output=resolve(args.output||'rendered'), width=Number(args.width||1920),height=Number(args.height||1080),fps=24;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
const failures=[];page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
try{
  await page.goto((args.url||'http://127.0.0.1:4173/')+'?render=1',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!!window.buddRender,{timeout:60000});
  await page.evaluate(({width,height})=>window.buddRender.configure(width,height),{width,height});
  console.log(JSON.stringify(await page.evaluate(()=>window.buddRender.info())));
  const write=async(name,data)=>writeFile(resolve(output,name),Buffer.from(data,'base64'));
  if(args.mode==='stills'){
    for(const [name,time]of[['entry',3.5],['living',8],['dining',12],['kitchen',19]]){
      await write(name+'.png',await page.evaluate(t=>window.buddRender.raster(t),time));console.log('Saved '+name);
    }
  }else if(args.mode==='trace'){
    const time=Number(args.time||8),samples=Number(args.samples||128);
    await write('raster.png',await page.evaluate(t=>window.buddRender.raster(t),time));
    await page.evaluate(t=>window.buddRender.traceStart(t),time);
    let status={samples:0};const deadline=Date.now()+15*60*1000;
    while(status.samples<samples){
      if(Date.now()>deadline)throw new Error('Path-traced sample exceeded 15 minutes');
      status=await page.evaluate(()=>window.buddRender.traceSamples(4));
      if(status.samples%32===0)console.log(JSON.stringify(status));
      if(status.compiling)await new Promise(r=>setTimeout(r,100));
    }
    await write('path-traced.png',await page.evaluate(()=>window.buddRender.traceImage()));
  }else{
    const dir=resolve(output,'frames');await mkdir(dir,{recursive:true});
    for(let i=0;i<fps*20;i++){
      const data=await page.evaluate(t=>window.buddRender.raster(t,true),i/fps);
      await writeFile(resolve(dir,String(i).padStart(5,'0')+'.png'),Buffer.from(data,'base64'));
      if(i%24===0)console.log(`Rendered ${i/fps}s / 20s`);
    }
    const result=spawnSync('ffmpeg',['-y','-framerate',String(fps),'-i',resolve(dir,'%05d.png'),'-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'budd-street-cinematic.mp4')],{stdio:'inherit'});
    if(result.status!==0)throw new Error('Video encoding failed');
  }
  if(failures.length)throw new Error(failures.join('\n'));
  console.log('Export completed without browser errors.');
}finally{await browser.close();}
