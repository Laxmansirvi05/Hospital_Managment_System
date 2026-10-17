# Changelog

Every change to a LOCKED decision, the API contract or a document's meaning is recorded here, newest first.

## 2026-10-17

### Setup

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
