# What a place captures

*19 August 2026. GrantConnect delivery location versus recipient location.*

## The question

When a grant is delivered into a place, does an organisation in that place receive it?

`grantconnect_awards` has been able to answer this since it was ingested. It carries
`delivery_postcode` and `delivery_state` as columns separate from `recipient_postcode`
and `recipient_state`. 291,264 awards, $230bn. Nothing read them.

## The answer

On the 85,898 awards where both locations resolve to a trustworthy LGA, worth **$33.75bn**:

- **85.1% of awards** are received by an organisation in the LGA they were delivered into.
- **59.6% of the dollars** are.

Those two numbers disagree because the large awards behave differently from the small ones.
Most grants stay local. Most grant money does not.

## The gradient, and the one that isn't there

By award count, local capture falls the further out you go, monotonically:

| delivered into | awards | delivered | captured locally (awards) | captured locally (dollars) |
|---|---|---|---|---|
| Major Cities | 58,139 | $24,337M | **86.8%** | 55.2% |
| Inner Regional | 14,644 | $3,785M | 83.7% | 67.0% |
| Outer Regional | 7,888 | $2,157M | 77.4% | 54.5% |
| Remote | 1,457 | $605M | 70.4% | 63.7% |
| Very Remote | 1,317 | $491M | **66.0%** | 68.1% |

86.8 per cent down to 66.0 per cent. In Very Remote Australia, one grant in three delivered
into a community is received by an organisation somewhere else.

**By dollars there is no gradient.** 55.2 per cent in Major Cities, 68.1 per cent in Very
Remote. If anything remote places capture a slightly larger share of the money delivered to
them, because a handful of large awards go to councils and land councils that genuinely sit
there.

I expected the dollar gradient and it is not in the data. Reporting it would have been the
easy story. The count gradient is the real one, and it is a different claim: what remote
communities lose is not disproportionately the money, it is the **number of separate
opportunities**. A third of the grants that touch them are administered from elsewhere. That
is a third of the relationships, the staff, the reporting lines and the accumulated
capability that sit outside the community.

## Where it is worst

Regional and remote LGAs receiving more than $15M across at least 30 awards, ranked by the
share of dollars captured locally:

| LGA | state | remoteness | awards | delivered | captured |
|---|---|---|---|---|---|
| Unincorporated SA | SA | Very Remote | 58 | $34.0M | 3.4% |
| Wangaratta | VIC | Inner Regional | 88 | $258.0M | 8.3% |
| Albury | NSW | Outer Regional | 89 | $16.6M | 9.9% |
| Macedon Ranges | VIC | Inner Regional | 124 | $18.9M | 11.5% |
| Glenelg | VIC | Outer Regional | 56 | $99.3M | 14.6% |
| Bega Valley | NSW | Outer Regional | 118 | $25.0M | 15.5% |
| Burke | QLD | Very Remote | 34 | $37.2M | 16.3% |
| George Town | TAS | Outer Regional | 39 | $113.6M | 22.7% |
| Boyup Brook | WA | Inner Regional | 35 | $16.1M | 24.1% |
| Burdekin | QLD | Outer Regional | 102 | $23.7M | 26.7% |

Wangaratta is the one to look at first. $258M delivered, 8.3 per cent captured. That is the
largest single gap in the table by a wide margin.

Read these as leads, not verdicts. A neighbouring-town recipient counts as off-site here, and
in a small LGA that is often the honest local answer.

## What I got wrong on the way, twice

Both corrections were large enough to change the story, so they are worth stating.

**`delivery_postcode` contains the literal string `'Multiple'`.** 5,978 rows, $19.55bn.
Multi-site grants. Because `'Multiple'` never equals a recipient postcode, every one counted
as delivered off-site. In the scoping pass I reported $42.46bn delivered away from the
recipient and $17.79bn crossing state lines. Excluding `'Multiple'` and aggregate-named rows,
the real figures are **$22.91bn and $3.95bn**. The cross-state number was wrong by 4.5x.

**`postcode_geo` contains rows whose "locality" is an SA3 name, carrying wrong LGAs.**
Postcode 4816 is recorded as locality `Townsville - South` with `lga_name = 'Croydon'`, an
LGA about 900km away in far north-west Queensland. Left in, Croydon QLD came out as one of
the worst-capturing LGAs in the country, on $72.9M that is actually Palm Island money. 443
such rows carry an LGA. They are now excluded, and `postcode_geo` should be repaired.

The first version of the per-place table also picked one LGA arbitrarily for postcodes that
straddle several. That is the mistake the LGA attribution rebuild already learned: unplaced
beats confidently wrong. 521 of 2,859 postcodes touch more than one LGA and are now excluded.

## Coverage, stated plainly

$33.75bn of $230bn. **This is a well-measured minority of the grant record, not the whole
of it.** The exclusions are the price of the LGA figures being trustworthy. Any screen built
on this must carry the number.

Where the coverage goes:

| | awards | value |
|---|---|---|
| all GrantConnect awards | 291,264 | $230bn |
| `delivery_postcode` populated | 152,546 | |
| after dropping `'Multiple'`, aggregates, non-positive | 144,853 | $51.29bn |
| after single-LGA postcodes only | 113,434 | $43.95bn |
| after dropping SA3-shaped `postcode_geo` rows | **85,898** | **$33.75bn** |

`delivery_state` is populated on **100%** of all 291,264 awards. Every state-level cut is
available across the full record. Only the LGA cut is this constrained.

## The view

`migrations/2026-08-19-grant-place-capture.sql` creates `v_grant_place_capture` with all
four exclusions in one place, so they cannot drift into a query someone rewrites from memory.
Written, not applied. Applying is a Tier 3 write.

## Next

- **Repair the 443 SA3-shaped `postcode_geo` rows.** They are wrong for every consumer of
  that table, not just this one. Separate issue.
- **Do the state-level version.** 100% coverage, no exclusions needed, and it answers the
  same question for the whole $230bn.
- **Wangaratta.** $258M and 8.3 per cent is either a real finding or an artefact, and one
  hour of looking at the recipient list settles it.

---

# Additions and corrections, same day

Four things changed after the above was written. Two are new findings, two are corrections
to what I wrote.

## The state-level cut: money stays in the state and leaves the town

Across **281,003 awards worth $200.21bn**, excluding multi-state and pseudo-state values:

- **97.5% of awards** are received in the state they were delivered into
- **96.8% of the dollars** are

Per state, every real jurisdiction sits between 93% and 98%.

Set that beside the LGA figures from earlier: 85.1% of awards and **59.6% of dollars**.

**State borders are almost never crossed. The leak is entirely internal.** Money delivered
into a place reliably stays in that state and then leaves the town, travelling to a capital
city or a regional centre inside the same jurisdiction. Any policy response pitched at
interstate extraction is aimed at something that is not happening. The gap between 96.8% and
59.6% is the whole problem, and it is a within-state problem.

## Correction: `delivery_state` is not a single state

I wrote in the scoping document and in spec #300 that `delivery_state` is populated on 100%
of awards and therefore supports a state cut with no exclusions. **That was wrong.**

The column holds **318 distinct values**, including comma-separated lists like
`ACT, VIC, SA, WA, QLD, TAS`, plus the pseudo-places `National` and `Overseas`.

- multi-state values: 4,726 rows, $9.73bn
- `National`: 1,644 awards, $18.93bn, 30.2% "captured locally", which is meaningless
- `Overseas`: 1,002 awards, $1.00bn

Left in, they never equal a single recipient state and so count as delivered off-site, the
same failure mode as `'Multiple'` in `delivery_postcode`. The uncorrected national figure was
95.3% of awards and 87.1% of dollars. Corrected: **97.5% and 96.8%.**

Coverage remains excellent, at $200.21bn of $230bn, but it is not uncaveated. Spec #300 needs
this fixed.

## Correction: the SA3-shaped `postcode_geo` rows are mostly fine

I wrote that 443 rows carry wrong LGAs and should be repaired. **The extent was overstated
and the repair is not available.**

Most SA3-shaped rows are correct. Postcode 0812 `Malak - Marrara` maps to Darwin, which is
right. 2000 `Sydney (North) - Millers Point` maps to Sydney, which is right. Postcode 4816
`Townsville - South` maps to Croydon, which is wrong by about 900km, and that one is proven.

How many others are wrong is **unknown, and cannot be determined from inside the database.**
Only 4 of the 443 rows have a same-postcode sibling to cross-check against, and all 4 agree.
The remaining 439 have no internal evidence either way. The Croydon case was caught by
eyeballing an output, which is not a method that scales.

So the blanket exclusion in `v_grant_place_capture` stands, but its justification changes. It
is not removing 443 known-bad rows. It is refusing an unknown number of unknown-bad rows at a
cost of about $10bn of coverage, on the evidence of one proven case. That is a defensible
trade and it should be stated as such rather than as a repair.

Fixing this properly needs the ABS SA3-to-LGA correspondence file, an external source.
Separate project, not a migration.

## Wangaratta was an artefact

$258M delivered at 8.3% captured, the largest gap in the ranked table. The cause is a single
recipient:

**Australian Rail Track Corporation, registered in South Australia, $940M across 4 awards.**
Inland Rail.

That is a Commonwealth-owned corporation delivering national rail infrastructure. It is not a
community organisation losing work to a city competitor, which is what the ranked table
invites you to read.

The lesson generalises. **Large national infrastructure delivered by government-owned
corporations will dominate any per-place capture ranking and means something different from
the rest of the measure.** Any surface built on this needs to segment it or the ranked list
will mostly be a list of places that had a road, a railway or a transmission line built.

A second, smaller thing surfaced in the same query: `Indigo Shire Council` appears twice under
different casing, with separate dollar totals. Recipient names are not normalised.

---

## Update 2026-08-20 — exclusion 4 narrowed, coverage up 28%

The figures above were measured while `v_grant_place_capture` refused **every** SA3-shaped
`postcode_geo` row, because one of them (4816 → `Croydon`) was wrong by ~900km and nothing
distinguished the wrong rows from the right ones.

`#301` has since been repaired against `abs_poa_lga_ratio`, which was already in the warehouse.
Verified 2026-08-20: 387 SA3-shaped postcodes now agree with the ABS majority, none remain
fixable, and 4816 carries no LGA at all rather than Croydon. The wholesale refusal was therefore
defusing a defect that no longer exists.

The view now refuses only the 11 SA3-shaped postcodes that still carry an unchecked stamp with no
ABS ratio row behind them.

| | awards | dollars |
|---|---:|---:|
| before | 85,898 | $33.75bn |
| after | **110,267** | **$42.37bn** |
| gain | +24,369 (+28%) | +$8.62bn (+26%) |

Post-repair national figures, on the resolved base: **90.4% of awards and 84.3% of dollars** stay
in the delivery council. On the whole base (counting the 5,216 unresolved awards / $13.78bn as
not-local): 86.1% and 56.9%.

The remoteness gradient survives the widening and still says the same thing — the award share
falls monotonically, the dollar share does not fall at all:

| remoteness | awards local | dollars local |
|---|---:|---:|
| Major Cities | 91.4% | 86.1% |
| Inner Regional | 88.6% | 82.1% |
| Outer Regional | 86.1% | 67.3% |
| Remote | 81.1% | 65.7% |
| Very Remote | 80.5% | 75.2% |
