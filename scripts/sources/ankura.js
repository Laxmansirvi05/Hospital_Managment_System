// Ankura Hospital for Women and Children doctor pages (D-56), from its doctors sitemap. Physician
// JSON-LD gives photo, languages, degrees and speciality; under the name the page lists title,
// qualifications, years of experience and the branch.
import { get, locs, lines, jsonLd, httpsOnly, splitQualifications } from '../lib/web.js';

export const id = 'ankura';
export const hospital = 'Ankura Hospitals';
export const sourcePlatform = 'Ankura Hospitals website';
export const photoHosts = ['www.ankurahospitals.com'];
// Ankura's Hyderabad branch names mapped by address to OpenStreetMap buildings. Attapur, LB Nagar,
// Gachibowli and Kompally have no OSM entry yet; their doctors are not placed.
export const branches = {
  Kukatpally: 'osm:node/6248961986',
  'AS Rao Nagar': 'osm:node/6503394122',
  'Banjara Hills': 'osm:node/6503655627',
  Madinaguda: 'osm:node/7243959583',
  Boduppal: 'osm:node/6486957243',
};

export function toRecord(html, url, checkedAt) {
  const ld = jsonLd(html).find((x) => x['@type'] === 'Physician');
  if (!ld?.name) return null;
  const name = ld.name.replace(/\s+/g, ' ').trim();
  const ls = lines(html);
  const i = ls.lastIndexOf(name, ls.indexOf('Plan Your') === -1 ? ls.length : ls.indexOf('Plan Your'));
  const after = i === -1 ? [] : ls.slice(i + 1, i + 8);
  const expIdx = after.findIndex((l) => /^\d{1,2}\+?\s*years? Experience$/i.test(l));
  const branchText = expIdx !== -1 ? after[expIdx + 1] || '' : '';
  const spec = [].concat(ld.medicalSpecialty || [])[0];
  return {
    sourceRef: `ankura:${new URL(url).pathname.toLowerCase()}`,
    name: name.slice(0, 200),
    title: (after[0] || '').slice(0, 160),
    specialization: (spec || 'Paediatrics').slice(0, 120),
    qualifications: [].concat(ld.degree || []).length ? [].concat(ld.degree) : splitQualifications(expIdx > 1 ? after[1] : ''),
    experienceYears: expIdx !== -1 ? Math.min(Number(/\d+/.exec(after[expIdx])[0]), 70) : null,
    languages: [].concat(ld.knowsLanguage || []).filter((x) => typeof x === 'string'),
    expertise: [].concat(ld.medicalSpecialty || []).slice(0, 12),
    branch: Object.keys(branches).find((k) => k.toLowerCase() === branchText.toLowerCase()) ?? null,
    branchText,
    photoUrl: httpsOnly(ld.image),
    profileUrl: url,
    bookingUrl: url,
    appointmentPhone: null,
    timings: '',
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.ankurahospitals.com/sitemap-doctors.xml'));
}
