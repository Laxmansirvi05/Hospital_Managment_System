// Collects doctor details from hospital websites into .cache/doctors-{source}.json (D-52, D-56).
// Every source module in scripts/sources/ follows P-29; scripts/lib/web.js enforces robots.txt
// and spacing. Resumable: records already cached are skipped.
// Run: node scripts/collect-doctors.js [source ...]   (no names = every source)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { get, today } from './lib/web.js';
import * as care from './sources/care.js';
import * as kims from './sources/kims.js';
import * as rainbow from './sources/rainbow.js';
import * as continental from './sources/continental.js';
import * as gleneagles from './sources/gleneagles.js';
import * as ankura from './sources/ankura.js';
import * as citizens from './sources/citizens.js';
import * as lvpei from './sources/lvpei.js';

export const SOURCES = [care, kims, rainbow, continental, gleneagles, ankura, citizens, lvpei];

async function collect(src) {
  const file = `.cache/doctors-${src.id}.json`;
  let cache = { source: src.sourcePlatform, records: {}, failed: {} };
  try { cache = JSON.parse(await readFile(file, 'utf8')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const save = () => writeFile(file, JSON.stringify(cache));
  const log = (m) => console.log(`[${src.id}] ${m}`);
  const checkedAt = today();
  if (src.collectAll) {
    await src.collectAll({ cache, save, log, checkedAt });
  } else {
    const done = new Set(Object.values(cache.records).map((r) => r.profileUrl));
    const todo = (await src.urls()).filter((u) => !done.has(u) && !cache.failed[u]);
    log(`${todo.length} pages to fetch`);
    for (const [n, url] of todo.entries()) {
      try {
        const r = src.toRecord(await get(url), url, checkedAt);
        if (r) cache.records[r.sourceRef] = r; else cache.failed[url] = 'no doctor details on the page';
      } catch (err) {
        cache.failed[url] = err.message;
      }
      if (n % 10 === 9) { await save(); log(`${n + 1} of ${todo.length}`); }
    }
    await save();
  }
  log(`done: ${Object.keys(cache.records).length} doctors, ${Object.keys(cache.failed).length} pages without details`);
}

async function main() {
  await mkdir('.cache', { recursive: true });
  const wanted = process.argv.slice(2);
  const chosen = wanted.length ? SOURCES.filter((s) => wanted.includes(s.id)) : SOURCES;
  // Different hosts run side by side; each host still gets one request at a time.
  await Promise.all(chosen.map((s) => collect(s).catch((err) => console.log(`[${s.id}] stopped: ${err.message}`))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
export { get };
