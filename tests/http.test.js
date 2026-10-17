import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError, parseInput, readJson } from '../server/http.js';

function request(body, type = 'application/json') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  req.headers = { 'content-type': type };
  return req;
}

describe('readJson', () => {
  it('parses JSON', async () => {
    expect(await readJson(request('{"a":1}'))).toEqual({ a: 1 });
  });
  it('rejects other content types with 415', async () => {
    await expect(readJson(request('a=1', 'text/plain'))).rejects.toMatchObject({ status: 415 });
  });
  it('rejects bad JSON with 400', async () => {
    await expect(readJson(request('{'))).rejects.toMatchObject({ status: 400 });
  });
  it('rejects oversize bodies with 413', async () => {
    await expect(readJson(request('x'.repeat(20)), 10)).rejects.toMatchObject({ status: 413 });
  });
});

describe('parseInput', () => {
  const schema = z.object({ patientLocation: z.object({ lat: z.number().min(-90).max(90) }) });

  it('returns parsed data', () => {
    expect(parseInput(schema, { patientLocation: { lat: 17.4 } })).toEqual({ patientLocation: { lat: 17.4 } });
  });

  it('throws 422 naming the field, as the collection test expects', () => {
    try {
      parseInput(schema, { patientLocation: { lat: 200 } });
      throw new Error('expected HttpError');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(422);
      expect(Object.keys(error.fields)).toEqual(['patientLocation.lat']);
      expect(error.message.toLowerCase()).toContain('location');
    }
  });
});
