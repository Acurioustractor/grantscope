# The government identity split: measured, and why the obvious fix makes it worse

Measured 2026-08-20 against production. Feeds #324. **No code changed — deliberately. See the
sequencing finding at the end.**

## The mechanism, confirmed in one line of code

`scripts/build-entity-graph.mjs:351`, minting government bodies from AusTender buyers:

```js
gs_id: makeGsId({ buyer_id: buyerId }),
```

No ABN is passed, and none is looked up. Every AusTender buyer therefore mints `AU-GOV-<buyer_id>`.
The same organisation arriving through any ABN-carrying dataset mints `AU-ABN-<abn>`. Both are
correct per `makeGsId`, whose preference order puts a valid ABN first and falls through to
`buyer_id`. Neither branch is wrong; the input simply differs by route.

The previous session's work on `scripts/lib/gs-id.mjs` — ABN checksum validation, a deterministic
name hash replacing a `Date.now()` fallback — is sound and unrelated to this. #324's first ask,
that *"the resolver should look the ABN up rather than depending on the source row happening to
carry it"*, is not done.

## The size of it

Government entities: **1,891, of which only 78 carry an ABN at all.**

Cross-scheme duplicates, matched on exact normalised name:

| | |
|---|---:|
| `AU-GOV` ↔ `AU-ABN` pairs | **122** |
| of which unambiguous (exactly one ABN candidate) | 119 |
| edges on the `AU-GOV` side | **130,963** |
| edges on the `AU-ABN` side | **150,013** |
| organisations with edges on **both** sides | **60** |

Those 60 are the ones that bite: a query resolving to either identity misses the other's edges
entirely, and nothing about the result looks wrong.

## The split is bidirectional, which is why nobody caught it

Sometimes the `AU-GOV` row holds the edges, sometimes the `AU-ABN` row does. There is no
"the ABN one is the real one" rule to lean on:

| organisation | `AU-GOV` edges | `AU-ABN` edges |
|---|---:|---:|
| Department of Home Affairs | **23,780** | 4 |
| Department of Agriculture, Fisheries and Forestry | 14,463 | 2,809 |
| Australian Federal Police | 14,358 | 301 |
| Australian Research Council | **13,063** | 1 |
| Australian Competition and Consumer Commission | 7,054 | 16 |
| Australian Signals Directorate | 6,687 | 37 |
| Geoscience Australia | 5,196 | 110 |
| Department of Finance | 15 | **12,530** |
| Australian Electoral Commission | 8 | **6,534** |
| Department of Education | 2,117 + 25 + 0 | **31,357** |

**The Department of Education is four entities** — three `AU-GOV` rows and one `AU-ABN` row.

## The fix is one line, and shipping it alone would make things worse

The code fix is small: build a `buyer_id → ABN` map before minting and pass the ABN, letting
`makeGsId`'s existing preference order do the rest. No change to `gs-id.mjs` is needed, because it
already prefers a valid ABN.

**But that fix must not land before the merge.** Today's `AU-GOV` rows hold 130,963 edges. Change
the resolver and the next graph build mints `AU-ABN-*` for those same buyers, writes new edges
there, and leaves the existing `AU-GOV` rows and their 130,963 edges behind — no longer being
written to, still being read by every surface keyed on entity identity. That is a **third**
identity state for the same organisations, and it is strictly worse than the two we have, because
the current two are at least both live.

So the order is: **merge first, then change the resolver** — or both in one migration. The
resolver change is the cheap half and the tempting one to ship early. It is the half that must
wait.

## What the merge has to handle, and why it is not written here

Re-pointing 130,963 edges is the visible part. The rest:

- `gs_entities.id` is referenced by other tables, not only `gs_relationships` — `justice_funding`,
  `grantconnect_awards`, `organizations` and the matviews keyed on entity identity. Every one needs
  re-pointing or rebuilding.
- `idx_gs_rel_dedup` from #322 enforces one edge per source record. Merging two entities will
  collide two edges onto the same key where both sides recorded the same source row, so the merge
  must dedupe as it goes rather than discover it as a constraint violation half way through.
- The 3 ambiguous pairs (more than one ABN candidate for the name) must be refused, not guessed —
  the standing rule.
- `mv_entity_power_index` and `mv_revolving_door` are keyed on entity identity and currently split
  these organisations across two rows, understating both. They need refreshing after, deliberately,
  and per #314 their tier decides when that happens on its own.

This is a design job with a real blast radius, not a migration to write at the end of a session.

## Bearing on the self-loops

#315 class B is downstream of this. The `austender` self-loops — 614 rows, $823.04M — are Defence
recorded as its own supplier, and the AusTender `AIR7000 P8 POSEIDON` finding sits on the same
identity confusion. The **82% figure** (Defence showing $927.16M inbound of which $761.45M is
itself) does not move until this does.
