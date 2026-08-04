---
date: 2026-07-14T14:10:00+08:00
session_name: agent-health-resilience
branch: feat/ghl-goods-opportunity-tracking
status: active
---

# Work Stream: ACT / Goods Operating Surface

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-07-14 - **STATE REALIGNED.** Branch `feat/ghl-goods-opportunity-tracking` is ahead of origin by 6 commits and now covers more than the original GHL Goods seeding work: ACT Atlas/place fields, ACT operating desk expansion, Goods community dossiers, Goods/ACT UI polish, entity dossier test threshold, and foundation intelligence refresh pipeline. There is also verified uncommitted stabilization work for chat message normalization and scheduled Goods GHL sync apply behavior.

**Goal now:** stabilize the branch, commit the verified narrow fixes, decide what to keep from the large untracked docs/ops set, then push/open a draft PR or split the branch into smaller PRs.

**Branch:** `feat/ghl-goods-opportunity-tracking` (local branch, ahead of `origin/feat/ghl-goods-opportunity-tracking` by 6 commits).

**Verified this pass:**
- `cd apps/web && npx tsc --noEmit` - passed.
- `cd apps/web && npx vitest run tests/unit/lib/ai-chat-helpers.test.ts` - passed, 3 tests.
- `git diff --check` - passed.

### Now
[->] Commit the verified stabilization set:
- `apps/web/src/lib/ai-chat-helpers.ts`
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/api/org/[orgProfileId]/journeys/chat/route.ts`
- `apps/web/src/app/api/start/[intakeId]/chat/route.ts`
- `apps/web/tests/unit/lib/ai-chat-helpers.test.ts`
- `scripts/sync-goods-ghl.mjs`
- `scripts/sync-act-xero.mjs`
- `package.json`
- this handoff

Do not stage loose/generated artifacts without a deliberate call, especially:
- `.env.bak-incident-2026-06-30`
- `scripts/.ghl-last-response.json`
- loose root screenshots such as `goods-buyers-*.jpeg`

### Committed Local Work
- `b966d54` - add ACT Atlas place fields.
- `14035d1` - expand ACT operating desk.
- `a435ce2` - expand Goods community dossiers.
- `fe73ce8` - polish Goods and ACT project surfaces.
- `a5fcc2a` - relax entity dossier relationship threshold.
- `53efe0b` - add foundation intelligence refresh pipeline.

### Uncommitted Verified Work
- Chat API routes now use `toTextModelMessages()` instead of `convertToModelMessages()` so text-only routes do not forward local UI/database ids or metadata as provider message ids.
- `getTextFromMessage()` now supports current UI `parts` and legacy `content` shapes.
- New unit coverage for chat helper behavior.
- `sync-goods-ghl.mjs --apply` now upserts via Supabase service API after writing the reviewable SQL artifact. This is intended for scheduled runtimes that do not have local `psql`.
- `scripts/sync-act-xero.mjs` bridges GrantScope to the ACT global infrastructure Xero sync scripts, keeping OAuth/token state in that repo.

### Unverified / Needs Deliberate Action
- GHL `sync-goods-ghl.mjs --apply` was reviewed but not live-run in this pass.
- ACT Xero bridge was reviewed but not live-run.
- Untracked SQL migrations for Goods chips were read, not applied.
- UX audit screenshots/docs were reviewed as artifacts, not re-tested in-browser.
- Large untracked planning/power-map/handoff files need classification before staging.

### Product Alignment
The ACT dashboard UX audit points to a Field Desk model rather than another dashboard pass. The recommended next product build is the Opportunity Inbox plus Universal Record Panel:
- ranked signal list,
- one selected record panel,
- source evidence,
- five stable score dimensions,
- inline decisions: commit, connect, investigate, park.

Before that, fix the Money priority contradiction and remove repeated metric/source-health clutter from primary work surfaces.

### Decisions
- Keep GHL money-in organized by pipeline-per-money-type plus Goods tags.
- Keep Grants pipeline as the grant-instrument source of truth.
- Keep scheduled syncs able to run without local `psql` when Supabase service API can safely express the write.
- Treat the current branch as too large to leave local-only; either push as draft PR or split.

### Open Questions
- Should this branch be pushed as one draft PR or split into ACT operating desk, Goods community/UI, foundation intelligence, and ops-sync PRs?
- Which untracked docs/ops artifacts are intentional repo assets versus local scratch?
- Should the Goods GHL apply path be live-run before committing, or committed as code-reviewed + type-checked only?
- Should the ACT Xero bridge scripts become part of this branch, or be separated into an ops PR?

### Workflow State
pattern: stabilize-then-ship
phase: 1
total_phases: 2
retries: 0
max_retries: 3

#### Resolved
- goal: "Review recent work and align on current state / next steps"
- resource_allocation: balanced

#### Unknowns
- push_decision: UNKNOWN
- split_decision: UNKNOWN
- untracked_artifact_policy: UNKNOWN

#### Last Failure
- Initial validation command used the wrong `npm exec` shape and printed TypeScript help; rerun from `apps/web` with `npx tsc --noEmit` passed.
- Initial unit test run from repo root could not resolve `@/`; rerun from `apps/web` passed.

---

## Context

### Key Facts For Resume
- Supabase SELECTs: `node --env-file=.env scripts/gsql.mjs "..."`
- DDL/heavy migrations: use `psql -f`; do not use `gsql.mjs -c` for PL/pgSQL dollar quoting.
- TypeScript validation after `.ts` / `.tsx` edits: `cd apps/web && npx tsc --noEmit`.
- Current user intent from "next": proceed with stabilization, not more planning.

### Prior Work Streams
- Phase 7 grant engine and Goods GHL opportunity tracking.
- ACT operating desk and Field Desk direction.
- Goods command center and community dossiers.
- Foundation intelligence refresh pipeline.
- Entity-graph data health and person disambiguation history.
