---
date: 2026-08-25T03:19:46Z
session_name: goods-data-alignment
branch: main
status: active
---

# Work Stream: goods-data-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-25T03:19:46Z
**Goal:** Goods x CivicGraph data alignment: verified supply/need/health facts, typed + guarded in the Goods repo, backfilled + source-stamped in CivicGraph, rendered on goodsoncountry.com/data. Done when the last PR (Goods #232) merges.
**Branch:** main (all work lands via short-lived branches; never commit to main)
**Test:** Goods: cd v2 && npx vitest run src/lib/data && npx tsc --noEmit · grantscope: bash scripts/precheck.sh

### Now
[->] Waiting on Ben to merge Goods PR #232 (Utopia health row, VISIBLE). Nothing else in flight.

### This Session
- [x] Ruling T (Goods DECISIONS.md): 20kg HDPE/Stretch Bed; conflict swept; 45kg/800t/109,600 family banned in check-retired-figures (21 figures guarded)
- [x] NT waste + ABS overcrowding figures verified against primary sources (research/nt-plastics-overcrowding-facts-2026-08-24.md); CDS corrected ~800t -> ~530t
- [x] supply-context.ts + guards; `supply:` figure namespace in deck guards; road integration (gap + Maningrida stops); Maningrida run corrected 60 -> 40 (register-verified)
- [x] Material traceability tables live on Goods Supabase (cwsyhpiuepvdjtxaozwf), RLS-locked; design doc docs/material_traceability_schema.sql
- [x] goodsoncountry.com/data built and LIVE (prod-verified): map + panels, overcrowding bars, health setting, supply facts, method; route-audience registered
- [x] CivicGraph: goods_communities extended (waste/overcrowding/identifier/DSS cols); ABS ILOC backfill NT+QLD+WA = 161 communities measured; abs_iloc_overcrowding + abs_iloc_health (613 ILOCs); phidu_lga_health (7,176 rows); dss cols on 1,517 rows
- [x] LGA fixes: Palm Island was Douglas-QLD (fixed 35790); Maningrida/Wadeye set; Utopia RULED Barkly 70420 (3 convergent sources); Kununurra row created (had assets, no row)
- [x] Merged: Goods #225-231; grantscope #394-398. All migrations applied + committed.

### Next
- [ ] Ben merges Goods PR #232 (then delete remote branches feat/data-page-v2, fix/utopia-health-row — Tier 3, Ben's verb)
- [ ] CivicGraph per-community decision-read surface — PARKED: another session is mid-flight in goods-communities-hub.ts / rhd-signal.ts / atlas (uncommitted in this tree); their work wants these new tables
- [ ] Waste-supply columns (est_plastic_waste_tpa etc.) stay NULL — needs fieldwork, not ingest
- [ ] Optional: SA/NSW/VIC ILOC packs; PHIDU deeper sheets (risk factors are suppressed for remote LGAs — Census/PPH lanes only)

### Decisions
- 20kg/bed (ruling T, workpaper until measured run weighs it); 1t clean HDPE ≈ 50 leg-sets; never derive beds-possible from supply
- Health/need = SETTING, never outcome/demand; claim ceiling printed on surfaces; beds÷households never becomes "coverage"
- One-community-one-ILOC-or-nothing; caveats (exc. town camps, whole-town) travel in source strings; NULL over guessed
- PHIDU licence CC BY-NC-SA: attribute, check before paid-tier use
- Utopia LGA = Barkly (council page + Wikipedia + Urapuntja Health)

### Open Questions
- UNCONFIRMED: whether the rhd-signal session wants to consume abs_iloc_health / phidu_lga_health (they're its natural raw material)
- UNCONFIRMED: PR #232 merge state (was OPEN, checks green, awaiting Ben)

### Workflow State
pattern: sequential ship-loop (build -> gates -> PR -> Ben merges VISIBLE / auto-merge SAFE)
phase: done pending #232
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
