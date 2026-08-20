# The government entity merge: design, and three corrections to my own analysis

Simulated against production 2026-08-21. Design for #324 step 2. **No SQL written yet — this is
the plan to argue with first.**

It corrects `thoughts/shared/analysis/2026-08-20-gov-identity-split.md`, which I wrote and merged
earlier the same day (#377). Three of its claims are wrong, and one of them understated the
problem by more than the whole thing it measured.

## Correction 1 — the duplicate set is two classes, and I only measured one

The analysis reported **122 `AU-GOV`↔`AU-ABN` pairs** as though that were the duplicate set. It is
one of two classes.

**Class B is `AU-GOV`↔`AU-GOV`: the same body minted twice under two different `buyer_id` hashes.**

| | |
|---|---:|
| duplicate names within `AU-GOV` | **36** |
| entities involved | 73 |
| rows removable | 37 |

And it contains the case I have been quoting all day:

| name | copies | edges across copies |
|---|---:|---:|
| **Department of Defence** | **2** | **271,521** |
| Australian Taxation Office | 2 | 16,575 |
| Department of Education | 3 | 2,142 |
| CrimTrac | 2 | 409 |

**Defence is not in class A at all.** It is two `AU-GOV` rows — one carrying ABN 68706814312, one
carrying none — and there is no `AU-ABN-68706814312` entity in the database. My name-matching
query only looked across schemes, so the single largest duplicate in the graph fell straight
through it. 271,521 edges, against 130,963 for the whole of class A.

The ticket said this out loud — *"37 names appear more than once"* — and I measured the other
thing.

## Correction 2 — there are no dedupe collisions

The analysis said the merge *"must dedupe as it goes rather than discover it as a constraint
violation half way through"*, because `idx_gs_rel_dedup` from #322 enforces one edge per source
record.

Simulated, both classes: **zero collisions.** The index key includes `source_record_id`, and the
two identities' edges come from different source records, so re-pointing produces no duplicate
keys. The merge does not need dedupe logic. It was a reasonable fear and it is not true.

## Correction 3 — the merge does not trip the self-loop constraint

Merging two identities turns any edge between them into a self-loop, and #315 added
`gs_relationships_no_judged_selfloops` this morning over six datasets. That looked like a live
collision between two pieces of the same day's work.

Measured: **class A creates 2 new self-loops, class B creates 0.** Both fall in `austender`, which
the constraint deliberately does not cover. Self-loops go 1,088 → 1,090. Nothing aborts.

## The blast radius, measured rather than assumed

34 foreign-key columns reference `gs_entities.id`. Only **11 columns across 10 tables** actually
hold rows pointing at a class A loser:

| table | column | rows |
|---|---|---:|
| `gs_relationships` | `source_entity_id` | 128,923 |
| `gs_relationships` | `target_entity_id` | 2,041 |
| `grantconnect_awards` | `gs_entity_id` | 275 |
| `civicscope_act_entity_bridge` | `gs_entity_id` | 19 |
| `person_entity_links` | `entity_id` | 13 |
| `research_grants` | `gs_entity_id` | 6 |
| `foundation_grantees` | `grantee_entity_id` | 5 |
| `alma_interventions` | `gs_entity_id` | 3 |
| `ndis_registered_providers` | `gs_entity_id` | 2 |
| `name_aliases` | `canonical_entity_id` | 2 |
| `vic_grants_awarded` | `gs_entity_id` | 1 |

Outside `gs_relationships` the tail is 326 rows. The merge is one big update and ten small ones,
and the list must be **regenerated at apply time** rather than trusted from this table — a new FK
added between now and then would be silently skipped.

## The survivor rule, which is not the same for both classes

**Class A: the ABN entity wins.** An ABN is a real identifier; a `buyer_id` hash is an artefact of
one source system. This is #324's own step 1 and it is not in doubt. 119 of 122 pairs have exactly
one ABN candidate. **The 3 ambiguous pairs are refused, not guessed.**

**Class B has no ABN to prefer.** 33 of the 36 duplicate names carry **no ABN on any copy**; only 3
have exactly one. So the rule must be:

1. the copy carrying a valid ABN, if exactly one does; else
2. the copy with the most edges; else
3. lowest `id`, purely so the result is deterministic and re-runnable.

Rule 2 is a choice worth challenging. It preserves the most history and minimises rows touched,
but it means the surviving `gs_id` is whichever hash happened to win — which is fine only because
`gs_id` for a government body is already an artefact. If we ever want a stable public id for these,
that is a separate decision and should be made before this runs, not after.

## Proposed sequence

1. **Backup** both entity sets and every affected FK row, inside the transaction, per the #290/#315 pattern.
2. **Build both maps as tables**, not inline CTEs, so the applied mapping is auditable afterwards —
   this is the artefact that lets someone reverse it.
3. **Abort on unexpected counts** (122 class A pairs, 37 class B losers) rather than proceed.
4. **Re-point** `gs_relationships` then the ten small tables, generated from `pg_constraint` at run time.
5. **Delete the loser entities.**
6. **Then, and only then, the resolver fix** in `build-entity-graph.mjs:351` — build a
   `buyer_id → ABN` map and pass the ABN. Shipping it first orphans the edges; that finding stands.
7. **Refresh `mv_entity_power_index` and `mv_revolving_door` deliberately.** Both are keyed on
   entity identity and currently split these organisations across rows, understating both.

## What this still will not fix

The `austender` self-loops (614 rows, $823.04M) are **not** caused by this split. They are #315
class B: AusTender notices carrying a `supplier_abn` equal to the buyer's own ABN, across 138 real
supplier names. Merging Defence's two identities does not touch them.

So the **82% figure** — Defence showing $927.16M inbound of which $761.45M is itself — does not
clear here either. I have twice written that it waits on #324. More precisely: it waits on the
supplier-ABN repair, which is a different piece of work that #324 was masking.
