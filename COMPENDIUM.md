# CivicGraph System Compendium

> The complete technical reference for CivicGraph (GrantScope). Updated 2026-03-10.

## Architecture Overview

**Stack:** Next.js 15 (Tailwind 4) + Supabase (Postgres + Storage + Auth) + 48 data pipeline agents

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                     │
│   /home  /grants  /tracker  /foundations  /knowledge  /places    │
│   /entities  /tender-intelligence  /power  /reports  /alerts     │
├──────────────────────────────────────────────────────────────────┤
│                         API Layer (76 routes)                    │
│   Search · Entities · Grants · Foundations · AI Chat · Knowledge │
│   Procurement · Billing · Mission Control · Power Analysis       │
├──────────────────────────────────────────────────────────────────┤
│                    Data Pipeline (48 agents)                     │
│   Sync · Import · Discovery · Enrichment · Profiling · Graph     │
│   Embedding · Analytics · Intelligence                           │
├──────────────────────────────────────────────────────────────────┤
│                    Supabase (Postgres + pgvector)                 │
│   100K entities · 200K relationships · 672K contracts            │
│   370K charity filings · 312K political donations · 18K grants   │
│   2.2M company records · 10K foundations · 10K social enterprises│
└──────────────────────────────────────────────────────────────────┘
```

---

## Database (100+ tables)

### Core Entity Graph
| Table | Rows | Purpose |
|-------|------|---------|
| `gs_entities` | 100K | Canonical entity registry — orgs, companies, government bodies |
| `gs_relationships` | 199K | Directed edges: donations, contracts, grants, governance |
| `entity_aliases` | 31K | Alternate names (trading, legal, abbreviations) |
| `entity_identifiers` | 31K | Cross-reference: ABN, ACN, ORIC ICE, Supply Nation ID |

### Government & Funding
| Table | Rows | Purpose |
|-------|------|---------|
| `austender_contracts` | 672K | Federal procurement contracts |
| `acnc_charities` | 66K | ACNC charity register |
| `acnc_ais` | 370K | Annual information statements (financials by year) |
| `justice_funding` | 52K | Justice/social services funding records |
| `political_donations` | 312K | AEC political party donations |
| `ato_tax_transparency` | 24K | Corporate tax data for large companies |
| `oric_corporations` | 7.5K | Indigenous corporations (ORIC register) |

### Grants & Foundations
| Table | Rows | Purpose |
|-------|------|---------|
| `grant_opportunities` | 18K | Grant programs from 10+ sources |
| `foundations` | 10K | Grantmaking foundations with profiles |
| `foundation_programs` | 2.5K | Specific grant programs offered by foundations |
| `social_enterprises` | 10K | Social Traders + Supply Nation + B Corps |

### Business Intelligence
| Table | Rows | Purpose |
|-------|------|---------|
| `asic_companies` | 2.2M | All Australian companies (ASIC register) |
| `asx_companies` | 2K | ASX-listed companies with market cap |

### Geographic & Demographic
| Table | Rows | Purpose |
|-------|------|---------|
| `postcode_geo` | 12K | Postcode → SA2, remoteness, LGA mapping |
| `seifa_2021` | 11K | SEIFA disadvantage scores & deciles by postcode |

### User & Organisation
| Table | Rows | Purpose |
|-------|------|---------|
| `org_profiles` | — | SaaS customer organisations |
| `saved_grants` | 229 | User grant tracking (Kanban) |
| `saved_foundations` | 34 | Foundation relationship tracking |
| `grant_answer_bank` | — | Reusable Q&A from past applications |
| `knowledge_sources` | — | Uploaded documents (PDF/DOCX/URL) |
| `knowledge_chunks` | — | Embedded text chunks for RAG |
| `wiki_pages` | — | Auto-generated knowledge wiki pages |

### Agent System
| Table | Rows | Purpose |
|-------|------|---------|
| `agent_runs` | 344 | Execution logs for all agents |
| `agent_schedules` | 20 | Cron-like scheduling config |
| `agent_registry` | 29 | Agent definitions & config |
| `agent_tasks` | 49 | Task queue for orchestrator |

### Materialized Views
| View | Rows | Purpose |
|------|------|---------|
| `mv_funding_by_lga` | 884 | Funding aggregated by LGA |
| `mv_funding_by_postcode` | 4K | Funding aggregated by postcode |
| `mv_gs_entity_stats` | 8K | Entity-level statistics rollup |
| `mv_org_justice_signals` | 65K | Justice funding flags per entity |
| `mv_gs_donor_contractors` | 342 | Entities that donate AND contract (conflict) |
| `mv_acnc_latest` | 64K | Latest ACNC snapshot per charity |
| `mv_data_quality` | 6 | Data quality metrics by dataset |

### Key RPCs
- `search_grants_semantic()` — Vector similarity search for grants
- `search_org_knowledge()` — Org-scoped knowledge chunk search
- `get_funding_gaps()` — Identify underserved areas
- `match_grants_for_org()` — Grant matching for org profiles
- `resolve_entity()` — Entity resolution by name/ABN
- `get_entity_by_identifier()` — Cross-reference lookup

---

## Agent Pipeline (48 agents, 9 categories)

### Categories & Counts
| Category | Count | Purpose |
|----------|-------|---------|
| **sync** | 9 | Pull data from government registries (ACNC, ORIC, AusTender, ATO, ASX, ASIC) |
| **import** | 15 | One-off data loads (AEC donations, ROGS, SEIFA, Supply Nation, B Corp) |
| **discovery** | 5 | Find new grants (multi-source scraping, state portals, deadline scraping) |
| **enrichment** | 8 | AI-powered descriptions, classifications, metadata extraction |
| **profiling** | 5 | Deep LLM profiling of foundations and community orgs |
| **graph** | 5 | Entity resolution, graph construction, community classification |
| **embedding** | 1 | OpenAI text-embedding-3-small for vector search |
| **analytics** | 3 | Materialized view refresh, money flow analysis |
| **intelligence** | 3 | Grant scouting, foundation alignment scoring, Notion pipeline sync |

### Top Agents by Usage (from 344 logged runs)
| Agent | Runs | Avg Duration | What it Does |
|-------|------|-------------|-------------|
| Profile Foundations | 72 | 16 min | Deep LLM profiling of grantmaking foundations |
| Enrich Grants (Free) | 59 | 7 min | Groq/MiniMax descriptions for grants |
| Grant Discovery | 47 | 2.4 min | Multi-source grant scraping |
| Sync Foundation Programs | 45 | 24s | Pull foundation program data |
| Backfill Embeddings | 37 | 23s | OpenAI embeddings for vector search |
| Build Entity Graph | 9 | 10 min | Consolidate 92K entities + 65K relationships |
| Refresh Materialized Views | 7 | 2.6s | SQL-only, fastest agent |

### Agent Execution Patterns

**1. Idempotent Upsert** (sync agents) — `onConflict: 'abn'` ensures safe reruns
**2. Multi-Source Discovery** — GrantEngine combines GrantConnect, data.gov.au, state portals, web search
**3. LLM Round-Robin** — 5 providers (MiniMax, Groq, Gemini, DeepSeek, Anthropic) with automatic failover on rate limits
**4. Graph Builder** — Pre-loads 92K entities into memory for O(1) lookups, batch inserts
**5. ABR Streaming** — Streams 1GB+ XML via `unzip -p | readline` sliding window

### Data Flows

```
Grant Discovery → Enrich Grants → Scout for Profiles → User Pipeline
                                                         ↓
Sync Agents → Build Entity Graph → Materialized Views → Dashboard
                                                         ↓
Foundation Profiling → Alignment Scoring → Foundation Tracker
```

### Adding a New Agent
1. Create `scripts/my-agent.mjs`
2. Import `{ logStart, logComplete, logFailed }` from `./lib/log-agent-run.mjs`
3. Register in `scripts/lib/agent-registry.mjs`
4. Add schedule: `INSERT INTO agent_schedules (agent_id, interval_hours, priority) VALUES (...)`

---

## API Routes (76 routes, 15 categories)

### Search & Discovery (7)
- `GET /api/search` — Text search grants/foundations
- `GET /api/search/semantic` — Vector similarity (OpenAI embeddings)
- `GET /api/global-search` — Unified search across all entities
- `POST /api/discover` — Grant discovery agent (API key)
- `GET /api/grants/match` — AI-scored matches for org
- `GET /api/alerts/matches` — Grants matching alert criteria
- `GET /api/profile/matches` — Feedback-adjusted vector matches

### Entities & Places (4)
- `GET /api/entities/[gsId]` — Entity dossier + relationships
- `GET /api/entities/[gsId]/place` — Geographic/SEIFA data
- `GET /api/entities/[gsId]/stories` — Impact stories (Empathy Ledger)
- `GET /api/places/[postcode]` — Place dossier with funding data

### Foundations (5)
- `GET /api/foundations` — List/filter foundations
- `GET /api/foundations/saved` — Tracked foundations
- `PUT|DELETE /api/foundations/saved/[id]` — Save/remove
- `GET|POST /api/foundations/notes` — Relationship notes
- `GET /api/simulator` — Funding landscape simulator

### Grant Tracking (4)
- `GET /api/tracker` — Kanban board data
- `PUT|DELETE /api/tracker/[grantId]` — Save/update + GHL sync
- `GET|POST /api/grants/[grantId]/feedback` — Thumbs voting for ML
- `GET /api/pipeline/*` — DEPRECATED → redirects to tracker

### Social Enterprises & Procurement (6)
- `GET /api/social-enterprises` — 10K+ SE directory
- `POST /api/procurement/analyse` — Compliance analysis
- `POST /api/tender-intelligence/discover` — Supplier discovery
- `POST /api/tender-intelligence/enrich` — Bulk enrichment
- `POST /api/tender-intelligence/compliance` — IPP scoring
- `POST /api/tender-intelligence/pack` — Full tender pack

### Knowledge & AI (6)
- `POST /api/chat` — RAG chat (Claude Haiku + vector search + org knowledge)
- `POST /api/query` — Natural language → SQL
- `POST|GET|DELETE /api/knowledge/ingest` — Upload docs (PDF/DOCX/URL)
- `POST /api/knowledge/process` — Background processor (chunking + embedding)
- `GET|POST|PUT|DELETE /api/answers` — Grant answer bank CRUD
- `POST /api/answers/extract` — AI document → Q&A extraction
- `POST /api/profile/enrich` — AI profile suggestions from docs

### Alerts (3)
- `GET|POST /api/alerts` — List/create alert preferences
- `PATCH|DELETE /api/alerts/[id]` — Update/delete alert
- `GET /api/alerts/matches` — Matching grants for alert

### User & Org (3)
- `GET|PUT /api/profile` — Org profile CRUD + embedding
- `POST /api/profile/enrich` — AI enrichment from knowledge
- `GET|POST|DELETE /api/team` — Team member management

### Billing (4)
- `POST /api/billing/checkout` — Stripe checkout session
- `POST /api/billing/portal` — Stripe billing portal
- `POST /api/billing/webhook` — Stripe webhook handler
- `GET /api/billing/check-access` — Premium status check

### Mission Control (7)
- `GET /api/mission-control` — Dashboard: inventory, power, agents
- `POST /api/mission-control/query` — Execute read-only SQL
- `GET|POST /api/mission-control/tasks` — Agent task queue
- `POST /api/mission-control/tasks/[id]/cancel` — Cancel task
- `GET /api/mission-control/schedules` — Agent schedules
- `PUT /api/mission-control/schedules/[id]` — Update schedule
- `GET /api/mission-control/registry` — Agent registry

### Power & Money Flows (5)
- `GET /api/power/flows` — Sankey diagram data
- `GET /api/power/place/[sa2Code]` — SA2 funding analysis
- `GET /api/power/network/[gsId]` — Entity network visualization
- `GET /api/power/map-data` — SA2 map overlay
- `GET /api/power/health` — Data coverage metrics

### Operations, Data & Auth (remaining)
- `GET /api/ops/health` — System health
- `GET /api/data` — RESTful data API
- `GET /api/data/export` — CSV/JSON export
- `GET /api/places/gaps` — Funding gap analysis
- `GET /api/insights` — System-wide statistics
- `POST /api/auth/signout` — Sign out
- `GET|POST /api/keys` — API key management

### Auth Patterns
| Pattern | Count | Example |
|---------|-------|---------|
| Public | 26 | `/api/search`, `/api/social-enterprises` |
| User auth | 43 | `/api/profile`, `/api/tracker`, `/api/chat` |
| API key | 2 | `/api/discover`, `/api/query` |
| Admin only | 1 | `/api/ops/claims` |
| Worker secret | 1 | `/api/knowledge/process` |

### External Integrations
- **Anthropic Claude** — Chat, query, extraction, enrichment
- **OpenAI** — Embeddings (text-embedding-3-small, 1536 dims)
- **GoHighLevel CRM** — Contact sync, opportunity pipeline
- **Stripe** — Billing, checkout, webhooks (5 tiers)
- **Empathy Ledger** — Impact story syndication
- **Gmail** — Notification emails

---

## Frontend Pages

### Logged-in App
| Route | Purpose |
|-------|---------|
| `/home` | Personalised dashboard |
| `/grants` | Search 18K+ grant opportunities |
| `/tracker` | Kanban board: saved grants pipeline |
| `/foundations` | Browse 10K foundations |
| `/foundations/tracker` | Foundation relationship management |
| `/alerts` | Grant alert preferences |
| `/knowledge` | Knowledge wiki: upload docs, Q&A, AI chat |
| `/profile` | Organisation profile |
| `/profile/answers` | Answer bank for grant applications |
| `/profile/matches` | AI-matched grants |
| `/settings` | API keys & account |

### Public Platform
| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/entities` | Entity graph explorer (99K entities) |
| `/entities/[gsId]` | Entity dossier: funding, contracts, relationships |
| `/places` | Place-based funding analysis |
| `/places/[postcode]` | Place dossier: geo, SEIFA, entities, funding |
| `/charities` | 64K charity directory |
| `/social-enterprises` | Social enterprise directory |
| `/tender-intelligence` | Procurement compliance tools |
| `/power` | Money flow Sankey diagrams |
| `/reports/*` | Research reports & investigations |
| `/mission-control` | Admin: agent monitoring & control |
| `/dashboard` | Public metrics dashboard |

### For Audiences
| Route | Audience |
|-------|----------|
| `/for/community` | Community organisations |
| `/for/funders` | Funders & philanthropists |
| `/for/government` | Government procurement officers |
| `/for/researchers` | Academic researchers |
| `/for/corporate` | Corporate social responsibility |
| `/for/foundations` | Foundation program managers |

---

## Data Coverage

### Entity Enrichment (as of 2026-03-10)
| Metric | Coverage |
|--------|----------|
| Postcode | 96.4% |
| Remoteness | 96.4% |
| LGA | 95.1% |
| SEIFA decile | 93.5% |
| Community-controlled | 7,801 orgs classified |

### Data Sources
| Source | Records | Frequency |
|--------|---------|-----------|
| ACNC Register | 66K charities | Weekly |
| AusTender | 672K contracts | Weekly |
| AEC Donations | 312K records | Quarterly |
| ATO Tax Transparency | 24K records | Annual |
| ASIC Companies | 2.2M records | Monthly |
| ORIC Corporations | 7.5K records | Monthly |
| ASX Companies | 2K records | Weekly |
| Supply Nation | 6K businesses | Monthly |
| Social Traders | 4K enterprises | Monthly |
| Justice/ROGS Funding | 52K records | Varied |

---

## Design System

**Bauhaus-inspired** — bold, geometric, high contrast.

### Tokens
- **Black:** `bauhaus-black` (borders, text, buttons)
- **Red:** `bauhaus-red` (alerts, admin, emphasis)
- **Blue:** `bauhaus-blue` (links, active states, CTAs)
- **Muted:** `bauhaus-muted` (secondary text, descriptions)
- **Canvas:** `bauhaus-canvas` (hover backgrounds)

### Patterns
- **Borders:** `border-4 border-bauhaus-black` (cards), `border-3` (buttons)
- **Text:** `font-black uppercase tracking-widest` (labels), `text-xs` (most UI text)
- **Buttons:** `text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black`
- **Cards:** `border-4 border-bauhaus-black bg-white`
- **Status badges:** `text-[10px] font-black uppercase tracking-wider px-2 py-0.5`
- **Shadow:** `bauhaus-shadow-sm` (dropdowns)

---

## Key Decision Log

| Decision | Rationale |
|----------|-----------|
| Same Supabase instance (GrantScope + JusticeHub + EmpathyLedger) | Simplicity, shared entities, single billing |
| Service role for all API routes (not RLS) | Simpler auth, org_profile_id scoping in application layer |
| 5 LLM providers with round-robin | Cost optimization: free tiers first, paid as fallback |
| Materialized views for analytics | Expensive aggregations cached, manual refresh |
| `gs_entities` + `gs_relationships` as core graph | Unified entity model across all data sources |
| Premium = `stripe_customer_id` presence | Simple gating, no tier column needed |
| Community-controlled = ORIC type + name pattern | Heuristic classification, 7.8K orgs matched |
| Gap score = external_share × disadvantage × remoteness | Identifies truly underserved communities |

---

## Development Workflow

```bash
# Start dev server
cd apps/web && pnpm dev

# Type check
cd apps/web && npx tsc --noEmit

# Query database
node --env-file=.env scripts/gsql.mjs "SELECT ..."

# Run migration
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f <file.sql>

# Run agent
node --env-file=.env scripts/<agent>.mjs [--apply] [--limit=N]

# Refresh materialized views
node --env-file=.env scripts/refresh-materialized-views.mjs
```

---

## Next Phase: Target Audiences & Communications

### Primary Audiences
1. **Community Organisations** — Find grants, track applications, build answer bank
2. **Government Procurement** — Supplier compliance, Indigenous/SE procurement targets
3. **Funders & Foundations** — Portfolio intelligence, funding gap analysis
4. **Researchers** — Open data, living reports, money flow analysis

### Revenue Products
1. **Tender Intelligence Packs** — $49-499/pack, compliance scoring for procurement officers
2. **Entity Dossiers** — Premium org profiles with full funding history
3. **Place Packs** — Community funding gap analysis by postcode/LGA
4. **Foundation Tracker** — Relationship management for grant seekers
5. **API Access** — Programmatic access to entity/grant/funding data

### Growth Channels
1. **Content/SEO** — Reports (Donor-Contractors, $222B, Community Parity) drive organic traffic
2. **Government procurement teams** — Direct outreach, conference talks
3. **Peak bodies** — ACOSS, state councils, philanthropy associations
4. **Academic partnerships** — Research data agreements
