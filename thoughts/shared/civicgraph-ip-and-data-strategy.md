# CivicGraph — IP, Trademark & Data Flow Strategy

**Date:** 2026-03-14
**Status:** LOCKED — foundational strategy document

---

## What CivicGraph Is

CivicGraph is **decision infrastructure for government and social sector**.

It connects public datasets that have never been connected before — procurement contracts, political donations, charity registries, tax transparency, youth justice interventions, and foundation giving — into a single entity graph that reveals who funds what, who contracts with whom, and whether it worked.

### The Numbers (as of 2026-03-14)

| Asset | Count | Value |
|-------|-------|-------|
| Entity graph | 138,580 organizations | The master spine |
| Relationships | 296,565 connections | Funding, contracting, board seats, donations |
| AusTender contracts | 670,919 | $834B total contract value |
| Political donations | 312,933 records | $21.9B total donations tracked |
| Justice funding | 64,847 records | $26.7B government→org funding flows |
| ALMA interventions | 1,155 programs | 40,110 outcome measurements |
| Foundations | 10,779 profiles | Giving patterns, thematic focus |
| NZ Charities | 45,192 | First international dataset |
| Unique suppliers | 45,792 | ABN-resolved AusTender suppliers |
| Crossover alerts | 89 | Donor-contractor intelligence |

### The Insight Layer

**Nobody else connects these dots:**

```
Political Donor (Multiplex, $2M to 36 political entities)
    ↕
Government Contractor (Multiplex, $122M Department of Finance contract)
    ↕
Charity Registry (ACNC profile, board members, financial returns)
    ↕
Youth Justice Intervention (BackTrack Youth Works, evidence-rated)
    ↕
Foundation Funder (Paul Ramsay Foundation, thematic alignment)
```

This cross-domain linkage is the product. The raw data is public. The graph is ours.

---

## Corporate Structure

```
A Curious Tractor Pty Ltd (parent company)
├── JusticeHub (project — youth justice data, ALMA interventions)
├── CivicGraph (product — the decision infrastructure platform)
│   ├── Procurement Intelligence
│   ├── Allocation Intelligence
│   └── Governed Proof
└── GrantScope (legacy repo name — being rebranded to CivicGraph)
```

### Attribution

- **"Powered by JusticeHub"** — appears on youth justice / ALMA data
- **"A Curious Tractor project"** — appears in footer / about page
- **"CivicGraph"** — the public product brand

---

## Trademark Strategy

### What to Trademark

| Mark | Class | Status | Priority |
|------|-------|--------|----------|
| **CivicGraph** | Class 42 (SaaS, data analytics) | FILE NOW | P0 |
| **CivicGraph** | Class 9 (software, databases) | FILE NOW | P0 |
| **"Decision Infrastructure"** | Class 42 | Consider | P1 |
| **ALMA** (Australian Living Map of Alternatives) | Class 42 | Consider | P2 |
| **JusticeHub** | Class 42 | Check availability | P2 |

### Filing Details (Australia)

- **Filing body:** IP Australia (ipaustralia.gov.au)
- **Cost:** ~$250 per class per mark (online filing)
- **Entity:** A Curious Tractor Pty Ltd
- **Classes to file:**
  - **Class 9:** Computer software; databases; downloadable data files
  - **Class 42:** Software as a service (SaaS); data analytics services; computer software design; database development; providing online non-downloadable software for data analysis

### Steps to File

1. **Search first:** Use IP Australia's ATMOSS search to check "CivicGraph" isn't taken
2. **File TM application** for "CivicGraph" in Classes 9 and 42 under A Curious Tractor Pty Ltd
3. **Use ™ immediately** — you can use ™ from the day you file, ® only after registration
4. **Consider .com.au** — secure civicgraph.com.au if not already held

### What's NOT Trademarkable

- The data itself (public government records)
- Generic terms like "entity graph" or "procurement intelligence"
- Government dataset names (AusTender, ACNC, etc.)

---

## Data Flow Architecture

### How Data Moves Through the System

```
PUBLIC DATA SOURCES                    CIVICGRAPH PIPELINE                      INTELLIGENCE LAYER
─────────────────                    ──────────────────                      ──────────────────

AusTender (OCID API)     ──┐
ACNC Charities Register  ──┤
ATO Tax Transparency     ──┤         ┌──────────────────┐
ORIC Corporations        ──┤────────▶│  48 Data Agents   │──────▶  gs_entities (138K)
Political Donations (AEC)──┤         │  (overnight runs) │         gs_relationships (296K)
Justice Funding (NIAA)   ──┤         │                   │         entity_identifiers (31K)
NZ Charities Register    ──┤         │  ETL + Normalize  │
ABR (ABN Lookup)         ──┘         │  + Deduplicate    │         ┌─────────────────────┐
                                     └──────────────────┘    ┌───▶│  Crossover Alerts    │
                                                             │    │  (donor + contractor) │
JusticeHub / ALMA        ──┐         ┌──────────────────┐    │    └─────────────────────┘
  1,155 interventions    ──┤────────▶│  Entity Linker    │────┤
  40,110 outcomes        ──┤         │  (fuzzy matching)  │    │    ┌─────────────────────┐
  570 evidence records   ──┘         └──────────────────┘    ├───▶│  Exposure API        │
                                                             │    │  (enterprise dossiers)│
Foundation Programs      ──┐         ┌──────────────────┐    │    └─────────────────────┘
  10,779 foundations     ──┤────────▶│  Alignment Scorer │────┤
  2,500 programs         ──┘         └──────────────────┘    │    ┌─────────────────────┐
                                                             └───▶│  Tier-Gated UI       │
                                                                  │  (5 subscription     │
                                                                  │   tiers, 8 modules)  │
                                                                  └─────────────────────┘
```

### The ABN Spine

**Everything connects through ABN (Australian Business Number).**

```
austender_contracts.supplier_abn ─────┐
political_donations.donor_abn ────────┤
justice_funding.recipient_abn ────────┤
ato_tax_transparency.abn ─────────────┼────▶ gs_entities.abn ────▶ gs_id
acnc_charities.abn ───────────────────┤
foundations.acnc_abn ─────────────────┤
entity_identifiers.identifier_value ──┘
```

For NZ, the equivalent spine is **NZBN (NZ Business Number)** → will connect NZ charities to NZ GETS contracts when that data is imported.

### What We Own vs. What's Public

| Layer | Public? | Ownable? | Why |
|-------|---------|----------|-----|
| Raw data (AusTender, ACNC, etc.) | Yes | No | Government open data |
| ETL pipelines (48 agents) | No | Yes | Our code, our logic |
| Entity resolution (ABN matching, dedup) | No | Yes | Our algorithms |
| Cross-domain linkage (donor↔contractor) | No | Yes | Nobody else does this |
| Scoring models (portfolio, evidence, authority) | No | Yes | Our methodology |
| Freshness (nightly agent runs) | No | Yes | Operational investment |
| NZ expansion (multi-country pattern) | No | Yes | Framework for scaling |
| ALMA interventions (JusticeHub) | Partly | Yes (curation) | We compiled & scored it |
| CivicGraph brand | No | Yes | Trademark it |

---

## Revenue Model vs. Data Flow

### Free Tier (Community)
- **Gets:** Basic grant search, entity lookup
- **Data exposed:** grant_opportunities (filtered), gs_entities (basic fields)
- **Purpose:** Builds awareness, captures leads

### Professional ($49/mo)
- **Gets:** Grant tracking, alerts, saved searches
- **Data exposed:** + grant matching, + deadline alerts
- **Purpose:** Individual fundraisers, small NFPs

### Organisation ($149/mo)
- **Gets:** Procurement workspace, entity dossiers, reporting
- **Data exposed:** + austender_contracts, + gs_relationships, + justice_funding
- **Purpose:** Medium orgs, procurement teams

### Funder ($349/mo)
- **Gets:** Foundation alignment, allocation intelligence, API access
- **Data exposed:** + foundations, + foundation_programs, + political_donations
- **Purpose:** Foundations, government funders, philanthropists

### Enterprise ($999/mo)
- **Gets:** Full API, supply chain, governed proof, custom exports
- **Data exposed:** Everything + ALMA interventions + crossover alerts
- **Purpose:** Government departments, large consultancies, media

---

## What Needs to Happen Next

### Immediate (This Week)
- [ ] IP Australia search for "CivicGraph" — confirm availability
- [ ] File TM application (Classes 9 + 42) under A Curious Tractor
- [ ] Add "CivicGraph™" branding to the platform UI
- [ ] Add "Powered by JusticeHub" to ALMA/intervention pages
- [ ] Add "A Curious Tractor project" to footer

### Short-term (This Month)
- [ ] Stripe integration — wire the 5 tiers to actual payments
- [ ] Run crossover agent on FULL history (not just 30 days) — will yield 1000+ alerts
- [ ] Push to 40%+ ALMA linkage with manual review of top 100 unmatched orgs
- [ ] Import NZ GETS contracts — complete the NZ data story
- [ ] Landing page refresh — lead with "We connected $834B in contracts to $21.9B in donations"

### Medium-term (This Quarter)
- [ ] First paying customer — target procurement officers, journalists, researchers
- [ ] API documentation page — make /api/v1/exposure self-service
- [ ] Weekly email digest — "Top 10 crossover alerts this week"
- [ ] PR: "New platform reveals links between political donors and government contractors"

---

## The Pitch (One Paragraph)

**CivicGraph** connects Australia's public data that has never been connected before. We link $834 billion in government contracts to $21.9 billion in political donations, cross-referenced with 138,580 organizations, 10,779 foundations, and 1,155 youth justice interventions with 40,110 measured outcomes. When Medibank wins a $2.9B Defence contract while donating to the ALP, CivicGraph surfaces it. When a community-controlled Aboriginal health service runs an evidence-rated intervention but can't find funding, CivicGraph connects them to aligned foundations. Powered by JusticeHub. A Curious Tractor project.

---

*This document is proprietary to A Curious Tractor Pty Ltd. Last updated 2026-03-14.*
