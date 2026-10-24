# Security

Security is a locked requirement (D-14). The security agent in `.claude/agents/security-agent.md` reviews every change against this document. Root `SECURITY.md` covers how outsiders report problems.

## 1. What we protect

| Asset | Why it matters |
| --- | --- |
| Medical ID, reports, notes | Health data. Highest sensitivity. |
| Patient and ambulance locations | Safety. Can be used to stalk. |
| Phone numbers and emails | Personal data, also used for SMS. |
| Tokens (JWT, tracking tokens) | Anyone holding one acts as that user or sees that case. |
| Third-party API keys | Abuse costs money and can break the product. |
| The dispatch process itself | False or blocked requests cost lives or trips. |
| Listing data | Users call these phone numbers and visit these links in a health need. A tampered number or link can send them to the wrong place or to a scam. |
| Admin accounts | An admin can disable users and change every listing. |

## 2. Threats and controls

| Threat | Control | Test |
| --- | --- | --- |
| Anyone registers as driver or admin | Only `patient` self-registers in production (D-21). `driver` and `admin` accounts are created by the server-side script. | Register with each privileged role without the flag, expect 403 |
| Reading or changing another user's data (IDOR) | Ownership check on every read and write, section 5 | IDOR matrix test, one case per resource |
| Admin account taken over | Admin accounts created only by script, admin actions written to `admin_audit`, admin sessions short (PROPOSED). A second factor for admins is OPEN. | Audit row test, role test |
| Tampered or malicious listing link | Admin input validated with Zod, links limited to `https` and `http`, phone numbers normalized, outbound links open with `rel="noopener noreferrer"`, every edit audited | Link validation test, XSS payload test |
| Guess or leak of a tracking token | 128 bits or more of randomness, stored hashed, lifetime limit, never logged | Token entropy test, log redaction test |
| Token leaks through URL (it is a query parameter in the collection) | `Referrer-Policy: no-referrer` on the tracking page, strip `token` from all logs and error reports, tracking page loads no third-party scripts | Header test, log test |
| Fake or flood SOS from the guest endpoint | Rate limit by IP and by phone, phone format check, admin visibility (P-18), optional OTP later | Rate limit test |
| SMS pumping: attacker triggers many SMS | Cap SMS per emergency and per account, only send to saved contacts, cap per day | Limit test |
| Brute force login | Rate limit per account and per IP, argon2id, same message for wrong email and wrong password | Login test |
| User enumeration | Register returns 409 as the collection requires, so rate limit it and do not add other signals | Rate limit test |
| Stored XSS through `notes`, names, report titles, doctor names | Data written with `textContent` or cloned templates, never `innerHTML` with data, CSP with no inline script | XSS payload test per text field |
| SQL injection | Parameterized queries only, no string-built SQL | Lint rule and review |
| GPS spoofing or ping flood | Only the ambulance's own driver may ping, rate limit per ambulance, sanity check speed and jump distance | Ping test |
| Prompt injection in triage or the discovery assistant | Model has no tools or data access, output schema validated, safety floor from rules, discovery results come only from our database | Injection test set |
| Prompt injection inside an uploaded report | Report text is untrusted, the explanation schema has no treatment or diagnosis field, D-33 limits checked on the output | Injection report test |
| Malicious file upload | Type and size checks, byte sniffing, private bucket, forced safe download headers, no server-side rendering of files | Upload test |
| Secret in a public file | Secrets only under `server/` and in environment variables, public values only through the allow-listed `/api/v1/config` response, CI scan of `public/` and of the config response | Public file scan |
| Secret in git | Secret scanning before commit and in CI | Scanner |
| Supabase public key misuse | RLS on every table with no `anon` or `authenticated` policy, storage buckets private | RLS test as `anon` |
| Dependency compromise | Lockfile, audit in CI, few dependencies, no install scripts from unknown packages | Audit |
| Replay of accept (two drivers) | Conditional update in the database | Concurrency test |
| Insider reads medical data | Access logged, least privilege. The admin user list shows account fields only, never medical ID, reports or emergency notes (P-22). | Admin response field test |
| Collecting listing data breaks a platform's terms | Read and record each platform's terms and robots.txt before collecting from it (Q-28). Identify the collector honestly, keep request rates low, no logging in to platforms, no bypassing of bot checks. | Review per platform |
| Collected content is hostile or wrong | Every collected field is untrusted input: parsed with Zod, length limited, URLs restricted to `https` and `http`, stored as text and rendered with `textContent`. Large price or phone changes held for admin review (PROPOSED). | XSS payload test on collected fields |

## 3. Secrets and key handling

This is the section the owner flagged. Treat it as the highest-priority rule set.

### 3.1 Key inventory

| Variable | Used by | Allowed in browser | Notes |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Server and browser | Yes, public | Not a secret |
| `PUBLIC_SUPABASE_URL` | Browser, via `/api/v1/config` | Yes | Same value as `SUPABASE_URL`, exposed on purpose |
| `PUBLIC_SUPABASE_ANON_KEY` | Browser (Realtime), via `/api/v1/config` | Yes, by design | Safe only because every table has RLS with no `anon` policy. Never treat it as a secret and never rely on it for access control. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | No | Bypasses RLS. Highest risk key. |
| `DATABASE_URL` | Server only | No | Direct connection string |
| `JWT_SECRET` | Server only | No | Signs login tokens |
| `GEMINI_API_KEY` | Server only | No | |
| `GROQ_API_KEY` | Server only | No | |
| `OPENROUTER_API_KEY` | Server only | No | |
| `MAPBOX_SECRET_TOKEN` | Server only | No | Give it only the scopes needed for directions and matrix |
| `PUBLIC_MAPTILER_KEY` | Browser, via `/api/v1/config` | Yes, unavoidable | Tile requests need it in the page. Restrict the key to our allowed origins in the MapTiler dashboard and use a separate key per environment. |
| `TWILIO_ACCOUNT_SID` | Server only | No | |
| `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` | Server only | No | Use an API key pair rather than the account auth token (PROPOSED) |
| `TWILIO_FROM_NUMBER` | Server only | No | |
| `TRACKING_TOKEN_PEPPER` | Server only | No | Pepper for hashing refresh tokens now, tracking tokens later |
| `ALLOW_PRIVILEGED_SIGNUP` | Server only | No | Not a secret. `true` lets non-patient roles self-register. Never set in production (D-21). |

Only variables starting with `PUBLIC_` are returned to the browser, and only by `GET /api/v1/config`, which returns a fixed list of names and nothing else. The allow-list above is the complete list. Adding a new `PUBLIC_` variable needs a security review.

### 3.2 Rules

1. Secrets exist only in Vercel environment variables (marked sensitive) and in each developer's untracked `.env.local`. Nowhere else: not in code, tests, fixtures, docs, screenshots, logs, issue text or chat.
2. `.env*` is in `.gitignore`. Only `.env.example` with placeholders is committed.
3. Server code lives under `server/`, outside `public/`, so it is never served. A test fails if any file in `public/` references `server/` or a server secret name.
4. `server/config.js` is the only reader of server secrets. It validates with Zod and throws at startup if one is missing or malformed.
5. Third-party calls happen only in server code. The browser never receives a provider URL that contains a key, except the MapTiler key above.
6. CI scans every file in `public/` and the `/api/v1/config` response for the value of every server secret and fails if any appears. It also fails if the config response contains any name not in the allow-list.
7. A secret scanner runs before each commit and in CI.
8. Error responses and logs never include request headers, tokens, keys, connection strings or provider error bodies that echo a key.
9. Separate keys for local, preview and production. Preview deployments never get production keys.
10. Free-tier keys still get this treatment. A leaked free key gets abused and blocks the demo.

### 3.3 If a key leaks

1. Revoke or rotate it at the provider first. Rotation matters more than cleanup.
2. Put the new value in Vercel, redeploy.
3. Check provider usage logs for abuse.
4. Remove the old value from git history if it was committed.
5. Record what happened in `docs/incidents/` using the runbook template in `17-observability-and-runbook.md`.

## 4. Authentication

- Passwords hashed with scrypt (N=2^17, r=8, p=1, the OWASP minimum) from `node:crypto` (D-24). Length 8 to 128 (PROPOSED). A breach-list check is OPEN.
- Access tokens are HS256 JWTs signed with `node:crypto`, valid 15 minutes. The header is compared byte for byte, so `alg: none` and algorithm switching are impossible. Each request also confirms the session is live and reads the role from the database, so logout and role changes apply at once (D-22).
- Refresh tokens rotate on every use and are stored only as peppered hashes. Presenting an already rotated token revokes the session (D-22).
- The browser holds both tokens in httpOnly, SameSite=Lax cookies, Secure over HTTPS. Page scripts cannot read them (D-23).
- CSRF: any write that cookies could authenticate needs the same `Origin` and the `x-careroute-csrf: 1` header. A foreign `Origin` is refused on every write, which also blocks login CSRF. Requests with an `Authorization` header are API clients and skip the header check.
- Privileged roles self-register only when `ALLOW_PRIVILEGED_SIGNUP=true`, which must never be set in production. Production accounts are created by a server-side script run by the owner (D-21).
- Unknown email and wrong password take the same time (a dummy scrypt check) and return the same message.
- Same error text for unknown email and wrong password.
- The role claim is verified server side on every request. A client-supplied role is never trusted.

## 5. Authorization and ownership

| Resource | Who may read | Who may write |
| --- | --- | --- |
| Own user | That user | That user |
| Medical ID | Owner. Crew only if `shareWithCrew` and the crew is assigned to an active case. | Owner |
| Contacts | Owner | Owner |
| Listings: hospitals, doctors, pharmacies, diagnostic centres, medicines | Signed-in users today. Without sign-in is OPEN (Q-27). | Admin |
| Users list | Admin (account fields only) | Admin may disable |
| Ambulance | Its driver, admin (P-18) | Its driver |
| Ambulance location | Its driver, admin (P-18), and parties on its active case | Its driver |
| Emergency | Its patient, its assigned driver, admin for operational fields only (P-18) | Patient: create, cancel, feedback. Driver: accept, reject, advance state. |
| Offers inbox | The driver the offer is for | The driver |
| Tracking view | Holder of the token | Nobody |
| Reports | See `08-medical-reports.md` section 6 | Owner |
| Analytics | Admin (P-18) | Nobody |

A 404 is returned instead of 403 when revealing that a resource exists would itself leak information, for example another patient's emergency id. The collection requires 403 for a patient calling accept, so that case stays 403.

## 6. Input and output

- Every input is validated by a Zod schema. Unknown fields are rejected or stripped, never stored.
- Coordinates are range checked. Phone numbers are normalized and checked. Free text has a length limit.
- Responses are built from explicit field lists. Never return a database row as is.
- The public tracking response has its own type that cannot include medical fields.

## 7. Rate limits and abuse

Counters are stored in Postgres (D-25). Values designed for WP-1, all PROPOSED: register 10 per hour per IP, login 30 per 15 minutes per IP and 10 per 15 minutes per account, refresh 60 per 15 minutes per session. Values for other surfaces are set when they are built.

| Surface | Limit by |
| --- | --- |
| Login and register | IP and account |
| Guest SOS | IP and phone |
| SOS, authenticated | Account |
| Triage, discovery assistant, report explanation | Account and IP, also protects model quotas |
| Discovery search | IP |
| Driver pings | Ambulance |
| SMS | Emergency, account, day |
| Tracking endpoint | Token and IP |
| File upload URLs | Account |

## 8. Data protection

- Row Level Security on every table, no policy for `anon` or `authenticated`.
- Storage buckets private. Downloads by signed URL that expires in minutes.
- TLS everywhere. Supabase and Vercel provide it. Do not disable certificate checks anywhere.
- Passwords, tokens and tracking tokens are never stored in plain form (tracking tokens stored as hashes).
- Medical data fields are never written to logs, analytics, error trackers or model prompts unless this document is changed.
- Backups and retention: OPEN (Q-10).

## 9. Browser protections

| Header or setting | Value |
| --- | --- |
| `Content-Security-Policy` | Default to own origin. Allow only the Supabase project (https and wss) and the MapTiler tile origin. No inline scripts and no inline event handlers. Headers are set in `vercel.json`. Confirm exact origins in WP-0. |
| `Strict-Transport-Security` | Enabled |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` site wide, `no-referrer` on the tracking page |
| `Permissions-Policy` | Geolocation allowed for self only. Camera, microphone and others disabled. |
| `frame-ancestors` | `none` |
| Cookies, if used | `HttpOnly`, `Secure`, `SameSite=Lax` or stricter |

## 10. Supply chain and build

- Commit the lockfile. Install with a frozen lockfile in CI.
- Run a dependency audit in CI and fail on high severity findings in production dependencies.
- Prefer a small number of well-known dependencies. Each new dependency needs a one-line reason in the pull request.
- No `curl | sh` in scripts. No postinstall scripts from packages we do not trust.
- Actions and tools in CI are pinned to exact versions.
- Browser libraries are copied into `public/vendor/` at an exact version with the source and version noted beside the file. No script or style is loaded from a CDN at runtime. Updating one is a reviewed change.

## 11. Logging and incidents

- Structured logs with a request id. Redaction by key name for: `password`, `token`, `authorization`, `phone`, `email`, `lat`, `lng`, `address`, `medical*`, `notes`, `key`, `secret`.
- Security-relevant events are logged: failed logins, role denials, rate limit hits, report access, token validation failures.
- Incident steps are in `17-observability-and-runbook.md`.

## 12. Pre-merge security checklist

Every pull request answers these. The security agent checks them.

1. Does any new route have tests for 401, 403 and the happy path?
2. Is ownership checked, not only role?
3. Is all input validated with Zod, and are responses built from explicit fields?
4. Is any new environment variable named correctly, listed in section 3.1, and read only through `config.ts`?
5. Does any file in `public/` reference server code, a server secret name or a provider key?
6. Does the change log, return or store any field that is personal or medical?
7. Does the change call a third party, and does it go through an adapter with a timeout and fallback?
8. Does the change add a dependency? Why?
9. Does the change touch auth, tokens, uploads, SMS or the public tracking page? If so, was a security review run?
10. Do the CI secret scan and the `public/` file scan pass?

## 13. Security tests that must exist before the demo

Role matrix for every route, IDOR matrix, RLS as `anon`, token entropy, log redaction, rate limits, XSS payloads in each free text field and each admin listing field, outbound link validation, upload abuse, prompt injection set (including inside a report), concurrency on accept, public file secret scan.
