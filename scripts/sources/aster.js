// Aster Prime Hospital, Ameerpet: doctor pages from the Aster Hospitals sitemap (D-56).
// robots.txt on 2026-10-27 allows /doctors/<branch>/<doctor> and blocks only the filtered lists.
// The page's JSON-LD belongs to another doctor's template, so the visible labelled lines are used.
import { get, locs, lines, httpsOnly, splitQualifications } from '../lib/web.js';

export const id = 'aster';
export const hospital = 'Aster Prime Hospital';
export const sourcePlatform = 'Aster Hospitals website';
export const photoHosts = ['www.asterhospitals.in'];
export const branches = { 'Aster Prime Hyderabad': 'osm:node/6497362076' };
const SECTION = /^(Call us|Book An Appointment|Overview|Area of expertise|Awards|Publications|Memberships|Education|Testimonials|Videos|FAQs?)$/i;

export function toRecord(html, url, checkedAt) {
  const ls = lines(html);
  const s = ls.indexOf('Speciality');
  if (s < 3) return null;
  const heading = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const name = heading || ls[s - 3];
  if (!name || !/^Dr\.?\s/i.test(name)) return null;
  const after = (label) => { const i = ls.indexOf(label, s); return i !== -1 ? ls[i + 1] : null; };
  const branchText = after('Hospital') || '';
  if (!/hyderabad/i.test(branchText)) return null;
  const languages = [];
  const li = ls.indexOf('Languages', s);
  for (let k = li + 1; li !== -1 && k < ls.length && !SECTION.test(ls[k]) && languages.length < 8; k++) {
    languages.push(...ls[k].split(/\s*(?:,|&|\band\b)\s*/i).map((x) => x.replace(/\u200b/g, '').trim()).filter(Boolean));
  }
  const overview = after('Overview') || '';
  const exp = /experience of (?:over |more than )?(\d{1,2})\+? years/i.exec(overview);
  const expertise = [];
  const ei = ls.indexOf('Area of expertise', s);
  for (let k = ei + 1; ei !== -1 && k < ls.length && !SECTION.test(ls[k]) && expertise.length < 12; k++) {
    const item = ls[k].replace(/[,"]+$/, '').trim();
    if (item.length > 2 && item.length <= 120) expertise.push(item);
  }
  const img = new RegExp(`<img[^>]+src="(/sites/default/files/[^"]+\\.(?:jpe?g|png|webp))"`, 'i').exec(html);
  return {
    sourceRef: `aster:${new URL(url).pathname}`,
    name: name.slice(0, 200),
    title: ls[s - 2].slice(0, 160),
    specialization: (after('Speciality') || 'General Medicine').slice(0, 120),
    qualifications: splitQualifications(ls[s - 1]),
    experienceYears: exp && Number(exp[1]) <= 70 ? Number(exp[1]) : null,
    languages,
    expertise,
    branch: 'Aster Prime Hyderabad',
    branchText,
    photoUrl: img ? httpsOnly(`https://www.asterhospitals.in${img[1]}`) : null,
    profileUrl: url,
    // The profile page carries Aster's own "Book An Appointment" form.
    bookingUrl: url,
    appointmentPhone: null,
    timings: '',
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  const pages = locs(await get('https://www.asterhospitals.in/sitemap.xml'));
  const out = [];
  for (const p of pages) out.push(...locs(await get(p)).filter((u) => /\/doctors\/aster-prime-hyderabad\/[^/]+$/.test(u)));
  return out;
}
