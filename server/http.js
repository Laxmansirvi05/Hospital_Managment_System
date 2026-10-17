export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message safe to show to the caller
   * @param {Record<string, string>} [fields]
   */
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const MAX_BODY_BYTES = 1_000_000;

/** @param {import('node:http').IncomingMessage} req */
export async function readJson(req, limit = MAX_BODY_BYTES) {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send the request body as application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'payload_too_large', 'The request body is too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
}

/**
 * Parses with a Zod schema. Failures become 422, as the contract requires, and name each field.
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export function parseInput(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  /** @type {Record<string, string>} */
  const fields = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'body';
    fields[path] ??= issue.message;
  }
  throw new HttpError(422, 'validation_failed', `Invalid input: ${Object.keys(fields).join(', ')}`, fields);
}

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} [body] omitted for 204
 * @param {Record<string, string>} [headers]
 */
export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(status === 204 || body === undefined ? undefined : JSON.stringify(body));
}

/** @param {HttpError} error */
export function errorBody(error) {
  return { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } };
}
