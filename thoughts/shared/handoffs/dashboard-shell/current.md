---
date: 2026-08-16T07:20:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-17T03:00:00Z
**Goal:** CivicGraph as one legible system: soft-shell admin at 100%, plain language everywhere, Browse (list → thing → links) for every kind, and the enrichment loop (find → resolve → ingest → show) running.
**Branch:** `main` (everything pushed through `8b9809ec`). Merged this arc: #226–#243 + direct-to-main data commits.
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (726 pass) · dev server 3013 (restart: `cd apps/web && npx next dev --turbopack -p 3013`; it DIED once this session)

### Now
[->] Fresh session: continue the grantee-ingest queue (Telethon Trust, Stan Perron, RCH Foundation, Peter Mac — each likely publishes beneficiary lists; pattern proven on McKinnon: their own documents → dry ABN resolution → flagged confidence → reversible dataset key), or whichever lane Ben picks below.

### This Session (2026-08-16→17, the whole arc)
- [x] Clarity console COMPLETE (slices 0–10): row viewer + consent census, code scanner (3 repos), findings stream, nouns, inline edit (caught 2 shipped bugs via real HTTP), owner_app, project codes (wiki-declared), story↔project links (Ben's 3 rulings), surfaces (data→surface contract)
- [x] All 1,486 catalogue objects described in plain language (96 by hand+rule, 578 by agents reading real definitions); /dashboard/guide "What this is"; writing rule embedded in curated-fields.ts
- [x] Admin at 100% (#243): Bauhaus bridge + dark-suite token flip + type pass; overview drawer; consequence layer ("How the system is doing, screen by screen" + needs-attention with influences); Browse rail (Foundations/SEs/Charities) with RPC lists, known-ness dots, filters/sorts, drawers w/ 6yr ACNC financials
- [x] Person-trio money filters + de-collide (last SEVERE); proven_suppliers grant revoked; consent gate on public place pages (status='published' NEVER EXISTED; fallback rendered every transcript — fixed with quote_sharing_consent basis)
- [x] Power-dynamics page rebuilt live-only — **PARKED on branch `power-dynamics-live` (rebased, tsc-clean), Ben verb to ship**
- [x] Grantee lane: 6,672 offer-self-loops retyped (971-foundations illusion → honest 27); McKinnon ingest from their own register (24 edges $12.7M, 27→30 foundations linked)
- [x] Adjudications (Ben-delegated): 839 owners, ~1,011 nouns (+66 corrections; 475 remain, no proposals), findings 144 confirmed/119 dismissed

### Next
- [ ] Grantee-ingest queue (day-shift, Ben-in-loop per batch): Telethon, Stan Perron, RCH Fdn, Peter Mac; GBRF = project-page crawl; Judith Neilson publishes NOTHING (cite as the opacity example)
- [ ] Ship `power-dynamics-live` (Ben verb)
- [ ] /ops/health query repair (data rotted: zeros everywhere, health score 26)
- [ ] Catalogue retire-or-keep (Ben call); docs-in-rail IA (Ben call); F5 chart-as-shares + F7 clarity chips (taste)
- [ ] 475 unfiled round 2 (widened heuristics then bulk-adjudicate)
- [ ] Vercel prod eyeball of the whole shell (localhost-verified only)

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
