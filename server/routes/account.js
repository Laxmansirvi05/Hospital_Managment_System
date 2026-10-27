// Account settings: change password, sign out other devices, delete the account (D-45).
import { z } from 'zod';
import { getStore } from '../db/index.js';
import { getStorage } from '../adapters/storage.js';
import { parse, readJson, unauthorized, forbidden, HttpError } from '../http.js';
import { hashPassword, verifyPassword } from '../auth/crypto.js';
import { clearCookies } from '../auth/session.js';
import { limit } from '../limits.js';
import { ROLES } from './auth.js';

const BUCKETS = { document: 'patient-documents', photo: 'patient-photos' };

const passwordSchema = z.object({
  // Optional only for a Google account that has never had a password (D-63).
  currentPassword: z.string().min(1, 'Enter your current password').max(128).optional(),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
}).strict().refine((v) => v.currentPassword !== v.newPassword, { message: 'Choose a password you have not used here', path: ['newPassword'] });

const deleteSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(128).optional(),
  confirm: z.literal('DELETE', { message: 'Type DELETE to confirm' }),
}).strict();

const RECENT_SIGN_IN = 15 * 60 * 1000;

/**
 * Proof that the person at the keyboard owns the account: the password, or for a Google account
 * without one, a sign-in in the last 15 minutes (so a long-open tab cannot be used).
 */
async function checkPassword(user, password, sessionId) {
  await limit('password-check', user.id, 10, 900);
  if (!user.passwordHash) {
    const session = await getStore().sessions.get(sessionId);
    if (!session?.createdAt || Date.now() - new Date(session.createdAt).getTime() > RECENT_SIGN_IN) {
      throw forbidden('reauth_required', 'Sign in with Google again, then try this within 15 minutes.');
    }
    return;
  }
  if (!password || !(await verifyPassword(password, user.passwordHash))) throw unauthorized('invalid_credentials', 'That password is not right.');
}

export const routes = [
  {
    method: 'POST', path: '/auth/password', roles: ROLES,
    async handler({ req, user, sessionId }) {
      const body = parse(passwordSchema, await readJson(req));
      await checkPassword(user, body.currentPassword, sessionId);
      const store = getStore();
      await store.users.setPassword(user.id, await hashPassword(body.newPassword));
      // A changed password ends every other session, in case the old one was known to someone else.
      await store.sessions.revokeOthers(user.id, sessionId);
      return { status: 204 };
    },
  },
  {
    method: 'POST', path: '/auth/sessions/revoke-others', roles: ROLES,
    async handler({ user, sessionId }) {
      await getStore().sessions.revokeOthers(user.id, sessionId);
      return { status: 204 };
    },
  },
  {
    method: 'POST', path: '/patients/me/delete-account', roles: ['patient'],
    async handler({ req, user, sessionId }) {
      const body = parse(deleteSchema, await readJson(req));
      await checkPassword(user, body.password, sessionId);
      const store = getStore();
      // Files first: if storage fails, stop, so no file is left behind without an owner.
      for (const f of await store.files.all(user.id)) {
        try {
          await getStorage().remove(BUCKETS[f.purpose], f.storagePath);
        } catch {
          throw new HttpError(502, 'delete_incomplete', 'We could not remove your files just now, so your account was not deleted. Try again in a few minutes.');
        }
      }
      await store.users.remove(user.id);
      return { status: 204, headers: { 'Set-Cookie': clearCookies(req) } };
    },
  },
];
