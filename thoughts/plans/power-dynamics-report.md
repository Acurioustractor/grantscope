# GrantScope: State of Australian Power Dynamics
## A Data-Driven Audit of What We Have, What It Reveals, and What's Missing

*March 2026 — Internal Assessment*

---

## 1. Executive Summary

GrantScope has assembled **~2.8 million records** across **35 database tables**, **9 materialized views**, and **47 API endpoints** — creating the most comprehensive cross-referenced map of Australian money, power, and organisations ever built by a non-government entity. This report audits the current state of that data infrastructure against GrantScope's founding thesis: **making the invisible visible**.

The verdict: the platform is roughly **60% built** toward the vision of a complete Australian power map. The foundation layer (who exists) is strong. The money flow layer (who pays whom) is partially built. The person layer (who controls what) and community voice layer (what communities actually need) remain the critical gaps.

---

## 2. The Data Estate: What We Actually Have

### 2.1 Database Inventory (35 Tables)

| Category | Table | Records | Status | Power Relevance |
|----------|-------|--------:|--------|-----------------|
| **Entity Registry** | `gs_entities` | 92,303 | Live, growing | Core — unified ABN-linked registry |
| **Relationship Graph** | `gs_relationships` | 50,425 | Live | Core — every connection between entities |
| **Entity Aliases** | `gs_entity_aliases` | Dynamic | Live | Supports entity resolution |
| **Charities** | `acnc_charities` | 64,473 | Live, weekly sync | Full ACNC register |
| **Charity Financials** | `acnc_ais` | 359,678 | Live (7 years) | Revenue, assets, grants, staff per year |
| **ASIC Companies** | `asic_companies` | 2,149,868 | Live | Company structures (shallow — no directors) |
| **AusTender** | `austender_contracts` | 58,128 | Live, weekly sync | Federal procurement ($99.6B/yr universe) |
| **Political Donations** | `political_donations` | 188,609 | Live | AEC disclosure register |
| **Donor-Entity Matches** | `donor_entity_matches` | 5,361 | Live | Resolves donors → ABNs |
| **Foundations** | `foundations` | 10,763 | Live, 55% enriched | Philanthropic profiles |
| **Foundation Programs** | `foundation_programs` | 2,378 | Live | Active funding programs |
| **Grant Opportunities** | `grant_opportunities` | 17,727 | Live, daily refresh | 30+ sources, 96% embedded |
| **ORIC Indigenous Corps** | `oric_corporations` | 7,369 | Live | Aboriginal & TSI corporations |
| **Social Enterprises** | `social_enterprises` | 3,541 | Live | Multi-source aggregation |
| **ATO Tax Transparency** | `ato_tax_transparency` | ~2,000 | Live | Large taxpayer income & tax data |
| **ASX Companies** | `asx_companies` | 1,976 | Live | Listed companies |
| **Modern Slavery** | (via gs_entities) | 16,473 | Imported | Corporate accountability |
| **Lobbying Register** | (via gs_entities) | 139 | Imported | Influence mapping |
| **SEIFA 2021** | `seifa_2021` | ~10,572 | Live | Disadvantage by postcode |
| **Postcode Geography** | `postcode_geo` | ~10,559 | Live | Location + remoteness |
| **ROGS Justice Spending** | `rogs_justice_spending` | 9,576 | Live | State-by-state justice costs |
| **Community Orgs** | `community_orgs` | 541 | Live | Enriched profiles |
| **Money Flows** | `money_flows` | 406 | Legacy | Manual aggregate flows |

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

### 2.3 Frontend Surfaces (7 Data Pages, 47 API Routes)

| Page | What Users See | Data Sources |
|------|---------------|--------------|
| `/entities` | Entity graph browser + donor-contractor flagship view | gs_entities, mv_gs_donor_contractors |
| `/entities/[gsId]` | Full entity dossier ("ABN X-Ray") | 8+ parallel queries across all tables |
| `/grants` | Semantic + keyword grant search | grant_opportunities + pgvector |
| `/foundations` | Foundation directory with giving history | foundations, acnc_ais, foundation_programs |
| `/places` | Community funding map by postcode | mv_funding_by_postcode, seifa_2021, postcode_geo |
| `/power` | Capital map, money flows, network graphs | power/* APIs, gs_entities, gs_relationships |
| `/dashboard` | Data observatory with health metrics | All tables (counts, freshness) |

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

The charity sector is larger than many ASX-listed companies combined, yet no equivalent of a stock exchange dashboard exists. GrantScope is building that dashboard.

### 3.3 Foundation Giving: Concentrated and Opaque

From `foundations` (10,763 records, 55% AI-enriched):

- 10,763 foundations profiled with ACNC financials
- 2,378 active funding programs mapped
- 1,627 enriched with AI-generated profiles (descriptions, tips, focus areas)
- **Gap**: 45% of foundations still lack enriched profiles
- **Gap**: No standardised grant outcome data (360Giving equivalent missing)

### 3.4 Government Procurement: Who Gets the Money

From `austender_contracts` (58,128 contracts):

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

From `ato_tax_transparency` (~2,000 records):

- Large entities ($100M+ income) reporting $3.28T total income
- $95.7B in tax payable across all reporting entities
- Effective tax rate calculable per entity (generated column)
- **Key cross-reference**: entities that receive government contracts but pay minimal tax
- **Gap**: Only ~2,000 records imported vs 4,110 available. Needs completion.

### 3.7 Geographic Power Distribution

From `seifa_2021` + `postcode_geo` + `mv_funding_by_postcode`:

- SEIFA disadvantage scoring by postcode (deciles 1-10)
- Remoteness classification (Major Cities → Very Remote)
- `get_funding_gaps()` function calculates gap scores combining:
  - Community-controlled entity ratio
  - SEIFA disadvantage level
  - Remoteness classification
- **Enables**: "Show me postcodes with highest disadvantage + lowest funding"
- **Gap**: Entity-to-place linkage still incomplete. Many entities lack geocoded postcodes.

---

## 4. The Five Power Layers: Completion Assessment

### Layer 1: Entity Registry — 75% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| Charities (ACNC) | Done (64,473) | Weekly sync operational |
| Foundations | Done (10,763) | 45% need enrichment |
| Indigenous Corps (ORIC) | Done (7,369) | Cross-referenced with ACNC |
| ASIC Companies | Done (2.1M) | Shallow — no directors/officers |
| ASX Listed | Done (1,976) | Linked to ASIC |
| Social Enterprises | Done (3,541) | Multi-source |
| Modern Slavery | Done (16,473) | Imported |
| Lobbying Register | Done (139) | Small dataset |
| **ABN Bulk Extract** | **NOT DONE** | **10M+ entities — the backbone** |
| **ASIC Directors** | **NOT DONE** | **Paid extracts ($23/entity)** |
| **Beneficial Ownership** | **NOT AVAILABLE** | **~2027 legislation** |

**The critical missing piece**: The ABN Bulk Extract (10M+ entities) would make the entity registry comprehensive. Every other dataset can be joined via ABN, but without the full ABN register, the gs_entities table only contains entities that appear in at least one other dataset.

### Layer 2: Money Flows — 50% Complete

| Flow Type | Status | Records | Gap |
|-----------|--------|--------:|-----|
| Political donations | Done | 188,609 | Annual updates |
| Federal procurement | Partial | 58,128 | AusTender has 450K+ — need full OCDS sync |
| Foundation grants | Partial | 17,727 opps | Recipients often unknown |
| ATO tax data | Partial | ~2,000 | 4,110 available |
| **State procurement** | **NOT DONE** | — | NSW, QLD, VIC, WA, SA, TAS all separate |
| **GrantConnect awards** | **NOT DONE** | — | No API, no bulk download |
| **Mining royalties** | **NOT DONE** | — | State-by-state, fragmented |

**The critical missing piece**: GrantConnect (federal grant awards — not just opportunities) has no API. This means we know what grants are available but often can't track what grants were actually awarded and to whom.

### Layer 3: Tax & Revenue — 30% Complete

| Component | Status | Gap |
|-----------|--------|-----|
| ATO large taxpayer data | Partial (~2,000 of 4,110) | Need full import |
| Cross-ref with procurement | Possible via ABN | Not materialised |
| Effective tax rate analysis | Schema supports it | Views not built |
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

**This is the layer that makes GrantScope different from every other transparency platform.** Everyone else stops at showing where money goes. GrantScope's thesis is that you also need to show whether money matched what communities actually need. This layer barely exists yet.

---

## 5. The Entity Graph: Structural Analysis

### 5.1 Current Graph State

```
ENTITIES:     92,303 nodes
RELATIONSHIPS: 50,425 edges
ENTITY TYPES:  company, charity, foundation, government_body,
               indigenous_corp, political_party, person,
               social_enterprise, trust, unknown
RELATIONSHIP TYPES: donation, contract, grant, directorship,
                    ownership, charity_link, program_funding,
                    tax_record, registered_as, listed_as,
                    subsidiary_of, member_of, lobbies_for
```

### 5.2 Graph Density by Relationship Type

| Type | Edges | What It Connects |
|------|------:|------------------|
| donation | ~188K potential (5,361 matched) | Donors → Political Parties |
| contract | ~58K | Government Bodies → Suppliers |
| charity_link | ~10K | Foundations → ACNC Charities |
| registered_as | ~1,389 | ORIC Corps → ACNC Charities |
| tax_record | ~2K | Companies → ATO |
| lobbies_for | 139 | Lobbyists → Clients |
| grant | ~17K | Foundations → Grant Programs |
| directorship | ~0 | **Empty — critical gap** |
| ownership | ~0 | **Empty — awaiting beneficial ownership register** |

### 5.3 Entity Resolution Quality

From `/benchmark` page and entity resolution pipeline:

- **Entity resolution F1 score: 77.3%** (trigram matching + ABN/ACN/ICN)
- Match methods: exact ABN, trigram similarity, manual verification
- Confidence hierarchy: registry > verified > reported > inferred > unverified
- `gs_id` format: `AU-ABN-12345678901` (deterministic, ABN-primary)
- `gs_make_id()` function generates canonical IDs from best available identifier
- `normalize_company_name()` strips suffixes and normalises for fuzzy matching

**Assessment**: 77.3% F1 is good for automated entity resolution on messy AEC donor names, but means ~23% of political donation → entity links are missed or incorrect. The benchmark dashboard tracks this with confusion matrix and failure analysis.

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

3. **Charity sector is massive but invisible**: $249B revenue, $545B assets — larger than most industries — but no unified dashboard existed before GrantScope.

4. **Foundation giving is concentrated**: 10,763 foundations, but giving is heavily skewed toward established urban organisations. 94% of donations reach 10% of charities.

5. **Indigenous self-governance infrastructure exists at scale**: 3,366 active ORIC corporations across every state, 41% also ACNC-registered. AI enrichment reveals specific language groups and community roles. This is the first comprehensive map.

6. **Geographic funding gaps are measurable**: SEIFA + remoteness + entity counts per postcode = quantifiable gap scores. The `get_funding_gaps()` function already works.

### 8.2 What the Data Suggests But Can't Yet Prove

1. **Who actually controls the money**: Without the person layer (ACNC responsible persons + AEC donors cross-referenced), we can show money flows between organisations but not the people who sit across multiple boards and benefit from multiple flows.

2. **Whether funded programs work**: Without community voice data or outcome tracking, we can show where money goes but not whether it achieves anything.

3. **The full procurement picture**: 58,128 contracts is a fraction of the 450K+ in AusTender. State procurement is entirely missing. The current data shows patterns but not the complete picture.

4. **Beneficial ownership**: Until the register goes live (~2027), we can't connect corporate entities to their real human owners.

### 8.3 What the Data Can't Address Yet

1. **Informal power**: Board dinners, golf club networks, school ties, family connections — none of this is in structured data.

2. **International money flows**: Australian entities with offshore structures, foreign-owned companies operating in Australia, international foundation grants — mostly opaque.

3. **Media ownership and influence**: Not tracked in any current dataset.

4. **Lobbying effectiveness**: We know who lobbies, but not what they achieve.

---

## 9. Critical Gaps: Deep Investigation (March 2026)

### Gap 1: AusTender — Quick Win, Run the Backfill

**Root cause identified**: The sync script (`sync-austender-contracts.mjs`) defaults to **3 months** of data. It has never been run with full historical parameters.

```bash
# Current behavior (58K contracts):
node scripts/sync-austender-contracts.mjs
# → Only syncs last 3 months via contractPublished endpoint

# What it should be (800K+ contracts):
node scripts/sync-austender-contracts.mjs --from=2013-01-01
# → 144 monthly chunks, ~4-5 hours, full OCDS history
```

**Additional fixes needed**:
- Switch from `contractPublished` to `contractLastModified` endpoint (captures amendments, not just new contracts)
- Add sync checkpoint tracking for efficient daily incremental sync
- Deploy as cron job for ongoing freshness

**Effort**: Run one command today (~5 hours). Endpoint fix is a 1-line code change.
**Impact**: 58K → 800K contracts. Definitive federal procurement analysis.

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

**The strategy says**: "This is the layer that makes GrantScope genuinely different. Most transparency platforms stop at showing where money goes. None show whether the money matched what communities actually need."

**Fastest path to any community content**:
1. **Empathy Ledger API** — reportedly "2 stories live, 15 storytellers ready", syndication API built. Wire it to place pages. (2-3 weeks)
2. **LGA Community Strategic Plans** — public PDFs from every council. LLM extraction of priorities by postcode. (4-6 weeks)
3. **APH Inquiry Submissions** — community testimony searchable on aph.gov.au. Structured extraction. (3-4 weeks)

**Effort**: Months for meaningful coverage. EL integration is the quickest proof of concept.

---

## 9.1 Priority Actions (Revised After Investigation)

### Do Today

| Action | Effort | Impact |
|--------|--------|--------|
| Run AusTender backfill `--from=2013-01-01` | 5 hours (background) | 58K → 800K contracts |
| Fix endpoint to `contractLastModified` | 1 line of code | Captures amendments |
| Complete ATO import (remaining 2,110 entities) | Hours | Full tax transparency picture |

### Do This Week

| Action | Effort | Impact |
|--------|--------|--------|
| Deploy cron jobs (grants daily, entity graph weekly) | Days | Data stays fresh |
| Enforce access control on premium routes | Days | Revenue prerequisite |
| Classify AEC donors as person vs org | Days | First person-layer data |
| Rebuild entity graph after AusTender backfill | Hours | Graph reflects 800K contracts |

### Do This Month

| Action | Effort | Impact |
|--------|--------|--------|
| Research ACNC per-entity API for person names | Days | Unblocks person layer |
| ABN Bulk Extract import (10M+ entities) | 1-2 weeks | Universal entity backbone |
| Foundation enrichment (remaining 45%) | Ongoing | Customer value |
| Wire Empathy Ledger syndication to place pages | 2-3 weeks | First community voice data |

### Do This Quarter

| Action | Effort | Impact |
|--------|--------|--------|
| ACNC responsible person import (top 1000 charities) | 2-3 weeks | Interlocking directorates |
| LGA Community Strategic Plan extraction | 4-6 weeks | Council priorities by place |
| State procurement (NSW, QLD) | 3-6 months | National procurement picture |
| Beneficial ownership readiness | Ongoing | Position for 2027 register |

---

## 10. The Thesis Restated

GrantScope exists because **informational power in Australia is asymmetric**. Large corporations, consulting firms, and political insiders understand how money moves through the economy. Community organisations, small businesses, journalists, and citizens do not.

The data to change this already exists. It sits in government databases, published under open licences. What didn't exist was the connective tissue — a platform that links entity registrations to government contracts to grants to tax data to political donations by ABN.

**Current state**: 92,303 entities, 50,425 relationships, 2.8M total records, 47 API endpoints, 7 data pages, 15 investigative reports. Built by 2 people.

**What remains**: The person layer (who controls what), the community voice layer (what communities actually need), the full procurement layer (all 450K+ federal contracts + state procurement), and the revenue engine (0 paying customers → $14K ARR in 90 days).

The data infrastructure Australia never had is 60% built. The next 40% determines whether it becomes a permanent civic institution or a technically impressive prototype.

---

*GrantScope — grantscope.au*
*Making the invisible visible.*
*Built on Jinibara Country.*
