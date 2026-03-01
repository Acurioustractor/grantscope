# GrantScope Data Model — The 360Giving Architecture

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
                    │   (9,874)   │  │ ORGS (500)   │  │ (via ASX/ABN)│
                    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
                           │                │                  │
                   ┌───────┴───────┐        │                  │
                   ▼               ▼        │                  │
          ┌────────────┐  ┌────────────┐    │                  │
          │ FOUNDATION │  │ OPEN       │    │                  │
          │ PROGRAMS   │  │ PROGRAMS   │    │                  │
          │   (866)    │  │ (JSON)     │    │                  │
          └──────┬─────┘  └────────────┘    │                  │
                 │                          │                  │
                 ▼                          │                  │
    ┌────────────────────────┐              │                  │
    │   GRANT OPPORTUNITIES  │◄─────────────┘                  │
    │       (14,119)         │              (applies to)       │
    │                        │                                 │
    │  gov + foundation +    │◄────────────────────────────────┘
    │  corporate + research  │         (corporate programs)
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐      ┌─────────────────┐
    │     MONEY FLOWS        │◄────►│   GOVERNMENT    │
    │       (406)            │      │   PROGRAMS (4)  │
    │  source → destination  │      └─────────────────┘
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

#### `foundations` — 9,874 rows ✅
Every significant grantmaking entity in Australia.
- 34 columns: financials, focus areas, giving philosophy, application tips
- Derived from ACNC filtered for grantmakers
- 1,627 enriched with AI profiling (descriptions, tips, board members)
- **Links to:** acnc_ais (via ABN), foundation_programs (FK)

#### `foundation_programs` — 866 rows ✅
Specific funding programs from foundations.
- Name, description, amount range, deadline, status
- **Links to:** foundations (FK)
- **GAP:** Not linked to grant_opportunities. Not in search results.

#### `grant_opportunities` — 14,119 rows ✅
All discoverable grants from government + some foundations.
- 41 columns, 100% embedded for semantic search
- 10+ automated source plugins
- **GAP:** No FK to foundations. Foundation programs aren't included.

#### `community_orgs` — 500 rows ✅
Grassroots organisations, the seekers.
- Programs, outcomes, admin burden tracking
- **GAP:** No matching system. Can't search for grants that fit them.

#### `government_programs` — 4 rows ✅ (barely started)
Government spending programs (budget allocations, not grants).
- Budget amounts, spend per unit, outcomes
- **GAP:** Only 4 programs (youth justice). Needs 100s.

#### `money_flows` — 406 rows ✅
How money moves between entities.
- Source → destination with amounts, years, flow types
- **GAP:** Uses TEXT names not FKs. Only covers youth justice domain.

### TIER 2: Needed Tables (DON'T EXIST YET)

#### `org_profiles` — NEW
**Purpose:** Any organisation can create a profile to get matched with grants.
Uses ACNC data automatically if they have an ABN.

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

GrantScope model:
```
Foundation → GrantScope search → ALL matching orgs ranked by fit → funded
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
| acnc_ais | 359,678 | 410,000 | 460,000 | +~50k/year |
| grant_opportunities | 14,119 | 25,000 | 50,000 | SA, WA, intl, enrichment |
| foundations | 9,874 | 12,000 | 15,000 | More ACNC filters, community foundations |
| foundation_programs | 866 | 3,000 | 5,000 | Scrape all foundation websites |
| community_orgs | 500 | 2,000 | 10,000 | Self-registration + ACNC mining |
| org_profiles | 0 | 500 | 5,000 | Seekers signing up |
| corporate_entities | 0 | 200 | 500 | ASX200 + major private |
| wealth_flows | 406 | 5,000 | 50,000 | Full economy mapping |
| government_programs | 4 | 200 | 1,000 | All jurisdictions, all domains |
| matches | 0 | 10,000 | 100,000 | Automated matching engine |

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
