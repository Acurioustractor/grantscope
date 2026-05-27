---
title: Goods Phase 1 — surface capital/procurement (discovery_method) + repeat-buyer intel
status: approved — building (2026-05-28). D1=report-only · D2=include B (minimal) · D3=Grant bucket = not-capital/procurement.
date: 2026-05-28
repo: grantscope
branch: wip/goods-phase1-discovery-surface-2026-05-28
worktree: .claude/worktrees/goods-phase1-a1b2c3
base: origin/main @ d3d19ab
related:
  - thoughts/shared/plans/2026-05-27-goods-capital-procurement-pipelines-scope.md (Phase 1 def)
  - thoughts/shared/handoffs/goods-capital-procurement-scoping-2026-05-27.md (file:line map)
---

# Goods Phase 1 — Surface what already exists

**Goal:** make the capital + procurement opportunities (already in `grant_opportunities`, tagged `discovery_method ∈ {indigenous-finance, procurement}`) and the 672K-row `austender_contracts` asset *visible* — no new ingestion. Three independent, additive, low-risk changes.

## Pre-work facts (verified this session)
- `discovery_method` is NOT selected or filtered anywhere in `/grants` (`apps/web/src/app/grants/page.tsx`). DB values seen: `indigenous-finance`, `procurement`, `grant`, plus crawler tags (`scraper`, `data.gov.au`, `open-data-api`, null).
- `FilterBar` (`apps/web/src/app/components/filter-bar.tsx`) is just a mobile-toggle wrapper; the chips render as `children` built inside `page.tsx`.
- Workbench (`goods-signals-workbench.ts:188`) joins matched grants but selects no `discovery_method`. It is **signal-centric** — capital opps (no procurement signal) don't map to a signal row.
- `austender_contracts` columns: `buyer_name`, `buyer_id`, `supplier_name`, `supplier_abn`, `title`, `category` (UNSPSC), `contract_value`, `contract_start`, `ocid`.
- `hydrate-goods-procurement.mjs` groups by **supplier** (who Goods competes with). Repeat-buyer intel groups by **buyer_name** (who to sell to) — the inverse.
- `exec_sql` RPC is PostgREST-1000-row capped → paginate at 900 (pattern already in hydrate script).

## Task A — `discovery_method` filter chip on `/grants` (S, frontend)
**Files:** `apps/web/src/app/grants/page.tsx` (only).
1. Add `discovery_method?: string | null` to the `Grant` interface (`:11`).
2. Add `'discovery_method'` to the non-semantic `grantFields` select (`:743-766`) and the semantic detail select (`:661`); carry it through the semantic `.map` (`:668-690`).
3. Add `method?: string` to `SearchParams` (`:574`); parse `methodFilter = params.method || ''` (`:~608`); add `!methodFilter` to the `isFastGrantIndex` guard (`:617`).
4. Filter:
   - non-semantic path: map chip→DB. Capital→`.eq('discovery_method','indigenous-finance')`; Procurement→`.eq('discovery_method','procurement')`; Grant→`.not('discovery_method','in','("indigenous-finance","procurement")')` OR is-null (i.e. "everything that isn't capital/procurement"). Add near the other `.eq` filters (`:792-798`).
   - semantic path: mirror with a client `.filter` (`:709-717` block).
5. Render a chip group (All · Capital · Procurement · Grant) in the filter JSX, mirroring the existing project-preset chip markup. Bauhaus styling consistent with siblings.
**Acceptance:** `?method=capital` shows only the ~6 indigenous-finance rows (IBA/NAIF/Many Rivers/ABA/ILSC…); `?method=procurement` shows Supply Nation + the 2 AusTender open-tenders; chip persists across other filters; `tsc` + `next build` clean.

## Task B — capital/procurement labels in the goods workbench (S–M, reframed)
The signals workbench can't host a "capital section" cleanly (capital opps aren't signals). Minimal honest change:
**Files:** `goods-signals-workbench.ts` + its page `org/[slug]/wiki/goods-signals/page.tsx`.
1. Add `discovery_method` to the matched-grant select (`:188`) and to the matched-grant type, so procurement-tagged matched grants render a "Procurement" label/badge.
2. Add a standalone **"Capital opportunities"** read-only panel: one extra query `grant_opportunities` where `discovery_method='indigenous-finance'` AND `goods_relevance_score >= 50`, ordered by score — listed independent of signals (IBA, NAIF, etc.). Mirrors how the page already lists matched grants.
**Acceptance:** workbench shows a Capital panel with the indigenous-finance rows + procurement matched-grants badged; `tsc` + build clean. *(If Ben prefers, defer B — A+C deliver most of the value.)*

## Task C — repeat-buyer intelligence (S, new read-only script)
**File:** `scripts/goods-repeat-buyer-intel.mjs` (new) + register in `scripts/lib/agent-registry.mjs`.
- Query `austender_contracts`, `GROUP BY buyer_name`, `WHERE (title ILIKE goods-keyword OR category goods-UNSPSC)`, ranked by `contract_count DESC, total_goods_value DESC`. Reuse `GOODS_KEYWORDS` from hydrate + the UNSPSC allowlist from `sync-austender-open-tenders.mjs` (family 56 + 5210/5212/5213/5214).
- Paginate via `exec_sql` at 900 rows.
- **Output: report-only, no DB writes this phase.** Write `thoughts/shared/reports/goods-repeat-buyers-<date>.md` + `.json` — ranked govt buyers who repeatedly purchase Goods-type products = warmest procurement targets. `--apply` flag reserved (no-op for now) so a later phase can promote top buyers into `goods_procurement_entities`/`_signals`.
**Acceptance:** script runs against the live DB, emits a ranked report (top ~30 buyers with count + $ + sample contract titles); spot-check 3 rows against `austender_contracts`; zero DB mutations.

## Build order & commits
1. Task C first (self-contained, no UI risk, highest "surface the asset" value) → commit.
2. Task A (filter chip) → `tsc` + build → commit.
3. Task B (workbench) → `tsc` + build → commit.
Each task = its own commit with `Plan: 2026-05-28-goods-phase1-discovery-surface` trailer. Then push branch + open PR (Tier 3 — on Ben's go).

## Decisions for Ben
- **D1 — Task C output:** report-only (no DB write) this phase? *(my default: yes — keep Phase 1 read-only; promote-to-CRM is a Phase-1.5/2 follow-up.)*
- **D2 — Include Task B**, or ship A+C and defer the workbench? *(my default: include B but keep it minimal — the Capital panel is the genuinely new surface.)*
- **D3 — chip "Grant" bucket semantics:** "not capital/procurement" (incl. nulls) vs only `discovery_method='grant'`. *(my default: not-capital/procurement, so nothing disappears from the default view.)*

## Out of scope (later phases)
New ingestion (Phase 3 done), capital freshness crawler + GHL Capital flow (Phase 2), NT $4B housing (Phase 4), promoting repeat-buyers into the CRM.
