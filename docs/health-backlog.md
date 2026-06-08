# Project Health Backlog

> Generated + maintained by the **project-health loop** (self-paced). Each iteration mines a
> facet of system state (enrichment gaps · data cleaning · automation/cron health), grounds
> ideas in real queries, and **appends only new, deduped** items. Numbers are point-in-time —
> re-verify before acting. Exit condition for the loop = Ben's interruption, not "when done".

**Last iteration:** 2026-06-08 (iter 6 — VIC crawl landed · fresh supplier data)
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
- **C5 — `state` contradicts `lga_code` (border-LGA mislabels) [✅ DONE 2026-06-09].** Shipped via migration
  `20260609030000`: corrected **6,949 `gs_entities`** + **130 `postcode_geo`** rows from `lga_code` in lockstep
  (also normalised case-variants like "Qld"→"QLD"); refreshed all **38 MVs** (0 failures). Verified: 0
  remaining contradictions (codes 1-8); Laverton consolidated to 1 WA row / 101 entities (NT phantom gone);
  funding-deserts has 0 blank-state rows; OP6 reconciles (665 = 665). *Residual:* ~66 case-variant rows with no
  `lga_code` can't be derived (negligible); 313K entities still have no `lga_code` at all (unrelated — see B3).
  Original scope below. The ABS
  `lga_code` first digit is the authoritative state (1 NSW · 2 VIC · 3 QLD · 4 SA · 5 WA · 6 TAS ·
  7 NT · 8 ACT) and is 99.97% populated, but the `state` column disagrees for a band of border LGAs:
  **`postcode_geo` 130 rows** (e.g. Laverton coded NT but lga_code 54970 = WA; Albury VIC→NSW;
  Goondiwindi NSW→QLD) and **`gs_entities` ~4,556 wrong + 2,393 null** (of the 285K with a usable code;
  313K entities have no `lga_code` and can't be derived — leave as-is). *Partial fix already shipped:*
  migration `20260609020000` backfilled the 1,071 `postcode_geo` **nulls** (fixed the 227 funding-desert
  "Unknown" LGAs); the **contradictions** were deliberately deferred here. **Why it needs care, not a
  one-liner:** `mv_funding_deserts` FULL JOINs the disadvantage side (`postcode_geo`) to the power side
  (`mv_entity_power_index` ← `gs_entities.state`) on `(lga_name, state)` — correcting one side alone
  *creates* phantom split rows (a "Laverton WA / 0 entities" ghost beside the real "Laverton NT / 85").
  **Recipe:** UPDATE both `gs_entities.state` and `postcode_geo.state` from `LEFT(lga_code,1)` in lockstep
  (WHERE `lga_code ~ '^[1-8]'` AND state null/empty OR ≠ derived), then refresh `mv_entity_power_index`
  + downstream (`mv_funding_deserts`, `mv_funding_by_postcode`, `mv_funding_by_lga`, and the power/
  revolving-door/board MVs that read entity state). **Blast radius:** `gs_entities.state` feeds state
  filters, dashboards, OP1/OP3 supplier shortlists, and the central power index — app-wide; verify
  state-keyed counts before/after and spot-check the named border LGAs. **Tier 2-3, Ben's explicit go
  on the run.** Cross-ref **C1** (adding `lga_code` to `mv_funding_deserts` and keying on it instead of
  `(lga_name, state)` would structurally eliminate the split — the deeper fix).

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

## VIC crawl landed (iter 6) — fresh supplier data

The VIC contract crawl **finished cleanly** (4,891 `vic-` rows; 4,686 upserted this run, 205 skipped,
3 failed; 3,980 with ABN). New facet from the fresh data:

- **L5 — Ingest/link 1,116 new VIC suppliers.** Of 2,353 distinct supplier ABNs in `vic-` contracts,
  **1,116 (47%) are not in `gs_entities`** — entities the VIC crawl surfaced that aren't in the graph.
  Create/link them (mirrors L1/L6) → VIC procurement becomes queryable at entity level. *Wedge: feeds
  `scout-se-buyers`.*

**Downstream — Ben's call (Tier 2 prod writes, not the loop):** the ledger's gated next-actions are now
unblocked — refresh the evidence MVs (tonight's 17:00 UTC cron does it automatically now the timeout is
fixed, or trigger manually) + re-run `scout-se-buyers` against the new VIC suppliers.

---

## 🟢 Agent-fleet root causes found + fixed (2026-06-09)

Triaged the failing-agent cluster (A1) live against `agent_runs` + the pm2 `orchestrator` (id 133).
**The "3% success / silent failure" signal was NOT one bug — it was three, two of them environmental,
not agent-code:**

1. **`spawn psql ENOENT` (A1 root cause — FIXED + PROVEN + PUSHED).** The pm2 orchestrator spawned every
   agent (`execFile`) with pm2's minimal PATH, which omits Homebrew, so all agents that shell out to `psql`
   (Trust Remediation Loop, Refresh Materialized Views, Youth Justice source chain, the `execSync('psql')`
   backfill/build agents) died with `spawnSync psql ENOENT`. **Fix:** added a `PATH` env (Homebrew + base)
   to the orchestrator in `ecosystem.config.js` (commit `d7a2aaa`), `pm2 restart … --update-env` + `pm2 save`.
   **Proven:** queued a Trust Remediation task — it ran **>220s past the old 8.6s→ENOENT death point** with
   zero ENOENT in logs. `pm2 jlist` confirms the orchestrator env now carries the psql dir.

2. **PostgREST schema-cache error blocked the executor (the dominant *current* blocker — CLEARED).** The
   orchestrator's `claim_next_task` RPC was failing with *"Could not query the database for the schema
   cache. Retrying."* → it couldn't claim **any** pending task, so the whole fleet stalled. Shaken loose by
   this session's DDL migrations + 38-MV refresh (PostgREST reloads its cache on schema changes). **Cleared
   with `NOTIFY pgrst, 'reload schema';`** — executor immediately resumed claiming + running tasks. *If it
   recurs after heavy DDL/refresh, the same NOTIFY (or a Supabase schema reload) fixes it; consider issuing
   it automatically at the end of the nightly MV-refresh job.*

3. **`agent_tasks_priority_check` violations (FIXED).** CHECK is `priority BETWEEN 1 AND 10`; the only
   offender was the `watch-outcomes-changes` schedule at **priority 50**, so every 5-min scheduler tick
   failed to create its task. **Fix:** clamped to 10 (migration `20260609050000`).

- **A5 — runs don't terminalize (stuck `running`) — ROOT CAUSE FOUND, fix scoped, NOT yet built.** On
  orchestrator restart, `shutdown()` kills active child agents but they never call `logComplete`/`logFailed`,
  so their `agent_runs` rows are orphaned in `status='running'` forever (and read as non-success on the
  dashboard — this is the real source of the "0ms / silent" signal, *not* an LLM/API failure as iter-2
  guessed). The wedge-critical enrich agents (Enrich SE/Charities) actually **run clean standalone**.
  **Fix (orchestrator code):** add a reaper — on startup and on a periodic tick, mark `agent_runs` that are
  `running` with `started_at` older than a sane timeout (and no live child) → `failed` ("orphaned by
  restart/timeout"). Then re-measure true agent success rates (likely far higher than the iter-1 3%).
  *Net: agents now **run** (psql + executor fixed); they don't yet cleanly **close their run log**.*

---

**Loop status: PARKED again.** Crawl facet mined (iter 6); backlog ≈ 24 ideas. Next genuinely-new state =
the **17:00 UTC MV refresh** (~18h) — which should also clear the `mv_data_quality` staleness and, if C1
ships, the dedup MVs. Re-mines on next gate-check if `mv_refresh_log` shows a 2026-06-08 success.
Exit = Ben interrupts.

<!-- LOOP STATE: PARKED after iter 6. Crawl DONE (no longer a trigger). Resume trigger = mv_refresh_log
     shows a 2026-06-08 success. On wake: gate-check that one; if unchanged, re-park (~3600s); if changed,
     re-mine MV-driven facets and append iter 7+. -->



