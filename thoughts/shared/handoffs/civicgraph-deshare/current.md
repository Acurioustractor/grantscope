---
date: 2026-06-21T07:50:00Z
session_name: civicgraph-deshare
branch: feat/goods-registry-entity-resolution
status: active
---

# Work Stream: civicgraph-deshare

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-21T07:50:00Z
**Goal:** Relieve the chronic saturation of the shared "Empathy Ledger" Supabase box by giving CivicGraph (grantscope) its own dedicated DB and turning it into an explicit shared service. Done when the heavy grantscope estate + batch workload is off the shared box and all 5 consumer apps still work.
**Branch:** feat/goods-registry-entity-resolution (shared with a PARALLEL power-map session — do NOT rewrite history / force-push)
**Test:** cd apps/web && npx tsc --noEmit

### Now
[x] **Medium compute APPLIED + VERIFIED (2026-06-21):** `max_connections=120` (was 90), `shared_buffers=1GB`, `effective_cache_size=3GB` — all confirm Medium. Box at **29/120 conns (24%)**, `idle_in_transaction=0` (no leak), heavy reads <700ms, zero 522s/timeouts. **The fire is out — full de-share is now a CALM later project, not urgent.**
[x] **Ben decided (2026-06-21):** (a) build act-global's CivicGraph client now — **DONE, committed `0df8d35`**; (b) justice_funding/alma ownership = **PARKED** (Medium bought time; decide deliberately later — do NOT touch JusticeHub).
[->] **Next concrete step is a calm one** — no urgent action. Remaining decoupling/de-share work is now optional + staged (see Next). Fire is out.

### This Session
- [x] Code-reviewed the goods branch (9-angle workflow): no blocking bugs. Applied + committed the one latent finding — `aade461` PowerChip surfaces RD flag at systemCount 0.
- [x] Goods registry migration applied by Ben (`UPDATE 25`, registry 92→117).
- [x] **PR #100 opened** against main (goods registry + the parallel session's power-leaderboard commit 412cbb2 — Ben chose one bundled PR; disjoint files).
- [x] Diagnosed DB saturation = chronic multi-tenant burst (NOT a leak). Box flapped recover↔saturate ~5× this session; even broke the Supabase console's own metrics gauge (showed 0.00 GB).
- [x] Proved data intact: real DB = **24 GB**; gs_entities **608,367**, gs_relationships **2,463,244**, austender_contracts **844,845** (grown well past CLAUDE.md's 159K/1.08M).
- [x] Wrote 3 plan docs in `thoughts/shared/plans/`: `grantscope-deshare-to-barkly.md`, `crossapp-db-dependency-map.md`, `civicgraph-decoupling-matrix.md`.

### Next
- [x] Medium compute applied + VERIFIED (max_conn 120, 29/120, no flapping). Fire out.
- [x] **act-global CivicGraph client MERGED to main** — **PR #202 MERGED 2026-06-21T20:42Z** (squash `30189ea`). Single clean commit `f23c4e8`; repo CI green (Type Check & Lint ✅, Schema Contract ✅, Vercel ✅). Behavioural no-op in prod (civicgraph client falls back to the app's own URL/key since CIVICGRAPH_* unset) → Vercel main redeploy is safe. Remote branch `feat/civicgraph-client-decouple` NOT deleted (Ben's call). EOFY wip preserved. Added `civicgraph` proxy in `apps/command-center/src/lib/supabase.ts` (env `CIVICGRAPH_SUPABASE_URL`/`CIVICGRAPH_SUPABASE_KEY`, falls back to app's own → no-op today); routed grant-estate across 4 `/api/grantscope/*` routes + `api/grants/[id]/{route,draft,milestones}`. act-global-owned tables (projects, project_knowledge, v_pipeline_value, hybrid_memory_search) left on `supabase`.
  - **act-global FOLLOW-ON (deferred, only needed at actual move-time):** (1) grant-engine client repoint at the `new GrantEngine({supabase})` construction site (instantiated in a discovery script/cron, not app routes — must be located); (2) notion-workers `index.ts:1719` grant_opportunities write; (3) ~25 finance/briefing/harvest/telegram READ sites for grant_opportunities/grant_applications; (4) resolve `v_pipeline_value` + `grant_funder_documents` ownership.
- [ ] **JusticeHub decoupling — PARKED** (justice/alma ownership undecided; 220 live-app files + 8 RPCs; do not start without Ben's go).
- [ ] Confirm `CIVICGRAPH_SUPABASE_KEY` is the correct env var name (live EL impl uses `_SUPABASE_KEY`, anon key; the decoupling-matrix doc's `CIVICGRAPH_SERVICE_KEY` is WRONG). act-global's client uses service-role fallback.
- [ ] Confirm Barkly Backbone (gkwzdnzwpfpkvgpcbeeq) is safe to wipe — Ben must eyeball its tables in dashboard (list_tables is classifier-blocked). Check its compute tier. OR provision a fresh Sydney project.
- [ ] Resolve grantscope→auth.users/org_profiles/org_members FK handling (~8 tables) for the move.
- [ ] Move grantscope estate → dedicated box; repoint 82 hardcoded scripts (keystone `scripts/lib/psql.mjs:22`) + Vercel env + the 3 cross-project write-backs.

### Decisions
- **Target architecture = CivicGraph-as-a-service**, NOT cut-the-cord. grantscope owns+writes the civic data; the 4 other apps are read-consumers via an explicit client. Door = read-replica / dedicated box. (empathy-ledger-v2 already does this via `CIVICGRAPH_SUPABASE_URL` — the template.)
- **Ownership (Ben, 2026-06-21):** `grant_opportunities`/`grant_applications` = grantscope-owned (MOVE; act-global is a cross-project writer). **act-global verified clean: ~43 files, writes all SINGLE-TABLE (no cross-project transaction) → safe to split (matrix Q#3 RESOLVED favourably).**
- **⚠️ CORRECTION (2026-06-21, VERIFIED via rg on JusticeHub src/): the "`justice_funding`/`alma_*` move cleanly because JH live app has 0 `.from()` refs" decision is FALSE.** JusticeHub's LIVE app heavily queries them: **76 files `.from('justice_funding')`, ~197 files `.from('alma_*')`, 22 files `.from('gs_entities/relationships')` — 220 distinct live-app files** (of 1,299 src TS files; no vendored dir), PLUS **≥8 distinct `.rpc('justice_funding_*')` / `get_funding_total` stored-proc calls** across ≥5 live API routes (justice-funding, spending/[state], power-page, homepage-stats, directory, page.tsx). JusticeHub IS a justice-funding/ALMA product — these tables are its lifeblood. **RPC WRINKLE (new): `.rpc()` calls are DB-resident functions; a client-repoint does NOT carry them — if justice_funding moves, every `justice_funding_*` function must be recreated on the destination AND JH must call them via the civicgraph client.** This reopens the ownership call (stay vs move) and means JH decoupling is 25× the EL-sized job the plan assumed.
- **Saturation root cause:** Small box, max_connections=90, ~6 tenants' bursts collide. Pool already maxed at 30. Real levers: Medium compute (90→120 conns, +$45/mo, reversible) OR de-share. Reaping dev servers doesn't move the floor (PostgREST ~31 + platform ~12 = ~43 fixed).
- **Medium OUTCOME — VERIFIED 2026-06-22:** Medium FIXED the chronic session-long saturation (no more recover↔saturate flapping; steady-state ~29–38/120 = 24–32%). BUT transient ~1-min burst-blips still occur: monitor `bwx4frswj` fired DB-UNREACHABLE 06:20:00 → DB-RECOVERED 06:21:01, while a live gsql query showed the box healthy (38/120, 0 idle-in-txn, 0 long-running) seconds later. These short blips are heavy BATCH/burst load momentarily starving the shared PostgREST/Supavisor ~30-slot pools, then self-clearing. **De-share (isolating grantscope's batch load) is the durable fix for the residual blips — but it is NOT urgent; the box self-recovers and steady-state is comfortable.** The monitor's baked-in "pool bump insufficient, escalate" text predates Medium and overstates it.
  - **Blip log (watch for a worsening trend):** #1 06:20:00→06:21:01 (~1 min); #2 06:54:30→07:03:28 (**~9 min**, longer). Both self-recovered; box at 27–32/120 seconds after each. Couldn't attribute the first two — recovered before a live `pg_stat_activity` could catch the active burst. **FIXED 2026-06-22: snapshot-on-unreachable capturer is LIVE.** `scripts/db-saturation-snapshot.mjs` (pm2 `db-saturation-snapshot`, id 143) polls the PostgREST/gsql path every 10s; on the reachable→unreachable transition (+ each poll while down, capped 6) it snapshots `pg_stat_activity` via **psql (separate Supavisor pool — answers even when PostgREST is saturated)** → appends to `scripts/logs/db-saturation-snapshots.log`. Captures pool counts + every non-idle backend's query/wait/duration (longest first = likely culprit). Key insight: a blip = PostgREST-pool saturation, so the busy `authenticator` backends ARE the burst and psql sees them; if psql ALSO fails it logs "BOTH POOLS DOWN" (pooler-wide). **Next blip → `tail -n 60 scripts/logs/db-saturation-snapshots.log` to see who did it.** Not `pm2 save`d yet (survives until reboot/pm2 kill; run `pm2 save` to persist across reboot). **Trigger to UN-PARK the de-share:** a blip that stops self-recovering, or gaps that keep lengthening past ~10–15 min. Cheap interim levers if blips worsen: `pm2 stop orchestrator` when idle + fewer concurrent dev servers (known burst sources; cut frequency, not ceiling).
- Goods PR scope = one bundled PR (#100), not split — disjoint files, all Ben's work.

### Open Questions
- UNCONFIRMED: Barkly Backbone genuinely abandoned/safe-to-wipe? (couldn't inspect — classifier blocked list_tables). Its compute tier?
- **RESOLVED (REFUTED 2026-06-21):** JusticeHub DOES reach justice/alma in live runtime — heavily, via `.from()` AND `.rpc('justice_funding_*')` stored procs (220 live-app files + ≥8 RPCs). NOT 0-refs. See corrected decision above.
- **RESOLVED (2026-06-21):** act-global's grant_opportunities/grant_applications writes are ALL single-table (`.from(x).insert/update/delete`), no multi-table transaction or cross-table RPC → safe to split across projects. Sites: grant-engine `repository.ts`, `api/grants/[id]/{route,draft,milestones}`, notion-workers.
- NEW: both consumer repos are on ACTIVE feature branches with uncommitted work (JH `docs/contained-adelaide-launch-pack`; act-global `docs/eofy-next-week-plan-2026-06-20` mid-EOFY) — land any CivicGraph-client work on a fresh branch, don't pile onto theirs.

### Workflow State
pattern: staged-migration
phase: 0
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "De-share grantscope/CivicGraph off the shared Empathy Ledger box into a dedicated DB + explicit shared-service clients"
- resource_allocation: conservative

#### Unknowns
- barkly_safe_to_wipe: UNKNOWN
- barkly_compute_tier: UNKNOWN
- justicehub_raw_sql_access: UNKNOWN

#### Last Failure
(none — analysis phase complete, no migration executed yet)

---

## Context

### The five apps share ONE box (`tednluwflfhxyucgwigh` = "Empathy Ledger", Small, max_conn 90)
Verified via list_projects (org `zennczhyghoomusnvcpg`, all on Pro plan). Repos referencing the ref: empathy-ledger-v2 (968 files), JusticeHub (814), act-global-infrastructure (432), act-regenerative-studio (51), grantscope. Raw counts overstate coupling — real cross-app surface is ~13 tables, mostly read-only.

### The estate splits 3 ways (full detail in crossapp-db-dependency-map.md)
1. **Grantscope-only (80+ tables, every mv_*)** → moves with zero cross-app impact. This is the heavy/batch load causing saturation.
2. **Shared read/write surface (~13 tables)** → the blockers: gs_entities (read ×3 + JusticeHub enrich-cron WRITE), gs_relationships (read ×3), acnc_*, austender_contracts, political_donations, foundations, foundation_programs, foundation_relationship_signals, mv_gs_donor_contractors, outcome_submissions (EL WRITE-back), grant_opportunities/grant_applications (act-global read-WRITE).
3. **Shared identity backbone (STAYS):** auth.users, org_profiles, org_members, canonical_entities, entity_identifiers, ghl_*, xero_*.

### Only 3 cross-project WRITES exist (the hard bits, all single-table + async-tolerant)
1. JusticeHub → gs_entities (enrich cron)
2. empathy-ledger-v2 → outcome_submissions (funding write-back)
3. act-global → grant_opportunities/grant_applications (grant-engine)

### Candidate target: "Barkly Backbone" (gkwzdnzwpfpkvgpcbeeq)
Region ap-southeast-2 (Sydney ✓), same org/billing ✓, ACTIVE_HEALTHY, PG17. Ben said unused/wipeable but UNVERIFIED (couldn't inspect tables). A dedicated box even on Small likely fixes saturation (isolation removes the 6-tenant burst collision).

### Plan docs (read on resume)
- `thoughts/shared/plans/grantscope-deshare-to-barkly.md` — table-level move/stay/cutover + 82-script repoint checklist
- `thoughts/shared/plans/crossapp-db-dependency-map.md` — who reads what + per-app breaks-or-not verdict
- `thoughts/shared/plans/civicgraph-decoupling-matrix.md` — Step-2: per-app CivicGraph client, execution order

### Parallel session note
`feat/goods-registry-entity-resolution` is shared with the `power-holder-leverage-map` session (committed 412cbb2 / Power Holders leaderboard, pushed). Its own ledger is `thoughts/shared/handoffs/power-holder-leverage-map/current.md` — do not clobber it. Branch is 5 commits ahead of main; PR #100 covers it.
