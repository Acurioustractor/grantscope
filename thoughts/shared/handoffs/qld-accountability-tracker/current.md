---
date: 2026-03-23T14:30:00Z
session_name: qld-accountability-tracker
branch: main
status: active
---

# Work Stream: QLD Accountability Tracker + Outcomes Infrastructure

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-23T14:30:00Z
**Goal:** Build QLD Youth Justice Accountability Tracker + outcomes infrastructure for Bloomberg terminal layer
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit` + `curl http://localhost:3003/reports/youth-justice/qld/tracker`

### Now
[->] Done for this session — 3 commits shipped

### This Session
- [x] Built QLD Accountability Tracker page at `/reports/youth-justice/qld/tracker` (e775ca2)
- [x] Added "Numbers That Matter" section from QLD Child Rights Report 2025 (outcomes, cost, watch-houses, socioeconomic, policy timeline)
- [x] Added "How QLD Compares" section (AIHW + ROGS state comparison table: QLD vs NSW, VIC, WA, NT)
- [x] Added "Court Pipeline" section (Childrens Court data — sentencing, 614% bail breach spike, diversion)
- [x] Added "Closing the Gap: Target 11" scorecard with 5-year trend chart (WORSENING: 42 per 10K)
- [x] Added "Oversight & Accountability" section (3 HR Act overrides, 4 oversight body scorecards)
- [x] Created 3 new DB tables: `outcomes_metrics`, `policy_events`, `oversight_recommendations` (4729bbd)
- [x] Ingested 89 metrics, 13 policy events, 15 oversight recommendations from 7+ sources
- [x] Added "Jurisdiction Context" section to ALL entity pages (7af0c25) — auto-shows outcomes + policy for entity's state
- [x] Fixed dynamic Tailwind class issue (template literals → static classes)
- [x] Verified Legal Aid Queensland entity page shows jurisdiction context live

### Next
- [ ] Wire tracker page hardcoded data to live `outcomes_metrics` queries (replace static → dynamic)
- [ ] Ingest other states' data (NSW, VIC, WA, NT) — same metrics, same sources
- [ ] Build AIHW scraper agent (`scripts/scrape-aihw-yj.mjs`) to auto-ingest annual data
- [ ] Build ROGS scraper agent for Table 17A data
- [ ] Add outcomes_metrics to entity search ("show me QLD orgs where outcomes are worsening")
- [ ] Build `watch-outcomes-changes.mjs` watcher agent — alert when new data diverges from baseline
- [ ] Fill in actual recommendation text for QAO Rec 1-12 (currently placeholder)
- [ ] QLD lobbying scraper live run (deferred from earlier session)
- [ ] Consider `/reports/youth-justice/national` comparison page

### Decisions
- Reports (editorial layer) keep hardcoded data for narrative control — they're storytelling products
- Database tables (Bloomberg layer) make same data queryable, searchable, alertable
- Both coexist: reports reference the data, entity pages query it live
- `outcomes_metrics` uses UNIQUE constraint on (jurisdiction, domain, metric_name, period, cohort, source) for safe upserts
- Entity page shows max 4 metrics + 3 policy events to keep it compact
- Jurisdiction context only shows for youth-justice domain currently
- Some AIHW/ROGS numbers from oracle agents may need verification against actual Excel data tables

### Open Questions
- UNCONFIRMED: Some state-comparison numbers (NSW/VIC/WA detention counts, costs) need verification against AIHW source Excel
- Should we prioritise NT data next (for Oonchiumpa) or do all states at once?
- When to build the national comparison page?

### Workflow State
pattern: build-and-ship
phase: 3
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "QLD Accountability Tracker + outcomes infrastructure"
- resource_allocation: aggressive

#### Unknowns
- Exact AIHW/ROGS numbers need verification against source Excel files

#### Last Failure
(none)

---

## Context

### Architecture: Two Layers

```
EDITORIAL LAYER (Reports)          BLOOMBERG LAYER (Database)
━━━━━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━━━━━━
/reports/youth-justice/qld/tracker  outcomes_metrics (89 rows)
  - Hardcoded narrative data        policy_events (13 rows)
  - Storytelling, context           oversight_recommendations (15 rows)
  - 16 data sources cited
  - Static but powerful             Entity pages auto-query these
                                    Search can filter by metrics
                                    Watcher agents can alert on changes
```

### New Tables (created this session)

```sql
-- State-level outcome data from AIHW, ROGS, Child Rights Report, Court, CtG, Ombudsman
outcomes_metrics (89 rows)
  UNIQUE(jurisdiction, domain, metric_name, period, cohort, source)
  Metrics: detention_rate_per_10k, indigenous_overrepresentation_ratio, cost_per_day_detention,
           cost_per_day_community, pct_unsentenced, avg_daily_detention, avg_days_in_detention,
           ctg_target11_indigenous_detention_rate, court_finalised_appearances, court_breach_bail_convictions,
           watchhouse_stays, pct_disability_in_detention, recidivism_6_months, etc.

-- Legislative/policy timeline
policy_events (13 rows)
  event_type: legislation, amendment, announcement, budget, framework, facility, inquiry,
              report, human_rights_override, election
  QLD: 3 HR Act overrides, 3 legislation, 3 budget, 2 reports, 1 facility, 1 framework

-- Oversight body findings with implementation tracking
oversight_recommendations (15 rows)
  oversight_body: qld-audit-office, qld-sentencing-advisory-council, qld-human-rights-commissioner, qld-ombudsman
  status: pending, accepted, partially_implemented, implemented, rejected, superseded, unknown
```

### Key Files
- `apps/web/src/app/reports/youth-justice/qld/tracker/page.tsx` — QLD Tracker (editorial)
- `apps/web/src/app/entity/[gsId]/page.tsx` — Entity page with jurisdiction context (Bloomberg)
- `apps/web/src/lib/services/report-service.ts` — 6 tracker service functions
- `scripts/migrations/outcomes-infrastructure.sql` — 3 table DDL
- `scripts/ingest-outcomes-data.mjs` — data ingestion script (re-runnable with upserts)

### Data Sources Researched (9 total)
1. QLD Child Rights Report 2025 (OATSICC & QFCC) — read from user-provided PDF
2. AIHW Youth Justice in Australia 2023-24 — oracle agent
3. ROGS 2026 Table 17A — oracle agent
4. QLD Childrens Court Annual Report 2023-24 — oracle agent
5. Closing the Gap Target 11 Dashboard — oracle agent
6. QLD Ombudsman watch-house reports — oracle agent
7. QLD Audit Office "Reducing Serious Youth Crime" — oracle agent
8. QLD Sentencing Advisory Council — oracle agent
9. QLD Human Rights Commissioner — oracle agent

### Commits This Session
- `e775ca2` feat: QLD Youth Justice Accountability Tracker — 16 data sources, outcomes + oversight
- `4729bbd` feat: outcomes infrastructure — 3 new tables, 117 records from 7 sources
- `7af0c25` feat: jurisdiction context on entity pages — outcomes + policy from live DB

### Key Insights from Research
- 97% recidivism within 6 months (72-hour transition plans)
- $2,162/day detention vs $382/day community (5.7x cost multiplier)
- 614% spike in breach-of-bail convictions from one legislative change (938 → 6,697)
- QLD highest absolute detention numbers in Australia (317), longest stays (104 days)
- Closing the Gap Target 11: WORSENING (42 per 10K, was 29 in 2020)
- Zero HR Act overrides during COVID; 3 overrides for youth justice
- All 4 oversight bodies have advisory power only — no enforcement teeth
