# CivicGraph — Mission & Focus

## Mission

Build decision infrastructure for Australian government and social sector — connecting supplier intelligence, place-based funding data, and outcome evidence into the layer that helps institutions allocate better and helps communities access fairly.

**Know who to fund. Know who to contract. Know it worked.**

## Three Products

| Product | What | For Whom |
|---------|------|----------|
| **Procurement Intelligence** | Supplier discovery, compliance checking, Indigenous/SE verification, donor-contractor cross-reference | Government procurement officers, commissioners |
| **Allocation Intelligence** | Place-based funding gaps by SEIFA/remoteness, entity density, community need scoring | Program managers, funders, philanthropists |
| **Governed Proof** | Outcome evidence linking funding to results (JusticeHub + Empathy Ledger integration) | Evaluators, commissioners, community orgs |

**Cross-subsidy model:** Institutions pay so communities get free access. Free forever for community orgs.

## North Star Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Entities resolved | 100,036 | 150K+ | ASIC companies (2.2M raw → ~50K high-value) |
| Relationships mapped | 199,001 | 200K+ | Close to target — need ASIC directors, grant recipients |
| Entity match F1 | **94.1%** | 90%+ | **TARGET MET** — evaluator fix + name normalization (was 76.9%) |
| Geographic coverage | **96% postcode, 96% remoteness, 95% LGA, 94% SEIFA** | 97%+ | ABR bulk extract filled 16K entities; ~3K remain (no postcode) |
| Community-controlled tagged | 7,822 | 10K+ | Supply Nation + self-declared still missing |
| Entity descriptions | **83,367 (89.6%)** | 80%+ | **TARGET MET** — All types 100% except foundations (11%, LLM enriching 9.6K remaining) |
| JH↔CG linkage | 315/556 (57%) | 90%+ | 241 orgs without ABN — need manual or fuzzy match |
| Revenue (MRR) | $0 | $5K | Product exists but no launch, no users yet |

## The 7 Core Objects

1. **Entity** — businesses, charities, Indigenous corps, social enterprises, government
2. **Person** — directors, responsible people, key personnel
3. **Transaction** — grants, contracts, donations, procurements, sponsorships
4. **Program** — grant programs, procurement categories, service types
5. **Place** — nation → state → LGA → postcode → suburb → electorate
6. **Document** — PDFs, reports, statements, evidence
7. **Story** — community voice, lived experience, priorities, outcomes

## The 4 Truth Layers

1. **Raw record** — exactly what the source published
2. **Resolved entity** — best canonical representation (gs_entities)
3. **Relationship** — donated to, contracted by, funded by, directs, operates in
4. **Community** — local voice, priorities, lived experience, community-defined outcomes

## Phase Status

| Phase | Status | What |
|-------|--------|------|
| 1. Central auditable core | **DONE** | Entity graph, search, place pages, entity dossiers, gap packs, premium gating |
| 1b. Cross-system integration | **DONE** | JH↔CG entity bridge (57%), ALMA evidence on dossiers, EL stories on place pages, LGA enrichment |
| 2. Data coverage expansion | **MOSTLY DONE** | 96% postcode, 96% remoteness, 95% LGA, 94% SEIFA. Remaining: ASIC directors, Supply Nation API |
| 3. Open contribution layer | PENDING | User corrections, community stories, local context |
| 4. Benchmarked intelligence | PENDING | Open tasks, competitions, decentralised compute |
| 5. Community governance | PENDING | Cooperative governance, community treasury |

## Data Sources

| Source | Status | Records | Freshness |
|--------|--------|---------|-----------|
| ACNC Charities | Live | 66K | Daily sync |
| ORIC Corporations | Live | 7.5K | Daily sync |
| AusTender Contracts | Live | 672K | Daily sync |
| AEC Political Donations | Live | 312K | On-demand |
| ATO Tax Transparency | Live | 24K | Annual |
| ASX Companies | Live | ~2K | Daily sync |
| Justice Funding | Live | 52K | Manual import |
| Foundations | Live | 10.8K | Enrichment pipeline |
| Grant Opportunities | Live | 18K | Discovery pipeline |
| Social Enterprises | Live | 10.3K | Supply Nation + Social Traders + B Corps |
| SEIFA 2021 | Static | 11K postcodes | ABS release cycle |
| Postcode Geo + LGA | Static | 12K postcodes | ABS release cycle |
| ASIC Companies | Live | 2.2M | ABN resolution backbone |
| ABR/ABN Lookup | **WAITING** | — | GUID pending (ref ABNL26131) |

## Revenue Model

- **Free public layer** — search, place pages, entity pages, core evidence
- **Paid professional layer** — procurement intelligence, alerts, API, bulk exports, due diligence
- **5 tiers** — Community (free), Professional ($79), Organisation ($249), Funder ($499), Enterprise ($1999)
- **Cross-subsidy** — institutions pay, communities get free access

## Target Audiences (Priority Order)

1. **Government procurement officers** — supplier discovery, Indigenous/SE compliance, tender intelligence packs ($49-499)
2. **Funders & philanthropists** — portfolio intelligence, funding gap analysis, foundation tracker ($499/mo)
3. **Community organisations** — grant search, answer bank, knowledge wiki, place-based intelligence (free)
4. **Researchers** — open data API, living reports, money flow analysis

## What Matters Now (Priority Stack)

1. **Launch to first users** — the product exists, no one is using it yet. This is the #1 priority.
2. ~~**Get to 97% geographic coverage**~~ — **DONE (96%)** via ABR bulk extract.
3. ~~**Entity description enrichment**~~ — **DONE (88.2%)** via ACNC/ABR/ORIC templates.
4. ~~**Improve entity match precision**~~ — **DONE (F1 94.1%)** via evaluator fix.
5. **Foundation enrichment at scale** — 3,264 of 10,779 done (30%), 494 with websites in queue
6. **ASIC selective enrichment** — directors + subsidiaries for high-value entities ($10-23/extract)
7. **Supply Nation integration** — verified Indigenous businesses complete the community-controlled picture (7,822 → 10K+)

## Ecosystem Integration (CivicGraph + JusticeHub + Empathy Ledger)

Three systems share one Supabase (CG + JH) with EL syncing in:

| System | Purpose | Key Metric |
|--------|---------|------------|
| **CivicGraph** | Decision infrastructure | 100K entities, 199K relationships |
| **JusticeHub** | Justice evidence | 556 orgs, 1.1K interventions, 570 evidence |
| **Empathy Ledger** | Community voice | 226 storytellers, 9 stories |

**Bridge:** ABN is the universal join key. 315 JH orgs linked to CG entities (57%). Remaining 241 need fuzzy/manual match.

**Cross-system features (LIVE):**
- CG entity dossier shows JusticeHub link + ALMA interventions/evidence
- CG place pages show Empathy Ledger community voices
- JH org pages show CG enrichment (SEIFA, remoteness, LGA, revenue)
- `build-entity-graph.mjs` auto-ingests JH orgs and links back

**Ownership:** CG owns entity resolution + geographic enrichment. JH owns justice evidence + interventions. EL owns community voice + consent.

**Check health:** `node --env-file=.env scripts/health-check.mjs` (includes `--ecosystem` section)

## What Does NOT Matter Now

- Community governance (Phase 5)
- Decentralised compute (Phase 4)
- Perfect data coverage (80% is useful, 100% is a trap)
- More data sources before validating with real users
