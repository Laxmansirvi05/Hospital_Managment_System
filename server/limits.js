// Rate limits (D-25, docs/09-security.md section 7). Counters live in Postgres; keys are
// hashed so no email or IP is stored in clear.
import { getConfig } from './config.js';
import { getStore } from './db/index.js';
import { HttpError } from './http.js';
import { hashToken } from './auth/crypto.js';

export function clientIp(req) {
  // Only behind a proxy that overwrites X-Forwarded-For (Vercel) is that header a real client address.
  const fwd = getConfig().trustProxy ? req.headers['x-forwarded-for'] : undefined;
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
}

export async function limit(kind, value, max, windowSeconds) {
  const key = hashToken(`${kind}:${value}`, getConfig().pepper);
  const result = await getStore().rateLimits.hit(key, max, windowSeconds);
  if (!result.allowed) {
    const err = new HttpError(429, 'rate_limited', 'Too many requests. Wait a little and try again.');
    err.retryAfter = result.retryAfter;
    throw err;
  }
}

// Values are PROPOSED until the owner sets them (security review, question 4).
export const LIMITS = {
  uploadPerAccount: [20, 3600],
  searchPerIp: [120, 60],
  maxPendingUploads: 3,
};
