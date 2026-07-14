# Power-Holder Unification - Runbook & Verified Corrections

Date: 2026-06-20 · Companion to `power-holder-leverage-map-2026-06-20.md`

The leverage map was produced by agents that inventoried the **database** but could not see the **Next.js app**. Verifying its build plan against the app + live schema flipped several items. This runbook is the corrected, ground-truthed version. Read it before acting on the map's section 6.

## What the map got wrong (verified 2026-06-20)

| Map claim | Verified reality | Source |
|---|---|---|
| "Build `mv_abr_name_lookup`" (move A1, effort L) | **Already exists**, 9.04M rows, columns `abn, entity_name, upper_name, norm_name`, with `idx_abr_lookup_norm` btree on the stripped `norm_name`. The "index only covers upper(entity_name)" claim is false. | `pg_class` / `pg_indexes` |
| L4/L6/L9 "shown to no user" | **Already surfaced.** L6 = `/reports/who-runs-australia` (`mv_person_cross_system`). L9 = `/reports/double-dippers` + `/reports/timing` (`mv_donation_contract_timing`). L4 `mv_donor_person_crosslink` wired in `org-dashboard-service`. | `rg` over `apps/web/src` |
| "Build the `/power` UI surface" (Phase C) | **Already a large surface**: `src/app/power/{client.tsx 37KB, capital-map, money-flow, network-graph, place-detail}` + 7 `api/power/*` routes + a `reports/*` suite (power-concentration, power-map, philanthropy-power, power-dynamics, power-network, community-power). | `ls`, `rg` |
| L8 double-count (the gate) | **Confirmed real.** 8 distinct non-nominee people share an identical $7,570,752,694.37 procurement total; 12 share $1.20B; more clusters. | query below |

Net: "do all" is mostly already built. The genuine, not-already-done residue is three things, in order.

## Move A4 - de-collide person -> money (the one verified DB blocker) - STAGED

Root cause: `mv_person_identity_influence` = `SUM(procurement_dollars) ... FROM mv_person_identity_network GROUP BY identity_key`, and each network row carries the **entity's full per-system total**, so every co-director is credited the entity's entire figure.

Fix staged at `staged-sql/2026-06-20_power_a4_decollide_person_money.sql` - a **non-breaking** new MV `mv_person_identity_influence_v2` with proportional attribution (entity dollars split evenly across its directors), the original sums preserved as `*_affiliated`, plus honesty flags (`shares_board_entities`, `max_board_director_count`).

Apply (day-shift, Tier 3):
```
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
  -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f thoughts/shared/power-map/staged-sql/2026-06-20_power_a4_decollide_person_money.sql
```
Then run the verification queries at the bottom of that file. **Correction (verified on apply 2026-06-21):** the "collision query must return zero rows" criterion was naïve. Even-split gives genuine co-directors of one entity the *same* per-director share (e.g. the former $7.57B/8 became $757M/8 — exactly ⅒, since that entity has 10 directors), so the cluster query still returns rows. That is **correct, not a failure**: the real success criterion is that per-person figures **shrink to the per-director share so no dollar is counted twice in aggregate** (the $60.6B phantom from 8×$7.57B collapses to a true $7.57B summed across directors). Even-split fixes *replication*; it cannot make co-directors individually distinct without role/tenure data. Swap any person-money leaderboard to read `*_attributed` columns; show `*_affiliated` only labelled "boards served on", never as personal spend.

Caveat: even-split is proportional by headcount, not weighted by role/tenure. Good enough to publish a ranking; note it in any UI tooltip.

## Move A1-residue - name-resolution backfill - STAGED (written 2026-06-20)

The MV exists; this resolves name-only money rows to ABNs against it. Dry-run verified:
- `justice_funding`: 14,869 name-only rows -> **7,471 unambiguous** ABR matches (202 ambiguous excluded, never guessed). Quality eyeballed clean ("3bridges Community Limited" -> "3BRIDGES COMMUNITY LIMITED").
- `political_donations`: **~497K** null-donor_abn rows resolvable via `donor_entity_matches` (all >= 0.8 confidence), govt entity types (CGE/SGE/LGE) excluded.

CRITICAL: the real `mv_abr_name_lookup.norm_name` formula (verified via `pg_get_viewdef`) STRIPS legal/structural words (Aboriginal, Torres Strait Islander, Corporation, Inc, Ltd, Pty, The, Of ...), keeps spaces, lowercases, trims. The leverage map's `upper(...no-spaces...)` formula was WRONG and would match almost nothing. The staged SQL uses the correct formula.

Two-step safe pattern (both Tier 3, day-shift):
1. `staged-sql/2026-06-20_power_a1_backfill_STEP1_stage.sql` - READ-ONLY on real tables; builds inspectable `_a1_jf_resolved` / `_a1_pd_resolved` staging tables and self-reports counts + quality samples. Run, inspect.
2. `staged-sql/2026-06-20_power_a1_backfill_STEP2_apply.sql` - UPDATEs from the staging tables (fills NULLs only, never overwrites), atomic transaction, before/after counts. Then refresh `mv_entity_power_index` + deps so recovered rows enter the index.

Optional phase 2: postcode tie-break for the 202 ambiguous justice names against `abr_registry` (carries postcode; the MV does not).

## Move B - `get_power_holder()` convenience function - OPTIONAL

`mv_entity_power_index` already is the unified org record (read in 27 files). A `get_power_holder(p_abn text, p_gs_id text, p_name text)` SQL function would consolidate the scattered lookups into one call returning the cross-system footprint (org row + board people + foundation backers + donate-then-win flag). Nice-to-have, not a blocker. Stage as SQL when the leaderboard work lands.

## UI - EXTEND, do not rebuild

`/power` and `/reports/*` already cover map, network, flows, who-runs-australia, double-dippers, timing, power-concentration. The honest UI gap is small: a single cross-system **people leaderboard** reading `mv_person_identity_influence_v2` (after A4) + reverse "who funds this power holder" annotation (L16, `mv_foundation_grantees` WHERE `link_method='relationship'`). Do these as surgical additions to the existing surface, after reading `src/app/power/client.tsx`. Do not stand up a parallel `/power`.

## Status (2026-06-21)

- **A4 de-collide: APPLIED + VERIFIED.** `mv_person_identity_influence_v2` is live (241,260 identities, 142 nominee blocks, 4 indexes). Before/after proof captured: per-person figures dropped to the per-director share (former $7.57B/8 → $757M each), aggregate phantom eliminated. Honest cross-system people leaderboard now publishable → **move C (UI) unblocked.** Verify SQL: `staged-sql/2026-06-20_power_a4_verify.sql`. Old `mv_person_identity_influence` left intact (2 app files still read it; retire in a follow-up once the leaderboard reads `_v2`).
- **A1 STEP 1 (staging): RAN.** `_a1_jf_resolved` (7,471) + `_a1_pd_resolved` (443,494, valid-ABN gated) live on the DB.
- **A1 STEP 2a (justice): COMMITTED.** 7,467 `recipient_abn` + 1,892 `gs_entity_id` backfilled into `justice_funding`. The nightly MV refresh (3am AEST) folds them into `mv_entity_power_index` automatically.
- **A1 STEP 2b (donations): DEFERRED.** `political_donations` writes are pathologically slow on this Small-compute shared DB (8 indexes; a 30K batch ran 18+ min during a contention window). Single-shot times out. Use the batched, resumable runner **off-peak**: `bash thoughts/shared/power-map/staged-sql/run-donations-batched.sh` (10K batches, self-healing, resumes on re-run). ~414K rows, IND excluded, unverified-matcher data so lower priority.
- **Root cause to fix:** the shared Supabase project is under-provisioned (Small compute, pool 15, ~6 projects) - bump compute + pool and the slow writes AND the pooler timeouts both go away.

## Recommended order

1. Review + apply **A4** (staged SQL). Unblocks any honest person leaderboard.
2. **Donations off-peak:** run `run-donations-batched.sh` overnight (justice is already in).
3. Then, only if wanted: the small UI extension + the `get_power_holder()` function.
