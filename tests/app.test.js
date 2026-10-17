import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRouter, createApp } from '../server/app.js';
import { ConfigError } from '../server/config.js';
import { HttpError } from '../server/http.js';

const PUBLIC_ENV = {
  PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'anon-demo',
  PUBLIC_MAPTILER_KEY: 'maptiler-demo',
};

let server;
const logged = [];
const quietLog = { info: (e, f) => logged.push({ e, f }), warn: () => {}, error: (e, f) => logged.push({ e, f }) };

/** Starts the real handler on a random port. Returns the base URL. */
async function start(options) {
  const app = createApp({ log: quietLog, ...options });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  logged.length = 0;
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
});

const deps = (overrides = {}) => ({
  db: { ping: async () => {} },
  getConfig: (group) => {
    if (group === 'publicConfig') return PUBLIC_ENV;
    throw new ConfigError(group, ['X is required']);
  },
  ...overrides,
});

describe('GET /api/v1/health', () => {
  it('returns ok when the database answers (collection folder 0)', async () => {
    const base = await start({ deps: deps() });
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 when the database does not answer', async () => {
    const base = await start({ deps: deps({ db: { ping: async () => { throw new Error('connect failed'); } } }) });
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('unavailable');
  });

  it('returns 500 server_misconfigured when DATABASE_URL is missing', async () => {
    const base = await start({ deps: deps({ db: { ping: async () => { throw new ConfigError('database', ['DATABASE_URL is required']); } } }) });
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('server_misconfigured');
  });
});

describe('GET /api/v1/config', () => {
  it('returns only the allow-listed public values', async () => {
    const base = await start({ deps: deps() });
    const body = await (await fetch(`${base}/api/v1/config`)).json();
    expect(Object.keys(body).sort()).toEqual(['maptilerKey', 'supabaseAnonKey', 'supabaseUrl']);
    expect(body.supabaseUrl).toBe(PUBLIC_ENV.PUBLIC_SUPABASE_URL);
  });

  it('returns a generic 500 when public config is missing', async () => {
    const base = await start({ deps: deps({ getConfig: (g) => { throw new ConfigError(g, ['PUBLIC_MAPTILER_KEY is required']); } }) });
    const res = await fetch(`${base}/api/v1/config`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('server_misconfigured');
    expect(JSON.stringify(body)).not.toContain('PUBLIC_MAPTILER_KEY');
  });
});

describe('routing and access', () => {
  it('returns 404 JSON for unknown endpoints', async () => {
    const base = await start({ deps: deps() });
    const res = await fetch(`${base}/api/v1/does-not-exist`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('returns 405 with Allow for a wrong method', async () => {
    const base = await start({ deps: deps() });
    const res = await fetch(`${base}/api/v1/health`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });

  it('fails closed with 401 on protected routes until auth exists', async () => {
    const router = buildRouter().add('GET', '/emergencies/mine', { roles: ['patient'] }, async () => ({ status: 200, body: {} }));
    const base = await start({ router, deps: deps() });
    const res = await fetch(`${base}/api/v1/emergencies/mine`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for the wrong role', async () => {
    const router = buildRouter().add('POST', '/emergencies/:id/accept', { roles: ['driver'] }, async () => ({ status: 200, body: {} }));
    const base = await start({ router, deps: deps(), authenticate: async () => ({ id: 'u1', role: 'patient' }) });
    const res = await fetch(`${base}/api/v1/emergencies/em_1/accept`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('hides unexpected errors and logs the route pattern, not the URL', async () => {
    const router = buildRouter().add('GET', '/emergencies/:id/track', { roles: 'public' }, async () => {
      throw new Error('db password=hunter2 exploded');
    });
    const base = await start({ router, deps: deps() });
    const res = await fetch(`${base}/api/v1/emergencies/em_1/track?token=trk_secret`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('hunter2');
    const request = logged.find((l) => l.e === 'request');
    expect(request.f.route).toBe('/emergencies/:id/track');
    expect(JSON.stringify(logged)).not.toContain('trk_secret');
  });

  it('passes HttpError fields through as a 422 body', async () => {
    const router = buildRouter().add('POST', '/echo', { roles: 'public' }, async () => {
      throw new HttpError(422, 'validation_failed', 'Invalid input: patientLocation.lat', { 'patientLocation.lat': 'Too big' });
    });
    const base = await start({ router, deps: deps() });
    const res = await fetch(`${base}/api/v1/echo`, { method: 'POST' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json()).toLowerCase()).toContain('location');
  });
});
