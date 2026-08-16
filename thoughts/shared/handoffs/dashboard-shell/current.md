---
date: 2026-08-16T07:20:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-16T08:10:00Z
**Goal:** Rebuild CivicGraph's console UX as a softened-Bauhaus dashboard shell (Ben's verdict on the deployed console: works but "hard to make sense of"; direction chosen: "soften Bauhaus toward the demo", shadcn dashboard reference). Every chrome element must have a real data source.
**Branch:** `main` at `5660801`, clean, everything pushed. **Six PRs merged this stream: #219–#222, then #223 (vocab dropdowns) + #224 (per-view pages).**
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (711 pass) · smoke `curl localhost:3013/dashboard` (dev server 3013, `--turbopack`)

### Now
[->] Ben to eyeball the deployed shell (civicgraph.app/dashboard after next Vercel deploy) — esp. the `/clarity` dark-ground-inside-light-shell framing, which needs his taste verdict before any dark-shell variant is built.

### This Session
- [x] Pencil mock "CG Dashboard Shell — Softened Bauhaus" — NOTE: it lives at the bottom of `empathy-ledger-v2/design/empathy-ledger-canonical.pen` (Pencil ignored the filePath arg); move it out when a grantscope .pen exists
- [x] `DASHBOARD-VIEW-MAP.md` (thoughts/shared/data-map/) — 4 spines, rail→data table, 9 verified views, guardrail block
- [x] `.shell` scoped theme in globals.css (radius 6/10px, hairline `#E4E4E1`, canvas `#F4F4F2`); radius-0 selector now `*:not(.ws *):not(.shell *)`; DESIGN.md + brand alignment map (act-global-infrastructure) both record the decision
- [x] `/dashboard` chromeless route: rail + header + 4 live tiles + remoteness chart + top yj recipients (PR #219)
- [x] Shell chrome: notifications bell fed by `agent_runs` (red dot only on failure), profile menu, help menu, `/dashboard/help` (PR #219)
- [x] Shell promoted to `src/components/shell/shell.tsx` ({title, activeHref}); /search + /clarity adopted; routes added to root layout's isChromeless list (PR #220)
- [x] ⌘K jump-to-view: GlobalSearch surfaces registry views (pinned on empty query); themeMoney extended with accoDollars/linkedDollars/accoPctOfLinked; ACCO tile live at 11.6% (PR #221)
- [x] Link integrity: /themes/* and /people NEVER existed (rail 404s); new `/reports/theme` index; People → /person; registry hrefs → real report pages (PR #222)
- [x] `view-registry.ts` — typed saved-views registry, caveats carried on the view object

- [x] Year/topic dropdowns fed by real vocabularies (PR #223): `v_vocab_financial_years` + `v_vocab_topics` (migration APPLIED by Ben 2026-08-16); `lib/vocab.ts` returns [] → dropdown absent, never invented; `themeMoney` gained `financialYear` opt; /dashboard `?topic=&fy=` validated against vocab; page revalidate → unstable_cache per loader (searchParams made it dynamic)
- [x] Per-view pages (PR #224): `/dashboard/views/[id]` for all six registry views; `lib/view-data.ts` loaders never throw / never silently empty — every no-data outcome states WHY; registry hrefs → view pages, old targets kept as `deepHref`
- FINDING: `justice_funding.financial_year` formats are MIXED — `2025-26` alongside `2026-2027` and multi-year `2026-2030` (32 distinct values). Dropdown shows actuals by design; normalising is a justice_funding cleaning task, not a dropdown bug.

### Next
- [ ] Public-safe docs surface from the data map (NEEDS SAFETY PASS — the map names ACT private systems, plaintext-token tables etc.)
- [ ] Possibly dark shell variant for /clarity, pending Ben's verdict
- [ ] Older backlog still open: Slice 5 row viewer (transcripts have FIVE independent consent flags), person-influence lane (last SEVERE money-view fixes), mv_justice_proven_suppliers GRANT ALL posture question, benjamin@act.place password reset

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
