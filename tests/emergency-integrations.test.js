import { describe, expect, it, vi } from 'vitest';
import { createMapboxAdapter, straightLineEtas } from '../server/integrations/mapbox.js';
import { createFakeSmsAdapter, createSmsAdapter } from '../server/integrations/sms.js';
import { loadConfig } from '../server/config.js';

const origin = { lat: 17.43, lng: 78.45 };
const candidates = Array.from({ length: 26 }, (_, i) => ({ id: `a-${i}`, lat: 17.43 + i / 1000, lng: 78.45, distanceKm: i / 10 }));

describe('emergency provider adapters', () => {
  it('caps Mapbox Matrix requests at 24 sources and parses durations', async () => {
    let requestUrl;
    const fetchImpl = vi.fn(async (url) => { requestUrl = new URL(url); return { ok: true, json: async () => ({ durations: Array.from({ length: 24 }, (_, i) => [12 + i]) }) }; });
    const result = await createMapboxAdapter({ token: 'secret-token-value', fetchImpl })(origin, candidates);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(requestUrl.pathname.split('/').at(-1).split(';')).toHaveLength(25);
    expect(requestUrl.searchParams.get('sources').split(';')).toHaveLength(24);
    expect(requestUrl.searchParams.get('destinations')).toBe('24');
    expect(requestUrl.searchParams.get('access_token')).toBe('secret-token-value');
    expect(result).toHaveLength(24);
    expect(result[0]).toMatchObject({ etaSeconds: 12, etaIsEstimate: false });
  });

  it('uses straight-line estimates without calling fetch when no token is configured', async () => {
    const fetchImpl = vi.fn();
    const eta = await createMapboxAdapter({ fetchImpl })(origin, candidates.slice(0, 1));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(eta[0]).toMatchObject({ etaIsEstimate: true, etaSeconds: expect.any(Number) });
    expect(eta).toEqual(straightLineEtas(origin, candidates.slice(0, 1)));
  });

  it('falls back after timeout and never returns the token in an error or result', async () => {
    const secret = 'mapbox-secret-not-for-output';
    const fetchImpl = vi.fn((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error(`timeout ${secret} ${url}`)), { once: true })));
    const result = await createMapboxAdapter({ token: secret, fetchImpl, timeoutMs: 2 })(origin, candidates.slice(0, 1));
    expect(result[0].etaIsEstimate).toBe(true);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('uses the fake SMS adapter in sample mode and sends only the tracking link and demo notice', async () => {
    const fetchImpl = vi.fn(); const sms = createSmsAdapter({ config: { accountSid: 'AC' + 'a'.repeat(32), authToken: 'secret-auth-token-value', from: '+15555550100' }, sampleMode: true, fetchImpl });
    await sms.sendTracking({ to: '+15555550101', trackingUrl: 'https://care.example/track/opaque-token' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sms.sent[0].message).toContain('Demo: no real ambulance is sent.');
    expect(sms.sent[0].message).not.toMatch(/cardiac|accident|breathing|stroke|pregnancy|diagnosis/i);
  });

  it('sends Twilio form data through fetch and hides credentials from provider errors', async () => {
    const secret = 'secret-auth-token-value'; let request;
    const sms = createSmsAdapter({ config: { accountSid: 'AC' + 'a'.repeat(32), authToken: secret, from: '+15555550100' }, fetchImpl: async (url, options) => { request = { url, ...options }; return { ok: true }; } });
    await sms.sendTracking({ to: '+15555550101', trackingUrl: 'https://care.example/track/tkn' });
    expect(request.url).toContain('/Accounts/AC');
    expect(request.headers.authorization).toBe(`Basic ${Buffer.from(`AC${'a'.repeat(32)}:${secret}`).toString('base64')}`);
    expect(new URLSearchParams(request.body).get('To')).toBe('+15555550101');
    expect(new URLSearchParams(request.body).get('Body')).toContain('Demo: no real ambulance is sent.');
    const failing = createSmsAdapter({ config: { accountSid: 'AC' + 'a'.repeat(32), authToken: secret, from: '+15555550100' }, fetchImpl: async () => { throw new Error(secret); } });
    await expect(failing.sendTracking({ to: '+15555550101', trackingUrl: 'https://care.example/track/tkn' })).rejects.toThrow('SMS provider request failed');
    await expect(failing.sendTracking({ to: '+15555550101', trackingUrl: 'https://care.example/track/tkn' })).rejects.not.toThrow(secret);
  });

  it('treats Mapbox and Twilio config as optional and server only', () => {
    const config = loadConfig({ NODE_ENV: 'test', MAPBOX_TOKEN: 'replace-with-mapbox-server-token', TWILIO_ACCOUNT_SID: 'replace-with-account-sid', TWILIO_AUTH_TOKEN: 'replace-with-auth-token', TWILIO_FROM: '+15555550100' });
    expect(config.mapboxToken).toBeUndefined();
    expect(config.twilio).toBeNull();
    expect(config.publicValues).not.toHaveProperty('mapboxToken');
    expect(config.publicValues).not.toHaveProperty('twilio');
  });
});
