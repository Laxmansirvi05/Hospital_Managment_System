// Local development server on port 4000 (docs/00-decisions.md section 2): serves public/
// and the API from one origin, with the same headers vercel.json sets in production.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { getConfig } from '../server/config.js';
import { initStore } from '../server/db/index.js';
import { handle } from '../server/router.js';
import { log } from '../server/log.js';

const ROOT = resolve('public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
};

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let path;
  try {
    path = normalize(decodeURIComponent(url.pathname));
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    // Missing paths fall through to the 404 below.
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
    res.end(body);
  } catch {
    const body = await readFile(join(ROOT, '404.html')).catch(() => Buffer.from('Not found'));
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
    res.end(body);
  }
}

const config = getConfig();
await initStore();
for (const w of config.warnings) log.warn(w);

createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handle(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return undefined;
  }
  return serveStatic(req, res);
}).listen(config.port, '127.0.0.1', () => {
  log.info(`CareRoute running at http://127.0.0.1:${config.port}`, { store: config.store });
});
