# CivicGraph

**Decision infrastructure for Australian government and social sector. Know who to fund. Know who to contract. Know it worked.**

CivicGraph is the decision layer that connects 100,000+ entities, 672,000+ contracts, 312,000+ political donations, and 18,000+ grant opportunities into a unified intelligence platform — all cross-referenced by ABN. Nothing like this exists in Australia.

**Free for communities. Institutions pay so communities don't have to.**

## What This Does

CivicGraph is **decision infrastructure** that powers three products:

1. **Procurement Intelligence** — supplier discovery, compliance checking, Indigenous/social enterprise verification across 672K federal contracts and 10K social enterprises
2. **Allocation Intelligence** — place-based funding gap analysis using SEIFA disadvantage, remoteness, and entity density across 2,900+ postcodes and 492 LGAs
3. **Governed Proof** — outcome evidence linking funding to results (coming — integrates JusticeHub + Empathy Ledger)

Built on a **unified entity graph** of 100,000+ organisations linked by ABN across 30+ public data sources, with 199,000+ relationships revealing who funds whom, who contracts with government, and who donates to political parties.

## The Flagship Finding

**140 entities in Australia donate to political parties AND hold government contracts.** Together they donated $80M to 28 parties and received $4.7B in contracts. That's a 58x return per dollar donated. Both major parties benefit — this is structural, not partisan.

See the full investigation: `/reports/donor-contractors`

## Entity Graph (100,000+ entities)

The core of CivicGraph is the **entity graph** — a unified registry linking every dataset by ABN:

| Layer | Records | What it reveals |
|-------|--------:|----------------|
| Entity Registry | 100,036 | Unified entities (companies, charities, foundations, Indigenous corps, government bodies) |
| Relationships | 199,001 | Donations, contracts, grants, governance, charity links |
| AusTender Contracts | 672,474 | Full federal procurement history |
| ACNC Annual Statements | 370,468 | 7 years of charity financials (2017–2023) |
| Political Donations | 312,182 | AEC disclosure records (1998–2024) |
| ACNC Charities | 66,431 | Every registered charity |
| Justice Funding | 52,133 | QLD, federal, cross-sector justice/social services |
| Entity Identifiers | 30,934 | ABN, ACN, ORIC ICE, Supply Nation cross-references |
| ATO Tax Transparency | 23,909 | Large company tax data |
| Grant Opportunities | 18,069 | Government + philanthropic grants from all states |
| Foundations | 10,779 | Philanthropic foundations with AI-generated profiles |
| Social Enterprises | 10,339 | Supply Nation + Social Traders + B Corps |
| ORIC Corporations | 7,523 | Indigenous corporations register |
| Foundation Programs | 2,472 | Linked grant programs |
| ASX Companies | 1,976 | Listed companies with market cap |
| ASIC Companies | 2,176,163 | Company name → ABN lookup for entity resolution |

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

- **Donor → Contract:** 140 entities donate to political parties AND hold government contracts ($80M donated, $4.7B contracts)
- **Both-sides donors:** Majority donate to BOTH Labor and Liberal/National — hedging their bets
- **ORIC → ACNC:** 41% of Indigenous corporations linked to ACNC charity records
- **Donor → Entity:** 5,361 political donor names resolved to ABNs via entity matching
- **Entity Resolution F1:** 94.1% (precision 99.9%, recall 89.0%)
- **Geographic Coverage:** 96% postcode, 96% remoteness, 95% LGA, 94% SEIFA across 100K entities
- **Community-Controlled:** 7,822 organisations classified (ORIC + name-pattern matching)

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
  web/                    # Next.js 15 public web app (App Router)
    src/app/
      grants/             # Grant search and discovery
      foundations/         # Foundation profiles and search
      charities/          # Charity lookup and claims
      entities/           # Entity graph explorer + dossier pages
      reports/            # 15 analytical reports
      places/             # Place-based funding intelligence
      tracker/            # Saved grants and foundations
      knowledge/          # Document upload, AI extraction, org Q&A
      social-enterprises/ # Social enterprise directory
      tender-intelligence/# Procurement compliance tools
      power/              # Money flow analysis + Sankey diagrams
      alerts/             # Grant alert preferences
      pipeline/           # Grant application pipeline
      mission-control/    # Agent monitoring & control
      ops/                # Admin tools (claims review)
      api/                # 76 API routes
scripts/                  # 48 data pipeline agents
  enrich-*.mjs            # Multi-provider LLM enrichment
  import-*.mjs            # Data source importers (Modern Slavery, Lobbying, etc.)
  sync-*.mjs              # Ongoing sync pipelines
  scrape-*.mjs            # Web scraping pipelines
  build-entity-graph.mjs  # Entity graph builder (10 source tables → unified graph)
supabase/
  migrations/             # Database schema (PostgreSQL)
```

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind 4 (Bauhaus design system)
- **Database:** Supabase (PostgreSQL + pgvector) with 100+ tables, 7 materialized views
- **Entity Graph:** 100K entities, deterministic GS ID system (`AU-ABN-*`, `AU-ACN-*`, `AU-ORIC-*`), F1 94.1%
- **AI Enrichment:** 9 LLM providers in round-robin (Groq, Gemini, DeepSeek, OpenAI, Anthropic, Perplexity, Kimi, Minimax, Gemini grounded)
- **Data Pipelines:** 48 agents with orchestrator, scheduling, and Mission Control dashboard
- **Auth:** Supabase Auth with org team model and Stripe billing (5 tiers)
- **Search:** Full-text + pgvector semantic search (OpenAI text-embedding-3-small, 1536 dims)

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

- **$107 billion** in government funding flows through systems with no unified intelligence layer
- **672,000 federal contracts** awarded with no cross-reference to political donations or community need
- **140 entities** donate to political parties AND hold $4.7B in government contracts — a 58x return
- First Nations communities receive **0.5%** of philanthropic funding
- **No single platform** maps the flow of public money from allocation to outcome
- Community-based organisations are the last to hear about opportunities and the first to lose funding

CivicGraph makes the invisible visible. Decision infrastructure, not just data.

## Who Built This

CivicGraph is a project of [A Curious Tractor (ACT)](https://act.place) — a regenerative innovation ecosystem founded by Benjamin Knight and Nicholas Marchesi OAM. ACT partners with marginalised communities (especially First Nations) to build tools that transfer institutional power to community-led initiatives.

Free for communities. Institutions pay so communities don't have to.

## Contributing

We welcome contributions from developers, researchers, philanthropic professionals, and anyone who cares about funding equity in Australia.

- **Data issues:** Found incorrect data? Open an issue.
- **New sources:** Know of a grant portal we're missing? Let us know.
- **Research:** Working on Australian philanthropy? We'd love to collaborate.

## License

MIT
