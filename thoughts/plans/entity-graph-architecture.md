# GrantScope Entity Graph Architecture

## The Gap

GrantScope has 2.5M+ records across 12 datasets. But they sit in silos. There is no entity graph connecting them.

**What exists:**
| Table | Records | Cross-Referencing |
|-------|---------|------------------|
| asic_companies | 2,167,341 | name lookup only |
| political_donations | 188,609 | donor_name (text, unlinked) |
| acnc_charities | 64,473 | ABN column |
| austender_contracts | 58,128 | supplier_abn column |
| ato_tax_transparency | 25,545 | not linked |
| grant_opportunities | 17,727 | foundation_id FK |
| foundations | 10,763 | abn column, derived from ACNC |
| postcode_geo | 10,559 | geographic |
| seifa_2021 | 10,572 | socioeconomic |
| oric_corporations | 7,369 | abn column |
| donor_entity_matches | 5,361 | THE ONLY cross-reference |
| social_enterprises | 3,541 | not linked |
| asx_companies | 1,976 | not linked |
| foundation_programs | 2,378 | foundation_id FK |
| community_orgs | 541 | not linked |
| money_flows | 406 | manual aggregate flows |

**What's missing:**
- No unified entity table for organisations (companies, charities, foundations, govt bodies are all separate)
- `entity_relationships` table exists but has **0 rows**
- No way to ask "show me everything connected to ABN X" without querying 8+ tables manually
- The 185 donor-contract overlap is computed at query time, not materialised
- No provenance tracking (which source said what, when)
- No temporal data on relationships
- ATO tax data (25,545 records) and ASX data (1,976) are completely unlinked

**The existing `canonical_entities` system is ACT CRM** (14,982 persons with LinkedIn/GHL/Xero IDs). It's not GrantScope infrastructure and should not be repurposed.

---

## Target Architecture: Follow The Money for Australia

Inspired by OCCRP's Follow The Money (FtM) model, OpenSanctions' statement-based provenance, and 360Giving's grant schema.

### Core Principle: Relationships Are First-Class Entities

Every connection between organisations is a record with its own properties, provenance, and temporal data. A donation isn't just a row in `political_donations` — it's a relationship between two entities with an amount, date, confidence level, and source attribution.

---

## Phase 1: The Entity Registry (Week 1-2)

### New Table: `gs_entities`

The unified entity registry. Every organisation, government body, or person that appears in any dataset gets one canonical record.

```sql
CREATE TABLE gs_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  entity_type TEXT NOT NULL,  -- 'company', 'charity', 'foundation', 'government_body',
                              -- 'indigenous_corp', 'political_party', 'person', 'social_enterprise'
  canonical_name TEXT NOT NULL,
  abn TEXT,                   -- primary Australian identifier
  acn TEXT,                   -- ASIC company number

  -- Prefixed identifiers (360Giving pattern)
  -- AU-ABN-21591780066, AU-ACN-123456789, AU-ORIC-ICN1234, AU-ASX-BHP
  gs_id TEXT UNIQUE NOT NULL, -- GrantScope canonical ID

  -- Descriptive
  description TEXT,
  website TEXT,
  state TEXT,
  postcode TEXT,

  -- Classification
  sector TEXT,                -- 'mining', 'finance', 'health', 'education', etc.
  sub_sector TEXT,
  tags TEXT[],

  -- Data quality
  source_datasets TEXT[] NOT NULL DEFAULT '{}',  -- which datasets mention this entity
  source_count INT DEFAULT 1,                     -- how many datasets
  confidence TEXT DEFAULT 'medium',               -- 'registry', 'verified', 'inferred'

  -- Timestamps
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gs_entities_abn ON gs_entities(abn) WHERE abn IS NOT NULL;
CREATE INDEX idx_gs_entities_type ON gs_entities(entity_type);
CREATE INDEX idx_gs_entities_name ON gs_entities USING gin(canonical_name gin_trgm_ops);
CREATE INDEX idx_gs_entities_gs_id ON gs_entities(gs_id);
CREATE INDEX idx_gs_entities_source ON gs_entities USING gin(source_datasets);
```

### Entity ID Format

```
AU-ABN-{abn}           → any entity with an ABN (primary)
AU-ACN-{acn}           → ASIC company number
AU-ORIC-{icn}          → Indigenous corporation number
AU-ASX-{code}          → ASX listed company
AU-ACNC-{charity_id}   → ACNC charity registration
AU-AEC-{donor_hash}    → Political donor (no ABN available)
AU-GOV-{buyer_id}      → Government department/agency
```

ABN is the canonical join key. Where ABN exists, it takes precedence. The gs_id is constructed deterministically from the best available identifier.

### Population Script: `scripts/build-entity-registry.mjs`

Reads from all source tables, deduplicates by ABN, creates canonical entities:

```
1. ACNC charities (64,473) → gs_entities WHERE entity_type = 'charity'
2. Foundations (10,763) → update existing charity records, set entity_type = 'foundation'
3. ORIC corporations (7,369) → gs_entities, link to ACNC where ABN matches
4. ASIC companies (2.1M) → gs_entities WHERE entity_type = 'company'
   (batch: start with those that appear in donations/contracts)
5. AusTender suppliers → create or link by supplier_abn
6. AusTender buyers → gs_entities WHERE entity_type = 'government_body'
7. Political donors → create or link by donor_abn (from donor_entity_matches)
8. ATO tax records → link by ABN
9. ASX companies → link by ABN
10. Social enterprises → create or link
```

**Critical: Don't import all 2.1M ASIC companies immediately.** Start with ~100K that appear in other datasets (have contracts, donations, charity links). The rest can be imported on-demand or in background batches.

---

## Phase 2: The Relationship Graph (Week 2-3)

### New Table: `gs_relationships`

Every connection between entities is a first-class record. Inspired by FtM's reified relationships.

```sql
CREATE TABLE gs_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The connection
  source_entity_id UUID NOT NULL REFERENCES gs_entities(id),
  target_entity_id UUID NOT NULL REFERENCES gs_entities(id),
  relationship_type TEXT NOT NULL,
  -- 'donation', 'contract', 'grant', 'directorship', 'ownership',
  -- 'charity_link', 'program_funding', 'tax_transparency'

  -- Properties (vary by type)
  amount NUMERIC,
  currency TEXT DEFAULT 'AUD',
  year INT,

  -- Temporal
  start_date DATE,
  end_date DATE,

  -- Provenance
  dataset TEXT NOT NULL,        -- 'aec_donations', 'austender', 'acnc', etc.
  source_record_id TEXT,        -- ID in the source table
  source_url TEXT,
  confidence TEXT DEFAULT 'registry',  -- 'registry', 'verified', 'reported', 'inferred'

  -- Timestamps
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata (type-specific properties)
  properties JSONB DEFAULT '{}'
  -- For donations: { financial_year, return_type, receipt_type }
  -- For contracts: { procurement_method, category, contract_start, contract_end, ocid }
  -- For grants: { program_name, grant_id }
  -- For directorships: { role, appointment_date }
);

-- Indexes
CREATE INDEX idx_gs_rel_source ON gs_relationships(source_entity_id);
CREATE INDEX idx_gs_rel_target ON gs_relationships(target_entity_id);
CREATE INDEX idx_gs_rel_type ON gs_relationships(relationship_type);
CREATE INDEX idx_gs_rel_dataset ON gs_relationships(dataset);
CREATE INDEX idx_gs_rel_year ON gs_relationships(year);
CREATE INDEX idx_gs_rel_amount ON gs_relationships(amount) WHERE amount IS NOT NULL;

-- Composite for common queries
CREATE INDEX idx_gs_rel_entity_type ON gs_relationships(source_entity_id, relationship_type);
CREATE INDEX idx_gs_rel_target_type ON gs_relationships(target_entity_id, relationship_type);
```

### Relationship Population

Convert existing siloed data into graph edges:

| Source Table | Relationship Type | Source Entity | Target Entity | Records |
|-------------|------------------|---------------|---------------|---------|
| political_donations | `donation` | donor (person/company) | political party | 188,609 |
| austender_contracts | `contract` | government body (buyer) | company (supplier) | 58,128 |
| grant_opportunities | `grant` | foundation | recipient (when known) | 17,727 |
| foundation_programs | `program` | foundation | program | 2,378 |
| donor_entity_matches | enriches donations | maps donor names → ABNs | | 5,361 |
| ato_tax_transparency | `tax_record` | company | ATO | 25,545 |
| acnc → foundations | `foundation_of` | foundation | parent charity | 10,763 |
| oric → acnc | `registered_as` | indigenous corp | ACNC charity | ~3,000 |

**Estimated initial graph:** ~300,000+ relationships from existing data alone.

### Population Script: `scripts/build-relationship-graph.mjs`

```
Phase 1: Political donations → gs_relationships
  - For each donation with a matched ABN (via donor_entity_matches):
    - Find/create source entity (donor)
    - Find/create target entity (political party)
    - Create relationship with amount, year, confidence

Phase 2: AusTender contracts → gs_relationships
  - For each contract with supplier_abn:
    - Find/create source entity (buyer/govt body)
    - Find/create target entity (supplier)
    - Create relationship with contract_value, dates, category

Phase 3: Foundation→Grant links → gs_relationships
  - For each grant with foundation_id:
    - Link foundation entity → grant (as program/funding relationship)

Phase 4: Cross-registry links
  - ORIC corps with matching ACNC ABNs → 'registered_as' relationships
  - Foundations derived from ACNC → 'foundation_of' relationships
  - ASX companies matching ASIC records → 'listed_as' relationships
```

---

## Phase 3: The Entity Dossier API (Week 3-4)

### API Route: `GET /api/entities/[gsId]`

The killer product page. "Show me everything connected to this ABN."

```typescript
// Response shape
{
  entity: {
    gs_id: "AU-ABN-46008700048",
    canonical_name: "BHP GROUP LIMITED",
    entity_type: "company",
    abn: "46008700048",
    description: "...",
    sector: "mining",
    source_datasets: ["asic", "aec_donations", "austender", "ato_tax", "asx"],
    source_count: 5
  },

  relationships: {
    donations_made: [
      { to: "Liberal Party", amount: 500000, year: 2023, confidence: "registry" },
      { to: "Labor Party", amount: 450000, year: 2023, confidence: "registry" },
    ],
    contracts_held: [
      { from: "Dept of Industry", amount: 12000000, year: 2024, category: "Mining Services" },
    ],
    tax_data: {
      total_income: 65000000000,
      taxable_income: 12000000000,
      tax_payable: 3600000000,
      year: "2022-23"
    },
    charity_links: [
      { name: "BHP Foundation", abn: "...", type: "foundation_of" }
    ],
    directorships: [] // future: ASIC officer data
  },

  cross_references: {
    donates_and_contracts: true,  // THE FLAG
    total_donated: 2500000,
    total_contracts: 45000000,
    overlap_years: [2021, 2022, 2023]
  },

  provenance: {
    sources: ["AEC Annual Returns 2022-23", "AusTender", "ATO Tax Transparency 2022-23", "ASIC"],
    last_updated: "2026-03-08"
  }
}
```

### Entity Dossier Page: `/entities/[gsId]`

The product wedge. Visual page showing:
- Entity header (name, type, ABN, sector)
- Relationship graph (Sankey diagram or network visualization)
- Donation history (table + chart)
- Contract history (table + chart)
- Tax transparency data
- Cross-reference flags ("This entity donates to political parties AND holds government contracts")
- Related entities (directors, subsidiaries, foundation links)
- Data provenance footer

---

## Phase 4: Cross-Reference Intelligence (Week 4-5)

### Materialised Views for Key Insights

```sql
-- The headline stat: entities that both donate and hold contracts
CREATE MATERIALIZED VIEW mv_donor_contractors AS
SELECT
  e.id, e.gs_id, e.canonical_name, e.entity_type, e.abn,
  COALESCE(d.total_donated, 0) as total_donated,
  COALESCE(d.donation_count, 0) as donation_count,
  COALESCE(c.total_contracts, 0) as total_contract_value,
  COALESCE(c.contract_count, 0) as contract_count,
  d.parties_donated_to,
  c.government_buyers
FROM gs_entities e
JOIN (
  SELECT source_entity_id,
    SUM(amount) as total_donated,
    COUNT(*) as donation_count,
    ARRAY_AGG(DISTINCT target.canonical_name) as parties_donated_to
  FROM gs_relationships r
  JOIN gs_entities target ON r.target_entity_id = target.id
  WHERE r.relationship_type = 'donation'
  GROUP BY source_entity_id
) d ON e.id = d.source_entity_id
JOIN (
  SELECT target_entity_id,
    SUM(amount) as total_contracts,
    COUNT(*) as contract_count,
    ARRAY_AGG(DISTINCT source.canonical_name) as government_buyers
  FROM gs_relationships r
  JOIN gs_entities source ON r.source_entity_id = source.id
  WHERE r.relationship_type = 'contract'
  GROUP BY target_entity_id
) c ON e.id = c.target_entity_id
ORDER BY total_donated DESC;

-- Refresh daily
-- REFRESH MATERIALIZED VIEW mv_donor_contractors;
```

### Pre-Built Intelligence Queries

```sql
-- Top political donors by total amount
-- Foundations by revenue vs grants distributed
-- Government departments by contractor concentration
-- Entities appearing in most datasets (highest cross-reference count)
-- Regional funding distribution (postcode_geo + seifa_2021 join)
-- Indigenous org funding vs population
```

---

## Phase 5: Agent-Powered Enrichment (Week 5-6)

### Entity Resolution Agent

An AI agent that resolves ambiguous entity matches. Runs as a batch process.

```
Input: Unmatched political donor name "BHP BILLITON PTY LTD"
Process:
  1. Normalize name: "bhp billiton pty ltd"
  2. Search ASIC by trigram similarity
  3. Search existing gs_entities by name
  4. If match confidence > 0.8: auto-link
  5. If 0.5-0.8: queue for human review (entity_potential_matches)
  6. If < 0.5: create new entity with confidence='inferred'
Output: gs_entity link with confidence score
```

### Relationship Discovery Agent

Discovers implicit relationships not in structured data:

```
Input: Foundation description mentioning "funded by Rio Tinto"
Process:
  1. NER extraction from descriptions
  2. Match extracted org names to gs_entities
  3. Create relationship with confidence='inferred', source='llm_extraction'
Output: New gs_relationship with provenance
```

### Data Quality Agent

Runs periodic checks:

```
- Entities with ABN but not in ACNC or ASIC (data gap)
- Relationships with amount=0 or NULL (missing data)
- Duplicate entities (same ABN, different gs_id)
- Stale data (last_seen > 12 months)
- Coverage gaps (foundations with no description, entities in only 1 dataset)
```

---

## Phase 6: Statement-Based Provenance (Future)

When data quality matters enough to track individual claims:

```sql
CREATE TABLE gs_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES gs_entities(id),
  property TEXT NOT NULL,          -- 'name', 'abn', 'revenue', 'sector'
  value TEXT NOT NULL,
  dataset TEXT NOT NULL,           -- 'acnc', 'asic', 'aec', 'llm_enrichment'
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  confidence TEXT DEFAULT 'medium',
  canonical BOOLEAN DEFAULT true,  -- is this the current best value?
  source_url TEXT
);
```

This is the OpenSanctions/BODS pattern. It lets you answer "who said this entity's name is X?" and "when did we first see this?" — critical for investigative use but not needed for MVP.

---

## Implementation Order

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| 1 | `gs_entities` + population script | 2 days | Foundation for everything |
| 2 | `gs_relationships` + population from existing data | 3 days | The graph exists |
| 3 | Entity Dossier API + page | 3 days | The product wedge |
| 4 | Materialised views + cross-reference intelligence | 2 days | The flagship report |
| 5 | Agent-powered entity resolution + enrichment | 3 days | Quality improvement |
| 6 | Statement-based provenance | Future | Investigative-grade |

**Total to MVP entity graph: ~2 weeks of focused work.**

---

## What This Enables

Once the graph exists:

1. **Entity Dossier page** — "Show me everything linked to ABN X" in one page
2. **Flagship report** — 185 donor-contractors, materialised and browsable
3. **Network traversal** — "Who connects BHP to this community org?" (2-hop query)
4. **Alert system** — "Notify me when any entity connected to [X] gets a new contract"
5. **Paid API** — query the graph programmatically
6. **Investigative packs** — pre-built dossiers for journalists
7. **Modern Slavery Register integration** — just another entity source + relationship type
8. **Beneficial Ownership Register (2027)** — ownership relationships slot right into gs_relationships

---

## Schema Summary

```
gs_entities (unified registry)
  ├── gs_relationships (the graph edges)
  │     ├── donation (AEC → party)
  │     ├── contract (govt → supplier)
  │     ├── grant (foundation → recipient)
  │     ├── tax_record (company → ATO)
  │     ├── directorship (future: person → company)
  │     ├── ownership (future: beneficial ownership)
  │     ├── charity_link (foundation → ACNC)
  │     └── registered_as (ORIC → ACNC)
  ├── gs_statements (future: provenance)
  └── mv_donor_contractors (materialised cross-reference)

Source tables (unchanged, read-only):
  ├── political_donations (188K)
  ├── austender_contracts (58K)
  ├── acnc_charities (64K)
  ├── foundations (10K)
  ├── oric_corporations (7K)
  ├── asic_companies (2.1M)
  ├── ato_tax_transparency (25K)
  ├── grant_opportunities (17K)
  ├── asx_companies (2K)
  └── social_enterprises (3.5K)
```

The source tables stay as-is. The `gs_*` tables are the graph layer built on top. Source tables are the raw data; `gs_*` is the intelligence.

---

*Built on Jinibara Country. Making capital allocation legible.*
