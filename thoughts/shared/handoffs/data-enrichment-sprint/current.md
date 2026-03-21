---
date: 2026-03-19T11:30:00Z
session_name: data-enrichment-sprint
branch: main
status: active
---

# Work Stream: data-enrichment-sprint

## Ledger
**Updated:** 2026-03-21T16:30:00Z
**Goal:** Data infrastructure scaling + relationship expansion
**Branch:** main
**Test:** `node --env-file=.env scripts/gsql.mjs "SELECT relationship_type, COUNT(*) FROM gs_relationships GROUP BY relationship_type ORDER BY count DESC"`

### Now
[->] entity_xref optimized + subsidiary expansion done. Ready for next infrastructure task.

### This Session
- [x] **mv_entity_xref → entity_xref table**: converted from MV (refresh timed out >5min) to regular table with staged refresh. 1.2M rows, refreshable via `scripts/refresh-entity-xref.mjs` (12 staged INSERTs batched by state)
- [x] **Subsidiary expansion**: subsidiary_of 423 → 1,234 (+811) via ABR trading name matching. Script: `scripts/link-subsidiaries-v2.mjs`
- [x] **Expression indexes**: added `idx_gs_entities_name_upper` and `idx_entity_xref_trading_upper` for normalized name matching

### Previous Sessions
- [x] NDIS provider linkage: 48,510 linked, 28,211 tagged
- [x] MV refresh + optimization: power_index 160K, person_network 337K, 9 cascaded MVs
- [x] Foundation type reclassification, 25 distinct types
- [x] Mega-linker: +232K person entities, +425K edges
- [x] Justice ABN linkage, gov body enrichment, SE enrichment

### Key Stats (CURRENT as of 2026-03-21T16:30)
| Table/MV | Rows | Status |
|----------|------|--------|
| gs_entities | 565,660 | Stable |
| gs_relationships | ~1.51M | +811 subsidiary_of |
| entity_xref | 1,211,743 | Fresh (was stale MV) |
| subsidiary_of | 1,234 | Was 423 |
| affiliated_with | 505 | Unchanged |
| mv_entity_power_index | 160,312 | Optimized ✓ |
| mv_person_entity_network | 337,002 | Optimized ✓ |

### Next
- [ ] Company enrichment — 226K without descriptions (biggest gap, needs LLM — BLOCKED by MiniMax balance)
- [ ] entity_xref needs VACUUM — can't complete through Supabase pooler (times out >7min). Try via Supabase dashboard SQL editor
- [ ] Fix foundation enrichment JSON parsing
- [ ] Recharge MiniMax API balance — LLM scripts blocked
- [ ] Subsidiary v2 script improvement — ABR batch queries timeout intermittently via REST API (300 ABNs/batch). Keyset pagination + retry logic works for gs_entities but ABR needs smaller batches or psql fallback

### Decisions
- Justice entities created as entity_type='company', confidence='reported', source_datasets=['justice_funding']
- Most common recipient_name per ABN used as canonical_name
- Junk gov bodies reclassified to 'company' (not deleted — FK constraints)
- enrich-gov-bodies.mjs auto-reclassifies non-gov entities during enrichment
- **MV optimization pattern**: universe-first (collect entity_ids per system, UNION, then JOIN details) — avoids scanning 566K × N LEFT JOINs
- **LATERAL JOINs kill Supabase pooler** at scale — replace with pre-aggregated CTEs filtered by `IN (SELECT entity_id FROM relevant_set)`
- **CASCADE drops 9 dependent MVs** when rebuilding mv_entity_power_index — migration files exist in scripts/migrations/ to recreate each
- **entity_xref converted to regular table** — MV REFRESH timed out (>5min, 6 UNION ALL branches each scanning 566K). Now uses staged INSERTs batched by state in `scripts/refresh-entity-xref.mjs`
- **Subsidiary matching approach**: SQL temp tables (tn_lookup + en_lookup) for fast matching (~3s), then export CSV + Supabase REST for insertion. Direct SQL INSERT into gs_relationships (1.5M rows) times out.
- **PostgREST pagination**: keyset (cursor) pagination required for gs_entities (566K) — offset-based times out at ~400K. Use `.gt('id', lastId).order('id').limit(1000)`
- SE enrichment writes to `social_enterprises` table (separate from gs_entities)
- Foundation enrichment is slow (~1/min) due to web scraping + LLM chain

### Open Questions
- SE enrichment: should results also update gs_entities.description? Currently only social_enterprises table
- Foundation JSON parsing: MiniMax sometimes returns 7K+ char responses that don't parse as JSON
- Foundation enrichment: Gemini fallback is also failing (503 high demand) — need third fallback or retry logic?
- UNCONFIRMED: entity_xref VACUUM may have completed via autovacuum by next session — check `n_dead_tup` on resume

### Workflow State
pattern: enrichment-sprint
phase: 3
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Bulk enrich entities via MiniMax M2.7"
- resource_allocation: aggressive
- justice_abn_linkage: DONE (+13,685 entities)
- gov_body_enrichment: DONE (870/870)
- gov_body_cleanup: DONE (665 junk reclassified)
- entity_xref_optimization: DONE (MV → table, staged refresh)
- subsidiary_expansion: DONE (423 → 1,234)

#### Unknowns
- Company enrichment approach: UNKNOWN (need website scraping or name-based?)
- MiniMax API balance: EXHAUSTED — need recharge for LLM-based scripts

#### Last Failure
MiniMax API balance exhausted (status_code: 1008, status_msg: "insufficient balance") — classify-foundations.mjs blocked

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
