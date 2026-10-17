import { z } from 'zod';

// Variables are validated per group, at the first use of that group. A work package that
// has not been built yet (SMS, triage) does not block startup of the parts that exist.
// `pnpm check:env` validates every group before a deploy.

const required = z.string().trim().min(1, 'is required');
const url = z.url('must be a URL');
const longSecret = z.string().min(32, 'must be at least 32 characters');

const groups = {
  database: z.object({ DATABASE_URL: url }),
  auth: z.object({ JWT_SECRET: longSecret, TRACKING_TOKEN_PEPPER: longSecret }),
  storage: z.object({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: required }),
  publicConfig: z.object({
    PUBLIC_SUPABASE_URL: url,
    PUBLIC_SUPABASE_ANON_KEY: required,
    PUBLIC_MAPTILER_KEY: required,
  }),
  triage: z.object({
    GEMINI_API_KEY: required,
    GROQ_API_KEY: required,
    OPENROUTER_API_KEY: required,
  }),
  routing: z.object({ MAPBOX_SECRET_TOKEN: required }),
  sms: z.object({
    TWILIO_ACCOUNT_SID: required,
    TWILIO_API_KEY_SID: required,
    TWILIO_API_KEY_SECRET: required,
    TWILIO_FROM_NUMBER: required,
  }),
};

/** The only names that may ever be sent to a browser. See docs/09-security.md section 3.1. */
export const PUBLIC_CONFIG_NAMES = Object.freeze([
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_MAPTILER_KEY',
]);

/** Every server-only variable name. Used by the public file scan. */
export const SERVER_SECRET_NAMES = Object.freeze(
  Object.entries(groups)
    .filter(([name]) => name !== 'publicConfig')
    .flatMap(([, schema]) => Object.keys(schema.shape)),
);

export const GROUP_NAMES = Object.freeze(Object.keys(groups));

export class ConfigError extends Error {
  /** @param {string} group @param {string[]} problems names and reasons, never values */
  constructor(group, problems) {
    super(`Configuration group "${group}" is invalid: ${problems.join('; ')}`);
    this.name = 'ConfigError';
    this.group = group;
    this.problems = problems;
  }
}

const cache = new Map();

/**
 * @param {keyof typeof groups} group
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string>}
 */
export function getConfig(group, env = process.env) {
  const schema = groups[group];
  if (!schema) throw new Error(`Unknown configuration group "${group}"`);
  if (env === process.env && cache.has(group)) return cache.get(group);

  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`);
    throw new ConfigError(group, problems);
  }
  const value = Object.freeze(result.data);
  if (env === process.env) cache.set(group, value);
  return value;
}

/** Test helper: forget cached groups after changing process.env. */
export function resetConfigCache() {
  cache.clear();
}
