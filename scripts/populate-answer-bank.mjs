#!/usr/bin/env node

/**
 * Populate ACT Answer Bank
 *
 * Inserts grant-ready Q&A pairs into GrantScope's answer bank
 * from ACT ecosystem project knowledge across all 7+ codebases.
 *
 * Usage:
 *   node scripts/populate-answer-bank.mjs              # Full populate
 *   node scripts/populate-answer-bank.mjs --dry-run    # Preview only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ORG_ID = '8b6160a1-7eea-4bd2-8404-71c196381de0'; // A Curious Tractor

// ── Generate embedding via OpenAI ──────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });
  const json = await res.json();
  return json.data?.[0]?.embedding || null;
}

// ── Answer Bank Entries ────────────────────────────────────────────────

const ANSWERS = [
  // ═══════════════════════════════════════
  // MISSION
  // ═══════════════════════════════════════
  {
    category: 'mission',
    question: "What is your organisation's mission?",
    answer: `ACT (A Curious Tractor) is a regenerative innovation ecosystem partnering with marginalised—especially First Nations—communities to dismantle extractive systems. Our north star: communities own their narratives, land, and economic futures. We design for our own obsolescence—if ACT is still running things in ten years, we've failed.

We operate through the LCAA methodology: Listen (deep listening to place, people, history), Curiosity (ask better questions, prototype, learn), Action (radical prototyping through technology, stories, and art), and Art (recognising art as the first form of revolution).

Founded by Benjamin Knight (systems designer) and Nicholas Marchesi OAM (Orange Sky co-founder, 2016 Young Australian of the Year), ACT operates as a dual-entity: ACT Foundation (CLG, charitable) for mission-locked governance and ACT Ventures for sustainable revenue with 40% profit-sharing to communities.`,
    tags: ['identity', 'values', 'methodology'],
    source_application: 'ACT Brand Core',
  },
  {
    category: 'mission',
    question: "Describe your organisation's vision for the next 10 years.",
    answer: `By 2036, ACT should be largely unnecessary. Communities should own their stories, their economies, their land, and their futures.

Phase 1 (2026-2028): Build the engine, prove the model — establish core infrastructure, demonstrate impact across 7 projects, achieve financial sustainability.
Phase 2 (2028-2031): Transfer power, scale what works — community-led governance on place-based projects, Indigenous-majority boards, open-source tools adopted sector-wide.
Phase 3 (2031-2036): Hand over the keys — ACT becomes a philosophical movement, not an organisation. Communities independently replicating models. Indigenous land trusts holding BCV and ACT Farm.`,
    tags: ['vision', 'strategy', 'decade-plan'],
    source_application: 'ACT Decade Vision',
  },
  {
    category: 'mission',
    question: "What values guide your organisation's work?",
    answer: `ACT is guided by four core values:

1. Radical Humility: We don't have all the answers, but we're cultivating solutions together. Communities lead; we support.
2. Decentralised Power: Every tool has a sunset clause and "forkable" IP. We hand over the keys.
3. Creativity as Disruption: Revolution starts with imagination. Art opens new possibilities for how things could work.
4. Uncomfortable Truth-telling: We name extractive systems and work to dismantle them, even when that's uncomfortable.

Our promise: Social, cultural, environmental and economic value remains in community hands. 40% of profits flow to community ownership. The farm is a commons; the studio is the toolkit to practice care, accountability, and collective power.`,
    tags: ['values', 'principles'],
    source_application: 'ACT Brand Core',
  },
  {
    category: 'mission',
    question: "What is your approach to working with First Nations communities?",
    answer: `ACT partners WITH marginalised—especially First Nations—communities. We are not a First Nations organisation. Our approach centres:

Indigenous Data Sovereignty: The right of Indigenous peoples to control data about their communities, cultures, and territories. This is embedded as technical architecture (OCAP principles in our platforms), not just policy.

Community Authority: In our ALMA evaluation framework, community authority carries the highest weight (30%) — above evidence strength, harm risk, and implementation capability. Indigenous-led programs are automatically prioritised.

Cultural Safety: Elder review systems built into platform workflows. Sacred content protection with multi-layer access controls. Ongoing consent with renewable expiry management. Cultural protocols enforced through code, not guidelines.

Power Transfer: Communities lead; ACT supports. Every tool has a sunset clause. We design for our own obsolescence. Handover planning is embedded in every project from day one.

Our work on Jinibara Country, with Palm Island Community Company (PICC), and with Quandamooka collaborators reflects this commitment.`,
    tags: ['first-nations', 'indigenous', 'cultural-safety', 'data-sovereignty'],
    source_application: 'ACT Brand Core + Empathy Ledger + PICC',
  },

  // ═══════════════════════════════════════
  // CAPACITY
  // ═══════════════════════════════════════
  {
    category: 'capacity',
    question: "Describe your organisation's technical capacity and infrastructure.",
    answer: `ACT operates a sophisticated technology ecosystem across 7+ projects:

Platform Infrastructure:
- 5 production web applications (Empathy Ledger, JusticeHub, Goods on Country, Palm Island Repository, The Harvest)
- 4 Supabase database instances (571+ tables across shared ACT/GrantScope instance)
- Multi-provider AI integration (Anthropic, OpenAI, Groq, Gemini, DeepSeek, MiniMax) with cost-optimised rotation
- 110+ operational scripts managing data pipelines, sync, and intelligence
- Real-time IoT telemetry (Particle.io) tracking 10 washing machines in remote communities

Technology Stack: Next.js, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel, Google Workspace (4 mailboxes with domain-wide delegation), Xero financial integration, Notion workspace, GoHighLevel CRM, Telegram bot (grammY).

AI Capabilities: Vector embeddings for semantic search, LLM-powered content extraction and evaluation, multi-provider rotation for cost efficiency ($50-200/month vs $2,000+ single-provider), 7-stage robust JSON parser, web scraping intelligence.

Security: Row Level Security (RLS) on all databases, 98/100 security score on Empathy Ledger, OCAP-compliant data architecture, consent management with renewable expiry.`,
    tags: ['technology', 'infrastructure', 'ai', 'platforms'],
    source_application: 'ACT Infrastructure Audit',
  },
  {
    category: 'capacity',
    question: "Describe your team and their qualifications.",
    answer: `Core Leadership:
- Benjamin Knight — Systems designer, co-founder. Designed and built the entire ACT technology ecosystem including 5 production platforms, 110+ operational scripts, and AI infrastructure.
- Nicholas Marchesi OAM — Co-founder, Orange Sky co-founder, 2016 Young Australian of the Year. Spatial design and vision. Deep experience scaling social enterprises nationally.

Program Team:
- Sophie — Producer, full-time from March 2026. Program coordination and community engagement.
- Susie — Operations management for The Harvest.
- Thais — Architect, rammed earth studio design and construction.
- Leah — Kids program lead, quarterly co-design workshops.
- Cath — NDIS-accessible garden integration specialist.

Community Specialists:
- Cultural advisors for Indigenous projects
- Elder review teams for cultural content
- Community operators for local programs (growing)
- Stephen Pozzi (Openfields Solutions) — IoT telemetry partner

The team combines deep technology expertise with lived community engagement experience, creative arts leadership, and First Nations cultural advisory.`,
    tags: ['team', 'leadership', 'qualifications'],
    source_application: 'ACT Team Overview',
  },
  {
    category: 'capacity',
    question: "What is the Empathy Ledger and what can it do?",
    answer: `Empathy Ledger is a culturally respectful platform for Indigenous communities to share, preserve, and celebrate their stories, traditions, and wisdom for future generations.

Current State (2026): Version 2.0.0 — PRODUCTION READY. 8/8 Sprints complete, 131 components, ~36,650 lines of production code, 60+ APIs, 98/100 security score, 100% OCAP compliant. 1000+ stories protected.

Four Modes:
1. STORY Mode ("Look What We've Done") — Annual reports, impact summaries, project spotlights
2. MEMORY Mode ("Everything We Know") — Knowledge engine, searchable through conversation
3. CAPTURE Mode ("Record As It Happens") — Voice notes, photos, meeting summaries
4. DIRECTION Mode ("Where We're Going") — Connect today's work to tomorrow's aspirations

Cultural Safety Features: OCAP principles built into core architecture, Elder Review System, Sacred Content Protection with multi-layer access controls, ongoing consent with renewable expiry management (6-12 months), multi-tenant organisations with isolation.

First deployment with Palm Island Community Company (PICC) — 18 years of history, $130K funding, active projects including Elders Room, Photo Studio, and Storm Stories.`,
    tags: ['empathy-ledger', 'storytelling', 'platform', 'indigenous'],
    source_application: 'Empathy Ledger v2',
  },
  {
    category: 'capacity',
    question: "What is the ALMA system and how does it work?",
    answer: `ALMA (Authentic Learning for Meaningful Accountability) is Australia's first national clearinghouse of youth justice interventions — an evidence intelligence engine evaluating 1,112 interventions from 507+ organisations.

Each intervention is scored on 5 signals:
1. Evidence Strength (25%): From Untested to Proven (RCT-validated)
2. Community Authority (30%): Highest weight — prioritises Indigenous-led programs
3. Harm Risk (20%): Inverse score, flags programs needing cultural review
4. Implementation Capability (15%): Replication readiness assessment
5. Option Value (10%): Learning potential for emerging programs

Coverage (March 2026): 1,112 interventions, 507 organisations, 198 evidence items, 327 evidence links, 1,150 outcomes documented, 1,699 outcome links, 840 interventions with outcomes (76% coverage), 100% portfolio score coverage.

The system enables grassroots programs to "fork" proven models, access AI insights, and make evidence-based decisions about youth justice interventions. Open-source tools already adopted by 10+ organisations.`,
    tags: ['alma', 'justicehub', 'evidence', 'youth-justice'],
    source_application: 'JusticeHub ALMA',
  },
  {
    category: 'capacity',
    question: "Describe the Goods on Country project and its operations.",
    answer: `Goods on Country is a circular-economy venture co-designing essential products (beds, mattresses, washing machines) for remote Indigenous communities while converting local waste into manufacturing inputs.

Current Operations:
- 389 individual assets deployed: 363 Basket Beds, 6 Weave Beds, 20 ID Washing Machines
- 8 remote communities served: Palm Island (141 assets), Tennant Creek (139), Alice Homelands (60), Maningrida (24), Kalgoorlie (20), and more
- Real-time IoT monitoring of 10 washing machines via Particle.io
- QR code tracking system with 389 unique codes for immediate support access
- Automated alerts for maintenance, overuse, and high-priority tickets
- Consumer platform (v2) with e-commerce, community storytelling, and sponsorship program ("Buy for a Community")

Revenue Model: Communities own production and profits. 40% profit-sharing to source communities. E-commerce revenue + sponsorship + circular manufacturing reduces material costs.

Domain: goodsoncountry.com.au`,
    tags: ['goods', 'circular-economy', 'remote-communities', 'assets'],
    source_application: 'Goods on Country',
  },

  // ═══════════════════════════════════════
  // IMPACT
  // ═══════════════════════════════════════
  {
    category: 'impact',
    question: "What measurable impact has your organisation achieved?",
    answer: `Demonstrated Impact (as of March 2026):

Narrative Sovereignty:
- 1,000+ stories protected through Empathy Ledger
- Storytellers earning from their narratives
- Traditional knowledge respected and compensated
- 15 years of Palm Island reports digitized with AI search

Justice & Evidence:
- 1,112 youth justice interventions catalogued (first in Australia)
- 507 organisations represented in ALMA database
- Youth justice models reducing recidivism by 58%
- 10+ organisations adopting open-source tools

Community Infrastructure:
- 389 assets (beds, washing machines) deployed across 8 remote communities
- Real-time IoT monitoring protecting community investments
- QR-code support system enabling immediate maintenance access

Community Engagement:
- 80+ locals at The Harvest First Gathering (March 2026)
- Milk Crate Pavilion built collectively by community
- $45K Radical Scoops fellowship (Regional Arts Australia) — exploring dairy, timber, and cooperative heritage

Technology:
- 5 production platforms, all with Row Level Security
- 98/100 security score on Empathy Ledger
- 100% OCAP compliance
- Multi-provider AI reducing costs by 10-20x`,
    tags: ['impact', 'outcomes', 'metrics'],
    source_application: 'Cross-Project Impact',
  },
  {
    category: 'impact',
    question: "How do you measure impact and outcomes?",
    answer: `ACT uses the ALMA (Authentic Learning for Meaningful Accountability) framework across all projects, measuring five signals:

1. Community Authority (30% weight — highest): Prioritises Indigenous-led programs and community-defined success measures. Not just "what academics think works" but "what communities say matters."

2. Evidence Strength (25%): From untested to proven (RCT-validated). We value rigorous evidence but don't let it override community voice.

3. Harm Risk (20%): Inverse scoring flags culturally unsafe programs. Cultural safety is non-negotiable.

4. Implementation Capability (15%): Can this be replicated? Replication readiness ensures impact scales.

5. Option Value (10%): Learning potential for emerging programs. Innovation gets space even without full evidence.

Cross-Project Metrics:
- Community Ownership: Communities independently replicating models
- Regenerative Outcomes: Land under conservation, jobs created, waste reduction
- Narrative Sovereignty: Stories protected, storytellers earning, traditional knowledge respected
- Systems Change: Justice models reducing recidivism, open-source adoption
- Joy Assessments: Qualitative measures of agency, capacity, and wellbeing

We also use SROI (Social Return on Investment) with cultural value proxies in Empathy Ledger, and generate funder reports with comprehensive impact analytics.`,
    tags: ['measurement', 'evaluation', 'alma', 'outcomes'],
    source_application: 'ALMA Framework',
  },
  {
    category: 'impact',
    question: "What are your projected outcomes for the next 1-3 years?",
    answer: `Projected Impact by 2027:

Community Ownership:
- 3+ communities independently replicating ACT models
- 40% of profits flowing to community hands
- Indigenous-majority governance on place-based projects

Environmental:
- 117+ hectares of land under conservation (Black Cockatoo Valley)
- Glossy Black Cockatoo habitat protected and restored
- Biodiversity credits financing ongoing conservation

Economic:
- 50+ jobs created in marginalised communities
- 70% waste reduction through Goods on Country circular economy
- Eco-cottage revenue sustaining land restoration

Social:
- 1,000+ stories protected through Empathy Ledger (already achieved)
- Youth justice models adopted by 15+ organisations nationally
- CONTAINED Tour reaching 6+ cities with youth justice awareness
- Community governance group at The Harvest carrying program forward

Technology:
- Open-source tools enabling sector-wide adoption
- AI-powered grant matching reducing barrier to funding access
- First Nations data sovereignty as replicable technical pattern`,
    tags: ['projections', 'outcomes', 'future'],
    source_application: 'ACT Decade Vision',
  },

  // ═══════════════════════════════════════
  // BUDGET
  // ═══════════════════════════════════════
  {
    category: 'budget',
    question: "What are your organisation's revenue streams?",
    answer: `ACT operates a diversified revenue model through its dual-entity structure:

Revenue Mix (Target):
- Government contracts (40-50%): Fee-for-service programs, research partnerships
- Philanthropic grants (20-30%): Innovation and systems change funding
- Social enterprise revenue (20-25%): Goods on Country products, BCV eco-cottages, Art sales, consulting
- Consulting and training (10-15%): Sharing methodologies, evaluation services (Innovation Studio)
- Impact investment (Growing): Patient capital for infrastructure and scaling

Current Revenue Sources:
- Innovation Studio consulting: Steady income stream
- Empathy Ledger licensing: First paying clients (planned)
- The Harvest operations: Break-even projected by month 9
- Grant pipeline: Systematic discovery and application process

Grant Funding Secured:
- Radical Scoops (Regional Arts Australia): $45,000 (received)
- PICC projects (Palm Island): $130,000 (active)
- Creative Australia application: $45,000 (pending, March 2026)
- Multiple additional grants in pipeline via GrantScope matching

Financial Management: Xero integration, real-time finance intelligence dashboard, automated receipt reconciliation, receivables tracking.`,
    tags: ['revenue', 'funding', 'financial'],
    source_application: 'ACT Financial Overview',
  },
  {
    category: 'budget',
    question: "What is your technology operating cost structure?",
    answer: `ACT maintains extremely lean technology operations through smart architecture choices:

Monthly Operating Costs:
- Supabase databases: $25-50/month (4 instances, mostly free tier)
- Vercel hosting: $0-20/month (5 apps, free tier for most)
- AI API costs: $50-200/month (multi-provider rotation using free tiers first)
- Domains: ~$100/year across all projects
- Google Workspace: $0 (existing domain, service account)
- IoT telemetry: ~$30/month (Particle.io for washing machines)
- Total: ~$150-400/month for entire ecosystem

Cost Optimisation Strategies:
- Multi-provider AI rotation: Groq (free) → Gemini (free) → MiniMax → DeepSeek → paid providers. This achieves 10-20x cost reduction vs single-provider.
- Free tier maximisation: Supabase free tier for non-critical instances, Vercel free tier for most deployments.
- Web scraping via Jina Reader (free) instead of paid data services.
- Open-source tooling throughout.

This means technology costs are <5% of total operating budget, enabling maximum allocation to community programs.`,
    tags: ['costs', 'technology', 'operations'],
    source_application: 'ACT Infrastructure Audit',
  },
  {
    category: 'budget',
    question: "Provide a sample project budget (The Harvest Art Space).",
    answer: `The Harvest Art Space — Community Gallery & Seasonal Residency Activation
Budget Period: July 2026 – June 2027

EXPENSES:
- Artist fees (4 seasonal residents, 3 months each): $32,000
- Exhibition materials and installation (4 seasons): $6,000
- Community workshop materials and facilitation: $3,000
- Kids co-design program (4 quarterly workshops): $2,000
- Curated dining events (4 events, subsidised at $30/head): $2,000
- Documentation and photography: $1,500
- Open call promotion and artist travel: $1,500
- Accessibility costs (NDIS integration): $1,000
- Admin and insurance: $1,000
Total Expenses: $50,000

INCOME:
- Curated dining ticket revenue (4 events × 40 seats × $30): $4,800
- In-kind: Venue (The Harvest provides gallery space): $0 cash
- In-kind: Sophie producer time (already funded): $0 cash
Total Income: $4,800

GRANT REQUEST: $45,000

This represents a seasonal cycle model: open call → residency → community co-design → exhibition → open studios → documentation → changeover, repeated four times across the year.`,
    tags: ['harvest', 'budget-sample', 'arts'],
    source_application: 'Creative Australia Application 2026',
  },

  // ═══════════════════════════════════════
  // GOVERNANCE
  // ═══════════════════════════════════════
  {
    category: 'governance',
    question: "Describe your organisation's governance structure.",
    answer: `ACT operates a dual-entity governance structure:

ACT Foundation (CLG — Company Limited by Guarantee):
- Charitable status for grant eligibility
- Mission-locked governance protecting community interests
- Owns majority of ventures
- Board oversight (being established)

ACT Ventures (Mission-Locked Trading Company):
- Generates sustainable revenue through social enterprise
- 40% profit-sharing commitment to communities
- Attracts impact investment
- Operates Goods on Country, BCV eco-cottages, Art sales

Governance Principles:
- Power Transfer: Communities lead; ACT supports. Every tool has a sunset clause and "forkable" IP.
- Design for Obsolescence: Handover planning embedded in every project from day one.
- Cultural Protocols: Elder review for cultural content, First Nations Cultural and IP Protocols observed, OCAP principles embedded as technical architecture.
- Community Co-Design: Not consultation — genuine co-design from inception. Kids at The Harvest design their own creative area. Communities choose workshop topics.

Long-term Vision (by 2036): Transition to Indigenous land trust with Jinibara partnership for BCV and ACT Farm. Community governance groups carrying programs forward independently.

ABN: 21 591 780 066
Location: Jinibara Country, Queensland`,
    tags: ['governance', 'structure', 'dual-entity'],
    source_application: 'ACT Brand Core',
  },
  {
    category: 'governance',
    question: "How do you ensure cultural safety and Indigenous data sovereignty?",
    answer: `Cultural safety and Indigenous data sovereignty are embedded as technical architecture in ACT's platforms, not just policy documents:

OCAP Principles (Ownership, Control, Access, Possession):
- Built into the core database architecture of Empathy Ledger
- Row Level Security (RLS) enforces access controls at the database level
- Multi-tenant isolation ensures each community's data is separate
- Communities can export all their data at any time

Elder Review System:
- Complete workflow for cultural content review before publication
- Sacred content protection with multi-layer access controls
- Ongoing consent with renewable expiry management (6-12 months)
- AI analysis requires explicit opt-in (never applied without consent)

ALMA Community Authority:
- Highest weighted signal (30%) in evaluation framework
- Indigenous-led programs automatically prioritised
- Harm risk assessment prevents culturally unsafe programs from ranking high
- Community-defined success measures valued alongside academic evidence

Platform Compliance:
- 100% OCAP compliant (Empathy Ledger)
- 98/100 security score
- All platforms use RLS
- First Nations Cultural and Intellectual Property Protocols (Creative Australia standard) observed across all projects`,
    tags: ['cultural-safety', 'data-sovereignty', 'ocap', 'indigenous'],
    source_application: 'Empathy Ledger + ALMA',
  },
  {
    category: 'governance',
    question: "What risk management and compliance measures do you have?",
    answer: `ACT maintains comprehensive risk management across technology and community operations:

Technology Security:
- Row Level Security (RLS) on ALL database tables across all projects
- 98/100 security score on Empathy Ledger (independent audit)
- Service account authentication with domain-wide delegation (Google)
- OAuth2 with refresh token rotation (Xero)
- Webhook signature validation on all incoming integrations
- Multi-tenant data isolation for community platforms

Data Protection:
- Indigenous Data Sovereignty principles in all platforms
- OCAP-compliant architecture (not just policy)
- Renewable consent management (6-12 month cycles)
- Sacred content multi-layer access controls
- Complete data export capability for communities

Financial Controls:
- Xero accounting integration with automated sync
- Receipt reconciliation and correlation pipeline
- Real-time finance intelligence dashboard
- Transaction tagging and project code tracking
- Receivables monitoring and aging analysis

Operational Risk:
- 110+ automated scripts with PM2 process management
- Data freshness monitoring across all systems
- Automated alerts and health checks
- Git version control with full audit trail
- Vercel deployment with rollback capability

Insurance: Professional indemnity, public liability, cyber liability (as required by grant conditions).`,
    tags: ['risk', 'compliance', 'security'],
    source_application: 'ACT Infrastructure',
  },

  // ═══════════════════════════════════════
  // PARTNERS
  // ═══════════════════════════════════════
  {
    category: 'partners',
    question: "Who are your key partners and collaborators?",
    answer: `Indigenous Communities:
- Jinibara Country — ACT Farm, Black Cockatoo Valley, and The Harvest location. Elder guidance on land practice.
- Palm Island Community Company (PICC) — $130K active projects. First Empathy Ledger deployment. 18 years of history digitized.
- Quandamooka — Shaun Fisher, oyster farmer and cross-cultural creative collaborator at The Harvest.

Arts & Culture:
- Maleny Arts Council — exhibition promotion, artist network for The Harvest.
- Regional Arts Australia — Radical Scoops fellowship ($45K received).
- Creative Australia — pending application for Harvest Art Space ($45K).
- Sunshine Coast Council — Arts & Heritage Levy pathway for future sustainability.

Education & Research:
- University of the Sunshine Coast (USC) — June's Patch therapeutic garden research, evidence-based wellbeing program.
- Local primary schools and homeschool networks — school group visits, kids co-design at The Harvest.

Community & Social:
- Orange Sky Australia — Nicholas Marchesi co-founded, deep understanding of homelessness service delivery.
- Wishlist community — June's Patch partnership for healthcare worker wellbeing.
- 507 youth justice organisations in ALMA database.
- 80+ community members at The Harvest First Gathering.

Technology:
- Openfields Solutions (Stephen Pozzi) — IoT telemetry for Goods washing machines via Particle.io.
- Supabase, Vercel, OpenAI, Anthropic — technology infrastructure partnerships.`,
    tags: ['partners', 'collaborators', 'networks'],
    source_application: 'Cross-Project Partnerships',
  },
  {
    category: 'partners',
    question: "Describe your relationship with Palm Island Community Company.",
    answer: `Palm Island Community Company (PICC) is ACT's foundational community partner and the first deployment site for Empathy Ledger.

Partnership Scope:
- $130,000 in active project funding
- Projects: Elders Room, Photo Studio, Storm Stories, Uncle Allan documentation
- 18 years of annual reports digitized with AI search capability
- Community stories, knowledge wiki, and media management platform

Why Palm Island:
- 18 years of history, low tech literacy, high community knowledge
- "If it works here, it works anywhere" — proof case for the Empathy Ledger model
- Demonstrates that cultural safety and technical sophistication aren't trade-offs

Cultural Protocols:
- All content owned and controlled by Palm Island community
- Cultural sensitivity protocols for sharing stories, especially Elder knowledge
- Permission-based access: different levels based on community roles
- Proper attribution and respect for storytellers and knowledge holders
- Indigenous Data Sovereignty embedded in platform architecture

Motto: "Our stories are our strength. Our data is our sovereignty."

This partnership demonstrates ACT's approach: deep, long-term engagement with community-led governance, not fly-in/fly-out consulting.`,
    tags: ['picc', 'palm-island', 'community-partnership'],
    source_application: 'PICC Partnership',
  },
  {
    category: 'partners',
    question: "Describe your community engagement at The Harvest.",
    answer: `The Harvest is a community hub forming at 9 Gumland Drive, Witta, on the Blackall Range, Sunshine Coast Hinterland, Jinibara Country.

First Gathering (March 7, 2026):
- 80+ locals participated
- Built Milk Crate Pavilion together (community-built structure from donated dairy crates)
- Oral histories recorded with Barry Rodgerig (neighbour since 1972)
- Shared communal meal

Community Need:
- Only community-led gallery/residency in the Blackall Range hinterland
- Region has 157 creative arts workers but no dedicated exhibition space
- Witta has no public gathering space at all
- Heritage: timber, dairy, and cooperative movement on Blackall Range

Engagement Model:
- Core principle: transformation. Everything can be removed between seasons. Gallery one quarter, theatre the next, ceramics workshop after that.
- Kids design their own creative area each season (not a playground installed for them)
- Community chooses workshop topics
- Local makers test ideas at seasonal markets
- Curated dining priced accessibly ($30/head)
- Open studios and workshops free
- Sliding-scale principle throughout

Partners: Maleny Arts Council, local primary schools + homeschool networks, Regional Arts Australia (Radical Scoops fellowship), Shaun Fisher (Quandamooka collaborator), Barry Rodgerig (community elder/neighbour).

Sustainability: Community governance group to be established by June 2027, ensuring program outlives any single grant.`,
    tags: ['harvest', 'community', 'arts', 'witta'],
    source_application: 'The Harvest + Creative Australia Application',
  },

  // ═══════════════════════════════════════
  // ADDITIONAL CROSS-CUTTING ANSWERS
  // ═══════════════════════════════════════
  {
    category: 'mission',
    question: "How does your work address systems change?",
    answer: `ACT's approach to systems change is fundamentally different from service delivery:

Not service delivery — infrastructure building: We build platforms and tools that communities own and operate, not programs that require our ongoing involvement.

Not organisation building — movement catalysing: ALMA's open-source evaluation tools enable any organisation to assess youth justice interventions. GrantScope makes grant discovery accessible to small nonprofits.

Not dependency creating — power transferring: Every tool has a sunset clause. Communities can fork our IP. 40% of profits flow to community hands. We design for our own obsolescence.

Not permanent interventions — designed for obsolescence: By 2036, ACT should be unnecessary. If we're still running things, we've failed.

Concrete examples:
- ALMA provides transparent, replicable evaluation that 10+ orgs already use independently
- Empathy Ledger's OCAP architecture means communities own their data infrastructure
- Goods on Country transfers production ownership to source communities
- The Harvest builds community governance group to carry program forward
- BCV transitions to Indigenous land trust with Jinibara partnership`,
    tags: ['systems-change', 'power-transfer', 'infrastructure'],
    source_application: 'ACT Philosophy',
  },
  {
    category: 'impact',
    question: "How does your work contribute to reconciliation?",
    answer: `ACT contributes to reconciliation through practical action, not symbolic gestures:

Data Sovereignty as Architecture: Empathy Ledger embeds OCAP (Ownership, Control, Access, Possession) principles at the database level — not as policy overlay, but as how the technology works. Indigenous communities control their data infrastructure, not just their content.

Community Authority in Evaluation: ALMA weights community authority highest (30%) in evaluating youth justice interventions. This means Indigenous-led programs are structurally prioritised, inverting traditional evidence hierarchies that favour academic credentials over community knowledge.

Economic Transfer: 40% profit-sharing commitment in governance. Goods on Country co-designs products with remote communities and transfers production ownership. BCV creates Indigenous land-care jobs funded by eco-cottage revenue and biodiversity credits.

Cultural Preservation: 1,000+ stories protected through Empathy Ledger. 15 years of Palm Island reports digitized with AI search. Sacred content protection with Elder review workflows. Renewable consent management respecting cultural protocols.

Land Justice: Black Cockatoo Valley and ACT Farm on Jinibara Country, with long-term vision of transitioning to Indigenous land trust (by 2036).

Relationship, Not Extraction: Deep, long-term partnerships with PICC (multi-year, $130K), Jinibara community, and Quandamooka collaborators. Not fly-in/fly-out consulting.`,
    tags: ['reconciliation', 'indigenous', 'practical-action'],
    source_application: 'Cross-Project Impact',
  },
  {
    category: 'capacity',
    question: "What is Black Cockatoo Valley and the ACT Farm?",
    answer: `Black Cockatoo Valley (BCV) is a 150-acre (117 ha) regeneration estate on Jinibara lands near Witta, Queensland, combining eco-cottages, Indigenous land-care jobs, and biodiversity credits to finance habitat restoration.

Features:
- Threatened species habitat (Glossy Black Cockatoo)
- Views to Mary River, creeks and forest to Elaman Creek
- Conservation-first approach: low-impact, limited-volume, no extractive tourism
- Premium small-group R&D residencies (accommodation + prototyping on land)
- Workshops and events (regeneration, monitoring, learning-by-doing)

Revenue Model: Eco-cottage rentals fund restoration. Biodiversity credits finance conservation. Indigenous land-care employment programs create ongoing jobs.

ACT Farm is the broader home base where land care, learning, and art-making meet. It encompasses BCV operations plus studio work, and is the physical manifestation of the entire ACT ecosystem model.

Key Programs:
- June's Patch: Healthcare worker wellbeing garden and food program (partnership with Wishlist community and USC)
- Conservation workshops and working bees
- Artist residencies and cultural programming
- Community gatherings and harvest meals

Long-term Vision: Transition to Indigenous land trust with Jinibara partnership by 2031-2036. Community co-stewardship model. Regenerated land supporting Indigenous-led programs. ACT controls this property (unlike The Harvest partnership).`,
    tags: ['bcv', 'farm', 'land', 'conservation', 'regeneration'],
    source_application: 'BCV + ACT Farm',
  },
  {
    category: 'budget',
    question: "What is your approach to financial sustainability?",
    answer: `ACT's financial sustainability model balances grant funding with earned revenue, reducing dependency over time:

Dual-Entity Structure:
- ACT Foundation (CLG): Grant-eligible, charitable, mission-locked
- ACT Ventures: Revenue-generating, 40% profit-sharing, attracts impact investment

Revenue Diversification:
- Year 1-2: Primarily grants + consulting (60-70%)
- Year 3-5: Growing social enterprise revenue (target 40-50% earned income)
- Year 5+: Majority earned income, grants for innovation only

Social Enterprise Revenue Streams:
- Goods on Country: Product sales, sponsorship ("Buy for a Community"), circular manufacturing
- Black Cockatoo Valley: Eco-cottage rentals, biodiversity credits, workshops
- The Harvest: Curated dining, CSA subscriptions, seasonal markets
- Empathy Ledger: SaaS licensing to organisations (Story, Memory, Full Platform tiers)
- Innovation Studio: Consulting and methodology sharing
- Art: Sales, commissions, exhibition revenue

Cost Discipline:
- Technology operating costs < $400/month for entire ecosystem
- Multi-provider AI rotation reducing costs 10-20x
- Free tier maximisation across infrastructure
- No unnecessary SaaS subscriptions (recently cancelled 18, saved $1,716/yr)

Financial Management: Xero integration, automated receipt reconciliation, real-time dashboard, receivables monitoring, project-level cost tracking.`,
    tags: ['sustainability', 'revenue', 'financial-model'],
    source_application: 'ACT Financial Strategy',
  },
  {
    category: 'governance',
    question: "How do you ensure accountability and transparency?",
    answer: `ACT maintains accountability through multiple mechanisms:

Financial Transparency:
- Xero accounting integration with full audit trail
- Real-time finance intelligence dashboard
- Automated receipt reconciliation and correlation
- Project-level cost tracking and budget monitoring
- Transaction tagging by project code

Technical Accountability:
- All code in version control (Git) with full audit trail
- Open-source tools and methodologies
- Row Level Security (RLS) on all databases
- Automated health monitoring across all systems
- Data freshness checks preventing stale information

Community Accountability:
- 40% profit-sharing commitment embedded in governance
- ALMA evaluation with transparent, open methodology
- Community authority weighted highest (30%) in all assessments
- Elder review systems for cultural content
- Renewable consent management (not set-and-forget)
- Handover planning from day one in every project

Reporting:
- SROI Calculator with cultural value proxies (Empathy Ledger)
- Funder reports generated from comprehensive analytics
- Impact metrics tracked across all projects
- Weekly project health monitoring
- Community governance groups with decision-making authority

Sunset Clauses: Every tool ACT builds has a sunset clause and "forkable" IP. Communities can take any platform and run it independently. This is the ultimate accountability — if we build dependency, we've failed.`,
    tags: ['accountability', 'transparency', 'reporting'],
    source_application: 'ACT Governance',
  },
  {
    category: 'partners',
    question: "How do you collaborate with government and funding bodies?",
    answer: `ACT engages with government and funding bodies as partners in systems change, not just as funding sources:

Current Government/Funder Relationships:
- Regional Arts Australia: Radical Scoops fellowship ($45K received) — exploring dairy, timber, and cooperative heritage of Blackall Range
- Creative Australia: Pending application ($45K) for Harvest Art Space seasonal residency program
- Sunshine Coast Council: Arts & Heritage Levy pathway for future sustainability
- Queensland Government: Youth justice partnerships through JusticeHub/ALMA

Approach to Government:
- Fee-for-service programs that build community capacity, not dependency
- Research partnerships generating open, reusable evidence
- Policy submissions backed by ALMA's evidence base
- Technology partnerships (data sharing, open-source tools)

What We Offer Funders:
- Transparent evaluation via ALMA framework
- Comprehensive impact reporting (SROI with cultural value proxies)
- Technology-enabled monitoring and outcomes tracking
- Community authority measures (not just academic metrics)
- Open-source methodology that scales beyond our projects
- Evidence that community-led approaches work (58% recidivism reduction)

Funding Pipeline: Systematic approach via GrantScope — AI-powered grant discovery, matching, and application management. Currently tracking 14,000+ grant opportunities with automated fit scoring.`,
    tags: ['government', 'funders', 'policy', 'grants'],
    source_application: 'Cross-Project Partnerships',
  },
];

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Populating ACT Answer Bank ===`);
  console.log(`Org: A Curious Tractor (${ORG_ID})`);
  console.log(`Answers to insert: ${ANSWERS.length}`);
  if (DRY_RUN) console.log('DRY RUN — no changes will be made\n');

  let inserted = 0;
  let errors = 0;

  for (const entry of ANSWERS) {
    const text = `${entry.question}\n\n${entry.answer}`;
    console.log(`  [${entry.category}] ${entry.question.slice(0, 60)}...`);

    if (DRY_RUN) {
      inserted++;
      continue;
    }

    // Generate embedding
    let embedding = null;
    try {
      embedding = await embed(text);
    } catch (e) {
      console.warn(`    Warning: embedding failed — ${e.message}`);
    }

    const { error } = await supabase
      .from('grant_answer_bank')
      .insert({
        org_profile_id: ORG_ID,
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        tags: entry.tags || [],
        source_application: entry.source_application || null,
        embedding,
      });

    if (error) {
      console.error(`    ERROR: ${error.message}`);
      errors++;
    } else {
      inserted++;
    }

    // Rate limit OpenAI
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Done ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
