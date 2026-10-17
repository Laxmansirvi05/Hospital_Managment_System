import { describe, expect, it } from 'vitest';
import { Router } from '../server/router.js';

const ok = async () => ({ status: 200 });

describe('router', () => {
  it('requires roles on every route', () => {
    expect(() => new Router().add('GET', '/x', {}, ok)).toThrow(/roles/);
    expect(() => new Router().add('GET', '/x', { roles: [] }, ok)).toThrow(/roles/);
    expect(() => new Router().add('GET', '/x', { roles: ['admin'] }, ok)).toThrow(/roles/);
  });

  it('matches parameters', () => {
    const router = new Router().add('GET', '/emergencies/:id', { roles: ['patient'] }, ok);
    const found = router.match('GET', '/emergencies/em_123');
    expect(found.params).toEqual({ id: 'em_123' });
  });

  it('refuses a static path that a parameter path would shadow', () => {
    const router = new Router().add('GET', '/emergencies/:id', { roles: ['patient'] }, ok);
    expect(() => router.add('GET', '/emergencies/mine', { roles: ['patient'] }, ok)).toThrow(/shadowed/);
  });

  it('routes static paths registered first to themselves', () => {
    const router = new Router()
      .add('GET', '/emergencies/mine', { roles: ['patient'] }, ok)
      .add('GET', '/emergencies/:id', { roles: ['patient'] }, ok);
    expect(router.match('GET', '/emergencies/mine').route.path).toBe('/emergencies/mine');
    expect(router.match('GET', '/emergencies/em_1').route.path).toBe('/emergencies/:id');
  });

  it('reports allowed methods for a known path', () => {
    const router = new Router().add('GET', '/health', { roles: 'public' }, ok);
    expect(router.match('POST', '/health')).toEqual({ notAllowed: ['GET'] });
    expect(router.match('GET', '/nope')).toBeNull();
  });

  it('refuses duplicates', () => {
    const router = new Router().add('GET', '/health', { roles: 'public' }, ok);
    expect(() => router.add('GET', '/health', { roles: 'public' }, ok)).toThrow(/twice/);
  });
});
