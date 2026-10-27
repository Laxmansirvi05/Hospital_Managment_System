import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt, hashToken } from '../server/auth/crypto.js';
import { loadConfig } from '../server/config.js';
import { buildTable, TABLE } from '../server/router.js';
import { dosesFor } from '../server/db/geo.js';
import { sniffOk } from '../server/adapters/storage.js';
import { scrub } from '../server/log.js';
import { dropRewriteParam } from '../api/v1/[...path].js';
import { toListings, facilityType, chainOf } from '../scripts/collect-osm.js';
import { parseDoctor, branchOf, branches as careBranches } from '../scripts/sources/care.js';
import { timingsFrom } from '../scripts/sources/kims.js';
import { toRecord as gleneaglesRecord } from '../scripts/sources/gleneagles.js';
import { fallbackBranch as rainbowBranch } from '../scripts/sources/rainbow.js';
import { robotsRules, splitQualifications } from '../scripts/lib/web.js';
import { SOURCES } from '../scripts/collect-doctors.js';
import { readFileSync } from 'node:fs';
import { toMedicines, formOf } from '../scripts/collect-medicines.js';
import { hospitalView } from '../server/routes/discovery.js';
import { facilityFallbackIcon } from '../public/js/ui.js';
import { isDoctorName } from '../scripts/load-listings.js';
import { toRecord as lvpeiRecord } from '../scripts/sources/lvpei.js';
import { toRecord as asterRecord } from '../scripts/sources/aster.js';

describe('passwords (scrypt, D-24)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
  });
  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });
});

describe('tokens (HS256, D-22, D-24)', () => {
  const secret = 's'.repeat(40);
  it('round trips claims', () => {
    const t = signJwt({ sub: 'u1', role: 'patient' }, secret, 60);
    const r = verifyJwt(t, secret);
    expect(r.ok && r.claims.sub).toBe('u1');
  });
  it('reports expiry separately', () => {
    const t = signJwt({ sub: 'u1' }, secret, 60, Date.now() - 120000);
    expect(verifyJwt(t, secret)).toEqual({ ok: false, reason: 'expired' });
  });
  it('rejects alg none and a tampered body', () => {
    const t = signJwt({ sub: 'u1', role: 'patient' }, secret, 60);
    const [, body, sig] = t.split('.');
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(verifyJwt(`${none}.${body}.`, secret).ok).toBe(false);
    const forged = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: 9e9 })).toString('base64url');
    expect(verifyJwt(`${t.split('.')[0]}.${forged}.${sig}`, secret).ok).toBe(false);
    expect(verifyJwt(t, 'other'.repeat(10)).ok).toBe(false);
  });
  it('hashes tokens with the pepper', () => {
    expect(hashToken('a', 'p1')).not.toBe(hashToken('a', 'p2'));
  });
});

describe('config', () => {
  it('refuses to start in production without required values, naming only the variables', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL, JWT_SECRET, TRACKING_TOKEN_PEPPER/);
  });
  it('refuses privileged sign-up in production (D-21)', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', JWT_SECRET: 'a'.repeat(40), TRACKING_TOKEN_PEPPER: 'b'.repeat(40), ALLOW_PRIVILEGED_SIGNUP: 'true' })).toThrow(/ALLOW_PRIVILEGED_SIGNUP/);
  });
  it('treats .env.example placeholders as unset and falls back to memory outside production (P-27)', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'replace-with-at-least-32-random-characters', SUPABASE_SERVICE_ROLE_KEY: 'replace-me' });
    expect(c.store).toBe('memory');
    expect(c.storage).toBeNull();
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it('never exposes a non-public value through publicValues', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'a'.repeat(40), PUBLIC_MAPTILER_KEY: 'pk_test_abcdef' });
    expect(Object.keys(c.publicValues)).toEqual(['maptilerKey']);
  });
});

describe('router table', () => {
  it('refuses a route without roles', () => {
    expect(() => buildTable([{ method: 'GET', path: '/x', handler: async () => ({}) }])).toThrow(/must declare roles/);
  });
  it('orders static paths before parameter paths', () => {
    const t = buildTable([
      { method: 'GET', path: '/emergencies/:id', roles: ['patient'], handler: async () => ({}) },
      { method: 'GET', path: '/emergencies/mine', roles: ['patient'], handler: async () => ({}) },
    ]);
    expect(t[0].path).toBe('/emergencies/mine');
  });
  it('has the reminders/today route ahead of reminders/:id', () => {
    const iToday = TABLE.findIndex((r) => r.path === '/patients/me/reminders/today');
    const iId = TABLE.findIndex((r) => r.path === '/patients/me/reminders/:id' && r.method === 'PATCH');
    expect(iToday).toBeLessThan(iId);
  });
});

describe('reminder schedule', () => {
  const r = { id: 'r1', active: true, medicineName: 'M', dose: '1 tablet', instructions: '', times: ['20:00', '08:00'], daysOfWeek: [1, 3, 5], startDate: '2026-10-01', endDate: '2026-10-31' };
  it('lists doses only on chosen days and inside the date range, sorted by time', () => {
    expect(dosesFor([r], [], '2026-10-26').map((d) => d.time)).toEqual(['08:00', '20:00']); // Monday
    expect(dosesFor([r], [], '2026-10-25')).toEqual([]); // Sunday
    expect(dosesFor([r], [], '2026-11-02')).toEqual([]); // after end
  });
  it('merges recorded status', () => {
    const d = dosesFor([r], [{ reminderId: 'r1', date: '2026-10-26', time: '08:00', status: 'taken' }], '2026-10-26');
    expect(d.map((x) => x.status)).toEqual(['taken', 'due']);
  });
});

describe('uploads and logs', () => {
  it('checks the real first bytes of a file', () => {
    expect(sniffOk('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
    expect(sniffOk('application/pdf', Buffer.from('<html>'))).toBe(false);
    expect(sniffOk('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]))).toBe(true);
    expect(sniffOk('text/html', Buffer.from('<html>'))).toBe(false);
  });
  it('redacts personal and medical keys from log fields', () => {
    const out = scrub({ route: '/x', email: 'a@b', phone: '+91', medicalNotes: 'x', nested: { lat: 1, password: 'p' } });
    expect(out).toEqual({ route: '/x', email: '[redacted]', phone: '[redacted]', medicalNotes: '[redacted]', nested: { lat: '[redacted]', password: '[redacted]' } });
  });
});

describe('client address (H3)', () => {
  it('ignores X-Forwarded-For unless the proxy is trusted', async () => {
    const { setConfigForTests } = await import('../server/config.js');
    const { clientIp } = await import('../server/limits.js');
    const req = { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } };
    setConfigForTests(loadConfig({ NODE_ENV: 'test', TRUST_PROXY: 'false' }));
    expect(clientIp(req)).toBe('127.0.0.1');
    setConfigForTests(loadConfig({ NODE_ENV: 'test', TRUST_PROXY: 'true' }));
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('refuses production without storage, or with plain http storage (M4)', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', JWT_SECRET: 'a'.repeat(40), TRACKING_TOKEN_PEPPER: 'b'.repeat(40) };
    expect(() => loadConfig(base)).toThrow(/SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => loadConfig({ ...base, SUPABASE_URL: 'http://x.example', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(30) })).toThrow(/https/);
    expect(loadConfig({ ...base, SUPABASE_URL: 'https://x.example', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(30) }).store).toBe('postgres');
  });
});

describe('Vercel environments (D-21)', () => {
  const real = { DATABASE_URL: 'postgres://u:p@h/db', JWT_SECRET: 'a'.repeat(40), TRACKING_TOKEN_PEPPER: 'b'.repeat(40), SUPABASE_URL: 'https://x.example', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(30) };
  it('allows privileged sign-up on a Vercel preview, where NODE_ENV is also production', () => {
    expect(loadConfig({ ...real, NODE_ENV: 'production', VERCEL_ENV: 'preview', ALLOW_PRIVILEGED_SIGNUP: 'true' }).allowPrivilegedSignup).toBe(true);
  });
  it('still refuses it on Vercel production', () => {
    expect(() => loadConfig({ ...real, NODE_ENV: 'production', VERCEL_ENV: 'production', ALLOW_PRIVILEGED_SIGNUP: 'true' })).toThrow(/D-21/);
  });
  it('requires real configuration on a preview, so it never falls back to memory', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toThrow(/DATABASE_URL/);
  });
});

describe('Vercel entry point', () => {
  it('drops the path param the rewrite adds and keeps the real query', () => {
    expect(dropRewriteParam('/api/v1/hospitals?q=care&path=hospitals')).toBe('/api/v1/hospitals?q=care');
    expect(dropRewriteParam('/api/v1/health?path=health')).toBe('/api/v1/health');
    expect(dropRewriteParam('/api/v1/areas')).toBe('/api/v1/areas');
    expect(dropRewriteParam('/api/v1/medicines?q=para')).toBe('/api/v1/medicines?q=para');
  });
});

describe('OpenStreetMap collection (D-50, D-51)', () => {
  const el = (id, tags, lat = 17.42, lon = 78.45) => ({ type: 'node', id, lat, lon, tags });
  const data = toListings([
    el(1, { place: 'suburb', name: 'Banjara Hills' }, 17.418, 78.44),
    el(2, { amenity: 'hospital', name: 'City Hospital', emergency: 'yes', website: 'www.city.example', 'healthcare:speciality': 'general;paediatrics' }),
    el(3, { amenity: 'pharmacy', name: 'Corner Pharmacy', opening_hours: '24/7' }),
    el(4, { amenity: 'clinic', name: 'Vijaya Diagnostic Centre' }),
    el(5, { amenity: 'clinic', name: 'Family Clinic' }),
    el(6, { amenity: 'hospital' }),
    { type: 'way', id: 7, center: { lat: 17.5, lon: 78.6 }, tags: { amenity: 'hospital', name: 'Far Hospital', phone: '+91 40 1234 5678; +91 98490 00000', website: 'javascript:alert(1)', 'addr:suburb': 'Uppal' } },
  ], '2026-10-25');

  it('sorts places into the three listing types, keeps clinics as clinics (D-59) and drops unnamed places', () => {
    expect(data.hospitals.map((h) => h.name)).toEqual(['City Hospital', 'Family Clinic', 'Far Hospital']);
    expect(data.hospitals.map((h) => h.facilityType)).toEqual(['hospital', 'clinic', 'hospital']);
    expect(data.pharmacies.map((p) => p.name)).toEqual(['Corner Pharmacy']);
    expect(data.diagnostics.map((d) => d.name)).toEqual(['Vijaya Diagnostic Centre']);
  });
  it('keeps a missing phone as null and the first of several numbers', () => {
    expect(data.hospitals[0].phone).toBeNull();
    expect(data.hospitals[2].phone).toBe('+91 40 1234 5678');
  });
  it('only accepts http and https websites', () => {
    expect(data.hospitals[0].website).toBe('https://www.city.example');
    expect(data.hospitals[2].website).toBeNull();
  });
  it('names the area from the nearest suburb, else the address tag, and never invents a street', () => {
    expect(data.hospitals[0].area).toBe('Banjara Hills');
    expect(data.hospitals[2].area).toBe('Uppal');
    expect(data.hospitals[0].address).toBe('Banjara Hills, Hyderabad (no street address listed)');
  });
  it('keeps the source, licence link target and a stable reference', () => {
    expect(data.hospitals[2]).toMatchObject({ sourceRef: 'osm:way/7', sourcePlatform: 'OpenStreetMap', sourceUrl: 'https://www.openstreetmap.org/way/7', checkedAt: '2026-10-25' });
    expect(data.hospitals[0]).toMatchObject({ emergencyAvailable: true, specialities: ['General', 'Paediatrics'] });
    expect(data.hospitals[2].emergencyAvailable).toBeNull();
    expect(data.pharmacies[0].open24).toBe(true);
  });
});

describe('CARE doctor pages (D-52, D-54)', () => {
  const page = (body) => `<html><head><script type="application/ld+json">{"@type":"Person","name":"Dr. Test Rao"}</script></head><body>${'<p>nav</p>'.repeat(45)}${body}</body></html>`;
  const url = 'https://www.carehospitals.com/doctor/hyderabad/banjara-hills/test-rao';
  it('reads only the published professional fields', () => {
    const d = parseDoctor(page('<h1>Dr. Test Rao</h1><p>Consultant Cardiologist</p><p>Speciality</p><p>Cardiology</p><p>Qualification</p><p>MBBS, MD, DM</p><p>Experience</p><p>12 Years</p><p>Location</p><p>CARE Hospitals, Banjara Hills, Hyderabad, CARE Hospitals Outpatient Centre, Banjara Hills, Hyderabad</p><p>+91-40-68106529</p>'), url);
    expect(d).toEqual({
      sourceRef: 'care:/doctor/hyderabad/banjara-hills/test-rao', name: 'Dr. Test Rao', title: 'Consultant Cardiologist', specialization: 'Cardiology',
      qualifications: ['MBBS', 'MD', 'DM'], experienceYears: 12,
      locations: ['CARE Hospitals, Banjara Hills, Hyderabad', 'CARE Hospitals Outpatient Centre, Banjara Hills, Hyderabad'],
      appointmentPhone: '+91 40 68106529', profileUrl: url,
    });
  });
  it('reads a doctor with no title, with no structured data on the page', () => {
    const html = `<html><body>${'<p>nav</p>'.repeat(45)}<h1>Dr. No Title</h1><p>Speciality</p><p>ENT</p><p>Qualification</p><p>MBBS, MS</p><p>Location</p><p>CARE Hospitals, Nampally, Hyderabad</p></body></html>`;
    expect(parseDoctor(html, url)).toMatchObject({ name: 'Dr. No Title', title: '', specialization: 'ENT', experienceYears: null, appointmentPhone: null, locations: ['CARE Hospitals, Nampally, Hyderabad'] });
  });
  it('returns null when the page has no doctor', () => {
    expect(parseDoctor('<html><body>Not found</body></html>', url)).toBeNull();
  });
  it('maps a branch only by its locality name, never by distance', () => {
    expect(careBranches[branchOf('CARE Hospitals, Banjara Hills, Hyderabad')]).toBe('osm:way/337928613');
    expect(branchOf('CARE Hospitals Outpatient Centre, HITEC City, Hyderabad')).toBe('HITEC City');
    expect(branchOf('CARE Hospitals, Malakpet, Hyderabad')).toBeNull();
  });
});

describe('collector helpers (P-29, D-56)', () => {
  it('honours robots.txt for every agent, longest rule winning', () => {
    const ok = robotsRules('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /doctors/\nAllow: /doctors/public/\nDisallow: /*?\n');
    expect(ok('/hospitals/')).toBe(true);
    expect(ok('/doctors/dr-a')).toBe(false);
    expect(ok('/doctors/public/dr-a')).toBe(true);
    expect(ok('/search?q=x')).toBe(false);
  });
  it('finds a Rainbow branch from its name list or its URL', () => {
    expect(rainbowBranch({ branchText: 'Kondapur OP', profileUrl: 'https://www.rainbowhospitals.in/all/doctor/hyderabad/x/y/z' })).toBe('Kondapur');
    expect(rainbowBranch({ branchText: '', profileUrl: 'https://www.rainbowhospitals.in/all/doctor/hyderabad/secunderabad/obstetrics-maternity-hospital/dr-a' })).toBe('Secunderabad');
    expect(rainbowBranch({ branchText: 'Financial District', profileUrl: 'https://www.rainbowhospitals.in/all/doctor/hyderabad/financial-district/h/dr-b' })).toBeNull();
  });
  it('splits qualifications only on commas outside brackets', () => {
    expect(splitQualifications('MBBS, MD (Medicine, AIIMS), DM')).toEqual(['MBBS', 'MD (Medicine, AIIMS)', 'DM']);
  });
  it('turns a KIMS timings table into one line', () => {
    const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    const html = `<table>${row(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}${row(['10:00am - 04:00pm', '10:00am - 04:00pm', '10:00am - 04:00pm', '10:00am - 04:00pm', '10:00am - 04:00pm', '09:00am - 01:00pm', 'Not Available'])}</table>`;
    expect(timingsFrom(html)).toBe('Monday to Friday, 10:00am to 04:00pm; Saturday, 09:00am to 01:00pm');
  });
  it('reads a Gleneagles doctor page, including the consultation fee', () => {
    const html = `<html><head><meta property="og:image" content="https://gleneagles-optimized-prod.s3.ap-south-1.amazonaws.com/x.png"></head><body><h1>Dr Test</h1><p>Dr Test</p><p>Senior Consultant</p><p>Speciality</p><p>Cardiology</p><p>Qualification</p><p>MD</p><p>DM</p><p>Experience</p><p>18 Years</p><p>Language Spoken</p><p>English</p><p>Telugu</p><p>Location</p><p>Hyderabad,Lakdi-Ka-Pul</p><p>Consultation Charges</p><p>800</p><p>×</p></body></html>`;
    const r = gleneaglesRecord(html, 'https://www.gleneagleshospitals.co.in/hyderabad/lakdi-ka-pul/doctors/dr-test', '2026-10-25');
    expect(r).toMatchObject({ name: 'Dr Test', title: 'Senior Consultant', specialization: 'Cardiology', qualifications: ['MD', 'DM'], experienceYears: 18, languages: ['English', 'Telugu'], branch: 'Lakdi-Ka-Pul', consultationFeeInr: 800 });
    expect(r.bookingUrl).toContain('book-an-appointment');
  });
});

describe('doctor photos (D-55)', () => {
  it('allows every source photo host in the production and local CSP, and nothing wider', () => {
    const csp = (text) => /img-src ([^;]+);/.exec(text)[1].split(' ');
    const prod = csp(readFileSync('vercel.json', 'utf8'));
    const local = csp(readFileSync('scripts/dev.js', 'utf8'));
    for (const host of SOURCES.flatMap((s) => s.photoHosts)) {
      expect(prod).toContain(`https://${host}`);
      expect(local).toContain(`https://${host}`);
    }
    expect(prod.some((h) => h === 'https:' || h === '*' || h === 'https://*')).toBe(false);
  });
});

describe('care place types and pharmacy chains (D-59)', () => {
  it('keeps no mobile or email for a single doctor practice (D-54)', () => {
    const [p] = toListings([{ type: 'node', id: 9, lat: 17.42, lon: 78.45, tags: { amenity: 'doctors', name: 'Dr Rao Clinic', 'contact:mobile': '+91 98480 00000', email: 'dr.rao@example.test' } }], '2026-10-25').hospitals;
    expect(p.phone).toBeNull();
    expect(p.email).toBeNull();
  });
  it('types places by tags first, then name', () => {
    expect(facilityType({ amenity: 'dentist', name: 'Smile Care' })).toBe('dental');
    expect(facilityType({ amenity: 'clinic', name: 'Vasan Eye Care' })).toBe('eye');
    expect(facilityType({ amenity: 'hospital', name: 'City Hospital' })).toBe('hospital');
    expect(facilityType({ amenity: 'clinic', name: 'Sri Homoeo Clinic' })).toBe('ayush');
    expect(facilityType({ amenity: 'doctors', name: 'Family Clinic' })).toBe('clinic');
  });
  it('names a pharmacy chain from the brand or name', () => {
    expect(chainOf({ name: 'Apollo Pharmacy Madhapur' })).toBe('Apollo Pharmacy');
    expect(chainOf({ brand: 'MedPlus', name: 'Store 42' })).toBe('MedPlus');
    expect(chainOf({ name: 'Ravi Medicals' })).toBeNull();
  });
});

describe('Jan Aushadhi medicines (D-53)', () => {
  it('keeps priced active products with a stable reference and reads the dosage form', () => {
    const m = toMedicines([
      { drugCode: 1, genericName: 'Paracetamol Tablets IP 500 mg', unitSize: "10's", mrp: 9.5, groupName: 'Analgesic', status: 1 },
      { drugCode: 2, genericName: 'Zero priced item', unitSize: '1', mrp: 0, groupName: 'X', status: 1 },
      { drugCode: 3, genericName: 'Withdrawn item', unitSize: '1', mrp: 5, groupName: 'X', status: 0 },
    ], '2026-10-25');
    expect(m).toEqual([{ sourceRef: 'janaushadhi:1', name: 'Paracetamol Tablets IP 500 mg', form: 'Tablet', pack: "10's", category: 'Analgesic', priceInr: 9.5, drugCode: 1, checkedAt: '2026-10-25' }]);
    expect(formOf('Ceftriaxone Injection IP 1 g')).toBe('Injection');
    expect(formOf('Amoxycillin Oral Suspension IP')).toBe('Syrup');
  });
});

describe('facility directory cards and views', () => {
  it('maps facility types to distinct healthcare fallback icons', () => {
    expect(facilityFallbackIcon('nursing_home')).toBe('home');
    expect(facilityFallbackIcon('clinic')).toBe('doctor');
    expect(facilityFallbackIcon('dental')).toBe('doctor');
    expect(facilityFallbackIcon('ayush')).toBe('doctor');
    expect(facilityFallbackIcon('eye')).toBe('eye');
    expect(facilityFallbackIcon('diagnostic')).toBe('flask');
    expect(facilityFallbackIcon('hospital')).toBe('hospital');
    expect(facilityFallbackIcon('maternity')).toBe('hospital');
    expect(facilityFallbackIcon(undefined)).toBe('hospital');
  });

  it('preserves genuine facility logo fields in hospitalView', () => {
    const raw = {
      id: 'h-1', name: 'Test Hospital', area: 'Begumpet', address: '123 Test St',
      lat: 17.44, lng: 78.45, phone: '+91 40 1234', email: null, website: null,
      rating: 4.5, ratingCount: 10, sourcePlatform: 'OSM', sourceUrl: null, checkedAt: '2026-10-25',
      facilityType: 'hospital', description: 'Desc', emergencyAvailable: true, specialities: ['Cardiology'], departments: [],
      logoUrl: 'https://example.com/logo.png',
    };
    const view = hospitalView(raw);
    expect(view.logoUrl).toBe('https://example.com/logo.png');
    expect(view.facilityType).toBe('hospital');
  });
});

describe('doctor names from hospital pages (2026-10-27)', () => {
  it('refuses page labels as names and keeps real names', () => {
    expect(isDoctorName('Dr Book appointment')).toBe(false);
    expect(isDoctorName('Dr. View Profile')).toBe(false);
    expect(isDoctorName('Dr')).toBe(false);
    expect(isDoctorName('Dr Rohit C Khanna')).toBe(true);
    expect(isDoctorName('Prof. Dr. Javed Ali')).toBe(true);
  });

  it('reads an LVPEI name from the heading, not the booking button before Designation', () => {
    const filler = Array.from({ length: 22 }, (_, i) => `<p>menu ${i}</p>`).join('');
    const html = `<html><head><meta property="og:title" content="Dr Rohit C Khanna - LVPEI"></head><body>${filler}
      <a>Book appointment</a><h1>Dr Rohit C Khanna</h1><a>Book appointment</a>
      <p>Designation</p><p>Consultant Ophthalmologist</p><p>Specialisation</p><p>Cataract</p>
      <p>Location</p><p>Kallam Anji Reddy Campus, Hyderabad</p></body></html>`;
    const r = lvpeiRecord(html, 'https://www.lvpei.org/team-members/dr-rohit-c-khanna/', '2026-10-27');
    expect(r.name).toBe('Dr Rohit C Khanna');
    expect(r.specialization).toBe('Cataract');
  });

  it('reads an Aster Prime Hyderabad profile and skips other branches', () => {
    const page = (hospital) => `<h1 class="title"><span>Dr. A Test Doctor </span></h1>
      <p>Dr. A Test Doctor</p><h2>Sr Consultant - Cardiology</h2><p>MD, DM (Cardiology)</p>
      <p>Speciality</p><p>Cardiology</p><p>Hospital</p><p>${hospital}</p><p>Languages</p><p>English, Hindi &amp; Telugu</p>
      <p>Call us</p><p>Overview</p><p>Dr. A Test Doctor has an overall experience of 21 years.</p>
      <p>Area of expertise</p><p>Coronary Interventions,</p><p>Awards</p>
      <img src="/sites/default/files/2024-08/test.jpg" alt="x">`;
    const url = 'https://www.asterhospitals.in/doctors/aster-prime-hyderabad/dr-a-test-doctor';
    const r = asterRecord(page('Aster Prime Hyderabad'), url, '2026-10-27');
    expect(r).toMatchObject({ name: 'Dr. A Test Doctor', specialization: 'Cardiology', experienceYears: 21, languages: ['English', 'Hindi', 'Telugu'], expertise: ['Coronary Interventions'], qualifications: ['MD', 'DM (Cardiology)'] });
    expect(r.photoUrl).toBe('https://www.asterhospitals.in/sites/default/files/2024-08/test.jpg');
    expect(asterRecord(page('Aster Medcity Kochi'), url, '2026-10-27')).toBeNull();
  });
});
