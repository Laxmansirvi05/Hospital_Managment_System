# CareRoute patient-side status

Date: 2026-11-06

## Current completion

The audit's patient-side pillars still score **48.3% weighted** across the six patient pillars (discovery, health portal, authentication/security, data quality, AI assistant and emergency), using the same weighted pillar arithmetic as the audit and normalizing by their combined weight of 86:

`(25×52.2 + 20×41.7 + 15×56.9 + 10×48.6 + 8×44.0 + 8×40.0) / 86 = 48.26%`.

The corresponding scoped row score is approximately **46.8% unweighted**: the six pillars contain 79 scored rows and approximately 37.0 points from the audit's displayed pillar values. These are inherited proxy scores, not a complete product inventory or release claim. The source ledger remains unchanged because it is pre-existing untracked owner work. Its entries and score cannot be safely updated under the ownership rule.

## Ledger rows moved

No scored requirement row changed in the source ledger. The following audit findings were addressed or rechecked in patient-owned files:

| Finding | Result and evidence |
|---|---|
| FND-024 | Added `/search/doctors/`, `robots.txt`, and a valid empty `sitemap.xml`; local `/favicon.svg` already exists. Browser screenshot: `docs/audit/evidence-codex-2026-11-06/doctors-search-desktop.png`. Local responses were HTTP 200. The sitemap is empty because the public domain is unresolved (Q-16/Q-18); production is unverified. |
| FND-029 | Reconciled `docs/16-deployment-and-environments.md` and removed the stale Gemini key from `.env.example`; names now match `server/config.js`. |
| FND-030 | Route registry and Postman both contain 104 entries after adding 15 already-registered admin routes to the shared spec/collection. Exact set equality is covered by `tests/api-contract.test.js`. P-20 reject remains explicitly proposed. |
| FND-013 | Current route and UI use `total` with `limit`/`offset`; `docs/05-api-spec.md` contains no `nextCursor`. Existing pagination tests cover non-repeating pages. |
| FND-025 | Sign-in/sign-up use the poster and defer the 64,522,280-byte 4K source. Browser tests measure initial transfer below 1 MB and verify that user action requests the video. The full asset still loads if played; Range support is not established. |

Patient portal journey evidence was captured in `docs/audit/evidence-codex-2026-11-06/` for dashboard, medical ID, reminders, appointments, documents, settings, account, and doctor search.
Further screenshots in the same folder cover hospital search at desktop/tablet/mobile, a hospital detail page, assistant consent and provider fallback, guest SOS/tracking completed and no-match states, a patient search error recovery state, a synthetic price warning, and Google sign-in through the local fake. The selected browser suites total 17 passing tests; this is not a full E2E suite run.
The memory-mode banner now also says listings and prices are examples, not current provider information. Browser evidence: `sample-price-warning-desktop.png`.

## Commands and results

| Command | Result |
|---|---|
| `pnpm check` | Passed: `public/ check passed`. |
| `NODE_ENV=test DATABASE_URL= pnpm test` | Passed: 14 files, 459 tests. `DATABASE_URL` was explicitly empty to keep the suite in memory mode. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/patient-journeys.spec.js --workers=1` | Passed: portal CRUD and responsive journey, 1 test. External HTTPS requests were blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/discovery-doctor-route.spec.js tests/e2e/auth-media.spec.js --workers=1` | Passed: 3 tests. Screenshots saved under `docs/audit/evidence-codex-2026-11-06/`; external HTTPS requests were blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/ambulance.spec.js --workers=1` | Passed: 4 synthetic SOS/tracking tests, with external HTTPS blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/assistant-accessibility.spec.js --workers=1` | Passed: 2 keyboard, consent, fallback and withdrawal tests, with external HTTPS blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/hospitals.spec.js --workers=1` | Passed: 4 discovery layout, filter, detail-source and contact-path tests, with external HTTPS blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/patient-keyboard-access.spec.js --workers=1` | Passed: keyboard skip path and labelled-field sweep across public, patient, detail and synthetic emergency pages, with external HTTPS blocked. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/patient-error-states.spec.js --workers=1` | Passed: empty states plus 401/403/404/422/500/network recovery across patient portal, assistant, discovery and detail pages. The test blocks external HTTPS and saved `patient-search-error-desktop.png` in the evidence folder. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/patient-journeys.spec.js --workers=1` | Passed: account and care-record journey in memory mode; also verifies and captures the synthetic listing/price warning. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4403 pnpm exec playwright test tests/e2e/auth-google-memory.spec.js --workers=1` | Passed: browser OAuth state/cookie/callback journey using the local fake token adapter in `tests/e2e/support/fake-google-token-endpoint.js`. Chromium blocks Google DNS; the browser rewrites the local start response to the local callback before navigation. Screenshot: `google-signin-memory.png`. |
| `NODE_ENV=test DATABASE_URL= node scripts/measure-assistant-rules.js` | Passed: 25 in-memory `/assistant/triage` red-flag API samples. Median 1.71 ms, p95 3.01 ms, fake-provider calls 0. |
| `NODE_ENV=test DATABASE_URL= pnpm exec vitest run tests/api.test.js -t "isolates each patient record view"` | Passed: verifies profile privacy, empty per-patient lists, no cross-owner reminder/dose/appointment/contact access, dashboard isolation, and continued owner access. |
| `pnpm check` | Passed after the memory-mode warning change: `public/ check passed`. |
| Local `curl -I` to `/search/doctors/`, `/sitemap.xml`, `/robots.txt` | All returned 200; sitemap and robots MIME types are configured in the memory-mode dev server. |

## Owner must verify on real systems

- Postgres behavior and migrations have not been exercised against any real database in this work step.
- Production deployment, production routes, and any provider delivery remain unverified. No live database or AI/SMS provider was contacted. One initial Google browser-harness attempt reached Google's authorization page and received `invalid_client` because the route did not intercept the navigation. No credentials were entered and no token exchange occurred. The passing test now rewrites the local start response before browser navigation, blocks Google DNS, and uses a fake server-side token endpoint. Other earlier browser runs blocked external HTTPS requests; a first local capture before network blocking displayed the configured OpenStreetMap tiles.
- The two pre-existing untracked emergency migration files remain untouched and unstaged because the audit records them as owner-existing uncommitted work; resolve ownership before committing them.

## Decisions needed

- P-09: approval for Playwright, axe and Newman test tooling and any CI additions. No CI change is authorized by this status.
- P-20: driver reject contract remains proposed. Treat any existing implementation as unapproved for contract expansion.
- P-30: landing-page guardrails need owner decision before finalizing scene behavior.
- P-05 conflicts with locked D-24 scrypt; D-24 wins and will not be changed.
- P-18/P-22/P-28 admin work was already approved by D-83; this pass added only the missing shared contract documentation for registered admin paths and changed no admin implementation or tests.
- Q-10 retention, Q-16 security contact/domain, Q-18 domain/Vercel plan, Q-20 map tile terms, Q-26 assistant external sources, and Q-28 collector schedule remain open. Work will not depend on these decisions.

## Blocked / constraints

- Existing owner/audit modifications and untracked assets are present in the worktree. They were not staged or changed.
- Step 1's requested migration commit conflicts with the explicit ownership rule for pre-existing owner-uncommitted files. The migration files are not included in this commit.
- `docs/03-architecture.md` and `docs/04-data-model.md` are already owner-modified; D-77 and migration-state text there remains for the owner to reconcile. The pre-existing `docs/00-decisions.md` still says the P-20 request is absent from Postman, which conflicts with current generated contract files; it was left untouched.
- The current ledger and audit report are pre-existing untracked files. They were not edited, so the completion score cannot yet reflect this work.
- Populated test-price parity and the NPPA ceiling-price collector path remain incomplete; no fixture was invented and no live source was fetched.
- The sitemap has no URLs until the canonical domain is decided. D-80 landing scene work is also waiting for P-30 guardrails.
- The keyboard pass added skip navigation to sign-in/sign-up and focusable main targets on home, SOS, emergency status and tracking pages. It checks skip-link focus and labelled fields; it is not a full WCAG or axe audit.
- No owner/Claude implementation files were staged.

## Continuation verification (2026-11-06)

After the patient-side commits, the baseline was rerun in this checkout:

| Command | Result |
|---|---|
| `pnpm check` | Passed: `public/ check passed`. |
| `NODE_ENV=test DATABASE_URL= pnpm test` | Passed: 14 files, 459 tests. The empty database URL keeps this run on the memory/test path. |

The baseline was rerun again after the fake OAuth browser harness and assistant timing tool were added: `pnpm check` passed, and `NODE_ENV=test DATABASE_URL= pnpm test` passed all 459 tests in 14 files. The 25-sample assistant timing command reported 1.71 ms median and 3.01 ms p95, with zero provider calls. The patient ownership test was then expanded to check independent views and cross-owner denial across medical ID, contacts, reminders and doses, appointments, and dashboard; its focused Vitest run passed.

This recheck did not change the ledger or completion score. D-53's collector still covers Jan Aushadhi only; no NPPA source schema or authorized export was available, so an NPPA parser/fixture was not fabricated. `server/db/memory.js` and `server/db/postgres.js` have owner changes in the worktree and were not edited. The existing test-price parity check covers the empty memory result only; populated-price parity remains unverified. The audit ledger, audit report, and prior emergency migration files also remain untouched and unstaged as owner-origin work. The patient error-state sweep adds one passing selected browser test and a recovery screenshot. The portal journey was rerun after adding a visible warning that memory-mode listings and prices are synthetic examples; it passed and saved a screenshot. A separate browser test now completes the Google OAuth route with a fake token endpoint and no external provider request. The rule-layer API path was measured at 1.71 ms median and 3.01 ms p95 across 25 local samples with zero model calls. These browser runs remain selected coverage, not the full suite.
