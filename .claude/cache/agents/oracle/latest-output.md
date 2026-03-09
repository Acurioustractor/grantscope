# Research Report: OpenSanctions Integration for GrantScope
Generated: 2026-03-10

## Summary

OpenSanctions is a mature open database combining international sanctions lists, PEP databases, and related entity data into a unified FollowTheMoney (FtM) graph model. It includes 269 datasets (84 PEP sources alone), covers Australian DFAT sanctions natively, and offers both bulk data downloads and a self-hostable matching API (yente). The data is CC BY-NC 4.0 licensed -- free for non-commercial use, paid for commercial. For matching ~80K Australian entities, the self-hosted yente API with batch matching is the recommended approach.

## Questions Answered

### Q1: What datasets are available and their formats?
**Answer:** 269 dataset collections available in three formats:
- **FtM JSON** (`entities.ftm.json`) -- full structured data using FollowTheMoney graph model. One JSON object per line (NDJSON). Recommended for developers.
- **Simplified CSV** (`targets.simple.csv`) -- flattened tabular view with key columns. Comma-delimited, UTF-8. Good for spreadsheet analysis but loses relationship data.
- **Nested JSON** (`entities.nested.json`) -- API-style JSON with resolved references.

Key dataset collections:
- `default` -- everything combined (sanctions + PEPs + crime)
- `sanctions` -- all sanctions lists only
- `peps` -- all PEP data only (219K persons from 84 sources)
- `crime` -- crime-related datasets
- `au_dfat_sanctions` -- Australian DFAT sanctions specifically

Download URL pattern:
```
https://data.opensanctions.org/datasets/latest/{dataset}/{format}
```
Examples:
```
https://data.opensanctions.org/datasets/latest/default/entities.ftm.json
https://data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv
https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/entities.ftm.json
```

Historical versions available via date:
```
https://data.opensanctions.org/datasets/20260310/{dataset}/{format}
```

**Source:** https://www.opensanctions.org/docs/bulk/, https://www.opensanctions.org/datasets/
**Confidence:** High

### Q2: How to download bulk data?
**Answer:** Direct HTTP download from `data.opensanctions.org`. No authentication required for download. Updated multiple times daily. Recommended polling frequency: every 30 minutes for freshness.

```bash
# Download all sanctions + PEPs (the "default" collection)
curl -O https://data.opensanctions.org/datasets/latest/default/entities.ftm.json

# Download just Australian DFAT sanctions
curl -O https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/entities.ftm.json

# Download simplified CSV for analysis
curl -O https://data.opensanctions.org/datasets/latest/default/targets.simple.csv
```

**Source:** https://www.opensanctions.org/faq/150/downloading/
**Confidence:** High

### Q3: What entity types do they track?
**Answer:** Based on FollowTheMoney schema, OpenSanctions uses these entity types:
- **Person** -- natural persons (sanctioned individuals, PEPs)
- **Organization** -- unincorporated bodies, associations
- **Company** -- incorporated entities
- **LegalEntity** -- parent type for Company/Organization
- **Vessel** -- ships/boats (for maritime sanctions)
- **Aircraft** -- sanctioned aircraft
- **CryptoWallet** -- cryptocurrency addresses
- **Position** -- political/governmental roles (for PEP classification)
- **Occupancy** -- links a Person to a Position for a time period
- **Identification** -- passport/ID document linked to a person
- **Address** -- physical addresses
- **Sanction** -- the sanction event itself, linking entity to program

Relationship types:
- **Ownership** -- ownership/control between entities
- **Directorship** -- director/officer role
- **Employment** -- employment relationship
- **Family** -- family relationships
- **Associate** -- general associations
- **UnknownLink** -- unclassified relationships

**Source:** https://www.opensanctions.org/reference/, https://followthemoney.tech/explorer/
**Confidence:** High

### Q4: What identifiers do they use?
**Answer:** The FtM model supports various identifier types:

For **Person**:
- `name`, `alias`, `weakAlias` -- name variants
- `birthDate`, `deathDate`
- `nationality`, `country`
- `idNumber` -- national ID numbers
- `passportNumber`
- `taxNumber`
- `gender`
- `position` -- political position held

For **Company/LegalEntity**:
- `name`, `alias`
- `registrationNumber` -- company registration number
- `taxNumber` -- tax/ABN equivalent
- `jurisdiction` -- country of incorporation
- `incorporationDate`
- `address`
- `classification` -- entity type classification

For **Identification** (linked documents):
- `number` -- document number
- `type` -- passport, national ID, etc.
- `country` -- issuing country
- `authority` -- issuing authority

**Important for GrantScope:** OpenSanctions does NOT natively store Australian Business Numbers (ABNs) as a first-class field. ABNs would appear as `registrationNumber` or `taxNumber` if present. Matching will primarily rely on **name + jurisdiction** rather than ABN lookup.

**Source:** https://followthemoney.tech/explorer/schemata/Person/, https://followthemoney.tech/explorer/schemata/LegalEntity/
**Confidence:** High

### Q5: Australian-specific data?
**Answer:** Yes, OpenSanctions includes:

**Australian DFAT Sanctions Consolidated List** (`au_dfat_sanctions`):
- All persons and entities subject to targeted financial sanctions under Australian sanctions law
- Includes UNSC sanctions (mandatory for UN members) and Australian autonomous sanctions
- Updated daily from the Australian Sanctions Office (ASO)
- Dataset URL: https://www.opensanctions.org/datasets/au_dfat_sanctions/
- Programs covered: AU-HUMAN (Human Rights Sanctions Regime), plus UNSC programs

**Australian PEPs:**
- No dedicated Australian PEP source dataset found
- Australian PEPs would come from **Wikidata PEPs** (`wd_peps`) which pulls from Wikidata entries for Australian politicians, officials
- Coverage likely includes federal parliamentarians, state premiers, senior officials -- but NOT comprehensive for all levels
- EveryPolitician data (historical) may also contribute Australian parliamentary data

**Gap:** There is no dedicated Australian PEP registry in OpenSanctions. Australian PEP coverage relies on Wikidata, which is community-maintained and may have gaps for state/local officials and statutory body heads.

**Source:** https://www.opensanctions.org/datasets/au_dfat_sanctions/, https://www.opensanctions.org/datasets/peps/
**Confidence:** High (sanctions), Medium (PEP coverage depth)

### Q6: Data schema -- fields per entity?
**Answer:** The simplified CSV (`targets.simple.csv`) contains these columns:
- `id` -- unique entity identifier
- `schema` -- entity type (Person, Company, etc.)
- `name` -- primary name
- `aliases` -- semicolon-separated aliases
- `birth_date` -- for persons
- `countries` -- semicolon-separated country codes
- `addresses` -- semicolon-separated addresses
- `identifiers` -- semicolon-separated ID numbers
- `sanctions` -- semicolon-separated sanction descriptions
- `phones` -- phone numbers
- `emails` -- email addresses
- `dataset` -- source dataset name
- `datasets` -- all contributing datasets
- `first_seen` -- when entity first appeared
- `last_seen` -- most recent update
- `last_change` -- when properties last changed
- `program_ids` -- sanctions program identifiers

The full FtM JSON format provides much richer data with all properties, nested relationships, and provenance.

**Source:** https://www.opensanctions.org/docs/bulk/csv/
**Confidence:** High

### Q7: Licensing terms?
**Answer:**
- **License:** Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)
- **Non-commercial use:** Free, no license needed
- **Commercial use:** Requires paid data license
- **Exemptions (zero-cost license):**
  - Journalistic media publishing in public interest
  - Advocacy and non-profit groups working on democratic governance
  - Public institutions of countries invaded by Russian Armed Forces
- **GrantScope implication:** If GrantScope is a non-profit/advocacy project improving grant transparency, it likely qualifies for the exemption. If commercial, a license is needed.
- **Pricing:** Not publicly listed; contact OpenSanctions for commercial tiers
- **Self-hosted API (yente):** The software is MIT-licensed. The DATA still requires appropriate licensing.

**Source:** https://www.opensanctions.org/licensing/, https://www.opensanctions.org/faq/32/exemptions/
**Confidence:** High

### Q8: Yente matching API?
**Answer:**

**Architecture:**
- Two Docker containers: yente app + ElasticSearch index
- Hardware: minimum 4GB RAM, 1 vCPU, 40GB disk; recommended 8GB RAM + SSD
- Ships as docker-compose setup; also works on Kubernetes

**Self-hosted setup:**
```bash
# docker-compose.yml (simplified)
docker pull ghcr.io/opensanctions/yente:latest
# Requires OPENSANCTIONS_API_KEY env var for data access
```

**Key endpoints:**
- `GET /search/{dataset}?q=name` -- text search
- `POST /match/{dataset}` -- single entity matching
- `POST /match/{dataset}` with batch -- batch matching (recommended)

**Batch matching format (the key for 80K entities):**
```json
POST /match/default
{
  "queries": {
    "entity1": {
      "schema": "Company",
      "properties": {
        "name": ["Acme Charity Ltd"],
        "jurisdiction": ["au"],
        "registrationNumber": ["12345678"]
      }
    },
    "entity2": {
      "schema": "Person",
      "properties": {
        "name": ["Jane Smith"],
        "birthDate": ["1975"],
        "nationality": ["au"]
      }
    }
  }
}
```

**Recommended batch size:** 20-50 entities per request (not 5000).

**Response includes:**
- Match score (0-1)
- Matched entity details
- Explanation of scoring components (useful for analyst review)

**Matching algorithm options:**
- `algorithm=best` -- highest quality matching
- Supports name transliteration, fuzzy matching, phonetic matching

**Custom datasets:** You can load your own entity lists into yente alongside OpenSanctions data, enabling cross-matching between your data and sanctions/PEP lists.

**Cloud API alternative:**
- Hosted at `api.opensanctions.org`
- Pay-as-you-go pricing
- Same endpoints as self-hosted
- No infrastructure management needed

**Source:** https://www.opensanctions.org/docs/self-hosted/, https://github.com/opensanctions/yente, https://www.opensanctions.org/docs/api/matching/
**Confidence:** High

## Recommendations for GrantScope

### Integration Strategy

1. **Self-host yente** via Docker for the 80K entity matching job. At 50 entities/batch, that is ~1,600 API calls -- very manageable. A single run should complete in under an hour.

2. **Match in two passes:**
   - **Pass 1 -- Entity match:** Match all 80K entities (charities, companies, Indigenous corps) as `Company` or `Organization` schema against `sanctions` + `peps` collections
   - **Pass 2 -- Director/officer match:** Extract known directors/officers from ACNC/ORIC data, match as `Person` schema against `peps` collection to flag PEP board members

3. **Matching fields to use:**
   - For entities: `name` + `jurisdiction: "au"` + `registrationNumber` (ABN if available)
   - For persons: `name` + `nationality: "au"` + `birthDate` (if available)
   - Name matching is fuzzy by default; jurisdiction/nationality helps reduce false positives

4. **Store results in a `sanctions_screening` table:**
   ```sql
   CREATE TABLE sanctions_screening (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     entity_id UUID REFERENCES entities(id),
     person_name TEXT,
     match_score NUMERIC,
     matched_entity_id TEXT, -- OpenSanctions entity ID
     matched_name TEXT,
     matched_schema TEXT, -- Person, Company, etc.
     match_type TEXT, -- 'sanction', 'pep', 'crime'
     datasets TEXT[], -- contributing datasets
     explanation JSONB, -- yente match explanation
     screened_at TIMESTAMPTZ DEFAULT NOW(),
     reviewed BOOLEAN DEFAULT FALSE
   );
   ```

5. **Licensing:** If GrantScope is non-commercial/advocacy, request the zero-cost exemption. If commercial, budget for a data license.

### Known Limitations

- **ABN matching is weak:** OpenSanctions won't have ABNs for most entities. Name-based matching will produce false positives that need human review.
- **Australian PEP coverage is partial:** Relies on Wikidata. State/local officials, statutory body heads, and Indigenous corporation directors are unlikely to be in the PEP dataset. Consider supplementing with your own PEP list from Australian Parliament/state parliament websites.
- **Ownership/control relationships:** OpenSanctions has some Ownership and Directorship relationship data, but it's primarily focused on sanctioned entities. For comprehensive Australian corporate ownership, you'd need ASIC data or similar.
- **False positive rate:** For 80K entities matched by name, expect a significant number of false positives. Build a review workflow.

## Sources
1. [OpenSanctions Bulk Data](https://www.opensanctions.org/docs/bulk/) -- download formats and URLs
2. [OpenSanctions Datasets](https://www.opensanctions.org/datasets/) -- 269 dataset collections
3. [Australian DFAT Sanctions](https://www.opensanctions.org/datasets/au_dfat_sanctions/) -- Australian sanctions data
4. [PEP Datasets](https://www.opensanctions.org/datasets/peps/) -- 84 PEP sources, 219K persons
5. [Licensing](https://www.opensanctions.org/licensing/) -- CC BY-NC 4.0 terms
6. [Exemptions](https://www.opensanctions.org/faq/32/exemptions/) -- non-commercial exemptions
7. [Self-hosted yente](https://www.opensanctions.org/docs/self-hosted/) -- Docker deployment guide
8. [yente GitHub](https://github.com/opensanctions/yente) -- source code and README
9. [Matching API docs](https://www.opensanctions.org/docs/api/matching/) -- batch matching format
10. [FtM Person schema](https://followthemoney.tech/explorer/schemata/Person/) -- Person entity properties
11. [FtM LegalEntity schema](https://followthemoney.tech/explorer/schemata/LegalEntity/) -- Company/Org properties
12. [Data Reference](https://www.opensanctions.org/reference/) -- data dictionary
13. [CSV format docs](https://www.opensanctions.org/docs/bulk/csv/) -- simplified CSV columns
14. [API examples](https://github.com/opensanctions/api-examples) -- code examples for API usage
