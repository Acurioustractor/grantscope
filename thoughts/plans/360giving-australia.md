# CivicGraph: Australia's 360Giving

## Vision

Build Australia's open grants infrastructure — the single most complete, searchable database of every funding opportunity in the country. Government grants, philanthropic foundations, corporate giving programs, research funding, and international funders active in Australia.

Australia has no 360Giving equivalent. The UK has 320+ funders publishing 1M+ grants in machine-readable format. Australia has GrantConnect (government only), Foundation Maps (members-only), and Funding Centre ($55-85/year). CivicGraph fills this gap as open infrastructure.

## Current State (10 March 2026)

### Grants Database: `grant_opportunities` — 18,069 rows
- 100% embedded (pgvector, text-embedding-3-small, 1536 dims)
- Semantic search live via `/api/search/semantic`
- Hybrid search on grants page (auto-detect keyword vs natural language)
- 30+ automated source plugins across all states + federal

### Foundations Database: `foundations` — 10,779 rows
- Derived from ACNC register (64K+ charities filtered to grantmakers)
- 34 columns including giving_philosophy, application_tips, board_members
- Multi-provider LLM enrichment pipeline (9 providers: Groq, Gemini, DeepSeek, OpenAI, Anthropic, Perplexity, Kimi, Minimax, Gemini grounded)
- **3,264 AI-enriched (30%)** — up from 1,627 (16.5%)

### ACNC Annual Statements: `acnc_ais` — 359,678 rows
- 7 years of data (2017-2023), 65 columns
- Full financials: revenue, expenses, grants given (AU + intl), assets, staff
- **14,882 charities gave grants in 2023** totalling **$8.86 billion**
- `v_acnc_grant_makers` view identifies grantmaking orgs
- `mv_acnc_latest` materialised view for most recent year per charity

### Foundation Programs: `foundation_programs` — 2,472 rows
- Linked to foundations via FK
- All have descriptions

### Entity Graph (NEW — not in original 360Giving vision)
- **100,036 entities** in unified registry linked by ABN
- **211,783 relationships** — contracts, donations, grants, tax, justice funding
- **670,303 AusTender contracts** — full federal procurement history
- **312,933 political donations** — full AEC register
- **26,241 ATO tax transparency** records
- **52,133 justice funding** records
- **10,339 social enterprises** — Supply Nation + 5 sources
- Entity resolution F1: **94.1%**

### Built Infrastructure
- `packages/grant-engine/src/foundations/` — acnc-importer, foundation-profiler, community-profiler, repository, types
- `scripts/sync-acnc-register.mjs` — ACNC register sync
- `scripts/import-acnc-financials.mjs` — AIS data import
- `scripts/profile-vip-foundations.mjs` — AFR Philanthropy 50 + Forbes Corporate 50
- `scripts/profile-community-orgs.mjs` — Community org profiling
- `apps/web/src/app/foundations/` — Foundation directory + detail pages
- `apps/web/src/app/corporate/` — Corporate giving page
- `apps/web/src/app/reports/big-philanthropy/` — Big philanthropy report
- Multi-provider LLM profiler with auto-rotation: Gemini (grounded), DeepSeek, Kimi, Groq, Minimax, OpenAI, Perplexity, Anthropic

## What's Working vs What's Not

### Working Well
- ACNC data pipeline (360k records, 7 years)
- Foundation registry (9,874 foundations with financials)
- Multi-provider LLM enrichment (round-robin across 8+ providers)
- VIP foundation profiling (AFR 50, Forbes Corporate 50)
- Grant discovery from 10+ government sources
- Semantic search with pgvector embeddings
- Web UI: foundations directory, grants search, reports

### Gaps (Priority Order — Updated 10 March 2026)

#### 1. Foundation Enrichment Scale ($0, ongoing)
- **~7,500 foundations** still need AI enrichment (3,264 of 10,779 done = 30%)
- 494 with websites currently queued
- The profiler works with 9 LLM providers in round-robin
- **Action:** Continue running `enrich-foundations.mjs --limit=500`

#### 2. Zero Users
- No external users, no paying customers
- All infrastructure is built — launch is the #1 priority
- **Action:** Recruit 10 beta testers from warm network

#### 3. Grant Description Enrichment
- Many grants still have thin descriptions
- Grant enrichment pipeline built (`enrich-grant-descriptions.mjs`)
- **Action:** Continue running enrichment batches

#### 4. Eligibility Data
- Structured eligibility criteria still sparse
- **Action:** LLM extraction from grant/program URLs

#### 5. State Coverage
- 30+ sources now active across all states + federal
- Some states still have thin coverage
- **Action:** Build additional state plugins where gaps identified

## Build Phases (Updated)

### Phase 1: Scale Foundation Enrichment (NOW)
Run the existing profiler on the 3,304 foundations with websites that haven't been enriched yet. The infrastructure is built — this is just execution.

Priority order:
1. Top 500 by total_giving_annual (highest value foundations)
2. Those with open_programs in JSONB (have known programs)
3. Remaining by giving amount

### Phase 2: Grant Description Enrichment
Build a Cheerio + Groq pipeline for the 6,244 grants with no description:
1. Fetch URL with Cheerio
2. If empty/JS-rendered, queue for Playwright
3. Send to Groq (Llama 3.3 70B, free tier): extract description, eligibility, deadlines
4. Update grant_opportunities
5. Re-embed enriched grants

### Phase 3: Unify Foundation Programs + Grants Search
Make the 866 foundation programs searchable alongside the 14k grants:
- Option A: Sync foundation_programs → grant_opportunities (denormalize)
- Option B: Unified search endpoint that queries both tables
- Either way: embed foundation programs for semantic search

### Phase 4: SA + WA Government Sources
- SA: grants.sa.gov.au or similar
- WA: wa.gov.au/grants + Lotterywest (huge — $100M+/year)
- Fix VIC + NT with Firecrawl

### Phase 5: Eligibility Extraction
For all grants and foundation programs with URLs:
- Crawl the page
- LLM extract: who can apply, requirements, assessment criteria
- Populate eligibility_criteria, assessment_criteria, target_recipients

### Phase 6: International + ARDC
- ARDC API (free key, combines ARC + NHMRC)
- Gates Foundation committed grants
- CRC program grants
- UNESCO, GEF Small Grants

### Phase 7: 360Giving Standard
- Define open data format for Australian grants
- Publish API
- Invite funders to publish directly
- Partner with Philanthropy Australia / ACNC

## Free Tool Stack

| Need | Tool | Status |
|------|------|--------|
| ACNC import | Custom importer | Built |
| Foundation profiling | Multi-provider LLM (8 providers) | Built |
| Website scraping | Firecrawl + Jina | Built |
| Static scraping | Cheerio | In deps |
| JS rendering | Playwright | In deps |
| Free LLM extraction | Groq (14.4k req/day), Gemini, DeepSeek | Configured |
| Embeddings | OpenAI text-embedding-3-small | Running |
| Vector search | pgvector + HNSW | Running |
| Database | Supabase | Running |
| Hosting | Vercel | Running |

## The Moat

1. **ACNC + Financial Data**: 360k records, 7 years of giving history — no other platform has this depth
2. **Foundation Profiles**: AI-enriched with giving philosophy, application tips, board members — unique intel
3. **Comprehensiveness**: Government + foundation + corporate + research in one searchable index
4. **Semantic Search**: Natural language queries across all funding sources
5. **Open**: Free to search, moving toward open data standard
6. **Living Data**: Automated discovery, enrichment, freshness checks
