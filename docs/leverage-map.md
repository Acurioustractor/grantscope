# Leverage Map

> Generated + maintained by the **`/leverage` loop**. Maps the data estate × the goals
> (`.claude/skills/leverage/references/goals-register.md`) and ranks the highest-value **latent**
> connections — ones we already have the data for but aren't exploiting. **Connect/deepen, never widen**
> (widening is paused). Every row is grounded in a coverage count. Re-verify before acting.

**Inventory snapshot:** 2026-06-08 · `gs_entities` 598K · `austender_contracts` 810K · `justice_funding`
157K · `oric_corporations` 7.4K · 60+ MVs (last successful refresh 2026-04-30 — **stale**, fix landed,
17:00 UTC cron will clear it). Spine keys: ABN · gs_entity_id · postcode · lga · person · intervention_id.

**Score = readiness × alignment × novelty** (see `references/method.md`). Highest first.

---

## Ranked opportunities

- **OP1 — A "proven Indigenous supplier" evidence layer for buyers.** Datasets: `oric_corporations` ×
  `austender_contracts` (× `gs_entities`) via ABN. Serves: **G4∩G1 (best quadrant)**. Why valuable: **325
  of 3,266 ORIC corps (10%) have won federal contracts** — a defensible shortlist of Indigenous orgs with
  proven delivery, exactly the evidence a buyer with Indigenous-procurement targets needs. Evidence: 325
  ABN-matched. State: **partially-built** — `mv_indigenous_procurement_score` exists; verify it surfaces
  *these* to buyers / `/suppliers`. Effort: S–M. Wedge: **green**.

- **OP2 — Link the 1,116 new VIC suppliers into the registry.** Datasets: `austender_contracts` (vic-) ×
  `gs_entities` × `se_search_index` via ABN. Serves: **G1**. Why valuable: the finished VIC crawl added
  **1,116 distinct supplier ABNs (47% of 2,353) not yet in `gs_entities`** — capability evidence (contract
  titles) sitting unlinked. Evidence: 1,116 unlinked. State: **latent** (feeds `scout-se-buyers`). Effort:
  M. Wedge: **green**. (Cross-ref: health-backlog L5.)

## Dead leads (logged so the loop won't re-mine)

- **justice_funding × ato_tax_transparency (ABN)** → only **184 / 36,805 (0.5%)** overlap. ATO
  transparency covers only >$100M entities; justice recipients are small community orgs. `blocked` — the
  "resourced-vs-struggling recipients" idea has no data behind it. Use ACNC (AIS financials), not ATO.

## To verify next iterations (seed list, not yet coverage-checked)

- `mv_funding_deserts × gs_entities(is_community_controlled)` via lga/postcode → community-controlled orgs
  in funding deserts (G5∩G4).
- `political_donations × austender_contracts` via ABN → likely **already-built** (`mv_gs_donor_contractors`) — confirm, then skip.
- `alma_interventions → alma_evidence → alma_outcomes → justice_funding` via intervention_id/gs_entity_id
  → evidence-backed-intervention funding chain (G3, and G1 if packaged as buyer evidence).

---

<!-- LOOP STATE: iter 0 seeded (inventory + ABN key, 2 connections + 1 dead lead). Facets covered = [ABN
     partial]. Next = finish ABN key (donor-contractor confirm, ACNC financials swap for the dead lead),
     then gs_entity_id, then postcode/lga, then person, then intervention_id. Re-mine after the 17:00 UTC
     MV refresh (fresh MVs change readiness scores). Exit = Ben interrupts. -->
