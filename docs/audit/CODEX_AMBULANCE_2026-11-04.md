# CareRoute ambulance demo build report

The synthetic ambulance server, API, sample adapters, patient screens, driver screen, and admin screen are implemented.
The contract docs and Postman collection include the emergency routes, and the API test command now includes all `tests/*.test.js` suites.
The memory lifecycle and public tracking allowlist pass unit tests; browser coverage exercises patient SMS, undo, guest tracking, and the guest demo trip.
The shared navigation change and a browser test for a real driver accepting a non-demo emergency remain partial.
No production database, Mapbox, Twilio, deployment, or push was used by Codex.

## Task status

| Task | Status | Commit | Files or scope |
| --- | --- | --- | --- |
| E0: run every server suite in CI | Done | `581611e` | `package.json`, `.github/workflows/ci.yml` |
| E1: memory lifecycle adapter | Done | `03cffa7` | `server/db/memory.js`, `tests/emergency-memory.test.js` |
| E2: demo crew lifecycle simulator | Done | `33ab8e4`, follow-up `35fed50` | `server/emergency/demo-crew.js`, `server/emergency/service.js`, `tests/emergency-service.test.js`; acceptance remains observable for one read |
| E3: ETA and SMS adapters | Done | `159e648` | `server/integrations/mapbox.js`, `server/integrations/sms.js`, config and integration tests |
| E4: role-scoped API routes | Done | `de18e27` | `server/routes/emergencies.js`, `server/emergency/runtime.js`, `server/router.js`, API tests |
| E5: Postgres adapter | Partial | `43aab3a` | `server/db/postgres.js`, `tests/adapter-parity.test.js`, `docs/audit/handoff/to-claude.md`; SQL is listed for Claude verification, no live DB verification by Codex |
| E6: API contract docs | Done | `9be1589` | `scripts/generate-api-contract.js`, `docs/05-api-spec.md`, Postman collection, contract tests |
| E7: SOS screen | Done | `4c25dbb` | `public/sos/`, `public/js/pages/sos.js`, `public/css/emergency.css` |
| E8: emergency status screen | Done | `5d29f30` | `public/emergency/`, `public/js/pages/emergency.js`, `public/css/emergency.css` |
| E9: public tracking screen | Done | `5842662` | `public/track/`, `public/js/pages/track.js`, `public/css/emergency.css` |
| E10: driver workspace | Done | `3178a20` | `public/driver/`, `public/js/pages/driver.js`, `public/css/emergency.css` |
| E11: admin operations | Done | `40043b7` | `public/admin/`, `public/js/pages/admin.js`, `public/css/emergency.css` |
| E12: navigation | Partial | None | Shared `public/js/shell.js` not changed because its owner edit `273e853` at 20:12:23 was still inside the three-hour no-clash window at review time |
| E13: browser tests | Partial | `35fed50` | `tests/e2e/ambulance.spec.js`; four tests pass, including full guest demo trip, patient sample SMS, undo, no-match, tracking allowlist, keyboard, responsive, reduced-motion, and CSP checks; real non-demo driver acceptance is not covered |

## Findings and limits

- Sample mode uses the in-memory adapter when `DATABASE_URL` is empty. The browser run logged `"store":"memory"` on port 4402.
- Mapbox and Twilio adapters use local fake/fallback behavior in sample mode. No outside requests were made or verified.
- The public tracking API returns only `status`, `ambulance`, `etaSeconds`, `etaIsEstimate`, and `demo`. The E2E check asserts the exact field set and page text does not include the tracking token, emergency ID, guest phone, or pickup address.
- The guest trip browser test starts close to a demo crew. It skips deterministic decline seeds by cancelling those requests before the offer timer and using a fresh test network address. The successful request then travels through `assigned`, `en_route`, and `completed`.
- The service unit suite uses an injected fake clock and also verifies a no-match path and that a non-demo ambulance is never auto-accepted or moved. A browser session for a real driver accepting that non-demo ambulance is not verified because the sample server does not provision a driver/vehicle account.
- The shared shell currently filters navigation to patients and care discovery links. Proposed additive change: create a role-filtered navigation group with `/driver/` for `driver` and `/admin/` for `admin`, with the `ambulance` and `shield` icons; add a patient `/emergency/?id=<active-id>` link only when `GET /api/v1/emergencies/active` returns a request. Apply the same role filter to the compact tab bar if those links should be reachable there. Do this after the shell owner’s edit window closes.

## Needs Claude

- Verify every statement and parameter in `docs/audit/handoff/to-claude.md` against the DEV schema in rolled-back transactions. Codex did not connect to a database or run SQL.
- Report any Postgres row mapping, null-return, lifecycle, or SQL cast mismatch. Postgres adapter behavior against a real database remains **NOT VERIFIED** by Codex.
- Production migration or deployment is outside this pass and remains **NOT DONE** by Codex.

## Needs owner

- Apply the E12 navigation addition after the shell no-clash window, then verify Driver and Admin links are role-specific and the patient Emergency link appears only for an active request.
- Arrange a local/demo driver account attached to a non-demo ambulance if a browser acceptance test for that path is required. Current automated service coverage proves only that the simulator does not act on non-demo vehicles.
- The owner’s existing untracked/modified files and assets remain untouched. `public/assets/careroute-ambulance-720p.mp4` remains an existing cleanup candidate noted by the earlier handoff.

## Verification

| Command | Result |
| --- | --- |
| `DATABASE_URL= pnpm test` | Passed: 12 files, 374 tests |
| `pnpm check` | Passed: `public/` check |
| `node --check public/js/pages/admin.js` | Passed |
| `DATABASE_URL= PORT=4402 TRUST_PROXY=true pnpm dev` | Started in sample memory mode; `DATABASE_URL` explicitly empty |
| `DATABASE_URL= CAREROUTE_BASE_URL=http://127.0.0.1:4402 pnpm exec playwright test tests/e2e/ambulance.spec.js` | Passed: 4 browser tests; sample mode; port 4402 |

Not verified: Postgres adapter against a live database; real Mapbox or Twilio behavior; browser acceptance by a real non-demo driver; production migration/deployment. No test used a database or outside service.

## Codex commits

`581611e`, `03cffa7`, `33ab8e4`, `159e648`, `de18e27`, `43aab3a`, `9be1589`, `4c25dbb`, `5d29f30`, `5842662`, `3178a20`, `40043b7`, `35fed50`.

No commit was pushed.
