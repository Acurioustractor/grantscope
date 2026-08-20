# Self-loops across the whole of `gs_relationships`

Measured 2026-08-20 against production (`tednluwflfhxyucgwigh`). Closes the unknown in #315.

## The measurement completes; it was never the query's fault

#290 could not measure this and shipped a dataset-scoped constraint for that reason. The scan
times out through `gsql.mjs`, which caps at about 8 seconds, and through the Supabase MCP. It
takes roughly a second in a direct `psql` session with the cap lifted:

```sql
SET statement_timeout = '600s';
SELECT dataset, relationship_type, count(*),
       count(*) FILTER (WHERE amount IS NOT NULL), sum(amount)
FROM gs_relationships WHERE source_entity_id = target_entity_id
GROUP BY 1, 2 ORDER BY 3 DESC;
```

No partial index, no chunking, no `maintenance_work_mem` bump. A sequential scan of 3.43M rows is
cheap; what was expensive was the 8-second client cap. **Anything in this repo that "times out
against the pooler" should be retried through `psql` before it is designed around.**

## What is there

7,330 self-loops, 12 `(dataset, relationship_type)` pairs, $4,382.14M nominal.
`foundation_grantees` does not appear: #290's fix held.

| dataset | relationship_type | rows | $m | class |
|---|---|---:|---:|---|
| grant_opportunities | offers_grant_program | 6,229 | 3,494.29 | A |
| austender | contract | 614 | 823.04 | **B** |
| lobbying_register_federal | lobbies_for | 217 | – | **C** |
| aec_donations | party_receipt | 132 | 60.57 | **B** |
| lobbying_register_wa | lobbies_for | 72 | – | **C** |
| lobbying_register_sa | lobbies_for | 49 | – | **C** |
| foundations | subsidiary_of | 4 | – | A |
| lobbying_register_nsw | lobbies_for | 4 | – | **C** |
| grantconnect_awards | offers_grant_program | 3 | 4.21 | A |
| grant_opportunities | grant | 3 | – | A |
| qld_arts_grants | offers_grant_program | 2 | 0.03 | A |
| foundation_charity_match | affiliated_with | 1 | – | A |

## They are not one defect

The ticket assumed a verdict per pair of "bug or legitimate". The data supports three classes, and
the middle one is the reason a blanket delete would have been wrong.

### A — the edge asserts a falsehood and nothing real is lost. 6,242 rows, $3,498.53M.

An opportunity node collapsed into its own provider, so the graph records an organisation offering
a grant program to itself. Snow Medical Research Foundation offers itself $50M. Swinburne, Adelaide
and Queensland each offer themselves the identical $37,507,787 — which is an ARC Centre of
Excellence, money those universities *received*, recorded with the host named as the provider.
Both ends of the edge are wrong and deleting it loses nothing.

Also here: four foundations that are their own subsidiary, and one charity affiliated with itself.

### B — a real relationship between two distinct organisations, collapsed by identity. 746 rows, $883.61M. Do not delete.

**`austender`, 614 rows, $823.04M.** Of 626 self-loop rows re-joined to their contract notice, 624
carry a `supplier_abn` equal to the buyer's own ABN, across **138 distinct and entirely real
supplier names** — ADM Systems, Adagold Aviation, Airnsea Safety, Associated Aircraft Spares. The
supplier field on the notice is right; the ABN on it is wrong, and ABN-based resolution then maps a
genuine external supplier onto the buyer. The contracts happened. Deleting the edges would remove
138 suppliers' Defence work from the graph rather than fix it. The repair is re-resolution on
`supplier_name` where `supplier_abn` equals the buyer's ABN.

**`aec_donations`, 132 rows, $60.57M.** Transfers between party branches our graph merged into one
entity: ALP federal to ALP Northern Territory, Greens national to Greens South Australia. Real
money between real distinct organisations. Note that 98 of the 132 rows are `receipt_type =
'other receipt'` and are therefore not donations at all under CLAUDE.md's third mandatory filter —
only 28 rows and $3.92M are `'donation received'`.

Both belong to **#324**, entity resolution, not to a self-loop cleanup.

### C — undecided, possibly legitimate. 342 rows, no dollars. Not deleted, not constrained.

Every lobbying self-loop carries `properties.note = 'Client of registered lobbyist firm'`. An
entity that is its own client is either in-house lobbying, which is real and common, or a name
collapse. Nobody has judged which. Left out **for a stated reason**, the way `foundation_grantees`
was the only dataset covered in #290.

## Which published figures move

Not the ones you would expect, and the worst distortion is in the class we are *not* deleting.

| entity | self-loops | $m in loops | $m inbound on the entity page | share |
|---|---:|---:|---:|---:|
| Department of Defence | 597 | 761.45 | 927.16 | **82%** |
| The University Of Queensland | 570 | 556.99 | 4,733.41 | 12% |
| Monash University | 575 | 532.43 | 2,428.03 | 22% |
| The University of Sydney | 522 | 457.66 | 3,961.10 | 12% |
| Australian National University | 359 | 278.61 | 1,673.61 | 17% |

Four fifths of the money the graph shows flowing *into* the Department of Defence is Defence paying
itself, and none of it clears under the class A deletion — it is class B and waits on #324.

The university rows are class A and do clear. Their entity pages, the giving and foundation
surfaces and the eight matviews over `grant_opportunities` all move. **Refresh those matviews
deliberately after applying**: #314 showed a manual refresh folds in thousands of rows of unrelated
backlog at the same moment, which is exactly why #290 could not report a per-surface delta.

## What was left undone

`migrations/2026-08-20-gs-relationships-selfloops.sql` is written and **not applied**. It backs up
inside the transaction, aborts on an unexpected count, deletes class A only, and extends the #290
constraint to the six judged datasets as `NOT VALID`. Applying it deletes production rows, which is
Ben's call.
