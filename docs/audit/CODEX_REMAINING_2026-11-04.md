# CareRoute Pass 2 remaining work

Date: 2026-11-04

## Summary

- W1 to W9 work is recorded below; W13 reduces the auth video from 64,522,280 bytes to 956,245 bytes and defers its request.
- W15 removes the runtime `cssText` write and adds source and browser checks for CSP style violations.
- Final local checks: 138 unit/API tests and 23 E2E tests passed; `pnpm check` passed.
- No production database, Supabase, AI provider, deployment, paid service, or push was used in this pass.
- W10/W11/W19/W20 remain partial or skipped for the reasons below; blank G1/G2/G3 approvals remain gates.

## Task status

| Task | Status | Commit | Files or result |
|---|---|---|---|
| W1 | Done | `07f3384` | `server/db/postgres.js`, `tests/adapter-parity.test.js`; generic conflict clause and duplicate identity tests. |
| W2 | Partial | `c13a088` | `tests/route-matrix.test.js`; route auth/input matrix added, but exact valid response fields are not asserted for every route. |
| W3 | Partial | `96afb72` | Assistant fake-provider tests; invalid JSON maps to `bad_json`. The full requested prompt matrix, including every DOCX and log assertion, is not covered. |
| W4 | Done | `9a55449` | `docs/05-api-spec.md`, Postman collection; both enumerate the 68 implemented method/path pairs. Future ambulance/SOS paths are marked planned. |
| W5 | Done | None | Read-only scan covered 82 revisions, tracked worktree, and 27 untracked text files; no secret-shape candidates. `.env` and `.env.*` contents were not read. |
| W6 | Done | `b051b0b` | `.github/workflows/ci.yml`; pinned Node/pnpm, frozen install, check and test only, no secrets or deploy. |
| W7 | Partial | `11b0595` | `tests/e2e/patient-journeys.spec.js`; synthetic signed-in patient journeys at 390/820/1440. Sessions list/revocation screen is absent and remains uncovered. |
| W8 | Done | `9a05bea` | `tests/e2e/patient-error-states.spec.js`; empty, auth, HTTP, and network recovery states covered. |
| W9 | Partial | `ee15916` | `tests/e2e/assistant-accessibility.spec.js`; keyboard, consent, fallback, live region and withdrawal covered. Robot focus trap is not implemented; no real provider was called. |
| W10 | Partial | None | Saved browser candidates reviewed as heuristics. 72 visits include 51 protected-route sign-in redirects; the 9px minimum and target counts are not reliable for those pages. No axe scan because G2 is blank; full manual contrast, focus, tab order, labels, and 200% zoom audit remains. |
| W11 | Partial | None | `public/js/details.js:24-35,43-46` shows the no-phone message and directions on detail pages. `public/js/ui.js:123-152` list cards omit phone availability. No change made because list presentation and owner design lane need review. |
| W12 | Done | None | Repository grep found no `/search/doctors/` app link, redirect, or documentation reference outside audit evidence. No redirect added. |
| W13 | Done | `2d44dd2` | `public/js/auth-page.js`, `public/assets/careroute-ambulance-720p.mp4` (956,245 bytes), `public/assets/careroute-ambulance-poster.webp` (80,556 bytes), `tests/e2e/auth-media.spec.js`. Original MP4 and images preserved. Local static Range request still returns HTTP 200 and the full 956,245 bytes. |
| W14 | Done, review only | None | `README.md`, `public/` copy scan found no unsupported live dispatch, tracking, SMS, response-time, price-ceiling, diagnosis, or doctor-availability promise. Matching hits state limitations: README lines 6-7, 13; `public/terms/index.html:59,64`; `public/privacy/index.html:69`; `public/js/pages/reminders.js:192`. No edits needed. |
| W15 | Done | `e536c91` | `public/js/h.js`, `scripts/check-public.js`, `tests/e2e/csp-runtime-styles.spec.js`; individual CSSOM writes replace `cssText`, scanner checks style attribute writes and template markup, browser saw no CSP style violations on public pages or signed-in dashboard. |
| W16 | Gated | None | G1 is blank. No dependency changes. |
| W17 | Gated | None | G2 is blank. No axe dependency or scan. |
| W18 | Gated | None | G3 is blank. Memory test prices remain empty; no fixture invented. |
| W19 | Skipped | None | `postgres`, `pg_ctl`, and `initdb` exist, but the local PostgreSQL extension directory lacks `postgis.control`, required by the foundation migration. No cluster was initialized and no migrations were run. |
| W20 | Partial, report only | None | Candidate scan found 0 unreferenced JavaScript files among 41 public JS modules. No exhaustive unused-export, CSS-selector, or dependency analysis tool is installed; no files or dependencies were removed. |

## Findings

- **Medium, remaining:** W10 is not a complete manual WCAG 2.1 AA audit. The 2026-11-03 saved sweep had 72 route/viewport rows, no measured horizontal overflow, and 51 protected-route redirects. It cannot establish accessible names, real control dimensions, contrast, keyboard focus order, or 200% zoom behavior on signed-in pages.
- **Medium, remaining:** listing cards do not state “phone not listed.” Detail pages show that message and directions when location is present. Confirm whether the list-card design should add a directions action before changing its structure.
- **Medium, remaining:** assistant panel uses `aria-modal="false"` and has no focus trap. See `public/js/assistant/chat.js`; robot implementation is owner work committed within the protected three-hour window during this pass.
- **Low, remaining:** local static server does not honor Range requests. The new optimized file is 956,245 bytes, so a range fix was not necessary for the 4 MB cap. Recheck CDN delivery after an owner-approved deployment.
- **Low, remaining:** W20's 0-file candidate result is heuristic. Runtime imports and generated selectors can defeat static reference scans.
- **Verified:** W13 auth media test confirms both auth pages transfer under 1 MB before any video request. Video loads only after idle on wide screens; reduced motion, data saver, and screens up to 720px skip it.
- **Verified:** W15 `pnpm check` passes; the browser test reports zero style-related CSP console violations on home, sign-in, sign-up, privacy, terms, and a signed-in dashboard.

## Needs owner

- Fill G1/G2/G3 only after deciding on the dependency upgrade, axe scan, and synthetic test-price fixture.
- Review whether no-phone list cards should expose directions directly or route users through the existing detail actions.
- Decide the assistant panel focus-trap behavior and schedule the full signed-in manual accessibility pass.
- Install or provide a local PostGIS-enabled PostgreSQL service if adapter integration tests are still required.

## Needs Claude

- No code or database action requested from Claude in this pass. Existing Supabase migration and production findings remain in Claude's `PROD_*` and `SUPABASE_*` audit files.

## Verification

| Command | Result |
|---|---|
| `pnpm check` | Passed: `public/ check passed`. |
| `NODE_ENV=test pnpm test` | Passed: 138 tests, 67 unit and 71 API. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4013 pnpm exec playwright test tests/e2e --workers=1` | Passed: 23/23 E2E tests, sequentially. One earlier parallel run had the existing reduced-motion screenshot test fail once; the sequential full rerun passed. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4013 pnpm exec playwright test tests/e2e/auth-media.spec.js --workers=1` | Passed: 2/2. |
| `CAREROUTE_BASE_URL=http://127.0.0.1:4013 pnpm exec playwright test tests/e2e/csp-runtime-styles.spec.js --workers=1` | Passed: 2/2. |
| `curl -r 0-1023 .../assets/careroute-ambulance-720p.mp4` | Not range-supported locally: HTTP 200, 956,245 bytes returned. |
| Postgres extension check | Not run: PostGIS control file absent. |
| Full manual W10, axe, signed-in 200% zoom and contrast computation | Not verified. G2 remains blank. |

## Untouched on purpose

No production or development database, SQL, Supabase, real AI provider, paid service, schema, decision log, public owner file within the three-hour window, `.env`, or original untracked media was changed. The existing untracked `assets/`, audit evidence, decision briefs, production reports, `public/assets/*` images, and handoff files were preserved.
