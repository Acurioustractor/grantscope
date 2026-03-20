---
date: 2026-03-20T17:30:00+10:00
session_name: justice-data-sweep
branch: main
status: active
---

# Work Stream: justice-data-sweep

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-20T17:30:00+10:00
**Goal:** Comprehensive justice data audit, cleanup, and new people data pipelines (ACNC, ASIC, OpenCorporates, OpenPolitics)
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] All immediate tasks complete — ready for full ACNC scrape or next priorities

### This Session
- [x] Comprehensive justice data sweep across all tables (justice_funding, ALMA, power index, revolving door)
- [x] Fixed sector duplication: normalised `youth-justice` → `youth_justice` (320 rows)
- [x] Deleted 444 non-justice federal procurement records ($1.06B — missiles, ammunition, embassy leases)
- [x] Normalised all remaining hyphenated sectors to underscores (23 rows)
- [x] Refreshed mv_entity_power_index and mv_revolving_door
- [x] Added unique index on mv_entity_power_index(id) for concurrent refresh
- [x] Built `person_roles` table schema with dedup index, trigram search, RLS
- [x] Built ACNC board member scraper (scrape-acnc-people.mjs) — 4-phase resumable, tested with 51 records
- [x] Built ASIC officer scraper (scrape-asic-officers.mjs) — needs Playwright for CAPTCHA
- [x] Built OpenCorporates officer pipeline (scrape-opencorporates-officers.mjs) — needs API key
- [x] Built OpenPolitics parliamentarian scraper (scrape-openpolitics.mjs) — 227 MPs with interest declarations

### Next
- [ ] Run full ACNC scrape (~93K charities, ~500K person_roles records)
- [ ] Apply for OpenCorporates API key (instructions in output/opencorporates-application.md)
- [ ] Consider OpenPolitics subscription ($7.90/mo) for directorship company names
- [ ] Upgrade ASIC scraper to use Playwright for CAPTCHA bypass
- [ ] Build board interlock analysis queries / visualization
- [ ] Address remaining data quality: 13,820 single-system justice entities need ABN cross-matching
- [ ] Investigate 2013-14 data gap (831 records, no dollar amounts)

### Decisions
- person_roles table: person_name_normalised is GENERATED ALWAYS (UPPER + trim + collapse whitespace)
- Dedup: unique on (person_name_normalised, role_type, company_acn, COALESCE(appointment_date, '1900-01-01'))
- confidence enum: registry|verified|reported|inferred|unverified
- role_type enum: director|secretary|officer|chair|ceo|cfo|trustee|partner|founder|board_member|responsible_person|public_officer|other
- OpenPolitics: idempotent delete+reinsert pattern (data changes frequently)
- Justice cleanup: deleted Outside Australia records rather than moving to separate table (clearly wrong data)

### Open Questions
- UNCONFIRMED: Whether ACNC full scrape will complete without rate limiting issues (~93K charities)
- UNCONFIRMED: How many board interlocks will emerge from full ACNC data
- UNKNOWN: Best approach for ASIC CAPTCHA — Playwright vs paid API vs manual batches

### Workflow State
pattern: data-pipeline-build
phase: 2
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "Justice data audit + people data pipelines"
- resource_allocation: aggressive

#### Unknowns
- acnc_rate_limits: UNKNOWN (tested with 10, need to verify at scale)
- asic_captcha_bypass: UNKNOWN

#### Last Failure
(none)

---

## Context

### Justice Data Landscape (as of 2026-03-20)

**Scale:**
- justice_funding: 70,963 records, 38K unique recipients, 20,280 linked entities (88.6%)
- ALMA: 1,162 interventions, 570 evidence, 506 outcomes, 334 linked entities
- Power index: 20,279 justice entities across 1-6 systems
- 94.5% of justice records have dollar amounts

**State breakdown:** QLD $45B (65K records), VIC $16.5B, NSW $16.3B, WA $6.9B, NT $5.1B

**Sectors (normalized):** youth_justice ($70.8B), community_services ($19.2B), federal ($3.1B), legal_services ($3B)

**Time series:** 2008-2026, steady growth from $2.6B to $12.4B/yr

**Cross-system:** 13,820 justice entities in only 1 system (invisible to procurement/donations). 39 entities span 5 systems, 2 span 6.

**ALMA evidence quality:** Mostly Untested/Promising. Only 5 Proven (RCT). Cultural Connection has most Indigenous-led evidence (11).

**Top evidence-linked orgs:** WA Dept of Justice (28 ALMA), Ted Noffs (16), PCYC QLD (14), Youth Advocacy Centre (12), Palm Island Community Company (7)

**Revolving door:** Top scores are corporates (Multiplex, Thiess, Qantas, Telstra) that donate + contract + receive justice funding — not frontline service providers.

### New Scripts Created
- `scripts/migrations/create-person-roles.sql` — person_roles table
- `scripts/migrations/fix-justice-data-quality.sql` — sector normalization + junk removal
- `scripts/scrape-acnc-people.mjs` — ACNC responsible persons (4-phase, resumable)
- `scripts/scrape-asic-officers.mjs` — ASIC officer data (needs Playwright)
- `scripts/scrape-opencorporates-officers.mjs` — OpenCorporates officers (needs API key)
- `scripts/scrape-openpolitics.mjs` — Federal parliamentarian interests (working)
