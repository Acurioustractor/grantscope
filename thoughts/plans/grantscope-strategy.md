# GrantScope: Power Map Strategy

## The Thesis

**GrantScope is not a grants discovery platform. It is Australia's first open power-mapping infrastructure.**

The data already proves it. We have 2.5M+ records cross-referenced by ABN that trace money from political donors → parties → government → contracts → businesses → foundations → communities. 185 entities that both donate to political parties AND hold government contracts. Nobody else has assembled this picture.

The conventional investor analysis frames this as a $2.6B "grant management software" play. That's thinking too small. The real market is **transparency infrastructure** — and the real model isn't SaaS subscriptions. It's a cooperative engine that generates revenue from making power visible, then redistributes that revenue to the communities the data serves.

---

## Why the Nonprofit Transparency Model Is Dying

Every major transparency data platform in the world is failing financially:

| Organisation | Peak | Current Status |
|-------------|------|---------------|
| **OpenSecrets** (US political money) | 40+ staff, $6.3M revenue | Laid off 1/3 of staff Nov 2024 |
| **Sunlight Foundation** (US govt transparency) | $9M revenue, 40+ staff | Dead since 2020 |
| **Center for Public Integrity** (US investigative) | Decades of Pulitzer-winning work | Down to handful of staff, dying |
| **Michael West Media** (AU corporate power) | 500K monthly views | No reliable revenue model, reader-funded |
| **360Giving** (UK grants data) | 275 funders, £265B in grants | Charity, funded by foundations |

The pattern: foundations fund transparency work when it's fashionable, then "reprioritize" toward partisan outcomes. OpenSecrets' director said it plainly: *"Groups have opted to fund a partisan outcome rather than nonpartisan democratic infrastructure."*

**GrantScope cannot follow this path.** It must generate its own revenue — not from donations, not from government grants, not from foundation charity. From the data itself.

---

## What We Actually Have (March 2026)

| Dataset | Records | Cross-Referenced |
|---------|--------:|:---:|
| ASIC Company Names | 2,149,868 | ABN |
| Political Donations (AEC) | 188,609 | ABN via entity matching |
| ACNC Charities | 64,473 | ABN |
| AusTender Federal Contracts | 58,128 | ABN |
| Grant Opportunities (30+ sources) | 17,529 | Foundation linkage |
| Foundations (profiled) | 10,763 | ABN + ACNC |
| ORIC Indigenous Corporations | 7,369 | ABN + ACNC |
| Donor→Entity ABN Matches | 5,361 | ABN |
| Foundation Programs | 2,378 | Foundation ID |
| **Total** | **~2.5M** | |

**Cross-reference highlights:**
- 185 entities that donate to parties AND hold government contracts
- 41% of Indigenous corporations linked to ACNC charity records
- 31% of grants linked to their source foundation
- Entity resolution: `normalize_company_name()` + ASIC trigram matching

**Coming waves (all public data, all free):**
- ABN Bulk Extract: 10M+ entities (the backbone registry)
- ATO Corporate Tax Transparency: 4,110 entities, $3.28T total income
- ASIC full company register: 3M+ companies
- Beneficial ownership register: live ~2027 (the game-changer)

---

## Revenue Architecture: The Robin Hood Model

### Principle: Make Power Visible. Redistribute What You Earn.

Revenue comes from 4 sources. Distribution follows cooperative principles.

### Source 1: Open Core Intelligence ($200K-1M/yr)

**Free forever (open core):**
- All raw data, basic search, cross-reference browser
- Grant discovery and foundation directory
- Community org profiles

**Paid (transparency intelligence):**
- **Investigative Packs** ($500-2,000): "Show me everything connected to ABN X" — every contract, donation, charity, foundation, and cross-reference. Pre-built for journalists, researchers, compliance teams.
- **Custom Alerts** ($50/mo): "Notify me when any entity connected to [company] gets a new contract/donation/grant"
- **API Access** ($200-2,000/mo tiered): For media orgs, researchers, NGOs building their own tools
- **Power Reports** ($2,000-10,000): "Mining Money in QLD", "Political Donations vs Procurement by Electorate", "ASX200 Corporate Giving vs Tax Paid". Automated, updated quarterly.

### Source 2: Institutional Licensing ($500K-3M/yr)

| Customer | What They Get | Pricing |
|----------|-------------|---------|
| **Media** (ABC, Guardian, Crikey, Michael West) | API + embed widgets + pre-built investigations | $20-100K/yr |
| **Universities** (political science, public policy) | Full dataset access + research API | $10-50K/yr |
| **Anti-corruption bodies** (CCC, NACC, IBAC) | Cross-reference engine + custom alerts | $50-200K/yr |
| **Grant-making foundations** | "Where does our money actually go?" analytics | $10-50K/yr |
| **ESG/Compliance firms** | Due diligence data feeds | $20-100K/yr |

### Source 3: Decentralised Data Mining (Speculative, High Upside)

**Bittensor subnets that align with GrantScope's pipeline:**

| Subnet | What It Does | GrantScope Fit |
|--------|-------------|---------------|
| **Subnet 13 (Data Universe)** | 350M rows/day data scraping | Our scrapers already do this for AU public data |
| **Subnet 33 (ReadyAI)** | Structured data processing + annotation | Our LLM enrichment pipeline is exactly this |
| **Subnet 28 (S&P 500 Oracle)** | Financial predictions | Entity financial data (ACNC, ATO) |

**Two paths:**
1. **Mine on existing subnets** — contribute Australian public-interest data as a miner on Data Universe or ReadyAI. Lower barrier, immediate income.
2. **Register a civic data subnet** — first-ever public-interest data subnet. Miners scrape and structure government/corporate transparency data globally. Registration cost: ~3,797 TAO (~$1.5M at current prices). High barrier but massive potential.

**Path 1 is immediate. Path 2 is the 2027 play** — once we have ABN registry + ATO tax data + beneficial ownership register, the dataset becomes globally unique and valuable enough to justify a subnet.

**Honest assessment:** Bittensor is currently optimised for AI/ML workloads, not civic data. The most realistic near-term path is partnering with SN13 or SN33 rather than registering a new subnet. The "mine TAO with transparency data" story is exciting but the economics aren't there yet. Build the dataset independently, revisit Bittensor when the ecosystem matures toward structured data provision. Also worth exploring **Ocean Protocol** as a more natural marketplace for structured public records.

### Source 4: Cooperative Member Services ($100-500K/yr)

Community organisations are members, not customers. They get:
- Free access to all data
- Matched grant recommendations
- Advocacy intelligence ("here's the evidence for your campaign")

In return, they contribute:
- Local data (community grants, local council spending)
- Validation (confirm/correct data about their organisation)
- Political will (collective advocacy for more open data)

**Member services revenue** comes from:
- Team accounts for larger NGOs ($20-50/mo)
- Grant application tools (AI-powered, using GrantScope data)
- Fundraising intelligence reports

---

## Legal Structure: Data Cooperative Under ACT

### Fits the ACT Dual-Entity Model Perfectly

```
ACT Foundation (CLG, charitable)
  └── GrantScope Data Cooperative (non-distributing, QLD)
        ├── Free public data access (charitable purpose)
        ├── Institutional licensing revenue
        └── Bittensor mining revenue

ACT Ventures (Pty Ltd, mission-locked, 40% profit-sharing)
  └── GrantScope Intelligence (commercial layer)
        ├── Investigative packs
        ├── API subscriptions
        ├── Power reports
        └── Enterprise licensing
```

### QLD Cooperative Registration

- **Law:** Co-operatives National Law Act 2020 (QLD adopted Dec 2020)
- **Minimum members:** 5
- **Two types:** Distributing (can pay dividends) or Non-distributing (NFP)
- **Non-distributing cooperative** can register as ACNC charity
- **CLG can own a cooperative** as subsidiary — standard structure
- **Registration:** QLD Office of Fair Trading
- **Patronage rebates:** Tax-deductible for eligible distributing co-ops

### Surplus Distribution Model

| Allocation | % | Purpose |
|-----------|---|---------|
| Infrastructure | 40% | Hosting, LLM costs, engineering, data pipeline |
| Member dividends | 30% | Especially community orgs, weighted by contribution |
| Community grants | 20% | Projects identified by the data (filling gaps the data reveals) |
| Reserve fund | 10% | Sustainability buffer |

---

## The Real Competitive Moat

It's not the code (MIT-licensed). It's not the data (all public). It's the **connective tissue**:

1. **Entity resolution** — 5,361 donor→ABN matches took months of normalization, ASIC matching, and validation. Nobody else has done this for Australia.
2. **Cross-reference graph** — linking political donations → government contracts → charities → Indigenous corporations by ABN. Each new dataset multiplies the value of every existing one.
3. **Community trust** — being a cooperative, not a VC-backed startup, means community orgs actually contribute data and validate results.
4. **Timing** — the Beneficial Ownership Register goes live ~2027. Whoever has the entity registry + money flow map ready to integrate ownership data becomes the definitive power map.
5. **AI enrichment at scale** — multi-provider LLM pipeline with JSON salvage, deterministic ACNC extraction (99.3% metadata coverage at zero cost), and now Anthropic Haiku as reliable paid fallback.

---

## 12-Month Execution Plan

### Q2 2026 (Now → June): Ship the Power Map

| Action | Impact |
|--------|--------|
| Complete foundation + ORIC enrichment | 100% description coverage |
| Build public API (read-only, rate-limited) | Distribution channel |
| Ship cross-reference report (185 donors with contracts) | Media attention |
| Approach Michael West Media with data partnership | First institutional user |
| Register QLD non-distributing cooperative | Legal structure |
| Integrate ABN Bulk Extract (10M+ entities) | Backbone registry |
| Build "Entity X-Ray" page (everything linked to one ABN) | Core product |

### Q3 2026 (July → Sept): First Revenue

| Action | Impact |
|--------|--------|
| Launch paid API tiers ($200-2K/mo) | Recurring revenue |
| Ship first Power Reports (Mining, Political Donations) | Content marketing + sales |
| Onboard 3-5 media partners (API + embed widgets) | $50-200K pipeline |
| Import ATO Corporate Tax Transparency data | Add tax layer |
| Build Bittensor miner for Subnet 13 (Data Universe) | Passive income stream |
| Recruit first 20 cooperative members (community orgs) | Network effects |

### Q4 2026 (Oct → Dec): Scale

| Action | Impact |
|--------|--------|
| Ship investigative intelligence packs | Self-serve revenue |
| Approach universities for research licensing | $50-200K pipeline |
| Import ASIC full company register (3M+ companies) | Complete entity graph |
| Launch grant matching for cooperative members | Member value |
| First cooperative surplus distribution | Prove the model |

### Q1 2027: The Ownership Layer

| Action | Impact |
|--------|--------|
| Integrate Beneficial Ownership Register (when live) | Game-changer |
| Launch civic data Bittensor subnet (if economics work) | Decentralized revenue |
| First "Who Really Benefits?" investigation using full stack | National attention |
| Target: $500K ARR from institutional + API + cooperative | Sustainability |

---

## The Pitch (Not to Investors — to Communities)

> Every dollar of taxpayer money, every political donation, every government contract, every charitable grant — all connected, all searchable, all free.
>
> GrantScope doesn't just show you where the money is. It shows you where the power is. And it puts that knowledge in your hands.
>
> We're not a startup looking for exit. We're a cooperative that exists to make power visible and redistribute what we earn to the communities the data serves.
>
> The question isn't whether this data should be connected. It's who builds the platform first — and whether it serves shareholders or communities.
>
> We chose communities.

---

## Why This Is Bigger Than Australia

Every democracy has:
- Political donation disclosures
- Government procurement databases
- Charity registers
- Corporate registries
- Tax transparency data

The entity resolution + cross-reference engine is portable. The ABN is just Australia's version of a universal business identifier. The UK has Companies House numbers. The US has EINs. Canada has BNs. The pattern is the same everywhere.

**Phase 1:** Australia (2026)
**Phase 2:** New Zealand (2027 — similar data landscape, shared ACNC patterns)
**Phase 3:** UK (2027 — 360Giving integration, Companies House, Electoral Commission)
**Phase 4:** Global civic data subnet on Bittensor (2028)

---

*A Curious Tractor project. Built on Jinibara Country.*
*Communities own their narratives, land, and economic futures.*
