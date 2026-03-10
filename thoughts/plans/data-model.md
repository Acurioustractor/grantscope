# CivicGraph Data Model — The 360Giving Architecture

## Core Philosophy

> This is about leveling the playing field so that more community-based organisations that value relationship and cultural understanding at the core can build a more connected, genuine and authentic world.
>
> Australia was built on colonisation. Money made from mining. Families that have built the majority of wealth that is being hoarded, and relationships and ships driven when money flows. We are changing that.

The data model serves two sides of the same coin:
1. **Seekers** — Community orgs, First Nations groups, social enterprises who need funding
2. **Givers** — Foundations, government, corporate programs who need to find the right partners

Both sides get transparency. Both sides get matched. The model traces money from its source (mining, finance, retail) through foundations and government, down to community impact. Nothing is hidden.

---

## Entity Relationship Diagram

```
                                    ┌─────────────────┐
                                    │   ACNC Register  │
                                    │   (359,678 AIS)  │
                                    └────────┬────────┘
                                             │ ABN lookup
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
                    │ FOUNDATIONS  │  │ COMMUNITY    │  │ CORPORATES   │
                    │  (10,779)   │  │ ORGS (541)   │  │ (via ASX/ABN)│
                    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
                           │                │                  │
                   ┌───────┴───────┐        │                  │
                   ▼               ▼        │                  │
          ┌────────────┐  ┌────────────┐    │                  │
          │ FOUNDATION │  │ OPEN       │    │                  │
          │ PROGRAMS   │  │ PROGRAMS   │    │                  │
          │  (2,472)   │  │ (JSON)     │    │                  │
          └──────┬─────┘  └────────────┘    │                  │
                 │                          │                  │
                 ▼                          │                  │
    ┌────────────────────────┐              │                  │
    │   GRANT OPPORTUNITIES  │◄─────────────┘                  │
    │       (18,069)         │              (applies to)       │
    │                        │                                 │
    │  gov + foundation +    │◄────────────────────────────────┘
    │  corporate + research  │         (corporate programs)
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐      ┌─────────────────┐
    │   GS_RELATIONSHIPS     │◄────►│   GOVERNMENT    │
    │     (211,783)          │      │   PROGRAMS      │
    │  entity → entity       │      └─────────────────┘
    │  with amounts + years  │
    └────────────────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │   ORG PROFILES         │
    │   (seekers who sign up)│
    │   match against grants │
    └────────────────────────┘
```

---

## Tables: What Exists + What's Needed

### TIER 1: Core Data (EXISTS — needs connecting)

#### `acnc_ais` — 359,678 rows ✅
The bedrock. 7 years of annual financial statements for 53,000+ charities.
- Shows who gives grants, who receives government money, who has what assets
- `grants_donations_au` + `grants_donations_intl` = total giving
- `revenue_from_government` = government dependency
- `giving_ratio_pct` (via view) = how much flows through vs hoarded

#### `foundations` — 10,779 rows ✅
Every significant grantmaking entity in Australia.
- 34 columns: financials, focus areas, giving philosophy, application tips
- Derived from ACNC filtered for grantmakers
- 3,264 enriched with AI profiling (30% — descriptions, tips, board members)
- **Links to:** acnc_ais (via ABN), foundation_programs (FK)

#### `foundation_programs` — 2,472 rows ✅
Specific funding programs from foundations.
- Name, description, amount range, deadline, status
- **Links to:** foundations (FK)

#### `grant_opportunities` — 18,069 rows ✅
All discoverable grants from government + some foundations.
- 41 columns, 100% embedded for semantic search
- 30+ automated source plugins

#### `gs_entities` — 100,036 rows ✅
Unified entity registry linking all datasets by ABN.
- Entity types: charity (52K), company (24K), foundation (10.7K), indigenous_corp (7.3K), social_enterprise (5.2K), government_body (134)
- Geo coverage: postcode 90%, remoteness 96%, LGA 90%, SEIFA 89%
- 7,822 community-controlled organisations classified

#### `gs_relationships` — 211,783 rows ✅
Every connection between entities — the graph.
- Types: contract (170K), donation (36K), grant (5.4K), and more
- Links donations, contracts, grants, tax, justice funding

#### `austender_contracts` — 670,303 rows ✅
Full federal procurement history from 2013 via OCDS API.

#### `political_donations` — 312,933 rows ✅
Full AEC disclosure register.

#### `ato_tax_transparency` — 26,241 rows ✅
Full large taxpayer dataset — income, taxable income, tax payable.

#### `justice_funding` — 52,133 rows ✅
Cross-sector justice funding flows from JusticeHub.

#### `social_enterprises` — 10,339 rows ✅
Supply Nation + Social Traders + B Corp + state networks.

#### `community_orgs` — 541 rows ✅
Grassroots organisations, the seekers.
- Programs, outcomes, admin burden tracking

### TIER 2: Tables Added Since Initial Plan

#### `org_profiles` — EXISTS
**Purpose:** Any organisation can create a profile to get matched with grants.
Uses ACNC data automatically if they have an ABN. Includes Stripe billing integration (`stripe_customer_id`, `subscription_plan`).

```sql
CREATE TABLE org_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  acnc_abn TEXT UNIQUE,              -- links to ACNC data automatically
  name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  logo_url TEXT,

  -- What they do
  mission TEXT,                       -- their mission statement
  focus_areas TEXT[],                 -- ['indigenous', 'youth', 'environment', 'arts']
  geographic_scope TEXT[],            -- ['AU-QLD', 'AU-NSW', 'Remote']
  beneficiaries TEXT[],               -- ['first_nations', 'youth', 'elderly', 'refugees']
  programs JSONB,                     -- [{name, description, outcomes}]

  -- Capacity
  org_size TEXT,                      -- 'micro' | 'small' | 'medium' | 'large'
  annual_revenue DECIMAL(14,2),
  staff_count INTEGER,
  volunteer_count INTEGER,
  years_operating INTEGER,

  -- Grant readiness
  abn_registered BOOLEAN DEFAULT false,
  dfv_check BOOLEAN DEFAULT false,    -- deductible gift recipient
  acnc_registered BOOLEAN DEFAULT false,
  insurance_current BOOLEAN DEFAULT false,
  audited_financials BOOLEAN DEFAULT false,

  -- Matching preferences
  grant_size_min DECIMAL(12,2),       -- what size grants they want
  grant_size_max DECIMAL(12,2),
  open_to_partnerships BOOLEAN DEFAULT true,

  -- Embedding for matching
  embedding vector(1536),
  embedded_at TIMESTAMPTZ,

  -- Metadata
  claimed_by TEXT,                    -- user who claimed this profile
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**This is the key table for leveling the playing field.** A community org in Arnhem Land with 2 staff and no grant writer can create a profile, and the system matches them with every relevant grant and foundation program automatically.

#### `matches` — NEW
**Purpose:** Grant ↔ Org matches (both directions)

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being matched
  grant_id UUID REFERENCES grant_opportunities(id),
  foundation_program_id UUID REFERENCES foundation_programs(id),
  org_profile_id UUID REFERENCES org_profiles(id),
  foundation_id UUID REFERENCES foundations(id),

  -- Match quality
  similarity_score FLOAT,             -- vector cosine similarity
  fit_score INTEGER,                   -- 0-100 composite fit
  match_reasons TEXT[],                -- ['focus_area_overlap', 'geographic_match', 'size_appropriate']
  match_warnings TEXT[],               -- ['deadline_soon', 'competitive', 'requires_partnership']

  -- Status
  status TEXT DEFAULT 'suggested',     -- 'suggested' | 'saved' | 'applying' | 'submitted' | 'won' | 'lost' | 'dismissed'
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `corporate_entities` — NEW
**Purpose:** Track the businesses behind the money — mining, finance, retail.
Shows the connection between wealth extraction and philanthropy.

```sql
CREATE TABLE corporate_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  asx_code TEXT UNIQUE,
  abn TEXT,
  name TEXT NOT NULL,
  industry TEXT,                       -- 'mining' | 'finance' | 'retail' | 'energy' | 'tech' | 'property'

  -- Scale
  market_cap DECIMAL(16,2),
  annual_revenue DECIMAL(16,2),
  annual_profit DECIMAL(16,2),
  employees INTEGER,

  -- Giving
  foundation_id UUID REFERENCES foundations(id),  -- their foundation entity
  annual_community_investment DECIMAL(14,2),
  giving_as_pct_profit DECIMAL(5,2),

  -- Impact (the uncomfortable truth)
  environmental_impact TEXT,           -- mining footprint, emissions, etc.
  communities_affected TEXT[],         -- regions where they operate/extract
  indigenous_land_operations TEXT[],   -- traditional lands they operate on
  controversies JSONB,                 -- [{year, description, source_url}]

  -- Transparency
  modern_slavery_statement_url TEXT,
  reconciliation_action_plan TEXT,     -- 'none' | 'reflect' | 'innovate' | 'stretch' | 'elevate'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `wealth_flows` — NEW (evolution of money_flows)
**Purpose:** Complete picture of how wealth moves in Australia.
From extraction → corporate profit → foundation → community.

```sql
CREATE TABLE wealth_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_type TEXT NOT NULL,           -- 'extraction' | 'corporate' | 'government' | 'foundation' | 'individual'
  source_entity_id UUID,              -- FK to corporate_entities, foundations, government_programs
  source_name TEXT NOT NULL,

  -- Destination
  dest_type TEXT NOT NULL,             -- 'foundation' | 'government' | 'community_org' | 'program' | 'individual'
  dest_entity_id UUID,
  dest_name TEXT NOT NULL,

  -- Flow
  amount DECIMAL(16,2),
  year INTEGER,
  flow_type TEXT,                      -- 'profit' | 'tax' | 'donation' | 'grant' | 'contract' | 'royalty' | 'budget'
  domain TEXT,                         -- 'mining' | 'health' | 'education' | 'indigenous' | 'arts'

  -- Evidence
  evidence_url TEXT,
  confidence TEXT DEFAULT 'medium',    -- 'low' | 'medium' | 'high' | 'verified'
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

This enables questions like:
- "BHP makes $13B profit from mining on Yawuru country → gives $195M through BHP Foundation → how much reaches Yawuru community?"
- "What % of Fortescue's profit flows back to Pilbara communities vs offshore shareholders?"
- "Show me every dollar that flows from mining in the NT to community programs"

---

## How the Matching Works

### For Community Orgs (Seekers)

1. Org creates profile (or we auto-populate from ACNC data)
2. Profile gets embedded (mission + focus + geography + beneficiaries)
3. System runs vector similarity against:
   - All 14,119 grant_opportunities
   - All 866 foundation_programs
   - All foundation open_programs (JSON field)
4. Results scored on:
   - **Semantic fit** (embedding similarity)
   - **Geographic match** (org location ↔ grant geography)
   - **Size appropriateness** (org revenue vs grant amount)
   - **Eligibility match** (org capabilities vs requirements)
   - **Cultural alignment** (indigenous-led org → indigenous-focused grants)
5. Daily digest: "3 new grants match your organisation"

### For Foundations (Givers)

1. Foundation profile already exists (from ACNC + enrichment)
2. Foundation searches for orgs that match their program criteria
3. System shows community_orgs + org_profiles that align with:
   - Foundation's thematic focus
   - Foundation's geographic focus
   - Foundation's target recipients
4. **This is the leveling mechanism** — foundations discover orgs they'd never find through traditional networks

### The Leveling Effect

Traditional model:
```
Foundation → grants officer → networks → established orgs → funded
(relationship-driven, Sydney/Melbourne-centric, English-first)
```

CivicGraph model:
```
Foundation → CivicGraph search → ALL matching orgs ranked by fit → funded
(merit-driven, national, culturally aware)
```

---

## Connection Map: What Links to What

### Currently Connected
```
acnc_ais ──(ABN)──► foundations
foundations ──(FK)──► foundation_programs
```

### Needs Connecting
```
foundation_programs ──(sync)──► grant_opportunities    (so programs appear in search)
grant_opportunities ──(FK)──► foundations               (so grants link to their funder)
community_orgs ──(ABN)──► acnc_ais                     (auto-populate financials)
org_profiles ──(ABN)──► acnc_ais                        (auto-populate for seekers)
org_profiles ──(match)──► grant_opportunities           (the matching engine)
org_profiles ──(match)──► foundation_programs            (the matching engine)
foundations ──(FK)──► corporate_entities                 (who's behind the money)
corporate_entities ──(flow)──► wealth_flows              (money trail)
wealth_flows ──(flow)──► community impact                (where it ends up)
```

---

## Data Volumes: Now vs Future

| Table | Now | 6 months | 1 year | Notes |
|-------|----:|--------:|---------:|-------|
| gs_entities | 100,036 | 110,000 | 130,000 | Unified entity registry |
| gs_relationships | 211,783 | 250,000 | 300,000 | All cross-references |
| austender_contracts | 670,303 | 700,000 | 750,000 | Full OCDS history |
| acnc_ais | 359,678 | 410,000 | 460,000 | +~50k/year |
| political_donations | 312,933 | 320,000 | 330,000 | Annual AEC releases |
| justice_funding | 52,133 | 55,000 | 60,000 | Cross-sector flows |
| ato_tax_transparency | 26,241 | 28,000 | 30,000 | Annual ATO releases |
| grant_opportunities | 18,069 | 25,000 | 50,000 | SA, WA, intl, enrichment |
| foundations | 10,779 | 12,000 | 15,000 | More ACNC filters |
| social_enterprises | 10,339 | 12,000 | 15,000 | Growing directory |
| foundation_programs | 2,472 | 4,000 | 6,000 | Scrape all foundation websites |
| community_orgs | 541 | 2,000 | 10,000 | Self-registration + ACNC mining |
| org_profiles | ~10 | 500 | 5,000 | Seekers signing up |

---

## The Story the Data Tells

Layer 1: **Where does the money come from?**
`corporate_entities` → profit from mining/finance/retail → `wealth_flows`

Layer 2: **Where does it sit?**
`foundations` → endowments, investment returns, giving ratios → `acnc_ais`

Layer 3: **Where does it flow?**
`foundation_programs` + `grant_opportunities` → who funds what → `money_flows`

Layer 4: **Who needs it?**
`community_orgs` + `org_profiles` → mission, capacity, geography → matching

Layer 5: **Does it reach?**
`matches` → did the community org get funded? → outcomes tracking

The data model makes visible what's currently invisible:
- $8.86B flows through charities annually — but where exactly?
- Mining companies extract from indigenous land — how much returns?
- 14,882 charities give grants — but who do they give to?
- Community orgs spend X hours on admin — vs Y hours on mission

**Every table, every column, every relationship serves one purpose: making the playing field visible so it can be leveled.**
