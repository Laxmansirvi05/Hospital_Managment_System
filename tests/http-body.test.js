import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError, parse, readJson } from '../server/http.js';

describe('readJson on a platform that parses the body first', () => {
  it('returns the parsed body', async () => {
    const req = { headers: {}, body: { a: 1 } };
    expect(await readJson(req)).toEqual({ a: 1 });
  });

  it('answers 400 invalid_json when the platform parser throws on malformed JSON', async () => {
    const req = { headers: {} };
    Object.defineProperty(req, 'body', { get() { throw new SyntaxError('Unexpected token'); } });
    const err = await readJson(req).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect([err.status, err.code]).toEqual([400, 'invalid_json']);
  });

  it('answers 413 for a pre-parsed body over 64 KB', async () => {
    const err = await readJson({ headers: {}, body: { x: 'y'.repeat(70000) } }).catch((e) => e);
    expect([err.status, err.code]).toEqual([413, 'too_large']);
  });
});

describe('parse and null characters', () => {
  const schema = z.object({ area: z.string().optional(), tags: z.array(z.string()).optional() }).strict();

  it('rejects a NUL byte in a value, in a nested array and in a key as a 422', () => {
    for (const input of [{ area: 'a\u0000b' }, { tags: ['ok', 'x\u0000'] }, { 'k\u0000': 'v' }]) {
      let err;
      try { parse(schema, input); } catch (e) { err = e; }
      expect(err, JSON.stringify(input)).toBeInstanceOf(HttpError);
      expect([err.status, err.code]).toEqual([422, 'invalid_input']);
    }
  });

  it('still accepts normal input', () => {
    expect(parse(schema, { area: 'Kukatpally', tags: ['a'] })).toEqual({ area: 'Kukatpally', tags: ['a'] });
  });
});
