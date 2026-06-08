# OP3 — Justice-domain proven suppliers ("Proven govt delivery")

**Status:** awaiting approval · **Wedge:** green (evidence depth) · **Created:** 2026-06-08

## Goal
Surface the broad evidence tier — **4,225 orgs (by ABN)** carrying BOTH justice/community-domain
funding AND a won federal contract — as a buyer-facing **"Proven govt delivery"** badge on
`/suppliers` search results and `/social-enterprises/[id]` profiles. Mirrors the OP7 triple-proof
pattern exactly; broadens it by dropping the ACNC requirement.

## Data (verified 2026-06-08, gsql)
- **4,225** ABNs have justice ∩ contract (exact; matches leverage map)
- **724** of those also have ACNC = the existing triple-proof subset (already badged)
- **331** are in the SE registry → would badge on `/suppliers` + profiles
- Wedge: green — evidence depth is the wedge's #1 tie-breaker

## Badge hierarchy (strongest wins, per supplier)
1. **Proven outcomes** (gold) — triple-proof + ALMA evidence/outcomes  *(exists)*
2. **Triple-proof** — justice + contract + ACNC governance  *(exists)*
3. **Proven govt delivery** (NEW) — justice + contract (the broad 4,225)

The 724 triple-proof orgs are a strict subset of the 4,225, so they keep the stronger badge; the new
badge fires for the ~3,500 that have justice+contract but not ACNC.

## Build steps

### Phase A — Migration (TIER 3 — requires explicit "apply"/"run" before any DB write)
1. `supabase/migrations/20260608060000_mv_justice_proven_suppliers.sql`
   - Clone `mv_triple_proof_suppliers` **minus the ACNC `EXISTS` gate**.
   - ACNC kept as an **optional LEFT JOIN** (charity_size, acnc_registered_since): present where it
     exists, null otherwise.
   - Carry the `has_alma_evidence_outcomes` flag (same as triple-proof migration `20260608050000`)
     so the gold "Proven outcomes" tier composes for justice-proven orgs too.
   - Anchor on `gs_entities` (`DISTINCT ON (abn)`). Unique index on `abn` (for CONCURRENTLY refresh)
     + gs_id / state / total_evidence_dollars indexes.
   - Expected ≈ 4,225 rows (minus any ABN that doesn't resolve to a gs_entity — verify post-build).
2. `supabase/migrations/20260608070000_cron_refresh_order_add_justice_proven.sql`
   - Re-dump `refresh_civicgraph_mvs()` with `mv_justice_proven_suppliers` added to the
     `refresh_order` array (after `mv_triple_proof_suppliers`), preserving the `statement_timeout=0`
     + `search_path` fix verbatim.
3. Apply both via `psql -f` (CLAUDE.md DDL rule).
4. Register in `scripts/refresh-views-v2.mjs` VIEW_LIST.
5. Verify: row count ≈ 4,225, unique index present, sample ABN.

### Phase B — App surfaces (TIER 1)
6. `lib/services/supplier-search.ts` — add `proven_govt_delivery: boolean` to `SupplierResult`;
   extend the existing ABN-enrichment block to also check `mv_justice_proven_suppliers`.
7. `/suppliers/page.tsx` — add `ProvenGovtDeliveryBadge`; render only when the stronger badges
   don't fire (hierarchy).
8. `/social-enterprises/[id]/page.tsx` — add the same badge to the header badge row via a cheap
   one-row MV lookup by ABN.
9. `lib/supplier-copy.ts` — badge tooltip copy if it lives there.

### Phase C — Verify + ship
10. Gates: `tsc --noEmit` (0) + `vitest run` (221/221).
11. Live-verify: a justice-proven-but-not-triple-proof SE shows "Proven govt delivery"; a
    triple-proof one still shows the stronger badge (hierarchy correct).
12. Manual MV refresh once so it's populated (Tier 2 — will post first).
13. Ship: branch `feat/op3-justice-proven-suppliers`, push + PR (Tier 2/3 — explicit verb).

## Guardrails / NOT doing
- No data widening (no new ingestion) — connect/deepen only.
- Don't require ACNC (that's OP7) — keep OP3 broad.
- Don't rebuild the badge system — extend it; strongest badge wins.
- No browsable `/suppliers/justice-proven` list in v1 (deferred — possible phase 2).

## Tier map
- MV creation + migration apply + cron fn change = **Tier 3** (explicit verb gate).
- Manual MV refresh = **Tier 2** (post "about to" first).
- App code, migration *files*, refresh-views registration = **Tier 1**.

## Rollback
Fully reversible, no data mutation: `DROP MATERIALIZED VIEW mv_justice_proven_suppliers`, revert the
cron-fn migration, revert app code.
