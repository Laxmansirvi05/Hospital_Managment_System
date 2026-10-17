// Database checks against a real Postgres. Skipped (and reported as skipped) without DATABASE_URL.
// Run with `pnpm test:db`, which loads .env.local. docs/14-testing-strategy.md section 1.
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 1, prepare: false, connect_timeout: 5, onnotice: () => {} }) : null;

afterAll(async () => {
  await sql?.end();
});

/** Runs fn inside a transaction that is always rolled back. */
async function inRollback(fn) {
  const rollback = new Error('rollback');
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe.skipIf(!sql)('database foundation (WP-0 migration)', () => {
  it('answers a ping', async () => {
    const [row] = await sql`select 1 as one`;
    expect(row.one).toBe(1);
  });

  it('has PostGIS and can measure distance in km', async () => {
    // Two sample points from the Postman collection, about 140 m apart.
    const [row] = await sql`
      select extensions.st_distance(
        extensions.st_makepoint(78.4983, 17.4399)::extensions.geography,
        extensions.st_makepoint(78.4989, 17.4412)::extensions.geography
      ) / 1000 as km`;
    expect(row.km).toBeGreaterThan(0.1);
    expect(row.km).toBeLessThan(0.2);
  });

  it('has pg_cron installed', async () => {
    const rows = await sql`select extname from pg_extension where extname = 'pg_cron'`;
    expect(rows).toHaveLength(1);
  });

  it('turns on Row Level Security for any new table in public', async () => {
    await inRollback(async (tx) => {
      await tx`create table public.rls_probe (id int)`;
      const [row] = await tx`select relrowsecurity from pg_class where oid = 'public.rls_probe'::regclass`;
      expect(row.relrowsecurity).toBe(true);
    });
  });

  it('gives the anon and authenticated roles no access to new tables', async () => {
    await inRollback(async (tx) => {
      await tx`create table public.grant_probe (id int)`;
      const [row] = await tx`
        select
          has_table_privilege('anon', 'public.grant_probe', 'select') as anon_select,
          has_table_privilege('anon', 'public.grant_probe', 'insert') as anon_insert,
          has_table_privilege('authenticated', 'public.grant_probe', 'select') as auth_select`;
      expect(row).toEqual({ anon_select: false, anon_insert: false, auth_select: false });
    });
  });
});
