# Handoff — Grant-Finder Overhaul (run in the codebase)

**Date:** 2026-07-05 · **Branch:** `claude/codebase-main-goal-i5bhs3`
**For:** a Claude Code session running in the real codebase (has `.env`, DB creds, network).

## Why this handoff exists

Phases 1–5 of the grant-finder overhaul were built and unit-tested in a sandbox
that had **no `.env` and no network to gov hosts**, so the DB/feed dry-runs and a
few build items couldn't be finished there. Everything below is ready to run
here. Full plan + status: `docs/strategy/grant-finder-overhaul.md`.
Exact commands + expected output: `docs/strategy/grant-finder-dry-run-runbook.md`.

## What's already done (committed on this branch)

| Phase | What shipped | Key files |
|---|---|---|
| 1 — Vector matching | One scorer for all 3 paths (was: 2 keyword matchers + 1 vector) | `packages/grant-engine/src/grant-matching.ts`; `apps/web/src/app/api/grants/match/route.ts`, `.../api/profile/matches/route.ts`; `scripts/scout-grants-for-profiles.mjs` |
| 2 — Trust layer | Quarantine `llm_knowledge`/unverified from alerts; trust badge; stale-close on either deadline field | `packages/grant-engine/src/grant-verification.ts`; `scripts/scout-grants-for-profiles.mjs`, `scripts/close-stale-grants.mjs`; `apps/web/src/app/grants/[id]/page.tsx` |
| 3 — CKAN client | Shared paginating client (fixes silent >500-row truncation); GA auto-fetch | `packages/grant-engine/src/sources/lib/ckan.ts`; `.../sources/qld-grants.ts`; `scripts/ingest-grantconnect.mjs` |
| 4 — CLASSIE | Taxonomy + zero-cost category→CLASSIE mapper; migration; classifier | `packages/grant-engine/src/classie.ts`; `supabase/migrations/20260704000000_grant_classie.sql`; `scripts/classify-grants-classie.mjs` |
| 5 — Dedup + health | Hardened dedup key (provider aliases); source-health classifier; per-source run logging | `packages/grant-engine/src/normalizer.ts`, `.../source-health.ts`; `scripts/scrape-state-grants.mjs` |

31 grant-engine tests pass; `apps/web` typecheck clean.

## Do this, in order

### Step 0 — baseline
```bash
pnpm install --frozen-lockfile
cd apps/web && npx tsc --noEmit
cd ../../packages/grant-engine && npx tsx --test tests/*.test.ts   # expect 31 pass
```

### Step 1 — apply the CLASSIE migration
```bash
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f supabase/migrations/20260704000000_grant_classie.sql
```

### Step 2 — run the connected dry-runs
Follow `docs/strategy/grant-finder-dry-run-runbook.md` section B (steps 1–7).
Verify each "Expect" line. The important ones:
- Scout `--dry-run` for a real embedded org → `Semantic matching: N/N`, sensible ranking, `⚠ … held back as unconfirmed` for any llm_knowledge match.
- `scrape-state-grants --state=qld --dry-run` → no `[ckan] stopped at maxRecords` warning (full ingest).
- `classify-grants-classie --dry-run` → mostly `via category map`, few skipped.

### Step 3 — go live where the dry-runs looked right
- `npx tsx scripts/classify-grants-classie.mjs --limit=5000` (deterministic, no LLM cost).
- Backfill grant embeddings for any grants missing vectors:
  `embeddings.ts:backfillEmbeddings` (wire a small script or run via an existing entrypoint).
- Let a real scrape run, then confirm `agent_runs` has `source:*` rows (Step 7 in runbook).

### Step 4 — finish the two deferred build items
1. **`/health` source panel.** Query `agent_runs WHERE agent_id LIKE 'source:%'`
   (latest per source), feed rows to `classifySourceHealth()` from
   `packages/grant-engine/src/source-health.ts`, render the `zeroed`/`stale`/`failing`
   rows in the ops health page (`apps/web/src/app/ops/health/`). Pure classifier is
   done + tested — this is just query + render.
2. **CLASSIE UI.** Surface `classie_subjects` / `sdg_codes` as filters/badges on
   the grants list + detail page (labels via `CLASSIE_SUBJECTS`/`SDGS` in `classie.ts`).

### Step 5 — Phase 6 (the differentiator, not yet built)
Award-history join: view over `grant_opportunities` × historical awards
(`gs_relationships` grant/funding rows, `austender_contracts`, `justice_funding`)
by funder/category/sector → "N similar grants awarded · past winners · your odds"
on the grant detail page, feeding an extra signal into the Phase-1 scorer. See
`grant-finder-overhaul.md` §Phase 6. Respect premium gating (buyer-wedge).

## Guardrails
- After any `.ts`/`.tsx` edit: `cd apps/web && npx tsc --noEmit`.
- Run under `tsx` (not `node`) for scripts importing `packages/grant-engine/src/*.ts`
  (scout, classify-grants-classie) — both agent registries already updated.
- Stay inside the buyer-wedge (`docs/strategy/buyer-wedge.md`): deepen, don't widen.
- Nothing here widens data; it deepens matching, trust, and taxonomy.
