# Grantscope de-share → dedicated Supabase ("Barkly Backbone")

**Date:** 2026-06-21
**Why:** The shared "Empathy Ledger" box (`tednluwflfhxyucgwigh`, Small, max_connections=90) is chronically saturated — ~6 projects' query bursts collide on one box. Pool-tuning and dev-server reaping are band-aids; the floor (~31 PostgREST + ~12 platform) doesn't shrink when you kill clients. **The cure is isolation:** move grantscope's heavy data + batch workload onto a dedicated project so its 1M-row scans / MV refreshes / orchestrator stop competing with five other tenants.

## Target: "Barkly Backbone" (`gkwzdnzwpfpkvgpcbeeq`)

| Check | Result |
|---|---|
| Region | ✅ `ap-southeast-2` (Sydney) — same as now, no latency penalty |
| Org / billing | ✅ `zennczhyghoomusnvcpg` — same org, same access token |
| Status / PG | ✅ ACTIVE_HEALTHY, Postgres 17 |
| **Is it actually empty/abandoned?** | ❌ **UNVERIFIED** — `list_tables` blocked by an earlier Supabase deny rule; Ben must eyeball the dashboard before any wipe. Name "Barkly Backbone" suggests it held real NT data. |
| **Compute tier** | ❓ Not in metadata — size it for grantscope's heavy load (MV refreshes), at least Small-paid. |

## The central finding: grantscope's data splits into TWO halves

A static repo audit (DB-free, 5 readers) found the move is **not uniform**. Tables fall into two groups by their foreign keys:

### Half A — heavy, grantscope-only, internal FKs (this is what's saturating the box)
Moves **cleanly**. This is the whole point of the migration.
- Entity graph: `gs_entities` (159K), `gs_relationships` (1.08M), `gs_entity_aliases`, completeness log
- Source data: `austender_contracts` (770K), `acnc_charities`/`acnc_ais`, `ato_tax_transparency`, `political_donations`, `justice_funding` (71K)
- Registries: `asic_companies`, `asx_companies`, `oric_corporations`, `ndis_*`, `nz_*`, `vic_grants_awarded`, `grantconnect_awards`, `research_grants`
- `foundations`/`foundation_*`, `grant_opportunities`, `social_enterprises`/`se_*`
- `alma_*` evidence layer, `postcode_geo`/`seifa_2021`/`sa2_reference`, `person_identities`/`person_*`/`entity_xref`
- `goods_*` (8/9 internal FKs — but see open question on the Tokyo "Goods" project)
- Orchestrator/telemetry: `agent_runs`/`agent_tasks`/`agent_schedules`/`mv_refresh_log`
- **Batch workload**: `agent-orchestrator.mjs`, `refresh-views-v2.mjs` (82 MVs), ~63 ingest/enrich/scrape scripts

### Half B — light, user/tenant-scoped, FK to Empathy Ledger identity (the complication)
~25 tables FK to **`org_profiles`** and **`auth.users`** (Empathy Ledger's billing + GoTrue identity). These are LIGHT (per-user, low volume) and they're the thread tying grantscope to the shared auth system:
- `procurement_*` (19 tables — workspace, shortlists, governance threads)
- `saved_grants`, `saved_foundations`, `alert_preferences`, `user_grant_tracking`, `api_keys`
- `grant_feedback`, `grant_answer_bank`, `opportunity_decisions`
- `goods_cost_allocation_decisions`/`goods_tranches` (FK/join to `xero_invoices` — ACT financial data)
- `civicscope_act_entity_bridge` (links ACT `canonical_entities` ↔ `gs_entities`)

### Stays on Empathy Ledger regardless
`org_profiles`, `auth.users`, `profiles`, `canonical_entities`, `ghl_contacts`/`ghl_opportunities`, `xero_invoices`/`xero_bank_accounts`, `org_contacts`.

## Recommended strategy: move Half A, decide Half B per-table

Moving Half A alone **removes the saturation** (it's the heavy/batch load) and is **clean** (no cross-project FK). Half B is light and auth-coupled — for those, the app can query across both projects and join in app code (small result sets). The central call is **how to handle the `org_profiles`/`auth.users` FKs** for any Half-B table you do want to move (mirror IDs + sync, or just leave it on Empathy Ledger).

## Schema objects to recreate in Barkly (not carried cleanly by a data dump)
- **Extensions first**: `pg_trgm` (fuzzy-search index), `vector`/pgvector (ivfflat semantic search), `pg_cron` + `pg_net` (nightly MV refresh)
- **RPCs**: `get_funding_gaps`, `search_entities_fuzzy`, `search_entities_semantic`, `search_foundations_semantic`, `charity_sector_snapshot`, `get_timing_windows`, `gs_make_id`, `claim_next_task`
- **Triggers**: `gs_entities_updated_at`, `trg_classify_justice_funding`
- **82 MVs** (`mv_entity_power_index`, `mv_revolving_door`, `mv_person_identity_influence`, …) — recreate defs + unique indexes, refresh in dependency order (4 are non-concurrent)
- **pg_cron job** `refresh-civicgraph-mvs-nightly` + `cron_refresh_order` chain — re-run setup SQL, update embedded project URL

## Cutover repoint surface (a missed one = split-brain writes)
- **`.env`, `.env.example`, `apps/web/.env.local`** — all 6 Supabase vars
- **`scripts/lib/psql.mjs:22`** — hardcoded conn (ref baked in, only password from env). **KEYSTONE** — imported by 24 scripts.
- **`scripts/gsql.mjs:63`, `refresh-views-v2.mjs:22-25`** — hardcoded psql host/user
- **82 scripts** hardcode `tednluwflfhxyucgwigh` (`grep -rln tednluwflfhxyucgwigh scripts/`) — parameterize via env
- **Vercel dashboard env vars** (not just local .env), **pm2 orchestrator env**
- `scripts/sql/setup-pg-cron-mv-refresh.sql` embedded URL; CLAUDE.md / schema-cache / MEMORY.md docs
- App client libs (`supabase.ts` etc.) are **already env-driven** — no code change, just verify they resolve the new URL.

## Top risks
1. **82 hardcoded refs** — miss one batch script and it keeps writing to the OLD box after cutover (silent split-brain).
2. **`org_profiles`/`auth.users` FKs** — moving any Half-B table breaks the FK unless IDs are mirrored; tenant-leak risk if a mirror drifts.
3. **Xero coupling** — `goods_cost_allocation_decisions` (hard FK) + `goods_tranches` (query-time `WHERE project_code='ACT-GD'`) break on move.
4. **pg_cron + MV defs don't travel with a `pg_dump`** — if not re-run, MVs rot silently (no error).
5. **pgvector/pg_trgm indexes** are slow to rebuild — semantic/fuzzy RPCs return empty until built.
6. **`act_grant_recommendations` MV** joins an external ACT `projects` table not in grantscope migrations — refresh fails on Barkly.
7. **Goods Tokyo project** (`cwsyhpiuepvdjtxaozwf`) syncs into `goods_asset_lifecycle` — repoint that sync too.

## Open questions (Ben decides — these change what gets dumped)
1. **The central call:** for `org_profiles`/`auth.users`-coupled tables — mirror IDs into Barkly + sync, or leave them on Empathy Ledger? (~25 tables.)
2. Does `goods_*` belong in the **Tokyo "Goods" project** instead of Barkly? (It already syncs from there.)
3. Is `alma_funding_opportunities` grantscope-owned or shared?
4. What is `profiles` (vs `org_profiles`)?
5. Xero coupling for goods cost/tranche: drop FK + denormalize, or replicate xero data?
6. Should user-scoped tables (`saved_*`, `alerts`, `api_keys`) move at all, or stay with `auth.users`?
7. **Barkly compute size** so it doesn't re-create the saturation it's leaving.

## Recommended sequence
0. **Provision**: confirm Barkly empty (Ben) → `CREATE EXTENSION pg_trgm, vector, pg_cron, pg_net`
1. **Schema**: apply `supabase/migrations/` to Barkly; stub/skip cross-project FKs (org_profiles/auth.users/xero/canonical_entities)
2. **Decide couplings** (Half B) BEFORE dumping — each table: move+mirror / keep+sync / stay
3. **Dump** Half-A data-only from Empathy Ledger
4. **Restore** into Barkly; rebuild pgvector + pg_trgm indexes (slow — schedule)
5. **Recreate MVs** + unique indexes; run `refresh-views-v2.mjs` once in dependency order
6. **Recreate cron** (`setup-pg-cron-mv-refresh.sql` + `cron_refresh_order`) with new URL
7. **Repoint batch**: parameterize `psql.mjs`/`gsql.mjs`/`refresh-views-v2.mjs` + 82 scripts to env; orchestrator env → Barkly
8. **Repoint app**: `.env` + `apps/web/.env.local` + Vercel dashboard
9. **Verify (read-only)**: row counts match; RPCs return; MVs fresh; cron registered; cross-project bridges resolve; sample app page + sample batch script hit Barkly (check pg_stat_activity)
10. **Cutover**: stop orchestrator on old box, snapshot/read-only old grantscope tables, flip env everywhere, restart orchestrator + redeploy app, re-verify live
11. **Decommission**: after a stability window, drop the moved tables from Empathy Ledger — this is what actually relieves the shared-pool saturation
