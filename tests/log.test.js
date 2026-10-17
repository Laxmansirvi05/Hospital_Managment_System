import { describe, expect, it } from 'vitest';
import { createLogger, isSensitiveKey, redact, scrubString } from '../server/log.js';

describe('redaction', () => {
  it.each([
    'password', 'token', 'trackingToken', 'authorization', 'phone', 'driverPhone', 'email',
    'lat', 'lng', 'address', 'patientLocation', 'medicalNotes', 'notes', 'allergies',
    'bloodGroup', 'apiKey', 'JWT_SECRET', 'DATABASE_URL', 'message',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['requestId', 'route', 'status', 'durationMs', 'role', 'method', 'group'])('keeps %s', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });

  it('redacts nested values and keeps safe ones', () => {
    const out = redact({ user: { role: 'patient', phone: '9876500000' }, patientLocation: { lat: 17.4 }, status: 201 });
    expect(out).toEqual({ user: { role: 'patient', phone: '[redacted]' }, patientLocation: '[redacted]', status: 201 });
  });

  it('scrubs credentials inside free text', () => {
    const text = scrubString('failed postgres://user:pw@db.example.com/x with Bearer abc.def and /track?token=trk_123&x=1');
    expect(text).not.toContain('pw@');
    expect(text).not.toContain('abc.def');
    expect(text).not.toContain('trk_123');
  });

  it('logs errors by name and scrubbed message', () => {
    const lines = [];
    const log = createLogger({ write: (line) => lines.push(line), now: () => new Date(0) });
    log.error('boom', { error: new Error('connect postgres://u:secret@host/db failed') });
    const entry = JSON.parse(lines[0]);
    expect(entry.event).toBe('boom');
    expect(entry.error.name).toBe('Error');
    expect(lines[0]).not.toContain('secret@');
  });

  it('survives circular objects', () => {
    const value = { a: 1 };
    value.self = value;
    expect(redact(value)).toEqual({ a: 1, self: '[circular]' });
  });
});
