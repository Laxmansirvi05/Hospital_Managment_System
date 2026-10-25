// In-memory store (P-27). Same interface as postgres.js, used by tests and by the local
// server until DATABASE_URL is set. Nothing survives a restart.
import { randomUUID } from 'node:crypto';
import { AREAS, HOSPITALS, DOCTORS, PHARMACIES, DIAGNOSTICS, MEDICINES } from './seed-data.js';
import { distanceKm, dosesFor } from './geo.js';

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
  return out.slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 50));
}

export function createMemoryStore() {
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
  const reports = [];
  const hospitals = clone(HOSPITALS);
  const doctors = clone(DOCTORS);

  const hospitalOf = (d) => hospitals.find((h) => h.id === d.hospitalId);
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
    async close() {},

    users: {
      async create({ name, email, phone, passwordHash, role }) {
        for (const u of users.values()) if (u.email === email) return null;
        const user = { id: randomUUID(), name, email, phone, passwordHash, role, createdAt: now(), disabledAt: null };
        users.set(user.id, user);
        return clone(user);
      },
      async byEmail(email) { for (const u of users.values()) if (u.email === email) return clone(u); return null; },
      async byId(id) { return users.has(id) ? clone(users.get(id)) : null; },
      async list() { return [...users.values()].map(clone).sort((a, b) => a.createdAt - b.createdAt); },
      async setPassword(id, passwordHash) { const u = users.get(id); if (u) u.passwordHash = passwordHash; },
      // D-45: removing the user removes everything tied to them, as the database cascade does.
      async remove(id) {
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
          totals: { carePlaces: hospitals.length, doctors: docs.length, pharmacies: PHARMACIES.length, diagnosticCentres: DIAGNOSTICS.length, doctorsWithPhoto: docs.filter((d) => d.photoUrl).length, emergency: hospitals.filter((h) => h.emergencyAvailable === true).length },
          byType: count(hospitals, (h) => h.facilityType ?? 'hospital'), byArea: count(hospitals, (h) => h.area).slice(0, 12),
          bySpeciality: count(docs, (d) => d.specialization).slice(0, 12), bySource: count(docs, (d) => d.sourcePlatform), byChain: count(PHARMACIES, (p) => p.chain ?? 'Independent'),
          medicines: MEDICINES.length, byMedicineGroup: count(MEDICINES.filter((x) => x.category), (x) => x.category).slice(0, 10), commonTests: [],
          fees: fees.length ? { count: fees.length, min: fees[0], median: fees[Math.floor(fees.length / 2)], max: fees.at(-1) } : null,
          points: [...hospitals.map((h) => ({ kind: 'c', type: h.facilityType ?? 'hospital', lat: h.lat, lng: h.lng })), ...PHARMACIES.map((p) => ({ kind: 'p', type: null, lat: p.lat, lng: p.lng })), ...DIAGNOSTICS.map((d) => ({ kind: 'd', type: null, lat: d.lat, lng: d.lng }))],
        };
      },
      async testPrices() { return []; },
      async areas() { return [...AREAS]; },
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
        const out = near(list.map((d) => ({ ...d, lat: d.place.lat, lng: d.place.lng })), p).map(clone);
        return p.sort === 'experience' ? out.sort((a, b) => (b.experienceYears ?? -1) - (a.experienceYears ?? -1)) : out;
      },
      async doctor(id) { const d = doctors.find((x) => x.id === id); return d ? clone(doctorView(d)) : null; },
      async medicines(p) {
        return MEDICINES.filter((m) => matches(m.name, p.q) && (!p.category || m.category === p.category)).slice(p.offset ?? 0, (p.offset ?? 0) + (p.limit ?? 50)).map((m) => ({ ...clone(m), listings: clone(m.listings).sort((a, b) => a.priceInr - b.priceInr) }));
      },
      async medicine(id) { const m = MEDICINES.find((x) => x.id === id); return m ? { ...clone(m), listings: clone(m.listings).sort((a, b) => a.priceInr - b.priceInr) } : null; },
      async pharmacies(p) {
        return near(PHARMACIES.filter((x) => matches([x.name, x.area].join(' '), p.q) && (!p.area || x.area === p.area) && (!p.open24 || x.open24) && (!p.chain || x.chain === p.chain)), p).map(clone);
      },
      async pharmacy(id) { const x = PHARMACIES.find((y) => y.id === id); return x ? clone(x) : null; },
      async diagnostics(p) {
        return near(DIAGNOSTICS.filter((x) =>
          matches([x.name, x.area, ...x.testsListed].join(' '), p.q) &&
          (!p.area || x.area === p.area) &&
          (!p.test || x.testsListed.some((t) => t.toLowerCase().includes(p.test.toLowerCase())))), p).map(clone);
      },
      async diagnostic(id) { const x = DIAGNOSTICS.find((y) => y.id === id); return x ? clone(x) : null; },
    },
  };
}
