# GrantScope Australia

**Open-source funding transparency platform for Australia.**

Three layers of funding intelligence:
1. **Government Grants** — every portal, always current
2. **Philanthropic Foundations** — every trust, every program, annual report data
3. **Corporate Philanthropy** — ASX200 foundations, giving vs revenue transparency

## Architecture

```
packages/
  grant-engine/          # Pluggable discovery engine (sources, dedup, storage)
apps/
  web/                   # Public Next.js app (search, browse, transparency)
scripts/                 # Discovery crons, ACNC import, foundation profiling
supabase/migrations/     # Database schema
```

## Data Sources

| Source | Type | Format | Cost |
|--------|------|--------|------|
| GrantConnect RSS | Federal grants | XML via Firecrawl | ~$0.01/day |
| ACNC Register | Foundations | CSV (FREE) | $0 |
| data.gov.au | Government datasets | CKAN API (FREE) | $0 |
| QLD Grants Finder | State grants | CKAN API (FREE) | $0 |
| business.gov.au | Aggregated grants | Scrape via Firecrawl | ~$0.01/day |

## Quick Start

```bash
pnpm install
cp .env.example .env     # Add your API keys

# Run grant discovery
pnpm discover

# Import ACNC foundation register
pnpm sync-acnc

# Start the web app
pnpm dev
```

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=          # For web search + LLM knowledge sources
FIRECRAWL_API_KEY=          # For GrantConnect + business.gov.au scraping
```

## License

MIT
