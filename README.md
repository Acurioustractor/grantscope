# GrantScope

**Australia's open grants data infrastructure. The 360Giving equivalent that doesn't exist yet.**

Australia moves **$18.9 billion** in charitable donations annually, but there is no single place to see who funds what, where, and how much. GrantScope assembles fragments from government portals, charity registers, political donation disclosures, and procurement databases into one searchable, cross-referenced platform.

The goal: community-based organisations that value relationship and cultural understanding should have **equal access to funding**. Make the invisible visible.

## What This Project Does

GrantScope is a **data aggregation and transparency platform** that:

1. **Collects** grants, foundations, charities, political donations, and government contracts from 30+ public data sources across Australia
2. **Enriches** records with AI-generated descriptions, thematic tags, geographic focus, and beneficiary information
3. **Cross-references** datasets using ABN (Australian Business Number) matching to reveal connections — e.g., which political donors also hold government contracts
4. **Presents** the data through a public web app with search, reports, and analytical tools

## Database (2.5M+ records)

| Dataset | Records | Description | Sources |
|---------|--------:|-------------|---------|
| ASIC Company Names | 2,149,868 | Company name → ABN lookup for entity matching | ASIC bulk extract |
| Political Donations | 188,609 | AEC Transparency Register disclosures | AEC annual returns |
| ACNC Charities | 64,473 | Every registered charity in Australia | ACNC Register |
| AusTender Contracts | 58,128 | Federal government procurement contracts | AusTender OCDS API |
| Grant Opportunities | 17,529 | Government + philanthropic grants from all states | 30+ portals |
| Foundations | 10,763 | Philanthropic foundations profiled with giving data | ACNC + AI enrichment |
| ORIC Corporations | 7,369 | Indigenous corporations register | ORIC public register |
| Donor Entity Matches | 5,361 | Political donor → ABN resolution | ABN/name matching |
| Foundation Programs | 2,378 | Individual grant programs within foundations | Website scraping |

### Grant Sources

Grants are aggregated from federal, state, and local government portals plus philanthropic foundations:

- **Federal:** GrantConnect, ARC, NHMRC, data.gov.au, NIAA, IBA, ILSC
- **State:** NSW, VIC, QLD, SA, WA, TAS, NT, ACT grant portals
- **Local:** Brisbane City Council community grants
- **Arts:** QLD Arts Data, Regional Arts Australia
- **Philanthropic:** 1,532 foundation program grants from website scraping

### Cross-Reference Analysis

GrantScope links datasets by ABN to surface patterns:

- **Donor → Contract:** 185 entities that both donate to political parties AND hold government contracts
- **ORIC → ACNC:** 41% of registered Indigenous corporations linked to ACNC charity records
- **Grant → Foundation:** 31% of grants linked to their source foundation (remainder are government-sourced)
- **Donor → Entity:** 5,361 political donor names resolved to ABNs via ASIC/ACNC name matching

## Architecture

```
apps/
  web/                    # Next.js 14 public web app (App Router)
    src/app/
      grants/             # Grant search and discovery
      foundations/         # Foundation profiles and search
      charities/          # Charity lookup and claims
      reports/            # 14 analytical reports (see below)
      tracker/            # Saved grants and foundations
      ops/                # Admin tools (claims review)
      api/                # 40+ API routes
scripts/                  # 43 data pipeline scripts
  enrich-*.mjs            # Multi-provider LLM enrichment
  import-*.mjs            # Data source importers
  sync-*.mjs              # Ongoing sync pipelines
  scrape-*.mjs            # Web scraping pipelines
supabase/
  migrations/             # Database schema (PostgreSQL)
```

### Reports

14 analytical reports at `/reports/`:

| Report | What it shows |
|--------|--------------|
| Data Quality Scorecard | Field completeness across all datasets |
| Funding Equity | Political donor ↔ government contract cross-reference |
| Power Map | Network visualisation of money flows |
| Power Dynamics | Who holds power in Australian philanthropy |
| Big Philanthropy | Top foundations by giving |
| Community Power | Community-controlled funding analysis |
| Community Parity | Gap between community need and funding received |
| Access Gap | Geographic and demographic funding disparities |
| Money Flow | Tracing money from extraction to community |
| Cross-Reference | ABN-linked entity analysis across datasets |
| Social Enterprise | B Corps, social traders, and Indigenous enterprises |
| State of the Nation | National philanthropy overview |
| Youth Justice | Youth justice spending and outcomes |
| Architecture | System design documentation |

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL) with materialized views for analytics
- **AI Enrichment:** Multi-provider LLM rotation (Groq, Gemini, Minimax, DeepSeek) with automatic fallback
- **Data Pipelines:** Node.js scripts with Cheerio for web scraping
- **Auth:** Supabase Auth with charity claim/verification flow
- **Search:** Full-text search with embedding-based semantic matching

## Data Pipeline Design

### Multi-Provider LLM Enrichment

Enrichment scripts rotate across free/cheap LLM providers to avoid rate limits:

```
Groq (llama-3.3-70b) → Gemini (2.5-flash) → Minimax (M2.5) → DeepSeek → fallback
```

Each provider auto-disables on rate limit errors. A **JSON salvage** mechanism recovers descriptions from truncated LLM responses (common with Gemini), preventing data loss.

### Deterministic ACNC Extraction

For fields that can be derived without AI, we bulk-extract from ACNC's structured charity data:

- **Thematic focus:** Maps ACNC purpose fields (Advancing_Health → health, etc.) to standard tags
- **Geographic focus:** Extracts state from registered address + operating states (ISO 3166-2:AU codes)
- **Target recipients:** Maps ACNC beneficiary fields to human-readable labels

This gives 78% thematic coverage, 97% geographic coverage, and 76% recipient coverage at zero LLM cost.

### Entity Resolution

Political donors are matched to ABNs using:

1. `normalize_company_name()` — strips PTY/LTD/INC suffixes, trustee clauses, possessives
2. Exact match against ASIC company name lookup (2.1M records, trigram-indexed)
3. Trigram similarity matching for fuzzy cases
4. Results stored in `donor_entity_matches` with confidence scores

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env   # Add your API keys

# Import core datasets
node scripts/sync-acnc-charities.mjs        # 64K charities
node scripts/import-oric-register.mjs        # 7K Indigenous corps
node scripts/import-gov-grants.mjs           # State grant portals
node scripts/sync-austender-contracts.mjs    # Federal contracts
node scripts/import-aec-donations.mjs        # Political donations

# Enrich with AI descriptions
node scripts/enrich-foundations.mjs --limit=500
node scripts/enrich-oric-corporations.mjs --limit=500

# Start the web app
cd apps/web && pnpm dev
```

## Environment Variables

```
SUPABASE_URL=                    # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (backend only)
NEXT_PUBLIC_SUPABASE_URL=        # Public URL for frontend
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Anon key for frontend

# LLM Providers (for enrichment — at least one required)
GROQ_API_KEY=                    # Free tier: llama-3.3-70b
GEMINI_API_KEY=                  # Free tier: gemini-2.5-flash
MINIMAX_API_KEY=                 # MiniMax-M2.5
DEEPSEEK_API_KEY=                # DeepSeek chat

# Optional
OPENAI_API_KEY=                  # Embeddings for semantic search
```

## Why This Matters

From our [research into Australian philanthropy](WHY.md):

- **82%** of tax benefits from charitable deductions go to the **top income decile**
- **71%** of the benefit goes to donations over **$1 million/year**
- Donor participation has **fallen from 35.1% to 27.8%** over the past decade
- **No single official "total philanthropy" figure** exists in Australia
- Community-based organisations are often the last to hear about funding opportunities

GrantScope exists to change that. Open data, open source, open access.

## Who Built This

GrantScope is a project of [A Curious Tractor (ACT)](https://act.place) — a regenerative innovation ecosystem founded by Benjamin Knight and Nicholas Marchesi OAM. ACT partners with marginalised communities (especially First Nations) to build tools that transfer institutional power to community-led initiatives.

## Contributing

We welcome contributions from developers, researchers, philanthropic professionals, and anyone who cares about funding equity in Australia.

- **Data issues:** Found incorrect data? Open an issue.
- **New sources:** Know of a grant portal we're missing? Let us know.
- **Research:** Working on Australian philanthropy? We'd love to collaborate.

## License

MIT
