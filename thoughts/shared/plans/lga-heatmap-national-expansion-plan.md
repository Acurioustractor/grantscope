# Feature Plan: National LGA Cross-System Overlap Heatmap

Created: 2026-03-16
Author: architect-agent

## Overview

Expand the youth justice cross-system overlap heatmap from ~20 hand-picked NSW LGAs to all ~550 Australian LGAs. The heatmap shows Education, Welfare, Youth Justice, NDIS, and Crime indicators per LGA, revealing which communities face compounding disadvantage across multiple systems.

## Database Audit Results

### Existing Data Coverage Summary

| Data Source | Table | Granularity | LGA Coverage | States |
|---|---|---|---|---|
| **ACARA Schools** | `acara_schools` | LGA (name) | 540 LGAs | All 8 states/territories |
| **DSS Payments** | `dss_payment_demographics` | LGA (code) | 548 LGAs | All states |
| **Crime Stats** | `crime_stats_lga` | LGA (name) | 99 LGAs | NSW only (BOCSAR) |
| **NDIS Participants** | `ndis_participants` | Service District | 81 districts | All states |
| **Youth Justice** | `v_youth_justice_state_dashboard` | State | 8 states | All states |
| **AIHW Child Protection** | `aihw_child_protection` | State | 8 states | All states |
| **SEIFA** | `seifa_2021` | Postcode | 2,643 postcodes | All states |
| **Postcode-to-LGA mapping** | `postcode_geo` | Postcode-LGA | 490 LGAs | All states |
| **Funding by LGA** | `mv_funding_by_lga` | LGA | 479 LGAs | All states |
| **Pre-built LGA stats** | `lga_cross_system_stats` | LGA | **0 (empty table)** | Schema ready |

### Key Finding: `lga_cross_system_stats` Table Already Exists

The schema at `lga_cross_system_stats` is perfectly designed for this use case with 26 columns including `low_icsea_schools`, `avg_icsea`, `dsp_recipients`, `jobseeker_recipients`, `youth_allowance_recipients`, `indigenous_pct`, `youth_offenders`, `youth_offender_rate`, `detention_beds`, etc. **The table is empty — it just needs to be populated.**

---

## Column-by-Column Feasibility

### 1. EDUCATION

| Column | Current Coverage | Gap | Fill Strategy | Data Source | Effort |
|---|---|---|---|---|---|
| **Low ICSEA Schools Count** | 532 LGAs (ACARA) | ~18 LGAs missing ICSEA values | Direct query: `COUNT(*) WHERE icsea_value < 900 GROUP BY lga_name` | `acara_schools` table | **Low** |
| **Average ICSEA** | 532 LGAs | Same ~18 gap | Direct query: `AVG(icsea_value) GROUP BY lga_name` | `acara_schools` table | **Low** |
| **Indigenous Student %** | 540 LGAs | Negligible gap | Direct query: `AVG(indigenous_pct) GROUP BY lga_name` | `acara_schools.indigenous_pct` | **Low** |

**Verdict: READY NOW.** All education columns can be computed directly from `acara_schools` with simple GROUP BY queries. Coverage is 540/~550 LGAs (98%).

---

### 2. WELFARE (DSS Payments)

| Column | Current Coverage | Gap | Fill Strategy | Data Source | Effort |
|---|---|---|---|---|---|
| **DSP Recipients** | 548 LGAs (by code) | Need LGA name join | Join DSS `geography_code` to `postcode_geo.lga_code` (489/548 match) | `dss_payment_demographics` WHERE payment_type = 'Disability Support Pension' | **Low** |
| **JobSeeker Recipients** | 548 LGAs | Same join needed | Same pattern, payment_type = 'JobSeeker Payment' | `dss_payment_demographics` | **Low** |
| **Youth Allowance Recipients** | 548 LGAs | Same join needed | Combine `Youth Allowance (other)` + `Youth Allowance (student and apprentice)` | `dss_payment_demographics` | **Low** |

**Verdict: READY NOW.** DSS data covers 548 LGAs nationally. The `geography_name` column is empty but `geography_code` matches `postcode_geo.lga_code` for 489 LGAs (89%). For the remaining 59 LGA codes, we need to build a supplementary ABS LGA code-to-name mapping (available from ABS ASGS downloads). **Effort is low — one mapping table import.**

**Join query pattern:**
```sql
SELECT p.lga_name, p.lga_code,
  SUM(CASE WHEN d.payment_type = 'Disability Support Pension' THEN d.recipient_count END) as dsp,
  SUM(CASE WHEN d.payment_type = 'JobSeeker Payment' THEN d.recipient_count END) as jobseeker,
  SUM(CASE WHEN d.payment_type IN ('Youth Allowance (other)', 'Youth Allowance (student and apprentice)') THEN d.recipient_count END) as youth_allowance
FROM dss_payment_demographics d
JOIN postcode_geo p ON d.geography_code = p.lga_code
WHERE d.geography_type = 'lga'
GROUP BY p.lga_name, p.lga_code;
```

---

### 3. YOUTH JUSTICE

| Column | Current Coverage | Gap | Fill Strategy | Data Source | Effort |
|---|---|---|---|---|---|
| **Cost per Detention Day** | State-level only (8 states) | No LGA breakdown exists anywhere | **State value applied to all LGAs in that state** — this is inherently a state-level budget metric | `v_youth_justice_state_dashboard.cost_per_detention` | **Low** (but flagged as state-level) |
| **Recidivism %** | State-level only | No LGA breakdown published | **State value applied to all LGAs** — same reasoning | `v_youth_justice_state_dashboard.recidivism_pct` | **Low** (flagged) |
| **Indigenous Rate Ratio** | State-level only | No LGA breakdown | **State value** — AIHW publishes this at state level only | `v_youth_justice_state_dashboard.indigenous_rate_ratio` | **Low** (flagged) |
| **Detention Indigenous %** | State-level only | No LGA breakdown | **State value** — facility-level data could refine this | `v_youth_justice_state_dashboard.facility_indigenous_pct` | **Low** (flagged) |

**Verdict: STATE-LEVEL PROXY ONLY.** Youth justice indicators (cost, recidivism, Indigenous overrepresentation) are published exclusively at state level by AIHW and the Productivity Commission's Report on Government Services (ROGS). No Australian jurisdiction publishes LGA-level youth justice statistics. The best we can do is:

1. Apply the state value uniformly to all LGAs in that state
2. Use local proxies (Indigenous youth population %, SEIFA disadvantage, crime rates) to create a weighted "youth justice risk" index
3. Clearly label these as "State-level" in the heatmap UI

**Important: Do NOT present state-level data as LGA-level data without clear labelling.** A tooltip or footnote must indicate "State-level indicator applied to LGA for comparison purposes."

---

### 4. DISABILITY (NDIS)

| Column | Current Coverage | Gap | Fill Strategy | Data Source | Effort |
|---|---|---|---|---|---|
| **Youth Participants** | 81 Service Districts | Service districts != LGAs; ~5-10 LGAs per district | **Proportional allocation**: distribute district totals to LGAs by population share | `ndis_participants` + ABS population data | **Medium** |
| **Budget** | 81 Service Districts | Same mapping gap | Same proportional allocation approach | `ndis_participants.avg_annual_budget` | **Medium** |

**Verdict: ESTIMATION REQUIRED.** NDIS data is published at "service district" level (81 nationally), which is roughly equivalent to ABS SA3 regions. Each service district contains multiple LGAs. Options:

**Option A (Recommended): Proportional Population Allocation**
- Build an NDIS Service District -> LGA mapping table (manual, ~81 rows)
- Use ABS population data to calculate each LGA's share of its service district
- Allocate participants and budget proportionally
- Effort: Medium (one-time mapping + population data import)

**Option B: Display at Service District Level**
- Show NDIS data at service district granularity, not LGA
- Simpler but breaks the LGA-level consistency of the heatmap
- Effort: Low

**Option C: Use NDIS Open Data Portal**
- The NDIS publishes quarterly data at SA2 level in their data downloads
- SA2 -> LGA mapping is available from ABS
- This would give actual LGA-level NDIS data
- URL: https://data.ndis.gov.au/
- Effort: Medium (new data pipeline agent)

---

### 5. CRIME

| Column | Current Coverage | Gap | Fill Strategy | Data Source | Effort |
|---|---|---|---|---|---|
| **Rate per 100K** | 99 LGAs (NSW only) | ~450 LGAs across 7 other states | **Ingest crime data from each state's crime statistics agency** | Multiple state portals | **High** |

**Verdict: MAJOR GAP — NSW ONLY.** This is the biggest gap. Current coverage is only NSW (BOCSAR data, 99 LGAs). Each state publishes crime statistics differently:

| State | Agency | LGA Data Available? | Format | URL |
|---|---|---|---|---|
| **NSW** | BOCSAR | Yes, 99 LGAs (HAVE) | CSV | bocsar.nsw.gov.au |
| **VIC** | Crime Statistics Agency | Yes, 79 LGAs | CSV/Excel | crimestatistics.vic.gov.au |
| **QLD** | QPS Open Data | Yes, ~77 LGAs | CSV | data.qld.gov.au |
| **SA** | SA Police / OCSAR | Yes, ~40 LGAs | Excel/PDF | ocsar.sa.gov.au |
| **WA** | WA Police | Yes, ~140 LGAs | CSV | police.wa.gov.au |
| **TAS** | Tasmania Police | Limited, ~10 regions | PDF | police.tas.gov.au |
| **NT** | NT Police | Limited, ~5 regions | PDF | pfes.nt.gov.au |
| **ACT** | ACT Policing | 1 LGA (Canberra) | Web | policenews.act.gov.au |

**National alternative: ABS 4510.0 "Recorded Crime — Victims"** publishes state-level only. There is no single national dataset at LGA level. Each state must be ingested separately.

**Fill Strategy:**
1. **Phase 1**: Ingest VIC + QLD + WA (covers ~296 additional LGAs, all publish machine-readable data)
2. **Phase 2**: Ingest SA (adds ~40 LGAs)
3. **Phase 3**: For TAS/NT/ACT, use state-level rates as proxy (small states, few LGAs)
4. Each state needs a dedicated scraper/ingester in `scripts/agents/`

---

## SEIFA as a Universal Proxy

SEIFA (Socio-Economic Indexes for Areas) at postcode level can be aggregated to LGA via `postcode_geo` join. This provides:

- **IRSD (Index of Relative Socio-economic Disadvantage)**: best proxy for disadvantage
- **IEO (Index of Education and Occupation)**: education proxy
- **IRSAD (Index of Relative Socio-economic Advantage and Disadvantage)**: combined measure
- **IER (Index of Economic Resources)**: economic proxy

**Coverage**: 2,643 postcodes -> can compute weighted LGA averages for ~490 LGAs via `postcode_geo`.

**Use case**: For any column where direct data is unavailable, SEIFA decile can serve as a "disadvantage proxy" column in the heatmap.

---

## Implementation Plan

### Phase 1: Populate `lga_cross_system_stats` (Effort: LOW)

The table already exists with the right schema. Build a SQL script or agent to populate it.

**Files to create/modify:**
- `scripts/agents/lga-cross-system-builder.mjs` — aggregation agent
- `scripts/sql/populate-lga-cross-system.sql` — SQL to compute and INSERT

**Data available NOW for all ~540 LGAs:**
- `low_icsea_schools` — from `acara_schools`
- `avg_icsea` — from `acara_schools`
- `indigenous_pct` — from `acara_schools` (school-level proxy)
- `dsp_recipients` — from `dss_payment_demographics`
- `jobseeker_recipients` — from `dss_payment_demographics`
- `youth_allowance_recipients` — from `dss_payment_demographics`

**Data available at state level (applied to LGAs):**
- Youth justice indicators from `v_youth_justice_state_dashboard`

**Acceptance:**
- [ ] `lga_cross_system_stats` populated with 540+ rows
- [ ] All education and welfare columns have real LGA-level data
- [ ] Youth justice columns present with state-level flag

**Estimated effort:** 1-2 hours

### Phase 2: Crime Data Expansion (Effort: HIGH)

**Files to create:**
- `scripts/agents/crime-ingest-vic.mjs`
- `scripts/agents/crime-ingest-qld.mjs`
- `scripts/agents/crime-ingest-wa.mjs`
- `scripts/agents/crime-ingest-sa.mjs`

**Target:** Add VIC (79 LGAs), QLD (77 LGAs), WA (140 LGAs), SA (40 LGAs) = ~336 additional LGAs

**Acceptance:**
- [ ] `crime_stats_lga` has data for 4+ states
- [ ] Rate per 100K normalized across states
- [ ] Offence groups harmonized (each state uses different categories)

**Estimated effort:** 2-3 days (each state has different data formats)

### Phase 3: NDIS LGA Allocation (Effort: MEDIUM)

**Files to create:**
- `scripts/agents/ndis-lga-allocator.mjs`
- `data/ndis-service-district-lga-mapping.csv`

**Approach:** Map 81 service districts to constituent LGAs, allocate by population proportion.

**Alternative:** Ingest NDIS SA2-level data from data.ndis.gov.au and aggregate to LGA.

**Acceptance:**
- [ ] Every LGA has estimated NDIS youth participants and budget
- [ ] Estimates flagged as proportional allocations, not actuals

**Estimated effort:** 1-2 days

### Phase 4: Heatmap UI Expansion (Effort: MEDIUM)

**Files to modify:**
- `apps/web/src/app/reports/youth-justice/charts.tsx` — replace `LgaOverlapChart` with full heatmap
- `apps/web/src/app/reports/youth-justice/page.tsx` — query `lga_cross_system_stats` instead of passing empty `lgaOverlap={[]}`
- `apps/web/src/lib/services/report-service.ts` — add `getLgaCrossSystemStats()` function

**UI Requirements:**
- Sortable/filterable table showing all ~540 LGAs
- Color-coded cells (heatmap style) — red for high disadvantage, green for low
- State filter dropdown
- Column group toggles (Education | Welfare | Youth Justice | NDIS | Crime)
- Data quality indicators (actual vs. estimated vs. state-level proxy)
- Export to CSV

**Acceptance:**
- [ ] All ~540 LGAs displayed
- [ ] Columns correctly color-coded by quintile
- [ ] State-level proxies visually distinguished from actual LGA data
- [ ] Responsive on desktop

**Estimated effort:** 1-2 days

### Phase 5: Add SEIFA Disadvantage Index (Effort: LOW)

**Add column:** SEIFA IRSD decile per LGA (aggregated from postcode-level via `postcode_geo`)

**Files to modify:**
- Add `seifa_irsd_decile` column to `lga_cross_system_stats` if not present
- Update population SQL

**Acceptance:**
- [ ] ~490 LGAs have SEIFA IRSD scores
- [ ] Used as sort/filter option in UI

**Estimated effort:** 1-2 hours

---

## Summary Coverage Matrix

| Column Group | Column | LGAs Now | LGAs After Phase 1 | LGAs After All Phases | Data Quality |
|---|---|---|---|---|---|
| **Education** | Low ICSEA Schools | 0 (not computed) | ~532 | ~532 | Actual |
| **Education** | Average ICSEA | 0 | ~532 | ~532 | Actual |
| **Education** | Indigenous Student % | 0 | ~540 | ~540 | Actual |
| **Welfare** | DSP Recipients | 0 | ~489 | ~548 | Actual |
| **Welfare** | JobSeeker Recipients | 0 | ~489 | ~548 | Actual |
| **Welfare** | Youth Allowance | 0 | ~489 | ~548 | Actual |
| **Youth Justice** | Cost/Detention Day | 0 | ~540 (state proxy) | ~540 (state proxy) | State-level proxy |
| **Youth Justice** | Recidivism % | 0 | ~540 (state proxy) | ~540 (state proxy) | State-level proxy |
| **Youth Justice** | Indigenous Rate Ratio | 0 | ~540 (state proxy) | ~540 (state proxy) | State-level proxy |
| **Youth Justice** | Detention Indigenous % | 0 | ~540 (state proxy) | ~540 (state proxy) | State-level proxy |
| **NDIS** | Youth Participants | 0 | 0 | ~490 | Estimated (proportional) |
| **NDIS** | Budget | 0 | 0 | ~490 | Estimated (proportional) |
| **Crime** | Rate per 100K | 99 (NSW) | 99 (NSW) | ~435 | Actual (multi-state) |
| **Bonus** | SEIFA IRSD Decile | 0 | ~490 | ~490 | Actual |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LGA name mismatches across datasets | Medium — some LGAs won't join | Use LGA codes (ABS standard) as canonical key, not names |
| State crime data format differences | High — harmonization is complex | Standardize offence categories to ABS framework during ingest |
| NDIS proportional allocation accuracy | Medium — urban/rural mix within districts | Document methodology, flag as estimate in UI |
| Youth justice data presented as LGA-level when it's not | High — misleading users | Clear "State-level" badges in UI, tooltip explanations |
| DSS small-area suppression | Low — DSS suppresses counts < 20 | Accept gaps, show "< 20" or null |
| `postcode_geo` missing NT LGAs | Low — NT has ~17 LGAs | Supplement with ABS ASGS LGA shapefile download |

---

## Open Questions

- [ ] Should we import an official ABS LGA reference table (ASGS 2021) as the canonical LGA master list? This would fix state field gaps in `postcode_geo` and provide official LGA codes for all ~547 LGAs.
- [ ] For crime data: should we normalize to "total crime rate" or show specific offence groups (violent, property, drug)?
- [ ] Should the heatmap support year-over-year comparison, or just latest snapshot?
- [ ] Do we need population denominators per LGA for rate calculations? (ABS ERP data needed)
- [ ] Should `lga_cross_system_stats` be a materialized view (auto-refreshes) or a static table populated by an agent?

## Success Criteria

1. Heatmap renders data for 490+ LGAs across all 8 states/territories
2. Education and Welfare columns have actual LGA-level data (not proxies)
3. State-level proxy data is clearly distinguished in the UI
4. Crime data covers at least 3 states (NSW + VIC + QLD minimum)
5. Page loads in under 5 seconds with all ~540 rows
6. Data exportable to CSV for policy analysis
