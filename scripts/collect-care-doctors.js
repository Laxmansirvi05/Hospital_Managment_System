// Collects Hyderabad doctor details that CARE Hospitals publishes on its own website (D-52) into
// .cache/care-doctors.json. Only the fields in D-54 are kept. Pages come from CARE's doctors
// sitemap, robots.txt is checked first, and requests go one at a time, 3 seconds apart (P-29).
// Resumable: pages already in the cache are skipped. Run: node scripts/collect-care-doctors.js [--retry]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { USER_AGENT } from './collect-osm.js';

const SITE = 'https://www.carehospitals.com';
const CACHE = '.cache/care-doctors.json';
const DELAY_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

/** Disallow rules for all agents. Enough for CARE's file, which uses only `*` and `$`-free prefixes. */
function disallowed(robots) {
  const rules = [];
  let forAll = false;
  for (const raw of robots.split('\n')) {
    const line = raw.split('#')[0].trim();
    const [k, ...rest] = line.split(':');
    const v = rest.join(':').trim();
    if (/^user-agent$/i.test(k)) forAll = v === '*';
    else if (forAll && /^disallow$/i.test(k) && v) rules.push(new RegExp(`^${v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`));
  }
  return (path) => rules.some((r) => r.test(path));
}

const text = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'")
  .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

/**
 * The part of a doctor page that holds the details: the doctor's name, title, then labelled
 * Speciality, Qualification, Experience and Location. Only this part is cached, so the parser
 * can change without fetching the pages again. Null when the page has no doctor details.
 */
export function pageLines(html) {
  const lines = text(html);
  const i = lines.findIndex((l, k) => l === 'Speciality' && lines[k + 2] === 'Qualification');
  return i < 2 ? null : lines.slice(i - 2, i + 30);
}

/** Cuts a long title at the last comma that fits, so it never ends mid-word. */
const shorten = (t, max) => (t.length <= max ? t : t.slice(0, t.lastIndexOf(',', max) > 0 ? t.lastIndexOf(',', max) : max).trim());

export function parseLines(lines, url) {
  // Name first, then the title. Some doctors have no title, so the name sits right above Speciality.
  const [a, b] = lines;
  const isName = (l) => /^Dr\.?\s/i.test(l);
  const name = isName(a) ? a : isName(b) ? b : null;
  if (!name) return null;
  const title = name === a ? b : '';
  const after = (label) => {
    const i = lines.indexOf(label);
    return i !== -1 ? lines[i + 1] : null;
  };
  const locIdx = lines.indexOf('Location');
  const locations = locIdx !== -1 ? lines[locIdx + 1].split(/,\s*(?=CARE|Gurunanak|Guru Nanak)/).map((s) => s.trim()).filter(Boolean) : [];
  const phoneLine = lines.slice(locIdx === -1 ? 0 : locIdx).find((l) => /^\+91[-\s0-9]{8,}$/.test(l));
  const exp = /^(\d{1,2})\+?\s*Years?/i.exec(after('Experience') || '');
  return {
    sourceRef: `care:${new URL(url).pathname}`,
    name: name.slice(0, 200),
    title: shorten(title, 160),
    specialization: after('Speciality') || 'General Medicine',
    qualifications: (after('Qualification') || '').split(/,\s*/).map((x) => x.trim()).filter(Boolean),
    experienceYears: exp ? Number(exp[1]) : null,
    locations,
    appointmentPhone: phoneLine ? phoneLine.replace(/-/g, ' ').replace(/\s+/g, ' ') : null,
    profileUrl: url,
  };
}

export function parseDoctor(html, url) {
  const lines = pageLines(html);
  return lines ? parseLines(lines, url) : null;
}

async function main() {
  const retry = process.argv.includes('--retry');
  const disallow = disallowed(await get(`${SITE}/robots.txt`));
  const sitemap = await get(`${SITE}/doctors-sitemap.xml`);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
    .filter((u) => /\/doctor\/hyderabad\//.test(u) && !disallow(new URL(u).pathname));
  await mkdir('.cache', { recursive: true });
  let cache = { source: 'CARE Hospitals website', version: 2, pages: {}, failed: {} };
  try {
    const old = JSON.parse(await readFile(CACHE, 'utf8'));
    if (old.version === 2) cache = old;
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  // Pages that had no doctor details are not asked for again unless --retry is given.
  const todo = urls.filter((u) => !cache.pages[u] && (retry || !cache.failed[u]));
  console.log(`${urls.length} allowed Hyderabad pages, ${todo.length} to fetch`);
  for (const [i, url] of todo.entries()) {
    try {
      const lines = pageLines(await get(url));
      if (lines) {
        cache.pages[url] = { lines, checkedAt: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()) };
        delete cache.failed[url];
      } else cache.failed[url] = 'no doctor details on the page';
    } catch (err) {
      cache.failed[url] = err.message;
    }
    if (i % 10 === 9 || i === todo.length - 1) {
      await writeFile(CACHE, JSON.stringify(cache));
      console.log(`${i + 1} of ${todo.length}`);
    }
    await sleep(DELAY_MS);
  }
  await writeFile(CACHE, JSON.stringify(cache));
  console.log(`done: ${Object.keys(cache.pages).length} pages with doctor details, ${Object.keys(cache.failed).length} without`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
