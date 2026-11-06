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
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  SUPABASE_URL: optionalReal(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: optionalReal(z.string().min(20)),
  PUBLIC_SUPABASE_URL: optionalReal(z.string().url()),
  PUBLIC_SUPABASE_ANON_KEY: optionalReal(z.string().min(20)),
  PUBLIC_MAPTILER_KEY: optionalReal(z.string().min(8)),
  MAPBOX_TOKEN: optionalReal(z.string().min(8)),
  TWILIO_ACCOUNT_SID: optionalReal(z.string().regex(/^AC[0-9a-fA-F]{32}$/)),
  TWILIO_AUTH_TOKEN: optionalReal(z.string().min(16)),
  TWILIO_FROM: optionalReal(z.string().regex(/^\+[1-9][0-9]{7,14}$/)),
  // Sign in with Google (D-63): an OAuth web client from Google Cloud. Both or neither.
  GOOGLE_CLIENT_ID: optionalReal(z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/, 'must be a Google OAuth web client id')),
  GOOGLE_CLIENT_SECRET: optionalReal(real(z.string().min(10))),
  // The assistant's model providers, in order (D-66). Free plans only (D-47).
  GROQ_API_KEY: optionalReal(z.string().min(20)),
  GROQ_MODEL: z.string().min(3).max(100).default('openai/gpt-oss-120b'),
  // Model calls the whole site may make in a day, below the providers' free daily allowances.
  ASSISTANT_DAILY_LIMIT: z.coerce.number().int().min(1).max(100000).default(300),
  OPENROUTER_API_KEY: optionalReal(z.string().min(20)),
  // Only ':free' models, so the key can never be charged (CLAUDE.md rule 11). OpenRouter tries them
  // in order: free models are often rate limited by their host, so one is never enough.
  OPENROUTER_MODELS: z.string().default('nvidia/nemotron-3.5-super-vl:free,google/gemma-4-26b-a4b-it:free,google/gemma-4-31b-it:free')
    .transform((v) => v.split(',').map((m) => m.trim()).filter(Boolean))
    .refine((list) => list.length > 0 && list.length <= 3 && list.every((m) => /^[\w.-]+\/[\w.:-]+:free$/.test(m)), 'must be one to three free models (each ends in :free), separated by commas'),
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
 * @property {{ clientId: string, clientSecret: string } | null} google
 * @property {{ name: string, url: string, key: string, model: string, files: boolean }[]} aiProviders
 * @property {number} assistantDailyLimit
 * @property {Record<string, string|boolean>} publicValues
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
  // Vercel sets NODE_ENV=production on preview deployments too, so VERCEL_ENV decides which
  // one this is. Every deployed environment needs real configuration; only production forbids
  // privileged sign-up (D-21 allows it in preview).
  const deployed = v.NODE_ENV === 'production' || v.VERCEL_ENV === 'production' || v.VERCEL_ENV === 'preview';
  const prod = v.VERCEL_ENV ? v.VERCEL_ENV === 'production' : v.NODE_ENV === 'production';

  if (deployed) {
    const missing = ['DATABASE_URL', 'JWT_SECRET', 'TRACKING_TOKEN_PEPPER'].filter((k) => !v[k]);
    if (missing.length) throw new Error(`Missing required configuration in production: ${missing.join(', ')}`);
    if (prod && v.ALLOW_PRIVILEGED_SIGNUP === 'true') throw new Error('ALLOW_PRIVILEGED_SIGNUP must not be true in production (D-21)');
    // Without Supabase Storage, medical files would sit in function memory and vanish between instances.
    const storageMissing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !v[k]);
    if (storageMissing.length) throw new Error(`Missing required configuration in production: ${storageMissing.join(', ')}`);
    if (!v.SUPABASE_URL.startsWith('https://')) throw new Error('SUPABASE_URL must use https in production, so the service key is never sent in clear');
  }

  // P-27: without a database the local server runs on an in-memory store and says so.
  const store = v.DATABASE_URL ? 'postgres' : 'memory';
  // See the note in db/postgres.js: overlapping requests stall behind the transaction pooler.
  if (/\.pooler\.supabase\.com:6543\//.test(v.DATABASE_URL ?? '')) warnings.push('DATABASE_URL uses the Supabase transaction pooler (port 6543). Use the session pooler (port 5432), or requests can hang.');
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

  if (Boolean(v.GOOGLE_CLIENT_ID) !== Boolean(v.GOOGLE_CLIENT_SECRET)) {
    throw new Error('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither');
  }
  const google = v.GOOGLE_CLIENT_ID ? { clientId: v.GOOGLE_CLIENT_ID, clientSecret: v.GOOGLE_CLIENT_SECRET } : null;
  if (!google) warnings.push('Google sign-in is off: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.');

  // D-66: Groq first, then OpenRouter. Only providers with a key take part.
  const aiProviders = [
    v.GROQ_API_KEY && { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: v.GROQ_API_KEY, model: v.GROQ_MODEL, files: false },
    v.OPENROUTER_API_KEY && { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: v.OPENROUTER_API_KEY, model: v.OPENROUTER_MODELS[0], fallbacks: v.OPENROUTER_MODELS.slice(1), files: true },
  ].filter(Boolean);
  if (!aiProviders.length) warnings.push('No AI provider key is set. The assistant answers from its fixed rules only.');

  // Allow-list for GET /api/v1/config (docs/09-security.md section 3.1). Nothing else is ever returned.
  const publicValues = {};
  if (v.PUBLIC_SUPABASE_URL) publicValues.supabaseUrl = v.PUBLIC_SUPABASE_URL;
  if (v.PUBLIC_SUPABASE_ANON_KEY) publicValues.supabaseAnonKey = v.PUBLIC_SUPABASE_ANON_KEY;
  if (v.PUBLIC_MAPTILER_KEY) publicValues.maptilerKey = v.PUBLIC_MAPTILER_KEY;
  // Only whether the button works; the client id stays on the server, which builds the redirect.
  if (google) publicValues.googleSignIn = true;

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
    google,
    aiProviders,
    assistantDailyLimit: v.ASSISTANT_DAILY_LIMIT,
    mapboxToken: v.MAPBOX_TOKEN,
    twilio: v.TWILIO_ACCOUNT_SID && v.TWILIO_AUTH_TOKEN && v.TWILIO_FROM
      ? { accountSid: v.TWILIO_ACCOUNT_SID, authToken: v.TWILIO_AUTH_TOKEN, from: v.TWILIO_FROM }
      : null,
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
