# GrantScope Australia

**Open-source funding transparency platform for Australia.**

Australia's philanthropic sector moves **$18.9 billion** in donations annually, but there's no single place to see who funds what, where, and how much. GrantScope assembles the fragments into one searchable, public platform.

**[Read why this matters →](WHY.md)**

## Three Layers of Funding Intelligence

1. **Government Grants** — 400+ opportunities from GrantConnect, state portals, data.gov.au
2. **Philanthropic Foundations** — 9,875 foundations profiled from the ACNC register
3. **Corporate Philanthropy** — ASX200 foundations mapped with giving vs revenue transparency

## Current Database

| Dataset | Count | Source |
|---------|------:|--------|
| Foundations | 9,875 | ACNC Register (complete) |
| Profiled (high + medium confidence) | 777 | AI-powered analysis |
| Grant opportunities | 400+ | 24 government sources |
| Foundation programs | 472 | Website scraping |
| VIP foundations | 46 | AFR, Forbes, CSI verified |

## Architecture

```
packages/
  grant-engine/          # Pluggable discovery engine
    src/sources/         # GrantConnect, data.gov.au, QLD, web search, LLM
    src/foundations/      # ACNC import, web scraping, AI profiling
apps/
  web/                   # Public Next.js app (coming soon)
scripts/                 # Discovery crons, ACNC import, foundation profiling
supabase/migrations/     # Database schema
```

## Data Sources

| Source | Type | Format | Cost |
|--------|------|--------|------|
| ACNC Register | 9,875 foundations | CSV | Free |
| GrantConnect RSS | Federal grants | XML via Firecrawl | ~$0.01/day |
| data.gov.au | Government datasets | CKAN API | Free |
| QLD Grants Finder | State grants | CKAN API | Free |
| business.gov.au | Aggregated grants | Scrape | ~$0.01/day |
| Foundation websites | Programs, annual reports | Jina Reader + Firecrawl | ~$5/month |

**Total operating cost: ~$6/month**

## Quick Start

```bash
pnpm install
cp .env.example .env     # Add your API keys

# Import ACNC foundation register
pnpm sync-acnc

# Run grant discovery
pnpm discover

# Profile foundations (AI-powered)
npx tsx --env-file=.env scripts/reprofile-low-confidence.mjs --include-unenriched --limit=200

# Start the web app
pnpm dev
```

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FIRECRAWL_API_KEY=          # For GrantConnect + site scraping
GROQ_API_KEY=               # Free LLM provider (llama-3.3-70b)
OPENAI_API_KEY=             # gpt-4o-mini for foundation profiling
MINIMAX_API_KEY=            # Additional LLM provider
```

## Key Research Findings

From our [deep research into Australian philanthropy](WHY.md):

- **82%** of tax benefits from charitable deductions go to the **top income decile**
- **71%** of the benefit goes to donations over **$1 million/year**
- Donor participation has **fallen from 35.1% to 27.8%** over the past decade
- **Environment** and **international affairs** receive less than **5.3% combined** of structured philanthropic distributions
- There is **no single official "total philanthropy" figure** in Australia

## Contributing

We welcome contributions from developers, researchers, philanthropic professionals, and anyone who cares about funding equity in Australia.

- **Data issues**: Found incorrect foundation data? Open an issue.
- **New sources**: Know of a grant portal we're missing? Let us know.
- **Research**: Working on Australian philanthropy? We'd love to collaborate.

## License

MIT
