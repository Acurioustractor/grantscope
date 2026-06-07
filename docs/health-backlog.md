# Project Health Backlog

> Generated + maintained by the **project-health loop** (self-paced). Each iteration mines a
> facet of system state (enrichment gaps · data cleaning · automation/cron health), grounds
> ideas in real queries, and **appends only new, deduped** items. Numbers are point-in-time —
> re-verify before acting. Exit condition for the loop = Ben's interruption, not "when done".

**Last iteration:** 2026-06-08 (iter 5 — automation freshness · low-yield · loop parked)
**Entity baseline:** `gs_entities` = 598,150 · `austender_contracts` = 810,118

---

## 🔴 Root-cause finding (iter 1)

The enrichment **agent fleet is mostly failing** — this is *why* the gaps in section B are so
large. Fixing the agents is higher-leverage than any one-off backfill.

| Agent | Success | Runs | Note |
|---|---|---|---|
| Enrich Social Enterprises | **3%** | 78 | ⚠️ wedge-critical — this is the SE registry product |
| Poll Foundation Frontier | 5% | 58 | |
| Build Entity Graph | 5% | 21 | graph is the core data model |
| Refresh Youth Justice Source Chain | 7% | 43 | wedge-relevant |
| Re-profile Missing Descriptions | 11% | 47 | feeds B2/C2 |
| Trust Remediation Loop | 12% | 83 | |
| Enrich Charities | 15% | 71 | feeds B1/C3 |
| Classify ACNC Social Enterprises | 29% | 31 | wedge-relevant |
| Notion Pipeline Sync | **0%** | 11 | last run 2026-04-22 — abandoned? |

---

## A. Automation / cron health

- **A1 — Triage the failing enrichment agents (S→M, do first).** Pull `error_message` from the
  last failed `agent_runs` per agent above; fix the common cause. Single-digit success across 9
  agents smells like one shared breakage (API key, schema drift, rate-limit). *Wedge: unblocks the
  registry + evidence layer the buyer product sells.*
- **A2 — Decide on `Notion Pipeline Sync` (0%, dead since Apr).** Fix or unschedule — same pattern
  as the `cleanup-rate-limits` job killed 2026-06-08.
- **A3 — Add an enrichment-gap trend check.** Extend `/health` (or a nightly job) to log gap %s
  over time so regressions surface early — same blind-spot fix as the MV-staleness line just added.

## B. Enrichment data (gaps — mostly symptoms of A)

- **B1 — ABN backfill for `gs_entities`.** 250,187 / 598,150 (**42%**) have no ABN. ABN is the join
  key to ACNC / ATO / contracts / donations. `mv_abr_name_lookup` (1.3 GB) already exists — drive a
  name→ABR fuzzy match off it. Highest cross-system leverage.
- **B2 — Sector backfill.** 419,306 (**70%**) no `sector` — the single largest gap. Derive from
  ANZSIC / ACNC purposes / `entity_type`.
- **B3 — Postcode/geo backfill.** 271,182 (**45%**) no `postcode`. Blocks place-based work (funding
  deserts, SEIFA). Source from ABR address / ACNC / contract records.
- **B4 — ORIC corporations under-enriched.** `oric_corporations`: 30.8% description, 44.6% ABN,
  66.5% geo. Indigenous corporations register — *wedge-relevant*. Backfill ABN + geo first.
- **B5 — `political_donations` ABN linkage.** Only 69.5% have a donor ABN → ~95K donations can't be
  tied to an entity. Fuzzy `donor_name` → `gs_entities`.
- **B6 — `austender_contracts` supplier ABN.** 56,459 (**7%**) no `supplier_abn` → can't attribute
  to registry suppliers. Fuzzy `supplier_name` → ABR.

## C. Data cleaning / quality

- **C1 — Dedup the MVs that can't go CONCURRENTLY.** `mv_funding_by_lga` + `mv_funding_deserts` have
  duplicate keys blocking a unique index, forcing slower locking non-concurrent refresh (per
  `refresh_civicgraph_mvs()` comment). Dedup the source queries → faster, lock-free nightly refresh.
- **C2 — `foundations` profile gaps.** 54% no description, 47% no website. Enrich from ACNC / web.
- **C3 — `acnc_charities` website 33% missing.** Backfill.
- **C4 — `austender_contracts` value/title hygiene.** 2,627 rows zero/null value; 0.1% no title.
  Flag + source-check.

---

## 🔴 Root-cause finding (iter 2) — the failures are mostly TIMEOUTS

Two distinct clusters in `agent_runs.errors` (last 5 days):

**Loud (emit a timeout payload):**
- `Refresh Materialized Views` → "Timed out after 600s" (repeating). A *second* MV-refresh path
  (agent orchestrator, 600s wall-clock) hitting the same `mv_abr_name_lookup` slowness the cron fix
  addressed. `statement_timeout=0` on the function helps only if this agent calls it — its own 600s
  cap still kills it. → **A4**.
- `Build Entity Graph` → "Timed out after 3600s" — genuinely long; needs chunking/incremental.
- `Trust Remediation Loop` → DB "statement timeout" — query needs optimisation or a per-connection
  timeout bump.
- `QGIP Expenditure Scraper` → "Timed out after 1800s" (intermittent — succeeds @ 313K items other runs).

**Silent (no error payload):** the lowest-success agents — `Enrich Social Enterprises` (3%),
`Poll Foundation Frontier` (5%), `Enrich Charities` (15%) — fail with `errors=[]/null`, logging
nothing. A 3%-success agent that records no error is the real blocker for the registry product. → **A5**.

New items:
- **A4 — `Refresh Materialized Views` agent: raise the 600s cap or point it at the fixed
  `refresh_civicgraph_mvs()`.** Direct mirror of the 2026-06-08 cron fix.
- **A5 — Instrument the silent-failure agents.** Capture *why* `Enrich Social Enterprises` /
  `Poll Foundation Frontier` / `Enrich Charities` fail (likely swallowed API/LLM errors) before any
  backfill in section B — they're the upstream of those gaps. *Wedge-critical.*

---

## Linkage opportunities (iter 3)

- **L1 — Link 2,424 unlinked political donor ABNs.** Of 10,736 distinct `donor_abn` in
  `political_donations`, 2,424 (**23%**) aren't in `gs_entities` → those donors are off the graph.
  Create/link them → exposes donor→recipient influence paths.
- **L2 — Backfill `justice_funding.gs_entity_id`.** 31,543 / 157,116 (**20%**) rows have no entity
  link → they drop out of every entity-level justice rollup. *Wedge-relevant (youth justice).*
  Match `recipient_abn` / `recipient_name` → `gs_entities`.
- **L3 — ABN-backfill 4,081 ORIC corporations.** ORIC corps that *have* an ABN are 100% linked, but
  4,081 (**55%**) have none → unlinkable. Backfill via ABR (name) or an ORIC-number→ABN crosswalk.
  *Wedge: Indigenous corporations.* (Sharpens **B4**.)
- **L4 (uncertain) — `entity_identifiers` coverage is 2.5%.** Only 15,119 / 598,150 entities have any
  identifier row. May be by-design (alt-IDs only) — confirm whether ACN / ORIC-number / state-registry
  IDs should be populated for cross-system joins before investing.

**Non-findings (logged so the loop won't re-mine):** `ato_tax_transparency.abn` → `gs_entities` =
**100% linked** (26,241 rows, 0 unlinked) — no gap.

---

## Cleaning specifics (iter 4)

- **C1 recipe — `mv_funding_by_lga`.** 2,199 rows but only **489 distinct `lga_code`** (~4.5× inflation),
  and **729 rows have NULL `lga_code`**. Fix: GROUP the source query to one row per LGA; resolve the 729
  null codes from `lga_name`+`state` via `postcode_geo` crosswalk (or aggregate them) → then a unique
  index on `lga_code` unblocks `REFRESH … CONCURRENTLY`.
- **C1 recipe — `mv_funding_deserts`.** 2,196 rows; even `(lga_name, state, remoteness)` yields only
  **1,666 distinct** → ~530 duplicate tuples. Add `DISTINCT`/`GROUP BY (lga_name, state, remoteness)` in
  the source query → unique index → CONCURRENTLY. (MV has no `lga_code` column — add one for a clean key.)
- **C2 refined — foundations: descriptions are the real gap, and ACNC can cross-fill it.**
  10,111 / 11,042 (**92%**) have no description, 5,218 (47%) no website — and **5,216 of those 5,218
  no-website rows have an `acnc_abn`**, so cross-fill from `acnc_charities` first (one join, not 5K
  web-scrapes). NB: this 92% contradicts `mv_data_quality`'s 45.6% — that MV is 38d stale; trust the
  direct count and treat stale `mv_data_quality` as another reason to land the MV-refresh fix.
- **(non-finding)** `gs_entities.canonical_name` is clean — 2 empty, 21 numeric-only, 9 ≤2-char out of
  598,150. No cleanup warranted.

---

## Automation freshness (iter 5) — low yield, confirms the iter-2 diagnosis

The **scheduler itself is healthy**: 90 schedules, 86 enabled, **0 never-run**, only **8 mildly
overdue** (all ~1.0–1.4× their interval). The overdue set — `enrich-charities`,
`build-foundation-profiles`, `discover-foundation-programs`, `poll-source-frontier` — is the *same*
failing-agent cluster from iter 1. So the lateness is a **symptom of execution failure, not a
scheduling gap** → reinforces **A1/A5**, no net-new action. **Net-new ideas this iter: 0.**

---

**Loop status: PARKED.** Facets [gaps · quality · agent-health · failure-root-cause · linkage ·
cleaning · automation-freshness] are mined out for the *current* DB state — iter 5 was low-yield, so
tight-looping stopped. Backlog ≈ 23 ideas. Next genuinely-new state arrives with the VIC crawl finish
(~tonight) + the 17:00 UTC MV refresh. The loop re-mines after a cheap gate-check confirms that state
changed; otherwise it re-parks. Exit = Ben interrupts.

<!-- LOOP STATE: PARKED after iter 5 (low-yield). Resume trigger = crawl finished OR mv_refresh_log shows
     a 2026-06-08 success. On wake: gate-check those two; if unchanged, re-park (~3600s); if changed,
     re-mine fresh facets and append iter 6+. -->



