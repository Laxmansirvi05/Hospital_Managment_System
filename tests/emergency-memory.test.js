import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../server/db/memory.js';

function setup() {
  let time = new Date('2026-11-04T12:00:00.000Z');
  const store = createMemoryStore({ now: () => new Date(time) });
  const tick = (ms) => { time = new Date(+time + ms); };
  return { store, tick };
}

async function emergencyWithOffers(store, count = 2) {
  const db = store.emergencies;
  const emergency = await db.createEmergency({ patientUserId: 'patient-1', emergencyType: 'accident', location: { lat: 17.43, lng: 78.45 }, trackingTokenHash: 'h'.repeat(64) });
  const crews = (await db.listAmbulances()).slice(0, count);
  const result = await db.createOffers(emergency.id, crews.map((a, i) => ({ ambulanceId: a.id, etaSeconds: 300 + i })), true);
  return { db, emergency: result, crews };
}

async function acceptAndComplete(db, emergencyId, ambulanceId) {
  expect(await db.acceptEmergency(emergencyId, ambulanceId)).toMatchObject({ status: 'assigned' });
  for (const status of ['en_route', 'arrived', 'picked_up', 'at_hospital', 'completed']) {
    expect(await db.advanceEmergency(emergencyId, ambulanceId, status)).toMatchObject({ status });
  }
}

describe('emergency memory adapter mirrors the SQL lifecycle', () => {
  it('seeds the same twelve demo crews and filters candidates by radius, type, freshness, and availability', async () => {
    const { store } = setup(); const db = store.emergencies;
    const all = await db.listAmbulances();
    expect(all).toHaveLength(12);
    expect(all.map((a) => [a.registrationNumber, a.type, a.lat, a.lng])).toEqual([
      ['DEMO-0001', 'BLS', 17.4435, 78.4676], ['DEMO-0002', 'ALS', 17.4399, 78.4983], ['DEMO-0003', 'ICU', 17.4156, 78.4347],
      ['DEMO-0004', 'BLS', 17.4326, 78.4071], ['DEMO-0005', 'ALS', 17.4435, 78.3772], ['DEMO-0006', 'BLS', 17.4401, 78.3489],
      ['DEMO-0007', 'BLS', 17.4948, 78.3996], ['DEMO-0008', 'ALS', 17.4375, 78.4482], ['DEMO-0009', 'BLS', 17.3688, 78.5247],
      ['DEMO-0010', 'ICU', 17.3457, 78.5522], ['DEMO-0011', 'BLS', 17.3616, 78.4747], ['DEMO-0012', 'ALS', 17.4058, 78.5591],
    ]);
    const icu = await db.nearbyAmbulances({ point: { lat: 17.43, lng: 78.45 }, type: 'ICU' });
    expect(icu.every((a) => a.type === 'ICU' && a.distanceKm <= 10)).toBe(true);
  });

  it('runs the happy path, keeps the ambulance busy after completion, and records seven lifecycle events', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    await acceptAndComplete(db, emergency.id, crews[0].id);
    expect(await db.releaseAmbulance(crews[0].id)).toBe(true);
    const events = await db.timeline(emergency.id);
    expect(events.filter((e) => e.kind !== 'created')).toHaveLength(7);
    expect(events).toHaveLength(8);
    expect(events.map((e) => e.kind)).toEqual(['created', 'offered', 'accepted', 'status_changed', 'status_changed', 'status_changed', 'status_changed', 'status_changed']);
    expect((await db.getById(emergency.id)).trackingExpiresAt).toBeInstanceOf(Date);
  });

  it('rejects a wrong ambulance accept and does not allow two open offers', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 2);
    expect(await db.acceptEmergency(emergency.id, crews[1].id)).toBeNull();
    expect((await db.offersForEmergency(emergency.id)).filter((o) => o.state === 'open')).toHaveLength(1);
  });

  it('rejects skipped moves and only advances from the immediately previous state', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    await db.acceptEmergency(emergency.id, crews[0].id);
    expect(await db.advanceEmergency(emergency.id, crews[0].id, 'arrived')).toBeNull();
    expect(await db.advanceEmergency(emergency.id, 'wrong-driver', 'en_route')).toBeNull();
  });

  it('opens the next offer immediately after decline', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 2);
    await db.declineOffer(emergency.id, crews[0].id);
    const offers = await db.offersForEmergency(emergency.id);
    expect(offers.map((o) => o.state)).toEqual(['declined', 'open']);
    expect(offers[1].expiresAt - offers[1].offeredAt).toBe(30_000);
  });

  it('opens the next offer on expiry and marks all five expired offers as no_match', async () => {
    const { store, tick } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 5);
    for (let i = 0; i < 5; i += 1) { tick(30_001); await db.expireOffers(); }
    const result = await db.getById(emergency.id);
    expect(result.status).toBe('no_match');
    expect(result.closedAt).toBeInstanceOf(Date);
    expect((await db.offersForEmergency(emergency.id)).map((o) => o.state)).toEqual(['expired', 'expired', 'expired', 'expired', 'expired']);
  });

  it('moves an emergency with no candidates directly to no_match', async () => {
    const { store } = setup(); const db = store.emergencies;
    const emergency = await db.createEmergency({ guestPhone: '+15555550123', trackingTokenHash: 'z'.repeat(64), location: { lat: 0, lng: 0 } });
    expect((await db.createOffers(emergency.id, [])).status).toBe('no_match');
  });

  it('does not accept an expired offer', async () => {
    const { store, tick } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    tick(30_000);
    expect(await db.acceptEmergency(emergency.id, crews[0].id)).toBeNull();
  });

  it('cancels before pickup and frees the assigned ambulance', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    await db.acceptEmergency(emergency.id, crews[0].id);
    expect((await db.cancelEmergency(emergency.id, 'caller cancelled')).status).toBe('cancelled');
    expect((await db.listAmbulances()).find((a) => a.id === crews[0].id).status).toBe('available');
  });

  it('does not cancel after completion and only permits feedback after completion', async () => {
    const { store } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    expect(await db.addFeedback(emergency.id, { rating: 5 })).toBeNull();
    await acceptAndComplete(db, emergency.id, crews[0].id);
    expect(await db.cancelEmergency(emergency.id)).toBeNull();
    expect(await db.addFeedback(emergency.id, { rating: 5, comment: 'Clear updates' })).toMatchObject({ rating: 5 });
  });

  it('exposes event reads but no timeline mutation operation', async () => {
    const { store } = setup(); const { db, emergency } = await emergencyWithOffers(store, 1);
    expect(await db.timeline(emergency.id)).toHaveLength(2);
    expect(db).not.toHaveProperty('updateEvent');
    expect(db).not.toHaveProperty('deleteEvent');
  });

  it('expires tracking two hours after a closed case, capped at 24 hours after creation', async () => {
    const { store, tick } = setup(); const { db, emergency, crews } = await emergencyWithOffers(store, 1);
    tick(23 * 3600_000); await db.acceptEmergency(emergency.id, crews[0].id); await db.cancelEmergency(emergency.id);
    const closed = await db.getById(emergency.id);
    expect(+closed.trackingExpiresAt).toBe(+new Date(+closed.createdAt + 24 * 3600_000));
    tick(3600_001);
    expect(await db.getByTokenHash(emergency.trackingTokenHash)).toBeNull();
  });
});
