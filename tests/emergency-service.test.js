import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../server/db/memory.js';
import { createEmergencyService } from '../server/emergency/service.js';
import { demoDeclines, demoOfferDelayMs } from '../server/emergency/demo-crew.js';

function selectedId(shouldDecline) {
  const seed = (id) => [...id].reduce((n, c) => (n * 33 + c.charCodeAt(0)) >>> 0, 5381);
  for (let i = 0; i < 10000; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    if (demoDeclines(id) === shouldDecline) return id;
  }
  throw new Error('could not find deterministic demo id');
}

function memoryAtClock() {
  let current = new Date('2026-11-04T12:00:00Z');
  return { store: createMemoryStore({ now: () => new Date(current) }), now: () => new Date(current), tick: (ms) => { current = new Date(+current + ms); } };
}

describe('emergency service and demo crew simulator', () => {
  it('uses a deterministic 5 to 20 second acceptance delay and completes/releases a demo trip', async () => {
    const clock = memoryAtClock(); const service = createEmergencyService({ store: clock.store, now: clock.now, timing: { acceptMinMs: 5, acceptRangeMs: 15, enRoutePauseMs: 2, arrivedPauseMs: 2, pickedUpPauseMs: 2, atHospitalPauseMs: 2, releasePauseMs: 2 } });
    const demo = (await clock.store.emergencies.listAmbulances())[0];
    const emergency = await service.create({ id: selectedId(false), patientUserId: 'p1', location: { lat: demo.lat, lng: demo.lng }, trackingTokenHash: 'x'.repeat(64) });
    const offer = (await clock.store.emergencies.offersForEmergency(emergency.id))[0];
    const delay = demoOfferDelayMs(emergency.id, { acceptMinMs: 5, acceptRangeMs: 15 });
    clock.tick(delay - 1); await service.tick();
    expect((await clock.store.emergencies.getById(emergency.id)).status).toBe('matching');
    clock.tick(1); await service.tick();
    expect((await clock.store.emergencies.getById(emergency.id)).status).toBe('assigned');
    await service.tick();
    expect((await clock.store.emergencies.getById(emergency.id)).status).toBe('en_route');
    expect(offer.expiresAt - offer.offeredAt).toBe(30_000);
    for (let i = 0; i < 6; i += 1) { clock.tick(3); await service.tick(); }
    expect((await clock.store.emergencies.getById(emergency.id)).status).toBe('completed');
    clock.tick(3); await service.tick();
    expect((await clock.store.emergencies.listAmbulances()).find((a) => a.id === demo.id).status).toBe('available');
  });

  it('follows the deterministic decline path through to no_match', async () => {
    const clock = memoryAtClock(); const service = createEmergencyService({ store: clock.store, now: clock.now, timing: { acceptMinMs: 5, acceptRangeMs: 1 } });
    const emergency = await service.create({ id: selectedId(true), patientUserId: 'p1', location: { lat: 17.43, lng: 78.45 }, trackingTokenHash: 'y'.repeat(64) });
    for (let i = 0; i < 5; i += 1) { clock.tick(6); await service.tick(); }
    expect((await clock.store.emergencies.getById(emergency.id)).status).toBe('no_match');
    expect((await clock.store.emergencies.offersForEmergency(emergency.id)).every((o) => o.state === 'declined')).toBe(true);
  });

  it('never accepts or moves an ambulance without isDemo', async () => {
    const clock = memoryAtClock();
    const base = createMemoryStore({ now: clock.now, extraAmbulances: [{ id: 'real-ambulance', driverUserId: 'driver-1', registrationNumber: 'REAL-001', type: 'BLS', status: 'available', lat: 17.43, lng: 78.45, lastPingAt: clock.now(), isDemo: false }] });
    const db = { ...base.emergencies, nearbyAmbulances: async () => [{ id: 'real-ambulance', type: 'BLS', distanceKm: 0, isDemo: false }] };
    const service = createEmergencyService({ store: { ...base, emergencies: db }, now: clock.now, timing: { acceptMinMs: 5, acceptRangeMs: 1 } });
    const emergency = await service.create({ id: selectedId(false), patientUserId: 'p1', location: { lat: 17.43, lng: 78.45 }, trackingTokenHash: 'z'.repeat(64) });
    clock.tick(10); await service.tick();
    expect((await db.getById(emergency.id)).status).toBe('matching');
    expect((await db.listAmbulances()).find((a) => a.id === 'real-ambulance').status).toBe('available');
  });
});
