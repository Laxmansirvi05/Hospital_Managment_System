# CareRoute audit delta

Date: 2026-11-04

This delta supplements `AUDIT_2026-11-02.md`; the older report and evidence files were not edited. Findings here reflect local code/tests, read-only Supabase metadata, and limited Chromium checks. They do not certify production readiness.

## Updated facts

| Earlier audit statement | New fact and evidence | Status |
| --- | --- | --- |
| Production database state and migrations were unknown because Supabase access was denied. | Reauthorization now exposes the correct org and both projects. Dev is active with 16 migrations; prod is active with 14. Migration inventories show that assistant and document-type changes exist in dev only. See [`PROD_VERIFY_2026-11-04.md`](./PROD_VERIFY_2026-11-04.md). | Updated from read-only metadata. |
| AI assistant not started. | D-65 to D-69 code is present: assistant page/panel, consent gate, triage and care discovery, document explanation path, DOCX text support, and saved conversations. `pnpm check` and 137 fake/unit/API tests pass. No real provider calls, clinician review, or production migration. | Code and fake tests verified; release not verified. |
| No robot implementation. | Robot component and model are present. On dev, the robot appeared on a signed-in dashboard and was absent on SOS for two synthetic accounts. Model plus vendored Three.js files total about 1.2 MB raw. | Browser behavior partially verified. |
| All public routes returned 200 and authenticated app routes were not exercised in a browser. | A fresh 72-visit route matrix at 3 sizes produced 66 HTTP 200 responses and six expected 404 responses. Private routes redirected in sample mode. On dev, two synthetic users completed signup and account deletion. | Sample page render and limited dev journey verified. |
| Production database parity unknown. | Prod is two migrations behind dev. Current assistant routes need the absent tables and consent column. Prod also lacks current DOCX/WebP Storage and file constraint changes. | Release blocker. |
| Current medicine rows do not prove NPPA ceiling-price coverage. | Still true. The current Jan Aushadhi collector requests its public product list, not a verified NPPA dataset. Official OGD/NPPA search found no dataset id or API resource suitable for the proposed collector. | Data source remains unresolved in implementation. See [`NPPA_PLAN_2026-11-04.md`](./NPPA_PLAN_2026-11-04.md). |
| The README said this was still the documentation phase with no application code, implied live ambulance dispatch, and listed Gemini before Groq/OpenRouter. | README now records that development is active, says SOS is a demo pending Q-21, and lists the current Groq/OpenRouter order under D-66. | Factually reconciled. |
| Q-28 names `scripts/import-*.js`. | The checked-out collector and loader files are `scripts/collect-*.js` and `scripts/load-listings.js`; Q-28 wording now names those files. Q-28 remains OPEN. | Reference corrected, decision unchanged. |
| Hobby runtime history and Vercel team-scope access were unknown. | The denied Vercel response names `laxman-sirvi-s-projects`. Official Vercel docs limit Hobby logs to one hour, so seven-day logs cannot be retrieved under the documented plan. | Team/runtime checks remain UNVERIFIED. |

## Decisions and document reconciliation

- Q-21 remains OPEN. No real ambulance or patient operation is authorized by this audit.
- Q-28 remains OPEN. The proposed scheduler and operator are not selected.
- The current decision log already records D-53 as LOCKED to government NPPA plus Jan Aushadhi through data.gov.in, and D-48 as LOCKED to no landing page for now. The attached owner-answer fields were blank. This delta neither changes nor reinterprets those existing entries.
- The data.gov.in key status and key variable are UNKNOWN. No key was read or printed; no NPPA collector was built.
- The current report changes factual documentation only. No new decision was added to `docs/00-decisions.md`; its Q-28 script reference was corrected because the old path does not exist.
- `docs/01-prd.md` was not changed because it states intended product requirements, not current implementation status. `README.md` was updated only where it described a live ambulance workflow and a stale model order.

## Re-scored scoped completion proxy

The 2 Nov ledger has 79 scored rows and 27.2 points. Add seven requirement rows for D-63 to D-69: D-63 to D-68 are `DONE-UNVERIFIED` (0.6 each); D-69 is `PARTIAL` (0.4) because the page and upload code exist but its browser journeys are not complete. This adds 4.0 points. No new row is `DONE-VERIFIED`.

| Measure | 2 Nov audit | 4 Nov delta |
| --- | ---: | ---: |
| Scored rows | 79 | 86 |
| Points | 27.2 | 31.2 |
| Unweighted score | 34.4% | 36.28% |
| DONE-VERIFIED rows | 2 | 2 |
| Verified-only percentage | 2.5% | 2.33% |
| Weighted score | 38.62% | 40.60% |
| Weighted verified-only | 1.82% | 1.74% |

Arithmetic for the new unweighted figure: `(27.2 + 6 × 0.6 + 0.4) / (79 + 7) = 31.2 / 86 = 36.28%`. The verified-only figure is `2 / 86 = 2.33%`. Using the 2 Nov pillar weights and unrounded values, weighted score is `(25×55.7 + 20×41.7 + 15×57.1 + 10×48.6 + 10×0 + 8×36.4 + 8×0 + 4×50.0) / 100 = 40.60%`. Weighted verified-only is recalculated using 1 of 14 auth/security rows and 1 of 6 operations rows as verified, with the unchanged pillar weights, which yields 1.74%. These are scoped proxies, not launch certification.

## What was exercised

- `pnpm check`: passed against the local checkout.
- `NODE_ENV=test pnpm test`: 137 passed, including 67 unit and 70 API tests using fakes and test data.
- Supabase read-only inventories: dev and prod metadata/migrations/table catalogs; dev assistant schema, RLS, role/default grants. No personal data rows. No prod SQL.
- Browser: Chromium route sweep on sample mode at mobile/tablet/desktop; signup and deletion of two synthetic patients on dev; robot presence on dashboard and absence on SOS; aggregate count of matching synthetic accounts returned zero.
- Local server API: health returned HTTP 200 with `ok`; unauthenticated assistant triage returned HTTP 401.

Not exercised: real model providers, real documents, production SQL/data, production health, production Vercel environment names/targets, Vercel deployment SHA, seven-day logs, full browser accessibility, full signed-in product journeys, and NPPA data matching.

## Follow-up tasks

| Task | Files or system | Tests | Effort |
| --- | --- | --- | --- |
| Review and approve the two production migrations only after backup/access checks. | Supabase prod, `supabase/migrations/20261103000100_assistant.sql`, `20261103000200_more_document_types.sql` | Repeat migration inventory, RLS/grant check, file-type smoke, assistant route check after approval. | M |
| Reauthorize Vercel scope and verify only variable names/targets, deployment SHA and health. | Vercel `laxman-sirvi-s-projects` | Read-only production metadata and unauthenticated route checks. | S |
| Reduce the 62 MB auth video and confirm range support before rollout. | `public/assets/careroute_ambulance_4K.mp4`, `public/js/auth-page.js` | Browser transfer bytes and reduced-motion tests. Requires separate product edit authorization under Prompt B's report-only boundary. | M |
| Complete authenticated browser journeys and accessibility pass. | `docs/audit/browser-pass/` scripts; no `tests/` changes | axe, keyboard/focus, zoom, mobile touch, upload/reminder/review/settings flows using synthetic dev users. | M |
| Clinician review and privacy/legal review, including Q-10. | `docs/07-ai-triage.md`, privacy notice, data inventory | Reviewer sign-off; no code test substitutes for it. | Owner-led |
| Identify the official NPPA resource and estimate match quality before implementation. | `NPPA_PLAN_2026-11-04.md`, official OGD/NPPA portal | Read-only sample matching after a dataset and access method are confirmed. | M |

## Retention inventory for legal/privacy reviewer

Current retention is marked unset unless a code or owner decision provides a period. App server reads go through `careroute_api`; no direct browser database grants were observed. RLS is enabled with no browser policies on observed public tables. This records implementation facts, not legal advice.

| Data class | Where it lives | Who can read it | Deletion | Current retention |
| --- | --- | --- | --- | --- |
| Account | `users` in Postgres | Owner through authenticated app routes; server role. No admin account-read UI was verified. | Account deletion route removes account and cascades related rows. | Until account deletion; no inactivity purge recorded. |
| Medical ID | `patient_profiles` in Postgres | Owner through app; server role. Assistant may send only D-67 permitted fields after consent. | Account deletion cascade; patient edits through app. | Until user deletes account; Q-10 unset. |
| Emergency contacts | `emergency_contacts` | Owner through app; server role. | Account deletion cascade; user can manage via app. | Until account deletion; no independent expiry recorded. |
| Reminders and doses | `reminders`, `reminder_doses` | Owner through app; server role. | User deletion/account cascade. | No expiry policy recorded. |
| Appointments | `appointments` | Owner through app; server role. | User deletion/account cascade. | No expiry policy recorded. |
| Documents and photo | `patient_files` metadata in Postgres, private Supabase Storage object | Owner through app; server storage adapter/service credentials. Document text can be sent to providers after consent. | User delete action and account cascade/storage cleanup route. | No age-based expiry recorded; Q-10 unset. |
| Reviews | `reviews` and `review_reports` | Public listing review content may be visible in discovery; owner manages own review; server role. | User may delete own review; account behavior follows route/cascade. | No review expiry policy recorded. |
| Sessions | `sessions` in Postgres; token hashes, not raw refresh token | Server role; current user can revoke own session(s). | Logout/revoke; account deletion cascade. | Access token 15 minutes; refresh session expiry moves to 7 days; revoked-row cleanup not confirmed. |
| Rate limits | `rate_limits` hashed counters in Postgres | Server role only. | Scheduled cleanup removes rows older than one day. | One day, per D-25. |
| Assistant conversations | `assistant_conversations` in dev and proposed/applied schema only in dev | Owner through assistant routes; server role. No direct browser grants. | Delete one, delete all, or account cascade. | Beyond deletion is unset under Q-10. |
| Assistant messages | `assistant_messages` in dev | Owner through conversation routes; server role. Provider receives request content only after consent. | Conversation deletion/account cascade. | Beyond deletion is unset under Q-10. |
| Application/runtime logs | Vercel runtime logs and local structured logs | Authorized project operators; connector team-scope access currently denied. | Platform retention/rotation; owner policy not recorded. | Hobby docs: one hour of runtime logs. App-specific retention is otherwise unset. |
| AI provider logs | Groq/OpenRouter systems if calls occur | Provider operations under their policies. No live request was made in this audit. | Provider controls/deletion options vary by route and account setting. | Groq documents up to 30 days default reliability/abuse logging; OpenRouter route/provider retention varies. |
