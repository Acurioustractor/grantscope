---
date: 2026-06-18T00:00:00+10:00
session_name: agent-health-resilience
branch: main
status: active
---

# Work Stream: entity-graph data health (was: agent-health-resilience)

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-18 (later) — **BRIDGE WRITE-PATH REWRITE DONE (live, uncommitted on `main`).** Both bridges converted to set-based psql `INSERT…SELECT … ON CONFLICT (dedup-expr) DO NOTHING`, sharing the SoT. **justice +81,493 edges (56,630→138,123), gate now OK; person +329,896 edges (5,086→334,982), 333,836 person_roles backfilled.** Graph: **~605,900 entities · 2,370,061 edges** (+411,389 this run). NOT yet committed/PR'd — awaiting Ben's go. Earlier this session: **#86/#87/#88** all merged.
**Goal:** Make the CivicGraph relationship graph correct, fast, and self-monitoring. Diagnose by REPRODUCTION (never assumption); every fix validated live before claiming done.
**Branch:** `main` at `ee617a4`. **No open PRs** (#86/#87/#88 all squash-merged, branches deleted). CI green throughout.
**Test:** `node --check scripts/build-entity-graph.mjs` · dry-run a phase (`--phase=X --dry-run`) · `node --env-file=.env scripts/check-graph-completeness.mjs` (the gate) · reproduce/validate live before claiming done.

### Now — DONE this session (live, uncommitted). Next: commit + PR (Ben's go).
[x] **Converted both bridge agents' WRITE paths to set-based psql** — re-runnable, additive, recovered the dropped edges. Files changed (uncommitted on `main`):
- **`scripts/lib/graph-edge-datasets.mjs`** — added `justice_funding` dataset entry (read-only `jf_prog_map` prelude + canonical edge SELECT) and two write-side exports: `JUSTICE_PROGRAM_ENSURE_SQL` (creates missing `program` entities) + `JUSTICE_BUILD_GUARD` (`NOT EXISTS` additive guard, write-only).
- **`scripts/build-entity-graph.mjs`** — new `--phase=justice` (program-ensure → guarded set-based edge insert). Included in `all`.
- **`scripts/bridge-justice-to-graph.mjs`** — rewritten as a thin set-based psql agent sharing the SoT. `--dry-run` counts; live = program-ensure + guarded `INSERT…ON CONFLICT DO NOTHING`. (Old REST `.upsert` couldn't match the COALESCE-expr index → 0 written: the [[feedback_postgrest_partial_index_upsert]] mode.)
- **`scripts/bridge-person-roles.mjs`** — rewritten set-based, 3 steps (person entities → edges → `person_roles` backfill), all `ON CONFLICT DO NOTHING` / idempotent UPDATE. `--apply` to write.
- **Why the justice guard:** the program-node layer is historically split (old `GS-PROG-<slug60>-<state>` + new `<slug80>-<md5x4>-<state>` + slug collisions); 55,811 of 56,630 existing edges sit on OLD-format nodes, so NO clean (name,state)→node map matches them all. The `NOT EXISTS (payment already edged)` guard makes the WRITE touch only un-edged payments → 0 new dups, fully re-runnable. The gate measures the FULL derivation (bare selectSql); only the write appends the guard. Person needs no guard (single gs_id format → gs_id join lands on the existing nodes; `ON CONFLICT` dedups the 5,086).
- **Results (live):** justice +81,493 (gate justice now **138,055 exp / 138,123 act / OK**); person +329,896 (dir 113,419 + member_of 221,563), 333,836 backfilled, 87 residual unlinked (empty-slug/unmatched-ABN). Total edges 2,370,061.
- **Gate coverage:** justice_funding now watched (was on the gap list). Person NOT gated (would need 2 entries dir+member_of — follow-up). grant_opportunities/foundations still STALE (pre-existing legacy; separate clean-rebuild).

### Context for that task (verified this session)
- Only dedup index: `idx_gs_rel_dedup UNIQUE (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id,''::text))`. `gs_relationships_pkey` on `id`.
- justice agent program-entity creation DID work (2046 created); only the relationship write is broken.
- `bridge-justice-to-graph` runs LIVE by default (`--dry-run` to suppress); `bridge-person-roles` needs `--apply`.

**[history] Re-run surfaced a DEEPER write bug (the `.order()` fix is necessary-not-sufficient):** ran `bridge-justice-to-graph` live → **0 relationships created, 99,999 errors**, "no unique constraint matching ON CONFLICT". Root cause: PostgREST `.upsert({onConflict:'…,source_record_id'})` can't match the only dedup index `idx_gs_rel_dedup` which is on the EXPRESSION `COALESCE(source_record_id,'')` (the [[feedback_postgrest_partial_index_upsert]] failure mode). No data harmed (count still 56,630). `bridge-person-roles` has an analogous problem — plain `.insert()` (no onConflict) fails whole batches on existing-edge unique violations, so it can't cleanly re-run either (NOT run, deliberately). **Real fix = convert both write paths to set-based psql `INSERT…SELECT … ON CONFLICT (…COALESCE(source_record_id,'')…) DO NOTHING`** (the build-entity-graph pattern) — would recover ~20K justice + ~? person edges AND make both agents re-runnable. Natural to fold justice_funding into `graph-edge-datasets.mjs` + the gate at the same time. PR #88's `.order()` fixes still correct + mergeable (prerequisite for any recovery), just don't recover edges alone.

**Gate coverage gap (noted):** the completeness gate watches only the 4 build-entity-graph datasets (~1.44M of ~2.0M edges). The ~25 agent-built datasets (directorship 322K, shared_director 95K, justice grants 56K, the other grant/* + lobbies_for/member_of/affiliated_with) are NOT watched. Extending the gate to set-based-expressible ones (e.g. justice_funding) is a roadmap follow-up.

### Earlier today
[->] **PR #87 MERGED** (squash `a90dfa6`) — completeness gate live + scheduled. The gate's first run flagged grant_opportunities (+1,122) & foundations (+20) as STALE (over-built legacy rows) and donations/austender as sub-threshold over-built (+30K/+31K) → roadmap Phase 1 **clean-rebuild per dataset** is the natural next data op. Also: audit other relationship agents (#3) for the 1000-cap class; build the `/health` UI surface (roadmap Phase 2 #3 — gate already emits `--json`).

### Completeness gate (BUILT 2026-06-18, branch `feat/graph-completeness-gate`)
- **`scripts/lib/graph-edge-datasets.mjs`** — single source of truth for the 4 edge SELECTs; imported by BOTH `build-entity-graph` (inserts) and the check (counts) → expected can't drift from actual. Build's 4 phase fns are now thin wrappers; validated by per-phase `--dry-run` (SQL semantically identical, only key-col aliases added).
- **`scripts/check-graph-completeness.mjs`** — per dataset: EXPECTED (distinct edge-keys over the build SELECT) vs ACTUAL (`gs_relationships`). `expected>actual`→ALERT (under-built, exit 1); `actual>expected`→STALE (exit 0). Flags: `--threshold=` (default 0.05), `--json` (for /health).
- **migration `…_gs_graph_completeness_log.sql`** — trend table (the roadmap's "coverage trend") + `service_role` grant + nightly `agent_schedules` row. All idempotent. Registered in agent-registry (`check-graph-completeness`, deps `build-entity-graph`).
- **First live run** (±5%): donations 713,348/743,594 OK · austender 658,940/689,921 OK · grants 5,291/6,413 STALE · foundations 18/38 STALE · 0 ALERTs. Rows persisted.

### This Session (2026-06-18 late — PR #86)
- [x] **#86 OPEN (`41d8b6f`+`110c690`)** — paginate Phase 1d (gov bodies), 1e (suppliers), 1i (ASX). Unpaginated PostgREST reads → set-based `DISTINCT` via psql, parsed delimiter-safe through `row_to_json` + new `selectJsonRows` helper. **1e saw only ~1000 of 60,017 distinct supplier ABNs.** Also filtered 1e + the contracts join (kept in sync) to valid 11-digit ABNs (12 garbage values like `#N/A`/`Exempt-*` were collapsing 100s of suppliers into fake hubs `AU-ABN-#N/A` et al.).
- [x] **selectJsonRows SET-tag crash found+fixed (`110c690`)** — `runDml` prepends `SET statement_timeout=0;` so psql echoes a `SET` line; `JSON.parse('SET')` threw fatal on the first call. Filter to `{`-prefixed lines. Routed 1f through the same hardened helper → also kills #85's latent bug minting a junk "SET" political_party (deleted the orphan: `DELETE 1`).
- [x] **1i finding:** all 2,013 `asx_companies.abn` are NULL → 1i creates 0 entities regardless of pagination (separate upstream data gap; now logged explicitly).
- [x] **Backfill run live** — entities phase (18min) created the missing suppliers (austender entities 55,638→57,408; **supplier ABN coverage 59,958/60,017**). Contracts re-run set-based, clean: **+4,385 edges** (685,536→689,921). Impact modest because most supplier ABNs already had entities via ACNC/ATO/ORIC (same `AU-ABN-*` gs_id); only ~1,770 were austender-only.
- [x] **MV refresh** re-running live (`b6la5297f`).
- [!] **Transient flake during entities run:** 1000 row writes failed with `TypeError: terminated` (shared-pooler saturation, NOT a code bug — see memory). Landed mostly in the JusticeHub phase (ran last) + 59 suppliers. Idempotent → recovered on any future `--phase=entities` run. NOT blocking.

### Prior Session (2026-06-18 earlier)
- [x] **#83 MERGED (`38f9bd8`)** — set-based rewrite of all 4 relationship phases (donations/contracts/grants/links). One server-side `INSERT…SELECT … ON CONFLICT DO NOTHING` each via psql; in-memory `loadEntityIndex` removed entirely. ~40× faster end-to-end (donations 63s vs ~45min). Validated phase-by-phase diff-to-zero. Recovered **+578,799** index-dropped edges live (donations +159,659, contracts +418,876, grants +257, links +7).
- [x] **#84 MERGED** — `docs/strategy/data-health-roadmap.md` (5 phases; completeness gate = centerpiece).
- [x] **#85 MERGED** — Phase 1f party creation read was unpaginated → PostgREST 1000-cap → only 66 of 2,437 parties. Set-based `SELECT DISTINCT` fix. Live: parties **66→2,438**, donation edges **368,365→743,594** (re-ran donations after).
- [x] **MVs refreshed twice** — 38/38, 0 failed; final refresh (21.6 min) reflects the doubled donations + deduped contracts.
- [x] **#1 contract dedup DONE (data op, no PR)** — removed 702,189 legacy dual-key dupes + stale rows; **preserved 29,193** would-be-lost contracts (safe set only). Contracts **1,387,725→685,536**. No recurrence (current code keys on `ocid`).

### Next
- [x] ~~Fix Phase 1d/1e/1i unpaginated reads~~ → **PR #86**, backfilled live.
- [x] ~~Merge PR #86~~ → squash-merged `94a66a8`, CI green, branch deleted.
- [ ] **Build the completeness gate** (roadmap Phase 2): nightly expected-vs-actual edge count per dataset, alert on drift. Would have caught all of #82/#83/#85/#86/#1 the morning after. **← now the top durable item.**
- [ ] **#3 audit** other relationship agents (directorship 329K, shared_director 95K, grant 94K) for the same 1000-cap read class.
- [ ] **ASX ABN data gap** — populate `asx_companies.abn` (all 2,013 NULL) upstream so Phase 1i actually creates entities. Separate ingest fix.
- [ ] **Mop-up (low pri):** re-run `--phase=entities` once to recover the 1000 transient-failed rows + 59 missing suppliers (idempotent). Tonight's manual run or any future build clears it.

### Decisions
- **Additive-only writes** for the rewrite (Ben, 2026-06-17): recover dropped links, leave legacy rows; clean rebuild only as a deliberate separate step.
- **#1 contract cleanup = safe delete** (Ben, 2026-06-18): delete only proven dupes+stale, preserve the 29,193 net-loss rows.
- **Large DELETEs:** precompute doomed IDs into an indexed TEMP table set-based, then delete-by-pkey. Per-row `EXISTS` in a big DELETE = pathological (killed a 22-min runaway). Even safe, 702K×13-index deletes = ~21min IO on the throttled shared instance.

### Open Questions
- UNCONFIRMED: exact count the 29,193 shrinks to after Phase 1d/1e fix + contract re-run (expected to drop substantially, not necessarily to 0).
- UNCONFIRMED: whether the frontend actually surfaces the now-complete graph + refreshed MVs (no app audit done — likely the biggest user-visible win; roadmap Phase 4 / a `/leverage` pass).

### Workflow State
pattern: diagnose-fix-validate-ship
phase: 6
total_phases: 8
retries: 0
max_retries: 3

#### Resolved
- goal: "make the entity graph correct, fast, self-monitoring; fix donation/contract data at source"
- resource_allocation: balanced

#### Unknowns
- frontend_surfaces_the_data: UNKNOWN (no app audit)

#### Last Failure
(none — last destructive op, the contract dedup, completed clean: DELETE 702189, 29193 preserved)

---

## Context

### Key facts for resume
- **Supabase:** SELECT via `node --env-file=.env scripts/gsql.mjs "..."`; DML/heavy via direct psql (`PGPASSWORD=$DATABASE_PASSWORD psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f file.sql`). `exec_sql` RPC is SELECT-only. Shared pooler intermittently saturates.
- **Set-based phase helper:** `buildRelationshipsSetBased(label, cols, selectSql, prelude)` in `scripts/build-entity-graph.mjs` — shells to psql via `resolveBin`+`withRetry` (`scripts/lib/agent-resilience.mjs`); `ON CONFLICT (dedup index expr) DO NOTHING`. Prelude pre-materialises+indexes lookup tables (donor_map) so joins are index scans, not nested-loop-over-Materialize (~4B-op runaway otherwise).
- **The recurring bug class:** silent read truncation — unpaginated REST `.select()` (PostgREST 1000-row cap) OR `.range()` without stable `.order()`. Caused #82 (entity index), #85 (66 parties), and the 29,193 unresolved contracts (Phase 1d/1e). The completeness gate is the durable fix.
- **Memory:** `project_build_entity_graph_setbased` (full detail, corrected findings), `feedback_data_quality_before_scoring`.
- **Roadmap:** `docs/strategy/data-health-roadmap.md`.

### Prior sessions (history — see git/PRs/memory for detail)
- 2026-06-17: #80 (build-entity-graph resilience + JusticeHub N+1), #81 (Vercel 45-min deploy hang), #82 (`loadEntityIndex` `.order('id')` — found the ⅓ drop). #76–#79 (shared `agent-resilience.mjs`, withRetry on logStart/Complete/Failed, trust-remediation unify, null-run_id snapshot fix).
- 2026-06-16: #71–#75 (scraper-hang timeouts, enrich-se status accounting, YJ tracker pooler-retry, trust-remediation psql-PATH, Poll-Frontier 403 auto-disable).
- DEFERRED: Notion sync (#71) re-enable needs per-run cap (full run = 1,480-page dump); agent is `enabled=false`.
