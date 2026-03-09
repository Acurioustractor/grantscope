# /preflight — Session Health Check

Run the preflight script to check GrantScope system health.

## Steps

1. Run the preflight check:
```bash
node --env-file=.env scripts/preflight.mjs
```

2. Report the results to the user. If any checks fail, suggest fixes:
   - **Database:** Check `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - **Environment:** List missing env vars and where to get them
   - **Git:** Show uncommitted files, offer to commit
   - **TypeScript:** Run `cd apps/web && npx tsc --noEmit` and fix errors
   - **Port 3003:** Show what process is using it

3. If all checks pass, confirm the session is ready for work.
