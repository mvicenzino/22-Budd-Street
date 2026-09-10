import {chromium} from 'playwright';
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const match=/^--([a-z-]+)=(.+)$/.exec(arg);
  if(!match)throw new Error(`Expected --option=value, received ${arg}`);
  return [match[1],match[2]];
}));
const options=new Set(['mode','output','width','height','fps','samples','encoder','url','time','start','end']);
for(const name of Object.keys(args))if(!options.has(name))throw new Error(`Unknown export option --${name}`);
const mode=args.mode||'film';
if(!['film','stills','trace'].includes(mode))throw new Error('--mode must be film, stills, or trace');
function number(name,fallback,min,max,integer=false){
  const value=Number(args[name]??fallback);
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`--${name} must be ${integer?'an integer':'a number'} from ${min} to ${max}`);
  return value;
}
const output=resolve(args.output||'rendered');
const width=number('width',1920,64,7680,true),height=number('height',1080,64,4320,true),fps=number('fps',24,1,60);
if(mode==='film'&&(width%2||height%2))throw new Error('MP4 width and height must both be even');
const samples=number('samples',128,1,16384,true);
const encoder=args.encoder||'libx264';
if(!['libx264','h264_videotoolbox'].includes(encoder))throw new Error('--encoder must be libx264 or h264_videotoolbox');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:true,
  args:['--use-gl=angle',...(process.platform==='darwin'?['--use-angle=metal']:[]),'--ignore-gpu-blocklist','--disable-background-timer-throttling'],
});
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
page.on('console',message=>{if(message.type()==='error')failures.push(message.text());});
const checkBrowser=()=>{if(failures.length)throw new Error(failures.join('\n'));};
const write=(name,data)=>writeFile(resolve(output,name),Buffer.from(data,'base64'));
const slug=value=>String(value??'room').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let encoding=null,encoded=null,partial=null;
try{
  const url=new URL(args.url||'http://127.0.0.1:4173/');url.searchParams.set('render','1');
  await page.goto(url.href,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!!window.buddRender,{timeout:60000});
  await page.evaluate(async({width,height})=>{await document.fonts.ready;window.buddRender.configure(width,height);},{width,height});
  const info=await page.evaluate(()=>window.buddRender.info());
  const duration=Number(info.duration);
  if(!Number.isFinite(duration)||duration<=0)throw new Error('The scene did not expose a valid cinematic duration');
  console.log(JSON.stringify(info));
  const manifest={mode,width,height,fps,duration,chapters:info.chapters,gpu:info.gpu};

  if(mode==='stills'){
    if(!Array.isArray(info.chapters)||!info.chapters.length)throw new Error('The scene did not expose cinematic chapters');
    const frames=[];
    for(const [index,chapter]of info.chapters.entries()){
      const next=info.chapters[index+1]?.time??duration;
      const time=chapter.sampleTime??Math.min(duration-.05,chapter.time+(next-chapter.time)*.55);
      const name=`${String(chapter.number).padStart(2,'0')}-${slug(chapter.title)}`;
      const data=await page.evaluate(time=>window.buddRender.raster(time),time);
      checkBrowser();await write(name+'.png',data);
      frames.push({name,time,title:chapter.title,subtitle:chapter.subtitle,floor:chapter.floor,data});
      console.log(`Saved ${name} at ${time.toFixed(2)}s`);
    }
    const sheet=await page.evaluate(async frames=>{
      const cols=3,cellWidth=480,cellHeight=322,pad=16;
      const canvas=document.createElement('canvas');canvas.width=cols*cellWidth;canvas.height=Math.ceil(frames.length/cols)*cellHeight;
      const ink=canvas.getContext('2d');ink.fillStyle='#f4f0e6';ink.fillRect(0,0,canvas.width,canvas.height);
      for(const [index,frame]of frames.entries()){
        const picture=new Image();picture.src='data:image/png;base64,'+frame.data;await picture.decode();
        const x=index%cols*cellWidth,y=Math.floor(index/cols)*cellHeight;
        const imageWidth=cellWidth-pad*2,imageHeight=244,scale=Math.min(imageWidth/picture.width,imageHeight/picture.height);
        ink.drawImage(picture,x+pad+(imageWidth-picture.width*scale)/2,y+pad+(imageHeight-picture.height*scale)/2,picture.width*scale,picture.height*scale);
        ink.fillStyle='#1e3527';ink.font='20px Georgia';ink.fillText(frame.title,x+pad,y+282,cellWidth-pad*2);
        ink.font='13px Arial';ink.fillStyle='#5c655c';ink.fillText(`${frame.time.toFixed(1)}s · ${frame.subtitle}`,x+pad,y+305,cellWidth-pad*2);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },frames);
    await write('contact-sheet.png',sheet);
    manifest.stills=frames.map(({data,...frame})=>frame);
  }else if(mode==='trace'){
    const time=number('time',8,0,duration);
    manifest.time=time;manifest.samples=samples;
    await write('raster.png',await page.evaluate(time=>window.buddRender.raster(time),time));
    await page.evaluate(time=>window.buddRender.traceStart(time),time);
    let status={samples:0},lastReported=-1;const deadline=Date.now()+15*60*1000;
    while(status.samples<samples){
      if(Date.now()>deadline)throw new Error('Path-traced sample exceeded 15 minutes');
      status=await page.evaluate(count=>window.buddRender.traceSamples(count),Math.min(4,samples-status.samples));
      checkBrowser();
      if(Math.floor(status.samples/32)>lastReported){console.log(JSON.stringify(status));lastReported=Math.floor(status.samples/32);}
      if(status.compiling)await new Promise(resolve=>setTimeout(resolve,100));
    }
    await write('path-traced.png',await page.evaluate(()=>window.buddRender.traceImage()));
    await page.evaluate(()=>window.buddRender.traceDispose());
  }else{
    const start=number('start',0,0,duration),end=number('end',duration,0,duration);
    if(end<=start)throw new Error('--end must be later than --start');
    const frames=Math.round((end-start)*fps);
    if(frames<1)throw new Error('The selected time range is shorter than one frame');
    manifest.start=start;manifest.end=end;manifest.frames=frames;manifest.encoder=encoder;
    partial=resolve(output,`.budd-street-cinematic-${process.pid}.partial.mp4`);
    const codec=encoder==='h264_videotoolbox'?['-c:v',encoder,'-b:v','20M']:['-c:v','libx264','-preset','slow','-crf','18'];
    const ffmpegArgs=['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-an',...codec,'-pix_fmt','yuv420p','-movflags','+faststart',partial];
    encoding=spawn(process.env.FFMPEG_PATH||'ffmpeg',ffmpegArgs,{stdio:['pipe','ignore','pipe']});
    let encoderLog='';encoding.stderr.on('data',chunk=>{encoderLog=(encoderLog+chunk.toString()).slice(-12000);});
    // Keep rejections attached immediately: ffmpeg can fail while the browser renders a frame.
    encoded=new Promise(resolve=>{
      encoding.once('error',error=>resolve({error}));
      encoding.once('close',code=>resolve({code}));
    });
    let pipeError=null;encoding.stdin.on('error',error=>{pipeError=error;});
    const began=Date.now();let lastSecond=-1;
    for(let index=0;index<frames;index++){
      const time=start+index/fps;
      const data=await page.evaluate(time=>window.buddRender.raster(time,true),time);
      checkBrowser();
      if(pipeError||encoding.exitCode!==null)throw new Error(`Video encoder stopped: ${encoderLog||pipeError?.message||encoding.exitCode}`);
      await new Promise((resolve,reject)=>encoding.stdin.write(Buffer.from(data,'base64'),error=>error?reject(error):resolve()));
      const second=Math.floor(time-start);
      if(second>lastSecond){
        const elapsed=(Date.now()-began)/1000,remaining=elapsed*(frames-index-1)/(index+1);
        console.log(`Rendered ${(time-start).toFixed(1)}s / ${(end-start).toFixed(1)}s; approximately ${Math.ceil(remaining/60)}m remaining`);
        lastSecond=second;
      }
    }
    encoding.stdin.end();
    const result=await encoded;encoding=null;
    if(result.error||result.code!==0)throw new Error(`Video encoding failed: ${result.error?.message||encoderLog||result.code}`);
    checkBrowser();
    await rename(partial,resolve(output,'budd-street-cinematic.mp4'));partial=null;
    manifest.renderSeconds=Number(((Date.now()-began)/1000).toFixed(1));
  }
  checkBrowser();
  await writeFile(resolve(output,'render-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Export completed without browser errors.');
}finally{
  if(encoding){encoding.stdin.destroy();encoding.kill('SIGTERM');await encoded;}
  if(partial)await rm(partial,{force:true});
  await browser.close();
}
