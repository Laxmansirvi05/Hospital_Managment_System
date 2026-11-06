// Admin API (D-83). Runs the real router against the in-memory store: no database, no provider.
// Postgres behaviour for the same methods is covered by admin-postgres.test.js with a recording fake.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './helpers.js';

let app; let admin; let admin2; let patient; let driver;
const as = (u) => ({ token: u.token });

beforeAll(async () => {
  app = await startApp();
  admin = await app.user('admin'); admin2 = await app.user('admin'); patient = await app.user('patient'); driver = await app.user('driver');
});
afterAll(() => app.close());

const HOSPITAL = { name: 'Test Care Hospital', area: 'Madhapur', address: '1 Test Road, Madhapur, Hyderabad 500081', lat: 17.44, lng: 78.39 };

describe('admin routes: who may call them', () => {
  const calls = [
    ['GET', '/admin/overview'], ['GET', '/admin/users'], ['POST', '/admin/users/00000000-0000-4000-8000-000000000001/disable'],
    ['POST', '/admin/users/00000000-0000-4000-8000-000000000001/enable'], ['GET', '/admin/listings'], ['GET', '/admin/hospital-choices'],
    ['GET', '/admin/listings/hospital/00000000-0000-4000-8000-000000000001'], ['POST', '/admin/listings/hospital'],
    ['PATCH', '/admin/listings/hospital/00000000-0000-4000-8000-000000000001'], ['POST', '/admin/listings/hospital/00000000-0000-4000-8000-000000000001/hide'],
    ['POST', '/admin/listings/hospital/00000000-0000-4000-8000-000000000001/unhide'], ['GET', '/admin/reviews'],
    ['POST', '/admin/reviews/00000000-0000-4000-8000-000000000001/restore'], ['DELETE', '/admin/reviews/00000000-0000-4000-8000-000000000001'], ['GET', '/admin/audit'], ['GET', '/admin/data-quality'],
  ];
  it.each(calls)('%s %s refuses anonymous callers with 401', async (method, path) => {
    expect((await app.api(path, { method, body: method === 'GET' ? undefined : {} })).status).toBe(401);
  });
  it.each(calls)('%s %s refuses patients and drivers with 403', async (method, path) => {
    for (const who of [patient, driver]) expect((await app.api(path, { method, body: method === 'GET' ? undefined : {}, ...as(who) })).status).toBe(403);
  });
});

describe('admin overview and users', () => {
  it('counts users, listings and reviews', async () => {
    const r = await app.api('/admin/overview', as(admin));
    expect(r.status).toBe(200);
    expect(r.body.users).toMatchObject({ total: 4, patients: 1, drivers: 1, admins: 2, disabled: 0 });
    expect(r.body.listings.hospital).toEqual({ active: 8, hidden: 0 });
    expect(r.body.reviews).toEqual({ visible: 0, hidden: 0, reported: 0 });
  });

  it('lists accounts with only safe fields and filters them', async () => {
    const all = await app.api('/admin/users', as(admin));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(4);
    for (const u of all.body.users) expect(Object.keys(u).sort()).toEqual(['createdAt', 'disabledAt', 'email', 'id', 'name', 'role', 'signIn']);
    const text = JSON.stringify(all.body);
    expect(text).not.toMatch(/scrypt|passwordHash|phone|98765/);
    expect((await app.api('/admin/users?role=driver', as(admin))).body.users.map((u) => u.id)).toEqual([driver.id]);
    expect((await app.api(`/admin/users?q=${encodeURIComponent(patient.email.slice(0, 8))}`, as(admin))).body.users.map((u) => u.id)).toContain(patient.id);
    expect((await app.api('/admin/users?status=disabled', as(admin))).body.total).toBe(0);
    expect((await app.api('/admin/users?role=nurse', as(admin))).status).toBe(422);
    expect((await app.api('/admin/users?limit=500', as(admin))).status).toBe(422);
  });

  it('never exposes health data anywhere in the admin screens', async () => {
    const marker = 'MARKER-PEANUT-ALLERGY';
    const put = await app.api('/patients/me/medical-id', { method: 'PUT', body: { fullName: 'Marker Patient', allergies: [marker], medicalNotes: marker }, ...as(patient) });
    expect(put.status).toBeLessThan(300);
    const seen = [];
    for (const path of ['/admin/overview', '/admin/users', '/admin/listings', '/admin/reviews?status=all', '/admin/audit', '/admin/emergencies', '/admin/analytics', '/admin/data-quality', '/admin/ambulances']) {
      const r = await app.api(path, as(admin));
      expect(r.status).toBe(200);
      seen.push(JSON.stringify(r.body));
    }
    expect(seen.join('')).not.toContain(marker);
    expect(seen.join('')).not.toContain('Marker Patient');
  });

  it('disables and enables an account, ends its sessions, and audits both', async () => {
    const victim = await app.user('patient');
    expect((await app.api('/auth/me', as(victim))).status).toBe(200);
    const off = await app.api(`/admin/users/${victim.id}/disable`, { method: 'POST', ...as(admin) });
    expect(off.status).toBe(200);
    expect(off.body.user.disabledAt).toBeTruthy();
    // Disabling revokes the session, so the old token stops working, and signing in again is refused.
    expect((await app.api('/auth/me', as(victim))).status).toBe(401);
    const login = (extra = {}) => app.api('/auth/login', { body: { email: victim.email, password: 'correct horse' }, headers: { 'x-forwarded-for': '10.9.9.9' }, ...extra });
    const refused = await login();
    expect(refused.status).toBe(403);
    expect(JSON.stringify(refused.body)).toContain('account_disabled');
    expect((await app.api(`/admin/users/${victim.id}/disable`, { method: 'POST', ...as(admin) })).status).toBe(409);
    const on = await app.api(`/admin/users/${victim.id}/enable`, { method: 'POST', ...as(admin) });
    expect(on.status).toBe(200);
    expect(on.body.user.disabledAt).toBeNull();
    expect((await login()).status).toBe(200);
    const audit = await app.api('/admin/audit?targetKind=user', as(admin));
    expect(audit.body.entries.map((e) => e.action)).toEqual(expect.arrayContaining(['user.disable', 'user.enable']));
    const entry = audit.body.entries.find((e) => e.action === 'user.disable');
    expect(entry.targetId).toBe(victim.id);
    expect(entry.actor).toBe('admin 1');
    expect(JSON.stringify(entry)).not.toContain(victim.email);
  });

  it('refuses to disable your own account', async () => {
    const r = await app.api(`/admin/users/${admin.id}/disable`, { method: 'POST', ...as(admin) });
    expect(r.status).toBe(403);
    expect(r.body.error?.code ?? r.body.code).toBe('cannot_disable_self');
  });

  it('keeps the last active admin enabled even if the check is reached another way', async () => {
    const store = app.store;
    const first = await store.admin.disableUser(admin2.id, admin.id);
    expect(first.ok).toBe(true);
    const second = await store.admin.disableUser(admin.id, admin2.id);
    expect(second).toEqual({ ok: false, reason: 'last_admin' });
    await store.admin.enableUser(admin2.id, admin.id);
  });

  it('answers 404 for an unknown or malformed id', async () => {
    expect((await app.api('/admin/users/00000000-0000-4000-8000-0000000000ff/disable', { method: 'POST', ...as(admin) })).status).toBe(404);
    expect((await app.api('/admin/users/not-a-uuid/disable', { method: 'POST', ...as(admin) })).status).toBe(404);
  });
});

describe('admin listings', () => {
  it('lists every kind, filters, and reads one listing in full', async () => {
    const all = await app.api('/admin/listings?limit=100', as(admin));
    expect(all.body.total).toBe(8 + 11 + 6 + 5);
    expect(new Set(all.body.listings.map((l) => l.kind))).toEqual(new Set(['hospital', 'doctor', 'pharmacy', 'diagnostic_centre']));
    const hospitals = await app.api('/admin/listings?kind=hospital&q=lakeview', as(admin));
    expect(hospitals.body.listings.map((l) => l.name)).toEqual(['Lakeview Multispeciality Hospital']);
    const one = await app.api(`/admin/listings/hospital/${hospitals.body.listings[0].id}`, as(admin));
    expect(one.body.listing).toMatchObject({ kind: 'hospital', active: true, area: 'Begumpet', emergencyAvailable: true });
    expect((await app.api('/admin/listings/pharmacy/00000000-0000-4000-8000-0000000000ff', as(admin))).status).toBe(404);
    expect((await app.api('/admin/listings/robot/00000000-0000-4000-8000-0000000000ff', as(admin))).status).toBe(404);
  });

  it('creates a hospital that patients can then find, and audits it', async () => {
    const created = await app.api('/admin/listings/hospital', { method: 'POST', body: { ...HOSPITAL, phone: '+91 40 5555 0100', emergencyAvailable: true, specialities: ['Cardiology'] }, ...as(admin) });
    expect(created.status).toBe(201);
    const id = created.body.listing.id;
    expect(created.body.listing).toMatchObject({ name: HOSPITAL.name, sourcePlatform: 'CareRoute admin', active: true, facilityType: 'hospital' });
    const seen = await app.api(`/hospitals/${id}`, as(patient));
    expect(seen.status).toBe(200);
    expect(seen.body.name ?? seen.body.hospital?.name).toBe(HOSPITAL.name);
    const audit = await app.api('/admin/audit?targetKind=hospital', as(admin));
    expect(audit.body.entries[0]).toMatchObject({ action: 'hospital.create', targetId: id });
  });

  it('edits only the fields it is given and records which', async () => {
    const id = (await app.api('/admin/listings?kind=pharmacy&q=wellcare', as(admin))).body.listings[0].id;
    const r = await app.api(`/admin/listings/pharmacy/${id}`, { method: 'PATCH', body: { hours: '09:00 to 21:00', open24: false }, ...as(admin) });
    expect(r.status).toBe(200);
    expect(r.body.listing).toMatchObject({ hours: '09:00 to 21:00', open24: false, name: 'Wellcare Pharmacy', area: 'Ameerpet' });
    const entry = (await app.api('/admin/audit?targetKind=pharmacy', as(admin))).body.entries[0];
    expect(entry.action).toBe('pharmacy.update');
    expect(entry.summary).toContain('hours, open24');
    expect(entry.summary).not.toContain('09:00');
  });

  it('hides a listing from patients and shows it again', async () => {
    const id = (await app.api('/admin/listings?kind=diagnostic_centre&q=clearpath', as(admin))).body.listings[0].id;
    expect((await app.api(`/diagnostic-centres/${id}`, as(patient))).status).toBe(200);
    const hide = await app.api(`/admin/listings/diagnostic_centre/${id}/hide`, { method: 'POST', ...as(admin) });
    expect(hide.body.listing.active).toBe(false);
    expect((await app.api(`/diagnostic-centres/${id}`, as(patient))).status).toBe(404);
    expect((await app.api('/diagnostic-centres?limit=50', as(patient))).body.diagnosticCentres?.some?.((x) => x.id === id) ?? false).toBe(false);
    expect((await app.api('/admin/listings?status=hidden', as(admin))).body.listings.map((l) => l.id)).toContain(id);
    expect((await app.api(`/admin/listings/diagnostic_centre/${id}/hide`, { method: 'POST', ...as(admin) })).status).toBe(409);
    expect((await app.api(`/admin/listings/diagnostic_centre/${id}/unhide`, { method: 'POST', ...as(admin) })).status).toBe(200);
    expect((await app.api(`/diagnostic-centres/${id}`, as(patient))).status).toBe(200);
  });

  it('keeps a hidden hospital named on its doctors, as the database join does', async () => {
    const h = (await app.api('/admin/listings?kind=hospital&q=deccan heart', as(admin))).body.listings[0];
    const doctors = (await app.api(`/doctors?q=ananya`, as(patient))).body;
    const list = doctors.doctors ?? doctors;
    expect(list.length).toBeGreaterThan(0);
    await app.api(`/admin/listings/hospital/${h.id}/hide`, { method: 'POST', ...as(admin) });
    const after = (await app.api(`/doctors?q=ananya`, as(patient))).body;
    expect((after.doctors ?? after)[0].place.name).toBe(h.name);
    await app.api(`/admin/listings/hospital/${h.id}/unhide`, { method: 'POST', ...as(admin) });
  });

  it('creates a doctor with a clinic, and one at a hospital, and refuses both or neither', async () => {
    const hospitalId = (await app.api('/admin/listings?kind=hospital&q=sanjeevani', as(admin))).body.listings[0].id;
    const at = await app.api('/admin/listings/doctor', { method: 'POST', body: { name: 'Dr. Test One', specialization: 'Cardiology', hospitalId }, ...as(admin) });
    expect(at.status).toBe(201);
    expect(at.body.listing).toMatchObject({ hospitalId, hospitalName: 'Sanjeevani General Hospital', clinic: null });
    const clinic = { name: 'Test Clinic', area: 'Ameerpet', address: '2 Test Lane, Ameerpet', phone: null, lat: 17.43, lng: 78.44 };
    const alone = await app.api('/admin/listings/doctor', { method: 'POST', body: { name: 'Dr. Test Two', specialization: 'ENT', clinic }, ...as(admin) });
    expect(alone.status).toBe(201);
    expect(alone.body.listing).toMatchObject({ hospitalId: null, clinic: { name: 'Test Clinic', lat: 17.43 }, area: 'Ameerpet' });
    expect((await app.api('/admin/listings/doctor', { method: 'POST', body: { name: 'Dr. Both', specialization: 'ENT', clinic, hospitalId }, ...as(admin) })).status).toBe(422);
    expect((await app.api('/admin/listings/doctor', { method: 'POST', body: { name: 'Dr. Neither', specialization: 'ENT' }, ...as(admin) })).status).toBe(422);
    const missing = await app.api('/admin/listings/doctor', { method: 'POST', body: { name: 'Dr. Ghost', specialization: 'ENT', hospitalId: '00000000-0000-4000-8000-0000000000ff' }, ...as(admin) });
    expect(missing.status).toBe(422);
    const moved = await app.api(`/admin/listings/doctor/${alone.body.listing.id}`, { method: 'PATCH', body: { hospitalId }, ...as(admin) });
    expect(moved.body.listing).toMatchObject({ hospitalId, clinic: null });
  });

  it('rejects bad input without changing anything', async () => {
    const bad = (body) => app.api('/admin/listings/hospital', { method: 'POST', body: { ...HOSPITAL, ...body }, ...as(admin) });
    expect((await bad({ lat: 28.6, lng: 77.2 })).status).toBe(422);
    expect((await bad({ lat: 78.4, lng: 17.4 })).status).toBe(422);
    expect((await bad({ website: 'javascript:alert(1)' })).status).toBe(422);
    expect((await bad({ phone: 'call me' })).status).toBe(422);
    expect((await bad({ checkedAt: '2999-01-01' })).status).toBe(422);
    expect((await bad({ facilityType: 'spa' })).status).toBe(422);
    expect((await bad({ rating: 5 })).status).toBe(422);
    expect((await bad({ name: '' })).status).toBe(422);
    expect((await app.api('/admin/listings/hospital', { method: 'POST', body: { name: 'No place' }, ...as(admin) })).status).toBe(422);
    const id = (await app.api('/admin/listings?kind=hospital&q=lakeview', as(admin))).body.listings[0].id;
    expect((await app.api(`/admin/listings/hospital/${id}`, { method: 'PATCH', body: {}, ...as(admin) })).status).toBe(422);
    expect((await app.api(`/admin/listings/hospital/${id}`, { method: 'PATCH', body: { lat: 17.4 }, ...as(admin) })).status).toBe(422);
    expect((await app.api(`/admin/listings/hospital/${id}`, { method: 'PATCH', body: { id: 'x' }, ...as(admin) })).status).toBe(422);
    expect((await app.api(`/admin/listings/hospital/${id}`, { method: 'PATCH', body: { name: 'Renamed' }, headers: { 'content-type': 'application/json' }, raw: '{broken', ...as(admin) })).status).toBeGreaterThanOrEqual(400);
    const still = await app.api(`/admin/listings/hospital/${id}`, as(admin));
    expect(still.body.listing.name).toBe('Lakeview Multispeciality Hospital');
  });

  it('offers hospitals for the doctor editor', async () => {
    const r = await app.api('/admin/hospital-choices', as(admin));
    expect(r.body.hospitals.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(r.body.hospitals[0]).sort()).toEqual(['active', 'area', 'id', 'name']);
  });
});

describe('review moderation (P-28)', () => {
  it('hides a review after reports, lets an admin keep or delete it, and never shows the author', async () => {
    const hospitalId = (await app.api('/admin/listings?kind=hospital&q=eastside', as(admin))).body.listings[0].id;
    const author = await app.user('patient');
    const put = await app.api('/reviews', { method: 'PUT', body: { kind: 'hospital', id: hospitalId, rating: 1, body: 'Rude review text' }, ...as(author) });
    expect(put.status).toBe(200);
    const reviewId = put.body.id;
    const reporters = [await app.user('patient'), await app.user('patient'), await app.user('patient')];
    expect((await app.api('/admin/reviews?status=reported', as(admin))).body.total).toBe(0);
    await app.api(`/reviews/${reviewId}/report`, { method: 'POST', body: {}, ...as(reporters[0]) });
    const reported = await app.api('/admin/reviews?status=reported', as(admin));
    expect(reported.body.reviews[0]).toMatchObject({ id: reviewId, reportCount: 1, status: 'visible', kind: 'hospital', listingName: 'Eastside Community Hospital', rating: 1 });
    await app.api(`/reviews/${reviewId}/report`, { method: 'POST', body: {}, ...as(reporters[1]) });
    await app.api(`/reviews/${reviewId}/report`, { method: 'POST', body: {}, ...as(reporters[2]) });
    const hidden = await app.api('/admin/reviews?status=hidden', as(admin));
    expect(hidden.body.reviews.map((r) => r.id)).toContain(reviewId);
    for (const row of hidden.body.reviews) expect(Object.keys(row).sort()).toEqual(['body', 'createdAt', 'id', 'kind', 'listingId', 'listingName', 'rating', 'reportCount', 'status', 'updatedAt']);
    expect(JSON.stringify(hidden.body)).not.toContain(author.id);
    expect((await app.api(`/reviews?kind=hospital&id=${hospitalId}`, as(patient))).body.reviews).toHaveLength(0);

    expect((await app.api(`/admin/reviews/${reviewId}/restore`, { method: 'POST', ...as(admin) })).status).toBe(204);
    expect((await app.api(`/reviews?kind=hospital&id=${hospitalId}`, as(patient))).body.reviews).toHaveLength(1);
    expect((await app.api('/admin/reviews?status=all', as(admin))).body.total).toBe(0);
    expect((await app.api(`/admin/reviews/${reviewId}/restore`, { method: 'POST', ...as(admin) })).status).toBe(409);
    // The reports were cleared by the check, so one new report does not hide it again.
    await app.api(`/reviews/${reviewId}/report`, { method: 'POST', body: {}, ...as(reporters[0]) });
    expect((await app.api(`/reviews?kind=hospital&id=${hospitalId}`, as(patient))).body.reviews).toHaveLength(1);

    expect((await app.api(`/admin/reviews/${reviewId}`, { method: 'DELETE', ...as(admin) })).status).toBe(204);
    expect((await app.api(`/reviews?kind=hospital&id=${hospitalId}`, as(patient))).body.reviews).toHaveLength(0);
    expect((await app.api(`/admin/reviews/${reviewId}`, { method: 'DELETE', ...as(admin) })).status).toBe(404);
    const actions = (await app.api('/admin/audit?targetKind=review', as(admin))).body.entries.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['review.restore', 'review.delete']));
  });
});

describe('audit log', () => {
  it('lists newest first with the actor name, filters, and pages', async () => {
    const all = await app.api('/admin/audit?limit=100', as(admin));
    expect(all.body.total).toBeGreaterThan(5);
    const times = all.body.entries.map((e) => +new Date(e.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    for (const e of all.body.entries) expect(Object.keys(e).sort()).toEqual(['action', 'actor', 'createdAt', 'id', 'summary', 'targetId', 'targetKind']);
    expect((await app.api('/admin/audit?action=user.disable', as(admin))).body.entries.every((e) => e.action === 'user.disable')).toBe(true);
    expect((await app.api('/admin/audit?limit=2&offset=1', as(admin))).body.entries).toHaveLength(2);
    expect((await app.api('/admin/audit?targetKind=spaceship', as(admin))).status).toBe(422);
  });
  it('is the only trace: no email, phone or review text lands in any summary', async () => {
    const text = JSON.stringify((await app.api('/admin/audit?limit=100', as(admin))).body);
    expect(text).not.toMatch(/@test\.example|Rude review text|98765/);
  });
});

describe('admin data quality and ambulance search (F-17, F-34, P-31)', () => {
  it('reports each kind of listing, possible duplicates and listings checked long ago, and no people', async () => {
    const r = await app.api('/admin/data-quality', as(admin));
    expect(r.status).toBe(200);
    expect(r.body.staleAfterDays).toBe(180);
    expect(r.body.kinds.map((k) => k.kind).sort()).toEqual(['diagnostic_centre', 'doctor', 'hospital', 'pharmacy']);
    for (const k of r.body.kinds) expect(Object.keys(k).sort()).toEqual(['active', 'kind', 'noPhone', 'noSource', 'stale']);
    expect(r.body.kinds.find((k) => k.kind === 'hospital').active).toBeGreaterThan(0);
    expect(r.body.possibleDuplicates).toMatchObject({ total: expect.any(Number), groups: expect.any(Array) });
    expect(r.body.stale.rows.every((x) => Object.keys(x).sort().join() === 'area,checkedAt,id,kind,name')).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/email|userId|medical/i);
  });

  it('finds the same name in the same area as a possible duplicate, and stops when one is hidden', async () => {
    const twin = { ...HOSPITAL, name: 'Twin Care Hospital' };
    const a = await app.api('/admin/listings/hospital', { method: 'POST', body: twin, ...as(admin) });
    const b = await app.api('/admin/listings/hospital', { method: 'POST', body: twin, ...as(admin) });
    expect([a.status, b.status]).toEqual([201, 201]);
    const groups = async () => (await app.api('/admin/data-quality', as(admin))).body.possibleDuplicates.groups;
    expect((await groups()).find((g) => g.name === twin.name)).toMatchObject({ kind: 'hospital', count: 2 });
    await app.api(`/admin/listings/hospital/${b.body.listing.id}/hide`, { method: 'POST', body: {}, ...as(admin) });
    expect((await groups()).find((g) => g.name === twin.name)).toBeUndefined();
  });

  it('lists every crew without a point, and with one only available crews in range, nearest first', async () => {
    const all = await app.api('/admin/ambulances', as(admin));
    expect(all.status).toBe(200);
    expect(all.body.ambulances.length).toBeGreaterThan(0);
    const { lat, lng } = all.body.ambulances[0].position;
    const near = await app.api(`/admin/ambulances?lat=${lat}&lng=${lng}&radiusKm=100`, as(admin));
    expect(near.status).toBe(200);
    expect(near.body.ambulances.every((a) => a.status === 'available')).toBe(true);
    const km = near.body.ambulances.map((a) => a.distanceKm);
    expect(km).toEqual([...km].sort((x, y) => x - y));
    const onlyIcu = await app.api(`/admin/ambulances?type=ICU&lat=${lat}&lng=${lng}&radiusKm=100`, as(admin));
    expect(onlyIcu.body.ambulances.every((a) => a.type === 'ICU')).toBe(true);
  });

  it('refuses half a point, a bad type and an oversized radius', async () => {
    for (const q of ['lat=17.4', 'type=VAN', 'lat=17.4&lng=78.4&radiusKm=500']) {
      expect((await app.api(`/admin/ambulances?${q}`, as(admin))).status, q).toBe(422);
    }
  });

  it('gives the overall averages the analytics screen shows', async () => {
    const r = await app.api('/admin/analytics', as(admin));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('averageAssignSeconds');
    expect(r.body).toHaveProperty('averageArriveSeconds');
  });
});
