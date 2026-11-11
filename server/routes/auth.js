import { z } from 'zod';
import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { parse, readJson, conflict, forbidden, unauthorized } from '../http.js';
import { limit, clientIp } from '../limits.js';
import { hashPassword, verifyPassword, dummyVerify } from '../auth/crypto.js';
import { startSession, refreshSession, refreshSessionId, clearCookies } from '../auth/session.js';

export const ROLES = ['patient', 'driver', 'admin'];

/** 10-digit Indian mobile numbers become +91 numbers; others must already be in + form (PROPOSED). */
export const phoneSchema = z.string().trim().transform((v) => v.replace(/[\s-]/g, '')).transform((v) => (/^[6-9]\d{9}$/.test(v) ? `+91${v}` : v))
  .refine((v) => /^\+[1-9]\d{7,14}$/.test(v), 'Enter a mobile number, for example 98765 43210');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters');

// An Indian registration plate such as TS09UB1234, typed with or without spaces or hyphens.
const registration = z.string().trim().transform((v) => v.replace(/[\s-]/g, '').toUpperCase()).refine((v) => /^[A-Z0-9]{4,20}$/.test(v), 'Enter the vehicle registration number, for example TS09UB1234');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email,
  // Patients add a phone later (owner, 2026-10-27). A driver needs one now, so a patient can be told who is coming.
  phone: phoneSchema.optional(),
  password,
  role: z.enum(ROLES).default('patient'),
  vehicle: z.object({ registrationNumber: registration, type: z.enum(['BLS', 'ALS', 'ICU']) }).strict().optional(),
}).strict().superRefine((v, ctx) => {
  if (v.role === 'driver') {
    if (!v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter your mobile number' });
    if (!v.vehicle) ctx.addIssue({ code: 'custom', path: ['vehicle', 'registrationNumber'], message: 'Enter the vehicle registration number' });
  } else if (v.vehicle) ctx.addIssue({ code: 'custom', path: ['vehicle'], message: 'Only a driver account has a vehicle' });
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(128) }).strict();

const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name });

export const routes = [
  {
    method: 'POST', path: '/auth/register', roles: 'public',
    async handler({ req }) {
      await limit('register-ip', clientIp(req), 10, 3600);
      const body = parse(registerSchema, await readJson(req));
      // Patients and drivers sign up here (owner, 2026-11-11, D-84). Admin accounts come from the account script (D-21).
      if (body.role === 'admin' && !getConfig().allowPrivilegedSignup) {
        throw forbidden('role_not_allowed', 'Only patients and drivers can sign up. Admin accounts are created by the CareRoute team.');
      }
      const passwordHash = await hashPassword(body.password);
      let user;
      if (body.role === 'driver') {
        const made = await getStore().drivers.register({ name: body.name, email: body.email, phone: body.phone, passwordHash, vehicle: body.vehicle });
        if (made.conflict === 'vehicle') throw conflict('vehicle_taken', 'A driver account already uses this registration number.');
        user = made.user;
      } else {
        user = await getStore().users.create({ name: body.name, email: body.email, phone: body.phone ?? null, role: body.role, passwordHash });
      }
      if (!user) throw conflict('email_taken', 'An account with this email already exists. Sign in instead.');
      const { token, cookies } = await startSession(req, user);
      return { status: 201, body: { token, user: publicUser(user) }, headers: { 'Set-Cookie': cookies } };
    },
  },
  {
    method: 'POST', path: '/auth/login', roles: 'public',
    async handler({ req }) {
      await limit('login-ip', clientIp(req), 30, 900);
      const body = parse(loginSchema, await readJson(req));
      await limit('login-account', body.email, 10, 900);
      const user = await getStore().users.byEmail(body.email);
      // An unknown email gets the same answer, after the same work, as a wrong password.
      const ok = user?.passwordHash ? await verifyPassword(body.password, user.passwordHash) : await dummyVerify(body.password);
      if (!user || !ok) throw unauthorized('invalid_credentials', 'The email or password is not right.');
      if (user.disabledAt) throw forbidden('account_disabled', 'This account is disabled.');
      const { token, cookies } = await startSession(req, user);
      return { body: { token, user: publicUser(user) }, headers: { 'Set-Cookie': cookies } };
    },
  },
  {
    method: 'GET', path: '/auth/me', roles: ROLES,
    async handler({ user }) {
      return { body: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, createdAt: user.createdAt } };
    },
  },
  {
    method: 'POST', path: '/auth/refresh', roles: 'public',
    async handler({ req }) {
      // The refresh cookie is the credential here, so the CSRF header is required.
      if (req.headers['x-careroute-csrf'] !== '1') throw forbidden('csrf_failed', 'Missing request header.');
      // No cookie means nothing to refresh, and it must not use up a limit other people share:
      // many patients reach the internet through one mobile network address.
      const sid = refreshSessionId(req);
      if (!sid) throw unauthorized('refresh_invalid', 'Sign in again.');
      await limit('refresh-session', sid, 30, 900);
      await limit('refresh-ip', clientIp(req), 600, 900);
      const { user, token, cookies } = await refreshSession(req);
      return { body: { token, user: publicUser(user) }, headers: { 'Set-Cookie': cookies } };
    },
  },
  {
    method: 'POST', path: '/auth/logout', roles: ROLES,
    async handler({ req, sessionId }) {
      await getStore().sessions.revoke(sessionId, 'logout');
      return { status: 204, headers: { 'Set-Cookie': clearCookies(req) } };
    },
  },
];
