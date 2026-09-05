# Migration history (pre-baseline)

Moved here on 2026-09-05 when `supabase/migrations/20260905130000_baseline_remote_schema.sql` became the
schema floor. Nothing in this folder is applied by any tool; the live database already contains whatever of
it was ever run.

| folder | from | files |
|---|---|---|
| `pre-baseline-supabase/` | `supabase/migrations/` (Feb to Aug 2026, 14-digit stamps and free names) | 312 |
| `legacy-date-named/` | `migrations/` (June to Aug 2026, applied by `psql -f`, never tracked) | 84 |
| `tracker-snapshot-2026-09-05.txt` | `supabase_migrations.schema_migrations` as it stood before the baseline: 418 versions, 313 with no file in any repo | 1 |

To restore the old layout: `git mv supabase/migrations_history/pre-baseline-supabase/* supabase/migrations/`
and `git mv supabase/migrations_history/legacy-date-named migrations`. Nothing else referenced the paths
except comments in `scripts/refresh-views-v2.mjs` and `scripts/grantee-migration.mjs`, and the scan list in
`scripts/scan-clarity-code-refs.mjs`, all updated in the same commit.
