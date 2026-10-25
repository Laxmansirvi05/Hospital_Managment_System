// Collects Vijaya Diagnostic Centre's Hyderabad centres and published test prices (D-56) into
// .cache/diagnostics-vijaya.json. Centre pages embed the centre list (address, PIN, coordinates,
// phones, services); test pages carry a schema.org Offer with the Hyderabad price. robots.txt
// is honoured and requests are spaced (scripts/lib/web.js). Google review text embedded in the
// pages is never kept (P-29). Resumable. Run: node scripts/collect-diagnostics.js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { get, locs, jsonLd, today } from './lib/web.js';

const SITE = 'https://www.vijayadiagnostic.com';
const FILE = '.cache/diagnostics-vijaya.json';

/** The page's React Server Components payload, decoded into one string. */
export function nextPayload(html) {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join('');
}

/** The "centresList" array inside the payload, or []. */
export function centresFrom(html) {
  const p = nextPayload(html);
  const i = p.indexOf('"centresList":[');
  if (i === -1) return [];
  let depth = 0;
  let j = i + '"centresList":'.length;
  const start = j;
  for (; j < p.length; j++) {
    if (p[j] === '[') depth++;
    else if (p[j] === ']' && --depth === 0) break;
  }
  try { return JSON.parse(p.slice(start, j + 1)); } catch { return []; }
}

export function toCentre(c, url, checkedAt) {
  const pos = c.address?.locationCoordinates;
  if (!pos || typeof pos.lat !== 'number' || typeof pos.lon !== 'number') return null;
  const services = (c.pocCenterDetails?.serviceList || []).flatMap((s) => (s.subServiceList || []).map((x) => x.categoryName)).filter(Boolean);
  const phone = (c.contactList || []).map(String).find((p) => /^\d[\d-]{7,}$/.test(p));
  return {
    sourceRef: `vijaya:${c.pocId}`,
    name: `Vijaya Diagnostic Centre, ${String(c.pocName).trim()}`,
    address: String(c.areaName || [c.address.address1, c.address.address2].filter(Boolean).join(', ')).replace(/\s+/g, ' ').trim().slice(0, 300),
    pinCode: c.address.pinCode || null,
    lat: pos.lat,
    lng: pos.lon,
    phone: phone ? (phone.startsWith('0') ? `+91 ${phone.slice(1).replace(/-/g, ' ')}` : `+91 ${phone}`) : null,
    website: url,
    services: [...new Set(services)].slice(0, 20),
    checkedAt,
  };
}

export function toTestPrice(html, url, checkedAt) {
  const ld = jsonLd(html);
  const offer = ld.find((x) => x['@type'] === 'Offer');
  const test = ld.find((x) => x['@type'] === 'MedicalTest');
  const price = Number(offer?.priceSpecification?.price ?? offer?.price);
  const name = (test?.alternateName || offer?.itemOffered?.name || '').replace(/\s+/g, ' ').trim();
  if (!name || !Number.isFinite(price) || price <= 0) return null;
  return {
    sourceRef: `vijaya:test:${new URL(url).pathname.split('/').pop()}`,
    provider: 'Vijaya Diagnostic Centre',
    name: name.slice(0, 300),
    category: null,
    priceInr: price,
    centresOffering: Array.isArray(offer.availableAtOrFrom) ? offer.availableAtOrFrom.length : null,
    url,
    checkedAt,
  };
}

async function main() {
  await mkdir('.cache', { recursive: true });
  let cache = { source: 'Vijaya Diagnostic website', centres: {}, tests: {}, failed: {} };
  try { cache = JSON.parse(await readFile(FILE, 'utf8')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const save = () => writeFile(FILE, JSON.stringify(cache));
  const checkedAt = today();
  const centrePages = locs(await get(`${SITE}/diagnostic-centres-sitemap.xml`)).filter((u) => /\/find-a-centre\/hyderabad(\/|$)/.test(u));
  const seen = new Set(cache.centrePagesDone || []);
  for (const [n, url] of centrePages.entries()) {
    if (seen.has(url)) continue;
    try {
      for (const c of centresFrom(await get(url))) {
        const r = toCentre(c, `${SITE}/find-a-centre/hyderabad/${String(c.pocName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}`, checkedAt);
        if (r && c.address?.cityName === 'Hyderabad') cache.centres[r.sourceRef] = r;
      }
    } catch (err) { cache.failed[url] = err.message; }
    seen.add(url);
    cache.centrePagesDone = [...seen];
    if (n % 10 === 9) { await save(); console.log(`centre pages ${n + 1} of ${centrePages.length}, centres ${Object.keys(cache.centres).length}`); }
  }
  await save();
  const testPages = locs(await get(`${SITE}/diagnostic-test-sitemap.xml`)).filter((u) => /\/test\/hyderabad\/[^/]+$/.test(u));
  const done = new Set(Object.values(cache.tests).map((t) => t.url));
  const todo = testPages.filter((u) => !done.has(u) && !cache.failed[u]);
  console.log(`${Object.keys(cache.centres).length} centres; ${todo.length} test pages to fetch`);
  for (const [n, url] of todo.entries()) {
    try {
      const t = toTestPrice(await get(url), url, checkedAt);
      if (t) cache.tests[t.sourceRef] = t; else cache.failed[url] = 'no price on the page';
    } catch (err) { cache.failed[url] = err.message; }
    if (n % 25 === 24) { await save(); console.log(`tests ${n + 1} of ${todo.length}`); }
  }
  await save();
  console.log(`done: ${Object.keys(cache.centres).length} centres, ${Object.keys(cache.tests).length} test prices`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
