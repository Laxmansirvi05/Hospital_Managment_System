// Admin operations on the in-memory store (D-83). Same interface as admin-postgres.js.
// The memory store hands over its own arrays, so a hidden listing really leaves the public lists
// and a restored review really returns, exactly as the `active` and `status` columns behave in Postgres.
import { randomUUID } from 'node:crypto';

const clone = (v) => structuredClone(v);
const today = () => new Date().toISOString().slice(0, 10);
import { LISTING_KINDS } from './admin-kinds.js';
export { LISTING_KINDS };

/** Fields an admin may set, per kind. Anything else on a record (photo, source rating) is left alone. */
const SHARED = ['name', 'area', 'address', 'lat', 'lng', 'phone', 'email', 'website', 'sourcePlatform', 'sourceUrl', 'checkedAt'];
const FIELDS = {
  hospital: [...SHARED, 'facilityType', 'description', 'emergencyAvailable', 'specialities', 'departments'],
  pharmacy: [...SHARED, 'chain', 'hours', 'open24'],
  diagnostic_centre: [...SHARED, 'description', 'hours', 'testsListed'],
  doctor: ['name', 'title', 'specialization', 'qualifications', 'experienceYears', 'hospitalId', 'publishedTimings', 'profileUrl', 'appointmentPhone',
    'languages', 'expertise', 'bookingUrl', 'consultationFeeInr', 'sourcePlatform', 'sourceUrl', 'checkedAt'],
};

export function createMemoryAdmin(ctx) {
  const { users, sessions, reviews, reports, lists, hidden, audit } = ctx;

  const findIn = (kind, id) => {
    const live = lists[kind].find((x) => x.id === id);
    if (live) return { rec: live, active: true };
    const off = hidden[kind].find((x) => x.id === id);
    return off ? { rec: off, active: false } : null;
  };
  const all = (kind) => [...lists[kind].map((rec) => ({ rec, active: true })), ...hidden[kind].map((rec) => ({ rec, active: false }))];
  const hospitalName = (id) => findIn('hospital', id)?.rec.name ?? null;

  /** The admin view of one listing: one shape for all kinds, doctors' clinic fields grouped. */
  function view(kind, { rec, active }) {
    const base = { id: rec.id, kind, active, name: rec.name, sourcePlatform: rec.sourcePlatform ?? null, sourceUrl: rec.sourceUrl ?? null, checkedAt: rec.checkedAt ?? null, updatedAt: rec.updatedAt ?? null };
    if (kind === 'doctor') {
      const clinic = rec.hospitalId ? null : { name: rec.clinicName ?? '', area: rec.area ?? '', address: rec.clinicAddress ?? '', phone: rec.clinicPhone ?? null, lat: rec.lat ?? null, lng: rec.lng ?? null };
      return { ...base, area: rec.hospitalId ? (findIn('hospital', rec.hospitalId)?.rec.area ?? '') : (rec.area ?? ''), title: rec.title ?? '', specialization: rec.specialization,
        qualifications: rec.qualifications ?? [], experienceYears: rec.experienceYears ?? null, hospitalId: rec.hospitalId ?? null, hospitalName: rec.hospitalId ? hospitalName(rec.hospitalId) : null,
        clinic, publishedTimings: rec.publishedTimings ?? '', profileUrl: rec.profileUrl ?? null, appointmentPhone: rec.appointmentPhone ?? null, languages: rec.languages ?? [],
        expertise: rec.expertise ?? [], bookingUrl: rec.bookingUrl ?? null, consultationFeeInr: rec.consultationFeeInr ?? null };
    }
    const common = { ...base, area: rec.area, address: rec.address, lat: rec.lat, lng: rec.lng, phone: rec.phone ?? null, email: rec.email ?? null, website: rec.website ?? null };
    if (kind === 'hospital') return { ...common, facilityType: rec.facilityType ?? 'hospital', description: rec.description ?? '', emergencyAvailable: !!rec.emergencyAvailable, specialities: rec.specialities ?? [], departments: rec.departments ?? [] };
    if (kind === 'pharmacy') return { ...common, chain: rec.chain ?? null, hours: rec.hours ?? '', open24: !!rec.open24 };
    return { ...common, description: rec.description ?? '', hours: rec.hours ?? '', testsListed: rec.testsListed ?? [] };
  }

  /** Applies admin input onto a stored record, keeping the memory store's own field names. */
  function apply(kind, rec, data) {
    for (const key of FIELDS[kind]) if (data[key] !== undefined) rec[key] = data[key];
    if (kind === 'doctor' && data.hospitalId !== undefined && data.hospitalId !== null) {
      for (const k of ['clinicName', 'clinicAddress', 'clinicPhone']) rec[k] = null;
      delete rec.lat; delete rec.lng; delete rec.area;
    }
    if (kind === 'doctor' && data.clinic !== undefined) {
      if (data.clinic === null) { rec.clinicName = null; rec.clinicAddress = null; rec.clinicPhone = null; }
      else Object.assign(rec, { hospitalId: null, clinicName: data.clinic.name, area: data.clinic.area, clinicAddress: data.clinic.address, clinicPhone: data.clinic.phone ?? null, lat: data.clinic.lat, lng: data.clinic.lng });
    }
    rec.updatedAt = new Date().toISOString();
    return rec;
  }

  const addAudit = ({ actorId, action, targetKind, targetId, summary = '' }) => {
    const row = { id: randomUUID(), actorUserId: actorId, action, targetKind, targetId: String(targetId), summary: summary.slice(0, 300), createdAt: new Date() };
    audit.push(row);
    return row;
  };
  const matches = (text, q) => !q || text.toLowerCase().includes(q.toLowerCase());
  const page = (rows, { limit = 25, offset = 0 }) => ({ total: rows.length, rows: rows.slice(offset, offset + limit) });
  const reportCount = (reviewId) => reports.filter((x) => x.reviewId === reviewId).length;
  const activeAdmins = () => [...users.values()].filter((u) => u.role === 'admin' && !u.disabledAt);

  return {
    async overview() {
      const people = [...users.values()];
      const listingCounts = Object.fromEntries(LISTING_KINDS.map((k) => [k, { active: lists[k].length, hidden: hidden[k].length }]));
      return {
        users: { total: people.length, patients: people.filter((u) => u.role === 'patient').length, drivers: people.filter((u) => u.role === 'driver').length, admins: people.filter((u) => u.role === 'admin').length, disabled: people.filter((u) => u.disabledAt).length },
        listings: listingCounts,
        reviews: { visible: reviews.filter((r) => r.status === 'visible').length, hidden: reviews.filter((r) => r.status === 'hidden').length, reported: reviews.filter((r) => r.status === 'visible' && reportCount(r.id) > 0).length },
        auditEntries: audit.length,
      };
    },

    async listUsers({ q, role, status, limit, offset } = {}) {
      const rows = [...users.values()]
        .filter((u) => matches(`${u.name} ${u.email}`, q) && (!role || u.role === role) && (!status || (status === 'disabled') === !!u.disabledAt))
        .sort((a, b) => +b.createdAt - +a.createdAt)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, disabledAt: u.disabledAt ?? null }));
      return page(rows, { limit, offset });
    },
    async getUser(id) {
      const u = users.get(id);
      return u ? { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, disabledAt: u.disabledAt ?? null } : null;
    },
    /** Disables an account and ends its sessions. Refuses to lock out the last active admin or the acting admin. */
    async disableUser(id, actorId) {
      const u = users.get(id);
      if (!u) return { ok: false, reason: 'not_found' };
      if (id === actorId) return { ok: false, reason: 'self' };
      if (u.disabledAt) return { ok: false, reason: 'already' };
      if (u.role === 'admin' && activeAdmins().length <= 1) return { ok: false, reason: 'last_admin' };
      u.disabledAt = new Date();
      for (const s of sessions.values()) if (s.userId === id && !s.revokedAt) Object.assign(s, { revokedAt: new Date(), revokedReason: 'disabled' });
      addAudit({ actorId, action: 'user.disable', targetKind: 'user', targetId: id, summary: `Disabled a ${u.role} account` });
      return { ok: true };
    },
    async enableUser(id, actorId) {
      const u = users.get(id);
      if (!u) return { ok: false, reason: 'not_found' };
      if (!u.disabledAt) return { ok: false, reason: 'already' };
      u.disabledAt = null;
      addAudit({ actorId, action: 'user.enable', targetKind: 'user', targetId: id, summary: `Enabled a ${u.role} account` });
      return { ok: true };
    },

    async listListings({ kind, q, status, area, limit, offset } = {}) {
      const kinds = kind ? [kind] : LISTING_KINDS;
      const rows = kinds.flatMap((k) => all(k).map((entry) => view(k, entry)))
        .filter((v) => matches(`${v.name} ${v.area}`, q) && (!area || v.area === area) && (!status || (status === 'active') === v.active))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ id, kind: k, name, area: a, active, sourcePlatform, checkedAt, updatedAt }) => ({ id, kind: k, name, area: a, active, sourcePlatform, checkedAt, updatedAt }));
      return page(rows, { limit, offset });
    },
    async getListing(kind, id) { const hit = findIn(kind, id); return hit ? clone(view(kind, hit)) : null; },
    async createListing(kind, data, actorId) {
      const rec = { id: randomUUID(), sourcePlatform: 'CareRoute admin', checkedAt: today() };
      if (kind === 'doctor' && data.hospitalId && !findIn('hospital', data.hospitalId)) return { ok: false, reason: 'hospital_missing' };
      apply(kind, rec, data);
      lists[kind].push(rec);
      addAudit({ actorId, action: `${kind}.create`, targetKind: kind, targetId: rec.id, summary: `Created ${kind.replace('_', ' ')} "${rec.name}"` });
      return { ok: true, listing: clone(view(kind, { rec, active: true })) };
    },
    async updateListing(kind, id, data, actorId, summary) {
      const hit = findIn(kind, id);
      if (!hit) return { ok: false, reason: 'not_found' };
      if (kind === 'doctor' && data.hospitalId && !findIn('hospital', data.hospitalId)) return { ok: false, reason: 'hospital_missing' };
      apply(kind, hit.rec, data);
      addAudit({ actorId, action: `${kind}.update`, targetKind: kind, targetId: id, summary: summary ?? `Edited ${kind.replace('_', ' ')} "${hit.rec.name}"` });
      return { ok: true, listing: clone(view(kind, hit)) };
    },
    async setListingActive(kind, id, active, actorId) {
      const from = active ? hidden[kind] : lists[kind];
      const to = active ? lists[kind] : hidden[kind];
      const i = from.findIndex((x) => x.id === id);
      if (i < 0) return findIn(kind, id) ? { ok: false, reason: 'already' } : { ok: false, reason: 'not_found' };
      const [rec] = from.splice(i, 1);
      rec.updatedAt = new Date().toISOString();
      to.push(rec);
      addAudit({ actorId, action: `${kind}.${active ? 'unhide' : 'hide'}`, targetKind: kind, targetId: id, summary: `${active ? 'Showed' : 'Hid'} ${kind.replace('_', ' ')} "${rec.name}"` });
      return { ok: true, listing: clone(view(kind, { rec, active })) };
    },
    /** Hospitals a doctor can be attached to, for the editor's picker. */
    async hospitalChoices({ q, limit = 20 } = {}) {
      return all('hospital').filter(({ rec }) => matches(`${rec.name} ${rec.area}`, q)).map(({ rec, active }) => ({ id: rec.id, name: rec.name, area: rec.area, active })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
    },

    /** Hidden reviews and reviews with reports, newest first. The author is never part of the row (P-28). */
    async listReviews({ status = 'hidden', limit, offset } = {}) {
      const nameOf = (r) => findIn(r.kind, r.listingId)?.rec.name ?? 'Removed listing';
      const rows = reviews
        .map((r) => ({ id: r.id, kind: r.kind, listingId: r.listingId, listingName: nameOf(r), rating: r.rating, body: r.body, status: r.status, reportCount: reportCount(r.id), createdAt: r.createdAt, updatedAt: r.updatedAt }))
        .filter((r) => (status === 'hidden' ? r.status === 'hidden' : status === 'reported' ? r.status === 'visible' && r.reportCount > 0 : r.status === 'hidden' || r.reportCount > 0))
        .sort((a, b) => +b.updatedAt - +a.updatedAt);
      return page(rows, { limit, offset });
    },
    async getReview(id) { const r = reviews.find((x) => x.id === id); return r ? { id: r.id, kind: r.kind, status: r.status, reportCount: reportCount(id) } : null; },
    /** Keeps a checked review: it is visible again and its reports are cleared, so only new reports can hide it. */
    async restoreReview(id, actorId) {
      const r = reviews.find((x) => x.id === id);
      if (!r) return { ok: false, reason: 'not_found' };
      const cleared = reportCount(id);
      if (r.status === 'visible' && cleared === 0) return { ok: false, reason: 'already' };
      r.status = 'visible';
      for (let i = reports.length - 1; i >= 0; i--) if (reports[i].reviewId === id) reports.splice(i, 1);
      addAudit({ actorId, action: 'review.restore', targetKind: 'review', targetId: id, summary: `Kept a ${r.kind.replace('_', ' ')} review after ${cleared} report${cleared === 1 ? '' : 's'}` });
      return { ok: true };
    },
    async deleteReview(id, actorId) {
      const i = reviews.findIndex((x) => x.id === id);
      if (i < 0) return { ok: false, reason: 'not_found' };
      const [r] = reviews.splice(i, 1);
      for (let j = reports.length - 1; j >= 0; j--) if (reports[j].reviewId === id) reports.splice(j, 1);
      addAudit({ actorId, action: 'review.delete', targetKind: 'review', targetId: id, summary: `Deleted a ${r.kind.replace('_', ' ')} review` });
      return { ok: true };
    },

    /** Active listings past the re-check line, missing contact or source details, and possible duplicates. */
    async dataQuality({ staleAfterDays = 180, limit = 25 } = {}) {
      const line = new Date(Date.now() - staleAfterDays * 86400000).toISOString().slice(0, 10);
      const isStale = (rec) => !rec.checkedAt || String(rec.checkedAt).slice(0, 10) < line;
      const phoneOf = (kind, rec) => (kind === 'doctor' ? rec.appointmentPhone ?? rec.clinicPhone ?? findIn('hospital', rec.hospitalId)?.rec.phone : rec.phone);
      const areaOf = (kind, rec) => (kind === 'doctor' && rec.hospitalId ? findIn('hospital', rec.hospitalId)?.rec.area ?? '' : rec.area ?? '');
      const kinds = LISTING_KINDS.map((kind) => {
        const live = lists[kind];
        return { kind, active: live.length, stale: live.filter(isStale).length, noPhone: live.filter((r) => !phoneOf(kind, r)).length, noSource: live.filter((r) => !r.sourceUrl).length };
      });
      const groups = new Map();
      for (const kind of LISTING_KINDS) for (const rec of lists[kind]) {
        const key = `${kind}|${rec.name.toLowerCase()}|${areaOf(kind, rec).toLowerCase()}`;
        groups.set(key, [...(groups.get(key) ?? []), { kind, rec }]);
      }
      const dupes = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
      const stale = LISTING_KINDS.flatMap((kind) => lists[kind].filter(isStale).map((rec) => ({ id: rec.id, kind, name: rec.name, area: areaOf(kind, rec), checkedAt: rec.checkedAt ?? null })))
        .sort((a, b) => String(a.checkedAt ?? '').localeCompare(String(b.checkedAt ?? '')));
      return { staleAfterDays, kinds,
        possibleDuplicates: { total: dupes.length, groups: dupes.slice(0, limit).map((g) => ({ kind: g[0].kind, name: g[0].rec.name, area: areaOf(g[0].kind, g[0].rec), count: g.length, ids: g.map((x) => x.rec.id) })) },
        stale: { total: stale.length, rows: stale.slice(0, limit) } };
    },

    /** An audit row for a change made outside an admin session, such as the account script (D-21). */
    async recordAudit(entry) { addAudit(entry); },

    async listAudit({ action, targetKind, limit, offset } = {}) {
      const rows = audit.filter((a) => (!action || a.action === action) && (!targetKind || a.targetKind === targetKind))
        .sort((a, b) => +b.createdAt - +a.createdAt)
        .map((a) => ({ id: a.id, actor: users.get(a.actorUserId)?.name ?? 'Removed account', action: a.action, targetKind: a.targetKind, targetId: a.targetId, summary: a.summary, createdAt: a.createdAt }));
      return page(rows, { limit, offset });
    },
  };
}
