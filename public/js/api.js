export class ApiError extends Error {
  /** @param {number} status @param {string} code @param {string} message @param {Record<string,string>} [fields] */
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/**
 * Calls the CareRoute API. Network failures become an ApiError with status 0.
 * @param {string} path for example '/health'
 * @param {{ method?: string, body?: unknown, token?: string, signal?: AbortSignal }} [options]
 */
export async function api(path, { method = 'GET', body, token, signal } = {}) {
  /** @type {Record<string, string>} */
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (_error) {
    throw new ApiError(0, 'network_error', 'No connection to CareRoute.');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    throw new ApiError(response.status, error.code ?? 'unknown_error', error.message ?? 'Something went wrong.', error.fields);
  }
  return data;
}
