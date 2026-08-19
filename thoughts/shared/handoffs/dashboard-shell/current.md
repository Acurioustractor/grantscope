---
date: 2026-08-19T02:00:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-19T05:30:00Z
**Goal:** CivicGraph as one legible system — every number on a screen means what the screen says,
and landing the work stops costing more than the work.
**Branch:** `main` through `3cd384c0`. **Zero open PRs.** Merged this session: #270-#278, #286-#288,
#292-#297 (16 PRs).
**Test:** `scripts/precheck.sh` — tsc + 742 vitest + a production build when the diff touches
package.json / lockfile / next.config / root layout / middleware. Refuses to build if :3013 is up.

### Now
[->] **Design-system migration, step 1: wrap `/dashboard/*` in `.ui`.** shadcn is installed and
live; 19 routes are the cheapest first conversion. Order and costs: artifact
https://claude.ai/code/artifact/ae4d84e9-3d02-4833-aa44-1a3adbd18718

### This Session
- [x] **Periphery swept and disarmed** (#277, #278) — `send-billing-reminders` was armed: enabled,
      daily, 33 runs, no `--dry-run`, live `sendEmail()` for a product cut in April. Now
      double-latched. 4 dead schedules off, pg_cron reactor unscheduled.
- [x] **`agent_schedules.last_run_at` was lying** — written on task creation, not success. Four
      schedules claimed "ran this week" while `agent_runs` said June. Split into
      `last_scheduled_at`; both writers fixed; proven live after orchestrator restart.
- [x] **API-key surface dormant** (#286) — 6 routes, 2 pages, 4 nav entries deleted; table +
      `/api/v1/exposure` kept on purpose. A keyless caller gets 401, verified.
- [x] **Dollar-less funder policy** (#292) — 202 rows `amount_unknown`. Found **306 self-loops
      carrying $98.69M** → issue #290.
- [x] **`/foundation/[abn]` 404'd for everyone** (#294) — 10 matviews had NO PostgREST grants.
      6th instance of that class. Fixed; also fixed a 24x ACCO undercount on that page.
- [x] **shadcn/ui installed** (#296) + `/ui` (public reference) + `/ui/routes` (admin-gated,
      filesystem-scanned route map with thumbnails).
- [x] **Regression I shipped and fixed** (#297) — #296's unscoped `@layer base` killed DM Sans
      site-wide and turned every border shadcn grey. Live for ~1h. Caught by `/code-review`.

### Next
- [ ] **Reopen #289 (analytics).** Closed as "deterministically stuck, cause unknown" — likely the
      same build fault. If it lands, Lever 2's re-entry trigger becomes pullable again.
- [ ] **Correct the queue entry** claiming Lever 2's "returns if" is unreachable (premise died).
- [ ] **#290** — delete the 306 self-loops + $98.69M, guard the backfill.
- [ ] **#274** — 2-minute `/clarity` prod check (admin login needed).
- [ ] `.dark` block from shadcn init still global; DESIGN.md permits dark for `/clarity` only.

### Decisions
- **shadcn/ui is the design system.** Ben rejected all three existing languages. Token layer +
  components, matching his Pencil doc. `.ui` is the opt-in scope.
- **`.ui` scope is load-bearing**: `globals.css` has `border-radius: 0 !important` outside
  `.ws`/`.shell`, which flattens every shadcn component. Base layer must be scoped too.
- **`shadcn` belongs in `dependencies`, not devDependencies** — `globals.css` imports
  `shadcn/tailwind.css`. Removing it breaks the CSS build. A review flagged it; the review was wrong.
- **Migration order** (artifact above): dashboard 19 → the 31 templated reports → script the 126
  Tailwind-default routes → 55 hand-rolled articles when next edited, not as a project.

### Open Questions
- **UNCONFIRMED: the Vercel build fault is not understood.** Builds hang at "Creating an optimized
  production build" with NO error, ~29 min, whenever the dependency tree changes. `rm -rf .next` in
  `vercel.json` currently works around it and is still there — it discards incremental cache on
  every deploy. My "stale cache, one clean build heals it" conclusion was DISPROVEN (#297 hung on a
  fresh cache). Not root-caused.
- **UNCONFIRMED: `/ui/routes` may return an empty list in production.** It reads `src/app` from the
  filesystem at request time; source files are not guaranteed in a serverless bundle. Only ever
  verified locally — on prod I saw the login redirect and stopped.
- **UNCONFIRMED: route-map classification is asserted, not measured.** `route-scan.ts` assigns a
  system by path prefix and regexes only each route's own `page.tsx`, never its imports. The
  "136 routes mixing vocabularies" headline is unverifiable in both directions.
- `precheck.sh` cannot catch lockfile drift — a local install is not `--frozen-lockfile`.
- 3 foundation detail pages still exist (`/foundation/[abn]`, `/foundations/[id]`,
  `/dashboard/browse/foundations/[id]`). Duplication now costs more, not less.

### Workflow State
pattern: sequential
phase: 1
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "one design system, locked, every page reads from it"
- resource_allocation: balanced

#### Unknowns
- vercel_build_hang: UNKNOWN (root cause)
- ui_routes_serverless_fs: UNKNOWN (untested in prod)

#### Last Failure
(none — #297 green and verified live)

---

## Context

Session flow: Ben reviewed the deployed console (post-clarity-catalog work), verdict "works but hard
to make sense of", pointed at https://demos.shadcndashboard.dev/ and chose "soften Bauhaus toward
the demo" via AskUserQuestion. Pencil mock approved, then four ship-per-slice PRs same day.

Key files: `src/components/shell/{shell,shell-header,shell-menus}.tsx` · `src/app/dashboard/{layout,page}.tsx` · `src/app/dashboard/help/page.tsx` · `src/lib/view-registry.ts` · `src/app/reports/theme/page.tsx` (new index) · globals.css `.shell` block.
Grounding docs: `thoughts/shared/data-map/DASHBOARD-VIEW-MAP.md` · `thoughts/shared/plans/dashboard-shell-buildout.md`.
Prior stream handoff: `thoughts/shared/handoffs/clarity-catalog/current.md` (clarity console rebuild, still holds Slice 5 detail).
