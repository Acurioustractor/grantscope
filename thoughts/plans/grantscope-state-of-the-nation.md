# CivicGraph: The State of Business, Power and Money in Australia
## Why We're Building This, What We've Found, and What Comes Next

*March 2026*

---

## Why This Exists

Australia is one of the most economically concentrated democracies in the developed world. The ASX top 100 commands 47% of GDP. Two supermarket chains control 65% of grocery spending. The top 10 federal procuring entities account for 87.5% of $99.6 billion in annual government contracts.

Yet no public tool exists that lets ordinary Australians trace how money moves through the economy — from taxpayer to government agency to contractor, from mining company to foundation to community grant, from corporate entity to beneficial owner.

The data to build that tool already exists. It sits in government databases, published under open licences, updated weekly. What doesn't exist — and what has never existed — is the connective tissue.

CivicGraph is building that connective tissue.

---

## What We've Built So Far

### The Numbers (Live, 10 March 2026)

| Layer | Records | What It Tells You |
|-------|---------|-------------------|
| **AusTender Contracts** | 670,303 | Full history of federal government procurement — who gets paid, how much |
| **Charities** (ACNC) | 64,560 | Every registered charity in Australia — who they serve, what they do, where they operate |
| **Political Donations** | 312,933 | Every disclosed political donation — who donates, to which party, how much |
| **Justice Funding** | 52,133 | Justice sector funding flows cross-linked from JusticeHub |
| **ATO Tax Transparency** | 26,241 | Large taxpayer data — income, taxable income, tax payable |
| **Grant Opportunities** | 18,069 from 30+ sources | Every findable government grant currently open or recently closed |
| **Foundations** | 10,779 | Australia's philanthropic infrastructure — who gives, how much, to whom |
| **Social Enterprises** | 10,339 | Supply Nation + Social Traders + B Corp + state networks |
| **Indigenous Corporations** (ORIC) | 7,369 (3,366 active) | Every Aboriginal and Torres Strait Islander corporation ever registered |
| **Foundation Programs** | 2,472 | Active funding programs accepting applications |
| **Financial Data** | 359,678 annual statements | Revenue, expenses, assets, staff, grants given — 7 years per charity |
| **Entity Graph** | 100,036 entities, 211,783 relationships | The connected power map |

### What That Data Already Reveals

**The charity sector is enormous and invisible.** 64,473 registered charities hold $545 billion in combined assets and generate $249 billion in annual revenue. That's larger than many ASX-listed companies — yet there's no equivalent of a stock exchange dashboard for the charitable sector. No one can see the whole picture.

**Foundation giving is concentrated.** 10,763 foundations distributed $2.99 billion in grants in their most recent reporting year. But that money flows unevenly — and until now, there was no way to see the full map of who gives to whom, which communities are funded, and which are left out.

**Indigenous corporations are the backbone of self-determination.** 3,366 active ORIC-registered corporations operate across every state and territory — 1,389 of them also registered as ACNC charities. They are the infrastructure of Indigenous self-governance:

| State | Active Corps | What They Do |
|-------|-------------|-------------|
| QLD | 854 | Community services, health, education, land management |
| WA | 809 | Land and waters management, native title, housing |
| NSW | 694 | Community services, education, employment |
| NT | 663 | Health, land management, culture, housing |
| SA | 144 | Community services, education |
| VIC | 131 | Community services, culture |

By size: 281 Large, 804 Medium, 2,281 Small — proving that Indigenous self-governance operates at every scale, from major health services employing hundreds to small family corporations managing traditional land.

### AI-Powered Understanding

We don't just store data. We use AI (9 LLM providers including Minimax, Gemini, Groq, DeepSeek, Kimi, OpenAI, Perplexity, Anthropic) to analyse every entity — generating descriptions, identifying focus areas, mapping which communities are served. 3,264 foundations have been AI-enriched with descriptions, giving philosophy, application tips, and board members. Here's what the AI reveals about real corporations:

> **Acacia Larrakia Aboriginal Corporation** (NT, est. 1992)
> "The name combines 'Acacia' (the wattle tree, culturally significant to many Aboriginal groups) with 'Larrakia' — the Larrakia people, who are the Traditional Owners of the Darwin region. The corporation serves to support, preserve and promote Larrakia cultural heritage, traditions and community interests."
> *Focus: Heritage and Culture, Cultural preservation*
> *Community: The Larrakia people — Traditional Owners of the Darwin area, with traditional country spanning from Dundee Beach to the Adelaide River.*

> **Mooloola Aboriginal and Torres Strait Islanders Corporation** (QLD, est. 1992)
> "A community-based corporation operating in the Sunshine Coast region providing affordable housing, tenancy management, or housing support services. As a small corporation operating for over three decades, it plays a practical role in addressing housing needs."
> *Focus: Housing and tenancy services*
> *Community: Aboriginal and Torres Strait Islander community in Mooloolah/Sunshine Coast — traditional Gubbi Gubbi (Kabi Kabi) Country.*

This isn't generic — the AI identifies specific language groups, traditional country, and the role each corporation plays in community self-determination. At scale, across thousands of corporations, this creates the first comprehensive map of Indigenous self-governance infrastructure in Australia.

---

## The Power Map: What We're Building Next

### The Five Layers

**Layer 1: The Entity Registry** (BUILT)
100,036 entities — businesses, charities, Indigenous corporations, social enterprises, foundations, government bodies — classified and linked by ABN. 90% geocoded with postcode, 96% with remoteness, 90% with LGA, 89% with SEIFA disadvantage decile. Entity resolution F1: 94.1%.

**Layer 2: Where Government Money Flows** (BUILT)
670,303 AusTender contracts — full OCDS history from 2013. 312,933 political donations cross-referenced by ABN. 140+ entities that donate to political parties AND hold government contracts. Plus 52,133 justice funding records.

The numbers are stark:
- 87.5% of contract value goes to 10 entities
- SMEs win 52% of contracts by number but only 35% by value
- 140+ entities simultaneously donate to parties AND hold government contracts ($80M donated, $4.7B in contracts)

**Layer 3: Who Pays Tax (And Who Doesn't)** (BUILT)
26,241 ATO tax transparency records imported — full dataset. Cross-referenced with procurement and donations via ABN. Effective tax rates calculable per entity.

**Layer 4: The Grants and Philanthropy Layer** (BUILT)
18,069 grants from 30+ sources, 100% embedded for semantic search. 10,779 foundations with 3,264 AI-enriched. 2,472 foundation programs. Knowledge Wiki for org document management and AI-powered Q&A.

**Layer 5: Beneficial Ownership** (~2027)
Parliament passed the beneficial ownership register legislation in November 2025. When it goes live, we'll integrate it — connecting not just which companies receive money, but who actually owns them. The entity graph is ready to absorb this data the moment it becomes available.

### Questions That Become Answerable

Once these layers connect, questions that currently require months of FOI requests become queryable in seconds:

- *"Show every dollar that flowed from BHP → BHP Foundation → grants → which communities"*
- *"What % of federal procurement goes to Indigenous-owned businesses?"*
- *"Which suburbs receive the most government spending per capita? Which receive the least?"*
- *"How has Big 4 consulting spend changed over 10 years vs community organisation funding?"*
- *"Which organisations receive both government grants AND procurement contracts?"*
- *"What is the geographic distribution of philanthropic funding relative to disadvantage?"*

---

## Why Australia, Why Now

### No One Has Done This

The UK has 360Giving (1.25 million grants, GBP 300 billion, 320 publishers). The US has ProPublica Nonprofit Explorer (100,000+ foundations) and USAspending.gov (all federal spending). Australia has nothing comparable. The data exists. The connections don't.

### The Beneficial Ownership Window

The beneficial ownership register passes in 2025, implements around 2027. The platform that builds the entity registry, procurement linkage, and grants mapping NOW — before beneficial ownership goes live — will be positioned to integrate ownership data the moment it becomes available. That creates the most comprehensive power map ever assembled in Australia.

### Policy Momentum

- Social procurement frameworks expanding across all states
- National social enterprise strategy requiring data infrastructure
- ACCC merger reform driving demand for concentration data
- Cost-of-living scrutiny on corporate profits
- Post-PwC scandal demands for consulting contract transparency

---

## How We're Building It

### Architecture

Everything runs on open, public data. No scraping behind paywalls. No proprietary datasets. Every source is government-published, openly licensed (CC-BY 3.0), and machine-readable.

| Data Source | Records | How We Ingest | Status |
|------------|---------|---------------|--------|
| ACNC Charities | 64,473 | CSV bulk download | **Live** |
| ACNC Financial Data | ~400K records (7 years) | CSV bulk download | **Live** |
| Foundations | 10,763 | LLM-enriched from ACNC + web | **Live** |
| Grant Opportunities | 17,727 | 37 government APIs + scrapers | **Live** |
| ORIC Indigenous Corps | 7,369 | CSV from data.gov.au | **Live** |
| Foundation Programs | 2,378 | LLM-discovered from websites | **Live** |
| AusTender Procurement | 450K+ contracts | OCDS JSON API | **Next** |
| ASIC Companies | 3M+ | CSV from data.gov.au | **Planned** |
| ABN Bulk Extract | 10M+ | XML streaming parser | **Planned** |
| ATO Tax Transparency | 4,110 entities | XLSX from data.gov.au | **Planned** |

### The ABN Is the Key

Every dataset connects through the Australian Business Number. A charity's ABN links to its ORIC registration, its ASIC company structure, its government contracts, its grants received, and (soon) its beneficial owners. The ABN Bulk Extract — 10 million+ entities — becomes the backbone.

### Multi-Provider AI Enrichment

We use 4 AI providers with automatic rotation to keep costs near zero:
- **Minimax M2.5** — reasoning model, best for deep analysis
- **Gemini 2.5 Flash** — free web-grounded search
- **Groq** (Llama 3.3 70B) — 14,400 free requests/day
- **DeepSeek** — free tier fallback

When one provider hits rate limits, the system automatically rotates to the next. Total monthly cost for enriching 10,000+ entities: under $50.

---

## The Thesis

Making money flows transparent is not a technical project. It is a redistribution of informational power.

Currently, detailed knowledge of how money moves through Australia is asymmetric. Large corporations, consulting firms, and lobbyists understand the procurement landscape, the grants ecosystem, and the regulatory environment. Community organisations, small businesses, journalists, and ordinary citizens do not.

An open, queryable platform that connects entity registrations to government contracts to grants to tax data inverts this dynamic. When a community in regional Australia can see exactly how much procurement spending flows to their region versus Sydney, how much tax the companies operating locally pay, and which foundations fund their needs — that community gains evidence for advocacy that was previously inaccessible.

When journalists can trace money from mining company to foundation to grant to community in minutes instead of months of FOI requests, accountability journalism scales.

When it becomes visible that 87.5% of federal contract value flows to 10 entities while Indigenous-owned businesses receive a fraction despite the Indigenous Procurement Policy, the political pressure for redistribution intensifies.

The data already exists. The connections don't. We're building the connections.

---

## Current Data Snapshot (10 March 2026)

```
ENTITY GRAPH
├── Total Entities             100,036
├── Total Relationships        211,783
├── Entity Types: charity (52K), company (24K), foundation (10.7K),
│   indigenous_corp (7.3K), social_enterprise (5.2K), government_body (134)
└── Relationship Types: contract (170K), donation (36K), grant (5.4K)

DATA ESTATE
├── AusTender Contracts        670,303
├── ACNC Annual Statements     359,678  (7 years)
├── Political Donations        312,933
├── Charities (ACNC)            64,560
├── Justice Funding             52,133
├── ATO Tax Transparency        26,241
├── Grant Opportunities         18,069  (100% embedded)
├── Foundations                 10,779  (3,264 AI-enriched = 30%)
├── Social Enterprises          10,339  (Supply Nation + 5 other sources)
├── Indigenous Corps (ORIC)      7,369  (3,366 active)
├── Foundation Programs          2,472
└── Community Orgs                 541

ENTITY COVERAGE
├── With postcode               90%
├── With remoteness             96%
├── With LGA                    90%
├── With SEIFA decile           89%
├── With ABN                    96%
├── Community-controlled      7,822

PLATFORM
├── Frontend pages               70
├── API routes                   77
├── Data pipeline scripts        86
├── Entity resolution F1       94.1%

TOTAL RECORDS: ~4.2M
```

---

*CivicGraph — civicgraph.au*
*Making the invisible visible.*
