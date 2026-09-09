import {build} from 'esbuild';
await build({stdin:{contents:"export {WebGLPathTracer} from 'three-gpu-pathtracer';",resolveDir:process.cwd()},bundle:true,format:'esm',minify:true,plugins:[{name:'shared-three',setup(b){b.onResolve({filter:/^three$/},()=>({path:'three',external:true}));}}],outfile:'render/pathtracer.js',legalComments:'eof'});
// Shader template strings retain source indentation after minification.
const {readFile,writeFile}=await import('node:fs/promises');
const output='render/pathtracer.js';
await writeFile(output,(await readFile(output,'utf8')).replace(/^[\t ]+/gm,''));
