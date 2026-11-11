// Driver sign-up and the patient to driver journey on the in-memory store (D-84): a driver registers
// with a vehicle, goes online, gets the request meant for them and nobody else's, and walks the trip.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './helpers.js';

let app;
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await app.close(); });

// Away from the sample store's simulated crews, so only the drivers made here can be matched.
const at = { lat: 17.58, lng: 78.62 };
const SOS = { emergencyType: 'cardiac', forSelf: true, conscious: true, patientCount: 1, ambulanceType: 'BLS', notes: 'test note only', location: at, address: 'Test Road, Begumpet' };
const driverBody = (n, extra = {}) => ({ name: `Driver ${n}`, email: `driver-flow-${n}@test.example`, phone: `98760${String(n).padStart(5, '0')}`, password: 'correct horse', role: 'driver', vehicle: { registrationNumber: `TS10FL${String(n).padStart(4, '0')}`, type: 'BLS' }, ...extra });
let ip = 0;
const from = () => ({ 'x-forwarded-for': `10.7.${Math.floor(++ip / 250)}.${ip % 250}` });
const register = (body) => app.api('/auth/register', { body, headers: from() });
async function onlineDriver(n, where) {
  const r = await register(driverBody(n));
  expect(r.status).toBe(201);
  const token = r.body.token;
  expect((await app.api('/driver/me/location', { method: 'PUT', token, body: where })).status).toBe(200);
  expect((await app.api('/driver/me/status', { method: 'PUT', token, body: { status: 'available' } })).status).toBe(200);
  return { token, id: r.body.user.id };
}

describe('driver sign-up (D-84)', () => {
  it('creates the account and its one ambulance together, offline at first', async () => {
    const r = await register(driverBody(1));
    expect(r.status).toBe(201);
    const me = await app.api('/driver/me', { token: r.body.token });
    expect(me.body.ambulance).toMatchObject({ registrationNumber: 'TS10FL0001', type: 'BLS', status: 'offline' });
  });

  it('asks for a phone and a vehicle, and refuses a vehicle on a patient account', async () => {
    const noVehicle = await register({ ...driverBody(2), vehicle: undefined });
    expect(noVehicle.status).toBe(422);
    expect(Object.keys(noVehicle.body.error.fields)).toContain('vehicle.registrationNumber');
    const noPhone = await register({ ...driverBody(3), phone: undefined });
    expect(noPhone.status).toBe(422);
    expect(Object.keys(noPhone.body.error.fields)).toContain('phone');
    const patientWithVehicle = await register({ ...driverBody(4), role: 'patient' });
    expect(patientWithVehicle.status).toBe(422);
    expect((await register({ ...driverBody(5), vehicle: { registrationNumber: 'x', type: 'BLS' } })).status).toBe(422);
  });

  it('refuses a registration number or email that is already used, and leaves no half-made account', async () => {
    expect((await register(driverBody(6))).status).toBe(201);
    const sameVehicle = await register(driverBody(7, { vehicle: { registrationNumber: 'ts 10 fl 0006', type: 'ALS' } }));
    expect(sameVehicle.status).toBe(409);
    expect(sameVehicle.body.error.code).toBe('vehicle_taken');
    expect(await app.store.users.byEmail('driver-flow-7@test.example')).toBeNull();
    const sameEmail = await register(driverBody(6, { vehicle: { registrationNumber: 'TS10FL9999', type: 'BLS' } }));
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.code).toBe('email_taken');
    expect((await app.store.emergencies.listAmbulances()).some((a) => a.registrationNumber === 'TS10FL9999')).toBe(false);
  });

  it('signs a driver in with the same form as a patient and reports the role', async () => {
    await register(driverBody(8));
    const login = await app.api('/auth/login', { body: { email: 'driver-flow-8@test.example', password: 'correct horse' }, headers: from() });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('driver');
  });
});

describe('a request goes only to the driver it was offered to', () => {
  it('reaches the nearest online driver, stays hidden from another driver, and runs to completion', async () => {
    const near = await onlineDriver(20, at);
    const far = await onlineDriver(21, { lat: at.lat + 0.02, lng: at.lng + 0.02 });
    expect((await app.api('/driver/offers', { token: near.token })).body.offer).toBeNull();

    const guest = await app.api('/emergencies', { body: { ...SOS, guestPhone: '+919876500777' }, headers: from() });
    expect(guest.status).toBe(201);
    const id = guest.body.emergency.id;

    const offer = (await app.api('/driver/offers', { token: near.token })).body.offer;
    expect(offer).toMatchObject({ emergencyId: id, emergencyType: 'cardiac', address: 'Test Road, Begumpet' });
    expect(offer.secondsRemaining).toBeGreaterThan(0);
    // Nothing about the patient's identity is in an offer from a guest.
    expect(JSON.stringify(offer)).not.toMatch(/919876500777|guestPhone|trackingToken/);

    // The other driver sees nothing, and cannot accept or decline it by guessing the id.
    expect((await app.api('/driver/offers', { token: far.token })).body.offer).toBeNull();
    expect((await app.api(`/driver/offers/${id}/accept`, { method: 'POST', token: far.token, body: {} })).status).toBe(409);
    expect((await app.api(`/driver/offers/${id}/reject`, { method: 'POST', token: far.token, body: {} })).status).toBe(409);
    expect((await app.api('/driver/trips/active', { token: far.token })).body.emergency).toBeNull();

    const accepted = await app.api(`/driver/offers/${id}/accept`, { method: 'POST', token: near.token, body: {} });
    expect(accepted.status).toBe(200);
    expect(accepted.body.emergency.status).toBe('assigned');

    // Once taken, the same request is not offered again, and the other driver still cannot move the trip.
    expect((await app.api(`/driver/offers/${id}/accept`, { method: 'POST', token: far.token, body: {} })).status).toBe(409);
    expect((await app.api(`/driver/trips/${id}/status`, { method: 'POST', token: far.token, body: { status: 'en_route' } })).status).toBe(409);

    const trip = (await app.api('/driver/trips/active', { token: near.token })).body.emergency;
    expect(trip).toMatchObject({ id, status: 'assigned', address: 'Test Road, Begumpet' });

    // The guest follows the trip with the link only they hold: first name and position, no phone.
    const token = guest.body.trackingToken;
    const tracked = (await app.api(`/track/${token}`)).body;
    expect(tracked.status).toBe('assigned');
    expect(JSON.stringify(tracked)).not.toMatch(/9876|TS10FL|phone/i);

    for (const step of ['en_route', 'arrived', 'picked_up', 'at_hospital', 'completed']) {
      const moved = await app.api(`/driver/trips/${id}/status`, { method: 'POST', token: near.token, body: { status: step } });
      expect(moved.status, step).toBe(200);
      expect((await app.api(`/track/${token}`)).body.status).toBe(step);
    }
    expect((await app.api('/driver/me/release', { method: 'POST', token: near.token, body: {} })).status).toBe(200);
    expect((await app.api('/driver/me', { token: near.token })).body.ambulance.status).toBe('available');
    for (const d of [near, far]) await app.api('/driver/me/status', { method: 'PUT', token: d.token, body: { status: 'offline' } });
  });

  it('moves on to the next driver when the first declines', async () => {
    const first = await onlineDriver(30, { lat: at.lat + 0.001, lng: at.lng });
    const second = await onlineDriver(31, { lat: at.lat + 0.003, lng: at.lng });
    const guest = await app.api('/emergencies', { body: { ...SOS, guestPhone: '+919876500778' }, headers: from() });
    const id = guest.body.emergency.id;
    expect((await app.api('/driver/offers', { token: first.token })).body.offer?.emergencyId).toBe(id);
    expect((await app.api(`/driver/offers/${id}/reject`, { method: 'POST', token: first.token, body: {} })).status).toBe(200);
    expect((await app.api('/driver/offers', { token: first.token })).body.offer).toBeNull();
    expect((await app.api('/driver/offers', { token: second.token })).body.offer?.emergencyId).toBe(id);
    await app.api(`/emergencies/${id}`, { method: 'GET' });
  });

  it('refuses driver routes to patients and patient routes to drivers', async () => {
    const patient = await app.user('patient');
    const driver = await register(driverBody(40));
    for (const path of ['/driver/me', '/driver/offers', '/driver/trips/active']) expect((await app.api(path, { token: patient.token })).status, path).toBe(403);
    expect((await app.api('/emergencies', { token: driver.body.token, body: SOS })).status).toBe(403);
    expect((await app.api('/driver/me')).status).toBe(401);
  });
});
