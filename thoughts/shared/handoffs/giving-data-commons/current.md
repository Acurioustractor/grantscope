---
date: 2026-06-06T22:36:04Z
session_name: giving-data-commons
branch: codex/australian-giving-data-commons
status: active
---

# Work Stream: giving-data-commons

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-06-08T04:45:00+10:00
**Goal:** Buyer wedge: "free open registry for everyone; paid evidence + tender tools for buyers" (`docs/strategy/buyer-wedge.md`, decided 2026-06-08). Run `/wedge` before building anything SE/procurement/giving. Moves 1+2 SHIPPED, 3 waiting on Ben, 4 nearly done, 5 (widening pause) ACTIVE.
**Branch:** main (everything pushed @ d619bbe, working tree clean)
**Test:** cd apps/web && npx tsc --noEmit && npx vitest run

### Now
[->] Session COMPLETE — no work in flight. Wedge scoreboard: 1✓ wedge picked · 2✓ /suppliers shipped · 3 NIAA pack waiting on Ben (named contact + PDF) · 4 profile-page tier badges remain · 5 widening paused.

### This Session (2026-06-08 — the big one)
- [x] **Chain→parent-ABN mapping**: `data/chain-parent-abns.json` (30 verified entries) + `scripts/apply-chain-parent-abns.mjs`. 40 ABNs applied (25 SA + 15 VIC). Salvos SA = 13320346330 (ABR business name), Blackwood Goodwill+Lifeline = same shop = Uniting Communities, Thrifty V = Lyell McEwin Volunteer Assoc
- [x] **Grant ingests live + scheduled daily**: `ingest-grantconnect-go.mjs` (CloudFront 403 is UA-gating only — 133 open federal GOs) + `ingest-vic-grants-open.mjs` (Tide ES proxy, 32 VIC). Pool 322 → 367 open dated non-ARC. Dead ends: QLD Grants Finder auth-gated SPA; SA Akamai-walled (per-tenant SmartyGrants only)
- [x] **VIC classifier pass**: pre-filter widened for MCD vocabulary (+97 candidates nationally); 20 inserted ≥0.85, 15/20 with ABN. Registry 11,860 rows
- [x] **STRATEGY CHECKPOINT → buyer wedge decided** (`docs/strategy/buyer-wedge.md`). Verified white spaces: nobody links supplier profiles to AusTender/funding evidence; nobody does open need-first search. GrantGuru deep-dive: hand-curated anti-scraping moat (erodes under LLM extraction), council white-label GTM validates a council-embed product, $3,500/yr = Pro/consultant tier
- [x] **Skills built**: `/wedge` (strategy guardrail, has move-status table) + `/lighthouse` (buyer prospecting). Agents: `compute-se-verification-tiers` (v2: statutory cross-check vs acnc_charities/oric_corporations elevates ABN-matched rows), `scout-se-buyers` (austender → se_buyer_prospects, 374 buyers), `build-se-search-index`
- [x] **Tiers live**: certified 7,025 / verified 3,813+ / identified ~1,022. Tiers + search-index scheduled daily 24h
- [x] **NIAA lighthouse pack** (`thoughts/shared/prospects/niaa/` + PIPELINE.md): $72.9M/364 contracts/132 suppliers evidence one-pager, draft email, demo scenario verified (recruitment/ACT → First People Recruitment Solutions #1, their own 50-contract supplier). Why NIAA: IPP steward = multiplier. Pool is FEDERAL (AusTender) — VIC/SA SPF buyers need a state-tenders ingest (gated behind /wedge)
- [x] **Goods twin-engine understood + registered**: ACT Pty Ltd (ABN 36697347676) **trades as "Goods on Country"** — registry row inserted (identified, self-registered). **The Butterfly Movement Ltd (22155132684) = Goods DGR home — Item 1 DGR + PBI since 2012, "TABOO Foundation" = business name same ACN, stewardship handover 26 Jun 2026, Indigenous-led board** — registry row at verified (ACNC cross-check), cross-linked in both sources jsonb. DGR grants → Butterfly; procurement → Pty. Memory updated (project_act_business_model)
- [x] **ACT-context sync fixed**: template inside `act-global-infrastructure/scripts/sync-act-context.mjs` had drifted (said ABN PENDING, no Butterfly) — fixed + synced to 7 repos. Infra repo has LOCAL commit `3d87c2b` NOT pushed; 6 other repos have uncommitted CLAUDE.md updates
- [x] **MOVE 2 SHIPPED — `/suppliers` need-first search**: `se_search_index` (capability_text = AusTender contract titles per ABN, weighted tsvector) + `search_suppliers` RPC (tier + evidence boosts) + SSR page (tier badges, evidence lines, claim-CTA, tender-pack CTA). Verified: "beds" → GEBIE Civil (44 contracts) + ALPA on revealed capability, Goods on Country surfaces. `/giving/suppliers` 308-redirects with query forwarded

### Next
- [ ] **Ben (human)**: NIAA — find named IPP/procurement contact, render one-pager to PDF (re-verify figures same day), send. Then PIPELINE.md → contacted
- [ ] **Ben (human)**: logged-in tender-pack e2e on :3003 (procurement-tier session) — still the standing UNCONFIRMED
- [ ] **Ben (human)**: push infra repo local commit `3d87c2b`; check 6 other repos' uncommitted CLAUDE.md syncs
- [ ] Move 4 finish: tier badges on `/social-enterprises/[id]` profile pages (same TierBadge pattern as /suppliers)
- [ ] /wedge question pending: state-tenders ingest (Buying for Victoria / SA Tenders) to unlock VIC/SA lighthouse prospects — evidence-depth work, needs the ask
- [ ] Goods grant-match demo: run se-grant-match against the twin-engine pair (DGR-required → Butterfly 22155132684, rest → Goods on Country 36697347676)
- [ ] PAUSED per move 5: NSW/QLD/WA/ACT classifier passes (~100 candidates, cache makes them cheap when unpaused); GrantConnect /fo/list forecast XHR; QLD/SA grant headless scrapers

### Decisions
- **Buyer wedge** (2026-06-08): free open registry / paid buyer tools. Overruling = update buyer-wedge.md FIRST. Widening PAUSED (scheduled agents exempt)
- **Lighthouse = NIAA first** via IPP angle (mandatory federal targets + 80%-Indigenous registry beats VIC SPF until state-tenders ingest exists). Defence + Services Australia held
- **Tier = strength of external verification, not SE-ness**; v2 statutory cross-check (ABN in acnc_charities/oric → verified) regardless of source
- Evidence beats badges; tags/certs are signals NOT gates (north-star memory)
- Outreach: drafts only, Ben sends (Tier 3); every outbound claim traces to a queryable row
- LLM verdict caching (append-only JSONL) = standard for classification scripts; entity-type blocklist on top of LLM verdicts
- SA tender-pack honestly states no mandated SE weighting — credibility beats overclaiming

### Open Questions
- UNCONFIRMED: tender-pack logged-in e2e (page 200 + API 401-gates verified; full flow needs Ben's session)
- UNCONFIRMED: NIAA turf sensitivity (private evidence layer over THEIR policy) — counter: open registry, attribution-first, we issue no marks

### Gotchas (active)
- **DB outages recur around 3am AEST** (ECHECKOUTTIMEOUT both pooler modes + REST): suspect nightly MV refresh cron + other session's ingest. Back off, retry in minutes
- Another ACTIVE session on `claude/scraping-funding-orgs-TeFjK` (community-directory ingest) — check before touching scraping/ingest code; community_directory_orgs is read-only to us
- psql `\o` redirect swallows `UPDATE n` status tags — parse both channels (bit us once)
- `array_to_string` is not IMMUTABLE — can't live in generated columns (pre-join text in build scripts)
- `scripts/lib/psql.mjs` swallows SQL errors; gsql/raw psql to see them. gsql REST also dies during DB saturation
- social_enterprises UNIQUE is (name, state) NOT abn; grant_opportunities upsert target = unique non-partial url index
- Auto-mode classifier blocks --live/mass updates + agent_schedules inserts + CLAUDE.md-rewriting scripts without explicit user approval of THAT action
- LLM free tiers exhaust after ~50-80 classification calls — verdict cache + re-run
- Dev server port 3003 (`lsof -ti:3003`); cold compile ~18s, curl timeouts ≥30s

### Workflow State
pattern: buyer-wedge-execution
phase: 2 of 5 moves shipped
total_phases: 5 (wedge moves)
retries: 0
max_retries: 3

#### Resolved
- goal: "build the agent and skills to do this [5-move plan]" — moves 1+2 shipped, 3 machinery done, 4 nearly, 5 active
- resource_allocation: balanced

#### Unknowns
(none blocking)

#### Last Failure
(none)

---

## Context

Full strategy and provenance: `thoughts/shared/research/2026-06-07-social-enterprise-commons-review.md`
Strategy doc (source of truth): `docs/strategy/buyer-wedge.md`
North-star memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_supply_base_evidence_layer.md`
ACT/Goods entities memory: `~/.claude/projects/-Users-benknight-Code-grantscope/memory/project_act_business_model.md`
NIAA prospect pack: `thoughts/shared/prospects/niaa/` · pipeline: `thoughts/shared/prospects/PIPELINE.md`
