# Before You Commission the Next $10M Data Linkage Project

**A briefing for Chief Data Officers and Deputy Secretaries across Australian social services**

---

## The Problem You Already Know

Your department is about to commission another multi-million dollar engagement. A Big 4 firm will spend 12 months linking datasets you already hold, building dashboards you'll use for one budget cycle, and delivering a report that confirms what your frontline staff could have told you on day one: disadvantaged communities are underfunded, provider markets are concentrated, and the organisations closest to the problem are the furthest from the capital.

The consulting industry extracts $200M+ annually from the Australian social sector to perform data harmonisation, predictive modelling, procurement framework design, and program evaluation. Much of this work is rebuilt from scratch for each engagement because no standing, linked view of social sector funding flows exists outside government firewalls.

**What if that standing view already existed — built from public data, available now, at a fraction of the cost?**

---

## What's Already Linked

CivicGraph is a decision infrastructure platform that has spent two years ingesting, harmonising, and linking publicly available Australian data into a single entity graph. No ethics approval was required. No data custodian agreements. No 18-month pilot phase. The data is public. The linking is the value.

### The Asset

| Dataset | Records | What It Shows |
|---|---|---|
| **Linked entities** | 143,318 | Charities, government bodies, Indigenous orgs, social enterprises, suppliers — resolved to a single canonical identity with ABN, location, sector, and community-controlled status |
| **Funding relationships** | 301,642 | Who funds whom, how much, what year, from which program — across grants, contracts, and donations |
| **Federal contracts** | 754,130 | AusTender procurement records with buyer, supplier, value, duration — fully linked to the entity graph |
| **Political donations** | 312,933 | Donor-to-party flows linked to entity ABNs — showing who donates and who contracts |
| **Justice sector funding** | 64,560 | Program-level funding by state, recipient, and financial year across justice, diversion, and rehabilitation |
| **Registered charities** | 71,407 | ACNC registry with purposes, beneficiaries, financials, PBI/HPC status, and operating states |
| **Philanthropic foundations** | 10,779 | Giving capacity, thematic focus, geographic focus, grant size ranges, and openness scoring |
| **Active grant opportunities** | 18,000+ | Open programs with eligibility, deadlines, and amount ranges |
| **ALMA evidence base** | 1,155 interventions | The Australian Living Map of Alternatives — justice and social interventions with evidence type, methodology, outcomes, and cultural authority ratings |
| **Place-based indicators** | 12,000 postcodes | SEIFA disadvantage deciles, remoteness classification, LGA mapping, SA2 geography |

### What the Linking Reveals

This is not a collection of flat datasets. Every entity is resolved to a canonical identity and connected across systems:

```
ENTITY: "Wuchopperen Health Service" (GS-04821)
  ├─ ABN: 51 136 904 222
  ├─ Type: Aboriginal Community-Controlled Health Organisation
  ├─ Location: Cairns (QLD), Remote
  ├─ SEIFA: Decile 2
  │
  ├─ FUNDING RECEIVED
  │   ├─ $2.4M justice sector (2019-2024, 3 programs)
  │   ├─ $890K federal contracts (health, aged care)
  │   └─ Eligible for 12 open grant opportunities
  │
  ├─ POWER CONTEXT
  │   ├─ 3 foundations with thematic alignment
  │   ├─ NDIS provider market: 67% top-10 concentration in region
  │   └─ 2 community-controlled orgs within 50km
  │
  └─ EVIDENCE
      └─ Linked to 4 ALMA interventions (wraparound support, cultural connection)
```

**This view — entity identity + funding flows + place context + evidence linkage — is what governments pay $5-50M to build from scratch for each reform engagement.** CivicGraph maintains it as standing infrastructure.

---

## Three Questions This Answers Today

### 1. "Where are the funding gaps?"

CivicGraph's materialised views aggregate funding by postcode, LGA, and remoteness classification. We can show you:
- Which postcodes receive less than $100K total tracked funding despite high disadvantage (SEIFA decile 1-2)
- Which LGAs have zero community-controlled service providers
- Which NDIS service districts have provider markets where the top 10 providers capture >80% of payments

**This is the analysis your department commissions a $2-5M "Service System Mapping" engagement to produce.** We can generate it in under a minute from standing data.

### 2. "Who is already doing the work?"

When designing commissioning frameworks, procurement teams need to identify capable delivery partners — especially Aboriginal Community-Controlled Organisations. CivicGraph's entity graph identifies:
- 2,400+ entities flagged as community-controlled
- Operating location, sector, revenue size, and source dataset count for each
- Cross-referencing with contract history, charity registration, and funding relationships

**This is the supplier market analysis embedded in every $8-15M "Commissioning Framework Design" engagement.** The entity graph already has it.

### 3. "What evidence exists for this intervention?"

ALMA (Australian Living Map of Alternatives) contains 1,155 social and justice interventions with structured evidence metadata:
- Evidence type (RCT, quasi-experimental, program evaluation, community-led research)
- Methodology, sample size, and effect size where available
- Cultural authority ratings and target cohort alignment
- Linked to CivicGraph entities where the intervention is delivered by a known organisation

**This is the evidence synthesis that every program evaluation includes as a $500K-1M literature review.** It's already structured and queryable.

---

## What This Is NOT

We are direct about the boundaries:

- **Not person-level data.** CivicGraph uses only publicly available, aggregate data. We do not access, store, or link individual health, education, or justice records. PLIDA and the NDDA serve that function inside secure environments. CivicGraph is the complementary public layer.
- **Not predictive modelling.** We show what IS — where funding flows, where it doesn't, who delivers services, what evidence exists. We do not predict individual outcomes. The algorithmic bias risks documented in BOCSAR's XGBoost modelling reinforce why "what is" matters more than "what might be."
- **Not a replacement for frontline investment.** Better data does not substitute for adequate funding of community-controlled services, housing, mental health, and family violence response. CivicGraph helps direct that investment more intelligently — it does not replace it.

---

## The Commercial Case

| Engagement Type | Typical Big 4 Cost | CivicGraph Equivalent | Our Cost |
|---|---|---|---|
| Service system mapping | $2-5M | Funding gap analysis by postcode/LGA/remoteness | $50-100K/yr subscription |
| Commissioning framework supplier analysis | $1-3M (within larger engagement) | Entity graph with community-controlled status, contract history, capability indicators | Included |
| Evidence synthesis / literature review | $500K-1M | ALMA structured evidence base, queryable by intervention type, cohort, geography | Included |
| Data harmonisation (ETL, entity resolution) | $3-10M per engagement | Standing linked entity graph, continuously updated | Included |
| Executive dashboards | $500K-2M | API-first platform, embeddable in existing BI tools | Included |

**Standing infrastructure vs. bespoke engagements.** The data doesn't need to be re-linked every time a new minister asks a new question.

---

## Next Step

We propose a 4-week proof-of-value engagement with your department:

1. **Week 1:** You nominate a specific policy question (e.g., "Map the justice diversion funding landscape in Far North Queensland" or "Identify NDIS service gaps in remote NT communities")
2. **Week 2-3:** We produce the analysis using CivicGraph's existing linked data, delivered as an interactive dashboard and structured data export
3. **Week 4:** Joint review — compare what we delivered against the scope and cost of the last externally commissioned equivalent

**Cost: $0 for the proof-of-value.** We're confident the data speaks for itself.

---

*CivicGraph — Decision Infrastructure for Government & Social Sector*
*Know who to fund. Know who to contract. Know it worked.*

Contact: [ben@civicgraph.au]
