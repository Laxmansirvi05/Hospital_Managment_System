// Passwords with scrypt and tokens with HMAC-SHA256, both from node:crypto (D-24).
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// OWASP minimum for scrypt. maxmem must exceed 128 * N * r bytes.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 256 * 1024 * 1024;

/** @param {string} password */
export async function hashPassword(password, params = { N, r: R, p: P }) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: params.N, r: params.r, p: params.p, maxmem: MAXMEM });
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/**
 * @param {string} password
 * @param {string} stored
 */
export async function verifyPassword(password, stored) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, expected] = parts;
  const want = Buffer.from(expected, 'base64url');
  const got = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return got.length === want.length && timingSafeEqual(got, want);
}

// A fixed hash so an unknown email costs the same time as a wrong password.
let dummy = null;
/** Builds the dummy hash at start-up so the first unknown-email login is not slower than the rest. */
export async function prewarm() {
  if (!dummy) dummy = await hashPassword('careroute-timing-equaliser');
}
export async function dummyVerify(password) {
  if (!dummy) dummy = await hashPassword('careroute-timing-equaliser');
  await verifyPassword(password, dummy);
  return false;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

/**
 * @param {Record<string, unknown>} claims
 * @param {string} secret
 * @param {number} ttlSeconds
 */
export function signJwt(claims, secret, ttlSeconds, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const body = Buffer.from(JSON.stringify({ ...claims, iat, exp: iat + ttlSeconds })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${HEADER}.${body}`).digest('base64url');
  return `${HEADER}.${body}.${sig}`;
}

/**
 * Returns the claims, or a reason string. The header must match byte for byte,
 * so "alg: none" and algorithm switching cannot get through.
 * @returns {{ ok: true, claims: any } | { ok: false, reason: 'invalid'|'expired' }}
 */
export function verifyJwt(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return { ok: false, reason: 'invalid' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return { ok: false, reason: 'invalid' };
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'invalid' };
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return { ok: false, reason: 'expired' };
  return { ok: true, claims };
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/** Peppered SHA-256 for refresh and tracking tokens. The token itself is never stored. */
export function hashToken(token, pepper) {
  return createHash('sha256').update(pepper).update(':').update(token).digest('base64url');
}
