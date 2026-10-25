// KIMS Hospitals doctors (D-56) from the JSON API its own website uses. robots.txt allows
// everything (`Allow: /*`). The list gives name, designation, qualifications, photo and branch;
// each Hyderabad doctor's detail adds the published outpatient timings.
import { get, decode, httpsOnly, splitQualifications } from '../lib/web.js';

export const id = 'kims';
export const hospital = 'KIMS Hospitals';
export const sourcePlatform = 'KIMS Hospitals website';
export const photoHosts = ['assets.kimshospitals.com'];
const API = 'https://www.kimshospitals.com/api';
// KIMS branch ids in Hyderabad, mapped by address to OpenStreetMap buildings. Kompally (28) has
// no OSM entry yet, so its doctors are not placed.
const BRANCH_IDS = { 1: 'Secunderabad', 2: 'Kondapur', 11: 'Gachibowli', 15: 'Begumpet', 28: 'Kompally', 30: 'Arete HITEC City' };
export const branches = {
  Secunderabad: 'osm:way/274482470',
  Kondapur: 'osm:node/4679716389',
  Gachibowli: 'osm:node/7248877410',
  // KIMS-Sunshine Begumpet is the former Sunshine Hospital on Penderghast Road.
  Begumpet: 'osm:way/361655217',
  // KIMS Arete HITEC City is the former Arete Hospitals in Khajaguda.
  'Arete HITEC City': 'osm:node/13423743515',
};

/** "Monday ... Sunday" header row and a times row from the OP timings table, as one line. */
export function timingsFrom(html) {
  const cells = [...(html || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const start = cells.indexOf('Monday');
  if (start === -1 || cells.length < start + 14) return '';
  const times = cells.slice(start + 7, start + 14);
  const groups = [];
  days.forEach((d, i) => {
    const t = times[i];
    if (!t || /not available/i.test(t)) return;
    const last = groups.at(-1);
    if (last && last.t === t && last.end === i - 1) { last.end = i; } else groups.push({ start: i, end: i, t });
  });
  return groups.map((g) => `${g.start === g.end ? days[g.start] : `${days[g.start]} to ${days[g.end]}`}, ${g.t.replace(/\s*-\s*/g, ' to ')}`).join('; ');
}

export async function collectAll({ cache, save, log, checkedAt }) {
  const specs = await get(`${API}/specialities`, { json: true });
  const specName = new Map((specs.data || specs).map((s) => [s.id, s.name]));
  const all = [];
  for (let page = 1; page < 60; page++) {
    const r = await get(`${API}/doctors?per_page=100&page=${page}`, { json: true });
    all.push(...r.data);
    if (!r.data.length || page >= (r.meta?.last_page ?? r.last_page ?? page)) break;
  }
  const hyd = all.filter((d) => BRANCH_IDS[d.branch_id]);
  log(`${all.length} KIMS doctors, ${hyd.length} in Hyderabad branches`);
  for (const [n, d] of hyd.entries()) {
    const ref = `kims:${d.slug}`;
    if (cache.records[ref]) continue;
    let timings = '';
    try {
      timings = timingsFrom((await get(`${API}/doctors/${encodeURIComponent(d.slug)}`, { json: true })).data?.content);
    } catch (err) {
      log(`timings missing for ${d.slug}: ${err.message}`);
    }
    const profile = `https://www.kimshospitals.com/doctor-profile/${d.slug}/`;
    cache.records[ref] = {
      sourceRef: ref,
      name: d.name.replace(/\s+/g, ' ').trim().slice(0, 200),
      title: (d.designation || '').trim().slice(0, 160),
      specialization: specName.get(d.speciality_id) || (d.designation || '').replace(/^(Sr\.?|Senior|Chief|Head|Consultant|Associate|Junior)\s*/gi, '').trim() || 'General Medicine',
      qualifications: splitQualifications(d.qualifications),
      experienceYears: null,
      languages: [], expertise: [],
      branch: BRANCH_IDS[d.branch_id],
      branchText: `KIMS ${BRANCH_IDS[d.branch_id]}`,
      photoUrl: httpsOnly(d.avatar_url),
      profileUrl: profile,
      bookingUrl: d.book || d.appointment_booking ? profile : null,
      appointmentPhone: null,
      timings,
      consultationFeeInr: null,
      checkedAt,
    };
    if (n % 20 === 19) { await save(); log(`${n + 1} of ${hyd.length}`); }
  }
  await save();
}
