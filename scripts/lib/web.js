// Polite fetching for the collectors (P-29): robots.txt is read once per host and honoured,
// requests to one host are spaced out, and the user agent says who is asking.
export const USER_AGENT = 'CareRouteCollector/0.1 (Hyderabad health listings; contact laxmansirvi2203@gmail.com)';
const GAP_MS = 3000;

const robots = new Map();
const lastHit = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Disallow and Allow rules that apply to every agent, longest match wins as in RFC 9309. */
export function robotsRules(txt) {
  const rules = [];
  let forAll = false;
  let inGroup = false;
  for (const raw of txt.split('\n')) {
    const line = raw.split('#')[0].trim();
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === 'user-agent') {
      if (!inGroup) forAll = false;
      forAll = forAll || v === '*';
      inGroup = true;
      continue;
    }
    inGroup = false;
    if (!forAll || (k !== 'disallow' && k !== 'allow') || !v) continue;
    const re = new RegExp(`^${v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
    rules.push({ allow: k === 'allow', re, len: v.length });
  }
  return (path) => {
    const hits = rules.filter((r) => r.re.test(path)).sort((a, b) => b.len - a.len || Number(b.allow) - Number(a.allow));
    return hits.length === 0 || hits[0].allow;
  };
}

async function allowedBy(url) {
  const u = new URL(url);
  if (!robots.has(u.host)) {
    const res = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
    // No robots.txt means no rules; any other failure means we do not know, so we stay out.
    robots.set(u.host, res.status === 404 ? () => true : res.ok ? robotsRules(await res.text()) : () => false);
  }
  return robots.get(u.host)(u.pathname + u.search);
}

/** Fetches a page politely. Throws when robots.txt disallows it or the site answers with an error. */
export async function get(url, { json = false } = {}) {
  if (!(await allowedBy(url))) throw new Error(`robots.txt disallows ${url}`);
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: json ? 'application/json' : 'text/html,application/xml' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  // A redirect to another host is fetched only if that host's robots.txt allows the final address too.
  if (res.redirected && new URL(res.url).host !== host && !(await allowedBy(res.url))) throw new Error(`robots.txt disallows ${res.url}`);
  return json ? res.json() : res.text();
}

export const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...' };
export const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** Visible text of a page as trimmed lines. */
export const lines = (html) => decode(html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/g, ' ')
  .replace(/<[^>]+>/g, '\n'))
  .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Every schema.org object in the page's JSON-LD blocks, flattened. */
export const jsonLd = (html) => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
  .flatMap((j) => (j ? [].concat(j).flatMap((x) => [].concat(x['@graph'] || x)) : []))
  .filter((x) => x && typeof x === 'object');

export function meta(html, prop) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decode(m[1]).trim() : null;
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const splitList = (s) => (s || '').split(/\s*[,|;]\s*/).map((x) => x.trim()).filter(Boolean);

/** Splits "MBBS, MD (Medicine, AIIMS), DM" on commas outside brackets. */
export function splitQualifications(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s || '') {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
export const httpsOnly = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);
