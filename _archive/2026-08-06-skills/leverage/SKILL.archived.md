---
name: leverage
description: Data-to-Goals Leverage Map — inventory the whole data estate, align it to the buyer-wedge + mission goals, and surface the highest-value LATENT connections we already have the data for but aren't exploiting. Connect/deepen, never widen (data widening is paused). Self-paced loop that appends to a living map. Use on /leverage, "what should we build", "find valuable connections", "what are we sitting on", "align our data to goals".
---

# /leverage — Data-to-Goals Leverage Map

Most of the value in this estate is **latent**: ~254 tables and 30+ MVs that share a handful of join
keys, against a small set of explicit goals. The connections that would serve a goal but were never
built are invisible until something maps them. That mapping is this skill.

`/wedge` *judges* proposed work against the strategy. `/leverage` is its generative twin: it *finds*
candidate work — the valuable connections — and pre-tags each with the wedge verdict so the two never
drift.

## The one hard rule

**Data widening is PAUSED (buyer-wedge move 5).** Leverage here means **connecting and deepening data we
already have** — joins, materialised cross-system views, evidence chains, entity resolution. A finding
whose action is "scrape more states / more rows / a new source" is **out of scope** — surface it only as
an explicitly-flagged `WIDENING (paused)` note, never as a top opportunity. Depth beats row count, always.

## Output: a living Leverage Map

Write to `docs/leverage-map.md` (create on first run). Each opportunity is one row:

```
- **<id> — <the connection in a sentence>.** Datasets: A × B (× C) via <join key>. Serves: <goal>.
  Why valuable: <one line>. Evidence: <counts proving the data supports it>. State: already-built /
  latent / blocked. Effort: S/M/L. Wedge: green / supply-magnet / widening-paused / not-building.
```

Rank by `data-readiness × goal-alignment × novelty` (see `references/method.md`). Dedup against rows
already in the map — append only genuinely new connections each iteration.

## Loop discipline (self-paced, like the health loop)

Encode Ben's "stop being the loop" pattern — exit is **his interruption**, not "when done".

1. **Inventory** (cheap, each session-start or when stale): run the estate + join-key-coverage queries
   from `references/method.md`. This is "see everything we have." Cache the snapshot in the map header.
2. **Pick an unmined facet** — a join key (ABN, gs_entity_id, postcode, person, name) or a goal. One per
   iteration; don't re-mine a covered facet.
3. **Mine latent connections** for that facet: which dataset pairs/triples join on it, which are already
   materialised (MV exists) vs latent vs blocked. Ground each in ONE tiny count query (coverage proof).
4. **Score + tag**: readiness × alignment × novelty; attach the wedge verdict; classify state/effort.
5. **Dedup-append** new rows to `docs/leverage-map.md`. Update the LOOP STATE comment.
6. **Summarise to Ben in ≤3 lines.** Then self-pace: `ScheduleWakeup ~270s` for the next facet while
   facets are fresh; once two iterations add nothing new, park (`~3600s`) until new state arrives
   (a new MV, a finished crawl, an enrichment run) — same gate-check pattern as the health loop.

## Guardrails

- **Tier 1–2 only.** Read-only queries + local file writes. Building an MV, refreshing prod, or running
  a writing agent is the *recommendation*, never an action the loop takes. Hand those to Ben.
- **Ground every claim in a count.** No opportunity goes in the map without a query proving the join
  actually has coverage (verification rule). "Latent but 4% ABN overlap" is a dead lead, say so.
- **Don't re-derive strategy.** Goals live in `references/goals-register.md`; if the work would change a
  goal, update that file (and the underlying doc) first.

## References (load when needed)

- `references/goals-register.md` — the goals, what "valuable" means for each, and the wedge filter.
- `references/method.md` — inventory queries, the join-key map, connection-mining method, scoring rubric.
