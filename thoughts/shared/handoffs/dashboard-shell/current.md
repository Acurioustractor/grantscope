---
date: 2026-08-16T07:20:00Z
session_name: dashboard-shell
branch: main
status: active
---

# Work Stream: dashboard-shell

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-16T09:00:00Z
**Goal:** Rebuild CivicGraph's console UX as a softened-Bauhaus dashboard shell (Ben's verdict on the deployed console: works but "hard to make sense of"; direction chosen: "soften Bauhaus toward the demo", shadcn dashboard reference). Every chrome element must have a real data source.
**Branch:** `main` at `e9407cc`, clean, everything pushed. **Seven PRs merged this stream: #219–#222, then this session #223 (vocab dropdowns) + #224 (per-view pages) + #225 (public docs surface). Every buildable next-item is DONE — what remains needs Ben.**
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run` (711 pass) · smoke `curl localhost:3013/dashboard` (dev server 3013, `--turbopack`)

### Now
[->] Stream is code-complete pending Ben: eyeball civicgraph.app/dashboard (+ /dashboard/views/*, /dashboard/docs, the topic/year dropdowns once the hourly vocab cache turns over) and give the `/clarity` dark-inside-light verdict. No further build work queued in this stream.

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
- [x] Public docs surface (PR #225): `/dashboard/docs` — the safety pass is STRUCTURAL: `lib/data-docs.ts` is a hand-typed allowlist of 13 civic datasets (rule in module header forbids generating from thoughts/shared/data-map, which names ACT private systems + token tables); row counts via PostgREST `estimated` count (planner stats, verified within a few % of measured; gs_entities worst at ~8% low), hourly refresh so nothing rots; Known Limits section; linked from help menu ("The data we hold")
- FINDING (RESOLVED 2026-08-16): `justice_funding.financial_year` formats were MIXED — see next entry.
- [x] `justice_funding.financial_year` normalisation APPLIED (migration `migrations/2026-08-16-justice-fy-normalise.sql`): the mess was not formatting — 41 rows were multi-year spans / `YYYY-ongoing` / bare `2024`, incl. `2021-25` = a 2021→2025 PRF span that LOOKS canonical. New parsed cols `fy_start`/`fy_end`/`fy_open_ended` on all 157,116 rows (zero unparsed), maintained by trigger `trg_justice_funding_parse_fy`; raw strings kept as provenance except `2026-2027`→`2026-27` (2 rows, single-FY either way); `v_vocab_financial_years` now requires `fy_end = fy_start + 1` → dropdown is 19 clean FYs (2008-09…2026-27). Filter by `fy_*`, never by string shape.
- Vocab views live: 9 topics (child-protection 7,481 rows → prevention 313), 19 financial years. Dropdowns appear as each surface's hourly vocab cache refreshes.

### Phase 2 directive (Ben, 2026-08-17)
"See any screen we've got on this new dashboard and make sure it aligns to the new design system;
searchable queries; keep thinking about which parts of the data go where. Make sure the dashboard
and all links go to the right style UX/UI, then make sure all the data is linked the right way, and
use the clarity tool to understand what data goes into which user's experience."
Work order: 1) chrome crawl from /dashboard (pattern-collapsed) → map every reachable screen's
visual family vs intent (root layout isChromeless list is the code's intent, layout.tsx:93) →
convert stragglers to shell; 2) data→surface mapping via clarity (visibility floor + owner_app +
nouns feeding a per-surface data contract).
- [x] CRAWL DONE 2026-08-17: 47 screens, ZERO broken chrome — clean two-family split (shell:
  dashboard+views+docs+search+18 clarity surfaces; public Bauhaus: everything else). One 404
  (/ask footer link, removed). Ben's rulings: shell-native noun pages (rail never exits the
  shell) + ops tools (/ops/health /alerts /tracker /foundations/tracker) move into the shell.
- [x] Five shell-native noun pages BUILT (branch shell-native-noun-pages): /dashboard/{themes,
  reports,entities,people,places} reusing themes registry / reportSections / mv_entity_power_index
  / mv_board_interlocks (**MAX_PLAUSIBLE_BOARDS cap applied read-side — unfiltered top "person"
  sits on 745 estate trusts**) / mv_funding_by_postcode. Detail pages still open the public atlas,
  stated on every page. Rail is now pathname-aware (`rail-nav.tsx` client component, longest-prefix
  active; TRAP: component refs can't cross the server→client boundary as props — NAV must live in
  the client file). Shell.activeHref deprecated-ignored.
- [ ] Ops tools into the shell (second PR of this stream).
- [ ] Then: clarity-driven data→surface contract (visibility floor + owner + noun per surface).

### Next
- [ ] Ben's taste verdicts: deployed shell overall + `/clarity` dark-inside-light framing (gates the dark shell variant); also eyeball /dashboard/views/* and /dashboard/docs
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
