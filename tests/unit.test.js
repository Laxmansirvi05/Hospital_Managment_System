import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt, hashToken } from '../server/auth/crypto.js';
import { loadConfig } from '../server/config.js';
import { buildTable, TABLE } from '../server/router.js';
import { dosesFor } from '../server/db/geo.js';
import { sniffOk } from '../server/adapters/storage.js';
import { scrub } from '../server/log.js';
import { dropRewriteParam } from '../api/v1/[...path].js';
import { toListings } from '../scripts/collect-osm.js';
import { parseDoctor } from '../scripts/collect-care-doctors.js';
import { careBranchMatcher } from '../scripts/load-listings.js';

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

  it('sorts places into the three listing types and drops unnamed or plain clinics', () => {
    expect(data.hospitals.map((h) => h.name)).toEqual(['City Hospital', 'Far Hospital']);
    expect(data.pharmacies.map((p) => p.name)).toEqual(['Corner Pharmacy']);
    expect(data.diagnostics.map((d) => d.name)).toEqual(['Vijaya Diagnostic Centre']);
  });
  it('keeps a missing phone as null and the first of several numbers', () => {
    expect(data.hospitals[0].phone).toBeNull();
    expect(data.hospitals[1].phone).toBe('+91 40 1234 5678');
  });
  it('only accepts http and https websites', () => {
    expect(data.hospitals[0].website).toBe('https://www.city.example');
    expect(data.hospitals[1].website).toBeNull();
  });
  it('names the area from the nearest suburb, else the address tag, and never invents a street', () => {
    expect(data.hospitals[0].area).toBe('Banjara Hills');
    expect(data.hospitals[1].area).toBe('Uppal');
    expect(data.hospitals[0].address).toBe('Banjara Hills, Hyderabad (no street address listed)');
  });
  it('keeps the source, licence link target and a stable reference', () => {
    expect(data.hospitals[1]).toMatchObject({ sourceRef: 'osm:way/7', sourcePlatform: 'OpenStreetMap', sourceUrl: 'https://www.openstreetmap.org/way/7', checkedAt: '2026-10-25' });
    expect(data.hospitals[0]).toMatchObject({ emergencyAvailable: true, specialities: ['General', 'Paediatrics'] });
    expect(data.hospitals[1].emergencyAvailable).toBeNull();
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
  it('matches a branch only by its locality, never by distance', () => {
    const osm = { suburbs: [], hospitals: [
      { sourceRef: 'osm:node/1', name: 'Care Hospital', address: 'Road No.1, Banjara Hills', area: 'Masab Tank' },
      { sourceRef: 'osm:node/2', name: 'Care Hospitals', address: 'Hi Tech City Main Road', area: 'Khajaguda' },
      { sourceRef: 'osm:node/3', name: 'Medicare Hospital', address: 'Malakpet', area: 'Malakpet' },
    ] };
    const match = careBranchMatcher(osm);
    expect(match('CARE Hospitals, Banjara Hills, Hyderabad')).toBe('osm:node/1');
    expect(match('CARE Hospitals Outpatient Centre, HITEC City, Hyderabad')).toBe('osm:node/2');
    expect(match('CARE Hospitals, Malakpet, Hyderabad')).toBeNull();
  });
});
