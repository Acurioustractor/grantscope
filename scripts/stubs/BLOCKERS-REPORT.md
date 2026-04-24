# Blocker Analysis — Round B Scrapers (FINAL)

First-principles diagnosis, real root causes, and systematic recovery paths.
Last updated 2026-04-25 after exhaustive reconnaissance.

## 1. NSW political donations — Playwright required

**System located:** `https://efadisclosures.elections.nsw.gov.au/`
- Salesforce VisualForce page (VFRemote + DataTables + jQuery)
- Form POSTs to `/FDCLiteDisclosures` with `ViewState` + `ViewStateVersion`
  + `ViewStateMAC` tokens (CSRF-like)
- Fields: `electionEventValue`, `electorateValue`, `partyAffiliationValue`,
  `OrganisationName`, `ABNName`, `familyName`, `givenName`, `fromDate`,
  `toDate`
- **Tested:** submitting with ViewState tokens returns the search page but
  zero data rows — form likely requires specific required-field combinations
  (election event + date range) OR data is populated via a separate
  Visualforce.remoting.Manager.invokeAction() AJAX call after form submit

**Why a simple curl script can't finish the job:**
- Salesforce VFRemote uses server-side ViewState that expires per-session
- Results may be populated by JS after form submission (DataTables)
- Proper scraping needs Playwright to: GET landing, submit form, wait for
  DataTables to render, extract `<tbody>` rows, handle pagination

**Estimated effort for a complete scraper:** 4-6 hours (Playwright + VF
ViewState handling + pagination + 2024-2025 date-range filtering).

**Recovery paths (ranked):**
1. **Playwright scraper** — 4-6h, 80% likely to work (no Cloudflare at this
   subdomain, just Salesforce rate limits)
2. **Direct email to EFA** (`thoughts/shared/outreach/06-nsw-efa-data-request.md`)
   — 30 min to send, 60% likely to get bulk data within a week
3. **GIPAA formal request** — 1h, 95% likely to succeed, 14-28 day wait

## 2. VIC political donations — TEMPORARY maintenance

**System located:** `https://disclosures.vec.vic.gov.au/donations-public/`
- Confirmed at the right URL
- Currently returns HTTP 308 → `https://www.vec.vic.gov.au/Maintenance/`
- Not gone, just temporarily offline

**Recovery paths:**
1. **Watcher script** — cron every 6h: `curl -I` and alert when 200 OK instead
   of 308. Then build Playwright scraper.
2. **Direct email to VEC** (`thoughts/shared/outreach/07-vec-data-request.md`)

## 3. Black Business Finder — RESOLVED

**System located:** `https://gateway.icn.org.au/bbf/capability-statements`
(Industry Capability Network / ICN Gateway platform)

**Final results (scraper live run):**
- 76 unique suppliers harvested (100% with clean ABN)
- **16 new entities created** in gs_entities (not previously in atlas)
- **60 existing entities updated** (matched by ABN, tagged `bbf-listed`,
  `is_community_controlled=true`)
- Output: `output/bbf-suppliers-2026-04-24.json`

**Important finding:** the public BBF view is capped at ~80 "featured"
suppliers. The full ICN Gateway directory is auth-gated. To get the complete
directory, partnership outreach is needed
(`thoughts/shared/outreach/08-bbf-partnership.md`).

**Usage:**
```bash
node --env-file=.env scripts/scrape-bbf-suppliers.mjs                    # 80 featured
node --env-file=.env scripts/scrape-bbf-suppliers.mjs --pages=3 --detail-limit=80
```

## Summary matrix

| Source | State | Blocker type | Fix |
|---|---|---|---|
| NSW donations | Playwright required | Session + JS | Build scraper (4-6h) OR email EFA |
| VIC donations | Temporary maintenance | Availability | Watcher + retry in 24-48h |
| BBF | **RESOLVED** | Was wrong URL | Scraped — 76 suppliers added |

## What's actually been added to the atlas

- **Supply Nation** (Round A): ~3,883 Indigenous-certified suppliers
- **BBF** (this round): 76 Indigenous-led suppliers (60 enriched existing
  entities, 16 wholly new)
- **ORIC** (pre-existing): ~8,451 Aboriginal & Torres Strait Islander
  corporations

Combined Indigenous business coverage: **~12,400 entities** with
`is_community_controlled = true` and `is_supply_nation_certified` /
`bbf-listed` / `entity_type=indigenous_corp` flags.

The NSW/VIC donation gaps don't affect existing Indigenous business
mapping. They're independent problems that only bite when a NEW publication
needs state-level donation data — not blocking anything else.
