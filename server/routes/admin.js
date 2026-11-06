// Platform admin API (D-29, D-83; P-18, P-22, P-28). Emergency operations live in emergencies.js.
// What no route here may return: a medical ID, a report, a document, an assistant conversation,
// emergency notes, a password hash or a review's author. Every write is audited by the store.
import { z } from 'zod';
import { getStore } from '../db/index.js';
import { LISTING_KINDS } from '../db/admin-kinds.js';
import { parse, readJson, notFound, invalid, conflict, forbidden } from '../http.js';
import { limit } from '../limits.js';

const ADMIN = ['admin'];
const uuid = z.string().uuid();
const kindSchema = z.enum(LISTING_KINDS);

// Listings are Hyderabad-first. A point outside this box is almost always swapped or mistyped coordinates.
const HYDERABAD = { south: 16.9, north: 17.8, west: 78.0, east: 79.0 };
const lat = z.number().min(HYDERABAD.south, 'Latitude is outside Hyderabad').max(HYDERABAD.north, 'Latitude is outside Hyderabad');
const lng = z.number().min(HYDERABAD.west, 'Longitude is outside Hyderabad').max(HYDERABAD.east, 'Longitude is outside Hyderabad');

const text = (max, min = 1) => z.string().trim().min(min, 'This is required').max(max, `Keep it under ${max} characters`);
const optionalText = (max) => z.string().trim().max(max, `Keep it under ${max} characters`);
const phone = z.string().trim().regex(/^\+?[0-9][0-9 ()-]{4,30}$/, 'Enter a valid phone number').nullable();
const httpUrl = z.string().trim().max(500).regex(/^https?:\/\/\S+$/, 'Use a web address that starts with http:// or https://').nullable();
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/\S+$/, 'Use a web address that starts with https://').nullable();
const list = (max = 80) => z.array(text(max)).max(40, 'Too many entries');
const checkedAt = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the form YYYY-MM-DD').refine((d) => !Number.isNaN(Date.parse(d)) && d <= new Date().toISOString().slice(0, 10), 'The date cannot be in the future');

const shared = {
  name: text(160), area: text(80), address: text(300), lat, lng, phone, email: z.string().trim().email('Enter a valid email address').max(254).nullable(),
  website: httpUrl, sourcePlatform: text(80), sourceUrl: httpUrl, checkedAt,
};
const FACILITY_TYPES = ['hospital', 'clinic', 'nursing_home', 'dental', 'eye', 'maternity', 'ayush'];
const base = {
  hospital: z.object({ ...shared, facilityType: z.enum(FACILITY_TYPES), description: optionalText(1000), emergencyAvailable: z.boolean(), specialities: list(), departments: list() }).strict(),
  pharmacy: z.object({ ...shared, chain: text(80).nullable(), hours: optionalText(120), open24: z.boolean() }).strict(),
  diagnostic_centre: z.object({ ...shared, description: optionalText(1000), hours: optionalText(120), testsListed: list(120) }).strict(),
  doctor: z.object({
    name: text(160), title: optionalText(160), specialization: text(120), qualifications: list(), experienceYears: z.number().int().min(0).max(70).nullable(),
    hospitalId: uuid.nullable(), clinic: z.object({ name: text(160), area: text(80), address: text(300), phone, lat, lng }).strict().nullable(),
    publishedTimings: optionalText(300), profileUrl: httpUrl, appointmentPhone: phone, languages: list(40), expertise: list(), bookingUrl: httpsUrl,
    consultationFeeInr: z.number().min(0).max(100000).nullable(), sourcePlatform: text(80), sourceUrl: httpUrl, checkedAt,
  }).strict(),
};
// Required on create; everything else takes the default below. Update schemas take any subset.
const REQUIRED = {
  hospital: ['name', 'area', 'address', 'lat', 'lng'], pharmacy: ['name', 'area', 'address', 'lat', 'lng'],
  diagnostic_centre: ['name', 'area', 'address', 'lat', 'lng'], doctor: ['name', 'specialization'],
};
const DEFAULTS = {
  hospital: { phone: null, email: null, website: null, sourceUrl: null, facilityType: 'hospital', description: '', emergencyAvailable: false, specialities: [], departments: [] },
  pharmacy: { phone: null, email: null, website: null, sourceUrl: null, chain: null, hours: '', open24: false },
  diagnostic_centre: { phone: null, email: null, website: null, sourceUrl: null, description: '', hours: '', testsListed: [] },
  doctor: { title: '', qualifications: [], experienceYears: null, hospitalId: null, clinic: null, publishedTimings: '', profileUrl: null, appointmentPhone: null, languages: [], expertise: [], bookingUrl: null, consultationFeeInr: null, sourceUrl: null },
};
const coords = (d) => (d.lat === undefined) === (d.lng === undefined);
const workplace = (d) => !(d.hospitalId && d.clinic);

function createSchema(kind) {
  const required = Object.fromEntries(REQUIRED[kind].map((k) => [k, true]));
  let s = base[kind].partial().required(required);
  s = s.refine(coords, { message: 'Give latitude and longitude together', path: ['lat'] });
  if (kind === 'doctor') s = s.refine((d) => !!d.hospitalId !== !!d.clinic, { message: 'Choose either a hospital or a clinic', path: ['hospitalId'] });
  return s;
}
function updateSchema(kind) {
  let s = base[kind].partial().refine((d) => Object.keys(d).length > 0, { message: 'Nothing to change', path: ['name'] }).refine(coords, { message: 'Give latitude and longitude together', path: ['lat'] });
  if (kind === 'doctor') s = s.refine(workplace, { message: 'Choose either a hospital or a clinic', path: ['hospitalId'] });
  return s;
}
const CREATE = Object.fromEntries(LISTING_KINDS.map((k) => [k, createSchema(k)]));
const UPDATE = Object.fromEntries(LISTING_KINDS.map((k) => [k, updateSchema(k)]));

const paging = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) });
const q = (query, name) => query.get(name) || undefined;
const search = z.string().trim().max(100).optional();

function kindOf(params) {
  const r = kindSchema.safeParse(params.kind);
  if (!r.success) throw notFound();
  return r.data;
}
function idOf(params, name = 'id') {
  const r = uuid.safeParse(params[name]);
  if (!r.success) throw notFound();
  return r.data;
}
const REASONS = {
  not_found: () => notFound(),
  self: () => forbidden('cannot_disable_self', 'You cannot disable your own account.'),
  last_admin: () => conflict('last_admin', 'This is the last active admin account.'),
  already: () => conflict('no_change', 'Nothing to change.'),
  hospital_missing: () => invalid('hospitalId', 'Choose a hospital that exists.'),
};
function check(result) {
  if (!result.ok) throw REASONS[result.reason]();
  return result;
}
async function writeGate(user) { await limit('admin-write', user.id, 300, 3600); }
/** A database refusal (bad reference, check constraint) is the admin's input problem, not a crash. */
function mapDbError(err) {
  if (err?.code === '23514') throw invalid('name', 'These values do not fit together. Check the workplace and required fields.');
  if (err?.code === '23503') throw invalid('hospitalId', 'Choose a hospital that exists.');
  if (err?.code === '23505') throw conflict('duplicate', 'A record with these details already exists.');
  throw err;
}

export const routes = [
  { method: 'GET', path: '/admin/overview', roles: ADMIN, async handler() { return { body: await getStore().admin.overview() }; } },

  { method: 'GET', path: '/admin/users', roles: ADMIN, async handler({ query }) {
    const f = parse(z.object({ q: search, role: z.enum(['patient', 'driver', 'admin']).optional(), status: z.enum(['active', 'disabled']).optional() }).extend(paging.shape),
      { q: q(query, 'q'), role: q(query, 'role'), status: q(query, 'status'), limit: q(query, 'limit'), offset: q(query, 'offset') });
    const { total, rows } = await getStore().admin.listUsers(f);
    return { body: { total, users: rows } };
  } },
  { method: 'POST', path: '/admin/users/:id/disable', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    check(await getStore().admin.disableUser(idOf(params), user.id));
    return { body: { user: await getStore().admin.getUser(idOf(params)) } };
  } },
  { method: 'POST', path: '/admin/users/:id/enable', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    check(await getStore().admin.enableUser(idOf(params), user.id));
    return { body: { user: await getStore().admin.getUser(idOf(params)) } };
  } },

  { method: 'GET', path: '/admin/listings', roles: ADMIN, async handler({ query }) {
    const f = parse(z.object({ kind: kindSchema.optional(), q: search, status: z.enum(['active', 'hidden']).optional(), area: z.string().trim().max(80).optional() }).extend(paging.shape),
      { kind: q(query, 'kind'), q: q(query, 'q'), status: q(query, 'status'), area: q(query, 'area'), limit: q(query, 'limit'), offset: q(query, 'offset') });
    const { total, rows } = await getStore().admin.listListings(f);
    return { body: { total, listings: rows } };
  } },
  { method: 'GET', path: '/admin/hospital-choices', roles: ADMIN, async handler({ query }) {
    const f = parse(z.object({ q: search, limit: z.coerce.number().int().min(1).max(50).default(20) }), { q: q(query, 'q'), limit: q(query, 'limit') });
    return { body: { hospitals: await getStore().admin.hospitalChoices(f) } };
  } },
  { method: 'GET', path: '/admin/listings/:kind/:id', roles: ADMIN, async handler({ params }) {
    const listing = await getStore().admin.getListing(kindOf(params), idOf(params));
    if (!listing) throw notFound();
    return { body: { listing } };
  } },
  { method: 'POST', path: '/admin/listings/:kind', roles: ADMIN, async handler({ params, req, user }) {
    await writeGate(user);
    const kind = kindOf(params);
    const body = parse(CREATE[kind], await readJson(req));
    try {
      const { listing } = check(await getStore().admin.createListing(kind, { ...DEFAULTS[kind], ...body }, user.id));
      return { status: 201, body: { listing } };
    } catch (err) { return mapDbError(err); }
  } },
  { method: 'PATCH', path: '/admin/listings/:kind/:id', roles: ADMIN, async handler({ params, req, user }) {
    await writeGate(user);
    const kind = kindOf(params); const id = idOf(params);
    const body = parse(UPDATE[kind], await readJson(req));
    const existing = await getStore().admin.getListing(kind, id);
    if (!existing) throw notFound();
    try {
      const { listing } = check(await getStore().admin.updateListing(kind, id, body, user.id, `Edited "${existing.name}": ${Object.keys(body).join(', ')}`));
      return { body: { listing } };
    } catch (err) { return mapDbError(err); }
  } },
  { method: 'POST', path: '/admin/listings/:kind/:id/hide', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    const { listing } = check(await getStore().admin.setListingActive(kindOf(params), idOf(params), false, user.id));
    return { body: { listing } };
  } },
  { method: 'POST', path: '/admin/listings/:kind/:id/unhide', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    const { listing } = check(await getStore().admin.setListingActive(kindOf(params), idOf(params), true, user.id));
    return { body: { listing } };
  } },

  { method: 'GET', path: '/admin/reviews', roles: ADMIN, async handler({ query }) {
    const f = parse(z.object({ status: z.enum(['hidden', 'reported', 'all']).default('hidden') }).extend(paging.shape),
      { status: q(query, 'status'), limit: q(query, 'limit'), offset: q(query, 'offset') });
    const { total, rows } = await getStore().admin.listReviews(f);
    return { body: { total, reviews: rows } };
  } },
  { method: 'POST', path: '/admin/reviews/:id/restore', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    check(await getStore().admin.restoreReview(idOf(params), user.id));
    return { status: 204 };
  } },
  { method: 'DELETE', path: '/admin/reviews/:id', roles: ADMIN, async handler({ params, user }) {
    await writeGate(user);
    check(await getStore().admin.deleteReview(idOf(params), user.id));
    return { status: 204 };
  } },

  // Read only. Listing facts, no people; the 180 day line is P-31 until the owner settles it.
  { method: 'GET', path: '/admin/data-quality', roles: ADMIN, async handler() { return { body: await getStore().admin.dataQuality({ staleAfterDays: 180 }) }; } },

  { method: 'GET', path: '/admin/audit', roles: ADMIN, async handler({ query }) {
    const f = parse(z.object({ action: z.string().trim().max(60).optional(), targetKind: z.enum(['user', ...LISTING_KINDS, 'review']).optional() }).extend(paging.shape),
      { action: q(query, 'action'), targetKind: q(query, 'targetKind'), limit: q(query, 'limit'), offset: q(query, 'offset') });
    const { total, rows } = await getStore().admin.listAudit(f);
    return { body: { total, entries: rows } };
  } },
];
