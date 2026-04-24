# Round B Scrapers — Reconnaissance Notes

Built or researched 2026-04-25. One landed as v1 (parliament interests),
three need more reconnaissance before proper implementation.

## 1. Parliament interests — `scripts/scrape-parliament-interests.mjs` (v1 shipped)

**Source:** https://www.aph.gov.au/Senators_and_Members/Members/Register
**Status:** SHIPPED v1 with known limitations.

- Framework fetches the register index, extracts 135 MP PDF URLs
- Downloads + parses each PDF via pdf-parse v2.x
- Splits by section headers (Shareholdings, Directorships, etc.)
- Extracts org mentions by company-suffix regex
- Matches MPs to gs_entities by lastname ILIKE
- Creates `gs_relationships` of type `shareholder_of | director_of | member_of`

**Known limitations:**
- PDFs are change-log format (notifications of addition/deletion) rather
  than flat current-state. Section structure varies between MPs.
- MP-entity matching by lastname ILIKE returns null for MPs not yet
  ingested into `gs_entities` as `entity_type='person'`. Run
  `scripts/ingest-parliament-members.mjs --live` first for best results.
- Org-name extraction regex is conservative — only catches names with
  Pty Ltd / Limited / Inc / Corporation suffixes.
- Gifts and sponsored travel sections contain descriptive text, not
  structured org names — usually skipped.

**Usage:**
```bash
node --env-file=.env scripts/scrape-parliament-interests.mjs --dry-run --limit=10
node --env-file=.env scripts/scrape-parliament-interests.mjs --limit=10   # live
```

**Next iteration:** replace regex-based extraction with LLM-based entity
extraction (given we have gemini/anthropic/openai tokens elsewhere in
the codebase). Would raise yield from ~30% to probably 70-80%.

---

## 2. NSW political donations — NOT shipped

**Source considered:** https://elections.nsw.gov.au/electoral-funding/disclosures

**Why blocked:** NSW Electoral Funding Authority uses a JavaScript
single-page search app for disclosure lookup. There is no public CSV
or JSON API. The data.nsw.gov.au catalogue returns zero hits for
"political donations" via the CKAN API. Direct HTML scraping of the
SPA would return empty document shells.

**What a proper scraper needs:**
1. Reverse-engineer the JS-driven search API (check devtools Network
   tab on a real disclosure search)
2. Or obtain a bulk CSV export via a direct FOI request to NSW EFA
3. Or scrape results using Puppeteer / Playwright headless-browser

**Recommendation:** treat as out-of-scope for a one-off scraper. Best
path is FOI request or direct email to NSW EFA (efa@elections.nsw.gov.au)
asking for bulk disclosure data export.

---

## 3. VIC political donations — NOT shipped

**Source considered:** https://www.vec.vic.gov.au/ (VEC)

**Why blocked:** The URL path assumed (funding-and-disclosure) returns
404. VEC has restructured and the current donation-disclosure path
needs manual research. The discover.data.vic.gov.au API returned
empty for "political donations".

**What a proper scraper needs:**
1. Manually browse https://www.vec.vic.gov.au to find the current
   disclosure section
2. Check if Victoria's Independent Broad-based Anti-corruption
   Commission (IBAC) publishes donation data
3. Check data.vic.gov.au for an election-funding dataset (different
   search terms needed)

---

## 4. Black Business Finder — NOT shipped

**Source considered:** https://blackbusinessfinder.com.au/

**Why blocked:** `ECONNREFUSED` on direct HTTP attempts. Site appears
to be either down, blocking scrapers, or DNS-resolving incorrectly
from this host. Couldn't verify access at all.

**What a proper scraper needs:**
1. Verify the site is actually reachable (different network, mobile
   data, etc.)
2. Check robots.txt for scraping policy
3. Contact BBF directly to request a data partnership — this is the
   cleanest path and aligns with our partner-principles in
   /about/curious-tractor

**Recommendation:** our existing Supply Nation linkage (PR #33 Round A)
already covers ~3,883 Indigenous businesses. BBF would add coverage
but requires either permission or a working connection. Non-urgent.

---

## Summary

- **1 of 4 scrapers shipped** — parliament interests v1, yield TBD
- **3 blocked** — not from lack of intent, but because the data access
  path is not clear without more reconnaissance than a single session
  can provide
- Round B objective partially met; for full coverage, each of the 3
  blocked sources needs a dedicated research session + likely direct
  outreach to the data custodian

Next useful move: the parliament scraper extraction quality is the
highest-leverage follow-up. Swap regex-based extraction for LLM-based
and we get 2-3x better yield from the 135 existing PDFs.
