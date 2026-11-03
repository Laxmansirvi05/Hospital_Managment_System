// Route-wide authorization checks use the in-memory store, fake storage, and fake auth users.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TABLE } from '../server/router.js';
import { startApp, cookieHeader } from './helpers.js';

let app;
let patient;
let driver;
beforeAll(async () => {
  app = await startApp();
  patient = await app.user('patient');
  driver = await app.user('driver');
});
afterAll(async () => { await app.close(); });

const id = '00000000-0000-4000-8000-000000000001';
const pathFor = (route) => route.path.replace(/:[^/]+/g, id);
const protectedRoutes = TABLE.filter((route) => route.roles !== 'public');
const patientOnlyRoutes = protectedRoutes.filter((route) => route.roles.includes('patient') && !route.roles.includes('driver'));
const protectedWrites = protectedRoutes.filter((route) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method));

describe('registered route authorization matrix (memory store and fakes)', () => {
  it.each(protectedRoutes.map((route) => [`${route.method} ${route.path}`, route]))('%s requires a session', async (_label, route) => {
    const r = await app.api(pathFor(route), { method: route.method, ...(route.method === 'GET' ? {} : { body: {} }) });
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ error: { code: 'unauthorized', message: expect.any(String) } });
  });

  it.each(patientOnlyRoutes.map((route) => [`${route.method} ${route.path}`, route]))('%s refuses a driver without revealing the resource', async (_label, route) => {
    const r = await app.api(pathFor(route), { method: route.method, token: driver.token, ...(route.method === 'GET' ? {} : { body: {} }) });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: { code: 'role_not_allowed', message: expect.any(String) } });
  });

  it.each(protectedWrites.map((route) => [`${route.method} ${route.path}`, route]))('%s requires CSRF for cookie-authenticated writes', async (_label, route) => {
    const r = await app.api(pathFor(route), { method: route.method, cookie: cookieHeader(patient.cookies), body: {} });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: { code: 'csrf_failed', message: expect.any(String) } });
  });

  it('keeps public health and config routes session-free with explicit response shapes', async () => {
    const health = await app.api('/health');
    const config = await app.api('/config');
    expect(health).toMatchObject({ status: 200, body: { status: 'ok' } });
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({ dataMode: 'sample' });
  });

  it('rejects a foreign Origin on public writes', async () => {
    const r = await app.api('/auth/register', {
      body: { name: 'Asha', email: 'origin@test.example', password: 'long enough' },
      headers: { origin: 'https://attacker.example' },
    });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: { code: 'csrf_failed', message: expect.any(String) } });
  });

  it('keeps invalid writes on the established 422 error contract', async () => {
    const r = await app.api('/patients/me/assistant/consent', {
      method: 'PUT',
      token: patient.token,
      body: { agree: true, unexpected: 'field' },
    });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ error: { code: 'invalid_input', message: expect.any(String), fields: expect.any(Object) } });
  });
});
