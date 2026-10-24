// API behaviour through the real router, against the in-memory store and storage (fakes).
// The Postgres store is checked separately against careroute-dev; see CHANGELOG.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApp, cookieHeader } from './helpers.js';
import { TABLE } from '../server/router.js';

let app;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await app.close(); });

describe('auth', () => {
  it('registers a patient, returns 201 with token and sets httpOnly cookies', async () => {
    const r = await app.api('/auth/register', { body: { name: 'Asha', email: 'Asha@Test.example', phone: '98765 43210', password: 'long enough' } });
    expect(r.status).toBe(201);
    expect(r.body.user).toEqual({ id: expect.any(String), role: 'patient', name: 'Asha' });
    const cookies = r.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('cr_access=') && c.includes('HttpOnly') && c.includes('SameSite=Lax'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('cr_refresh=') && c.includes('Path=/api/v1/auth'))).toBe(true);
    const me = await app.api('/auth/me', { token: r.body.token });
    expect(me.body).toMatchObject({ email: 'asha@test.example', phone: '+919876543210', role: 'patient' });
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('returns 409 for a repeated email and 422 naming the bad field', async () => {
    const body = { name: 'Dup', email: 'dup@test.example', phone: '9876500001', password: 'long enough' };
    expect((await app.api('/auth/register', { body })).status).toBe(201);
    expect((await app.api('/auth/register', { body })).status).toBe(409);
    const bad = await app.api('/auth/register', { body: { ...body, email: 'nope', phone: '123' } });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields)).toEqual(expect.arrayContaining(['email', 'phone']));
  });

  it('refuses privileged sign-up when the flag is off (D-21)', async () => {
    const strict = await startApp({ allowPrivilegedSignup: false });
    const r = await strict.api('/auth/register', { body: { name: 'D', email: 'd@test.example', phone: '9876500002', password: 'long enough', role: 'driver' } });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('role_not_allowed');
    await strict.close();
    app.activate();
  });

  it('gives the same 401 for unknown email and wrong password', async () => {
    const u = await app.user();
    const a = await app.api('/auth/login', { body: { email: 'nobody@test.example', password: 'whatever1' } });
    const b = await app.api('/auth/login', { body: { email: u.email, password: 'wrong pass' } });
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.body.error).toEqual(b.body.error);
    expect((await app.api('/auth/login', { body: { email: u.email, password: 'correct horse' } })).status).toBe(200);
  });

  it('rotates the refresh token and revokes the session when an old one is reused', async () => {
    const u = await app.user();
    const first = cookieHeader(u.cookies);
    const r1 = await app.api('/auth/refresh', { method: 'POST', cookie: first, headers: { 'x-careroute-csrf': '1' } });
    expect(r1.status).toBe(200);
    const reuse = await app.api('/auth/refresh', { method: 'POST', cookie: first, headers: { 'x-careroute-csrf': '1' } });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('refresh_reused');
    // The whole session is gone, including the newest access token.
    expect((await app.api('/auth/me', { token: r1.body.token })).status).toBe(401);
  });

  it('logs out with 204 and the token stops working at once', async () => {
    const u = await app.user();
    expect((await app.api('/auth/logout', { method: 'POST', token: u.token })).status).toBe(204);
    expect((await app.api('/auth/me', { token: u.token })).status).toBe(401);
  });

  it('requires the CSRF header for cookie-authenticated writes (D-23)', async () => {
    const u = await app.user();
    const cookie = cookieHeader(u.cookies);
    const body = { name: 'Ravi', phone: '9876511111', relation: 'Brother' };
    expect((await app.api('/patients/me/contacts', { body, cookie })).status).toBe(403);
    expect((await app.api('/patients/me/contacts', { body, cookie, headers: { 'x-careroute-csrf': '1' } })).status).toBe(201);
    expect((await app.api('/patients/me/contacts', { body, cookie, headers: { 'x-careroute-csrf': '1', origin: 'https://evil.example' } })).status).toBe(403);
  });
});

describe('every protected route', () => {
  it('returns 401 without a token', async () => {
    const protectedRoutes = TABLE.filter((r) => r.roles !== 'public');
    for (const r of protectedRoutes) {
      const path = r.path.replace(/:id/g, '00000000-0000-4000-8000-000000000000');
      const res = await app.api(path, { method: r.method, body: r.method === 'GET' || r.method === 'DELETE' ? undefined : {} });
      expect(res.status, `${r.method} ${r.path}`).toBe(401);
    }
  });
  it('returns 403 to a driver on patient routes', async () => {
    const d = await app.user('driver');
    for (const r of TABLE.filter((x) => Array.isArray(x.roles) && !x.roles.includes('driver'))) {
      const path = r.path.replace(/:id/g, '00000000-0000-4000-8000-000000000000');
      const res = await app.api(path, { method: r.method, token: d.token, body: r.method === 'GET' || r.method === 'DELETE' ? undefined : {} });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
    }
  });
});

describe('medical ID (D-39)', () => {
  it('saves partial updates and keeps other fields, and accepts the collection shape', async () => {
    const u = await app.user();
    const a = await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { bloodGroup: 'B+', allergies: ['Penicillin'], medicalNotes: 'Diabetic', shareWithCrew: true } });
    expect(a.status).toBe(200);
    expect(a.body.bloodGroup).toBe('B+');
    const b = await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { dateOfBirth: '1985-03-12', address: { line1: '12 MG Road', pinCode: '500016' }, heightCm: 172, weightKg: 70.5 } });
    expect(b.body).toMatchObject({ bloodGroup: 'B+', allergies: ['Penicillin'], heightCm: 172, address: { line1: '12 MG Road', city: 'Hyderabad' } });
    expect(b.body.age).toBeGreaterThan(30);
    expect(b.body.completeness).toBeGreaterThan(0);
  });
  it('rejects unknown fields, a future birth date and a bad pin code', async () => {
    const u = await app.user();
    const r = await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { dateOfBirth: '2999-01-01', address: { pinCode: '12' }, role: 'admin' } });
    expect(r.status).toBe(422);
  });
});

describe('ownership', () => {
  it('stops one patient changing another patient’s data (404, no leak)', async () => {
    const a = await app.user();
    const b = await app.user();
    const c = await app.api('/patients/me/contacts', { token: a.token, body: { name: 'K', phone: '9876522222', relation: 'Friend' } });
    const r = await app.api('/patients/me/reminders', { token: a.token, body: { medicineName: 'Metformin 500 mg', dose: '1 tablet', times: ['08:00'], startDate: '2026-10-01' } });
    const ap = await app.api('/patients/me/appointments', { token: a.token, body: { doctorName: 'Dr. Rao', place: 'Lakeview', date: '2026-11-02', time: '10:30' } });
    expect((await app.api(`/patients/me/contacts/${c.body.id}`, { method: 'DELETE', token: b.token })).status).toBe(404);
    expect((await app.api(`/patients/me/reminders/${r.body.id}`, { method: 'PATCH', token: b.token, body: { dose: '2 tablets' } })).status).toBe(404);
    expect((await app.api(`/patients/me/appointments/${ap.body.id}`, { method: 'DELETE', token: b.token })).status).toBe(404);
    expect((await app.api('/patients/me/reminders', { token: b.token })).body.reminders).toEqual([]);
  });
});

describe('reminders (D-38)', () => {
  it('lists today’s doses and records taken or skipped', async () => {
    const u = await app.user();
    const r = await app.api('/patients/me/reminders', { token: u.token, body: { medicineName: 'Atorvastatin 10 mg', dose: '1 tablet', instructions: 'After dinner', times: ['21:00', '09:00'], startDate: '2026-10-01' } });
    expect(r.status).toBe(201);
    expect(r.body.times).toEqual(['09:00', '21:00']);
    const today = await app.api('/patients/me/reminders/today?date=2026-10-25', { token: u.token });
    expect(today.body.doses.map((d) => [d.time, d.status])).toEqual([['09:00', 'due'], ['21:00', 'due']]);
    expect((await app.api(`/patients/me/reminders/${r.body.id}/doses`, { token: u.token, body: { date: '2026-10-25', time: '09:00', status: 'taken' } })).status).toBe(200);
    expect((await app.api(`/patients/me/reminders/${r.body.id}/doses`, { token: u.token, body: { date: '2026-10-25', time: '10:00', status: 'taken' } })).status).toBe(422);
    const after = await app.api('/patients/me/dashboard?date=2026-10-25', { token: u.token });
    expect(after.body.today).toMatchObject({ taken: 1, total: 2 });
  });
  it('rejects an end date before the start date', async () => {
    const u = await app.user();
    const r = await app.api('/patients/me/reminders', { token: u.token, body: { medicineName: 'X', dose: '1', times: ['08:00'], startDate: '2026-10-10', endDate: '2026-10-01' } });
    expect(r.status).toBe(422);
    expect(r.body.error.fields.endDate).toBeDefined();
  });
});

describe('appointment log (D-37)', () => {
  it('shows upcoming appointments on the dashboard, soonest first', async () => {
    const u = await app.user();
    await app.api('/patients/me/appointments', { token: u.token, body: { doctorName: 'Dr. B', place: 'Clinic', date: '2026-11-10', time: '09:00' } });
    await app.api('/patients/me/appointments', { token: u.token, body: { doctorName: 'Dr. A', place: 'Lakeview', date: '2026-10-28', time: '11:00' } });
    await app.api('/patients/me/appointments', { token: u.token, body: { doctorName: 'Dr. Old', place: 'X', date: '2026-10-01', time: '11:00' } });
    const d = await app.api('/patients/me/dashboard?date=2026-10-25', { token: u.token });
    expect(d.body.appointments.map((a) => a.doctorName)).toEqual(['Dr. A', 'Dr. B']);
  });
});

describe('documents and photo (memory storage)', () => {
  it('uploads a PDF, verifies its bytes, lists it and deletes it', async () => {
    const u = await app.user();
    const bytes = Buffer.from('%PDF-1.7 sample');
    const start = await app.api('/patients/me/reports', { token: u.token, body: { title: 'Blood test', kind: 'lab', fileName: 'cbc.pdf', contentType: 'application/pdf', sizeBytes: bytes.length } });
    expect(start.status).toBe(201);
    expect((await app.api(start.body.uploadUrl, { method: 'PUT', raw: bytes, headers: { 'content-type': 'application/pdf' } })).status).toBe(200);
    const done = await app.api(`/patients/me/reports/${start.body.id}/complete`, { method: 'POST', token: u.token });
    expect(done.status).toBe(200);
    expect((await app.api('/patients/me/reports', { token: u.token })).body.reports).toHaveLength(1);
    const dl = await app.api(`/patients/me/reports/${start.body.id}/download`, { token: u.token });
    const file = await app.api(dl.body.url);
    expect(file.headers.get('content-security-policy')).toContain('sandbox');
    expect((await app.api(`/patients/me/reports/${start.body.id}`, { method: 'DELETE', token: u.token })).status).toBe(204);
  });
  it('rejects a file whose bytes do not match its declared type', async () => {
    const u = await app.user();
    const bytes = Buffer.from('<script>alert(1)</script>');
    const start = await app.api('/patients/me/reports', { token: u.token, body: { title: 'Fake', kind: 'other', fileName: 'x.pdf', contentType: 'application/pdf', sizeBytes: bytes.length } });
    await app.api(start.body.uploadUrl, { method: 'PUT', raw: bytes, headers: { 'content-type': 'application/pdf' } });
    const done = await app.api(`/patients/me/reports/${start.body.id}/complete`, { method: 'POST', token: u.token });
    expect(done.status).toBe(422);
    expect((await app.api('/patients/me/reports', { token: u.token })).body.reports).toHaveLength(0);
  });
  it('refuses a photo that is too large or not an image', async () => {
    const u = await app.user();
    expect((await app.api('/patients/me/photo', { token: u.token, body: { contentType: 'application/pdf', sizeBytes: 10 } })).status).toBe(422);
    expect((await app.api('/patients/me/photo', { token: u.token, body: { contentType: 'image/png', sizeBytes: 3 * 1024 * 1024 } })).status).toBe(422);
  });
});

describe('discovery (D-36)', () => {
  it('searches hospitals nearest first and filters by emergency department', async () => {
    const u = await app.user();
    const r = await app.api('/hospitals?lat=17.4477&lng=78.4522&emergencyOnly=true', { token: u.token });
    expect(r.status).toBe(200);
    const d = r.body.hospitals.map((h) => h.distanceKm);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(r.body.hospitals.every((h) => h.emergencyAvailable)).toBe(true);
    expect(r.body.hospitals[0].source).toMatchObject({ platform: expect.any(String), checkedAt: expect.any(String) });
  });
  it('matches the collection: nearby needs a location and rejects latitude 200', async () => {
    const u = await app.user();
    const bad = await app.api('/hospitals/nearby?lat=200&lng=78.4', { token: u.token });
    expect(bad.status).toBe(422);
    expect(JSON.stringify(bad.body).toLowerCase()).toContain('location');
  });
  it('compares medicine prices cheapest first', async () => {
    const u = await app.user();
    const r = await app.api('/medicines?q=para', { token: u.token });
    const prices = r.body.medicines[0].listings.map((l) => l.priceInr);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
  it('finds diagnostic centres by test and pharmacies open 24 hours', async () => {
    const u = await app.user();
    const mri = await app.api('/diagnostic-centres?test=MRI', { token: u.token });
    expect(mri.body.diagnosticCentres.every((c) => c.testsListed.includes('MRI'))).toBe(true);
    const p = await app.api('/pharmacies?open24=true', { token: u.token });
    expect(p.body.pharmacies.length).toBeGreaterThan(0);
    expect(p.body.pharmacies.every((x) => x.open24)).toBe(true);
  });
  it('returns 404 for an unknown or malformed id', async () => {
    const u = await app.user();
    expect((await app.api('/hospitals/not-a-uuid', { token: u.token })).status).toBe(404);
    expect((await app.api('/hospitals/00000000-0000-4000-8000-000000000000', { token: u.token })).status).toBe(404);
  });
});

describe('rate limits (D-25)', () => {
  it('limits failed logins per account with 429 and Retry-After', async () => {
    const u = await app.user();
    let last;
    for (let i = 0; i < 11; i++) last = await app.api('/auth/login', { body: { email: u.email, password: 'wrong pass' } });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});

describe('security review fixes (2026-10-25)', () => {
  it('revokes the session when a token two rotations old is presented (D-22, M3)', async () => {
    const u = await app.user();
    const t1 = cookieHeader(u.cookies);
    const r2 = await app.api('/auth/refresh', { method: 'POST', cookie: t1, headers: { 'x-careroute-csrf': '1' } });
    const t2 = cookieHeader(r2.headers.getSetCookie());
    const r3 = await app.api('/auth/refresh', { method: 'POST', cookie: t2, headers: { 'x-careroute-csrf': '1' } });
    expect(r3.status).toBe(200);
    const old = await app.api('/auth/refresh', { method: 'POST', cookie: t1, headers: { 'x-careroute-csrf': '1' } });
    expect(old.status).toBe(401);
    expect(old.body.error.code).toBe('refresh_reused');
    expect((await app.api('/auth/me', { token: r3.body.token })).status).toBe(401);
  });

  it('answers 401, not 500, for a malformed refresh cookie (L1)', async () => {
    const r = await app.api('/auth/refresh', { method: 'POST', cookie: 'cr_refresh=not-a-uuid.abc', headers: { 'x-careroute-csrf': '1' } });
    expect(r.status).toBe(401);
  });

  it('rejects impossible dates such as 30 February (L1)', async () => {
    const u = await app.user();
    const r = await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { dateOfBirth: '1985-02-30' } });
    expect(r.status).toBe(422);
  });

  it('rejects a body over 64 KB before parsing (M5)', async () => {
    const u = await app.user();
    const r = await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { medicalNotes: 'x'.repeat(70 * 1024) } });
    expect(r.status).toBe(413);
  });

  it('caps unfinished uploads per account (M2)', async () => {
    const u = await app.user();
    const body = { title: 'Lab', kind: 'lab', fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 100 };
    for (let i = 0; i < 3; i++) expect((await app.api('/patients/me/reports', { token: u.token, body })).status).toBe(201);
    const fourth = await app.api('/patients/me/reports', { token: u.token, body });
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe('too_many_uploads');
  });

  it('stops another patient opening, completing or deleting a document (H10)', async () => {
    const a = await app.user();
    const b = await app.user();
    const bytes = Buffer.from('%PDF-1.7 x');
    const start = await app.api('/patients/me/reports', { token: a.token, body: { title: 'Mine', kind: 'lab', fileName: 'm.pdf', contentType: 'application/pdf', sizeBytes: bytes.length } });
    await app.api(start.body.uploadUrl, { method: 'PUT', raw: bytes, headers: { 'content-type': 'application/pdf' } });
    expect((await app.api(`/patients/me/reports/${start.body.id}/complete`, { method: 'POST', token: b.token })).status).toBe(404);
    await app.api(`/patients/me/reports/${start.body.id}/complete`, { method: 'POST', token: a.token });
    expect((await app.api(`/patients/me/reports/${start.body.id}/download`, { token: b.token })).status).toBe(404);
    expect((await app.api(`/patients/me/reports/${start.body.id}`, { method: 'DELETE', token: b.token })).status).toBe(404);
    expect((await app.api(`/patients/me/photo/${start.body.id}/complete`, { method: 'POST', token: a.token })).status).toBe(404);
  });

  it('rate limits discovery search per IP (M2)', async () => {
    const u = await app.user();
    let last;
    for (let i = 0; i < 121; i++) last = await app.api('/areas', { token: u.token, headers: { 'x-forwarded-for': '10.9.9.9' } });
    expect(last.status).toBe(429);
  });
});

describe('account settings (D-45)', () => {
  it('changes the password and ends the other sessions', async () => {
    const u = await app.user();
    const other = await app.api('/auth/login', { body: { email: u.email, password: 'correct horse' } });
    expect((await app.api('/auth/password', { token: u.token, body: { currentPassword: 'wrong one', newPassword: 'new horse 123' } })).status).toBe(401);
    expect((await app.api('/auth/password', { token: u.token, body: { currentPassword: 'correct horse', newPassword: 'new horse 123' } })).status).toBe(204);
    expect((await app.api('/auth/me', { token: other.body.token })).status).toBe(401);
    expect((await app.api('/auth/me', { token: u.token })).status).toBe(200);
    expect((await app.api('/auth/login', { body: { email: u.email, password: 'new horse 123' } })).status).toBe(200);
  });

  it('deletes the account and every piece of the patient’s data', async () => {
    const u = await app.user();
    await app.api('/patients/me/medical-id', { method: 'PUT', token: u.token, body: { bloodGroup: 'O+' } });
    await app.api('/patients/me/contacts', { token: u.token, body: { name: 'K', phone: '9876533333', relation: 'Friend' } });
    await app.api('/patients/me/reminders', { token: u.token, body: { medicineName: 'X', dose: '1', times: ['08:00'], startDate: '2026-10-01' } });
    await app.api('/reviews', { method: 'PUT', token: u.token, body: { kind: 'hospital', id: '0b9c1d2e-0000-4000-8000-000000000001', rating: 4, body: 'Clean and quick.' } });
    expect((await app.api('/patients/me/delete-account', { token: u.token, body: { password: 'correct horse', confirm: 'nope' } })).status).toBe(422);
    expect((await app.api('/patients/me/delete-account', { token: u.token, body: { password: 'wrong pass', confirm: 'DELETE' } })).status).toBe(401);
    const del = await app.api('/patients/me/delete-account', { token: u.token, body: { password: 'correct horse', confirm: 'DELETE' } });
    expect(del.status).toBe(204);
    expect((await app.api('/auth/me', { token: u.token })).status).toBe(401);
    expect((await app.api('/auth/login', { body: { email: u.email, password: 'correct horse' } })).status).toBe(401);
    expect(await app.store.profiles.get(u.id)).toBeNull();
    expect(await app.store.contacts.list(u.id)).toEqual([]);
    expect(await app.store.reminders.list(u.id)).toEqual([]);
    const other = await app.user();
    expect((await app.api('/reviews?kind=hospital&id=0b9c1d2e-0000-4000-8000-000000000001', { token: other.token })).body.reviews.some((r) => r.author.startsWith('patient'))).toBe(false);
  });
});

describe('reviews (D-43)', () => {
  const H = '0b9c1d2e-0000-4000-8000-000000000002';
  it('keeps one review per patient per listing, shows first names only, and averages', async () => {
    const a = await app.user();
    const b = await app.user();
    await app.api('/reviews', { method: 'PUT', token: a.token, body: { kind: 'hospital', id: H, rating: 5, body: 'Kind staff.' } });
    await app.api('/reviews', { method: 'PUT', token: a.token, body: { kind: 'hospital', id: H, rating: 3, body: 'Long wait this time.' } });
    await app.api('/reviews', { method: 'PUT', token: b.token, body: { kind: 'hospital', id: H, rating: 5 } });
    const r = await app.api(`/reviews?kind=hospital&id=${H}`, { token: a.token });
    expect(r.body.summary).toEqual({ average: 4, count: 2 });
    expect(r.body.reviews.filter((x) => x.mine)).toHaveLength(1);
    expect(r.body.reviews.every((x) => !x.author.includes(' '))).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('@test.example');
  });

  it('refuses unknown listings, bad ratings and deleting someone else’s review', async () => {
    const a = await app.user();
    const b = await app.user();
    expect((await app.api('/reviews', { method: 'PUT', token: a.token, body: { kind: 'hospital', id: '00000000-0000-4000-8000-000000000000', rating: 4 } })).status).toBe(422);
    expect((await app.api('/reviews', { method: 'PUT', token: a.token, body: { kind: 'hospital', id: H, rating: 6 } })).status).toBe(422);
    const mine = await app.api('/reviews', { method: 'PUT', token: a.token, body: { kind: 'pharmacy', id: '2d7e3f40-0000-4000-8000-000000000001', rating: 4 } });
    expect((await app.api(`/reviews/${mine.body.id}`, { method: 'DELETE', token: b.token })).status).toBe(404);
    expect((await app.api(`/reviews/${mine.body.id}`, { method: 'DELETE', token: a.token })).status).toBe(204);
  });

  it('hides a review after three different patients report it', async () => {
    const author = await app.user();
    const r = await app.api('/reviews', { method: 'PUT', token: author.token, body: { kind: 'doctor', id: '1c8d2e3f-0000-4000-8000-000000000001', rating: 1, body: 'Spam text' } });
    expect((await app.api(`/reviews/${r.body.id}/report`, { method: 'POST', token: author.token })).status).toBe(422);
    for (let i = 0; i < 3; i++) {
      const rep = await app.user();
      expect((await app.api(`/reviews/${r.body.id}/report`, { method: 'POST', token: rep.token })).status).toBe(204);
    }
    const list = await app.api('/reviews?kind=doctor&id=1c8d2e3f-0000-4000-8000-000000000001', { token: author.token });
    expect(list.body.reviews.some((x) => x.id === r.body.id)).toBe(false);
  });
});
