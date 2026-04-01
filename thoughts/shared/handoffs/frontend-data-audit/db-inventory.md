# CivicGraph Database Inventory
**Audited:** 2026-04-02  
**Purpose:** Comprehensive reference of all tables, materialized views, and data available in the CivicGraph Supabase database (project `tednluwflfhxyucgwigh`).

---

## Summary Stats

| Category | Count |
|----------|-------|
| Public tables | 491 |
| Materialized views | ~48 |
| Total rows (estimated) | ~32M+ |
| Core entity graph | 587K entities, 1.53M relationships |

---

## Core Graph Tables

### `gs_entities` — 587,307 rows
The central entity registry. Every org, person, company, charity, foundation, and government body in the graph.

**Key columns:** `gs_id`, `canonical_name`, `abn`, `entity_type`, `sector`, `postcode`, `state`, `remoteness`, `seifa_irsd_decile`, `is_community_controlled`, `lga_name`, `lga_code`

**Entity type breakdown:**
| entity_type | count |
|-------------|-------|
| company | 264,410 |
| person | 238,256 |
| charity | 53,973 |
| foundation | 10,748 |
| indigenous_corp | 7,827 |
| social_enterprise | 5,176 |
| program | 3,960 |
| government_body | 2,891 |
| political_party | 66 |

---

### `gs_relationships` — 1,535,772 rows
All connections between entities. Core of the graph.

**Relationship type breakdown:**
| relationship_type | count |
|-------------------|-------|
| contract | 904,047 |
| directorship | 328,918 |
| donation | 103,450 |
| shared_director | 95,476 |
| grant | 86,729 |
| member_of | 2,858 |
| lobbies_for | 2,453 |
| subsidiary_of | 1,234 |
| affiliated_with | 505 |
| partners_with | 44 |

**Dataset breakdown (top 20):**
| dataset | count |
|---------|-------|
| austender | 904,047 |
| acnc_register | 322,163 |
| aec_donations | 103,450 |
| person_roles_crossmatch | 95,476 |
| justice_funding | 56,630 |
| nhmrc_grants | 9,310 |
| grant_opportunities | 5,444 |
| person_roles | 5,077 |
| foundation_board | 4,246 |
| hms_trust_grants | 3,591 |
| frrr_grants | 3,588 |
| creative_australia | 3,394 |
| lobbying_register_nsw | 1,800 |
| ian_potter_grants_db | 1,716 |
| abr_corporate_groups | 1,204 |
| arc_grants | 1,045 |
| qld_arts_grants | 959 |
| foundation_charity_match | 505 |
| lotterywest_grants | 470 |
| acnc | 284 |

---

### `gs_entity_aliases` — 16,634 rows
Name aliases and historical names for entities.

### `entity_identifiers` — 30,934 rows
Cross-reference IDs: ABN, ACN, ASIC codes, etc. per entity.

### `entity_xref` — 1,193,379 rows
Large cross-reference table linking entity IDs across datasets.

### `canonical_entities` — 14,921 rows
Deduplicated/canonical entity records (subset of gs_entities).

### `person_identity_map` — 14,919 rows
Maps person names across datasets for deduplication.

---

## Procurement & Contracts

### `austender_contracts` — 796,701 rows (est.)
Federal procurement contracts from AusTender. Includes NSW and QLD state procurement (~16K rows).

**Key columns:** `title`, `contract_value`, `buyer_name`, `supplier_name`, `supplier_abn`, `contract_start`, `contract_end`, `category`, `unspsc_code`

### `state_tenders` — 199,694 rows
State government procurement disclosures.

**Breakdown by source/state:**
| source | state | count |
|--------|-------|-------|
| qld_doe_disclosure | QLD | 94,628 |
| qld_dcyjma_disclosure | QLD | 45,665 |
| qld_dcssds_disclosure | QLD | 37,494 |
| qld_dcsyw_disclosure | QLD | 15,466 |
| qld_corrective_disclosure | QLD | 3,503 |
| qld_desbt_disclosure | QLD | 1,628 |
| qld_dyj_disclosure | QLD | 688 |
| qld_dyjvs_disclosure | QLD | 599 |
| nsw_etender | NSW | 10 |

**Key columns:** `source`, `source_id`, `title`, `description`, `contract_value`, `status`, `category`, `state`, `buyer_name`, `buyer_department`, `supplier_name`, `supplier_abn`, `published_date`

### `procurement_alerts` — 53,222 rows
Watchlist/alert records for procurement monitoring.

---

## Justice & Social Funding

### `justice_funding` — 218,022 rows
Social sector funding (justice, child protection, NDIS, community services) by state governments.

**By state:**
| state | count | total ($) |
|-------|-------|-----------|
| QLD | 140,018 | $59.7B |
| NSW | 10,374 | $22.3B |
| VIC | 2,242 | $16.8B |
| WA | 533 | $8.0B |
| NT | 265 | $5.3B |
| SA | 1,472 | $3.2B |
| ACT | 1,338 | $2.2B |
| TAS | 197 | $1.6B |
| National | 10 | $102M |

**Key columns:** `recipient_name`, `recipient_abn`, `gs_entity_id`, `program_name`, `amount_dollars`, `state`, `financial_year`, `sector`, `topics` (text array with GIN index)

---

## Charities & ACNC

### `acnc_charities` — 64,724 rows
ACNC charity register snapshot. Foundation for charity data.

**Key columns:** `abn`, `name`, `charity_size`, `state`, `postcode`, `purposes`, `beneficiaries`, `is_foundation`

### `acnc_ais` — 359,678 rows
ACNC Annual Information Statements — multi-year financial data per charity.

### `acnc_programs` — 98,196 rows
Programs reported by ACNC charities in their AIS submissions.

---

## Foundations

### `foundations` — 10,837 rows
Australian philanthropic foundations.

**Key columns:** `name`, `acnc_abn`, `total_giving_annual`, `thematic_focus` (array), `geographic_focus`

### `foundation_programs` — 2,687 rows
Specific grant programs offered by foundations.

### `foundation_power_profiles` — 10,008 rows
Enriched power/influence profiles for foundations.

---

## Grants

### `grant_opportunities` — 30,724 rows
Live and historical grant opportunities.

**By source:**
| source | count |
|--------|-------|
| brisbane-grants | 15,252 |
| arc-grants | 5,598 |
| qld-arts-data | 4,959 |
| nsw-grants | 1,591 |
| ghl_sync | 1,139 |
| foundation_program | 1,123 |
| wa-grants | 197 |
| qld-grants | 156 |
| grantconnect | 142 |
| tas-grants | 103 |
| act-grants | 95 |
| nt-grants | 78 |
| sa-grants | 69 |
| vic-grants | 38 |

**Key columns:** `name`, `amount_min`, `amount_max`, `deadline`, `categories`, `focus_areas`, `source`

### `research_grants` — 46,378 rows
ARC and NHMRC research grant records.

**By source:**
| source | count | total ($) |
|--------|-------|-----------|
| arc | 34,475 | $18.5B |
| nhmrc | 11,903 | $10.7B |

**Key columns:** `source`, `grant_code`, `scheme_name`, `program`, `title`, `lead_investigator`, `investigators`, `admin_organisation`, `admin_organisation_abn`, `funding_amount`

### `opportunities_unified` — 9,851 rows
Unified/deduplicated grant opportunities across sources.

---

## Political & Donations

### `political_donations` — 301,803 rows (est.)
AEC political donation disclosures.

**Key columns:** `donor_name`, `donor_abn`, `donation_to`, `amount`, `financial_year`

---

## Tax & Financial

### `ato_tax_transparency` — 23,909 rows
ATO tax transparency data for large entities.

**Key columns:** `entity_name`, `abn`, `total_income`, `taxable_income`, `tax_payable`, `report_year`

---

## People & Boards

### `person_roles` — 339,698 rows
Board/executive roles across all datasets (ACNC 334K, foundation 4.5K, parliament 582).

**Key columns:** `person_name`, `organisation_name`, `organisation_abn`, `role_title`, `source`, `start_date`, `end_date`

### `person_entity_links` — 2,572 rows
Direct links from person records to gs_entities.

---

## NDIS Data

### `ndis_utilisation` — 143,987 rows
NDIS service utilisation by district, age group, disability type, support class, quarter.

**Key columns:** `service_district`, `state`, `age_group`, `disability_type`, `support_class`, `utilisation_rate`, `participant_count`, `reporting_period`, `quarter_date`

### `ndis_active_providers` — 67,617 rows
Currently active NDIS providers.

### `ndis_participants` — 67,353 rows
NDIS participant records (geography/demographic level, not individuals).

### `ndis_registered_providers` — 48,510 rows
All NDIS registered providers (current + historical).

### `ndis_market_concentration` — 14,516 rows
NDIS market concentration metrics by region/support class.

### `ndis_participants_lga` — 8,329 rows
NDIS participant counts aggregated to LGA level.

---

## Australian Living Map of Alternatives (ALMA)

### `alma_interventions` — 1,680 rows (est., from pg_class; ~1,155 active)
Evidence-based alternative justice interventions.

**By type:**
| type | count |
|------|-------|
| Wraparound Support | 328 |
| Community-Led | 300 |
| Prevention | 207 |
| Cultural Connection | 206 |
| Education/Employment | 182 |
| Diversion | 140 |
| Therapeutic | 116 |
| Justice Reinvestment | 72 |
| Early Intervention | 72 |
| Family Strengthening | 57 |

### `alma_evidence` — ~570 rows
Evidence records linked to interventions (program evals, RCTs, case studies, etc.)

### `alma_outcomes` — ~506 rows
Outcome records linked to interventions.

### `alma_intervention_evidence` — 2,065 rows
Many-to-many link table between interventions and evidence.

### `alma_discovered_links` — 2,544 rows
Auto-discovered links between ALMA interventions and external datasets.

### Other ALMA tables (mostly empty/small):
`alma_community_contexts`, `alma_consent_ledger`, `alma_conversations`, `alma_entity_sources`, `alma_extraction_patterns`, `alma_funding_applications`, `alma_funding_data`, `alma_funding_opportunities`, `alma_government_programs`, `alma_impact_metrics`, `alma_ingestion_jobs`, `alma_locations`, `alma_maturation_log`, `alma_media_articles`, `alma_program_interventions`, `alma_raw_content`, `alma_research_findings`, `alma_research_sessions`, `alma_research_tool_logs`, `alma_source_documents`, `alma_stories`, `alma_tags`

---

## Registry / Reference Data

### `abr_registry` — 20,006,350 rows (est.)
Full ABR bulk extract — all Australian ABNs. Very large; COUNT(*) times out.

**Key use:** Entity name/ABN lookup for matching and enrichment.

### `asic_companies` — 2,167,341 rows (est.)
ASIC company register.

### `asic_name_lookup` — 2,149,476 rows (est.)
ASIC name index for fast fuzzy matching.

### `oric_corporations` — 7,523 rows
ORIC Indigenous corporation register.

### `nz_charities` — 45,192 rows
New Zealand charity register.

### `asx_companies` — 1,976 rows
ASX listed companies.

### `social_enterprises` — 10,552 rows
Social enterprise directory.

### `organizations` — 108,004 rows
Generic organizations table (appears to be a CRM/operational table, not the main entity graph).

---

## Geographic Reference

### `postcode_geo` — 11,724 rows
Postcode-level geographic data with SA2 codes, remoteness classification, LGA mapping.

**Key columns:** `postcode`, `locality`, `state`, `sa2_code`, `remoteness_2021`, `lga_name`, `lga_code`

### `seifa_2021` — 10,572 rows
SEIFA 2021 socioeconomic disadvantage scores by postcode.

**Key columns:** `postcode`, `index_type`, `score`, `decile_national`

### `postcode_sa2_concordance` — 6,904 rows
Concordance table mapping postcodes to SA2 regions.

### `sa2_reference` — 2,473 rows
SA2 statistical area reference data.

### `sa3_regions` — (empty/small)
SA3 reference data.

---

## Justice & Crime Data

### `rogs_justice_spending` — 9,116 rows (est. 8,873)
Report on Government Services justice spending data — national, by state, by service type, multi-year.

**Key columns:** `rogs_table`, `rogs_section`, `financial_year`, `measure`, `service_type`, `indigenous_status`, `age_group`, `nsw`, `vic`, `qld`, `wa`, `sa`, `tas`, `act`, `nt`

### `crime_stats_lga` — 57,832 rows
LGA-level crime statistics with trends.

**Key columns:** `lga_name`, `state`, `offence_group`, `offence_type`, `year_period`, `incidents`, `rate_per_100k`, `two_year_trend_pct`, `ten_year_trend_pct`, `lga_rank`

### `aihw_child_protection` — 2,981 rows
AIHW child protection statistics.

### `youth_detention_facilities` — (small/empty)
Youth detention facility data.

---

## Social Sector DSS Data

### `dss_payment_demographics` — 105,529 rows
DSS payment recipient demographics by geography, payment type, quarter.

**Key columns:** `payment_type`, `quarter`, `geography_type`, `geography_code`, `geography_name`, `state`, `recipient_count`, `male_count`, `female_count`, `indigenous_count`, `age_under_25`, `age_25_44`, `age_45_64`, `age_65_plus`

---

## Education

### `acara_schools` — 9,755 rows
ACARA school data (NAPLAN, My School).

---

## Civic / Government Intelligence

### `civic_ministerial_diaries` — 1,728 rows
Queensland ministerial diary disclosures.

### `civic_hansard` — (small)
Parliamentary Hansard records.

### `civic_charter_commitments` — (small)
Charter of budget honesty commitments.

### `civic_consultancy_spending` — (empty)
Government consultancy spend data.

### `civic_rti_disclosures` — (empty)
Right to Information disclosure logs.

---

## Agent Infrastructure

### `agent_runs` — (small, operational)
Agent execution history — `agent_id`, `agent_name`, `status`, `items_found`, `items_new`, `duration_ms`, `started_at`

### `agent_schedules` — (small, operational)
Scheduled agent configs — `agent_id`, `interval_hours`, `enabled`, `last_run_at`, `priority`

### `agent_registry` — (small)
Registry of all registered agents.

### `agent_tasks`, `agent_task_queue`, `agent_actions`, `agent_proposals`, `agent_audit_log` — (operational/small)

---

## Materialized Views

All MVs listed with approximate row counts from `pg_class.reltuples`:

### Power & Influence
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_entity_power_index` | 179,877 | Cross-system power concentration. 7 systems: procurement, justice, donations, charity, foundation, ALMA, ATO. Key cols: `power_score`, `system_count`, `total_dollar_flow`, `procurement_dollars`, `justice_dollars` |
| `mv_revolving_door` | 6,631 | Entities with 2+ influence vectors (lobbying, donations, contracts, funding). Key cols: `revolving_door_score`, `influence_vectors`, `total_contracts`, `total_donated` |
| `mv_board_power` | 38,199 | Board-level power scores |
| `mv_gs_donor_contractors` | 1,443 | Entities that both donate to parties AND hold government contracts |

### Person / Director Networks
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_director_network` | 1,383,883 | Full director relationship network |
| `mv_person_entity_network` | 336,444 | Person→entity connections with financial footprint |
| `mv_person_entity_crosswalk` | 331,239 | Cross-dataset person↔entity mapping |
| `mv_person_network` | 237,990 | Person-to-person connections |
| `mv_person_directory` | 237,987 | Deduplicated person directory |
| `mv_person_influence` | 237,340 | Per-person influence scores: `board_count`, `financial_footprint` |
| `mv_person_board_seats` | 39,804 | Per-person board seat counts |
| `mv_board_interlocks` | 39,757 | People on multiple boards. Key cols: `person_name`, `board_count`, `organisations`, `interlock_score`, `total_power_score` |
| `mv_charity_network` | 340,818 | Charity-to-charity network via shared directors |
| `mv_donor_person_crosslink` | 294 | Cross-link between donors and persons |
| `mv_person_cross_system` | 282 | People appearing across multiple data systems |

### Funding & Finance
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_gs_entity_stats` | 369,071 | Entity-level stats rollup (funding totals, contract counts, etc.) |
| `mv_org_justice_signals` | 64,724 | Justice funding signals per charity |
| `mv_donation_contract_timing` | 208,209 | Timing analysis between donations and contract awards |
| `mv_fy_donation_contracts` | 50,685 | Financial year donation + contract crossref |
| `mv_donor_contract_crossref` | 2,068 | Donors who also hold contracts |
| `mv_evidence_backed_funding` | 2,233 | Funding flows to ALMA evidence-backed orgs |
| `mv_intervention_funding_chain` | 341 | Funding chains from government → intervention org |
| `mv_funding_outcomes_summary` | 39,437 | Funding amounts linked to outcome data |
| `mv_individual_donors` | 1,041 | Individual (not corporate) political donors |
| `mv_temporal_summary` | 158 | Time-series summary of funding flows |

### Charity & Foundation
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_acnc_latest` | 63,509 | Latest ACNC snapshot per charity |
| `mv_charity_rankings` | 42,502 | Charity rankings by funding, size, impact |
| `mv_foundation_grantees` | 25,767 | Foundation → grantee relationships |
| `mv_foundation_need_alignment` | 62,550 | Foundation thematic focus vs community need alignment |
| `mv_foundation_trends` | 53,739 | Foundation giving trends over time |
| `mv_foundation_regranting` | 48,062 | Foundations that re-grant to other foundations |
| `mv_foundation_readiness` | 10,323 | Foundation readiness scores for partnership |
| `mv_trustee_grantee_chain` | 177,841 | Trustee→grantee funding chains |
| `mv_trustee_grantee_overlaps` | 10,206 | Trustee/grantee entity overlaps |
| `mv_foundation_scores` | 2,466 | Composite foundation scores |

### Geographic
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_funding_by_postcode` | 8,243 | Per-postcode funding aggregates |
| `mv_funding_by_lga` | 1,857 | Per-LGA funding aggregates (492 LGAs) |
| `mv_funding_deserts` | 1,951 | LGA-level disadvantage vs funding — `desert_score`, `avg_irsd_decile`, `ndis_participants`, SEIFA + remoteness |
| `mv_sa2_map_data` | 2,473 | SA2-level data for map rendering |

### Sector-Specific
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `mv_disability_landscape` | 1,636 | NDIS/disability sector overview |
| `mv_youth_justice_entities` | 5,469 | Youth justice orgs and their funding/evidence |

### ALMA Dashboards (aggregated views)
| MV | Rows (est.) | Description |
|----|-------------|-------------|
| `alma_dashboard_interventions` | 525 | Filtered/enriched interventions for dashboard |
| `alma_daily_sentiment` | 324 | Daily sentiment analysis of ALMA media |
| `alma_sentiment_program_correlation` | 47 | Sentiment vs program outcome correlation |

### Non-prefixed Views
| View | Rows | Description |
|------|------|-------------|
| `v_austender_procurement_by_type` | 94 | Austender breakdown by procurement type |
| `v_grant_provider_summary` | 30 | Grant provider summary |
| `v_ato_largest_entities` | 30 | Largest ATO-reported entities |
| `v_grant_focus_areas` | 30 | Grant focus area taxonomy |

---

## CRM / Operational Tables (not core data)

These tables exist but are operational/CRM in nature, not primary research data:

- **`privacy_audit_log`** (1.28M rows) — audit trail for data access
- **`webhook_delivery_log`** (23,396 rows) — webhook dispatch logs
- **`communications_history`** (19,327 rows) — CRM comms log
- **`linkedin_contacts`** (13,804 rows) — LinkedIn contact imports
- **`ghl_contacts`** (4,831 rows) — GoHighLevel CRM contacts
- **`org_profiles`** — user/org subscription data
- **`xero_*`** tables — Xero accounting integration
- **`bookkeeping_transactions`** (5,460 rows) — internal bookkeeping
- **`calendar_events`** (2,129 rows) — calendar data
- **`page_views`** (2,989 rows) — app analytics
- **`knowledge_chunks`** (19,100 rows) — RAG/AI knowledge base chunks
- **`civic_intelligence_chunks`** (7,022 rows) — CivicGraph-specific knowledge chunks
- **`project_knowledge`** — in-app research notes
- **`discoveries`** — autoresearch agent discoveries (not in pg_class estimate but referenced in code)

---

## Notable Empty / Scaffold Tables (reltuples = -1)

These tables exist in schema but have no or negligible data:
`bgfit_*`, `ndis_sda`, `ndis_plan_budgets`, `ndis_providers`, `notion_grants`, `notion_meetings`, `nz_gets_contracts`, `governed_proof_*`, `founder_intakes`, `campaign_content`, `civic_consultancy_spending`, `civic_rti_disclosures`, `org_projects`, `strategic_objectives`, `voice_notes`, `wiki_page_versions`, `youth_opportunities`

---

## Total Data Footprint (Approximate)

| Category | Tables | Est. Rows |
|----------|--------|-----------|
| Entity graph | 5 | 2.7M |
| Procurement | 3 | 1.0M |
| Registries (ABR/ASIC) | 3 | 24.3M |
| Justice funding | 1 | 218K |
| NDIS | 6 | 350K |
| Charities/ACNC | 3 | 523K |
| People/boards | 3 | 357K |
| Political donations | 1 | 302K |
| Research grants | 1 | 46K |
| Foundations | 3 | 23K |
| Grant opportunities | 3 | 41K |
| ALMA | ~15 | ~7K |
| Crime/justice stats | 3 | 70K |
| DSS payments | 1 | 106K |
| Geographic ref | 5 | 43K |
| Other/operational | ~440 | ~200K |

**Grand total (excl. ABR/ASIC): ~5.9M rows of research-grade data**  
**Including registries: ~30.2M rows**
