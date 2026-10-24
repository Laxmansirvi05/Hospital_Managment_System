import { z } from 'zod';
import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { HttpError, parse, readJson, conflict, forbidden, unauthorized } from '../http.js';
import { hashPassword, verifyPassword, dummyVerify, hashToken } from '../auth/crypto.js';
import { startSession, refreshSession, clearCookies } from '../auth/session.js';

export const ROLES = ['patient', 'driver', 'admin'];

/** 10-digit Indian mobile numbers become +91 numbers; others must already be in + form (PROPOSED). */
export const phoneSchema = z.string().trim().transform((v) => v.replace(/[\s-]/g, '')).transform((v) => (/^[6-9]\d{9}$/.test(v) ? `+91${v}` : v))
  .refine((v) => /^\+[1-9]\d{7,14}$/.test(v), 'Enter a mobile number, for example 98765 43210');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email,
  phone: phoneSchema,
  password,
  role: z.enum(ROLES).default('patient'),
}).strict();

const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(128) }).strict();

function clientIp(req) {
  const fwd = getConfig().trustProxy ? req.headers['x-forwarded-for'] : undefined;
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
}

/** Postgres-backed counters (D-25). Keys are hashed so no email or IP is stored in clear. */
async function limit(kind, value, max, windowSeconds) {
  const key = hashToken(`${kind}:${value}`, getConfig().pepper);
  const result = await getStore().rateLimits.hit(key, max, windowSeconds);
  if (!result.allowed) {
    const err = new HttpError(429, 'rate_limited', 'Too many attempts. Wait a little and try again.');
    err.retryAfter = result.retryAfter;
    throw err;
  }
}

const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name });

export const routes = [
  {
    method: 'POST', path: '/auth/register', roles: 'public',
    async handler({ req }) {
      await limit('register-ip', clientIp(req), 10, 3600);
      const body = parse(registerSchema, await readJson(req));
      if (body.role !== 'patient' && !getConfig().allowPrivilegedSignup) {
        throw forbidden('role_not_allowed', 'Only patients can sign up. Driver and admin accounts are created by the CareRoute team.');
      }
      const user = await getStore().users.create({
        name: body.name, email: body.email, phone: body.phone, role: body.role, passwordHash: await hashPassword(body.password),
      });
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
      const ok = user ? await verifyPassword(body.password, user.passwordHash) : await dummyVerify(body.password);
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
      await limit('refresh-ip', clientIp(req), 60, 900);
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
