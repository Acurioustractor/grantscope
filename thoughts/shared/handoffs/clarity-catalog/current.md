---
date: 2026-08-15T05:30:00Z
session_name: clarity-catalog
branch: main
status: active
---

# Work Stream: clarity-catalog

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-15T05:30:00Z
**Goal:** `/clarity` slice 2 — the question board. Done when the surface leads with cross-sections this database can answer that no public Australian source can, each carrying its coverage and caveat.
**Branch:** `main` — **zero open PRs**, board clear
**Test:** `cd apps/web && npx tsc --noEmit` · gates: `node --env-file=.env scripts/check-graph-{completeness,referential-integrity,attribution}.mjs`

### Now
[->] **Slice 2: the question board.** The job verification that blocked it is done — jobs 4 and 11 are proven, see below. Nothing else is in the way.

### This Session
- [x] Mapped the whole shared DB — 1,024 relations, 52.3M rows. `thoughts/shared/data-map/`
- [x] Rebuilt the justice graph layer: 857,798 edges → 144,901, resolution 16.9% → **100%**
- [x] Built the GrantConnect layer: 291,264 awards had **zero** edges → 189,590 at 100%
- [x] Merged 141 shadow entities, 333,960 edges consolidated, 0 orphaned FKs
- [x] Three graph gates built + registered: completeness, referential-integrity, **attribution**
- [x] Shipped `/clarity` slice 1, merged as PR #199 (`d6c8081`)
- [x] Scheduled `clarity_refresh()` nightly — pg_cron job 11, 18:00 UTC
- [x] Enabled tiered matview cron — job 4 → `CALL ...('nightly')`, job 13 weekly (PR #200, merged `0bff05e`)
- [x] Audited all 398 anon-readable objects; found and closed a **bank-statement leak** (PR #201, merged `2297ed3`)
- [x] **Proved job 4 by direct test** — `CALL refresh_civicgraph_mvs_run('nightly')`, 12m24s, **50/50 success, 0 fallbacks**, 38 concurrent / 12 plain. Slowest `mv_entity_power_index` at 368s (looks like a stall; it is not).
- [x] **Proved job 11 by direct test** — full refresh, `refreshed_at` advanced, 1,039 relations reproduced exactly.
- [x] Found + closed a grant defect the catalog surfaced on itself (PR #202, merged `9e3c467`) — see Decisions.

### Next
- [ ] **Slice 2: the question board.** Ten-working-day guard from slice 1 (shipped 15 Aug)
- [ ] Job 13 (weekly tier, Sundays 15:00 UTC) has **never run** and is unexercised. Also unchecked: where the four matviews that logged `success-fallback` under the old code now sit — if they are in the weekly tier, job 13 inherits a known-flaky set unwatched. They were `mv_grant_contract_overlap`, `mv_indigenous_procurement_score`, `mv_lga_indigenous_proxy_score`, `mv_abr_name_lookup`.
- [ ] Deferred, all diagnosed and written up: 19 unwatched edge layers · runbook steps 3 (donor sink, 47,563 misattributed edges) and 5 (opportunity self-loops)

### Decisions
- Headline is **1,039 relations**, not 1,455; 416 routines get their own segment. They will never carry a domain, so counting them strands 29% of the list as undescribed. (#193)
- Coverage denominator is relations → **78%**, not 56% against everything.
- ACT excluded by default, count permanently on screen, **neutral not yellow** — a scope boundary, not a warning.
- Freshness has **four states that never collapse**: a date (687), `+` blue = our missing timestamp column (294, an afternoon's work), `?` yellow = too large to probe (58, needs a rebuild), `—` n/a (416). (#195)
- Admin-gated. Not deference to the April kill — the catalog enumerates which objects are anon-readable, i.e. our own attack surface. (#196)
- Ranked by default (`clarity_object.importance`), sort controls first-class. Segments kept but **ALL is the default** — opening behind SOURCES hid 60% on arrival.
- `/api/data/schema-graph` superseded now, deleted after slice 5. Zero consumers were *found*, not proven.
- `catalog_object_scope` is authoritative for `act_business`, bidirectionally. The old name-prefix regex missed 215 ACT objects and could never un-flag a false positive.
- **A new function gets its ACL set in the same migration that creates it.** `clarity_apply_act_flag` was created without one and kept PostgreSQL's default of `EXECUTE` to `PUBLIC`, while its four siblings were each explicitly restricted. Impact was contained (`SECURITY INVOKER`; anon holds no grants on `clarity_object`, so a call dies on first write) but it was one `SECURITY DEFINER` away from live. (#202)

### Open Questions
- RESOLVED 15 Aug: jobs 4 and 11 both **proven by direct test**, not by an overnight run. Job 4's per-matview `COMMIT` is real — rows were readable from a second connection mid-run, with distinct `started_at` and non-zero `duration_ms`. The frozen-`now()` bug is gone and **PR #200's rollback trigger will not fire**. Neither job has still ever fired *via pg_cron itself*; first unattended runs are 17:00 and 18:00 UTC on 15 Aug.
- UNCONFIRMED: is `/clarity` actually reachable in the deployed app? Vercel deploys on merge but the page has never been opened by a human.
- UNCONFIRMED: `gs_relationships` read 2,943,598 at one point vs 2,904,091 after the merge — ~39.5K higher. Probably a scheduled ingest; not verified.
- OPEN, Ben's call: `person_roles` aggregates 334,152 individually-public ACNC records into one anon-readable endpoint. Each is public by law; the aggregate is a different artifact. Not a defect — a decision.

### Workflow State
pattern: wayfinder map (issue #190, 8/8 tickets closed)
phase: slice 1 complete
total_phases: 7 slices
retries: 0
max_retries: 3

#### Resolved
- goal: "slice 1 shipped and live" — done
- resource_allocation: balanced

#### Unknowns
- job_4_and_11_health: **RESOLVED** — both proven by direct test 15 Aug
- job_13_weekly_tier: UNKNOWN — never run, never exercised by hand

#### Last Failure
(none)

---

## Context

### Where things live
- **The map**: `thoughts/shared/data-map/README.md` → then `VERIFICATION.md` (68 claims checked, 3 blockers found). Never act on `CANONICAL-DATA-MAP.md` without it.
- **Slice 2 source material**: `thoughts/shared/data-map/clarity/OPPORTUNITY-MAP.md` — 16 cross-sections, **9 already run for real** with numbers. Plus `BAR-CHECK.md` and `BAR-CHECK-CLOSURE.md`.
- **The spec**: `thoughts/shared/data-map/clarity/CLARITY-SPEC.md` (1,816 lines). Its scope corrections are in the closure doc.
- **The code**: `apps/web/src/app/clarity/` — 4 files, one client island.

### Hard-won facts that will save a session
- **The pooler drops long connections.** One operation per psql invocation; TCP keepalives (`?keepalives=1&keepalives_idle=20&...`) on anything over ~5 min. A chained psql call reports the **echo's** exit code, so a failure looks like success. There is no direct non-pooler host.
- **`pg_stat_user_tables.n_live_tup` is broken here** — reports 0 for a 2.5M-row table.
- **`LIMIT n` without `ORDER BY` is not a sample.** Two 20,000-row "samples" of the same dataset gave 0% and 34.2%; the exact answer was 16.9%.
- **Use `getDirectServiceSupabase()`**, never `getServiceSupabase()` — the latter sniffs the call stack for `/app/reports/` and returns a stub resolving every query to null.
- **PostgREST caps a page at 1,000 rows.** The catalog is 1,455. Without explicit pagination a ledger renders complete and is missing a third.
- **Read the producer before diagnosing the product.** Six confident readings were wrong this session; every one died within two minutes of opening the code that generated the number. Two would have caused damage.
- **Empty ≠ unused.** No drop verdict without grepping both `src` trees AND `pg_proc.prosrc`.
- **A merge rule keyed on identifier presence must also consider entity KIND.** The shadow merge nearly merged 1,209 people into companies and would have broken two derivations that resolve entities by name.
- **Table-level RLS auditing cannot see definer views.** That is how 1,618 bank transactions stayed public through a sweep that closed 48 policies. The re-audit query is in `migrations/2026-08-15-close-bank-statement-view-leak.sql` — run it after adding any view.

### The bar slice 2 has to clear
`BAR-CHECK.md`'s verdict on slice 1, and it still stands:

> Nothing on any screen answers a question about the world today; every screen audits our estate. There is no reason to open this on a Tuesday when nothing is broken.

Slice 2 is the fix. It is the half that makes `/clarity` Ben's rather than a competent data catalog anyone could buy.
