// Driver approval by an admin (D-87) and password reset requests with admin-issued links (D-88),
// on the in-memory store through the real router.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './helpers.js';

let app; let admin; let patient;
beforeAll(async () => { app = await startApp(); admin = await app.user('admin'); patient = await app.user('patient'); });
afterAll(async () => { await app.close(); });

let n = 0;
const from = () => ({ 'x-forwarded-for': `10.8.${Math.floor(++n / 250)}.${n % 250}` });
const driverBody = (i) => ({ name: `Pending Driver ${i}`, email: `pending-${i}@test.example`, phone: `98770${String(i).padStart(5, '0')}`, password: 'correct horse', role: 'driver', vehicle: { registrationNumber: `TS11AP${String(i).padStart(4, '0')}`, type: 'ALS' } });
const as = (u) => ({ token: u.token });
async function newDriver(i) {
  const r = await app.api('/auth/register', { body: driverBody(i), headers: from() });
  expect(r.status).toBe(201);
  return { token: r.body.token, id: r.body.user.id, approval: r.body.user.approval };
}

describe('a new driver waits for an admin', () => {
  it('starts pending, can sign in, and cannot work until approved', async () => {
    const d = await newDriver(1);
    expect(d.approval).toBe('pending');
    const me = await app.api('/auth/me', as(d));
    expect(me.body).toMatchObject({ role: 'driver', driverApproval: 'pending' });
    const mine = await app.api('/driver/me', as(d));
    expect(mine.status).toBe(200);
    expect(mine.body.approval.status).toBe('pending');
    for (const [path, method, body] of [['/driver/me/status', 'PUT', { status: 'available' }], ['/driver/me/location', 'PUT', { lat: 17.4, lng: 78.4 }], ['/driver/offers'], ['/driver/trips/active']]) {
      const r = await app.api(path, { method: method || 'GET', body, ...as(d) });
      expect(r.status, path).toBe(403);
      expect(r.body.error.code, path).toBe('driver_not_approved');
    }
    const login = await app.api('/auth/login', { body: { email: 'pending-1@test.example', password: 'correct horse' }, headers: from() });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: 'driver', approval: 'pending' });
  });

  it('shows an admin who and which vehicle, and nobody else', async () => {
    const d = await newDriver(2);
    const list = await app.api('/admin/driver-requests', as(admin));
    expect(list.status).toBe(200);
    expect(list.body.requests.find((r) => r.id === d.id)).toMatchObject({ name: 'Pending Driver 2', email: 'pending-2@test.example', phone: '+919877000002', registrationNumber: 'TS11AP0002', vehicleType: 'ALS', status: 'pending' });
    expect((await app.api('/admin/driver-requests')).status).toBe(401);
    expect((await app.api('/admin/driver-requests', as(patient))).status).toBe(403);
    expect((await app.api('/admin/driver-requests', as(d))).status).toBe(403);
    expect((await app.api(`/admin/drivers/${d.id}/approve`, { method: 'POST', body: {}, ...as(d) })).status).toBe(403);
  });

  it('lets an approved driver work, and takes a rejected one off the road', async () => {
    const d = await newDriver(3);
    const ok = await app.api(`/admin/drivers/${d.id}/approve`, { method: 'POST', body: {}, ...as(admin) });
    expect(ok.status).toBe(204);
    expect((await app.api(`/admin/drivers/${d.id}/approve`, { method: 'POST', body: {}, ...as(admin) })).status).toBe(409);
    expect((await app.api('/driver/me/location', { method: 'PUT', body: { lat: 17.58, lng: 78.62 }, ...as(d) })).status).toBe(200);
    expect((await app.api('/driver/me/status', { method: 'PUT', body: { status: 'available' }, ...as(d) })).status).toBe(200);
    expect((await app.api('/driver/me', as(d))).body.ambulance.status).toBe('available');

    const no = await app.api(`/admin/drivers/${d.id}/reject`, { method: 'POST', body: { note: 'Plate did not match' }, ...as(admin) });
    expect(no.status).toBe(204);
    const after = await app.api('/driver/me', as(d));
    expect(after.body.approval).toEqual({ status: 'rejected', note: 'Plate did not match' });
    expect(after.body.ambulance.status).toBe('offline');
    expect((await app.api('/driver/offers', as(d))).status).toBe(403);
  });

  it('only lists drivers, refuses other ids, and writes an audit row without contact details', async () => {
    expect((await app.api(`/admin/drivers/${patient.id}/approve`, { method: 'POST', body: {}, ...as(admin) })).status).toBe(404);
    expect((await app.api('/admin/drivers/00000000-0000-4000-8000-000000000009/approve', { method: 'POST', body: {}, ...as(admin) })).status).toBe(404);
    expect((await app.api('/admin/driver-requests?status=bogus', as(admin))).status).toBe(422);
    const audit = await app.api('/admin/audit?targetKind=user&limit=50', as(admin));
    const rows = audit.body.entries.filter((e) => e.action.startsWith('driver.'));
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/@test\.example|9877|TS11AP/);
    const overview = await app.api('/admin/overview', as(admin));
    expect(overview.body.drivers.pending).toBeGreaterThanOrEqual(2);
  });
});

describe('password reset by an admin-issued link', () => {
  it('records a request the same way for any address, and shows only real ones to an admin', async () => {
    const u = await app.user('patient');
    const known = await app.api('/auth/forgot', { body: { email: u.email }, headers: from() });
    const unknown = await app.api('/auth/forgot', { body: { email: 'nobody-here@test.example' }, headers: from() });
    expect([known.status, unknown.status]).toEqual([202, 202]);
    expect(known.body).toEqual(unknown.body);
    const list = (await app.api('/admin/password-resets', as(admin))).body.requests;
    expect(list.some((r) => r.email === u.email && !r.issuedAt)).toBe(true);
    expect(list.some((r) => r.email === 'nobody-here@test.example')).toBe(false);
    expect((await app.api('/admin/password-resets', as(patient))).status).toBe(403);
    // Asking again does not pile up requests.
    await app.api('/auth/forgot', { body: { email: u.email }, headers: from() });
    expect((await app.api('/admin/password-resets', as(admin))).body.requests.filter((r) => r.email === u.email)).toHaveLength(1);
  });

  it('issues a one-time link that sets a new password and ends every session', async () => {
    const u = await app.user('patient');
    await app.api('/auth/forgot', { body: { email: u.email }, headers: from() });
    const issued = await app.api(`/admin/users/${u.id}/reset-link`, { method: 'POST', body: {}, ...as(admin) });
    expect(issued.status).toBe(201);
    expect(issued.body.link).toMatch(/\/reset\/\?token=[A-Za-z0-9_-]{40,}$/);
    const token = new URL(issued.body.link).searchParams.get('token');
    // Only a hash is stored.
    expect(JSON.stringify([...(await app.store.admin.listResetRequests())])).not.toContain(token);

    expect((await app.api('/auth/me', as(u))).status).toBe(200);
    const done = await app.api('/auth/reset', { body: { token, password: 'a brand new phrase' }, headers: from() });
    expect(done.status).toBe(204);
    expect((await app.api('/auth/me', as(u))).status).toBe(401);
    expect((await app.api('/auth/login', { body: { email: u.email, password: 'correct horse' }, headers: from() })).status).toBe(401);
    expect((await app.api('/auth/login', { body: { email: u.email, password: 'a brand new phrase' }, headers: from() })).status).toBe(200);
    const again = await app.api('/auth/reset', { body: { token, password: 'another phrase here' }, headers: from() });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('reset_invalid');
    expect((await app.api('/admin/password-resets', as(admin))).body.requests.some((r) => r.email === u.email)).toBe(false);
  });

  it('refuses a made-up token, a short password, and anyone who is not an admin issuing links', async () => {
    const u = await app.user('patient');
    expect((await app.api('/auth/reset', { body: { token: 'x'.repeat(43), password: 'a brand new phrase' }, headers: from() })).status).toBe(400);
    expect((await app.api('/auth/reset', { body: { token: 'x'.repeat(43), password: 'short' }, headers: from() })).status).toBe(422);
    expect((await app.api(`/admin/users/${u.id}/reset-link`, { method: 'POST', body: {}, ...as(patient) })).status).toBe(403);
    expect((await app.api(`/admin/users/${u.id}/reset-link`, { method: 'POST', body: {} })).status).toBe(401);
    expect((await app.api('/admin/users/00000000-0000-4000-8000-000000000009/reset-link', { method: 'POST', body: {}, ...as(admin) })).status).toBe(404);
  });

  it('rate limits asking for a reset', async () => {
    const results = [];
    for (let i = 0; i < 5; i += 1) results.push((await app.api('/auth/forgot', { body: { email: 'spam-target@test.example' }, headers: from() })).status);
    expect(results.slice(0, 3)).toEqual([202, 202, 202]);
    expect(results.slice(3)).toEqual([429, 429]);
  });

  it('asks for a new password when the account started with one someone else chose', async () => {
    const made = await app.store.users.create({ name: 'Starter', email: 'starter@test.example', phone: null, role: 'patient', passwordHash: await (await import('../server/auth/crypto.js')).hashPassword('12345678'), passwordChangeRequired: true });
    const login = await app.api('/auth/login', { body: { email: 'starter@test.example', password: '12345678' }, headers: from() });
    expect(login.status).toBe(200);
    expect((await app.api('/auth/me', { token: login.body.token })).body.passwordChangeRequired).toBe(true);
    expect((await app.api('/auth/password', { body: { currentPassword: '12345678', newPassword: 'my own new phrase' }, token: login.body.token })).status).toBe(204);
    const again = await app.api('/auth/login', { body: { email: 'starter@test.example', password: 'my own new phrase' }, headers: from() });
    expect((await app.api('/auth/me', { token: again.body.token })).body.passwordChangeRequired).toBe(false);
    expect(made.id).toBeTruthy();
  });
});
