// Postgres store (P-04). Parameterised queries only, through the postgres driver's tagged
// templates. Same interface as memory.js.
import postgres from 'postgres';
import { dosesFor } from './geo.js';

const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const num = (v) => (v === null || v === undefined ? null : Number(v));

const userRow = (r) => r && { id: r.id, name: r.name, email: r.email, phone: r.phone, passwordHash: r.password_hash, role: r.role, createdAt: r.created_at, disabledAt: r.disabled_at };
const sessionRow = (r) => r && { id: r.id, userId: r.user_id, refreshHash: r.refresh_hash, previousRefreshHash: r.previous_refresh_hash, expiresAt: r.expires_at, revokedAt: r.revoked_at };
const profileRow = (r) => r && {
  userId: r.user_id, fullName: r.full_name, dateOfBirth: day(r.date_of_birth), gender: r.gender, preferredLanguage: r.preferred_language,
  address: r.address, bloodGroup: r.blood_group, heightCm: r.height_cm, weightKg: num(r.weight_kg), allergies: r.allergies, conditions: r.conditions,
  currentMedicines: r.current_medicines, pastSurgeries: r.past_surgeries, disabilities: r.disabilities, organDonor: r.organ_donor,
  medicalNotes: r.medical_notes, insurance: r.insurance, primaryDoctor: r.primary_doctor, shareWithCrew: r.share_with_crew, photoFileId: r.photo_file_id,
};
const reminderRow = (r) => r && {
  id: r.id, userId: r.user_id, medicineName: r.medicine_name, dose: r.dose, instructions: r.instructions, times: r.times,
  daysOfWeek: r.days_of_week.map(Number), startDate: day(r.start_date), endDate: day(r.end_date), notes: r.notes, active: r.active, createdAt: r.created_at,
};
const appointmentRow = (r) => r && {
  id: r.id, userId: r.user_id, doctorName: r.doctor_name, speciality: r.speciality, place: r.place, hospitalId: r.hospital_id,
  date: day(r.appointment_date), time: r.appointment_time, reason: r.reason, notes: r.notes, status: r.status,
};
const fileRow = (r) => r && {
  id: r.id, userId: r.user_id, purpose: r.purpose, title: r.title, kind: r.kind, fileName: r.file_name, contentType: r.content_type,
  sizeBytes: r.size_bytes, storagePath: r.storage_path, status: r.status, createdAt: r.created_at,
};

// Column maps for partial updates. Only listed keys can ever reach SQL.
const PROFILE_COLS = {
  fullName: 'full_name', dateOfBirth: 'date_of_birth', gender: 'gender', preferredLanguage: 'preferred_language', address: 'address',
  bloodGroup: 'blood_group', heightCm: 'height_cm', weightKg: 'weight_kg', allergies: 'allergies', conditions: 'conditions',
  currentMedicines: 'current_medicines', pastSurgeries: 'past_surgeries', disabilities: 'disabilities', organDonor: 'organ_donor',
  medicalNotes: 'medical_notes', insurance: 'insurance', primaryDoctor: 'primary_doctor', shareWithCrew: 'share_with_crew', photoFileId: 'photo_file_id',
};
const REMINDER_COLS = {
  medicineName: 'medicine_name', dose: 'dose', instructions: 'instructions', times: 'times', daysOfWeek: 'days_of_week',
  startDate: 'start_date', endDate: 'end_date', notes: 'notes', active: 'active',
};
const APPOINTMENT_COLS = {
  doctorName: 'doctor_name', speciality: 'speciality', place: 'place', hospitalId: 'hospital_id', date: 'appointment_date',
  time: 'appointment_time', reason: 'reason', notes: 'notes', status: 'status',
};

function columns(patch, map) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) if (map[k]) out[map[k]] = v;
  return out;
}

export function createPostgresStore(url) {
  const sql = postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Supabase transaction pooler does not support prepared statements.
    types: { bigint: postgres.BigInt },
    transform: { undefined: null },
  });
  const json = (v) => sql.json(v ?? {});
  const point = (lat, lng) => sql`extensions.st_setsrid(extensions.st_makepoint(${lng}, ${lat}), 4326)::extensions.geography`;

  function nearFilter(col, p) {
    if (p.lat == null) return { dist: sql`null::float8`, where: sql`true`, order: sql`name` };
    const origin = point(p.lat, p.lng);
    return {
      dist: sql`round((extensions.st_distance(${sql.unsafe(col)}, ${origin}) / 1000)::numeric, 2)::float8`,
      where: p.radiusKm ? sql`extensions.st_dwithin(${sql.unsafe(col)}, ${origin}, ${p.radiusKm * 1000})` : sql`true`,
      order: sql`${sql.unsafe(col)} operator(extensions.<->) ${origin}`,
    };
  }

  const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const listingBase = (r) => ({
    id: r.id, name: r.name, area: r.area, address: r.address, lat: r.lat, lng: r.lng, phone: r.phone, email: r.email, website: r.website,
    rating: num(r.rating), ratingCount: r.rating_count, sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at),
    ...(r.distance_km !== null && r.distance_km !== undefined ? { distanceKm: r.distance_km } : {}),
  });
  const hospitalOut = (r) => ({ ...listingBase(r), facilityType: r.facility_type, description: r.description, emergencyAvailable: r.emergency_available, specialities: r.specialities, departments: r.departments });
  const doctorOut = (r) => ({
    id: r.id, name: r.name, title: r.title, specialization: r.specialization, qualifications: r.qualifications, experienceYears: r.experience_years,
    hospitalId: r.hospital_id, publishedTimings: r.published_timings, profileUrl: r.profile_url, rating: num(r.rating), ratingCount: r.rating_count,
    photoUrl: r.photo_url, languages: r.languages, expertise: r.expertise, bookingUrl: r.booking_url, consultationFeeInr: num(r.consultation_fee_inr),
    sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at),
    place: r.hospital_id
      ? { kind: 'hospital', id: r.hospital_id, name: r.h_name, area: r.h_area, address: r.h_address, phone: r.appointment_phone ?? r.h_phone, lat: r.p_lat, lng: r.p_lng }
      : { kind: 'clinic', id: null, name: r.clinic_name, area: r.clinic_area, address: r.clinic_address, phone: r.clinic_phone, lat: r.p_lat, lng: r.p_lng },
    ...(r.distance_km !== null && r.distance_km !== undefined ? { distanceKm: r.distance_km } : {}),
  });
  const latlng = (col) => sql`extensions.st_y(${sql.unsafe(col)}::extensions.geometry) as lat, extensions.st_x(${sql.unsafe(col)}::extensions.geometry) as lng`;

  async function doctorsQuery(where, p = {}) {
    const loc = 'coalesce(h.location, d.clinic_location)';
    const n = nearFilter(loc, p);
    return sql`
      select d.*, h.name as h_name, h.area as h_area, h.address as h_address, h.phone as h_phone,
        extensions.st_y(${sql.unsafe(loc)}::extensions.geometry) as p_lat, extensions.st_x(${sql.unsafe(loc)}::extensions.geometry) as p_lng,
        ${n.dist} as distance_km
      from public.doctors d left join public.hospitals h on h.id = d.hospital_id
      where d.active and ${where} and ${n.where}
      order by ${p.lat == null ? sql`d.name` : n.order}
      limit ${p.limit ?? 50}`;
  }

  return {
    kind: 'postgres',
    async ping() { await sql`select 1`; },
    async close() { await sql.end({ timeout: 5 }); },

    users: {
      async create({ name, email, phone, passwordHash, role }) {
        const rows = await sql`insert into public.users (name, email, phone, password_hash, role) values (${name}, ${email}, ${phone}, ${passwordHash}, ${role})
          on conflict (email) do nothing returning *`;
        return userRow(rows[0]) || null;
      },
      async byEmail(email) { return userRow((await sql`select * from public.users where email = ${email}`)[0]) || null; },
      async byId(id) { return userRow((await sql`select * from public.users where id = ${id}`)[0]) || null; },
      async list() { return (await sql`select * from public.users order by created_at`).map(userRow); },
      async setPassword(id, passwordHash) { await sql`update public.users set password_hash = ${passwordHash}, updated_at = now() where id = ${id}`; },
      // D-45: every patient table references users with on delete cascade.
      async remove(id) { await sql`delete from public.users where id = ${id}`; },
      async setDisabled(id, disabled) {
        return userRow((await sql`update public.users set disabled_at = ${disabled ? sql`now()` : null}, updated_at = now() where id = ${id} returning *`)[0]) || null;
      },
    },

    sessions: {
      async create({ userId, refreshHash, expiresAt }) {
        return sessionRow((await sql`insert into public.sessions (user_id, refresh_hash, expires_at) values (${userId}, ${refreshHash}, ${expiresAt}) returning *`)[0]);
      },
      async get(id) { return sessionRow((await sql`select * from public.sessions where id = ${id}`)[0]) || null; },
      async rotate(id, refreshHash, previousRefreshHash, expiresAt) {
        // Conditional on the presented hash, so two refreshes racing cannot both win.
        const rows = await sql`update public.sessions set refresh_hash = ${refreshHash}, previous_refresh_hash = ${previousRefreshHash}, expires_at = ${expiresAt}, last_used_at = now()
          where id = ${id} and refresh_hash = ${previousRefreshHash} and revoked_at is null returning *`;
        return sessionRow(rows[0]) || null;
      },
      async revokeOthers(userId, keepId) { await sql`update public.sessions set revoked_at = now(), revoked_reason = 'logout' where user_id = ${userId} and id <> ${keepId} and revoked_at is null`; },
      async revoke(id, reason) { await sql`update public.sessions set revoked_at = now(), revoked_reason = ${reason} where id = ${id} and revoked_at is null`; },
    },

    rateLimits: {
      async hit(key, limit, windowSeconds) {
        const [r] = await sql`select * from public.hit_rate_limit(${key}, ${limit}, ${windowSeconds})`;
        return { allowed: r.allowed, retryAfter: r.retry_after };
      },
    },

    profiles: {
      async get(userId) { return profileRow((await sql`select * from public.patient_profiles where user_id = ${userId}`)[0]) || null; },
      async upsert(userId, data) {
        const cols = columns(data, PROFILE_COLS);
        for (const k of ['address', 'insurance', 'primary_doctor']) if (k in cols) cols[k] = json(cols[k]);
        await sql`insert into public.patient_profiles (user_id) values (${userId}) on conflict (user_id) do nothing`;
        if (Object.keys(cols).length) {
          // Merge object fields so a partial address update keeps the other parts.
          const sets = Object.entries(cols).map(([c, v]) => (['address', 'insurance', 'primary_doctor'].includes(c) ? sql`${sql(c)} = ${sql(c)} || ${v}` : sql`${sql(c)} = ${v}`));
          await sql`update public.patient_profiles set ${sets.reduce((a, b) => sql`${a}, ${b}`)}, updated_at = now() where user_id = ${userId}`;
        }
        return profileRow((await sql`select * from public.patient_profiles where user_id = ${userId}`)[0]);
      },
    },

    contacts: {
      async list(userId) { return (await sql`select * from public.emergency_contacts where user_id = ${userId} order by created_at`).map((r) => ({ id: r.id, userId: r.user_id, name: r.name, phone: r.phone, relation: r.relation })); },
      async create(userId, c) {
        const [r] = await sql`insert into public.emergency_contacts (user_id, name, phone, relation) values (${userId}, ${c.name}, ${c.phone}, ${c.relation}) returning *`;
        return { id: r.id, userId: r.user_id, name: r.name, phone: r.phone, relation: r.relation };
      },
      async remove(userId, id) { return (await sql`delete from public.emergency_contacts where id = ${id} and user_id = ${userId}`).count > 0; },
    },

    reminders: {
      async list(userId) { return (await sql`select * from public.reminders where user_id = ${userId} order by created_at`).map(reminderRow); },
      async get(userId, id) { return reminderRow((await sql`select * from public.reminders where id = ${id} and user_id = ${userId}`)[0]) || null; },
      async create(userId, r) {
        const [row] = await sql`insert into public.reminders (user_id, medicine_name, dose, instructions, times, days_of_week, start_date, end_date, notes, active)
          values (${userId}, ${r.medicineName}, ${r.dose}, ${r.instructions}, ${r.times}, ${r.daysOfWeek}, ${r.startDate}, ${r.endDate}, ${r.notes}, ${r.active}) returning *`;
        return reminderRow(row);
      },
      async update(userId, id, patch) {
        const cols = columns(patch, REMINDER_COLS);
        if (!Object.keys(cols).length) return this.get(userId, id);
        return reminderRow((await sql`update public.reminders set ${sql(cols)}, updated_at = now() where id = ${id} and user_id = ${userId} returning *`)[0]) || null;
      },
      async remove(userId, id) { return (await sql`delete from public.reminders where id = ${id} and user_id = ${userId}`).count > 0; },
      async logDose(userId, reminderId, { date, time, status }) {
        await sql`insert into public.reminder_doses (reminder_id, user_id, dose_date, dose_time, status) values (${reminderId}, ${userId}, ${date}, ${time}, ${status})
          on conflict (reminder_id, dose_date, dose_time) do update set status = excluded.status, recorded_at = now()`;
        return { reminderId, date, time, status };
      },
      async doses(userId, date) {
        const [reminders, logs] = await Promise.all([
          sql`select * from public.reminders where user_id = ${userId} and active and start_date <= ${date} and (end_date is null or end_date >= ${date})`,
          sql`select reminder_id, dose_date, dose_time, status from public.reminder_doses where user_id = ${userId} and dose_date = ${date}`,
        ]);
        return dosesFor(reminders.map(reminderRow), logs.map((l) => ({ reminderId: l.reminder_id, date: day(l.dose_date), time: l.dose_time, status: l.status })), date);
      },
    },

    appointments: {
      async list(userId) { return (await sql`select * from public.appointments where user_id = ${userId} order by appointment_date, appointment_time`).map(appointmentRow); },
      async create(userId, a) {
        const [row] = await sql`insert into public.appointments (user_id, doctor_name, speciality, place, hospital_id, appointment_date, appointment_time, reason, notes)
          values (${userId}, ${a.doctorName}, ${a.speciality}, ${a.place}, ${a.hospitalId}, ${a.date}, ${a.time}, ${a.reason}, ${a.notes}) returning *`;
        return appointmentRow(row);
      },
      async update(userId, id, patch) {
        const cols = columns(patch, APPOINTMENT_COLS);
        if (!Object.keys(cols).length) return appointmentRow((await sql`select * from public.appointments where id = ${id} and user_id = ${userId}`)[0]) || null;
        return appointmentRow((await sql`update public.appointments set ${sql(cols)}, updated_at = now() where id = ${id} and user_id = ${userId} returning *`)[0]) || null;
      },
      async remove(userId, id) { return (await sql`delete from public.appointments where id = ${id} and user_id = ${userId}`).count > 0; },
    },

    files: {
      async create(userId, m) {
        const [r] = await sql`insert into public.patient_files (user_id, purpose, title, kind, file_name, content_type, size_bytes, storage_path)
          values (${userId}, ${m.purpose}, ${m.title}, ${m.kind}, ${m.fileName}, ${m.contentType}, ${m.sizeBytes}, ${m.storagePath}) returning *`;
        return fileRow(r);
      },
      async get(userId, id) { return fileRow((await sql`select * from public.patient_files where id = ${id} and user_id = ${userId}`)[0]) || null; },
      async all(userId) { return (await sql`select * from public.patient_files where user_id = ${userId}`).map(fileRow); },
      async pendingCount(userId) {
        const [r] = await sql`select count(*)::int as n from public.patient_files where user_id = ${userId} and status = 'pending' and created_at > now() - interval '1 hour'`;
        return r.n;
      },
      async markReady(userId, id) { return fileRow((await sql`update public.patient_files set status = 'ready', updated_at = now() where id = ${id} and user_id = ${userId} returning *`)[0]) || null; },
      async list(userId, purpose) { return (await sql`select * from public.patient_files where user_id = ${userId} and purpose = ${purpose} and status = 'ready' order by created_at desc`).map(fileRow); },
      async remove(userId, id) { return fileRow((await sql`delete from public.patient_files where id = ${id} and user_id = ${userId} returning *`)[0]) || null; },
    },

    reviews: {
      async list(kind, listingId) {
        const rows = await sql`select r.*, u.name as author_name from public.reviews r join public.users u on u.id = r.user_id
          where r.listing_kind = ${kind} and r.listing_id = ${listingId} and r.status = 'visible' order by r.updated_at desc limit 200`;
        return rows.map((r) => ({ id: r.id, userId: r.user_id, kind: r.listing_kind, listingId: r.listing_id, rating: r.rating, body: r.body, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, authorName: r.author_name }));
      },
      async get(id) {
        const [r] = await sql`select * from public.reviews where id = ${id}`;
        return r ? { id: r.id, userId: r.user_id, kind: r.listing_kind, listingId: r.listing_id, rating: r.rating, body: r.body, status: r.status } : null;
      },
      async upsert(userId, { kind, listingId, rating, body }) {
        const [r] = await sql`insert into public.reviews (user_id, listing_kind, listing_id, rating, body) values (${userId}, ${kind}, ${listingId}, ${rating}, ${body})
          on conflict (user_id, listing_kind, listing_id) do update set rating = excluded.rating, body = excluded.body, updated_at = now() returning *`;
        return { id: r.id, userId: r.user_id, kind: r.listing_kind, listingId: r.listing_id, rating: r.rating, body: r.body, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
      },
      async remove(userId, id) { return (await sql`delete from public.reviews where id = ${id} and user_id = ${userId}`).count > 0; },
      async report(userId, id, hideAt) {
        return sql.begin(async (tx) => {
          const [r] = await tx`select id from public.reviews where id = ${id} for update`;
          if (!r) return null;
          await tx`insert into public.review_reports (review_id, user_id) values (${id}, ${userId}) on conflict do nothing`;
          const [{ n }] = await tx`select count(*)::int as n from public.review_reports where review_id = ${id}`;
          if (n >= hideAt) await tx`update public.reviews set status = 'hidden', updated_at = now() where id = ${id}`;
          return { hidden: n >= hideAt };
        });
      },
    },

    listings: {
      async areas() {
        const rows = await sql`
          select area from (
            select area from public.hospitals where active union all
            select area from public.pharmacies where active union all
            select area from public.diagnostic_centres where active) a
          group by area order by area`;
        return rows.map((r) => r.area);
      },
      async hospitals(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km from public.hospitals
          where active
            and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')}
                 or array_to_string(specialities, ' ') ilike ${like(p.q ?? '')} or array_to_string(departments, ' ') ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null})
            and (${p.emergencyOnly ?? false} = false or emergency_available is true)
            and (${p.type ?? null}::text is null or facility_type = ${p.type ?? null})
            -- Sources spell specialities their own way, so the filter matches part of a name, ignoring case.
            and (${p.speciality ?? null}::text is null or exists (select 1 from unnest(specialities) s where s ilike ${like(p.speciality ?? '')}))
            and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50}`;
        return rows.map(hospitalOut);
      },
      async hospital(id) { const [r] = await sql`select *, ${latlng('location')} from public.hospitals where id = ${id} and active`; return r ? hospitalOut(r) : null; },
      async hospitalDoctors(id, specialization) {
        return (await doctorsQuery(sql`d.hospital_id = ${id} and (${specialization ?? null}::text is null or d.specialization ilike ${like(specialization ?? '')})`)).map(doctorOut);
      },
      async doctors(p) {
        const where = sql`(${p.q ?? null}::text is null or d.name ilike ${like(p.q ?? '')} or d.specialization ilike ${like(p.q ?? '')} or coalesce(h.name, d.clinic_name) ilike ${like(p.q ?? '')})
          and (${p.area ?? null}::text is null or coalesce(h.area, d.clinic_area) = ${p.area ?? null})
          and (${p.specialization ?? null}::text is null or d.specialization ilike ${like(p.specialization ?? '')})`;
        return (await doctorsQuery(where, p)).map(doctorOut);
      },
      async doctor(id) { const [r] = await doctorsQuery(sql`d.id = ${id}`); return r ? doctorOut(r) : null; },
      async medicines(p) {
        const meds = await sql`select * from public.medicines where active and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')}) order by name limit ${p.limit ?? 50}`;
        if (!meds.length) return [];
        const listings = await sql`select * from public.medicine_listings where active and medicine_id in ${sql(meds.map((m) => m.id))} order by price_inr`;
        return meds.map((m) => ({
          id: m.id, name: m.name, form: m.form, pack: m.pack, prescriptionRequired: m.prescription_required,
          listings: listings.filter((l) => l.medicine_id === m.id).map((l) => ({ platform: l.platform, priceInr: num(l.price_inr), productUrl: l.product_url, checkedAt: l.checked_at.toISOString() })),
        }));
      },
      async medicine(id) {
        const [m] = await sql`select * from public.medicines where id = ${id} and active`;
        if (!m) return null;
        const listings = await sql`select * from public.medicine_listings where medicine_id = ${id} and active order by price_inr`;
        return { id: m.id, name: m.name, form: m.form, pack: m.pack, prescriptionRequired: m.prescription_required, listings: listings.map((l) => ({ platform: l.platform, priceInr: num(l.price_inr), productUrl: l.product_url, checkedAt: l.checked_at.toISOString() })) };
      },
      async pharmacies(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km from public.pharmacies
          where active and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null}) and (${p.open24 ?? false} = false or open_24)
            and (${p.chain ?? null}::text is null or chain = ${p.chain ?? null}) and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50}`;
        return rows.map((r) => ({ ...listingBase(r), chain: r.chain, hours: r.hours, open24: r.open_24 }));
      },
      async pharmacy(id) { const [r] = await sql`select *, ${latlng('location')} from public.pharmacies where id = ${id} and active`; return r ? { ...listingBase(r), chain: r.chain, hours: r.hours, open24: r.open_24 } : null; },
      async diagnostics(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km from public.diagnostic_centres
          where active and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')} or array_to_string(tests_listed, ' ') ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null})
            and (${p.test ?? null}::text is null or array_to_string(tests_listed, ' ') ilike ${like(p.test ?? '')}) and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50}`;
        return rows.map((r) => ({ ...listingBase(r), hours: r.hours, description: r.description, testsListed: r.tests_listed }));
      },
      async diagnostic(id) {
        const [r] = await sql`select *, ${latlng('location')} from public.diagnostic_centres where id = ${id} and active`;
        return r ? { ...listingBase(r), hours: r.hours, description: r.description, testsListed: r.tests_listed } : null;
      },
    },
  };
}
