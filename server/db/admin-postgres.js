// Admin operations on Postgres (D-83). Same interface as admin-memory.js.
// Every method that changes data writes its audit row inside the same transaction, so there is
// never a change without a record or a record without a change. Parameterised queries only;
// the only identifiers that reach SQL come from the fixed maps below.
import { LISTING_KINDS } from './admin-kinds.js';

const TABLE = { hospital: 'hospitals', doctor: 'doctors', pharmacy: 'pharmacies', diagnostic_centre: 'diagnostic_centres' };
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const num = (v) => (v === null || v === undefined ? null : Number(v));
const today = () => new Date().toISOString().slice(0, 10);

// Admin field name to column. Location is written separately from lat and lng.
const SHARED_COLS = { name: 'name', area: 'area', address: 'address', phone: 'phone', email: 'email', website: 'website', sourcePlatform: 'source_platform', sourceUrl: 'source_url', checkedAt: 'checked_at' };
const COLS = {
  hospital: { ...SHARED_COLS, facilityType: 'facility_type', description: 'description', emergencyAvailable: 'emergency_available', specialities: 'specialities', departments: 'departments' },
  pharmacy: { ...SHARED_COLS, chain: 'chain', hours: 'hours', open24: 'open_24' },
  diagnostic_centre: { ...SHARED_COLS, description: 'description', hours: 'hours', testsListed: 'tests_listed' },
  doctor: { name: 'name', title: 'title', specialization: 'specialization', qualifications: 'qualifications', experienceYears: 'experience_years', hospitalId: 'hospital_id',
    publishedTimings: 'published_timings', profileUrl: 'profile_url', appointmentPhone: 'appointment_phone', languages: 'languages', expertise: 'expertise',
    bookingUrl: 'booking_url', consultationFeeInr: 'consultation_fee_inr', sourcePlatform: 'source_platform', sourceUrl: 'source_url', checkedAt: 'checked_at' },
};

export function createPostgresAdmin(sql, { point }) {
  // The table name comes from the fixed TABLE map above, never from input.
  const t = (kind) => sql(`public.${TABLE[kind]}`);
  const join = (parts) => parts.reduce((a, b) => sql`${a}, ${b}`);
  const latlng = (col) => sql`extensions.st_y(${sql.unsafe(col)}::extensions.geometry)::float8 as lat, extensions.st_x(${sql.unsafe(col)}::extensions.geometry)::float8 as lng`;
  const audit = (tx, { actorId, action, targetKind, targetId, summary = '' }) =>
    tx`insert into public.admin_audit_log (actor_user_id, action, target_kind, target_id, summary) values (${actorId}, ${action}, ${targetKind}, ${String(targetId)}, ${summary.slice(0, 300)})`;
  const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const withTotal = (rows, map) => ({ total: rows[0]?.total_count ?? 0, rows: rows.map(map) });

  const userOut = (r) => r && ({ id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at, disabledAt: r.disabled_at ?? null });

  /** One listing as the admin sees it, in any state (active or hidden). */
  async function read(tx, kind, id) {
    if (kind === 'doctor') {
      const [r] = await tx`select d.*, h.name as h_name, h.area as h_area, ${latlng('d.clinic_location')} from public.doctors d left join public.hospitals h on h.id = d.hospital_id where d.id = ${id}`;
      if (!r) return null;
      const clinic = r.hospital_id ? null : { name: r.clinic_name ?? '', area: r.clinic_area ?? '', address: r.clinic_address ?? '', phone: r.clinic_phone ?? null, lat: r.lat, lng: r.lng };
      return { id: r.id, kind, active: r.active, name: r.name, area: r.hospital_id ? (r.h_area ?? '') : (r.clinic_area ?? ''), title: r.title ?? '', specialization: r.specialization,
        qualifications: r.qualifications ?? [], experienceYears: r.experience_years, hospitalId: r.hospital_id, hospitalName: r.h_name ?? null, clinic,
        publishedTimings: r.published_timings ?? '', profileUrl: r.profile_url, appointmentPhone: r.appointment_phone, languages: r.languages ?? [], expertise: r.expertise ?? [],
        bookingUrl: r.booking_url, consultationFeeInr: num(r.consultation_fee_inr), sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at), updatedAt: r.updated_at };
    }
    const [r] = await tx`select *, ${latlng('location')} from ${t(kind)} where id = ${id}`;
    if (!r) return null;
    const common = { id: r.id, kind, active: r.active, name: r.name, area: r.area, address: r.address, lat: r.lat, lng: r.lng, phone: r.phone, email: r.email, website: r.website,
      sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at), updatedAt: r.updated_at };
    if (kind === 'hospital') return { ...common, facilityType: r.facility_type, description: r.description, emergencyAvailable: r.emergency_available, specialities: r.specialities ?? [], departments: r.departments ?? [] };
    if (kind === 'pharmacy') return { ...common, chain: r.chain, hours: r.hours, open24: r.open_24 };
    return { ...common, description: r.description, hours: r.hours, testsListed: r.tests_listed ?? [] };
  }

  /** Column values for the fields present in `data`. */
  function columnsOf(kind, data) {
    const out = {};
    for (const [k, col] of Object.entries(COLS[kind])) if (data[k] !== undefined) out[col] = data[k];
    return out;
  }

  return {
    async overview() {
      const [u] = await sql`select count(*)::int as total, count(*) filter (where role = 'patient')::int as patients, count(*) filter (where role = 'driver')::int as drivers,
        count(*) filter (where role = 'admin')::int as admins, count(*) filter (where disabled_at is not null)::int as disabled from public.users`;
      const listings = {};
      for (const kind of LISTING_KINDS) {
        const [c] = await sql`select count(*) filter (where active)::int as active, count(*) filter (where not active)::int as hidden from ${t(kind)}`;
        listings[kind] = { active: c.active, hidden: c.hidden };
      }
      const [r] = await sql`select count(*) filter (where status = 'visible')::int as visible, count(*) filter (where status = 'hidden')::int as hidden,
        count(*) filter (where status = 'visible' and exists (select 1 from public.review_reports x where x.review_id = reviews.id))::int as reported from public.reviews`;
      const [a] = await sql`select count(*)::int as n from public.admin_audit_log`;
      return { users: { total: u.total, patients: u.patients, drivers: u.drivers, admins: u.admins, disabled: u.disabled }, listings, reviews: { visible: r.visible, hidden: r.hidden, reported: r.reported }, auditEntries: a.n };
    },

    async listUsers({ q, role, status, limit = 25, offset = 0 } = {}) {
      const rows = await sql`select *, count(*) over()::int as total_count from public.users
        where (${q ?? null}::text is null or name ilike ${like(q ?? '')} or email ilike ${like(q ?? '')})
          and (${role ?? null}::text is null or role::text = ${role ?? null})
          and (${status ?? null}::text is null or (${status ?? null} = 'disabled') = (disabled_at is not null))
        order by created_at desc, id limit ${limit} offset ${offset}`;
      return withTotal(rows, userOut);
    },
    async getUser(id) { return userOut((await sql`select * from public.users where id = ${id}`)[0]) || null; },
    async disableUser(id, actorId) {
      return sql.begin(async (tx) => {
        const [u] = await tx`select id, role, disabled_at from public.users where id = ${id} for update`;
        if (!u) return { ok: false, reason: 'not_found' };
        if (id === actorId) return { ok: false, reason: 'self' };
        if (u.disabled_at) return { ok: false, reason: 'already' };
        if (u.role === 'admin') {
          // Locking every active admin row makes two admins disabling each other at once take turns.
          const active = await tx`select id from public.users where role = 'admin' and disabled_at is null for update`;
          if (active.length <= 1) return { ok: false, reason: 'last_admin' };
        }
        await tx`update public.users set disabled_at = now(), updated_at = now() where id = ${id}`;
        await tx`update public.sessions set revoked_at = now(), revoked_reason = 'disabled' where user_id = ${id} and revoked_at is null`;
        await audit(tx, { actorId, action: 'user.disable', targetKind: 'user', targetId: id, summary: `Disabled a ${u.role} account` });
        return { ok: true };
      });
    },
    async enableUser(id, actorId) {
      return sql.begin(async (tx) => {
        const [u] = await tx`select id, role, disabled_at from public.users where id = ${id} for update`;
        if (!u) return { ok: false, reason: 'not_found' };
        if (!u.disabled_at) return { ok: false, reason: 'already' };
        await tx`update public.users set disabled_at = null, updated_at = now() where id = ${id}`;
        await audit(tx, { actorId, action: 'user.enable', targetKind: 'user', targetId: id, summary: `Enabled a ${u.role} account` });
        return { ok: true };
      });
    },

    async listListings({ kind, q, status, area, limit = 25, offset = 0 } = {}) {
      const rows = await sql`select *, count(*) over()::int as total_count from (
          select id, 'hospital'::text as kind, name, area, active, source_platform, checked_at, updated_at from public.hospitals
          union all select id, 'pharmacy', name, area, active, source_platform, checked_at, updated_at from public.pharmacies
          union all select id, 'diagnostic_centre', name, area, active, source_platform, checked_at, updated_at from public.diagnostic_centres
          union all select d.id, 'doctor', d.name, coalesce(h.area, d.clinic_area, ''), d.active, d.source_platform, d.checked_at, d.updated_at
            from public.doctors d left join public.hospitals h on h.id = d.hospital_id) l
        where (${kind ?? null}::text is null or kind = ${kind ?? null})
          and (${q ?? null}::text is null or name ilike ${like(q ?? '')} or area ilike ${like(q ?? '')})
          and (${area ?? null}::text is null or area = ${area ?? null})
          and (${status ?? null}::text is null or (${status ?? null} = 'active') = active)
        order by name, id limit ${limit} offset ${offset}`;
      return withTotal(rows, (r) => ({ id: r.id, kind: r.kind, name: r.name, area: r.area, active: r.active, sourcePlatform: r.source_platform, checkedAt: day(r.checked_at), updatedAt: r.updated_at }));
    },
    async getListing(kind, id) { return read(sql, kind, id); },

    async createListing(kind, data, actorId) {
      return sql.begin(async (tx) => {
        const d = { sourcePlatform: 'CareRoute admin', checkedAt: today(), ...data };
        const cols = columnsOf(kind, d);
        let id;
        // Column names and values are paired one to one; location is added last as a geography value.
        const withLocation = (extra, loc) => {
          const all = { ...cols, ...extra };
          const names = Object.keys(all);
          const parts = [...names.map((n) => sql(n)), ...(loc ? [sql('location')] : [])];
          const vals = [...names.map((n) => sql`${all[n]}`), ...(loc ? [loc] : [])];
          return { parts, vals };
        };
        if (kind === 'doctor') {
          const c = d.clinic;
          const { parts, vals } = c
            ? withLocation({ clinic_name: c.name, clinic_area: c.area, clinic_address: c.address, clinic_phone: c.phone ?? null }, null)
            : withLocation({}, null);
          if (c) { parts.push(sql('clinic_location')); vals.push(point(c.lat, c.lng)); }
          const [r] = await tx`insert into public.doctors (${join(parts)}) values (${join(vals)}) returning id`;
          id = r.id;
        } else {
          const { parts, vals } = withLocation({}, point(d.lat, d.lng));
          const [r] = await tx`insert into ${t(kind)} (${join(parts)}) values (${join(vals)}) returning id`;
          id = r.id;
        }
        await audit(tx, { actorId, action: `${kind}.create`, targetKind: kind, targetId: id, summary: `Created ${kind.replace('_', ' ')} "${d.name}"` });
        return { ok: true, listing: await read(tx, kind, id) };
      });
    },
    async updateListing(kind, id, data, actorId, summary) {
      return sql.begin(async (tx) => {
        const [exists] = await tx`select name from ${t(kind)} where id = ${id} for update`;
        if (!exists) return { ok: false, reason: 'not_found' };
        const cols = columnsOf(kind, data);
        const sets = Object.entries(cols).map(([c, v]) => sql`${sql(c)} = ${v}`);
        if (kind === 'doctor') {
          if (data.hospitalId) {
            for (const c of ['clinic_name', 'clinic_area', 'clinic_address', 'clinic_phone', 'clinic_location']) sets.push(sql`${sql(c)} = null`);
          }
          if (data.clinic) {
            const c = data.clinic;
            sets.push(sql`hospital_id = null`, sql`clinic_name = ${c.name}`, sql`clinic_area = ${c.area}`, sql`clinic_address = ${c.address}`, sql`clinic_phone = ${c.phone ?? null}`, sql`clinic_location = ${point(c.lat, c.lng)}`);
          }
        } else if (data.lat !== undefined) sets.push(sql`location = ${point(data.lat, data.lng)}`);
        sets.push(sql`updated_at = now()`);
        await tx`update ${t(kind)} set ${join(sets)} where id = ${id}`;
        await audit(tx, { actorId, action: `${kind}.update`, targetKind: kind, targetId: id, summary: summary ?? `Edited ${kind.replace('_', ' ')} "${exists.name}"` });
        return { ok: true, listing: await read(tx, kind, id) };
      });
    },
    async setListingActive(kind, id, active, actorId) {
      return sql.begin(async (tx) => {
        const [r] = await tx`select name, active from ${t(kind)} where id = ${id} for update`;
        if (!r) return { ok: false, reason: 'not_found' };
        if (r.active === active) return { ok: false, reason: 'already' };
        await tx`update ${t(kind)} set active = ${active}, updated_at = now() where id = ${id}`;
        await audit(tx, { actorId, action: `${kind}.${active ? 'unhide' : 'hide'}`, targetKind: kind, targetId: id, summary: `${active ? 'Showed' : 'Hid'} ${kind.replace('_', ' ')} "${r.name}"` });
        return { ok: true, listing: await read(tx, kind, id) };
      });
    },
    async hospitalChoices({ q, limit = 20 } = {}) {
      const rows = await sql`select id, name, area, active from public.hospitals where (${q ?? null}::text is null or name ilike ${like(q ?? '')} or area ilike ${like(q ?? '')}) order by name limit ${limit}`;
      return rows.map((r) => ({ id: r.id, name: r.name, area: r.area, active: r.active }));
    },

    async listReviews({ status = 'hidden', limit = 25, offset = 0 } = {}) {
      const rows = await sql`select * from (
          select r.id, r.listing_kind, r.listing_id, r.rating, r.body, r.status, r.created_at, r.updated_at,
            (select count(*)::int from public.review_reports x where x.review_id = r.id) as report_count,
            coalesce((select name from public.hospitals where id = r.listing_id and r.listing_kind = 'hospital'),
                     (select name from public.doctors where id = r.listing_id and r.listing_kind = 'doctor'),
                     (select name from public.pharmacies where id = r.listing_id and r.listing_kind = 'pharmacy'),
                     (select name from public.diagnostic_centres where id = r.listing_id and r.listing_kind = 'diagnostic_centre'), 'Removed listing') as listing_name
          from public.reviews r) x
        where (${status} = 'hidden' and status = 'hidden')
           or (${status} = 'reported' and status = 'visible' and report_count > 0)
           or (${status} = 'all' and (status = 'hidden' or report_count > 0))
        order by updated_at desc, id limit ${limit} offset ${offset}`;
      const total = await sql`select count(*)::int as n from (
          select r.status, (select count(*) from public.review_reports x where x.review_id = r.id) as report_count from public.reviews r) x
        where (${status} = 'hidden' and status = 'hidden') or (${status} = 'reported' and status = 'visible' and report_count > 0) or (${status} = 'all' and (status = 'hidden' or report_count > 0))`;
      return { total: total[0].n, rows: rows.map((r) => ({ id: r.id, kind: r.listing_kind, listingId: r.listing_id, listingName: r.listing_name, rating: r.rating, body: r.body, status: r.status, reportCount: r.report_count, createdAt: r.created_at, updatedAt: r.updated_at })) };
    },
    async getReview(id) {
      const [r] = await sql`select id, listing_kind, status, (select count(*)::int from public.review_reports x where x.review_id = reviews.id) as report_count from public.reviews where id = ${id}`;
      return r ? { id: r.id, kind: r.listing_kind, status: r.status, reportCount: r.report_count } : null;
    },
    async restoreReview(id, actorId) {
      return sql.begin(async (tx) => {
        const [r] = await tx`select id, listing_kind, status from public.reviews where id = ${id} for update`;
        if (!r) return { ok: false, reason: 'not_found' };
        const [{ n }] = await tx`select count(*)::int as n from public.review_reports where review_id = ${id}`;
        if (r.status === 'visible' && n === 0) return { ok: false, reason: 'already' };
        await tx`update public.reviews set status = 'visible', updated_at = now() where id = ${id}`;
        await tx`delete from public.review_reports where review_id = ${id}`;
        await audit(tx, { actorId, action: 'review.restore', targetKind: 'review', targetId: id, summary: `Kept a ${r.listing_kind.replace('_', ' ')} review after ${n} report${n === 1 ? '' : 's'}` });
        return { ok: true };
      });
    },
    async deleteReview(id, actorId) {
      return sql.begin(async (tx) => {
        const [r] = await tx`delete from public.reviews where id = ${id} returning listing_kind`;
        if (!r) return { ok: false, reason: 'not_found' };
        await audit(tx, { actorId, action: 'review.delete', targetKind: 'review', targetId: id, summary: `Deleted a ${r.listing_kind.replace('_', ' ')} review` });
        return { ok: true };
      });
    },

    /** Active listings past the re-check line, missing contact or source details, and possible duplicates. */
    async dataQuality({ staleAfterDays = 180, limit = 25 } = {}) {
      const kinds = [];
      for (const kind of LISTING_KINDS) {
        const phone = kind === 'doctor' ? sql`coalesce(x.appointment_phone, x.clinic_phone, h.phone)` : sql`x.phone`;
        const from = kind === 'doctor' ? sql`public.doctors x left join public.hospitals h on h.id = x.hospital_id` : sql`${t(kind)} x`;
        const [c] = await sql`select count(*)::int as active,
            count(*) filter (where x.checked_at is null or x.checked_at < current_date - ${staleAfterDays}::int)::int as stale,
            count(*) filter (where ${phone} is null)::int as no_phone,
            count(*) filter (where x.source_url is null)::int as no_source
          from ${from} where x.active`;
        kinds.push({ kind, active: c.active, stale: c.stale, noPhone: c.no_phone, noSource: c.no_source });
      }
      const live = sql`select id, 'hospital'::text as kind, name, area, checked_at from public.hospitals where active
          union all select id, 'pharmacy', name, area, checked_at from public.pharmacies where active
          union all select id, 'diagnostic_centre', name, area, checked_at from public.diagnostic_centres where active
          union all select d.id, 'doctor', d.name, coalesce(h.area, d.clinic_area, ''), d.checked_at from public.doctors d left join public.hospitals h on h.id = d.hospital_id where d.active`;
      const groups = await sql`select kind, min(name) as name, min(area) as area, count(*)::int as n, array_agg(id) as ids, count(*) over()::int as total_count
        from (${live}) l group by kind, lower(name), lower(area) having count(*) > 1 order by n desc, name limit ${limit}`;
      const stale = await sql`select id, kind, name, area, checked_at, count(*) over()::int as total_count from (${live}) l
        where checked_at is null or checked_at < current_date - ${staleAfterDays}::int order by checked_at asc nulls first, name limit ${limit}`;
      return { staleAfterDays, kinds,
        possibleDuplicates: { total: groups[0]?.total_count ?? 0, groups: groups.map((g) => ({ kind: g.kind, name: g.name, area: g.area, count: g.n, ids: g.ids })) },
        stale: { total: stale[0]?.total_count ?? 0, rows: stale.map((r) => ({ id: r.id, kind: r.kind, name: r.name, area: r.area, checkedAt: day(r.checked_at) })) } };
    },

    /** An audit row for a change made outside an admin session, such as the account script (D-21). */
    async recordAudit(entry) { await audit(sql, entry); },

    async listAudit({ action, targetKind, limit = 25, offset = 0 } = {}) {
      const rows = await sql`select a.*, u.name as actor_name, count(*) over()::int as total_count from public.admin_audit_log a left join public.users u on u.id = a.actor_user_id
        where (${action ?? null}::text is null or a.action = ${action ?? null}) and (${targetKind ?? null}::text is null or a.target_kind = ${targetKind ?? null})
        order by a.created_at desc, a.id limit ${limit} offset ${offset}`;
      return withTotal(rows, (r) => ({ id: r.id, actor: r.actor_name ?? 'Removed account', action: r.action, targetKind: r.target_kind, targetId: r.target_id, summary: r.summary, createdAt: r.created_at }));
    },
  };
}
