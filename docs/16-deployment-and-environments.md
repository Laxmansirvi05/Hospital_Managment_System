# Deployment and environments

Hosting is Vercel plus Supabase only (D-10). No separate server.

## 1. Environments

| Environment | Web and API | Database | Keys |
| --- | --- | --- | --- |
| Local | Local dev server on port 4000 serving `public/` and the API function (to be rebuilt when building starts) | Supabase CLI local stack in Docker (colima). Optional once the cloud development project exists. | `.env.local`, untracked |
| Preview | Vercel preview deployment per branch | Supabase development project (D-18) | Vercel preview variables, never production keys |
| Production | Vercel production | Supabase production project (D-18) | Vercel production variables, marked sensitive |

Two Supabase projects are used: development and previews, and production (D-18).

## 2. Environment variables

The authoritative list and browser exposure rules are in `09-security.md` section 3.1. Summary by scope:

| Scope | Variables |
| --- | --- |
| Browser (public by design, returned only by `/api/v1/config`) | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_MAPTILER_KEY` |
| Server only | `ALLOW_PRIVILEGED_SIGNUP` (`true` in local and preview only, unset in production), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, `TRACKING_TOKEN_PEPPER`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MAPBOX_SECRET_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_FROM_NUMBER` |

Rules:

1. A `.env.example` with placeholders and one-line comments is committed in WP-0. Nothing else with `.env` in its name is.
2. Server variables are set in Vercel as sensitive, per environment.
3. A new variable is added to `09-security.md`, `.env.example`, `server/config.js` and this file in the same change.

## 3. Third-party limits that shape the demo

Facts below were checked while writing these documents. Anything not listed here is unknown and must be checked before relying on it.

| Service | Known limit or condition | Effect |
| --- | --- | --- |
| Vercel Hobby | Cron jobs run at most once per day with hourly precision | No sub-minute scheduled work on Vercel. Offer expiry runs in the database. |
| Vercel | WebSocket support is in public beta, Socket.IO works only with the WebSocket transport forced | Reason Supabase Realtime is used instead of Socket.IO |
| Supabase Free | Projects with low activity for about a week are paused. The free plan allows 2 active projects per account. | See section 6 |
| Twilio trial | Sends only to verified numbers, up to 5 recipients. Twilio's India page says the international route needs no DLT registration, while the domestic route needs company and sender ID registration on the operators' DLT portal. The page does not mention trial accounts, so delivery to Indian numbers on a trial is still unconfirmed. | Demo contacts are limited to verified numbers. Test one Indian number early. |
| Mapbox | Matrix API: at most 25 input coordinates and 60 requests per minute (Mapbox documentation). The Terms of Service page has no clause restricting use with another provider's map, and requires telling end users when Directions is used in an app. The separate Product Terms were not read. | Pre-filter with PostGIS to 25 candidates or fewer. Show the Directions disclosure. Read the Product Terms before WP-5. |
| MapTiler free tier | 100,000 API requests and 5,000 sessions per month. Free plan is non-commercial use and research and development only. Going over can suspend the account. The commercial plan starts at 25 US dollars a month. | Fine for a demo. A commercial launch needs a paid plan, which is a cost decision for the owner (Q-20). |
| Gemini API | Google's terms for unpaid services allow using inputs and outputs to improve its products, with human review. Paid usage is excluded. AI Studio counts as unpaid even with billing set up. | Demo uses synthetic symptom text only. Real use needs paid usage. See Q-17. |
| Groq | Secondary sources say no training on API data and no default retention, with up to 30 days of reliability logs. Not confirmed from Groq's own pages. | Read Groq's data policy before WP-6 |
| OpenRouter | Some free models run on hosts whose terms allow training. A data collection setting set to deny excludes them. Secondary sources. | Send the deny setting on every request, confirm in OpenRouter's docs before WP-6 |
| pg_cron | Verified on `careroute-dev`: a 30 second schedule is accepted and ran twice, 30 seconds apart, both succeeded. | Offer expiry design stands (D-12). The extension is now installed on dev with no jobs. |
| Supabase Free | Storage size, database size and Realtime connection and message limits not yet verified | Check before WP-5 and WP-9 |
| Vercel | Function duration and invocation limits for the plan in use not yet verified | Check before WP-5 |
| Vercel Hobby | Sources disagree on how many functions one deployment may hold (one reports 12, another says it depends on the framework) | The API is one function with a router, so this should not matter. Confirm in WP-0. |

Update this table whenever a limit is confirmed.

## 4. Database setup

1. Enable the `postgis` extension. Enable `pg_cron`.
2. Apply migrations from `supabase/migrations` in order. They are forward-only. A mistake is fixed by a new migration.
3. Enable Row Level Security on every table. Add no policy for `anon` or `authenticated`.
4. Create storage buckets as private.
5. Create the pg_cron job for `expire_offers()`. Confirm the minimum supported interval on the installed version first.
6. Seed data is loaded only in local and preview environments.

## 5. Release steps (PROPOSED)

1. Merge to `main` after the checks in `15-workflow.md` pass.
2. Vercel deploys `public/` and the API function. There is no frontend build step. CI runs before the merge and blocks it if the secret scan, the `public/` file scan, lint or tests fail.
3. Apply new migrations to the target Supabase project before or with the deploy, in the order that keeps old and new code both working. Prefer additive migrations.
4. Run the contract suite against the deployed URL.
5. Check `/api/v1/health`.
6. Rollback: use Vercel's instant rollback for code. Database changes are not rolled back by deleting migrations. Write a corrective forward migration.

## 6. Keeping the free Supabase project active

Supabase pauses free projects with low activity. Its documentation says a few database requests each day normally avoids this. The health check queries the database, so:

- PROPOSED: a Vercel cron job calls `/api/v1/health` once a day. This fits the Hobby cron limit.
- A paused project is restored from the Supabase dashboard. See the runbook.
- Before any live demo, confirm the project is active.

## 7. Domains and TLS

Domain name is OPEN (Q-16, Q-18). Vercel provides TLS. HTTP is redirected to HTTPS. Headers from `09-security.md` section 9 are set in `vercel.json`.

## 8. Backups

Free-tier backup and point-in-time recovery options are not verified. Until they are, treat the demo database as rebuildable from migrations and seed data, and never as the only copy of anything.
