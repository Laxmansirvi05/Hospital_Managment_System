import { ZodError } from 'zod';
import { log } from './log.js';

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {Record<string, string>} [fields]
   */
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const unauthorized = (code = 'unauthorized', message = 'Sign in to continue.') => new HttpError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'You do not have access to this.') => new HttpError(403, code, message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (code, message) => new HttpError(409, code, message);
/** A 422 for one field, for rules a schema cannot express alone. */
export const invalid = (field, message) => new HttpError(422, 'invalid_input', message, { [field]: message });

/**
 * Turns a Zod error into the 422 shape from docs/02-trd.md section 4.6.
 * @param {ZodError} err
 */
export function validationError(err) {
  const fields = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return new HttpError(422, 'invalid_input', `Check these fields: ${Object.keys(fields).join(', ')}.`, fields);
}

/** @param {import('zod').ZodTypeAny} schema */
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

const MAX_BODY = 64 * 1024;

/** Reads a JSON body up to 64 KB. */
export async function readJson(req) {
  // Checked before anything else: on Vercel the platform has already parsed the body, so the
  // streaming limit below would never run.
  if (Number(req.headers['content-length'] || 0) > MAX_BODY) throw new HttpError(413, 'too_large', 'The request is too large.');
  if (req.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > MAX_BODY) throw new HttpError(413, 'too_large', 'The request is too large.');
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large', 'The request is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
}

/** Reads a raw body up to a limit, for file uploads. */
export async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'too_large', 'The file is larger than allowed.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // A malformed cookie value is ignored rather than failing the whole request.
      out[name] = '';
    }
  }
  return out;
}

/**
 * @param {{ name: string, value: string, maxAge: number, path: string, secure: boolean }} c
 */
export function cookie({ name, value, maxAge, path, secure }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

export function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

export function sendError(res, err, requestId) {
  if (err instanceof ZodError) err = validationError(err);
  if (err instanceof HttpError) {
    const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
    send(res, err.status, { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }, headers);
    return;
  }
  // Database errors often quote the rejected value, which may be personal data, so only the
  // error code and the first stack frames are logged, never the message.
  log.error('unhandled error', { requestId, name: err?.name, code: err?.code, at: err?.stack?.split('\n').slice(1, 4).join(' | ') });
  send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.' } });
}
