# The CivicGraph + JusticeHub Data Map

Produced 2026-08-14 by a 15-agent workflow: full census, per-object classification, code-usage
tracing across both repos, measured join coverage, design research, synthesis, and an adversarial
verification pass (41 claims checked, 34 confirmed, 7 corrected).

## Start here

| Read this | When |
|---|---|
| **`VERIFICATION.md`** | **First, always.** What survived scrutiny and what did not. |
| `CANONICAL-DATA-MAP.md` | The map: 812 objects → 14 domains, 6 tiers, join paths, drill-down levels, gap register |
| `COMPLETENESS.md` | What the map still misses (212 views, 409 functions, RLS, embeddings, storage) |
| `OPPORTUNITY-MAP.md` | 16 cross-sections, 9 of them actually run, with real numbers |
| `BUILD-SPEC.md` | The `/clarity` build: 4 screens, DDL, refresh job, slice sequence |
| `raw/` | Every agent's full output plus the census CSVs the whole thing was built on |

## The one-paragraph version

GrantScope/CivicGraph and JusticeHub are **two apps on one Supabase project**
(`tednluwflfhxyucgwigh`), plus a seam to Empathy Ledger (`yvnuayzslukamizrlhwb`). The public schema
holds **1,024 relations** — 714 tables, 98 matviews, 212 views — of which 724 are populated,
totalling **52.3M rows**. About 29% of the objects are A Curious Tractor's private business systems
rather than civic data. The civic corpus that matters collapses to roughly 60 objects hanging off
one hub, `gs_entities`. The declared foreign keys are a decoy: the top FK target is `users` with
91 constraints pointing at 17 rows, while the nine largest objects have no FKs at all. The real
spine is reached by four implicit mechanisms — uuid stamps, ABN equality, normalised-name
equality, and place codes — all of which have now been measured rather than assumed.

## Numbers you can rely on (exact `count(*)`, 2026-08-14)

| | |
|---|---|
| public-schema relations | 1,024 (714 tables · 98 matviews · 212 views) |
| populated | 724 |
| empty | 88 |
| total rows | 52,349,579 |
| columns | 14,310 |
| declared foreign keys | 636 |
| database functions | 409 |
| pg_cron jobs | 5 (only one refreshes matviews, and it covers 27 of 98) |
| database size | 28 GB |

## Graph integrity — added 2026-08-14, after the map

`GRAPH-DEFECT-justice-program-nodes.md` is the full investigation. Headlines:

| layer | state |
|---|---|
| `justice_funding` | **144,971 of 857,798 edges resolve (16.9%)** — 712,827 orphans. Source was re-ingested with new uuids; edge layer never rebuilt. Rebuild target 144,901, confirmed independently by two tools. |
| `grantconnect_awards` | **291,264 rows, ZERO edges.** Never built. The largest awarded-grants source is absent from the graph. |
| `grant_opportunities` | Self-loops are BY DESIGN (foundation offers grant). 961 of 6,497 orphaned. Opportunities are being modelled as relationships. |
| `aec_donations`, `austender`, `foundations` | Healthy. |
| 19 other layers (~780K edges, 23%) | **Unmonitored.** Not covered by any gate. |

Two gates now exist and both are registered to run:
- `check-graph-completeness.mjs` — counts vs a rebuilt derivation. New `STALE_SEVERE` tier
  (ratio + a 1,000-edge floor) fails instead of exiting 0. `--dataset=` filter.
- `check-graph-referential-integrity.mjs` — **new.** Do edges point at rows that still exist?
  Counts exactly by default; nine datasets reported UNCHECKABLE with reasons rather than skipped.

**Method lesson, learned four times in one day:** three separate readings of this data were
confidently wrong — "AusTender categories", "10.4× duplicated", "philanthropy layer empty" — and
each was killed within two minutes of opening the code that produces the number. Read the producer
before diagnosing the product. Also: `LIMIT n` without `ORDER BY` is not a sample. Two 20,000-row
"samples" of the same dataset gave 0% and 34.2%; the exact answer was 16.9%.

## The five things that most need a decision

1. **`xero_payments` (1,536 rows) is readable with the public anon key** — RLS on, anon granted,
   policy literally named "Public read" with `USING true`. Same for `founder_intake_messages` (23).
   227 SELECT policies across the database grant anon with `USING true`. *Verified by query.*
2. **Three headline money figures are wrong** and two are the kind you would publish:
   justice funding overstates by up to 45x without `measure_kind='grant'`; donations overstate ~8x
   without `receipt_type='donation received'`; and 13 AusTender rows carry $372.5bn = 29.4% of all
   recorded Commonwealth contract value, the largest a $123.0bn "contract" to a recruitment agency.
3. **71 of 98 matviews are on no refresh schedule**, including the entire `mv_person_*` /
   `mv_charity_network` director-links layer — last refreshed by hand on 2026-08-09.
4. **`/clarity` already existed** (built 2026-03-25, deleted 2026-04-24 in a scope cut). Its API is
   still deployed with zero consumers. Rebuilding means reversing a past decision — deliberately.
5. **~67,000 GrantConnect awards** point at real entities that were never created in `gs_entities`.
   Recipient ABNs are 99.97% present in `abr_registry`. One bulk insert closes it.

## Rules this exercise established

- **No drop verdict without a grep over both `src` trees AND `pg_proc.prosrc`.** Empty ≠ unused;
  write-first tables look identical to dead ones from the row count alone.
- **`pg_stat_user_tables.n_live_tup` is broken on this instance** (reports 0 for a 2.5M-row table).
  Use exact `count(*)` under ~2M rows and `pg_class.reltuples` above, and label estimates as such.
- **Never say "has no evidence" about an organisation.** The data supports "no evidence record
  linked", which is a fact about this database, not about the organisation.
- **Do not remove `MAX_PLAUSIBLE_BOARDS`.** Measured: average procurement dollars per person rises
  17x from the 2–3 board band to the 11–20 band. Removing the cap promotes name collisions to the
  top of every money-sorted ranking.
