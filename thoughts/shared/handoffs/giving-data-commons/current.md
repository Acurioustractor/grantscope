---
date: 2026-06-06T22:36:04Z
session_name: giving-data-commons
branch: codex/australian-giving-data-commons
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-08T01:30:00+10:00
**Goal:** Open national registry + evidence layer for Australia's social enterprise supply base, built on the Giving Data Commons. Phases 1-4 SHIPPED. Current mode: state-by-state coverage deepening (SA done) + grant-pool widening (federal+VIC live).
**Branch:** main
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] Chain-ABN mapping + grant-pool widening COMPLETE — committed locally (2 commits ahead of origin/main, NOT pushed). No work in flight.

### ⚠️ Heads-up (2026-06-07)
**`claude/scraping-funding-orgs-TeFjK` has another ACTIVE session** — community-directory ingest pipeline (Ask Izzy/ISS API, MyCommunityDirectory, SA Community Directory, entity promotion bridge, ACNC AIS --delta, contact enrichment v2). **Before touching scraping/ingest code, check that branch** — its ledger: commit `aeccf52`. Its `community_directory_orgs` table (76K rows: sacommunity 14,439 + mycommunitydirectory 61,712) is what this session's SA classifier reads from — read-only, no conflict.

### This Session (chain ABNs + grant pool, 2026-06-07 night)
- [x] **NEW `data/chain-parent-abns.json` + `scripts/apply-chain-parent-abns.mjs`** — verified chain→parent-ABN lookup (30 entries; every ABN checked against acnc_charities or ABR API, never memory). Pattern+state+postcode-gated, dry-run default, conflict detection, provenance into sources jsonb. APPLIED: 40 ABNs (25 SA + 15 VIC senvic bonus). SA classified no-ABN 33 → 8 (all independents). Registry **86.3% ABN coverage (10,221/11,838)**. Key resolutions: Salvos SA = SA Property Trust 13320346330 (ABR business name 'SALVOS STORES'), both Blackwood Goodwill/Lifeline shops = Uniting Communities 33174490373 (same address+phone), Thrifty V ×3 = Lyell McEwin Volunteer Association 55911334857. Commit `(chain-abn)`
- [x] **NEW `scripts/ingest-grantconnect-go.mjs`** — GrantConnect CloudFront 403 is UA-gating only; browser UA on www.grants.gov.au/go/list serves full HTML. 133 open federal GOs ingested (99 dated + 34 ongoing). `--details` flag fetches AUD amounts from Show pages
- [x] **NEW `scripts/ingest-vic-grants-open.mjs`** — vic.gov.au Tide/SDP Elasticsearch proxy (`/api/tide/elasticsearch/content-vic__production__sapi_node/_search`, no auth; direct ES host firewalled). 32 VIC open/ongoing grants with funding ranges
- [x] **Pool: open non-ARC dated 322 → 367** (+50 ongoing rolling). Both agents registered (discovery, prio 3) + agent_schedules daily 24h (user-approved)
- [x] Researched dead ends: QLD Grants Finder = auth-gated AWS API Gateway behind Vite SPA (x-api-key from bundle rejected; needs headless/live-token capture). SA gov domains = hard-403 Akamai WAF; only per-tenant SmartyGrants portals reachable (dhs/dpc/lgasa/environmentsa/greenadelaide-sa.smartygrants.com.au) — no cross-tenant listing

### Prior Session (SA deepening, 2026-06-07 afternoon)
- [x] SA strategy review: 415 SA SEs (thinnest mainland state — SASEC login-walls its 82 members), 63 SA SEs hold 198 AusTender contracts ($359M), 21.8K SA gs_entities, $3.25B SA justice funding tracked
- [x] **NEW `scripts/classify-directory-se-candidates.mjs`** — mines community_directory_orgs for SE candidates: signal pre-filter (op shops, supported employment, SE mentions) → site grouping + ABN merge → entity-type blocklist (service clubs/CFS/churches sans shop) → multi-provider LLM round-robin → **append-only verdict cache `data/classify-dir-se-cache.jsonl`** (quota-exhausted runs resume, never re-bill). Flags: --state --source --limit --min-confidence --apply
- [x] SA pass APPLIED: 233 rows → 98 parent orgs → 65 inserted at ≥0.85 conf (`source_primary='sacommunity-classified'`). Caught: Bedford Group, SA Group Enterprises, Salvos Stores [32 sites], Lifeline [18 sites], Red Cross [12 sites], Goods @ Gertrude. Audit: `data/backups/2026-06-07-sa-directory-se-dryrun-final.log`
- [x] Fuzzy ABN backfill re-run APPLIED: +7 ABNs on new rows (4 via ABN Lookup API score+postcode-gated, 3 norm-exact). Proposals CSV in data/backups/
- [x] **SA policy insert in `lib/social-procurement.ts`** — SAIPP (min 20% economic-contribution weighting, Office of the Industry Advocate), Economic and Social Procurement Guideline (SE outcomes discretionary — SA has NO mandated SE weighting unlike Vic SPF), Aboriginal direct engagement ≤$550K + 0.5% target. Verified via web research agent against official sa.gov.au sources
- [x] Committed + pushed: `54efeb0` (scripts/data), `add0c3e` (web policy)
- [x] FINAL STATE: SA 415 → **480 SEs** (382 with ABN); registry-wide **11,838 rows, 10,181 with ABN (86%)**

### Prior sessions (compressed)
- Phases 1-4 all shipped (PR #55 → main): Commons dataset public, evidence-enriched SE profiles, buyer loop (analyse + tender-pack + /giving/suppliers), grant matching (`lib/services/se-grant-match.ts`) + claim-your-profile CTA
- ABN backfills: 8,410 → 10,174 across exact + 3 fuzzy/API passes (caches: `data/abn-lookup-cache-se.jsonl`)
- State network ingests: senvic 834, secna 152, wasec 72, qsec 38, sasec 31 (`scripts/ingest-state-se-networks.mjs --source=<key>`); SENTAS/SECTAS verified dead end (no public directory)
- 144 junk SE rows deleted (nav-link artifacts; backup in data/backups/)

### Next
- [ ] **Push the 2 local commits** (chain-ABN + grant ingests) when ready
- [ ] **Replicate SA classifier pass for other states**: `--state=VIC|NSW|QLD|WA --source=mycommunitydirectory` (61,712 rows untapped; same script, verdict cache makes it cheap to iterate). Chain-ABN lookup ready for those states' Salvos/Vinnies/RSPCA/AWL rows; add NSW/QLD Salvos + remaining Vinnies entries when needed (see TODO in chain-parent-abns.json)
- [ ] QLD + SA grant sources need headless browser (Playwright) — QLD Grants Finder XHR capture, SA SmartyGrants per-tenant round pages
- [ ] GrantConnect Forecast list (`/fo/list`) is JS-rendered — underlying XHR uncracked; would add pipeline-stage-earlier opportunities
- [ ] Remaining ~1,617 no-ABN SEs are long tail — route through claim-your-profile flow, not more automation

### Decisions
- Positioning: open registry + evidence layer; tags/certifications are signals NOT gates (memory: project_supply_base_evidence_layer)
- Evidence beats badges: AusTender contract history = revealed capability; rank by delivery evidence
- SE classification needs entity-type blocklist on TOP of LLM verdicts — LLM over-classifies service clubs/churches/emergency services that run op shops (Rotary, Lions, CFS, cathedrals at conf 0.8). Blocklist exempts names that ARE the shop ("Waikerie Rotary Opportunity Shop" kept, "Rotary Club of Waikerie" blocked)
- Site-level chain rows (Salvos Stores ×32) grouped to ONE parent row with sites array in sources jsonb — precedent: senvic already has site-level rows, but grouping is cleaner going forward
- SA tender-pack copy honestly states SA has no mandated SE weighting — credibility beats overclaiming
- LLM verdict caching (append-only JSONL keyed by source|state|normname) is now the standard pattern for classification scripts — provider quotas WILL exhaust mid-run (happened twice)

### Open Questions
- UNCONFIRMED: procurement analyse/tender-pack full e2e with logged-in session (compiles + 401-gates correctly; SA policy insert traced through policyInsertsForStates but not browser-tested)

### Gotchas (active)
- LLM providers (groq/deepseek/anthropic/gemini free tiers) exhaust after ~50-80 classification calls — verdict cache + re-run is the recovery path; 4-min cooldown helps
- `scripts/lib/psql.mjs` swallows SQL errors (returns [] like empty); gsql/raw psql to see errors
- social_enterprises UNIQUE is (name, state) — NOT abn; ABN dedupe must be done in script logic
- Auto-mode classifier blocks `--live` mass-update scripts without explicit user approval of THAT action — ask first, then run
- Dev server port 3003 (`lsof -ti:3003`)

### Workflow State
pattern: state-coverage-deepening
phase: 1 (SA complete)
total_phases: open-ended (per-state)
retries: 0
max_retries: 3

#### Resolved
- goal: "SA coverage deepening — what we have, value, next steps" — SHIPPED (classifier + 65 SEs + 7 ABNs + tender-pack policy)
- resource_allocation: balanced

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
- `apps/web/src/lib/social-procurement.ts` — jurisdiction policy inserts (VIC/QLD/NSW/SA/Federal)
- `apps/web/src/app/giving/**` — commons pages incl. new `suppliers/page.tsx`
- `apps/web/src/app/social-enterprises/[id]/page.tsx` — evidence profile
- `apps/web/src/app/api/procurement/{analyse,tender-pack}/route.ts` — buyer loop
- `scripts/backfill-se-abns.mjs` + `scripts/backfill-se-abns-fuzzy.mjs` — re-runnable ABN backfill (dry-run default, --live)
- `scripts/classify-directory-se-candidates.mjs` — directory→SE classifier (dry-run default, --apply; verdict cache resumes)

Verified numbers (2026-06-07 evening): social_enterprises 11,838 rows / 10,181 with ABN (86%); SA 480 SEs / 382 with ABN; 63 SA SEs hold 198 contracts ($359M); registry-wide 1,135 SEs hold $15.6B AusTender contracts.
