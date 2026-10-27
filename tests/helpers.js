// Starts the real router on a random local port with the in-memory store and storage.
// These tests run against fakes for the database and storage, and say so in their names.
import { createServer } from 'node:http';
import { loadConfig, setConfigForTests } from '../server/config.js';
import { setStoreForTests } from '../server/db/index.js';
import { createMemoryStore } from '../server/db/memory.js';
import { memoryStorage, setStorageForTests } from '../server/adapters/storage.js';
import { handle } from '../server/router.js';

export async function startApp({ allowPrivilegedSignup = true, google = false } = {}) {
  // With google: true the Google client is set, and the token exchange is a fake the test installs.
  const googleEnv = google ? { GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret-value' } : {};
  const config = loadConfig({ NODE_ENV: 'test', ALLOW_PRIVILEGED_SIGNUP: allowPrivilegedSignup ? 'true' : 'false', TRUST_PROXY: 'true', JWT_SECRET: 'x'.repeat(40), TRACKING_TOKEN_PEPPER: 'y'.repeat(40), ...googleEnv });
  const store = createMemoryStore();
  const storage = memoryStorage();
  // Config, store and storage are module singletons; activate() puts this app's back after another app replaced them.
  const activate = () => { setConfigForTests(config); setStoreForTests(store); setStorageForTests(storage); };
  activate();
  const server = createServer((req, res) => handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  /** @param {string} path @param {{ method?: string, body?: any, token?: string, cookie?: string, headers?: Record<string,string>, raw?: any, redirect?: RequestRedirect }} o */
  async function api(path, o = {}) {
    const headers = { ...(o.headers || {}) };
    if (o.body !== undefined) headers['content-type'] = 'application/json';
    if (o.token) headers.authorization = `Bearer ${o.token}`;
    if (o.cookie) headers.cookie = o.cookie;
    const res = await fetch(`${base}${path.startsWith('/api') ? path : `/api/v1${path}`}`, {
      method: o.method || (o.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      redirect: o.redirect || 'follow',
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  let n = 0;
  async function user(role = 'patient') {
    n += 1;
    const email = `${role}${n}@test.example`;
    // Each test user arrives from its own address behind the trusted proxy, so per-IP limits apply per user.
    const r = await api('/auth/register', { body: { name: `${role} ${n}`, email, phone: `98765${String(n).padStart(5, '0')}`, password: 'correct horse', role }, headers: { 'x-forwarded-for': `10.0.${Math.floor(n / 250)}.${n % 250}` } });
    if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
    return { token: r.body.token, id: r.body.user.id, email, cookies: r.headers.getSetCookie() };
  }

  return { api, user, store, activate, base, close: () => new Promise((r) => server.close(r)) };
}

/** Joins Set-Cookie headers into one Cookie header. */
export function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}
