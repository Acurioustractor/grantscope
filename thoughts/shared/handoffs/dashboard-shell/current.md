---
date: 2026-08-16T07:20:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-18T00:00:00Z
**Goal:** CivicGraph as one legible system — one shell over all data, every kind browsable and sortable; grantee-ingest waves filling the funder→grantee graph.
**Branch:** `main` through `8877b9de` (#256). This arc merged: #252 shell sweep + /ops/health fix · #253 seven kind browsers · #254 review follow-ups · #255 UX polish (13 findings) · #256 sortable headers everywhere. Prod (civicgraph.app) verified READY through #255; #256 deploying on merge.
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (726 pass) · dev 3013

### Now
[->] Continue the UI/UX pass with Ben live (polish loop, pass 2), or resume the grantee-ingest wave (see memory: grantee-ingest-pipeline). Both lanes clean.

### This Session (2026-08-17→18)
- [x] "One shell, all data" phase: grill → spec (thoughts/shared/plans/one-shell-all-data.md) → issues #244–#251 → built → two-axis code review → all merged. Browsers: People (attributed _v2 $, stated exclusions), Places (LGA grain + lga_source provenance; deserts dollars suppressed — non-unique grain), Grants ($33.96bn canonical basis in RPC SQL), Contracts+Buyers (shared component, year floor), Donors ('donation received' only), Entities = search+jump-off. /ops+/admin in shell; /ops/health zeros fixed (unfiltered pg_class × PostgREST 1,000-cap).
- [x] Grantee wave 1: Telethon 115/$75.4M · HMST 2,873/$99.2M · Lotterywest 345/$141.2M — all from the funders' own registers, judge-adjudicated fuzzy bands, reversible dataset keys. 12 foundations scouted; 6 parked ready; 5-name opacity list verified.
- [x] UX audit pass 1 (14 findings, docs/ux-audit/shell-ux-findings.md + shots) → #255 fixed 13: shares chart (Ben's call — 93% vs red 7% story), '(blank)' recipient purge, rail/header active states, donor ABN-collapse dedupe, drawer scrim, vocab humanized.
- [x] #256: every column sorts via its header on all nine browse tables (People gained visible Influence column); RPC sort keys added (systems/acco/recent); chips removed.
- [x] Memories written: grantee-ingest-pipeline, browse-shell-conventions.

### Next
- [ ] UX pass 2 with Ben (open items: floating avatar bubble overlaps rail bottom — move to header?; Pratt Pty-Limited/LTD donor dupe = name-normalisation lane; chart could accept topic filter)
- [ ] Grantee wave 1 remainder (~4-5h): Ian Potter scraper, Myer PDFs, Buckland PDFs, VFFF prose, Perron/PRF names-only
- [ ] Catalogue retire-or-keep (Ben) · docs-in-rail IA (Ben) · 475 unfiled round 2
- [ ] Telethon 45 held-out names; HMST 816; Lotterywest 65 — resolution round 2 when entity lanes improve

### Key traps (this arc, will bite again)
- Missing service_role GRANT = PostgREST silently empty (FIVE instances; check relacl FIRST on any new view/MV read)
- PostgREST 1,000-row cap silently truncates pull-and-compute (power-concentration bug; compute in DB)
- Function object_keys carry full signatures — bare-name IN-lists miss them
- exec_sql ~8s timeout; long MV rebuilds via BACKGROUND psql (foreground 10-min kill ORPHANS the server-side txn — needed Ben's pg_terminate)
- 'history' contains 'story'; generated database.types.ts matches every table name
- Sandbox blocks api.anthropic.com directly (extract-foundation-grantees script) — extract in-session; PDF download + pdftotext work fine
- cd apps/web persists across Bash calls — repo-root paths break next call

### Decisions
- Softened Shell (`.shell`) scoped like `.ws` — first sanctioned radius break; identity colours/type unchanged; Bauhaus untouched outside scope. Logged in DESIGN.md Decisions Log 2026-08-16.
- No chrome without a data source (`thoughts/shared/plans/dashboard-shell-buildout.md`) — notifications = data events from agent_runs, help centre = provenance docs.
- Saved views = typed code registry first (`apps/web/src/lib/view-registry.ts`), user persistence later.
- ACCO share denominator = LINKED dollars only (unlinked can't be classified); tile states the basis. Live value 11.6% vs report's 11.5% — different denominator, both honest.
- Views must query source tables, not gs_relationships (drill-through 100% broken until edge rebuild).

### Open Questions
- UNCONFIRMED: /clarity dark-inside-light framing acceptable to Ben?
- UNCONFIRMED: does the Vercel prod deploy of /dashboard render with data (chromeless path skips auth; service key must be present in prod env — expected fine, unverified).
- Repo does NOT allow gh auto-merge queueing (`enablePullRequestAutoMerge` off) — merge via background wait-for-green loop instead.

### Workflow State
pattern: ship-per-slice (branch → build → tsc+vitest → smoke 3013 → PR → merge-on-green)
phase: 5
total_phases: open-ended
retries: 0
max_retries: 3

#### Resolved
- goal: "dashboard shell UX rebuild, shadcn structure in softened Bauhaus skin"
- resource_allocation: balanced

#### Unknowns
- (see Open Questions)

#### Last Failure
(none)

---

## Context

Session flow: Ben reviewed the deployed console (post-clarity-catalog work), verdict "works but hard
to make sense of", pointed at https://demos.shadcndashboard.dev/ and chose "soften Bauhaus toward
the demo" via AskUserQuestion. Pencil mock approved, then four ship-per-slice PRs same day.

Key files: `src/components/shell/{shell,shell-header,shell-menus}.tsx` · `src/app/dashboard/{layout,page}.tsx` · `src/app/dashboard/help/page.tsx` · `src/lib/view-registry.ts` · `src/app/reports/theme/page.tsx` (new index) · globals.css `.shell` block.
Grounding docs: `thoughts/shared/data-map/DASHBOARD-VIEW-MAP.md` · `thoughts/shared/plans/dashboard-shell-buildout.md`.
Prior stream handoff: `thoughts/shared/handoffs/clarity-catalog/current.md` (clarity console rebuild, still holds Slice 5 detail).
