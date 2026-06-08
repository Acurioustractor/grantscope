# /close — Session Close-Out

Clean close-out for a GrantScope work session.

## Steps

1. **Type check** — Run `cd apps/web && npx tsc --noEmit`. If errors exist, fix them before proceeding.

2. **Git status** — Run `git status` and `git log --oneline -10` to show the session's work.

3. **Commit prompt** — If there are uncommitted changes, ask the user if they want to commit. If yes, stage and commit with a descriptive message.

4. **Session summary** — Summarize what was accomplished this session:
   - Files created/modified
   - Features built or bugs fixed
   - Database changes (migrations, backfills)
   - Current coverage numbers if relevant

5. **Update handoff** — Update the **active** handoff ledger (the work-stream this session belongs to). There are several handoff streams and the active one changes, so **do NOT hard-code a work-stream name**. Detect it the same way the SessionStart loader does — the most-recently-modified ledger:
   ```bash
   ls -t thoughts/shared/handoffs/*/current.md | head -1
   ```
   In that file:
   - Update the **Ledger** quick-resume block at the top (Updated timestamp · Branch · Goal · the **Now** line). This block is what the SessionStart hook surfaces on resume, so keep it accurate and current.
   - Add a new dated **This Session** entry summarising the work (move completed "Now"/"Next" items into it).
   - Refresh the **Next on resume** list with any next actions discovered this session.

6. **Next actions** — List 2-3 recommended next actions for the following session.
