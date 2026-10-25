// CARE Hospitals doctor pages (D-52). Pages come from CARE's doctors sitemap; robots.txt allows
// the English Hyderabad pages. The details sit under labelled lines: Speciality, Qualification,
// Experience, Location.
import { get, locs, lines, jsonLd, meta, httpsOnly, splitQualifications } from '../lib/web.js';

export const id = 'care';
export const hospital = 'CARE Hospitals';
export const sourcePlatform = 'CARE Hospitals website';
export const photoHosts = ['www.carehospitals.com'];
// Each CARE location name mapped by hand to the OpenStreetMap building it names. Malakpet has no
// OSM entry; its doctors are left out rather than guessed (see CHANGELOG 2026-10-25).
export const branches = {
  'Banjara Hills': 'osm:way/337928613',
  'HITEC City': 'osm:way/630869585',
  Musheerabad: 'osm:node/5118590649',
  Nampally: 'osm:node/6481952537',
};

/** The part of a page that holds the details, starting two lines above "Speciality". */
export function pageLines(html) {
  const all = lines(html);
  const i = all.findIndex((l, k) => l === 'Speciality' && all[k + 2] === 'Qualification');
  return i < 2 ? null : all.slice(i - 2, i + 30);
}

const shorten = (t, max) => (t.length <= max ? t : t.slice(0, t.lastIndexOf(',', max) > 0 ? t.lastIndexOf(',', max) : max).trim());

export function parseLines(ls, url) {
  const [a, b] = ls;
  const isName = (l) => /^Dr\.?\s/i.test(l);
  const name = isName(a) ? a : isName(b) ? b : null;
  if (!name) return null;
  const title = name === a ? b : '';
  const after = (label) => { const i = ls.indexOf(label); return i !== -1 ? ls[i + 1] : null; };
  const locIdx = ls.indexOf('Location');
  const locations = locIdx !== -1 ? ls[locIdx + 1].split(/,\s*(?=CARE|Gurunanak|Guru Nanak)/).map((s) => s.trim()).filter(Boolean) : [];
  const phoneLine = ls.slice(locIdx === -1 ? 0 : locIdx).find((l) => /^\+91[-\s0-9]{8,}$/.test(l));
  const exp = /^(\d{1,2})\+?\s*Years?/i.exec(after('Experience') || '');
  return {
    sourceRef: `care:${new URL(url).pathname}`,
    name: name.slice(0, 200),
    title: shorten(title, 160),
    specialization: after('Speciality') || 'General Medicine',
    qualifications: splitQualifications(after('Qualification')),
    experienceYears: exp ? Number(exp[1]) : null,
    locations,
    appointmentPhone: phoneLine ? phoneLine.replace(/-/g, ' ').replace(/\s+/g, ' ') : null,
    profileUrl: url,
  };
}

export function parseDoctor(html, url) {
  const ls = pageLines(html);
  return ls ? parseLines(ls, url) : null;
}

/** CARE location text such as "CARE Hospitals, Banjara Hills, Hyderabad" to a branch key. */
export function branchOf(location) {
  const parts = location.split(',').map((s) => s.trim()).filter((s) => !/^hyderabad$/i.test(s));
  const locality = (parts.at(-1) || '').toLowerCase();
  return Object.keys(branches).find((k) => k.toLowerCase() === locality) ?? null;
}

export function toRecord(html, url, checkedAt) {
  const d = parseDoctor(html, url);
  if (!d) return null;
  const person = jsonLd(html).find((x) => x['@type'] === 'Person');
  const photo = httpsOnly(person?.image) || httpsOnly(meta(html, 'og:image'));
  return {
    ...d,
    branch: d.locations.map(branchOf).find(Boolean) ?? null,
    branchText: d.locations.join(' / '),
    photoUrl: photo && /\/doctor|best-|dr-/i.test(photo) ? photo : null,
    bookingUrl: url,
    languages: [], expertise: [], timings: '', consultationFeeInr: null, checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.carehospitals.com/doctors-sitemap.xml')).filter((u) => /\/doctor\/hyderabad\//.test(u));
}
