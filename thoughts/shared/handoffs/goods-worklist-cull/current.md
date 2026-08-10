---
date: 2026-08-10T03:40:00Z
session_name: goods-worklist-cull
branch: goods-worklist-cull
status: active
---

# Work Stream: goods-worklist-cull

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-10T03:40:00Z
**Goal:** Make the Goods workspace answer "what gets us money and connects us with community" instead of reporting scale. Done when every Goods screen leads with something that has a name, an owner and a date — or admits it cannot.
**Branch:** `goods-worklist-cull` (commit `9978bc7`, **not pushed**)
**Test:** `cd apps/web && npx tsc --noEmit` · dev server `cd apps/web && npx next dev --turbopack -p 3013`

### Now
[->] Decide what to do about **244 communities carrying LGA values the place-data repair disproved** — including the NT `0872` outstation block stamped `Laverton` (a WA shire, wrong state). Two options on the table, Ben's call: (a) run them through the same rung logic as the entity rebuild (own-name-town, SAL ratio dominance, community name) leaving outstations null with reason codes, or (b) null the demonstrably wrong ones now so the screen stops asserting Alpurrurulam is in Western Australia. Naive `postcode_geo` backfill is WRONG — 0872 legitimately spans seven LGAs.

### This Session
- [x] **New screen `/org/act/goods/portfolio`** — one row per community pathway (5), not one per grant. Dense table with `<details>` expansion, Server Component. Merged as PR #189 (`ac5961b`).
- [x] **Hub rebuilt** — `/org/act/goods` is now "This week": unowned pathways + grants closing soon, scored on `goods_relevance_score`. Replaced the `focus_areas` overlap filter that was surfacing Screen Territory / Rural Health rounds as Goods money.
- [x] **Rail cull 26 routes → 8.** we-owe / model / pitch / foundations-scan moved to `_archive/2026-08-10-goods-tab-cull/` with RESTORE.md. Merged-away screens still live, reachable from the hub's "everything else".
- [x] **Header 330px → 98px** across all Goods screens (shared `GoodsWorkspaceHeader` + `goods-workspace.module.css` padding + 4 bespoke headers).
- [x] **Rail scroll fix** — was `overflow-hidden` on `h-screen`; 1,054px of tree in a 587px box made Channels/Buyers unreachable.
- [x] **Communities 1,000 → 1,214** — PostgREST caps at 1000 regardless of `.limit(2000)`; now paged with `.range()`.
- [x] **SEIFA column lit up** — `GRANT SELECT ON v_goods_community_priority TO service_role, authenticated, anon` **APPLIED 2026-08-10** by Ben. Most-disadvantaged tile went 0 → 821.

### Next
- [ ] Resolve the 244 stale-LGA communities (see Now).
- [ ] Push `goods-worklist-cull` and open a PR — Tier 2/3, needs Ben's verb. Touches a lot of surface, so eyeball the Vercel preview.
- [ ] Optional: the *real* code merge behind the nav cull. Seven screens still read the same 306-row `goods_relationships`; this session only merged the doors, not the code.
- [ ] Consider mirroring GHL next-action/owner back into `org_pipeline` — that is the single change that would make the hub long.

### Decisions
- **Nav cull was doors-only, not code.** Merging seven working screens on a guess about which parts Ben uses is the expensive kind of wrong; consolidating the rail delivers the benefit immediately and reversibly.
- **Archive, never delete.** `_archive/` is underscore-prefixed so Next does not route it; files intact, RESTORE.md gives the exact `git mv` back.
- **The hub states its own data gap.** All 125 `org_pipeline` rows have no owner / next action / date, so the page says so rather than dressing aggregates as actions.
- **Grant fit over focus-area overlap.** `goods_relevance_score >= 60` — the overlap filter was a liar.

### Open Questions
- UNCONFIRMED: whether the 34 communities with no SEIFA decile matter, or are legitimately unmatched.
- UNCONFIRMED: whether `foundations/scan` was genuinely redundant with `foundations`, or held scan-specific behaviour worth keeping. Archived, easily restored.

### Workflow State
pattern: iterative-surface-repair
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "work on the next most important screen for the Goods project" → became "make the whole Goods surface useful"
- resource_allocation: balanced

#### Unknowns
- stale_lga_remediation_approach: UNKNOWN (Ben's call — rung logic vs null-out)

#### Last Failure
(none — `tsc --noEmit` clean, all 24 remaining routes 200, archived four 404 as intended)

---

## Context

### The finding that reframed the session
Ben's reaction to the old Goods hub: "this is currently insane, the amount of information here — what is actually helpful in getting us money and connecting with the community?"

The answer, verified: almost nothing, and not because of layout. **`org_pipeline` holds 125 rows and 0 have `next_action`, 0 have `owner_name`, 0 have `next_action_at`, 0 have `qbe_stage`.** The columns exist; nothing populates them. `goods_communities` (1,542 rows) has only `priority` — no next step, no owner. `act_obligations` is **0 rows**, which is why the "We owe" screen rendered empty and got cut.

So the aggregates ("126 buyers · 126 open", "$3.3M in play") were not a UI failure — they were the only thing the data could support. Relationship state lives in GoHighLevel and nothing mirrors it back. Saved to memory as `project_goods_next_action_data_gap.md`.

### The stale place data
`goods_communities` was last written **2026-05-13**, three months before the LGA attribution rebuild. It never received that work: `lga_name` 1,366/1,542, `lga_code` only 741/1,542. **244 active communities disagree with repaired `postcode_geo`.** The NT `0872` block — 10 Mile, Alcoota Station, Alpurrurulam, Alkupitja, Amburla Station — is stamped `Laverton`, a shire in Western Australia ~1,500km away.

This is the landmine class the place work already knows about: `0872` spans Alice Springs, APY, Barkly, Central Desert, MacDonnell, Ngaanyatjarraku and Unincorporated NT, which is exactly why the POA ratio pass refuses it. Any fix must use the rung logic, not a postcode join.

### Gotchas worth keeping
- **PostgREST caps every response at 1000 rows** regardless of `.limit()`. The old code asked for 2000, got 1000, and the header said "Showing 1000" — a silent truncation that looked like a real number. Page with `.range()`.
- **`v_goods_*` views need explicit GRANTs.** `v_goods_community_priority` had SELECT only for `agent_readonly` and `postgres`; the app reads as `service_role`, the fetch errored, and `fetchChunked(..., optional = true)` swallowed it into an empty column. 1,508 communities had deciles the whole time. Same trap as `v_goods_relationship_power` / `_funding`.
- **`perl -i` replaces the file inode** and can blind Turbopack's watcher. Used it on four bespoke headers; the dev server then served stale HTML through touches and reloads until a full restart.
- **Don't start the dev server from inside this session** — background tasks get reaped and it dies. Run it in a separate terminal, or `nohup ... &`.

### Files
- `apps/web/src/lib/services/goods-investment-portfolio.ts` — typed pathway records + `isPortfolioEligible()` guard (named decision AND owner, or it is relationship work only).
- `apps/web/src/app/org/[slug]/goods/page.tsx` — the "This week" hub.
- `apps/web/src/app/org/[slug]/goods/portfolio/page.tsx` — the portfolio table.
- `apps/web/src/app/org/[slug]/_components/act-workspace-shell.tsx` — rail sections (8) + scroll fix.
- `apps/web/src/app/org/[slug]/goods/_components/goods-sub-nav.tsx` — tab lists + `MERGED_INTO` map.
- `apps/web/src/lib/services/goods-communities-hub.ts` — `.range()` pagination.
- `scripts/sql/2026-08-10-grant-goods-community-priority-view.sql` — applied.
- `apps/web/src/app/org/[slug]/goods/_archive/2026-08-10-goods-tab-cull/RESTORE.md` — how to bring the four back.

### Source
`thoughts/shared/handoffs/goods-investment-portfolio-alignment-2026-08-10.md` is the alignment doc the portfolio readings come from (community decision → relationship → investment need → opportunity). It cites the Goods Asset Register decision log.
