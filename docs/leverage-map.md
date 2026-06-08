# Leverage Map

> Generated + maintained by the **`/leverage` loop**. Maps the data estate × the goals
> (`.claude/skills/leverage/references/goals-register.md`) and ranks the highest-value **latent**
> connections — ones we already have the data for but aren't exploiting. **Connect/deepen, never widen**
> (widening is paused). Every row is grounded in a coverage count. Re-verify before acting.

**Inventory snapshot:** 2026-06-08 · `gs_entities` 598K · `austender_contracts` 810K · `justice_funding`
157K · `oric_corporations` 7.4K · 60+ MVs (all 34 nightly MVs refreshed clean **2026-06-08 10:04 AEST —
fresh**; root cause of the 38-day staleness was a 120s role-level `statement_timeout`, fixed via
`ALTER ROLE postgres … = 0`, cron self-heals tonight). Spine keys: ABN · gs_entity_id · postcode · lga ·
person · intervention_id.

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

> **Premium tier (iter 4): OP7/OP8** are the *governance-deepened* versions of OP3/OP1 — the same buyers,
> the same wedge play, but each org carries **three** independent proof signals instead of two. Fewer rows
> (724 / 278), strictly deeper evidence. Per the wedge ("depth beats row count"), OP7 is a candidate to
> *replace* OP3 in the headline as the premium shortlist; OP3 stays as the broad tier.

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
  titles) sitting unlinked. Evidence: 1,116 unlinked. State: **BUILT 2026-06-08** — 1,116 entities created
  as `AU-ABN-*` (confidence=reported, entity_type=company); VIC suppliers now 0 unlinked. Migration
  `20260608040000_op2_link_vic_suppliers.sql`. **Downstream TODO (Ben/Tier-2):** re-run `scout-se-buyers`.
  Effort: M. Wedge: **green**. (Cross-ref: health-backlog L5.)

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
  `/suppliers` profiles. Evidence: 983 of 1,502 linked (65%). State: **BUILT 2026-06-08** — a
  `Program Evidence` section on `/social-enterprises/[id]` surfaces the ALMA programs plus the
  cited-studies / measured-outcomes chain for the ~100 SE profiles whose ABN resolves to an
  ALMA-linked entity (`getEntityEvidencePrograms` in `report-service.ts`, commit `eab192a`; uses the
  caller's live client, not the report snapshot). Effort: M. Wedge: **green**. **Even stronger** than
  the inline signals: the full chain *is* joinable via the junctions
  `alma_intervention_evidence`/`alma_intervention_outcomes` — **348 entity-linked interventions have
  BOTH cited evidence AND measured outcomes**, the gold-standard buyer proof.

- **OP7 — Triple-proof justice/community suppliers (the premium buyer shortlist).** Datasets:
  `justice_funding` × `austender_contracts` × `acnc_charities` via ABN. Serves: **G3∩G1 (best quadrant)**.
  Why valuable: **724 orgs carry all three proofs at once** — justice-domain delivery + a won federal
  contract + ACNC charity governance/financials. That is the deepest defensible "this supplier is real,
  capable, and well-governed" shortlist in the estate; it's the 17% of OP3's 4,225 that also stand up to a
  governance check. Exactly the wedge's #1 asset (evidence depth), stacked. Evidence: 724 ABN-matched
  across 3 sources (all fresh 2026-06-08). State: **BUILT 2026-06-08** — `mv_triple_proof_suppliers`
  (724 rows, migration `20260608020000`); registered in manual + nightly cron refresh; triple-proof badge
  live on `/suppliers` (fires for the 166 that are SEs). Effort: M. Wedge: **green**. (Refines OP3 →
  premium tier.) **Follow-up:** a browsable buyer list for the 558 non-SE triple-proof orgs.

- **OP8 — Triple-proof Indigenous suppliers.** Datasets: `oric_corporations` × `austender_contracts` ×
  `acnc_charities` via ABN. Serves: **G4∩G1 (best quadrant)**. Why valuable: **278 of OP1's 325 (86%)
  contract-winning ORIC corps are also ACNC charities** — Indigenous-controlled orgs with proven federal
  delivery *and* charity-grade governance. A buyer with Indigenous-procurement targets gets a shortlist
  that already clears the governance bar. The 86% co-incidence is itself a finding: contract-winning ORIC
  corps are overwhelmingly ACNC-registered. Evidence: 278 ABN-matched across 3 sources. State:
  **partially-built** (`mv_indigenous_procurement_score` has the oric×contracts pair; ACNC is the
  deepening). Effort: S–M. Wedge: **green**. (Refines OP1.)

- **OP9 — Conflict-of-interest risk flag on supplier profiles (narrow).** Datasets: `mv_entity_power_index`
  (`in_procurement` × `in_political_donations` × `distinct_parties_funded` / `parties_funded`). Serves:
  **G1 (tender-tools — the risk leg)**, but narrowly. Why valuable: **2,085 of 57,262 suppliers (3.6%)
  also donate to political parties** — a defensible conflict-of-interest flag for buyer due-diligence on a
  *named* supplier. Evidence: 2,085 supplier-donors; **but only 3 community-controlled and 126 charity
  suppliers carry it** — the SE/registry supply base is essentially **clean of political entanglement**, so
  the flag fires on large corporates, not the wedge's core SEs. State: **latent** (flags exist in
  `mv_entity_power_index`, not surfaced as risk). Effort: **S** (data already computed). Wedge:
  **green-but-narrow** — real for per-supplier due-diligence, near-zero as a registry-wide SE signal; **NOT
  a Top-3**.
  - *Mission sub-angle (de-ranked per wedge):* **392 justice-funded suppliers (8.3%) also donate to
    parties** — a G3 "public money meets political influence" accountability thread, but that belongs to
    the accountability-ledger strand, not the buyer wedge.

- **OP10 — Quad-proof suppliers (the gold tier).** Datasets: `mv_triple_proof_suppliers` ×
  `alma_interventions` (× `alma_intervention_evidence` × `alma_intervention_outcomes`) via gs_entity_id.
  Serves: **G3∩G1 (best quadrant, deepest)**. Why valuable: **54 of the 724 triple-proof orgs also carry
  an ALMA intervention with BOTH cited evidence AND measured outcomes** — a *fourth* independent proof.
  The deepest defensible "this works, and they can deliver it" shortlist in the estate: domain delivery +
  federal contract + charity governance + evidence-of-what-works. Newly minable now that OP7's MV exists
  (iter 6). Evidence: 54 quad-proof; 99 of 724 have any ALMA link. State: **BUILT 2026-06-08** —
  `has_alma_evidence_outcomes` flag on `mv_triple_proof_suppliers` (54 true, migration `20260608050000`) +
  "Proven outcomes" gold badge live on `/suppliers` (fires for the 14 quad-proof that are SEs). Effort: **S**
  (done). Wedge: **green**. (Premium-of-the-premium; tiny by rows, deepest by evidence — the wedge's
  depth>rows thesis at its limit.)

## Dead leads (logged so the loop won't re-mine)

- **G2 claim-magnet: SEs with delivery evidence but unclaimed (iter 8)** → only **2** of 11,861 SEs have
  contract delivery AND an `identified` (unclaimed) tier. The SEs with proven delivery are almost all
  already `verified`/`certified` via registers (ACNC/ORIC/Supply Nation); unclaimed directory profiles
  rarely have contract matches. The "claim your profile — you've delivered $X" magnet has no volume.
  `thin` — and G2 is low-value by design (never revenue) anyway. Don't re-mine.
- **VIC new entities × justice / acnc / federal (iter 7)** → of the 1,116 newly-linked VIC suppliers
  (OP2), **0 are in justice_funding, 0 in ACNC, only 5 have federal contracts**. They're net-new
  *commercial* VIC vendors (the charity/justice/federal ones were already in gs_entities via earlier
  backfills, which is why they weren't in the unlinked set). No cross-jurisdiction evidence-stack — OP2's
  value is registry capability evidence (contract titles), not cross-system depth. `thin` — don't re-mine.
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

<!-- LOOP STATE: iter 8 done — LOOP COMPLETE. Mined the last facet G2 (claim-magnet) = THIN (2 targets).
     That's 2 consecutive empty iters (7 VIC cross-jurisdiction, 8 G2). ALL 5 join keys + ALL 5 goals now
     mined. Map final: Top-3 synthesis + OP1-OP10 + 5 dead leads. Builds shipped this session: cron fix,
     OP7 (mv_triple_proof_suppliers + badge), OP2 (1,116 VIC entities), SE index + buyer prospects rebuilt.
     NO AUTO-WAKE scheduled — the estate is mined out; re-waking would only re-confirm "nothing new". The
     loop should ONLY resume when genuinely new DATA lands (a new crawl, an enrichment run, or a build like
     OP10's flag) — re-invoke /leverage then. A refresh of existing structures does NOT count as new state.
     Cheapest next ship if continuing: OP10 has_alma_evidence_outcomes flag + "Proven outcomes" badge.
     Exit = Ben. -->
<!-- LOOP STATE: iter 5 done — mined the risk-signal facet (mv_entity_power_index in_procurement ×
     in_political_donations). Result NARROW: 2,085/57,262 suppliers (3.6%) donate to parties but only 3 are
     community-controlled — the SE base is clean, so the COI flag fires on big corporates, not wedge supply.
     Logged as OP9 (green-but-narrow, NOT Top-3) + the "SE base is clean" finding + a de-ranked G3 accountability
     sub-angle (392 justice-funded donors).
     SEAMS NOW LARGELY EXHAUSTED: all 5 pair-keys (iters 0-3) + ABN triple-stacks (iter 4) + risk signal (iter 5)
     mined. Only unmined facet = G2 supply-magnet, which is low-value by design (never revenue). Diminishing
     returns — the high-value move now is BUILDING (OP7 724 triple-proof / OP2 link VIC suppliers), not more mining.
     PARKED (~3600s) until new state: a build landing (e.g. OP7 MV), a finished crawl, or an enrichment run.
     On wake: re-inventory; if no new state, mine G2 once then stop. Exit = Ben interrupts. -->
