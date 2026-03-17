# CivicGraph — Product Vision & Revenue PRD

**Last updated:** 2026-03-17
**Status:** Active — this is the canonical product direction document
**Owner:** Ben Knight

---

## 1. What We Are

CivicGraph is **Decision Infrastructure for the Australian Government & Social Sector**.

We are the only platform that connects a charity's ABN to its government contracts, political donations, foundation grants, ALMA interventions, NDIS participation, and justice system funding in one place. **The product is the graph, not the data.**

### The Moat

```
UNIQUE TO US (DEFENSIBLE)                   PUBLIC DATA (NOT A MOAT)
─────────────────────────                   ────────────────────────
Entity graph (100K+ resolved entities)      AusTender contracts (public)
Cross-system relationships (199K+)          AEC political donations (public)
ALMA interventions + evidence (1.2K)        ACNC charity register (public)
Entity resolution across ALL datasets       GrantConnect (public)
Cross-system overlap intelligence
Place-based funding gap analysis
```

Anyone can scrape AusTender. Nobody else resolves entities across every dataset and shows you the full picture.

---

## 2. Who Pays (Customer Segments, Ranked by Revenue Potential)

### Segment 1: FUNDERS ($499-1,999/mo) — PRIMARY REVENUE TARGET

**Who:** Foundation program officers, government commissioners, philanthropic advisors
**Market size:** ~300 Australian foundations giving >$1M/year, plus state/federal program managers
**Willingness to pay:** HIGH (they have budgets, they need due diligence)
**Sales cycle:** 2-6 weeks (program officers make decisions, not committees)

**Jobs to be done:**
- "Show me every org working on youth justice in QLD, their funding, outcomes, and overlaps"
- "Which of my grantees also get government contracts? Are they double-dipping?"
- "Where are the geographic funding gaps in child protection?"
- "I need a due diligence brief on this org for my board paper"

**Why they switch from status quo:**
- Currently: manual Google searches, calling colleagues, reading annual reports
- CivicGraph: 30-second entity dossier with full funding history, relationships, evidence

### Segment 2: GOVERNMENT PROCUREMENT ($249-1,999/mo)

**Who:** Procurement officers, contract managers, social procurement leads
**Market size:** ~500 procurement teams across federal + state + local govt
**Willingness to pay:** MEDIUM-HIGH (budget exists but procurement cycles are slow)
**Sales cycle:** 3-6 months (government procurement of procurement tools is ironic)

**Jobs to be done:**
- "Who else delivers youth services in this region? What's their contract history?"
- "Generate a supplier assessment for this tender respondent"
- "Show me the market landscape for disability services in NT"

### Segment 3: ESTABLISHED NFPs/SEs ($79-249/mo)

**Who:** CEOs, grant writers, partnership managers at orgs with >$500K revenue
**Market size:** ~5,000 orgs in Australia above this threshold
**Willingness to pay:** LOW-MEDIUM (budgets are tight, many free alternatives for parts of this)
**Sales cycle:** 1-4 weeks

**Jobs to be done:**
- "Match me to grants I'm eligible for"
- "Track my grant pipeline (applied, submitted, acquitted)"
- "Show me who else works in my space — potential partners or competitors"

### Segment 4: COMMUNITY ORGS ($0 — free tier, cross-subsidised)

**Who:** Small charities, Indigenous corps, new social enterprises under $500K revenue
**Market size:** ~30,000+ orgs
**Willingness to pay:** NONE (and that's by design — cross-subsidy model)

**Jobs to be done:**
- "Find grants I can apply for"
- "Understand the funding landscape in my area"
- "Get help structuring my new org" (Founder Intake)

**Value to CivicGraph:** Network effects. More orgs on platform = better data = better product for funders.

---

## 3. Revenue Model

### Pricing Tiers (Live on /pricing, Stripe integrated)

| Tier | Price | Target | Key Unlock |
|------|-------|--------|------------|
| Community | $0 | Small orgs <$500K | Grant search, basic tracking, 1 user |
| Professional | $79/mo | Growing NFPs | AI grant matching, pipeline, 5 users |
| Organisation | $249/mo | Established orgs | Procurement intel, place packs, 25 users |
| Funder | $499/mo | Foundations, commissioners | Portfolio view, gap analysis, API, unlimited |
| Enterprise | $1,999/mo | State govt departments | Custom reports, dedicated support, SLA |

Annual discount: 17% (2 months free)

### Path to $500K ARR

```
SEGMENT              COUNT    PRICE        ANNUAL REVENUE
─────────────────    ─────    ─────────    ──────────────
Foundations          30       $499/mo      $179,640
Govt procurement     20       $249/mo      $59,760
Enterprise govt      5        $1,999/mo    $119,940
Professional NFPs    200      $79/mo       $189,600
Community (free)     2,000    $0           $0
                                           ──────────────
                              TOTAL:       $548,940
```

**Key insight:** We don't need 2,000 customers. We need 30 foundations at $499/mo and 5 government departments at $1,999/mo. That's 35 sales conversations.

---

## 4. Product Priorities (What to Build, What to Stop)

### P0 — SHIP THIS MONTH (Revenue-Enabling)

These are the features that convert the existing platform into something someone pays for.

#### 4.1 Due Diligence Pack (Entity PDF Export)
**The single most important feature we haven't built.**

A foundation program officer needs to attach a brief to a board paper. Today they spend hours Googling. We can generate it in 30 seconds.

**Contents:**
- Entity overview (name, ABN, type, size, location, ACNC status)
- Funding history (government grants, contracts, foundation grants — by year)
- Relationship map (who funds them, who they fund, political connections)
- Evidence alignment (ALMA interventions matched to their programs)
- Risk signals (donor-contractor overlap, compliance gaps)
- Geographic context (SEIFA decile, remoteness, local ecosystem)

**Output:** Branded PDF, downloadable from any entity dossier page.

**Gated by:** Organisation tier and above ($249/mo+)

**Files to create/modify:**
- `apps/web/src/app/entities/[gsId]/due-diligence-pack.tsx` — generation UI
- `apps/web/src/app/api/entities/[gsId]/due-diligence/route.ts` — PDF generation API
- `apps/web/src/lib/services/due-diligence-service.ts` — data assembly

#### 4.2 Email Capture on Public Reports
Every public report should have a soft gate: "Download the full PDF — enter your email."

This is our top-of-funnel. 20 reports, each getting organic traffic, each converting to an email list we can nurture toward paid tiers.

**Implementation:** Modal on "Download PDF" button, stores to `lead_captures` table, sends to email marketing tool.

#### 4.3 Funder Portfolio View ("My Grantees")
A saved collection of entities that a funder monitors. Shows:
- Aggregate funding flowing to their portfolio
- New contracts/grants their grantees received
- Risk alerts (compliance issues, political donation flags)
- Gap analysis (where their portfolio has no coverage)

**Gated by:** Funder tier ($499/mo+)

#### 4.4 Founder Intake → Account Conversion
The `/start` flow currently ends at a brief page. It should end with:
"Create a free CivicGraph account to save your brief, track grants, and get matched to funding."

This converts the intake funnel into registered users.

### P1 — NEXT 6 WEEKS (Retention & Expansion)

#### 4.5 Saved Searches & Watchlists
"Alert me when new grants match my criteria" or "Watch this entity for new contracts."
Drives daily active usage. Email digest (weekly).

#### 4.6 Custom Report Builder (Funder Tier)
"Show me all youth justice funding in QLD by LGA, with ALMA evidence overlay."
Parameterised version of our public reports. Funder-tier feature.

#### 4.7 Tender Intelligence Workflow
"Paste a tender URL → get a market intelligence brief."
Specific workflow for procurement officers. Organisation-tier feature.

### P2 — NEXT QUARTER (Platform)

#### 4.8 API Access (Enterprise Tier)
RESTful API for entity lookup, relationship queries, funding data.
Enterprise customers integrate CivicGraph into their own systems.

#### 4.9 Governed Proof (New Product Line)
Outcomes tracking + evidence validation. Currently "Coming Soon" on pricing.
This is a separate product that deserves its own PRD when we're ready.

#### 4.10 Board Report Generation
Automated quarterly board reports for NFPs using their org dashboard data.
Organisation-tier feature.

### STOP / DEPRIORITISE

| Feature | Status | Decision | Rationale |
|---------|--------|----------|-----------|
| Journey Builder polish | Just built | PAUSE | Beautiful but pre-revenue. Revisit after first paying customer. |
| More public reports | 20 exist | PAUSE | Enough proof-of-concept. Focus on converting existing traffic. |
| New data pipelines | 48 agents | PAUSE | Data moat is sufficient. Polish what we have. |
| Crime data expansion | Recently added | STOP | Impressive but not what funders pay for directly. |
| Hardening/refactoring | Ongoing | MINIMAL | Only fix things that block revenue features. |
| Founder Intake AI improvements | Just built | PAUSE | Works well enough. Add account conversion, then move on. |

---

## 5. Go-to-Market

### Phase 1: Prove It (Weeks 1-4)

**Goal:** 3 paying customers

1. **Pick 10 foundations** that fund youth justice or child protection in QLD/NSW
2. **Generate a Due Diligence Pack** for one of their current grantees (using our data)
3. **Email the program officer:** "We built this about [Org X]. Thought you'd find it useful. Here's what CivicGraph can do for your whole portfolio."
4. **Offer:** 30-day free trial of Funder tier, then $499/mo

**Why this works:** We're not selling a platform. We're sending them something immediately useful and saying "want more?"

### Phase 2: Systematise (Weeks 5-8)

- Email capture on all 20 public reports → nurture sequence
- Founder Intake → account creation funnel
- First case study from Phase 1 customers
- LinkedIn content from report insights (we have 20 reports of ammunition)

### Phase 3: Scale (Weeks 9-16)

- Government procurement pilot (1 state government department)
- Conference presence (ACOSS, Philanthropy Australia, AIATSIS)
- API beta for Enterprise tier
- Referral program (existing customers introduce peers)

---

## 6. Success Metrics

### North Star: Monthly Recurring Revenue (MRR)

| Milestone | Target | Timeline |
|-----------|--------|----------|
| First paying customer | $499 MRR | Week 4 |
| 10 paying customers | $3,000 MRR | Week 8 |
| 50 paying customers | $15,000 MRR | Week 16 |
| $500K ARR run rate | $42,000 MRR | Month 12 |

### Leading Indicators

| Metric | Measures | Target |
|--------|----------|--------|
| Due Diligence Packs generated | Product-market fit signal | 50/week |
| Email captures from reports | Top-of-funnel health | 100/week |
| Entity dossier page views | Discovery usage | 500/week |
| Founder Intake completions | Future customer pipeline | 20/week |
| Org dashboard WAU | Retention | 60% of registered orgs |

### Lagging Indicators

| Metric | Target |
|--------|--------|
| Churn rate | <5% monthly |
| Net revenue retention | >110% |
| CAC payback | <3 months |
| LTV:CAC ratio | >3:1 |

---

## 7. What Already Exists (Build Inventory)

### Ready to Monetise (Needs Packaging, Not Building)

```
FEATURE                           STATUS          MONETISATION GAP
────────────────────────────────  ──────────────  ──────────────────────────
Entity dossier pages              ✅ Live          Needs PDF export (P0)
20 public reports                 ✅ Live          Needs email gate (P0)
Grant search (18K grants)         ✅ Live          Needs tier gating refinement
Foundation directory (10.8K)      ✅ Live          Already useful, needs alerts
Pricing page + Stripe checkout    ✅ Live          Ready to take money
Subscription middleware           ✅ Live          Module gating implemented
Org dashboard                     ✅ Live          Needs onboarding flow
Pipeline tracker                  ✅ Live          Needs polish, already gated
Founder Intake (/start)           ✅ Live          Needs account conversion (P0)
ALMA evidence matching            ✅ Live          Unique differentiator
Cross-system heatmaps             ✅ Live          Proof-of-concept for funders
```

### Needs Building (P0 Revenue Blockers)

```
FEATURE                           EFFORT    REVENUE IMPACT
────────────────────────────────  ────────  ──────────────
Due Diligence Pack (PDF export)   1 week    CRITICAL — first paid feature
Email capture on reports          2 days    HIGH — top-of-funnel
Funder Portfolio view             1 week    HIGH — funder retention
Intake → account conversion       2 days    MEDIUM — user acquisition
Saved searches / watchlists       1 week    MEDIUM — DAU driver
```

---

## 8. Technical Architecture for Revenue Features

### Due Diligence Pack Data Flow

```
  USER clicks "Generate Pack"
       │
       ▼
  ┌─────────────────────┐
  │  due-diligence API   │
  │  /api/entities/[id]/ │
  │  due-diligence       │
  └──────────┬──────────┘
             │
       ┌─────┴──────┐
       ▼             ▼
  ┌─────────┐  ┌──────────┐
  │ Entity  │  │ Parallel  │
  │ lookup  │  │ queries   │
  │ (ABN)   │  │           │
  └────┬────┘  └─────┬─────┘
       │             │
       │    ┌────────┼────────┬──────────┬──────────┐
       │    ▼        ▼        ▼          ▼          ▼
       │  funding  contracts  donations  ALMA     local
       │  history  history    history    matches  ecosystem
       │    │        │          │          │         │
       └────┴────────┴──────────┴──────────┴─────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Assemble into   │
                    │  structured JSON  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐     ┌──────────┐
              │ On-screen │     │   PDF     │
              │ preview   │     │ download  │
              └──────────┘     └──────────┘
```

### Email Capture Flow

```
  VISITOR reads public report
       │
       ▼
  Clicks "Download Full PDF"
       │
       ▼
  ┌─────────────────────┐
  │  Email capture modal  │
  │  (name, email, org)   │
  └──────────┬──────────┘
             │
       ┌─────┴──────┐
       ▼             ▼
  ┌─────────┐  ┌──────────┐
  │ Store   │  │ Generate  │
  │ lead    │  │ PDF &     │
  │ capture │  │ download  │
  └─────────┘  └──────────┘
       │
       ▼
  Nurture email sequence
  (7-day drip → trial offer)
```

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Foundations won't pay for data they can Google | MEDIUM | HIGH | Due Diligence Pack must be 10x faster than manual. Demo with THEIR grantees. |
| Government sales cycle kills momentum | HIGH | MEDIUM | Start with foundations (faster). Govt is Phase 3. |
| Free tier cannibalises paid | LOW | MEDIUM | Module gating already exists. Key features (PDF, portfolio, API) are tier-locked. |
| Data freshness degrades trust | MEDIUM | HIGH | Agent pipeline exists (48 agents). Run monthly refresh cycle minimum. |
| Single-person dependency | HIGH | HIGH | This PRD + codebase docs + CLAUDE.md reduce bus factor. |
| Competitor copies the graph | LOW | LOW | 2+ years of entity resolution work. Hard to replicate. |

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-17 | Funders are primary revenue target, not NFPs | Highest willingness to pay, shortest sales cycle, strongest data moat alignment |
| 2026-03-17 | Due Diligence Pack is P0 feature #1 | First thing someone will pay for — attaches to existing workflow (board papers) |
| 2026-03-17 | Pause Journey Builder, Founder Intake polish, new reports | Pre-revenue features. Resume after first paying customer. |
| 2026-03-17 | Cross-subsidy model confirmed | Community orgs free, funders/govt pay. Network effects justify free tier. |
| 2026-03-17 | PDF export is the monetisation unlock | Funders need artifacts they can attach to existing processes, not another dashboard to log into. |

---

*This document is the source of truth for what we build next and why. Every feature decision should trace back to a section in this PRD. If it doesn't serve the revenue path, it waits.*
