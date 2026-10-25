// Gleneagles Hospitals doctor pages (D-56). The Hyderabad pages come from its doctors sitemap.
// Each page lists Speciality, Qualification, Experience, Language Spoken, Location and
// Consultation Charges as labelled lines.
import { get, locs, lines, meta, httpsOnly } from '../lib/web.js';

export const id = 'gleneagles';
export const hospital = 'Gleneagles Hospitals';
export const sourcePlatform = 'Gleneagles Hospitals website';
export const photoHosts = ['gleneagles-optimized-prod.s3.ap-south-1.amazonaws.com'];
export const branches = { 'Lakdi-Ka-Pul': 'osm:way/357057519' };

const LABELS = ['Speciality', 'Qualification', 'Experience', 'Gender', 'Language Spoken', 'Location', 'Consultation Charges'];

export function toRecord(html, url, checkedAt) {
  const ls = lines(html);
  const s = ls.indexOf('Speciality');
  if (s < 2) return null;
  const block = (label) => {
    const i = ls.indexOf(label, s - 1);
    if (i === -1) return [];
    const out = [];
    for (let k = i + 1; k < ls.length && !LABELS.includes(ls[k]) && ls[k] !== '×' && out.length < 12; k++) out.push(ls[k]);
    return out;
  };
  const name = ls[s - 2];
  if (!/^Dr\.?\s/i.test(name)) return null;
  const exp = /^(\d{1,2})/.exec(block('Experience')[0] || '');
  const fee = /^(\d{2,5})$/.exec((block('Consultation Charges')[0] || '').replace(/[^\d]/g, ''));
  const location = block('Location')[0] || '';
  const branch = Object.keys(branches).find((k) => location.toLowerCase().includes(k.toLowerCase())) ?? null;
  const path = new URL(url).pathname;
  return {
    sourceRef: `gleneagles:${path}`,
    name: name.slice(0, 200),
    title: ls[s - 1].slice(0, 160),
    specialization: block('Speciality')[0] || 'General Medicine',
    qualifications: block('Qualification').flatMap((q) => q.split(/\s*\|\s*|,\s*/)).filter(Boolean),
    experienceYears: exp && Number(exp[1]) <= 70 ? Number(exp[1]) : null,
    languages: block('Language Spoken'),
    expertise: [],
    branch,
    branchText: location,
    photoUrl: httpsOnly(meta(html, 'og:image')),
    profileUrl: url,
    bookingUrl: `https://www.gleneagleshospitals.co.in/form/book-an-appointment?path=${encodeURIComponent(path)}`,
    appointmentPhone: null,
    timings: '',
    consultationFeeInr: fee ? Number(fee[1]) : null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.gleneagleshospitals.co.in/doctors/sitemap.xml')).filter((u) => /\/hyderabad\//i.test(u));
}
