import { z } from 'zod';
import { getStore } from '../db/index.js';
import { parse, readJson, notFound, invalid } from '../http.js';
import { phoneSchema } from './auth.js';

const PATIENT = ['patient'];
const id = z.string().uuid();
const text = (max) => z.string().trim().max(max);
const list = (maxItems, maxLen = 80) => z.array(text(maxLen).min(1)).max(maxItems);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24 hour time, for example 08:30');

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'];

// D-39 field groups. Every field is optional so the patient can fill it over time.
const medicalIdSchema = z.object({
  fullName: text(100).min(1),
  dateOfBirth: isoDate.refine((v) => v <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future'),
  gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say']),
  preferredLanguage: text(40),
  address: z.object({
    line1: text(120), line2: text(120), landmark: text(120), area: text(60), city: text(60), pinCode: z.string().regex(/^\d{6}$/, 'Pin code has 6 digits').or(z.literal('')),
  }).partial().strict(),
  bloodGroup: z.enum(BLOOD_GROUPS),
  heightCm: z.number().int().min(30).max(250).nullable(),
  weightKg: z.number().min(1).max(350).nullable(),
  allergies: list(30),
  conditions: list(30),
  currentMedicines: list(40, 120),
  pastSurgeries: list(30, 120),
  disabilities: list(20),
  organDonor: z.enum(['yes', 'no', 'undecided']),
  medicalNotes: text(500),
  insurance: z.object({ provider: text(80), policyNumber: text(40) }).partial().strict(),
  primaryDoctor: z.object({ name: text(100), phone: phoneSchema.or(z.literal('')) }).partial().strict(),
  shareWithCrew: z.boolean(),
}).partial().strict();

const contactSchema = z.object({
  name: text(100).min(1, 'Enter a name'),
  phone: phoneSchema,
  relation: text(40).min(1, 'Choose a relation'),
}).strict();

const reminderSchema = z.object({
  medicineName: text(120).min(1, 'Enter the medicine name'),
  dose: text(60).min(1, 'Enter the dose, for example 1 tablet'),
  instructions: text(120).default(''),
  times: z.array(time).min(1, 'Add at least one time').max(8).transform((t) => [...new Set(t)].sort()),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]).transform((d) => [...new Set(d)].sort()),
  startDate: isoDate,
  endDate: isoDate.nullable().default(null),
  notes: text(300).default(''),
  active: z.boolean().default(true),
}).strict().refine((r) => !r.endDate || r.endDate >= r.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] });

const reminderPatch = z.object({
  medicineName: text(120).min(1), dose: text(60).min(1), instructions: text(120),
  times: z.array(time).min(1).max(8).transform((t) => [...new Set(t)].sort()),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((d) => [...new Set(d)].sort()),
  startDate: isoDate, endDate: isoDate.nullable(), notes: text(300), active: z.boolean(),
}).partial().strict();

const doseSchema = z.object({ date: isoDate, time, status: z.enum(['taken', 'skipped']) }).strict();

const appointmentSchema = z.object({
  doctorName: text(100).min(1, 'Enter the doctor’s name'),
  speciality: text(60).default(''),
  place: text(150).min(1, 'Enter the hospital or clinic'),
  hospitalId: z.string().uuid().nullable().default(null),
  date: isoDate,
  time,
  reason: text(200).default(''),
  notes: text(300).default(''),
}).strict();

const appointmentPatch = z.object({
  doctorName: text(100).min(1), speciality: text(60), place: text(150).min(1), date: isoDate, time, reason: text(200), notes: text(300),
  status: z.enum(['scheduled', 'done', 'cancelled']),
}).partial().strict();

/** Today in India, since every patient is in Hyderabad (D-27) and servers run in UTC. */
export function todayIst(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

function ageFrom(dob, today) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

const EMPTY = {
  fullName: '', dateOfBirth: null, gender: null, preferredLanguage: '', address: {},
  bloodGroup: null, heightCm: null, weightKg: null, allergies: [], conditions: [], currentMedicines: [], pastSurgeries: [], disabilities: [],
  organDonor: 'undecided', medicalNotes: '', insurance: {}, primaryDoctor: {}, shareWithCrew: false, photoFileId: null,
};

/** Response built from explicit fields (docs/09-security.md section 6). */
export function medicalIdView(profile, user) {
  const p = { ...EMPTY, ...(profile || {}) };
  return {
    fullName: p.fullName || user.name,
    phone: user.phone,
    dateOfBirth: p.dateOfBirth,
    age: ageFrom(p.dateOfBirth, todayIst()),
    gender: p.gender,
    preferredLanguage: p.preferredLanguage,
    address: { line1: '', line2: '', landmark: '', area: '', city: 'Hyderabad', pinCode: '', ...p.address },
    bloodGroup: p.bloodGroup,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    allergies: p.allergies,
    conditions: p.conditions,
    currentMedicines: p.currentMedicines,
    pastSurgeries: p.pastSurgeries,
    disabilities: p.disabilities,
    organDonor: p.organDonor,
    medicalNotes: p.medicalNotes,
    insurance: { provider: '', policyNumber: '', ...p.insurance },
    primaryDoctor: { name: '', phone: '', ...p.primaryDoctor },
    shareWithCrew: p.shareWithCrew,
    hasPhoto: Boolean(p.photoFileId),
    completeness: completeness(p),
  };
}

const CHECKS = [
  (p) => p.dateOfBirth, (p) => p.gender, (p) => p.address?.line1 && p.address?.pinCode, (p) => p.bloodGroup,
  (p) => p.heightCm && p.weightKg, (p) => p.allergies.length || p.medicalNotes, (p) => p.primaryDoctor?.name, (p) => p.photoFileId,
];
function completeness(p) {
  return Math.round((CHECKS.filter((f) => f(p)).length / CHECKS.length) * 100);
}

const contactView = (c) => ({ id: c.id, name: c.name, phone: c.phone, relation: c.relation });
const reminderView = (r) => ({
  id: r.id, medicineName: r.medicineName, dose: r.dose, instructions: r.instructions, times: r.times, daysOfWeek: r.daysOfWeek,
  startDate: r.startDate, endDate: r.endDate, notes: r.notes, active: r.active,
});
const appointmentView = (a) => ({
  id: a.id, doctorName: a.doctorName, speciality: a.speciality, place: a.place, hospitalId: a.hospitalId, date: a.date, time: a.time,
  reason: a.reason, notes: a.notes, status: a.status,
});
export const fileView = (f) => ({ id: f.id, title: f.title, kind: f.kind, fileName: f.fileName, contentType: f.contentType, sizeBytes: f.sizeBytes, uploadedAt: f.createdAt });

async function own(promise) {
  const row = await promise;
  if (!row) throw notFound();
  return row;
}

function idParam(params, name = 'id') {
  const r = id.safeParse(params[name]);
  if (!r.success) throw notFound();
  return r.data;
}

export const routes = [
  {
    method: 'GET', path: '/patients/me/medical-id', roles: PATIENT,
    async handler({ user }) {
      return { body: medicalIdView(await getStore().profiles.get(user.id), user) };
    },
  },
  {
    method: 'PUT', path: '/patients/me/medical-id', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(medicalIdSchema, await readJson(req));
      const saved = await getStore().profiles.upsert(user.id, body);
      return { body: medicalIdView(saved, user) };
    },
  },

  {
    method: 'GET', path: '/patients/me/contacts', roles: PATIENT,
    async handler({ user }) { return { body: { contacts: (await getStore().contacts.list(user.id)).map(contactView) } }; },
  },
  {
    method: 'POST', path: '/patients/me/contacts', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(contactSchema, await readJson(req));
      const existing = await getStore().contacts.list(user.id);
      if (existing.length >= 5) throw invalid('contacts', 'You can save up to 5 contacts.');
      return { status: 201, body: contactView(await getStore().contacts.create(user.id, body)) };
    },
  },
  {
    method: 'DELETE', path: '/patients/me/contacts/:id', roles: PATIENT,
    async handler({ params, user }) {
      if (!(await getStore().contacts.remove(user.id, idParam(params)))) throw notFound();
      return { status: 204 };
    },
  },

  {
    method: 'GET', path: '/patients/me/reminders', roles: PATIENT,
    async handler({ user }) { return { body: { reminders: (await getStore().reminders.list(user.id)).map(reminderView) } }; },
  },
  {
    method: 'GET', path: '/patients/me/reminders/today', roles: PATIENT,
    async handler({ query, user }) {
      const date = query.get('date') ? parse(isoDate, query.get('date')) : todayIst();
      return { body: { date, doses: await getStore().reminders.doses(user.id, date) } };
    },
  },
  {
    method: 'POST', path: '/patients/me/reminders', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(reminderSchema, await readJson(req));
      return { status: 201, body: reminderView(await getStore().reminders.create(user.id, body)) };
    },
  },
  {
    method: 'PATCH', path: '/patients/me/reminders/:id', roles: PATIENT,
    async handler({ req, params, user }) {
      const rid = idParam(params);
      const patch = parse(reminderPatch, await readJson(req));
      const current = await own(getStore().reminders.get(user.id, rid));
      const end = patch.endDate === undefined ? current.endDate : patch.endDate;
      const start = patch.startDate ?? current.startDate;
      if (end && end < start) throw invalid('endDate', 'End date must be on or after the start date.');
      return { body: reminderView(await own(getStore().reminders.update(user.id, rid, patch))) };
    },
  },
  {
    method: 'DELETE', path: '/patients/me/reminders/:id', roles: PATIENT,
    async handler({ params, user }) {
      if (!(await getStore().reminders.remove(user.id, idParam(params)))) throw notFound();
      return { status: 204 };
    },
  },
  {
    method: 'POST', path: '/patients/me/reminders/:id/doses', roles: PATIENT,
    async handler({ req, params, user }) {
      const rid = idParam(params);
      const body = parse(doseSchema, await readJson(req));
      const reminder = await own(getStore().reminders.get(user.id, rid));
      if (!reminder.times.includes(body.time)) throw invalid('time', 'This reminder has no dose at that time.');
      return { body: await getStore().reminders.logDose(user.id, rid, body) };
    },
  },

  {
    method: 'GET', path: '/patients/me/appointments', roles: PATIENT,
    async handler({ user }) { return { body: { appointments: (await getStore().appointments.list(user.id)).map(appointmentView) } }; },
  },
  {
    method: 'POST', path: '/patients/me/appointments', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(appointmentSchema, await readJson(req));
      return { status: 201, body: appointmentView(await getStore().appointments.create(user.id, body)) };
    },
  },
  {
    method: 'PATCH', path: '/patients/me/appointments/:id', roles: PATIENT,
    async handler({ req, params, user }) {
      const patch = parse(appointmentPatch, await readJson(req));
      return { body: appointmentView(await own(getStore().appointments.update(user.id, idParam(params), patch))) };
    },
  },
  {
    method: 'DELETE', path: '/patients/me/appointments/:id', roles: PATIENT,
    async handler({ params, user }) {
      if (!(await getStore().appointments.remove(user.id, idParam(params)))) throw notFound();
      return { status: 204 };
    },
  },

  {
    // D-40: one call for the home dashboard.
    method: 'GET', path: '/patients/me/dashboard', roles: PATIENT,
    async handler({ query, user }) {
      const store = getStore();
      const date = query.get('date') ? parse(isoDate, query.get('date')) : todayIst();
      const [profile, doses, appts, docs, contacts, reminders] = await Promise.all([
        store.profiles.get(user.id), store.reminders.doses(user.id, date), store.appointments.list(user.id),
        store.files.list(user.id, 'document'), store.contacts.list(user.id), store.reminders.list(user.id),
      ]);
      const mid = medicalIdView(profile, user);
      const upcoming = appts.filter((a) => a.status === 'scheduled' && a.date >= date).slice(0, 4).map(appointmentView);
      return {
        body: {
          date,
          patient: {
            name: mid.fullName, age: mid.age, gender: mid.gender, bloodGroup: mid.bloodGroup, allergies: mid.allergies, conditions: mid.conditions,
            hasPhoto: mid.hasPhoto, completeness: mid.completeness, shareWithCrew: mid.shareWithCrew, contactCount: contacts.length,
          },
          today: { doses, taken: doses.filter((d) => d.status === 'taken').length, total: doses.length },
          appointments: upcoming,
          documents: docs.slice(0, 5).map(fileView),
          counts: { reminders: reminders.filter((r) => r.active).length, documents: docs.length, appointments: upcoming.length },
        },
      };
    },
  },
];
