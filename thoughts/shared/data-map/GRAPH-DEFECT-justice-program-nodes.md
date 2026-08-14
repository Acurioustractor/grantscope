# The justice graph layer is stale, not malformed

Measured 2026-08-14 by direct psql, then **corrected twice**. Nothing has been changed in the
database. This is a diagnosis, and the correction history matters more than the conclusion.

## Two wrong readings, then the real one

**Wrong reading 1 (from the design workflow):** *"The two largest nodes in the graph are AusTender
procurement categories materialised as entities."* — Wrong. They are `justice_funding` **program**
nodes. Every edge on them is `dataset='justice_funding'`, `relationship_type='grant'`.

**Wrong reading 2 (mine, committed in `26e0202`):** *"The layer is 10.4× duplicated — 857,798 edges
collapse to 82,675 distinct pairs."* — Wrong, and wrong in an embarrassing way. Distinct
`(source, target)` pairs is the wrong denominator. Measured properly:

```
edges                    857,798
distinct source_record_id  857,731
edges per grant               1.00      ← no duplication whatsoever
null source_record_id             0
```

Many grants legitimately share a (program, recipient) pair — one program pays one organisation
repeatedly over years. That is correct behaviour, not inflation. I mistook a normal one-to-many for
a bug because I measured pair-uniqueness instead of record-uniqueness.

## The actual defect

**`justice_funding` was re-ingested with regenerated primary keys, and the graph's justice layer was
never rebuilt.**

- `justice_funding.id` is `uuid`. `gs_relationships.source_record_id` holds `uuid` in the same
  format. They are the same key space.
- The graph references **857,731 distinct grant ids**. The table holds **157,116 rows**.
- **0 of 20,000 sampled edges resolve** to a current `justice_funding.id`.

So every one of the 857,798 justice edges points at a grant row that no longer exists. This also
explains the documented April drop from 218,022 rows to 157,116 that nothing alerted on: the table
has been rewritten at least once, and the edge layer never followed.

## The builder is correct — do not rewrite it

`scripts/lib/graph-edge-datasets.mjs` (the `justice_funding` entry, ~line 136) already does the
right thing:

- `source` = canonical program node via `jf_prog_map`, `target` = recipient matched by exact ABN
- **one edge per payment**, with `source_record_id = jf.id::text`
- an idempotency guard (`COALESCE(y.source_record_id,'') = jf.id::text`) so re-runs add zero duplicates
- `jf_prog_map` already collapses the two historical `GS-PROG-` id formats to one node per
  (program, state), specifically to stop edges splitting across node generations

The design intent is exactly what a drill-through needs. It was simply never re-run after the source
table was replaced.

## What this changes

**The fix is much smaller than the previous version of this document claimed.** Not a redesign —
a rebuild of one slice:

1. Delete `WHERE dataset='justice_funding'` from `gs_relationships` (857,798 rows).
2. Re-run the justice phase of `build-entity-graph.mjs`, which runs `JUSTICE_PROGRAM_ENSURE_SQL`
   then the edge insert. Expect roughly 157,116 edges back, one per payment with a resolving
   `source_record_id`.
3. Refresh `mv_gs_entity_stats` → `mv_entity_power_index` → `mv_revolving_door`, in that order.
   This is precisely the dependency-ordering problem the matview registry migration exists to
   solve, so land that first.
4. Add a guard so this cannot recur silently: a check that
   `count(source_record_id) NOT IN justice_funding.id` is zero, run after any justice ingest.
   The absence of that guard is the actual root cause — the table can be replaced underneath the
   graph with nothing noticing.

**Drill-through becomes buildable.** CLARITY-SPEC §1.5 rejected "click an edge to see the grant" on
the grounds that `source_record_id` is a dead key namespace. It is not dead — it is stale. After the
rebuild it resolves, and that rejection should be revisited.

## Still true, and still worth acting on

- **Program nodes dominate the degree distribution.** Three `GS-PROG-*` nodes hold 668,845 edges,
  19.5% of the 3,429,184-edge graph; the largest holds 330,460 to 181 counterparties. That is a
  *consequence of the design* (program-as-node), not a bug — but it does mean any "most connected
  entity" ranking is topped by programs rather than organisations, and `mv_entity_power_index` and
  `mv_revolving_door` are live surfaces reading it. After the rebuild the counts drop ~5×, but the
  shape stays. Decide separately whether 9,584 `GS-PROG-*` rows belong in `gs_entities` at all or
  in a `programs` dimension — they are not organisations and they dilute the 609,448 headline.
- **`AU-ABN-0`** — "112 Trenerry Crescent Pty Ltd", `abn='0'`, 53,193 edges. A zero ABN acting as a
  catch-all bucket. Separate defect.
- **"Department of Defence" appears twice** in `gs_entities`, on the third-largest hub. Unverified
  beyond the name match.

## Method note

Both wrong readings were produced the same way: inferring a mechanism from the shape of the data
without reading the code that generates it. The builder took two minutes to read and killed both.
Read the producer before diagnosing the product.

---

# Addendum — the full sweep, 2026-08-14

Once `--dataset=` existed, all five edge datasets were checked individually (the full serial run
had been dying on pooler drops before reaching most of them).

| dataset | expected | actual | status | coverage of source |
|---|---|---|---|---|
| `aec_donations` | 1,038,896 | 1,073,308 | OK | — |
| `austender` | 668,335 | 699,387 | OK | — |
| `grant_opportunities` | 5,422 | 6,656 | STALE (22.8%) | 25.7% |
| **`foundations`** | **24** | **63** | **STALE_SEVERE (2.6×)** | **0.6%** |
| **`justice_funding`** | **144,901** | **857,798** | **STALE_SEVERE (5.9×)** | 546% |

**Two of five layers are severely stale.** But `foundations` is the more alarming row, and not for
the staleness.

## The philanthropy layer of the graph barely exists

`foundations` holds 11,159 rows. The builder's own set-based derivation produces **24 edges**. Not
24,000 — twenty-four. Actual is 63, so the layer is both stale *and* empty.

Staleness is a rebuild. This is not: rebuilding `foundations` would replace 63 stale edges with 24
fresh ones and the philanthropy layer would still be, effectively, absent. The join that produces
those edges must be matching almost nothing — that is a **coverage defect in the derivation**, and
it needs the same treatment the justice ABN joins got: measure the match rate, find out which key
is failing, and fix the join rather than re-running it.

This matters disproportionately. Philanthropy and giving are the first two pillars of the stated
vision, and `foundations` is the table that carries them into the graph. Every "who funds whom"
question routes through 63 edges.

`grant_opportunities` at 25.7% coverage is the same class of problem, one order less severe — and
consistent with the data map's earlier finding that 97.6% of its edges (6,497 of 6,656) are
self-loops.

## Revised priority

1. `justice_funding` — rebuild. Mechanism understood, target number known (144,901).
2. `foundations` — **diagnose the join before rebuilding.** A rebuild here fixes nothing.
3. `grant_opportunities` — diagnose the self-loops, then rebuild.
4. `aec_donations` / `austender` — healthy, leave alone.
