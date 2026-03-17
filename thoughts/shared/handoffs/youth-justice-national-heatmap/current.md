---
date: 2026-03-16T01:20:00Z
session_name: youth-justice-national-heatmap
branch: main
status: active
---

# Work Stream: youth-justice-national-heatmap

## Ledger
**Updated:** 2026-03-16T01:20:00Z
**Goal:** Expand youth justice cross-system heatmap from 21 hardcoded LGAs to ALL ~540 Australian LGAs with education, welfare, youth justice, disability (NDIS), and crime data. Also align data between CivicGraph and JusticeHub codebases (same Supabase DB).
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit` + `curl http://localhost:3003/reports/youth-justice`

### Now
[->] Sprint 4: Refactor CivicGraph heatmap to read from `lga_cross_system_stats` instead of runtime JOINs

### This Session
- [x] Fixed recidivism data (was null for 2023-24, pulled from 2022-23 via LATERAL)
- [x] Fixed decimal formatting (54.333% → 54%, all percentages rounded)
- [x] Added NDIS disability columns to heatmap (youth participants + budget)
- [x] Crime column shows only when data exists
- [x] Committed: f050d04 (youth justice + crime indicators)
- [x] Sprint 1: Enriched `lga_cross_system_stats` — 7 new columns, 360 LGAs
- [x] Sprint 2: Researched crime data sources — QLD (CSV/S3), VIC (XLSX), SA (CSV/suburb), NT (web scrape)
- [x] Sprint 3: Researched NDIS — publishes DIRECT LGA-level CSV (no estimation needed!)
- [x] Ingested QLD crime: 78 LGAs, 4,082 rows from QPS S3 CSV
- [x] Ingested VIC crime: 79 LGAs, 1,873 rows from CSA Victoria XLSX
- [x] Scraped NT crime: 6 towns, 60 rows from NTPFES web pages
- [x] Ingested NDIS LGA data: 329 LGAs updated with actual participant counts (Dec 2025 quarter)
- [x] Oracle research: "Why Australia needs community-level youth justice data" policy brief

### Next
- [ ] **Sprint 4: Refactor CivicGraph heatmap** — replace runtime JOINs with single query to `lga_cross_system_stats`, remove hardcoded CITY_LGAS, show ALL LGAs with sorting/filtering
- [ ] **Sprint 5: Policy position** — add "Why community-level data matters" section to report with international comparison + data sovereignty argument
- [ ] SA crime ingest (CSV, suburb→LGA mapping via postcode_geo) — P2
- [ ] ACT crime ingest (XLSX, single LGA "Canberra") — P2
- [ ] Rename `ndis_youth_participants` column — currently stores TOTAL participants not youth-specific
- [ ] Align with JusticeHub — both read from same `lga_cross_system_stats`, consistent UI

### Decisions
- Both CivicGraph and JusticeHub share the SAME Supabase database — `lga_cross_system_stats` is the shared data layer
- Youth justice indicators (cost/day, recidivism, Indigenous ratio) are STATE-LEVEL — no Australian jurisdiction publishes LGA-level YJ data. Apply state values to constituent LGAs with clear labeling.
- NDIS LGA CSV has TOTAL participants, not youth-specific. Stored in `ndis_youth_participants` for now — can apply state-level youth ratio later.
- NT crime data is monthly counts only (no rate per 100K) — needs ABS population to calculate rates
- Crime data priority: QLD P1 (done), VIC P1 (done), SA P2, ACT P2, WA P3, TAS P4

### Open Questions
- UNCONFIRMED: Should heatmap show top N LGAs or all 360+ with pagination?
- UNCONFIRMED: How to visually distinguish state-level proxy data from actual LGA data in the heatmap?

## Context

### Database State After This Session

**`lga_cross_system_stats`** — 360 LGAs, 33 columns:
- Education: low_icsea_schools, avg_icsea, school_count, indigenous_pct
- Demographics: population, youth_population, indigenous_youth_pct
- Welfare: dsp_recipients, jobseeker_recipients, youth_allowance_recipients
- Youth Justice: recidivism_pct, indigenous_rate_ratio, cost_per_detention_day, detention_indigenous_pct (all state-level)
- NDIS: ndis_youth_participants (329 LGAs with actual LGA data, 30 with state-level), ndis_budget (state-level)
- Crime: crime_rate_per_100k (NSW 65 + QLD 18 + VIC 78 = ~161 LGAs)
- Computed: pipeline_intensity (0-100)

**`crime_stats_lga`** — 57,495 rows:
- NSW: 99 LGAs, 51,480 rows (BOCSAR)
- QLD: 78 LGAs, 4,082 rows (QPS)
- VIC: 79 LGAs, 1,873 rows (CSA VIC)
- NT: 6 LGAs, 60 rows (NTPFES)

### Scripts Created
- `scripts/ingest-crime-qld.mjs` — QLD Police S3 CSV ingest
- `scripts/ingest-crime-vic.mjs` — VIC CSA XLSX ingest
- `scripts/ingest-crime-nt.mjs` — NT Police web scraper
- `scripts/ingest-ndis-lga.mjs` — NDIS participants by LGA CSV ingest

### Key Files (CivicGraph)
- `apps/web/src/app/reports/youth-justice/page.tsx` — the report page with heatmap
- `apps/web/src/app/reports/youth-justice/charts.tsx` — recharts visualizations
- `apps/web/src/lib/services/report-service.ts` — shared data service

### Policy Brief
Oracle research saved at `.claude/cache/agents/oracle/latest-output.md`:
- Australia is an international outlier — UK publishes for 150 local authorities, US for 3,100 counties
- AIHW Youth Justice National Minimum Data Set already collects individual records with geographic IDs — barrier is publication policy not data collection
- Government funds 30 community-led justice reinvestment programs ($69M) requiring local data while failing to publish it
- Maiam nayri Wingara Indigenous data sovereignty principles explicitly require community-level disaggregation
- State averages mask extreme variation (40% recidivism state avg could hide 80% in one community and 10% in another)

### Commits This Session
- f050d04: feat: add youth justice + crime indicators to cross-system heatmap
- (uncommitted changes from heatmap formatting fixes + NDIS columns — need to commit)

### Git Status
Branch: main, 6 commits ahead of origin (need to push eventually)
