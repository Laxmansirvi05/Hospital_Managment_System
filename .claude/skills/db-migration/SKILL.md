---
name: db-migration
description: Use when changing the CareRoute database schema, functions, indexes, cron jobs, storage buckets or Row Level Security. Covers forward-only migrations, RLS, PostGIS conventions and verification.
---

# Database migration

Database: Supabase PostgreSQL with PostGIS. Migrations are SQL files in `supabase/migrations`, applied with the Supabase CLI.

## Before writing

1. Read `docs/04-data-model.md` and `docs/06-emergency-lifecycle.md` if states or offers are involved.
2. Check `docs/00-decisions.md` for open questions that affect the schema (Q-03, Q-05, Q-06, Q-10, Q-11, Q-22, Q-24, Q-28). If one applies, ask the owner. Do not choose for them.
3. Look at the existing tables and migrations before adding anything.

## Rules

1. Forward-only. Never edit a migration that has been applied anywhere. Fix mistakes with a new migration.
2. Prefer additive changes (new column, new table) so old and new code both work during a deploy.
3. Every new table: enable Row Level Security in the same migration, and add no policy for `anon` or `authenticated`. All access goes through the server.
4. Locations use `geography(Point, 4326)` with a GiST index.
5. Use real enums or check constraints for states and bounded numbers. Prices never go below zero.
6. Timestamps are `timestamptz`. Every table has `created_at`. Mutable tables have `updated_at`.
7. Functions that change emergency state do it in one statement with a condition, so races are safe. `accept_emergency` is the model.
8. `emergency_events` is append only. Do not add update or delete paths.
9. Storage buckets are private.
10. pg_cron jobs: confirm the installed version supports the interval before relying on it. Document the job name and schedule in the migration.
11. Secrets never appear in a migration or in seed data. Seed data is synthetic only.
12. The API connects as `careroute_api` (D-49). New tables and sequences get its grants by default privileges. A new function the API calls needs `grant execute on function ... to careroute_api` in the same migration, after revoking it from `public`, `anon` and `authenticated`. Migrations run as `postgres`.

## Verify

1. Reset the local database and apply all migrations from empty.
2. Run the database tests: constraints, `accept_emergency` concurrency, `expire_offers`, and a check that the `anon` role can read nothing.
3. Update `docs/04-data-model.md` in the same change.
4. Add a `CHANGELOG.md` line.
5. Run the security agent for any change to RLS, storage, auth tables or functions with elevated rights.
