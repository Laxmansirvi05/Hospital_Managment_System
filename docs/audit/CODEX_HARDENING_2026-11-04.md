# CareRoute hardening pass, Codex

Date: 2026-11-04

## Summary

- Added route authorization coverage and fixed doctor experience ordering and output shape in the memory adapter.
- Hardened DOCX archive parsing and made red-flag assistant responses bypass model calls.
- Completed environment examples. T3 dependency advisories remain because the smallest Vitest security bump was incompatible with the locked Vite version.
- Full suite result after code changes: 138 unit and API tests passed; three new DOCX checks, three adapter checks, and 128 route matrix checks also passed.
- No production database, Supabase, SQL, migrations, deploy or push was used.

## Tasks

| Task | Status | Commit | Files |
| --- | --- | --- | --- |
| T1 | Partial | `c31542a` | `tests/route-matrix.test.js` |
| T2 | Partial | `1b18c72` | `server/db/memory.js`, `tests/adapter-parity.test.js` |
| T3 | Partial | None | No dependency changes retained |
| T4 | Done | `338148e` | `server/assistant/docx.js`, `server/routes/assistant.js`, `tests/docx-hardening.test.js`, `tests/api.test.js` |
| T5 | Done, review only | None | No code change indicated |
| T6 | Done, review only | None | No code change indicated |
| T7 | Done, review only | None | No code change indicated |
| T8 | Done | `42cc038`, `0ace111` | `.env.example` |
| T9 | Skipped | None | Tree was not clean, as required to run T9 |

Commit `8379726` is a correction after `42cc038` accidentally captured an already staged owner deletion of `public/logo.png`. It restores the committed asset and leaves the owner deletion uncommitted in the worktree. Across those two commits, the net owned change is `.env.example`; the final deletion remains outside this task.

## Findings

- **Medium, fixed:** [server/assistant/docx.js](/Users/laxmansirvi/hospital%20managment/server/assistant/docx.js:6) now caps archive entries, total and per-entry expanded size, compression ratio, validates central and local record bounds, rejects unsafe paths, nested archives, and DTD/entity declarations. `tests/docx-hardening.test.js` covers DTD, path, count, nested archive and compression cases.
- **High, fixed:** [server/routes/assistant.js](/Users/laxmansirvi/hospital%20managment/server/routes/assistant.js:98) now returns the fixed emergency guidance immediately when red-flag rules match. No model call or model-written diagnosis or dose enters that emergency response. The API test asserts that the provider is not called.
- **Medium, fixed:** [server/db/memory.js](/Users/laxmansirvi/hospital%20managment/server/db/memory.js:288) now sorts experience results before paging, follows the Postgres tie-break by name, retains total count, and does not expose temporary top-level coordinates.
- **High, unresolved:** [server/db/memory.js](/Users/laxmansirvi/hospital%20managment/server/db/memory.js:266) returns no test prices, while [server/db/postgres.js](/Users/laxmansirvi/hospital%20managment/server/db/postgres.js:389) reads populated `test_prices`. No sample prices were fabricated. Populated parity needs an approved fixture or a separate development test database, neither was available under this prompt.
- **Medium, unresolved:** [server/db/postgres.js](/Users/laxmansirvi/hospital%20managment/server/db/postgres.js:121) ignores conflicts on `email` only. Memory also returns null for a duplicate `googleSub`. A racing duplicate Google identity can therefore take a different path in Postgres. This needs a focused adapter test or a query review by the database lane; no live database was used.
- **Medium, unresolved:** T1 covers every protected route's unauthenticated result, patient/driver role boundaries and missing cookie CSRF on protected writes. It does not give every route a valid and invalid input case. The prompt asks for HTTP 400 validation, while the established project contract returns 422 `invalid_input`; that API contract was preserved.
- **Medium, unresolved:** T3 audit remains at 15 advisories in dev dependencies: 1 low, 10 moderate, 1 high and 3 critical. `npm audit` could not run because the repo has no npm lockfile. `pnpm audit` is the usable report. A temporary exact Vitest 4.1.12 bump removed the three critical advisories but Vitest could not start with the resolved Vite 5.4.21 (`ERR_PACKAGE_PATH_NOT_EXPORTED`, missing `vite/module-runner`). pnpm 11 ignores package-level `pnpm.overrides`; the temporary bump was reverted. Needs owner approval to move the Vite override into pnpm workspace configuration and test the resulting toolchain.
- **Low, review only:** Auth uses HttpOnly, SameSite=Lax cookies, production Secure, scoped paths and expected lifetimes. CSRF checks apply to cookie writes and foreign Origins; public refresh requires its CSRF header. Google flow binds state, nonce and PKCE verifier to a signed ten-minute cookie; callback checks state and Google checks nonce. Refresh-token reuse revokes its session. JWT uses a fixed HS256 header, required expiry and startup secret validation. Login/register email enumeration is intentionally report-only. No password-reset route exists.
- **Low, review only:** T6 found no empty catch blocks or direct logging of request bodies, tokens, cookies, contact information, health content or document names. Unexpected errors log limited metadata and return the generic 500 error shape without a stack or SQL text in the response.
- **Low, review only:** T7 route input schemas are bounded and strict for writes and search filters. Response view functions enumerate client fields. Search pages cap limit at 50 and offset at 5,000. No route was found spreading a database row directly into a response.
- **Low, fixed:** [`.env.example`](/Users/laxmansirvi/hospital%20managment/.env.example:4) now includes server mode, proxy, Vercel, import database URL, assistant model and daily-limit variables with local values or placeholders. `server/config.js` validates required deployment secrets at startup. `scripts/load-listings.js` refuses to run if the selected database URL is missing.
- **Not verified:** Memory-only tests do not execute Postgres SQL. All SQL was inspected statically. No live database call was made.

## Needs owner

- Approve or reject the pnpm 11 workspace-level Vite override and Vitest 4 upgrade, with full regression testing.
- Confirm whether in-memory test-price results should intentionally be empty or should receive a curated synthetic fixture.
- Decide whether login and registration email-enumeration behavior should remain as-is.

## Needs Claude

See [handoff to Claude](/Users/laxmansirvi/hospital%20managment/docs/audit/handoff/to-claude.md): Postgres duplicate Google-subject conflict behavior and populated test-price parity need follow-up without using production data.

## Verification

- `pnpm exec vitest run tests/route-matrix.test.js`: 1 file, 128 tests passed.
- `pnpm exec vitest run tests/adapter-parity.test.js`: 1 file, 3 tests passed.
- `pnpm exec vitest run tests/docx-hardening.test.js`: 1 file, 3 tests passed.
- `NODE_ENV=test pnpm test`: 2 files, 138 tests passed (67 unit and 71 API).
- `node --env-file=.env.example --input-type=module -e "import { loadConfig } from './server/config.js'; const c=loadConfig(); console.log(JSON.stringify({env:c.env,port:c.port,store:c.store,assistantDailyLimit:c.assistantDailyLimit,trustProxy:c.trustProxy,providerCount:c.aiProviders.length}))"`: passed with development, port 4000, configured sample database mode, daily limit 300, trustProxy false, and no providers. This only loaded configuration and made no database connection.
- `npm audit --json`: exit 1, `ENOLOCK`; an npm lockfile is absent.
- `pnpm audit --json`: exit 1 because of advisories, 15 total (1 low, 10 moderate, 1 high, 3 critical). The final audit is unchanged from the starting lockfile.
- `git diff --check`: passed before each code and environment commit.
- No lint script exists. `pnpm check` was not run because it scans `public/`, where concurrent owner edits were present.
- Nonprinting secret scan on these two report files: 0 hits. Em-dash scan: 0 hits.

## Untouched on purpose

- Owner edits and deletions under `public/**`, including the current deletion of `public/logo.png`.
- Pre-existing untracked `assets/`, video, audit evidence, decision briefs, Supabase reports, brand assets and other files under `docs/audit/`.
- No changes to `vercel.json`, `api/**`, `supabase/**`, or any decision document.
- T9 was skipped because the worktree has owner edits and untracked files. The Vercel `/search/doctors/` routing and video-size inventory were not performed.

## Git status and commits

The original baseline at the start of this pass had no tracked modifications and had the untracked audit, asset and brand files listed above. The current tracked changes are owner edits under `public/**`, including `D public/logo.png`. Existing untracked files remain unmodified. No owner file was staged in the final state. Commit hashes created by this pass: `c31542a`, `1b18c72`, `338148e`, `42cc038`, `8379726`, `0ace111`. A concurrent owner commit `d4efbce` is also on `main`; it is not part of this work.
