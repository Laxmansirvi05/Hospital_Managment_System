import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { authenticate } from '../auth/session.js';
import { hashToken } from '../auth/crypto.js';
import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { parse, readJson, notFound, invalid, conflict, forbidden, unauthorized } from '../http.js';
import { clientIp, limit } from '../limits.js';
import { phoneSchema } from './auth.js';
import { getEmergencyService } from '../emergency/runtime.js';
import { distanceKm } from '../db/geo.js';

const PATIENT = ['patient']; const DRIVER = ['driver']; const ADMIN = ['admin'];
const uuid = z.string().uuid();
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict();
const type = z.enum(['cardiac', 'accident', 'breathing', 'stroke', 'pregnancy', 'other']);
const ambulanceType = z.enum(['BLS', 'ALS', 'ICU']);
const nearbySchema = z.object({
  type: ambulanceType.optional(), lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional(), radiusKm: z.coerce.number().min(1).max(100).default(10),
}).strict().refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Give latitude and longitude together', path: ['lat'] });
const sosSchema = z.object({ emergencyType: type.default('other'), forSelf: z.boolean().default(true), conscious: z.boolean().nullable().default(null),
  patientCount: z.number().int().min(1).max(20).default(1), ambulanceType: ambulanceType.default('BLS'), notes: z.string().trim().max(500).default(''),
  location: point, address: z.string().trim().max(300).default(''), guestPhone: phoneSchema.optional() }).strict();
const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).default('') }).strict();
const statusSchema = z.object({ status: z.enum(['en_route', 'arrived', 'picked_up', 'at_hospital', 'completed']) }).strict();
const statusBody = z.object({ status: z.enum(['available', 'offline']) }).strict();
const locationBody = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), heading: z.number().int().min(0).max(359).nullable().default(null), speed: z.number().min(0).max(250).nullable().default(null) }).strict();

const publicSummary = (e) => ({ id: e.id, status: e.status, emergencyType: e.emergencyType, patientCount: e.patientCount, ambulanceType: e.ambulanceType, etaSeconds: e.etaSeconds, etaIsEstimate: e.etaIsEstimate, createdAt: e.createdAt });
const ambulancePosition = (a) => a ? { lat: a.lat, lng: a.lng, heading: a.heading } : null;
function tokenHash(token) { return hashToken(token, getConfig().pepper); }
function hashPhone(phone) { return hashToken(phone, getConfig().pepper); }
async function optionalUser(req) {
  const session = await authenticate(req);
  if (session?.viaCookie && req.headers['x-careroute-csrf'] !== '1') throw forbidden('csrf_failed', 'Missing request header.');
  return session?.user ?? null;
}
function requireRole(user, role) { if (!user) throw unauthorized(); if (user.role !== role) throw forbidden('role_not_allowed', 'Your account cannot do this.'); }
async function patientOwned(ctx) {
  const id = uuid.parse(ctx.params.id);
  const emergency = await getEmergencyService().read(id);
  if (!emergency || emergency.patientUserId !== ctx.user.id) throw notFound();
  return emergency;
}
const validToken = (value) => /^[A-Za-z0-9_-]{32,100}$/.test(value);

export const routes = [
  { method: 'POST', path: '/emergencies', roles: 'public', async handler(ctx) {
    const user = await optionalUser(ctx.req);
    if (user && user.role !== 'patient') throw forbidden('role_not_allowed', 'Your account cannot do this.');
    const body = parse(sosSchema, await readJson(ctx.req));
    if (!user && !body.guestPhone) throw invalid('guestPhone', 'Enter a phone number to request a demo.');
    if (!user) { await limit('guest-sos-phone', hashPhone(body.guestPhone), 3, 3600); await limit('guest-sos-ip', clientIp(ctx.req), 3, 3600); }
    const trackingToken = randomBytes(32).toString('base64url');
    const contacts = user ? await getStore().contacts.list(user.id) : [];
    const url = new URL(`/track/?token=${encodeURIComponent(trackingToken)}`, `${ctx.url.protocol}//${ctx.req.headers.host}`).toString();
    const emergency = await getEmergencyService().create({ ...body, patientUserId: user?.id ?? null, guestPhone: user ? null : body.guestPhone,
      trackingTokenHash: tokenHash(trackingToken), contacts, trackingUrl: url });
    return { status: 201, body: { emergency: publicSummary(emergency), trackingToken } };
  } },
  { method: 'GET', path: '/emergencies/active', roles: PATIENT, async handler({ user }) { const e = await getEmergencyService().activeForPatient(user.id); return { body: { emergency: e ? publicSummary(e) : null } }; } },
  { method: 'GET', path: '/emergencies', roles: PATIENT, async handler({ user, query }) {
    const limitCount = parse(z.coerce.number().int().min(1).max(100).default(25), query.get('limit') ?? undefined);
    const offset = parse(z.coerce.number().int().min(0).max(10000).default(0), query.get('offset') ?? undefined);
    const rows = await getEmergencyService().history(user.id, { limit: limitCount, offset }); return { body: { emergencies: rows.map(publicSummary) } };
  } },
  { method: 'GET', path: '/emergencies/:id', roles: PATIENT, async handler(ctx) {
    const emergency = await patientOwned(ctx); const db = getStore().emergencies;
    const ambulance = emergency.ambulanceId ? (await db.listAmbulances()).find((a) => a.id === emergency.ambulanceId) : null;
    const timeline = await db.timeline(emergency.id);
    return { body: { emergency: { ...publicSummary(emergency), location: emergency.location, address: emergency.address,
      ambulance: ambulance ? { type: ambulance.type, registrationNumber: ambulance.registrationNumber, ...(emergency.status !== 'matching' && !ambulance.isDemo ? { firstName: ambulance.driverName, phone: ambulance.driverPhone } : {}), position: ambulancePosition(ambulance) } : null,
      timeline: timeline.map((e) => ({ kind: e.kind, createdAt: e.createdAt, data: e.kind === 'status_changed' ? e.data : undefined })) } } };
  } },
  { method: 'POST', path: '/emergencies/:id/cancel', roles: PATIENT, async handler(ctx) {
    const emergency = await patientOwned(ctx); const result = await getStore().emergencies.cancelEmergency(emergency.id, 'patient_cancelled');
    if (!result) throw conflict('cannot_cancel', 'This request can no longer be cancelled.'); return { body: { emergency: publicSummary(result) } };
  } },
  { method: 'POST', path: '/emergencies/:id/feedback', roles: PATIENT, async handler(ctx) {
    const emergency = await patientOwned(ctx); const body = parse(feedbackSchema, await readJson(ctx.req));
    const result = await getStore().emergencies.addFeedback(emergency.id, body);
    if (!result) throw conflict('feedback_unavailable', 'Feedback is available after a completed trip.'); return { status: 201, body: { feedback: { rating: result.rating, comment: result.comment, createdAt: result.createdAt } } };
  } },
  { method: 'GET', path: '/track/:token', roles: 'public', async handler({ params }) {
    if (!validToken(params.token)) throw notFound();
    const emergency = await getEmergencyService().readTracking(tokenHash(params.token)); if (!emergency) throw notFound('This tracking link has expired.');
    const ambulance = emergency.ambulanceId ? (await getStore().emergencies.listAmbulances()).find((a) => a.id === emergency.ambulanceId) : null;
    return { body: { status: emergency.status, ambulance: ambulancePosition(ambulance), etaSeconds: emergency.etaSeconds, etaIsEstimate: emergency.etaIsEstimate, demo: true } };
  } },
  { method: 'POST', path: '/track/:token/cancel', roles: 'public', async handler(ctx) {
    if (!validToken(ctx.params.token)) throw notFound();
    const emergency = await getStore().emergencies.getByTokenHash(tokenHash(ctx.params.token)); if (!emergency || emergency.patientUserId) throw notFound();
    const result = await getStore().emergencies.cancelEmergency(emergency.id, 'guest_cancelled');
    if (!result) throw conflict('cannot_cancel', 'This request can no longer be cancelled.'); return { body: { status: result.status } };
  } },
  { method: 'GET', path: '/driver/me', roles: DRIVER, async handler({ user }) {
    requireRole(user, 'driver');
    await getEmergencyService().driverOffers(user.id); const ambulance = await getStore().emergencies.ambulanceByDriver(user.id); if (!ambulance) throw notFound();
    return { body: { ambulance: { id: ambulance.id, type: ambulance.type, registrationNumber: ambulance.registrationNumber, status: ambulance.status, position: ambulancePosition(ambulance) } } };
  } },
  { method: 'PUT', path: '/driver/me/status', roles: DRIVER, async handler(ctx) {
    requireRole(ctx.user, 'driver');
    const body = parse(statusBody, await readJson(ctx.req)); const ambulance = await getStore().emergencies.ambulanceByDriver(ctx.user.id); if (!ambulance) throw notFound();
    const updated = await getStore().emergencies.setAmbulanceStatus(ambulance.id, body.status); return { body: { status: updated.status } };
  } },
  { method: 'PUT', path: '/driver/me/location', roles: DRIVER, async handler(ctx) {
    requireRole(ctx.user, 'driver');
    const body = parse(locationBody, await readJson(ctx.req)); const ambulance = await getStore().emergencies.ambulanceByDriver(ctx.user.id); if (!ambulance) throw notFound();
    await limit('driver-ping', ambulance.id, 40, 60);
    const updated = await getStore().emergencies.updateAmbulanceLocation(ambulance.id, body); return { body: { status: 'ok', position: ambulancePosition(updated) } };
  } },
  { method: 'GET', path: '/driver/offers', roles: DRIVER, async handler({ user }) {
    requireRole(user, 'driver');
    const { ambulance, offer } = await getEmergencyService().driverOffers(user.id); if (!ambulance) throw notFound(); if (!offer) return { body: { offer: null } };
    // Before the driver accepts, an offer says only what is needed to decide: what kind of emergency, how many
    // people and how far away. The exact place, address, notes and any shared medical ID come with the trip
    // after accepting, so a driver account made to browse requests learns nothing about the patient (D-84).
    const e = await getStore().emergencies.getById(offer.emergencyId);
    const away = Number.isFinite(ambulance.lat) && Number.isFinite(ambulance.lng) && e.location ? Math.round(distanceKm({ lat: ambulance.lat, lng: ambulance.lng }, e.location) * 10) / 10 : null;
    return { body: { offer: { emergencyId: e.id, emergencyType: e.emergencyType, conscious: e.conscious, patientCount: e.patientCount, distanceKm: away,
      secondsRemaining: Math.max(0, Math.ceil((+offer.expiresAt - Date.now()) / 1000)) } } };
  } },
  { method: 'POST', path: '/driver/offers/:emergencyId/accept', roles: DRIVER, async handler(ctx) {
    requireRole(ctx.user, 'driver');
    const ambulance = await getStore().emergencies.ambulanceByDriver(ctx.user.id); if (!ambulance) throw notFound(); const id = uuid.parse(ctx.params.emergencyId);
    const e = await getStore().emergencies.acceptEmergency(id, ambulance.id); if (!e) throw conflict('offer_unavailable', 'This offer is no longer available.'); return { body: { emergency: publicSummary(e) } };
  } },
  { method: 'POST', path: '/driver/offers/:emergencyId/reject', roles: DRIVER, async handler(ctx) {
    requireRole(ctx.user, 'driver');
    const ambulance = await getStore().emergencies.ambulanceByDriver(ctx.user.id); if (!ambulance) throw notFound(); const id = uuid.parse(ctx.params.emergencyId);
    const e = await getStore().emergencies.declineOffer(id, ambulance.id); if (!e) throw conflict('offer_unavailable', 'This offer is no longer available.'); return { body: { status: e.status } };
  } },
  { method: 'GET', path: '/driver/trips/active', roles: DRIVER, async handler({ user }) {
    requireRole(user, 'driver');
    await getEmergencyService().tick(); const a = await getStore().emergencies.ambulanceByDriver(user.id); if (!a) throw notFound(); const e = await getStore().emergencies.activeForAmbulance(a.id);
    if (!e) return { body: { emergency: null } };
    const profile = e.patientUserId ? await getStore().profiles.get(e.patientUserId) : null;
    return { body: { emergency: { ...publicSummary(e), location: e.location, address: e.address, conscious: e.conscious, notes: e.notes,
      ...(profile?.shareWithCrew ? { medicalId: { fullName: profile.fullName, bloodGroup: profile.bloodGroup, allergies: profile.allergies, conditions: profile.conditions, currentMedicines: profile.currentMedicines } } : {}) } } };
  } },
  { method: 'POST', path: '/driver/trips/:emergencyId/status', roles: DRIVER, async handler(ctx) {
    requireRole(ctx.user, 'driver');
    const body = parse(statusSchema, await readJson(ctx.req)); const a = await getStore().emergencies.ambulanceByDriver(ctx.user.id); if (!a) throw notFound(); const id = uuid.parse(ctx.params.emergencyId);
    const e = await getStore().emergencies.advanceEmergency(id, a.id, body.status); if (!e) throw conflict('invalid_transition', 'Only the next trip step is allowed.'); return { body: { emergency: publicSummary(e) } };
  } },
  { method: 'POST', path: '/driver/me/release', roles: DRIVER, async handler({ user }) {
    requireRole(user, 'driver');
    const a = await getStore().emergencies.ambulanceByDriver(user.id); if (!a) throw notFound(); if (!(await getStore().emergencies.releaseAmbulance(a.id))) throw conflict('cannot_release', 'Finish the active trip before releasing the ambulance.'); return { body: { status: 'available' } };
  } },
  { method: 'GET', path: '/admin/emergencies', roles: ADMIN, async handler({ query }) {
    const status = query.get('status'); if (status && !['matching', 'assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed', 'cancelled', 'no_match'].includes(status)) throw invalid('status', 'Choose a valid status.');
    return { body: { emergencies: (await getEmergencyService().adminList({ status })).map((e) => ({ id: e.id, status: e.status, emergencyType: e.emergencyType, createdAt: e.createdAt, assignedAt: e.assignedAt, arrivedAt: e.arrivedAt, isDemo: e.isDemo })) } };
  } },
  { method: 'GET', path: '/admin/emergencies/:id', roles: ADMIN, async handler(ctx) {
    const e = await getEmergencyService().read(uuid.parse(ctx.params.id)); if (!e) throw notFound(); return { body: { emergency: { id: e.id, status: e.status, emergencyType: e.emergencyType, location: e.location, createdAt: e.createdAt, timeline: (await getStore().emergencies.timeline(e.id)).map((event) => ({ kind: event.kind, actorRole: event.actorRole, createdAt: event.createdAt })) } } };
  } },
  { method: 'GET', path: '/admin/ambulances', roles: ADMIN, async handler({ query }) {
    // F-17: with a point, only available crews inside the radius, nearest first. Without one, every crew.
    const f = parse(nearbySchema, Object.fromEntries(['type', 'lat', 'lng', 'radiusKm'].map((k) => [k, query.get(k) ?? undefined])));
    await getEmergencyService().tick();
    const all = (await getStore().emergencies.listAmbulances()).filter((a) => !f.type || a.type === f.type);
    const row = (a) => ({ id: a.id, type: a.type, status: a.status, position: ambulancePosition(a), isDemo: a.isDemo });
    if (f.lat === undefined) return { body: { ambulances: all.map(row) } };
    const near = all.filter((a) => a.status === 'available' && Number.isFinite(a.lat) && Number.isFinite(a.lng))
      .map((a) => ({ a, km: distanceKm({ lat: f.lat, lng: f.lng }, { lat: a.lat, lng: a.lng }) }))
      .filter((x) => x.km <= f.radiusKm).sort((x, y) => x.km - y.km);
    return { body: { ambulances: near.map((x) => ({ ...row(x.a), distanceKm: Math.round(x.km * 10) / 10 })) } };
  } },
  { method: 'GET', path: '/admin/analytics', roles: ADMIN, async handler({}) {
    const all = await getEmergencyService().adminList({ limit: 10000 }); const hours = new Map();
    for (const e of all) { const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).format(e.createdAt); const row = hours.get(key) ?? { hour: key, requested: 0, assignedSeconds: [], arrivedSeconds: [] }; row.requested += 1; if (e.assignedAt) row.assignedSeconds.push((+e.assignedAt - +e.createdAt) / 1000); if (e.arrivedAt) row.arrivedSeconds.push((+e.arrivedAt - +e.createdAt) / 1000); hours.set(key, row); }
    const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
    return { body: { timeZone: 'Asia/Kolkata', totalRequests: all.length, noMatch: all.filter((e) => e.status === 'no_match').length, averageAssignSeconds: average(all.filter((e) => e.assignedAt).map((e) => (+e.assignedAt - +e.createdAt) / 1000)), averageArriveSeconds: average(all.filter((e) => e.arrivedAt).map((e) => (+e.arrivedAt - +e.createdAt) / 1000)), byHour: [...hours.values()].map((x) => ({ hour: x.hour, requested: x.requested, averageAssignSeconds: x.assignedSeconds.length ? x.assignedSeconds.reduce((a, b) => a + b, 0) / x.assignedSeconds.length : null, averageArriveSeconds: x.arrivedSeconds.length ? x.arrivedSeconds.reduce((a, b) => a + b, 0) / x.arrivedSeconds.length : null })) } };
  } },
];
