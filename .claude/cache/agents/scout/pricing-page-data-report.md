# GrantScope Pricing Page Data Report
**Generated:** 2026-03-06
**Scout Agent Report**

---

## Executive Summary

GrantScope isn't just another grants database. It's Australia's missing 360Giving infrastructure — the **only** platform tracing money from extraction (mining, finance) through foundations to community impact. The pricing page needs to reflect this power.

**What nobody else has:**
- 359,678 ACNC charity financial records (7 years)
- $222 billion in sector revenue mapped
- 9,874 foundations profiled (1,627 AI-enriched)
- 14,119 grants (100% embedded for semantic search)
- Full power dynamics transparency: who controls Australia's philanthropy

---

## The Core Mission (Use This Framing)

From `/thoughts/plans/data-model.md`:

> **"Level the playing field. Community-based organisations that value relationship and cultural understanding should have equal access to funding. Trace money from extraction (mining, finance) through foundations to community impact. Make the invisible visible."**

Australia was built on colonisation. Money made from mining. Families that built wealth by extracting from land now control who gets funded. GrantScope changes that.

**The Vision:** Australia's 360Giving. The UK has 320+ funders publishing 1M+ grants in machine-readable format. Australia has GrantConnect (government only), Foundation Maps (members-only, $$$), and Funding Centre ($55-85/year). GrantScope is open infrastructure.

---

## Powerful Statistics (Homepage & Reports)

### The Concentration Problem

From `/apps/web/src/app/page.tsx` (homepage):

- **94%** of charitable donations go to just **10% of organisations**
- First Nations communities receive **0.5%** of philanthropic funding (they're 3.8% of population)
- Women and girls get **12%** of direct grant funding (they're 51% of population)
- The 16,000 smallest charities posted a collective net loss of **-$144 million** last year

### Big Philanthropy ($222 Billion Report)

From `/apps/web/src/app/reports/big-philanthropy/page.tsx`:

**The Scale:**
- **$222 billion** total charity sector revenue (2023)
- **$494 billion** in assets held
- **$11.3 billion** distributed as grants (only 2.3% of revenue)
- **359,678** ACNC records analyzed (2017-2023)
- **53,207** charities tracked

**The Concentration:**
- Top 10% of charities captured **90.3%** of all donation dollars (up from 86.7% in 2017)
- Gini coefficient for Australian charitable giving: **0.96** (higher than the most unequal economy on earth — South Africa is 0.63)
- **1.1 million fewer Australians** donate $2+ per year compared to 2016

**Foundation Scorecard (Real Names, Real Numbers):**

| Foundation | Grants (2023) | Assets | Giving Ratio | KMP Pay | Grade |
|------------|--------------|--------|--------------|---------|-------|
| Paul Ramsay Foundation | $184M | $3.0B | 176% | $1.7M | A+ |
| Ian Potter Foundation | $46M | $888M | 112% | $0 | A |
| Snow Medical Research | $35M | $421M | 295% | $0 | A+ |
| Pratt Foundation | $21M | $21M | 100%+ | $0 | A+ |
| Myer Foundation | $8M | $333M | 57% | $1.1M | B |
| **Minderoo Foundation** | $156M | **$7.6B** | **3.1%** | **$3.4M** | **D** |
| **Lowy Foundation** | **$0** | **$76M** | **0%** | **$1.5M** | **F** |

**The Executive Pay Problem:**
- **89%** of charities with KMP data paid executives MORE than they distributed in grants
- Total sector-wide executive compensation: **$3.75 billion**

### Community Parity Report

From `/apps/web/src/app/reports/community-parity/page.tsx`:

**Who Misses Out:**
- First Nations: **0.5%** of funding / 3.8% of population (8.6-year life expectancy gap)
- Women & girls: **12%** of funding / 51% of population
- Grassroots orgs: **6%** of funding (they're the primary service delivery for marginalized communities)

**Tax Structures:**
- Private Ancillary Funds + Public Ancillary Funds: **$10.2 billion** contributed, only **$4.65 billion** distributed
- For every dollar contributed, only **46 cents** has been distributed. The rest grows the fund.
- Tax-deductible giving costs the federal budget **$2.5 billion/year** in foregone revenue
- **82%** of the tax benefit flows to the **top income decile**

**Reputation Cleansing:**
- Corporate philanthropy worth **$1.8 billion** annually
- **$1.1 billion** comes from ethically dubious sources (fossil fuel, gambling, mining companies)
- Minerals Council of Australia members gave ~**$450 million** in 2022-23

**Political Influence:**
- **35%** of political donations above threshold remain undisclosed (loopholes)
- Australia's disclosure threshold: **$16,900** (Canada: $200, UK: $0)
- **44%+** of wealth held by top 10% (inheritance tax abolished 1979)

### Youth Justice Report (Queensland)

From `/apps/web/src/app/reports/youth-justice/page.tsx`:

- **$343M/year** on detention for ~280 children
- **$1.3M per child** in detention
- **73%** reoffend within 12 months
- Community programs cost **$12K per child** with **42%** reoffending
- **Cost ratio: 108x** (detention vs community programs)

### Geographic Distortion

From `WHY.md`:

| State | Average Donation Claim | Median Claim | Total Claimed |
|-------|----------------------:|------------:|--------------:|
| WA | $11,534 | $120 | $5.49B |
| NSW | $1,063 | $170 | $1.49B |
| VIC | $968 | $130 | $1.21B |
| QLD | $660 | $120 | $0.55B |

WA's average is **10x higher than QLD's** — driven by mining wealth mega-donations. The median? Nearly identical ($120). A tiny number of extractive-industry billionaires distort the entire picture.

---

## What GrantScope Offers (Current State)

From `/thoughts/plans/360giving-australia.md`:

### Data Assets

| Dataset | Count | Coverage |
|---------|------:|----------|
| **Grants** | 14,119 | 100% embedded for semantic search |
| **Foundations** | 9,874 | All ACNC-registered foundations |
| **AI-Enriched Foundations** | 1,627 | Giving philosophy, application tips, board members |
| **Foundation Programs** | 866 | Open funding programs from 361 foundations |
| **ACNC Annual Statements** | 359,678 | 7 years (2017-2023), full financials |
| **Community Orgs** | 500 | Enriched profiles (growing to 2,000) |
| **VIP Foundations** | 46 | AFR Philanthropy 50, Forbes Corporate 50 verified data |

### Grant Sources (Live Data)

From homepage:
- **10+ government portals:** GrantConnect (federal), QLD, NSW, VIC, WA, SA, TAS, ACT, NT
- **data.gov.au:** 30 datasets
- **Research bodies:** ARC (5,598 grants), NHMRC (18 grants)
- **State-level:** Brisbane City Council (5,529), QLD Arts (2,319)
- **14,119 grants total** from **24+ sources**, updated daily

### Foundation Intelligence

From `/thoughts/plans/360giving-australia.md`:

**1,627 foundations enriched with:**
- Giving philosophy
- Application tips
- Board members
- Thematic focus (arts, environment, health, indigenous, education, etc.)
- Geographic coverage
- Open programs
- Funding amounts
- Contact details

**Multi-provider LLM profiler** (Gemini, DeepSeek, Kimi, Groq, Minimax, OpenAI, Perplexity, Anthropic) auto-rotates on quota/rate errors. This is **unique infrastructure**.

### Search Capabilities

- **Semantic search:** Natural language queries ("Find grants for First Nations arts in QLD")
- **Hybrid search:** Auto-detect keyword vs semantic
- **100% embedding coverage** on grants (pgvector, text-embedding-3-small)
- **Category filtering:** Arts, community, technology, regenerative, enterprise, health, education, indigenous, justice, sport, research
- **Geographic filtering:** All 8 states + territories
- **Amount filtering:** Min/max grant amounts

---

## What's Different from Competitors

### vs GrantConnect (Government)
- **They have:** Federal government grants only
- **We have:** Federal + all 8 states + foundations + corporate + research funding
- **Our edge:** AI-powered semantic search, foundation intelligence, power dynamics transparency

### vs Foundation Maps (Members-only, $$$)
- **They have:** Foundation directory (members-only access)
- **We have:** 9,874 foundations, 1,627 AI-enriched, **completely free**
- **Our edge:** ACNC financial data (7 years), giving ratios, KMP pay, scorecard grades, power analysis

### vs Funding Centre ($55-85/year)
- **They have:** Grants database (paywall)
- **We have:** Same grants + foundations + ACNC data + reports — **free**
- **Our edge:** Living reports, power dynamics mapping, money flow tracing (mining → foundations → communities)

### The Moat (From `/thoughts/plans/360giving-australia.md`)

1. **ACNC + Financial Data:** 360k records, 7 years of giving history — no other platform has this depth
2. **Foundation Profiles:** AI-enriched with giving philosophy, application tips, board members — unique intel
3. **Comprehensiveness:** Government + foundation + corporate + research in one searchable index
4. **Semantic Search:** Natural language queries across all funding sources
5. **Open:** Free to search, moving toward open data standard
6. **Living Data:** Automated discovery, enrichment, freshness checks

---

## Value Props by User Type

### For Community Organisations

From `/apps/web/src/app/for/community/page.tsx`:

**Current stats (live):**
- 6,271 open grants
- 9,874 foundations mapped
- 1,627 foundations profiled with AI-generated intel

**What they get:**
- AI-powered semantic search ("describe what you do" → find matching grants)
- Track applications (save grants, add notes, never miss a deadline)
- Learn the landscape (who funds work like yours)
- Foundation intelligence (giving philosophy, application tips, what they care about)

**Pain solved:** No more checking 15 different government websites. No more guessing which foundations fund your work. No more $10k grant writers.

### For Foundations

From `/apps/web/src/app/for/foundations/page.tsx`:

**Current stats (live):**
- 9,874 foundations mapped
- 1,627 AI-profiled
- 866 programs
- $[calculated total giving tracked]

**What they get:**
- Peer comparison (how your focus, reach, and giving levels compare)
- Gap analysis (identify underfunded sectors, geographies, beneficiary groups)
- Transparency (claim your profile, tell your story, show what you fund and why)

**Pain solved:** "Is our giving aligned with sector needs?" "Where are the gaps?" "How do we compare to peers?"

### For Researchers

From `/apps/web/src/app/for/researchers/page.tsx`:

**Current stats (live):**
- 359,678 ACNC financial records
- 14,119 grants
- 24+ data sources
- 7 years of history
- 100% open access

**What they get:**
- Living reports (data-driven investigations updated as new data arrives)
- Full transparency (every number traceable, every methodology documented)
- Build in public (see our pipeline, gaps, methodology — fork it, extend it)

**Pain solved:** "Where's the public data on Australian philanthropy?" "How do I analyze power dynamics?" "What's the relationship between tax subsidies and giving patterns?"

---

## Pricing Page Narrative Structure

Based on this data, the pricing page should tell this story:

### 1. The Problem (Concentration + Invisibility)

**Headline:** "94% of charitable donations go to 10% of organisations. First Nations communities get 0.5%. Women and girls get 12%. The 16,000 smallest charities lost $144 million last year."

**Sub:** "The system is broken. But the data to fix it exists — scattered across ACNC returns, government portals, foundation websites. GrantScope assembles it into one place. For free."

### 2. The Mission (Level the Playing Field)

**Headline:** "Australia's 360Giving — Open Grants Infrastructure"

**Sub:** "Community-based organisations that value relationship and cultural understanding should have equal access to funding. We trace money from extraction (mining, finance) through foundations to community impact. Make the invisible visible."

### 3. What You Get (The Moat)

**Three tiers, but the core value is the same:**

**Free Tier:**
- 14,119 grants (100% embedded, semantic search)
- 9,874 foundations (1,627 AI-profiled)
- 359,678 ACNC records
- Living reports (Big Philanthropy, Community Parity, Power Dynamics)
- Open access, no paywall

**Researcher Tier (maybe $0 or "cite us"):**
- Everything in Free
- API access
- Bulk data export
- Methodology docs
- Collaboration opportunities

**Foundation/Organisation Tier ($? or "claim your profile"):**
- Everything in Free + Researcher
- Claim your foundation profile
- Add programs, impact data, application tips
- Get matched with aligned community orgs
- Peer benchmarking dashboard

### 4. The Numbers (Social Proof)

Use homepage stats:
- 14,119 grants tracked
- 9,874 foundations
- 359,678 ACNC records
- 24+ data sources
- $222B sector revenue mapped
- 100% open access

### 5. The Differentiator (Power Transparency)

**What nobody else shows:**
- Foundation scorecards (A+ to F based on giving ratio vs KMP pay)
- Money flow tracing (mining company → foundation → community)
- Tax subsidy analysis ($2.5B/year foregone revenue, 82% to top 10%)
- Political influence mapping (who sits on boards, who lobbies, who donates)

### 6. The Outcome (For Each Persona)

**Community orgs:** Find funding you didn't know existed. Stop competing for the same 10 foundations everyone knows about.

**Foundations:** Identify gaps. Compare to peers. Prove impact with data.

**Researchers:** Analyze power dynamics. Trace funding flows. Advocate with evidence, not anecdote.

---

## Killer Quotes to Use

From `WHY.md` and reports:

1. **On concentration:** "The Gini coefficient for Australian charitable giving is 0.96 — higher than the most unequal economy on earth."

2. **On tax advantage:** "For every dollar contributed to tax-advantaged philanthropic vehicles, only 46 cents has been distributed. The rest grows the fund — not the community."

3. **On executive pay:** "89% of charities with KMP data paid their executives more than they gave in grants. Total sector-wide executive compensation: $3.75 billion."

4. **On scale:** "Australia's charity sector reported $222 billion in revenue in 2023 — more than the GDP of New Zealand. They held $494 billion in assets. Only $11.3 billion flowed out as grants."

5. **On invisibility:** "There is no single official 'total philanthropy' figure in Australia that avoids double-counting. This isn't just a measurement problem — it's a power problem."

6. **On geographic distortion:** "Western Australia's average donation claim was $11,534 — ten times higher than Queensland's $660. But the median in WA was just $120. A tiny number of mining-wealth mega-donations distort the entire picture."

7. **On mission:** "Community organisations receiving grants from extractive companies often have no alternative funding source, creating a dependency on the very companies causing harm."

8. **On the alternative:** "The alternative exists. Community-led models that build genuine economic power — cooperatives, community energy, social enterprise, timebanking — are already working in Australia. They just need to be visible."

---

## Technical Differentiators (For "How It Works")

From codebase:

- **Multi-provider LLM profiling:** 8 providers (Gemini grounded, DeepSeek, Kimi, Groq, Minimax, OpenAI, Perplexity, Anthropic) with auto-rotation on quota/rate errors
- **100% embedding coverage:** pgvector + HNSW, text-embedding-3-small (1536 dims)
- **Hybrid search:** Auto-detect keyword vs semantic queries
- **Live data:** Automated discovery from 24+ sources, daily updates
- **Open source:** MIT license, full transparency
- **Operating cost:** ~$6/month (Supabase, Firecrawl, LLM APIs)

---

## Gaps to Acknowledge (Builds Trust)

From `/thoughts/plans/360giving-australia.md`:

**Current gaps (Phase 2 priorities):**

1. **Grant descriptions are thin** — 44% have no description, 43% have stubs. Semantic search quality suffers. (Fix: Cheerio + Groq pipeline to crawl URLs and extract descriptions)

2. **Only 16.5% of foundations enriched** — 3,304 have websites but haven't been profiled yet. (Fix: Run existing profiler in batches)

3. **Foundation programs not in main search** — 866 programs exist but don't appear in grant search results. (Fix: Sync foundation_programs → grant_opportunities or unify search)

4. **No org self-registration yet** — Community orgs can't create profiles and get matched. (Fix: Phase 2 Track B — org registration + matching engine)

5. **Corporate layer incomplete** — Can't fully trace BHP's $13B profit → BHP Foundation → Yawuru community yet. (Fix: Phase 2 Track C — corporate entities table + wealth flows)

**Acknowledging these gaps = credibility.** "We're building in public. Here's what works, here's what's next."

---

## Pricing Page CTAs

1. **Search Grants Now** → `/grants`
2. **Explore Foundations** → `/foundations`
3. **Read the $222B Report** → `/reports/big-philanthropy`
4. **View Community Parity Report** → `/reports/community-parity`
5. **See the Dashboard** → `/dashboard`
6. **Claim Your Foundation Profile** → `/charities/claim` (if building this)
7. **API Access (Researchers)** → `/api` or contact form
8. **Contribute to the Project** → GitHub link

---

## Final Recommendation

**Don't undersell this.** GrantScope has:

- The **only** comprehensive ACNC financial database (359k records, 7 years)
- The **only** AI-enriched foundation directory in Australia (1,627 profiled)
- The **only** platform tracing money from mining/finance → foundations → communities
- The **only** open-source, free-to-use grants infrastructure

**The pricing page should reflect the power, the mission, and the moat.**

Use the **real numbers** (94%, 0.5%, 12%, $222B, 359,678 records).
Use the **real foundation names** (Minderoo 3.1% giving ratio with $3.4M KMP pay).
Use the **real mission** (level the playing field, make extraction visible, community power).

The story is already there in the codebase. Just surface it.

---

**Files Referenced:**
- `/Users/benknight/Code/grantscope/apps/web/src/app/page.tsx`
- `/Users/benknight/Code/grantscope/WHY.md`
- `/Users/benknight/Code/grantscope/README.md`
- `/Users/benknight/Code/grantscope/thoughts/plans/360giving-australia.md`
- `/Users/benknight/Code/grantscope/thoughts/plans/data-model.md`
- `/Users/benknight/Code/grantscope/thoughts/plans/prd-phase-2.md`
- `/Users/benknight/Code/grantscope/apps/web/src/app/for/community/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/for/foundations/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/for/researchers/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/reports/community-parity/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/reports/big-philanthropy/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/reports/youth-justice/page.tsx`
- `/Users/benknight/Code/grantscope/apps/web/src/app/dashboard/page.tsx`
