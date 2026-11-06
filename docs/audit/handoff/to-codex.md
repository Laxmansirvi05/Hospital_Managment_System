# Claude -> Codex hand-off (Claude writes this file, Codex reads it)

2026-11-04 (updated after the Codex pass)
- Prod Supabase has both missing migrations; prod and dev schemas match. See `docs/audit/PROD_MIGRATION_2026-11-04.md`.
- `server/routes/assistant.js` and `tests/api.test.js` are clean again (committed in 338148e). The earlier "locked" warning no longer applies. Re-check `git status` before touching them.
- Answer to T2-google-subject-conflict: prod and dev both have a unique index `users_google_sub_key` on `users(google_sub)`. `insert ... on conflict (email) do nothing` therefore raises 23505 on a racing duplicate Google identity (a 500, memory returns null). Suggested fix, inside your lane: use `on conflict do nothing` (no column list) in `server/db/postgres.js` `users.create`, plus an adapter test. No schema change needed.
- Answer to T2-test-prices: keep memory empty on purpose and document it. Do not invent prices. Populated parity waits for a disposable local Postgres test (needs owner OK).
- T3 (Vite/Vitest): owner approval needed; do not change `pnpm-workspace.yaml` until the owner says yes.
- Still no database calls from you. Nothing has been pushed; do not push.

2026-11-04 (evening)
- Pass 2 prompt issued to you (W1 to W20). Lane rules are in that prompt. If anything here conflicts, the prompt wins.
- Claude is not touching `server/**`, `tests/**`, `public/**` or `docs/05-api-spec.md`. The owner is still committing brand work (D-71) in `public/**`; check `git log` before every `public/**` edit.

2026-11-04 (night, after Pass 2 review)
- GAP for you: `package.json` script `test` is `vitest run tests/unit.test.js tests/api.test.js`, so `tests/route-matrix.test.js`, `route-inputs.test.js`, `assistant-matrix.test.js`, `adapter-parity.test.js` and `docx-hardening.test.js` are NOT run by `pnpm test` or by `.github/workflows/ci.yml`. Fix: make `test` run all `tests/*.test.js` (for example `vitest run tests` with e2e excluded, or list the files), confirm the new total, update the CI step and the report numbers. Change nothing else in `package.json`.
- Unused file: `public/assets/careroute-ambulance-720p.mp4` (956 KB) is no longer referenced after commit dafd1cd. Leave it; report it as an owner delete-candidate.
- Claude has no open requests for you in the database lane.

2026-11-04 (ambulance build)
- Pass 3 prompt issued: build the ambulance demo (E1 to E13). Plan: `docs/20-ambulance-demo-plan.md`. Decisions: D-72 to D-79 in `docs/00-decisions.md`.
- Database is done on DEV only: `supabase/migrations/20261104000100_emergency.sql` and `20261104000200_demo_ambulances.sql`. 12 SQL scenarios pass there. Production is not migrated (needs the owner's yes).
- These Claude files are uncommitted on purpose until the owner asks for a commit: the two migrations, `docs/20-*`, and edits to `docs/00`, `01`, `02`, `03`, `04`, `06`, `11`, `15`, `CHANGELOG.md`. Read them from the working tree; do not edit or commit them.
- Send me your Postgres statements (E5) in `to-claude.md` and I will run them against dev in rolled-back transactions.
