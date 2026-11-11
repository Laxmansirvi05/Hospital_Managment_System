// In-memory store (P-27). Same interface as postgres.js, used by tests and by the local
// server until DATABASE_URL is set. Nothing survives a restart.
import { randomUUID } from 'node:crypto';
import { AREAS, HOSPITALS, DOCTORS, PHARMACIES, DIAGNOSTICS, MEDICINES } from './seed-data.js';
import { distanceKm, dosesFor } from './geo.js';
import { createMemoryAdmin } from './admin-memory.js';

const clone = (v) => structuredClone(v);
const now = () => new Date();

function matches(text, q) {
  return !q || text.toLowerCase().includes(q.toLowerCase());
}

function near(list, p) {
  let out = list;
  if (p.lat != null && p.lng != null) {
    out = out.map((x) => ({ ...x, distanceKm: +distanceKm(p, x).toFixed(2) }));
    if (p.radiusKm) out = out.filter((x) => x.distanceKm <= p.radiusKm);
    out.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  // Every row carries the count before paging, as the Postgres store does with a window count.
  return out.slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 50)).map((x) => ({ ...x, total: out.length }));
}

export function createMemoryStore(options = {}) {
  const users = new Map();
  const sessions = new Map();
  const limits = new Map();
  const profiles = new Map();
  const contacts = [];
  const reminders = [];
  const doseLogs = [];
  const appointments = [];
  const files = [];
  const reviews = [];
  const conversations = [];
  const messages = [];
  const reports = [];
  const emergencyNow = options.now ?? now;
  const ambulances = new Map();
  const emergencies = new Map();
  const emergencyOffers = [];
  const emergencyEvents = [];
  const emergencyFeedback = new Map();
  const emergencyStatusOrder = ['matching', 'assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital', 'completed'];
  const demoAmbulances = [
    ['DEMO-0001', 'BLS', 'Demo crew Begumpet', 17.4435, 78.4676], ['DEMO-0002', 'ALS', 'Demo crew Secunderabad', 17.4399, 78.4983],
    ['DEMO-0003', 'ICU', 'Demo crew Banjara Hills', 17.4156, 78.4347], ['DEMO-0004', 'BLS', 'Demo crew Jubilee Hills', 17.4326, 78.4071],
    ['DEMO-0005', 'ALS', 'Demo crew HITEC City', 17.4435, 78.3772], ['DEMO-0006', 'BLS', 'Demo crew Gachibowli', 17.4401, 78.3489],
    ['DEMO-0007', 'BLS', 'Demo crew Kukatpally', 17.4948, 78.3996], ['DEMO-0008', 'ALS', 'Demo crew Ameerpet', 17.4375, 78.4482],
    ['DEMO-0009', 'BLS', 'Demo crew Dilsukhnagar', 17.3688, 78.5247], ['DEMO-0010', 'ICU', 'Demo crew LB Nagar', 17.3457, 78.5522],
    ['DEMO-0011', 'BLS', 'Demo crew Charminar', 17.3616, 78.4747], ['DEMO-0012', 'ALS', 'Demo crew Uppal', 17.4058, 78.5591],
  ];
  for (const [registrationNumber, type, driverName, lat, lng] of demoAmbulances) {
    const id = randomUUID();
    ambulances.set(id, { id, driverUserId: null, registrationNumber, type, status: 'available', operatorName: 'CareRoute Demo Crew', driverName, driverPhone: null, isDemo: true, lat, lng, heading: 0, speedKmph: 0, lastPingAt: emergencyNow(), createdAt: emergencyNow(), updatedAt: emergencyNow() });
  }
  for (const row of options.extraAmbulances ?? []) ambulances.set(row.id ?? randomUUID(), { status: 'offline', isDemo: false, ...clone(row) });
  const addEmergencyEvent = (emergencyId, kind, actorRole = 'system', data = {}) => {
    const row = { id: randomUUID(), emergencyId, kind, actorRole, data: clone(data), createdAt: emergencyNow() };
    emergencyEvents.push(row);
    return row;
  };
  const openNextEmergencyOffer = (emergencyId) => {
    const queued = emergencyOffers.filter((offer) => offer.emergencyId === emergencyId && offer.state === 'queued').sort((a, b) => a.rank - b.rank)[0];
    const emergency = emergencies.get(emergencyId);
    if (!emergency) return null;
    if (queued) {
      queued.state = 'open'; queued.offeredAt = emergencyNow(); queued.expiresAt = new Date(+queued.offeredAt + 30_000);
      emergency.offersMade += 1; emergency.updatedAt = emergencyNow();
      addEmergencyEvent(emergencyId, 'offered', 'system', { ambulance_id: queued.ambulanceId, rank: queued.rank });
      return queued;
    }
    if (emergency.status === 'matching') {
      emergency.status = 'no_match'; emergency.closedAt = emergencyNow(); emergency.updatedAt = emergencyNow();
      emergency.trackingExpiresAt = new Date(Math.min(+new Date(+emergency.createdAt + 24 * 3600_000), +new Date(+emergencyNow() + 2 * 3600_000)));
      addEmergencyEvent(emergencyId, 'no_match', 'system');
    }
    return null;
  };
  const hospitals = clone(HOSPITALS);
  const doctors = clone(DOCTORS);
  const pharmacies = clone(PHARMACIES);
  const diagnostics = clone(DIAGNOSTICS);
  // Hidden listings leave the public lists and wait here until an admin shows them again (D-83).
  const hiddenListings = { hospital: [], doctor: [], pharmacy: [], diagnostic_centre: [] };
  const adminAudit = [];
  const resets = [];

  // A hidden hospital still names its doctors' workplace, as the Postgres join does.
  const hospitalOf = (d) => hospitals.find((h) => h.id === d.hospitalId) ?? hiddenListings.hospital.find((h) => h.id === d.hospitalId);
  const doctorView = (d) => {
    const h = hospitalOf(d);
    return {
      ...d,
      place: h ? { kind: 'hospital', id: h.id, name: h.name, area: h.area, lat: h.lat, lng: h.lng, phone: h.phone, address: h.address }
        : { kind: 'clinic', id: null, name: d.clinicName, area: d.area, lat: d.lat, lng: d.lng, phone: d.clinicPhone, address: d.clinicAddress },
    };
  };

  return {
    kind: 'memory',
    admin: createMemoryAdmin({ users, sessions, reviews, reports, lists: { hospital: hospitals, doctor: doctors, pharmacy: pharmacies, diagnostic_centre: diagnostics }, hidden: hiddenListings, audit: adminAudit, resets, ambulances }),
    async close() {},

    emergencies: {
      async nearbyAmbulances({ point, type = 'BLS', radiusKm = 10, maxAgeSeconds = 90, limit = 24 }) {
        const rank = { BLS: 0, ALS: 1, ICU: 2 };
        const cutoff = +emergencyNow() - maxAgeSeconds * 1000;
        return [...ambulances.values()].filter((a) => a.status === 'available' && rank[a.type] >= rank[type] && a.lat != null && a.lng != null
          && distanceKm(point, { lat: a.lat, lng: a.lng }) <= radiusKm && (a.isDemo || +a.lastPingAt > cutoff))
          .map((a) => ({ id: a.id, type: a.type, distanceKm: distanceKm(point, { lat: a.lat, lng: a.lng }), isDemo: a.isDemo }))
          .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, Math.min(Math.max(limit, 1), 24)).map(clone);
      },
      async createEmergency(input) {
        const createdAt = emergencyNow();
        const row = { id: input.id ?? randomUUID(), patientUserId: input.patientUserId ?? null, guestPhone: input.guestPhone ?? null, forSelf: input.forSelf ?? true,
          emergencyType: input.emergencyType ?? 'other', conscious: input.conscious ?? null, patientCount: input.patientCount ?? 1,
          ambulanceType: input.ambulanceType ?? 'BLS', notes: input.notes ?? null, location: clone(input.location), address: input.address ?? null,
          status: 'matching', ambulanceId: null, etaSeconds: input.etaSeconds ?? null, etaIsEstimate: true, offersMade: 0,
          trackingTokenHash: input.trackingTokenHash, trackingExpiresAt: new Date(+createdAt + 24 * 3600_000), cancelReason: null, isDemo: true,
          createdAt, assignedAt: null, enRouteAt: null, arrivedAt: null, pickedUpAt: null, atHospitalAt: null, completedAt: null, closedAt: null, updatedAt: createdAt };
        emergencies.set(row.id, row);
        addEmergencyEvent(row.id, 'created', row.patientUserId ? 'patient' : 'guest');
        return clone(row);
      },
      async createOffers(emergencyId, candidates, etaIsEstimate = true) {
        const emergency = emergencies.get(emergencyId);
        if (!emergency || emergency.status !== 'matching') return null;
        if (emergencyOffers.some((offer) => offer.emergencyId === emergencyId)) return clone(emergency);
        emergency.etaIsEstimate = etaIsEstimate;
        for (const [index, candidate] of candidates.slice(0, 5).entries()) {
          emergencyOffers.push({ id: randomUUID(), emergencyId, ambulanceId: candidate.ambulanceId, rank: index + 1, etaSeconds: candidate.etaSeconds ?? null,
            state: 'queued', offeredAt: null, expiresAt: null, createdAt: emergencyNow() });
        }
        openNextEmergencyOffer(emergencyId);
        return clone(emergency);
      },
      async acceptEmergency(emergencyId, ambulanceId) {
        const emergency = emergencies.get(emergencyId);
        if (!emergency || emergency.status !== 'matching') return null;
        const ambulance = ambulances.get(ambulanceId);
        const offer = emergencyOffers.find((o) => o.emergencyId === emergencyId && o.ambulanceId === ambulanceId && o.state === 'open' && +o.expiresAt > +emergencyNow());
        if (!offer || !ambulance || ambulance.status !== 'available') return null;
        offer.state = 'accepted'; ambulance.status = 'busy'; ambulance.updatedAt = emergencyNow();
        for (const other of emergencyOffers.filter((o) => o.emergencyId === emergencyId && ['queued', 'open'].includes(o.state))) other.state = 'expired';
        emergency.status = 'assigned'; emergency.ambulanceId = ambulanceId; emergency.assignedAt = emergencyNow(); emergency.updatedAt = emergencyNow();
        emergency.etaSeconds = offer.etaSeconds ?? emergency.etaSeconds;
        addEmergencyEvent(emergencyId, 'accepted', 'driver', { ambulance_id: ambulanceId });
        return clone(emergency);
      },
      async declineOffer(emergencyId, ambulanceId) {
        const emergency = emergencies.get(emergencyId);
        if (!emergency || emergency.status !== 'matching') return null;
        const offer = emergencyOffers.find((o) => o.emergencyId === emergencyId && o.ambulanceId === ambulanceId && o.state === 'open');
        if (!offer) return null;
        offer.state = 'declined';
        addEmergencyEvent(emergencyId, 'declined', 'driver', { ambulance_id: ambulanceId });
        openNextEmergencyOffer(emergencyId);
        return clone(emergency);
      },
      async expireOffers() {
        let count = 0;
        for (const emergency of [...emergencies.values()].sort((a, b) => +a.createdAt - +b.createdAt)) {
          if (emergency.status !== 'matching') continue;
          const offer = emergencyOffers.find((o) => o.emergencyId === emergency.id && o.state === 'open' && +o.expiresAt <= +emergencyNow());
          if (!offer) continue;
          offer.state = 'expired'; addEmergencyEvent(emergency.id, 'expired', 'system', { ambulance_id: offer.ambulanceId });
          openNextEmergencyOffer(emergency.id); count += 1;
        }
        return count;
      },
      async advanceEmergency(emergencyId, ambulanceId, to) {
        const emergency = emergencies.get(emergencyId);
        const next = emergencyStatusOrder.indexOf(to);
        if (!emergency || next < 2 || emergency.ambulanceId !== ambulanceId || emergency.status !== emergencyStatusOrder[next - 1]) return null;
        const from = emergency.status; const at = emergencyNow(); emergency.status = to; emergency.updatedAt = at;
        const timestamp = { en_route: 'enRouteAt', arrived: 'arrivedAt', picked_up: 'pickedUpAt', at_hospital: 'atHospitalAt', completed: 'completedAt' }[to];
        emergency[timestamp] = at;
        if (to === 'completed') { emergency.closedAt = at; emergency.trackingExpiresAt = new Date(Math.min(+new Date(+emergency.createdAt + 24 * 3600_000), +new Date(+at + 2 * 3600_000))); }
        addEmergencyEvent(emergencyId, 'status_changed', 'driver', { from, to });
        return clone(emergency);
      },
      async cancelEmergency(emergencyId, reason = null) {
        const emergency = emergencies.get(emergencyId);
        if (!emergency || !['matching', 'assigned', 'en_route', 'arrived'].includes(emergency.status)) return null;
        const at = emergencyNow(); emergency.status = 'cancelled'; emergency.cancelReason = reason == null ? null : String(reason).slice(0, 200);
        emergency.closedAt = at; emergency.updatedAt = at;
        emergency.trackingExpiresAt = new Date(Math.min(+new Date(+emergency.createdAt + 24 * 3600_000), +new Date(+at + 2 * 3600_000)));
        for (const offer of emergencyOffers.filter((o) => o.emergencyId === emergencyId && ['queued', 'open'].includes(o.state))) offer.state = 'expired';
        const ambulance = emergency.ambulanceId && ambulances.get(emergency.ambulanceId);
        if (ambulance?.status === 'busy') { ambulance.status = 'available'; ambulance.updatedAt = at; }
        addEmergencyEvent(emergencyId, 'cancelled', 'patient', { reason: emergency.cancelReason });
        return clone(emergency);
      },
      async releaseAmbulance(ambulanceId) {
        const ambulance = ambulances.get(ambulanceId);
        const active = [...emergencies.values()].some((e) => e.ambulanceId === ambulanceId && ['assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital'].includes(e.status));
        if (!ambulance || ambulance.status !== 'busy' || ambulance.lat == null || ambulance.lng == null || active) return false;
        ambulance.status = 'available'; ambulance.updatedAt = emergencyNow(); return true;
      },
      async addFeedback(emergencyId, { rating, comment = null }) {
        const emergency = emergencies.get(emergencyId);
        if (!emergency || emergency.status !== 'completed' || emergencyFeedback.has(emergencyId)) return null;
        const row = { emergencyId, rating, comment, createdAt: emergencyNow() }; emergencyFeedback.set(emergencyId, row);
        addEmergencyEvent(emergencyId, 'feedback', 'patient'); return clone(row);
      },
      async getById(id) { return emergencies.has(id) ? clone(emergencies.get(id)) : null; },
      async getByTokenHash(hash) { const row = [...emergencies.values()].find((e) => e.trackingTokenHash === hash && +e.trackingExpiresAt > +emergencyNow()); return row ? clone(row) : null; },
      async activeForPatient(patientUserId) { const row = [...emergencies.values()].filter((e) => e.patientUserId === patientUserId && !['completed', 'cancelled', 'no_match'].includes(e.status)).sort((a, b) => +b.createdAt - +a.createdAt)[0]; return row ? clone(row) : null; },
      async history(patientUserId, { limit = 50, offset = 0 } = {}) { return [...emergencies.values()].filter((e) => e.patientUserId === patientUserId).sort((a, b) => +b.createdAt - +a.createdAt).slice(offset, offset + limit).map(clone); },
      async listAdmin({ status = null, limit = 100 } = {}) { return [...emergencies.values()].filter((e) => !status || e.status === status).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, limit).map(clone); },
      async listAmbulances() { return [...ambulances.values()].map(clone); },
      async ambulanceByDriver(driverUserId) { const row = [...ambulances.values()].find((a) => a.driverUserId === driverUserId); return row ? clone(row) : null; },
      async setAmbulanceStatus(id, status) { const row = ambulances.get(id); if (!row) return null; row.status = status; row.updatedAt = emergencyNow(); return clone(row); },
      async updateAmbulanceLocation(id, { lat, lng, heading = null, speed = null }) { const row = ambulances.get(id); if (!row) return null; Object.assign(row, { lat, lng, heading, speedKmph: speed, lastPingAt: emergencyNow(), updatedAt: emergencyNow() }); return clone(row); },
      async openOfferForAmbulance(id) { const row = emergencyOffers.find((o) => o.ambulanceId === id && o.state === 'open' && +o.expiresAt > +emergencyNow()); return row ? clone(row) : null; },
      async offersForEmergency(id) { return emergencyOffers.filter((o) => o.emergencyId === id).sort((a, b) => a.rank - b.rank).map(clone); },
      async activeForAmbulance(id) { const row = [...emergencies.values()].find((e) => e.ambulanceId === id && ['assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital'].includes(e.status)); return row ? clone(row) : null; },
      async timeline(id) { return emergencyEvents.filter((e) => e.emergencyId === id).sort((a, b) => +a.createdAt - +b.createdAt).map(clone); },
      async feedbackForEmergency(id) { const row = emergencyFeedback.get(id); return row ? clone(row) : null; },
      async insertEvent(id, kind, actorRole = 'system', data = {}) { if (!emergencies.has(id)) return null; return clone(addEmergencyEvent(id, kind, actorRole, data)); },
    },

    drivers: {
      /** A driver account and its one ambulance (D-73), created together or not at all. */
      async register({ name, email, phone, passwordHash, vehicle }) {
        for (const u of users.values()) if (u.email === email) return { conflict: 'email' };
        for (const a of ambulances.values()) if (a.registrationNumber === vehicle.registrationNumber) return { conflict: 'vehicle' };
        const user = { id: randomUUID(), name, email, phone, passwordHash, role: 'driver', createdAt: now(), disabledAt: null, driverApproval: 'pending', driverReviewNote: null, passwordChangeRequired: false };
        users.set(user.id, user);
        const id = randomUUID();
        ambulances.set(id, { id, driverUserId: user.id, registrationNumber: vehicle.registrationNumber, type: vehicle.type, status: 'offline', operatorName: 'Independent driver',
          driverName: name.split(/\s+/)[0], driverPhone: phone, isDemo: false, lat: null, lng: null, heading: null, speedKmph: null, lastPingAt: null, createdAt: emergencyNow(), updatedAt: emergencyNow() });
        return { user: clone(user) };
      },
    },

    passwordResets: {
      async request(userId) { const open = resets.find((r) => r.userId === userId && !r.usedAt); if (open) open.requestedAt = now(); else resets.push({ id: randomUUID(), userId, requestedAt: now(), tokenHash: null, issuedBy: null, issuedAt: null, expiresAt: null, usedAt: null }); },
      async byTokenHash(hash) { const r = resets.find((x) => x.tokenHash === hash && !x.usedAt && +x.expiresAt > +now()); return r ? { id: r.id, userId: r.userId, expiresAt: r.expiresAt } : null; },
      async consume(id) { const r = resets.find((x) => x.id === id && !x.usedAt); if (!r) return false; r.usedAt = now(); return true; },
    },

    users: {
      async create({ name, email, phone = null, passwordHash = null, role, passwordChangeRequired = false }) {
        for (const u of users.values()) if (u.email === email) return null;
        const user = { id: randomUUID(), name, email, phone, passwordHash, role, createdAt: now(), disabledAt: null, driverApproval: null, driverReviewNote: null, passwordChangeRequired };
        users.set(user.id, user);
        return clone(user);
      },
      async byEmail(email) { for (const u of users.values()) if (u.email === email) return clone(u); return null; },
      async setAssistantConsent(id, at) { const u = users.get(id); if (!u) return null; u.assistantConsentAt = at; return clone(u); },
      async byId(id) { return users.has(id) ? clone(users.get(id)) : null; },
      async list() { return [...users.values()].map(clone).sort((a, b) => a.createdAt - b.createdAt); },
      async setPassword(id, passwordHash) { const u = users.get(id); if (u) { u.passwordHash = passwordHash; u.passwordChangeRequired = false; } },
      // D-45: removing the user removes everything tied to them, as the database cascade does.
      async remove(id) {
        // A driver's one ambulance goes with the account (D-73); emergencies keep their history.
        for (const [aid, a] of ambulances) if (a.driverUserId === id && !a.isDemo) { ambulances.delete(aid); for (const e of emergencies.values()) if (e.ambulanceId === aid) e.ambulanceId = null; }
        users.delete(id);
        profiles.delete(id);
        for (const [sid, s] of sessions) if (s.userId === id) sessions.delete(sid);
        const drop = (arr, pred) => { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) arr.splice(i, 1); };
        drop(contacts, (x) => x.userId === id);
        drop(doseLogs, (x) => x.userId === id);
        drop(reminders, (x) => x.userId === id);
        drop(appointments, (x) => x.userId === id);
        drop(files, (x) => x.userId === id);
        const mine = new Set(reviews.filter((r) => r.userId === id).map((r) => r.id));
        drop(reports, (x) => x.userId === id || mine.has(x.reviewId));
        drop(reviews, (x) => x.userId === id);
        drop(messages, (x) => x.userId === id);
        drop(conversations, (x) => x.userId === id);
      },
      async setDisabled(id, disabled) { const u = users.get(id); if (!u) return null; u.disabledAt = disabled ? now() : null; return clone(u); },
    },

    sessions: {
      async create({ userId, refreshHash, expiresAt }) {
        const s = { id: randomUUID(), userId, refreshHash, previousRefreshHash: null, createdAt: now(), lastUsedAt: now(), expiresAt, revokedAt: null, revokedReason: null };
        sessions.set(s.id, s);
        return clone(s);
      },
      async get(id) { return sessions.has(id) ? clone(sessions.get(id)) : null; },
      async rotate(id, refreshHash, previousRefreshHash, expiresAt) {
        const s = sessions.get(id);
        if (!s || s.revokedAt || s.refreshHash !== previousRefreshHash) return null;
        Object.assign(s, { refreshHash, previousRefreshHash, expiresAt, lastUsedAt: now() });
        return clone(s);
      },
      async revokeOthers(userId, keepId) { for (const s of sessions.values()) if (s.userId === userId && s.id !== keepId && !s.revokedAt) Object.assign(s, { revokedAt: now(), revokedReason: 'logout' }); },
      async revoke(id, reason) { const s = sessions.get(id); if (s && !s.revokedAt) Object.assign(s, { revokedAt: now(), revokedReason: reason }); },
    },

    rateLimits: {
      async hit(key, limit, windowSeconds) {
        const t = Date.now();
        const w = limits.get(key);
        if (!w || t - w.start >= windowSeconds * 1000) {
          limits.set(key, { start: t, count: 1 });
          return { allowed: true, retryAfter: 0 };
        }
        w.count += 1;
        return w.count > limit ? { allowed: false, retryAfter: Math.ceil((w.start + windowSeconds * 1000 - t) / 1000) } : { allowed: true, retryAfter: 0 };
      },
    },

    profiles: {
      async get(userId) { return profiles.has(userId) ? clone(profiles.get(userId)) : null; },
      async upsert(userId, data) {
        const next = { ...(profiles.get(userId) || {}), ...data, userId, updatedAt: now() };
        profiles.set(userId, next);
        return clone(next);
      },
    },

    contacts: {
      async list(userId) { return contacts.filter((c) => c.userId === userId).map(clone); },
      async create(userId, c) { const row = { id: randomUUID(), userId, ...c, createdAt: now() }; contacts.push(row); return clone(row); },
      async remove(userId, id) { const i = contacts.findIndex((c) => c.id === id && c.userId === userId); if (i < 0) return false; contacts.splice(i, 1); return true; },
    },

    reminders: {
      async list(userId) { return reminders.filter((r) => r.userId === userId).map(clone).sort((a, b) => a.createdAt - b.createdAt); },
      async get(userId, id) { const r = reminders.find((x) => x.id === id && x.userId === userId); return r ? clone(r) : null; },
      async create(userId, r) { const row = { id: randomUUID(), userId, active: true, ...r, createdAt: now() }; reminders.push(row); return clone(row); },
      async update(userId, id, patch) { const r = reminders.find((x) => x.id === id && x.userId === userId); if (!r) return null; Object.assign(r, patch); return clone(r); },
      async remove(userId, id) {
        const i = reminders.findIndex((r) => r.id === id && r.userId === userId);
        if (i < 0) return false;
        reminders.splice(i, 1);
        for (let j = doseLogs.length - 1; j >= 0; j--) if (doseLogs[j].reminderId === id) doseLogs.splice(j, 1);
        return true;
      },
      async logDose(userId, reminderId, { date, time, status }) {
        const existing = doseLogs.find((l) => l.reminderId === reminderId && l.date === date && l.time === time);
        if (existing) Object.assign(existing, { status, recordedAt: now() });
        else doseLogs.push({ reminderId, userId, date, time, status, recordedAt: now() });
        return { reminderId, date, time, status };
      },
      async doses(userId, date) {
        return dosesFor(reminders.filter((r) => r.userId === userId), doseLogs.filter((l) => l.userId === userId), date);
      },
    },

    appointments: {
      async list(userId) { return appointments.filter((a) => a.userId === userId).map(clone).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)); },
      async create(userId, a) { const row = { id: randomUUID(), userId, status: 'scheduled', ...a, createdAt: now() }; appointments.push(row); return clone(row); },
      async update(userId, id, patch) { const a = appointments.find((x) => x.id === id && x.userId === userId); if (!a) return null; Object.assign(a, patch); return clone(a); },
      async remove(userId, id) { const i = appointments.findIndex((a) => a.id === id && a.userId === userId); if (i < 0) return false; appointments.splice(i, 1); return true; },
    },

    files: {
      async create(userId, meta) { const row = { id: randomUUID(), userId, status: 'pending', ...meta, createdAt: now() }; files.push(row); return clone(row); },
      async get(userId, id) { const f = files.find((x) => x.id === id && x.userId === userId); return f ? clone(f) : null; },
      async all(userId) { return files.filter((f) => f.userId === userId).map(clone); },
      async pendingCount(userId) { return files.filter((f) => f.userId === userId && f.status === 'pending' && Date.now() - f.createdAt < 3600000).length; },
      async markReady(userId, id) { const f = files.find((x) => x.id === id && x.userId === userId); if (!f) return null; f.status = 'ready'; return clone(f); },
      async list(userId, purpose) { return files.filter((f) => f.userId === userId && f.purpose === purpose && f.status === 'ready').map(clone).sort((a, b) => b.createdAt - a.createdAt); },
      async remove(userId, id) { const i = files.findIndex((f) => f.id === id && f.userId === userId); if (i < 0) return null; return clone(files.splice(i, 1)[0]); },
    },

    assistant: {
      async create(userId, title) {
        const c = { id: randomUUID(), userId, title, createdAt: now(), updatedAt: now() };
        conversations.push(c);
        return clone(c);
      },
      async list(userId) { return conversations.filter((c) => c.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50).map(clone); },
      async get(userId, id) { const c = conversations.find((x) => x.userId === userId && x.id === id); return c ? clone(c) : null; },
      async remove(userId, id) {
        const i = conversations.findIndex((x) => x.userId === userId && x.id === id);
        if (i === -1) return false;
        conversations.splice(i, 1);
        for (let k = messages.length - 1; k >= 0; k--) if (messages[k].conversationId === id) messages.splice(k, 1);
        return true;
      },
      async removeAll(userId) {
        for (const c of conversations.filter((x) => x.userId === userId)) await this.remove(userId, c.id);
      },
      async addMessage({ conversationId, userId, role, content, payload = {} }) {
        const m = { id: randomUUID(), conversationId, userId, role, content, payload, createdAt: now() };
        messages.push(m);
        const c = conversations.find((x) => x.id === conversationId);
        if (c) c.updatedAt = now();
        return clone(m);
      },
      async messages(userId, conversationId, max = 200) {
        return messages.filter((m) => m.userId === userId && m.conversationId === conversationId).slice(-max).map(clone);
      },
    },

    reviews: {
      async list(kind, listingId) {
        return reviews.filter((r) => r.kind === kind && r.listingId === listingId && r.status === 'visible')
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((r) => ({ ...clone(r), authorName: users.get(r.userId)?.name ?? '' }));
      },
      async get(id) { const r = reviews.find((x) => x.id === id); return r ? clone(r) : null; },
      async upsert(userId, { kind, listingId, rating, body }) {
        let r = reviews.find((x) => x.userId === userId && x.kind === kind && x.listingId === listingId);
        if (r) Object.assign(r, { rating, body, updatedAt: now() });
        else { r = { id: randomUUID(), userId, kind, listingId, rating, body, status: 'visible', createdAt: now(), updatedAt: now() }; reviews.push(r); }
        return clone(r);
      },
      async remove(userId, id) { const i = reviews.findIndex((r) => r.id === id && r.userId === userId); if (i < 0) return false; reviews.splice(i, 1); return true; },
      async report(userId, id, hideAt) {
        const r = reviews.find((x) => x.id === id);
        if (!r) return null;
        if (!reports.some((x) => x.reviewId === id && x.userId === userId)) reports.push({ reviewId: id, userId });
        if (reports.filter((x) => x.reviewId === id).length >= hideAt) r.status = 'hidden';
        return { hidden: r.status === 'hidden' };
      },
    },

    listings: {
      async insights() {
        const count = (list, key) => Object.entries(list.reduce((a, x) => ({ ...a, [key(x)]: (a[key(x)] || 0) + 1 }), {}))
          .map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
        const docs = doctors.map(doctorView);
        const fees = docs.map((d) => d.consultationFeeInr).filter((f) => f !== null && f !== undefined).sort((a, b) => a - b);
        return {
          totals: { carePlaces: hospitals.length, doctors: docs.length, pharmacies: pharmacies.length, diagnosticCentres: diagnostics.length, doctorsWithPhoto: docs.filter((d) => d.photoUrl).length, emergency: hospitals.filter((h) => h.emergencyAvailable === true).length },
          byType: count(hospitals, (h) => h.facilityType ?? 'hospital'), byArea: count(hospitals, (h) => h.area).slice(0, 12),
          bySpeciality: count(docs, (d) => d.specialization).slice(0, 12), bySource: count(docs, (d) => d.sourcePlatform), byChain: count(pharmacies, (p) => p.chain ?? 'Independent'),
          medicines: MEDICINES.length, byMedicineGroup: count(MEDICINES.filter((x) => x.category), (x) => x.category).slice(0, 10), commonTests: [],
          fees: fees.length ? { count: fees.length, min: fees[0], median: fees[Math.floor(fees.length / 2)], max: fees.at(-1) } : null,
          points: [...hospitals.map((h) => ({ kind: 'c', type: h.facilityType ?? 'hospital', lat: h.lat, lng: h.lng })), ...pharmacies.map((p) => ({ kind: 'p', type: null, lat: p.lat, lng: p.lng })), ...diagnostics.map((d) => ({ kind: 'd', type: null, lat: d.lat, lng: d.lng }))],
        };
      },
      async mapLocations() {
        const base = (x, kind, type = null) => ({
          id: x.id, kind, type, name: x.name, area: x.area, address: x.address,
          phone: x.phone ?? null, email: x.email ?? null, website: x.website ?? null,
          rating: x.rating ?? null, ratingCount: x.ratingCount ?? null,
          sourcePlatform: x.sourcePlatform ?? null, sourceUrl: x.sourceUrl ?? null,
          lat: x.lat, lng: x.lng,
        });
        return [
          ...hospitals.map((x) => base(x, 'c', x.facilityType ?? 'hospital')),
          ...pharmacies.map((x) => base(x, 'p')),
          ...diagnostics.map((x) => base(x, 'd')),
        ].filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
      },
      async testPrices() { return []; },
      async areas() { return [...AREAS]; },
      async areaCentroids() {
        return AREAS.map((name) => {
          const pts = [...hospitals, ...pharmacies, ...diagnostics].filter((x) => x.area === name && Number.isFinite(x.lat));
          if (!pts.length) return null;
          const avg = (k) => Math.round((pts.reduce((s, x) => s + x[k], 0) / pts.length) * 1e5) / 1e5;
          return { name, places: pts.length, lat: avg('lat'), lng: avg('lng') };
        }).filter(Boolean);
      },
      async hospitals(p) {
        return near(hospitals.filter((h) =>
          matches([h.name, h.area, ...h.specialities, ...h.departments].join(' '), p.q) &&
          (!p.area || h.area === p.area) &&
          (!p.emergencyOnly || h.emergencyAvailable === true) &&
          (!p.type || (h.facilityType ?? 'hospital') === p.type) &&
          (!p.speciality || h.specialities.some((s) => s.toLowerCase().includes(p.speciality.toLowerCase())))), p).map(clone);
      },
      async hospital(id) { const h = hospitals.find((x) => x.id === id); return h ? clone(h) : null; },
      async hospitalDoctors(id, specialization) {
        return doctors.filter((d) => d.hospitalId === id && (!specialization || d.specialization.toLowerCase().includes(specialization.toLowerCase()))).map(doctorView).map(clone);
      },
      async doctors(p) {
        const list = doctors.map(doctorView).filter((d) =>
          matches([d.name, d.specialization, d.place.name].join(' '), p.q) &&
          (!p.area || d.place.area === p.area) &&
          (!p.specialization || d.specialization.toLowerCase().includes(p.specialization.toLowerCase())) &&
          (!p.language || (d.languages ?? []).includes(p.language)) && (!p.group || d.sourcePlatform === p.group));
        if (p.sort !== 'experience') return near(list.map((d) => ({ ...d, lat: d.place.lat, lng: d.place.lng })), p).map(clone);

        // Match doctorsQuery: apply the experience ordering before pagination and keep
        // location fields nested under place, with distanceKm only when requested.
        let ordered = list.map((d) => {
          if (p.lat == null || p.lng == null) return d;
          const distance = distanceKm(p, d.place);
          return { ...d, distance, distanceKm: +distance.toFixed(2) };
        });
        if (p.radiusKm) ordered = ordered.filter((d) => d.distance === undefined || d.distance <= p.radiusKm);
        ordered.sort((a, b) => {
          const aYears = a.experienceYears;
          const bYears = b.experienceYears;
          if (aYears == null && bYears != null) return 1;
          if (aYears != null && bYears == null) return -1;
          return (bYears ?? 0) - (aYears ?? 0) || a.name.localeCompare(b.name);
        });
        const offset = p.offset ?? 0;
        const page = ordered.slice(offset, offset + (p.limit ?? 50));
        return page.map(({ distance, ...d }) => clone({ ...d, total: ordered.length }));
      },
      async doctor(id) { const d = doctors.find((x) => x.id === id); return d ? clone(doctorView(d)) : null; },
      async medicines(p) {
        const found = MEDICINES.filter((m) => matches(m.name, p.q) && (!p.category || m.category === p.category));
        return found.slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 50)).map((m) => ({ ...clone(m), total: found.length, listings: clone(m.listings).sort((a, b) => a.priceInr - b.priceInr) }));
      },
      async medicine(id) { const m = MEDICINES.find((x) => x.id === id); return m ? { ...clone(m), listings: clone(m.listings).sort((a, b) => a.priceInr - b.priceInr) } : null; },
      async pharmacies(p) {
        return near(pharmacies.filter((x) => matches([x.name, x.area].join(' '), p.q) && (!p.area || x.area === p.area) && (!p.open24 || x.open24) && (!p.chain || x.chain === p.chain)), p).map(clone);
      },
      async pharmacy(id) { const x = pharmacies.find((y) => y.id === id); return x ? clone(x) : null; },
      async diagnostics(p) {
        return near(diagnostics.filter((x) =>
          matches([x.name, x.area, ...x.testsListed].join(' '), p.q) &&
          (!p.area || x.area === p.area) &&
          (!p.test || x.testsListed.some((t) => t.toLowerCase().includes(p.test.toLowerCase())))), p).map(clone);
      },
      async diagnostic(id) { const x = diagnostics.find((y) => y.id === id); return x ? clone(x) : null; },
    },
  };
}
