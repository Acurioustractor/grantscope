# Blocker Analysis — Round B Scrapers (UPDATED)

First-principles diagnosis, real root causes, and systematic recovery paths.
Updated 2026-04-25 after deeper reconnaissance and correction by user.

## 1. NSW political donations — STILL BLOCKED

**Real root cause:** NSW Electoral Funding Authority's public disclosure system
is an Angular SPA behind Cloudflare. The landing page at `/political-
participants/disclosures` is Kentico CMS content, not the actual search.
The disclosure search historically lived at efareports/publicdisclosures
subdomains — both now return 000 (no DNS). Wayback has zero CSV/xlsx
captures. data.nsw returns 0 hits for political finance terms.

**Recovery paths (ranked):**
1. Direct email to EFA — `outreach/06-nsw-efa-data-request.md` (60% likely)
2. GIPAA formal request — 14-28 day response (95% likely, binding)
3. Playwright SPA scraper — 6-8h build (80% likely, Cloudflare risk)

## 2. VIC political donations — TEMPORARY OUTAGE

**Real root cause:** Found the actual URL:
`https://disclosures.vec.vic.gov.au/donations-public/` — currently redirecting
to `/Maintenance/` (HTTP 308). Temporary, not permanent.

**Recovery paths:**
1. Retry in 24-48h, then build Playwright scraper (most likely to succeed)
2. Direct email to VEC — `outreach/07-vec-data-request.md`

## 3. Black Business Finder — SCRAPED!

**Original mis-diagnosis:** I probed `blackbusinessfinder.com.au` which
doesn't resolve from this host (DNS dead or site gone).

**Actual URL (user-provided):** `https://gateway.icn.org.au/bbf/capability-
statements` — hosted by Industry Capability Network (ICN) Gateway platform.

**Status:** Scrapeable end-to-end. No auth required for listings or detail
pages. Server-rendered HTML, clean ABN extraction from detail pages.
Respectful throttling at 2.5 req/sec. robots.txt allows all.

**Built:** `scripts/scrape-bbf-suppliers.mjs`
- Phase 1: paginates /bbf/capability-statements?page={1..N}, extracts
  supplier IDs + card metadata
- Phase 2: fetches /suppliers/{id} detail pages for ABN
- Phase 3: upserts to gs_entities with tags
  `['bbf-listed','indigenous-supplier']` and sets
  is_community_controlled=true

**Sample output (5 pages, 20 detail fetches):**
- 75 unique suppliers harvested
- 20/20 detail fetches returned clean ABN (100% hit rate)
- Clean names, locations (State extracted from "City, STATE" pattern)

**Usage:**
```bash
node --env-file=.env scripts/scrape-bbf-suppliers.mjs --dry-run --pages=5 --detail-limit=20
node --env-file=.env scripts/scrape-bbf-suppliers.mjs --pages=300 --detail-limit=1500   # live
```

## Summary

- NSW donations: POLICY block (no bulk API). Email + GIPAA path.
- VIC donations: TEMPORARY block (maintenance). Watcher + Playwright.
- BBF: RESOLVED. Scraper built and running.
