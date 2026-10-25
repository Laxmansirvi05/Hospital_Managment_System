// Fetch wrapper for /api/v1. Cookies carry the session (D-23); writes send the CSRF header.
// A missing or expired access token is refreshed once, then the request is retried.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code || 'error';
    this.fields = body?.error?.fields || {};
  }
}

let refreshing = null;

async function refresh() {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'x-careroute-csrf': '1' } })
      .then((r) => r.ok)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/**
 * @param {string} path  path under /api/v1
 * @param {{ method?: string, body?: any, retry?: boolean }} [o]
 */
export async function api(path, o = {}) {
  const method = o.method || (o.body !== undefined ? 'POST' : 'GET');
  const headers = {};
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-careroute-csrf'] = '1';
  let res;
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, credentials: 'same-origin', body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  } catch {
    throw new ApiError(0, { error: { code: 'offline', message: 'You seem to be offline. Check your connection and try again.' } });
  }
  // The access cookie lives 15 minutes, so the browser usually drops it before it can be sent
  // expired: a plain "unauthorized" is the common case, not "token_expired". Both try the refresh
  // cookie once. Sign-in, sign-up and refresh itself are never retried, so a wrong password stays wrong.
  const authCall = /^\/auth\/(login|register|refresh|logout)\b/.test(path);
  if (res.status === 401 && o.retry !== false && !authCall) {
    const body = await res.clone().json().catch(() => null);
    if (['token_expired', 'token_invalid', 'unauthorized'].includes(body?.error?.code) && (await refresh())) return api(path, { ...o, retry: false });
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** Sends the file bytes to the one-time upload link the server returned. */
export async function uploadTo(url, file) {
  const sameOrigin = url.startsWith('/');
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': file.type, ...(sameOrigin ? { 'x-careroute-csrf': '1' } : {}) },
    credentials: sameOrigin ? 'same-origin' : 'omit',
  });
  if (!res.ok) throw new ApiError(res.status, { error: { message: 'The upload did not finish. Try again.' } });
}

export function signInUrl() {
  const next = `${location.pathname}${location.search}`;
  return `/signin/?next=${encodeURIComponent(next)}`;
}
