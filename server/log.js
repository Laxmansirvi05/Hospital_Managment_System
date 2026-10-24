// Redacting logger. Keys listed in docs/09-security.md section 11 never reach a log line.
const REDACT = /^(password|token|refresh|authorization|cookie|phone|email|lat|lng|address|medical.*|notes|key|secret|.*hash|photo.*|policy.*|dob|dateofbirth)$/i;

function scrub(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[redacted]' : scrub(v, depth + 1);
  return out;
}

function write(level, message, fields) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg: message, ...scrub(fields || {}) });
  (level === 'error' ? console.error : console.log)(line);
}

export const log = {
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};

export { scrub };
