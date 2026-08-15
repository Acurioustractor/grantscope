> **⚠ SCOPE CORRECTED AND EXECUTED 2026-08-15 — read this before the tables below.**
>
> The bucket-C figure below (1,455 groups / 684,161 edges, "~20% of the graph") was **wrong by
> roughly 12×**. A staged dry-run caught it before anything was written.
>
> "One ABN plus ABN-less shadows" says nothing about **what the shadow is**. By entity type the
> 1,429 eligible groups were:
>
> | shadow type | groups | merging it would |
> |---|---|---|
> | `person` | 1,209 | merge a **person** into an organisation on a name match |
> | `program` | 103 | break the justice derivation — `jf_prog_map` resolves programs BY NAME |
> | `political_party` | 92 | break `aec_donations` — it matches recipients on `entity_type='political_party'` |
> | org-like | 158 | be correct |
>
> Two of those would have silently broken derivations rebuilt earlier the same day. Not with an
> error — the next rebuild would simply have produced fewer edges.
>
> **Real scope after the entity-type guard: 148 groups / 54,753 shadow edges.**
>
> **EXECUTED 2026-08-15:** 141 groups merged, 0 failed, 0 orphaned FKs. 333,960 edges consolidated
> onto real entities (Department of Defence alone: 272,179). Entities 609,448 → 609,300;
> edges 2,905,877 → 2,904,091 (1,786 duplicates deduped). 7 groups skipped on state conflict.
>
> The lesson generalises: a merge rule keyed on *identifier presence* must also consider *entity
> kind*, and any rule that deletes entities must be checked against every derivation that resolves
> entities **by name** rather than by id.

---

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

---

## Addendum, 2026-08-15 — do NOT "fix" the aec_donations party join

After the merge, the residual split list is topped by `political_party` groups
(Canberra Labor Club, ALP N.S.W. Branch, Labor Holdings). The obvious next move looked like:
drop `party.entity_type = 'political_party'` from the `aec_donations` derivation so recipients
resolve to their ABN-bearing entity, then merge the shadows.

**Measured first. The recommendation is wrong.**

```
distinct donation recipients          2,365
  match a political_party entity      2,365   (100%)
  match ANY entity by name            2,365   (100%)
  match an ABN-BEARING entity           163   (6.9%)
```

For **93% of donation recipients there is no ABN-bearing entity at all**. The `political_party`
row is not a shadow — it is the only node that exists. Removing the type filter would resolve
6.9% of recipients to an ABN and leave the rest matching by name alone, with nothing to
disambiguate against; the current filter is doing real work.

**So the derivation stays as written.** The 92 split `political_party` groups are the minority
where both a party-typed node and an ABN-bearing node exist — a genuine but small problem, and the
fix is *not* deletion. It is to carry the ABN onto the party-typed entity (or record the link
explicitly), so the donations derivation keeps resolving while the two identities stop competing.
That is a different and more careful operation than the shadow merge, and it is not scoped here.

This is the second time in this investigation that the residual after a fix pointed at a
"next obvious step" that measurement then refuted. The pattern is consistent enough to state
plainly: **the shape of what is left after a repair is not evidence about what should happen next.**
