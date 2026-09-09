import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extname, resolve, sep} from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || pathname.split('/').some(p => p.startsWith('.'))) {
      response.writeHead(403).end(); return;
    }
    const body = await readFile(path);
    response.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    response.end(body);
  } catch { if (!response.headersSent) response.writeHead(404); response.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Budd Street preview: http://127.0.0.1:4173'));
