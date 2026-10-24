import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt, hashToken } from '../server/auth/crypto.js';
import { loadConfig } from '../server/config.js';
import { buildTable, TABLE } from '../server/router.js';
import { dosesFor } from '../server/db/geo.js';
import { sniffOk } from '../server/adapters/storage.js';
import { scrub } from '../server/log.js';

describe('passwords (scrypt, D-24)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored.startsWith('scrypt$131072$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
  });
  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });
});

describe('tokens (HS256, D-22, D-24)', () => {
  const secret = 's'.repeat(40);
  it('round trips claims', () => {
    const t = signJwt({ sub: 'u1', role: 'patient' }, secret, 60);
    const r = verifyJwt(t, secret);
    expect(r.ok && r.claims.sub).toBe('u1');
  });
  it('reports expiry separately', () => {
    const t = signJwt({ sub: 'u1' }, secret, 60, Date.now() - 120000);
    expect(verifyJwt(t, secret)).toEqual({ ok: false, reason: 'expired' });
  });
  it('rejects alg none and a tampered body', () => {
    const t = signJwt({ sub: 'u1', role: 'patient' }, secret, 60);
    const [, body, sig] = t.split('.');
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(verifyJwt(`${none}.${body}.`, secret).ok).toBe(false);
    const forged = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: 9e9 })).toString('base64url');
    expect(verifyJwt(`${t.split('.')[0]}.${forged}.${sig}`, secret).ok).toBe(false);
    expect(verifyJwt(t, 'other'.repeat(10)).ok).toBe(false);
  });
  it('hashes tokens with the pepper', () => {
    expect(hashToken('a', 'p1')).not.toBe(hashToken('a', 'p2'));
  });
});

describe('config', () => {
  it('refuses to start in production without required values, naming only the variables', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL, JWT_SECRET, TRACKING_TOKEN_PEPPER/);
  });
  it('refuses privileged sign-up in production (D-21)', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db', JWT_SECRET: 'a'.repeat(40), TRACKING_TOKEN_PEPPER: 'b'.repeat(40), ALLOW_PRIVILEGED_SIGNUP: 'true' })).toThrow(/ALLOW_PRIVILEGED_SIGNUP/);
  });
  it('treats .env.example placeholders as unset and falls back to memory outside production (P-27)', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'replace-with-at-least-32-random-characters', SUPABASE_SERVICE_ROLE_KEY: 'replace-me' });
    expect(c.store).toBe('memory');
    expect(c.storage).toBeNull();
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it('never exposes a non-public value through publicValues', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'a'.repeat(40), PUBLIC_MAPTILER_KEY: 'pk_test_abcdef' });
    expect(Object.keys(c.publicValues)).toEqual(['maptilerKey']);
  });
});

describe('router table', () => {
  it('refuses a route without roles', () => {
    expect(() => buildTable([{ method: 'GET', path: '/x', handler: async () => ({}) }])).toThrow(/must declare roles/);
  });
  it('orders static paths before parameter paths', () => {
    const t = buildTable([
      { method: 'GET', path: '/emergencies/:id', roles: ['patient'], handler: async () => ({}) },
      { method: 'GET', path: '/emergencies/mine', roles: ['patient'], handler: async () => ({}) },
    ]);
    expect(t[0].path).toBe('/emergencies/mine');
  });
  it('has the reminders/today route ahead of reminders/:id', () => {
    const iToday = TABLE.findIndex((r) => r.path === '/patients/me/reminders/today');
    const iId = TABLE.findIndex((r) => r.path === '/patients/me/reminders/:id' && r.method === 'PATCH');
    expect(iToday).toBeLessThan(iId);
  });
});

describe('reminder schedule', () => {
  const r = { id: 'r1', active: true, medicineName: 'M', dose: '1 tablet', instructions: '', times: ['20:00', '08:00'], daysOfWeek: [1, 3, 5], startDate: '2026-10-01', endDate: '2026-10-31' };
  it('lists doses only on chosen days and inside the date range, sorted by time', () => {
    expect(dosesFor([r], [], '2026-10-26').map((d) => d.time)).toEqual(['08:00', '20:00']); // Monday
    expect(dosesFor([r], [], '2026-10-25')).toEqual([]); // Sunday
    expect(dosesFor([r], [], '2026-11-02')).toEqual([]); // after end
  });
  it('merges recorded status', () => {
    const d = dosesFor([r], [{ reminderId: 'r1', date: '2026-10-26', time: '08:00', status: 'taken' }], '2026-10-26');
    expect(d.map((x) => x.status)).toEqual(['taken', 'due']);
  });
});

describe('uploads and logs', () => {
  it('checks the real first bytes of a file', () => {
    expect(sniffOk('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
    expect(sniffOk('application/pdf', Buffer.from('<html>'))).toBe(false);
    expect(sniffOk('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]))).toBe(true);
    expect(sniffOk('text/html', Buffer.from('<html>'))).toBe(false);
  });
  it('redacts personal and medical keys from log fields', () => {
    const out = scrub({ route: '/x', email: 'a@b', phone: '+91', medicalNotes: 'x', nested: { lat: 1, password: 'p' } });
    expect(out).toEqual({ route: '/x', email: '[redacted]', phone: '[redacted]', medicalNotes: '[redacted]', nested: { lat: '[redacted]', password: '[redacted]' } });
  });
});
