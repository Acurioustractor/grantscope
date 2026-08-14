# Split identities — 4,864 groups triaged into three buckets

Measured 2026-08-14. Nothing changed. Surfaced by `scripts/check-graph-attribution.mjs`.

**4,864 canonical names are split across 10,442 entities holding 974,463 edges — 28% of the
3.43M-edge graph.** Every one of those organisations is understated in every ranking, because its
relationships are divided between nodes nothing joins together.

4,864 individual decisions is not a plan. Grouping by what the ABNs look like makes it three.

| bucket | groups | entities | edges | verdict |
|---|---|---|---|---|
| **C. one ABN + ABN-less shadows** | 1,455 | 2,954 | **684,161** | **Merge.** High confidence. |
| D. multiple distinct ABNs | 1,184 | 2,925 | 235,529 | Leave. Different organisations. |
| A. no member has an ABN | 2,225 | 4,563 | 54,773 | Needs other evidence. |

## The missing fourth bucket is the proof the model is right

There is no "all members share one ABN" bucket, and there cannot be: `gs_entities.abn` carries a
unique index with zero duplicates across 351,455 values (verified separately during the data-map
work). So two entities can never share an ABN, and every split is therefore either an ABN-less
shadow, a genuinely different organisation, or an unidentified pair. The classification is
exhaustive by construction rather than by inspection.

## Bucket C is the whole prize — 70% of the problem, one rule

1,455 groups where exactly one member carries an ABN and the rest carry none. This is the
Department of Defence pattern:

```
AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583   Department of Defence   abn 68706814312   ACT
AU-GOV-0ec98ef9e0205da9dcb10135be81bd2b   Department of Defence   (no abn)          (no state)
```

The ABN-bearing row is the real entity; the others are shadows created by a name-only ingest path
that never resolved to an identifier. Merging shadow → ABN-bearing recovers **684,161 edges**,
about **20% of the entire graph**, under a single mechanical rule with no per-case judgement.

The largest individual cases are exactly the ones that most distort rankings: Department of Defence
(270,884 edges), Canberra Labor Club (90,919), Australian Labor Party N.S.W. Branch (55,829),
Labor Holdings (36,565), Gambling Community Benefit Fund (22,641), Department of Home Affairs
(20,967), Australian Taxation Office (16,448).

**Caveat before merging.** "One ABN plus shadows" is strong evidence, not proof. Two genuinely
different organisations can share a name where only one is ABN-registered. Suggested guard: merge
automatically only where the shadow carries no conflicting `state`, and hand-review the top 50 by
edge count — those seven alone account for over half the bucket's edges, so a small review covers
most of the risk.

## Bucket D — leave alone

1,184 groups with two or more distinct ABNs. Different ABN means different legal entity. A shared
name is normal in Australia (trading names, franchise structures, "The Trustee for ..." variants).
Merging here would be worse than the current state.

## Bucket A — needs evidence this database does not currently hold

2,225 groups, 4,563 entities, and only 54,773 edges between them — 5.6% of the split problem for
46% of the groups. Nothing distinguishes the members: no ABN on either side. Resolving them needs a
second signal (state, postcode, ACN, source dataset). Low value per unit effort; do it last if at all.

## Recommended sequence

1. Hand-review the **top 50 of bucket C** by edge count. Seven names carry more than half the
   bucket's edges, so this is a short session with most of the payoff.
2. Merge the rest of bucket C under the ABN-less-shadow rule, with the `state`-conflict guard.
3. Re-run `check-graph-attribution.mjs` and confirm the split edge count drops by roughly 684,161.
4. Leave D. Revisit A only if a second identifier signal becomes available.

Sequence this **after** the `justice_funding` rebuild, which removes 712,827 orphaned edges — some
of them may sit on shadow nodes, so merging first means merging rows that are about to be deleted.
