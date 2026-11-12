# Observability and runbook

## 1. What we watch

| Signal | Where | Why |
| --- | --- | --- |
| Health | `GET /api/v1/health` | API and database reachable |
| Request logs | Vercel logs, redacted | Errors, latency, rate limit hits |
| Offer and match outcomes | `emergency_events` | Failed matches, time to assign |
| SMS results | `sms_outbox` | Is SMS working |
| Provider errors | Structured log entries from adapters | Which provider failed and which fallback was used |
| Admin analytics (P-18) | Dashboard | Totals, assign time, response time by hour |
| Listing freshness | `checked_at` on listing tables | Listings not checked recently need review (P-24) |
| Admin actions | `admin_audit` | Who changed what |

For the demo, a person looks at these. Alerting systems are not part of the scope (OPEN if wanted later).

## 2. Logging rules

- One structured line per request: request id, method, route pattern (not the full URL with query), status, duration, role, outcome.
- Redaction by key name as listed in `09-security.md` section 11.
- The `token` query parameter of the tracking endpoint is removed before logging.
- Provider failure logs contain the provider name, status and duration, not request bodies.
- Triage logs contain the rule version, provider used and urgency. They do not contain the message.
- Discovery assistant and report explanation logs contain the provider used and the outcome. They never contain the user's text or report content.

## 3. Runbook

Each entry: how you notice, what to do, how to confirm it worked.

### R-01 A secret leaked

- Notice: scanner alert, key in a commit, a provider warning, or unexplained usage.
- Do: revoke or rotate the key at the provider. Update Vercel. Redeploy. Check provider usage for abuse. Remove it from history if committed. Record the incident.
- Confirm: old key rejected, new key works, health check passes, usage returns to normal.

### R-02 Supabase project paused

- Notice: health check fails, database errors on every route.
- Do: restore the project from the Supabase dashboard. Wait for it to become active. Check pg_cron job still exists.
- Confirm: health check passes, a test SOS in preview matches an ambulance.

### R-03 Mapbox unavailable or over quota

- Notice: adapter errors, ETA marked as estimate.
- Do: nothing is required for the flow, ranking falls back to straight-line distance. Check the Mapbox dashboard for quota or key problems.
- Confirm: ETA no longer marked as estimate.

### R-04 Model providers failing

- Notice: triage results carry the rule-only flag in logs.
- Do: check each provider's status page and key. The chain is Gemini, Groq, OpenRouter.
- Confirm: a mild symptom test returns a model-produced suggestion.

### R-05 SMS failing

- Notice: failed rows in `sms_outbox`.
- Do: check the Twilio console. Confirm the recipient is a verified number on the trial. The patient can still share the tracking link by hand.
- Confirm: a test SMS to a verified number arrives.

### R-06 An emergency is stuck

- Notice: an active case stays in `matching` or in a trip state with no updates.
- Do: check offers for the case and the expiry job. Check the ambulance's last ping. Contact the driver. If needed, the admin tells the patient to call the emergency number (P-18).
- Confirm: the case progresses or is closed with an event recording why.

### R-07 SOS flood or prank requests

- Notice: many guest SOS from one phone or address range, the admin view shows a spike.
- Do: tighten the rate limit on the guest endpoint, block the offending phone numbers, mark the cases cancelled with a reason.
- Confirm: new requests from the source are rejected, real requests still work.

### R-08 Suspected personal or health data exposure

- Notice: a report, an unexpected access event, a failed isolation test.
- Do: stop the exposure first (disable the route or the sharing). Preserve logs. Find what was exposed and to whom. Rotate affected keys. Tell the owner immediately. Legal notification duties are checked with a professional.
- Confirm: the exposure path is closed and a test now covers it.

### R-09 A bad deploy

- Notice: errors after a release, failing contract run.
- Do: roll back the code in Vercel. If a migration is involved, write a forward fix.
- Confirm: health check and contract suite pass on the rolled back version.

### R-10 Wrong or tampered listing data

- Notice: a user or the owner reports a wrong phone number, link or price, or `admin_audit` shows an unexpected edit.
- Do: hide the listing. Check `admin_audit` for who changed it and when. If an admin account may be compromised, disable it and follow R-08. Correct the data from the official source and record the new checked date.
- Confirm: the listing shows the corrected data and checked date, and the audit trail explains the change.

### R-11 Someone cannot sign in or forgot their password

- Notice: the person tells the owner, or a request appears under Password resets in the admin portal (there is no email service yet, D-88).
- Do: check who is asking, then issue a one-time link from the admin portal (valid 2 hours, shown once) and hand it over through a channel you trust. If the person cannot be recognised, do not issue it. An account that cannot be recovered through the portal: `node --env-file=.env.local scripts/set-account-password.js --email ...`.
- Confirm: the link was used once, the person signs in, and old sessions are gone.

### R-12 A driver says they cannot go online

- Notice: the driver sees "waiting for approval" or "not approved" on the driver page.
- Do: open Driver requests in the admin portal, check the name, phone and vehicle number against what the driver tells you, then approve or turn down with a short reason. Every decision is in the audit log.
- Confirm: the driver page changes by itself within a few seconds and the driver can go online.

### R-13 Visitors see a "Vercel Security Checkpoint" page, or scripts get 403

- Notice: a first visit shows a short checking page, or health checks and scripts get 403 with `x-vercel-mitigated: challenge`.
- Do: in the Vercel dashboard open the project's Firewall page and see whether Attack Challenge Mode is on, or whether automatic protection reacted to a burst of traffic. Switch attack mode off when there is no attack. Ordinary browsers pass the checkpoint after a moment, but monitors and scripts do not.
- Confirm: `curl -i https://<site>/api/v1/health` returns 200 without the mitigation header.

### R-14 Many requests fail with 500 after a deploy

- Notice: `server_error` in the logs with a database "max clients" or XX000 message.
- Do: the API keeps one database connection per instance on the session pooler (port 5432) so deploys do not use up the pooler's slots. Wait a minute for old instances to end. If it continues, check that `DATABASE_URL` is the session pooler address and nothing else (scripts, a second app) is holding connections.
- Confirm: `/api/v1/health` and one signed-in request return normally.

## 4. Incident record template

Create `docs/incidents/YYYY-MM-DD-short-name.md` with:

1. What happened, in plain words.
2. When it was noticed and by whom or what.
3. Impact: who and what was affected.
4. What was done and when.
5. Cause, as known. Mark guesses as guesses.
6. What will prevent it. Link the test or document change.

No secrets, tokens, or personal data in an incident record.
