# CareRoute

Hyderabad-first healthcare discovery and assistance web app with three parts: discovery of hospitals, doctors, medicines, pharmacies and diagnostic centres; an AI healthcare assistant; and an emergency ambulance system. Roles are `patient`, `driver` and `admin`. Built as a demo to production standard. HTML, CSS and JavaScript as the foundation, a Node.js API, Supabase (PostgreSQL with PostGIS, Storage, Realtime), Vercel. UI frameworks and TypeScript are allowed when necessary, and other technology only where really required. Each one needs a written need and the owner's approval (`docs/02-trd.md` section 1.2). None has been chosen yet. Project phase right now: building the patient side (D-41). All work happens on `main`; the owner asked for no other branches.

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

Building started on 2026-10-25 (D-41). All work is on `main`.

| Purpose | Command |
| --- | --- |
| Run the app on http://127.0.0.1:4000 | `pnpm dev` (reads `.env.local`; without `DATABASE_URL` it runs on sample data, P-27) |
| Unit and API tests | `NODE_ENV=test pnpm test` |
| Scan `public/` for secrets and unsafe HTML | `pnpm check` |
| Regenerate `supabase/seed.sql` | `node scripts/gen-seed.js` |
| Collect OpenStreetMap listings into `.cache/` | `node scripts/collect-osm.js` |
| Collect doctors from hospital websites into `.cache/` (slow: 3 s per request per site) | `node scripts/collect-doctors.js [care kims rainbow continental gleneagles ankura citizens lvpei]` |
| Collect the Jan Aushadhi medicine and MRP list into `.cache/` | `node scripts/collect-medicines.js` |
| Load `.cache/` into careroute-dev | `node --env-file=.env.local scripts/load-listings.js` |
| Load `.cache/` into careroute-prod (D-60) | `node --env-file=.env.local scripts/load-listings.js --prod` |
