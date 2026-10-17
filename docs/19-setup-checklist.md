# Accounts and keys setup

Everything that must exist before building restarts. Each row says what to create, which variable it fills, and how to restrict it. Rules for every key are in `09-security.md` section 3.

## How keys move (read first)

1. You create each key in the provider's own dashboard while signed in as yourself.
2. You paste it in two places only:
   - your local `.env.local` file (git-ignored, never committed), and
   - Vercel, Project Settings, Environment Variables, marked Sensitive, per environment.
3. Never paste a key into chat, an issue, a commit, a screenshot or a doc. Claude never needs to see a key value. Claude can check that a variable is set by name only.
4. Use different keys for development (local and preview) and production. Preview deployments never get production keys.
5. If a key is ever exposed, rotate it at the provider first. Steps in `09-security.md` section 3.3.

## Status

| # | Service | Needed for | Status |
| --- | --- | --- | --- |
| 1 | GitHub | Code and CI | Done. Repository `Laxmansirvi05/Hospital_Managment_System`, public, `main` is docs only. |
| 2 | Supabase | Database, Storage, Realtime | Projects done. `careroute-dev` (ref `jelepdfgdxbkbmocrnnx`) and `careroute-prod` (ref `qbiltbhqtesdidjxpscf`), both in `ap-south-1`, free plan, new account. Keys and database passwords still to be copied by the owner into `.env.local` and Vercel. Account is at the 2 project free limit. |
| 3 | Vercel | Hosting | Project `careroute` created on the Hobby plan, linked to the GitHub repository, function region `bom1` Mumbai (PROPOSED, next to Supabase `ap-south-1`). Vercel Authentication protects deployments. GitHub link confirmed by the first deploy. No environment variables yet. |
| 4 | MapTiler | Map tiles | To do |
| 5 | Mapbox | Road ETA and matrix | To do |
| 6 | Google AI Studio (Gemini) | Triage, first choice | To do |
| 7 | Groq | Triage, second choice | To do |
| 8 | OpenRouter | Triage, third choice | To do |
| 9 | Twilio | SMS | To do |

## Per service

### 2. Supabase (D-10, D-18)

- Create two projects: `careroute-dev` and `careroute-prod`, region `ap-south-1` (Mumbai), on the free plan.
- Save each project's database password in a password manager when Supabase shows it. It is shown once.
- Variables, per project: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, bypasses Row Level Security), `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (public by design).
- Free projects pause after about a week of low activity. Plan in `16-deployment-and-environments.md` section 6.
- Checked on `careroute-dev`: PostGIS 3.3.7 and pg_cron 1.6.4 are available to install. Not yet checked: that pg_cron accepts a schedule shorter than a minute, and the Row Level Security event trigger from the earlier foundation work. Check before the first remote migration.
- Project URLs: dev `https://jelepdfgdxbkbmocrnnx.supabase.co`, prod `https://qbiltbhqtesdidjxpscf.supabase.co`. It is public information, not a secret. Keys and the database password are not recorded anywhere in this repository.

### 3. Vercel (D-10)

- One project linked to the GitHub repository, production branch `main`.
- Environment variables are added per environment (Development, Preview, Production) as the other services are set up.
- `ALLOW_PRIVILEGED_SIGNUP=true` only in Development and Preview. Never in Production (D-21).

### 4. MapTiler (D-08)

- Create an account and an API key for development and a separate one for production.
- Restrict each key to the allowed origins (localhost for development, the Vercel domain for production) in the MapTiler dashboard. This key is visible in the browser by design, so the origin restriction is the protection.
- Variable: `PUBLIC_MAPTILER_KEY`.
- Check the free plan's terms and monthly quota and record them in `16-deployment-and-environments.md` section 3.

### 5. Mapbox (D-09)

- Create an account and a token used only by the server for Directions and Matrix.
- Give the token only the scopes those two APIs need.
- Variable: `MAPBOX_SECRET_TOKEN`.
- Before building WP-5, read Mapbox's terms on using its routing results with a map from another provider (MapTiler). Record the answer in `00-decisions.md`.

### 6 to 8. Triage models (D-07)

| Provider | Variable | Check before WP-6 |
| --- | --- | --- |
| Google AI Studio, Gemini API | `GEMINI_API_KEY` | Whether the plan in use may train on submitted text (Q-17), rate limits |
| Groq | `GROQ_API_KEY` | Same |
| OpenRouter | `OPENROUTER_API_KEY` | Same, plus which models are allowed |

All three are server only. Symptom text is the only health data they ever receive (`07-ai-triage.md` section 4).

### 9. Twilio (D-13)

- Trial account. Verify the few test phone numbers the demo will text (the trial sends only to verified numbers, up to 5).
- Prefer an API key pair over the account auth token.
- Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_FROM_NUMBER`.
- Not yet verified: whether the trial can deliver to Indian numbers and whether DLT registration applies. Check in the Twilio console before WP-5.

### Generated by us, not by a provider

| Variable | How |
| --- | --- |
| `JWT_SECRET`, `TRACKING_TOKEN_PEPPER` | At least 32 random characters each, different per environment. Generate locally, for example with `openssl rand -base64 48`, and paste straight into `.env.local` and Vercel. |

## Done means

Every row in the status table says Done, every variable in `16-deployment-and-environments.md` section 2 exists in `.env.local` and in Vercel for the right environments, and the unverified items above are checked and recorded.
