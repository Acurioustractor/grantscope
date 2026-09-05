---
date: 2026-09-05
topic: Phase 2 of the Supabase platform review, the private-data boundary
status: plan, measured; recommendation at the end; nothing applied
depends_on: thoughts/shared/findings/supabase-platform-review-2026-09-05.md (sections 1, 2, 10)
---

# Phase 2: put a boundary around ACT's private data

**The question.** The review found ACT's CRM, accounts mirror and inbox living in the same Supabase project as the public
civic graph, and found them readable with the public key through definer views. Phase 0 and Phase 1 closed every such
object found (register red count 42 → 31, all 31 consent-gated publishing rows by design). The remaining risk is
structural: the private data is still one careless view or policy away from the public key. This plan measures what a
boundary costs in three shapes and recommends one.

All figures measured 2026-09-05 against the live project with `schema_ownership` seeded `[V]`.

## What "ACT private" is, measured

| measure | value |
|---|---|
| ACT-owned objects | 235: 170 tables, 64 views, 1 matview, 345 MB |
| foreign keys from ACT tables into civic tables | 39 (`org_profiles`, `users`, `gs_entities`, `grant_opportunities`, `foundations`, `organizations`, `alma_funding_opportunities`, `public_profiles`, `person_identity_map`, `justicehub_nodes`, …) |
| foreign keys from civic tables into ACT tables | 0 |
| ACT views that join civic tables | 13 of 64 (`v_act_organisations`, `v_act_people`, `v_act_pipeline_unified`, `v_act_procurement_buyers`, the seven `v_goods_*`, `v_grant_readiness`, `act_funding_opportunity_current_status`, `task_queue_dashboard`) |
| code naming ACT objects via `.from()` | grantscope 271 call sites in 84 files; act-global 1,803 call sites in 527 files |
| `exec_sql` strings naming ACT tables in grantscope | 1,211 mentions |
| schemas the API exposes | `public` only (`drizzle` holds one Harvest migrations table) |
| ACT objects open to the public key today | 4, all by design: `coe_key_people`, `partner_storytellers`, `pmpp_knowledge` (consent or approval filtered), `newsletter_subscriptions` (admin-filtered) |

The FKs are the tell: ACT's work-truth tables (Obligations, Communities, Asks' mirrors) reference CivicGraph's tenancy
(`org_profiles`, `users`) and spine (`gs_entities`, `grant_opportunities`, `foundations`) by design, per ADRs 0003 and 0004.
The desk is not a separate product bolted onto the civic graph; it is a private lens on it.

## Three shapes, costed

### A. Separate Supabase project (the review's original Phase 2)

Move the 235 objects to their own project. The public project then has one rule, "public read, service-role write".

- **Breaks** all 39 FKs (cross-database FKs do not exist) and the 13 cross views; each becomes an application-side join or a
  `postgres_fdw` foreign table. Auth splits too: the desk's `org_profiles`/`users` references need either a second auth
  pool or plain uuids with no referential integrity.
- **Re-points** ~2,000 call sites across two repos to a second client, plus the 13 edge functions that write ACT tables.
- **Effort:** a quarter, as estimated in the review, with a dual-running window and a parity check between projects.
- **Gains:** physical separation; a leak in the civic project cannot reach accounts data; independent compute and backups.

### B. Separate schema inside the same project

Move the 235 objects to a schema `act`. PostgREST exposes only `public` today, so an unexposed `act` schema is unreachable
through the public key at any URL, and a new schema starts with zero grants to `anon` and `authenticated` (the default
privileges that hand `public` objects to those roles do not apply elsewhere). FKs and cross views keep working: same database.

- **Keeps** all 39 FKs and the 13 views (views in `public` may read `act` tables; they must be `security_invoker` or the
  boundary is undone, which the register page already flags).
- **Re-points** the same ~2,000 `.from()` call sites to `.schema('act')`, or exposes `act` to the API for the service role
  only (exposure is per schema, not per role, so exposing it re-opens the grant question; prefer `.schema()` on the
  service client plus RPCs). `exec_sql` strings keep working if its `search_path` gains `act` after `public`.
- **Effort:** two to three weeks, table family by table family (xero, ghl, comms, receipts, project knowledge, goods), each
  move a migration through `/db-apply` with the parity check; the desk's reads move with each family.
- **Gains:** private by default, no auth split, no FK rework. Loses: none of the physical-separation benefits of A.

### C. Guardrail only, no move

Keep the tables where they are; make the boundary a check that fails the build: no ACT-owned object may be open to the
public key beyond a named allowlist (the four above). Run it in `/preflight` and in CI next to Migration Parity, off the same
query `/ops/schema` renders.

- **Breaks** nothing, re-points nothing. **Effort:** a day. **Gains:** the class of leak found on 2026-09-05 is caught the
  day it is reintroduced instead of months later. Loses: the data is still one revoked check away from exposure, and every
  new ACT table needs a register row for the check to see it (the migrations README already requires that).

## Recommendation

**C now, B folded into Phase 3, A not unless a compliance or blast-radius reason appears.**

- C is cheap, honest and enforceable this week, and it turns the register from a page into a gate.
- B is the right end state for one project shared by six repos: private by default instead of private by vigilance. Its
  cost is dominated by re-pointing call sites, which Phase 3 (named SQL instead of `exec_sql` strings, typed RPCs) touches
  anyway; doing the schema move family by family inside that work costs little extra and removes the vigilance dependency.
- A's benefits (separate compute, backups, physical isolation) are real but nothing in the review needed them, and its
  cost lands on the FKs that encode ADRs 0003 and 0004. Revisit if ACT's accounts data needs its own retention or access
  regime, or if a funder or auditor asks where the data lives.

## What C needs (the next slice)

1. `scripts/check-private-exposure.mjs`: the `/ops/schema` state query filtered to `owner = 'act'` and open, minus the
   allowlist; exit 1 with the names on anything new. Allowlist lives in the script with the reason for each entry.
2. Run it in `/preflight` and as a step in the CI `Migration Parity` job (same secrets).
3. One line in `supabase/migrations/README.md`: a new ACT table or view is not done until the register has its row and the
   check is green.

## What B needs when Phase 3 starts

1. `CREATE SCHEMA act;` with no grants beyond `service_role`; `exec_sql` search_path `public, act, extensions, pg_temp`.
2. Per family: `ALTER TABLE ... SET SCHEMA act;` (FKs and views follow automatically), re-point that family's `.from()`
   calls to `.schema('act')`, run parity and the exposure check, ship.
3. Views in `public` that read `act` tables stay `security_invoker`; the register page shows any definer view over `act`
   as red.
4. Edge functions `ghl-webhook` and `intake` write ACT tables and move with the ghl and intake families.
