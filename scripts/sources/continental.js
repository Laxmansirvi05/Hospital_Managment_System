// Continental Hospitals doctor pages (D-56), from its doctors sitemap. One Hyderabad hospital.
// Physician JSON-LD gives name, title and photo; the visible text gives experience, OPD hours
// and languages right under the name.
import { get, locs, lines, jsonLd, httpsOnly } from '../lib/web.js';

export const id = 'continental';
export const hospital = 'Continental Hospitals';
export const sourcePlatform = 'Continental Hospitals website';
export const photoHosts = ['continentalhospitals.com'];
export const branches = { 'Financial District': 'osm:way/254295845' };

export function toRecord(html, url, checkedAt) {
  const ld = jsonLd(html).find((x) => x['@type'] === 'Physician');
  if (!ld?.name) return null;
  const name = ld.name.replace(/\s+/g, ' ').trim();
  const ls = lines(html);
  const i = ls.findIndex((l, k) => k > 20 && l === name);
  const near = i === -1 ? [] : ls.slice(i + 1, i + 8);
  const exp = near.map((l) => /^(\d{1,2})\+?\s*Yrs? Experience$/i.exec(l)).find(Boolean);
  const timings = near.find((l) => /\d{1,2}:\d{2}\s*[AP]M/i.test(l)) || '';
  const langs = near.find((l) => /^(English|Hindi|Telugu|Urdu|Tamil|Kannada|Marathi|Bengali|Malayalam)(,\s*[A-Za-z]+)*$/.test(l)) || '';
  const title = (ld.jobTitle || '').replace(/\s+/g, ' ').trim();
  return {
    sourceRef: `continental:${new URL(url).pathname}`,
    name: /^Dr\.?\s/i.test(name) ? name : `Dr ${name}`,
    title: title.slice(0, 160),
    // "Consultant - Anesthesiologist": the part after the dash names the speciality.
    specialization: (title.split(/\s+-\s+/)[1] || ld.medicalSpecialty || title || 'General Medicine').slice(0, 120),
    qualifications: [],
    experienceYears: exp ? Number(exp[1]) : null,
    languages: langs.split(/,\s*/).filter(Boolean),
    expertise: [],
    branch: 'Financial District',
    branchText: 'Continental Hospitals, Gachibowli, Hyderabad',
    photoUrl: httpsOnly(ld.image),
    profileUrl: url,
    bookingUrl: url,
    appointmentPhone: null,
    timings: timings.replace(/\s*–\s*/g, ' to '),
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://continentalhospitals.com/doctors-sitemap.xml')).filter((u) => /\/doctors\/[^/]+\/?$/.test(u));
}
