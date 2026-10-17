// Local development server on port 4000, so the Postman collection's baseUrl works unchanged.
// Serves public/ the way Vercel does and sends /api/v1/* to the same handler Vercel runs.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createApp } from '../server/app.js';

const PORT = Number(process.env.PORT ?? 4000);
const ROOT = resolve('public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Apply the same headers as production so CSP problems show up locally.
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
const headerRules = vercel.headers.map((rule) => ({
  pattern: new RegExp(`^${rule.source.replace(/\(\.\*\)/g, '.*')}$`),
  headers: rule.headers,
}));

function headersFor(pathname) {
  const out = {};
  for (const rule of headerRules) {
    if (rule.pattern.test(pathname)) for (const { key, value } of rule.headers) out[key] = value;
  }
  return out;
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = normalize(join(ROOT, decoded));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  for (const option of [candidate, `${candidate}.html`, join(candidate, 'index.html')]) {
    try {
      if ((await stat(option)).isFile()) return option;
    } catch {
      // try the next option
    }
  }
  return null;
}

const app = createApp();

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/api/v1' || pathname.startsWith('/api/v1/')) return app(req, res);

  const file = await resolveFile(pathname);
  const headers = headersFor(pathname);
  if (!file) {
    res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(PORT, () => {
  process.stdout.write(`CareRoute dev server on http://localhost:${PORT}\n`);
});
