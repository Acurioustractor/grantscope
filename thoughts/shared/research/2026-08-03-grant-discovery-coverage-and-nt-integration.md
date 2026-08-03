---
date: 2026-08-03T11:45:00+08:00
researcher: Codex
git_commit: 7efecfe6c92c34bcc977eddd98125fedc34eefa8
branch: feat/ghl-goods-opportunity-tracking
repository: grantscope
topic: "Grant discovery coverage, ACT hub freshness, missing sources, search models, and deep NT grants integration"
tags: [research, grants, funding, source-frontier, northern-territory, matching]
status: complete
last_updated: 2026-08-03
last_updated_by: Codex
last_updated_note: "Added FUND-102 source expansion, evidence-status contract, quarantine, and verifier production results"
---

# Research: Grant Discovery Coverage and NT Integration

## Research question

Is the live ACT/GrantScope funding hub current, where does it obtain grants, what material sources are missing, and what is the most efficient architecture for discovering, matching and converting funding opportunities for each ACT project? The NT Government grants directory was added as a priority deep-dive.

## Executive conclusion

GrantScope already contains most of the right architectural components: official-source plugins, a source frontier, foundation/program discovery, project funding profiles, semantic matching, eligibility rules, evidence gates, award data and a pipeline UI. The main weakness is operational completeness rather than absence of code.

Production data is not uniformly current. NSW, Victorian TIDE and foundation discovery show recent activity, but several major sources are stale, incorrectly marked open, or producing rows without usable deadlines. The scheduled ingest and enrichment pipeline is enabled but several orchestrator phases are timing out. GrantConnect GO ingestion is currently failing. Therefore the ACT hub is live and connected to a large corpus, but it cannot yet be described as comprehensively current.

The highest-value architecture is a source-of-sources system:

1. maintain an authoritative registry of grant directories, portals, funders and recurring programs;
2. monitor each source for change at an appropriate cadence;
3. expand directory entries into program-detail pages and application portals;
4. extract eligibility and dates into structured evidence-backed fields;
5. apply deterministic eligibility gates before semantic ranking;
6. use hybrid lexical and vector retrieval with a reranker for project fit;
7. convert shortlisted grants into an application workstream with owners, evidence requirements and reusable answers;
8. learn from pursue/pass/submit/win outcomes.

## Current system

### Ingestion and discovery

- `scripts/scrape-state-grants.mjs` runs jurisdiction plugins for ACT, QLD, NSW, VIC, TAS, SA, WA and NT.
- `packages/grant-engine/src/sources/` includes official or semi-structured sources for GrantConnect, business.gov.au, data.gov.au, ARC, NHMRC, states, major councils, web search and LLM discovery.
- `scripts/sync-source-frontier.mjs` and `scripts/poll-source-frontier.mjs` maintain and monitor known source pages using hashes, HTTP state, cadence, confidence and error history.
- `scripts/discover-foundation-programs.mjs` and `scripts/sync-foundation-programs.mjs` discover programs from the foundation estate.
- `scripts/import-public-discovered-grant-pages.mjs` promotes public grant pages discovered outside the primary plugins.
- `scripts/nightly-grant-pipeline.mjs` is designed to scrape, promote, classify, enrich, verify and refresh recommendations.

### Matching and project research

- `scripts/research-project-funding.mjs` combines the GrantScope database, foundation programs, curated source seeds and Octen search against a project funding profile.
- `scripts/funding-profiles/goods-on-country.json` is the structured GOODS profile.
- `scripts/lib/project-funding-fit.mjs` applies hard eligibility gates, scores project/funder alignment and builds a funding portfolio.
- `scripts/evaluate-project-funding-fit.mjs` benchmarks the GOODS matcher against labelled cases.
- Web matching uses semantic vectors with learning boosts and keyword fallback, as documented in `docs/strategy/grant-finder-overhaul.md`.

### Production freshness observed on 3 August 2026

- NSW: 1,704 rows; 191 verified in the last 30 days.
- Foundation programs: 1,545 rows; 43 verified in the last seven days and 84 in 30 days.
- Victorian TIDE API: 47 rows; 35 verified in seven days.
- WA: 214 rows; 204 verified in 30 days.
- QLD: 154 rows; no verification in 30 days.
- NT: 81 rows; 79 marked open, no future deadlines and no verification in 30 days.
- GrantConnect: 87 rows; latest verification 15 July; scheduled GO ingest failed on 2 August with `fetch failed`.
- Business.gov.au: 16 rows; latest verification 29 April.
- Sunshine Coast: 12 rows; latest verification 21 June.

Agent scheduling is active, but the latest recorded runs for the ingest, enrichment and finalisation phases are timed out. This explains why a live UI can still expose stale records despite the existence of freshness code.

## NT grants deep dive

### Official source chain

The NT Government uses three connected surfaces:

1. `https://nt.gov.au/community/grants-and-volunteers/grants` — entry page;
2. `https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory` — directory of more than 100 grants across Aboriginal, arts, business, community and other categories;
3. `https://grantsnt.nt.gov.au/` — application and grant-management portal, including subscriptions, organisational profiles, stored documents and reporting milestones.

The directory contains recurring and currently relevant pathways including Aboriginal Business Development, Aboriginal ranger funding, Community Benefit Fund major/minor/event/vehicle rounds, youth grants, arts, multicultural, gender equality, remote transport, road safety, tourism and disaster support.

### Existing NT implementation

`packages/grant-engine/src/sources/nt-grants.ts` already scrapes both the NT directory and GrantsNT. It extracts directory link titles and optionally uses Firecrawl for the JavaScript portal. However:

- the directory pass mainly creates title/URL stubs;
- it does not fetch every linked program page to extract current dates, amounts and eligibility;
- the heading-to-program category association is weak because `currentSection` is populated separately from link processing and is not used when each grant row is emitted;
- all rows are emitted under one generic NT Government provider;
- GrantsNT extraction depends on optional Firecrawl or direct HTML, while the portal is JavaScript-driven;
- no explicit reconciliation determines whether a directory program is currently open in GrantsNT;
- no recurring-round model distinguishes an evergreen program from an open intake.

The production result reflects this: 81 NT rows, 79 marked open, but zero future deadlines and no verification in 30 days. Of 14 NT URLs in `source_frontier`, only two succeeded in the last 30 days and 11 have failures.

### Required NT integration

Treat the NT directory as a source index, not an opportunity feed.

For every directory program:

1. store the canonical program identity and category;
2. fetch the linked program detail page;
3. discover all child tabs such as eligibility, assessment, dates and successful-applicant conditions;
4. reconcile current status against GrantsNT;
5. create one opportunity row per active round, not one permanently open program row;
6. store recurring schedule rules separately from the current intake;
7. retain page-level evidence URLs for each extracted fact;
8. monitor the directory weekly, active program pages daily, and recurring closed programs near their expected reopening window;
9. create a specific GOODS eligibility classification: direct applicant, eligible via NT NFP/Aboriginal corporation partner, or ineligible commercial activity.

This should immediately cover the Community Benefit Fund major and minor rounds, youth quick-response programs, Aboriginal business and ranger programs, remote transport, arts/community infrastructure and disaster-specific grants.

## Missing or under-covered source families

### Tier 1: authoritative and machine-readable

- GrantConnect current and forecast Grant Opportunities, including guideline attachments and addenda—not only historical Grant Awards.
- business.gov.au's full guided finder corpus; current production coverage of 16 rows is far below the hundreds of programs presented by the official finder.
- Official state datasets/APIs and grant-management portals, with completeness tests by jurisdiction.
- NT directory + GrantsNT detail/status integration.
- Local-government source registry generated from the national council list, then prioritised by ACT project geography rather than a hand-picked subset.
- Government procurement and challenge/innovation pathways: AusTender open approaches, state tender portals, pre-market engagement, procurement pilots and social procurement panels.

### Tier 2: philanthropic open rounds and latent funders

- Australian Communities Foundation current grant rounds and funding platform.
- Community foundations and place-based funds across every relevant ACT geography.
- Corporate community-investment pages, sustainability reports and staff foundations.
- Trustee-company and wealth-adviser grant programs.
- Giving circles and collective-giving programs such as Impact100 chapters.
- Indigenous-controlled trusts, Prescribed Body Corporates, native-title benefit trusts and mining agreement community funds.
- Philanthropic intermediaries and regrantors such as FRRR and issue-specific intermediaries.
- Annual reports and grants-paid lists used to infer recurring rounds even where applications are invitation-only.

### Tier 3: non-grant capital that projects need

- Impact investment, blended finance, recoverable grants and program-related investment.
- Social-enterprise accelerators, prizes, challenges and fellowships.
- Sponsorships and corporate in-kind support.
- Rebates, tax incentives, wage subsidies, training subsidies and export support.
- Research-industry partnerships, CRC-P, university translation funds and research infrastructure access.
- Procurement, offtake and advance-purchase commitments.

These must remain different instrument types. Calling every opportunity a grant creates false matches and poor application advice.

## Recommended discovery architecture

### 1. Source registry

Make `source_frontier` the canonical registry. Every source should have jurisdiction, source family, legal audience, extraction method, expected cadence, last successful yield, completeness expectation and cost.

### 2. Discovery layers

- Layer A: structured feeds and APIs.
- Layer B: directory crawlers that discover canonical program pages.
- Layer C: program-page change detection and attachment extraction.
- Layer D: web search for new sources and unregistered rounds.
- Layer E: newsletters, email alerts and social announcements used only to discover primary sources.
- Layer F: annual reports and award histories used to predict recurring or relationship-led funding.

### 3. Evidence model

Store each fact with provenance: source URL, document date, extracted text span or field, retrieved time and confidence. A row should only be `open` when official evidence supports the active round or when an evergreen intake is explicitly confirmed.

### 4. Project model

Each ACT project should have a versioned funding profile containing:

- applicant entities and legal structures;
- DGR/ACNC/Indigenous-ownership and geography facts;
- beneficiaries and delivery locations;
- project outcomes and evidence;
- costed funding blocks;
- acceptable instruments;
- exclusions and non-negotiable ownership rules;
- relationship network and potential auspices/partners.

The current GOODS profile is a strong starting point. Harvest and other projects need profiles at the same resolution.

### 5. Matching model

Use a staged model:

1. deterministic hard gates for deadline, geography, legal applicant, DGR, ownership, turnover, co-contribution and excluded costs;
2. BM25/full-text retrieval for exact program language and eligibility terms;
3. dense embeddings for semantic mission/outcome similarity;
4. graph signals from prior awards, funder relationships, geography and similar winners;
5. freshness and evidence-confidence multipliers;
6. cross-encoder or LLM reranking of the top 50 candidates against the full project profile;
7. portfolio selection across funding blocks, deadlines and applicant entities.

This is more reliable than embeddings alone: exact legal terms are lexical, while mission and outcome alignment are semantic.

### 6. Conversion workflow

For each pursued opportunity, automatically create:

- eligibility decision with evidence;
- recommended applicant/partner structure;
- fundable project boundary;
- required documents and missing evidence;
- application question set;
- reusable answer-bank suggestions with provenance;
- budget mapped to eligible cost categories;
- relationship and endorsement actions;
- internal review and submission deadlines;
- post-submission reporting and learning record.

## Efficiency and cost model

- Fetch structured feeds first; they are cheapest and most complete.
- Use HTTP `ETag`, `Last-Modified` and content hashes so unchanged pages do not invoke extraction models.
- Use deterministic parsers for common portal templates and LLM extraction only for changed, unstructured pages.
- Run cheap embedding/lexical retrieval across the corpus; reserve expensive reranking for the top candidates.
- Prioritise source monitoring by expected value: project geography, historical yield, upcoming recurrence and failure risk.
- Use humans only for ambiguous eligibility, invitation pathways, strategic positioning and final pursue/pass decisions.

## Recommended execution order

1. Restore operational reliability: fix timed-out nightly phases and GrantConnect GO failure; expose source-health alarms.
2. Build the NT directory-detail-GrantsNT reconciler and repair false-open NT rows.
3. Complete business.gov.au and GrantConnect opportunity coverage.
4. Generate a national local-government source registry and activate project-geography subsets.
5. Add Australian Communities Foundation, community foundations, giving circles and corporate community-investment sources.
6. Standardise Harvest and every active ACT project as a versioned funding profile.
7. Implement hybrid retrieval and top-candidate reranking on the existing eligibility and vector infrastructure.
8. Connect pursue decisions to application workspaces and outcome learning.

## Code references

- `packages/grant-engine/src/sources/nt-grants.ts` — NT directory and GrantsNT scraper.
- `scripts/scrape-state-grants.mjs` — state/territory plugin runner and source-level run logging.
- `scripts/sync-source-frontier.mjs` — source registry synchronisation.
- `scripts/poll-source-frontier.mjs` — change detection and source polling.
- `scripts/nightly-grant-pipeline.mjs` — ingest, enrichment, verification and recommendation orchestration.
- `scripts/research-project-funding.mjs` — project-specific discovery across DB, foundations, curated seeds and Octen.
- `scripts/lib/project-funding-fit.mjs` — deterministic eligibility and portfolio scoring.
- `scripts/evaluate-project-funding-fit.mjs` — labelled benchmark evaluation.
- `docs/strategy/grant-finder-overhaul.md` — existing ingestion, matching and trust-layer strategy.
- `docs/strategy/repeatable-project-funding-discovery.md` — repeatable project-discovery workflow.

## External primary sources

- NT Grants: https://nt.gov.au/community/grants-and-volunteers/grants
- NT Grants Directory: https://nt.gov.au/community/grants-and-volunteers/grants/grants-directory
- GrantsNT: https://nt.gov.au/community/grants-and-volunteers/grants/grantsnt
- GrantConnect: https://www.finance.gov.au/individuals/find-grant-grantconnect
- business.gov.au finder: https://business.gov.au/grants-and-programs
- Grants Awarded Data: https://data.gov.au/data/dataset/grants-awarded-data
- Australian Communities Foundation rounds: https://communityfoundation.org.au/grant-rounds/
- Philanthropy Australia seeking-funding guidance: https://www.philanthropy.org.au/seeking-funding/how-to-seek-funding

## Open questions

- Whether GrantsNT exposes an undocumented JSON endpoint that can be used instead of browser automation.
- Which production egress path can reliably fetch GrantConnect, NT and other government sites that currently return DNS, 403 or fetch failures.
- Whether all ACT projects have confirmed legal-entity and applicant-authority records sufficient for deterministic eligibility.
- Which application/outcome records are available to train a project-specific reranker beyond the current GOODS benchmark.

## Follow-up research — 2026-08-03T12:30:00+08:00

FUND-102 established that the production recommendation materialized view treated an HTTP-reachable page as sufficient verification. Before the new contract, it exposed 5,774 project recommendation rows; 5,335 had no deadline, 935 had no application URL and 583 had no official source URL.

The production contract is now represented by `act_funding_opportunity_current_status`. A record can be `apply_now` only when it has:

- `verification_status = verified`;
- a verification timestamp no older than seven days;
- an official source URL;
- an application URL;
- a future deadline.

Every failed requirement is retained as a named quarantine reason. `act_grant_recommendations_current` joins the existing recommendation materialized view to that contract, preserving all historical recommendations while excluding unsupported rows from current project feeds.

After the full verifier run, 35 opportunity records pass the contract and 661 remain quarantined. Those passing records produce 19 distinct current opportunities and 208 project-level recommendations. The current feed has zero missing deadlines, application URLs, official source URLs or verification timestamps.

The verifier itself previously read only the first 1,000 rows because of the Supabase response cap and performed checks sequentially. It now paginates all 1,621 eligible records, uses bounded concurrency, skips recently verified records and persists each result incrementally. The complete paginated run finished in 324 seconds.

The curated source frontier also gained 13 official source targets spanning Creative Australia, Regional Arts Fund, Screen Australia, Office for the Arts, Arts Queensland, CreateSA, Arts Tasmania, WA creative industries, AusTender, Buy NSW, Tenders SA, Tenders WA and NT Tenders. Live polling established successful baselines for the primary national arts sources, AusTender, Buy NSW, Tenders WA and NT Tenders. Sources returning 403 are retained as monitored bot-block failures rather than being represented as successful or silently discarded.

### Follow-up code references

- `supabase/migrations/20260803042000_funding_current_status_contract.sql` — current-status classification and evidence-safe recommendation view.
- `scripts/verify-alma-opportunities.mjs` — paginated, bounded-concurrency, incremental verification.
- `scripts/sync-source-frontier.mjs` — expanded arts and procurement source registry.
- `apps/web/src/lib/services/org-pipeline-service.ts` — project pipeline reads the evidence-safe view.
- `apps/web/src/lib/services/act-atlas-context.ts` — portfolio context reads the evidence-safe view.
- `apps/web/src/app/home/page.tsx` — home recommendations read the evidence-safe view.
- `apps/web/src/app/ops/grant-recommendations/page.tsx` — grant operations surface reads the evidence-safe view.
