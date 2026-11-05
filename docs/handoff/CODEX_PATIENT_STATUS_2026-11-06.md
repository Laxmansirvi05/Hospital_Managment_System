# CareRoute patient-side status

Date: 2026-11-06

## Current completion

No ledger rows moved in this step. The baseline ledger score is unchanged. The audit's patient-side pillars score **48.3% weighted** across the six patient pillars (discovery, health portal, authentication/security, data quality, AI assistant and emergency), using the same weighted pillar arithmetic as the audit and normalizing by their combined weight of 86:

`(25×52.2 + 20×41.7 + 15×56.9 + 10×48.6 + 8×44.0 + 8×40.0) / 86 = 48.26%`.

The corresponding scoped row score is approximately **46.8% unweighted**: the six pillars contain 79 scored rows and approximately 37.0 points from the audit's displayed pillar values. These are inherited proxy scores, not a complete product inventory or release claim. No row is upgraded based only on the baseline run.

## Ledger rows moved

None. This step establishes the baseline only.

## Commands and results

| Command | Result |
|---|---|
| `pnpm check` | Passed: `public/ check passed`. |
| `NODE_ENV=test DATABASE_URL= pnpm test` | Passed: 12 files, 374 tests. `DATABASE_URL` was explicitly empty to keep the suite in memory mode. |

## Owner must verify on real systems

- Postgres behavior and migrations have not been exercised against any real database in this work step.
- Production deployment, production routes, and any provider delivery remain unverified. No live database or AI/SMS/maps/Google provider was contacted.
- The two pre-existing untracked emergency migration files remain untouched and unstaged because the audit records them as owner-existing uncommitted work; resolve ownership before committing them.

## Decisions needed

- P-09: approval for Playwright, axe and Newman test tooling and any CI additions. No CI change is authorized by this status.
- P-20: driver reject contract remains proposed. Treat any existing implementation as unapproved for contract expansion.
- P-30: landing-page guardrails need owner decision before finalizing scene behavior.
- P-05 conflicts with locked D-24 scrypt; D-24 wins and will not be changed.
- Q-10 retention, Q-16 security contact/domain, Q-18 domain/Vercel plan, Q-20 map tile terms, Q-26 assistant external sources, and Q-28 collector schedule remain open. Work will not depend on these decisions.

## Blocked / constraints

- Existing owner/audit modifications and untracked assets are present in the worktree. They were not staged or changed.
- Step 1's requested migration commit conflicts with the explicit ownership rule for pre-existing owner-uncommitted files. The migration files are not included in this commit.
- No files outside this status report were changed in this step.
