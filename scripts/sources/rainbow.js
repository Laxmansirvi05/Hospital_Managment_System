// Rainbow Children's Hospital doctor pages (D-56), Hyderabad only, from its doctor profile
// sitemap. The page has a Physician JSON-LD block (photo, areas of care) and, under the name,
// the title, qualifications, years of experience, languages and branches.
import { get, locs, lines, jsonLd, httpsOnly, splitQualifications } from '../lib/web.js';

export const id = 'rainbow';
export const hospital = "Rainbow Children's Hospital";
export const sourcePlatform = 'Rainbow Hospitals website';
export const photoHosts = ['rainbowhospitalsproduction.s3.ap-south-1.amazonaws.com'];
// Branch names as Rainbow writes them, mapped by address to OpenStreetMap buildings.
export const branches = {
  'Banjara Hills': 'osm:way/860550549',
  Kondapur: 'osm:node/8748429666',
  Secunderabad: 'osm:node/6479951769',
  Hydernagar: 'osm:node/6504110557',
  'LB Nagar': 'osm:node/4625163789',
};

// Rainbow's URLs name the branch: /all/doctor/hyderabad/{branch}/{hospital}/{doctor}.
const SLUGS = { 'banjara-hills-road': 'Banjara Hills', 'banjara-hills': 'Banjara Hills', kondapur: 'Kondapur', secunderabad: 'Secunderabad', hydernagar: 'Hydernagar', 'lb-nagar': 'LB Nagar' };

/** Branch from the listed branch names ("Kondapur OP" counts as Kondapur), else from the URL. */
export function fallbackBranch(d) {
  for (const piece of (d.branchText || '').split('/').map((x) => x.trim().toLowerCase())) {
    const k = Object.keys(branches).find((b) => piece === b.toLowerCase() || piece.startsWith(`${b.toLowerCase()} op`));
    if (k) return k;
  }
  const slug = new URL(d.profileUrl).pathname.split('/')[4];
  return SLUGS[slug] ?? null;
}

export function toRecord(html, url, checkedAt) {
  const ld = jsonLd(html).find((x) => x['@type'] === 'Physician');
  const ls = lines(html);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!h1 || !/^Dr\.?\s/i.test(h1)) return null;
  // The name appears twice in a row (breadcrumb, then heading); details follow the second.
  let i = ls.lastIndexOf(h1, ls.indexOf('Book an appointment'));
  if (i === -1) i = ls.indexOf(h1);
  const after = ls.slice(i + 1, i + 30);
  const years = after.findIndex((l) => /^\d{1,2}\+?\s*Years?$/i.test(l));
  const book = after.indexOf('Book an appointment');
  const title = after[0] || '';
  const quals = years > 1 ? after.slice(1, years).join(', ') : '';
  const langs = years !== -1 ? after[years + 1] || '' : '';
  const branchList = years !== -1 && book > years ? after.slice(years + 2, book).filter((l) => l !== ',') : [];
  return {
    sourceRef: `rainbow:${new URL(url).pathname}`,
    name: h1.slice(0, 200),
    title: title.replace(/ - Rainbow Children'?s Hospital$/i, '').slice(0, 160),
    specialization: (Array.isArray(ld?.knowsAbout) && ld.knowsAbout[0]) || 'Paediatrics',
    qualifications: splitQualifications(quals),
    experienceYears: years !== -1 ? Math.min(Number(/\d+/.exec(after[years])[0]), 70) : null,
    languages: langs.split(/,\s*/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+$/.test(x)),
    expertise: Array.isArray(ld?.knowsAbout) ? ld.knowsAbout.slice(0, 12) : [],
    branch: branchList.map((b) => Object.keys(branches).find((k) => k.toLowerCase() === b.toLowerCase())).find(Boolean) ?? null,
    branchText: branchList.join(' / '),
    photoUrl: httpsOnly(ld?.image),
    profileUrl: url,
    bookingUrl: url,
    appointmentPhone: null,
    timings: '',
    consultationFeeInr: null,
    checkedAt,
  };
}

export async function urls() {
  return locs(await get('https://www.rainbowhospitals.in/doctor-profile-sitemap.xml')).filter((u) => /\/doctor\/hyderabad\//i.test(u));
}
