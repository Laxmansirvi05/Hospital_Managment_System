# Changelog

Every change to a LOCKED decision, the API contract or a document's meaning is recorded here, newest first.

## 2026-10-17

### WP-0 foundation (in progress)

- Added: `package.json` (zod, postgres; vitest, eslint), `.gitignore`, `.env.example`, `vercel.json` with security headers.
- Added: `server/` config groups with Zod, redacting logger, HTTP helpers, router that refuses shadowed and role-less routes, fail-closed auth stub, `GET /api/v1/health`, `GET /api/v1/config`, single entry `api/v1/[...path].js`.
- Added: `public/` tokens, base CSS, button, card, field and status components, home page, styleguide page, theme toggle.
- Added: `scripts/dev.js`, `scripts/lint-style.js`, `scripts/scan-public.js`, `scripts/check-env.js`, and 100 tests.
- Added: dark tokens `--border` `#38383A` and `--primary-hover` `#5AB0FF` to the design system (PROPOSED).
- Git initialised with remote `origin` set to the GitHub repository. Nothing pushed.

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
