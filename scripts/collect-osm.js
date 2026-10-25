// Collects hospitals, clinics, pharmacies and diagnostic centres in greater Hyderabad from OpenStreetMap (D-50, D-59)
// into .cache/osm.json. One Overpass request per run, sent with an honest user agent (P-29).
// Load the result with scripts/load-listings.js. Run: node scripts/collect-osm.js
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { distanceKm } from '../server/db/geo.js';

export const USER_AGENT = 'CareRouteCollector/0.1 (Hyderabad health listings; contact laxmansirvi2203@gmail.com)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
// Greater Hyderabad (D-59): the city, Secunderabad, Cyberabad and the ring of suburbs inside the
// Outer Ring Road, as a box (south, west, north, east).
const BOX = '17.20,78.20,17.62,78.70';

const QUERY = `[out:json][timeout:180][bbox:${BOX}];
(
  nwr["amenity"~"^(hospital|pharmacy|clinic|doctors|dentist)$"];
  nwr["healthcare"~"^(hospital|pharmacy|laboratory|diagnostic|radiology|clinic|doctor|dentist|optometrist|centre)$"];
  nwr["shop"="chemist"];
  node["place"="suburb"];
);
out tags center;`;

// Clinics and doctors' practices are kept only when the name says they test or scan.
const DIAGNOSTIC_NAME = /diagnos|\blab(s|oratory|oratories)?\b|scan|imaging|patholog|x-?ray|\bmri\b|\bct\b|ultrasound|radiolog/i;

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const first = (...vals) => vals.map(clean).find(Boolean) || null;
const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function website(t) {
  const w = first(t.website, t['contact:website'], t.url);
  if (!w) return null;
  // The database accepts only a lower-case scheme, and some OSM entries write HTTP://.
  const v = /^https?:\/\//i.test(w) ? w.replace(/^https?/i, (m) => m.toLowerCase()) : /^www\./i.test(w) ? `https://${w}` : null;
  return v && v.length <= 300 ? v : null;
}

// A single doctor's practice often lists the doctor's own mobile or email; keep only its phone (D-54).
const personalPractice = (t) => t.amenity === 'doctors' || t.healthcare === 'doctor';

function phone(t) {
  const p = personalPractice(t) ? first(t.phone, t['contact:phone']) : first(t.phone, t['contact:phone'], t['contact:mobile'], t.mobile);
  return p ? p.split(/[;,]/)[0].trim().slice(0, 40) : null;
}

function address(t, area) {
  if (t['addr:full']) return clean(t['addr:full']);
  const parts = [[t['addr:housenumber'], t['addr:street']].map(clean).filter(Boolean).join(' '), t['addr:suburb'], t['addr:city'], t['addr:postcode']].map(clean).filter(Boolean);
  // Without address tags only the area is known; the page says so rather than inventing a street.
  return parts.length ? [...new Set(parts)].join(', ') : `${area}, Hyderabad (no street address listed)`;
}

const CARE_PLACE = (t) => ['hospital', 'clinic', 'doctors', 'dentist'].includes(t.amenity) || ['hospital', 'clinic', 'doctor', 'dentist', 'optometrist', 'centre'].includes(t.healthcare);

function kindOf(t) {
  if (t.amenity === 'pharmacy' || t.healthcare === 'pharmacy' || t.shop === 'chemist') return 'pharmacy';
  if (['laboratory', 'diagnostic', 'radiology'].includes(t.healthcare)) return 'diagnostic';
  if (CARE_PLACE(t) && DIAGNOSTIC_NAME.test(t.name || '')) return 'diagnostic';
  if (CARE_PLACE(t)) return 'hospital';
  return null;
}

/** Which kind of care place this is (D-59), from tags first and the name second. */
export function facilityType(t) {
  const n = (t.name || '').toLowerCase();
  if (t.amenity === 'dentist' || t.healthcare === 'dentist' || /dental|dentist|\bteeth\b|orthodont/.test(n)) return 'dental';
  if (t.healthcare === 'optometrist' || /\beye\b|netralaya|ophthalm|vision|optical/.test(n)) return 'eye';
  if (/ayurved|homoeo|homeo|unani|siddha|naturopath|ayush/.test(n) || /ayurved|homeopath|unani|siddha/.test(t['healthcare:speciality'] || '')) return 'ayush';
  if (/maternity|fertility|ivf|women/.test(n)) return 'maternity';
  if (/nursing home/.test(n)) return 'nursing_home';
  if (t.amenity === 'hospital' || t.healthcare === 'hospital' || /hospital|institute of medical|medical college/.test(n)) return 'hospital';
  return 'clinic';
}

// Pharmacy chains by name, so patients can find a branch of a chain they trust.
const CHAINS = [['Apollo Pharmacy', /apollo/], ['MedPlus', /med ?plus/], ['Hetero Pharmacy', /hetero/], ['Wellness Forever', /wellness forever/], ['Jan Aushadhi Kendra', /jan ?aushadh|janaushadh|pmbjp/], ['Netmeds', /netmeds/], ['Frank Ross', /frank ross/], ['Sri Sai Pharmacy', /^sri sai (pharma|medical)/]];
export function chainOf(t) {
  const n = `${t.brand || ''} ${t.name || ''}`.toLowerCase();
  return CHAINS.find(([, re]) => re.test(n))?.[0] ?? null;
}

export function toListings(elements, checkedAt) {
  // Suburbs are coarse enough for an area filter; neighbourhoods would give hundreds of choices.
  const places = elements.filter((e) => e.tags?.place === 'suburb' && e.tags.name && e.lat != null).map((e) => ({ name: clean(e.tags['name:en'] || e.tags.name), lat: e.lat, lng: e.lon }));
  const areaFor = (p, t) => {
    let best = null;
    for (const pl of places) {
      const d = distanceKm(p, pl);
      if (!best || d < best.d) best = { d, name: pl.name };
    }
    // Nearest suburb within 4 km; otherwise the place's own suburb tag.
    return best && best.d <= 4 ? best.name : first(t['addr:suburb'], t['addr:city']) || 'Hyderabad';
  };
  const out = { hospitals: [], pharmacies: [], diagnostics: [] };
  const seen = new Set();
  for (const e of elements) {
    const t = e.tags || {};
    const kind = kindOf(t);
    // Prefer the English name when the main one has no Latin letters, so search by typing works.
    const name = clean(/[A-Za-z]/.test(t.name || '') ? t.name : t['name:en'] || t.name);
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!kind || !name || lat == null) continue;
    const ref = `osm:${e.type}/${e.id}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const area = areaFor({ lat, lng }, t);
    const base = {
      sourceRef: ref, name: name.slice(0, 200), area, address: address(t, area), lat, lng,
      phone: phone(t), email: personalPractice(t) ? null : first(t.email, t['contact:email']), website: website(t),
      sourcePlatform: 'OpenStreetMap', sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`, checkedAt,
    };
    if (kind === 'hospital') {
      out.hospitals.push({ ...base, facilityType: facilityType(t), emergencyAvailable: t.emergency === 'yes' ? true : t.emergency === 'no' ? false : null, specialities: (t['healthcare:speciality'] || '').split(';').map(clean).filter(Boolean).map(titleCase), description: '' });
    } else if (kind === 'pharmacy') {
      out.pharmacies.push({ ...base, chain: chainOf(t), hours: clean(t.opening_hours), open24: clean(t.opening_hours) === '24/7' });
    } else {
      out.diagnostics.push({ ...base, hours: clean(t.opening_hours), description: '', testsListed: [] });
    }
  }
  out.suburbs = places;
  return out;
}

async function main() {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'user-agent': USER_AGENT, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass answered ${res.status}`);
  const json = await res.json();
  const checkedAt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const data = toListings(json.elements, checkedAt);
  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/osm.json', JSON.stringify({ source: 'OpenStreetMap', licence: 'ODbL 1.0', collectedAt: new Date().toISOString(), ...data }));
  console.log(`hospitals ${data.hospitals.length}, pharmacies ${data.pharmacies.length}, diagnostic centres ${data.diagnostics.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
