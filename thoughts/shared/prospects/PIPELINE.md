# Lighthouse Buyer Pipeline

Stages: identified → pack built → contacted → meeting → live tender → paying

| Buyer | Stage | Date | Next action |
|---|---|---|---|
| **NSW Dept of Communities and Justice** | **pack built** | 2026-08-08 | **Ben:** pick recipient and pick the lead angle (Aboriginal Procurement Policy 3% target, or the sub-$150K reporting gap). Then build a tender-pack against a named live DCJ procurement. Pack at `nsw-dcj/`. First **state** buyer in the pipeline. 91 SE / 29 cert / 61 Indigenous / 383 contracts / $3,692.2M. |
| **NIAA** | **pack built + demo ready** | 2026-06-09 | **Ben (Tier 3, day-shift):** find named IPP/procurement contact; render one-pager + tender-pack-demo to PDF; send. Demo category chosen + supplier shortlist grounded (`niaa/tender-pack-demo.md`). **Figures in that pack are from 2026-06-09 and are now stale — refresh before sending.** Current as at 2026-08-08: **134 SE / 109 cert / 367 contracts / $78.5M** (pack says 132 / 108 / 364 / $72.9M). |
| Department of Defence | identified | 2026-06-08 | Hold — biggest story but hardest first sale. Build pack only if the two live ones stall. Current: 273 SE / 218 cert / 3,661 contracts / $2,462.7M. |
| Services Australia | identified | 2026-06-08 | Hold — highest non-Defence SE count. Current: 177 SE / 82 cert / $257.5M. |
| DSS / PM&C | identified | 2026-06-09 | Hold. DSS current: 142 SE / 109 cert / $3,983M — note this was **$10,862M before the 2026-08-08 dedupe fix**, a 2.7× overstatement. PM&C: 149 SE / 107 cert / $155.6M. |
| QLD justice + child safety | blocked | 2026-08-08 | Real story in `state_tenders` (DCYJMA 61 SE / $808.1M, Child Safety 51 / $459.7M) but **almost no date coverage** — only `qld_doe_disclosure` has award dates and its latest is 2021-06-30. Fixing dates is the unlock. |
| VIC / SA buyers | blocked | 2026-08-08 | Strategy-preferred (SPF / SAIPP mandated weightings) but no data: 29 VIC rows with 0 ABNs, nothing for SA. Needs a state-tender ingest — raise via `/wedge` before building. |

**Goal:** ONE live procurement using a tender-pack. Two packs are now built. Do not build a third until one
of them is contacted.

**Prospect pool:** `se_buyer_prospects` — 417 buyers, **rebuilt 2026-08-08**.

Two corrections to what this file previously said:

1. **The pool is not federal-only.** `austender_contracts` carries NSW eTender disclosures alongside
   Commonwealth AusTender rows (confirmed via `source_url` = `tenders.nsw.gov.au`). State buyers were
   always in the pool: NSW DCJ, Transport for NSW, HealthShare NSW, Homes NSW, Queensland Rail, Parks
   Victoria, Queensland Corrective Services. The `states` column lists where the **suppliers** are, not
   the buyer, which is what made this easy to miss.
2. **Every figure computed before 2026-08-08 was inflated.** `scout-se-buyers.mjs` deduped its ABN lookup
   on the whole tuple instead of the ABN, and 527 duplicate registry rows fanned the contract join out.
   Re-derive anything quoted from an older run.

*Maintained by /lighthouse — update every run.*
