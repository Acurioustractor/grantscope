---
date: 2026-03-19T11:30:00Z
session_name: data-enrichment-sprint
branch: main
status: active
---

# Work Stream: data-enrichment-sprint

## Ledger
**Updated:** 2026-03-20T14:00:00Z
**Goal:** Bulk enrich entities via MiniMax M2.7 — descriptions, sectors, classifications, linkages
**Branch:** main
**Test:** `node --env-file=.env scripts/gsql.mjs "SELECT entity_type, SUM(CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END) as has_desc, COUNT(*) as total FROM gs_entities GROUP BY entity_type ORDER BY total DESC"`

### Now
[->] SE enrichment still running (b878ab6) — processing indigenous corps, coverage unchanged at 396/5,181

### This Session
- [x] **+13,685 new entities** from justice_funding ABN linkage (145K → 158.7K)
- [x] **Government bodies fully enriched**: 870/870 have descriptions (was 75/1,535)
- [x] Gov body cleanup: 665 junk entities reclassified (CSV fragments, not real gov bodies)
- [x] ALMA linker v4 run: 1 new link (63.6% coverage — remaining 424 are hard-to-match)
- [x] Foundation grantee mapping: 3 matched, 0 new edges (already existed)
- [x] SE enrichment: 396 now have descriptions on gs_entities (was 0, still running)
- [x] New scripts: `enrich-gov-bodies.mjs`, `enrich-social-enterprises.mjs`
- [x] Migration files: `link-justice-funding-entities.sql`, `reclassify-justice-entities.sql`, `cleanup-gov-bodies.sql`

### Running (Background Tasks)
- **SE enrichment** (b878ab6): still running, processing indigenous corps — 396/5,181 gs_entities descriptions so far

### Key Stats (CURRENT as of 2026-03-20T14:00)
| Entity Type | Has Desc | Total | Coverage |
|-------------|----------|-------|----------|
| company | 22,985 | 77,216 | 30% |
| charity | 52,417 | 52,552 | 99.7% |
| foundation | 10,465 | 10,750 | 97.3% |
| indigenous_corp | 7,337 | 7,343 | 99.9% |
| social_enterprise | 396 | 5,181 | 7.6% |
| person | 0 | 4,747 | 0% |
| government_body | 870 | 870 | 100% |
| political_party | 66 | 66 | 100% |

### Next
- [ ] Wait for SE enrichment (b878ab6) to complete
- [ ] Fix foundation enrichment JSON parsing (truncation at 7K chars, Gemini 503 fallback)
- [ ] Company enrichment — 54K without descriptions (biggest absolute gap)
- [ ] NDIS provider→entity ABN matching
- [ ] Subsidiary/parent relationship inference (only 29 exist)
- [ ] Board/directorship overlap expansion (only 2,219 exist)
- [ ] Refresh materialized views after enrichment

### Decisions
- Justice entities created as entity_type='company', confidence='reported', source_datasets=['justice_funding']
- Most common recipient_name per ABN used as canonical_name
- Junk gov bodies reclassified to 'company' (not deleted — FK constraints)
- enrich-gov-bodies.mjs auto-reclassifies non-gov entities during enrichment
- SE enrichment writes to `social_enterprises` table (separate from gs_entities)
- Foundation enrichment is slow (~1/min) due to web scraping + LLM chain

### Open Questions
- SE enrichment: should results also update gs_entities.description? Currently only social_enterprises table
- Foundation JSON parsing: MiniMax sometimes returns 7K+ char responses that don't parse as JSON
- Foundation enrichment: Gemini fallback is also failing (503 high demand) — need third fallback or retry logic?

### Workflow State
pattern: enrichment-sprint
phase: 2
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Bulk enrich entities via MiniMax M2.7"
- resource_allocation: aggressive
- justice_abn_linkage: DONE (+13,685 entities)
- gov_body_enrichment: DONE (870/870)
- gov_body_cleanup: DONE (665 junk reclassified)

#### Unknowns
- SE enrichment completion time: ~110 batches at current rate
- Foundation enrichment success rate: LOW (both MiniMax JSON parse + Gemini 503)
- Company enrichment approach: UNKNOWN (need website scraping or name-based?)

#### Last Failure
Foundation enrichment (b653e9f): MiniMax returns 7K+ chars that don't parse as JSON; Gemini fallback hitting 503 (high demand)

---

## Context

### MiniMax M2.7 Setup
- API: `scripts/lib/minimax.mjs` (shared ESM + TS versions)
- Model: `MiniMax-M2.7` (reasoning model, wraps CoT in `<think>` tags)
- Stripped via `stripThinkTags()` before returning
- Cheap bulk enrichment — good for classification tasks

### Scripts Using MiniMax
- `enrich-charities.mjs` — website scrape + LLM description
- `enrich-foundations.mjs` — website scrape + LLM profiling
- `enrich-social-enterprises.mjs` — website scrape + LLM classification
- `enrich-oric-corporations.mjs` — ORIC data + LLM enrichment
- `enrich-programs.mjs` — program classification
- `classify-acnc-social-enterprises.mjs` — SE classification
- `discover-foundation-programs.mjs` — program discovery
- `scrape-grant-deadlines.mjs` — deadline scraping
- **NEW: `enrich-gov-bodies.mjs`** — name-based classification (no web scraping)

### Enrichment Coverage Gaps (Priority Order)
1. Companies: 54K/77K without descriptions (70% gap)
2. Social enterprises: 4.8K/5.2K without descriptions (92% gap on gs_entities)
3. Persons: 4.7K with zero enrichment
4. Foundations: 770 without giving data
5. Indigenous corps: 7K without websites (but 99.9% have descriptions)

### Relationship Gaps
- Subsidiary/parent: only 29 exist
- Board/directorship: only 2,219
- Partners_with: only 44
- Foundation→grantee edges need fuzzy matching (exact match found only 3)

### Data Quality Issues Found
- ~665 government_body entities were CSV parse artifacts (commas, dollar signs, work order descriptions)
- Justice funding has some blank ABNs and "(blank)" recipient names
- Foundation enrichment JSON parsing fails on large web pages (7K+ char responses)

### Previous Sprint Results (2026-03-15)
- ABR bulk XML import: 18.5M records
- Entity Resolution Engine: 143,601 entities
- Relationship Extraction: 1,055,346 relationships
- Government entity resolver: 1,427 new govt bodies
