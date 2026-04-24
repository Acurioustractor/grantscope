---
date: 2026-03-24T12:15:00Z
session_name: qld-accountability-tracker
branch: main
status: active
---

# Work Stream: QLD Accountability Tracker + Outcomes Infrastructure

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-27T14:00:00Z
**Goal:** CivicGraph as standalone product + ACT's operating system — revenue, community impact, accountability infrastructure
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit` + `curl http://localhost:3003/foundations/prf`

### Now
[->] Next session: Send PRF outreach email + build Indigenous Proxy Problem report (57% of Indigenous money goes to non-Indigenous orgs)

### This Session (2026-03-27, session 3)
- [x] **Entity pages as killer surface** — cross-system summary banner, govt funding, political donations, lobbying, top contracts, board interlocks, board & leadership sidebar, outcome submissions (8dd3d32)
- [x] **Search improvements** — public access (removed auth gate), system badges (PROCUREMENT/GRANTS/DONATIONS), relationship counts, relevance sorting
- [x] **Consulting Class investigation** — new report at /reports/consulting-class: $9.1B contracts, $10.5M donations, 863:1 ROI, 7 firms, donation targets, lobbying connections, "The Pattern" (Donate→Advise→Implement)
- [x] **Youth justice report fixes** — org names linked to entity pages (29 orgs), revolving door cleaned (filtered procurement noise, $100K minimum, actual YJ amounts), philanthropy filtered to real foundations
- [x] **PRF/review page links** — outcome submissions link to entity pages + "View Funding" links
- [x] **Foundation backfill** — 12 synthetic foundations linked (BHP, Rio Tinto, Fortescue, Macquarie, etc.)
- [x] **Power dynamics research** — identified 5 major untapped stories: Consulting Class (built), Indigenous Proxy Problem, Procurement Oligopoly, Charity-Industrial Complex, Most Connected People

### Previous Session (2026-03-27, session 2)
- [x] **PRF full data ingest** — 18 people (9 board, 5 exec, 4 staff/FNAC) with backgrounds, $4B endowment, giving history FY22-25, 4 programs (ecd6af9)
- [x] **Person entity pages** — "Board Seats & Positions" shows all orgs a person sits on, linked both ways
- [x] **Person network API** — structured board network replacing force graph: co-directors per org, interlock badges, case-insensitive name lookup
- [x] **PRF dashboard overhaul** — 10 sections, all cross-linked

### Previous Session (2026-03-27, session 1)
- [x] **Design system created** — DESIGN.md, Satoshi + DM Sans + JetBrains Mono wired into app (3b283c2)
- [x] **CLAUDE.md Rule #6** — architecture constraints (in-app not CLI, server components, bulk SQL, ask when unsure)
- [x] **Pre-commit type-check hook** — tsc --noEmit runs before git commit, blocks on errors
- [x] **Foundations linkage 0% → 99.9%** — added gs_entity_id to foundations, backfilled 10,824 via ABN join, fixed clarity page query (5f8b422)
- [x] **ALMA data quality cleanup** — quarantined 83 junk records, flagged 208, linked 349 more. Valid: 1,107, 99.5% linked (6f0f0a2)
- [x] **ALMA naming** — spelled out "Australian Living Map of Alternatives (ALMA)" on clarity page

### Earlier Sessions
- [x] Ian Potter grants: 9,560 scraped, 1,742 edges
- [x] Sprint 4 Outcomes Scale — COMPLETE (funding→outcomes chain, PDF ingester, 3 outcome submissions, PRF dashboard)
- [x] Sprint 1-3 — COMPLETE (Universal Linker, Place Intelligence, Foundation Intelligence)

### Commits (this session)
- `8dd3d32` feat: entity pages as killer surface + Consulting Class investigation
- `ecd6af9` feat: PRF full data ingest + person entity pages with board network

### Sprint Status

**Sprint 1: Universal Linker — DONE**
**Sprint 2: Place Intelligence — DONE**
**Sprint 3: Foundation Intelligence — DONE**
- PRF portfolio: 15 grants parsed from PDF
- Foundation notable_grants: 2,034 parsed from existing DB
- Ian Potter grants: 9,560 scraped, 1,742 edges (ran this session)
- Foundation grants auto-surface in DD Packs via justice_funding ABN join

**Sprint 4: Outcomes Scale — DONE (this session)**
- [x] Funding→outcomes linkage views (3 views + 1 MV)
- [x] PDF→outcomes auto-ingester (MiniMax M2.5)
- [x] 3 real outcome submissions (HRLC, Maranguka, NTCOSS — 21 metrics total)
- [x] 28 governed_proof_tasks seeded for 14 PRF partners
- [x] PRF Intelligence Dashboard at /foundations/prf
- [x] Portfolio outcomes API at /api/outcomes/portfolio

### Next — Product Build (90-day plan)
- [x] **Place Brief build** — DONE (5312d6b)
- [x] **Sales sprint (infra)** — DONE: batch DD Pack generator (29c564d), PRF portfolio mapped
- [x] **Watchlist alerts** — DONE (4350e1d)
- [x] **API hardening** — DONE: metering wired (c406df2), /developers page already existed
- [x] **Sales sprint (outreach)** — DONE: 12 PRF DD Pack PDFs generated (b77fe6e), outreach email drafted
- [x] **Governed Proof pilot** — DONE: full flow validated end-to-end (this session)
- [x] **Dead page cleanup** — DONE: 18 pages, 13K lines (09054a3)
- [x] **Data connectivity sprint** — DONE: universal linker, 3 datasets linked, 17 MVs fixed (32d7d0d)
- [ ] **Send PRF outreach email** — attach 12 DD Pack PDFs + link to /foundations/prf dashboard as hook
- [ ] **Indigenous Proxy Problem report** — 57% of Indigenous-tagged money goes to non-Indigenous orgs. 708 non-Indigenous orgs ($560M) vs 255 community-controlled ($424M). Build as /reports/indigenous-proxy
- [ ] **Procurement Oligopoly report** — 100 entities (0.18%) get 62% of all procurement ($675B). Defence dominates but extends to services.
- [ ] **Wire outcomes into DD Pack PDFs** — add outcomes section to due-diligence-pdf.ts
- [ ] **First contracted intelligence engagement** — $20K+ custom accountability dashboard via ACT network
- [ ] **Foundation dashboard template** — generalize /foundations/prf for Ian Potter (1,742 edges) and others

### Data Connectivity Status (post-sprint)

| Dataset | Linkage | Records | Join Key |
|---------|---------|---------|----------|
| NDIS providers | 100% | 49K | ABN |
| QGIP justice_funding | 99.8% | 101K | ABN |
| acnc_programs | ~100% | 98K | ABN |
| austender_contracts | 84.8% | 791K | ABN |
| state_tenders | 81.7% | 200K | ABN |
| justice_funding (all) | — | 148K | ABN |
| crime_stats_lga | Wired to place pages | 58K | LGA name via postcode_geo |
| acara_schools | Wired to place pages | 10K | postcode |
| dss_payment_demographics | Wired to place pages | 106K | postcode/LGA code |
| ndis_participants_lga | Wired to place pages | 8.3K | LGA code/name |
| ndis_utilisation | Not wired (service districts) | 144K | NDIS service district |
| outcomes_metrics | 0% (jurisdiction) | 9K | jurisdiction |
| foundations | 99.9% | 10.8K | ABN → gs_entity_id (backfilled 2026-03-27) |
| ALMA interventions (valid) | 99.5% | 1,107 | operating_organization → gs_entity_id |
| foundation notable_grants | Parsed → justice_funding | 2,034 | text→structured |
| PRF portfolio | Parsed → justice_funding | 15 | PDF→structured |

### Compound Dynamics (key insight)
- **ABN is the universal join key** — 18.5M ABR registry rows make any ABN-bearing dataset auto-linkable
- **Universal linker** makes future datasets connect in minutes not days
- **Once connected, every MV/report/DD Pack/Place Brief gets richer automatically**
- **Geographic datasets** (crime, schools, DSS, NDIS utilisation) need postcode/LGA joins, not entity linker — Sprint 2

### Decisions
- **CivicGraph dual role**: standalone revenue product ($499/mo funder, $1,999/mo enterprise, $20-100K contracts) AND ACT's internal operating system
- **Flywheel**: CivicGraph revenue → funds ACT mission → mission generates unique data → makes CivicGraph more valuable
- **Revenue model**: Free (community), Funder $499/mo (DD Packs, Place Briefs), Enterprise $1,999/mo (API, dashboards)
- **Bittensor**: Not now (18-24mo). Build Proof of Impact scoring within CivicGraph instead.
- **Goods/EL**: Don't kill — reconnect to CivicGraph data. EL transcripts now surface on place pages via place-brief-service.
- **Kill list EXECUTED**: scenarios, simulator, investors, pitch/*, knowledge, ask, market-scanner, funding-workspace, goods-workspace, goods-intelligence + portfolio, settings, pipeline, benchmark, start/*, profile/answers, profile/matches, for/philanthropy — ALL DELETED (09054a3)
- **PRF as first target**: $320M foundation, justice-reinvestment focus, 15 partners all in CivicGraph
- **DD Pack PDF design**: Bauhaus black/white/red, DM Sans-inspired typography
- **Governed Proof validated**: full submit→validate→bundle flow works end-to-end
- **Universal linker as compound agent**: one script, any dataset, ABN→entity→linked. Build once, benefit forever.

### Open Questions
- The Harvest: conditional proceed, but need to track how CivicGraph serves it
- Pty Ltd registration: blocks R&D tax claims, employment, proper entity structure
- PRF outreach: email drafted, need to find specific JR team lead contact
- Minderoo: what's the current engagement status via JusticeHub?
- Ian Potter grants: DONE — 9,560 scraped, 1,742 edges. Diminishing returns on bespoke scrapers (56% name-match vs 99.8% ABN-match).
- Firecrawl MCP token expired — needs refresh for web scraping
- mv_api_usage_daily stays 0 — correct (no API consumers yet), will populate when API keys are used
- Anthropic API credits depleted — use MiniMax M2.5 as fallback for LLM extraction tasks
- GrantConnect (grants.gov.au) is auth-walled — no public API, requires manual browser download
- mv_entity_power_index times out even at 5min — needs direct DB connection or lighter query
- MiniMax M2.5 wraps output in `<think>` tags — strip with regex before JSON parsing
- Annual reports are mostly qualitative — community-controlled orgs report narratives not spreadsheets. voice_confidence dimension exists for this.
- PRF portfolio status: 3 submitted, 6 evidence_exists (ALMA), 6 awaiting_submission

### Workflow State
pattern: build-and-ship
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Nationwide youth justice accountability infrastructure"
- resource_allocation: aggressive
- AIHW 2025: ALL tables ingested (S1-S54, 1,902 metrics)
- ROGS 2026: INGESTED — 5,045 metrics, 29 types, 10-year time series
- CTG Target 11: INGESTED — 1,270 metrics, projections to 2030-31
- VIC quarterly: SCRAPED — 202 metrics from 51 quarterly reports
- Tracker UI: 3 new sections wired (sentenced/remand, safety, CTG target) + QGIP expenditure section
- QLD static tracker: DELETED — dynamic tracker is superset with all sections
- QGIP scraper: 102K records, 13 FYs, $20.5B, 88% entity-linked, psql-based upsert (partial unique index)
- Topic enrichment: 23K QGIP records tagged via ACNC cross-reference
- 3 scrapers scheduled: scrape-qgip-grants (24h), scrape-qld-yj-contracts (72h), scrape-qld-hansard (24h)
- Other state grant portals: only SA has usable CKAN data — NSW/VIC/WA have nothing consolidated
- All 48 MVs refreshed successfully (32 min) — power index, funding deserts, revolving door recalculated
- /clarity page: full platform data model — 9 domains, 45 tables, 27M records, interactive radial graph
- Topic triggers updated: 9 topics each for justice_funding + alma_interventions (was 6)
- Schema health watcher: watch-schema-health.mjs at 24h — scans ABN linkage, orphaned refs, unclassified tables, new tables, ABN validity, empty MVs
- Schema health findings: orphaned refs was false positive (renamed to contact_id), 0 empty MVs after refresh, ASIC 59% ABN match
- outcomes_metrics column is `jurisdiction` not `state` — all queries updated
- clarity page uses pg_stat estimated counts (instant) not COUNT(*) (timeout-prone)
- SA Grants SA: 1,040 records ingested, 55% entity-linked (name match only, no ABNs), scraper registered
- /clarity page now shows 254 live CivicGraph tables (was 45 hardcoded), auto-classified into 12 domains
- 146 non-CivicGraph tables filtered from /clarity (ACT ops, EL, personal)
- Strategic plan: `.claude/plans/vivid-sleeping-canyon.md` — 90-day sequence, revenue model, flywheel
- ACT business model reviewed: 5 entities, 7 revenue streams, R&D tax eligible, The Harvest conditional proceed
- Memory files created: project_strategic_plan.md, project_act_business_model.md

#### Unknowns
- Some AIHW rates have caveats (ACT age 12-17 from 2023-24, NT age changed twice)
- QLD tracker cache behavior in dev mode — may resolve on production deploy

#### Last Failure
(none)

---

## Context

### Architecture: Two Layers

```
EDITORIAL LAYER (Reports)          BLOOMBERG LAYER (Database)
━━━━━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━━━━━━
/reports/youth-justice/qld/tracker  outcomes_metrics (745 rows, 9 jurisdictions)
  - Rich QLD narrative (1170 lines) policy_events (19 rows — QLD 13, NT 6)
  - 16 data sources cited           oversight_recommendations (15 rows — QLD only)
/reports/youth-justice/[state]/tracker
  - Adaptive for all 8 states       Entity pages auto-query these
  - Shows available data per state   /api/data/outcomes serves it all
/reports/youth-justice/national
  - Cross-state comparison           Scrapers auto-refresh monthly
```

### Key Files
- `apps/web/src/app/reports/youth-justice/[state]/tracker/page.tsx` — dynamic tracker (all states)
- `apps/web/src/app/reports/youth-justice/[state]/program/[programSlug]/page.tsx` — program detail + leadership
- `scripts/scrape-qgip-grants.mjs` — QGIP expenditure scraper (102K records, scheduled 24h)
- `apps/web/src/app/reports/youth-justice/national/page.tsx` — national comparison
- `apps/web/src/app/api/data/outcomes/route.ts` — outcomes API (3 modes)
- `apps/web/src/lib/outcomes-trends.ts` — trend computation utility (18 tests)
- `apps/web/src/lib/services/report-service.ts` — all data query functions
- `scripts/scrape-aihw-yj.mjs` — AIHW Youth Justice scraper (726 lines)
- `scripts/scrape-rogs-17a.mjs` — ROGS Table 17A scraper (473 lines)
- `scripts/watch-outcomes-changes.mjs` — outcomes watcher (255 lines, has --dry-run)
- `scripts/scrape-lobbying-qld.mjs` — QLD lobbying scraper (528 lines, CSV fallback)
- `scripts/scrape-lobbying-qld-playwright.mjs` — Playwright-based QLD lobbying scraper
- `data/qld-lobbyists.csv` — 132 QLD registered lobbyist entities with ABNs
- `data/qld-lobbying-clients.csv` — 1,221 unique client names

### Data Coverage (justice_funding)
| Source | Rows | Dollars | Entity Link % |
|--------|------|---------|---------------|
| QGIP | 102K | $20.5B | 88% |
| QLD contract disclosure | 24K | $2.8B | 87% |
| QLD historical grants | 12K | $16.1B | — |
| ROGS expenditure | 824 | $65.2B | — |
| Austender direct | 5.2K | $3.1B | — |
| **Total** | **145K** | **$111B** | — |

### Data Coverage (outcomes_metrics)
| Jurisdiction | Metrics | Notes |
|-------------|---------|-------|
| QLD | 63 | Rich: court pipeline, watch-house, socioeconomic, CTG 5yr trend |
| NT | 33 | Enriched: Children's Commissioner vulnerability data, facility splits |
| National | 32 | AIHW + ROGS aggregates, CTG national trend |
| NSW | 28 | AIHW + ROGS baseline |
| VIC | 28 | AIHW + ROGS baseline |
| WA | 28 | AIHW + ROGS baseline |
| SA | 25 | AIHW + ROGS baseline |
| TAS | 19 | AIHW + ROGS baseline |
| ACT | 19 | AIHW + ROGS baseline |

### NT Enrichment Sources (from oracle research)
1. NT Corrections weekly detention census (CSV, machine-readable) — facility-level splits
2. AIHW Youth Detention Population 2025 (XLSX) — quarterly data through Jun 2025
3. Children's Commissioner 2024 report — vulnerability metrics (88% harm, 94% DFV, 18x FASD)
4. NT Police PFES — Alice Springs regional crime stats (37,955 offences per 100K)
5. Royal Commission RMO tracking — 227 recommendation implementation status
6. NTG Open Data Portal — justice datasets
