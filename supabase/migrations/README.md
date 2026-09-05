# The one migrations home for the shared Supabase project

Project: `tednluwflfhxyucgwigh` ("JusticeHub + GrantScope"). Decided 2026-09-05 after the platform review
(`thoughts/shared/findings/supabase-platform-review-2026-09-05.md`) found that the database tracked 418
migrations of which 313 had no source file in any repo, and that no repo, alone or together, could
reproduce the schema.

## The rule

**Every schema change to the shared project is a file in this folder, applied by `scripts/db-apply.sh`,
committed in the same session it was applied.** That includes changes made from JusticeHub,
act-global-infrastructure, The Harvest Website or act-regenerative-studio sessions: write the file here
(a PR against grantscope is fine), apply it, commit it. The MCP `apply_migration` tool is allowed only if
the same SQL is committed here with the same version number in the same turn.

`scripts/check-migration-parity.mjs` compares this folder with `supabase_migrations.schema_migrations`
and fails when either side has a post-baseline version the other lacks. Run it in `/preflight` and
before any `/ship-merge` that touches `supabase/`.

## Files

| file | what |
|---|---|
| `20260905130000_baseline_remote_schema.sql` | the live schema on 2026-09-05, dumped with `supabase db dump --linked` (pg_dump 17 inside the CLI's container; local pg_dump is 16 and refuses the server). 774 tables, 460 functions, 714 policies. Never edit; it is the floor everything after it stands on. |
| `2026MMDDHHMMSS_<snake_name>.sql` | one change each, 14-digit UTC stamp, applied with `scripts/db-apply.sh <file>` |
| `../migrations_history/` | the 396 pre-baseline files from `supabase/migrations` and `migrations/`, plus the tracker snapshot taken before the baseline. History, not instructions. See `RESTORE.md` there. |
| `../types/database.types.ts` | generated types for the whole project. Regenerate after any migration: `supabase gen types typescript --linked > supabase/types/database.types.ts` (or the MCP `generate_typescript_types`). |
| `../functions/` | the 13 edge functions, downloaded 2026-09-05 from the project. Deploy from here, never from `~/Downloads`. |

## How to apply

```bash
# writes the file's version into supabase_migrations.schema_migrations after a clean ON_ERROR_STOP run
scripts/db-apply.sh supabase/migrations/20260905141000_definer_views_security_invoker_flip_safe.sql
```

`supabase db push` is deliberately NOT the apply path: it refuses to run while the tracker holds the 418
pre-baseline versions, and resetting those would erase the only record of what they were. Applying with
`psql -f` plus a tracker insert keeps the history and the parity check honest.

## Rules that stay true across every migration

- New views are `WITH (security_invoker = true)` unless a documented anon consumer needs definer semantics.
- Nothing under `xero_*`, `ghl_*`, `linkedin_*`, `communications_*`, `email_*`, `receipt*`,
  `project_funding_*`, `project_pipelines`, `goods_relationships` is ever granted to `anon`.
- Functions set `search_path = public, extensions, pg_temp`.
- `schema_ownership` gets a row for every new object (owner, consumers, evidence) in the same migration. An ACT-owned object
  with no row is invisible to `scripts/check-private-exposure.mjs`, which is the gate that keeps private data off the public key.
- Money surfaces run `/money-audit` before shipping; that is unchanged.
