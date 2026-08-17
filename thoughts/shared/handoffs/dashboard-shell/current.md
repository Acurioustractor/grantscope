---
date: 2026-08-16T07:20:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-17T09:00:00Z
**Goal:** CivicGraph as one legible system: one shell over ALL data — every populated kind has a rich, honest Browse surface; enrichment loop (find → resolve → ingest → show) running.
**Branch:** `main` through `f7837258`. Merged this arc: #252 (shell sweep + /ops/health fix), #253 (browsers for people/places/grants/contracts/buyers/donors + entities jump-off), #254 (review follow-ups). Spec: `thoughts/shared/plans/one-shell-all-data.md`; issues #244–#251 all closed.
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (726 pass) · dev 3013

### Now
[->] UI/UX/style pass on the shell + new Browse surfaces (Ben's pick 2026-08-18).

### Grantee-ingest pipeline (PARKED 2026-08-18, resume in a fresh session)
Wave 1 DONE: Telethon 115/$75.4M · HMST 2,873/$99.2M · Lotterywest 345/$141.2M = 3,333 edges/$315.8M, all reversible by dataset key; source_record_id=name|year|rownum pattern REQUIRED (unique index rejects bare repeats).
Wave 1 REMAINING (~4-5h, scouts' URLs in session scratchpad + migration headers): Ian Potter (grants DB w/ amounts 1964-2026, needs scraper), Myer/SMF (PDF tables FY13-25), Wm Buckland (4 PDFs 2020-23, column-aware parse), VFFF (27 prose posts w/ amounts), Perron (names only), PRF (names only).
Publish NOTHING (opacity list, verified): RCH Fdn, Minderoo, GBRF, Peter Mac (internal only), Judith Neilson.
Method proven: register → dry resolve (trigram % operator, index-assisted; similarity() alone times out) → exact/high/review tiers → judge-agent adjudicates 0.60-0.80 band w/ false-friend rules (locality/state/federation/org-vs-own-foundation) → spot-check high tier for interstate traps → one Ben checkpoint → reversible migration + committed TSV.

### This Session (2026-08-17, "One shell, all data" phase)
- [x] Grilled → spec → issues #244–#251 → built → reviewed → merged, all in one day
- [x] S1 (#252): /ops/* + /admin/api-usage wrapped in shell (Ops rail group, admin-only); /ops/health ZEROS FIXED — unfiltered pg_class scan lost app tables to the PostgREST 1,000-row cap; now targeted 21-table query, real numbers verified; Views index page
- [x] S2–S8 (#253): browsers for People (attributed _v2 money, exclusions stated on screen), Places (LGA grain, lga_source provenance drawer; deserts DOLLARS suppressed — non-unique grain summed Brisbane to $2.5tn), Grants ($33.96bn matches canonical basis, filters in RPC SQL), Contracts+Buyers (shared component, since-year floor doubles as junk-date hygiene, hourly cache for ~3s rollups), Donors ('donation received' only, excluded billions named), Entities → search+jump-off. 7 migrations applied w/ GRANTs (Ben blanket-authorized read-only browse RPCs)
- [x] Two-axis code review + follow-ups (#254): browse-ui.tsx shared scaffolding (money/L/makeQs/useDrawer/Drawer), GIN trigram index on gs_entities.canonical_name, Views index lists kind browsers (registry stays question-shaped — ruling recorded in page docstring)
- [x] power-dynamics-live: ledger claim was STALE — work already byte-identical in main; stale local branch left in place
- [x] Local main had an unpushed spec commit that diverged after squash merges — rebase dropped it as already-upstream (watch for this after every squash-merge cycle)

### Next
- [ ] **Vercel prod eyeball of the whole shell (Ben; phase exit — only localhost-verified)**
- [ ] Grantee-ingest queue: Telethon, Stan Perron, RCH Fdn, Peter Mac; GBRF = project-page crawl; Judith Neilson publishes NOTHING (cite as the opacity example)
- [ ] Catalogue retire-or-keep (Ben call); docs-in-rail IA (Ben call); F5 chart-as-shares + F7 clarity chips (taste)
- [ ] 475 unfiled round 2 (widened heuristics then bulk-adjudicate)
- [ ] Name-grain dupes: grants/donors browse group by name where ABN missing — same org under two spellings appears twice (stated in UI caveats; entity-resolution lane)

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
