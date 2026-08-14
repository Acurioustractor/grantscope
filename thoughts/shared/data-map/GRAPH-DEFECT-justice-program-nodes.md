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

# Addendum — the full sweep, 2026-08-14 (corrected)

Once `--dataset=` existed, all five gate-covered datasets were checked individually.

| dataset | expected | actual | status |
|---|---|---|---|
| `aec_donations` | 1,038,896 | 1,073,308 | OK |
| `austender` | 668,335 | 699,387 | OK |
| `grant_opportunities` | 5,422 | 6,656 | STALE 22.8% |
| `foundations` | 24 | 63 | STALE_SEVERE 2.6× |
| **`justice_funding`** | **144,901** | **857,798** | **STALE_SEVERE 5.9×** |

## Correction: the `foundations` alarm was mine, and it was wrong

An earlier version of this addendum called 24 edges from an 11,159-row table "the philanthropy
layer barely exists". That was the **third** over-claim in this investigation, and it was wrong for
the same reason as the first two: I read the number before reading the derivation.

The `foundations` edge dataset is not "who funds whom". It is `subsidiary_of` — cross-registry
parent-company links, gated on `parent_company IS NOT NULL`. Measured:

```
foundations           11,159
  has acnc_abn        11,138   (99.8%)
  has parent_company      84   (0.75%)
  has both                73
```

**24 edges from 73 eligible rows is a 33% name-match rate on a genuinely rare field.** It is
working roughly as designed. The `STALE_SEVERE` flag is technically right (63 actual vs 24 expected)
but on 39 rows it is noise, not signal — a lesson for the `STALE_FACTOR` tier: it should carry an
absolute floor so tiny datasets cannot trip it.

## And philanthropy IS in the graph — via a pipeline the gate does not watch

`foundation_grantees`: **5,734 edges from 6,001 source rows = 95.6% coverage.** Healthy. It is
simply built somewhere other than `GRAPH_EDGE_DATASETS`, so the gate never sees it.

## The real finding: the gate watches 5 of 24+ datasets

`gs_relationships` carries at least 24 distinct `dataset` values. The completeness gate covers
**five**. Everything else — `person_roles` (334,982), `acnc_register` (322,163),
`person_roles_crossmatch` (95,476), `nhmrc_grants`, `foundation_grantees`, `foundation_board`,
`hms_trust_grants`, `frrr_grants`, `creative_australia`, the three lobbying registers,
`ian_potter_grants_db`, `arc_grants`, `qld_arts_grants`, `lotterywest_grants`, `wbf_grants`,
`abr_corporate_groups`, `foundation_charity_match` — is **unmonitored**. Roughly 780,000 edges,
23% of the graph, could go stale exactly the way justice funding did and nothing would report it.

## And the largest grants dataset in the database has no edges at all

```
grantconnect_awards          291,264 rows
edges in gs_relationships          0
```

Not stale. Never built. This is the same table the opportunity work flagged for ~67,000 recipient
ABNs that were never created as entities — but the gap is bigger than that: no GrantConnect award
appears in the graph in any form. For a project whose first two pillars are philanthropy and
giving, the single largest awarded-grants source is absent from the relationship layer.

## Revised priority

1. **`justice_funding`** — rebuild. Mechanism understood, target known (144,901).
2. **`grantconnect_awards`** — build the edge dataset. 291,264 rows, currently invisible. Likely the
   highest-value single addition to the graph.
3. **Extend the gate to all 24 datasets**, or at minimum the six above 10,000 edges. An unwatched
   layer is how this defect survived.
4. **Add an absolute floor to `STALE_FACTOR`** so a 39-row discrepancy stops paging.
5. `grant_opportunities` — diagnose the 97.6% self-loops, then rebuild.
6. `foundations`, `aec_donations`, `austender` — leave alone.

## Method note, sharpened

Three wrong readings in one investigation: AusTender categories (design workflow), 10.4×
duplication (mine), philanthropy-layer-empty (mine). Every one came from interpreting a number
without reading the code that produced it, and every one was killed within two minutes of opening
the source. The number tells you where to look. It does not tell you what you are looking at.

---

# Addendum 2 — `grant_opportunities`: the self-loops are deliberate

The data map flagged "97.6% of grant_opportunities edges are self-loops (6,497 of 6,656)" as a
defect. **It is not a bug — it is a modelling choice, and it is commented as such** in
`scripts/lib/graph-edge-datasets.mjs`:

```js
// self-ref edge on the foundation entity (foundation offers grant); amount = max || min.
f_ent.id AS source_entity_id, f_ent.id AS target_entity_id, 'grant' AS relationship_type,
```

Source and target are both the foundation. The derivation produces self-loops 100% of the time by
construction.

## But the modelling choice has real costs

An open grant *opportunity* is an **attribute of a foundation**, not a relationship between two
entities. Nobody has received anything yet. Encoding it as `relationship_type='grant'` with
`source = target` means:

- every open opportunity adds 1 to that foundation's degree, so foundations with active grant
  rounds rank as better-connected than foundations that have actually funded people
- it is semantically false — the row reads "this foundation granted to itself"
- graph traversal, centrality and any "who funds whom" query must special-case it
- it inflates the edge count of the philanthropy layer with non-relationships

This compounds with the earlier finding that `foundation_grantees` (real awards, 5,734 edges) is
built by a different pipeline the completeness gate does not watch. The graph currently gives
*opportunities* a first-class edge type and leaves *actual awards* unmonitored.

## The split, measured

| | edges | resolve to `grant_opportunities.id` |
|---|---|---|
| self-loop (`source = target`) | 6,497 | 5,536 (85.2%) — **961 orphaned** |
| not a self-loop | 159 | **159 (100%)** |

The 159 non-self-loop edges — from an older or different builder — are the **only fully healthy
part of this dataset**. That is the reverse of what I assumed before measuring: I expected the
legacy rows to be the stale ones.

## Recommendation

1. Stop modelling opportunities as edges. Either drop them from `gs_relationships` and read
   `grant_opportunities` directly wherever "open rounds" are needed, or give them a distinct
   `relationship_type` (e.g. `offers_grant`) that every traversal and centrality query excludes
   by default. The second is cheaper and reversible.
2. Rebuild to clear the 961 orphans, whichever option is chosen.
3. Work out what produced the 159 real edges and whether that path should be the primary one.
4. Add `foundation_grantees` to the completeness gate — real awards should be watched at least as
   closely as open opportunities.

Not urgent relative to `justice_funding` (712,827 orphans) or the never-built GrantConnect layer
(291,264 rows), but it is a correctness issue in exactly the pillar the project leads with.

---

# Addendum 3 — the two "unverified" claims, now verified

Both had been sitting in this document flagged unverified. Closed 2026-08-14.

## "Department of Defence appears twice" — TRUE, and it is a pattern

```
AU-GOV-0ec98ef9e0205da9dcb10135be81bd2b  Department of Defence  government_body  (no abn)  (no state)
AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583  Department of Defence  government_body  68706814312  ACT
```

The ABN-bearing row is the real one and carries 270,864 edges — the third-largest node in the
graph. The other is an ABN-less, state-less shadow.

**It is not a one-off.** Among `entity_type='government_body'` alone there are **41 duplicate-name
groups covering 84 rows** — roughly 43 excess entities. Government buyers are the counterparty on
most of the procurement graph, so a split identity there quietly divides one department's spend
across two nodes and understates it in every ranking.

Worth a dedup pass keyed on normalised name + ABN-presence, in the same family as the ORIC/ABN
dedup lane already running.

## "`AU-ABN-0` is a catch-all bucket" — TRUE, but narrower than described

Exactly **one** entity carries `abn='0'`:

```
AU-ABN-0   112 Trenerry Crescent Pty Ltd   company   abn='0'
```

So it is not a bucket of many mis-keyed rows. It is a single real company whose ABN was ingested as
`'0'`, and which has consequently become the **sink for 53,193 edges** — every source row whose ABN
normalised to zero resolved to this one node. One company is currently wearing tens of thousands of
other organisations' relationships.

Cheap to fix and worth doing before any centrality or power-score work: null the bogus ABN, break
the edges that resolved through it, and add a guard rejecting `'0'`, `'00000000000'` and similar
from ABN normalisation at ingest.
