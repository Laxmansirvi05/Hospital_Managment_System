// Citizens Specialty Hospital doctor pages (D-56), Nallagandla, from its sitemap. The page lists
// title, qualifications, experience and published timings under labelled lines.
import { get, locs, lines, jsonLd, splitQualifications } from '../lib/web.js';

export const id = 'citizens';
export const hospital = 'Citizens Specialty Hospital';
export const sourcePlatform = 'Citizens Specialty Hospital website';
export const photoHosts = ['www.citizenshospitals.com'];
export const branches = { Nallagandla: 'osm:node/6536715097' };

export function toRecord(html, url, checkedAt) {
  const ld = jsonLd(html).find((x) => x['@type'] === 'Person');
  if (!ld?.name) return null;
  const ls = lines(html);
  const after = (label) => { const i = ls.indexOf(label); return i !== -1 ? ls[i + 1] : null; };
  const exp = /^(\d{1,2})/.exec(after('Experience') || '');
  const t = ls.indexOf('Available Timings');
  const timings = t === -1 ? '' : ls.slice(t + 2, t + 6).filter((l) => /\d/.test(l) && /day/i.test(l)).join('; ');
  const img = (html.match(/<img[^>]+class="drprofile-img"[^>]*>/i) || html.match(/<img[^>]+drprofile-img[^>]*>/i) || [''])[0];
  const src = (img.match(/src="([^"]+)"/) || [])[1];
  const name = ld.name.replace(/\s+/g, ' ').replace(/^DR\b/, 'Dr').trim();
  return {
    sourceRef: `citizens:${new URL(url).pathname}`,
    name: name.slice(0, 200),
    title: (ld.jobTitle || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    specialization: ((ld.jobTitle || '').split(/\s+-\s+/)[1] || 'General Medicine').replace(/\s+/g, ' ').trim().slice(0, 120),
    qualifications: splitQualifications(after('Qualifications')),
    experienceYears: exp ? Number(exp[1]) : null,
    languages: [], expertise: [],
    branch: 'Nallagandla',
    branchText: 'Citizens Specialty Hospital, Nallagandla',
    photoUrl: src && src.startsWith('/') ? `https://www.citizenshospitals.com${src}` : null,
    profileUrl: url,
    bookingUrl: url,
    appointmentPhone: null,
    timings: timings.slice(0, 300),
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.citizenshospitals.com/sitemap.xml')).filter((u) => /\/doctor\/[^/]+$/.test(u));
}
