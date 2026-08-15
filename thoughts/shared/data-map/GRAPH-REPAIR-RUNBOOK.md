# Graph repair runbook

Every defect found on 2026-08-14, sequenced, with the exact command and the number to check the
result against. Each step is a Tier-3 data change needing Ben's word.

## Execution status

| step | status | result |
|---|---|---|
| 1. Rebuild justice layer | **DONE 2026-08-15** | 857,798 → **144,901** edges, resolution 16.9% → **100%**. Predicted 144,901 — hit exactly. |
| 2. Build GrantConnect | **DONE 2026-08-15** | 0 → **189,590** edges, **100%** resolving. Predicted 189,590 — hit exactly. |
| 3. Clear zero-ABN donor sink | not started | |
| 4. Merge split identities (bucket C) | not started | |
| 5. Reclassify opportunity self-loops | not started | |

Matviews after steps 1–2: `mv_gs_entity_stats` refreshed (the QLD program labels have dropped out
of the top; Department of Defence is now the most-connected entity, which is what a procurement
graph should look like). `mv_entity_power_index` and `mv_revolving_door` refreshed separately.

**Pooler note learned during execution:** chaining three `REFRESH MATERIALIZED VIEW CONCURRENTLY`
statements in one psql invocation loses the connection partway through on this shared pooler, and
the shell reports exit 0 because that is the echo, not psql. Refresh **one view per invocation**,
and use TCP keepalives on anything over ~5 minutes:

```
postgresql://...@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres\
  ?keepalives=1&keepalives_idle=20&keepalives_interval=10&keepalives_count=6
```

There is no direct (non-pooler) host on this project — `db.<ref>.supabase.co` does not resolve.

Order matters: steps 1–2 delete or add edges that later steps would otherwise operate on.

Before starting, take the baseline:

```bash
cd /Users/benknight/Code/grantscope
node --env-file=.env scripts/check-graph-completeness.mjs --json > /tmp/before-completeness.json
node --env-file=.env scripts/check-graph-referential-integrity.mjs --json > /tmp/before-refint.json
node --env-file=.env scripts/check-graph-attribution.mjs --json > /tmp/before-attrib.json
```

---

## 1. Rebuild the justice layer — removes 712,827 orphaned edges

`justice_funding` was re-ingested with regenerated uuids; the edge layer never followed. Only
144,971 of 857,798 edges (16.9%) resolve to a live grant.

```bash
# Delete the stale slice (857,798 rows)
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres \
  -c "DELETE FROM gs_relationships WHERE dataset='justice_funding';"

# Rebuild
node --env-file=.env scripts/build-entity-graph.mjs --phase=justice
```

| check | before | after |
|---|---|---|
| edges | 857,798 | **~144,901** |
| resolve rate | 16.9% | **~100%** |

If the rebuild lands materially away from 144,901, stop — something other than staleness is wrong.

**Unlocks:** edge-level drill-through ("click an edge, see the grant"), which `CLARITY-SPEC` §1.5
rejected on the grounds that `source_record_id` was a dead key namespace. It is stale, not dead.

---

## 2. Build the GrantConnect layer — adds 189,590 edges that never existed

291,264 awards, zero edges. Never built; no phase existed until now.

```bash
node --env-file=.env scripts/build-entity-graph.mjs --phase=grantconnect --dry-run   # confirms 189,590
node --env-file=.env scripts/build-entity-graph.mjs --phase=grantconnect
```

| check | before | after |
|---|---|---|
| edges | 0 | **~189,590** |

Target confirmed three independent ways: a hand-written query, the completeness gate's expected
count, and the builder's dry-run. The derivation's `gc_agency_map` prelude collapses each agency to
one node — 15 of 38 agency names match more than one entity, so without it those awards would
multiply up to 4×.

---

## 3. Clear the zero-ABN donor sink — 47,563 misattributed donation edges

771 of 10,264 rows in `donor_entity_matches` have `matched_abn = '0'`, collapsing 771 distinct
donors onto one company. The derivation guard is already committed; the data still needs clearing.

```bash
# Upstream: stop the bad matches being stored
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h ... -d postgres -c \
  "UPDATE donor_entity_matches SET matched_abn = NULL
    WHERE regexp_replace(coalesce(matched_abn,''),'\s','','g') ~ '^0+$';"   -- 771 rows

# Then rebuild the donations slice
psql ... -c "DELETE FROM gs_relationships WHERE dataset='aec_donations';"
node --env-file=.env scripts/build-entity-graph.mjs --phase=donations
```

| check | before | after |
|---|---|---|
| edges | 1,073,308 | **~991,333** |
| AU-ABN-0 degree | 53,193 | **~45** |

Also worth doing at source: 24 entities carry structurally invalid ABNs, several of which are AEC
form text ingested literally — `Exempt-NonAustralianEntity`, `Notapplicable`,
`Exempt-InsufficientTurnover`. Add a validity guard at ingest so these never become entities.

---

## 4. Merge split identities, bucket C — recovers 684,161 edges (~20% of the graph)

See `SPLIT-IDENTITY-TRIAGE.md`. 1,455 groups where one member has an ABN and the rest are
ABN-less shadows.

**Do this after steps 1–2**, because those delete 712,827 and add 189,590 edges — merging first
means merging rows that are about to change.

1. Hand-review the top 50 by edge count. Seven names carry over half the bucket's edges.
2. Merge shadow → ABN-bearing, guarded on no conflicting `state`.
3. Re-run the attribution gate; split edges should fall by roughly 684,161.

Buckets D (1,184 groups, distinct ABNs) and A (2,225 groups, no ABNs) are deliberately **not** in
scope. See the triage document for why.

---

## 5. Reclassify `grant_opportunities` self-loops

6,497 of 6,656 edges have `source = target` by design — a foundation "granting to itself". An open
opportunity is an attribute, not a relationship. Give them a distinct `relationship_type`
(e.g. `offers_grant`) that traversals and centrality exclude by default, and rebuild to clear the
961 orphans. Cheaper and more reversible than deleting them.

---

## After every step

```bash
node --env-file=.env scripts/check-graph-completeness.mjs
node --env-file=.env scripts/check-graph-referential-integrity.mjs
node --env-file=.env scripts/check-graph-attribution.mjs
```

Then refresh the dependent matviews **in dependency order** —
`mv_gs_entity_stats` → `mv_entity_power_index` → `mv_revolving_door`. That ordering is exactly what
the unapplied `2026-08-14-mv-refresh-registry.sql` migration provides, so **land that first** and
let `mv_refresh_plan()` derive the order rather than doing it by hand.

## Expected end state

| | now | after |
|---|---|---|
| total edges | 3,429,184 | ~2,900,000 |
| justice edges resolving | 16.9% | ~100% |
| GrantConnect edges | 0 | ~189,590 |
| misattributed donation edges | 47,563 | ~0 |
| split-identity edges | 974,463 | ~290,000 |

Fewer edges, and every remaining one attributable to a real source row and a real organisation.
The graph gets smaller and considerably more true.
