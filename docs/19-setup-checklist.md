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
| 1 | GitHub | Code and CI | Done. Repository `Laxmansirvi05/Hospital_Managment_System`, public. All work is on `main`. |
| 2 | Supabase | Database, Storage, Realtime | Projects done. `careroute-dev` (ref `jelepdfgdxbkbmocrnnx`) and `careroute-prod` (ref `qbiltbhqtesdidjxpscf`), both in `ap-south-1`, free plan, new account. Both have all 6 migrations; dev also has the seed data, prod has none. `.env.local` and Vercel Preview point at dev; Vercel Production points at prod. Account is at the 2 project free limit. |
| 3 | Vercel | Hosting | Project `careroute` created on the Hobby plan, linked to the GitHub repository, function region `bom1` Mumbai (PROPOSED, next to Supabase `ap-south-1`). Vercel Authentication protects deployments. GitHub link confirmed by the first deploy. Preview and Production environment variables set and checked on 2026-10-25. |
| 4 | MapTiler | Map tiles | To do |
| 5 | Mapbox | Road ETA and matrix | To do |
| 6 | Google AI Studio (Gemini) | Triage, first choice | To do |
| 7 | Groq | Triage, second choice | To do |
| 8 | OpenRouter | Triage, third choice | To do |
| 9 | Twilio | SMS | To do |
| 10 | Listing and medicine price data | Discovery | Hospitals, pharmacies and diagnostic centres from OpenStreetMap (D-50) and doctors from CARE Hospitals' website (D-52): loaded on 2026-10-25, see "Real listing data" below. Medicine prices (D-53): waiting for the owner's data.gov.in API key. Scheduled refresh waits for Q-28. |
| 11 | Assistant external sources | AI assistant | Not chosen (Q-26). Nothing to create until the owner decides. |

## To connect the app to careroute-dev (next step for the owner)

The schema and sample listings are already on `careroute-dev`. The app runs on sample data until these are in `.env.local` (copy `.env.example`):

1. `DATABASE_URL`: Supabase dashboard, careroute-dev, Connect, "Transaction pooler" connection string, with the database password.
2. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Project Settings, API. Server only.
3. `JWT_SECRET` and `TRACKING_TOKEN_PEPPER`: run `openssl rand -base64 48` twice.
4. `ALLOW_PRIVILEGED_SIGNUP=true` only locally.

Then run `pnpm dev`. When the "Sample data mode" banner is gone, the app is using the database.

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
- Each variable is a separate entry per environment. To give Production its own value, add a new entry with only Production ticked. Editing the environment ticks of an existing entry moves its value, it does not copy it.
- Preview uses careroute-dev. Production uses careroute-prod.
- Every `DATABASE_URL` (`.env.local`, Preview, Production) logs in as the `careroute_api` role, not `postgres` (D-49, see below).

#### Database role `careroute_api` (D-49, LOCKED)

Created on careroute-prod and careroute-dev on 2026-10-25, first because the prod `postgres` password was not available, then on dev so both behave the same. The owner allowed the SQL tool for this.

- Login, `BYPASSRLS` (the API is the only reader and every table has RLS with no policies), `NOINHERIT`. No superuser, no `CREATEROLE`, owns nothing, cannot change the schema.
- Grants: `USAGE` on schemas `public` and `extensions`; `SELECT, INSERT, UPDATE, DELETE` on all tables in `public`; sequences; `EXECUTE` on `public.hit_rate_limit`. Default privileges give it the same on tables and sequences that `postgres` creates later, so new migrations need no extra grant unless they add a function the API calls.
- Connection: transaction pooler, host `aws-0-ap-south-1.pooler.supabase.com`, port 6543. User `careroute_api.qbiltbhqtesdidjxpscf` on prod, `careroute_api.jelepdfgdxbkbmocrnnx` on dev.
- Each password was generated locally; only its SCRAM-SHA-256 hash was sent to the database. The prod password exists only in Vercel Production `DATABASE_URL`. The dev password exists only in `.env.local` and Vercel Preview `DATABASE_URL`. The dev `postgres` login is kept as a comment in `.env.local` (`DATABASE_URL_OWNER`) for manual admin work; the app does not read it. To rotate: `alter role careroute_api password '<new SCRAM hash>'`, then replace the Vercel value.
- Migrations still run as `postgres` through the Supabase tools.
- Checked on dev: a `create table` as `careroute_api` is refused (42501).

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

## Research findings (checked 2026-10-17)

Where a finding came only from secondary sources, it says so. Details by service are in `16-deployment-and-environments.md` section 3.

| Item | Finding |
| --- | --- |
| pg_cron on Supabase | Verified by running it on `careroute-dev`. A 30 second schedule works. |
| Mapbox | No clause found limiting use with another map provider. Product Terms still unread. Matrix API allows 25 coordinates and 60 requests a minute. |
| MapTiler | Free plan is non-commercial. Fine for the demo, paid for launch (Q-20). |
| Gemini | Free and AI Studio usage may be used and human-reviewed by Google. The demo must use synthetic symptom text only (Q-17). |
| Groq, OpenRouter | Secondary sources only. Read their own policies before WP-6. |
| Twilio India | Domestic route needs DLT registration, international does not. Trial delivery to Indian numbers unconfirmed. Test one number. |

## Platform data research for Q-28 (checked 2026-10-24)

Research only. Q-28 is still OPEN and nothing here decides it. Clauses are paraphrased, not legal advice. Have a qualified professional read the terms before any collection starts.

### robots.txt

Fetched directly on 2026-10-24.

| Site | What it allows and blocks for general crawlers |
| --- | --- |
| `apollopharmacy.in` | Allows `/` in general. Blocks `/search/`, `/medicine/search-medicines/`, cart, payment, account, health records, orders, `/appointments/?*`. Publishes a sitemap. |
| `apollo247.com` | Allows `/` in general. Blocks `/doctor-details/`, `/search/`, account, payments, health records, appointments, some tracking query strings. Fully blocks a long list of named bots (137 user-agent entries), including `Python-urllib`. Publishes a sitemap. |
| `medplusmart.com` | Blocks only `/cgi-bin/`, `/tmp/`, `/junk/`, `/new_theme/` (and all of the Sogou bot). Publishes a sitemap. |
| `1mg.com` | Allows `/` in general. Blocks `/search`, cart, checkout, `/drugs-usage`, `/drugs-ailments`, `/vendor-details`, `/community` and others. Publishes sitemaps for products, labs, doctors and retail. |

robots.txt says what crawlers may fetch. It does not grant a licence to reuse the content. The terms below decide that.

### Terms of use

| Platform | Document read | What it says about automated access, copying and reuse |
| --- | --- | --- |
| Tata 1mg | `1mg.com/TnC`, "last updated June 2021", Tata 1MG Healthcare Solutions Private Limited | Explicitly prohibits using spiders, robots or similar tools to navigate or search the website, copying or duplicating any 1mg content or information, and framing, hotlinking or **deeplinking** any 1mg content. Use is personal and not commercial. |
| Apollo 24\|7 | `apollo247.com/terms`, no date, Apollo Healthco Limited | No clause names scraping or crawling. Prohibits reproducing or modifying content, any commercial use of platform information, and exploiting the platform without written permission. Apollo Pharmacy products and prices are run by a separate company (Apollo Pharmacies Limited). |
| Apollo Pharmacy | `apollopharmacy.in/landing-page/terms-noBg.htm`, no year, Apollo Pharmacies Limited | No clause names scraping or crawling. Prohibits reproducing, distributing or commercially using platform information, and copying material without written authorization. Use is personal and not commercial. |
| MedPlus | `medplusmart.com/termsandconditions`, no date, MedPlus Health Services Pvt Ltd and Optival Health Solutions Pvt Ltd | No clause names scraping or crawling. States that site content (text, images, software) may not be used, reproduced or distributed without written authorization from MedPlus Mart. |

Observed behaviour: `medplusmart.com` returned "Access Denied" (HTTP 403 from its CDN) to plain command-line requests for every page except `robots.txt`. It loaded normally in a browser. The site actively blocks non-browser clients.

### Official APIs and partner programs

| Platform | Found | Not found |
| --- | --- | --- |
| Tata 1mg | A seller onboarding program (`partners.1mg.com`, contact `partners@1mg.com`) for brands and pharmacies to list and sell on 1mg. A "Strategic Partners" track on `1mg.com/partnerships` that names "API Integration" and "SSO Integration" for ePharmacy and eDiagnostics ordering, aimed at insurers and similar businesses. Developer docs titled "API Integration with TATA 1mg" exist on `onedoc.1mg.com` but returned HTTP 503 on 2026-10-24, so their contents and access terms are unverified. An affiliate scheme is described only by third-party affiliate networks, one of which marked its campaign "paused". It gives tracking links, not a data feed. | No public API for reading the catalogue or prices. |
| Apollo 24\|7 and Apollo Pharmacy | Nothing official. | No public API, developer portal, affiliate program or data partner program. |
| MedPlus | Nothing official. | No public API, developer portal, affiliate program or data partner program. |

Third-party scraping services and open-source scrapers for Apollo Pharmacy and 1mg exist (Apify actors, GitHub projects, commercial "data API" sellers). Their existence says nothing about whether their use is allowed. One GitHub scraper works by copying a login token from browser developer tools into Apollo's internal GraphQL API, which would breach the "no circumventing" clauses above.

### What this means for Q-28 (findings, not a decision)

1. All four sets of terms forbid reproducing or commercially reusing site content without written permission. 1mg's terms also name robots and spiders directly. Automated collection from these sites without written permission would conflict with their published terms.
2. 1mg's terms also forbid deep linking. Linking a medicine row straight to a 1mg product page (F-44) may conflict with that clause, even with no collection at all.
3. The only official routes found are business relationships: 1mg's partnerships and API integration (by agreement), and possibly 1mg's affiliate scheme through a network (links only). Nothing equivalent was found for Apollo or MedPlus. Asking each company for written permission or a data agreement is the route their terms leave open.
4. MedPlus's bot blocking means any automated collection from it would also be working against an active technical control.

## Real listing data (collected 2026-10-25)

Run by hand until Q-28 decides where a scheduled job runs. Commands are in `CLAUDE.md`.

| Source | What | Rules followed | Result |
| --- | --- | --- | --- |
| OpenStreetMap, Overpass API | Hospitals, pharmacies, diagnostic centres inside the Hyderabad administrative area | One request per run, honest user agent. ODbL credit shown on every listing and search page (D-50). | 970 hospitals, 222 pharmacies, 29 diagnostic centres, in 126 suburb areas. About a third of hospitals and almost no pharmacies have a phone (D-51). |
| CARE Hospitals website | Hyderabad doctor pages from CARE's own `doctors-sitemap.xml` | robots.txt checked before fetching; English pages only (language copies are disallowed); one request every 3 seconds; only the D-54 fields kept. | 331 pages allowed; 329 had doctor details; 297 doctors loaded at four CARE branches (Banjara Hills 144, HITEC City 83, Nampally 50, Musheerabad 20). Doctors at CARE Malakpet (32) are not shown: OpenStreetMap has no CARE Malakpet hospital to attach them to, and guessing by distance put them at the wrong branch. |
| KIMS Hospitals | Doctors, Hyderabad branches | Its own JSON API (`/api/doctors`, `/api/branches`, `/api/specialities`); robots.txt is `Allow: /*`. | Kompally branch not placed (no OSM building). |
| Rainbow, Continental, Gleneagles, Ankura, Citizens, L V Prasad | Doctors | Each site's own sitemap; robots.txt checked per request; 3 s between requests to a host. | L V Prasad: Hyderabad campus doctors only, no emails. |
| Jan Aushadhi (PMBJP) | Generic medicines and MRP | The public Product and MRP list, fetched the way the page fetches it (guest token, one request). | 2,096 priced products. |
| Vijaya Diagnostic | Centres and Hyderabad test prices | Centre pages' embedded centre list and test pages' schema.org Offer. Google review text in the pages is not kept. | |
| Apollo Hospitals, Medicover | Not used | 403 to automated clients (checked 2026-10-25). | |
| Yashoda Hospitals | Not used | robots.txt disallows `/doctors/` (checked 2026-10-25). | |
| Apollo Hospitals | Not used | Returns 403 to automated clients, even for robots.txt (checked 2026-10-25). P-29 forbids getting around that. | |
| NPPA | Not yet | Did not answer from here; also on data.gov.in, which needs the owner's free API key (D-53). | |

Known data quality limits, all from the source:

- OpenStreetMap tags some dental clinics, labs and eye clinics as hospitals. They appear in hospital search.
- Whether a hospital has an emergency department is usually not tagged. CareRoute shows "Emergency department not listed", never "No emergency department", unless the source says no.
- Specialities are free text in the source. The speciality filter matches part of a name, ignoring case.

## Done means

Every row in the status table says Done, every variable in `16-deployment-and-environments.md` section 2 exists in `.env.local` and in Vercel for the right environments, and the unverified items above are checked and recorded.
