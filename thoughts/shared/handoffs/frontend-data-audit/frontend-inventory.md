# CivicGraph Frontend Data Audit
**Date:** 2026-04-02  
**Scope:** All page.tsx routes and API route.ts endpoints in `apps/web/src/app/`

---

## Navigation Structure

### Public Nav (logged-out)
Top-level links: Ask, Intelligence (`/entity`), Procurement (`/tender-intelligence`), Places, Grants, Reports, API Docs, Mission Control, Login

**Mega-menu sections:**
- Intelligence: Entity Search, Power Index, Who Runs Australia?, Sector Intelligence, Compare Entities, Funding Desert Map, Network Graph
- Decision Tools: Ask CivicGraph, Evidence Synthesis, Scenario Modelling
- Procurement Intelligence: Tender Intelligence, List Enrichment, Intelligence Pack, For Government
- Domain Intelligence: Youth Justice, Child Protection, Disability, Education, State Dashboards, National Comparisons
- Explore Data: Grants, Foundations, Charities, Entity Graph, Social Enterprises, Dashboard
- Investigations: Power Index, Political Money, Donor-Contractors, $74B Question, $222 Billion, Community Parity, Who Runs Australia?, Funding Deserts, Data Health, Tax Transparency, Exec Remuneration, Board Interlocks, Charity Contracts, Influence Network, Power Network, Desert Overhead, ACCO Efficiency
- For: Government, Community Orgs, Funders, Researchers

### Workspace Nav (logged-in modules)
- Dashboard (`/home`)
- Grants: Search, Matched, Tracker, Foundations, Foundation Tracker, Alerts
- Procurement: Discover, Goods Workspace
- Allocation: Reports, Youth Justice, Child Protection, Disability, Education, Places, Power Map
- Research: Reports, Ask, Evidence, Scenarios, Entities, Entity Intel, Power Index, People, Funding Map, Network Graph, Charities, Social Enterprises
- Relationships: My Org, Contacts, Knowledge Wiki

### Admin-only links
- Ops (`/ops`), Mission Control (`/mission-control`), Goods Workspace

---

## Page Inventory

### Homepage (`/`)
**Type:** Server Component  
**Tables:** `mv_gs_donor_contractors`, `grant_opportunities`, `foundations`, `foundation_programs`, `acnc_ais`, `community_orgs`, `social_enterprises`, `gs_entities`, `gs_relationships`, `austender_contracts`, `political_donations`  
**Data:** Hero stats — entity count, relationship count, contract count, donation count, grant count, foundation count, open grants. Donor-contractor headline stats (total donated, total contract value, count). Grants by state. Uses `UnifiedSearch` component.  
**Note:** Major homepage with parallel count queries. 15+ parallel queries on load.

---

## INTELLIGENCE SECTION

### `/entity` — Entity Search
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/entity/search?q=&limit=30`  
**Tables (via API):** `gs_entities`, `mv_entity_power_index`  
**Data:** Debounced search across 560K entities. Shows entity name, type, sector, state, LGA, community-controlled flag, power_score, system_count. Links to `/entity/[gsId]`.

### `/entity/[gsId]` — Entity Detail Page
**Type:** Server Component  
**Tables:** `gs_entities`, `justice_funding`, `austender_contracts`, `political_donations`, `gs_relationships`, `alma_interventions`, `acnc_charities`, `impact_reports`, `anao_contract_stats`, `mv_entity_power_index`, `entity_rankings`, `ato_tax_transparency`, `person_roles`, `mv_revolving_door`, `outcome_metrics`, `policy_events`  
**Data:** Full entity profile — funding history, contracts, donations, board members, ALMA interventions, ATO data, power score, revolving door score, ranking score. Network graph via `EntityNetworkGraph` component.  
**Revalidate:** 3600s  
**Note:** One of the most data-heavy pages. Uses `safe()` wrapper + `exec_sql` RPC for most queries.

### `/entity/[gsId]/funding-flow` — Funding Flow View
**Type:** Server Component  
**Tables:** `gs_entities`, `gs_relationships`, `justice_funding`, `austender_contracts`  
**Data:** Dedicated funding flow visualization for an entity — upstream funders, downstream recipients, year-by-year breakdown.

### `/entity/[gsId]/investigate` — Investigation Mode
**Type:** Client Component (`use client`)  
**API:** Internal API calls  
**Data:** AI-powered investigation findings for an entity. Surfaces anomalies, contract alerts, funding timeline irregularities.

### `/entity/[gsId]/print` — Print View
**Type:** Server Component  
**Data:** Printable version of entity profile.

### `/entity/top` — Power Index Leaderboard
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/power-index` (inferred)  
**Tables:** `mv_entity_power_index`  
**Data:** Top entities ranked by power_score, total_dollar_flow, system_count. Filters: state, system presence (procurement/justice/donations/charity/foundation/evidence/ATO), entity type. Columns include all 7 system flags, dollar flows, buyer counts.

### `/entity/compare` — Compare Entities
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/entity/compare`  
**Tables:** `mv_entity_power_index`, `mv_revolving_door`, `person_roles`  
**Data:** Side-by-side comparison of 2+ entities. Compares power scores, system coverage, dollar flows, revolving door, board data.

### `/entities` — Entity Graph (legacy/alternate)
**Type:** Server Component  
**Tables:** `gs_entities`  
**Data:** Entity listing with type/state filters, source count, revenue sort. Separate from `/entity` search — shows broader entity graph view with more filter options.

### `/entities/[gsId]` — Entity Detail (alt route)
**Type:** Server Component (tabbed UI)  
**Tables:** `gs_entities`, `mv_entity_stats` (inferred `mv_gs_entity_stats`), `acnc_ais`, `foundations`, `foundation_programs`, `social_enterprises`, `ndis_supply`, `ndis_provider_concentration`, `alma_interventions`, `postcode_geo`, `seifa_2021`  
**Data:** Tabbed interface: Overview, Money, Network, Evidence. Includes Governed Proof bundle. Has NDIS district signal detection, disability-related beneficiary detection.  
**Revalidate:** 300s  
**Note:** This is a newer/more complete entity detail than `/entity/[gsId]`.

### `/entities/[gsId]/due-diligence` — Due Diligence Pack
**Type:** Server Component  
**Data:** Full due diligence report for an entity.

### `/person` — People / Who Runs Australia?
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/person?limit=100` and `?q=`  
**Tables:** `mv_person_influence` (inferred)  
**Data:** Lists top influential people by board_count, acco_boards, total_procurement, total_contracts, total_justice, total_donations, max_influence_score. Searchable.

### `/person/[name]` — Person Detail
**Type:** Server Component  
**Tables:** `mv_person_influence`, `mv_person_entity_network` (via `exec_sql`)  
**Data:** Individual person profile — all boards held, entity connections, financial footprint (procurement, justice, donations). Links to entity pages.  
**Revalidate:** 3600s

### `/sector` — Sector Intelligence
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/sector`  
**Tables:** `gs_entities`  
**Data:** Sector overview grid — each sector shows entity count, community-controlled count, states. Click to drill into sector detail with entities, breakdown by state/type, top-powered entities.

---

## PLACES / MAP SECTION

### `/places` — Community Funding Map Landing
**Type:** Client Component (`use client`)  
**Data:** Postcode search form. Renders `FundingGapMap` (Leaflet, SSR disabled). No direct DB queries on page — delegates to map component and search navigation.

### `/places/[postcode]` — Place Detail
**Type:** Server Component  
**Tables:** `postcode_geo`, `seifa_2021`, `mv_funding_by_postcode`, `justice_funding`, `austender_contracts`, `ndis_first_nations`, `ndis_provider_concentration`, `gov_proof_bundles` (via `GovernedProofService`), place data layers (via `getPlaceDataLayers`)  
**Data:** Comprehensive community profile — SEIFA/disadvantage scores, funding totals (justice + contracts + NDIS), entity count, remoteness, disability data (NDIS supply, concentration). Governed Proof pack if available.

### `/map` — Funding Desert Map
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/funding-deserts` and `GET /api/data/entity/search?lga=`  
**Tables:** `mv_funding_deserts`  
**Data:** Leaflet map of all LGAs coloured by desert_score. Summary stats (total LGAs, severe deserts, avg desert score). LGA click shows entity list from that LGA.

---

## GRAPH

### `/graph` — Network Graph
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/graph?mode=hubs|justice&topic=`  
**Tables:** `gs_entities`, `gs_relationships`, `justice_funding`, `mv_entity_power_index`, `mv_funding_deserts`, `mv_board_interlocks`, `foundations`  
**Data:** Force-directed graph (react-force-graph-2d, SSR disabled). Modes: Hub (top-connected entities), Justice (program→recipient graph with ALMA rings). Presets: Youth Justice, Child Protection, Indigenous Justice, Diversion, Foundation Networks, Full Network.

---

## GRANTS SECTION

### `/grants` — Grant Search
**Type:** Server Component (ISR)  
**Tables:** `grant_opportunities`, `foundation_programs`, `saved_grants` (client-side)  
**Data:** Grant search with semantic embeddings via `searchGrantsSemantic`. Filters: state, source, program type. Shows amount, deadline, provider. Uses `FundingIntelligenceRail` sidebar. List preview on hover.

### `/grants/[id]` — Grant Detail
**Type:** Server Component  
**Tables:** `grant_opportunities`  
**Data:** Full grant details — description, amount range, eligibility, deadline, URL.

### `/foundations` — Foundation Search
**Type:** Server Component (dynamic)  
**Tables:** `foundations`, `foundation_power_profiles`  
**Data:** Foundation listing with type, giving amount, thematic/geographic focus, power profile (capital_holder_class, openness_score, gatekeeping_score). Filters by type, focus area, openness. `FundingIntelligenceRail` sidebar.

### `/foundations/[id]` — Foundation Detail
**Type:** Server Component (dynamic)  
**Tables:** `foundations`, `foundation_programs`, `saved_foundations`, `org_profiles`  
**Data:** Full foundation profile — giving history chart, program list, application tips, board members, ACNC charity link, financial stats. Actions: save/unsave, notes.

### `/foundations/prf` — Private Research Foundation Report
**Type:** Server Component  
**Data:** PRF-specific foundation data.

### `/foundations/tracker` — Foundation Tracker
**Type:** Server Component (dynamic, auth-gated)  
**Tables:** `saved_foundations`, `foundations`  
**Data:** User's saved foundations with stage tracking.

### `/foundation/[abn]` and `/foundation` — Alt foundation routes
**Type:** Server Component  
**Data:** Legacy/alternate foundation routes.

---

## CHARITIES SECTION

### `/charities` — Charity Search
**Type:** Server Component (dynamic)  
**Tables:** `acnc_charities` (via `mv_acnc_latest` or `acnc_ais`)  
**Data:** Search 64K+ charities. Filters: purpose (Education, Health, Social Welfare, Religion, Culture, Environment, Reconciliation, Human Rights, etc.), beneficiaries (First Nations, Children, Youth, Aged, Disability, LGBTIQA+, etc.), state, charity size, sort (name, revenue, grants, assets, FTE, volunteers). Shows website, financial stats.

### `/charities/[abn]` — Charity Detail
**Type:** Server Component (dynamic)  
**Tables:** `acnc_charities`, `acnc_ais`, `org_profiles`, `gs_entities` (cross-reference)  
**Data:** Full charity profile — financial history, enriched description, programs, outcomes, admin burden, enriched domains. Auth check for claim status.

### `/charities/[abn]/edit` — Charity Edit
**Type:** Server Component (auth-gated)  
**Data:** Edit form for claimed charity profiles.

### `/charities/claim` — Claim Charity
**Type:** Client Component  
**Data:** Claim a charity record as org owner.

### `/charities/insights` — Charity Insights
**Type:** Server Component  
**Data:** Aggregated insights across the charity sector.

---

## SOCIAL ENTERPRISES

### `/social-enterprises` — Social Enterprise Search
**Type:** Server Component (dynamic)  
**Tables:** `social_enterprises`  
**Data:** Search B Corps, indigenous businesses, disability enterprises, cooperatives, social enterprises. Filters: org_type, state, certification (Social Traders, B Corp, BuyAbility, Supply Nation), sector. Shows certifications, description, website, map points via `SEClient`.

### `/social-enterprises/[id]` — Social Enterprise Detail
**Type:** Server Component  
**Tables:** `social_enterprises`  
**Data:** Full social enterprise profile.

---

## REPORTS SECTION

### `/reports` — Reports Index
**Type:** Server Component (static)  
**Data:** Static navigation page with reading order guide. Links to all reports. No DB queries.

### `/reports/[state]` — State Cross-Domain Dashboard
**Type:** Server Component (ISR 3600s)  
**Tables:** `justice_funding`, `austender_contracts`, `alma_interventions`, `outcome_metrics`, `policy_events`, `school_profiles`, `ndis_supply` (via `report-service`)  
**Data:** Cross-domain view for a state — youth justice, child protection, disability, education funding and outcomes. Policy timeline, oversight summary, cross-domain orgs. Available states: qld, nsw, vic, wa, sa, nt, tas, act.

### `/reports/youth-justice` — Youth Justice National
**Type:** Server Component (ISR 3600s)  
**Tables:** `justice_funding`, `austender_contracts`, `alma_interventions`, `outcome_metrics` (ROGS), `mv_funding_by_lga`, `ndis_first_nations`, `political_donations`, `foundations`, `anao_contract_stats`  
**Data:** National youth justice overview — ROGS time series, state spending breakdown (detention/community/conferencing), ALMA interventions, cross-system heatmap, ACCO funding gap, revolving door, ANAO compliance stats, foundation involvement, unfunded effective programs.

### `/reports/youth-justice/[state]` — State Youth Justice Deep-Dive
**Type:** Server Component (ISR 3600s)  
**Tables:** `justice_funding`, `austender_contracts`, `alma_interventions`, `outcome_metrics`, `mv_funding_by_lga`, `hansard_mentions`, `lobbying` (via `report-service`)  
**Data:** State-specific youth justice — funding by program and LGA, top orgs, ALMA evidence, ACCO funding gap, evidence gaps, Hansard mentions, lobbying connections, revolving door, outcomes metrics, ROGS expenditure.  
**States:** qld, nsw, vic, wa, sa, nt, tas, act

### `/reports/youth-justice/[state]/tracker` — State YJ Tracker
**Type:** Server Component  
**Data:** Grant and program tracker for a state's youth justice sector.

### `/reports/youth-justice/[state]/program/[programSlug]` — Program Detail
**Type:** Server Component  
**Data:** Individual program deep-dive.

### `/reports/youth-justice/national` — National Comparison
**Type:** Server Component  
**Data:** State-by-state comparison table for youth justice.

### `/reports/youth-justice/alice-springs` — Alice Springs Special
**Type:** Server Component  
**Data:** Alice Springs specific youth justice data.

### `/reports/disability` — Disability & NDIS National
**Type:** Server Component (ISR 3600s)  
**Tables:** `mv_disability_landscape`, `ndis_first_nations`, `ndis_supply`, `ndis_provider_concentration`, `ndis_registered_summary`  
**Data:** NDIS thin market analysis by LGA — market status (CRITICAL/SEVERE/MODERATE/ADEQUATE), First Nations participants by state/remoteness, provider counts, utilisation by state, cross-system stats.

### `/reports/disability/[state]` — State Disability Report
**Type:** Server Component  
**Tables:** `mv_disability_landscape`, `ndis_first_nations`, `ndis_supply`, `ndis_provider_concentration`  
**Data:** State-specific NDIS and disability data.

### `/reports/disability/national` — National Disability Comparison
**Type:** Server Component  
**Data:** National disability comparison across states.

### `/reports/education` — Education Intelligence
**Type:** Server Component (ISR 3600s)  
**Tables:** `school_profiles`, `outcome_metrics`, `alma_interventions`  
**Data:** Education funding and outcomes — school data by state (total schools, avg ICSEA, enrolments, Indigenous %), AIHW outcome metrics, ALMA education interventions.

### `/reports/education/[state]` and `/reports/education/national` — Education State/National
**Type:** Server Component  
**Data:** State/national education breakdowns.

### `/reports/child-protection` — Child Protection (inferred from nav)
**Type:** Server Component  
**Data:** Child protection notifications, OOHC, substantiation, ROGS 16A data.

### `/reports/power-concentration` — Cross-System Power Index
**Type:** Server Component (dynamic)  
**Tables:** `mv_entity_power_index`, `gs_entities`  
**Data:** 82,967 entities scored across 7 systems. Shows distribution (how many entities appear in 1, 2, 3+ systems), top entities by power_score, system coverage breakdown, community-controlled vs mainstream comparison, geographic inequity stats.

### `/reports/political-money` — Political Money
**Type:** Server Component (dynamic)  
**Tables:** `political_donations`, `austender_contracts`, `mv_gs_donor_contractors`, `gs_entities`  
**Data:** Top parties by donation total, top donors, pay-to-play analysis (donors who also have contracts), donation timeline, party breakdown.

### `/reports/donor-contractors` — Donor-Contractors
**Type:** Server Component (dynamic)  
**Tables:** `mv_gs_donor_contractors`, `gs_entities`, `gs_relationships`, `political_donations`, `austender_contracts`  
**Data:** Entities that both donate politically AND hold government contracts. Full cross-reference table with donor name, total donated, parties, total contract value, buyers. Email gate for dataset download.

### `/reports/board-interlocks` — Board Interlocks
**Type:** Server Component (dynamic)  
**Tables:** `person_roles`, `acnc_charities` (via `exec_sql`)  
**Data:** People serving on multiple charity boards — board count, entities controlled, financial footprint. Executive remuneration cross-reference.

### `/reports/funding-deserts` — Funding Deserts
**Type:** Server Component (dynamic)  
**Tables:** `mv_funding_deserts`  
**Data:** 568+ LGAs ranked by desert_score. Shows avg_irsd_decile, entity count, community-controlled count, total_funding_all_sources. Breakdown by remoteness category.

### `/reports/who-runs-australia` — Who Runs Australia?
**Type:** Server Component (dynamic)  
**Tables:** `mv_revolving_door`, `mv_board_interlocks`, `gs_entities` (via `exec_sql`)  
**Data:** Revolving door entities (lobbies + donates + contracts + receives funding), top board interlockers (people on most boards), cross-system influence analysis.

### `/reports/influence-network` — The Influence Network
**Type:** Server Component (dynamic)  
**Tables:** `mv_revolving_door`, `mv_entity_power_index`, `gs_entities`  
**Data:** Entities combining lobbying, political donations, and government contracts. Full influence cycle mapped. Revolving door score breakdown.

### `/reports/tax-transparency` — Tax Transparency
**Type:** Server Component (dynamic)  
**Tables:** `ato_tax_transparency`, `austender_contracts`, `gs_entities`  
**Data:** ATO data cross-referenced with AusTender — who gets government contracts vs effective tax rate. Industries with lowest tax vs highest contracts.

### `/reports/exec-remuneration` — Executive Remuneration
**Type:** Server Component (dynamic)  
**Tables:** `acnc_ais` (executive remuneration columns), `gs_entities`  
**Data:** Charity executive pay vs service delivery. Community-controlled vs mainstream breakdown.

### `/reports/ndis-market` — NDIS Market
**Type:** Server Component (dynamic)  
**Tables:** `ndis_supply`, `ndis_provider_concentration`, `ndis_registered_providers`  
**Data:** NDIS provider supply by state/district, market concentration (top-10 payment share), registered provider counts by status.

### `/reports/big-philanthropy` — $222 Billion (Static content)
**Type:** Server Component (static content + foundation links)  
**Tables:** `foundations` (for internal links only)  
**Data:** Long-form investigation into Australian charity money. References Paul Ramsay, Minderoo, Ian Potter, Snow Medical, Myer, Tim Fairfax, Pratt, Lowy foundations specifically. Mostly editorial content with embedded data stats.

### `/reports/funding-equity` — Funding Equity
**Type:** Server Component (dynamic)  
**Tables:** `acnc_charities`, `seifa_2021`  
**Data:** Charity income by SEIFA decile — top 12.9% disadvantaged postcodes get 12.9% of charity income vs 46% for least disadvantaged. Indigenous vs non-Indigenous breakdown.

### `/reports/access-gap` — Access Gap
**Type:** Server Component  
**Data:** Access gap analysis across services.

### `/reports/money-flow` — Money Flow
**Type:** Server Component  
**Tables:** `justice_funding`, `austender_contracts`, `political_donations`  
**Data:** Sankey-style money flow visualization across grant programs.

### `/reports/philanthropy` — Foundation Intelligence
**Type:** Server Component  
**Tables:** `foundations`, `foundation_programs`  
**Data:** Foundation landscape analysis.

### `/reports/philanthropy-power` — Philanthropy Power
**Type:** Server Component  
**Data:** Power concentration within the philanthropy sector.

### `/reports/social-enterprise` — Social Enterprise
**Type:** Server Component  
**Tables:** `social_enterprises`  
**Data:** The invisible $21B sector analysis.

### `/reports/state-of-the-nation` — State of the Nation
**Type:** Server Component  
**Data:** Comprehensive national overview report.

### `/reports/power-dynamics`, `/reports/power-map`, `/reports/power-network` — Power reports
**Type:** Server Component  
**Tables:** `mv_entity_power_index`, `mv_revolving_door`  
**Data:** Various power concentration analyses.

### `/reports/qld-youth-justice` — QLD Youth Justice
**Type:** Server Component  
**Data:** QLD-specific youth justice investigation.

### `/reports/indigenous-proxy` — Indigenous Proxy
**Type:** Server Component  
**Tables:** `gs_entities`, `justice_funding`  
**Data:** Analysis of Indigenous proxy measures in data.

### `/reports/triple-play`, `/reports/picc`, `/reports/procurement-oligopoly` — Investigations
**Type:** Server Component  
**Tables:** `austender_contracts`, `mv_gs_donor_contractors`  
**Data:** Procurement concentration/oligopoly analysis, triple-play (lobby+donate+contract) analysis.

### `/reports/desert-overhead` — Desert Overhead
**Type:** Server Component  
**Tables:** `acnc_ais`, `mv_funding_deserts`, `gs_entities`  
**Data:** Executive pay in highest-disadvantage LGAs.

### `/reports/data-health` — Data Health
**Type:** Server Component  
**Tables:** `mv_data_quality`, `agent_runs`  
**Data:** Coverage and completeness across all 7 data systems.

### `/reports/timing` — Timing Report
**Type:** Server Component  
**Data:** Grant/contract timing patterns.

---

## PROCUREMENT SECTION

### `/tender-intelligence` — Tender Intelligence Workspace
**Type:** Client Component (`use client`) — large file  
**Tables:** (via multiple API endpoints) `austender_contracts`, `gs_entities`, `social_enterprises`, `postcode_geo`, `seifa_2021`, `acnc_charities`, `procurement_workspaces`, `shortlists`, `notifications`, `tasks`, `team_members`, `comments`, `tender_watches`  
**Data:** Full procurement workspace — supplier discovery (Discover tab), list enrichment (Enrich tab), intelligence packs (Pack tab), shortlisting with go/no-go decisions, compliance scoring, team collaboration (comments, tasks, approvals, channels), notification management. Also handles export workflows.

### `/tender-intelligence/exports/[exportId]` — Export View
**Type:** Server Component  
**Data:** View generated procurement export.

### `/procurement/page`, `/procurement/commissioning`, `/procurement/gap-map`, `/procurement/tender-pack` — Procurement sub-pages
**Type:** Server Component  
**Data:** Landing pages for procurement features.

---

## WORKSPACE / ORG SECTION

### `/home` — Workspace Dashboard (logged-in)
**Type:** Server Component (dynamic, auth-required)  
**Tables:** `saved_grants`, `grant_opportunities`, `saved_foundations`, `foundations`, `org_profiles`, `agent_runs`, `gs_entities`  
**Data:** Saved grants (with pipeline stage), saved foundations, org profile, recent agent runs, open grant count, entity count. Pipeline stage counts. Uses `HomeClient` for interactive elements, `IntakeClaimer` for intake flow.

### `/org` — Organisation Index (admin) / Redirect (non-admin)
**Type:** Server Component (dynamic, auth-required)  
**Tables:** `org_profiles`, `org_members`  
**Data:** Admin sees all orgs. Non-admins redirect to own org. Impersonation support via `cg_impersonate_org` cookie.

### `/org/[slug]` — Organisation Dashboard
**Type:** Server Component (dynamic, auth-required)  
**Tables:** `org_profiles`, `justice_funding`, `austender_contracts`, `alma_interventions`, `gs_entities`, `grant_opportunities`, `org_contacts`, `person_roles`, `mv_entity_power_index`, `mv_revolving_door`, `mv_board_interlocks`, `foundations`, `political_donations`  
**Data:** Comprehensive org command center via `org-dashboard-service`. Sections: key stats, power score, revolving door, relationships, funding desert, board members, donor cross-links, foundation funders, leadership, funding timeline, programs, ALMA interventions, grant pipeline, matched grants, contacts, contracts, ecosystem, peer orgs, project summaries.

### `/org/[slug]/contacts` — Org Contacts
**Type:** Server Component  
**Tables:** `org_contacts`, `org_profiles`  
**Data:** CRM-style contact management for org.

### `/org/[slug]/ecosystem` — Ecosystem View
**Type:** Server Component  
**Data:** Local ecosystem map for org's geography/sector.

### `/org/[slug]/intelligence` — Intelligence Command Center
**Type:** Server Component  
**Data:** Cross-system intelligence summary for org (JusticeHub command center).

### `/org/[slug]/[projectSlug]` — Project Detail
**Type:** Server Component  
**Tables:** `org_projects`, `org_contacts`, `journey_sessions`  
**Data:** Project view with contact list and journey sessions.

### `/org/[slug]/[projectSlug]/journeys` — Journey List
### `/org/[slug]/[projectSlug]/journeys/[journeyId]` — Journey Detail
### `/org/[slug]/[projectSlug]/journeys/[journeyId]/map` — Journey Map
**Data:** User journey mapping tool.

### `/profile` — Organisation Profile
**Type:** Server Component (dynamic, auth-required)  
**Tables:** `org_profiles`  
**Data:** Org profile editor — name, ABN, focus areas, geographic focus. Delegates to `ProfileClient` for interactivity.

### `/profile/matches` — Matched Grants
**Type:** Server Component  
**Tables:** `org_profiles`, `grant_opportunities`, `saved_grants`  
**Data:** AI-matched grants based on org profile/embeddings.

### `/profile/answers` — Answer Bank
**Type:** Server Component  
**Tables:** `org_answers`  
**Data:** Organisation's stored answers for grant applications.

### `/tracker` — Grant Application Tracker
**Type:** Server Component (dynamic)  
**Tables:** `saved_grants`, `grant_opportunities`  
**Data:** Kanban/pipeline tracker for grant applications — all saved grants with stage (identified/drafting/submitted/awarded/declined). Uses `TrackerClient` for interactive drag-and-drop.

### `/alerts` — Grant Alerts
**Type:** Client Component (`use client`)  
**Tables:** `grant_alerts`, `grant_opportunities` (via `/api/alerts/matches`)  
**Data:** User-configured grant alerts — name, frequency (daily/weekly/monthly), filters (categories, focus areas, states, amount range, keywords, entity types). Shows matching grants per alert.

### `/home/watchlist` — Watchlist
**Type:** Server Component  
**Tables:** `watches`, `gs_entities`, `foundations`, `grant_opportunities`  
**Data:** Watched entities/foundations/grants for monitoring.

### `/home/portfolio` — Portfolio
**Type:** Server Component  
**Data:** Org funding portfolio view.

### `/home/board-report` — Board Report Generator
**Type:** Server Component  
**Data:** Generates board-ready reporting from org data.

### `/home/report-builder` — Report Builder
**Type:** Server Component  
**Data:** Custom report builder for org intelligence.

### `/home/tender-brief` — Tender Brief
**Type:** Server Component  
**Data:** Tender brief generator.

### `/home/api-keys` — API Keys
**Type:** Server Component (auth-required)  
**Tables:** `api_keys`  
**Data:** Manage API keys for developer access.

---

## GOODS WORKSPACE

### `/goods-workspace` — Goods Intelligence Workspace
**Type:** Server Component (dynamic, auth-check)  
**Tables:** `gs_entities`, `austender_contracts`, `justice_funding`, `foundations`, `grant_opportunities`, `postcode_geo`  
**Data:** Specialized procurement workspace for goods/social procurement. Shows community orgs (GoodsCommunityRow), procurement entities (GoodsProcurementEntityRow), procurement signals (GoodsProcurementSignalRow), foundations (GoodsFoundationRow), grants (GoodsGrantRow), NT community coverage (NtCommunityCoverageRow). Queries via `exec_sql` RPC.

### `/goods-intelligence` — Redirect
**Type:** Server Component  
**Data:** Redirects to `/goods-workspace`.

---

## POWER / RANKING PAGES

### `/power` — Power Map
**Type:** Client Component (`use client`, via `PowerPageClient`)  
**API:** Multiple internal APIs  
**Tables:** `mv_entity_power_index`, `gs_entities`, `mv_funding_deserts`, `justice_funding`, `austender_contracts`, `political_donations`  
**Data:** Interactive capital/power mapping with Leaflet map, money flow Sankey (SSR disabled), network graph (SSR disabled), place detail. Data sources panel. Filters and views.

### `/rankings` — Charity Rankings
**Type:** Client Component (`use client`)  
**API:** `GET /api/data/rankings`  
**Tables:** `entity_rankings` or derived from `acnc_charities`/`acnc_ais`  
**Data:** Charity performance rankings — composite score, revenue, growth (CAGR), FTE, volunteers, vol:FTE ratio, rev/FTE, network connections, assets. Filterable by state, sector, community-controlled flag, charity size.

---

## EVIDENCE / ALMA SECTION

### `/evidence` — Evidence Synthesis
**Type:** Server Component (shell)  
**Data:** Shell page wrapping `EvidenceClient` (client component).  
**API:** Hits ALMA evidence APIs  
**Tables:** `alma_interventions`, `alma_evidence`, `alma_outcomes`  
**Data:** ALMA evidence analysis and synthesis for policy-makers.

### `/evidence-packs` — Evidence Packs Generator
**Type:** Client Component (`use client`)  
**API:** `GET /api/justice/evidence-pack?format=json|html`  
**Tables:** `alma_interventions`, `alma_evidence`, `alma_outcomes`, `gs_entities`  
**Data:** Generate evidence packs by state, entity, or intervention. Shows ALMA intervention data, evidence records, outcomes. Printable/JSON/download.

---

## OPS / ADMIN SECTION

### `/ops` — Ops Dashboard
**Type:** Server Component  
**Data:** Shell for `OpsClient` (client component). Shows agent run history, data health, system status.

### `/ops/health` — Data Health Overview
**Type:** Server Component  
**Tables:** `mv_data_quality`, `agent_runs`, `agent_schedules`  
**Data:** Coverage metrics per dataset.

### `/ops/health/[dataset]` — Dataset Health Detail
**Type:** Server Component  
**Data:** Per-dataset health deep-dive.

### `/ops/claims` — Claims Management
**Type:** Server Component  
**Tables:** `charity_claims`, `org_profiles`  
**Data:** Admin view for managing charity claim requests.

### `/admin/api-usage` — API Usage Admin
**Type:** Server Component  
**Tables:** `api_usage_logs`, `api_keys`  
**Data:** API key usage stats for admin.

### `/mission-control` — Mission Control
**Type:** Server Component (shell)  
**Data:** Shell for `MissionControlClient` (client component). Unified data inventory, agent status, power concentration analysis, live SQL playground, discoveries feed, schedules management.

---

## MARKETING / STATIC PAGES

### `/for/government`, `/for/community`, `/for/funders`, `/for/foundations`, `/for/researchers`, `/for/corporate`, `/for/philanthropy`, `/for/social-enterprises` — Audience Landing Pages
**Type:** Server Component (mostly static)  
**Data:** Marketing content for specific audiences. Some pull live stats.

### `/for/funders/proof/[placeKey]` — Funder Proof Pack
**Type:** Server Component  
**Data:** Governed Proof pack for funders — place-based outcome evidence.

### `/for/funders/proof/[placeKey]/system` — System Proof View
**Type:** Server Component  
**Data:** System-level proof view.

### `/pricing` — Pricing Page
**Type:** Server Component  
**Data:** Static pricing tiers. Links to billing.

### `/developers` — API Documentation
**Type:** Server Component (static)  
**Data:** API documentation. Links to `/home/api-keys`.

### `/how-it-works` — How It Works
**Type:** Server Component (static)

### `/process` — Process Page
**Type:** Server Component (static)

### `/insights`, `/clarity`, `/showcase`, `/benchmark`, `/architecture` — Misc Pages
**Type:** Mostly Server/Client Components  
**Data:** Various internal/demo pages.

### `/corporate`, `/justice-reinvestment`, `/closing-the-gap` — Thematic Pages
**Type:** Server Component  
**Data:** Thematic landing/report pages.

---

## AUTH / ONBOARDING

### `/login` — Login
**Type:** Server Component  
**Data:** Supabase auth login form (email/magic link).

### `/register` — Register
**Type:** Server Component  
**Data:** Registration form.

### `/start` — Intake Flow
**Type:** Server Component  
**Tables:** `intake_sessions`  
**Data:** Guided onboarding intake.

### `/start/[intakeId]` — Intake Step
**Type:** Server Component  
**Data:** Individual intake step.

### `/start/[intakeId]/brief` — Intake Brief
**Type:** Server Component  
**Data:** Generated brief from intake answers.

### `/settings` — Settings
**Type:** Server Component (auth-required)  
**Tables:** `org_profiles`  
**Data:** User/org settings.

---

## API ROUTES SUMMARY

### Public Data APIs
| Endpoint | Method | Description | Key Tables |
|----------|--------|-------------|------------|
| `/api/data` | GET | Public entity/grants/foundations data | `gs_entities`, `grant_opportunities`, `foundations`, `social_enterprises` |
| `/api/data/health` | GET | System health (no auth, CORS cacheable) | `agent_runs`, `gs_entities` |
| `/api/data/entity/search` | GET | Entity search `?q=&lga=&limit=` | `gs_entities`, `mv_entity_power_index` |
| `/api/data/entity/top` | GET | Top entities by power/dollar | `mv_entity_power_index` |
| `/api/data/entity/compare` | GET | Side-by-side entity compare | `mv_entity_power_index`, `mv_revolving_door` |
| `/api/data/entity/network` | GET | Entity relationship network | `gs_relationships`, `gs_entities` |
| `/api/data/entity/investigate` | GET | Entity anomaly detection | Multiple |
| `/api/data/graph` | GET | Graph data (hubs/justice mode) | `gs_relationships`, `justice_funding`, `mv_entity_power_index` |
| `/api/data/power-index` | GET | Power index data | `mv_entity_power_index` |
| `/api/data/funding-deserts` | GET | Funding desert LGA data | `mv_funding_deserts` |
| `/api/data/map` | GET | Map data (postcode level) | `mv_funding_by_postcode` |
| `/api/data/sector` | GET | Sector overview and detail | `gs_entities` |
| `/api/data/person` | GET | Person influence data | `mv_person_influence` |
| `/api/data/outcomes` | GET | Outcomes data | `outcome_metrics` |
| `/api/data/political-money` | GET | Political donation data | `political_donations` |
| `/api/data/tax-transparency` | GET | ATO tax data | `ato_tax_transparency`, `austender_contracts` |
| `/api/data/who-runs-australia` | GET | Revolving door + interlocks | `mv_revolving_door`, `mv_board_interlocks` |
| `/api/data/rankings` | GET | Charity rankings | `entity_rankings` |
| `/api/data/board-power` | GET | Board power data | `mv_board_interlocks`, `person_roles` |
| `/api/data/schema-graph` | GET | DB schema visualization | `information_schema` |
| `/api/data/export` | GET | Data export | Multiple |

### Entity APIs (authed)
| Endpoint | Description |
|----------|-------------|
| `/api/entities/[gsId]` | Full entity data |
| `/api/entities/[gsId]/money` | Financial data for entity |
| `/api/entities/[gsId]/network` | Network for entity |
| `/api/entities/[gsId]/evidence` | ALMA evidence for entity |
| `/api/entities/[gsId]/place` | Place data for entity |
| `/api/entities/[gsId]/stories` | Story data for entity |
| `/api/entities/[gsId]/due-diligence` | Full DD pack |

### Grant/Foundation APIs
| Endpoint | Description |
|----------|-------------|
| `/api/grants/[grantId]` | Grant detail |
| `/api/grants/match` | Semantic grant matching |
| `/api/grants/send` | Send grant digest |
| `/api/grants/[grantId]/feedback` | Grant feedback |
| `/api/foundations` | Foundation list |
| `/api/foundations/saved` | User's saved foundations |
| `/api/foundations/saved/[foundationId]` | Save/unsave foundation |
| `/api/foundations/notes` | Foundation notes |

### Tender Intelligence APIs
| Endpoint | Description | Key Tables |
|----------|-------------|------------|
| `/api/tender-intelligence/discover` | Supplier discovery | `gs_entities`, `austender_contracts` |
| `/api/tender-intelligence/enrich` | List enrichment | `gs_entities`, `acnc_charities` |
| `/api/tender-intelligence/pack` | Generate intelligence pack | Multiple |
| `/api/tender-intelligence/shortlist` | Shortlist entity | `shortlists` |
| `/api/tender-intelligence/shortlists` | All shortlists | `shortlists` |
| `/api/tender-intelligence/compliance` | Compliance scoring | `gs_entities` |
| `/api/tender-intelligence/watch` | Watch tender | `tender_watches` |
| `/api/tender-intelligence/notifications` | Notifications | `notifications` |
| `/api/tender-intelligence/tasks` | Tasks | `procurement_tasks` |
| `/api/tender-intelligence/comments` | Comments | `procurement_comments` |
| `/api/tender-intelligence/team` | Team management | `team_members` |
| `/api/tender-intelligence/workspace` | Workspace config | `procurement_workspaces` |
| `/api/tender-intelligence/analyze-url` | URL content analysis | — |
| `/api/tender-intelligence/automation/run-due` | Cron: run due automations | — |
| `/api/tender-intelligence/automation/deliver-notifications` | Cron: deliver notifications | — |

### Justice / ALMA APIs
| Endpoint | Description |
|----------|-------------|
| `/api/justice/interventions` | ALMA intervention list |
| `/api/justice/evidence-pack` | Generate evidence pack (JSON or HTML) |
| `/api/justice/closing-the-gap` | Closing the Gap data |

### Mission Control APIs
| Endpoint | Description |
|----------|-------------|
| `/api/mission-control` | Aggregated MC data (agent runs, discoveries, schedules) |
| `/api/mission-control/query` | Live SQL query runner |
| `/api/mission-control/registry` | Agent registry |
| `/api/mission-control/discoveries/[id]` | Ack/dismiss discovery |
| `/api/mission-control/schedules` | Agent schedules CRUD |
| `/api/mission-control/tasks` | Running tasks |

### Org / CRM APIs
| Endpoint | Description |
|----------|-------------|
| `/api/org/[orgProfileId]/contacts` | Org contacts CRUD |
| `/api/org/[orgProfileId]/contacts/sync-ghl` | Sync to GoHighLevel |
| `/api/org/[orgProfileId]/contacts/link-notion` | Sync to Notion |
| `/api/org/[orgProfileId]/journeys` | Journey sessions |
| `/api/org/[orgProfileId]/journeys/[journeyId]` | Journey detail |
| `/api/org/[orgProfileId]/journeys/chat` | Journey AI chat |

### Other APIs
| Endpoint | Description |
|----------|-------------|
| `/api/search/universal` | Universal search |
| `/api/search/semantic` | Semantic search |
| `/api/global-search` | Global search |
| `/api/ask` | Natural language query |
| `/api/chat` | AI chat |
| `/api/insights` | Insights data |
| `/api/dashboard` | Dashboard stats |
| `/api/billing/checkout` | Stripe checkout |
| `/api/billing/portal` | Stripe customer portal |
| `/api/billing/webhook` | Stripe webhook |
| `/api/billing/check-access` | Check subscription access |
| `/api/profile` | Profile CRUD |
| `/api/profile/matches` | Matched grants |
| `/api/profile/enrich` | Enrich org profile |
| `/api/keys` | API key management |
| `/api/alerts` | Alert CRUD |
| `/api/alerts/matches` | Alert grant matches |
| `/api/tracker` | Grant tracker CRUD |
| `/api/watches` | Entity/grant watches |
| `/api/contacts/*` | Contact lookup, search, graph, sync |
| `/api/board-report` | Board report generation |
| `/api/report-builder` | Custom report generation |
| `/api/reports/money-flow` | Money flow data |
| `/api/reports/youth-justice` | YJ report data |
| `/api/civicscope/data` | CivicScope integration |
| `/api/civicscope/digest` | CivicScope digest |
| `/api/v1/exposure` | Public v1 API: entity exposure |
| `/api/ops` | Ops data |
| `/api/ops/health` | Data health metrics |
| `/api/ops/claims` | Claims management |
| `/api/admin/api-usage` | Admin API usage stats |
| `/api/admin/impersonate` | Admin impersonation |

---

## Key Observations

### Route Duplication
- **Two entity detail routes:** `/entity/[gsId]` (older, uses `exec_sql` heavily) and `/entities/[gsId]` (newer, tabbed UI, uses Supabase SDK + typed imports). Both appear active.
- **Two foundation routes:** `/foundation/[abn]` (legacy) and `/foundations/[id]` (current).
- `/goods-intelligence` redirects to `/goods-workspace`.

### Server vs Client Component Distribution
- **Server Components (ISR/dynamic):** Entity detail, reports, charities, foundations, grants, home, places, org dashboard, person detail
- **Client Components (`use client`):** Entity search, entity/top, entity/compare, sector, person search, map, graph, power, tender-intelligence, places landing, alerts, tracker, evidence-packs, rankings

### Pages with Heavy DB Load
1. `/entity/[gsId]` — 12+ parallel queries across 10+ tables
2. `/org/[slug]` — 20+ queries via org-dashboard-service
3. `/` (homepage) — 15+ parallel count queries
4. `/reports/youth-justice` — 15+ queries via report-service
5. `/tender-intelligence` — real-time multi-tab workspace

### Tables Queried Most Across Pages
1. `gs_entities` — everywhere
2. `justice_funding` — all reports + entity pages
3. `austender_contracts` — entity pages, reports, procurement
4. `alma_interventions` — evidence, reports, entity pages
5. `mv_entity_power_index` — entity search, top, compare, reports
6. `mv_revolving_door` — who-runs-australia, influence-network, entity pages
7. `mv_board_interlocks` — board report, who-runs-australia, interlocks report
8. `political_donations` — political money report, entity pages
9. `foundations` + `foundation_programs` — grants, org, home, philanthropy reports
10. `acnc_charities` / `acnc_ais` — charities, board interlocks, exec remuneration

### Subscription Gating
Modules gated by subscription tier:
- `grants` — Grants module (tracker, alerts, foundations)
- `procurement` — Procurement module (tender intelligence, goods workspace)
- `allocation` — Allocation module (domain reports, places, power map)
- `research` — Research module (reports, evidence, scenarios, entity intel, graph)
- `relationships` — Relationships module (org CRM, contacts)

### Pages Missing from Nav but Exist
- `/rankings` — Charity performance rankings (not in main nav)
- `/goods-workspace` — Admin-only in nav
- `/evidence-packs` — Not in main nav (linked from evidence page)
- `/sector` — In mega-menu only
- `/entities` — "Entity Graph" in mega-menu only
- `/justice-reinvestment`, `/closing-the-gap`, `/corporate` — Thematic landing pages
- `/benchmark`, `/architecture`, `/clarity`, `/showcase` — Internal/demo pages
- `/procurement/*` — Procurement sub-pages separate from tender-intelligence
