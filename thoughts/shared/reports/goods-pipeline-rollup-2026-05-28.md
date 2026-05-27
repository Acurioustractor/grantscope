# Goods on Country — 3-pipeline unit-ledger cockpit

**Generated:** 2026-05-28 · `scripts/goods-pipeline-rollup.mjs` (read-only)
**Model:** one need, two funding routes, one delivery. See `act-infra thoughts/shared/plans/2026-05-28-goods-three-pipeline-operating-model.md`.

## Cockpit (beds · washing machines · $)
| Line | Beds | Washers | $ |
|---|---|---|---|
| **NEED** — curated (active+lead, 64 communities) | **12504** | **1563** | — |
| _addressable (all 1542)_ | _72134_ | _8430_ | — |
| **ORDERED** — Buyer Pipeline (9 open) | 10 | 0 | $1,835,571 |
| **FUNDED** — Supporter Journey (36 open) | 0 | 0 | $1,378,111 |
| **DELIVERED** — assets (cited) | 520 | 41 | — |
| **GAP** (need − delivered) | **11,984** | **1,522** | — |

> Units come from the new GHL opportunity fields `Goods: Beds` / `Goods: Washing machines` + native opportunity value. As the team scopes deals (fills those fields), ORDERED/FUNDED fill in and GAP closes. DELIVERED is a cited constant — Goods v2 assets sync, 2026-05-27.

## Procurement — Buyer Pipeline by stage
| Stage | Opps | Beds ordered | Washers | $ |
|---|---|---|---|---|
| In Conversation | 5 | 10 |  | $64,800 |
| Outreach Queued | 4 |  |  | $1,770,771 |

## Support — Supporter Journey by stage
| Stage | Opps | Beds funded | Washers | $ committed |
|---|---|---|---|---|
| Identified | 13 |  |  |  |
| Stewarding / Reporting | 8 |  |  | $806,112 |
| Cultivating | 5 |  |  | $5,434 |
| Ask made | 4 |  |  | $200,000 |
| Qualified | 2 |  |  | $200,000 |
| Renewing | 2 |  |  | $40,065 |
| Lapsed | 1 |  |  | $82,500 |
| Delivering | 1 |  |  | $44,000 |

## Need — Demand Register by stage (relationship tracking; quantities live in goods_communities)
| Stage | Opps | Beds | Washers | $ |
|---|---|---|---|---|
| Signal | 85 |  |  | $9,380,500 |
| Buyer Matched | 25 |  |  |  |

## Provenance
- NEED: `goods_communities` priority ∈ {active, lead} (curated) and all rows (addressable), shared ACT DB `tednluwflfhxyucgwigh`.
- ORDERED/FUNDED: GHL pipelines (Buyer `FjMyJM3YzWQFmKqR9fur`, Supporter `JvBFYpVpyKsw899lkFgj`), open opps only; units from custom fields Beds `mi9ZW3KLhmpcez14cNbx` / Washers `UtxtfnyEd6p1epMEJ0b2` + monetaryValue.
- DELIVERED: Goods v2 assets sync, 2026-05-27 (Goods v2 `assets`, project cwsyhpiuepvdjtxaozwf) — cited constant, not live here.
