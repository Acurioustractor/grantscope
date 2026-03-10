# CivicGraph: State of Australian Power Dynamics
## A Data-Driven Audit of What We Have, What It Reveals, and What's Missing

*March 2026 — Internal Assessment*

---

## 1. Executive Summary

CivicGraph has assembled **~4.2 million records** across **40+ database tables**, **9 materialized views**, and **77 API endpoints** — creating the most comprehensive cross-referenced map of Australian money, power, and organisations ever built by a non-government entity. This report audits the current state of that data infrastructure against CivicGraph's founding thesis: **making the invisible visible**.

The verdict: the platform is roughly **75% built** toward the vision of a complete Australian power map. The entity layer (who exists) is comprehensive with 100K+ entities. The money flow layer (who pays whom) is substantially built with 670K contracts, 313K donations, and 52K justice funding records. The person layer (who controls what) and community voice layer (what communities actually need) remain the critical gaps.

---

## 2. The Data Estate: What We Actually Have

### 2.1 Database Inventory (35 Tables)

| Category | Table | Records | Status | Power Relevance |
|----------|-------|--------:|--------|-----------------|
| **Entity Registry** | `gs_entities` | 100,036 | Live, growing | Core — unified ABN-linked registry |
| **Relationship Graph** | `gs_relationships` | 211,783 | Live | Core — every connection between entities |
| **Entity Aliases** | `gs_entity_aliases` | Dynamic | Live | Supports entity resolution |
| **Charities** | `acnc_charities` | 64,560 | Live, weekly sync | Full ACNC register |
| **Charity Financials** | `acnc_ais` | 359,678 | Live (7 years) | Revenue, assets, grants, staff per year |
| **ASIC Companies** | `asic_companies` | 2,149,868 | Live | Company structures (shallow — no directors) |
| **AusTender** | `austender_contracts` | 670,303 | Live, full OCDS history | Federal procurement ($99.6B/yr universe) |
| **Political Donations** | `political_donations` | 312,933 | Live | AEC disclosure register |
| **Donor-Entity Matches** | `donor_entity_matches` | 5,361 | Live | Resolves donors → ABNs |
| **Foundations** | `foundations` | 10,779 | Live, 30% enriched | Philanthropic profiles |
| **Foundation Programs** | `foundation_programs` | 2,472 | Live | Active funding programs |
| **Grant Opportunities** | `grant_opportunities` | 18,069 | Live, daily refresh | 30+ sources, 100% embedded |
| **ORIC Indigenous Corps** | `oric_corporations` | 7,369 | Live | Aboriginal & TSI corporations |
| **Social Enterprises** | `social_enterprises` | 10,339 | Live | Supply Nation + 5 other sources |
| **ATO Tax Transparency** | `ato_tax_transparency` | 26,241 | Live | Large taxpayer income & tax data |
| **ASX Companies** | `asx_companies` | 1,976 | Live | Listed companies |
| **Justice Funding** | `justice_funding` | 52,133 | Live | Cross-sector justice funding flows |
| **SEIFA 2021** | `seifa_2021` | ~10,572 | Live | Disadvantage by postcode |
| **Postcode Geography** | `postcode_geo` | ~12,000 | Live | Location + remoteness + LGA |
| **ROGS Justice Spending** | `rogs_justice_spending` | 9,576 | Live | State-by-state justice costs |
| **Community Orgs** | `community_orgs` | 541 | Live | Enriched profiles |

### 2.2 Cross-Reference Intelligence (Materialized Views)

| View | What It Shows | Records |
|------|---------------|---------|
| `mv_gs_donor_contractors` | Entities that BOTH donate to parties AND hold govt contracts | 140 entities |
| `mv_gs_entity_stats` | Relationship counts and amounts per entity | All entities |
| `mv_donor_contract_crossref` | Political donors who also hold contracts | Deduped by ABN |
| `mv_acnc_latest` | Latest financial year per charity | ~53,000 |
| `mv_funding_by_postcode` | Place-based funding aggregation with SEIFA | All postcodes |
| `mv_data_quality` | Completeness scorecard across datasets | Per-dataset |
| `mv_crossref_quality` | Linkage quality across datasets | Per-cross-reference |

### 2.3 Frontend Surfaces (70 Pages, 77 API Routes)

| Page | What Users See | Data Sources |
|------|---------------|--------------|
| `/entities` | Entity graph browser + donor-contractor flagship view | gs_entities, mv_gs_donor_contractors |
| `/entities/[gsId]` | Full entity dossier ("ABN X-Ray") | 8+ parallel queries across all tables |
| `/grants` | Semantic + keyword grant search | grant_opportunities + pgvector |
| `/foundations` | Foundation directory with giving history | foundations, acnc_ais, foundation_programs |
| `/places` | Community funding map by postcode | mv_funding_by_postcode, seifa_2021, postcode_geo |
| `/power` | Capital map, money flows, network graphs | power/* APIs, gs_entities, gs_relationships |
| `/dashboard` | Data observatory with health metrics | All tables (counts, freshness) |
| `/knowledge` | Knowledge Wiki — document upload + AI Q&A | knowledge_sources, knowledge_chunks, wiki_pages |
| `/pipeline` | Grant pipeline with Notion sync | Notion API, grant pipeline tables |
| `/tender-intelligence` | AI-analysed procurement opportunities | austender_contracts, tender analysis |
| `/portfolio` | Organisation portfolio management | org_profiles, saved entities |
| `/alerts` | Email alert configuration | alert rules, matching engine |
| `/social-enterprises` | Social enterprise directory + map | social_enterprises (10,339 records) |

---

## 3. What the Data Already Reveals About Australian Power

### 3.1 The Donor-Contractor Overlap

**140 entities** simultaneously donate to political parties AND hold government contracts.

- **$80M** in total political donations from these entities
- **$4.7B** in government contracts held by these same entities
- **58x return** per dollar donated (correlation, not causation — but the pattern is structural)
- **28 political parties** receive donations from entities that also contract with government
- Both major parties benefit — this is bipartisan, not partisan

This is the flagship finding. It's derived from cross-referencing `political_donations` → `donor_entity_matches` → `austender_contracts` by ABN. No other Australian platform can surface this.

### 3.2 Charity Sector: Enormous and Invisible

From `acnc_charities` + `acnc_ais` (7 years of data):

- **64,473** registered charities
- **$249 billion** combined annual revenue
- **$545 billion** combined assets
- **$2.99 billion** in grants distributed by foundations
- Revenue from government: significant but unevenly distributed
- **94% of charitable donations go to 10% of organisations**

The charity sector is larger than many ASX-listed companies combined, yet no equivalent of a stock exchange dashboard exists. CivicGraph is building that dashboard.

### 3.3 Foundation Giving: Concentrated and Opaque

From `foundations` (10,779 records, 30% AI-enriched):

- 10,779 foundations profiled with ACNC financials
- 2,472 active funding programs mapped
- 3,264 enriched with AI-generated profiles (descriptions, tips, focus areas)
- **Gap**: 70% of foundations still lack enriched profiles
- **Gap**: No standardised grant outcome data (360Giving equivalent missing)

### 3.4 Government Procurement: Who Gets the Money

From `austender_contracts` (670,303 contracts — full OCDS history from 2013):

- **87.5%** of federal procurement value goes to **10 entities**
- SMEs win 52% of contracts by number but only 35% by value
- Government consulting spend: ~$1B in 2024-25
- Post-PwC spending shifted to other consulting firms, not reduced
- Cross-referenced with ACNC: shows which charities hold government contracts
- Cross-referenced with ORIC: shows Indigenous corporation contract participation

### 3.5 Indigenous Self-Governance Infrastructure

From `oric_corporations` (7,369 records, 3,366 active):

- **41%** (1,389) also registered as ACNC charities
- Distribution: QLD (854), WA (809), NSW (694), NT (663), SA (144), VIC (131)
- By size: 281 Large, 804 Medium, 2,281 Small
- AI enrichment identifies specific language groups, traditional country, and community roles
- **Gap**: No procurement data showing what % of government contracts go to Indigenous businesses

### 3.6 Tax Transparency: Who Pays and Who Doesn't

From `ato_tax_transparency` (26,241 records — full dataset imported):

- Large entities ($100M+ income) reporting $3.28T total income
- $95.7B in tax payable across all reporting entities
- Effective tax rate calculable per entity (generated column)
- **Key cross-reference**: entities that receive government contracts but pay minimal tax
- Full multi-year dataset now available for trend analysis

### 3.7 Geographic Power Distribution

From `seifa_2021` + `postcode_geo` + `mv_funding_by_postcode`:

- SEIFA disadvantage scoring by postcode (deciles 1-10)
- Remoteness classification (Major Cities → Very Remote)
- `get_funding_gaps()` function calculates gap scores combining:
  - Community-controlled entity ratio
  - SEIFA disadvantage level
  - Remoteness classification
- **Enables**: "Show me postcodes with highest disadvantage + lowest funding"
- Entity geo coverage: postcode 90%, remoteness 96%, LGA 90%, SEIFA 89%
- 7,822 community-controlled organisations identified

---

## 4. The Five Power Layers: Completion Assessment

### Layer 1: Entity Registry — 90% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| Charities (ACNC) | Done (64,560) | Weekly sync operational |
| Foundations | Done (10,779) | 70% need enrichment |
| Indigenous Corps (ORIC) | Done (7,369) | Cross-referenced with ACNC |
| ASIC Companies | Done (2.1M) | Shallow — no directors/officers |
| ASX Listed | Done (1,976) | Linked to ASIC |
| Social Enterprises | Done (10,339) | Supply Nation + 5 sources |
| ABN Bulk Extract | **Partially done** | ABR data used to fill 15,980 entity postcodes |
| **ASIC Directors** | **NOT DONE** | **Paid extracts ($23/entity)** |
| **Beneficial Ownership** | **NOT AVAILABLE** | **~2027 legislation** |

Entity geo coverage is now strong: postcode 90%, remoteness 96%, LGA 90%, SEIFA 89%. The ABR Bulk Extract (928MB, 20 XML files) has been downloaded and used for postcode enrichment.

### Layer 2: Money Flows — 80% Complete

| Flow Type | Status | Records | Gap |
|-----------|--------|--------:|-----|
| Political donations | Done | 312,933 | Full AEC register |
| Federal procurement | **Done** | 670,303 | **Full OCDS history from 2013** |
| Foundation grants | Done | 18,069 opps | Recipients often unknown |
| ATO tax data | **Done** | 26,241 | **Full dataset imported** |
| Justice funding | **Done** | 52,133 | Cross-sector justice flows |
| **State procurement** | **NOT DONE** | — | NSW, QLD, VIC, WA, SA, TAS all separate |
| **GrantConnect awards** | **NOT DONE** | — | No API, no bulk download |
| **Mining royalties** | **NOT DONE** | — | State-by-state, fragmented |

**Major progress**: AusTender full backfill (58K → 670K), ATO full import (2K → 26K), political donations expanded (189K → 313K), justice funding added (52K). The remaining gaps are state procurement and GrantConnect awards.

### Layer 3: Tax & Revenue — 70% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| ATO large taxpayer data | **Done (26,241 records)** | Full multi-year dataset |
| Cross-ref with procurement | **Done via entity graph** | ABN-linked in gs_entities |
| Effective tax rate analysis | Schema supports it | Views ready to build |
| **Company financials (ASIC)** | **NOT DONE** | Paid extracts |
| **Superannuation flows** | **NOT DONE** | Not publicly available |

### Layer 4: Person Layer (Who Controls What) — 10% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| gs_entities supports `person` type | Schema ready | Pipeline not built |
| gs_relationships supports `directorship` | Schema ready | No data flowing |
| ACNC responsible persons | Available (public) | **Not imported** |
| AEC individual donors | In political_donations | Not entity-resolved as persons |
| ORIC officeholders | Available (public) | **Not imported** |
| **ASIC directors/officers** | **NOT DONE** | Paid ($23/entity) — selective only |
| **Cross-ref: charity directors ↔ political donors** | **NOT DONE** | **Highest investigative value** |

**This is the most underbuilt layer relative to its importance.** The interlocking-directorate angle — people who sit on charity boards AND donate to political parties AND direct companies with government contracts — is the investigative goldmine. The schema supports it. The data pipelines don't exist yet.

### Layer 5: Community Voice — 5% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| Place pages (postcode funding) | Built | Basic — needs community stories |
| SEIFA disadvantage mapping | Built | Static (2021 Census) |
| Funding gap calculator | Built (RPC function) | Needs richer inputs |
| **Empathy Ledger integration** | **NOT DONE** | API exists but not connected |
| **LGA Community Strategic Plans** | **NOT DONE** | Public PDFs — LLM extraction needed |
| **APH Inquiry Submissions** | **NOT DONE** | Community testimony, unstructured |
| **Community-defined outcomes** | **NOT DONE** | The thing that makes GS unique |

**This is the layer that makes CivicGraph different from every other transparency platform.** Everyone else stops at showing where money goes. CivicGraph's thesis is that you also need to show whether money matched what communities actually need. This layer barely exists yet.

---

## 5. The Entity Graph: Structural Analysis

### 5.1 Current Graph State

```
ENTITIES:      100,036 nodes
RELATIONSHIPS: 211,783 edges
ENTITY TYPES:  charity (52K), company (24K), foundation (10.7K),
               indigenous_corp (7.3K), social_enterprise (5.2K),
               government_body (134), political_party, person, trust
RELATIONSHIP TYPES: contract (170K), donation (36K), grant (5.4K),
                    directorship, ownership, charity_link, program_funding,
                    tax_record, registered_as, listed_as,
                    subsidiary_of, member_of, lobbies_for
```

### 5.2 Graph Density by Relationship Type

| Type | Edges | What It Connects |
|------|------:|------------------|
| contract | ~170K | Government Bodies → Suppliers |
| donation | ~36K | Donors → Political Parties |
| charity_link | ~10K | Foundations → ACNC Charities |
| grant | ~5.4K | Foundations → Grant Programs |
| registered_as | ~1,389 | ORIC Corps → ACNC Charities |
| directorship | ~0 | **Empty — critical gap** |
| ownership | ~0 | **Empty — awaiting beneficial ownership register** |

### 5.3 Entity Resolution Quality

From `/benchmark` page and entity resolution pipeline:

- **Entity resolution F1 score: 94.1%** (trigram matching + ABN/ACN/ICN)
- Match methods: exact ABN, trigram similarity, manual verification
- Confidence hierarchy: registry > verified > reported > inferred > unverified
- `gs_id` format: `AU-ABN-12345678901` (deterministic, ABN-primary)
- `gs_make_id()` function generates canonical IDs from best available identifier
- `normalize_company_name()` strips suffixes and normalises for fuzzy matching

**Assessment**: 94.1% F1 is strong for automated entity resolution on messy AEC donor names. Previous score of 77.3% was due to a benchmark evaluator bug (negative pairs scored as FP when the resolver correctly found the right entity).

---

## 6. Frontend Data System: What Users Can See

### 6.1 Power Analysis Surfaces

The `/power` page provides four visualisations:

1. **Community Capital Map** — SA2-level funding distribution across Australia
2. **Follow the Money** — Sankey diagram showing funding flows between entity types
3. **Power Network** — Interactive network graph for selected entities showing all connections
4. **Community Voice** — Placeholder (not yet built)

Data coverage metrics shown live:
- Total entities, relationships, SA2 regions with data
- Entity geocoverage percentage
- Data gaps: entities without postcode, unmapped postcodes, missing SA2 codes

### 6.2 Entity Dossier ("ABN X-Ray")

The `/entities/[gsId]` page is the product wedge — 1,272 lines of code showing everything connected to an entity:

- **Identity**: Name, type, ABN, sector, source datasets
- **Relationships**: Outbound/inbound — donations, contracts, grants, subsidiaries
- **Financials**: ACNC 7-year history (revenue, assets, grants, staff)
- **Political**: Donation history with party breakdown
- **Procurement**: Government contract history
- **Location Intelligence**: Postcode, SEIFA decile, remoteness, SA2 context
- **Connected Entities**: Network traversal showing linked organisations
- **Donor-Contractor Alert**: Flags entities appearing in both donation and contract records
- **Premium Gating**: Justice funding and full lists behind subscription tiers

### 6.3 Grant Discovery

The `/grants` page offers dual search:
- **Keyword search**: ilike matching on name/provider
- **AI Semantic search**: pgvector embeddings with cosine similarity scoring
- 17,727 grants from 30+ sources, 96% embedded
- Filters: type, category, amount, geography, source, program type, closing date

### 6.4 Place-Based Analysis

The `/places/[postcode]` pages show:
- All entities operating in or near the postcode
- Funding flowing to the area (grants, contracts, donations)
- SEIFA disadvantage score and remoteness classification
- Community-controlled entity ratio
- Funding gap score (composite metric)

---

## 7. Revenue & Product Readiness

### 7.1 Pricing (Live on Stripe)

| Tier | Price/mo | Target Segment | Status |
|------|--------:|---------------|--------|
| Community | $0 | Grassroots NFPs, First Nations orgs | Live |
| Professional | $79 | Established NFPs, grant consultants | Live |
| Organisation | $249 | Larger NFPs, peak bodies | Live |
| Funder | $499 | Foundations, corporate giving | Live |
| Enterprise | $1,999 | Government, large foundations | Live |

### 7.2 Current State

- **Paying customers**: 0
- **External users**: 0
- **Beta testers**: Not yet recruited
- **Access control enforcement**: Needs implementation
- **Email alerts**: Not built
- **Cron jobs**: Not deployed (daily grants refresh, weekly entity graph rebuild)

### 7.3 Revenue Readiness Assessment

| Prerequisite | Status | Priority |
|-------------|--------|----------|
| Access control on premium features | Not done | Critical |
| Email digest (new grants matching profile) | Not done | High |
| Cron jobs for data freshness | Not done | High |
| Full signup → save → track → upgrade flow | Not tested e2e | High |
| Analytics (Vercel + custom events) | Not done | Medium |
| LinkedIn page + first content | Not done | High |
| Beta tester recruitment | Not done | High |

---

## 8. The Power Dynamics Thesis: Evidence Assessment

### 8.1 What the Data Proves

1. **Corporate concentration is extreme**: The ASX top 100 commands 47% of GDP. Two supermarkets control 65% of grocery. 10 entities get 87.5% of procurement value. The data in AusTender, ACNC, and ATO confirms this is structural, not anecdotal.

2. **Political money and government contracts correlate**: 140 entities donate to parties AND hold contracts. The cross-reference is clean (ABN-matched). The pattern is bipartisan.

3. **Charity sector is massive but invisible**: $249B revenue, $545B assets — larger than most industries — but no unified dashboard existed before CivicGraph.

4. **Foundation giving is concentrated**: 10,763 foundations, but giving is heavily skewed toward established urban organisations. 94% of donations reach 10% of charities.

5. **Indigenous self-governance infrastructure exists at scale**: 3,366 active ORIC corporations across every state, 41% also ACNC-registered. AI enrichment reveals specific language groups and community roles. This is the first comprehensive map.

6. **Geographic funding gaps are measurable**: SEIFA + remoteness + entity counts per postcode = quantifiable gap scores. The `get_funding_gaps()` function already works.

### 8.2 What the Data Suggests But Can't Yet Prove

1. **Who actually controls the money**: Without the person layer (ACNC responsible persons + AEC donors cross-referenced), we can show money flows between organisations but not the people who sit across multiple boards and benefit from multiple flows.

2. **Whether funded programs work**: Without community voice data or outcome tracking, we can show where money goes but not whether it achieves anything.

3. **The full procurement picture**: Federal procurement is now comprehensive (670,303 contracts). State procurement (NSW, QLD, VIC, WA, SA) remains entirely missing.

4. **Beneficial ownership**: Until the register goes live (~2027), we can't connect corporate entities to their real human owners.

### 8.3 What the Data Can't Address Yet

1. **Informal power**: Board dinners, golf club networks, school ties, family connections — none of this is in structured data.

2. **International money flows**: Australian entities with offshore structures, foreign-owned companies operating in Australia, international foundation grants — mostly opaque.

3. **Media ownership and influence**: Not tracked in any current dataset.

4. **Lobbying effectiveness**: We know who lobbies, but not what they achieve.

---

## 9. Critical Gaps: Deep Investigation (March 2026)

### Gap 1: AusTender — ✅ DONE

**Full OCDS backfill completed.** 670,303 contracts imported — full history from 2013. This was previously the biggest quick win; now it's done.

The AusTender data is now integrated into the entity graph with 170K+ contract relationships linking government bodies to suppliers.

### Gap 2: Person Layer — Harder Than Expected

**Investigation finding**: ACNC bulk CSV does NOT include responsible person names. Only the count (`num_responsible_persons`) is available in the public download.

**Schema is ready** (zero data flowing):
- `gs_entities` supports `entity_type='person'` — 0 person records exist
- `gs_relationships` supports `relationship_type='directorship'` — 0 directorship records exist
- `build-entity-graph.mjs` creates organisations only, never persons

**Available data sources for persons (all free, all public)**:

| Source | Data Available | Acquisition Method | Effort |
|--------|---------------|-------------------|--------|
| ACNC website | Responsible person names per charity | Per-charity scraping (64K pages) or ACNC API | Weeks |
| AEC donations | Individual donor names (mixed with orgs) | Already imported — need to classify person vs org | Days |
| ORIC register | Corporation officeholders | Public register scraping | Days |
| ASIC directors | Director/officer names per company | **Paid**: $23/entity via GlobalX | Selective only |

**The investigative gold** — cross-referencing charity directors with political donors — requires getting ACNC responsible person names first. Without that, the interlocking-directorate analysis can't happen.

**Recommended approach**:
1. Research whether ACNC has a per-entity API (faster than scraping 64K pages)
2. Classify AEC donor names as person vs organisation (quick win — filter by return_type and name patterns)
3. Start with high-value entities only (foundations, donor-contractors, top 1000 charities by revenue)
4. ASIC director data selectively for entities appearing in multiple datasets

**Effort**: 2-4 weeks for a meaningful person layer. Months for comprehensive coverage.

### Gap 3: Community Voice — The Competitive Moat (Unbuilt)

**Current state verified**:
- Place pages show money + demographics only (SEIFA, remoteness, entity counts, gap scores)
- Power page has a literal "Coming Soon" placeholder for Community Voice tab
- Zero database tables for community stories or priorities
- Zero API endpoints for community content
- Zero Empathy Ledger integration code

**What place pages currently show**:
```
✓ Money in (total funding, entity count, community-controlled share)
✓ Who got it (top recipients, entity type breakdown)
✓ Demographic context (SEIFA decile, remoteness)
✗ What communities say they need — EMPTY
✗ The gap between money and need — EMPTY
```

**The strategy says**: "This is the layer that makes CivicGraph genuinely different. Most transparency platforms stop at showing where money goes. None show whether the money matched what communities actually need."

**Fastest path to any community content**:
1. **Empathy Ledger API** — reportedly "2 stories live, 15 storytellers ready", syndication API built. Wire it to place pages. (2-3 weeks)
2. **LGA Community Strategic Plans** — public PDFs from every council. LLM extraction of priorities by postcode. (4-6 weeks)
3. **APH Inquiry Submissions** — community testimony searchable on aph.gov.au. Structured extraction. (3-4 weeks)

**Effort**: Months for meaningful coverage. EL integration is the quickest proof of concept.

---

## 9.1 Priority Actions (Revised After Investigation)

### Do Now (March 2026)

| Action | Effort | Impact |
|--------|--------|--------|
| ~~Run AusTender backfill~~ | ~~Done~~ | ✅ 670K contracts |
| ~~Complete ATO import~~ | ~~Done~~ | ✅ 26,241 records |
| **Launch to first users** | Days | #1 priority — zero external users |
| Foundation enrichment (remaining 70%) | Ongoing | Customer value — 494 queued |
| Deploy cron jobs (grants daily, entity graph weekly) | Days | Data stays fresh |

### Do This Month

| Action | Effort | Impact |
|--------|--------|--------|
| Recruit 10 beta testers | Days | First external validation |
| Enforce access control on premium routes | Days | Revenue prerequisite |
| Research ACNC per-entity API for person names | Days | Unblocks person layer |
| Classify AEC donors as person vs org | Days | First person-layer data |

### Do This Quarter

| Action | Effort | Impact |
|--------|--------|--------|
| ACNC responsible person import (top 1000 charities) | 2-3 weeks | Interlocking directorates |
| LGA Community Strategic Plan extraction | 4-6 weeks | Council priorities by place |
| State procurement (NSW, QLD) | 3-6 months | National procurement picture |
| Beneficial ownership readiness | Ongoing | Position for 2027 register |

---

## 10. The Thesis Restated

CivicGraph exists because **informational power in Australia is asymmetric**. Large corporations, consulting firms, and political insiders understand how money moves through the economy. Community organisations, small businesses, journalists, and citizens do not.

The data to change this already exists. It sits in government databases, published under open licences. What didn't exist was the connective tissue — a platform that links entity registrations to government contracts to grants to tax data to political donations by ABN.

**Current state**: 100,036 entities, 211,783 relationships, 4.2M total records, 77 API endpoints, 70 pages, 86 scripts, 15 investigative reports. Built by 2 people.

**What remains**: The person layer (who controls what), the community voice layer (what communities actually need), state procurement, and the revenue engine (0 paying customers → first users).

The data infrastructure Australia never had is 75% built. Federal procurement is complete (670K contracts). Tax transparency is complete (26K records). The entity graph is comprehensive (100K+ entities). The next 25% — plus actually launching to users — determines whether it becomes a permanent civic institution or a technically impressive prototype.

---

*CivicGraph — civicgraph.au*
*Making the invisible visible.*
*Built on Jinibara Country.*
