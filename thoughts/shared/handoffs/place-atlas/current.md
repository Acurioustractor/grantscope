# Place Atlas — one full-screen surface for the place data

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-09 night (rung 3 coda done: the "ICN ingest" premise DISSOLVED — all 122 no-ABN corps already exist as entities; 100 placement writes applied instead)
**In flight at save:** NOTHING — no background tasks. **All counts VERIFIED in-DB at session end: unplaced-with-postcode 28,490 · oric 184 · community 9 · own_name 2,582 · nolocality 10,859** (5 of the 100 writes were no-postcode twin rows — they reduced the no_postcode pool, arithmetic reconciled exactly). Tonight's 17:00 UTC cron MV refresh carries everything. Migration file + handoff dirs UNTRACKED (commit = Ben's verb).
**Goal:** Place data truth. **ORIC rung 3 COMPLETE** (9 batches applied: 5690, 0872, 4875, 0822, 0852, 4895, 4892, 0880, 4874; 4670 superseded by the repair migration; 6005 investigated → no batch, see Decisions). **Migration 20260809160000 APPLIED** (in stages): unplaced-with-postcode 39,450 → 28,591 (−10,859). Spine: `thoughts/shared/plans/place-data-truth.md`.
**Branch:** main tree on `main` at `6fd11a7`. No feature branches. Uncommitted: `supabase/migrations/20260809160000_empty_state_repair_and_poa_nolocality.sql` (applied, file reflects as-run fast forms) + both handoff dirs.
**Test:** `cd apps/web && npx tsc --noEmit && npx vitest run` (642 passing — no code touched today)

### Now
[->] Next rungs in order: **acnc hub-bias audit** → **gazetteer adds** → **AU-ORIC/AU-ABN dedup (29 pairs found, list in oric-verdicts-icn122.sql VALUES)** → street-address rung (ABR/ASIC, with agent-address detection — 6005's 1,041 wait here). Day-end counts verified 2026-08-09 night: 28,490 / 184 / 9 / 2,582 / 10,859 (unplaced_pc / oric / community / own_name / nolocality).

### Rung 3 coda — the no-ABN "coverage gap" that wasn't (2026-08-09 night)
- **Premise overturned**: recon for the planned ICN ingest matched **122/122** no-ABN register corps to EXISTING gs_entities rows — the graph already ingests ABN-less ORIC corps under **`AU-ORIC-<icn>` gs_ids (4,081 entities)**, and some exist under AU-ABN ids with ABNs ORIC's register doesn't record (Golarri, Numayanga, Tampu King…). The batch merges joined by ABN only → misfiled them NOROW. **Method fix: merge-oric joins by ABN OR normalized-name+state.**
- **100 placement writes applied** (keyed on gs_id, guarded, zero refusals, `oric-verdicts-icn122.sql` emitted by the classifier — never hand-copied): 98 unplaced rows placed across 20 councils (TSIRC 22, MacDonnell 10, Victoria Daly 9, Hope Vale 8, East Arnhem 7, Central Desert 6 incl. **Living Water UPC Yuendumu — inversion #3, Alice street line refused, placed via postal Yuendumu**, Mapoon 7, Barkly 4 first rows, **Belyuen Shire's first row** (Tjaetaba via BELYUEN COMMUNITY)…) + **Tjirrkarli pair Laverton → East Pilbara** (Ben: follow ABS GIBSON DESERT NORTH; Ngaanyatjarraku doubt noted in the SQL).
- **151 entity rows for 122 corps = 29 AU-ORIC+AU-ABN dupe pairs** — both rows placed identically; pair list → dedup lane.
- Standing skips honored: 36 hub-postal (Alice 23, Katherine 4, TI 4, Cooktown 2, Nhulunbuy 1), Daly River ×2 multi-LGA, Welere Community AC (ICN 325 — absent from the fetched register window, needs a single-page fetch or next register pull).

### This Session (2026-08-09 late pm — five ORIC batches, then the 4670 rabbit hole that paid off)
- [x] **ORIC batches 4875/0822/0852/4895/4892**: 83 writes, zero refusals (detail in prior ledger save; verdict SQL beside this file). Then **0880: 3 placed** (Gapuwiyak, Yirrkala ×2 → East Arnhem; 10 Nhulunbuy-postal skipped — the town is genuinely UNINCORPORATED, mining lease outside East Arnhem RC, SAL 2-LGA, POA 66/34) and **4874: 5 placed** by own-name pinned values (Napranum 35670 ×2, Mapoon 34830 ×2, Weipa 37300 — SAL fails all three: Napranum/Weipa absent, Mapoon 2-LGA).
- [x] **Preparing 4670 exposed the empty-state defect**: 161 postcode_geo rows / 157 postcodes with state='' (junk localities: ABS SA2 names, literal postcodes). '' passes `IS NOT NULL`, so #185's 4d' stamped 2,591 bogus state_conflicts (94% of the bucket) — 4670 alone: 1,036 QLD-vs-QLD "conflicts". Wider finding: **895 postcodes have ZERO ABS-mappable localities** (source of most of the 8,780 unmapped bucket); #188's locality-corroborated POA guard can never fire there.
- [x] **Migration `20260809160000_empty_state_repair_and_poa_nolocality.sql` APPLIED** (Ben live: "fix now" + "wide + distinct stamp"): '' → NULL + sibling/first-digit state backfill (157/157 resolved) → reason re-derivation (#185 cascade, PRE-MATERIALIZED helper form after the correlated-EXISTS form blew the 10-min shell cap — 33s vs >8min) → standard passes re-run (0 new — freed rows are all junk-locality class) → **NEW locality-free POA ≥90% pass: 10,859 placed** (QLD 9,710 · NSW 682 · VIC 200; Brisbane 2,001, Gold Coast 1,343, Sunshine Coast 1,071, Bundaberg 1,059), stamp `poa_ratio_nolocality`, translation guard 2,277/2,280 winners unambiguous. **Matched dry-run exactly.** state_conflict 2,745 → **170 genuine** · unmapped 11,355 → **496** · unstamped 0 · 4670: all 1,036 → Bundaberg. Gap ledger: 224 rows re-counted.
- [x] **6005 investigated → NO ORIC batch**: only 5 registered corps; WEST PERTH is 2-LGA in SAL (Perth/Vincent bisect it); addresses are registered-agent offices (placing them would place the accountant). The 1,041 unplaced multi_lga entities wait for the street-address rung with agent-address detection.
- [x] Apply-shape lesson recorded in the migration file: correlated per-row EXISTS against postcode_geo stalls on the pooler; pre-materialize postcode-level helper tables (stg_pc_state, stg_pc_mappable) — same semantics, seconds not minutes. First run's 10-min shell kill was harmless (autocommit).

### ORIC rung 3 — CLOSED (method + all executed SQL beside this file)
Final tally across 9 applied batches: **~125 verdict writes** (A placements, 20 hub-bias B-corrections, alias renames, own-name pinned values, community-name placements), zero guard refusals anywhere. Method file forms: `oric-verdicts-*.sql`, dry-runs `oric-*-dryrun.txt`, merge script `scratchpad/merge-oric.py` (rebuild from method notes if scratchpad is gone — session-specific path).

### Next (in order)
- [ ] Confirm tonight's cron MV refresh picked everything up (~11,100 changed rows today).
- [x] ~~ICN ingest rung~~ — DISSOLVED, see coda above (no gap; 100 placements applied instead).
- [ ] **acnc hub-bias audit**: every acnc_town_city placement in remote multi-council postcodes cross-checked against ORIC street lines (queue: Winnellie↔Darwin trio, Katherine-both-sides incl. Urapunga; 20 corrections already found incidentally).
- [ ] **Gazetteer adds**: Bookabie, Pukatja, Barrow Creek, Lajamanu (2-LGA, really Central Desert), Bloomfield, Gebar, Nhulunbuy note (genuinely unincorporated), Napranum/Weipa SAL absence.
- [ ] **Street-address rung** (ABR/ASIC): must include agent-address detection (6005 class) — a street line that resolves to an accountant's office is hub-bias in a suit.
- [ ] Phase-2 layer joins (money reaching here / Australian Living Map of Alternatives / who's here) — test council Ceduna.
- [ ] /polish queued findings (dupe Recorded money rows, raw SEIFA float).
- [ ] "commit the handoffs" + the applied migration file (Ben's verb). GitHub required-status-checks consideration stands.
- [ ] Atlas UI follow-up: add `poa_ratio_nolocality` to the How-sure stamp labels (new lga_source value, currently unlabelled).

### Decisions
- **poa_ratio_nolocality ADOPTED** (Ben, this session): locality-free POA ≥90% for postcodes with zero ABS-mappable localities; distinct stamp keeps translation-only placements separable from #188's locality-corroborated ones forever.
- **6005 / agent-address class**: ORIC register rung does NOT apply where registered addresses are agents' offices in multi-LGA metro localities — street-address rung problem, not a verdict problem.
- **Nhulunbuy stays split**: the town is real unincorporated territory; in-town vs homelands-PO unresolvable from the register.
- Standing from earlier today: alias renames (Murray→Mer class) · own-name-town beats 2-LGA SAL (reuse stamp) · inverted hubs refused · Coen in-catchment · off-SAL communities pinned (Mount Isa/Townsville SAL traps) · POA ≥90% + grouped verdicts + default hub skip + community-evidence requirement.

### Open Questions
- UNCONFIRMED: tonight's 17:00 UTC cron MV refresh picks up today's ~11,000 rows (also eyeball Bundaberg + Torres Strait Island + Mornington on /atlas).
- The 170 genuine state_conflicts and 496 residual unmapped: small enough to eyeball individually next session.
- The 103 remaining NULL-state postcode_geo rows (0/1/2-prefix, no sibling): honest, but worth a NSW/ACT/NT gazetteer pass eventually.

### Workflow State
pattern: day-shift verdict loop (dry-run → merge → grouped AskUserQuestion → guarded SQL apply)
phase: ORIC rung 3 CLOSED; next rung selection pending Ben (ICN ingest is the queued default)
retries: 0
max_retries: 3

#### Resolved
- goal: "Place data truth — reduce unplaced honestly; wrong is worse than missing"
- stamp_for_own_name_2lga: own_name_town+abs_asgs (reuse)
- nolocality_scope: wide + distinct stamp (Ben 2026-08-09)

#### Unknowns
- cron_pickup: UNKNOWN until tomorrow

#### Last Failure
(one 10-min shell kill mid-migration — harmless autocommit, resumed in stages; brief classifier outage at the end, cleared)

### Next-session prompt (paste this to resume)
▎ Place data: start the acnc hub-bias audit — every acnc_town_city placement in a remote multi-council postcode, cross-checked against ORIC street lines where a register corp shares the ABN (queued suspects: Winnellie↔Darwin trio, Katherine-both-sides incl. Urapunga; 20 corrections already found incidentally across rung 3). Read the method + standing rules in thoughts/shared/handoffs/place-atlas/current.md first. Bring me the audit shape and the suspect count before writing anything.
