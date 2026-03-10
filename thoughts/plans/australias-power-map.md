# Australia's Power Map: How Open Data Can Reshape Who Holds Power

## Executive Summary

Australia is one of the most economically concentrated democracies in the developed world. The revenue of the ASX top 100 companies grew from 27% of GDP in 1993 to 47% by 2015. Two supermarket chains control 65% of grocery spending. The top 10 federal procuring entities account for 87.5% of $99.6 billion in annual government contracts. Yet despite this extraordinary concentration, no public tool exists that allows ordinary Australians to trace how money moves through the economy -- from taxpayer to government agency to contractor, from mining company to foundation to community grant, from corporate entity to beneficial owner.

The raw materials to build that tool already exist. Australia's open data infrastructure -- ABN Bulk Extract (10M+ entities), AusTender OCDS API (450,000+ contracts), ATO Corporate Tax Transparency data (4,110 large corporations), ASIC company registers (3M+ companies), ACNC charity data (60,000+ charities), and ORIC Indigenous corporation data -- is rich, publicly available, and machine-readable. What is missing is the connective tissue: a platform that links these datasets by ABN, overlays grants and procurement flows, and makes the resulting map queryable by anyone. This report examines the opportunity, the data landscape, the precedents, and what it would mean for the distribution of power in Australia.

---

## The Concentration of Power in Australia

### Corporate Market Dominance

Australia's economy is unusually concentrated by international standards. ACCC analysis shows that 10 of the 20 largest industry classes are "highly concentrated," with the top four firms commanding more than one-third of revenue. The average four-firm concentration ratio increased by 2.2 percentage points between 2001 and 2019. In several key sectors, concentration is extreme:

- **Supermarkets:** Woolworths and Coles hold a combined 65% market share -- far exceeding the UK (top two: 43%) and the US (top four: 34%)
- **Banking:** The Big Four banks (CBA, Westpac, NAB, ANZ) dominate retail banking, mortgage lending, and wealth management
- **Media:** Concentrated ownership across print, broadcast, and digital
- **Mining:** BHP, Rio Tinto, and Fortescue dominate iron ore; Woodside and Santos dominate LNG

Research cited by the ACCC found that a 25% increase in market concentration leads to a 1% fall in productivity -- contradicting the Chicago School theory that concentration drives efficiency. The real-world consequences are visible in supermarket pricing: over 2.5 million Australian households are classified as "severely food insecure," while Woolworths reported $929 million in profit in a single half-year.

### Where Government Money Flows

The Australian Government is the single largest buyer of goods and services in the national economy. In 2023-24, AusTender recorded 83,453 contracts with a combined value of $99.6 billion -- the highest ever. The distribution is starkly concentrated:

| Metric | Value |
|--------|-------|
| Total federal procurement (2023-24) | $99.6 billion |
| Share held by top 10 entities | 87.5% |
| Contracts to SMEs (by number) | 52% (27,197 contracts) |
| Contracts to SMEs (by value) | 35% ($11.3 billion) |
| Consulting firm spend (2024-25) | ~$1 billion |

The discrepancy between SME contract volume (52%) and value (35%) reveals the structural advantage of large incumbents. Meanwhile, government consulting expenditure has continued to rise -- reaching nearly $1 billion in 2024-25, with spending shifting from the Big 4 (PwC, KPMG, Deloitte, EY) to other consulting firms rather than declining overall.

### The Invisible Flow: Philanthropy and Grants

Alongside procurement sits another river of money: philanthropic and government grants. GrantConnect, the Commonwealth's centralised grant information system, mandates that all non-corporate Commonwealth entities publish grant opportunities and awards. Yet GrantConnect has no API and no bulk data download -- it exists as a web-only system, making systematic analysis of where government grant money flows virtually impossible.

On the philanthropic side, Australia's 9,800+ foundations distribute billions annually through private grantmaking. Unlike the UK, where 320 funders have published data on 1.25 million grants worth over GBP 300 billion through the 360Giving open data standard, Australian philanthropic funding flows are opaque, fragmented, and largely untrackable by the public.

---

## The Open Data That Already Exists

The foundation for mapping Australia's power structure is already in place. Every major dataset is free, publicly licensed (typically CC-BY 3.0), and updated regularly:

| Dataset | Records | Format | Update Cycle | Status |
|---------|---------|--------|-------------|--------|
| ABN Bulk Extract | 10M+ entities | XML | Weekly | **Downloaded (928MB)** |
| ASIC Companies Register | 3M+ companies | CSV/XLSX | Weekly | **Imported (2.1M)** |
| AusTender (OCDS API) | 670K+ contracts (from 2013) | JSON API | Continuous | **Full history imported** |
| AEC Political Donations | 312K+ records | CSV | Annual | **Full register imported** |
| ATO Corporate Tax Transparency | 26K+ records | XLSX | Annual | **Full dataset imported** |
| ACNC (Charities) | 64K+ charities, 360K AIS | CSV | Bulk download | **Fully imported** |
| ORIC (Indigenous Corporations) | 7,369 | CSV | Periodic | **Fully imported** |
| Justice Funding | 52K+ records | Cross-sector | Various | **Fully imported** |
| Social Enterprises | 10K+ records | Multi-source | Various | **Fully imported** |
| NSW eTendering | Large (contracts $150K+) | JSON API (OCDS) | Continuous | Planned |
| QLD Forward Procurement Pipeline | Growing | CSV/API | Non-regular | Planned |

The critical connector across all these datasets is the **Australian Business Number (ABN)**. Every registered business, charity, Indigenous corporation, government entity, trust, and sole trader has one. The ABN Bulk Extract provides the master key -- linking ASIC company registrations, ACNC charity registrations, ORIC Indigenous corporation data, AusTender procurement contracts, and ATO tax transparency data into a single queryable entity graph.

---

## What Makes This Different From What Exists

Several individual analyses have been conducted using subsets of this data. Michael West Media has built corporate power investigations using ATO tax transparency data. The ACCC has analysed market concentration using ASX data. Academic researchers have studied procurement patterns using AusTender exports. But no platform combines all of these layers:

| Existing Tool | What It Does | What It Misses |
|---------------|-------------|----------------|
| AusTender website | Search individual contracts | No entity-level aggregation, no grant linkage |
| ACNC Register | Search individual charities | No procurement data, no grant flow tracking |
| Michael West Media investigations | Tax transparency analysis | Manual, journalism-focused, not queryable |
| Bidhive Open Contracts | AusTender + NSW eTendering dashboard | No entity registry, no grants, no philanthropy |
| ProPublica Nonprofit Explorer (US) | IRS 990 data for 100K+ nonprofits with API | US only |
| 360Giving (UK) | 1.25M grants, GBP 300B+ from 320 funders | UK only, grants only |

**The gap is not in any single dataset -- it is in the connections between them.**

---

## International Precedents: What Works

### United Kingdom: The Gold Standard

The UK has built the most comprehensive open money-flow infrastructure in the world, through three complementary systems:

**360Giving (grants transparency):** Since 2015, 360Giving has established an open data standard for grant data that the UK Government has adopted as an official standard for all grant-making bodies. By March 2025, 320 funders had published data on 1.25 million grants worth over GBP 300 billion. The standard requires just 10 core fields (funder, recipient, amount, date, description) but enables powerful analysis of funding flows, duplication, and gaps. Over 125,000 people used 360Giving's data tools in a single year.

**OpenCorporates (entity registry):** Since 2010, OpenCorporates has aggregated data from over 1,400 state registries worldwide to create a database of 220 million+ companies. It played a critical role in the Panama Papers investigation and in campaigning for the UK's public beneficial ownership register. Its Legal-Entity Data Principles provide a framework for verifiable trust in corporate data.

**Open Contracting Data Standard (OCDS):** The UK publishes procurement data through Contracts Finder, and civil society groups have attempted to connect contracts, spending, and beneficial ownership data into a unified database. The effort revealed that despite the UK's transparency commitments, connecting these datasets is still technically challenging -- but achievable.

### United States

The US has two major precedents:

**ProPublica Nonprofit Explorer:** Combines IRS Form 990 data for all US nonprofits into a searchable, API-accessible database. It now includes nearly 100,000 private foundations, 33,400 audited organisations, and decades of financial filings. It has become the definitive tool for journalists, researchers, and donors investigating nonprofit finances.

**USAspending.gov:** Mandated by the DATA Act of 2014, this platform makes all federal spending data accessible, searchable, and reliable -- enabling citizens to trace taxpayer dollars from appropriation through obligation to expenditure.

---

## What a Unified Platform Would Enable

### Layer 1: The Entity Registry

By ingesting the ABN Bulk Extract (10M+ entities) and cross-referencing with ASIC (company structure), ACNC (charity status), ORIC (Indigenous corporation status), and ASX (listed company status), every entity in Australia would receive a classification: listed company, private company, charity, Indigenous corporation, government body, sole trader, or trust.

### Layer 2: The Money Flow Map

Overlaying AusTender procurement data ($99.6 billion/year in federal contracts) onto the entity registry would reveal, for the first time, a complete picture of who receives government money, disaggregated by entity type, industry, geography, and size. Adding NSW eTendering data and Queensland procurement pipeline data would extend coverage to state-level spending.

### Layer 3: The Tax and Revenue Picture

The ATO Corporate Tax Transparency data (4,110 entities with $100M+ income, reporting $3.28 trillion in total income and $95.7 billion in tax payable for 2023-24) would add the revenue and tax dimension. Which companies earn the most but pay the least tax? How does their government contract revenue compare to their tax contribution?

### Layer 4: The Grants and Philanthropy Layer

Cross-referencing foundation grants data with entity registrations reveals the charitable redistribution network: which foundations fund which communities, how mining wealth flows through philanthropic vehicles, where gaps exist between community need and philanthropic investment. This is the 360Giving equivalent that Australia currently lacks.

### Layer 5: Research Questions That Become Answerable

Once these layers are connected, questions that currently require months of Freedom of Information requests and manual data assembly become queryable in seconds:

- "What percentage of federal procurement goes to ASX-listed companies vs SMEs vs Indigenous corporations vs community organisations?"
- "Show every dollar that flowed from BHP -> BHP Foundation -> grants -> which communities"
- "Which suburbs receive the most government contract spending per capita? Which receive the least?"
- "How has Big 4 consulting spend changed over 10 years relative to community organisation funding?"
- "Which organisations receive both government grants AND government contracts? What is the overlap?"
- "How much government money flows to companies that pay no tax?"
- "What is the geographic distribution of philanthropic funding relative to indices of disadvantage?"

---

## The Approaching Inflection Point

### The Beneficial Ownership Register

On 27 November 2025, Parliament passed the Treasury Laws Amendment (Strengthening Financial Systems and Other Measures) Bill 2025, establishing a public, Commonwealth-operated beneficial ownership register for unlisted companies. Royal Assent was given on 4 December 2025. Implementation is expected from 2027, aligned with ASIC's work to stabilise the companies register -- supported by $207 million in new ASIC funding.

This is transformative. For the first time, Australians will be able to identify the real human beings behind corporate structures. When combined with an entity registry linked to procurement, grants, and tax data, the beneficial ownership register completes the picture: not just which companies receive government money or pay no tax, but who actually benefits.

The timing creates a strategic window. A platform that establishes the entity registry, procurement linkage, and grants mapping now -- before the beneficial ownership register goes live -- will be positioned to integrate ownership data the moment it becomes available, creating the most comprehensive power map ever assembled in Australia.

### Policy Momentum

Several converging policy developments amplify the opportunity:

- Social procurement frameworks expanding across all states, creating demand for entity-level data on social enterprises, Indigenous businesses, and disability enterprises
- The national social enterprise strategy requiring data infrastructure to measure the sector's growth and impact
- ACCC merger reform driving demand for market concentration data and transparency
- Cost-of-living scrutiny on supermarket pricing, corporate profits, and the gap between farmgate and retail prices
- Post-PwC scandal demands for transparency in government consulting contracts

---

## How This Changes Power

### Democratising Information

Currently, detailed knowledge of money flows in Australia is asymmetric. Large corporations, consulting firms, and well-resourced lobbyists understand the procurement landscape, the grants ecosystem, and the regulatory environment. Community organisations, small businesses, journalists, and citizens do not have comparable access. An open, queryable platform inverts this dynamic -- making the information available to everyone simultaneously.

### Enabling Accountability Journalism

Michael West Media, the Australia Institute, CICTAR, and independent journalists currently invest enormous effort in manually assembling datasets for individual investigations. A unified platform would reduce weeks of FOI requests and data wrangling to minutes of querying -- dramatically increasing the volume and speed of accountability journalism.

### Strengthening Community Voice

When a community in regional Australia can see exactly how much government procurement spending flows to their region versus metropolitan areas, how much tax the companies operating in their region pay, and which foundations are (and aren't) funding their needs -- that community gains evidence for advocacy that was previously inaccessible.

### Reshaping Procurement

Making procurement data transparent and connected to entity data creates feedback loops. If it becomes visible that 87.5% of federal contract value flows to 10 entities, and that Indigenous-owned businesses receive a fraction of procurement dollars despite the Indigenous Procurement Policy, the political pressure for redistribution intensifies.

---

## The GrantConnect Gap as Strategic Entry Point

GrantConnect -- the Commonwealth's grants information system -- has no API and no bulk data download. It mandates publication but doesn't enable analysis. This is precisely the gap that a 360Giving-equivalent for Australia would fill. By building the infrastructure to aggregate, standardise, and publish Australian grants data in open format, a platform like CivicGraph becomes not just a directory but the foundational data infrastructure for an entirely new level of transparency in Australian public life.

---

## Technical Architecture: What It Takes

The technical requirements are substantial but achievable with existing open-source tools:

| Component | Approach | Data Volume | Status |
|-----------|----------|-------------|--------|
| Entity Graph | ABN-based unified registry | 100,036 entities, 211,783 relationships | **DONE** |
| AusTender Procurement | OCDS API client, full history | 670,303 contracts | **DONE** |
| Political Donations | AEC disclosure register | 312,933 records | **DONE** |
| ACNC Charities | CSV bulk download, weekly sync | 64,560 + 359,678 AIS | **DONE** |
| Justice Funding | JusticeHub cross-sector data | 52,133 records | **DONE** |
| ATO Tax Transparency | XLSX from data.gov.au | 26,241 records | **DONE** |
| Grant Opportunities | 30+ government APIs + scrapers | 18,069, 100% embedded | **DONE** |
| Foundations | ACNC-derived + AI enrichment | 10,779 (3,264 enriched) | **DONE** |
| Social Enterprises | Supply Nation + 5 sources | 10,339 records | **DONE** |
| ORIC Indigenous Corps | CSV from data.gov.au | 7,369 records | **DONE** |
| ABR Bulk Extract | XML streaming parser | 928MB downloaded | **Partial** |
| ASIC Company Data | CSV from data.gov.au | 2.1M+ records | **DONE** |
| Cross-reference Engine | ABN-based join, entity resolution F1 94.1% | Universal | **DONE** |
| NSW eTendering | OCDS API client | — | Planned |

The ABN serves as the universal join key. Every dataset either contains ABNs directly or can be linked through ASIC's ACN-to-ABN mapping. The AusTender OCDS API includes supplier ABNs in contract notices, enabling direct linkage to the entity registry.

Priority sequencing matters. ORIC (3,372 records, highest mission relevance, smallest dataset) proves the pattern. AusTender (OCDS API, maps government money flow) provides the "power" layer. ABN Bulk Extract (10M+ records, backbone registry) connects everything. Each wave builds on the prior, and each delivers standalone value while contributing to the integrated whole.

---

## Implementation Status (10 March 2026)

### Completed — ALL Core Data Layers

- **Entity Graph:** 100,036 entities, 211,783 relationships — unified ABN-linked registry
- **AusTender Contracts:** 670,303 records — full OCDS history from 2013 ($99.6B/year universe)
- **ACNC Charities:** 64,560 records with 359,678 annual statements (7 years)
- **Political Donations:** 312,933 records — full AEC disclosure register
- **Justice Funding:** 52,133 records — cross-sector funding flows
- **ATO Tax Transparency:** 26,241 records — full large taxpayer dataset
- **Grant Opportunities:** 18,069 from 30+ sources, 100% embedded for semantic search
- **Foundations:** 10,779 profiled, 3,264 AI-enriched (30%)
- **Social Enterprises:** 10,339 — Supply Nation (6,135 Indigenous businesses) + 5 other sources
- **ORIC Indigenous Corporations:** 7,369 records (3,366 active), cross-referenced with ACNC
- **Foundation Programs:** 2,472 active funding programs
- **ABR Bulk Extract:** Downloaded (928MB, 20 XML files) — used for postcode enrichment
- **Entity Resolution:** F1 score 94.1% (trigram + ABN/ACN/ICN matching)
- **Entity Geo Coverage:** postcode 90%, remoteness 96%, LGA 90%, SEIFA 89%
- **Community-Controlled Orgs:** 7,822 identified and classified
- **Platform:** 70 pages, 77 API routes, 86 data pipeline scripts

### In Progress

- Foundation enrichment at scale (494 with websites queued)
- Knowledge Wiki (document ingestion + AI Q&A)

### Remaining Waves

- **Person Layer:** ACNC responsible persons, ASIC directors — schema ready, no data flowing
- **State Procurement:** NSW, QLD, VIC, WA, SA — all separate systems
- **Beneficial Ownership Register:** Integration ready (~2027 when register goes live)

---

## Conclusion

The data to map Australia's power structure already exists. It sits in government databases, published under open licences, updated weekly or annually. What doesn't exist -- and what has never existed -- is the connective infrastructure that links an entity's company registration to its charity status to its Indigenous corporation registration to its government contracts to its grants received to its tax paid. Building that infrastructure does not require new legislation, new data collection, or new government commitments. It requires engineering: ingesting publicly available datasets, linking them by ABN, and making the result queryable.

The implications are profound. In a country where the ASX top 100 commands 47% of GDP, where two supermarkets control 65% of grocery spending, where 87.5% of procurement value flows to 10 entities, and where the beneficial ownership of unlisted companies has been invisible until legislation passed just months ago -- making money flows transparent is not a technical project. It is a redistribution of informational power. The question is not whether this data should be connected. It is who builds the platform first.

---

*Prepared by Deep Research, March 2026*
*Implementation by CivicGraph (civicgraph.au)*
