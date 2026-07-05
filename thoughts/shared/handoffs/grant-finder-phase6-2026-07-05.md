# Handoff — Grant-Finder Phase 6: award-history join (the differentiator)

**Date:** 2026-07-05 · **Branch:** `claude/codebase-main-goal-i5bhs3`
**For:** a Claude Code session in the real codebase (has `.env`, DB creds, network).
**Predecessor:** `grant-finder-overhaul-2026-07-05.md` (Steps 0–4) — now DONE. Full plan:
`docs/strategy/grant-finder-overhaul.md` §Phase 6.

## What is now done (this session, 2026-07-05)

Phases 1–5 were already committed. This session finished the go-live + deferred UI:

| Item | State |
|---|---|
| Baseline (typecheck + 31 grant-engine tests) | ✅ green |
| Dry-runs (runbook §B 1–4) | ✅ matching parity `1/1 semantic`, close-stale (both reasons), QLD CKAN no-truncation |
| CLASSIE migration `20260704000000_grant_classie.sql` | ✅ applied to prod (`classie_subjects/_populations/sdg_codes/_method/_classified_at` + 3 GIN indexes) |
| Close-stale (live) | ✅ 1,560 grants closed, 0 stale remaining |
| Embedding backfill | ✅ no-op — 25,586/25,586 already embedded |
| CLASSIE classify (live, deterministic) | ✅ **20,394 grants tagged** via category map ($0, no LLM). 5,024 "no-signal" left for the optional `--llm` pass by design |
| Step 4 UI — `/health` source panel + CLASSIE badges/filter | ✅ built, typecheck clean, committed |

**Commits (NOT yet pushed — Tier 2, needs Ben):**
- `51b4526 fix(grants): CLASSIE classify write path + paginated fetch`
- `43be7ad feat(grants): CLASSIE facets UI + per-source health panel`

### Two bugs found + fixed in `scripts/classify-grants-classie.mjs`
1. **Wrote 0 rows on the live path** — used bulk `.upsert({onConflict:'id'})` whose
   INSERT attempt violated the `name` NOT-NULL constraint (payload carries only
   classie fields). Dry-run masked it (no writes). Now per-row `.update().eq('id')`
   in bounded-concurrency (25) chunks.
2. **`--limit` silently capped at 1000** by PostgREST, and newest-first ordering
   kept re-fetching the same top 1000 — starving ~19K older-but-mappable grants
   behind unmappable recent ones. Now paginates via `.range()`.

## Still open (not blocking Phase 6, but note)
- **Not pushed.** `git push` when ready (Tier 2). No PR opened.
- **`/health` source panel shows empty** until a live scrape logs `agent_runs`
  `source:*` rows (none exist yet). The panel + classifier are wired and empty-safe;
  run `npx tsx scripts/scrape-state-grants.mjs --state=qld` (live) to populate it.
- **GrantConnect GA feed (runbook §B5)** needs a weekly export URL
  (`GRANTCONNECT_GA_EXPORT_URL`); local `data/grantconnect/ga-weekly-export.csv` is empty.
- **5,024 grants** unclassified-no-signal — optional `--llm` pass
  (`classify-grants-classie.mjs --llm`, needs `ANTHROPIC_API_KEY`, costs $).
- **Live CLASSIE UI smoke-test not run** — code is typecheck-clean + diff-reviewed but
  not exercised in a browser. `/grants` now has real `classie_subjects` data to render;
  worth an eyeball: `npx next dev --turbopack -p 3003` → `/grants`, `/grants/[id]`, `/ops/health`.

---

## Phase 6 — build the award-history join (~4–5 d)

**The market gap / differentiator.** Turn "here's a grant" into "here's a grant, and
here's who's won this kind of money before + your realistic odds." Everything it needs
now exists in the DB.

### Data sources for historical awards
| Table | Award signal | Key columns |
|---|---|---|
| `gs_relationships` (1.08M) | grant/funding edges | `source_entity_id`, `target_entity_id`, `relationship_type` (filter to grant/funding types), `amount`, `year`, `dataset` |
| `austender_contracts` (770K) | gov contracts | `buyer_name`, `supplier_name`, `supplier_abn`, `contract_value`, `contract_start` |
| `justice_funding` (71K) | justice grants | `recipient_name`, `recipient_abn`, `program_name`, `amount_dollars`, `state`, `financial_year`, `sector`, `topics[]` |

Join key candidates: **funder/provider name** (grant `provider` ↔ award funder), plus
**category/sector** and the new **`classie_subjects` / `sdg_codes`** facets (now populated
— use them as the interoperable join axis rather than the weak `categories`).

### ⚠ Data-layer feasibility (probed live 2026-07-05 — read before building)

A quick probe of the join changed the recommended approach. **Don't build the
award $-history off `gs_relationships` naively.** Findings, using Paul Ramsay
Foundation Ltd (`gs_entities.id = 92edb50b-b111-45a8-b697-0354410b2d2d`) as the test funder:

- The join concept is sound: the funder has 108 `grant` edges → 79 distinct recipients.
- **But amount and recipient live on different edges.** The high-$ edges
  ($2.1M, $1.75M, …, $15.15M total) are **self-loops** (`source_entity_id = target_entity_id`,
  `year` NULL) — ACNC-style "total grants made" attached to the funder itself.
  The 79 edges to **real** recipients all have `year` but **0 of 79 have `amount`**.
  → From `gs_relationships` you can get *who won + when*, NOT *who won how much*.
  Always filter `source_entity_id <> target_entity_id` or the "past winners" list
  is just the funder repeated.
- **Funders fragment** — "Paul Ramsay Foundation" resolves to 6+ entities (ABN entity,
  holding co, several `GS-PROG-*` program entities). Joining on funder needs canonical
  resolution (or fuzzy name match); this is the real entity-resolution cost of Phase 6.
- **`justice_funding` is the clean $-source** (157K rows: 100% `recipient_name`,
  96% `amount_dollars`, 93% `financial_year`, 81% `gs_entity_id`-resolved, + `topics[]`).
  `austender_contracts` similarly has clean `supplier_name`/`contract_value`/dates.

**Revised approach:** build the award **$-history** primarily from `justice_funding`
+ `austender_contracts` (clean recipient+amount+year), keyed by sector / `topics[]` /
the new `classie_subjects`. Use `gs_relationships` only to enrich the *recipient list*
and funder→recipient existence (self-loops excluded), not for dollar figures. Wire the
funder match to CLASSIE subject as the interoperable join axis.

### Build steps
1. **View/MV** `grant_award_history` (or a function) that, per funder + category/CLASSIE-subject,
   aggregates historical awards: `n_awards`, `total_awarded`, `median_award`,
   `distinct_recipients`, top-N `past_winners` (name + amount + year). Prefer an MV +
   nightly refresh if it's heavy (see `scripts/refresh-views-v2.mjs` + pg_cron pattern in CLAUDE.md).
   **Watch:** `gs_relationships`×`gs_entities` ILIKE JOINs time out (see memory) — resolve
   entity IDs first, aggregate set-based, don't ILIKE on the 1M-row join.
2. **Detail page** `apps/web/src/app/grants/[id]/page.tsx` — add a "Who's won this before"
   card: "N similar grants awarded · typical recipient profile · past winners". **Respect
   premium gating** per the buyer wedge (`docs/strategy/buyer-wedge.md`, or `/wedge`) — the
   open registry is free; deep evidence like this is buyer-tier. Check how existing
   premium/gated sections gate before adding.
3. **Scorer signal** — feed "realistic odds" into the Phase-1 scorer
   (`packages/grant-engine/src/grant-matching.ts:scoreGrantsForOrg`) as an extra signal
   (e.g. down-weight grants whose past winners look nothing like the org, up-weight
   repeat-funder fits). Keep it one more factor, don't rewrite the scorer.
4. **Verify:** pick a known repeat-funder grant, confirm the past-winners surface and match
   the underlying `gs_relationships`/`justice_funding` rows. Add a unit test for the
   odds/aggregation logic in `packages/grant-engine/`.

### Optional data widen (deferred into Phase 6 deliberately)
`data-gov-au-grants-awarded` — the structured **Grants Awarded** datastore (distinct from
the `package_search` discovery we already do). Needs a target awards schema + entity
resolution. Only pursue if the in-DB sources above prove too thin; **data widening is
paused** per CLAUDE.md — deepen first.

## Guardrails
- Verify schema before querying — `data/schema-cache.md`, or
  `information_schema.columns`. Never guess columns (CLAUDE.md Rule #2).
- After any `.ts`/`.tsx` edit: `cd apps/web && npx tsc --noEmit`.
- Run scripts importing `packages/grant-engine/src/*.ts` under `tsx`, not `node`.
- SELECTs via `scripts/gsql.mjs`; DDL/migrations via `psql -f`. **Migration-apply is
  blocked in auto-mode** (settings deny on `mcp__supabase__apply_migration` — a chat "go"
  can't override it; use dashboard SQL editor or a user-run `! psql -f`). The shared DB
  also throws transient `ECIRCUITBREAKER`/`ECHECKOUTTIMEOUT` under multi-tenant load —
  retry after a minute; it's not auth.
- Stay inside the buyer wedge: Phase 6 is exactly the paid-evidence depth the strategy wants.
