// Loads .cache/osm.json and .cache/care-doctors.json into a database. Rows are matched on
// source_ref, so running it again updates rows instead of adding copies, and rows a source no
// longer lists are hidden (active = false), not deleted, so reviews keep their target.
// Connects with DATABASE_URL (careroute-dev), or with --prod to PROD_IMPORT_DATABASE_URL (P-31).
// Run: node --env-file=.env.local scripts/load-listings.js [--prod] [--drop-samples]
//   --drop-samples  deletes the synthetic sample listings (rows with no source_ref) and their reviews.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseLines } from './collect-care-doctors.js';

const CARE_NAME = /^(guru ?nanak )?care hospitals?\b/i;
// CARE writes some localities differently from OpenStreetMap.
const ALIASES = { 'hitec city': ['hitec city', 'hi tech city', 'hi-tech city', 'hitech city'] };
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Maps a CARE location such as "CARE Hospitals, Banjara Hills, Hyderabad" to an OSM hospital ref. */
export function careBranchMatcher(osm) {
  const branches = osm.hospitals.filter((h) => CARE_NAME.test(h.name));
  return (location) => {
    const parts = location.split(',').map((s) => s.trim()).filter((s) => !/^hyderabad$/i.test(s));
    const locality = norm(parts.at(-1) || '');
    const names = ALIASES[locality] || [locality];
    // Only an explicit locality match counts. A nearest-branch guess once put Malakpet doctors at Nampally.
    const byText = branches.find((b) => names.some((n) => norm(`${b.name} ${b.address} ${b.area}`).includes(n)));
    return byText ? byText.sourceRef : null;
  };
}

const point = (sql, x) => sql`extensions.st_setsrid(extensions.st_makepoint(${x.lng}, ${x.lat}), 4326)::extensions.geography`;

async function upsertPlaces(sql, table, rows, extra) {
  for (const r of rows) {
    const cols = {
      source_ref: r.sourceRef, name: r.name, area: r.area, address: r.address, phone: r.phone, email: r.email, website: r.website,
      source_platform: r.sourcePlatform, source_url: r.sourceUrl, checked_at: r.checkedAt, active: true, ...extra(r),
    };
    await sql`
      insert into ${sql(table)} ${sql(cols)}
      on conflict (source_ref) do update set ${sql(cols, Object.keys(cols).filter((c) => c !== 'source_ref'))}, updated_at = now()`;
    await sql`update ${sql(table)} set location = ${point(sql, r)} where source_ref = ${r.sourceRef}`;
  }
  const refs = rows.map((r) => r.sourceRef);
  const hidden = await sql`update ${sql(table)} set active = false, updated_at = now()
    where source_platform = 'OpenStreetMap' and active and not (source_ref = any(${refs}))`;
  return hidden.count;
}

async function main() {
  const prod = process.argv.includes('--prod');
  const url = prod ? process.env.PROD_IMPORT_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error(prod ? 'Set PROD_IMPORT_DATABASE_URL in .env.local (P-31)' : 'Set DATABASE_URL in .env.local');
  const dropSamples = process.argv.includes('--drop-samples');
  const osm = JSON.parse(await readFile('.cache/osm.json', 'utf8'));
  let care = { pages: {} };
  try { care = JSON.parse(await readFile('.cache/care-doctors.json', 'utf8')); } catch (err) { if (err.code !== 'ENOENT') throw err; }

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  console.log(`loading into ${new URL(url).username.split('.').at(-1)}`);
  try {
    await sql.begin(async (tx) => {
      // Inserting a row without a location would break the not-null rule, so start from a valid point.
      const withPoint = (r) => ({ location: tx`extensions.st_setsrid(extensions.st_makepoint(${r.lng}, ${r.lat}), 4326)::extensions.geography` });
      if (dropSamples) {
        await tx`delete from public.reviews where listing_id in (
          select id from public.hospitals where source_ref is null union all select id from public.doctors where source_ref is null
          union all select id from public.pharmacies where source_ref is null union all select id from public.diagnostic_centres where source_ref is null)`;
        const d = await tx`delete from public.doctors where source_ref is null`;
        const h = await tx`delete from public.hospitals where source_ref is null`;
        const p = await tx`delete from public.pharmacies where source_ref is null`;
        const c = await tx`delete from public.diagnostic_centres where source_ref is null`;
        console.log(`samples removed: ${h.count} hospitals, ${d.count} doctors, ${p.count} pharmacies, ${c.count} diagnostic centres`);
      }
      const hh = await upsertPlaces(tx, 'hospitals', osm.hospitals, (r) => ({ ...withPoint(r), description: r.description, emergency_available: r.emergencyAvailable, specialities: r.specialities }));
      const ph = await upsertPlaces(tx, 'pharmacies', osm.pharmacies, (r) => ({ ...withPoint(r), hours: r.hours, open_24: r.open24 }));
      const dh = await upsertPlaces(tx, 'diagnostic_centres', osm.diagnostics, (r) => ({ ...withPoint(r), hours: r.hours, description: r.description, tests_listed: r.testsListed }));
      console.log(`OpenStreetMap: ${osm.hospitals.length} hospitals, ${osm.pharmacies.length} pharmacies, ${osm.diagnostics.length} diagnostic centres (${hh + ph + dh} no longer listed, hidden)`);

      const branch = careBranchMatcher(osm);
      const ids = new Map((await tx`select id, source_ref from public.hospitals where source_ref is not null`).map((r) => [r.source_ref, r.id]));
      const doctors = Object.entries(care.pages || {}).map(([url, p]) => ({ ...parseLines(p.lines, url), checkedAt: p.checkedAt })).filter((d) => d.name);
      const unplaced = [];
      const refs = [];
      for (const d of doctors) {
        const hospitalRef = d.locations.map(branch).find(Boolean);
        if (!hospitalRef) { unplaced.push(d.locations.join(' / ') || 'no location'); continue; }
        const cols = {
          source_ref: d.sourceRef, name: d.name, title: d.title, specialization: d.specialization, qualifications: d.qualifications,
          experience_years: d.experienceYears !== null && d.experienceYears <= 70 ? d.experienceYears : null,
          hospital_id: ids.get(hospitalRef), appointment_phone: d.appointmentPhone, profile_url: d.profileUrl, published_timings: '',
          source_platform: 'CARE Hospitals website', source_url: d.profileUrl, checked_at: d.checkedAt, active: true,
        };
        await tx`insert into public.doctors ${tx(cols)}
          on conflict (source_ref) do update set ${tx(cols, Object.keys(cols).filter((c) => c !== 'source_ref'))}, updated_at = now()`;
        refs.push(d.sourceRef);
      }
      await tx`update public.doctors set active = false, updated_at = now()
        where source_platform = 'CARE Hospitals website' and active and not (source_ref = any(${refs}))`;
      console.log(`CARE doctors: ${refs.length} loaded, ${unplaced.length} without a matching hospital`);
      const counts = {};
      for (const u of unplaced) counts[u] = (counts[u] || 0) + 1;
      for (const [loc, n] of Object.entries(counts)) console.log(`  not placed (${n}): ${loc}`);
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
