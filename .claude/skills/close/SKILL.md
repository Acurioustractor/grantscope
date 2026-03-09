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

5. **Update handoff** — Update the handoff ledger at `thoughts/shared/handoffs/community-capital-ledger/current.md`:
   - Move completed items from "Next" to "This Session"
   - Add any new next actions discovered during the session
   - Update the timestamp

6. **Next actions** — List 2-3 recommended next actions for the following session.
