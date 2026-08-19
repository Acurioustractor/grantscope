# Delivery location: scoping verdict

*19 August 2026. Scoping pass on extracting delivery location from AusTender contract text.*

## Verdict

**Kill the text-extraction spike.** It cannot work, and it is aimed at a field the federal
source does not publish.

**Do two other things instead.** One of them needs no new data and can run today. The other
is a bounded backfill with 100% coverage in sample.

The goal behind the spike, showing what a place actually captures versus what merely passes
through it, survives. The method was wrong.

## Why text extraction fails

Measured over all 825,222 rows of `austender_contracts`:

| signal | rate |
|---|---|
| average title length | **17 characters** |
| average description length | 35 characters |
| descriptions longer than 40 chars | 177,685 (21.5%) |
| contains a state token (NSW/VIC/QLD/...) anywhere | 12,286 (**1.5%**) |
| ends with a ` - STATE` suffix | 364 (0.04%) |
| mentions any of Australia's 30 largest places | 30,640 (**3.7%**) |

Many titles are bare reference numbers: `4610000551`, `2349`, `HS51689121`. Adding a full
gazetteer might reach 6 to 8 per cent, and a large share of those would be false friends,
where "Sydney Trains" is a buyer and "Perth Mint" is a supplier, neither being a delivery
location.

An extraction pipeline built on this would be expensive, would need per-match adjudication
of the kind the ORIC rung-3 work required, and would return a place for well under a tenth
of contracts.

## Why it fails at the source, not just in our copy

The obvious next thought is that the field exists upstream and our ingest dropped it. It
does not.

AusTender publishes OCDS 1.1, and OCDS defines `Item.deliveryAddress` and
`Item.deliveryLocation`. Pulled 100 live contract releases from
`api.tenders.gov.au/ocds/findByDates/contractPublished/...`:

- `deliveryAddress`: **0 occurrences**
- `deliveryLocation`: **0 occurrences**
- the string `delivery`, case-insensitive, anywhere in the payload: **0 occurrences**

Australian Government contract notices do not record where the work happens. This is a
property of the disclosure regime. No amount of parsing recovers it.

## What the same probe did find

Every supplier party carries a full address, and we do not store it.

| party role | n | postcode | locality | region |
|---|---|---|---|---|
| supplier | 100 | **100** | **100** | **100** |
| procuringEntity | 100 | 0 | 0 | 0 |

Today we get supplier geography by joining `supplier_abn` to `gs_entities`, which leaves
94,575 contracts and $126bn unmatched. The OCDS payload carries locality, region and
postcode directly, at what looks like complete coverage.

**This does not solve delivery location.** A supplier's registered address is still a
registered address, with the intermediary bias already documented for remote NT funding.
It removes a join and a coverage gap. It does not change what the number means, and any
surface using it must keep saying so.

## The thing that was already in the database

`grantconnect_awards`, 291,264 rows, $230bn, carries **`delivery_postcode` and
`delivery_state` as columns separate from `recipient_postcode` and `recipient_state`.**

Nothing reads them.

| | |
|---|---|
| rows | 291,264 |
| `delivery_state` populated | 291,264 (**100%**) |
| `delivery_postcode` populated | 152,546 (52.4%) |
| both delivery and recipient postcode present | 152,527 |
| **delivery postcode differs from recipient postcode** | **31,972 (21%)** |

By dollars, across the 152,527 rows where both are known:

- delivered where the recipient sits: **$28.43bn**
- delivered somewhere else: **$42.46bn**
- **crossing a state border: $17.79bn**

Sixty per cent of the money whose two locations we know is spent somewhere other than
where the organisation receiving it is based.

And it worsens with remoteness. Share of awards delivered away from the recipient's
postcode, by the remoteness of the delivery location:

| delivered into | awards | value | delivered off-site |
|---|---|---|---|
| Major Cities | 96,535 | $34.88bn | 14.9% |
| Inner Regional | 24,481 | $5.99bn | 20.1% |
| Outer Regional | 16,656 | $4.50bn | 26.7% |
| Remote | 2,974 | $1.13bn | 32.4% |
| Very Remote | 2,919 | $1.30bn | **36.3%** |
| (postcode unmapped) | 8,962 | $23.09bn | 69% |

This is the leak, measured. The further out the work happens, the more likely the
organisation paid for it sits somewhere else. That is the Preston metric, in Australian
data, available now.

Two cautions. `postcode_geo` is locality-grain, so any join to it must deduplicate to one
row per postcode or the dollars fan out; the table above is deduplicated, an earlier run
was not and inflated every figure. And the unmapped bucket holds $23.09bn at a 69%
off-site rate, which is too odd to publish before someone works out what those postcodes
are, most likely national programs or placeholder codes.

## Recommendation

**A. GrantConnect delivery-versus-recipient analysis. Do this first.** No ingest, no
extraction, no inference. The columns are populated and the gradient above is already
real. Roughly a day to get to a defensible per-place figure, plus the unmapped-postcode
audit. This answers "what does my community capture" for the grant lane.

**B. AusTender supplier address backfill from the OCDS API. Do this second.** Roughly
8,250 paginated calls at 100 releases each, so a few hours as a background job. Adds
supplier locality, region and postcode as first-class columns, retires the ABN join, and
closes the $126bn unmatched gap. Improves precision on the 0.43 per cent figure without
changing what it measures.

**C. Delivery location for contracts. Park it, and say why.** The federal record does not
contain it. If the question matters enough, the honest routes are the state portals,
where `state_tenders` already carries a `state` column across 200K rows, or a
freedom-of-information style ask about Defence site data, which is 286,286 contracts and
$363.5bn on its own. Both are separate projects. Neither is a parsing problem.

## The finding worth carrying out of this

We went looking for a way to infer place from prose and found that place was already
recorded, in a different table, in two columns nobody had read, for 291,264 awards worth
$230bn. Before the next extraction pipeline, census the columns.
