# Security policy

CareRoute handles location, contact and health information, so we treat security and privacy as part of the product. We welcome responsible reports.

## Reporting a vulnerability

Do not open a public issue or pull request for a security problem. A public report tells attackers before a fix exists.

The reporting address is not set yet. It is an open item (Q-16 in `docs/00-decisions.md`). Until it is set, report privately to the project owner directly.

Include:

- what the problem is and the impact you believe it has,
- the affected area (API route, page, database, storage, dependency, configuration),
- steps to reproduce or a proof of concept,
- logs, requests or screenshots with secrets and personal data removed.

Please give us reasonable time to fix a problem before disclosing it, and do not access, change or destroy data that is not yours.

## Supported versions

CareRoute is in development with no released version. Fixes go to `main` only.

## Secrets and configuration

- Secrets live only in environment variables: Vercel for deployed environments, an untracked `.env.local` for local work.
- Never commit `.env` files, keys, tokens or real data. Only `.env.example` with placeholders is committed.
- Only variables whose names start with `PUBLIC_` reach the browser, and only through `GET /api/v1/config`, and the complete allowed list is in `docs/09-security.md` section 3.1.
- The Supabase service role key bypasses Row Level Security and is server only.
- If a secret is ever exposed, rotate it at the provider first, then clean up. Steps are in `docs/09-security.md` section 3.3 and `docs/17-observability-and-runbook.md`.

## Data

The demo uses synthetic data only. Do not put real patient information into this project.

## Details

Threats, controls, key inventory and the pre-merge checklist are in [`docs/09-security.md`](docs/09-security.md). Data handling rules are in [`docs/10-privacy-and-data.md`](docs/10-privacy-and-data.md).
