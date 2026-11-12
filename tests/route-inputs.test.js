import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from './helpers.js';

let app;
let patient;
beforeAll(async () => {
  app = await startApp();
  patient = await app.user('patient');
});
afterAll(async () => { await app.close(); });

const invalid = async (path, method, body, query = '') => {
  const r = await app.api(`${path}${query}`, { method, token: patient.token, body });
  expect(r.status).toBe(422);
  expect(Object.keys(r.body)).toEqual(['error']);
  expect(r.body.error).toMatchObject({ code: 'invalid_input', message: expect.any(String), fields: expect.any(Object) });
  return r.body.error.fields;
};

describe('route input contract (memory store and fakes)', () => {
  it.each([
    ['register', '/auth/register', 'POST', { name: 'A', email: 'a@example.test', password: 'correct horse', extra: true }],
    ['login', '/auth/login', 'POST', { email: 'a@example.test', password: 'correct horse', extra: true }],
    ['medical ID', '/patients/me/medical-id', 'PUT', { role: 'admin' }],
    ['contact', '/patients/me/contacts', 'POST', { name: 'A', phone: '9876543210', relation: 'Friend', extra: true }],
    ['reminder', '/patients/me/reminders', 'POST', { medicineName: 'A', dose: 'one', times: ['08:00'], startDate: '2026-11-01', extra: true }],
    ['reminder patch', '/patients/me/reminders/00000000-0000-4000-8000-000000000001', 'PATCH', { unexpected: true }],
    ['dose log', '/patients/me/reminders/00000000-0000-4000-8000-000000000001/doses', 'POST', { date: '2026-11-04', time: '08:00', status: 'taken', extra: true }],
    ['appointment', '/patients/me/appointments', 'POST', { doctorName: 'A', place: 'Clinic', date: '2026-11-05', time: '10:00', extra: true }],
    ['document upload', '/patients/me/reports', 'POST', { title: 'Report', kind: 'lab', fileName: 'report.pdf', contentType: 'application/pdf', sizeBytes: 10, extra: true }],
    ['photo upload', '/patients/me/photo', 'POST', { contentType: 'image/jpeg', sizeBytes: 10, extra: true }],
    ['password change', '/auth/password', 'POST', { newPassword: 'a new password', extra: true }],
    ['account delete', '/patients/me/delete-account', 'POST', { confirm: 'DELETE', extra: true }],
    ['review write', '/reviews', 'PUT', { kind: 'hospital', id: '00000000-0000-4000-8000-000000000001', rating: 5, extra: true }],
    ['assistant triage', '/assistant/triage', 'POST', { message: 'headache', extra: true }],
    ['assistant consent', '/patients/me/assistant/consent', 'PUT', { agree: true, extra: true }],
    ['assistant conversation', '/assistant/conversations', 'POST', { text: 'hello', extra: true }],
    ['assistant reply', '/assistant/conversations/00000000-0000-4000-8000-000000000001/messages', 'POST', { text: 'hello', extra: true }],
  ])('rejects unknown fields for %s', async (_label, path, method, body) => {
    const fields = await invalid(path, method, body);
    expect(fields.body).toMatch(/Unrecognized key/);
  });

  it('rejects wrong types and over-length scalar values with the standard field map', async () => {
    expect(await invalid('/auth/register', 'POST', { name: 'A'.repeat(101), email: 'a@example.test', password: 'correct horse' })).toHaveProperty('name');
    expect(await invalid('/patients/me/medical-id', 'PUT', { allergies: 'penicillin' })).toHaveProperty('allergies');
    expect(await invalid('/patients/me/contacts', 'POST', { name: 'A', phone: 123, relation: 'Friend' })).toHaveProperty('phone');
    expect(await invalid('/assistant/triage', 'POST', { message: 'x'.repeat(2001) })).toHaveProperty('message');
    expect(await invalid('/assistant/conversations', 'POST', { text: 'x'.repeat(2001) })).toHaveProperty('text');
  });

  it('rejects arrays beyond the documented limits', async () => {
    expect(await invalid('/patients/me/reminders', 'POST', { medicineName: 'A', dose: 'one', times: Array(9).fill('08:00'), startDate: '2026-11-01' })).toHaveProperty('times');
    expect(await invalid('/patients/me/reminders', 'POST', { medicineName: 'A', dose: 'one', times: ['08:00'], daysOfWeek: [0, 1, 2, 3, 4, 5, 6, 0], startDate: '2026-11-01' })).toHaveProperty('daysOfWeek');
    expect(await invalid('/assistant/conversations', 'POST', { text: 'hello', documentIds: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'] })).toHaveProperty('documentIds');
  });

  it.each([
    ['limit over 50', '?limit=51'],
    ['offset over 5000', '?offset=5001'],
    ['wrong numeric type', '?limit=large'],
    ['unknown query field', '?unexpected=1'],
  ])('rejects discovery pagination and query violations: %s', async (_label, query) => {
    const r = await app.api(`/hospitals${query}`, { token: patient.token });
    expect(r.status).toBe(422);
    expect(Object.keys(r.body)).toEqual(['error']);
    expect(r.body.error).toMatchObject({ code: 'invalid_input', fields: expect.any(Object) });
  });

  it('returns explicit response fields for representative list and detail contracts', async () => {
    const health = await app.api('/health');
    const areas = await app.api('/areas', { token: patient.token });
    const contacts = await app.api('/patients/me/contacts', { token: patient.token });
    const reminders = await app.api('/patients/me/reminders', { token: patient.token });
    const appointments = await app.api('/patients/me/appointments', { token: patient.token });
    const reports = await app.api('/patients/me/reports', { token: patient.token });

    expect(Object.keys(health.body).sort()).toEqual(['status']);
    expect(Object.keys(areas.body).sort()).toEqual(['areas']);
    expect(Object.keys(contacts.body).sort()).toEqual(['contacts']);
    expect(Object.keys(reminders.body).sort()).toEqual(['reminders']);
    expect(Object.keys(appointments.body).sort()).toEqual(['appointments']);
    expect(Object.keys(reports.body).sort()).toEqual(['reports']);
  });
});

describe('null characters in search text (found by fuzzing the live site)', () => {
  it.each(['/doctors', '/pharmacies', '/diagnostic-centres', '/hospitals', '/medicines'])('%s answers 422, not a server error', async (path) => {
    const r = await app.api(`${path}?area=%00`, { token: patient.token });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('invalid_input');
  });
});

