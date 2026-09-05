---
name: db-apply
description: Apply a migration to the shared Supabase project the one sanctioned way. Use on /db-apply <file>, "apply the migration", "apply the drafts", or whenever a session is about to run DDL, a seed, a GRANT/REVOKE, a policy change or a security_invoker flip against tednluwflfhxyucgwigh. Runs the pre-checks that caught three rollbacks on 2026-09-05 (array columns written as strings, a PROCEDURE among the functions, a security_invoker flip measured by policy existence instead of content), applies with scripts/db-apply.sh, post-checks, runs parity, and commits the file in the same session.
---

# /db-apply — apply a migration without the 2026-09-05 detours

**Tier 3.** Needs Ben's explicit verb in his own message ("apply …"). "start phase N" does not count for
anything beyond the files that phase named. Every step below is read-only until step 5.

## 0. Where migrations live and how they get applied

- The file is `supabase/migrations/<14-digit UTC version>_<snake_name>.sql`, wrapped in `BEGIN; … COMMIT;`.
- The ONLY apply path is `scripts/db-apply.sh <file>` (psql `-v ON_ERROR_STOP=1`, then a tracker insert).
  Never `psql -f` by hand, never `supabase db push`, never the MCP `apply_migration` unless the same SQL is
  committed here with the same version in the same turn.
- Run from the repo root of a checkout that has the file. From a worktree, export the env first:
  `set -a; source /Users/benknight/Code/grantscope/.env; set +a` (the script sources `.env` only if present).
- Old migrations are in `supabase/migrations_history/`. The baseline is `20260905130000`.

## 1. Read the schema you are about to write to (schema-first, no exceptions)

For every table the file INSERTs into or UPDATEs:

```bash
node --env-file=.env scripts/gsql.mjs "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='<table>' ORDER BY ordinal_position"
node --env-file=.env scripts/gsql.mjs "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.<table>'::regclass"
```

- `data_type = ARRAY` (udt `_text`) takes `'{a,b}'` or `ARRAY[...]`, never `'a,b'`. That was rollback #1.
- A CHECK constraint on an enum-shaped column lists the allowed values; widen it in the same file if you add one.

## 2. If the file ALTERs functions

Generate the statements from the catalog, never by hand, because some "functions" are procedures:

```sql
SELECT 'ALTER '||CASE WHEN prokind='p' THEN 'PROCEDURE' ELSE 'FUNCTION' END||' public.'||proname||'('||pg_get_function_identity_arguments(oid)||') …'
```

`refresh_civicgraph_mvs_run(text)` is a PROCEDURE (pg_cron `CALL`s it). That was rollback #2.

## 3. If the file flips a view to security_invoker

"Preserves anon reads" is true only if every RLS-on base table has a **permissive** read policy whose USING
clause is literally `true` for that role (permissive policies OR together, so one `true` makes the table
open). A policy that merely EXISTS may filter (`assertions`, `civic_org_classifications`, `alma_interventions`
all do; `justice_funding` has a profile-gated policy AND a `true` one, so it is open). Measure by content:

```sql
-- for each base of each view: is there a permissive read policy with qual = 'true' for public/anon and for public/authenticated?
SELECT p.polrelid::regclass, pg_get_expr(p.polqual,p.polrelid) qual, p.polroles::regrole[] FROM pg_policy p WHERE p.polcmd IN ('r','*') AND p.polpermissive;
```

Views over a base with no `true` policy for a role are NOT neutral: leave them definer and put them on the
decision list. Then probe every flipped view with the publishable key before and after (`limit=5`, compare
status + row count); a 500 that becomes rows is fine, rows that become 0 is a regression. Excluding by
existence instead of content was the near-miss of 2026-09-05 (63 listed, 15 would have zeroed).

## 4. Dry read of the file

- `grep -nE "^(INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|DROP|CREATE)" <file> | head` and check each target
  exists: `SELECT to_regclass('public.<name>')`.
- Long-running seeds: run the generator without a shell `timeout`; a killed generator leaves the OLD file in
  place and the apply silently re-runs it (rollback #3 was exactly that).
- Nothing in the file may grant `anon` on `xero_*`, `ghl_*`, `linkedin_*`, `communications_*`, `email_*`,
  `receipt*`, `project_funding_*`, `project_pipelines`, `goods_relationships` or any view over them.

## 5. Apply, post-check, parity, commit

```bash
scripts/db-apply.sh supabase/migrations/<version>_<name>.sql
# post-check: the query in the file's footer, or count what changed (rows inserted, views flipped, functions pinned)
node --env-file=.env scripts/check-migration-parity.mjs      # expect: nothing applied without a file
git add supabase/migrations/<version>_<name>.sql && git commit  # same session, same version
```

If the file changed after a rollback (regenerated, corrected), commit the corrected file: the tracker holds the
version, the repo must hold the SQL that actually ran.

## Definition of done

- [ ] Ben's verb quoted in the session for this file
- [ ] Column types and constraints read for every write target
- [ ] Function statements generated from `prokind`; view flips measured by policy content with before/after probes
- [ ] Applied via `scripts/db-apply.sh`, post-check run, parity green, file committed in the same session
- [ ] Types regenerated if a column changed (`supabase/types/database.types.ts`)
