# The justice layer of the graph is a program-node cartesian, 10.4× inflated

Measured 2026-08-14 by direct psql. **Nothing has been changed.** This is a diagnosis.

## One root cause, three symptoms

Three defects were being tracked separately. They are the same bug.

| Reported as | Actually |
|---|---|
| "Two AusTender procurement categories materialised as entities, contaminating every power score" | Not AusTender. Three (not two) **`justice_funding`** program nodes, and they are the tip of 9,584 |
| "~700,000 orphaned edges — `gs_relationships` holds 857,798 justice edges against a 157,116-row source table" | Not orphaned rows. The edges are **program→org pairs repeated**, not per-grant rows |
| "`gs_relationships.source_record_id` is a dead key namespace, 0 of 49,426 resolve" | Correct, and now explained: an edge is not a grant, so it has no grant id to point at |

## The measurements

**Every justice edge in the graph touches a program node.**

```
jf_edges_total          857,798
jf_edges_touching_prog  857,794      ← 99.9995%
jf_edges_clean                4
```

**The layer is 10.4× duplicated.**

```
edges              857,798
distinct pairs      82,675      ← 10.4 duplicate edges per (source, target) pair
distinct sources     6,658      ← program nodes
distinct targets    39,501      ← real organisations
```

**The worst single node**, `GS-PROG-specialised-supplies-and-services-19dc-qld`:
330,460 edges — to **181 distinct counterparties**. That is ~1,826 edges per counterparty, and
more edges from one node than there are rows in the entire `justice_funding` table (157,116).

**The top of the degree distribution is program nodes, not organisations:**

| gs_id | degree | type |
|---|---|---|
| `GS-PROG-specialised-supplies-and-services-19dc-qld` | 330,460 | program |
| `GS-PROG-specialised-support-services-a6e8-qld` | 274,675 | program |
| `AU-GOV-...` Department of Defence | 270,864 | government_body |
| `GS-PROG-specialised-service-and-support-a044-qld` | 63,710 | program |

Three program nodes hold **668,845 edges = 19.5%** of the entire 3,429,184-edge graph.
9,584 `GS-PROG-*` entities exist in total.

## What is affected

Anything that ranks by connectivity, centrality or counterparty count is reading a graph where
one in five edges is a duplicated link to a QLD program label. That includes **`mv_entity_power_index`
and `mv_revolving_door`, which back live surfaces**, plus `mv_gs_entity_stats.total_relationships`,
`distinct_counterparties` and `top_counterparty_share`.

It also means any "most connected entity" list is wrong at the top, and any attempt to draw an
ego-network from a program node is undrawable for reasons that have nothing to do with the data
being genuinely dense.

## What this is NOT

Not a classification problem. Reclassifying `entity_type='program'` or filtering those nodes out of
rankings treats the symptom. The underlying edge set is 10.4× inflated regardless of what the nodes
are called, and the inflation is inside the pairs, not between them.

## The likely mechanism (inferred, not proven)

`build-entity-graph` appears to create one entity per distinct `justice_funding.program_name`, then
emit an edge per source row joining program → recipient. Because many rows share a
(program_name, recipient) combination, the same pair is emitted repeatedly — 10.4 times on average,
1,826 times in the worst case. The edge therefore represents a *program-recipient relationship*,
not a grant, which is exactly why `source_record_id` resolves to nothing.

**This is inferred from the shape of the data. Read the builder before acting on it.**

## Recommended fix, in order

1. **Read `scripts/build-entity-graph*.mjs`** and confirm the mechanism above. Do not skip this —
   the "AusTender categories" reading was confidently wrong and was arrived at the same way.
2. **Decide what a justice edge means.** Either one edge per grant (keyed to `justice_funding.id`,
   which makes `source_record_id` work and drill-through buildable), or one edge per
   program-recipient pair with `amount` summed and a count. The first is more useful and matches
   what every other dataset in the graph does.
3. **Rebuild only the `dataset='justice_funding'` slice.** 857,798 edges out; roughly 157,116
   (per-grant) or 82,675 (per-pair) back.
4. **Then** refresh `mv_gs_entity_stats`, `mv_entity_power_index` and `mv_revolving_door`, in that
   order — and note this is exactly the dependency-ordering problem the matview registry migration
   exists to solve, so land that first.
5. Decide separately whether the 9,584 `GS-PROG-*` rows should be entities at all, or a `programs`
   dimension table. They are not organisations and they dilute every entity count in the product,
   including the 609,448 headline.

## Also found, not chased

- **`AU-ABN-0`** — "112 Trenerry Crescent Pty Ltd" carries `abn='0'` and 53,193 edges. A zero ABN is
  behaving as a catch-all bucket. Separate defect, same family.
- **"Department of Defence" appears twice** in `gs_entities` — a duplicate on the third-largest hub
  in the graph. Unverified beyond the name match.
