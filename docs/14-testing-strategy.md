# Testing strategy

Tools are PROPOSED (P-09). The aim is simple: a change that breaks safety, security, the contract or accessibility must fail a test before it merges.

## 1. Layers

| Layer | Tool | What it proves |
| --- | --- | --- |
| Unit | Vitest | Pure logic: triage rules, ranking, state machine moves, token hashing, Zod schemas, config validation, custom element rendering (with a DOM test environment) |
| Database | Vitest against local Supabase | Migrations apply, constraints hold, `accept_emergency` is race safe, `expire_offers` works, RLS blocks `anon` |
| Contract | Newman running `postman/ambulance-platform.postman_collection.json` | The API behaves as the collection says, in the collection's order |
| Integration | Vitest against the API router | Role and ownership matrix, error shapes, adapters with fakes |
| End to end | Playwright | Each role's main flow in the browser, in light and dark |
| Accessibility | axe inside Playwright, plus manual passes | Section 4 of `13-accessibility.md` |
| Security | Dedicated suite | Section 13 of `09-security.md` |

## 2. Contract tests

- The collection is the contract. Do not edit it to make a failing run pass. A change to the collection needs owner approval and a note in `CHANGELOG.md`.
- It must run against a database reset to seed state, because registering twice returns 409 and the flow depends on earlier steps.
- The collection runs folders 0 to 8 in order and stores tokens and ids in collection variables. Newman reproduces this.
- The collection-wide "responds in under 2 seconds" test is kept. Measure it locally and on a warmed preview. A cold start failure is reported as such, not hidden.
- The collection's `baseUrl` points at port 4000, so the local app runs on 4000 (PROPOSED in `00-decisions.md`).
- New endpoints from `05-api-spec.md` section 4 get requests and tests added to the collection in WP-9, with approval.

## 3. What must have tests

1. **State machine.** Every allowed move, every disallowed move returning 409, terminal states, cancel only before pickup, feedback only after completion.
2. **First accept wins.** Two accepts at once: exactly one succeeds. This is a real concurrency test, not two sequential calls.
3. **Offer expiry.** An offer past its time is expired and the next opens. Use a controllable clock in unit tests and a real pg_cron run once in an integration check.
4. **Role and ownership matrix.** For every route: no token (401), wrong role (403), right role wrong owner (404 or 403 as defined), right role and owner (success).
5. **Triage rules.** Positive and near-miss negative case per rule. The chest pain and sweating case from the collection. Safety floor. Provider failure order. Injection set. See `07-ai-triage.md` section 5.
6. **Public tracking.** Response has no medical, name or phone fields. A wrong token returns no information about whether the emergency exists.
7. **Validation.** Latitude 200 returns 422 mentioning location. Each Zod schema has invalid cases.
8. **Adapters.** Each of Mapbox, SMS and the three model providers is tested with a fake for success, timeout and error, and the fallback behavior is asserted.
9. **Config.** Missing or malformed secrets stop startup with a clear message that does not print values.
10. **Secrets.** Scan of every file in `public/` and of the `/api/v1/config` response finds no server secret value, and the config response contains only allow-listed names. No file in `public/` references `server/`.
11. **Medical reports.** The list in `08-medical-reports.md` section 10.
12. **Design tokens.** A test computes contrast for every text and background token pair in both themes and fails under the required ratio.
13. **Spacing and banned patterns.** A lint script searches for the items in `11-design-system.md` section 9 where search is possible, for CSS spacing values outside the tokens, for `innerHTML` with data, and for the em dash character in source and docs.

## 4. Test data

- Synthetic only. Seed users for each role, a few hospitals, doctors, ambulances near the sample coordinates in the collection.
- No real phone numbers in tests. SMS and model calls use fakes in CI.
- Live provider checks run by hand, with the owner's keys, and are never part of the automated suite.

## 5. Running

No commands exist on `main` yet. This is the intended set.

| Purpose | Intended command |
| --- | --- |
| Unit and integration | `pnpm test` |
| Database tests | `pnpm test:db` |
| Contract tests | `pnpm test:contract` |
| End to end and accessibility | `pnpm test:e2e` |
| Lint | `pnpm lint` |
| Style lint and public secret scan | `pnpm check` |
| Everything before a commit | `pnpm verify` |

## 6. Rules for writing and changing tests

1. Write the failing test first for rules, the state machine and security fixes.
2. Never weaken, skip or delete a test to make a change pass. If a test is wrong, say why and get approval.
3. Never report a feature as verified based on a fake alone. Say what was tested against a fake and what against the real thing.
4. Report test totals honestly, including failures and which were already failing.
5. No numeric coverage target is set. Coverage is judged by the list in section 3 (OPEN: confirm with owner).

## 7. Performance checks

- Measure the SOS creation path, hospital search and the ping endpoint on a warmed preview and record the numbers in `docs/perf-notes.md` (created when measured).
- Measure ping handling for a realistic number of drivers before the demo, to confirm the serverless and Realtime limits are not hit.
- Do not publish performance claims that were not measured.
