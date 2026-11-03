import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../server/db/memory.js';

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
});
