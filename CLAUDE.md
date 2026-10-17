# CareRoute

Emergency ambulance web app that connects the patient, the ambulance, the hospital and the patient's medical reports. Built as a demo to production standard. HTML, CSS and JavaScript as the foundation (no TypeScript, no Next.js), a Node.js API, Supabase (PostgreSQL with PostGIS, Storage, Realtime), Vercel. Other technology only where really required and approved (`docs/02-trd.md` section 1.2). Project phase right now: WP-0 foundation.

## Read in this order

1. `docs/00-decisions.md`: what is LOCKED, PROPOSED and OPEN. It wins over every other file.
2. `docs/01-prd.md` and `docs/02-trd.md`
3. `docs/05-api-spec.md` and `postman/ambulance-platform.postman_collection.json`: the API contract
4. The document for the area you are touching. Index in `docs/README.md`.

## Rules that override everything

1. Do not guess. If a fact or decision is missing, ask the owner. Do not fill gaps and present them as settled.
2. Do not reinterpret a decision. If you have a suggestion, label it PROPOSED and wait for a yes.
3. Never turn an OPEN item into a decision on your own.
4. An honest report of what is broken or unverified beats a clean report that is not true.
5. Never weaken, skip or delete a test to make it pass. Report every test file you touch.
6. Never call something verified because a fake passed. Say what ran against what.
7. Never silence an error with an empty catch.
8. Never fabricate results, metrics, quotes, sources or test output.
9. Never commit, print or paste a secret. Never put a secret in a `PUBLIC_` variable or in any file under `public/`.
10. Never push, force-push or rewrite history unless the owner says so.
11. Do not spend money. Use fakes and free tiers. If something needs a paid key, say so and stop.
12. Do not edit the Postman collection to make a failing run pass.
13. Keep changes inside the task. Report unrelated problems instead of fixing them silently.

## Style rules

- No em dashes in code, comments, copy or docs. Use commas, colons, periods or a new sentence. Ranges use "to".
- No emoji in headings or product copy.
- No generic buzzwords. The list is in `docs/12-ux-and-content.md` section 7.
- The banned design patterns in `docs/11-design-system.md` section 9 are binding.
- Comments explain why, not what. Match the density of the code around them.

## Security non-negotiables

- Server secrets are read only in `server/config.js`. Server code lives in `server/`, never under `public/`. Everything under `public/` is public.
- Every route checks role and ownership and has tests for 401, 403 and the happy path.
- Every input is parsed by Zod on the server. Responses are built from explicit fields. Browser code writes data with `textContent` or cloned templates, never `innerHTML` with data.
- No personal, location or medical data in logs, prompts sent to models, or the public tracking response.
- Row Level Security is on for every table with no policy for `anon` or `authenticated`.

## Review agents and skills

| Use | Name |
| --- | --- |
| Security review | `security-agent`, skill `security-review` |
| Design review | `design-review-agent`, skill `ui-component` |
| Contract check | `contract-agent`, skill `add-api-endpoint` |
| Schema change | skill `db-migration` |
| Writing text | skill `write-copy` |

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Local server on port 4000: `public/` plus `/api/v1`, with production headers. Reads `.env.local` if present. |
| `pnpm test` | Vitest suite |
| `pnpm lint` | ESLint |
| `pnpm check` | Style lint (banned patterns, em dashes, raw CSS values) and the `public/` secret scan |
| `pnpm check:env` | Validates every configuration group, prints names only |
| `pnpm verify` | lint, check and test. Must pass before any commit. |
| `pnpm db:start` / `pnpm db:stop` | Local Supabase in Docker (colima), trimmed to database, Realtime, Storage and gateway |
| `pnpm db:reset` | Rebuild the local database from `supabase/migrations` and `supabase/seed.sql` |
| `pnpm test:db` | Database tests against the local database, using `.env.local` |

Styleguide for visual checks: `http://localhost:4000/styleguide`.
