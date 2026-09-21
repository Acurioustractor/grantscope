# Do grant URLs still lead anywhere?

**Date:** 2026-09-21 · **Tool:** `scripts/audit-grant-url-health.mjs`
**Method:** plain fetch as a cheap first pass, then **every non-2xx re-checked in a
real browser** before it is called dead.

## The headline: there is almost no link rot, and the first measurement was wrong

| population | fetch ok | bot-blocked | genuinely dead |
|---|---|---|---|
| every open grant (n=311) | 67.8% | **31.8%** | **0.3% — one row** |
| random sample of all grants (n=500) | 95.0% | 2.8% | 2.2% |

A first pass using bare `fetch` reported **93 of 93 open GrantConnect grants as
"404 gone"**. Every one of them loads fine in a browser. `grants.gov.au` answers a
plain HTTP client with 403/404 whether or not the page exists — `curl` gets 403 on
its own homepage. A bot wall and a dead link are indistinguishable to fetch, and
reading one as the other would have had us delete 30% of the live desk.

**So the audit tool never calls a URL dead on fetch alone.** That two-pass shape is
the point of the script, not an implementation detail.

## The real finding: the deadline enricher cannot see a third of the open desk

`scrape-grant-deadlines.mjs` fetches pages with a plain `fetch`. It therefore logs
`SKIP ... HTTP 404` for **99 of 311 open grants (31.8%)** — 94 of them GrantConnect,
i.e. essentially every Commonwealth grant opportunity on the desk. Those are the
highest-value rows in the table and the enricher has never once read one.

`scripts/enrich-grant-eligibility.mjs` already solves this: it drives Chromium with
`channel: 'chrome'` and a real user agent. The deadline scraper wants the same path.

Hosts that block plain HTTP clients, from the open-grant run:

| n | host |
|---|---|
| 94 | www.grants.gov.au |
| 1 each | goodtogreatschools.org.au, dtet.qld.gov.au, www.dwatsipm.qld.gov.au, www.create.sa.gov.au, www.tmr.qld.gov.au |

## Where the genuinely dead rows are

11 of 500 in the random sample, **7 of them `foundation_program`** — dead base
domains (`ENOTFOUND` on `saif.au`, `kinghornfoundation.org`) and removed scholarship
pages. The rest are single expired government pages.

## A separate false precision, found on the way

**99.9% of `foundation_program` URLs (1,744 of 1,746) carry a fabricated anchor.**
`sync-foundation-programs.mjs:198` builds every one as
`${baseUrl}#${programSlug(program.name)}`. The anchor is ours, not the site's, and
almost never matches an element on the page. A browser ignores it, so nothing breaks
— but the URL reads as a deep link to the specific programme when it is only the
foundation's front page. Same family as the rest of today's findings: a value
presented with more confidence than its source supports.
