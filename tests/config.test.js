import { describe, expect, it } from 'vitest';
import { ConfigError, PUBLIC_CONFIG_NAMES, SERVER_SECRET_NAMES, getConfig } from '../server/config.js';

describe('config', () => {
  it('accepts a complete group', () => {
    const env = { JWT_SECRET: 'a'.repeat(32), TRACKING_TOKEN_PEPPER: 'b'.repeat(32) };
    expect(getConfig('auth', env)).toEqual(env);
  });

  it('names missing and invalid variables without printing values', () => {
    const secret = 'short-but-secret';
    try {
      getConfig('auth', { JWT_SECRET: secret });
      throw new Error('expected ConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toContain('JWT_SECRET');
      expect(error.message).toContain('TRACKING_TOKEN_PEPPER');
      expect(error.message).not.toContain(secret);
    }
  });

  it('rejects .env.example placeholders', () => {
    expect(() => getConfig('routing', { MAPBOX_SECRET_TOKEN: 'replace-me' })).toThrow(/placeholder/);
    expect(() => getConfig('auth', {
      JWT_SECRET: 'replace-with-at-least-32-random-characters',
      TRACKING_TOKEN_PEPPER: 'b'.repeat(32),
    })).toThrow(/placeholder/);
  });

  it('rejects a database URL that is not a URL', () => {
    expect(() => getConfig('database', { DATABASE_URL: 'not a url' })).toThrow(ConfigError);
  });

  it('keeps public and server names apart', () => {
    for (const name of PUBLIC_CONFIG_NAMES) {
      expect(name.startsWith('PUBLIC_')).toBe(true);
      expect(SERVER_SECRET_NAMES).not.toContain(name);
    }
    for (const name of SERVER_SECRET_NAMES) expect(name.startsWith('PUBLIC_')).toBe(false);
    expect(SERVER_SECRET_NAMES).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
