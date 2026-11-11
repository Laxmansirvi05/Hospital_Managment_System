// Postgres store (P-04). Parameterised queries only, through the postgres driver's tagged
// templates. Same interface as memory.js.
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { dosesFor } from './geo.js';
import { createPostgresAdmin } from './admin-postgres.js';

const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const num = (v) => (v === null || v === undefined ? null : Number(v));

const userRow = (r) => r && { id: r.id, name: r.name, email: r.email, phone: r.phone, passwordHash: r.password_hash, assistantConsentAt: r.assistant_consent_at, role: r.role, createdAt: r.created_at, disabledAt: r.disabled_at };
const convRow = (r) => r && { id: r.id, userId: r.user_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at };
const msgRow = (r) => r && { id: r.id, conversationId: r.conversation_id, userId: r.user_id, role: r.role, content: r.content, payload: r.payload || {}, createdAt: r.created_at };
const sessionRow = (r) => r && { id: r.id, userId: r.user_id, createdAt: r.created_at, refreshHash: r.refresh_hash, previousRefreshHash: r.previous_refresh_hash, expiresAt: r.expires_at, revokedAt: r.revoked_at };
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
export const emergencyRow = (r) => r && ({
  id: r.id, patientUserId: r.patient_user_id, guestPhone: r.guest_phone, forSelf: r.for_self, emergencyType: r.emergency_type, conscious: r.conscious,
  patientCount: r.patient_count, ambulanceType: r.ambulance_type, notes: r.notes, location: { lat: num(r.patient_lat), lng: num(r.patient_lng) }, address: r.patient_address,
  status: r.status, ambulanceId: r.ambulance_id, etaSeconds: r.eta_seconds === null ? null : num(r.eta_seconds), etaIsEstimate: r.eta_is_estimate,
  offersMade: r.offers_made, trackingTokenHash: r.tracking_token_hash, trackingExpiresAt: r.tracking_expires_at, cancelReason: r.cancel_reason,
  isDemo: r.is_demo, createdAt: r.created_at, assignedAt: r.assigned_at, enRouteAt: r.en_route_at, arrivedAt: r.arrived_at,
  pickedUpAt: r.picked_up_at, atHospitalAt: r.at_hospital_at, completedAt: r.completed_at, closedAt: r.closed_at, updatedAt: r.updated_at,
});
export const ambulanceRow = (r) => r && ({
  id: r.id, driverUserId: r.driver_user_id, registrationNumber: r.registration_number, type: r.type, status: r.status, operatorName: r.operator_name,
  driverName: r.driver_name, driverPhone: r.driver_phone, isDemo: r.is_demo, lat: num(r.lat), lng: num(r.lng), heading: r.heading_degrees,
  speedKmph: num(r.speed_kmph), lastPingAt: r.last_ping_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const emergencyOfferRow = (r) => r && ({ id: r.id, emergencyId: r.emergency_id, ambulanceId: r.ambulance_id, rank: r.rank,
  etaSeconds: r.eta_seconds === null ? null : num(r.eta_seconds), state: r.state, offeredAt: r.offered_at, expiresAt: r.expires_at, createdAt: r.created_at });
export const emergencyEventRow = (r) => r && ({ id: r.id, emergencyId: r.emergency_id, kind: r.kind, actorRole: r.actor_role,
  actorUserId: r.actor_user_id, data: r.data || {}, createdAt: r.created_at });
export const emergencyFeedbackRow = (r) => r && ({ emergencyId: r.emergency_id, rating: r.rating, comment: r.comment, createdAt: r.created_at });

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

/** Opens the next queued offer for 30 seconds, or ends the request as no_match when none is left. */
async function openNextOffer(tx, emergencyId) {
  const [offer] = await tx`update public.emergency_offers o set state = 'open', offered_at = now(), expires_at = now() + interval '30 seconds'
    where o.id = (select q.id from public.emergency_offers q where q.emergency_id = ${emergencyId} and q.state = 'queued' order by q.rank limit 1) returning o.ambulance_id, o.rank`;
  if (offer) {
    await tx`update public.emergencies set offers_made = offers_made + 1, updated_at = now() where id = ${emergencyId}`;
    await tx`insert into public.emergency_events (emergency_id, kind, actor_role, data) values (${emergencyId}, 'offered', 'system', ${tx.json({ ambulance_id: offer.ambulance_id, rank: offer.rank })})`;
    return;
  }
  const [ended] = await tx`update public.emergencies set status = 'no_match', closed_at = now(), updated_at = now(),
    tracking_expires_at = least(created_at + interval '24 hours', now() + interval '2 hours') where id = ${emergencyId} and status = 'matching' returning id`;
  if (ended) await tx`insert into public.emergency_events (emergency_id, kind, actor_role) values (${emergencyId}, 'no_match', 'system')`;
}

/**
 * Supabase's transaction pooler (port 6543) stalls this driver for good when requests overlap, and then
 * every request waits (measured 2026-11-06: 40 at once hung on 6543, all succeeded on 5432). The same
 * credentials work on the session pooler, so a 6543 address is switched to 5432 here, whatever the
 * environment variable says.
 */
export function sessionPoolerUrl(url) {
  const u = new URL(url);
  if (u.hostname.endsWith('.pooler.supabase.com') && u.port === '6543') u.port = '5432';
  return u.toString();
}

export function createPostgresStore(rawUrl) {
  const url = sessionPoolerUrl(rawUrl);
  const sql = postgres(url, {
    // The session pooler gives each client connection its own database slot, and there are only about
    // fifteen. Every serverless instance holds its own pool, so each keeps one connection and gives it
    // back quickly; a deploy once used all the slots and sign-ups failed for ten seconds (2026-11-11).
    max: 1,
    idle_timeout: 8,
    connect_timeout: 10,
    prepare: false,
    types: { bigint: postgres.BigInt },
    transform: { undefined: null },
  });
  const json = (v) => sql.json(v ?? {});
  const point = (lat, lng) => sql`extensions.st_setsrid(extensions.st_makepoint(${lng}, ${lat}), 4326)::extensions.geography`;

  // sql.unsafe is used only on these fixed column expressions; anything else is a programming error.
  const COLUMNS = new Set(['location', 'coalesce(h.location, d.clinic_location)']);
  const column = (col) => {
    if (!COLUMNS.has(col)) throw new Error('nearFilter: column not allowed');
    return sql.unsafe(col);
  };

  function nearFilter(col, p) {
    if (p.lat == null) return { dist: sql`null::float8`, where: sql`true`, order: sql`name` };
    const origin = point(p.lat, p.lng);
    return {
      dist: sql`round((extensions.st_distance(${column(col)}, ${origin}) / 1000)::numeric, 2)::float8`,
      where: p.radiusKm ? sql`extensions.st_dwithin(${column(col)}, ${origin}, ${p.radiusKm * 1000})` : sql`true`,
      order: sql`${column(col)} operator(extensions.<->) ${origin}`,
    };
  }

  const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const listingBase = (r) => ({
    id: r.id, name: r.name, area: r.area, address: r.address, lat: r.lat, lng: r.lng, phone: r.phone, email: r.email, website: r.website,
    rating: num(r.rating), ratingCount: r.rating_count, sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at), total: r.total_count,
    ...(r.distance_km !== null && r.distance_km !== undefined ? { distanceKm: r.distance_km } : {}),
  });
  const hospitalOut = (r) => ({ ...listingBase(r), facilityType: r.facility_type, description: r.description, emergencyAvailable: r.emergency_available, specialities: r.specialities, departments: r.departments });
  const doctorOut = (r) => ({
    id: r.id, name: r.name, title: r.title, specialization: r.specialization, qualifications: r.qualifications, experienceYears: r.experience_years,
    hospitalId: r.hospital_id, publishedTimings: r.published_timings, profileUrl: r.profile_url, rating: num(r.rating), ratingCount: r.rating_count,
    photoUrl: r.photo_url, languages: r.languages, expertise: r.expertise, bookingUrl: r.booking_url, consultationFeeInr: num(r.consultation_fee_inr),
    sourcePlatform: r.source_platform, sourceUrl: r.source_url, checkedAt: day(r.checked_at), total: r.total_count,
    place: r.hospital_id
      ? { kind: 'hospital', id: r.hospital_id, name: r.h_name, area: r.h_area, address: r.h_address, phone: r.appointment_phone ?? r.h_phone, lat: r.p_lat, lng: r.p_lng }
      : { kind: 'clinic', id: null, name: r.clinic_name, area: r.clinic_area, address: r.clinic_address, phone: r.clinic_phone, lat: r.p_lat, lng: r.p_lng },
    ...(r.distance_km !== null && r.distance_km !== undefined ? { distanceKm: r.distance_km } : {}),
  });
  const latlng = (col) => sql`extensions.st_y(${column(col)}::extensions.geometry) as lat, extensions.st_x(${column(col)}::extensions.geometry) as lng`;
  const emergencySelect = sql`select e.*, extensions.st_y(e.patient_location::extensions.geometry) as patient_lat,
    extensions.st_x(e.patient_location::extensions.geometry) as patient_lng from public.emergencies e`;
  const ambulanceSelect = sql`select a.*, extensions.st_y(a.location::extensions.geometry) as lat,
    extensions.st_x(a.location::extensions.geometry) as lng from public.ambulances a`;

  async function doctorsQuery(where, p = {}) {
    const loc = 'coalesce(h.location, d.clinic_location)';
    const n = nearFilter(loc, p);
    return sql`
      select d.*, count(*) over()::int as total_count, h.name as h_name, h.area as h_area, h.address as h_address, h.phone as h_phone,
        extensions.st_y(${sql.unsafe(loc)}::extensions.geometry) as p_lat, extensions.st_x(${sql.unsafe(loc)}::extensions.geometry) as p_lng,
        ${n.dist} as distance_km
      from public.doctors d left join public.hospitals h on h.id = d.hospital_id
      where d.active and ${where} and ${n.where}
      order by ${p.sort === 'experience' ? sql`d.experience_years desc nulls last, d.name` : p.lat == null ? sql`d.name` : n.order}
      limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
  }

  return {
    kind: 'postgres',
    admin: createPostgresAdmin(sql, { point }),
    async ping() { await sql`select 1`; },
    async close() { await sql.end({ timeout: 5 }); },

    emergencies: {
      async nearbyAmbulances({ point: p, type = 'BLS', radiusKm = 10, maxAgeSeconds = 90, limit = 24 }) {
        const rows = await sql`select id, type, distance_m, is_demo from public.nearby_ambulances(${point(p.lat, p.lng)}, ${type}::public.ambulance_type, ${radiusKm}, ${maxAgeSeconds}, ${limit})`;
        // Simulated crews (is_demo) are never offered a request on a real database (D-85), even when
        // an older seed left some behind: they would sit ahead of real drivers and never answer.
        return rows.filter((r) => !r.is_demo).map((r) => ({ id: r.id, type: r.type, distanceKm: num(r.distance_m) / 1000, isDemo: r.is_demo }));
      },
      async createEmergency(input) {
        const id = input.id ?? randomUUID(); const p = input.location;
        return sql.begin(async (tx) => {
          const [row] = await tx`insert into public.emergencies (id, patient_user_id, guest_phone, for_self, emergency_type, conscious, patient_count,
            ambulance_type, notes, patient_location, patient_address, eta_seconds, tracking_token_hash, is_demo)
            values (${id}, ${input.patientUserId ?? null}, ${input.guestPhone ?? null}, ${input.forSelf ?? true}, ${input.emergencyType ?? 'other'},
              ${input.conscious ?? null}, ${input.patientCount ?? 1}, ${input.ambulanceType ?? 'BLS'}, ${input.notes ?? null}, ${point(p.lat, p.lng)},
              ${input.address ?? null}, ${input.etaSeconds ?? null}, ${input.trackingTokenHash}, true) returning *,
              extensions.st_y(patient_location::extensions.geometry) as patient_lat, extensions.st_x(patient_location::extensions.geometry) as patient_lng`;
          await tx`insert into public.emergency_events (emergency_id, kind, actor_role) values (${id}, 'created', ${input.patientUserId ? 'patient' : 'guest'})`;
          return emergencyRow(row);
        });
      },
      // Offers are opened with plain statements in one transaction, not through public.create_offers and
      // public.decline_offer: those call open_next_offer, which the API role may not run on a database
      // that predates migration 20261106000200 (found on production, 2026-11-06). Same rules as the
      // functions: row lock, one open offer, a 30 second window, one event row per move.
      async createOffers(emergencyId, candidates, etaIsEstimate = true) {
        return sql.begin(async (tx) => {
          const [locked] = await tx`select id from public.emergencies where id = ${emergencyId} and status = 'matching' for update`;
          if (!locked) return null;
          const [existing] = await tx`select 1 as found from public.emergency_offers where emergency_id = ${emergencyId} limit 1`;
          if (!existing) {
            await tx`update public.emergencies set eta_is_estimate = ${etaIsEstimate} where id = ${emergencyId}`;
            let rank = 0;
            for (const c of candidates.slice(0, 5)) {
              rank += 1;
              await tx`insert into public.emergency_offers (emergency_id, ambulance_id, rank, eta_seconds, state) values (${emergencyId}, ${c.ambulanceId}, ${rank}, ${c.etaSeconds ?? null}, 'queued')`;
            }
            await openNextOffer(tx, emergencyId);
          }
          const [row] = await tx`${emergencySelect} where e.id = ${emergencyId}`;
          return emergencyRow(row);
        });
      },
      async acceptEmergency(emergencyId, ambulanceId) {
        const [result] = await sql`select * from public.accept_emergency(${emergencyId}, ${ambulanceId})`;
        if (!result?.id) return null;
        const [row] = await sql`${emergencySelect} where e.id = ${emergencyId} and e.status = 'assigned' and e.ambulance_id = ${ambulanceId}`;
        return emergencyRow(row) || null;
      },
      async declineOffer(emergencyId, ambulanceId) {
        return sql.begin(async (tx) => {
          const [locked] = await tx`select id from public.emergencies where id = ${emergencyId} and status = 'matching' for update`;
          if (!locked) return null;
          const [declined] = await tx`update public.emergency_offers set state = 'declined' where emergency_id = ${emergencyId} and ambulance_id = ${ambulanceId} and state = 'open' returning id`;
          if (!declined) return null;
          await tx`insert into public.emergency_events (emergency_id, kind, actor_role, data) values (${emergencyId}, 'declined', 'driver', ${json({ ambulance_id: ambulanceId })})`;
          await openNextOffer(tx, emergencyId);
          const [row] = await tx`${emergencySelect} where e.id = ${emergencyId}`;
          return emergencyRow(row) || null;
        });
      },
      async expireOffers() { const [row] = await sql`select public.expire_offers() as count`; return row.count; },
      async advanceEmergency(emergencyId, ambulanceId, to) {
        const [result] = await sql`select * from public.advance_emergency(${emergencyId}, ${ambulanceId}, ${to}::public.emergency_status)`;
        if (!result?.id) return null;
        const [row] = await sql`${emergencySelect} where e.id = ${emergencyId} and e.ambulance_id = ${ambulanceId} and e.status = ${to}::public.emergency_status`;
        return emergencyRow(row) || null;
      },
      async cancelEmergency(emergencyId, reason = null) {
        const [result] = await sql`select * from public.cancel_emergency(${emergencyId}, ${reason})`;
        if (!result?.id) return null;
        const [row] = await sql`${emergencySelect} where e.id = ${emergencyId} and e.status = 'cancelled'`;
        return emergencyRow(row) || null;
      },
      async releaseAmbulance(ambulanceId) { const [row] = await sql`select public.release_ambulance(${ambulanceId}) as released`; return row.released; },
      async addFeedback(emergencyId, { rating, comment = null }) {
        const [row] = await sql`insert into public.emergency_feedback (emergency_id, rating, comment)
          select ${emergencyId}, ${rating}, ${comment} where exists (select 1 from public.emergencies where id = ${emergencyId} and status = 'completed')
          on conflict (emergency_id) do nothing returning *`;
        if (row) await sql`insert into public.emergency_events (emergency_id, kind, actor_role) values (${emergencyId}, 'feedback', 'patient')`;
        return emergencyFeedbackRow(row) || null;
      },
      async getById(id) { const [row] = await sql`${emergencySelect} where e.id = ${id}`; return emergencyRow(row) || null; },
      async getByTokenHash(hash) { const [row] = await sql`${emergencySelect} where e.tracking_token_hash = ${hash} and e.tracking_expires_at > now()`; return emergencyRow(row) || null; },
      async activeForPatient(userId) {
        const [row] = await sql`${emergencySelect} where e.patient_user_id = ${userId} and e.status not in ('completed', 'cancelled', 'no_match') order by e.created_at desc limit 1`;
        return emergencyRow(row) || null;
      },
      async history(userId, { limit = 50, offset = 0 } = {}) {
        return (await sql`${emergencySelect} where e.patient_user_id = ${userId} order by e.created_at desc limit ${limit} offset ${offset}`).map(emergencyRow);
      },
      async listAdmin({ status = null, limit = 100 } = {}) {
        return (await sql`${emergencySelect} where (${status}::text is null or e.status::text = ${status}) order by e.created_at desc limit ${limit}`).map(emergencyRow);
      },
      async listAmbulances() { return (await sql`${ambulanceSelect} where not a.is_demo order by a.registration_number`).map(ambulanceRow); },
      async ambulanceByDriver(driverUserId) { const [row] = await sql`${ambulanceSelect} where a.driver_user_id = ${driverUserId}`; return ambulanceRow(row) || null; },
      async setAmbulanceStatus(id, status) { const [row] = await sql`update public.ambulances set status = ${status}::public.ambulance_status, updated_at = now() where id = ${id} returning *, extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lng`; return ambulanceRow(row) || null; },
      async updateAmbulanceLocation(id, { lat, lng, heading = null, speed = null }) {
        const [row] = await sql`update public.ambulances set location = ${point(lat, lng)}, heading_degrees = ${heading}, speed_kmph = ${speed}, last_ping_at = now(), updated_at = now()
          where id = ${id} returning *, extensions.st_y(location::extensions.geometry) as lat, extensions.st_x(location::extensions.geometry) as lng`;
        return ambulanceRow(row) || null;
      },
      async openOfferForAmbulance(id) { const [row] = await sql`select * from public.emergency_offers where ambulance_id = ${id} and state = 'open' and expires_at > now() order by offered_at limit 1`; return emergencyOfferRow(row) || null; },
      async offersForEmergency(id) { return (await sql`select * from public.emergency_offers where emergency_id = ${id} order by rank`).map(emergencyOfferRow); },
      async activeForAmbulance(id) {
        const [row] = await sql`${emergencySelect} where e.ambulance_id = ${id} and e.status in ('assigned', 'en_route', 'arrived', 'picked_up', 'at_hospital') order by e.created_at desc limit 1`;
        return emergencyRow(row) || null;
      },
      async timeline(id) { return (await sql`select * from public.emergency_events where emergency_id = ${id} order by created_at, id`).map(emergencyEventRow); },
      async feedbackForEmergency(id) { const [row] = await sql`select * from public.emergency_feedback where emergency_id = ${id}`; return emergencyFeedbackRow(row) || null; },
      async insertEvent(id, kind, actorRole = 'system', data = {}) {
        const [row] = await sql`insert into public.emergency_events (emergency_id, kind, actor_role, data) values (${id}, ${kind}, ${actorRole}, ${json(data)}) returning *`;
        return emergencyEventRow(row);
      },
    },

    drivers: {
      /** A driver account and its one ambulance (D-73), created together or not at all. */
      async register({ name, email, phone, passwordHash, vehicle }) {
        const refused = Symbol('refused');
        try {
          return await sql.begin(async (tx) => {
            const [user] = await tx`insert into public.users (name, email, phone, password_hash, role) values (${name}, ${email}, ${phone}, ${passwordHash}, 'driver') on conflict do nothing returning *`;
            if (!user) throw Object.assign(new Error('email'), { [refused]: 'email' });
            const [ambulance] = await tx`insert into public.ambulances (driver_user_id, registration_number, type, status, operator_name, driver_name, driver_phone)
              values (${user.id}, ${vehicle.registrationNumber}, ${vehicle.type}::public.ambulance_type, 'offline', 'Independent driver', ${name.split(/\s+/)[0].slice(0, 100)}, ${phone})
              on conflict do nothing returning id`;
            if (!ambulance) throw Object.assign(new Error('vehicle'), { [refused]: 'vehicle' });
            return { user: userRow(user) };
          });
        } catch (err) {
          if (err?.[refused]) return { conflict: err[refused] };
          throw err;
        }
      },
    },

    users: {
      async create({ name, email, phone = null, passwordHash = null, role }) {
        const rows = await sql`insert into public.users (name, email, phone, password_hash, role) values (${name}, ${email}, ${phone}, ${passwordHash}, ${role})
          on conflict do nothing returning *`;
        return userRow(rows[0]) || null;
      },
      async byEmail(email) { return userRow((await sql`select * from public.users where email = ${email}`)[0]) || null; },
      /** D-67: when the patient agreed to send health facts to the assistant's models, or null. */
      async setAssistantConsent(id, at) {
        return userRow((await sql`update public.users set assistant_consent_at = ${at}, updated_at = now() where id = ${id} returning *`)[0]) || null;
      },
      async byId(id) { return userRow((await sql`select * from public.users where id = ${id}`)[0]) || null; },
      async list() { return (await sql`select * from public.users order by created_at`).map(userRow); },
      async setPassword(id, passwordHash) { await sql`update public.users set password_hash = ${passwordHash}, updated_at = now() where id = ${id}`; },
      // D-45: every patient table references users with on delete cascade.
      async remove(id) {
        await sql.begin(async (tx) => {
          // A driver's one ambulance goes with the account (D-73); emergencies keep their history.
          await tx`delete from public.ambulances where driver_user_id = ${id} and not is_demo`;
          await tx`delete from public.users where id = ${id}`;
        });
      },
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

    // Saved assistant conversations (D-68). Every query is scoped to the owner.
    assistant: {
      async create(userId, title) {
        return convRow((await sql`insert into public.assistant_conversations (user_id, title) values (${userId}, ${title}) returning *`)[0]);
      },
      async list(userId) {
        return (await sql`select * from public.assistant_conversations where user_id = ${userId} order by updated_at desc limit 50`).map(convRow);
      },
      async get(userId, id) {
        return convRow((await sql`select * from public.assistant_conversations where user_id = ${userId} and id = ${id}`)[0]) || null;
      },
      async remove(userId, id) {
        return (await sql`delete from public.assistant_conversations where user_id = ${userId} and id = ${id}`).count > 0;
      },
      async removeAll(userId) {
        await sql`delete from public.assistant_conversations where user_id = ${userId}`;
      },
      async addMessage({ conversationId, userId, role, content, payload = {} }) {
        const row = (await sql`insert into public.assistant_messages (conversation_id, user_id, role, content, payload)
          values (${conversationId}, ${userId}, ${role}, ${content}, ${sql.json(payload)}) returning *`)[0];
        await sql`update public.assistant_conversations set updated_at = now() where id = ${conversationId} and user_id = ${userId}`;
        return msgRow(row);
      },
      async messages(userId, conversationId, max = 200) {
        const rows = await sql`select * from (select * from public.assistant_messages where user_id = ${userId} and conversation_id = ${conversationId}
          order by created_at desc limit ${max}) m order by created_at`;
        return rows.map(msgRow);
      },
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
      /** Aggregates for the Explore page. Every number is a count of published listings, no personal data. */
      async insights() {
        const [totals] = await sql`select
          (select count(*) from public.hospitals where active)::int as care_places,
          (select count(*) from public.doctors where active)::int as doctors,
          (select count(*) from public.pharmacies where active)::int as pharmacies,
          (select count(*) from public.diagnostic_centres where active)::int as diagnostic_centres,
          (select count(*) from public.doctors where active and photo_url is not null)::int as doctors_with_photo,
          (select count(*) from public.hospitals where active and emergency_available is true)::int as emergency`;
        const byType = await sql`select facility_type as key, count(*)::int as n from public.hospitals where active group by 1 order by 2 desc`;
        const byArea = await sql`select area as key, count(*)::int as n from public.hospitals where active group by 1 order by 2 desc, 1 limit 12`;
        const bySpeciality = await sql`select specialization as key, count(*)::int as n from public.doctors where active group by 1 order by 2 desc, 1 limit 12`;
        const bySource = await sql`select source_platform as key, count(*)::int as n from public.doctors where active group by 1 order by 2 desc`;
        const byChain = await sql`select coalesce(chain, 'Independent') as key, count(*)::int as n from public.pharmacies where active group by 1 order by 2 desc`;
        const byMedicineGroup = await sql`select category as key, count(*)::int as n from public.medicines where active and category is not null group by 1 order by 2 desc, 1 limit 10`;
        const [medTotals] = await sql`select count(*)::int as n from public.medicines where active`;
        // Common tests patients ask about, cheapest published price for each.
        const tests = await sql`select distinct on (key) key, price_inr::float as price from (
            select case when name ilike '%complete blood%' then 'Complete blood count'
                        when name ilike '%thyroid profile%' or name ilike '%tft%' then 'Thyroid profile'
                        when name ilike '%hba1c%' or name ilike '%glycosylated%' then 'HbA1c (diabetes)'
                        when name ilike '%lipid profile%' then 'Lipid profile'
                        when name ilike '%vitamin d%' then 'Vitamin D'
                        when name ilike '%vitamin b12%' then 'Vitamin B12'
                        when name ilike '%liver function%' then 'Liver function'
                        when name ilike '%kidney function%' or name ilike '%renal function%' then 'Kidney function'
                   end as key, price_inr from public.test_prices where active) t
          where key is not null order by key, price`;
        const [fees] = await sql`select count(*)::int as n, min(consultation_fee_inr)::float as min,
          percentile_cont(0.5) within group (order by consultation_fee_inr)::float as median, max(consultation_fee_inr)::float as max
          from public.doctors where active and consultation_fee_inr is not null`;
        const points = await sql`
          select 'c' as k, facility_type as t, round(extensions.st_y(location::extensions.geometry)::numeric, 4)::float as lat, round(extensions.st_x(location::extensions.geometry)::numeric, 4)::float as lng from public.hospitals where active
          union all select 'p', null, round(extensions.st_y(location::extensions.geometry)::numeric, 4)::float, round(extensions.st_x(location::extensions.geometry)::numeric, 4)::float from public.pharmacies where active
          union all select 'd', null, round(extensions.st_y(location::extensions.geometry)::numeric, 4)::float, round(extensions.st_x(location::extensions.geometry)::numeric, 4)::float from public.diagnostic_centres where active`;
        const pairs = (rows) => rows.map((r) => ({ key: r.key, count: r.n }));
        return {
          totals: { carePlaces: totals.care_places, doctors: totals.doctors, pharmacies: totals.pharmacies, diagnosticCentres: totals.diagnostic_centres, doctorsWithPhoto: totals.doctors_with_photo, emergency: totals.emergency },
          byType: pairs(byType), byArea: pairs(byArea), bySpeciality: pairs(bySpeciality), bySource: pairs(bySource), byChain: pairs(byChain),
          medicines: medTotals.n, byMedicineGroup: pairs(byMedicineGroup), commonTests: tests.map((t) => ({ key: t.key, price: t.price })),
          fees: fees.n ? { count: fees.n, min: fees.min, median: fees.median, max: fees.max } : null,
          points: points.map((p) => ({ kind: p.k, type: p.t, lat: p.lat, lng: p.lng })),
        };
      },
      async mapLocations() {
        const rows = await sql`
          select id, 'c' as kind, facility_type as type, name, area, address, phone, email, website,
            rating, rating_count, source_platform, source_url,
            extensions.st_y(location::extensions.geometry)::float8 as lat,
            extensions.st_x(location::extensions.geometry)::float8 as lng
          from public.hospitals where active
          union all
          select id, 'p', null, name, area, address, phone, email, website,
            rating, rating_count, source_platform, source_url,
            extensions.st_y(location::extensions.geometry)::float8,
            extensions.st_x(location::extensions.geometry)::float8
          from public.pharmacies where active
          union all
          select id, 'd', null, name, area, address, phone, email, website,
            rating, rating_count, source_platform, source_url,
            extensions.st_y(location::extensions.geometry)::float8,
            extensions.st_x(location::extensions.geometry)::float8
          from public.diagnostic_centres where active
          order by name`;
        return rows.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).map((x) => ({
          id: x.id, kind: x.kind, type: x.type, name: x.name, area: x.area, address: x.address,
          phone: x.phone, email: x.email, website: x.website, rating: num(x.rating), ratingCount: x.rating_count,
          sourcePlatform: x.source_platform, sourceUrl: x.source_url, lat: x.lat, lng: x.lng,
        }));
      },
      async testPrices(p) {
        const rows = await sql`select *, count(*) over()::int as total_count from public.test_prices where active
          and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')})
          and (${p.provider ?? null}::text is null or provider = ${p.provider ?? null})
          order by ${p.q ? sql`extensions.similarity(name, ${p.q}) desc,` : sql``} price_inr limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
        return rows.map((r) => ({ name: r.name, provider: r.provider, priceInr: num(r.price_inr), centresOffering: r.centres_offering, url: r.url, checkedAt: day(r.checked_at), total: r.total_count }));
      },
      async areas() {
        const rows = await sql`
          select area from (
            select area from public.hospitals where active union all
            select area from public.pharmacies where active union all
            select area from public.diagnostic_centres where active) a
          group by area order by area`;
        return rows.map((r) => r.area);
      },
      /** The middle of each area's listings, so the browser can name a point and place an area. */
      async areaCentroids() {
        const rows = await sql`
          select area as name, count(*)::int as places,
            round(avg(extensions.st_y(location::extensions.geometry))::numeric, 5)::float8 as lat,
            round(avg(extensions.st_x(location::extensions.geometry))::numeric, 5)::float8 as lng
          from (
            select area, location from public.hospitals where active union all
            select area, location from public.pharmacies where active union all
            select area, location from public.diagnostic_centres where active) a
          where area is not null and area <> 'Hyderabad'
          group by area order by area`;
        return rows;
      },
      async hospitals(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km, count(*) over()::int as total_count from public.hospitals
          where active
            and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')}
                 or array_to_string(specialities, ' ') ilike ${like(p.q ?? '')} or array_to_string(departments, ' ') ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null})
            and (${p.emergencyOnly ?? false} = false or emergency_available is true)
            and (${p.type ?? null}::text is null or facility_type = ${p.type ?? null})
            -- Sources spell specialities their own way, so the filter matches part of a name, ignoring case.
            and (${p.speciality ?? null}::text is null or exists (select 1 from unnest(specialities) s where s ilike ${like(p.speciality ?? '')}))
            and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
        return rows.map(hospitalOut);
      },
      async hospital(id) { const [r] = await sql`select *, ${latlng('location')} from public.hospitals where id = ${id} and active`; return r ? hospitalOut(r) : null; },
      async hospitalDoctors(id, specialization) {
        // A large hospital lists hundreds of doctors; the page shows them all, grouped by speciality.
        return (await doctorsQuery(sql`d.hospital_id = ${id} and (${specialization ?? null}::text is null or d.specialization ilike ${like(specialization ?? '')})`, { limit: 1000 })).map(doctorOut);
      },
      async doctors(p) {
        const where = sql`(${p.q ?? null}::text is null or d.name ilike ${like(p.q ?? '')} or d.specialization ilike ${like(p.q ?? '')} or coalesce(h.name, d.clinic_name) ilike ${like(p.q ?? '')})
          and (${p.area ?? null}::text is null or coalesce(h.area, d.clinic_area) = ${p.area ?? null})
          and (${p.specialization ?? null}::text is null or d.specialization ilike ${like(p.specialization ?? '')})
          and (${p.language ?? null}::text is null or ${p.language ?? null} = any(d.languages))
          and (${p.group ?? null}::text is null or d.source_platform = ${p.group ?? null})`;
        return (await doctorsQuery(where, p)).map(doctorOut);
      },
      async doctor(id) { const [r] = await doctorsQuery(sql`d.id = ${id}`); return r ? doctorOut(r) : null; },
      async medicines(p) {
        const meds = await sql`select *, count(*) over()::int as total_count from public.medicines where active
          and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or category ilike ${like(p.q ?? '')})
          and (${p.category ?? null}::text is null or category = ${p.category ?? null})
          order by name limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
        if (!meds.length) return [];
        const listings = await sql`select * from public.medicine_listings where active and medicine_id in ${sql(meds.map((m) => m.id))} order by price_inr`;
        return meds.map((m) => ({
          id: m.id, name: m.name, form: m.form, pack: m.pack, category: m.category, prescriptionRequired: m.prescription_required, total: m.total_count,
          listings: listings.filter((l) => l.medicine_id === m.id).map((l) => ({ platform: l.platform, priceInr: num(l.price_inr), productUrl: l.product_url, checkedAt: l.checked_at.toISOString() })),
        }));
      },
      async medicine(id) {
        const [m] = await sql`select * from public.medicines where id = ${id} and active`;
        if (!m) return null;
        const listings = await sql`select * from public.medicine_listings where medicine_id = ${id} and active order by price_inr`;
        return { id: m.id, name: m.name, form: m.form, pack: m.pack, category: m.category, prescriptionRequired: m.prescription_required, listings: listings.map((l) => ({ platform: l.platform, priceInr: num(l.price_inr), productUrl: l.product_url, checkedAt: l.checked_at.toISOString() })) };
      },
      async pharmacies(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km, count(*) over()::int as total_count from public.pharmacies
          where active and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null}) and (${p.open24 ?? false} = false or open_24)
            and (${p.chain ?? null}::text is null or chain = ${p.chain ?? null}) and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
        return rows.map((r) => ({ ...listingBase(r), chain: r.chain, hours: r.hours, open24: r.open_24 }));
      },
      async pharmacy(id) { const [r] = await sql`select *, ${latlng('location')} from public.pharmacies where id = ${id} and active`; return r ? { ...listingBase(r), chain: r.chain, hours: r.hours, open24: r.open_24 } : null; },
      async diagnostics(p) {
        const n = nearFilter('location', p);
        const rows = await sql`
          select *, ${latlng('location')}, ${n.dist} as distance_km, count(*) over()::int as total_count from public.diagnostic_centres
          where active and (${p.q ?? null}::text is null or name ilike ${like(p.q ?? '')} or area ilike ${like(p.q ?? '')} or array_to_string(tests_listed, ' ') ilike ${like(p.q ?? '')})
            and (${p.area ?? null}::text is null or area = ${p.area ?? null})
            and (${p.test ?? null}::text is null or array_to_string(tests_listed, ' ') ilike ${like(p.test ?? '')}) and ${n.where}
          order by ${n.order} limit ${p.limit ?? 50} offset ${p.offset ?? 0}`;
        return rows.map((r) => ({ ...listingBase(r), hours: r.hours, description: r.description, testsListed: r.tests_listed }));
      },
      async diagnostic(id) {
        const [r] = await sql`select *, ${latlng('location')} from public.diagnostic_centres where id = ${id} and active`;
        return r ? { ...listingBase(r), hours: r.hours, description: r.description, testsListed: r.tests_listed } : null;
      },
    },
  };
}
