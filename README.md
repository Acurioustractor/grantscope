# GrantScope

**Australia's open funding intelligence platform. Trace where money flows, who holds power, and what communities actually need.**

GrantScope connects the dots between government grants, philanthropic foundations, political donations, government contracts, corporate accountability registers, and 92,000+ entities — all cross-referenced by ABN. No equivalent exists in Australia. We're building it.

**Free for communities. Open data, open source, open access.**

## What This Does

GrantScope is a **transparency and funding intelligence platform** that:

1. **Aggregates** grants, foundations, charities, political donations, government contracts, modern slavery statements, and lobbying registers from 30+ public data sources
2. **Builds an entity graph** — 92,000+ entities and 50,000+ relationships linked by ABN, revealing who funds whom, who contracts with government, and who donates to political parties
3. **Enriches** records with AI-generated descriptions, sector tags, geographic focus, and SEIFA disadvantage indexing
4. **Investigates** — 15 live analytical reports including the flagship finding: 140 entities donate $80M to political parties AND hold $4.7B in government contracts
5. **Serves** community organisations with free grant search, foundation matching, and place-based funding intelligence

## The Flagship Finding

**140 entities in Australia donate to political parties AND hold government contracts.** Together they donated $80M to 28 parties and received $4.7B in contracts. That's a 58x return per dollar donated. Both major parties benefit — this is structural, not partisan.

See the full investigation: `/reports/donor-contractors`

## Entity Graph (92,000+ entities)

The core of GrantScope is the **entity graph** — a unified registry linking every dataset by ABN:

| Layer | Records | What it reveals |
|-------|--------:|----------------|
| Entity Registry | 92,303 | Unified entities (companies, charities, foundations, Indigenous corps, government bodies) |
| Relationships | 50,425 | Donations, contracts, grants, lobbying, charity links, directorships |
| Political Donations | 188,609 | AEC disclosure records (1998–2024) |
| Government Contracts | 58,128 | Federal procurement via AusTender |
| Modern Slavery Register | 16,473 | Entities with $100M+ revenue and their supply chain statements |
| ACNC Charities | 64,473 | Every registered charity with 7 years of financials |
| Grant Opportunities | 17,727 | Government + philanthropic grants from all states |
| Foundations | 10,763 | Philanthropic foundations with AI-generated profiles |
| Lobbying Register | 139 | NSW third-party lobbyist firms and their clients |
| Social Enterprises | 3,541 | B Corps, social traders, Indigenous enterprises |
| ORIC Corporations | 7,369 | Indigenous corporations register |
| ASIC Companies | 2,149,868 | Company name → ABN lookup for entity resolution |

### Entity Dossier ("ABN X-Ray")

Every entity has a full dossier at `/entities/[gsId]` showing:
- Political donations (by party, aggregated, with premium gating)
- Government contracts (with buyer names, categories, procurement method)
- ACNC financial history (8 years: revenue, expenses, assets, surplus)
- Justice funding (cross-platform from JusticeHub)
- Location intelligence (postcode, remoteness, SEIFA disadvantage decile)
- Network relationships (connected entities, data source cross-references)
- Grant programs (if foundation)
- Modern slavery reporting status
- Confidence scoring and match methodology

### Cross-Reference Findings

- **Donor → Contract:** 140 entities donate to parties AND hold contracts ($80M donated, $4.7B contracts)
- **Both-sides donors:** Majority donate to BOTH Labor and Liberal/National — hedging their bets
- **ORIC → ACNC:** 41% of Indigenous corporations linked to ACNC charity records
- **Donor → Entity:** 5,361 political donor names resolved to ABNs via entity matching
- **Modern Slavery → Entity Graph:** 4,320 entities already in graph enriched with $100M+ revenue data

## Reports

15 live analytical reports at `/reports/`:

| Report | What it shows |
|--------|--------------|
| **Donor-Contractors** | 140 entities that donate AND contract — the flagship investigation |
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

## Architecture

```
apps/
  web/                    # Next.js 14 public web app (App Router)
    src/app/
      grants/             # Grant search and discovery
      foundations/         # Foundation profiles and search
      charities/          # Charity lookup and claims
      entities/           # Entity graph explorer + dossier pages
      reports/            # 15 analytical reports
      places/             # Place-based funding intelligence
      tracker/            # Saved grants and foundations
      social-enterprises/ # Social enterprise directory
      ops/                # Admin tools (claims review)
      api/                # 40+ API routes
scripts/                  # 50+ data pipeline scripts
  enrich-*.mjs            # Multi-provider LLM enrichment
  import-*.mjs            # Data source importers (Modern Slavery, Lobbying, etc.)
  sync-*.mjs              # Ongoing sync pipelines
  scrape-*.mjs            # Web scraping pipelines
  build-entity-graph.mjs  # Entity graph builder (10 source tables → unified graph)
supabase/
  migrations/             # Database schema (PostgreSQL)
```

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS (Bauhaus design system)
- **Database:** Supabase (PostgreSQL) with materialized views for analytics
- **Entity Graph:** 92K entities, deterministic GS ID system (`AU-ABN-*`, `AU-ACN-*`, `AU-ORIC-*`)
- **AI Enrichment:** Multi-provider LLM rotation (Groq, Gemini, Minimax, DeepSeek) with automatic fallback
- **Data Pipelines:** Node.js scripts with Cheerio for web scraping
- **Auth:** Supabase Auth with org team model and Stripe billing
- **Search:** Full-text search with embedding-based semantic matching (OpenAI)

## Data Pipeline Design

### Multi-Provider LLM Enrichment

Enrichment scripts rotate across free/cheap LLM providers to avoid rate limits:

```
Groq (llama-3.3-70b) → Gemini (2.5-flash) → Minimax (M2.5) → DeepSeek → fallback
```

Each provider auto-disables on rate limit errors. A **JSON salvage** mechanism recovers descriptions from truncated LLM responses (common with Gemini), preventing data loss.

### Entity Graph Build

The entity graph unifies 10+ source tables into `gs_entities` + `gs_relationships`:

1. **ACNC charities** → entity + charity_link relationships
2. **AEC political donations** → entity + donation relationships
3. **AusTender contracts** → entity + contract relationships
4. **ORIC Indigenous corporations** → entity + registered_as relationships
5. **Modern Slavery Register** → entity enrichment (revenue bands, industry sectors)
6. **Lobbying Register** → entity + lobbies_for relationships
7. **ATO tax data** → entity enrichment (tax payable)
8. **ASX companies** → entity + listed_as relationships
9. **Social enterprises** → entity + listed_as relationships
10. **ASIC companies** → ABN resolution backbone

Deterministic GS IDs (`gs_make_id()`) enable idempotent rebuilds without duplicates.

### Deterministic ACNC Extraction

For fields derivable without AI, bulk-extract from ACNC structured data:

- **Thematic focus:** Maps ACNC purpose fields to standard tags (78% coverage)
- **Geographic focus:** State from address + operating states (97% coverage)
- **Target recipients:** ACNC beneficiary fields to labels (76% coverage)

Zero LLM cost for these fields.

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
node scripts/import-modern-slavery.mjs       # 16K Modern Slavery entities
node scripts/import-lobbying-register.mjs    # NSW lobbyist firms

# Build the entity graph
node scripts/build-entity-graph.mjs          # Unify all sources

# Enrich with AI descriptions
node scripts/enrich-foundations.mjs --limit=500

# Start the web app
cd apps/web && pnpm dev
```

## Why This Matters

- **94%** of charitable donations go to just **10%** of organisations
- First Nations communities receive **0.5%** of philanthropic funding
- Women and girls get **12%**
- The 16,000 smallest charities posted a collective net loss of **$144 million** last year
- **No single official "total philanthropy" figure** exists in Australia
- Community-based organisations are often the last to hear about funding opportunities
- 140 entities donate to political parties AND hold $4.7B in government contracts

GrantScope makes the invisible visible. Open data, open source, open access.

## Who Built This

GrantScope is a project of [A Curious Tractor (ACT)](https://act.place) — a regenerative innovation ecosystem founded by Benjamin Knight and Nicholas Marchesi OAM. ACT partners with marginalised communities (especially First Nations) to build tools that transfer institutional power to community-led initiatives.

Free for communities. Institutions pay so communities don't have to.

## Contributing

We welcome contributions from developers, researchers, philanthropic professionals, and anyone who cares about funding equity in Australia.

- **Data issues:** Found incorrect data? Open an issue.
- **New sources:** Know of a grant portal we're missing? Let us know.
- **Research:** Working on Australian philanthropy? We'd love to collaborate.

## License

MIT
