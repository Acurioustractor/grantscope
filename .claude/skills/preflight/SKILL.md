# /preflight — Session Health Check

Run the preflight script to check GrantScope system health.

## Steps

1. Run the preflight check:
```bash
node --env-file=.env scripts/preflight.mjs
```

2. Report the results to the user. If any checks fail, suggest fixes:
   - **Database:** Check `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - **Migration parity:** `supabase/migrations/` vs the database tracker. Red means something was applied with no committed file (commit it with the same version); "draft(s) awaiting /db-apply" is normal while Ben has not said apply.
   - **Environment:** List missing env vars and where to get them
   - **Git:** Show uncommitted files, offer to commit
   - **TypeScript:** Run `cd apps/web && npx tsc --noEmit` and fix errors
   - **Port 3013:** Show what process is using it

3. If all checks pass, confirm the session is ready for work.

## What preflight does NOT check

It checks local env vars are **present**. It does not check that their *deployed* values can
satisfy the comparisons the code makes on them — and a var can be set, non-empty, and still wrong.
`CIVICGRAPH_LIVE_REPORTS` was stored in production as `"true\n"` against a `=== 'true'` check, so
61 public pages read nothing for four months and preflight passed every day of it.

Run **`/config-truth`** when a feature is configured but inert, and whenever a new env flag is
added.
