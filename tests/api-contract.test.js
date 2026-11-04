import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TABLE } from '../server/router.js';

const collection = JSON.parse(readFileSync(new URL('../postman/ambulance-platform.postman_collection.json', import.meta.url), 'utf8'));
const spec = readFileSync(new URL('../docs/05-api-spec.md', import.meta.url), 'utf8');
function flatten(items, rows = []) {
  for (const item of items) { if (item.request) rows.push(item); else flatten(item.item ?? [], rows); }
  return rows;
}

describe('generated API contract', () => {
  it('lists every registered route exactly once in Postman and the API spec', () => {
    const items = flatten(collection.item);
    const names = items.map((item) => item.name);
    expect(names).toHaveLength(TABLE.length);
    expect(new Set(names).size).toBe(TABLE.length);
    expect(new Set(names)).toEqual(new Set(TABLE.map((route) => `${route.method} ${route.path}`)));
    expect(spec).toContain(`Implemented route inventory (${TABLE.length} routes)`);
  });

  it('documents every emergency, tracking, driver, and admin route with role, request, and response', () => {
    for (const route of TABLE.filter((r) => /^\/(emergencies|track|driver|admin)(\/|$)/.test(r.path))) {
      const key = `${route.method} ${route.path}`;
      const item = flatten(collection.item).find((entry) => entry.name === key);
      expect(item.request.description).toContain('Role:');
      expect(item.request.description).toContain('Request:');
      expect(item.request.description).toContain('Success:');
      expect(spec).toContain(`| ${route.method} | \`${route.path}\` |`);
    }
  });
});
