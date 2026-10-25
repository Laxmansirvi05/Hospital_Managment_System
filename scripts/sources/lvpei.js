// L V Prasad Eye Institute team pages (D-56), Hyderabad campus only, doctors only. The team
// list also holds therapists and staff with work email addresses; those are not kept (D-54).
import { get, locs, lines, meta, httpsOnly } from '../lib/web.js';

export const id = 'lvpei';
export const hospital = 'L V Prasad Eye Institute';
export const sourcePlatform = 'L V Prasad Eye Institute website';
export const photoHosts = ['www.lvpei.org'];
export const branches = { 'Kallam Anji Reddy Campus': 'osm:way/660771331' };
const DOCTOR = /ophthalmolog|surgeon|consultant|cornea|retina|glaucoma|cataract|oculoplast|paediatric|pediatric|neuro|uvea|squint|refractive/i;

export function toRecord(html, url, checkedAt) {
  const ls = lines(html);
  const after = (label) => { const i = ls.indexOf(label); const v = i !== -1 ? ls[i + 1] : null; return v && v !== '-' ? v : null; };
  const name = ls.find((l, i) => i > 20 && ls[i + 1] === 'Designation');
  const location = after('Location') || '';
  const spec = after('Specialisation');
  const designation = [after('Designation'), after('Other Designations')].filter(Boolean).join(', ');
  // Hyderabad campus doctors only; therapists, optometrists and staff are not listed.
  if (!name || !/Kallam Anji Reddy/i.test(location) || !DOCTOR.test(`${designation} ${spec}`) || /therapist|optometr|counsel|coordinator|manager|executive/i.test(designation)) return null;
  return {
    sourceRef: `lvpei:${new URL(url).pathname}`,
    name: /^Dr\.?\s/i.test(name) ? name : `Dr ${name}`,
    title: designation.slice(0, 160),
    specialization: (spec || 'Ophthalmology').slice(0, 120),
    qualifications: [],
    experienceYears: null,
    languages: [], expertise: spec ? [spec] : [],
    branch: 'Kallam Anji Reddy Campus',
    branchText: location,
    photoUrl: httpsOnly(meta(html, 'og:image')),
    profileUrl: url,
    bookingUrl: 'https://www.lvpei.org/appointments/',
    appointmentPhone: null,
    timings: '',
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.lvpei.org/team_member-sitemap.xml')).filter((u) => /\/team-members\/[^/]+\/$/.test(u));
}
