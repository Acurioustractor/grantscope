# CivicGraph: Australia's Community Capital Ledger

## What This Is

CivicGraph is a searchable map of Australian organisations, money, ownership, grants, contracts, place, and community-defined impact. It makes capital allocation legible, then uses that legibility to help communities negotiate for a fairer share of power and capital.

Not a grants database. Not a procurement tracker. Not a charity register.

An always-on Australian ledger of money, power, place, and community voice.

---

## What It Answers

For any organisation, place, or issue, CivicGraph answers:

- Who exists here?
- Who owns what?
- Who funds what?
- Who gets paid?
- Who decides?
- Where does money land?
- Which communities miss out?
- What do people in those communities actually want?
- Did the money match the need?

The platform identifies every entity that touches community capital flows — not every business in Australia (~8M ABNs), but every business, charity, foundation, Indigenous corporation, social enterprise, and government body that receives public money, makes political donations, holds government contracts, or distributes grants. That's roughly 200K entities. We already have 80K.

---

## What's Real Today (March 2026)

This is not a whitepaper for something that doesn't exist. It's a strategy for something that's 75% built.

### Data Assets

| Dataset | Records | Status |
|---------|--------:|--------|
| AusTender Federal Contracts | 670,303 | Full OCDS history, ABN cross-referenced |
| ACNC Annual Statements | 359,678 | 7 years (2017-2023), full financials |
| AEC Political Donations | 312,933 | ABN-matched via entity resolution |
| ACNC Charities Register | 64,560 | Full register, weekly sync |
| Justice Funding Records | 52,133 | JusticeHub cross-linked |
| ATO Corporate Tax Transparency | 26,241 | Full import, effective tax rates |
| Grant Opportunities | 18,069 | 30+ sources, 100% embedded for semantic search |
| Foundations (profiled) | 10,779 | ABN + ACNC linked, 3,264 LLM-enriched (30%) |
| Social Enterprises | 10,339 | Supply Nation + Social Traders + B Corp + state networks |
| ORIC Indigenous Corporations | 7,369 | ABN + ACNC cross-referenced |
| Foundation Programs | 2,472 | Linked to 361+ foundations |
| SEIFA Socioeconomic Index | ~11,000 | All AU postcodes with disadvantage scores |
| Place/Postcode Geography | ~12,000 | Remoteness + LGA + SA2 + lat/lng |
| Community Orgs | 541 | Profile tracking |
| **Entity Graph** | **100,036 entities** | **211,783 relationships** |
| **Total Records** | **~4.2M** | |

### Cross-Reference Intelligence (Verified)

- 140+ entities that donate to political parties AND hold government contracts
- 41% of Indigenous corporations linked to ACNC charity records
- Entity resolution F1 score: **94.1%** (trigram matching + ABN/ACN/ICN + benchmark harness)
- Canonical ID system: `gs_id` format (`AU-ABN-12345678901`)
- Entity geo coverage: postcode 90%, remoteness 96%, LGA 90%, SEIFA 89%
- 7,822 community-controlled organisations classified (ORIC + name-matched charities)
- Funding gap scoring across 2,900+ postcodes via `get_funding_gaps()` RPC

### Live Product (70 pages, 77 API routes, 86 scripts)

- Semantic + hybrid grant search (18K grants, 100% embedded)
- Foundation directory with 7-year giving history and AI profiles
- Entity dossier ("ABN X-Ray") with donations, contracts, justice funding, place context
- Place pages with SEIFA + remoteness + funding gap analysis + coverage map
- Grant tracker (kanban: wishlist → submitted → won/lost)
- Knowledge Wiki: document upload (PDF/DOCX/URL) → AI extraction → org-scoped RAG Q&A
- AI Answer Bank: extract Q&A pairs from past applications
- Grant pipeline tracker with Notion sync
- Tender intelligence module with compliance checks
- Portfolio management for grant tracking
- Alert system for grant matches
- Social enterprise directory with Supply Nation + multi-source aggregation
- Investigative reports: donor-contractor overlap, power dynamics, funding equity, community parity
- AI chat assistant (RAG-powered grant discovery + org knowledge)
- Mission control dashboard with agent orchestration
- Data observatory with coverage map, sector charts, freshness tracking
- 48 data pipeline agents with 8-category registry and orchestrator
- Stripe billing (5 tiers), user accounts, team management
- API key management for programmatic access

### Technology Stack

Next.js 15 + Supabase (Postgres + pgvector + Storage + Auth) + OpenAI embeddings + 9-provider LLM rotation + Cheerio/mammoth scraping + Stripe billing + Vercel hosting

---

## The Architecture

### Seven Core Objects

| Object | What It Represents | Current State |
|--------|--------------------|---------------|
| **Entity** | Organisation, business, charity, foundation, Indigenous corp | 80K+ in graph |
| **Person** | Director, responsible person, donor, lobbyist | Partial (ACNC responsible persons, AEC donors) |
| **Transaction** | Grant, contract, donation, payment | 50K+ relationships mapped |
| **Program** | Funding program, foundation program, government scheme | 2,378 foundation programs |
| **Place** | Postcode, LGA, electorate, region, state, nation | 17K postcodes with SEIFA |
| **Document** | Source PDF, annual report, government notice | Provenance tracked per record |
| **Story** | Community voice, lived experience, local priorities | Not yet built — see Community Layer below |

### Four Truth Layers

**Layer 1: Raw Records** — Exactly what the source published. Every record carries `source_dataset`, `source_record_id`, `source_url`.

**Layer 2: Resolved Entities** — Canonical representation of each org/person/place. `gs_id` system with alias tracking and confidence levels (registry > verified > reported > inferred > unverified).

**Layer 3: Relationships** — Donated to, contracted by, funded by, directs, operates in, controls, subsidiary of. The cross-reference graph that multiplies the value of every dataset.

**Layer 4: Community Voice** — What communities say they need, what they think is working, what they think is harmful, what impact actually means there. This is where the platform stops being another institutional mirror and becomes a power-shifting tool.

**This is the core insight:** formal money data + formal organisation data + community-defined reality. When those are linked, you get quantitative accountability + qualitative legitimacy.

---

## Data Sources: What's Easy, What's Hard

### Tier 1: Easy / Open (do now)

Already public, structured, bulk-accessible. Low acquisition cost.

| Source | What You Get | Access | Status |
|--------|-------------|--------|--------|
| **ABR/ABN Bulk Extract** | 10M+ entities (name, type, status, state, GST) | Free weekly XML on data.gov.au | **Done** (20 XML files, ~6M records, backfilled 16K postcodes) |
| **ACNC Register** | 64K charities with purposes, programs, finances, governance | Free weekly CSV on data.gov.au | Done |
| **ACNC AIS Data** | Revenue, expenses, grants, assets, staff by charity by year | Free annual CSV | Done (7 years, 360K records) |
| **ORIC Register** | 7,369 Indigenous corporations with financials | Free CSV on data.gov.au | Done |
| **AusTender** | Federal procurement contracts | Free OCDS API | **Done** (670K contracts, full history) |
| **AEC Donations** | Political donations disclosures | Free, structured | **Done** (313K records) |
| **ASIC Company Dataset** | Company name, ACN, type, status, registration date | Free weekly CSV (shallow — no directors) | Done (2.1M) |
| **ATO Tax Transparency** | Large taxpayer income, tax, entity details | Free, annual | **Done** (26K records, full import) |
| **Supply Nation** | Verified Indigenous businesses | Directory scrape | **Done** (6,135 businesses) |
| **Social Traders** | Social enterprise directory | Directory scrape | **Done** (multi-source, 10K+ SEs) |
| **Modern Slavery Register** | ~27K entities with statements | Free, structured | Done (16K imported) |
| **Federal Lobbying Register** | ~1,500 third-party lobbyists | Free | Done (139 imported) |
| **NIAA Senate Order 16** | Indigenous affairs grants | Public data | **Done** |
| **Justice Funding** | Justice sector funding flows | JusticeHub cross-link | **Done** (52K records) |
| **ABS Geography** | Postcode-to-remoteness correspondence | Free CSV | **Done** (full AU coverage) |

### Tier 2: Hard / Fragmented (6-12 months)

| Source | Challenge |
|--------|-----------|
| **ASIC Directors/Officeholders** | Paid extracts ($10-23 per entity). Selective enrichment only. |
| **State government grants** | Each state has different portal, format, access rules. NSW/VIC/SA/WA/NT all incomplete. |
| **Supply Nation** | **Done** — 6,135 businesses scraped and imported. |
| **Council community plans** | Every LGA publishes one. Public but unstructured (PDFs). |
| **APH inquiry submissions** | Public, searchable, full of community voice. Unstructured. |

### Tier 3: Very Hard (12+ months)

| Source | Challenge |
|--------|-----------|
| **Beneficial Ownership Register** | Goes live ~2027. Game-changer when it arrives. |
| **Mining leases / exploration licences** | State-by-state registries, different formats |
| **Land titles / property ownership** | State registries, many paywalled |
| **State procurement** | Some open (QLD QGIP), most fragmented |

**Strategy:** Exhaust Tier 1 first. Cherry-pick high-value Tier 2 items. Tier 3 only when there's clear demand or investigative need.

---

## The Person Layer (Power Map)

The vision's most important underdeveloped layer. Person-entity relationships are the power map: who sits on which boards, who directs which companies AND which charities, who donates AND contracts.

### What's available now (free):

- **ACNC responsible persons** — every charity's directors/officers, public
- **AEC donor names** — individual political donors, public
- **AusTender supplier contacts** — limited but available
- **ORIC corporation officeholders** — public register

### The high-value cross-reference:

Cross-match ACNC responsible persons with AEC donor names. Find people who direct charities AND donate to political parties. This is the interlocking-directorate angle that gets investigative attention.

### What requires paid access:

- **ASIC officeholders** — $23 per roles-and-relationships extract. Use selectively on high-value entities only.

### Architecture:

The `gs_entities` table already supports `person` as an entity type, and `gs_relationships` supports `directorship` as a relationship type. The infrastructure exists — the data pipeline doesn't yet.

---

## The Community Layer (The Thing Nobody Else Has)

Most transparency platforms stop at showing where money goes. None show whether the money matched what communities actually need. This is the layer that makes CivicGraph genuinely different.

### Concrete data sources for community voice:

| Source | What It Provides | Acquisition |
|--------|-----------------|-------------|
| **Empathy Ledger** | Structured community stories, priorities, self-defined outcomes | Direct integration (same parent org, API available) |
| **LGA Community Strategic Plans** | Council-adopted community priorities by place | Public PDFs, LLM extraction |
| **APH Inquiry Submissions** | Community org testimony on issues (justice, housing, health) | Public, searchable on aph.gov.au |
| **ORIC Annual Reports** | Indigenous corporation self-reported priorities and challenges | Public, some structured |
| **Closing the Gap reports** | Community-defined outcomes and progress indicators | Public, structured |

### How it connects:

For every place page (`/places/[postcode]`), show:
1. **Money in:** All grants, contracts, and funding flowing to this area
2. **Who got it:** Recipients ranked by amount, local vs external
3. **What the community says it needs:** Extracted from council plans, inquiry submissions, EL stories
4. **The gap:** Where money doesn't match need

This is how the platform says: *here is the ledger of money AND here is the ledger of meaning.*

### Empathy Ledger as architectural partner:

EL is the community voice infrastructure. CivicGraph is the money/power ledger. Together they complete the picture. The integration is not decorative — it's structural:

- EL captures community-defined outcomes in structured format
- CivicGraph maps where money goes
- Linked by place, they show whether investment matches community priority
- This is the ACT ecosystem flywheel: better community data feeds better accountability, which feeds better funding decisions, which creates better community outcomes

---

## The Search Experience

A user should be able to search by organisation name, ABN, director name, postcode, town, grant program, department, electorate, or issue (youth justice, housing, community safety) and get back a single connected answer:

- Who this is
- What money they've received
- From whom
- Over what period
- In what places
- With what linked entities
- With what stated purpose
- With what known governance
- With what community story attached

That is search as civic orientation, not search as keyword matching.

### How AI is used:

AI does six jobs. None of them involve fabricating certainty.

1. **Extraction** — Turn PDFs, reports, statements into structured records
2. **Entity resolution** — Match names to ABNs, ACNs, ORIC entries, charity IDs
3. **Relationship inference** — Suggest likely links between entities, people, places, funding flows
4. **Gap analysis** — Find where money is concentrated, absent, or misaligned with need
5. **Story synthesis** — Turn a place, org, or issue into a plain-English briefing
6. **Community signal matching** — Link formal spend patterns to what communities say they need

**The rule:** AI proposes. Evidence proves. Communities interpret.

Every AI output shows: source, confidence, whether it is exact or inferred, where the user can verify it.

---

## Data Quality and Trust Framework

The platform's credibility depends on users knowing what's verified vs inferred.

### Confidence hierarchy (already in schema):

| Level | Meaning | Example |
|-------|---------|---------|
| `registry` | From an authoritative register | ACNC charity record |
| `verified` | Cross-referenced across 2+ sources | ABN matched in both AEC and AusTender |
| `reported` | Single authoritative source, not cross-checked | ATO tax transparency entry |
| `inferred` | AI or fuzzy-match suggested | Entity name matched at 85% trigram similarity |
| `unverified` | User-contributed, not validated | Community-submitted correction |

### Correction mechanism:

- Users can flag incorrect matches or missing data
- Corrections create `unverified` records until validated
- Validation = cross-reference against a registry source

### Indigenous data sovereignty:

CivicGraph partners WITH Indigenous communities. It does not claim ownership of Indigenous data. Specific principles:

- ORIC and Supply Nation data is presented as those organisations publish it — no re-interpretation
- Indigenous corporations can claim their profile and control how their community context is presented
- The community layer for Indigenous places is curated in partnership, not extracted unilaterally
- Supply Nation data will be accessed via partnership, not scraping

---

## Why Self-Sustaining Revenue Is Non-Negotiable

Every major transparency platform in the world is failing financially:

| Organisation | Peak | Current Status |
|-------------|------|---------------|
| **OpenSecrets** (US political money) | 40+ staff, $6.3M revenue | Laid off 1/3 of staff Nov 2024 |
| **Sunlight Foundation** (US govt transparency) | $9M revenue, 40+ staff | Dead since 2020 |
| **Center for Public Integrity** | Decades of Pulitzer-winning work | Dying |
| **Michael West Media** (AU corporate power) | 500K monthly views | Reader-funded, fragile |
| **360Giving** (UK grants data) | 275 funders, £265B in grants | Foundation-funded charity |

The pattern: foundations fund transparency work when it's fashionable, then reprioritise. CivicGraph cannot follow this path. It must generate its own revenue from the data itself.

---

## Three Product Layers

### Layer 1: Public Commons (free forever)

The civic infrastructure layer. Always free.

- All raw data, basic search, cross-reference browser
- Grant discovery and foundation directory
- Community org profiles
- Place pages with funding analysis
- Public-interest reports and datasets
- Community stories
- Baseline exports

### Layer 2: Professional Intelligence (paid)

Revenue from making capital allocation legible at professional depth.

| Product | Price | Status |
|---------|-------|--------|
| **Entity Dossiers** ("ABN X-Ray") | $500-2,000 | Core product wedge — show everything connected to an ABN |
| **Custom Alerts** | $50/mo | "Notify me when anything changes for [entity/place/issue]" |
| **Paid API / Data Exports** | $200-2,000/mo tiered | For researchers, NGOs, and tool-builders |
| **Flagship Reports** | $2,000-10,000 | Deep quarterly analytical reports |

### Layer 3: Institutional Infrastructure (enterprise)

| Customer Segment | What They Get | Pricing |
|----------|-------------|---------|
| **Foundations / grantmakers** | "Where does our money actually go?" analytics | $10-50K/yr |
| **Research centres / universities** | Full dataset access + research API | $10-50K/yr |
| **ESG / compliance firms** | Due diligence data feeds | $20-100K/yr |
| **Anti-corruption bodies** (CCC, NACC, IBAC) | Cross-reference engine + custom alerts | $50-200K/yr |
| **Peak bodies** | Sector-level funding flow analysis | $10-30K/yr |
| **Impact investors** | Portfolio transparency + benchmarking | $10-50K/yr |

The people who should pay already have budgets: the charity sector had $222B in revenue in 2023, and government spending with certified social enterprises reached $1.1B last year. The commercial layer sits on top of real, large, existing capital flows.

---

## Revenue Priority Order

1. **Entity dossiers and alerts** — closest to existing product, immediate demand
2. **Paid API / data exports** — standard data-platform revenue
3. **Flagship investigative reports** — content marketing + direct sales
4. **Institutional licensing** — longer cycle but higher value
5. **Custom advisory / white-label dashboards** — enterprise, relationship-driven

---

## Surplus Distribution Model

| Allocation | % | Purpose |
|-----------|---|---------|
| Infrastructure | 40% | Product, data, staff, systems |
| Member dividends (patronage rebates) | 30% | Returns to cooperative members proportional to usage |
| Community treasury | 20% | Grants, local bounties, community projects (via ACT Foundation) |
| Reserves | 10% | Financial buffer |

**Tax advantage:** Patronage rebates (30%) are tax-deductible to the cooperative. Community grants (20%) are potentially deductible as DGR donations to ACT Foundation. Effective tax rate is significantly reduced.

---

## Legal Structure: Distributing Cooperative

```
ACT Foundation (CLG, charitable, DGR)
  ├── Holds charitable purpose, receives tax-deductible donations
  ├── Administers the 20% community grants allocation
  └── Can receive co-op contributions as DGR-deductible donations

ACT Ventures (Pty Ltd, mission-locked, 40% profit-sharing)
  └── Provides operational services to the cooperative under contract

CivicGraph Data Cooperative (Distributing Co-op, CNL QLD)
  ├── Owned and governed by community org members (one member, one vote)
  ├── Revenue from professional intelligence + institutional licensing
  ├── Surplus distributed via patronage rebates (proportional to usage)
  └── Structurally independent — genuinely member-owned, not a subsidiary
```

### Why Distributing (not Non-Distributing)

- Distributing cooperatives CAN return surplus to members — required for the patronage rebate model
- Patronage rebates are tax-deductible to the cooperative
- The charitable layer already exists via ACT Foundation — no need for the cooperative itself to be a charity

### Formation Sequence

1. Contact BCCM for formation guidance
2. Identify 5+ founding community org members
3. Draft cooperative rules with revenue distribution baked in
4. Prepare disclosure statement (required for distributing co-ops)
5. Submit to QLD Office of Fair Trading for rule approval
6. Hold formation meeting
7. Register and obtain ABN
8. Establish service agreements with ACT Foundation and ACT Ventures
9. Get cooperative taxation advice

---

## The Competitive Moat

Nobody else has both the entity graph AND the community voice layer.

### What competitors have:

- **Philanthropy Australia** — grants database (members only)
- **Our Community / GrantSearch** — grant listings (paywall)
- **Funding Centre** — grant listings ($55-85/yr)
- **Michael West Media** — corporate power journalism (no data product)
- **360Giving (UK)** — open grants standard (no Australian equivalent)

### What CivicGraph has that nobody else does:

1. **Entity resolution at scale** — 100K+ entities cross-referenced by ABN across donations, contracts, charities, justice funding, and Indigenous corporations. Nobody else has done this for Australia. F1 score: 94.1%.
2. **The cross-reference graph** — 211K relationships linking political donations → government contracts → charities → Indigenous corporations → justice funding. Each new dataset multiplies the value of every existing one.
3. **Knowledge infrastructure** — document upload, AI extraction, org-scoped RAG search, answer bank with AI Q&A extraction. Users build institutional knowledge that improves with every application.
4. **Community voice integration** — Empathy Ledger partnership means community-defined priorities linked to funding flows. Unique globally.
5. **Cooperative ownership** — community orgs contribute data and validate results because they own the platform.
6. **Beneficial Ownership timing** — the register goes live ~2027. Whoever has the entity graph ready to integrate ownership data becomes Australia's definitive power map.
7. **AI enrichment pipeline** — 9-provider LLM rotation with entity resolution, making public data machine-readable at scale.
8. **Geographic intelligence** — 96% of entities geocoded with remoteness, 90% with LGA, 89% with SEIFA disadvantage. Funding gap scoring across 2,900+ postcodes.

---

## Execution Plan

### Phase 0: DONE

CivicGraph as grants + foundations + entities + places + knowledge + pipeline + alerts. Live product with 4.2M records, 100K entity graph, semantic search, investigative reports, knowledge wiki, 70 pages, 77 API routes, 86 scripts.

### Phase 1: Launch to First Users (NOW — Q2 2026)

| Action | Impact | Effort |
|--------|--------|--------|
| Deploy to production and verify accessibility | Users can reach the product | Days |
| Deploy cron for daily grant refresh + weekly graph rebuild | Data stays fresh | Days |
| Fix access control — enforce tier limits on API routes | Revenue prerequisite | Days |
| Recruit 10 beta testers from warm network | First feedback loop | 1-2 weeks |
| Complete foundation enrichment (2,452 remaining with websites) | Data quality | Ongoing (batches) |
| LinkedIn page + first content post (donor-contractor investigation) | Brand awareness | 1 day |
| Email 3 grant consultants — offer free Professional access | First users | Days |
| Set up hello@civicgraph.au forwarding | Contact channel | Hours |
| Submit PA Conference 2026 speaker proposal (Sep 8-10, Brisbane) | Conference presence | Days |

### Phase 2: Build the Person Layer + First Revenue (Q3 2026)

| Action | Impact | Effort |
|--------|--------|--------|
| Cross-reference ACNC responsible persons with AEC donors | Interlocking directorates — the investigative angle | 2-3 weeks |
| Person entity type in graph | People who direct + donate + contract | 1-2 weeks |
| Entity dossier includes "people connected to this org" | Product depth | 1 week |
| Convert beta testers to paid — founding member pricing (50% off forever) | First revenue | Ongoing |
| Launch paid API tiers | Recurring revenue | 2 weeks |
| Target 5 paying customers by end of Month 3 ($14K ARR) | Revenue validation | Sales |

### Phase 3: Build the Community Layer (Q4 2026)

| Action | Impact | Effort |
|--------|--------|--------|
| Empathy Ledger integration (API) | Community stories linked to places | 2-3 weeks |
| LGA Community Strategic Plan extraction | Council-adopted priorities by place | 4-6 weeks (PDF extraction) |
| Place pages show money + community priorities + gap | The full picture | 2-3 weeks |
| Ship flagship quarterly reports | Content + sales | Ongoing |
| Institutional licensing (universities, peak bodies) | Enterprise revenue | Relationship-driven |
| PA Conference Sep 2026 — "What 100,000 entities tell us about Australian philanthropy" | Market positioning | Preparation |

### Phase 4: Scale and Deepen (Q1 2027)

| Action | Impact | Effort |
|--------|--------|--------|
| Integrate Beneficial Ownership Register (when live) | Game-changer — who really owns what | Depends on API |
| Expand state coverage (NSW, VIC, SA, WA, NT) | National grants coverage | Ongoing |
| Selective ASIC director enrichment (high-value entities) | Deep corporate structure | Ongoing (paid per query) |
| Second state QGIP equivalent (NSW open data) | Cross-state spending comparison | 2-3 weeks |
| Target: $200K ARR from dossiers + API + licensing | Sustainability proof | Sales |

### Phase 5: International (2027+)

| Action | Impact |
|--------|--------|
| New Zealand (similar data landscape) | First export |
| UK (360Giving integration, Companies House, Electoral Commission) | Largest existing open grants ecosystem |

International expansion only when the Australian model is proven and self-sustaining.

---

## How This Helps Even Things Out

The platform doesn't "fix inequality" by itself. It changes who can see, argue, and negotiate.

Right now, large institutions have: better data, better memory, better reporting, better relationships, better ability to narrate success.

Communities have: better lived knowledge, less visibility into the full system, less time to prove what they already know.

CivicGraph narrows that gap. A community group should be able to say:

> Here is all the money that came into our area.
> Here is who got it.
> Here is how much stayed local.
> Here is how much went to large intermediaries.
> Here is what our people say is actually needed.
> Here is the mismatch.
> Here is our alternative.

That is how search, analysis, and visibility become a practical redistribution of power.

---

## Critical Gaps to Close (Priority Order)

### Data gaps:

1. **Foundation enrichment** — 2,452 with websites not yet enriched (30% done, was 16.5%)
2. **State grant coverage** — SA, WA, NT still sparse
3. **Eligibility data** — limited structured eligibility criteria
4. **Grant freshness** — inserted once, rarely updated, no lifecycle management
5. **Person layer** — ACNC responsible persons + AEC donor cross-reference not yet built

### Architecture gaps:

1. **Person layer pipeline** — infrastructure exists, data pipeline doesn't
2. **Community voice pipeline** — no structured ingestion yet (EL integration planned)
3. **Cron deployment** — automated daily/weekly data refresh not yet deployed
4. **Access control enforcement** — tier limits on API routes not fully enforced
5. **Zero external users** — product exists, no users yet. This is the #1 priority.

---

## The Pitch

> Every dollar of taxpayer money, every political donation, every government contract, every charitable grant — all connected, all searchable, all free.
>
> CivicGraph makes capital allocation legible. It puts that knowledge in your hands — whether you're a community org applying for funding, a journalist following the money, a researcher studying influence, or a foundation asking where your grants actually ended up.
>
> We're not a startup looking for exit. We're a cooperative that exists to make power visible and redistribute what we earn to the communities the data serves.
>
> The question isn't whether this data should be connected. It's who builds the platform first — and whether it serves shareholders or communities.
>
> We chose communities.

---

## The ACT Ecosystem Flywheel

CivicGraph does not exist alone. It is one of three platforms in the ACT ecosystem, each producing data the others need. Together they create a flywheel that no competitor can replicate because no competitor has all three layers.

### The Three Platforms

| Platform | What It Does | Data It Produces | Revenue Model |
|----------|-------------|-----------------|---------------|
| **CivicGraph** | Maps money, power, organisations, place | Entity graph, funding flows, cross-references, gap analysis | Cooperative: entity dossiers, API, institutional licenses |
| **Empathy Ledger** | Captures community voice, stories, cultural intelligence | Storyteller profiles, cultural markers, impact dimensions, consent-managed stories | Cross-subsidy SaaS: free for communities, $299-$2,499/mo for institutions |
| **JusticeHub** | Tracks intervention effectiveness in youth justice | 1,112 scored interventions, evidence links, outcome data, discrimination reports | Cross-subsidy SaaS + government contracts ($200K-$1M/yr) |

### How They Feed Each Other

```
CivicGraph (MONEY)                    Empathy Ledger (VOICE)
  │                                       │
  │ "Here's all the youth justice         │ "Here's what communities say
  │  funding in QLD, who got it,          │  about these programs — what's
  │  and which programs it funded"        │  working, what's harmful, what
  │                                       │  they actually need"
  │              ┌─────────┐              │
  └──────────────┤ COMBINED ├─────────────┘
                 └────┬────┘
                      │
                 JusticeHub (EVIDENCE)
                      │
                 "Here's which of those
                  funded programs actually
                  reduce reoffending, with
                  portfolio scores across
                  5 evidence signals"
```

### Specific Data Flows

**CivicGraph → JusticeHub:**
- Grant data feeds JH's Funding Operating System (System 0)
- Foundation profiles inform JH's philanthropic fundraising targets
- Place-based funding analysis shows which regions are underfunded for justice

**JusticeHub → CivicGraph:**
- Intervention effectiveness scores enrich CivicGraph's grant data ("this program works")
- 507 youth justice organisations add to CivicGraph's entity graph
- ALMA (Australian Living Map of Alternatives) evidence links provide outcome data for funded programs

**Empathy Ledger → CivicGraph:**
- Consented community stories appear on CivicGraph place pages and grant pages
- Cultural markers and impact dimensions provide qualitative context for funding decisions
- Storyteller profiles link to organisations in the entity graph
- Syndication API already built and tested (2 stories live, 15 storytellers ready)

**CivicGraph → Empathy Ledger:**
- Grant data contextualises stories ("This org received $X from Y foundation")
- Foundation profiles help storytelling orgs identify potential funders
- Place pages drive traffic to EL stories about specific communities

**Empathy Ledger → JusticeHub:**
- Bi-directional sync already working (push/pull profiles, stories, org membership)
- Narrative evidence layer for ALMA interventions (lived experience alongside effectiveness data)
- Cultural safety protocols inform how JH presents Indigenous program data

**JusticeHub → Empathy Ledger:**
- Intervention outcomes enrich storyteller context
- Organisation profiles sync back to EL
- JH campaign contacts (CONTAINED tour) become potential EL storytellers

### Why This Is Unassailable

A competitor building just a grants database can be replicated. A competitor building just a storytelling platform can be replicated. A competitor building just a justice data platform can be replicated.

But a competitor building all three — with bi-directional data flows, shared entity graph, consent-managed community voice, AND cooperative ownership by the communities the data serves — cannot be replicated. That combination is the moat.

### Combined Revenue Potential

| Platform | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
| **CivicGraph** | $80K | $350K | $800K |
| **Empathy Ledger** | $60K | $200K | $500K |
| **JusticeHub** | $180K | $420K | $950K |
| **Combined** | **$320K** | **$970K** | **$2.25M** |

JusticeHub leads revenue because government contracts are larger and the $3.9B NAJP procurement window is open NOW. CivicGraph follows as entity dossiers and API access gain traction. EL grows as institutional storytelling partnerships scale.

---

## Financial Model: Why This Is Viable

### The Market Is Real

| Segment                            | Size                            | CivicGraph's Share                               |
| ---------------------------------- | ------------------------------- | ------------------------------------------------ |
| Australian charity sector revenue  | **$222B/year**                  | Data about where this money goes                 |
| Charitable giving                  | **$13B+/year**                  | Data about who gives and who receives            |
| Private Ancillary Funds            | **~3,200 funds, $10B+ capital** | Primary data users — need to know where to grant |
| Federal government procurement     | **$105B/year**                  | Cross-reference with donations and charity data  |
| State government procurement       | **$31B+/year**                  | Same cross-reference opportunity                 |
| ESG/GRC compliance market          | **$996M, growing 12.7% CAGR**   | Demand driver for due diligence data             |
| Management consulting              | **$47.6B market**               | Paying customer segment for government advisory  |
| Youth justice spending (JH market) | **$26.5B/year**                 | JusticeHub's primary market                      |
| QLD Youth Justice budget alone     | **$770.9M**                     | First JH government contract target              |
| NAJP federal justice package       | **$3.9B over 5 years**          | JH procurement window — open NOW                 |

### What Comparable Companies Are Worth

| Company | Revenue | Valuation | Model |
|---------|---------|-----------|-------|
| **illion** (AU business data) | $175M/year | **$820M** (acquired by Experian 2024) | Pay-per-query + subscriptions |
| **Dye & Durham / GlobalX** (ASIC data) | $452M CAD total | Public company | Pay-per-search ($15-40/query) |
| **Equifax Australia** (D&B products) | Part of $5.5B USD global | Enterprise | Custom pricing |
| **360Giving** (UK grants) | ~$1.2M AUD/year | Nonprofit | Foundation grants (cautionary tale) |
| **OpenSecrets** (US political money) | $2.5M revenue, $4.3M expenses | Nonprofit | Foundation grants (dying) |

**The lesson:** 360Giving and OpenSecrets prove the foundation-funded model doesn't work. illion proves the commercial data model does. CivicGraph must be illion for civic data, not another OpenSecrets.

### Revenue Assumptions (CivicGraph Only)

#### Year 1: $80K (Proving the Model)

| Product | Units | Price | Revenue |
|---------|-------|-------|---------|
| Entity dossiers | 50 | $500-$2,000 | $40K |
| API subscriptions | 5 | $200/mo | $12K |
| Custom alerts | 20 | $50/mo | $12K |
| First flagship report | 2 | $5,000 | $10K |
| Consulting project | 1 | $6K | $6K |

#### Year 2: $350K (First Institutional Customers)

| Product | Units | Price | Revenue |
|---------|-------|-------|---------|
| Entity dossiers | 150 | $500-$2,000 | $120K |
| API subscriptions (tiered) | 15 | $500/mo avg | $90K |
| Institutional licenses | 3 | $20K/yr | $60K |
| Custom alerts | 80 | $50/mo | $48K |
| Flagship reports | 4 | $5,000 | $20K |
| Consulting/white-label | 2 | $6K | $12K |

#### Year 3: $800K (Scale)

| Product | Units | Price | Revenue |
|---------|-------|-------|---------|
| Entity dossiers | 300 | $500-$2,000 | $250K |
| API subscriptions | 40 | $600/mo avg | $288K |
| Institutional licenses | 6 | $30K/yr | $180K |
| Custom alerts | 150 | $50/mo | $90K |
| Flagship reports | 6 | $5,000 | $30K |
| Enterprise/white-label | 2 | $15K | $30K |

**Break-even:** ~$250K/year covers infrastructure ($50K Vercel/Supabase/APIs) + 1 FTE ($150K) + data costs ($50K). Achievable in Year 2.

### Pricing Philosophy

**Free forever:** All raw data, basic search, cross-reference browser, place pages, community stories, public reports. This is civic infrastructure — it must stay free.

**Paid:** The professional intelligence layer that saves institutional buyers hours of manual research. Price against the alternative: a consultant spending 2 days doing ASIC/ACNC/AusTender searches manually ($2,000-$5,000 in billable hours). An entity dossier at $500-$2,000 is a bargain.

**Benchmark against existing products:**
- ASIC company extract via GlobalX: $15-40 per search
- D&B business report: $100-300 per entity
- illion credit report: $50-200 per entity
- CivicGraph entity dossier (aggregating ALL of the above plus grants, donations, charity links, community voice): **$500-$2,000** — far more comprehensive at a competitive price

---

## Power Analysis: Who Wants This, Who's Scared

### Who Would Pay Anything to Get This

**1. Community Legal Centres and Aboriginal Legal Services**
They're fighting for their clients with one hand tied behind their back. They know the system is stacked but can't prove it with data. CivicGraph gives them ammunition: "Your department spent $X on programs that don't work while our community got nothing." **They'd pay nothing (free tier) but they're the moral backbone of the platform.**

**2. Philanthropic Foundations (3,200+ PAFs, $10B+ capital)**
They give $13B/year but have no way to see what everyone else is funding, where gaps are, or whether their grants overlap with government spending. They're flying blind. "Where should our next $500K go?" is a question CivicGraph answers better than any consultant. **They'd pay $2K-$50K/year and be grateful.**

**3. University Researchers**
Social policy, public administration, nonprofit studies — 30-50 research centres across 43 universities. They currently spend weeks manually downloading ACNC/AusTender/AEC data and cross-referencing in Excel. CivicGraph's API makes a PhD project that took 6 months take 6 hours. **They'd pay $5K-$50K/year per centre.**

**4. Anti-Corruption Bodies (NACC, CCC, ICAC, IBAC)**
Combined budgets ~$300-350M. They investigate corruption where money, influence, and power intersect — exactly what the entity graph maps. A tool that shows "this company donated $X to Party Y and then received $Z in contracts from Department W" is investigative gold. **They'd pay $50K-$200K/year through government procurement.**

**5. ESG/Compliance Firms**
$996M market growing at 12.7%. Mandatory sustainability reporting from Jan 2025 means every large company needs supply chain and community impact data. CivicGraph shows whether a company's "community investment" actually reaches communities. **They'd pay $20K-$100K/year.**

**6. Government Advisory Consultants (50-100 firms)**
Big 4 plus mid-tier firms doing government policy work need this data for every engagement. They currently charge clients $2,000-$5,000/day and spend significant time on manual data gathering that CivicGraph automates. **They'd pay $10K-$50K/year and embed it in their methodology.**

**7. Investigative Journalists**
ABC, Nine/SMH, Guardian AU, Michael West Media, Crikey, The Saturday Paper. They manually search ACNC/AusTender/AEC for every investigation. CivicGraph gives them the cross-reference in seconds. **They'd pay $0-$20K/year (mostly free tier — but the PR they generate is worth millions in brand value).**

### Who Really Wants This

**First Nations communities.** They know money flows through their regions but not to them. They know large intermediary organisations get the contracts. They know outside consultants get paid to write reports about them. CivicGraph makes all of that visible and provable. For the first time, a community group can walk into a negotiation with: "Here's every dollar that came into our region in the last 5 years, who got it, and how much stayed local." That changes power dynamics permanently.

**Anyone who's ever lost a grant to a bigger org with a better grant writer.** Small community organisations with deep local knowledge lose funding to large intermediaries with professional bid teams. CivicGraph shows the pattern — and shows funders they're funding intermediaries, not communities.

**Closing the Gap accountability advocates.** 4 of 19 targets on track. Justice targets going backwards. $3.9B NAJP committed. Nobody can show whether the money is reaching communities or being absorbed by departments and large NGOs. JusticeHub + CivicGraph together answer that question.

### Who's Nervous

**1. Large intermediary service providers**
The big NFPs that win government contracts to deliver services in communities they don't belong to. Anglicare, Mission Australia, Salvation Army, UnitingCare — organisations with $500M+ revenue that win contracts to deliver services in remote Indigenous communities from head offices in Sydney. CivicGraph shows how much money goes to them vs local organisations. **They won't try to block it (too politically risky) but they'll quietly resist adoption.**

**2. Political parties and their donor networks**
185 entities that donate to parties AND hold government contracts — already in the database. Making this cross-reference publicly searchable is embarrassing. The AEC transparency register exists but nobody cross-references it with AusTender. CivicGraph does this automatically. **They can't stop it (it's all public data) but they'd prefer it didn't exist.**

**3. Government departments with poor grant outcomes**
Departments that spend hundreds of millions on programs with no evidence of effectiveness. JusticeHub's ALMA scores expose this: "Your department funded 47 programs. 3 have any evidence of effectiveness. 31 have never been evaluated." **They'll resist by questioning methodology, not by engaging with the data.**

**4. Private foundations with undisclosed conflicts**
Foundation directors who also sit on boards of organisations their foundation funds. Foundation directors who also donate to political parties that set policy their grants respond to. The person layer of the entity graph exposes interlocking directorates. **They'll say "privacy concerns" when they mean "accountability concerns."**

**5. Consulting firms that sell manual research as expertise**
Firms charging $2,000-$5,000/day for analysis that CivicGraph provides at API prices. Their value proposition relies on information asymmetry — they know where to find public data and charge for finding it. CivicGraph eliminates that asymmetry. **Some will become customers (smart ones). Others will disparage it as "incomplete" (threatened ones).**

### Who's Genuinely Scared

**Nobody should be scared of transparent public data.** Every data source CivicGraph uses is already public. ABR, ACNC, AusTender, AEC, ORIC — all published by government. CivicGraph doesn't create new information. It connects existing information in ways that reveal patterns nobody could previously see without weeks of manual work.

The people who are scared are the people who benefit from the current opacity. That's not a reason to stop — it's a reason to move faster.

**The question this platform asks is simple:** If all this data is already public, why is it so hard for communities to see the full picture? And who benefits from that difficulty?

---

## Competitive Landscape: Who Makes Money From This Stuff

34 companies across 9 categories prove the model. The pattern is clear: start with open/public data, add enrichment and workflow, sell subscriptions. Here are the ones that matter most for CivicGraph.

### The Revenue Proof Points

| Company | Revenue | Model | Why It Matters |
|---------|---------|-------|----------------|
| PitchBook (US) | $618M | Enterprise subs on enriched public filings | **Closest analog.** Public data + enrichment = $618M. |
| Preqin (UK→BlackRock) | $240M ARR | Niche data, premium pricing | Sold for **$3.2B at 13x revenue** after 20 years. |
| Blackbaud (US) | $1.2B | SaaS for nonprofits | Proves nonprofit sector TAM is massive. |
| Benevity (Canada) | $133M | Corporate giving SaaS | Valued at **$1.1B** from corporate CSR side. |
| MSCI ESG (US) | $85M segment | Data feeds + ratings on company disclosures | ESG ratings on open data → $85M. |
| Submittable (US) | $67M | Grant workflow SaaS | Grant management from Missoula, MT — proves non-coastal viable. |
| Quorum (US) | $61M | SaaS on public legislative data | **Public data → $61M.** 50% of Fortune 100 pay. |
| Candid (US) | $40M | Tiered subs on IRS 990 data | US grants data equivalent — closest direct analog. |
| Sayari (US) | Est. $50-100M | Enterprise SaaS on open registry data | **$235M investment from TPG.** Open corporate data → massive valuation. |
| D&B (US) | ~$2.3B | Enterprise subs + data licensing | **183 years old.** DUNS number became infrastructure. |
| Bureau van Dijk (UK) | Est. $100-500M | Enterprise subs on aggregated registry data | Acquired by Moody's for **€3B** for normalising 170 sources. |
| OpenCorporates (UK) | Est. $5-15M | Dual licensing (free public/paid commercial) | **THE model for CivicGraph.** Free for journalists/NGOs, paid for banks. |
| Crunchbase (US) | ~$50M | Freemium + data licensing (45% of revenue) | Started as crowdsourced TechCrunch side project → commercial. |

### Australian Competitors (Direct)

| Competitor | Revenue | Model | CivicGraph Differentiation |
|------------|---------|-------|---------------------------|
| **SmartyGrants / Our Community** | $6.2M | SaaS for grantmakers + Funding Centre subs ($1.5-3K/yr) | They do workflow (applications). We do intelligence (who funds what, why, patterns). Complementary. |
| **The Grants Hub** | Small | Subscription directory ($313-486/yr) | Listings only. No enrichment, no entity graph, no AI. |
| **GrantConnect** | Free (govt) | Government transparency portal | Raw data source we build on — like PitchBook builds on SEC filings. |
| **Foundation Maps AU** (Candid/Philanthropy AU) | Part of Candid | Voluntary data sharing partnership | Thin — relies on voluntary participation. We scrape + enrich everything. |

### The Five Models That Transfer

**1. OpenCorporates (dual licensing) — THE model**
Free for public benefit, paid for commercial use. Open corporate registry data from 200M+ companies. Bellingcat and investigative journalists get free access (driving credibility and PR). Banks and compliance teams pay for KYC/AML use. CivicGraph should adopt this exact structure.

**2. PitchBook (enrichment on public filings) — the aspiration**
$618M revenue from data that's largely derived from public filings, press releases, and crowdsourced inputs. The enrichment and UX is the moat, not the raw data. CivicGraph already has the enrichment pipeline (9 LLM providers, entity resolution at 94.1% F1).

**3. Candid (grant-specific, US-only) — the category validator**
$40M revenue proving that grants data specifically sustains a real business. But US-only, and their Australian partnership via Foundation Maps is thin. CivicGraph can be the Australian Candid with better tech and broader scope.

**4. Quorum (workflow on public data) — the execution proof**
$61M from public legislative data turned into workflow tools. 50% of Fortune 100 pay. Proves that organising and making public data actionable is worth billions in aggregate.

**5. Sayari (registry aggregation → strategic value) — the exit benchmark**
Open corporate/registry data from 250+ jurisdictions, entity resolution, risk scoring. $235M investment from TPG Growth. 950% growth in government contracts. If CivicGraph becomes the authoritative Australian entity graph, strategic acquirers will pay multiples.

### Pricing Benchmarks Across Categories

| Tier | Price Range | What They Get | Who Charges This |
|------|-------------|---------------|-----------------|
| Free/Community | $0 | Basic search, limited results | Crunchbase, OpenCorporates, Candid, **CivicGraph** |
| Professional | $300-3,000/yr | Full search, alerts, exports | Grants Hub ($486), Funding Centre ($3K), Crunchbase Pro ($588) |
| Enterprise | $10K-100K+/yr | API access, data feeds, analytics | PitchBook ($20-60K/seat), Sayari, MSCI |
| Platform/OEM | $50K-500K+/yr | White-label data, bulk licensing | D&B, Bureau van Dijk, World-Check |

CivicGraph positioning: **Free for communities, $500-2K/yr for professional grant seekers, $5-50K/yr for foundations and researchers, $20-100K/yr for compliance and government.**

### What Drives Premium Pricing (Pattern From 34 Companies)

1. **Compliance requirement** — if regulators require the data, pricing power is unlimited (World-Check, Sayari)
2. **Decision-critical for capital allocation** — if it informs where money goes, buyers pay (MSCI ESG, PitchBook)
3. **Workflow integration** — if it's embedded in daily work, switching costs are high (Quorum, Blackbaud)
4. **Unique enrichment** — if nobody else has normalised the data, the moat is strong (Bureau van Dijk, Sayari)

CivicGraph targets #2 and #4 first. Foundation program officers making funding decisions and grant consultants writing applications are highest-value customers. The unique enrichment (AI-generated foundation profiles, entity graph, funding pattern analysis) is the moat.

### Realistic Revenue Trajectory (Benchmarked)

| Year | ARR Target | Comparable Stage | What Unlocks It |
|------|-----------|------------------|-----------------|
| 1-2 | $50-200K | Govly early stage | Early adopters, consultants, small foundations |
| 2-3 | $500K-2M | Crunchbase early, Our Community | Product-market fit, API customers, first govt contract |
| 3-5 | $2-10M | SmartyGrants/Our Community scale | Enterprise customers, data licensing, media partnerships |
| 5-10 | $10-50M+ | Quorum trajectory | Market leader, mandated for Closing the Gap reporting |
| Exit | 10-15x revenue | Preqin sold for 13x ($3.2B) | Strategic acquirer (Moody's, BlackRock, S&P type) |

### The Lesson

Every company on this list started with data that was either free, public, or crowdsourced. The money is never in the raw data — it's in normalisation, enrichment, cross-referencing, and making it actionable. CivicGraph already has 4.2M records, 100K entity graph with 211K relationships, 9-provider AI enrichment, 94.1% entity resolution F1, and semantic search across 18K grants. The infrastructure exists. The market is proven. Now it's execution — specifically, getting the first users in the door.

---

## Why ACT (Curioustractor) Is the Right Builder

This is not a project any normal startup or nonprofit can build. It requires:

1. **Technical capability** — 4.2M records, 100K entity graph, 211K relationships, multi-provider AI pipelines, production platforms across 3 codebases. Built by 2 people.

2. **Community trust** — First Nations organisations share data with ACT because ACT is led by people who show up, listen, and don't extract. Nick Marchesi built Orange Sky by standing next to people, not above them. That trust can't be bought or replicated.

3. **Structural alignment** — Cooperative ownership means communities own the platform. 40% profit-sharing via ACT Ventures means the builders are incentivised but not extractive. DGR-eligible Foundation means community grants are tax-deductible. The legal structure IS the value proposition.

4. **Cross-subsidy commitment** — Free forever for communities. Institutions pay so communities don't have to. This is not a freemium trap — the free tier is the full product.

5. **Long-term thinking** — ACT designs for its own obsolescence. The goal is communities owning their own narratives, land, and economic futures. The platform succeeds when communities don't need it anymore. No VC-backed company can make that promise.

Curioustractor should not be ashamed of making real money here. The $222B charity sector, the $105B procurement market, the $996M ESG compliance market — these are real capital flows that ACT can tap by making them legible. The surplus funds community projects, documentary work, local enterprises, and long bets that normal SaaS cannot take.

That is how you build freedom, not just sustainability.

---

*A Curious Tractor project. Built on Jinibara Country.*
*Communities own their narratives, land, and economic futures.*
