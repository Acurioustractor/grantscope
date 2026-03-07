# GrantScope: The State of Business, Power and Money in Australia
## Why We're Building This, What We've Found, and What Comes Next

*March 2026*

---

## Why This Exists

Australia is one of the most economically concentrated democracies in the developed world. The ASX top 100 commands 47% of GDP. Two supermarket chains control 65% of grocery spending. The top 10 federal procuring entities account for 87.5% of $99.6 billion in annual government contracts.

Yet no public tool exists that lets ordinary Australians trace how money moves through the economy — from taxpayer to government agency to contractor, from mining company to foundation to community grant, from corporate entity to beneficial owner.

The data to build that tool already exists. It sits in government databases, published under open licences, updated weekly. What doesn't exist — and what has never existed — is the connective tissue.

GrantScope is building that connective tissue.

---

## What We've Built So Far

### The Numbers (Live, March 2026)

| Layer | Records | What It Tells You |
|-------|---------|-------------------|
| **Charities** (ACNC) | 64,473 | Every registered charity in Australia — who they serve, what they do, where they operate |
| **Grant Opportunities** | 17,727 from 37 sources | Every findable government grant currently open or recently closed |
| **Foundations** | 10,763 | Australia's philanthropic infrastructure — who gives, how much, to whom |
| **Foundation Programs** | 2,378 | Active funding programs accepting applications |
| **Indigenous Corporations** (ORIC) | 7,369 (3,366 active) | Every Aboriginal and Torres Strait Islander corporation ever registered — community services, health, land management, culture |
| **Financial Data** | 7 years per charity | Revenue, expenses, assets, staff, grants given — $249 billion in total charity sector revenue |

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

We don't just store data. We use AI (Minimax M2.5, Gemini, Groq) to analyse every entity — generating descriptions, identifying focus areas, mapping which communities are served. Here's what the AI reveals about real corporations:

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

**Layer 1: The Entity Registry** (Partially built)
Every registered entity in Australia — business, charity, Indigenous corporation, trust, sole trader — classified and linked by ABN. We have charities, foundations, and Indigenous corporations. Next: ASIC (3M+ companies) and ABN Bulk Extract (10M+ entities).

**Layer 2: Where Government Money Flows** (Next wave)
AusTender publishes $99.6 billion/year in federal procurement contracts via an open API. By linking contracts to entities by ABN, we can show: Which entity types win government contracts? How much goes to large corporations vs SMEs vs Indigenous businesses vs community organisations?

The numbers we already know are stark:
- 87.5% of contract value goes to 10 entities
- SMEs win 52% of contracts by number but only 35% by value
- Government consulting spend: ~$1 billion in 2024-25

**Layer 3: Who Pays Tax (And Who Doesn't)**
The ATO publishes tax transparency data for 4,110 entities earning $100M+ annually — $3.28 trillion in total income, $95.7 billion in tax payable. Cross-referenced with procurement: how much government money flows to companies that pay no tax?

**Layer 4: The Grants and Philanthropy Layer** (Partially built)
We already have 17,727 grants and 10,763 foundations. The missing piece: GrantConnect (federal grants) has no API and no bulk download. It mandates publication but prevents analysis. We're building the 360Giving equivalent that Australia lacks.

**Layer 5: Beneficial Ownership** (~2027)
Parliament passed the beneficial ownership register legislation in November 2025. When it goes live, we'll integrate it — connecting not just which companies receive money, but who actually owns them.

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

## Current Data Snapshot

```
ENTITIES MAPPED
├── Charities (ACNC)           64,473
├── Foundations                 10,763
├── Foundation Programs          2,378
├── Indigenous Corps (ORIC)      7,369  (3,366 active)
├── Grant Opportunities         17,727  (37 sources)
└── Financial Records          ~400,000 (7 years)

CROSS-REFERENCES
├── ORIC ↔ ACNC matched         1,389
├── Foundations identified       9,867  (from ACNC)
└── Grants embedded (vectors)   17,727  (100%)

SECTOR TOTALS
├── Charity revenue           $249 billion
├── Charity assets            $545 billion
├── Foundation grants given    $2.99 billion
└── Entity types                    6

NEXT: AusTender ($99.6B procurement) → ASIC (3M companies) → ABN (10M entities)
```

---

*GrantScope — grantscope.au*
*Making the invisible visible.*
