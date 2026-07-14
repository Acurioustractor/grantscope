---
date: 2026-06-21T20:42:07Z
session_name: power-holder-leverage-map
branch: feat/goods-registry-entity-resolution
status: active
---

# Work Stream: power-holder-leverage-map

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-21T20:42:07Z
**Goal:** Make CivicGraph the one place to source every power holder in Australia. Map delivered; unification residue (A4 de-collide + A1 entity-resolution backfill) now COMPLETE; surfacing (move C leaderboard + get_power_holder) shipped.
**Branch:** feat/goods-registry-entity-resolution
**Test:** cd apps/web && npx tsc --noEmit

### Now
[->] SESSION COMPLETE — nothing running, branch+origin in sync, DB healthy on Medium. All of: A4 de-collide applied/verified · A1 backfill (justice 7,467 + donations 414,165) done · move C "Power Holders" leaderboard shipped · -q runner bug fixed · get_power_holder() applied · staging dropped · PR #100 open. ONLY pending = a Tier-3 merge of PR #100 (Ben's explicit go) + the optional junk-ABN cleanup below.

### This Session
- [x] Delivered the power-holder leverage map via a 6-pass ultracode workflow (33 agents): `thoughts/shared/power-map/power-holder-leverage-map-2026-06-20.md`
- [x] Verified the build plan against app+DB - ~80% was ALREADY BUILT (mv_abr_name_lookup exists 9.04M rows; /power UI + reports suite exist; L6/L9 already surfaced). Wrote `RUNBOOK-power-unification.md` with corrections.
- [x] Staged A4 de-collide migration (non-breaking mv_person_identity_influence_v2) - verified the 8-people-share-$7.57B double-count is real
- [x] Wrote + ran A1 backfill STEP 1 (staging): _a1_jf_resolved (7,471) + _a1_pd_resolved (443,494, valid-ABN gated, IND-excluded)
- [x] COMMITTED justice backfill (STEP 2a): 7,467 recipient_abn + 1,892 gs_entity_id into justice_funding
- [x] Donations write fought us: single-shot + 30K-batch both pathologically slow (8 indexes, Small compute). Saved batched/resumable runner for off-peak.
- [x] APPLIED + verified A4 de-collide (next session, 2026-06-21): mv_person_identity_influence_v2 live (241,260 ids, 4 indexes). Before/after captured — per-person figures dropped to per-director share ($7.57B/8 → $757M each = 1/10th), aggregate $60.6B phantom eliminated. KEY: cluster query still returns rows and that's CORRECT (honest equal-share among co-directors); the "must be zero rows" criterion was naïve — fixed in runbook + verify SQL. Move C now unblocked.
- [x] DONATIONS A1 BACKFILL COMPLETE (2026-06-21): 414,165 non-IND political_donations rows now carry donor_abn from staging; in-scope pending=0; 0 junk ABNs. Required bumping shared Supabase Small→**Medium** (max_conn 90→120) — pool was fully saturated (522 + ECHECKOUTTIMEOUT), orchestrator pause didn't clear it (other-tenant load), Medium's restart dropped stuck conns. Test batch 29s/10K on Medium+quiet. **FOUND+FIXED a real bug in run-donations-batched.sh: the `-q` psql flag suppressed the "UPDATE n" tag the loop parses → every batch read as +0 → script stopped after 1 batch thinking it was done. This is why donations never completed before. Removed -q; 38 batches ran clean.** Orchestrator restarted.
- [x] BUILT + verified live move C: "Power Holders" section on /power. New route `api/power/holders/route.ts` (read-only exec_sql: top-50 by influence_score_attributed, NOT is_nominee_block, board_count<=10; L16 funders = mv_foundation_grantees link_method='relationship' JOIN mv_person_identity_network on the entities they govern) + new section in `power/client.tsx`. tsc clean, query ~1.1s, 9,238 cross-system holders, renders on-brand. Fixed money() sub-$1K repeating-decimal by round()-ing attributed dollars to ::bigint in the route. COMMITTED 412cbb2 + PUSHED.
- [x] Committed + pushed the -q runner fix (c0ab32c). Opened/updated PR #100 into main (body covers all 6 commits). Bumped shared Supabase Small→**Medium** (max_conn 120) to unblock the backfill — also kills the recurring pooler saturation.
- [x] APPLIED + verified get_power_holder(p_abn,p_gs_id,p_name) → one jsonb (entity power-index row + board_people + foundation_backers + revolving_door incl. donate_then_win). Serco: donate_then_win, $1.89B procurement + ALP donations. Macquarie Uni: 6 systems, 14 board, Ian Potter $1.7M. Dropped staging _a1_pd_resolved/_a1_jf_resolved.

### Next
- [ ] MERGE PR #100 into main when ready (Tier-3, Ben's explicit verb). 6 commits.
- [ ] DATA-QUALITY cleanup (surfaced by get_power_holder test): junk all-zero ABNs in mv_entity_power_index carry large $ — e.g. abn '00000000000' = "Charlotte Tilbury Group", $662M justice_dollars. Null/exclude placeholder ABNs so they don't skew power rankings.
- [ ] After next 3am AEST nightly refresh, spot-check mv_entity_power_index folded in the recovered donor rows (donation_dollars/system_count for newly-resolved donors).
- [ ] Pre-existing bug (NOT this work): /api/power/health 500s → /power "Data Coverage" block blank. Likely exec_sql/route-migration residue ([[solution_exec_sql_app_block]]).
- [ ] Follow-up: retire old mv_person_identity_influence once leaderboard reads _v2 (2 app files still read v1).

### Decisions
- Did NOT rebuild /power (already a large surface) - map's Phase C was over-scoped; extend, don't rebuild
- Donations scope = B (company/org donors, IND excluded) - individuals carry name-collision risk on unverified matcher
- Backfill writes only fill NULLs (never overwrite) + unambiguous matches only (n_abn=1) - never guess
- DDL on shared Supabase is classifier-blocked for me (CREATE FUNCTION/migration via psql -f denied as "routing around apply_migration") → Ben runs via `!`/clipboard. DML (the backfill UPDATEs) went through fine — only DDL is blocked.
- Bumped shared Supabase Small→Medium (max_conn 120) - the durable fix for both slow writes AND pooler saturation. See [[shared-supabase-pooler-saturation]] (now marked RESOLVED).

### Open Questions
- RESOLVED: batched donations DID complete cleanly once on Medium + after the -q fix (38 batches, 29s/10K). The blockers were (a) Small-compute saturation and (b) the -q runner bug, not the matcher.
- OPEN (future, optional): the 202 ambiguous justice names could be recovered later via abr_registry postcode tie-break.
- OPEN: are placeholder all-zero ABNs widespread in mv_entity_power_index? (one confirmed: '00000000000' = Charlotte Tilbury Group, $662M justice) - scope a cleanup.

### Workflow State
pattern: map-then-stage-then-apply
phase: 6
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "one place to source every power holder in Australia - map + unification residue" — DELIVERED (A4 de-collide + A1 backfill + move C leaderboard + get_power_holder all shipped; PR #100 open)
- resource_allocation: aggressive (ultracode)

#### Unknowns
- donations_offpeak_speed: RESOLVED — 29s/10K on Medium+quiet; the prior "18+min/30K" was Small-compute contention + the -q bug

#### Last Failure
(none active) — prior session's slow 30K batch was root-caused this session to two things: Small-compute saturation (fixed by Medium bump) AND the -q flag bug in run-donations-batched.sh (fixed in c0ab32c). Backfill completed clean.

---

## Context

### Where everything lives
- Map: `thoughts/shared/power-map/power-holder-leverage-map-2026-06-20.md` (has a CORRECTION banner)
- Runbook (ground truth, read this first): `thoughts/shared/power-map/RUNBOOK-power-unification.md`
- Staged SQL: `thoughts/shared/power-map/staged-sql/`
  - `..._a4_decollide_person_money.sql` - person->money de-collide (NOT applied)
  - `..._a1_backfill_STEP1_stage.sql` / `_STEP2a_justice.sql` (DONE) / `_STEP2b_donations.sql` (superseded by batched)
  - `run-donations-batched.sh` - the off-peak donations runner
- Memory: `memory/project_power_holder_leverage_map.md` (+ MEMORY.md pointer)

### Key verified facts
- Substrate exists: mv_entity_power_index (187K entities, 7 systems, ABN 99.96%); top 1% hold 86.9% of $1.287T
- mv_abr_name_lookup.norm_name formula STRIPS legal words (Aboriginal|Corporation|Inc|Ltd|Pty|The|Of...), keeps spaces, lowercases, trims - NOT the map's wrong `upper(no-spaces)` formula
- donor_entity_matches.matched_abn has '0' junk (e.g. Australian Greens -> 0, 4,389 rows) - gate `~ '^[0-9]{11}$'`
- justice_funding now has 151,151 rows with gs_entity_id; null recipient_abn down to 7,402 (202 ambiguous + null-name deliberately skipped)
- gs_entities.id is uuid -> use (array_agg(id))[1] not min(id)

### DB access (Tier 3 = Ben runs via `!`)
- Reads: `node --env-file=.env scripts/gsql.mjs "SELECT ..."`
- Writes: `! bash <script>` or `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f <file.sql>`
- Pooler saturates (Small compute, pool 15, 6 projects). If ECHECKOUTTIMEOUT: dashboard pool 15->30 + restart.
