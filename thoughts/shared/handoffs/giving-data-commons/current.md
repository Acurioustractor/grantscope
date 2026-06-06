---
date: 2026-06-06T22:36:04Z
session_name: giving-data-commons
branch: codex/australian-giving-data-commons
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-07T09:45:00+10:00
**Goal:** Open national registry + evidence layer for Australia's social enterprise supply base, built on the Giving Data Commons. Done when Phases 1-4 shipped: dataset public, profiles evidenced, buyer loop live, grants flywheel + claim-your-profile working.
**Branch:** main (feature branch merged via PR #55 and deleted)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] Stream complete + repo clean. Next up (pick one): fuzzy/API ABN pass for 1,911 unmatched SEs, or state-directory re-scrape

### This Session
- [x] Giving Data Commons committed + migration applied (data_catalog public metadata, data_corrections table, /giving pages, open API envelope)
- [x] Deep review: 5 SE directories + landscape → strategy doc `thoughts/shared/research/2026-06-07-social-enterprise-commons-review.md`
- [x] Phase 1: social_enterprises registered as public Commons dataset (giving-commons.ts entry cascades to /giving pages + export API; catalog migration `20260607000000` applied)
- [x] Phase 1: ABN backfill 8,410 → 8,735 (`scripts/backfill-se-abns.mjs`, 325 matches via gs_entities + abr_registry)
- [x] Deleted 144 junk SE rows (sasec/wasec/qsec nav-link scraper artifacts; backup `data/backups/2026-06-07-social-enterprises-junk-rows.csv`). Table: 10,646 rows
- [x] Phase 2: evidence-enriched SE profiles (`social-enterprises/[id]/page.tsx`) — AusTender contracts, grant funding, place context, verification marks; fixed pre-existing crashes (sources object-shape 7K rows, certifications string-elements 6.8K rows)
- [x] Phase 3: buyer loop — analyse endpoint returns named SE recommendations; tender-pack overlays SE registry + policy inserts (`lib/social-procurement.ts`: Vic SPF/Buy Qld/NSW/IPP); public `/giving/suppliers` finder
- [x] Restored `/continuity_ledger` skill from 2026-05-01 pruning archive (refs in CLAUDE.md/permissions/hook were never cleaned)
- [x] All pushed to origin through `200ad6f`
- [x] Phase 4a: Open Funding Matches on every SE profile (`lib/services/se-grant-match.ts` + section in `social-enterprises/[id]/page.tsx`) — sector→category + geography match, verified e2e on Indigenous QLD + no-ABN VIC profiles (commit `aafde29`, local only)
- [x] Phase 4b: "Claim This Profile" CTA (yellow sidebar block) on every SE profile → `/giving/corrections?target_type=social_enterprise&target_id=…&claim_url=…`; no-ABN correction link carries same params (same commit)

### Next
- [x] Pushed + PR #55 merged to main (`d4dfcf6`)
- [x] CI failure on main fixed: stale rpc mock in `entity-service.test.ts` (PR #37, `893680a`) — main CI fully green (221/221)
- [x] Branch cleanup: 29 merged/superseded refs deleted (12 local + 17 remote), each verified by content. Kept: claude/scraping-funding-orgs-TeFjK (active other session), curious-tractor-thesis, codex/goods-civicgraph-signoff, wip/working-tree-snapshot-2026-04-24, recovered/civicscope-may22-features
- [ ] Fuzzy/API ABN pass for remaining 1,911 unmatched SE records (ABN_LOOKUP_GUID in .env; phases 1-2 of backfill-se-abns.mjs were exact/variant only)
- [ ] Re-scrape state network directories properly (SASEC/QSEC behind login walls — the deleted junk came from crawling nav menus)
- [ ] Grant pool is thin: only ~322 open non-ARC grants tracked. Grants flywheel improves as discovery agents widen coverage (matching layer is done)

### Decisions
- Positioning: "open national registry and evidence layer for Australia's social enterprise supply base" — tags/certifications are signals, NOT gates (Ben rejected exclusive directory model; memory: project_supply_base_evidence_layer)
- Public framing: "Social & Indigenous Enterprises" — 9.5K of 10.6K rows are Supply Nation/ORIC; not all are certified SEs. Caveat baked into dataset metadata
- Evidence beats badges: AusTender contract history = revealed capability (1,135 SEs hold $15.6B); rank search results by delivery evidence
- Goods on Country = archetype buyer journey ("buy a bed" → evidence profile)
- Match SE ABNs against gs_entities FIRST, then abr_registry (legal names differ from trading names; abr partial index needs status='Active')

### Open Questions
- UNCONFIRMED: procurement analyse/tender-pack changes compile + auth-gate (401 verified) but full e2e needs a logged-in session with procurement module

### Phase 4a data findings (verified 2026-06-07)
- `target_recipients` is junk for filtering: 4,630 of 4,946 values are universities/researchers; rest is inconsistent free text → matched on `categories` instead
- `source='arc-grants'` = 4,335 of 4,657 open grants (ARC research-project scrape, never SE-eligible, often NULL target_recipients + junk auto-categories) → hard-excluded in matcher
- Eligibility booleans (accepts_pty_ltd etc.) only on 182 open grants — too sparse to use yet
- Indigenous-targeted grants dominate the non-ARC pool → matcher only surfaces them for SEs with Indigenous signal (sector/org_type/ICN) or shared mission sector
- Multiple supabase-js `.or()` calls AND together (each is a separate PostgREST `or=` param) — verified, zero filter leaks on 200-row sample

### Gotchas (rediscovered this session)
- `scripts/lib/psql.mjs` swallows SQL errors silently → returns [] like an empty result. Re-run failing SQL via gsql/raw psql to see errors
- No `COUNT(DISTINCT x) OVER (...)` in Postgres — use GROUP BY + HAVING COUNT(*) = 1
- `social_enterprises.sources` jsonb has TWO shapes (array | object-keyed-by-source); `certifications` elements are mostly strings not objects
- Dev server may still be running on :3003 (`lsof -ti:3003` to check/kill)

### Workflow State
pattern: phased-feature-build
phase: 4 (complete)
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "Open SE registry + evidence layer, Phases 1-4" — ALL PHASES SHIPPED
- resource_allocation: balanced
- grant_opportunities.target_recipients taxonomy: junk — matched on categories + source exclusion instead

#### Unknowns
(none)

#### Last Failure
(none)

---

## Context

Full strategy and provenance: `thoughts/shared/research/2026-06-07-social-enterprise-commons-review.md`
North-star memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_supply_base_evidence_layer.md`

Key files this stream:
- `apps/web/src/lib/giving-commons.ts` — PUBLIC_DATASETS registry (one entry cascades everywhere), COMMONS_NAV
- `apps/web/src/lib/social-procurement.ts` — jurisdiction policy inserts
- `apps/web/src/app/giving/**` — commons pages incl. new `suppliers/page.tsx`
- `apps/web/src/app/social-enterprises/[id]/page.tsx` — evidence profile
- `apps/web/src/app/api/procurement/{analyse,tender-pack}/route.ts` — buyer loop
- `scripts/backfill-se-abns.mjs` — re-runnable ABN backfill (dry-run default, --live)

Verified numbers (2026-06-07): social_enterprises 10,646 rows / 8,735 with ABN (82%); 1,135 SEs hold 13,398 AusTender contracts worth $15.6B; 636 SEs received $2.0B tracked grants; 8,410 matched to gs_entities.
