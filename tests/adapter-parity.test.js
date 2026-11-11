import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMemoryStore } from '../server/db/memory.js';
import { ambulanceRow, emergencyEventRow, emergencyFeedbackRow, emergencyOfferRow, emergencyRow } from '../server/db/postgres.js';

describe('memory/Postgres listing adapter contract', () => {
  it('sorts doctors by experience before pagination and matches the Postgres tie-breaker', async () => {
    const listings = createMemoryStore().listings;
    const all = await listings.doctors({ sort: 'experience', limit: 50 });
    const page = await listings.doctors({ sort: 'experience', offset: 1, limit: 3 });

    expect(all.map((doctor) => doctor.experienceYears)).toEqual([20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8]);
    expect(page.map((doctor) => doctor.id)).toEqual(all.slice(1, 4).map((doctor) => doctor.id));
    expect(page.every((doctor) => doctor.total === all.length)).toBe(true);
  });

  it('keeps doctor coordinates under place and exposes only the Postgres distance field', async () => {
    const [doctor] = await createMemoryStore().listings.doctors({ lat: 17.43, lng: 78.45, sort: 'experience', limit: 1 });

    expect(doctor.place).toMatchObject({ kind: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) });
    expect(doctor.distanceKm).toEqual(expect.any(Number));
    expect(doctor).not.toHaveProperty('lat');
    expect(doctor).not.toHaveProperty('lng');
    expect(doctor).not.toHaveProperty('distance');
  });

  it('returns the documented empty memory test-price collection without inventing prices', async () => {
    expect(await createMemoryStore().listings.testPrices({ limit: 10 })).toEqual([]);
  });

  it('returns null for a duplicate email in memory', async () => {
    const users = createMemoryStore().users;
    await users.create({ name: 'A', email: 'a@example.test', role: 'patient' });

    expect(await users.create({ name: 'B', email: 'a@example.test', role: 'patient' })).toBeNull();
  });

  it('uses an untargeted Postgres conflict clause for all unique user keys', () => {
    const source = readFileSync(new URL('../server/db/postgres.js', import.meta.url), 'utf8');
    expect(source).toMatch(/insert into public\.users[\s\S]*?on conflict do nothing returning \*/i);
    expect(source).not.toMatch(/on conflict \(email\) do nothing/i);
  });
});

describe('memory/Postgres emergency adapter row shapes', () => {
  it('maps canned SQL rows into the same explicit shapes the memory store returns', async () => {
    const store = createMemoryStore({ now: () => new Date('2026-11-04T12:00:00Z') });
    const mem = store.emergencies;
    const row = await mem.createEmergency({ patientUserId: 'patient-1', emergencyType: 'accident', location: { lat: 17.43, lng: 78.45 }, trackingTokenHash: 'hash-placeholder-for-test' });
    const sqlRow = emergencyRow({ id: row.id, patient_user_id: row.patientUserId, guest_phone: null, for_self: true, emergency_type: 'accident', conscious: null,
      patient_count: 1, ambulance_type: 'BLS', notes: null, patient_lat: 17.43, patient_lng: 78.45, patient_address: null, status: 'matching', ambulance_id: null,
      eta_seconds: null, eta_is_estimate: true, offers_made: 0, tracking_token_hash: row.trackingTokenHash, tracking_expires_at: row.trackingExpiresAt,
      cancel_reason: null, is_demo: true, created_at: row.createdAt, assigned_at: null, en_route_at: null, arrived_at: null, picked_up_at: null,
      at_hospital_at: null, completed_at: null, closed_at: null, updated_at: row.updatedAt });
    expect(sqlRow).toEqual(row);
    const [memoryAmbulance] = await mem.listAmbulances();
    const mappedAmbulance = ambulanceRow({ id: memoryAmbulance.id, driver_user_id: null, registration_number: memoryAmbulance.registrationNumber, type: memoryAmbulance.type,
      status: memoryAmbulance.status, operator_name: memoryAmbulance.operatorName, driver_name: memoryAmbulance.driverName, driver_phone: null, is_demo: true,
      lat: memoryAmbulance.lat, lng: memoryAmbulance.lng, heading_degrees: memoryAmbulance.heading, speed_kmph: memoryAmbulance.speedKmph,
      last_ping_at: memoryAmbulance.lastPingAt, created_at: memoryAmbulance.createdAt, updated_at: memoryAmbulance.updatedAt });
    expect(mappedAmbulance).toEqual(memoryAmbulance);
    expect(emergencyOfferRow({ id: 'offer', emergency_id: row.id, ambulance_id: memoryAmbulance.id, rank: 1, eta_seconds: '90', state: 'open', offered_at: row.createdAt, expires_at: row.trackingExpiresAt, created_at: row.createdAt })).toMatchObject({ emergencyId: row.id, etaSeconds: 90 });
    expect(emergencyEventRow({ id: 'event', emergency_id: row.id, kind: 'created', actor_role: 'patient', actor_user_id: 'patient-1', data: null, created_at: row.createdAt })).toMatchObject({ emergencyId: row.id, actorRole: 'patient', data: {} });
    expect(emergencyFeedbackRow({ emergency_id: row.id, rating: 5, comment: null, created_at: row.createdAt })).toMatchObject({ emergencyId: row.id, rating: 5 });
  });
});
