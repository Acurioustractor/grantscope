# The worst-capturing places are mostly places with one big grant

Measured 2026-08-20 against production, after the #301 repair widened
`v_grant_place_capture` to 110,267 awards / $42.37bn.

## The lead

Widening coverage put **Gladstone** at the bottom of the dollar-capture table: of $200.0m of grant
money delivered into the council, **$0.36m — 0.3% — was received by an organisation based there.**

That reads like extraction. It is more specific than that, and the specifics matter.

## What the money actually is

| recipient | received in | $m |
|---|---|---:|
| Stanwell Corporation Limited | *unresolved* | 76.12 |
| Alpha HPA Limited | Sydney NSW | 49.50 |
| **Gladstone** Fortescue Future Industries Pty Ltd | Perth WA | 49.44 |
| Alpha HPA Limited | Sydney NSW | 17.05 |
| Vena Energy Services (Australia) Pty Ltd | Brisbane QLD | 3.30 |
| Northern Oil Refineries Pty Ltd | *unresolved* | 2.04 |
| Gladstone Regional Council | *unresolved* | 1.72 |

Hydrogen and critical-minerals decarbonisation grants. The projects are in Gladstone; the
companies are registered at head offices in Sydney and Perth. One recipient is literally named
**Gladstone** Fortescue Future Industries and is received in Perth — a Gladstone-named subsidiary
registered at the parent's address, which is the mechanism in a single row.

Meanwhile **70.4% of Gladstone's awards stay local.** The many small grants are local; the few
enormous ones are not.

## The pattern generalises, and it breaks the ranked list

Every one of the twelve worst dollar-capturing councils shows the same shape — high award capture,
and one award carrying most of the money:

| council | resolved awards | $m | awards local | dollars local | biggest award |
|---|---:|---:|---:|---:|---:|
| Gladstone QLD | 27 | 120 | 70.4% | **0.3%** | 38.1% |
| Armidale NSW | 25 | 100 | **96.0%** | 4.4% | **95.6%** |
| Unincorporated SA | 63 | 26 | 60.3% | 6.3% | 47.4% |
| Kentish TAS | 36 | 62 | 88.9% | 6.8% | 93.1% |
| Snowy Monaro NSW | 31 | 6 | 64.5% | 9.4% | 40.1% |
| Albury NSW | 114 | 19 | 79.8% | 12.5% | 50.8% |
| Ashburton WA | 21 | 5 | 47.6% | 13.3% | 56.3% |
| Tasman TAS | 28 | 9 | 82.1% | 13.5% | 38.6% |
| Glenelg VIC | 51 | 99 | 82.4% | 14.7% | 85.1% |
| Wollondilly NSW | 122 | 85 | 90.2% | 18.4% | 49.1% |
| Port Adelaide Enfield SA | 227 | 41 | 93.4% | 23.5% | 70.2% |
| Burdekin QLD | 99 | 24 | 72.7% | 26.7% | 66.7% |

Armidale is the clearest: **96.0% of awards stay local and 4.4% of dollars do, because one grant is
95.6% of the money.**

**So a "places that keep the least" table ranked on dollars is substantially a table of "places
with one big externally-received grant".** That is a real finding about how large industrial and
research grants are administered. It is not the finding a reader assumes they are looking at.

## What this cost, and what changed

The thresholds shipped this morning — `CAPTURE_MIN_AWARDS = 20`, `CAPTURE_MIN_DOLLARS = 5m` —
guard against small-N noise. **They do not catch dollar concentration**, and concentration is the
failure mode this data actually has: every council in the table above clears both thresholds
comfortably.

Filtering concentrated places out would hide something true, so per disclose-don't-hide every
`CapturePlace` now carries `biggestAwardShare`, and `rankWorstCapturing()` documents that a caller
ranking on dollars without rendering it is publishing a misleading table.

## The caution on Gladstone specifically

Stanwell Corporation, the single largest award at $76.12m, is **unresolved** — its recipient
postcode does not map to one trustworthy council, so it sits in neither the local nor the
elsewhere bucket. Stanwell is a Queensland government-owned generator, so a resolved Stanwell would
very likely land in Brisbane rather than Gladstone and would deepen the gap rather than close it.
But that is an inference, not a measurement, and the figure above does not depend on it.

## What this does not say

It does not say Gladstone is being short-changed. Grant money delivered to a place through a
company headquartered elsewhere still builds the thing in the place. What the measure shows is
**where the money is administered from**, which is a question about local capability and
contracting capacity, not about whether the project happens.
