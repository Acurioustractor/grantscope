---
date: 2026-03-16T12:00:00Z
session_name: cross-system-data-sprint
branch: main
status: active
---

# Work Stream: cross-system-data-sprint

## Ledger
**Updated:** 2026-03-16T22:30:00Z
**Goal:** Build cross-system youth justice + child protection intelligence — reports, data, campaigns.
**Branch:** main
**Test:** cd apps/web && npx tsc --noEmit

### Now
[->] Youth justice 5-city report built and rendering. Needs visual QA and commit.

### This Session
- [x] Built 5-city youth justice report at /reports/youth-justice (page.tsx + charts.tsx)
- [x] Replaced broken QLD-only report (dead @grant-engine imports) with full cross-system report
- [x] 5 states: QLD ($3.5B), NSW ($2.8B), WA ($1.3B), NT ($972M), SA ($560M) — 10yr ROGS data
- [x] 14 LGAs across 5 metros: Brisbane/Logan/Ipswich, Alice Springs, Sydney/Blacktown/Canterbury-Bankstown, Adelaide/Playford/Salisbury, Perth/Armadale/Wanneroo
- [x] ALMA interventions section (520 youth justice alternatives)
- [x] Provider contracts section (hardcoded entity UUIDs for speed)
- [x] Contained + JusticeHub campaign links section
- [x] Updated reports index card for new scope
- [x] Fixed critical: dev server must use --turbopack -p 3003 (vanilla webpack hangs)
- [x] Fixed critical: exec_sql ILIKE on gs_relationships JOINs causes statement timeout — use UUID lookups
- [x] Added safe() error wrapper so one failed query doesn't hang entire page
- [x] Type check passes clean

### Previous Session
- [x] Fuzzy search, child protection report, 3 ingestion scripts, monetization analysis

### Next
- [ ] Visual QA of youth justice report in browser (screenshots)
- [ ] Commit all new work (youth justice report + reports index update)
- [ ] Verify child protection report also renders
- [ ] Package Contained campaign briefing with youth justice data
- [ ] Consider: add DSS payment overlay to city profiles

### Decisions
- Dev server: always `npx next dev --turbopack -p 3003` (from package.json)
- DB queries: never ILIKE on gs_relationships JOINs — use entity UUID lookups
- exec_sql: ~8s statement timeout — wrap in safe() error handlers
- Contracts query: hardcoded 6 youth justice entity UUIDs for performance
- Report structure: server-rendered page.tsx + client charts.tsx (recharts)

### Open Questions
- UNCONFIRMED: Visual rendering of youth justice report not yet screenshotted
- Child protection report rendering status unknown (also uses exec_sql)

### Workflow State
pattern: build-and-ingest
phase: 6
total_phases: 7
retries: 0
max_retries: 3

#### Resolved
- goal: "Cross-system youth justice intelligence for 5 cities"
- resource_allocation: aggressive

#### Unknowns
- Whether child protection report also has statement timeout issues
- Education expulsion data source not yet identified

#### Last Failure
exec_sql ILIKE on gs_relationships JOIN gs_entities caused statement timeout — fixed with UUID lookups

---

## Context

### New Database Tables Created
| Table | Records | Key Columns |
|-------|---------|-------------|
| `acara_schools` | 9,755 | acara_id, school_name, postcode, state, lga, icsea, indigenous_pct, lbote_pct, total_enrolments, lat, lng |
| `aihw_child_protection` | 2,981 | state, financial_year, metric_name, metric_category, value, source_table |
| `dss_payment_demographics` | 105,529 | payment_type, quarter, geography_type, geography_code, recipient_count |

### Key Files Modified
- `apps/web/src/lib/services/entity-service.ts` — fuzzy search via RPC
- `apps/web/src/app/entities/page.tsx` — fuzzy search in page
- `apps/web/src/app/reports/child-protection/page.tsx` — NEW full report
- `apps/web/src/app/reports/page.tsx` — added report card
- `scripts/ingest-acara-schools.mjs` — NEW
- `scripts/ingest-aihw-child-protection.mjs` — NEW
- `scripts/ingest-dss-payments.mjs` — NEW

### Cross-System Query Proof
```sql
-- Low-ICSEA schools mapped to family payment density
SELECT s.postcode, s.school_name, s.icsea, d.payment_type, d.recipient_count
FROM acara_schools s
JOIN dss_payment_demographics d ON d.geography_code = s.postcode
WHERE s.icsea < 900 AND d.payment_type = 'Family Tax Benefit A'
AND d.geography_type = 'postcode'
ORDER BY d.recipient_count DESC LIMIT 10;
```

### Monetization Strategy (delivered to user)
Four products identified:
1. Commissioned Briefings ($15-25K each) — place-based cross-system reports
2. Place-Based Profiles (SaaS, $5-25K/yr) — postcode/LGA intelligence dashboards
3. Platform Access ($50-200K/yr) — government/foundation subscriptions
4. Evidence-to-Investment Matching — ALMA-powered allocation recommendations

Key insight: "The pipeline is visible in the money" — child protection → youth justice → NDIS disability pathway traceable through funding flows across 3+ government systems.
