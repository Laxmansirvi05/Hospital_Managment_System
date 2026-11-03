# CareRoute assistant production release readiness

Date: 2026-11-04

## Verdict: NOT READY

The release checks passed locally, and the assistant schema is present in `careroute-dev`. Production is two migrations behind dev: it has neither the assistant schema nor the current DOCX/WebP document constraint. Vercel team-scope authorization and production environment names could not be checked. No production migration, production write, AI provider call, or GitHub push was performed. The approval fields in the prompt are blank.

### Owner approvals and notes

| Item | Status |
| --- | --- |
| `MIGRATE PROD` for `20261103000100_assistant.sql` | Not approved in the prompt. Not applied. |
| `PUSH TO GITHUB` | Not approved in the prompt. Not pushed. |
| Real AI calls | Not approved. No real provider call was made. |
| Supabase dashboard notes | Not supplied. Plan, backups, Auth sign-ups, exposed schemas, SSL, network restrictions, and orphan decision remain UNKNOWN. |

## Code and migration evidence

### Commits since `928764f`

| Commit | Area and changed files |
| --- | --- |
| `01e8fe1` | Robot design and vendored Three.js: robot model, robot JavaScript/CSS, `scripts/convert-robot.mjs`, vendor script and files, `public/js/shell.js`, `vercel.json`, robot browser test, design docs and package files. |
| `94beea3` | Robot model and animation refinements: model, robot JavaScript/CSS, conversion script and robot browser test. |
| `509bd3e` | Robot size adjustment: robot CSS/JavaScript and robot browser test. |
| `ffb0da9` | Assistant API and UI, Groq/OpenRouter adapter, safety/rules, consent and saved conversations, migration `20261103000100_assistant.sql`, tests and assistant/privacy/decision docs. |
| `9b8aefb` | Assistant page and floating panel, device uploads, DOCX extraction and support, migration `20261103000200_more_document_types.sql`, tests and docs. |

The working branch is `main`, two commits ahead of `origin/main` at the baseline. Existing untracked media and audit files were preserved.

### Migration state and grants

Read-only Supabase migration inventories on 2026-11-04 reported 16 migrations in dev and 14 in prod. The first 14 are shared. Dev additionally has `20261103000100_assistant` and `20261103000200_more_document_types`.

The assistant migration file and dev catalog agree on:

- `users.assistant_consent_at timestamptz`.
- `assistant_conversations`: `id`, `user_id`, `title`, `created_at`, `updated_at`, with the user/update index and cascade deletion from users.
- `assistant_messages`: `id`, `conversation_id`, `user_id`, `role`, `content`, `payload`, `created_at`, with a conversation/time index and cascade deletion.
- RLS enabled on both assistant tables. No `anon` or `authenticated` table grants were found. `careroute_api` has SELECT, INSERT, UPDATE, DELETE on each.
- Dev's `postgres` default ACL grants the same table privileges to `careroute_api` on later `postgres`-created tables. The assistant migration itself has no explicit `GRANT` statements. Prod's actual default ACL and role grants have not been compared for these absent tables.

Prod lacks both assistant tables and the consent column because the assistant migration is not applied there. Prod also lacks the migration that adds DOCX and WebP to the Storage bucket allow-list and `patient_files` check. The app's current accepted types therefore exceed prod's recorded schema and bucket configuration. No migration was applied during this audit.

### Effect of deploying current code before migrations

Source inspection shows assistant routes access `assistant_conversations`, `assistant_messages`, and update `users.assistant_consent_at`. Those assistant actions would fail against a database missing the migration. The sign-in and ordinary dashboard paths do not call those assistant database methods, so they are not expected to fail from the absent assistant tables alone. This is a code-path assessment, not a production runtime test. DOCX/WebP uploads may be rejected by prod Storage or its `patient_files` constraint until the second migration is applied.

### Configuration and consent

`server/config.js` reads `DATABASE_URL`, `JWT_SECRET`, `TRACKING_TOKEN_PEPPER`, `ALLOW_PRIVILEGED_SIGNUP`, `TRUST_PROXY`, `VERCEL`, `VERCEL_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_MAPTILER_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`, `ASSISTANT_DAILY_LIMIT`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODELS`.

Vercel environment variable names and targets were not verified because connector access to the owning team scope was denied. When no provider key is configured, the adapter has no model provider and the rule layer returns its fixed-rule/fallback response.

Code inspection and the fake-provider API tests confirm the model call is gated on recorded patient consent. The tested outgoing body contains the patient's message and permitted health facts, and excludes name, phone, email, address, exact date of birth, insurance, emergency contacts, and user id. Document text is sent only after consent. This is verified against a fake provider, not a real provider.

### Safety evidence

| Limit | Evidence in code/tests | Result |
| --- | --- | --- |
| Server-added disclaimer | `server/routes/assistant.js`; fake-provider API tests assert disclaimer is present. | Tested with fake provider. |
| Red-flag rules run before model | `server/assistant/rules.js`; unit and API red-flag tests. | Tested with fake provider. |
| Model cannot lower emergency urgency | `server/assistant/safety.js`; API test checks emergency remains emergency. | Tested with fake provider. |
| Structured output validated | `server/assistant/safety.js`; unit test parses valid and fenced JSON. | Tested with fake provider. |
| No prescription, definitive diagnosis, or cure promise | safety response filtering and fake-provider API tests. | Tested with fake provider. |
| Clinician review | `docs/07-ai-triage.md` says demo rules are not clinically reviewed. | Not done. |

## Browser and asset checks

The installed Chromium browser loaded 24 routes at 390x844, 820x1180, and 1440x900 on the local sample-data server, for 72 route/viewport visits. The sweep got 66 HTTP 200 responses and six 404 responses: the nonexistent `/search/doctors/` route and intentional `/not-a-real-route`, at each viewport. No horizontal document overflow was measured. Protected routes redirected to sign-in without a logged-in user, so the full page-state matrix was not verified by that sweep.

On the connected dev server, two synthetic accounts were created through sign-up and deleted via the account deletion UI. Both reported the robot on `/dashboard/` and no robot on `/sos/`. An aggregate SQL count by synthetic audit email prefix returned zero remaining accounts. No model message was sent.

`vercel.json` keeps `script-src 'self'`. The robot's Three.js modules and model are same-origin, and local response headers carried the same-origin CSP with no observed CSP violation. The model is 390 KB. Vendored Three.js files total about 814 KB (675 KB core, 108 KB loader, 31 KB geometry utilities), so model plus libraries are about 1.2 MB before transfer compression. The 62 MB intro video appears in both sign-in and sign-up UI code; it is not limited to sign-in. Its element requests autoplay, muted, and metadata preload. A local `curl -r 0-1023` request returned HTTP 200 and downloaded the full 64,522,280 bytes, so that server did not provide byte-range streaming. Reduced-motion removes autoplay in the auth page code.

The browser sweep flagged small text/controls with simple DOM heuristics and saw expected 401 console errors on protected routes without authentication. It did not run axe, keyboard-only flows, 200 percent zoom, external-link HEAD checks, upload/review/reminder journeys, WebGL-disabled behavior, drag/resize, double-tap/A-key opening, actual byte accounting, or Lighthouse. These remain follow-up work.

## Checks run

| Check | Target | Result |
| --- | --- | --- |
| `pnpm check` | Local checkout | Passed. `public/ check passed`. |
| `NODE_ENV=test pnpm test` | Local fake/test environment | Passed: 137 tests, 67 unit and 70 API. No real provider calls. |
| Browser route sweep | Local sample server, three viewport sizes | 72 visits; 66 HTTP 200, six expected 404s as described above. No horizontal overflow measured. |
| Sign-up and delete | Local server connected to `careroute-dev`, synthetic accounts only | Two accounts created and deleted through UI. Aggregate remaining count: 0. |
| Health endpoint | Local dev server connected to `careroute-dev`, `GET /api/v1/health` | HTTP 200, status `ok`. |
| Unauthenticated assistant route | Local dev server, empty triage payload | HTTP 401, `unauthorized`. |

The local app without `DATABASE_URL` ran in memory/sample mode on port 4002. A separate dev server was already listening on port 4000, so the connected dev server ran on port 4001. No process was stopped except the servers started for this check.

## Provider terms for the owner

These are informational summaries of official pages, not legal advice.

| Provider | Retention, training/review, location, controls |
| --- | --- |
| Groq | The official [Your Data page](https://console.groq.com/docs/your-data) says API inputs and outputs are not used to train models by default. Reliability and abuse monitoring may retain prompts and completions for up to 30 days by default. Zero Data Retention is available through account Data Controls. The page says retained data is stored in GCP buckets in the US; it does not establish the location of inference processing. See also the [Services Agreement](https://console.groq.com/docs/legal/services-agreement). |
| OpenRouter | Its [Privacy Policy](https://openrouter.ai/privacy/) says OpenRouter does not train on user prompts and that prompt/completion logging is opt-in at OpenRouter. Routed model providers may use different retention, training, review and geography policies. OpenRouter documents [provider data collection and ZDR](https://openrouter.ai/docs/features/provider-routing); provider eligibility and settings need review for each model endpoint. |

No live request was sent to either provider. Because account controls and the precise route are not verified, do not treat consent text as proof that free-plan document handling meets the owner's intended privacy standard. Record the owner's real-document decision after provider settings and privacy review.

## Owner-run storage orphan query

Do not run this query through the agent. In the Supabase SQL Editor for `careroute-prod`, the owner can run it to return the object's creation time, byte size, and whether its first path segment matches a user id. It deliberately returns neither object name nor user id. If it returns more or fewer than one row, stop and inspect privately in the dashboard.

```sql
select
  o.created_at,
  coalesce((o.metadata ->> 'size')::bigint, 0) as size_bytes,
  exists (
    select 1
    from public.users u
    where u.id::text = split_part(o.name, '/', 1)
  ) as owner_id_prefix_exists
from storage.objects o
left join public.patient_files f on f.storage_path = o.name
where o.bucket_id = 'patient-documents'
  and f.id is null
order by o.created_at desc;
```

## Rollback and next owner actions

1. Do not push the current commits until environment names and targets, production migration order, and the clinician/privacy release gates are reviewed.
2. If a push is later approved and a deployment is unhealthy, open Vercel's `careroute` project, select the previous known-good production deployment, and use the dashboard's rollback/redeploy action. Verify its deployment SHA and `/api/v1/health` after it is ready.
3. Database migrations are forward-only. Do not drop assistant tables or columns as a code rollback. If the production migration is approved and applied, keep it and use a corrective forward migration only after review.
4. Owner should review dashboard items listed in the decision workflow: plan/backups, Auth sign-ups, exposed schemas, SSL and network restrictions, the orphan query result, and the Vercel environment names/targets.
5. Before real use, obtain clinician review of red-flag rules and legal/privacy review of provider handling, document retention, and Q-10.

## Evidence files

- Browser results and screenshots: [`browser-pass/`](./browser-pass/)
- Updated database and migration evidence: [`PROD_VERIFY_2026-11-04.md`](./PROD_VERIFY_2026-11-04.md)
- Decision and audit reconciliation: [`AUDIT_DELTA_2026-11-04.md`](./AUDIT_DELTA_2026-11-04.md)
