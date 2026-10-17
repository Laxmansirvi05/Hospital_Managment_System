---
name: security-review
description: Use before merging any CareRoute change that touches auth, ownership checks, tokens, uploads, SMS, third-party calls, config or secrets, dependencies, or health and location data. Runs the checklist and hands off to the security agent.
---

# Security review

## Steps

1. List what the change touches: routes, tables, environment variables, dependencies, third-party calls, files, UI that shows personal or medical data.
2. Answer each question in `docs/09-security.md` section 12, with file and line evidence for each answer. A bare "yes" is not an answer.
3. Secrets pass:
   - Search the diff for keys, tokens, connection strings and passwords.
   - Confirm every new environment variable is on the list in `docs/09-security.md` section 3.1, in `.env.example`, in `server/config.js`, and in `docs/16-deployment-and-environments.md`.
   - Confirm no `PUBLIC_` variable holds a secret and no file under `public/` references `server/`.
   - Run the secret scan and the `public/` file scan.
4. Authorization pass: for each route, list the role check, the ownership check, and the tests for 401, 403 and the success path.
5. Data pass: list every personal or medical field the change reads, writes, logs, returns or sends to a third party. Check against `docs/10-privacy-and-data.md` section 5.
6. Run the security agent (`security-agent`) with the list from steps 1 to 5 as context.
7. Fix, or report each finding to the owner with severity. Do not close a finding without a test or a written reason.
8. If the change reveals a missing rule, add it to `docs/09-security.md` only with the owner's approval. Otherwise list it as a question.

## Reporting

State what was checked, what was found, what was fixed, what remains and what could not be verified. Never describe a check as passed unless it ran. Never print a secret value.
