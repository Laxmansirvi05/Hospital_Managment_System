// Structured logger that redacts by key name. Rules: docs/09-security.md section 11.

const SENSITIVE_PARTS = [
  'password', 'passwd', 'token', 'authorization', 'cookie', 'secret', 'key',
  'phone', 'email', 'address', 'location', 'medical', 'notes', 'allergies',
  'bloodgroup', 'databaseurl', 'dsn',
];
const SENSITIVE_EXACT = new Set(['lat', 'lng', 'latitude', 'longitude', 'message', 'body']);
const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

/** @param {string} name */
export function isSensitiveKey(name) {
  const normalized = name.toLowerCase().replace(/[_\-\s]/g, '');
  return SENSITIVE_EXACT.has(normalized) || SENSITIVE_PARTS.some((part) => normalized.includes(part));
}

/** Removes credentials that can hide inside free text such as provider error messages. */
export function scrubString(text) {
  return String(text)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"]*@[^\s'"]*/gi, '[redacted-url]')
    .replace(/\bBearer\s+[^\s'"]+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|key|apikey|api_key|access_token)=)[^&\s'"]+/gi, '$1[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
}

/** @param {unknown} value */
export function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message), code: /** @type {any} */ (value).code };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return out;
}

/**
 * @param {{ write?: (line: string) => void, now?: () => Date }} [options]
 */
export function createLogger({ write = (line) => process.stdout.write(`${line}\n`), now = () => new Date() } = {}) {
  /** @param {'info'|'warn'|'error'} level @param {string} event @param {Record<string, unknown>} [fields] */
  const emit = (level, event, fields = {}) => {
    write(JSON.stringify({ time: now().toISOString(), level, event, ...redact(fields) }));
  };
  return {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}

export const log = createLogger();
