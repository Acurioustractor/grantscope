# CivicGraph Power-Holder Leverage Map
**Date: 2026-06-20** · Internal · Audience: Ben Knight

> **CORRECTION (verified 2026-06-20):** This map was produced from database-only recon and over-states the surfacing gap and the build plan. `mv_abr_name_lookup` already exists (9.04M rows, normalized index). L6/L9 are already surfaced (`/reports/who-runs-australia`, `/reports/double-dippers`, `/reports/timing`). The `/power` UI already exists as a large surface. Read `RUNBOOK-power-unification.md` for the ground-truthed plan. The L8 double-count IS real and confirmed. Treat sections 5-6 below as raw signal, not the action list.

## 1. Executive Summary

- **We already hold the substrate for "one place to source every power holder in Australia."** The entity spine `mv_entity_power_index` covers 186,980 entities across 7 systems (procurement, justice funding, political donations, charity registry, foundations, ATO, NDIS), keyed cleanly on ABN (99.96%) and gs_id, with per-system dollar flows. The person spine `mv_person_identity_influence` (241,260 disambiguated identities, nominee-block flagged) sits beside it. The data exists; it is the **surfacing and the entity-resolution that lag**, not the raw graph.
- **Concentration is real and severe.** The top 1% of entities hold **86.9% of $1.287T** in tracked dollar flow; only **10 entities** span all 6 systems (4 universities plus Life Without Barriers, Beyond Blue, Barnardos, EACH, Bravehearts, Churches of Christ QLD); 85.5% of entities touch just one system. This is a defensible headline asset today.
- **Contention (not just concentration) is also live.** Advantaged LGAs (SEIFA decile 9-10) capture ~49x more funding per area than disadvantaged ones; the worst funding deserts (Victoria Daly NT, Mount Magnet WA, desert_score 185) are predominantly Aboriginal communities with near-zero funding. The revolving-door cohort (513 entities, 3+ influence vectors) controls $376.8B, contract-dominated.
- **The single biggest gap is the empty `grantconnect_awards` table (0 rows).** The canonical Commonwealth federal grant-awards feed is absent, so no power holder's federal-grant pull is counted except indirectly and noisily via `justice_funding` source='austender-direct' (95% noise). The schema is well-designed (recipient_abn + gs_entity_id + value + dates) and would join straight onto the spine - this is an ingestion task, not a linkage-design problem.
- **The second-biggest gap is two unreconciled person namespaces.** The ASIC board-derived `identity_key` spine (27,851 identities) and the CRM/enrichment `person_id` spine (14,919 people: email, GHL, LinkedIn, government_influence score) have **no join column**. A real human appears in both but board influence cannot be fused with contact/enrichment. Plus a pre-leaderboard data-quality gate is mandatory: person-money rollups currently double-count a shared entity's procurement across every co-director (8 distinct names sharing an identical $7.571B procurement figure).

---

## 2. Data-Source Inventory

### 2.1 Grants - government & program grant flows

| Table | ~Rows | Join keys | Freshness | Quality issues |
|---|---|---|---|---|
| `justice_funding` | 157,116 | gs_entity_id, recipient_abn, financial_year, state | FRESH - max announcement 2026-03-11, updated 2026-06-19 | 5% null gs_entity_id; 9.5% null/empty recipient_abn; source='austender-direct' (5,250) is 95% noise; must filter `is_aggregate` (rogs rollups) for per-entity work |
| `research_grants` | 46,378 | gs_entity_id, commencement_year, admin_org name | end_date to 2033 (multi-year, not freshness); ~95% linked | **admin_organisation_abn 100% NULL** - join via gs_entity_id or name only; 4.5% null gs_entity_id |
| `vic_grants_awarded` | 5,202 | gs_entity_id, recipient_abn, financial_year | **approval_date 100% NULL** - use financial_year | 34.5% null gs_entity_id; 40% null recipient_abn - weakest grant table for unification |
| `foundation_grantees` | 6,001 | grantee_entity_id, grantee_abn, foundation_abn, grant_year | max grant_year 2026; best-linked grant table | only 1.4% null grantee_entity_id, 2.3% null grantee_abn; grant_year is int not FY-text; confidence is text |
| `grant_opportunities` | 25,513 | foundation_id, provider_org_id, ghl_opportunity_id | FRESH - max created 2026-06-19 | **CATALOGUE of OPEN opportunities, not awarded money - do NOT union into recipient ledger**; 79% null foundation_id |
| `grantconnect_awards` | **0** | gs_entity_id, recipient_abn, ga_id | **EMPTY** | The single biggest grants-domain gap. Well-designed schema, never ingested |
| `rogs_justice_spending` | 15,828 | financial_year only (wide/pivoted by state) | max FY 2024-25 | **No entity/ABN/gs_entity_id key** - govt-level aggregates, denominator/context only |
| `act_grant_recommendation_*` | 12 / 48 | project_code, grant_opportunity_id | operational | ACT-internal config/decisions - exclude from power union, matcher input only |
| `justice_reinvestment_sites` | 13 | state/lga (unconfirmed) | reference table | tiny registry, not a money flow |
| **MV** `mv_grant_contract_overlap` | 4,227 | abn, gs_id, state | nightly | 0 null abn/gs_id - canonical grant-vs-contract overlap; **reuse, don't rebuild** |
| **MV** `mv_evidence_backed_funding` | 2,233 | foundation_abn, grantee_abn | nightly | 0 null on both; scope limited to foundation grants mapping to an ALMA intervention |
| **MV** `mv_foundation_grantees` | 38,615 | foundation_abn, grantee_entity_id, grantee_gs_id | non-concurrent refresh | duplicate-key issues; link_method mixes exact + fuzzy |

### 2.2 Philanthropy - charitable giving & donor power

| Table | ~Rows | Join keys | Freshness | Quality issues |
|---|---|---|---|---|
| `foundations` | 11,075 | acnc_abn, gs_entity_id, name | updated 2026-06-19 (fresh) | 0.2% null acnc_abn; 2% null gs_entity_id; thematic/geographic_focus are text[] (cast before ILIKE) |
| `acnc_charities` | 65,560 | abn, postcode, state, name | updated 2026-06-16 (fresh) | corrupt future registration dates (max 2026-10-21); **no gs_entity_id - join via abn** |
| `acnc_ais` | 359,304 | abn, ais_year | per-year; use `mv_acnc_latest` for snapshot | no gs_entity_id; multi-year rows - always pick latest |
| `acnc_programs` | 98,196 | abn, gs_entity_id, report_year | report_year | gs_entity_id null-rate not audited |
| `political_donations` | 1,681,972 | donor_abn (sparse), donor_name, financial_year | FY 1998-99 to 2024-25; latest donation 2025-06-30 | **~87% null donor_abn** - route via `donor_entity_matches`; donation_date corrupt (max 2106); never ILIKE-join the 1.68M rows |
| `donor_entity_matches` | 9,918 | matched_abn, donor_name_normalized | updated 2026-06-16 | ~87% have matched_abn; **verified=0 on ALL rows** (algorithmic only) - weight by match_confidence |
| `foundation_power_profiles` | 10,114 | foundation_id | has updated_at; classifier_version tagged | classifier-generated scores; respect `reportable_in_power_map` flag |
| `foundation_grantees` | 6,001 | foundation_abn, grantee_abn, grantee_entity_id | updated 2026-05-23 | 2.3% null grantee_abn |
| `nz_charities` | 45,192 | gs_entity_id, name | annual_return_date | NZ jurisdiction - out of AU scope; no ABN |
| `foundation_people` / `_relationship_signals` | 24 / 8 | person_entity_id | seed/partial | trustee coverage really lives in `mv_trustee_grantee_chain` |
| `foundation_categories` / `acnc_ais_line_items` / `notion_grants` / `bgfit_grants` | 0 / 0 / 0 / 0 | - | never ANALYZEd / empty | out of unification scope |

### 2.3 Procurement - government buying power & supplier intelligence

| Table | ~Rows | Join keys | Freshness | Quality issues |
|---|---|---|---|---|
| `austender_contracts` | 851,955 | supplier_abn, supplier_id, buyer_id | DIRTY dates (1753-3411); valid 2024-26 slice = 96,658 rows | filter sane date bounds first; **no gs_entity_id - join via supplier_abn only, never ILIKE**; ~7% null supplier_abn; ~658K dual-key dupes; **buyer side has no buyer_abn** |
| `state_tenders` | 199,702 | gs_entity_id (82%), supplier_abn (98%), state | **STALE - newest award 2021**; updated_at present | 99.99% QLD; VIC (15)/NSW (10) are scaffold rows with 0 keys; best-resolved procurement table by direct gs_entity_id but 4 years stale |
| `goods_procurement_entities` | 4,562 | gs_id (99.7%), abn (99.96%) | last_contact_date (CRM, not contract) | best-keyed by fill rate but a **Goods CRM working-set** hydrated from austender, not authoritative |
| `goods_procurement_signals` | 1,260 | buyer_entity_id (internal id) | updated_at | event/signal feed, not source-of-record |
| `se_buyer_prospects` | 417 | buyer_name (string only) | derived | buyer resolution is fuzzy string-match; lighthouse-buyer source |
| `procurement_alerts` + workflow siblings | 53,223 | shortlist/watch links | operational | app/CRM plumbing - **exclude from power union** |
| `nz_gets_contracts` | **0** | supplier_nzbn, gs_entity_id | EMPTY | NZBN not ABN; exclude unless NZ scope |
| **MV** `mv_justice_proven_suppliers` | 4,227 | gs_id, abn, postcode, lga_name, state | contract history to 2026 | **strongest unification candidate** - justice $ + contract $ + ACNC + ALMA in one row; supplier-only |
| **MV** `mv_triple_proof_suppliers` | 724 | gs_id, abn, lga_name | contract history | justice $ AND contract $ AND evidence; entity_type can be coarse |
| **MV** `mv_indigenous_procurement_score` | 2,635 | agency (name string), year | derived from austender dates | buyer keyed by name only ('QLD QLD Health' doubling artifact); inherits date dirt |

### 2.4 Influence - cross-system power graph & human power-holders

| Table | ~Rows | Join keys | Freshness | Quality issues |
|---|---|---|---|---|
| `mv_entity_power_index` | 186,980 | id, gs_id, abn, postcode, lga_name, state | nightly (no date col) | **THE entity spine** - power_score is derived composite; zero human power-holders |
| `mv_revolving_door` | 6,844 | abn, gs_id, id | nightly | entity-only; 'lobbies' flag is **inferred** (no lobbyist-register table exists) |
| `mv_person_identity_influence` | 241,260 | identity_key, person_name_normalised | nightly; identities rebuilt 2026-06-18 | **canonical disambiguated person spine**; 70% of identity rows are nominee_blocks; 158 residual >10-board leaks; **rollups double-count shared entities** (gate before any leaderboard) |
| `mv_person_entity_network` | 336,444 | person_name_normalised, entity_id, entity_abn | nightly; appointment_date sparse | largest influence MV; person↔entity bridge; keyed on name not identity_key |
| `mv_board_interlocks` | 39,757 | person_name_normalised, organisation_abns[], entity_ids[] | nightly; person_roles loaded 2026-03-26 | name-string key (collision risk); arrays need unnest; no nominee flag |
| `mv_board_power` | 38,199 | **raw person_name** | nightly | raw name (not normalised) - will NOT join cleanly to other person MVs; consolidation candidate |
| `mv_person_influence` | 237,340 | person_name_normalised | nightly | no nominee flag; **deprecate in favour of identity_key version** |
| `mv_donation_contract_timing` | 231,561 | abn, donor_name, contract_id | nightly; real date range | entity-only; cross-product inflates rows - dedupe before aggregating |
| `mv_trustee_grantee_chain` | 178,323 | trustee_name, foundation_abn, grantee_abn | nightly; year-grain | trustee_name string not identity_key; filter `trustee_on_grantee_board=true` for hard signal |
| `person_roles` | 339,698 | person_name_normalised, company_abn, entity_id | last load 2026-03-26 | **source feeding all board MVs**; appointment_date all clustered 2022-08-01 (NOT real); all cessation_date NULL |
| `person_identities` | 27,851 | identity_key, role_id, person_name_normalised | rebuilt 2026-06-18 | 70% nominee_blocks; only 615 distinct normalised names across 27,851 rows |
| `person_identity_map` | 14,919 | person_id, email, ghl_contact_id, linkedin_contact_id | CRM-driven | **DIFFERENT namespace** from identity_key - unreconciled; government_influence score of unknown provenance |
| `person_entity_links` | 2,572 | person_id, entity_id | created/updated_at | CRM person_id → gs_entities; tiny/curated vs 336K name-derived edges; check verified count |
| `person_role_holdings` | 125 | person_id, organization_id | real start/end years | hand-curated political roles; tiny; CRM namespace |
| `donor_entity_matches` | 9,918 | donor_name_normalized, matched_abn | created 2026-06-16 | **verified=0 across ALL rows**; 13% null matched_abn |
| `v_person_360` / `v_goods_relationship_power` | view / view | person_id / entity_id | live | confirm two person graphs exist; Goods-scoped consumer view |

---

## 3. Linkage Matrix

**Lead story - ABN resolution is the master unlock.** The biggest single linkage win is not new data; it is normalising the 20M-row `abr_registry` (entity_name, postcode, state, status) and 2.1M-row `asic_name_lookup` we already hold into a fast name→ABN lookup. A bounded, index-backed join proves **3,133 of 8,838 (35%)** unresolved `justice_funding` recipient names ($24.5B) exact-match an ACTIVE ABR record on name alone - 3,090 unambiguous. The same bridge rescues high-$ political donors (the ~87% with no donor_abn) and the 2,091 null-gs_entity_id research grants. Every name-only record becomes a power-index citizen once this lands. The blocker is that raw joins over 20M ABR rows statement-timeout; the durable fix is a materialised `mv_abr_name_lookup` (see Build Plan §6).

### 3.1 Links Present (verified)

| Source A | Source B | Join key | Bridging MV |
|---|---|---|---|
| `mv_entity_power_index` | `gs_entities` | abn / id / gs_id | (is itself the spine; 99.96% ABN-keyed, 86% LGA-keyed) |
| `justice_funding` | power index / gs_entities | recipient_abn=abn (90.5%) OR gs_entity_id=id (95%) | `mv_grant_contract_overlap`, `mv_justice_proven_suppliers` |
| `justice_funding` (grants) | `austender_contracts` (procurement) | recipient_abn=supplier_abn | `mv_grant_contract_overlap` (4,227, 0 null) - **reuse, don't rebuild** |
| `foundation_grantees` | power index / gs_entities | grantee_abn=abn (97.7%) OR grantee_entity_id=id (98.6%) | `mv_foundation_grantees`, `mv_evidence_backed_funding` |
| `political_donations` | gs_entities | donor_name → `donor_entity_matches`.matched_abn = abn | `donor_entity_matches` (5,896 distinct ABNs join cleanly); verified=0 caveat |
| `political_donations` | `austender_contracts` | shared abn (donor=supplier) | `mv_donation_contract_timing` (231K pairs), `mv_gs_donor_contractors` |
| `mv_person_entity_network` | `mv_entity_power_index` | entity_id=id (99.9% join) | (is itself the person↔entity↔power bridge) |
| `person_roles` | `mv_person_identity_influence` | person_roles.id=person_identities.role_id; identity_key canonical | `person_identities`, `mv_person_identity_influence` |
| `mv_board_interlocks` / `mv_trustee_grantee_chain` | foundations / grantees | organisation_abns[] / grantee_abn / foundation_abn = abn | `mv_trustee_grantee_chain`, `mv_trustee_grantee_overlaps` |
| `state_tenders` (QLD) | power index / gs_entities | gs_entity_id=id (82%) OR supplier_abn=abn (98%) | direct to spine (but data ends 2021) |
| `goods_procurement_entities` | power index / gs_entities | gs_id (99.7%) / abn (99.96%) | `v_goods_relationship_power` |
| `acnc_charities` / `mv_acnc_latest` | gs_entities / power index | abn=abn (no gs_entity_id on acnc) | `mv_acnc_latest`, `in_charity_registry` flag |
| `foundations` | `foundation_power_profiles` | foundations.id=foundation_id (~1:1) | `mv_foundation_scores` |
| `mv_revolving_door` | `mv_entity_power_index` | abn / gs_id / id | (consumer view; 'lobbies' is inferred) |
| `mv_funding_by_lga` / `mv_funding_deserts` | `mv_entity_power_index` | lga_code / lga_name (86% filled) | place → SEIFA disadvantage overlay |
| name-only recipients | gs_entities | recipient/supplier_name → `abr_registry`/`asic_name_lookup` → abn | abr_registry (20M), asic_name_lookup (2.1M) - needs a normalised-name match step |

### 3.2 Links Missing (with fix feasibility)

| Source A | Source B | Missing key | Why it matters | Fix feasibility |
|---|---|---|---|---|
| `grantconnect_awards` | ALL grant/contract/donation systems | **TABLE EMPTY (0 rows)** | **Biggest single gap** - no federal grant pull counted; arrives only via 95%-noise austender-direct | **HIGH** - schema sound (abn+gs_entity_id+value+dates), joins straight to spine. Ingestion task |
| ASIC `identity_key` spine | CRM `person_id` spine | no `identity_key ↔ person_id` column | **CRITICAL** - board influence can't fuse with contact/enrichment (email, GHL, government_influence) | **MEDIUM** - bridge via name_normalised + entity overlap; needs curated crosswalk; collisions/nominee blocks unsafe for pure-name join |
| `political_donations` donors (~87% null abn) | suppliers / gs_entities | donor_abn absent; matches resolve only ~13% | donor-side power undercounted; most individual/small donors unresolvable | **MEDIUM** via name→ABR; individuals have no ABN, must route through person spine |
| `research_grants` (46,378) | ABN-keyed systems | admin_organisation_abn 100% NULL | a university's research pull can't be abn-unioned with its contracts/donations | **HIGH** - gs_entity_id→gs_entities.abn closes most; 2,091 null rows need name→ABR |
| `austender_contracts` BUYERS | gs_entities / power index | no buyer_abn (only buyer_name/buyer_id) | buying power (which agency commands most spend) can't resolve to an entity | **LOW-MEDIUM** - agencies largely absent from gs_entities; needs curated agency registry, not ABR |
| `vic_grants_awarded` | ABN systems | 40% null recipient_abn, 35% null gs_entity_id, approval_date 100% null | over a third of VIC recipients untieable to any other system | **MEDIUM** - name→ABR recovers many; join works once ABN filled |
| `mv_board_power` (raw name) | other person MVs (normalised) | raw vs normalised name; no stable person_id | two MVs describe the same humans under incompatible keys | **HIGH-but-lossy** - re-key through normaliser + attach identity_key; consolidation candidate |
| `rogs_justice_spending` | any recipient ledger | wide/pivoted, NO entity/abn key | govt-level spend, not entity grants | **N/A** for linkage - denominator/context only (filter by unit) |
| `acnc_charities` (abn-only) | person/board spine (KMP) | KMP names in AIS text, no person_id/identity_key | charity governance power can't fuse with ASIC board spine | **MEDIUM** - abn ties org; ACNC-KMP vs ASIC-officeholder need name+org match |
| `grant_opportunities` (forward catalogue) | awarded-money ledger | no recipient / no ABN | must NOT union (would double-count phantom money) | **N/A** - correctly excluded; matcher input only |
| `state_tenders` (ends 2021) | `austender_contracts` (current) | temporal mismatch + no shared contract id | combined supplier total under-weights non-QLD + recent years | ingestion gap (VIC/SA scrapable), not key-design; abn join itself works |

---

## 4. Power Concentration & Contention

Every figure below keeps its `source_table` + `source_query` inline so provenance survives. **Genuine contention** (disadvantage-vs-funding, revolving-door capture) is separated from **raw concentration**.

### 4.1 Cross-System Concentration (entity-level) - `mv_entity_power_index`

**Universities and national charities dominate the peak.** Peak power_score = 21, tied by La Trobe University (VIC) and Macquarie University (NSW), 6 systems each. Only non-university in the top tier is Life Without Barriers (NSW charity, power_score 19, ~$2.60B flow - by far the largest dollar flow in the group). University flows: UQ $383.7M, Adelaide $353.7M, ANU $342.5M, Sydney $264.0M, Monash $239.7M.
> `source_table: mv_entity_power_index` · `source_query: SELECT canonical_name, entity_type, state, system_count, power_score, total_dollar_flow ... ORDER BY power_score DESC, system_count DESC LIMIT 25`

**Exactly 10 entities span all 6 systems** - the true cross-system hubs: La Trobe, Macquarie, Western Sydney, Murdoch (universities) + Life Without Barriers ($2.60B), Beyond Blue, Barnardos Australia ($610.6M), EACH, Bravehearts Foundation, Churches of Christ in Queensland ($683.6M).
> `source_query: SELECT canonical_name ... ORDER BY system_count DESC, power_score DESC LIMIT 25`

**System reach is extremely concentrated.** Of 186,980 entities: 1 system = 159,865 (85.5%); 2 = 23,400 (12.5%); 3 = 3,033 (1.6%); 4 = 574 (0.3%); 5 = 98 (0.1%); 6 = 10 (0.005%). Mean system_count 1.17, median 2. Only 682 entities reach 4+ systems.
> `source_query: SELECT system_count, COUNT(*), ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (),1) ... GROUP BY system_count`

**Dollar-flow concentration is the headline: top 1% (1,006 of 100,660 flowing entities) hold 86.9% of $1.287T** ($1.118T).
> `source_query: WITH r AS (SELECT total_dollar_flow, NTILE(100) OVER (ORDER BY total_dollar_flow DESC) AS pct ... WHERE total_dollar_flow > 0) ... → entities_with_flow=100,660, top1pct_flow=$1,118,314,349,425, total=$1,286,543,142,984, share=86.9%`

**Caveat (read this before quoting the $1.29T):** `total_dollar_flow` sums heterogeneous columns (contract value + justice funding + donations + foundation giving + ATO income), so the absolute is an aggregate of differently-scoped streams - **report the share (86.9%), not the absolute, as the robust signal.** Separately, the power_score top-1% share looks low (3.1%, 1,870 entities) but that is a **thin-integer-scale artifact** of a max-21 capped index with dense ties - use power_score for RANKING/identity, use system_count + dollar flow for the CONCENTRATION claim.

### 4.2 Revolving Door (raw concentration of multi-vector influence) - `mv_revolving_door`

**513 entities hold 3+ influence vectors; 34 hold all four** (lobby + donate + contract + grant); 6,335 hold exactly 2; 6,848 total.
> `source_query: SELECT COUNT(*), COUNT(*) FILTER (WHERE influence_vectors>=3), COUNT(*) FILTER (WHERE influence_vectors=4), COUNT(*) FILTER (WHERE influence_vectors=2) FROM mv_revolving_door`

**The top 25 control $23.31B - and contracts are 99.4% of it** ($23.166B contracts vs $63M donations + $76M grants). Telstra alone is $11.52B (~49% of the top-25). The revolving door here is overwhelmingly about who wins government contracts, with donations/lobbying as smaller co-present levers.
> `source_query: SELECT round(SUM(total_donated)/1e9,3), round(SUM(total_contracts)/1e9,3), round(SUM(total_funded)/1e9,3) FROM (... ORDER BY revolving_door_score DESC LIMIT 25)`

**Top of the list (flag legend l/d/c/f = lobbies/donates/contracts/funded):** 1. Telstra (VIC, 4 vectors, score 22) $11,524.1M · 2. KPMG (NSW) $2,476.5M · 3. Aspen Medical (ACT) $1,755.1M · 4. Built Pty Ltd (NSW) $1,150.6M · 7. Macquarie Group (NSW, 3 vectors) $839.8M · 14. Luerssen Australia (WA, defence) $2,981.7M · 19. VMware $600.6M · 20. ANU (ACT, 4 vectors) $342.5M · 22. Monash University (VIC, 4 vectors) $239.7M · 25. Murdoch University (WA) $55.8M. Notable: 4 universities and a solar-industry charity hold all four vectors alongside primes. Australia Post has the largest donations book in the top 25 ($17.19M).
> `source_query: SELECT canonical_name, entity_type, state, influence_vectors, revolving_door_score, (lobbies::int::text||donates...||...) AS l_d_c_f, round(total_donated/1e6,2), round(total_contracts/1e6,2), round(total_funded/1e6,2) ... ORDER BY revolving_door_score DESC LIMIT 25`

**The full 3+ vector cohort (513 entities) controls $376.84B** - the top 25's $23.31B is only ~6% of that. Contention is broad, not just a handful of primes.
> `source_query: SELECT round(SUM(total_donated+total_contracts+total_funded)/1e9,2), COUNT(*) FROM mv_revolving_door WHERE influence_vectors>=3`

*Provenance note: live MV returned 6,848 rows (matches the brief), vs 4.7K in CLAUDE.md - the MV has been re-aggregated since. All figures above are from the current state.*

### 4.3 Board Interlocks (human power-holders) - `mv_board_interlocks` + `mv_person_identity_influence`, filtered `NOT is_nominee_block AND board_count<=10`

**Susan Rix and Cheryl Herbert top the genuine circuit, 10 boards each, interlock_score 1061.** Rix: $104.0M procurement, the UnitingCare/Blue Care QLD cluster (Blue Care, QPAC, QUT, UCQ). Herbert: $45.9M procurement, connects a community-controlled org (ARRCS, Blue Care, Lives Lived Well, UnitingCare Community).
> `source_table: mv_board_interlocks` · `source_query: SELECT person_name_display, board_count, interlock_score::bigint, total_procurement_dollars::bigint, max_entity_system_count, connects_community_controlled ... WHERE board_count<=10 ORDER BY board_count DESC, interlock_score DESC LIMIT 20`

**Interlock_score (not board_count) is the real separator** because the nominee filter caps board_count at 10. Top dollar exposure: Andrew Thomas (score 1022, $751.5M, Australian Childhood Foundation / Job Futures), Nancy Fox (1019, $412.8M, Mission Australia), Amy Brown (1018, $400.6M).

**Sector-cluster interlockers:** Sonya Beyers (community housing QLD/SA/Tas, score 954), Damien O'Brien (St Vincent's QLD group, $227.1M, 771), Brian Mascord (Wollongong diocese funds, 739), Shane Solomon (Cabrini group, 722), Francis Sullivan (Jesuit Social Services + church-reform, 718).

**Indigenous/community-controlled board reach is thin among top interlockers:** acco_boards = 0 for 23 of the top 25; only Cheryl Herbert and Natalie Smith connect a community-controlled org. The high-power governance circuit is overwhelmingly mainstream/institutional (UnitingCare, Mission Australia, Catholic health, Cabrini, St Vincent's).
> `source_table: mv_person_identity_influence` · `source_query: SELECT person_name, board_count, acco_boards, financial_system_count ... WHERE NOT is_nominee_block AND board_count<=10 ORDER BY board_count DESC LIMIT 25`

**DATA-QUALITY GATE - the financial-footprint ranking is corrupted at the head.** Claire Rogers ($7.72B, 4 boards) and Brendan Murphy ($7.65B, 7 boards) top it, but immediately below, **8 distinct people share an IDENTICAL $7,647,225,803 footprint / $7,570,752,694 procurement** (Annette Ruhotas Morgan, Andrea Sutton, Christopher Kwong, Michael Ferraro, Louise McCosker, Garry Nolan, Elizabeth Smith, Kuldeep Singh) - a single mega-entity's procurement attributed in full to every co-director. **Use board_count/interlock_score, not financial_footprint, as the power signal.**
> `source_query: SELECT person_name, board_count, (COALESCE(total_procurement,0)+...+total_donations)::bigint AS financial_footprint, total_procurement::bigint ... WHERE NOT is_nominee_block AND board_count<=10 ORDER BY financial_footprint DESC LIMIT 25`

**The trustworthy intersection** (high board_count AND high dollars, not in the collision cluster): catherine taylor (9 boards, $2.72B), Mellissa Naidoo (8, $1.98B), John Wakefield (9, $1.67B), Susan Rix (10, $1.66B), Cheryl Herbert (10, $1.66B), Helen Szoke (4, $3.03B incl. $24.9M donations).

### 4.4 Funder Concentration

**Foundations giving is moderately concentrated: top 10 = 22.4%, top 50 = 52.3% of $12.50B** across 10,159 funders.
> `source_table: foundations` · `source_query: WITH ranked AS (SELECT total_giving_annual AS g, ROW_NUMBER() OVER (ORDER BY total_giving_annual DESC) AS rn ... WHERE >0) → top10=$2.80B, top50=$6.54B, total=$12.50B, n=10,159`

**CAVEAT - the raw leaderboard conflates operating revenue with grantmaking.** The unfiltered top is service charities/institutions whose "giving" is really operating revenue: World Vision $514.1M, University of Sydney $340.7M, Catholic Education Centre $281.5M, Monash $273.7M, Australian Red Cross $265.7M. **Filtered to genuine grantmakers:** Geoffrey Cumming Foundation $250M (PAF), Headspace $209.2M, BHP Foundation $195.1M, Rio Tinto Foundation $153.7M, Coles Group Foundation $132.7M, Fortescue $54.9M, CSL $54.0M, Lowy $50.0M, Wesfarmers $45.3M.
> `source_query: SELECT name, type, total_giving_annual FROM foundations WHERE >0 AND (type ILIKE '%foundation%' OR name ILIKE '%foundation%') ORDER BY total_giving_annual DESC LIMIT 10`

**Political donations are top-heavy: top 10 = 22.3%, top 50 = 40.1% of $142.30B** across 35,175 distinct donors.
> `source_table: political_donations` · `source_query: WITH agg AS (SELECT donor_name, SUM(amount) AS total ... GROUP BY donor_name) ... → top10=$31.70B, top50=$57.11B, total=$142.30B, n=35,175`

**The Clive Palmer cluster is the single most dominant donor entity: $11.85B across 1,477 records** (Sino Iron & Korean Steel $8.11B + Mineralogy $3.74B) - over 5x the next genuine donor.
> `source_query: SELECT SUM(amount), COUNT(*) FROM political_donations WHERE donor_name IN ('Sino Iron Pty Ltd & Korean Steel Pty Ltd','Mineralogy Pty Ltd') → $11,847,076,480 (n=1,477)`

**CAVEAT - the raw $142.3B is polluted** by electoral commissions (AEC $6.74B, VEC $1.59B, NSWEC split $1.37B+$1.34B), ATO ($1.67B), payment processors (Cardtronics $1.28B/31,538 records, Pulse $1.74B, Prosegur $991M, EZE ATM $675M), and banks (Westpac $1.91B, CBA split). After excluding these, **genuine large donors:** NSW Nurses & Midwives' Association $2.24B, Greaton Development $1.89B, Abelshore $1.11B, BERT Training Fund $912M, Finance Sector Union $672M, Woolworths $594M, Liberal Party of Australia $562M. **Casing-duplicate donor names fragment true totals - entity-name normalisation is needed before treating rankings as final.**
> `source_query: SELECT donor_name, SUM(amount), COUNT(*) ... GROUP BY donor_name ORDER BY total DESC LIMIT 15 (and filtered NOT IN (...) AND NOT ILIKE '%bank%')`

### 4.5 CONTENTION - Disadvantage vs Funding (the equity signal)

**The headline injustice: advantaged LGAs capture ~49x more funding per area than disadvantaged ones.** The 59 most-advantaged LGAs (SEIFA IRSD decile 9-10) pull an average $3.03B each (total $178.6B); the 45 most-disadvantaged (decile 1-2) pull an average $61.1M each (total $2.75B). The entire disadvantaged band's combined funding is smaller than a single affluent LGA's haul.
> `source_table: mv_funding_deserts` · `source_query: WITH d AS (SELECT lga_name, state, MAX(avg_irsd_decile) dec, MAX(total_funding_all_sources) f ... GROUP BY lga_name, state) SELECT CASE WHEN dec<=2 ... END AS band, COUNT(*), SUM(f), AVG(f) GROUP BY 1`

**Worst funding deserts (desert_score 185, the table max):** Victoria Daly NT (Remote, decile 1, IRSD 793, 1 entity, **$0 funding**) and Mount Magnet WA (Very Remote, decile 1, IRSD 864, 3 entities, **$52,286**). Both predominantly Aboriginal communities.
> `source_query: SELECT lga_name, state, MAX(remoteness), AVG(avg_irsd_decile), MAX(indexed_entities), MAX(total_funding_all_sources), MAX(desert_score) ... WHERE desert_score IS NOT NULL GROUP BY lga_name, state ORDER BY desert_score DESC LIMIT 25`

**Top 25 deserts are overwhelmingly Very Remote WA/SA + remote NT/QLD, decile 1-2** (desert_score 151.7-185): WA dominates (Mount Magnet, Coolgardie 172.3, Murchison 170, Halls Creek 165), SA next (Kimba 165.8, Port Augusta 165), plus NT (Victoria Daly 185), QLD (Mount Isa 165), NSW (Carrathool 160), VIC (Yarriambiack 155). **Halls Creek WA and Wyndham-East Kimberley WA have strong community-controlled presence (28 and 24 CC entities) but still desert-score 160-165 - the orgs exist, the money doesn't follow.**

**Inverse contention - affluent capture:** North Sydney NSW (decile 10) $31.1B; Ryde NSW (8.5) $14.5B; Canada Bay NSW (8.6) $9.87B; Port Phillip VIC (8.0) $8.91B; Ku-ring-gai NSW (10) $3.94B. **CAVEAT:** much of this is corporate/contractor HQ registration (dollars booked where the supplier is registered, not where need is), not local community benefit.
> `source_table: mv_funding_by_lga` · `source_query: SELECT lga_name, state, AVG(avg_seifa_decile), MAX(entity_count), MAX(total_funding) ... WHERE avg_seifa_decile>=8 AND total_funding>0 AND lga_name NOT ILIKE '%unincorporated%' GROUP BY lga_name, state ORDER BY max_funding DESC LIMIT 15`

**Excluded govt artefact:** Unincorporated ACT $79.3B (decile 8.3, 8,166 entities) is where federal departments and Canberra-registered suppliers book contracts - a registration artefact, NOT community injustice. Excluded from the affluent-capture analysis.

*Data-quality note: `mv_funding_deserts` and `mv_funding_by_lga` have duplicate LGA rows (one $0, one real); all dollar figures deduplicated via `GROUP BY ... MAX(total_funding)`. 766 of 1,970 desert rows have NULL desert_score and were excluded. SEIFA/desert_score signals unaffected (identical across the duplicate pair).*

---

## 5. Latent Links We Are Sitting On (confirmed only)

| # | Latent link | Refined join path | Coverage (verified) | Value hypothesis | Effort |
|---|---|---|---|---|---|
| L1 | **ABR name bridge for unresolved justice_funding recipients** | `justice_funding`(abn NULL) → `upper(entity_name)` = `abr_registry` WHERE status='Active' (idx_abr_entity_name_upper); 1 active row resolves clean, postcode tie-break for 43 ambiguous; write back abn → gs_entity_id → power index | 3,133/8,838 names (35%), $24.5B; 3,090 unambiguous | Real funded service orgs (Aboriginal corps, CLCs, YJ providers) slot straight into power index, gaining power_score + austender join | **M** |
| L2 | **ABR bridge for high-$ political donors** | `political_donations`(abn NULL, amt≥10k) agg to `upper(donor_name)` → `abr_registry` (partial index, do NOT wrap entity_name in trim); EXCLUDE entity_type_code IN ('CGE','SGE','LGE'); → power index / revolving_door | 293/top-2000 names (15%, before gov-noise filter) | Connects donors to the same entity's contracts + grants - the revolving-door signal; today no-ABN donors can never enter `mv_revolving_door` | **M** |
| L3 | **Materialize `mv_abr_name_lookup` feeding the power index** | Build from `abr_registry` WHERE status='Active', norm_name = `upper(regexp_replace(entity_name,'[^A-Za-z0-9]','','g'))` + btree index; LEFT JOIN all name-only sources on same normalisation; **pre-filter line-item rows** ('- Total', 'unspecified recipient', 'Various - Confidential') | Bridges L1+L2 at once + grants + foundations names; existing index only covers `upper(entity_name)` not stripped form (cause of timeouts) | One reusable resolution layer turns every name-only record into a power-index citizen; removes per-query timeout. **$24.5B figure is an upper bound until line-item-filtered** | **L** |
| L4 | **Cross-system power-holder leaderboard from `mv_donor_person_crosslink`** | 294 pre-joined rows → `/person/[name]` via person_name_normalised; sort power_score DESC; filter system_count>=3 → ~150 multi-system people | 294 fully-resolved people; **150** at system_count≥3 (Palaszczuk $344.7M contracts + $35.2M justice; Allan Myers $25.7M + 7 boards) | The single most concentrated cross-system person artifact, consumed in 1 file, shown to no user. A public "Top power holders" table is the headline asset. `is_politician` flag unreliable | **S** |
| L5 | **Politician-donors with $0 contracts/justice (pure-influence tier)** | `mv_donor_person_crosslink` WHERE is_politician=true (47 rows, all aggregated) | 47 politicians, exactly 0 with contracts, 0 with justice - flag cleanly discriminates | Segments power graph into elected vs private-capital influence; one-click "show elected officials in this network" | **S** |
| L6 | **Charity-board directors who bankroll parties (named, party-level)** | `mv_person_cross_system` (282 rows, both flags uniformly true) → display_name, total_donated, parties_funded_list[]; sort by total_donated for "who funds which party" | 282 rows, 282 with party lists (0 null): Crouch $648K/8 conservative parties/6 boards; Farquhar $2.52M/Climate200+Qld Greens; Wood $2.51M/7 parties | Textbook soft-power pattern with party-level granularity. API already returns top-20; surfacing gap is in page.tsx (shows aggregate stat, not the named drill-down) | **S** |
| L7 | **Person → entity → dollars drill-down** | `mv_person_identity_network` (328,939 rows, entity_id 100% non-null → gs_entities.id hard FK); filter NOT is_nominee_block (311,949 real, 49,077 money-bearing) | ~49K money-bearing person→entity edges across ~64K entities | Decomposes a person's total into "which board entity got $X from which system" - auditable breakdown beneath each rollup. **Money cols are entity-total-per-system replicated across board seats - surface as board affiliation, not personal spend** | **M** |
| L8 | **De-collide person→money rollup (PRE-LEADERBOARD GATE)** | `mv_person_identity_influence` totals vs per-edge truth in `mv_person_identity_network` grouped by identity_key | 8 distinct names share identical $7.571B/96 contracts; pattern repeats (12 sharing $1.2B; 5 sharing $1.6B); not caught by is_nominee_block | **The single biggest blocker to shipping ANY person-money leaderboard.** Attribute entity dollars proportionally / flag shared-entity inflation. Per memory rule: verification gate BEFORE scoring | **M** |
| L9 | **Donate-then-win timing flag on the entity power record** | `mv_donation_contract_timing`.abn → `mv_entity_power_index`.abn (160/160 fast-donor ABNs matched, 0 loss); add `fastest_donate_to_contract_days` + `pay_to_play_flag` | 160 entities within 365d; 89 within 30d, 47 in 91-365d. Deloitte 0d/$12.8B, Macquarie 12d/$6.7B, Thales 0d, Telstra | Most damning signal we own and never surface where it counts. Turns weak boolean into ranked/dated proximity flag. **SUM(contract_value) double-counts across pairs - use distinct contract value** | **M** |
| L10 | **roi_multiple as per-entity "donation leverage"** | `mv_donation_contract_timing` (231,561 cartesian pairs, roi 100% populated) → roll up per abn using SUM(DISTINCT donation)/SUM(DISTINCT contract), NOT raw SUM → 183 distinct ABNs → power index | 183 ABNs (not 160); rolls up clean | Pairs "how fast" with "how much leverage". **"$112K into $5.8B" headline is fabricated if taken off raw SUMs - dedup required** | **S** |
| L11 | **Fold donate-then-win timing into revolving_door_score** | `mv_donation_contract_timing`.abn → `mv_revolving_door`.abn (183/183 matched, 0 loss) | 183 of 6,844 entities gain directional/temporal boost (Aspen Medical score 22, Macquarie, Minerals Council) | Makes the canonical power rank causal-looking ("moved money through the cycle in this order within N days") not co-incidental | **M** |
| L12 | **Place → power-holder lookup (LGA)** | `mv_funding_by_lga`.lga_name = `mv_entity_power_index`.lga_name; filter total_dollar_flow>0, ORDER BY total_dollar_flow DESC (power_score ties heavily - secondary sort only) | 483/489 LGAs (98.8%) reconcile; 159,993 place-attributable, 100,660 with flow. Brisbane top: Boeing Defence $21.4B, Airbus $10B | THE place→power-holder primitive. Today geo MVs say "Brisbane got $X across N entities" but never name WHO. Names already sit in the index | **S** |
| L13 | **Postcode → power-holder lookup (latent places/[postcode] page)** | `mv_entity_power_index` WHERE postcode=$1 AND total_dollar_flow>0 ORDER BY total_dollar_flow DESC | 94,897 flowing entities across **2,415** postcodes (not 7.3K - that's mv_funding_by_postcode). 0870: Scope Building NT $104M, Pedersen NT $68.5M, Ninti One $67M | Finer than LGA for remote/place-based work (Alice Springs). Existing page shows aggregates with no named holders; one WHERE clause away | **S** |
| L14 | **Who captures the little funding in disadvantaged LGAs** | Dedup `mv_funding_deserts` to one row/LGA first, then JOIN `mv_entity_power_index` ON lga_name+state (avoid cross-state collisions), filter avg_irsd_decile≤4 AND total_dollar_flow>0 | 233 disadvantaged LGAs, 20K distinctly-named entities. Sample: BAE Systems, General Dynamics, Sitzler capturing billions in most-disadvantaged LGAs | Highest-signal accountability version: in the most disadvantaged, least-funded places, WHICH orgs nonetheless capture the flow. **Raw join fans out - dedup desert MV first** | **S** |
| L15 | **Foundation downstream-power rollup (relationship tier)** | `mv_foundation_grantees`.grantee_entity_id = `mv_entity_power_index`.id, FILTER link_method='relationship', GROUP BY foundation; agg SUM(power_score) + COUNT(DISTINCT grantee) | 4,389/4,702 grantees (93%), 26 clean-tier foundations. FRRR 2,287 grantees/46,461 power; Ian Potter 1,454/22,035 | Turns each foundation into a downstream power footprint ("Ian Potter's grantees move $22B / touch N buyers"). **MUST filter to relationship tier - justice_funding tier duplicates a 194-grantee blob across all 1,497 foundations** | **S** |
| L16 | **Reverse annotation: "who funds this power-holder"** | `mv_foundation_grantees` WHERE link_method='relationship' GROUP BY grantee_entity_id → array_agg(foundation_name), count, sum(grant_amount) → LEFT JOIN onto power index keyed id | 4,389 of 4,702 grantees annotated; power index has ZERO reverse-annotation columns today | Inverts L15 - "who bankrolls this power holder?" answerable off the entity page. Makes power index self-describing about philanthropic backing. grant_total nullable where grant_amount absent | **S** |
| L17 | **Trustee-chain grantees → power index via ABN resolution** | `mv_trustee_grantee_chain`.grantee_abn = `mv_entity_power_index`.abn (text equality, NULL excluded); dedup (trustee_name, grantee_abn) before edge insert | 168,232/171,064 ABN-bearing rows (98.3%), 4,472 distinct grantees | People-layer of philanthropic power: named trustee → downstream cross-system clout of funded orgs. MV exposes grantee_abn but no grantee_entity_id, so ABN-resolution pass required (not a one-line join) | **M** |

---

## 6. Build Plan to Unify

Ordered. **Entity resolution comes first** - every downstream artifact's coverage depends on it. Tier-3 (Supabase migration apply, day-shift, human-in-loop) is flagged explicitly per the AFK boundary; MV/column adds and backfills are Tier-3 applies.

### Phase A - Entity-resolution backfill (foundation, do first)

**A1. `mv_abr_name_lookup` (L3).** Materialize a normalised name→ABN lookup from `abr_registry` WHERE status='Active': `norm_name = upper(regexp_replace(entity_name,'[^A-Za-z0-9]','','g'))` plus a btree index on norm_name (the existing index only covers `upper(entity_name)`, which is why raw joins time out). Pre-filter aggregation/line-item rows.
*Activates:* the reusable bridge under L1, L2, and all name-only grants/foundations.
*Effort:* **L** · *Deps:* none · **Tier-3 migration apply (day-shift).**

**A2. Backfill `justice_funding.recipient_abn` from A1 (L1).** Single set-based `UPDATE` via `psql -f` (not exploratory CTE - projection variants timeout under the pooler). Resolve clean where exactly one active ABR row; postcode/state tie-break for the 43 ambiguous; then derive gs_entity_id via gs_entities.abn.
*Activates:* L1 - 3,133 recipients ($24.5B upper bound) enter the power index.
*Effort:* **M** · *Deps:* A1 · **Tier-3 (data-modifying SQL, day-shift).**

**A3. Backfill high-$ donor ABNs from A1 (L2).** Aggregate no-ABN donations ≥$10K to upper(donor_name), join A1, EXCLUDE entity_type_code IN ('CGE','SGE','LGE') to drop electoral commissions/treasuries, write recovered abn to a donor-resolution table.
*Activates:* L2 - donors enter `mv_revolving_door`/power index, lighting up the revolving-door signal.
*Effort:* **M** · *Deps:* A1 · **Tier-3 (day-shift).**

**A4. De-collide the person→money rollup (L8) - MANDATORY GATE before any person leaderboard.** Re-attribute entity dollars proportionally (or flag shared-entity inflation) by joining `mv_person_identity_influence` totals against per-edge truth in `mv_person_identity_network` grouped by identity_key. Per the memory rule (verification before scoring), this precedes the leaderboard, not follows it.
*Activates:* makes L4/L7 publishable; without it the influence_score ordering is corrupt at the head.
*Effort:* **M** · *Deps:* none · **Tier-3 if it rebuilds the MV (day-shift).**

### Phase B - The unified power-holder object

**B1. `mv_power_holder` + `get_power_holder(abn | gs_id | name)` SQL function.** Returns a single cross-system footprint object for any org or person:
- **Org path:** key on abn/gs_id → pull `mv_entity_power_index` (power_score, system_count, per-system dollar flow, in_* flags) + `mv_revolving_door` (vectors, donate-then-win flag from L9) + `mv_grant_contract_overlap` (grants vs contracts) + `mv_acnc_latest` (charity financials) + foundation-funder array (L16) + LGA/SEIFA place (L12) + concentration rank (top-1% / system-count percentile).
- **Person path:** key on identity_key (or name → identity via `person_identities`, nominee-filtered) → `mv_person_identity_influence` (de-collided per A4) + board seats from `mv_board_interlocks` + per-entity breakdown (L7) + donations + `is_politician`/party (L6, with the unreliable-flag caveat).
- `name` path routes through A1's normaliser for resolution.

*Activates:* L4, L7, L9, L12, L15, L16 in one object. This is the "one place to source every power holder" primitive.
*Effort:* **M** (function) + **L** (MV if materialized) · *Deps:* A1-A4 · **Tier-3 (day-shift).**

**B2. Annotate `mv_entity_power_index` with the rider columns.** Add `fastest_donate_to_contract_days` + `pay_to_play_flag` (L9, use distinct contract value), `funded_by_foundations text[]` + `foundation_funder_count` + `foundation_grant_total` (L16), and fold donate-then-win into `revolving_door_score` (L11).
*Activates:* L9, L11, L16 directly on the spine so the power-index API and entity profile select them.
*Effort:* **M** · *Deps:* A3, B1 · **Tier-3 (column adds + recompute, day-shift).**

### Phase C - The `/power` UI surface (in-app, Server Components per Rule #6)

**C1. `/power` search + power-holder profile.** Search any ABN/name/gs_id → `get_power_holder()` → render full footprint: grants + philanthropy + contracts + board seats + donations + concentration rank + place (LGA/SEIFA). Includes the contention framing (revolving-door flag, donate-then-win timing) and the affiliation-not-spend caveat on person dollar columns.
*Activates:* surfaces B1/B2 to users.
*Effort:* **M** · *Deps:* B1, B2 · *Tier 1 (app code).*

**C2. Wire latent lookups into existing pages (quick wins, no migration):**
- Place → power-holder list on `mv_funding_by_lga` pages (L12) and `places/[postcode]` (L13).
- Funding-desert → named-capturer drill-down (L14).
- Public "Top power holders" leaderboard from `mv_donor_person_crosslink` (L4) with the politician facet (L5).
- Surface the named board-donor party drill-down already in the who-runs-australia API (L6) - fix is in page.tsx only.

*Activates:* L4, L5, L6, L12, L13, L14 - most are S-effort UI wiring against already-clean data.
*Effort:* **S each** · *Deps:* A4 for L4 only · *Tier 1 (app code).*

### Phase D - Close the structural gaps (larger, separable)

**D1. Ingest `grantconnect_awards` (the biggest single gap).** Schema is ready (recipient_abn + gs_entity_id + value + dates); joins straight onto the spine. Ingestion task, not linkage design. **Tier-3 (data load + likely deploy).**
**D2. Reconcile the two person namespaces (identity_key ↔ person_id).** Curated crosswalk via name_normalised + entity overlap; pure-name join is unsafe (collisions/nominee blocks). `person_entity_links` hints at the intended bridge. **Effort M-L.**
**D3. Consolidate `mv_board_power` (raw name) into the normalised person spine** - re-key + attach identity_key; deprecate `mv_person_influence` in favour of the identity version.

### Recommended first 3 moves

1. **A1 - build `mv_abr_name_lookup`.** Highest leverage, unblocks everything else (L1, L2, all name-only sources) and kills the per-query timeout. Tier-3 apply, day-shift.
2. **A4 - de-collide the person→money rollup.** The mandatory gate; without it no person leaderboard is publishable (8-name $7.571B collision). Do it before C1/L4 ship.
3. **C2 quick wins - place → power-holder (L12/L13) + the L4 leaderboard.** Pure app wiring against already-verified, already-clean MVs; demonstrates the "one place to source every power holder" promise immediately while A2/B1 land. (L4 depends on A4 being done first.)