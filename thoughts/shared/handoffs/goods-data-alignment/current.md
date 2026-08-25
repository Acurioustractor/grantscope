---
date: 2026-08-25T03:19:46Z
session_name: goods-data-alignment
branch: main
status: active
---

# Work Stream: goods-data-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-25T04:35:00Z
**Goal:** Goods x CivicGraph data alignment — **COMPLETE 2026-08-25.** All PRs merged (Goods #232; grantscope #394–#401), all migrations applied, decision-read surface live. Remaining items are fieldwork-blocked or Tier-3 cleanup only.
**Branch:** main (all work lands via short-lived branches; never commit to main)
**Test:** Goods: cd v2 && npx vitest run src/lib/data && npx tsc --noEmit · grantscope: bash scripts/precheck.sh

### Now
[->] Stream closed. Only open: Tier-3 Goods cleanup (delete remote branches feat/data-page-v2 + fix/utopia-health-row, remove stale worktree /private/tmp/goods-utopia — Ben's verb) and fieldwork-blocked waste columns.

### This Session (2026-08-25, close-out session)
- [x] Took over + landed the stalled rhd-signal session's uncommitted work (#399, merged d174bc57): two Atlas need layers (First Nations overcrowding by remoteness class; NT RHD at health-region grain via new AtlasRegionLayer), org-only map/place API counts (entity_type filter), 'unstamped' reason bucket + backlog migration 20260824111000 (applied), goods hub pagination past the 1,000-row cap + hydration fix. Fixed their palette-ratchet breach (8 raw greys → text-bauhaus-muted).
- [x] Rest-of-Australia ILOC pack (#400, merged + APPLIED): 525 ILOCs (NSW/VIC/SA/TAS/ACT/OT) → abs_iloc_* now the full national 1,138 set. +25 communities measured (18 generic match, 0 ambiguous; 7 APY hand-matches with homelands caveats — Amata 35.6%, Indulkana 55.2%, Kalka 64.7%, Fregon 20.7%, Mimili 45.3%, Pukatja 39.2%, Iga Warta). Refused: Kanpi/Nyapari/Angatja (one ILOC, three rows) + Watarru (0 dwellings). Coverage: NT 89 · WA 43 · QLD 30 · SA 15 · NSW 9 · VIC 1.
- [x] Per-community decision-read surface (#401, merged 86fa8030): "Health and housing setting" section on /org/[slug]/goods/community/[id] — measured ILOC overcrowding + source strings, I12 conditions (burden-signal caveat), PHIDU PPH + median-age-at-death (LGA-grain label, CC BY-NC-SA attribution), NT RHD via new getRhdSignalForLga (proxy-LGA membership, null outside register regions, tested), DSS postcode cards. Claim ceiling printed. Verified live :3013 (Amata conditions; Maningrida → Top End 3.2/100).
- [x] LANDMINE (the recurring psql-created-table class): abs_iloc_*, phidu_lga_health had ZERO API-role grants — app reads silently empty. migrations/2026-08-25-grant-health-reference-tables.sql (SELECT to anon/authenticated/service_role, self-verifying) APPLIED by Ben's verb.
- [x] Merged Goods #232 (Utopia health row) on Ben's verb; local fix/utopia-health-row branch survives (held by stale worktree /private/tmp/goods-utopia).

### Previous Sessions
- [x] Ruling T (Goods DECISIONS.md): 20kg HDPE/Stretch Bed; conflict swept; 45kg/800t/109,600 family banned in check-retired-figures (21 figures guarded)
- [x] NT waste + ABS overcrowding figures verified against primary sources (research/nt-plastics-overcrowding-facts-2026-08-24.md); CDS corrected ~800t -> ~530t
- [x] supply-context.ts + guards; `supply:` figure namespace in deck guards; road integration (gap + Maningrida stops); Maningrida run corrected 60 -> 40 (register-verified)
- [x] Material traceability tables live on Goods Supabase (cwsyhpiuepvdjtxaozwf), RLS-locked; design doc docs/material_traceability_schema.sql
- [x] goodsoncountry.com/data built and LIVE (prod-verified): map + panels, overcrowding bars, health setting, supply facts, method; route-audience registered
- [x] CivicGraph: goods_communities extended (waste/overcrowding/identifier/DSS cols); ABS ILOC backfill NT+QLD+WA = 161 communities measured; abs_iloc_overcrowding + abs_iloc_health (613 ILOCs); phidu_lga_health (7,176 rows); dss cols on 1,517 rows
- [x] LGA fixes: Palm Island was Douglas-QLD (fixed 35790); Maningrida/Wadeye set; Utopia RULED Barkly 70420 (3 convergent sources); Kununurra row created (had assets, no row)
- [x] Merged: Goods #225-231; grantscope #394-398. All migrations applied + committed.

### Next on resume
- [ ] Tier-3 Goods cleanup (Ben's verb): delete remote branches feat/data-page-v2 + fix/utopia-health-row; `git worktree remove /private/tmp/goods-utopia` then delete the local branch
- [ ] Waste-supply columns (est_plastic_waste_tpa etc.) stay NULL — needs fieldwork, not ingest
- [ ] Optional: PHIDU deeper sheets (risk factors are suppressed for remote LGAs — Census/PPH lanes only); goodsoncountry.com/data could now read the 25 new SA/NSW/VIC measured communities
- [ ] Watch: only 2 of 100 justice_funding-reading files reference measure_kind — unrelated standing debt, not this stream's

### Decisions
- 20kg/bed (ruling T, workpaper until measured run weighs it); 1t clean HDPE ≈ 50 leg-sets; never derive beds-possible from supply
- Health/need = SETTING, never outcome/demand; claim ceiling printed on surfaces; beds÷households never becomes "coverage"
- One-community-one-ILOC-or-nothing; caveats (exc. town camps, whole-town) travel in source strings; NULL over guessed
- PHIDU licence CC BY-NC-SA: attribute, check before paid-tier use
- Utopia LGA = Barkly (council page + Wikipedia + Urapuntja Health)

### Open Questions
- (none — both prior unknowns resolved: the rhd-signal work consumed the tables and was landed by this session; #232 merged)

### Workflow State
pattern: sequential ship-loop (build -> gates -> PR -> Ben merges VISIBLE / auto-merge SAFE)
phase: CLOSED 2026-08-25
total_phases: n/a
retries: 0
max_retries: 3

#### Resolved
- goal: "align CivicGraph data with Goods for presentations, pitches, website"
- resource_allocation: balanced

#### Unknowns
- (none blocking)

#### Last Failure
(none open; note for future: classifier blocks psql DDL and gh branch-delete in auto-mode; \copy needs pstdin under -f; Turbopack AND webpack refuse symlinked node_modules — APFS `cp -Rc` clone works)

---

## Context

Full detail lives in: memory/project_goods_supply_context.md (the standing facts),
research/nt-plastics-overcrowding-facts-2026-08-24.md (Goods repo, sourced figures),
Goods DECISIONS.md ruling T, and migrations/2026-08-2[45]-*.sql (each self-documenting
with apply commands). The /data page modules: supply-context.ts, community-need.ts,
community-health.ts — all guarded (measured-or-explained for every canon community).
Cross-session note: this grantscope tree carries ANOTHER session's uncommitted work
(atlas, goods-communities-hub, rhd-signal) — do not touch or commit those files.
