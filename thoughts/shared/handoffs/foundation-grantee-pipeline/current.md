---
date: 2026-03-18T02:58:00Z
session_name: foundation-grantee-pipeline
branch: main
status: active
---

# Work Stream: foundation-grantee-pipeline

## Ledger
**Updated:** 2026-03-18T10:05:00Z
**Goal:** Build the "Bloomberg terminal for social sector funding" — comprehensive map of who funds what in Australia. Cross-sector graph: grants + contracts + donations + justice + evidence.
**Branch:** main
**Test:** `node --env-file=.env scripts/gsql.mjs "SELECT dataset, COUNT(*) FROM gs_relationships WHERE relationship_type = 'grant' GROUP BY dataset ORDER BY count DESC"`

### Now
[->] Session complete. Ready for next batch of sources or cleanup tasks.

### This Session
- [x] NHMRC re-run: 9,207 new edges (dedupe fix worked, up from 103 to 9,310 total)
- [x] HMS Trust: 3,591 edges from 4,970 grants CSV (72% match)
- [x] Lotterywest: 380 edges from 512 grants API (75.6% match). Created Lotterywest entity (AU-ABN-75964258835).
- [x] FRRR: Built `scripts/scrape-frrr-grants.mjs` — WordPress REST API scraper, 5,521 grants from 143 blog posts (2015-2026). 3,588 edges (69.2% match). **BUG: amount parsing inflated — $82T instead of ~$50M. Fix amounts later.**
- [x] William Buckland Foundation: 151 edges from 181 grants across 3 PDF annual reports (2020-2022), 93.4% match
- [x] Westpac Group Foundations: 69 edges from 86 recipients (2024), 83.7% match. No individual amounts disclosed.
- [x] Researched ACF (down for maintenance), VFFF (logos only, no data), LMCF (redirected, no public list), RE Ross (DNS failure)
- Previous: Ian Potter, ARC, Creative Australia, Queensland Arts, NHMRC (first run), Candid research, foundation cross-referencing, sweep script build

### Current Grant Edge Totals (19 datasets)
| Dataset | Edges | Total $ |
|---------|------:|--------:|
| justice_funding | 34,857 | $14.9B |
| nhmrc_grants | 9,310 | $1.1B |
| grant_opportunities | 5,444 | $3.5B |
| hms_trust_grants | 3,591 | $117M |
| frrr_grants | 3,588 | BUG — fix amounts |
| creative_australia | 3,394 | $708M |
| ian_potter_grants_db | 1,399 | $224M |
| arc_grants | 1,045 | $18.0B |
| qld_arts_grants | 959 | $310M |
| lotterywest_grants | 380 | $139M |
| wbf_grants | 151 | $15M |
| 8 foundation reports | 274 | $15M |
| **Total** | **64,392** | **$39.0B+** |

### Next
- [ ] Fix FRRR amount parsing bug (amounts have extra digits from parseAmount)
- [ ] Fix Westpac funder entity (matched "Employee Assistance Foundation" not "Westpac Foundation" — create proper entity)
- [ ] GrantConnect bulk (100K+ govt grants) — email GrantConnect@Finance.gov.au
- [ ] ARC RGS grants (second dataset on ARC portal)
- [ ] VFFF annual reports (reports.vfff.org.au — JS-rendered, need headless browser)
- [ ] ACF directory (down for maintenance, retry later)
- [ ] LMCF (now Greater Melbourne Foundation, greatermelbournefoundation.org.au — no public grant list found)
- [ ] Fix 10 known false positive edges
- [ ] Justice Funding entity linkage (10,609 records)
- [ ] Refresh materialized views after all ingests

### Decisions
- **exec_sql is READ-ONLY** — use `db.from().insert()` for writes
- **idx_gs_rel_dedup constraint** — unique on (source, target, type, dataset, source_record_id)
- **NHMRC dedupe fix** — removed checkExisting, rely on unique constraint for individual grants
- **FRRR WordPress API** — `GET frrr.org.au/wp-json/wp/v2/posts?search=recipients` returns HTML with embedded tables (not JS-rendered)
- **WBF PDFs are structured** — tables with Organisation, Project, Amount, Instalment columns. Manual JSON extraction is faster than building a PDF parser for 3 files.
- **Westpac 2024** — 96 grant partners, $10.7M total, but individual amounts not disclosed
- **Fuzzy match threshold 0.5+**: pg_trgm below 0.5 = too many false positives

### Open Questions
- Foundation Maps Australia — can we get research access?
- Perpetual manages 1,000+ trusts ($125M/yr) but no aggregated public data

### Workflow State
pattern: data-enrichment
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Build Bloomberg terminal for social sector funding"
- resource_allocation: aggressive

#### Unknowns
- GrantConnect bulk access: need email request
- Foundation Maps Australia research access: UNKNOWN

#### Last Failure
- FRRR amount parsing: parseAmount strips non-numeric chars but some amounts had extra digits from HTML entities. Need to fix.

---

## Context

### Scripts Created
1. `scripts/scrape-ian-potter-grants.mjs` — Full grants database scraper with pagination, caching, entity matching
2. `scripts/map-foundation-grantees-bulk.mjs` — Multi-foundation grantee mapper with hardcoded lists
3. `scripts/parse-myer-grants.mjs` — PDF table parser for Myer annual report format
4. `scripts/extract-foundation-grantees-pdf.mjs` — Claude API PDF extractor (general purpose)
5. `scripts/link-alma-v4.mjs` — 6-phase ALMA entity linker
6. `scripts/link-indigenous-abns.mjs` — 3-stage indigenous corp ABN resolver
7. `scripts/sweep-public-grants.mjs` — 11-source grant ingest pipeline (CA, QLD, NHMRC, ARC, ACNC, HMS, Lotterywest, FRRR, WBF, Westpac)
8. `scripts/download-arc-grants.mjs` — ARC API scraper
9. `scripts/scrape-frrr-grants.mjs` — FRRR WordPress REST API scraper (5,521 grants from 143 posts)

### Foundation Data Sources Researched
**Tier 1 (structured, scrapeable):**
- Helen Macpherson Smith Trust — CSV download, 4,688 grants since 1955
- Lotterywest — JSON API, 512 grants, $169M
- FRRR — blog posts per round, 16,000+ grants since 2000

**Tier 2 (more effort):**
- Australian Communities Foundation — filterable web directory
- Lord Mayor's Charitable Foundation — web database + PDF supplements
- William Buckland Foundation — PDF grants-paid tables per year

**Tier 3 (limited):**
- VFFF — recipients page, may be narrative
- Westpac Foundation — press releases + PDF impact report
- RE Ross Trust — web grant lists

**Skip:**
- Scanlon Foundation — no published grantee lists
- Sidney Myer Fund — PDF only, related to already-mapped Myer
- Perpetual — no aggregated data despite managing 1,000+ trusts

### False Positive Edges to Fix
- "Australian Cultural Fund" → "Australian Vedic Cultural Trust" (Gandel)
- "Walk Free Foundation" → "Free Throw Foundation" (Minderoo)
- "International Justice Mission" → "International Mission Ministries Inc" (Minderoo)
- "Vision Australia" → "World Vision Australia" (Gandel)
- "Hadassah Australia" → "HAENNI AUSTRALIA" (Gandel)
- "JDRF Australia" → "JCI AUSTRALIA" (Gandel)
- "Queensland Brain Institute" → "QUEENSLAND HEART INSTITUTE LIMITED" (Tim Fairfax)
- "Centre for Social Impact, University" → "University Impact" (Myer)
- "Ardoch Youth Foundation" → "Doxa Youth Foundation" (Gandel)
- "Environmental Leadership Australia" → "WOMEN'S ENVIRONMENTAL LEADERSHIP AUSTRALIA LIMITED" (Myer)
