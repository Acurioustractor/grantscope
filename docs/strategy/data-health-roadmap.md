# Data Health Roadmap

**Status:** Active · **Created:** 2026-06-17 · **Owner:** Ben
**Trigger:** the set-based rewrite of `build-entity-graph` (PR #83) and the silent ⅓-graph-under-build it exposed (#82).

> **Principle (from `feedback_data_quality_before_scoring`):** build verification gates *before* you trust the numbers. Math on an under-built graph dresses noise up as signal. The bug fixed in #82/#83 survived for months only because **nothing was watching graph completeness.** This roadmap turns the manual diagnosis done in that session into something the platform does for itself, continuously.

> **Strategy guardrail (`docs/strategy/buyer-wedge.md`):** data widening is **paused** — evidence depth and buyer UX are the priority. "More information" below means going *deeper* on data we already hold, not bolting on new sources.

---

## Where we are after PR #83

`build-entity-graph` populates `gs_relationships` — the edges of CivicGraph (donations, contracts, grants, ownership). Everything downstream sits on it: `/graph`, the influence MVs (revolving-door, donor-contractors, entity-power-index, person-influence), entity profiles, place/funding summaries.

- The graph was **silently built with ~⅓ of its edges missing** — the source data was complete; an in-memory lookup dropped ~35% of entities before relationships resolved.
- The rewrite removed that in-memory index entirely (joins now resolve server-side against the complete table → the failure mode is structurally impossible) and recovered **+578,799 edges** (donations +159,659, contracts +418,876, grants +257, links +7). Graph: 1.70M → **2.28M edges**. ~40× faster (donations 45 min → 63s).

The graph is now **complete-by-construction and fast.** The rest of this roadmap is about keeping it that way *visibly*, then turning a trustworthy graph into depth and trust users can see.

---

## Phase 0 — Make the recovery visible *(immediate)*

The +578K edges live in `gs_relationships`, but user-facing analytics are **materialized views aggregated off that table** — they show the old under-built numbers until refreshed.

- [x] Refresh all relationship-dependent MVs (`refresh-views-v2.mjs`) — 2026-06-17.
- Ongoing: the nightly `pg_cron` job (`refresh-civicgraph-mvs-nightly`, 17:00 UTC / 3am AEST) keeps them current.

**Buys:** the recovery actually reaches the UI and the influence analytics.

---

## Phase 1 — Close the known holes (finish making *today's* graph correct)

1. **Clean-rebuild `austender`** — drop the ~658K legacy `id::text`-keyed duplicate rows (a dead code path stored the same contract under two keys). The set-based rewrite is additive so it left them. → contract **counts** become accurate, not just contract coverage. `DELETE FROM gs_relationships WHERE dataset='austender'; ` then re-run the set-based contract phase (Tier 2/3 — destructive, do it deliberately).
2. **Fix Phase 1f party-entity creation** — only **66** `political_party` entities exist for 2,437 distinct `donation_to` values, so the donation graph is capped upstream. Find why creation under-runs (no name-unique index blocks it — cause not yet isolated), fix it, re-run donations. → unlocks donation edges that are currently un-resolvable.
3. **Sweep the ~10 sibling `.range()`-without-stable-order bugs** elsewhere in the pipeline (same bug class as #82). Either add `.order(<pk>)` to each or migrate them to the same set-based pattern.

**Buys:** the *current* graph becomes fully correct, not just fully covered.

---

## Phase 2 — Continuous data-health gates *(the centerpiece)*

The durable fix isn't the rewrite — it's making "the graph is right" self-monitoring. This is the manual diff-to-zero from the #83 session, automated.

1. **Graph-completeness check (nightly agent).** For each relationship dataset, compute the *expected* edge count set-based (cheap, ~seconds, the same `INSERT…SELECT` shape minus the insert) and compare to *actual* `gs_relationships`. If actual falls below expected beyond a threshold → alert. **This single check would have caught the ⅓-drop the morning after instead of never.**
2. **Coverage trend.** Track "% of source rows that resolve to an edge," per dataset, in `mv_data_quality`. A falling line = silent regression; a rising line = genuinely capturing more. This trend *is* the platform's data-health vital sign.
3. **Extend `/health`.** Today it answers "did the agent run?" — it should also answer "is the graph *right*?" Surface completeness + freshness alongside agent success rates.

**Buys:** this class of bug can never hide here again. The difference between "we fixed a bug" and "the platform polices its own correctness."

---

## Phase 3 — More information & detail (depth, not widening)

Per the strategy guardrail, depth on what we hold — not new feeds.

- **Provenance + freshness per edge.** `first_seen` / `last_seen` / `confidence` / `dataset` columns already exist. Surface "as of <date>, source <X>, confidence <registry|reported|inferred>" on every figure. Believability *is* detail.
- **Evidence-layer enrichment** of existing entities (descriptions, evidence strength) rather than new datasets.
- Each hole closed in Phase 1 is itself "more information" — fixing Phase 1f surfaces donation signal that was always present.

**Buys:** the same data becomes richer and more trustworthy without widening.

---

## Phase 4 — Ongoing usability

- Now that the graph is trustworthy, the existing surfaces (graph viz, profiles, place summaries) can be *trusted* — shown with **freshness badges + provenance** so a buyer knows what they're looking at and when it was built.
- Compounds with Phase 2: the completeness numbers that gate health can double as a public **"data confidence"** indicator — turning internal plumbing into a trust feature.

**Buys:** correctness becomes something buyers can *see*, which is the wedge.

---

## Shape

| Phase | Theme | Outcome |
|---|---|---|
| 0 | Surface the recovery | +578K edges reach the UI/analytics |
| 1 | Close known holes | the graph is *right*, not just *covered* |
| 2 | **Continuous health gates** | "right" stays right, visibly — bug class can't hide |
| 3 | Depth + provenance | richer, more believable data (no widening) |
| 4 | Usability | correctness users can see → trust feature |

**Highest-leverage single item:** Phase 2's completeness gate.

## References

- PR #83 (set-based rewrite), #82 (the `.order('id')` index fix), #80 (resilience).
- `scripts/build-entity-graph.mjs`, `scripts/refresh-views-v2.mjs`
- Memory: `project_build_entity_graph_setbased`, `feedback_data_quality_before_scoring`
- Strategy: `docs/strategy/buyer-wedge.md`
