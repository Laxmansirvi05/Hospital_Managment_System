# Production access and verification report

Date: 2026-11-04

## Summary

Supabase access now resolves to the CareRoute organization and both projects. Read-only checks show dev active with 16 migrations and prod active with 14. The assistant schema and the expanded document-type migration exist only in dev. Production table/data parity, production role grants for the new schema, Storage configuration, and deployed code state were not changed or verified through a production request. Vercel project metadata was readable in the prior access check, but the team-scope and runtime-error calls were denied. The seven-day runtime-log request is impossible on the documented Hobby retention window of one hour.

No production SQL was executed. No personal-data table rows were read. No migration, deployment, variable, or project setting was changed. The owner-run orphan query is in [`RELEASE_READINESS_2026-11-04.md`](./RELEASE_READINESS_2026-11-04.md) and was not executed.

## Supabase read-only results

Organization: `lakshmansirvi1812@gmail.com's Org`, ref `pwhbeteedyqrccaywrpz`.

| Project | Ref | Status | Region and version | Applied migrations |
| --- | --- | --- | --- | ---: |
| `careroute-dev` | `jelepdfgdxbkbmocrnnx` | Active, healthy | `ap-south-1`, Postgres 17.11.0.003 | 16 |
| `careroute-prod` | `qbiltbhqtesdidjxpscf` | Active, healthy | `ap-south-1`, Postgres 17.11.0.003 | 14 |

The 14 shared migrations end with the Google sign-in/link migrations. Dev additionally has `20261103000100_assistant` and `20261103000200_more_document_types`. The production assistant migration was not approved, so it remains unapplied. The doc-type migration also remains unapplied in prod.

### Assistant schema on dev

- `users.assistant_consent_at` exists as `timestamp with time zone`.
- `assistant_conversations` has `id`, `user_id`, `title`, `created_at`, `updated_at`.
- `assistant_messages` has `id`, `conversation_id`, `user_id`, `role`, `content`, `payload`, `created_at`.
- Migration-defined indexes exist on conversation user/update time and message conversation/create time. Primary-key indexes also exist.
- RLS is enabled on both assistant tables.
- `careroute_api` has SELECT, INSERT, UPDATE and DELETE on both. No grants to `anon` or `authenticated` were returned for those tables.
- Dev `pg_default_acl` has `postgres` table defaults granting `careroute_api` SELECT, INSERT, UPDATE and DELETE. The migration SQL itself contains no explicit grant statement. The prod default ACL has not been queried in this update, and prod has no assistant tables to check.

The database advisor checks from the initial reauthorization found RLS-enabled public tables without policies, consistent with the server-only `careroute_api` access pattern documented under D-49. Dev had 20 public tables and prod 18 at that check. These advisory counts are not a grant verification for absent production assistant tables. The `careroute_api` role is designed to bypass RLS, so the app server is the security boundary. Do not interpret RLS enabled with no policy as proof of restricted server queries.

### Production status limitations

- The two migrations above are absent from prod. The current code's assistant endpoints require assistant tables and consent state; DOCX and WebP upload support also needs the second migration's Storage bucket and `patient_files` constraint changes.
- Production `careroute_api` grants and default ACL for new tables remain unverified. Do not assume catalog state is identical to dev.
- Current Vercel environment variable names and targets were not read. `.env.local` was classified as `careroute-dev` without exposing values; its credentials were not used for production access.
- No production health request, production account creation, or runtime database test was performed.
- Supabase dashboard settings that are not exposed by the connector remain UNKNOWN: plan, backups, PITR, Auth sign-ups, exposed schemas, SSL enforcement, and network restrictions.

## Vercel access results

The prior read-only project metadata call for project `careroute` succeeded and returned a latest production-target deployment, but no Git SHA. The owning team and runtime errors were denied. The exact errors were:

> `Vercel API request failed (403: forbidden). Not authorized: Trying to access resource under scope "laxman-sirvi-s-projects". You must re-authenticate to this scope or use a token with access to this scope.`

> `Vercel API request failed (403). You don't have permission to access this resource.`

The first error is scope-specific. Reauthorize the Vercel connector for `laxman-sirvi-s-projects` before checking project variables, deployment SHA, runtime errors, or production health. The project plan was not confirmed in Vercel dashboard access during this run; the existing setup doc and connected-user metadata report Hobby.

Official [Vercel Runtime Logs documentation](https://vercel.com/docs/logs/runtime) and [Hobby Plan documentation](https://vercel.com/docs/plans/hobby) state one hour of runtime-log retention for Hobby. A seven-day runtime-log history therefore cannot be recovered on this plan, even after access is restored. Runtime logs are **UNVERIFIED** for both the requested seven-day interval and the retained one-hour window.

## Call inventory

These were read-only connector calls. Project references are listed exactly; no SQL was run on prod.

| Tool | Target | Result |
| --- | --- | --- |
| `mcp__codex_apps__supabase_get_project` | `jelepdfgdxbkbmocrnnx` and `qbiltbhqtesdidjxpscf` | Both project metadata reads succeeded. |
| `mcp__codex_apps__supabase_list_migrations` | Both project refs | Dev 16, prod 14. |
| `mcp__codex_apps__supabase_list_tables` | Both project refs, verbose | Catalog/table inventories read; no table rows. |
| `mcp__codex_apps__supabase_execute_sql` | Dev only | Catalog metadata for schema, indexes, ACL/default ACL, and role grants. No personal-data rows. |
| `mcp__codex_apps__supabase_get_advisors` | Both project refs, security and performance | Read-only advisory results. |
| `mcp__codex_apps__vercel_get_auth_user` | Current connected Vercel account | Read-only identity/plan metadata in the prior access check; email omitted. |
| `mcp__codex_apps__vercel_list_teams` | Current connected Vercel account | Team inventory in the prior access check. |
| `mcp__codex_apps__vercel_get_project` | `careroute` | Readable in the prior check. Latest target showed production; no SHA returned. |
| `mcp__codex_apps__vercel_get_team` | `team_ZoKBUzeivolBMQGdfcufbDXh` / scope `laxman-sirvi-s-projects` | Denied with the scope-specific 403 above. |
| `mcp__codex_apps__vercel_get_runtime_errors` | project `prj_KhLnAiZLoZwAt4xkYr8jYbYLcTE1`, team scope, `7d` | Denied with the runtime-access 403 above. |
| `mcp__codex_apps__vercel_search_vercel_documentation` | Vercel runtime logs and Hobby retention | Official documentation search; supports the one-hour retention statement. |

No Vercel retry was made because the connector authorization state had not changed. No new Supabase permission failure occurred after the owner reconnected it.

## Next owner actions

1. In the Supabase dashboard, record the plan, backup/PITR retention, Auth sign-up setting, exposed schemas, SSL/network restrictions, and decide privately whether the storage orphan should be kept or removed.
2. In Vercel, authorize the connector for `laxman-sirvi-s-projects`; then verify environment variable names and environment assignments without copying values.
3. Before any production migration, review its exact target and backup/rollback plan. This report does not approve or apply a migration.
4. Keep database count checks and runtime checks marked **UNVERIFIED** until completed with approved access. Seven-day Hobby logs remain unavailable by plan design.
