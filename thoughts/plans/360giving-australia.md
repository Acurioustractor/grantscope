# GrantScope: Australia's 360Giving

## Vision

Build Australia's open grants infrastructure — the single most complete, searchable database of every funding opportunity in the country. Government grants, philanthropic foundations, corporate giving programs, research funding, and international funders active in Australia.

Australia has no 360Giving equivalent. The UK has 320+ funders publishing 1M+ grants in machine-readable format. Australia has GrantConnect (government only), Foundation Maps (members-only), and Funding Centre ($55-85/year). GrantScope fills this gap as open infrastructure.

## Current State (1 March 2026)

### Grants Database: `grant_opportunities` — 14,119 rows
- 100% embedded (pgvector, text-embedding-3-small, 1536 dims)
- Semantic search live via `/api/search/semantic`
- Hybrid search on grants page (auto-detect keyword vs natural language)

| Metric | Count | % |
|--------|------:|--:|
| Total grants | 14,119 | |
| With embeddings | 14,119 | 100% |
| Open opportunities | 6,271 | 44% |
| Historical awards | 7,848 | 56% |
| Has funding amount | 13,447 | 95% |
| Has URL | 14,018 | 99% |
| Has categories | 13,625 | 96% |
| Has deadline | 5,661 | 40% |
| Has description (>50 chars) | 7,539 | 53% |
| Has rich description (>500 chars) | 13 | 0.1% |
| Enrichment fields populated | ~20 | 0.1% |

**Sources active:** GrantConnect (129), ARC (5,598), Brisbane CC (5,529), QLD Arts (2,319), QLD Grants (148), TAS (103), ACT (95), GHL sync (93), data.gov.au (30), NHMRC (18), NSW (11), VIC (3), + ~45 manual/agent

### Foundations Database: `foundations` — 9,874 rows
- Derived from ACNC register (60k+ charities filtered to grantmakers)
- 34 columns including giving_philosophy, application_tips, board_members
- Multi-provider LLM enrichment pipeline built (Groq, Gemini, DeepSeek, OpenAI, Anthropic, Perplexity, Kimi, Minimax)

| Metric | Count | % |
|--------|------:|--:|
| Total foundations | 9,874 | |
| Has annual giving amount | 9,120 | 92% |
| Has website | 4,921 | 50% |
| Has thematic focus | 5,694 | 58% |
| **Enriched (LLM profiled)** | **1,627** | **16.5%** |
| Has website, NOT enriched | 3,304 | |
| No website, NOT enriched | 4,943 | |
| Has description | 247 | 2.5% |

**Enrichment sources:** firecrawl+multi-llm (1,075), firecrawl+claude (526), firecrawl+jina+multi-llm+vip (26)

### ACNC Annual Statements: `acnc_ais` — 359,678 rows
- 7 years of data (2017-2023), 65 columns
- Full financials: revenue, expenses, grants given (AU + intl), assets, staff
- **14,882 charities gave grants in 2023** totalling **$8.86 billion**
- `v_acnc_grant_makers` view identifies grantmaking orgs
- `v_acnc_latest` view for most recent year per charity

### Foundation Programs: `foundation_programs` — 866 rows
- Linked to 361 distinct foundations
- All have descriptions
- 185 have deadlines, 169 have amounts
- **0 have eligibility criteria** (biggest gap)

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

### Gaps (Priority Order)

#### 1. Foundation Enrichment Scale ($0, immediate)
- **3,304 foundations** have websites but haven't been enriched
- The profiler exists and works. It just needs to run on more foundations.
- Blocked by: LLM API quotas (already round-robins 8 providers)
- **Action:** Run profiler in batches, targeting foundations by total_giving_annual DESC

#### 2. Grant Description Enrichment ($0, 1-2 days)
- **6,244 grants** (44%) have no description at all
- **6,041 grants** have only short stubs (50-200 chars)
- Only 13 grants have rich descriptions (500+ chars)
- **Action:** Build Cheerio + Groq pipeline to crawl grant URLs and extract descriptions, eligibility, deadlines
- This dramatically improves semantic search quality

#### 3. Foundation ↔ Grant Linkage
- 866 foundation programs exist but aren't connected to grant_opportunities search
- Users searching grants don't see foundation programs
- **Action:** Either sync foundation_programs → grant_opportunities, or unify the search

#### 4. Eligibility Data
- 0 out of 866 foundation programs have eligibility criteria
- 0 out of 14,119 grants have structured eligibility (aside from ~20 manually enriched)
- **Action:** LLM extraction from grant/program URLs

#### 5. Missing Government Sources
- SA (South Australia) — no plugin yet
- WA (Western Australia) — no plugin yet
- VIC only has 3 grants (needs Firecrawl for JS SPA)
- NT has 0 grants (needs Firecrawl/Playwright)
- **Action:** Build SA + WA plugins, add Firecrawl for VIC/NT

#### 6. Freshness & Lifecycle
- Grants are inserted and never updated
- No staleness detection, no "grant closed" marking
- **Action:** Re-crawl URLs, detect closed/expired, daily discovery runs

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
