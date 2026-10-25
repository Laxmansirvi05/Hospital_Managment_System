// The three search areas (D-36): hospitals and doctors, medicines and pharmacies,
// diagnostic centres. Read only. Data comes from online platforms (D-35).
import { z } from 'zod';
import { getStore } from '../db/index.js';
import { parse, notFound, invalid } from '../http.js';
import { limit, clientIp, LIMITS } from '../limits.js';

// Q-27 is open, so search needs a signed-in account for now (docs/09-security.md section 5).
const SIGNED_IN = ['patient', 'driver', 'admin'];

const flag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');
const searchQuery = z.object({
  q: z.string().trim().max(80).optional(),
  // Areas come from the listings themselves (D-50), so any name the /areas list returns is accepted.
  area: z.string().trim().min(1).max(80).optional(),
  lat: z.coerce.number().min(-90, 'location latitude must be between -90 and 90').max(90, 'location latitude must be between -90 and 90').optional(),
  lng: z.coerce.number().min(-180, 'location longitude must be between -180 and 180').max(180, 'location longitude must be between -180 and 180').optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  speciality: z.string().trim().max(60).optional(),
  specialization: z.string().trim().max(60).optional(),
  emergencyOnly: flag.optional(),
  open24: flag.optional(),
  test: z.string().trim().max(60).optional(),
}).strict().refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Send both lat and lng for location', path: ['location'] });

function q(query) {
  const raw = Object.fromEntries([...query.entries()].filter(([, v]) => v !== ''));
  return parse(searchQuery, raw);
}

function uuid(params) {
  const r = z.string().uuid().safeParse(params.id);
  if (!r.success) throw notFound();
  return r.data;
}

async function found(promise) {
  const row = await promise;
  if (!row) throw notFound();
  return row;
}

// Explicit field lists for every listing type.
const base = (x) => ({
  id: x.id, name: x.name, area: x.area, address: x.address, location: { lat: x.lat, lng: x.lng },
  phone: x.phone ?? null, email: x.email ?? null, website: x.website ?? null,
  rating: x.rating ?? null, ratingCount: x.ratingCount ?? null,
  source: { platform: x.sourcePlatform, url: x.sourceUrl, checkedAt: x.checkedAt },
  ...(x.distanceKm !== undefined ? { distanceKm: x.distanceKm } : {}),
});
export const hospitalView = (x) => ({ ...base(x), description: x.description, emergencyAvailable: x.emergencyAvailable, specialities: x.specialities, departments: x.departments });
export const doctorView = (d) => ({
  id: d.id, name: d.name, title: d.title ?? '', specialization: d.specialization, qualifications: d.qualifications, experienceYears: d.experienceYears,
  publishedTimings: d.publishedTimings, profileUrl: d.profileUrl, rating: d.rating ?? null, ratingCount: d.ratingCount ?? null,
  place: { kind: d.place.kind, id: d.place.id, name: d.place.name, area: d.place.area, address: d.place.address, phone: d.place.phone, location: { lat: d.place.lat, lng: d.place.lng } },
  source: { platform: d.sourcePlatform, url: d.sourceUrl, checkedAt: d.checkedAt },
  ...(d.distanceKm !== undefined ? { distanceKm: d.distanceKm } : {}),
});
export const pharmacyView = (x) => ({ ...base(x), hours: x.hours, open24: x.open24 });
export const diagnosticView = (x) => ({ ...base(x), hours: x.hours, description: x.description, testsListed: x.testsListed });
export const medicineView = (m) => ({
  id: m.id, name: m.name, form: m.form, pack: m.pack, prescriptionRequired: m.prescriptionRequired,
  listings: m.listings.map((l) => ({ platform: l.platform, priceInr: l.priceInr, productUrl: l.productUrl, checkedAt: l.checkedAt })),
});

const ROUTES = [
  { method: 'GET', path: '/areas', roles: SIGNED_IN, async handler() { return { body: { areas: await getStore().listings.areas() } }; } },

  {
    method: 'GET', path: '/hospitals/nearby', roles: SIGNED_IN,
    async handler({ query }) {
      const p = q(query);
      if (p.lat === undefined) throw invalid('location', 'location lat and lng are required');
      return { body: { hospitals: (await getStore().listings.hospitals({ ...p, radiusKm: p.radiusKm ?? 10 })).map(hospitalView) } };
    },
  },
  { method: 'GET', path: '/hospitals', roles: SIGNED_IN, async handler({ query }) { return { body: { hospitals: (await getStore().listings.hospitals(q(query))).map(hospitalView) } }; } },
  { method: 'GET', path: '/hospitals/:id', roles: SIGNED_IN, async handler({ params }) { return { body: hospitalView(await found(getStore().listings.hospital(uuid(params)))) }; } },
  {
    method: 'GET', path: '/hospitals/:id/doctors', roles: SIGNED_IN,
    async handler({ params, query }) {
      const id = uuid(params);
      await found(getStore().listings.hospital(id));
      const spec = parse(z.string().trim().max(60).optional(), query.get('specialization') || undefined);
      return { body: { doctors: (await getStore().listings.hospitalDoctors(id, spec)).map(doctorView) } };
    },
  },

  { method: 'GET', path: '/doctors', roles: SIGNED_IN, async handler({ query }) { return { body: { doctors: (await getStore().listings.doctors(q(query))).map(doctorView) } }; } },
  { method: 'GET', path: '/doctors/:id', roles: SIGNED_IN, async handler({ params }) { return { body: doctorView(await found(getStore().listings.doctor(uuid(params)))) }; } },

  { method: 'GET', path: '/medicines', roles: SIGNED_IN, async handler({ query }) { return { body: { medicines: (await getStore().listings.medicines(q(query))).map(medicineView) } }; } },
  { method: 'GET', path: '/medicines/:id', roles: SIGNED_IN, async handler({ params }) { return { body: medicineView(await found(getStore().listings.medicine(uuid(params)))) }; } },

  { method: 'GET', path: '/pharmacies', roles: SIGNED_IN, async handler({ query }) { return { body: { pharmacies: (await getStore().listings.pharmacies(q(query))).map(pharmacyView) } }; } },
  { method: 'GET', path: '/pharmacies/:id', roles: SIGNED_IN, async handler({ params }) { return { body: pharmacyView(await found(getStore().listings.pharmacy(uuid(params)))) }; } },

  { method: 'GET', path: '/diagnostic-centres', roles: SIGNED_IN, async handler({ query }) { return { body: { diagnosticCentres: (await getStore().listings.diagnostics(q(query))).map(diagnosticView) } }; } },
  { method: 'GET', path: '/diagnostic-centres/:id', roles: SIGNED_IN, async handler({ params }) { return { body: diagnosticView(await found(getStore().listings.diagnostic(uuid(params)))) }; } },
];

// Every discovery route is rate limited per IP before it runs (docs/09-security.md section 7).
export const routes = ROUTES.map((r) => ({
  ...r,
  async handler(ctx) {
    await limit('search-ip', clientIp(ctx.req), ...LIMITS.searchPerIp);
    return r.handler(ctx);
  },
}));
