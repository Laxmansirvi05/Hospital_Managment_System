// Sessions, cookies and request authentication (D-22, D-23).
import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { cookie, parseCookies, unauthorized, forbidden } from '../http.js';
import { signJwt, verifyJwt, randomToken, hashToken } from './crypto.js';

export const ACCESS_TTL = 15 * 60;
export const REFRESH_TTL = 7 * 24 * 60 * 60;
const ACCESS_COOKIE = 'cr_access';
const REFRESH_COOKIE = 'cr_refresh';
const REFRESH_PATH = '/api/v1/auth';

function secureCookies(req) {
  return getConfig().env === 'production' || req.headers['x-forwarded-proto'] === 'https';
}

/** Creates a session and returns the cookies and the access token. */
export async function startSession(req, user) {
  const { jwtSecret, pepper } = getConfig();
  const refresh = randomToken();
  const session = await getStore().sessions.create({
    userId: user.id,
    refreshHash: hashToken(refresh, pepper),
    expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
  });
  const token = signJwt({ sub: user.id, sid: session.id, role: user.role }, jwtSecret, ACCESS_TTL);
  return { token, cookies: sessionCookies(req, token, `${session.id}.${refresh}`) };
}

function sessionCookies(req, token, refreshValue) {
  const secure = secureCookies(req);
  return [
    cookie({ name: ACCESS_COOKIE, value: token, maxAge: ACCESS_TTL, path: '/', secure }),
    cookie({ name: REFRESH_COOKIE, value: refreshValue, maxAge: REFRESH_TTL, path: REFRESH_PATH, secure }),
  ];
}

export function clearCookies(req) {
  const secure = secureCookies(req);
  return [
    cookie({ name: ACCESS_COOKIE, value: '', maxAge: 0, path: '/', secure }),
    cookie({ name: REFRESH_COOKIE, value: '', maxAge: 0, path: REFRESH_PATH, secure }),
  ];
}

/** Rotates the refresh token. Presenting a rotated-out token revokes the whole session. */
export async function refreshSession(req) {
  const { jwtSecret, pepper } = getConfig();
  const raw = parseCookies(req.headers.cookie)[REFRESH_COOKIE] || '';
  const dot = raw.indexOf('.');
  if (dot < 1) throw unauthorized('refresh_invalid', 'Sign in again.');
  const sessionId = raw.slice(0, dot);
  const presented = hashToken(raw.slice(dot + 1), pepper);
  const store = getStore();
  const session = await store.sessions.get(sessionId);
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw unauthorized('refresh_invalid', 'Sign in again.');
  if (session.previousRefreshHash === presented) {
    await store.sessions.revoke(sessionId, 'refresh_reuse');
    throw unauthorized('refresh_reused', 'Sign in again.');
  }
  if (session.refreshHash !== presented) throw unauthorized('refresh_invalid', 'Sign in again.');
  const user = await store.users.byId(session.userId);
  if (!user || user.disabledAt) throw unauthorized('refresh_invalid', 'Sign in again.');
  const next = randomToken();
  const rotated = await store.sessions.rotate(sessionId, hashToken(next, pepper), presented, new Date(Date.now() + REFRESH_TTL * 1000));
  // A concurrent refresh already rotated this token; the loser signs in again rather than forking the session.
  if (!rotated) throw unauthorized('refresh_invalid', 'Sign in again.');
  const token = signJwt({ sub: user.id, sid: sessionId, role: user.role }, jwtSecret, ACCESS_TTL);
  return { user, token, cookies: sessionCookies(req, token, `${sessionId}.${next}`) };
}

/**
 * Reads the bearer token or the access cookie, checks the session is live and reads the role
 * from the database, so logout and role changes apply at once.
 * @returns {Promise<{ user: any, sessionId: string, viaCookie: boolean } | null>}
 */
export async function authenticate(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const fromCookie = parseCookies(req.headers.cookie)[ACCESS_COOKIE];
  const token = bearer || fromCookie;
  if (!token) return null;
  const result = verifyJwt(token, getConfig().jwtSecret);
  if (!result.ok) throw unauthorized(result.reason === 'expired' ? 'token_expired' : 'token_invalid', result.reason === 'expired' ? 'Your session expired.' : 'Sign in again.');
  const store = getStore();
  const session = await store.sessions.get(result.claims.sid);
  if (!session || session.revokedAt || session.userId !== result.claims.sub) throw unauthorized('session_ended', 'Sign in again.');
  const user = await store.users.byId(result.claims.sub);
  if (!user) throw unauthorized('session_ended', 'Sign in again.');
  if (user.disabledAt) throw forbidden('account_disabled', 'This account is disabled.');
  return { user, sessionId: session.id, viaCookie: !bearer };
}
