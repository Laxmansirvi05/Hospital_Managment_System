# Project workflow

How work is planned, built, reviewed and shipped. Written to be followed by the owner and by AI coding agents alike.

## 1. Order of work

1. Documentation first. This set is approved by the owner before any code is written.
2. Resolve open questions that block a work package before it starts.
3. Build in vertical slices: each work package delivers API, database, UI and tests for one area of the collection.
4. The design tokens and base components come first (WP-0) so every later screen uses them.

## 2. Work packages

| WP | Scope | Collection folder | Blocked by |
| --- | --- | --- | --- |
| WP-0 | Foundation: project scaffold (`public/`, `api/`, `server/`), config validation, logger, design tokens, base components, CI with secret scan and `public/` file scan, local Supabase, health endpoint | 0 | none (Q-15 answered, icons decided) |
| WP-1 | Accounts and roles | 1 | Q-01, Q-04, Q-19 |
| WP-2 | Medical ID and emergency contacts | 2 | none |
| WP-3 | Hospitals, doctors and beds, nearby search | 3 | Q-02 |
| WP-4 | Ambulances, status, pings, nearby | 4 | Q-03 |
| WP-5 | Emergency core: SOS, guest SOS, matching, offers, accept, trip states, tracking, recommended hospitals, pre-alert, feedback, history, cancel, realtime, SMS | 5 and parts of 8 | Q-05, Q-06, Q-07, Q-08, Q-09, Q-12, Q-13, Q-14 |
| WP-6 | Triage assistant | 6 | Q-17, clinician review of rules |
| WP-7 | Dispatch dashboard and analytics | 7 | Q-06 |
| WP-8 | Hardening: negative tests, security suite, performance measurement, accessibility pass | 8 | none |
| WP-9 | Medical reports | new | Q-10, Q-11 |
| WP-10 | Demo readiness: seed data, demo script, deployment checks, runbook drill, final documentation review | all | all |

WP-1 comes before WP-2 to WP-4. WP-5 needs WP-2, WP-3 and WP-4. WP-9 needs WP-1 and WP-5.

## 3. Definition of ready

A work package or task starts only when:

- every OPEN question that blocks it is answered and moved to the LOCKED table,
- the documents it touches are up to date,
- its acceptance criteria are written (the PRD feature rows, or new ones the owner approved).

## 4. Definition of done

A task is done when every item holds:

1. Behavior matches `05-api-spec.md` and the collection.
2. Tests exist for the cases in `14-testing-strategy.md` section 3 that apply, and pass.
3. The security checklist in `09-security.md` section 12 is answered, and the security agent reviewed anything touching auth, tokens, uploads, SMS, the tracking page or secrets.
4. For UI: the design review checklist and accessibility checks pass, and the design agent reviewed it.
5. Documents that describe the change are updated in the same change.
6. `CHANGELOG.md` has an entry.
7. The result is reported honestly, including what was not verified.

## 5. Branches, commits and review

PROPOSED, the project is not yet a git repository.

- `main` is always deployable. Work happens on short branches named `wp-<n>/<topic>`.
- Commits use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. Commit messages state why.
- One pull request per task. It lists: what changed, which doc sections it follows, test results, the security checklist answers, and what was not verified.
- Nobody pushes to `main` directly. Nobody force-pushes or rewrites shared history.
- Secrets are never committed. If one is, follow `09-security.md` section 3.3.

## 6. Review gates

| Gate | Who | When |
| --- | --- | --- |
| Contract | Contract agent | Any change to routes, schemas or the collection |
| Security | Security agent | Any change touching auth, authorization, data, tokens, uploads, SMS, third-party calls, config or dependencies |
| Design | Design review agent | Any UI change |
| Owner | The project owner | Any change to a LOCKED item, any new dependency of note, any contract change |

Agents report findings. The owner or the engineer decides. An agent never approves its own work.

## 7. Rules for AI agents working in this repository

These rules apply to every AI coding session. `CLAUDE.md` repeats them at the top level.

1. Read `docs/00-decisions.md` first. Do not contradict it.
2. Do not guess. If a fact or decision is missing, ask the owner. Do not fill gaps with assumptions and present them as settled.
3. Do not interpret when you have a suggestion. State the suggestion, label it PROPOSED, and wait.
4. An honest report of what is broken beats a clean report that is not true. Say what was not done and what was not verified.
5. Never weaken, skip or delete a test to make it pass. Report every test file touched.
6. Never mark something verified from a fake alone.
7. Never silence an error with an empty catch.
8. Never fabricate results, metrics, test output or sources.
9. Never commit or print secrets. Never put a secret in a `PUBLIC_` variable or in any file under `public/`.
10. Never push, force-push or rewrite history without the owner's explicit instruction.
11. Do not spend money. Use fakes and free tiers. If something needs a paid key, say so and stop.
12. Never use the banned design patterns or the em dash character.
13. Keep changes inside the task. Report unrelated problems, do not fix them silently.

## 8. Keeping documents true

- A change that makes a document wrong must fix the document in the same pull request.
- Status labels (LOCKED, COLLECTION, PROPOSED, OPEN) are only changed by the owner's word.
- Each document names its source. If a source is missing, the statement is OPEN.

## 9. Demo readiness

Before any demo: seed data loaded, all keys valid in the target environment, Twilio test numbers verified, Supabase project active, the contract suite green on the deployed preview, the runbook drill done once, and the demo script rehearsed on a phone and a desktop in both themes.
