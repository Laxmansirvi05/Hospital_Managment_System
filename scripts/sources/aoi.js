// American Oncology Institute, Hyderabad (D-56). Its Hyderabad doctors page is drawn on the
// server with one block per doctor: photo, name, speciality, timings and a profile link.
// robots.txt (checked 2026-10-27) allows it and blocks only query-string pages such as ?dr=.
// One request collects every doctor, so the profile pages are not fetched.
import { get, decode, httpsOnly } from '../lib/web.js';

export const id = 'aoi';
export const hospital = 'American Oncology Institute';
export const sourcePlatform = 'American Oncology Institute website';
export const photoHosts = ['www.americanoncology.com'];
export const branches = { 'American Oncology Institute, Hyderabad': 'osm:node/6536715096' };
const SITE = 'https://www.americanoncology.com';
const text = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** One record per doctor block on the Hyderabad list page. */
export function toRecords(html, checkedAt) {
  const out = [];
  for (const block of html.split(/<div class="row gx-0\s+redBtmDashed/).slice(1)) {
    const name = text((/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block) || [])[1]);
    const slug = (/href="\/dr-profile\/([a-z0-9-]+)"/i.exec(block) || [])[1];
    // The page also holds an empty client-side template whose name is a placeholder.
    if (!slug || !/^Dr\.?\s+[A-Z]/.test(name)) continue;
    const speciality = text((/<h3[\s\S]*?<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(block) || [])[1]) || 'Oncology';
    const timings = text((/Available Timings([\s\S]*?)Book an Appointment/i.exec(block) || [])[1]).replace(/^-->\s*/, '');
    const img = /<img[^>]+class="profileimg"[^>]+src="(\/static\/uploads\/[^"]+\.(?:jpe?g|png|webp))"/i.exec(block);
    const profile = `${SITE}/dr-profile/${slug}`;
    out.push({
      sourceRef: `aoi:${slug}`,
      name: name.slice(0, 200),
      // The list shows one line under the name; the biography is not used, since it names past employers too.
      title: speciality.slice(0, 160),
      specialization: speciality.replace(/^(?:Senior |Sr\.? )?Consultant\s*[-\u2013:]?\s*/i, '').slice(0, 120) || 'Oncology',
      qualifications: [],
      experienceYears: null,
      languages: [],
      expertise: [],
      branch: 'American Oncology Institute, Hyderabad',
      branchText: 'Hyderabad',
      photoUrl: img ? httpsOnly(`${SITE}${img[1]}`) : null,
      profileUrl: profile,
      // The profile page has AOI's own appointment form.
      bookingUrl: profile,
      appointmentPhone: null,
      timings: timings.slice(0, 300),
      consultationFeeInr: null,
      checkedAt,
    });
  }
  return out;
}

export async function collectAll({ cache, save, log, checkedAt }) {
  const records = toRecords(await get(`${SITE}/our-doctors/hyderabad`), checkedAt);
  log(`${records.length} doctors on the Hyderabad page`);
  for (const r of records) cache.records[r.sourceRef] = r;
  await save();
}
