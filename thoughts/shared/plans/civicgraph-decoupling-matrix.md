# CivicGraph decoupling matrix — give every consumer an explicit client

**Date:** 2026-06-21 · **This is Step 2** of the safe sequence in `crossapp-db-dependency-map.md`.
**Principle:** Make every app reach grantscope's data through a **dedicated "CivicGraph" Supabase client** (its own env var + client instance), **still pointed at the current shared box.** Behaviourally a no-op — but it means that when the data later moves, you flip **one env var per app**, not rewrite queries. Decouple the *connection* first; move the *data* second. There is never a broken moment.

**Reference pattern (empathy-ledger-v2 already does this):**
```ts
// a SECOND client, separate from the app's own-data client
const civicgraph = createClient(process.env.CIVICGRAPH_SUPABASE_URL!, process.env.CIVICGRAPH_SERVICE_KEY!)
// all grantscope-table queries go through `civicgraph`; identity/own tables stay on the normal client
```

## Per-app matrix

### empathy-ledger-v2 — ✅ ALREADY DECOUPLED (the template)
- **Client:** `CIVICGRAPH_SUPABASE_URL` (exists)
- **Reads:** `gs_entities`, `gs_relationships`, `acnc_charities`, `acnc_ais`, `austender_contracts`, `political_donations`, `foundations`, `foundation_programs`, `mv_gs_donor_contractors`
- **Writes:** `outcome_submissions` (funding write-back)
- **Action:** none for decoupling. At data-move time: repoint `CIVICGRAPH_SUPABASE_URL`. Confirm the `outcome_submissions` write goes through the civicgraph client (not the default one).

### JusticeHub — needs a CivicGraph client (1 cross-project write)
- **Reads:** `gs_entities`, `gs_relationships` (org graph / power-map / network APIs — ~22 files)
- **Writes:** `gs_entities` (the `enrich-websites` cron: `sector`/`sub_sector`/`description`/`source_datasets`/`metadata`)
- **Action:** add `CIVICGRAPH_SUPABASE_URL`/key + a `civicgraph` client; route the ~22 read files + the enrich cron through it. The enrich write becomes a cross-project write at move time — it's idempotent/async-tolerant (enrichment), so fine.
- **Note:** JusticeHub does **NOT** query `justice_funding`/`alma_*` in its live app (0 `.from()` refs — verified) so those are not part of its client surface.

### act-global-infrastructure — needs a CivicGraph client (the trickiest: a cross-project READ-WRITE)
- **Reads:** `foundations`, `foundation_programs`, `foundation_relationship_signals`, `acnc_charities`, `gs_entities`, `gs_relationships` (`/api/grantscope/*`, finance/pipeline routes)
- **Read-WRITES:** `grant_opportunities`, `grant_applications` (grant-engine `repository.ts` + draft/milestones routes) — **grantscope-owned, so they MOVE**; act-global becomes the cross-project writer.
- **Action:** add the civicgraph client; route `/api/grantscope/*` + the grant-engine package through it. The `grant_opportunities`/`grant_applications` write is the hardest cross-project write — confirm no multi-table transaction spans it (single-table writes are fine across projects; a transaction is not).

### act-regenerative-studio — trivial
- **Reads:** `foundations`, `foundation_power_profiles` (BUILD script only — `scripts/build-payout-wall-data.mjs`)
- **Action:** point the build script's client at `CIVICGRAPH_SUPABASE_URL` (or ship the static snapshot). No runtime/app change.

### grantscope (the owner)
- After the move, its own app + the 82 hardcoded scripts repoint to the new box (see `grantscope-deshare-to-barkly.md` cutover checklist; keystone = `scripts/lib/psql.mjs:22`).
- Keeps reaching the shared-identity tables (`auth.users`/`org_profiles`/`org_members`) cross-project, or via replication for the ~8 FK-coupled tables.

## The cross-project WRITE inventory (the only genuinely hard bits — 3)
1. **JusticeHub → `gs_entities`** (enrich cron) — async, idempotent. Easy.
2. **empathy-ledger-v2 → `outcome_submissions`** — write-back, async. Easy.
3. **act-global → `grant_opportunities`/`grant_applications`** (grant-engine) — read-write, in a request path. Confirm no cross-table transaction. Medium.

Cross-project *reads* are all fine (separate client). Cross-project *writes* can't share a transaction with the writer's own DB — these 3 are all single-table and tolerant, so OK.

## Execution order (each is per-repo work, schedulable independently)
1. **empathy-ledger-v2** — verify it's already correct (reference impl); confirm the `outcome_submissions` write path.
2. **act-regenerative-studio** — trivial build-script client repoint.
3. **JusticeHub** — client + ~22 read sites + 1 enrich cron.
4. **act-global-infrastructure** — client + `/api/grantscope/*` routes + grant-engine write (hardest).
5. **Gate:** all four green while STILL pointed at the shared box (no data moved). Then → move grantscope's data to its own box and flip the env var in each app (+ grantscope's own 82-script repoint). Verify live, decommission old tables.

**Why this is safe:** during steps 1–4 every client still points at the SAME box — nothing moves, nothing breaks. You're only formalising connections. The data move is a later, separate, env-var flip once all consumers are decoupled.
