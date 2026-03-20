# Google.org Impact Challenge: AI for Government Innovation — Application Answers

**Applicant:** CivicGraph (operating as GrantScope Pty Ltd)
**Amount requested:** USD $2.5M
**Duration:** 24 months
**Deadline:** April 3, 2026
**Platform:** Submittable

> **Note:** Exact form questions are behind the Submittable portal. These answers are structured against the four evaluation criteria and common grant questions. Adjust to match actual form fields.

---

## 1. Organisation Details

**Organisation name:** GrantScope Pty Ltd (trading as CivicGraph)
**Website:** civicgraph.com.au
**Location:** Australia (serving national scope)
**Organisation type:** Social enterprise
**Year founded:** 2025
**Team size:** 1 founder + AI-augmented development (equivalent output of 5-person team)
**ABN:** [Ben to fill]

---

## 2. Executive Summary (likely ~200 words)

CivicGraph is open-source AI infrastructure that maps how public money flows across government systems, who it reaches, and what the evidence says works.

We've linked **158,000+ entities** across **8 government datasets** — procurement contracts ($672K records), justice funding ($71K records), NDIS providers (28K providers), political donations (312K records), charity registrations, ATO transparency, foundations, and the Australian Living Map of Alternatives (ALMA) evidence database with 1,162 evidence-rated interventions.

The platform reveals structural inequities invisible when datasets are viewed in isolation: community-controlled organisations appear in 2.15 systems on average but receive only 3.2% of procurement dollars. Major cities receive 118x the per-LGA dollar flow of Very Remote areas. 31 LGAs have NDIS participants but zero registered providers.

With Google.org support, CivicGraph would become the first cross-system allocation intelligence platform available to Australian government decision-makers — enabling evidence-informed funding allocation, thin market identification, and accountability for whether public investment reaches the communities that need it most.

---

## 3. Problem Statement — What public service challenge are you addressing?

### The Problem: Fragmented Funding Data Prevents Equitable Allocation

Australian governments allocate over $600 billion annually across federal, state, and local agencies. But the systems that track this spending — procurement, justice, disability, Indigenous affairs, charity regulation, tax transparency — are siloed. No single view exists of where money goes, who receives it, or whether investment matches need.

This fragmentation creates three systemic failures:

**1. Funding Deserts** — Areas of high disadvantage receive disproportionately low funding. Our analysis of 1,582 LGAs shows that the most disadvantaged decile receives, on average, 4x less per-capita government investment than the least disadvantaged. Very Remote areas — where Indigenous Australians are 52% of the population — receive 118x less dollar flow per LGA than Major Cities.

**2. Invisible Cross-System Actors** — Entities that receive government contracts, make political donations, receive justice funding, AND hold charity status operate across systems that never talk to each other. We've identified 240 entities spanning 4+ government systems and 40 entities spanning 5+ systems. Some receive millions in government contracts while simultaneously making large political donations — a pattern invisible to any single agency.

**3. Evidence-Free Allocation** — Governments fund programs without systematic access to evidence of what works. JusticeHub's ALMA database rates 1,162 interventions by evidence quality, but this data isn't integrated into funding decisions. The result: programs with strong evidence compete for the same pool as programs with no evaluation, and community-controlled organisations with proven track records are systematically under-funded.

### Who is affected?

The primary beneficiaries are the communities at the end of these funding flows — particularly First Nations communities, people with disability in thin markets, young people in the justice system, and residents of high-disadvantage areas. Secondary beneficiaries are the government officials making allocation decisions without adequate cross-system visibility.

### Why hasn't this been solved?

Cross-system data linkage requires: (a) access to multiple public datasets, (b) entity resolution across inconsistent naming conventions, (c) geographic normalisation, and (d) a platform that makes the linked data actionable. Government agencies lack the mandate (and often the capability) to build cross-agency tools. NGOs lack the data infrastructure. CivicGraph is purpose-built to fill this gap using AI for entity resolution, geographic matching, and evidence synthesis.

---

## 4. Proposed Solution — How will you use AI to address this challenge?

### CivicGraph: Cross-System Allocation Intelligence

CivicGraph is a working platform (not a concept) that uses AI to link, analyse, and visualise how public money flows across government systems. It is already live at civicgraph.com.au with real data.

#### Current Capabilities (already built)

| Capability | Data | Scale |
|------------|------|-------|
| **Entity Knowledge Graph** | 158,000+ organisations linked by ABN, name matching, and geographic proximity | 8 systems |
| **Cross-System Power Index** | Score each entity by how many government systems they appear in, total dollar flow, and influence vectors | 83,000 entities scored |
| **Funding Desert Analysis** | LGA-level desert scores combining SEIFA disadvantage, remoteness, and actual funding received | 1,582 LGAs |
| **NDIS Thin Market Mapping** | Bipartite graph of providers ↔ LGAs with severity classification | 26,778 providers, 31 critical LGAs |
| **Justice Funding Network** | Program → recipient graphs with ALMA evidence enrichment | 71,000 records |
| **Force-Directed Graph Visualisation** | Interactive network exploration with 6 viewing modes | Real-time, browser-based |
| **Evidence Integration (ALMA)** | 1,162 interventions rated by evidence quality, linked to recipient organisations | 570 evidence records, 506 outcomes |

#### AI Components (current + proposed)

**Current AI usage:**
- **Entity resolution**: Fuzzy name matching + ABN linkage to deduplicate across 8 systems (e.g., "Aboriginal Hostels Limited" vs "ABORIGINAL HOSTELS LTD" across procurement, ACNC, and ATO datasets)
- **Evidence classification**: NLP-based categorisation of ALMA interventions by type, evidence level, and target cohort
- **Topic tagging**: Automated classification of justice funding records into policy domains (youth-justice, child-protection, indigenous, diversion, etc.)
- **Anomaly detection**: Identifying cross-system patterns (entities that both donate and contract, funding concentration, revolving door indicators)

**Proposed AI expansion (with Google.org funding):**
- **Agentic data pipeline**: Autonomous agents that continuously harvest, clean, and link new government data releases (currently 48 agents, targeting 100+)
- **Natural language querying**: "Show me all NDIS providers in remote QLD that also receive justice funding" — translated to cross-system SQL via LLM
- **Predictive desert analysis**: ML models predicting which areas are likely to become funding deserts based on demographic trends, provider exits, and funding cycle patterns
- **Evidence synthesis**: LLM-powered summaries of what ALMA evidence says about specific program types, automatically linked to funding allocation recommendations
- **Board report generation**: Automated cross-system intelligence reports for foundation boards, government committees, and community organisations
- **Allocation scenario modelling**: "What happens to desert scores if we redirect 10% of detention spending to community programs in these 15 LGAs?"

### How does AI enhance the solution beyond what's possible without it?

Without AI, linking 158,000 entities across 8 systems with inconsistent naming, varying ABN coverage, and different geographic granularities would require an entire team of data analysts working full-time. Our AI entity resolution achieves 88.6% linkage rates in justice funding (up from 46%) — work that would take months manually. The proposed natural language querying and evidence synthesis would make the platform accessible to policy officers who don't write SQL, fundamentally changing who can use cross-system intelligence.

---

## 5. Government Partnership — Who is your government partner?

**[STATUS: Outreach in progress — need commitment by March 28]**

### Primary target: Queensland Department of Youth Justice

**Why QLD:**
- QLD spends $1.88B on youth detention vs $1.49B on community programs (ROGS 2024)
- QLD has the highest Indigenous over-representation in youth detention nationally
- CivicGraph already has deep QLD data: 21,739 entities, 4,130 community-controlled orgs, 487 ALMA-linked interventions
- The QLD Government has publicly committed to evidence-based justice reinvestment

**Partnership scope:** Pilot CivicGraph's allocation intelligence for youth justice funding decisions in 5-10 high-priority LGAs (e.g., Townsville, Cairns, Mount Isa, Palm Island). Government provides: letter of support, access to a policy team for user testing, commitment to evaluate the tool's impact on allocation decisions.

### Secondary targets:
- **NIAA** — Indigenous funding allocation nationally
- **DSS / NDIA** — NDIS thin market identification and provider development
- **OATSICC** — Aboriginal and Torres Strait Islander science and evidence infrastructure

### Government buy-in evidence:
- Platform is built on 100% public data — no data sharing agreements required
- Open-source — government can self-host if desired
- Already used informally by policy researchers and NGO grant-makers

---

## 6. Impact — What outcomes will you achieve?

### Measurable outcomes (24-month period)

| Metric | Baseline | Target | How measured |
|--------|----------|--------|-------------|
| Entities linked across systems | 158,000 | 250,000 | Database count |
| Government systems integrated | 8 | 12 | Add state procurement, health, education, housing |
| LGAs with desert analysis | 1,582 | 2,500+ | Include state-level funding data |
| Government users (monthly active) | 0 | 200 | Authentication analytics |
| Policy documents citing CivicGraph | 0 | 5 | Manual tracking |
| Funding reallocation influenced | $0 | $50M+ | Government partner reporting |
| Evidence-to-allocation linkages | 1,162 ALMA | 3,000+ | Database count (expand ALMA + add other evidence bases) |
| NDIS thin markets addressed | 31 critical LGAs identified | 15 LGAs with new providers | NDIS provider registry tracking |
| Open-source contributions | 1 contributor | 10+ | GitHub activity |

### Theory of change

```
Cross-system data linkage
       ↓
Funding desert identification + evidence matching
       ↓
Government officials see where money goes vs where need is
       ↓
Allocation decisions informed by cross-system intelligence
       ↓
More equitable distribution of public investment
       ↓
Better outcomes for disadvantaged communities
```

### Who benefits?

**Direct beneficiaries:**
- Government policy officers making allocation decisions (200+ target users)
- NGO grant-makers and community organisations understanding their funding landscape
- Researchers studying public investment equity

**Indirect beneficiaries:**
- First Nations communities in funding deserts (est. 500,000+ people in identified desert LGAs)
- NDIS participants in thin markets (31 critical LGAs)
- Young people in justice system receiving evidence-backed interventions

---

## 7. Feasibility — Can you execute this?

### Team

**Ben Knight (Founder/Engineer):** Full-stack developer with 15+ years experience. Built the entire CivicGraph platform (100K+ lines of code) in 4 months using AI-augmented development. Background in government technology and open data.

**With Google.org funding, the team would grow to:**
- 1x Data Engineering Lead (entity resolution, pipeline scaling)
- 1x Government Relations / Product Manager (user research, adoption)
- 1x AI/ML Engineer (predictive models, NLP querying)
- Part-time: Design, DevOps, Legal/compliance

### Technical infrastructure

| Component | Current | Status |
|-----------|---------|--------|
| Database | Supabase (PostgreSQL) | Production |
| Web app | Next.js 15, Tailwind 4 | Production |
| Data pipeline | 48 autonomous agents | Production |
| Entity resolution | ABN + fuzzy name matching | Production |
| Graph visualisation | react-force-graph-2d, 6 modes | Production |
| Hosting | Vercel + Supabase | Production |
| Open-source | GitHub (to be published) | Ready |

### Execution plan

**Months 1-3:** Government partner onboarding, user research, data expansion (add state procurement, housing, health datasets)

**Months 4-9:** Build NL querying, predictive desert models, allocation scenario tool. User testing with government partner.

**Months 10-15:** Scale to 3-5 government partners. Publish open-source. Knowledge-sharing with Centre for Public Impact network.

**Months 16-24:** Sustainability planning — government SaaS licensing, foundation funding for continued open development. International replication assessment (NZ, UK, Canada have similar data structures).

### Risks and mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Government partner doesn't engage | Medium | Multiple targets; tool works on public data regardless |
| Data quality issues | Medium | 48 automated agents with validation; manual review pipeline |
| AI hallucination in evidence synthesis | Low | Human-in-the-loop for all policy-facing outputs; source citation |
| Political sensitivity of cross-system findings | Medium | Focus on equity/access framing; partner with community organisations |

---

## 8. Scalability — How will this grow beyond Google.org support?

### Replication model

CivicGraph's architecture is designed for replication:

1. **Data model is generic** — the entity-relationship-evidence pattern works for any country with public procurement, charity registration, and funding data
2. **Agent pipeline is configurable** — new data sources added via agent configuration, not core code changes
3. **Open-source** — government and civil society organisations can self-host
4. **API-first** — third-party tools can build on CivicGraph data

### International replication targets

| Country | Similar public data available | Effort to replicate |
|---------|------------------------------|---------------------|
| New Zealand | Procurement, charities, iwi funding | Medium (6 months) |
| United Kingdom | Contracts Finder, Charity Commission, council spending | Medium (6 months) |
| Canada | Proactive Disclosure, CRA charities, Indigenous funding | Medium-High (9 months) |
| United States | USAspending, GuideStar/Candid, BIA tribal funding | High (12 months) |

### Sustainability plan

**Year 1-2 (Google.org funded):** Build platform, establish government partnerships, publish open-source
**Year 2-3:**
- Government SaaS licensing ($50-200K/year per jurisdiction)
- Foundation program funding for ongoing development
- University research partnerships (data access for academic research)
- Community-controlled organisations (free tier, always)

### Knowledge-sharing commitments

- Publish methodology as open-source documentation
- Present at Centre for Public Impact and Apolitical networks
- Annual "State of Cross-System Funding" report (public)
- Workshop series for government data teams on entity resolution and cross-system linkage

---

## 9. Budget Summary (USD $2.5M over 24 months)

| Category | Year 1 | Year 2 | Total |
|----------|--------|--------|-------|
| Personnel (4 FTE) | $600K | $600K | $1,200K |
| Cloud infrastructure (Supabase, Vercel, Google Cloud) | $80K | $120K | $200K |
| Data acquisition & licensing | $50K | $50K | $100K |
| AI/ML compute (model training, inference) | $100K | $150K | $250K |
| Government engagement (travel, workshops, events) | $75K | $75K | $150K |
| Open-source community development | $50K | $50K | $100K |
| Legal, compliance, accessibility audit | $75K | $25K | $100K |
| Research & evaluation (impact measurement) | $50K | $50K | $100K |
| Knowledge-sharing & replication toolkit | $25K | $75K | $100K |
| Contingency (8%) | $85K | $115K | $200K |
| **Total** | **$1,190K** | **$1,310K** | **$2,500K** |

---

## 10. Alignment with Google's AI Principles

CivicGraph aligns with Google's AI Principles:

1. **Be socially beneficial** — Cross-system transparency benefits communities that receive public funding, particularly disadvantaged and Indigenous communities
2. **Avoid creating or reinforcing unfair bias** — The platform reveals existing bias in funding allocation; it doesn't create new biases. Community-controlled perspective is centred.
3. **Be built and tested for safety** — All data is public. No personal data processed. Human-in-the-loop for all policy recommendations.
4. **Be accountable to people** — Open-source code. Transparent methodology. Community governance advisory.
5. **Incorporate privacy design principles** — Entity-level analysis only (organisations, not individuals). No PII collected.
6. **Uphold high standards of scientific excellence** — Evidence ratings from peer-reviewed ALMA database. Statistical rigour in desert scoring.
7. **Be made available for uses that accord with these principles** — Open-source. Free for community organisations. Government licensing model ensures accessibility.

---

## Supporting Materials to Attach

- [ ] Link to live platform: civicgraph.com.au/showcase
- [ ] Link to graph visualisation: civicgraph.com.au/graph
- [ ] Link to disability report: civicgraph.com.au/reports/disability
- [ ] Link to youth justice report: civicgraph.com.au/reports/youth-justice
- [ ] Government partner letter of support (pending)
- [ ] GitHub repository link (to be published)
- [ ] One-pager PDF (export from /showcase)
