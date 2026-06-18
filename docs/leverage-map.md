# Leverage Map

> Generated + maintained by the **`/leverage` loop**. Maps the data estate × the goals
> (`.claude/skills/leverage/references/goals-register.md`) and ranks the highest-value **latent**
> connections — ones we already have the data for but aren't exploiting. **Connect/deepen, never widen**
> (widening is paused). Every row is grounded in a coverage count. Re-verify before acting.

**Inventory snapshot:** 2026-06-18 · `gs_entities` ~606K · `gs_relationships` **2,370,061** (+411,389 today:
justice grant +81,493 → 138,123; person board/role +329,896 → 334,982 via PR #89). **All 38 MVs refreshed
clean 2026-06-18 07:42 AEST.** The person/board layer went **5,086 → 334,982 edges (65×)** — which REVIVES
the iter-2 person-facet dead lead (was "built-but-hollow, 4/2 rows"). See **Person facet REVIVED (iter 9)**
below. Spine keys: ABN · gs_entity_id · postcode · lga · **person (now dense)** · intervention_id.
(Prior snapshot 2026-06-08: `austender_contracts` 810K · `justice_funding` 157K · `oric_corporations` 7.4K.)

**Score = readiness × alignment × novelty** (see `references/method.md`). Highest first.

---

## Top 3 to build — synthesis (all 5 keys mined, iters 0–3)

All three are **evidence-depth** plays — the wedge's stated #1 tie-breaker ("evidence depth beats row count").

1. **OP3 · Justice-domain proven suppliers** — 4,225 justice-funded orgs that *also* won federal contracts
   (G3∩G1). Biggest best-quadrant base, net-new. The headline buyer asset.
2. **OP5 · ALMA evidence signals on profiles** — 983 entity-linked interventions with curated evidence +
   portfolio scores, surfaced on `/suppliers` (G3→G1). Highest readiness; directly deepens the registry.
3. **OP1 · Indigenous proven suppliers** — **BUILT 2026-06-08** — 301 *active* ORIC corps with won federal
   contracts (G4∩G1). `mv_indigenous_proven_suppliers`; surfaces as the red **"Indigenous-proven"** badge on
   `/suppliers` + profiles, orthogonal to the OP3 justice hierarchy (88 orgs carry both).

> **Enabler underneath all three: OP2** — link the 1,116 new VIC supplier ABNs into `gs_entities` so the
> fresh procurement evidence flows into the same profiles.

> **Premium tier (iter 4): OP7/OP8 — both BUILT 2026-06-08.** The *governance-deepened* versions of OP3/OP1
> — the same buyers, the same wedge play, but each org carries **three** independent proof signals instead
> of two. Fewer rows (724 / 265), strictly deeper evidence. Per the wedge ("depth beats row count"), OP7 is
> a candidate to *replace* OP3 in the headline as the premium shortlist; OP3 stays as the broad tier. OP8
> ships the same play for the Indigenous axis (**"Indigenous triple-proof"** badge, strongest-wins over OP1).

---

## Person facet REVIVED (iter 9 — 2026-06-18, post +330K person-edge recovery)

**The dead lead is alive.** Iter 2 logged the person facet as a dead lead: board→contractor/donor was
"built-but-hollow, 4 rows / 2 rows … sparse person↔entity linkage." That sparsity was the *bug* fixed by
PR #89 — person board/role edges went **5,086 → 334,982 (65×)**. Re-mined; every row below is grounded in a
post-recovery count. This is the first facet that surfaces **PEOPLE as the connective tissue** between the
funding systems — the procurement-probity / accountability angle the entity-only layer couldn't reach.

- **OP11 — "The Connectors" people/power screen (surface `mv_board_interlocks`).** Datasets:
  `mv_board_interlocks` (person × org boards × procurement$/justice$/donation$) via gs_entity_id/person.
  Serves: **G1 (evidence/probity) ∩ G3/G4 (justice$ + community-controlled flag) — best quadrant.** Why
  valuable: a freshly-refreshed, rich per-person interlock dataset — **39,757 interlocked people** with
  `board_count, organisations[], total_procurement_dollars, total_justice_dollars, total_donation_dollars,
  total_power_score, interlock_score, connects_community_controlled` — and **nothing surfaces it.** Biggest
  plumbing-vs-storefront gap in the estate: the data is computed, ranked, fresh; it just needs a UI.
  Evidence: 39,757 rows, MV built+fresh 2026-06-18. State: **latent (MV ready, no surface).** Effort: **S–M**
  (surface an existing MV). Wedge: **green**. ← **THE `/polish` target.**

- **OP13 — Cross-system director bridges: supplier ↔ justice-funded org (best quadrant).** Datasets:
  `gs_relationships(person_roles)` × `(austender)` × `(justice_funding)` via gs_entity_id. Serves:
  **G3∩G1 (best quadrant).** Why valuable: **5,509 directors sit on the board of BOTH a federal supplier
  AND a justice-funded org** — the people who literally connect the procurement system to justice funding.
  The accountability-graph headline; "follow the person across the money." Evidence: 5,509. State: **latent.**
  Effort: M. Wedge: **green** (per-supplier due-diligence) / mission accountability strand.

- **OP12 — Director interlocks across federal suppliers (concentration / probity radar).** Datasets:
  `person_roles` × `austender` via gs_entity_id (filter `mv_board_interlocks` to procurement>0 & board_count≥2).
  Serves: **G1 (tender-tools — the risk leg).** Why valuable: **1,849 people sit on ≥2 federal-supplier
  boards** — exactly what a probity officer needs ("do these 'competing' bidders share directors?").
  **Overturns the iter-2 dead lead** (`mv_board_contractor_links` was 4 rows → 1,849 real interlocks).
  Evidence: 1,849. State: **latent.** Effort: S. Wedge: **green**.

- **OP14 — Director-is-donor conflict flag (person-level COI).** Datasets: `person_roles` ×
  `political_donations` via normalised name. Serves: **G1 (tender-tools risk).** Why valuable: **1,222
  directors are also political donors** — deepens OP9 (which was *entity*-level, fired only on big corporates)
  to the PERSON level: a supplier whose *director* donates even when the org doesn't. The board data is
  ACNC/ORIC-sourced (NFP-heavy), so unlike OP9 this may reach the wedge's SE supply base. Evidence: 1,222
  name-matched. State: **latent.** Effort: M. Wedge: **green** — **verify-next:** which sector the 1,222 fall
  in (homonym risk on name-only match; needs ABN/entity disambiguation before it's buyer-grade).

> **Coverage honesty:** only **3,097 of 51,019 federal suppliers (6%) have a board layer** — board data is
> ACNC/ORIC-sourced, so it covers the **NFP/charity/SE supplier subset**, not commercial vendors. Within that
> subset the interlock signals above are dense and real. An *evidence-depth* play on the wedge's core supply
> base, not a universal flag. (ASIC director data would widen the base — paused, out of scope.)

> **⚠ DATA-QUALITY GATE (blocks naive surfacing — `feedback_data_quality_before_scoring`):** person entities
> are keyed by normalised NAME (`GS-PERSON-<slug>`), so every common name collapses distinct people into one
> node. `mv_board_interlocks` head is poisoned: **101 nodes have >50 boards** (e.g. "Mark Smith" = 714 boards),
> **2,492 more at 6–50** — homonym megamerges, not real brokers. **The good news: 37,164 (93.5%) sit at a
> plausible 2–5 boards.** So the LONG TAIL is real but a `ORDER BY interlock_score DESC` leaderboard shows
> fakes first. Implication for OP11–OP14: the counts (1,849 / 5,509 / 1,222) are directionally right but
> inflated at the head; **any surface or score must exclude/flag high-board-count nodes as
> "ambiguous name — not disambiguated"** before it's buyer-grade. NOT introduced by PR #89 — a latent person-
> resolution limit that density made visible. Real fix: person disambiguation (ABN/co-occurrence), a deepen
> not a widen → a new high-value OP in its own right. Cheap interim: cap board_count + a collision flag.

---

## Ranked opportunities (full, iters 0–3)

- **OP1 — A "proven Indigenous supplier" evidence layer for buyers.** Datasets: `oric_corporations` ×
  `austender_contracts` (× `gs_entities`) via ABN. Serves: **G4∩G1 (best quadrant)**. Why valuable: **325
  of 3,266 ORIC corps (10%) have won federal contracts** — a defensible shortlist of Indigenous orgs with
  proven delivery, exactly the evidence a buyer with Indigenous-procurement targets needs. Evidence: 325
  ABN-matched. State: **BUILT 2026-06-08** — `mv_indigenous_proven_suppliers` (301 rows, migration
  `20260608080000`; the 25 *deregistered* ORIC corps are excluded — a buyer shortlist must not recommend a
  wound-up corp). NB the pre-existing `mv_indigenous_procurement_score` is *agency*-side IPP compliance, not
  a supplier shortlist — this MV is the supplier-side build. Surfaces as the red **"Indigenous-proven"** badge
  on `/suppliers` search + `/social-enterprises/[id]`, an ORTHOGONAL axis to OP3's justice hierarchy (88 orgs
  carry both badges; 9 also clear the ALMA gold tier). Registered in manual + nightly cron refresh. 300 of
  301 are reachable in the search index + directory. Effort: S–M. Wedge: **green**.

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
  gets a defensible shortlist. Evidence: 4,225 ABN-matched. State: **BUILT 2026-06-08** —
  `mv_justice_proven_suppliers` (4,225 rows, migration `20260608060000`; triple-proof MV minus the
  ACNC gate, ACNC kept as optional signal). Registered in manual + nightly cron refresh. Surfaces as
  the **"Proven govt delivery"** badge on `/suppliers` search and `/social-enterprises/[id]` profiles
  (strongest-of-three hierarchy: Proven outcomes > Triple-proof > Proven govt delivery). Commit
  `5dcff2a`. Effort: M. Wedge: **green**. (Highest-volume best-quadrant find so far.)

- **OP4 — Financial-health signal on justice-funded charities.** Datasets: `justice_funding` ×
  `acnc_ais` via ABN. Serves: **G3**. Why valuable: justice recipients that are ACNC charities with AIS
  financials → flag which delivery orgs are financially fragile (the resourced-vs-struggling question the
  dead ATO lead couldn't answer). State: **BUILT 2026-06-09** — `mv_justice_charity_financial_health`
  (**3,996 rows**; migration `20260609000000`, cron-registered `20260609010000`). The 4,366 ACNC overlap
  narrows to 3,996 charities that actually filed an AIS. Latest-AIS-per-ABN; computes 4 transparent
  ratios (surplus margin, current ratio, reserves-runway months, govt-revenue share) + 5 raw flags, rolled
  into a `fragility_tier` (**healthy 53% / watch 30% / fragile 13.5% / unknown 3%**). **Data-quality gate
  was load-bearing:** balance-sheet split (current assets/liabs) is only filed by ~49% → `low_liquidity` is
  NULL-when-unknown, never inferred false. And reserves-runway is the MASTER solvency signal so a weak
  current ratio never alone flags an asset-rich org fragile (caught universities — 20+ months reserves,
  sub-1 current ratio — being mislabelled; fixed). Surfaces as a **"Financial Health"** section on
  `/social-enterprises/[id]`, framed as a supportive capacity signal (where multi-year/capacity support
  may help), not a buyer warning; no search-results badge (Ben's call — avoids a scarlet-letter effect).
  Effort: M. Wedge: **supply-magnet / mission** (not direct revenue).

- **OP6 — Community-controlled orgs in funding deserts (the named list).** Datasets: `mv_funding_deserts`
  × `mv_entity_power_index(is_community_controlled)` via (lga_name, state). Serves: **G5∩G4**. Why valuable:
  the worst-100 desert LGAs hold **665 community-controlled orgs** — **13% of the 4,984 indexed orgs there**,
  **~89% Aboriginal & Torres Strait Islander corporations**, across **56 LGAs**, and **374 of the
  665 run on zero tracked funding** — the orgs serving the hardest-hit places. The MV had the *counts*; the
  named list is now surfaced. **Data note:** the count is sourced from `mv_entity_power_index` (the same source
  `mv_funding_deserts.community_controlled_entities` aggregates), so the named list reconciles **exactly** with
  the displayed count (665 = 665). **Figures revised twice 2026-06-09 (102 / 29% → 565 / 12% → 665 / 13%):**
  the `postcode_geo.state` NULL backfill (migration `20260609020000`) filled 227 blank-state LGAs and collapsed
  the phantom zero-entity splits that had padded the old worst-100 (→565); then the C5 state-contradiction fix
  (migration `20260609030000`, `gs_entities`+`postcode_geo` from `lga_code`) moved border-LGA entities to their
  correct state, re-sorting the worst-100 again (→665). The corrected worst-100 is now real desert LGAs that
  actually have orgs; the page computes live so it tracks the truth automatically. State: **BUILT
  2026-06-09** — a "Who's Already There" section on `/reports/funding-deserts` (named, profile-linked via
  `/entity/{gs_id}`, with Charity/Contracts/Justice evidence tags + tracked-$ flow), and the list exposed on
  `/api/data/funding-deserts` as `communityControlledInDeserts` (the outreach/registry export the link
  promises). Shared SQL + mapper in `lib/funding-deserts.ts` keeps page and API in sync. No new MV/migration
  for OP6 itself (the data was latent in existing MVs). Effort: S. Wedge: **supply-magnet / mission**.
  **State data-quality now fixed (C5 done 2026-06-09):** the border-LGA contradictions (Laverton NT→WA etc.)
  were corrected across `gs_entities` (6,949 rows) + `postcode_geo` (130) from `lga_code`, all 38 MVs refreshed.

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
  `acnc_charities` via ABN. Serves: **G4∩G1 (best quadrant)**. Why valuable: **265 of OP1's 301 (88%)**
  *registered* contract-winning ORIC corps are also ACNC charities — Indigenous-controlled orgs with proven
  federal delivery *and* charity-grade governance. A buyer with Indigenous-procurement targets gets a
  shortlist that already clears the governance bar. The 88% co-incidence is itself a finding: contract-winning
  ORIC corps are overwhelmingly ACNC-registered. Evidence: 265 ABN-matched across 3 sources. State:
  **BUILT 2026-06-08** — ACNC governance added as an OPTIONAL `has_acnc` flag onto `mv_indigenous_proven_suppliers`
  (migration `20260608100000`, mirroring OP3→OP7's pattern; the MV keeps all 301 rows, 36 stay
  Indigenous-proven, 265 upgrade). Surfaces as the **"Indigenous triple-proof"** badge (red-on-black) on
  `/suppliers` search + `/social-enterprises/[id]`, strongest-wins over the basic OP1 badge within the
  Indigenous axis (orthogonal to the OP3 justice hierarchy — South Coast Medical Service carries BOTH the
  justice "Triple-proof" and "Indigenous triple-proof"). New `indigenous_triple_proof` flag in
  `supplier-search.ts`. No new cron migration (MV name + refresh registration unchanged). Verified live:
  301 rows · 265 triple-proof · 9 gold; badge correct on all three surfaces. Effort: S–M. Wedge: **green**.
  (Refines OP1 → premium Indigenous tier, the OP1 analogue of OP7.) **NB:** the 278/325 figure in the
  original find predated OP1's registered-only scoping; 265/301 is the verified post-scope count.

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

<!-- LOOP STATE: iter 9 done (2026-06-18) — PERSON FACET REVIVED by new DATA (the exact resume trigger the
     iter-8 note named: "ONLY resume when genuinely new DATA lands"). PR #89 took person board/role edges
     5,086 → 334,982 (65×) + justice grants → 138,123; all 38 MVs refreshed. Re-mined the person facet that
     iter 2 had logged DEAD (sparse linkage). Added OP11-OP14 (all latent, all green): OP11 "The Connectors"
     screen surfacing mv_board_interlocks (39,757 ppl, rich schema, ZERO surface) = THE /polish target;
     OP13 supplier↔justice director bridges (5,509, best quadrant); OP12 shared directors across suppliers
     (1,849, overturns the iter-2 dead lead); OP14 director-is-donor COI (1,222, verify sector next).
     Coverage caveat logged: 6% of suppliers have a board layer (NFP/SE subset). NOT auto-waking — Ben chained
     /polish next (build/surface OP11). Verify-next if leverage resumes: OP14 sector split; person→postcode
     (where do the connectors cluster). Exit = Ben. -->
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
