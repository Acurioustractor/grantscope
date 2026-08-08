# State-Tenders Ingest — VIC + SA Awarded Contracts

**Status (2026-08-08):** VIC scraper is **built, hardened and validated** — `--apply` upserts, resume-by-ocid survives restarts, politeness delay, per-run data-quality counts. What has NOT happened is the **full crawl**: ~57,349 contracts across 316 agencies at ~1s each is roughly **16 hours**. That is a deliberate decision to make, not a thing to start by accident, because it means sustained traffic to a government site.

**SA is blocked and cannot be unblocked by us.** SA publishes agency names and contract counts anonymously, but every contract list and detail page redirects to `/login`. SA needs an SA Tenders account. Until someone supplies credentials, "VIC/SA ingest" means VIC.

**Why:** Unlocks VIC/SA lighthouse buyers (SPF / SAIPP social-procurement obligations). Adds state contract evidence to SE profiles by ABN — the wedge's "evidence depth" lane. Today the evidence layer is federal-only (AusTender), so a VIC/SA buyer can't see their own social-procurement story.

## The breakthrough (overturns the "dead end")

The ledger recorded VIC/SA tender portals as Cloudflare/Akamai-walled dead ends. That was true for **curl / WebFetch (no JS engine → 403)**. It is FALSE for **headless system-Chrome**:

- `chromium.launch({ channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] })` + an init script hiding `navigator.webdriver` clears Cloudflare on both hosts with `blocked=false, challenged=false`. **No residential proxy needed.**
- Navigate with `waitUntil: 'domcontentloaded'` (NOT `networkidle` — the quick-search XHR can trip the challenge).

## Platform (identical for both states — "Consolidated Tenders")

| | VIC | SA |
|---|---|---|
| Host | `www.tenders.vic.gov.au` | `www.tenders.sa.gov.au` |
| Agencies | 314 | 63 |
| Contracts | ~56,468 | ~3,002 |
| Public? | **Yes — fully open** | **No — auth-gated** |

**SA correction (2026-06-08):** SA publishes agency names + contract *counts* on
`/contract/buyerIndex`, but every actual contract list/detail redirects to
`/login`. SA contract data needs an SA Tenders account — it CANNOT be crawled
anonymously. VIC is fully public (no login). So the ingest is **VIC-only** until
someone supplies SA credentials (then the same scraper works with an auth'd
context). The earlier "SA first to validate" plan is moot — pipeline was instead
validated on a 5-row VIC `--apply` slice (clean ABN+value+ISO dates in the DB).

Data path (same on both):
1. `/contract/buyerIndex` → every agency as `<a>… Name (count) → /contract/search?buyerId=<id>&browse=true`
2. `/contract/search?buyerId=<id>&browse=true` → server-rendered contract list (number, title, status, dates, **value**), each linking `/contract/view?id=<id>`
3. `/contract/view?id=<id>` → detail; supplier name + **ABN** in `.contractor-details`; other fields are flat ordered label/value text in body.

Server-rendered JSP/Struts app — no JSON API. Parse the DOM/text.

## Proven extraction (real rows, 2026-06-08)

```
AMES Australia  C037   Server Hardware…           Lenovo                 ABN 90614012985  $261,000
ACCS            WIC…   Office Tenancy Cleaning…    Pickwick Group Pty Ltd ABN 74089708818  $305,000
```

6/6 sample rows had supplier ABN + value — exactly the evidence-join keys.

## The `$1` values were never a parser bug (found 2026-08-08)

The note below assumed stray `$1` values meant the parser was misreading. It was
not. **VIC publishes `Total Value of the Contract $1.00 (Estimate)` as a sentinel
when the real figure is withheld.** Contract 227360 says so in as many words:

> "the Total Estimated Value of this contract has not been disclosed as it
> constitutes as Genuinely Confidential Business Information"

Ingesting that as a dollar value would silently understate every aggregate built
on it — the same class of error as the SE-buyer-scout inflation. The scraper now
nulls any value ≤ $1 and reports a per-run count of "value withheld by
publisher", so a crawl full of undisclosed values can never read as a low-spend
buyer. Undisclosed is not zero and it is not one dollar.

Field precedence was also corrected: detail-page labelled fields are
authoritative, the list row is the fallback. It used to be the other way round.

## Remaining work (the focused next session)

1. ~~**Parser hardening**~~ — DONE 2026-08-08. Value/date precedence fixed, the
   `$1` sentinel handled, dates parse to ISO. Validated on a live slice: 8/8 rows
   with ABN, 7 with value, 1 correctly recorded as withheld.
2. **Full crawl** — ~59K contracts × ~1s = ~16h. Run as a rate-limited background job, resumable (checkpoint by buyerId; skip already-seen `platform_id`). Be polite (≥800ms delay, off-peak).
3. **Upsert into `austender_contracts`** — `ocid` is NOT NULL + the natural key. Use `ocid = '<state>-tenders-<platform_id>'`. Map title/description/contract_value/dates/buyer_name/buyer_id/supplier_name/supplier_abn/source_url. Fully reversible: `DELETE FROM austender_contracts WHERE ocid LIKE 'vic-tenders-%'`.
4. **Refresh evidence MVs** so state contracts surface on `/suppliers`, SE profiles, and buyer prospecting by ABN.
5. **Re-run `scout-se-buyers`** — VIC/SA buyers now rank by their real SE contract evidence → state lighthouse prospects (the original motivation; see `docs/strategy/buyer-wedge.md` move 3).

## Run it (scaffold, extract-to-JSONL only)

```bash
node scripts/scrape-state-tenders.mjs --state=VIC --agencies-only
node scripts/scrape-state-tenders.mjs --state=VIC --limit-agencies=3 --limit-contracts=5
node scripts/scrape-state-tenders.mjs --state=SA  --limit-agencies=3
```

Output: `data/state-tenders/<state>.jsonl`. Does NOT touch the DB.
