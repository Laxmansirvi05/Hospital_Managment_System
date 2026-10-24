# Changelog

Every change to a LOCKED decision, the API contract or a document's meaning is recorded here, newest first.

## 2026-10-25

### Decided

- D-36 three search areas, D-37 patient appointment log (no booking, D-28 stands), D-38 medicine reminders in the app and browser, D-39 expanded medical ID, D-40 dashboard home, D-41 building started full stack. Proposed P-25 (crew view), P-26 (photo and document storage), P-27 (in-memory store until keys exist).

### Built (branch `wp-0/foundation`)

- Server: `server/config.js` (Zod, fails fast in production), redacting logger, router that refuses role-less routes, scrypt passwords and HS256 tokens from `node:crypto`, rotating refresh sessions with reuse revocation, httpOnly cookies with CSRF checks, Postgres rate limits, `X-Forwarded-For` trusted only behind a known proxy.
- API: auth (register, login, me, refresh, logout), medical ID, contacts, reminders with dose logging and today's schedule, appointment log, dashboard, documents and photo with signed upload and byte checks, and the three discovery areas (hospitals and doctors, medicines and pharmacies, diagnostic centres). Single entry `api/v1/[...path].js`, local server `scripts/dev.js` on port 4000.
- Database on `careroute-dev`: migrations `20261025000000` to `20261025000300` applied (extensions, accounts, listings, patient data, private storage buckets), synthetic listing seed loaded. Verified on the project: the `anon` role is denied on all 15 tables, `hit_rate_limit` allows then blocks, the PostGIS nearest-first query returns expected rows. The project was paused and was restored first.
- Frontend in `public/`: sign in and sign up, dashboard, the three search pages with the 3D map, hospital, doctor, medicine price comparison, pharmacy and diagnostic centre pages, medical ID, reminders with browser notifications, appointments, documents, and an emergency page that sends people to 112 because ambulance requests are not built yet.
- Tests: 41 passing (`tests/unit.test.js`, `tests/api.test.js`). They run against the in-memory store and storage, not Postgres. `scripts/check-public.js` passes.

### Not verified

- The Postgres store (`server/db/postgres.js`) has not run end to end: `.env.local` has no `DATABASE_URL` yet. Only its key SQL shapes were run by hand on `careroute-dev`.
- Supabase Storage calls in `server/adapters/storage.js` are written against the documented API but not run (no service role key).
- `vercel.json` has not been deployed.
- No security agent or design review agent pass has been run on this change yet.

## 2026-10-24

### Frontend prototype (owner request)

- Added `prototype/`: a clickable light-theme prototype of every role's screens, built with plain HTML, CSS and JavaScript, CSS and SVG 3D components, sample data only. No login, landing page, database or AI provider. Run with `python3 prototype/dev-server.py`. Added a `prototype` entry to `.claude/launch.json`.
- 21st.dev components were not used: the 21st MCP server is not connected in this environment (it needs an API key).
- Prototype choices that differ from the documents are listed as PROPOSED in `prototype/README.md` ("Where this differs from the documents").

### Platform data research for Q-28

- Read robots.txt and terms of use for Apollo Pharmacy, Apollo 24|7, MedPlus and Tata 1mg, and searched for official APIs and partner programs. Findings recorded in `docs/19-setup-checklist.md` and summarised in Q-28, `docs/16-deployment-and-environments.md` and a new risk in `docs/01-prd.md`. Q-28 stays OPEN.

### Stack rule and data source (owner, later the same day)

- D-03 changed: UI frameworks and TypeScript are allowed when necessary. Each adoption still needs a written need and the owner's approval under `docs/02-trd.md` section 1.2. None chosen yet. P-06 and P-15 (in D-19) stay the default and can be replaced under that rule. Section 1.2 now lists what a framework or TypeScript proposal must cover: build step, CSP, public file scan, no default component look, no raw HTML with data.
- Decided D-35: listing and medicine data come from online platforms such as Apollo, MedPlus, Tata 1mg and others. Q-23 closed. Q-22 narrowed to doctor profiles as personal data. New Q-28: collection method, each platform's terms and robots.txt, refresh rate, and where the collection job runs.
- The synthetic-data rule in `docs/10-privacy-and-data.md` now allows real business listings and prices. Patient, driver, emergency and report data stay synthetic.
- Updated: `docs/00-decisions.md`, `01-prd.md`, `02-trd.md`, `03-architecture.md`, `04-data-model.md` (new `source_platform`, duplicate matching PROPOSED), `05-api-spec.md` (`sourcePlatform`), `09-security.md`, `10-privacy-and-data.md`, `11-design-system.md`, `15-workflow.md`, `16-deployment-and-environments.md`, `19-setup-checklist.md`, `CLAUDE.md`, `README.md`, the design review agent, and the ui-component and db-migration skills.

### Product scope changed (owner's product vision)

- Decided: D-26 to D-34. CareRoute is now a Hyderabad-first healthcare discovery and assistance platform with three pillars: discovery (hospitals, doctors, medicines with price comparison, pharmacies, diagnostic centres), an AI healthcare assistant (report explanation, discovery from natural language, triage), and the emergency ambulance system. Discovery shows information and sends users to the provider. No bookings, orders, payments, beds or hospital portal.
- Roles are now `patient`, `driver`, `admin`. `hospital_admin` and `dispatcher` removed (D-29). Q-02 closed.
- Emergency flow: destination hospital, hospital recommendations, pre-alerts and bed counts removed (D-30). Guest SOS, contacts with SMS, family tracking and medical ID for the crew kept (D-31). Drivers can reject an offer (D-32).
- Changed notes on locked items D-02, D-04, D-06 and D-07 to follow the new decisions. Their decisions are unchanged.
- Proposed: P-18 (admin takes the former dispatcher screens, owner had no preference), P-19 (discovery endpoints and tables, Postgres full-text search and `pg_trgm`), P-20 (reject endpoint), P-21 (report explanation design), P-22 (admin user and listing management), P-23 (discovery assistant design), P-24 (source and checked date on every listing).
- Open: Q-21 (real ambulance operators against the demo scope in D-04), Q-22 (listing data source, doctor profiles as personal data, conflict with the synthetic data rule), Q-23 (medicine price data), Q-24 (ratings and reviews), Q-25 (report content sent to a model), Q-26 (assistant external sources), Q-27 (discovery without sign-in). Q-08 and Q-11 narrowed.

### Contract changed (D-34, owner approved)

`postman/ambulance-platform.postman_collection.json`:

- Removed requests: Register hospital admin, Register dispatcher, Create hospital, Add doctor, Update bed counts, Ambulances near a point, Recommended hospitals for this case, Hospital: incoming pre-alerts, and the whole folder "7. Dispatch dashboard and analytics" (Active emergencies, Summary, Response times by hour).
- Folder "8. Edge cases and negative tests" renamed to "7. ...". Folder 3 renamed "3. Hospital and doctor discovery".
- "Hospitals near me": added the test "Seed data has a hospital nearby" and now stores the first result's id as `hospitalId`, because no request creates a hospital any more.
- "List doctors": removed the test "Includes the new doctor", because the request that created that doctor was removed. The "Is a list" test stays.
- "Driver: choose hospital and mark picked up" renamed "Driver: mark picked up". Body is now only `status`. Removed the test "Destination set".
- Removed collection variables `hospitalToken`, `dispatcherToken`, `doctorId`. Descriptions updated to drop hospital and dispatcher wording.

### Documents updated

All of `docs/`, `README.md`, `CLAUDE.md`, and the contract agent, security agent, db-migration skill and write-copy skill, to match the decisions above. Work packages renumbered: WP-3 is discovery I, WP-7 is platform admin, new WP-10 is discovery II, demo readiness is now WP-11.

## 2026-10-17

### Setup

- Research recorded: MapTiler free plan is non-commercial (new Q-20), Gemini unpaid terms allow Google to use and review inputs (Q-17 partly answered), Mapbox Matrix limits, Twilio India rules. pg_cron 30 second schedule verified on the dev Supabase project, test job removed.

- Added `docs/19-setup-checklist.md`: every account and key needed before building, how keys are stored, and status.
- Vercel project `careroute` created and linked to the GitHub repository, function region `bom1` (PROPOSED).
- Supabase: owner's new account connected. `careroute-dev` and `careroute-prod` created in `ap-south-1` (D-18). The default Tokyo project was deleted by the owner to free the slot.
- The local archive branch with the earlier WP-0 and WP-1 code was deleted on the owner's request, along with local `node_modules`, `supabase/` and `.env.local`. The earlier commits that added WP-0 still exist in GitHub history. Removing them needs a force push, which has not been done.

### Building paused, code removed from main

- On the owner's request, all application code was removed from `main` (docs, Postman contract, agents and skills stay). Next: cloud Supabase projects, then accounts and keys setup, before any more building.
- The removed WP-0 and WP-1 code, including the WP-1 work that was never pushed, is kept on the local-only branch `archive/wp0-wp1-code`. It is not on GitHub. The commits that added WP-0 remain in GitHub history.
- Decisions D-18 to D-25 stay in force. The WP-0 and WP-1 entries below describe work that now lives only on the archive branch.

### WP-1 accounts and roles

- Decided: D-21 to D-25 (privileged signup flag, 15 minute tokens with rotating refresh, httpOnly cookies with CSRF checks, `node:crypto` scrypt and HMAC, Postgres rate limits). Q-01, Q-04, Q-13, Q-19 closed. P-05 replaced.
- Added: migration `20261017010000_wp1_accounts.sql` with `users`, `sessions`, `rate_limits`, `hit_rate_limit()` and two pg_cron cleanup jobs.
- Added: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (collection folder 1), and new `POST /auth/refresh`, `POST /auth/logout`.
- Added: `scripts/create-user.js` for production privileged accounts, with a hidden password prompt.
- Added: pages `/signin`, `/signup` (patients only), `/account`. The browser API client sends the CSRF header and refreshes an expired token once.
- Tests: 27 new unit tests, 15 new database tests. Login and register measured at about 0.4 s locally.

### WP-0 foundation (in progress)

- Added: `package.json` (zod, postgres; vitest, eslint), `.gitignore`, `.env.example`, `vercel.json` with security headers.
- Added: `server/` config groups with Zod, redacting logger, HTTP helpers, router that refuses shadowed and role-less routes, fail-closed auth stub, `GET /api/v1/health`, `GET /api/v1/config`, single entry `api/v1/[...path].js`.
- Added: `public/` tokens, base CSS, button, card, field and status components, home page, styleguide page, theme toggle.
- Added: `scripts/dev.js`, `scripts/lint-style.js`, `scripts/scan-public.js`, `scripts/check-env.js`, and 100 tests.
- Added: dark tokens `--border` `#38383A` and `--primary-hover` `#5AB0FF` to the design system (PROPOSED).
- Git initialised with remote `origin` set to the GitHub repository. Nothing pushed.
- Local database: Supabase CLI 2.121.0 as a pinned dev dependency (Homebrew needed newer Xcode tools). Stack runs in Docker through colima, trimmed with `pnpm db:start`.
- Migration `20261017000000_wp0_foundation.sql`: PostGIS, pg_cron, no default privileges for `anon` and `authenticated` in `public`, event trigger that enables Row Level Security on every new public table. Verified locally only; confirm on the hosted projects before the first remote migration.
- `tests/db.test.js` (5 tests, `pnpm test:db`). Config now rejects `.env.example` placeholder values.

### Decided

- D-18: two Supabase projects. D-19: proposals P-01, P-02, P-06, P-13 to P-17 approved. D-20: custom SVG icons only. Q-15 closed.

### Changed

- D-03: HTML, CSS and JavaScript are now the foundation, for the frontend and for the Node.js API. TypeScript, Next.js, Tailwind CSS and Radix are removed. Other technology only where really required, with owner approval (`docs/02-trd.md` section 1.2).
- `docs/02-trd.md` rewritten: repository layout (`public/`, `api/`, `server/`), single API function with a router, plain CSS tokens, custom elements, JSDoc, vendored browser libraries, public config endpoint.
- Environment variable prefix `NEXT_PUBLIC_` replaced by `PUBLIC_`, returned only by `GET /api/v1/config`. Security rules, tests and deployment docs updated to scan `public/` instead of a bundle.
- Design system: component construction (section 8.0) and banned pattern search hints updated for plain CSS and JavaScript.
- Added the web browser limit on driver background location to the technical risks.

### Proposed (need approval)

P-13 to P-17 in `docs/00-decisions.md`.

## 2026-10-16

### Added

- Documentation set in `docs/` (decision log, PRD, TRD, architecture, data model, API specification, emergency lifecycle, AI triage, medical reports, security, privacy, design system, UX and content, accessibility, testing, workflow, deployment, runbook, glossary).
- `CLAUDE.md`, `README.md`, `SECURITY.md`.
- Agents in `.claude/agents`: security, design review, contract.
- Skills in `.claude/skills`: add-api-endpoint, db-migration, ui-component, security-review, write-copy.
- Postman collection and environment copied to `postman/` as the API contract.

### Decisions locked this day

D-01 to D-17 in `docs/00-decisions.md`: product name CareRoute, web only, demo built to production standard, English only, medical reports added, model order Gemini then Groq then OpenRouter, MapTiler tiles, Mapbox routing, Vercel and Supabase only, Supabase Realtime in place of Socket.IO, pg_cron for offer expiry, Twilio trial for SMS, secrets must not leak, Apple guidelines for design, banned pattern list binding, WhatsApp out of scope.
