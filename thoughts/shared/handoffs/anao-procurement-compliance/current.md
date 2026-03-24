---
date: 2026-03-23T08:45:00Z
session_name: anao-procurement-compliance
branch: main
status: complete
---

# Work Stream: anao-procurement-compliance

## Ledger
**Updated:** 2026-03-23T08:45:00Z
**Goal:** ANAO indigenous procurement compliance layer + impact scraper expansion + entity UI. Done when MVs refreshed and entity profiles show all new data live.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`
**Status:** COMPLETE

### Completed This Session (2026-03-23)
- [x] Fixed `refresh-views.mjs` — SET statement_timeout per query, 10min for heavy views, removed 2 non-existent ALMA views
- [x] Refreshed all 48 materialized views (43 via script, 5 retried via psql with extended timeout)
- [x] Verified entity profiles render correctly (Mission Australia + Oonchiumpa — all sections live)
- [x] Added ANAO Procurement Accountability section to `/reports/youth-justice` — MMR stats + portfolio compliance table
- [x] Added `getAnaoYjCompliance()` and `getYjMmrStats()` to report-service.ts
- [x] Improved scraper PDF extraction — pdftotext fallback (<5K chars), OCR fallback (<2K chars via pdftoppm+tesseract)
- [x] 2 commits pushed to main: `5f0b859`, `255cd8c`

### Previously Completed
- [x] ANAO Report 40 (2024-25) data extracted from PDF appendices
- [x] Created 3 reference tables: `anao_mmr_exemptions`, `anao_mmr_compliance`, `mmr_unspsc_categories`
- [x] Tagged 394,226 AusTender contracts as MMR-applicable via `is_mmr_applicable` column
- [x] Fixed `is_community_controlled` false positives: 21,935 → 8,829
- [x] Expanded impact scraper nationally — 56 total reports, 40 quantitative
- [x] Entity profiles: impact reports, MMR contract stats, ANAO compliance
- [x] GrantConnect ingest infrastructure built (migration + script, awaiting CSV)

### Remaining (Non-Blocking)
- [ ] GrantConnect: email `GrantConnect@finance.gov.au` for weekly export CSV (script ready at `scripts/ingest-grantconnect.mjs`)
- [ ] Re-run impact scraper to pick up the 13 previously-failed orgs (now with pdftotext/OCR fallbacks)
- [ ] Consider installing `ocrmypdf` for better OCR quality (tesseract alone works but ocrmypdf adds preprocessing)

### Decisions
- `is_community_controlled`: ORIC indigenous_corp (7,312) + name-matched (1,517) = 8,829 total
- MV refresh: heavy views (mv_entity_power_index etc.) get 10min statement_timeout, others get 5min
- PDF extraction cascade: pdf-parse → pdftotext (threshold <5K) → OCR via tesseract (threshold <2K)
- ANAO youth-justice section shows 4 portfolios: Attorney-Generals (20% compliance), Education (100%), Social Services (100%), NIAA

### Git State
- Branch: main, 5 commits this work stream
- Latest: `255cd8c` — feat: ANAO compliance on youth-justice report, PDF extraction fallbacks
- All pushed to origin
