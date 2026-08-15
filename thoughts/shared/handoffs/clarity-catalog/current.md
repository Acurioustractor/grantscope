---
date: 2026-08-15T05:10:00Z
session_name: clarity-catalog
branch: close-bank-view-leak
status: active
---

# Work Stream: clarity-catalog

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-15T05:10:00Z
**Goal:** `/clarity` slice 2 — the question board. Done when the surface leads with cross-sections this database can answer that no public Australian source can, each carrying its coverage and caveat.
**Branch:** `close-bank-view-leak` (slice 1 already merged to main via #199)
**Test:** `cd apps/web && npx tsc --noEmit` · gates: `node --env-file=.env scripts/check-graph-{completeness,referential-integrity,attribution}.mjs`

### Now
[->] **Before any new work: verify the two scheduled jobs survived their first night.** They have never run unattended.

### This Session
- [x] Mapped the whole shared DB — 1,024 relations, 52.3M rows. `thoughts/shared/data-map/`
- [x] Rebuilt the justice graph layer: 857,798 edges → 144,901, resolution 16.9% → **100%**
- [x] Built the GrantConnect layer: 291,264 awards had **zero** edges → 189,590 at 100%
- [x] Merged 141 shadow entities, 333,960 edges consolidated, 0 orphaned FKs
- [x] Three graph gates built + registered: completeness, referential-integrity, **attribution**
- [x] Shipped `/clarity` slice 1, merged as PR #199 (`d6c8081`)
- [x] Scheduled `clarity_refresh()` nightly — pg_cron job 11, 18:00 UTC
- [x] Enabled tiered matview cron — job 4 → `CALL ...('nightly')`, job 13 weekly (PR #200, open)
- [x] Audited all 398 anon-readable objects; found and closed a **bank-statement leak** (PR #201, open)

### Next
- [ ] Verify job 4 (17:00) and job 11 (18:00) ran clean — **do this first**
- [ ] Merge PR #200 (matview cron) once the 17:00 run proves out
- [ ] Merge PR #201 (bank leak) — already applied to prod, just recording it
- [ ] **Slice 2: the question board.** Ten-working-day guard from slice 1 (shipped 15 Aug)
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

### Open Questions
- UNCONFIRMED: **did jobs 4 and 11 run correctly overnight?** Check `mv_refresh_log` for `triggered_by='pg_cron:nightly'` — **durations must be non-zero and `started_at` must differ per row**. Every pg_cron row before 15 Aug had `duration_ms = 0` because `now()` is frozen per transaction. If zeros return, the per-matview COMMIT is not happening → roll back PR #200 (rollback is in the migration header).
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
- overnight_job_health: UNKNOWN until the 17:00/18:00 runs are checked

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
