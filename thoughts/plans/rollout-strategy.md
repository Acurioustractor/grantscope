# CivicGraph Rollout Strategy
**Date:** 2026-03-08
**Status:** Ready for execution

---

## What We Built (Full Inventory)

### The Platform
| Metric | Count |
|--------|------:|
| Total entities in graph | 100,036 |
| Relationships mapped | 211,783 |
| Grant opportunities | 18,069 |
| Grants with AI embeddings | 18,069 (100%) |
| Foundations profiled | 10,779 |
| Foundations AI-enriched | 3,264 (30%) |
| Foundation programs | 2,472 |
| ACNC charity records | 359,678 |
| Social enterprises | 10,339 |
| Community orgs | 541 |
| Donor-contractors identified | 140 |
| Political donation records | 312,933 |
| Government contracts | 670,303 |
| ATO tax transparency | 26,241 |
| Justice funding records | 52,133 |
| ASIC company lookup | 2,149,868 |
| Entity resolution F1 | 94.1% |
| Entity coverage (postcode) | 90% |
| Entity coverage (remoteness) | 96% |
| Analytical reports | 15 live |
| Pages | 70 |
| API routes | 77 |
| Data pipeline scripts | 86 |

### What Users Can Do Today
1. **Search 18,069 grants** — keyword + AI semantic search, filter by state/amount/category/closing date
2. **Browse 10,779 foundations** — AI profiles, giving data, programs, ACNC financials
3. **Search 64,000+ charities** — full ACNC register with financial history
4. **Explore 100,000+ entities** — unified graph linking donations, contracts, grants, tax, justice funding
5. **Read 15 investigations** — donor-contractors, funding equity, power dynamics, community parity
6. **Save & track grants** — personal + team view, pipeline stages, notes, star ratings
7. **Track foundations** — CRM for funder relationships
8. **AI chat assistant** — RAG-powered grant discovery (Claude Haiku + pgvector)
9. **Knowledge Wiki** — upload documents (PDF, DOCX, URLs), AI-powered org Q&A
10. **Claim charity profiles** — verification flow for charity staff
11. **Team collaboration** — invite members, shared trackers, org-level views
12. **Place-based analysis** — postcode funding profiles, SEIFA disadvantage, remoteness
13. **Entity dossiers** — full ABN X-Ray with donations, contracts, tax, justice funding, location intelligence
14. **Tender intelligence** — AI-analysed procurement opportunities matching org profile
15. **Grant pipeline** — Notion-synced grant tracking with stage management
16. **Alert system** — email alerts for new matching grants and entity changes

### Pricing (Live on Stripe)
| Tier | Monthly | Who It's For |
|------|--------:|-------------|
| Community | $0 | Grassroots NFPs, First Nations orgs, CLCs <$500K |
| Professional | $79 | Established NFPs, social enterprises |
| Organisation | $249 | Larger NFPs, peak bodies, multi-program orgs |
| Funder | $499 | Foundations, corporate giving, philanthropic advisors |
| Enterprise | $1,999 | Government, large foundations, sector-wide deployments |

### Current Users
- **1 profile** (us), **12 saved grants**, **4 saved foundations**
- Zero paying customers yet
- Zero external users yet

---

## Why We Built This

### The Thesis (Say This Every Time)

> Australia moves $18.9B in charitable donations annually. 94% goes to 10% of organisations. First Nations communities get 0.5%. There is no single place to see who funds what, where, and how much. We built that place.

### The Proof (Say This Second)

> We cross-referenced AEC political donations with AusTender government contracts by ABN. 140 entities donate $80M to 28 political parties AND hold $4.7B in government contracts. That's a 58x return per dollar donated. Both sides benefit. This is structural, not partisan.

### The Product (Say This Third)

> 100,000 entities. 211,000 relationships. 18,069 grants. 10,779 foundations. 670,000 government contracts. 313,000 political donations. 26,000 tax transparency records. 52,000 justice funding records. 10,000 social enterprises. AI-powered search. Free for communities. The data infrastructure Australia never had.

---

## Who Pays (Ranked by Revenue Potential)

### Tier 1: Enterprise ($20-100K/yr) — Government + Peak Bodies
**Who:** State/federal departments (NIAA, DSS, DCCEEW), peak bodies (Philanthropy Australia, ACOSS, QCOSS)
**Why they pay:** Closing the Gap reporting, grant program evaluation, sector analysis
**How to reach:** Direct outreach, conference presentations, FOI-adjacent positioning
**Timeline:** 6-12 months (procurement cycles)

### Tier 2: Funder ($5-12K/yr) — Foundations + Corporate Giving
**Who:** Program officers at PAFs, PuAFs, corporate foundations (100+ in Australia)
**Why they pay:** See where peers fund, identify gaps, due diligence on grantees, compliance
**How to reach:** Philanthropy Australia Conference (Brisbane, Sep 8-10 2026), AEGN, CFA
**Timeline:** 3-6 months

### Tier 3: Professional ($1-3K/yr) — Grant Consultants + Researchers
**Who:** The 200-500 professional grant writers in Australia, university researchers
**Why they pay:** Find grants faster, track foundations, AI-assisted applications
**How to reach:** F&P Conference, LinkedIn, grant writing Facebook groups, university partnerships
**Timeline:** 1-3 months (fastest to convert)

### Tier 4: Organisation ($3K/yr) — Established NFPs
**Who:** NFPs with $500K-5M revenue, multiple grant applications per year
**Why they pay:** Team tracker, shared pipeline, foundation CRM, match scoring
**How to reach:** ACOSS network, state council newsletters, charity sector media
**Timeline:** 2-4 months

### Tier 5: Community ($0) — The Mission
**Who:** Grassroots NFPs, First Nations orgs, CLCs, social enterprises
**Why they're free:** Cross-subsidy model. Institutions pay so communities don't have to.
**Why they matter:** Usage data, testimonials, moral authority, network effects
**How to reach:** Word of mouth, ORIC, Reconciliation Australia, community sector events

---

## Rollout Plan (90 Days)

### Week 1-2: Foundation (Before Anyone Sees It)

1. **Fix access control** — Enforce subscription tier checks on API routes. Community tier shouldn't see premium features.
2. **Fix ops admin auth** — Add admin role check to /ops routes
3. **Complete invitation acceptance flow** — When invited user signs up, auto-join org
4. **Add email alerts** — Basic: "New grants matching your profile" weekly digest
5. **Test the full signup → save → track → upgrade flow** end-to-end
6. **Set up analytics** — Vercel Analytics + custom events for grant saves, searches, signups

### Week 3-4: Soft Launch (Warm Network)

7. **Recruit 10 beta testers** from warm network:
   - 3 grant consultants (Professional tier candidates)
   - 3 NFP staff (Organisation tier candidates)
   - 2 foundation program officers (Funder tier candidates)
   - 2 community orgs (Community tier — the mission)
8. **Give them free access** to Professional/Organisation tier for 60 days
9. **Weekly check-ins** — what works, what's missing, what would they pay for
10. **Fix every bug they find** immediately

### Week 5-8: Content Engine

11. **Publish the donor-contractor investigation** on LinkedIn/X with key stats
    - "140 entities donate to political parties AND hold $4.7B in government contracts"
    - Link to /reports/donor-contractors
    - Tag: journalists, researchers, transparency orgs (Transparency International AU, Grattan Institute, The Australia Institute)
12. **Monthly "State of Funding" report** — automated from live data
13. **LinkedIn content series:**
    - Week 5: "We mapped every foundation in Australia. Here's what we found."
    - Week 6: "94% of charity donations go to 10% of organisations. Here's the data."
    - Week 7: "The $4.7B question: who donates AND contracts?"
    - Week 8: "How we built Australia's entity graph (100,000 entities, 2 people)"
14. **Email newsletter** — "CivicGraph Weekly" with new grants, closing soon, foundation spotlight

### Week 9-12: Revenue

15. **Convert beta testers** — personal outreach, founding member pricing (50% off locked forever)
16. **Philanthropy Australia Conference prep** (Sep 8-10, Brisbane)
    - Submit speaker proposal: "What 100,000 entities tell us about Australian philanthropy"
    - Book fringe session: live demo of entity graph
    - Nick's network: Orange Sky connections in the philanthropy world
17. **Target 5 paying customers** by end of Month 3:
    - 2 grant consultants at $79/mo = $1,896/yr
    - 1 NFP at $249/mo = $2,988/yr
    - 1 foundation at $499/mo = $5,988/yr
    - 1 pilot at $249/mo = $2,988/yr
    - **Target ARR: ~$14K** (enough to cover hosting + validate demand)
18. **University partnerships** — offer research access in exchange for co-publications
    - Target: Centre for Social Impact (UNSW/UWA), Swinburne, QUT

---

## Data Refresh Strategy

### Automated (Already Built — Need Cron)
| Pipeline | Frequency | Script |
|----------|-----------|--------|
| ACNC charities | Monthly | `sync-acnc-charities.mjs` |
| Government grants (all states) | Daily | `import-gov-grants.mjs` |
| AusTender contracts | Weekly | `sync-austender-contracts.mjs` |
| Foundation enrichment | Ongoing (batches) | `enrich-foundations.mjs` |
| Grant description enrichment | Ongoing | `enrich-grant-descriptions.mjs` |
| Entity graph rebuild | Weekly | `build-entity-graph.mjs` |
| Modern Slavery Register | Quarterly | `import-modern-slavery.mjs` |
| Lobbying Register | Quarterly | `import-lobbying-register.mjs` |

### Manual (Needs Automation)
- AEC political donations — annual release, manual import
- ORIC register — manual download + import
- ASIC bulk extract — manual download + import
- Foundation program scraping — semi-automated (Cheerio + LLM)

### Agent/Bot Integration (Future)
- **Telegram bot** — already exists in ACT ecosystem. Add grant alert tool.
- **Notion Workers** — already deployed with 21 tools. Add CivicGraph grant search tool.
- **Email digests** — weekly grant matches for saved profiles (needs implementation)
- **Webhook alerts** — new grants matching saved criteria (needs implementation)

---

## Self-Service User Journey

### Grant Seeker Path
```
Landing page → Search grants → Find relevant grant → Sign up (free)
→ Save grant → Track in pipeline → Invite team → Share with org
→ AI chat for questions → Claim charity profile (if applicable)
→ Upgrade to Professional ($79) for AI matching + alerts
```

### Foundation/Funder Path
```
Landing page → Read donor-contractor report → Search entity graph
→ Look up own entity → See dossier → Sign up (free)
→ Explore foundation peers → Save foundations
→ Upgrade to Funder ($499) for full data + API + exports
```

### Researcher/Journalist Path
```
Landing page → Read investigation → Explore entity graph
→ Search by ABN/name → Download entity dossier
→ Contact for API access → Enterprise ($1999) or academic partnership
```

---

## Working With Foundations

### Value Proposition for Foundations
1. **See the landscape** — Who else funds your focus area? What's the gap?
2. **Due diligence** — Entity dossier on every potential grantee (ACNC financials, related entities, community-controlled status)
3. **Impact mapping** — Where does your funding reach? SEIFA disadvantage mapping.
4. **Compliance** — Modern Slavery Register cross-reference, political donation transparency
5. **Peer benchmarking** — How does your giving compare to similar foundations?

### Approach
- **Don't sell features. Sell insight.**
- Lead with the data: "Your foundation gave $X last year. Here's who else funds in your area, and where the gaps are."
- Philanthropy Australia membership = trust signal. Join PA ($1,100/yr for associate membership).
- Present at PA Conference Sep 2026 as "the data behind the decisions"

---

## Communication Strategy

### Core Narrative
**CivicGraph makes the invisible visible.** We trace where Australia's money flows — from political donations to government contracts to philanthropic grants to community outcomes. The data is open. The platform is free for communities. Institutions pay so communities don't have to.

### Voice
- **Not academic.** Plain language, strong claims backed by numbers.
- **Not activist.** We show the data and let it speak. "Correlation, not causation."
- **Not corporate.** No jargon. No "leveraging synergies."
- **Yes investigative.** Like a data journalist. "We cross-referenced X with Y. Here's what we found."

### Channels (Ranked by ROI)
1. **LinkedIn** — Highest signal for foundation officers, grant consultants, NFP leaders
2. **X/Twitter** — Journalist reach, investigation sharing
3. **Email newsletter** — Direct relationship, highest conversion
4. **Conference speaking** — PA Conference, F&P Conference, ACOSS National Conference
5. **Media partnerships** — The Guardian AU (philanthropy beat), Pro Bono News, Croakey
6. **Academic partnerships** — Co-publications drive credibility + citations

### Content Calendar (Monthly Rhythm)
- **Week 1:** "New This Month" — new data sources, new features
- **Week 2:** Investigation deep dive — one report highlighted
- **Week 3:** Foundation spotlight — profile one foundation's giving pattern
- **Week 4:** Community story — how a community org used CivicGraph

---

## Revenue Targets

| Milestone | Timeline | ARR | Customers |
|-----------|----------|----:|----------:|
| First paying customer | Month 2 | $948 | 1 |
| Validate demand | Month 3 | $14K | 5 |
| Cover hosting costs | Month 6 | $30K | 12 |
| Sustainable (1 person) | Month 12 | $80K | 25 |
| Growth mode | Month 18 | $200K | 50 |
| Real business | Month 24 | $500K | 100+ |

### What Unlocks Each Stage
- **$14K:** Warm network conversion (beta testers → founding members)
- **$30K:** Conference exposure + content marketing + first enterprise pilot
- **$80K:** 2-3 foundation accounts + 10-15 professional accounts + 1 government pilot
- **$200K:** Enterprise deal + API licensing + university partnerships
- **$500K:** Multiple enterprise + mandated for Closing the Gap reporting

---

## Immediate Next Actions (This Week)

1. [ ] **Deploy CivicGraph to production** — verify it's live and accessible
2. [ ] **Set up cron** for daily grant refresh + weekly entity graph rebuild
3. [ ] **Fix access control** — enforce tier limits on API routes
4. [ ] **Write LinkedIn post #1** — donor-contractor investigation teaser
5. [ ] **Identify 10 beta testers** — names from Nick + Ben's network
6. [ ] **Email 3 grant consultants** — offer free Professional access for 60 days
7. [ ] **Join Philanthropy Australia** as associate member ($1,100/yr)
8. [ ] **Submit PA Conference 2026 speaker proposal** (deadline TBD — check early bird registration)
9. [ ] **Set up hello@civicgraph.au** forwarding + monitoring
10. [ ] **Create CivicGraph LinkedIn page** + first post

---

*Built by 2 people. 100,036 entities. 4.2M records. The data infrastructure Australia never had.*
*A Curious Tractor project. Built on Jinibara Country.*
