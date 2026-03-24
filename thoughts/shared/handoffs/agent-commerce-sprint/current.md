---
date: 2026-03-22T06:50:00Z
session_name: agent-commerce-sprint
branch: main
status: active
---

# Work Stream: agent-commerce-sprint

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-22T18:00:00Z
**Goal:** CivicGraph agent commerce — fully shipped, polished, and monitored
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] Session complete — ready for next work stream

### This Session (2026-03-22, session 5)
- [x] Pushed 037f747 to remote
- [x] Alice Springs provider entities resolved — CAAC name fixed, CAYLUS=Tangentyere division, MCSCA+ACF already exist
- [x] Alice Springs ALMA linkage 10/17 → 13/17 (76%) — CAYLUS, Night Patrol, Youth Diversion linked
- [x] Diary linker v2: 167→220 links (44.2% of external meetings) — 60+ aliases, short-name matching, better internal filtering
- [x] Graph storytelling layer: dynamic `computeInsights()`, stat cards, callouts, Alice Springs story
- [x] Committed as 63b35e9, pushed to remote

### Previous Session (2026-03-22, session 4)
- [x] npm token revoked, diary NLP linker (5→167 links), ALMA graph mode, youth justice report fix
- [x] Sign-up flow + entity profile page verified

### Previous Session (2026-03-22, session 3)
- [x] MCP server v1.1.0, admin dashboard, usage alerts, diary scraper (1,728 meetings)

### Previous Session (2026-03-22, session 2)
- [x] API keys, npm publish, domain migration, usage dashboard, 3-tier pricing

### Previous Session (2026-03-21)
- [x] Unified search, Agent API (6 actions), storefront, MCP server, playground

### Next
- [ ] Stripe: create products in dashboard, set 7 env vars (BLOCKED — manual)
- [ ] Oonchiumpa: funding flow visualization, media package
- [ ] Ministerial diary graph mode (show minister→org meeting network)
- [ ] Push diary linker further (44.2% → 55%+ with more aliases + fallback DB search)
- [ ] Run watcher agents (board-changes, funding-anomalies) for fresh discoveries

### Decisions
- API key format: `cg_live_<32hex>`, SHA-256 hashed
- NL→SQL: OpenAI gpt-4.1-mini (MiniMax blocked from Vercel)
- npm: `civicgraph-mcp` (unscoped for simpler npx)
- Diary linker: reverse-lookup strategy (load 250K known entities, search in text) — beats regex extraction
- Diary linker v2: 15-char min for short names, word-boundary matching, context noise filter for place names
- ALMA graph mode: intervention_type → intervention → entity (3-tier graph)
- Graph insights: computed dynamically from loaded data, not static narratives
- CAAC ABN 76210591710 was stored as "Utju Health Service" (sub-clinic) — fixed to parent org name
- CAYLUS is a division of Tangentyere Council, not a separate entity

### Open Questions
- UNCONFIRMED: Stripe price IDs need creation in dashboard
- RESOLVED: All Alice Springs provider entities exist (CAAC, MCSCA, ACF, CAYLUS=Tangentyere)

### Workflow State
pattern: sequential-build
phase: complete
total_phases: 10
retries: 0
max_retries: 3

#### Resolved
- goal: "Make CivicGraph agent API commercially viable"
- resource_allocation: aggressive

#### Unknowns
- stripe_price_ids: need to create in Stripe dashboard

#### Last Failure
(none)

---

## Context

### What Was Built (4 sessions)
Session 1: core agent commerce (search, API, storefront, MCP server). Session 2: API keys, npm publish, domain migration, usage dashboard. Session 3: MCP v1.1, admin dashboard, usage alerts, diary scraper. Session 4: NLP diary linker (162 links), ALMA graph mode, youth justice report fix.

### Key New Files (Session 4)
| File | Purpose |
|------|---------|
| `scripts/link-ministerial-diary-nlp.mjs` | NLP entity linker — reverse-lookup, OCR fixes, alias map, 162 links |
| `apps/web/src/app/api/data/graph/route.ts` | Added ALMA graph mode (~130 lines) |
| `apps/web/src/app/graph/page.tsx` | ALMA mode type, "Alice Springs Youth" preset |
| `apps/web/src/app/reports/youth-justice/page.tsx` | Null safety fix for NDIS overlay |

### Diary Linker Details
- **Strategy**: Load ~250K entity names into memory map, search diary text for matches
- **Manual alias map**: QPS→Queensland Police Service, BHP→BHP Group Limited, etc.
- **OCR fixer**: Common space-insertion artifacts ("Andr ew Forrest" → "Andrew Forrest")
- **Internal meeting filter**: Excludes Hon X MP, Cabinet Ministers, Director-General, etc.
- **Result**: 162 new links (5→167), 21.7% of external meetings linked
- **Room for improvement**: fuzzy matching, more aliases, OCR dictionary

### ALMA Graph Mode
- New `mode=alma` in graph API — queries `alma_interventions` LEFT JOIN `gs_entities`
- 3-tier graph: intervention_type hubs → intervention nodes → entity nodes
- Also queries `gs_relationships` for inter-entity funding connections
- "Alice Springs Youth" preset with `state=Alice Springs` filter
- 32 nodes, 30 edges for Alice Springs

### Production State
- **civicgraph.app** — live, all endpoints verified
- **npm**: `civicgraph-mcp@1.1.0` published
- **Diary links**: 167 total (was 5)
- **Commit 037f747**: 1 ahead of origin/main — needs push
