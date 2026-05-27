---
title: Goods — ingest the source-vector programs (corrected for dedup)
status: proposed — needs Ben review of data values before any insert
date: 2026-05-27
repo: grantscope
related:
  - act-infra thoughts/shared/handoffs/goods-grants-sweep-2026-05-27.md (§3, §4)
  - grantscope thoughts/shared/plans/2026-05-27-goods-scoring-noise-fix.md (DONE — discovery_method hook)
---

# Goods — ingest the source-vector programs

## Correction to the sweep §3 ("~17 net-new programs")

Verified against live DB `tednluwflfhxyucgwigh` 2026-05-27 — **~6 of the 17 already exist** (the sweep's "net-new unless noted" was optimistic). So this is **insert ~10 net-new + enrich/dedup ~6 existing**, not "insert 17."

### Already in DB (ENRICH / DEDUP / re-score — do NOT re-insert)
| Program | Current row(s) | Action |
|---|---|---|
| ILSC Our Country Our Future | `ilsc` (40) + `ghl_sync` dup (6) | retire ghl_sync dup; enrich + re-score |
| Westpac Inclusive Employment Grant | `foundation_program` (13) | enrich (amount $50K/2yr, opens 2026); re-score |
| Westpac Social Change Fellowship | `foundation_program` (0 ×2) | dedup; **scores 0 — fellowship disqualifier (policy Q below)** |
| FRRR Strengthening Rural Communities | `foundation_program` (22 + 30) | dedup the two; enrich (Round 30 opens 25 Jun, closes 17 Sep) |
| Telstra Connected Communities | `web-search` (6) + "Connected Communities Grant" (4) | dedup; mark CLOSED this cycle (low priority) |

### Genuinely net-new (INSERT, review-first)
discovery_method drives the scorer's new +25 capital/procurement boost (shipped in the scoring-noise fix).

| Program | Provider | discovery_method | amount_max | status | proposed score* |
|---|---|---|---|---|---|
| IBA Start-Up Finance Package | Indigenous Business Australia | indigenous-finance | 150000 | open | ~82 |
| Supply Nation (certification + buyer access) | Supply Nation | procurement | (null — demand) | open | ~82 |
| Aboriginals Benefit Account (ABA) | NIAA / Aboriginal Investment NT | grant | (null — project) | open | ~75 |
| NAIF Small Loans Program | Northern Australia Infrastructure Facility | indigenous-finance | (null — loan) | open | ~62 |
| Many Rivers Microfinance | Many Rivers | indigenous-finance | (null — micro) | open | ~60 |
| Barayamal Accelerator | Barayamal | grant | 10000 | open (EOI) | ~55 |
| ILSC Future Industries Grant Program | ILSC | grant | (null — advice) | check | ~55 |
| FRRR / ANZ Seeds of Renewal | FRRR + ANZ | grant | (null) | upcoming | ~45 |
| Lowitja Institute Seeding / GLOWS | Lowitja Institute | grant | (null — seeding) | closes 2026-06-10 | ~40 |
| Macquarie Group Foundation | Macquarie Group Foundation | grant | (null) | relationship | ~40 |

\* *Proposed scores are curated (marked `source='manual-research-2026-05-27'` so the manual-guard protects them). Most sweep amounts/dates are "Inferred" — **every value needs a click-through before insert.***

## Scoring-policy decision needed (Ben)
**Westpac Social Change Fellowship scores 0** because `fellowship` is in `DISQUALIFIERS`. The sweep rated it "Medium — founder capability." Options:
1. **Keep disqualified** (recommended) — it funds a *person's* development, not the enterprise; Goods' need is org capital/capability/procurement. Leave at 0.
2. Carve an exception so founder-development fellowships aren't zeroed. Touches the scorer again.

## Apply mechanism (review-first, after data verification)
Idempotent seeder `scripts/seed-goods-source-vector-programs-2026-05-27.mjs` (mirrors the goods seeders): `--dry-run` prints the rows; `--apply` upserts on `(source, name)`. Sets `discovery_method`, `accepts_pty_ltd/charity`, curated score, `goods_relevance_scored_at=now()` so the next rescore's manual-guard preserves them. Enrich/dedup the 6 existing rows in the same script (UPDATE by id).

## Verification (post-apply)
- New + enriched rows present at expected scores; capital/procurement rows surfaced via discovery_method boost.
- No `(source,name)` or `url` unique-constraint violations.
- ACT-GD-tagged count moves from 110 by ~the number of new ≥50 rows.

## Out of scope (item #3, separate)
Dedicated capital/procurement *crawlers* + a pipeline view. This task only lands the rows; it does not build new source crawlers.
