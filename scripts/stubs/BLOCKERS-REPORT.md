# Blocker Analysis — Round B Scrapers

First-principles diagnosis, real root causes, and systematic recovery paths.
Updated 2026-04-25 after deeper reconnaissance.

## 1. NSW political donations

**Real root cause:** NSW Electoral Funding Authority's public disclosure system
is an Angular SPA behind Cloudflare. The landing page `/political-
participants/disclosures` is Kentico CMS content, NOT the disclosure search.
The actual search is on a separate subdomain that historically existed at
`efareports.elections.nsw.gov.au` or `publicdisclosures.elections.nsw.gov.au`
— both now return 000 (no DNS). Wayback has zero CSV/xlsx history. data.nsw
returns 0 hits for "donations/political finance/disclosure".

**Root-cause classification:** Dynamic-SPA + policy. Not just "we couldn't
find it" — the agency doesn't publish bulk data.

**Recovery paths (ranked by likelihood × effort):**

| # | Path | Effort | Likelihood | Notes |
|---|------|--------|------------|-------|
| 1 | Direct email to EFA | 30 min | 60% | Often works for legitimate research |
| 2 | Formal GIPAA request | 1 hr | 95% | 14-28 day response time; binding |
| 3 | Playwright SPA scraper | 6-8 hr | 80% | Real but fragile — Cloudflare risk |

**Recommendation:** start with #1 (email sent via
`outreach/06-nsw-efa-data-request.md`), fall back to #2 after 14 days,
build #3 only if #1+#2 both fail and NSW data is load-bearing for a story.

## 2. VIC political donations

**Real root cause:** VEC's disclosure system EXISTS at
`https://disclosures.vec.vic.gov.au/donations-public/` — I found the URL.
But it's **currently redirecting to /Maintenance/** (HTTP 308). Temporary
outage, not a permanent block.

**Root-cause classification:** Temporary availability. Resolvable by waiting.

**Recovery paths (ranked):**

| # | Path | Effort | Likelihood | Notes |
|---|------|--------|------------|-------|
| 1 | Wait 24-48h, retry | 0 min wait | 90% | Maintenance usually ends |
| 2 | Playwright scraper once up | 4-6 hr | 90% | SPA pattern — template in PLAYWRIGHT-SCRAPER-TEMPLATE.md |
| 3 | Direct email to VEC | 30 min | 60% | `outreach/07-vec-data-request.md` |

**Recommendation:** run a watcher that retries the URL daily; when
`curl -I https://disclosures.vec.vic.gov.au/donations-public/` stops
redirecting to /Maintenance/, build the Playwright scraper.

## 3. Black Business Finder

**Real root cause:** `blackbusinessfinder.com.au` DNS doesn't resolve from
this host (`dig` returns nothing). curl/nslookup also fail. Wayback fetch
was blocked. Can't distinguish between: (a) DNS issue on our resolver, (b)
site is down globally, (c) site blocks all automated access.

**Root-cause classification:** Cannot diagnose without external verification.

**Recovery paths (ranked):**

| # | Path | Effort | Likelihood | Notes |
|---|------|--------|------------|-------|
| 1 | User verifies from own network | 2 min | — | Tells us if site is alive at all |
| 2 | Partnership outreach | 30 min | 70% | `outreach/08-bbf-partnership.md` |
| 3 | Accept Supply Nation coverage | 0 min | — | 6,204 Indigenous businesses already in graph |

**Recommendation:** ask user to try the site in their own browser. If the
site is dead, this is not a "blocker", it's "the source is gone" — move on.
If alive, send the partnership email.

## Summary — what's actually unblockable vs. what's work

| Blocker | Type | Real fix | Time to fix |
|---------|------|----------|-------------|
| NSW donations | Policy + SPA | Direct email OR GIPAA | 2-4 weeks |
| VIC donations | Temporary outage | Wait, then scrape | 1-7 days |
| BBF | Diagnostic unclear | Verify from user's network | 2 minutes |

**None of these are fundamentally unsolvable.** They're just NOT
write-a-scraper problems. Two need human relationships (email outreach).
One needs a different network to verify reachability. One needs waiting +
a non-trivial Playwright build.

The strategic question isn't "can we scrape these" — it's "do we need
this data for the next 30 days of publication, or is federal-level data
(already in the atlas) sufficient for the 2-3 investigations we're
planning?" If federal is enough, these become Round C+ work.
