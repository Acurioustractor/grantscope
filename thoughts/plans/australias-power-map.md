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

| Dataset | Records | Format | Update Cycle | Key Fields |
|---------|---------|--------|-------------|------------|
| ABN Bulk Extract | 10M+ entities | XML | Weekly | ABN, entity type, legal name, trading names, state, GST/DGR status |
| ASIC Companies Register | 3M+ companies | CSV/XLSX | Weekly | ACN, name, type, status, state, registration date, ABN |
| AusTender (OCDS API) | 450K+ contracts (from 2013) | JSON API | Continuous | Contract ID, supplier ABN, value, category, agency, dates |
| NSW eTendering | Large (contracts $150K+) | JSON API (OCDS) | Continuous | Tender and contract data, OCDS-compliant |
| QLD Forward Procurement Pipeline | Growing | CSV/API | Non-regular | Agency, category, estimated value |
| ATO Corporate Tax Transparency | 4,110 entities ($100M+ income) | XLSX | Annual | Total income, taxable income, tax payable, ownership type |
| ORIC (Indigenous Corporations) | 3,372 | CSV | Periodic | ICN, ABN, name, state, industry, status |
| ACNC (Charities) | 60,000+ | CSV | Bulk download | ABN, name, financials, purposes, beneficiaries |

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

GrantConnect -- the Commonwealth's grants information system -- has no API and no bulk data download. It mandates publication but doesn't enable analysis. This is precisely the gap that a 360Giving-equivalent for Australia would fill. By building the infrastructure to aggregate, standardise, and publish Australian grants data in open format, a platform like GrantScope becomes not just a directory but the foundational data infrastructure for an entirely new level of transparency in Australian public life.

---

## Technical Architecture: What It Takes

The technical requirements are substantial but achievable with existing open-source tools:

| Component | Approach | Data Volume |
|-----------|----------|-------------|
| ABN Entity Registry | Streaming XML parser (fast-xml-parser), weekly sync | 10M+ records |
| ASIC Company Data | CSV/XLSX parsing, weekly sync from data.gov.au | 3M+ records |
| AusTender Procurement | OCDS API client, incremental sync by date | 450K+ contracts |
| NSW eTendering | OCDS API client | Large |
| ATO Tax Transparency | XLSX download from data.gov.au, annual | 4,110 entities |
| ORIC Indigenous Corps | CSV from data.gov.au | 3,372 records |
| ACNC Charities | Already ingested | 60K+ records |
| Cross-reference Engine | ABN-based join across all datasets | Universal |

The ABN serves as the universal join key. Every dataset either contains ABNs directly or can be linked through ASIC's ACN-to-ABN mapping. The AusTender OCDS API includes supplier ABNs in contract notices, enabling direct linkage to the entity registry.

Priority sequencing matters. ORIC (3,372 records, highest mission relevance, smallest dataset) proves the pattern. AusTender (OCDS API, maps government money flow) provides the "power" layer. ABN Bulk Extract (10M+ records, backbone registry) connects everything. Each wave builds on the prior, and each delivers standalone value while contributing to the integrated whole.

---

## Implementation Status (March 2026)

### Completed

- **ACNC Charities:** 359,678 records ingested with 7 years financial data (acnc_ais), full beneficiary/purpose mapping
- **Foundations:** 9,874 philanthropic entities profiled with multi-provider LLM enrichment
- **Foundation Programs:** 866 open funding opportunities mapped
- **Grant Opportunities:** 14,119 grants from 17 government sources, 100% embedded for semantic search
- **Community Orgs:** 500 enriched charity profiles
- **Social Enterprises:** 7 directory sources (B Corp, Social Traders, Supply Nation, state networks)
- **ORIC Indigenous Corporations:** 7,369 records ingested (3,366 registered), 1,388 cross-referenced with ACNC, Minimax M2.5 LLM enrichment running

### In Progress

- ORIC LLM enrichment (Minimax M2.5 primary, Gemini/Groq/DeepSeek rotation)

### Next Waves

- **Wave 2:** AusTender OCDS API (federal procurement, $99.6B/year)
- **Wave 3:** ASIC Companies Register (3M+ companies)
- **Wave 4:** ABN Bulk Extract (10M+ entities, streaming XML)
- **Wave 5:** ATO Corporate Tax Transparency (4,110 large entities)
- **Wave 6:** Cross-reference engine + power analysis visualisations
- **Wave 7:** Beneficial ownership register integration (~2027)

---

## Conclusion

The data to map Australia's power structure already exists. It sits in government databases, published under open licences, updated weekly or annually. What doesn't exist -- and what has never existed -- is the connective infrastructure that links an entity's company registration to its charity status to its Indigenous corporation registration to its government contracts to its grants received to its tax paid. Building that infrastructure does not require new legislation, new data collection, or new government commitments. It requires engineering: ingesting publicly available datasets, linking them by ABN, and making the result queryable.

The implications are profound. In a country where the ASX top 100 commands 47% of GDP, where two supermarkets control 65% of grocery spending, where 87.5% of procurement value flows to 10 entities, and where the beneficial ownership of unlisted companies has been invisible until legislation passed just months ago -- making money flows transparent is not a technical project. It is a redistribution of informational power. The question is not whether this data should be connected. It is who builds the platform first.

---

*Prepared by Deep Research, March 2026*
*Implementation by GrantScope (grantscope.au)*
