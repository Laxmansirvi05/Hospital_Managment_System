import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scrub } from '../server/log.js';
import { startApp } from './helpers.js';

let app; let patient; let another;
beforeAll(async () => { app = await startApp(); patient = await app.user('patient'); another = await app.user('patient'); });
afterAll(async () => { await app.close(); });

const body = { emergencyType: 'accident', forSelf: true, conscious: true, patientCount: 1, ambulanceType: 'BLS', notes: 'test note only', location: { lat: 17.4435, lng: 78.4676 }, address: 'Sample Road' };
const guestHeaders = (ip) => ({ 'x-forwarded-for': ip });

async function guestSOS(ip, phone, extra = {}) {
  return app.api('/emergencies', { method: 'POST', headers: guestHeaders(ip), body: { ...body, guestPhone: phone, ...extra } });
}

describe('emergency API routes (memory store, no external services)', () => {
  it('creates guest and patient requests and only returns a tracking token at creation', async () => {
    const guest = await guestSOS('192.0.2.81', '+15555551001');
    expect(guest.status).toBe(201);
    expect(guest.body.emergency.status).toBe('matching');
    expect(guest.body.trackingToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(await app.store.emergencies.getById(guest.body.emergency.id))).not.toContain(guest.body.trackingToken);
    const patientResponse = await app.api('/emergencies', { token: patient.token, body });
    expect(patientResponse.status).toBe(201);
    expect(patientResponse.body.emergency).toHaveProperty('id');
  });

  it('returns only the public tracking allowlist and lets a guest cancel with the token', async () => {
    const created = await guestSOS('192.0.2.82', '+15555551002'); const token = created.body.trackingToken;
    const tracked = await app.api(`/track/${token}`);
    expect(tracked.status).toBe(200);
    expect(Object.keys(tracked.body).sort()).toEqual(['ambulance', 'demo', 'etaIsEstimate', 'etaSeconds', 'status']);
    if (tracked.body.ambulance) expect(Object.keys(tracked.body.ambulance).sort()).toEqual(['heading', 'lat', 'lng']);
    expect(JSON.stringify(tracked.body)).not.toMatch(/name|phone|medical|address|notes|id|token/i);
    expect((await app.api(`/track/${token}/cancel`, { method: 'POST', body: {} })).body.status).toBe('cancelled');
  });

  it('hides another patient emergency as 404 and serves only that patient own history', async () => {
    const historyBefore = (await app.api('/emergencies', { token: patient.token })).body.emergencies.length;
    const own = await app.api('/emergencies', { token: patient.token, body }); const id = own.body.emergency.id;
    expect((await app.api(`/emergencies/${id}`, { token: another.token })).status).toBe(404);
    expect((await app.api(`/emergencies/${id}`, { token: patient.token })).status).toBe(200);
    expect((await app.api('/emergencies', { token: patient.token })).body.emergencies).toHaveLength(historyBefore + 1);
  });

  it('rate limits guest SOS three times per phone and network address per hour', async () => {
    const phone = '+15555551003';
    expect((await guestSOS('192.0.2.83', phone)).status).toBe(201);
    expect((await guestSOS('192.0.2.83', phone)).status).toBe(201);
    expect((await guestSOS('192.0.2.83', phone)).status).toBe(201);
    expect((await guestSOS('192.0.2.83', phone)).status).toBe(429);
  });

  it('rejects destination fields, malformed input, and a guest without a phone', async () => {
    expect((await guestSOS('192.0.2.84', '+15555551004', { destinationHospitalId: 'x' })).status).toBe(422);
    expect((await app.api('/emergencies', { method: 'POST', body: { ...body, guestPhone: undefined } })).status).toBe(422);
    expect((await guestSOS('192.0.2.85', '+15555551005', { location: { lat: 100, lng: 0 } })).status).toBe(422);
  });

  it('shows no_match when the candidate set is empty', async () => {
    const result = await guestSOS('192.0.2.86', '+15555551006', { location: { lat: 0, lng: 0 } });
    expect(result.body.emergency.status).toBe('no_match');
  });

  it('requires auth for protected routes and refuses patient driver access', async () => {
    expect((await app.api('/emergencies/active')).status).toBe(401);
    expect((await app.api('/driver/me', { token: patient.token })).status).toBe(403);
    expect((await app.api('/admin/analytics', { token: patient.token })).status).toBe(403);
  });

  it('does not include phone, address, notes, token, or coordinates in the log scrubber output', () => {
    const line = JSON.stringify(scrub({ phone: '+15555550000', address: 'Sensitive Road', notes: 'private', token: 'secret-token', lat: 17, lng: 78, route: '/api/v1/emergencies' }));
    expect(line).not.toMatch(/15555550000|Sensitive Road|private|secret-token|17|78/);
    expect(line).toContain('/api/v1/emergencies');
  });
});
