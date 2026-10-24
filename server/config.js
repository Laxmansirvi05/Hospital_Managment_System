// The only module that reads server secrets (docs/09-security.md section 3.2 rule 4).
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const PLACEHOLDER = /^replace-(me|with)/;
const real = (schema) => schema.refine((v) => !PLACEHOLDER.test(v), 'is still the .env.example placeholder');
const optionalReal = (schema) => z.preprocess((v) => (v === '' || (typeof v === 'string' && PLACEHOLDER.test(v)) ? undefined : v), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: optionalReal(z.string().url()),
  JWT_SECRET: optionalReal(real(z.string().min(32))),
  TRACKING_TOKEN_PEPPER: optionalReal(real(z.string().min(32))),
  ALLOW_PRIVILEGED_SIGNUP: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  VERCEL: z.string().optional(),
  SUPABASE_URL: optionalReal(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: optionalReal(z.string().min(20)),
  PUBLIC_SUPABASE_URL: optionalReal(z.string().url()),
  PUBLIC_SUPABASE_ANON_KEY: optionalReal(z.string().min(20)),
  PUBLIC_MAPTILER_KEY: optionalReal(z.string().min(8)),
});

/**
 * @typedef {object} Config
 * @property {'development'|'test'|'production'} env
 * @property {number} port
 * @property {'postgres'|'memory'} store
 * @property {string|undefined} databaseUrl
 * @property {string} jwtSecret
 * @property {string} pepper
 * @property {boolean} allowPrivilegedSignup
 * @property {boolean} trustProxy
 * @property {{ url: string, serviceKey: string } | null} storage
 * @property {Record<string, string>} publicValues
 * @property {string[]} warnings
 */

/**
 * Validates the environment once. Throws with variable names only, never values.
 * @param {Record<string, string|undefined>} env
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration. ${names}`);
  }
  const v = parsed.data;
  const warnings = [];
  const prod = v.NODE_ENV === 'production';

  if (prod) {
    const missing = ['DATABASE_URL', 'JWT_SECRET', 'TRACKING_TOKEN_PEPPER'].filter((k) => !v[k]);
    if (missing.length) throw new Error(`Missing required configuration in production: ${missing.join(', ')}`);
    if (v.ALLOW_PRIVILEGED_SIGNUP === 'true') throw new Error('ALLOW_PRIVILEGED_SIGNUP must not be true in production (D-21)');
    // Without Supabase Storage, medical files would sit in function memory and vanish between instances.
    const storageMissing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !v[k]);
    if (storageMissing.length) throw new Error(`Missing required configuration in production: ${storageMissing.join(', ')}`);
    if (!v.SUPABASE_URL.startsWith('https://')) throw new Error('SUPABASE_URL must use https in production, so the service key is never sent in clear');
  }

  // P-27: without a database the local server runs on an in-memory store and says so.
  const store = v.DATABASE_URL ? 'postgres' : 'memory';
  if (store === 'memory') warnings.push('DATABASE_URL is not set. Using the in-memory store with sample data. Nothing is saved after a restart.');

  let jwtSecret = v.JWT_SECRET;
  let pepper = v.TRACKING_TOKEN_PEPPER;
  if (!jwtSecret) {
    jwtSecret = randomBytes(48).toString('base64url');
    warnings.push('JWT_SECRET is not set. Using a temporary secret, so sign-ins end when the server restarts.');
  }
  if (!pepper) {
    pepper = randomBytes(48).toString('base64url');
    warnings.push('TRACKING_TOKEN_PEPPER is not set. Using a temporary value.');
  }

  const storage = v.SUPABASE_URL && v.SUPABASE_SERVICE_ROLE_KEY ? { url: v.SUPABASE_URL, serviceKey: v.SUPABASE_SERVICE_ROLE_KEY } : null;
  if (!storage) warnings.push('Supabase Storage keys are not set. Uploaded files are kept in memory only.');

  // Allow-list for GET /api/v1/config (docs/09-security.md section 3.1). Nothing else is ever returned.
  const publicValues = {};
  if (v.PUBLIC_SUPABASE_URL) publicValues.supabaseUrl = v.PUBLIC_SUPABASE_URL;
  if (v.PUBLIC_SUPABASE_ANON_KEY) publicValues.supabaseAnonKey = v.PUBLIC_SUPABASE_ANON_KEY;
  if (v.PUBLIC_MAPTILER_KEY) publicValues.maptilerKey = v.PUBLIC_MAPTILER_KEY;

  return Object.freeze({
    env: v.NODE_ENV,
    port: v.PORT,
    store,
    databaseUrl: v.DATABASE_URL,
    jwtSecret,
    pepper,
    allowPrivilegedSignup: v.ALLOW_PRIVILEGED_SIGNUP === 'true',
    // Only behind a proxy that overwrites X-Forwarded-For (Vercel) is that header a real client address.
    trustProxy: v.TRUST_PROXY === 'true' || v.VERCEL === '1',
    storage,
    publicValues: Object.freeze(publicValues),
    warnings,
  });
}

let cached = null;
/** @returns {Config} */
export function getConfig() {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Test hook: replace the cached config. */
export function setConfigForTests(config) {
  cached = config;
}
