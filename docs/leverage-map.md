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

## Top 3 to build — synthesis (all 5 keys mined, iters 0–3)

All three are **evidence-depth** plays — the wedge's stated #1 tie-breaker ("evidence depth beats row count").

1. **OP3 · Justice-domain proven suppliers** — 4,225 justice-funded orgs that *also* won federal contracts
   (G3∩G1). Biggest best-quadrant base, net-new. The headline buyer asset.
2. **OP5 · ALMA evidence signals on profiles** — 983 entity-linked interventions with curated evidence +
   portfolio scores, surfaced on `/suppliers` (G3→G1). Highest readiness; directly deepens the registry.
3. **OP1 · Indigenous proven suppliers** — 325 ORIC corps with won federal contracts (G4∩G1); mostly built
   in `mv_indigenous_procurement_score`, so the fastest to ship.

> **Enabler underneath all three: OP2** — link the 1,116 new VIC supplier ABNs into `gs_entities` so the
> fresh procurement evidence flows into the same profiles.

---

## Ranked opportunities (full, iters 0–3)

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

- **OP3 — Justice-domain proven suppliers for buyers.** Datasets: `justice_funding` ×
  `austender_contracts` via ABN. Serves: **G3∩G1 (best quadrant)**. Why valuable: **4,225 of 36,805
  justice-funded orgs (11.5%) have also won federal contracts** — orgs with *both* domain credibility
  (justice delivery) and a proven procurement track record. A buyer needing community/justice services
  gets a defensible shortlist. Evidence: 4,225 ABN-matched. State: **latent**. Effort: M. Wedge:
  **green**. (Highest-volume best-quadrant find so far.)

- **OP4 — Financial-health signal on justice-funded charities.** Datasets: `justice_funding` ×
  `acnc_charities` / `mv_acnc_ais_yearly` via ABN. Serves: **G3**. Why valuable: **4,366 (12%)** justice
  recipients are ACNC charities with AIS financials → flag which delivery orgs are financially fragile
  (the resourced-vs-struggling question the dead ATO lead couldn't answer). Evidence: 4,366 ABN-matched.
  State: **latent**, moderate coverage. Effort: M. Wedge: **supply-magnet / mission** (not direct revenue).

- **OP6 — Community-controlled orgs in funding deserts (the named list).** Datasets: `mv_funding_deserts`
  × `gs_entities(is_community_controlled)` via lga. Serves: **G5∩G4**. Why valuable: the worst-100 desert
  LGAs hold **108 community-controlled orgs** (27% of the 401 indexed orgs there) — the orgs serving the
  hardest-hit places. The MV has the *counts*; the named-org list for outreach/registry is latent.
  Evidence: 108 in worst-100 LGAs. State: **partially-built** (counts exist, list latent). Effort: S.
  Wedge: **supply-magnet / mission**.

- **OP5 — ALMA evidence signals on supplier/entity profiles.** Datasets: `alma_interventions` (inline
  `evidence_strength_signal` + `portfolio_score` + `verification_status`) × `gs_entities` via gs_entity_id.
  Serves: **G3→G1 (evidence depth — the wedge's #1 tie-breaker)**. Why valuable: **983 entity-linked
  interventions carry curated evidence + portfolio scores** — surface them as buyer-facing proof on
  `/suppliers` profiles. Evidence: 983 of 1,502 linked (65%). State: **latent** (signals exist, not
  surfaced). Effort: M. Wedge: **green**. **Even stronger** than the inline signals: the full chain *is*
  joinable via the junctions `alma_intervention_evidence`/`alma_intervention_outcomes` — **348 entity-linked
  interventions have BOTH cited evidence AND measured outcomes**, the gold-standard buyer proof.

## Dead leads (logged so the loop won't re-mine)

- **justice_funding × ato_tax_transparency (ABN)** → only **184 / 36,805 (0.5%)** overlap. ATO
  transparency covers only >$100M entities; justice recipients are small community orgs. `blocked` — the
  "resourced-vs-struggling recipients" idea has no data behind it via ATO. **Resolved iter 1 → OP4**:
  ACNC AIS financials cover 4,366 (12%), 24× the ATO route — that's the live version of this idea.
- **person key: board → contractor / donor (iter 2)** → entity-level influence is already-built
  (`mv_revolving_door`, 6,706 rows), but `mv_board_contractor_links` (4 rows) and `mv_board_donor_links`
  (2 rows) are **built-but-hollow** — the person→procurement/donation join yields almost nothing. Not a
  leverage OP; it's a data-quality flag (sparse person↔entity linkage). Cross-ref health-backlog.
- **~~alma_evidence/outcomes orphaned~~ — CORRECTED (post-iter-3).** Not orphaned: they link to
  interventions via the junctions `alma_intervention_evidence` (2,065 links) / `alma_intervention_outcomes`
  (2,060 links). The iter-3 "blocked at the data model" call was wrong — I checked for `intervention_id` on
  the evidence tables and missed the junctions. CLAUDE.md was stale (claimed a direct `intervention_id`);
  fixed 2026-06-08. The chain is fully available — see the strengthened OP5. `mv_evidence_backed_funding`
  (2,233 rows) is a separate funding rollup.

## To verify next iterations (seed list, not yet coverage-checked)

- `mv_funding_deserts × gs_entities(is_community_controlled)` via lga/postcode → community-controlled orgs
  in funding deserts (G5∩G4).
- *(resolved iter 1)* `political_donations × austender_contracts` → **already-built**
  (`mv_gs_donor_contractors`, 1,442 rows). Skip.
- *(resolved iter 1)* `alma_interventions × gs_relationships` → 547/590 (93%) in graph, **already-built**
  (`mv_intervention_funding_chain`). Deepening angle (**OP5 candidate, not yet built**): package
  `alma_evidence` / `alma_outcomes` as buyer-facing proof on intervention orgs (G3→G1).

---

<!-- LOOP STATE: iter 3 done — ALL 5 keys mined (ABN, gs_entity_id, postcode/lga, person, intervention_id).
     Map: Top-3 synthesis + OP1-OP6. iter 3 added OP5 (ALMA inline evidence signals) + alma-orphan flag.
     Loop PARKED: next state = 17:00 UTC MV refresh. On wake gate-check mv_refresh_log success >= 2026-06-08;
     if flipped, re-score readiness (fresh MVs) + mine any new state. Exit = Ben interrupts. -->
