# VIC crawl shortlist — pick targets before crawling

**Built:** 2026-08-08 from the live VIC agency index — 316 agencies, 57,349 contracts. Nothing has been
crawled. This exists so the crawl is aimed rather than exhaustive.

The index itself lives at `data/state-tenders/vic-agencies.json`, which is **gitignored**. Regenerate it
(about 20 seconds, no bulk crawling) with:

```bash
node --env-file=.env scripts/scrape-state-tenders.mjs --state=VIC --agencies-only
```

Timing below assumes ~1.5s per contract (page load plus the 800ms politeness delay). The full index is
about **24 hours** at that rate, not the 16 the ingest spec estimated.

## The thing worth noticing first

**81 of the 316 agencies are health, justice, housing or community**, holding 13,942 contracts — about 4
hours. But most of those are *closed* predecessor entities. VIC has reorganised its human-services
departments repeatedly, so the same delivery relationship is split across "Dept of Human Services - Office
of Housing - CLOSED", "DHHS", "Department of Health and Human Services (CLOSED)" and "Department of
Families, Fairness and Housing". Any VIC buyer pack has to reconcile those or it will understate history.

## Tranche 1 — the NSW DCJ analogue (recommended first crawl)

| Agency | Contracts | buyerId | Why |
|---|---|---|---|
| **Department of Justice and Community Safety** | 2,578 | 320019 | The live VIC justice department, and the direct parallel to the NSW DCJ pack already built. VIC is the state with *mandated* SPF weightings, so this is the strongest obligation story available anywhere in the data. |

**~65 minutes.** One agency, one command, and it produces a VIC lighthouse prospect that can be compared
like-for-like against NSW DCJ.

```bash
node --env-file=.env scripts/scrape-state-tenders.mjs --state=VIC --apply --buyer-id=320019
```

`--buyer-id` accepts a comma-separated list. Verified against DJCS 2026-08-08: it resolves the agency,
reports the contract count up front, and warns on any id not present in the index. Do not use
`--limit-agencies` to pick a target — it takes the first N of the index in page order, which is
alphabetical.

## Tranche 2 — the rest of the live justice and community picture

| Agency | Contracts | buyerId |
|---|---|---|
| Department of Justice (predecessor of DJCS) | 2,128 | 277022 |
| Department of Health | 673 | 714739 |
| Department of Families, Fairness and Housing | 443 | 714822 |
| Court Services Victoria | 698 | (see index) |
| Dept of Families, Fairness and Housing - Homes Victoria & Director of Housing | 182 | 320509 |

**~2 hours.** Completes the live picture without touching the closed entities.

## Tranche 3 — historical depth

| Agency | Contracts | buyerId |
|---|---|---|
| Dept of Human Services - Office of Housing - CLOSED | 2,948 | 295639 |
| Department of Health & Human Services (DHHS) | 1,174 | 319978 |
| ~70 further closed sub-entities | ~3,100 | (see index) |

**~3 hours.** Only worth it if a buyer asks for history beyond the current department's own records.

## SA — mapped 2026-08-08, and it is small

SA was re-tested properly rather than taken from the June note, because two "settled" conclusions have
already fallen over today. The June finding survives, but the picture around it is much better than
recorded.

**The wall is real.** With a warmed session that had already cleared Cloudflare, `/contract/search?buyerId=…`
and `/contracts/organisationWide` both redirect to `/login`. That is an authentication wall, not a bot
challenge.

**There is no open-data route.** `data.sa.gov.au` runs a CKAN API at `/data/api/3/action/…`. Datasets with
`jurisdiction:"South Australia"` matching "contract": **zero**. The only SA procurement dataset is *State
Procurement Board Annual Report Data* (XLSX, last modified 2021-10-25) — aggregate annual figures, no
supplier ABNs, no contract lines. SA simply does not publish what QLD publishes prolifically.

**But the buyer index IS public, and SA is tiny.** 66 agencies, **2,979 contracts total** — about 1/19th of
VIC. Behind the login, the whole of SA is roughly a 75-minute crawl.

| SA agency | Contracts | buyerId |
|---|---|---|
| Department for Education | 538 | 56694 |
| Department for Infrastructure and Transport | 446 | 56644 |
| SA Health | 247 | 56691 |
| SA Housing Trust | 113 | 267553 |
| Department of Human Services (DHS) | 98 | 84271 |
| Housing SA - Asset Services | 74 | 94146 |
| Attorney Generals Department | 59 | 56683 |
| Department for Child Protection | 59 | 223646 |
| South Australia Police | 51 | 56697 |
| Department for Correctional Services | 23 | 56713 |

The wedge-relevant set — housing, human services, child protection, attorney-general, corrections — is **14
agencies and 500 contracts, about 15 minutes**.

### What unblocking SA actually needs

The portal offers Supplier Login, Agency Login and **Sign Up**. A supplier account is the plausible route,
and ACT is a real supplier so registering is not a pretence. Two things make this Ben's call and not a
task to just do:

1. **Creating an account on an external system in ACT's name is Tier 3.** It needs an explicit decision.
2. **Crawling behind an authenticated session engages the site's terms of use** in a way anonymous access
   does not. Worth reading those terms before pointing a scraper at it, rather than after. The scraper
   supports an authenticated context technically; whether it *should* be used that way is a judgement about
   ACT's standing with a government buyer it may later want to sell to.

Until then, SA gives buyer names and contract counts. That is enough to choose a target and size it. It is
not enough to show a buyer their own supplier story, which is the whole pitch.

### Running SA once you have an account

**Sign up:** <https://www.tenders.sa.gov.au/terms?needAck=y>

That is the actual target of the "Sign Up" link on the login page, verified 2026-08-08 — registration
begins with a terms acknowledgement. There is no `/register` URL; going there directly 404s behind the
Cloudflare wall. Choose **Supplier**, not Agency. ACT Pty details: ABN 36 697 347 676.

**On the terms question I raised:** I read them. 8,695 characters, searched for every relevant term family
— automated, robot, spider, scrape, crawl, bulk, extract, data mining, harvest, screen scraping. **No
clause on any of them.** So the terms do not prohibit automated retrieval. Two honest caveats: `robots.txt`
sits behind Cloudflare and could not be read anonymously, and absence of a prohibition is not the same as
permission. But the concern is materially smaller than when I first flagged it, and the decision is now
mostly about relationship rather than compliance.

Then, one time:

```bash
node --env-file=.env scripts/scrape-state-tenders.mjs --state=SA --login
```

That opens a **real browser window** at the SA login page. Sign in there yourself. The script never sees,
stores or transmits the password — it only saves the resulting session cookies to
`data/state-tenders/sa-auth.json`, which is gitignored. Before it reports success it navigates to a real
contract list and confirms the session actually renders contracts, so an account that signs in but lacks
contract-view permission is caught immediately rather than after a crawl returns nothing.

After that, ordinary runs pick the session up automatically:

```bash
# wedge agencies: housing, human services, child protection, AG, corrections (~15 min)
node --env-file=.env scripts/scrape-state-tenders.mjs --state=SA --apply \
  --buyer-id=267553,84271,94146,56683,223646,56713

# whole of SA (~75 min)
node --env-file=.env scripts/scrape-state-tenders.mjs --state=SA --apply
```

If the session is missing or expires, the crawl **aborts loudly** rather than continuing. That is
deliberate: without it, every agency would record zero contracts, which reads as "this buyer uses no
social enterprises" when it actually means "we could not look". Silent zeros are worse than a failed run,
because they look like findings.

## Everything else

The largest agencies in VIC are Transport and Planning (5,224), Education (3,906) and Energy/Environment
(3,366). They are big but off-wedge — crawl them only if a specific buyer conversation calls for it.

## Before any of this is quoted at a buyer

- **`$1.00` means withheld, not one dollar.** VIC publishes that sentinel when a value is Genuinely
  Confidential Business Information. The scraper nulls it and counts it; any pack must say "value withheld"
  rather than treating it as zero.
- **Reversible.** `DELETE FROM austender_contracts WHERE ocid LIKE 'vic-%'`, then refresh the evidence MVs
  and re-run `scout-se-buyers.mjs`.
- **Resume is by ocid**, so a stopped crawl restarts without re-fetching, and a narrow tranche now does not
  waste work if the crawl is widened later.
- **SA is not available.** Every SA contract list and detail page redirects to `/login`. It needs an SA
  Tenders account.
