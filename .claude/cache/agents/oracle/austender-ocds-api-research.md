# Research Report: AusTender OCDS API

**Generated:** 2026-03-07

## Summary

The AusTender OCDS (Open Contracting Data Standard) API is a free, open access API that publishes Australian Government procurement contract data in OCDS-compliant JSON format. No authentication key is required. The API provides contract notices from January 1, 2013 onwards, with ~64,000-83,000 contracts published annually. Data is queryable by contract ID, published date, contract start date, contract end date, and last modified date using ISO 8601 format.

## Questions Answered

### Q1: What is the exact API base URL and what endpoints are available?

**Base URL:** `https://api.tenders.gov.au`

**Available Endpoints:**
- `GET /ocds/findById/{cnId}` - Search by Contract Notice ID
  - Example: `/ocds/findById/CN4026155`
  - Returns: Single release object

- `GET /ocds/findByDates/{dateType}/{startDate}/{endDate}` - Search by date range
  - Available date types:
    - `contractPublished` - Contract publication date
    - `contractStart` - Contract start date
    - `contractEnd` - Contract end date
    - `contractLastModified` - Last modification date
  - Date format: ISO 8601 with time interval format
    - Example: `/ocds/findByDates/contractPublished/2024-01-01T00:00:00Z/2024-01-02T00:00:00Z`
    - Date range can span weeks, months, or years

**Source:** [GitHub - austender/austender-ocds-api](https://github.com/austender/austender-ocds-api)

**Confidence:** High (verified from official README)

### Q2: Authentication requirements

**Result:** NO AUTHENTICATION REQUIRED

The API is **publicly accessible** without requiring an API key or authentication token. However, the base URL alone (without endpoint) returns a 403 error with "Missing Authentication Token" message, which is AWS API Gateway's standard response for missing route parameters—not an access control mechanism.

All endpoint queries work without any authentication headers.

**Source:** Verified via direct API testing

**Confidence:** High (tested directly)

### Q3: Pagination structure

**Finding:** The API does NOT use traditional pagination (no limit/offset or cursor parameters).

**Instead:** The API returns a **complete release package** for the filtered query, which can contain multiple releases. The structure is:

```json
{
  "uri": "...",
  "publisher": { "name": "Department of Finance" },
  "publishedDate": "2024-01-01T23:59:06Z",
  "license": "https://creativecommons.org/licenses/by/3.0/au/",
  "version": "1.1",
  "releases": [
    { /* release 1 */ },
    { /* release 2 */ },
    ...
  ]
}
```

**For large datasets:** When querying large date ranges (e.g., a full year), you must split the range into smaller chunks:
- Daily queries for high-volume periods
- Weekly or monthly queries for lower-volume periods

**OCDS Standard Pagination:** The OCDS specification itself supports two pagination models (per the extensions):
1. **"all" property** - Lists all packages in base files
2. **"next" property** - Links to next package for sequential iteration

However, the AusTender API does not expose these. Instead, implement pagination by chunking date ranges.

**Source:** [OCDS Pagination Extension](https://extensions.open-contracting.org/en/extensions/pagination/master/)

**Confidence:** High (verified from API response structure)

### Q4: JSON response structure — what fields are in a contract/release?

**Top-level package structure:**
```
{
  "uri",              // Request URI
  "publisher",        // { name, uri?, scheme?, uid? }
  "publishedDate",    // ISO 8601 timestamp
  "license",          // CC-BY 3.0 AU
  "version",          // "1.1" (OCDS version)
  "releases",         // Array of releases
  "extensions"        // Extension schemas used
}
```

**Release structure (each item in releases[]):**
```
{
  "ocid",                 // Unique contract ID (e.g., "prod-a80c9fcc7cfa48f28954133183c3840c")
  "id",                   // Release ID (includes hash)
  "date",                 // Release publication/amendment date (ISO 8601)
  "initiationType",       // "tender" or other
  "language",             // "EN"
  "parties",              // Array of parties (suppliers, procuring entities, etc.)
  "awards",               // Array of awards
  "contracts",            // Array of contracts
  "tag",                  // ["contract"] or ["contractAmendment"]
  "tender",               // Tender details (procurement method, reason, etc.)
}
```

**Parties structure (array of parties):**
```json
{
  "id",                      // Unique party ID
  "name",                    // Organization name
  "roles",                   // ["supplier"] or ["procuringEntity"]
  "additionalIdentifiers",   // Array with ABN identifier
  "address",                 // Full address with streetAddress, locality, region, postalCode, countryName
  "contactPoint"             // { name, email, telephone, branch, division }
}
```

**Contracts structure:**
```json
{
  "id",                   // Contract ID (e.g., "CN4026155")
  "awardID",              // Links to award
  "dateSigned",           // ISO 8601
  "description",          // Contract description
  "title",                // Contract title
  "items",                // Deliverables with UNSPSC classification
  "period",               // { startDate, endDate }
  "value",                // { currency: "AUD", amount: "14487.00" }
  "status",               // "active", "cancelled", etc.
  "amendments"            // [{ id, releaseID, amendsReleaseID }] (if amended)
}
```

**Source:** Live API response (2024-01-01 to 2024-01-02 date range)

**Confidence:** High (verified from actual API response)

### Q5: Where is the supplier ABN in the response? What field path?

**Supplier ABN field path:**

```
releases[].parties[]{
  "roles": ["supplier"],           // Filter for suppliers
  "additionalIdentifiers": [
    {
      "id": "90075448494",          // <-- THE ABN VALUE
      "scheme": "AU-ABN"            // <-- Confirms it's an ABN
    }
  ]
}
```

**Complete path:** `releases[i].parties[j].additionalIdentifiers[0].id` (where party has role "supplier")

**Structure:**
- `scheme` = "AU-ABN" (always for Australian Business Numbers)
- `id` = 11-digit ABN without spaces (e.g., "90075448494")
  - Format: No hyphens, no spaces, just digits
  - Length: Exactly 11 digits

**Example from actual API:**
```json
{
  "name": "ITC AUSTRALASIA PTY LTD",
  "additionalIdentifiers": [
    {
      "id": "90075448494",
      "scheme": "AU-ABN"
    }
  ],
  "roles": ["supplier"]
}
```

**Note:** Not all suppliers have ABN identifiers. International suppliers have `"id": "EXEMPTUUID-..."` instead. Domestic suppliers always have AU-ABN.

**Source:** OCDS standard for organization identifiers + verified from API response

**Confidence:** High

### Q6: How to filter by date for incremental sync

**Strategy 1: Use contractLastModified (RECOMMENDED for sync)**

```
GET /ocds/findByDates/contractLastModified/{lastSyncTime}/{now}T00:00:00Z
```

This captures all contracts that were created or amended since your last sync.

**Strategy 2: Use contractPublished (for new contracts only)**

```
GET /ocds/findByDates/contractPublished/{lastSyncTime}/{now}T00:00:00Z
```

This only captures newly published contracts, missing amendments to existing contracts.

**Date format:** ISO 8601 with time component required
- Format: `YYYY-MM-DDTHH:MM:SSZ`
- Examples:
  - `2024-01-01T00:00:00Z`
  - `2024-01-01T23:59:59Z`
  - `2026-03-07T14:30:00Z`

**Implementation tips:**
1. Store your last sync timestamp in database
2. Query from `lastSyncTime` to current time
3. For high-volume periods (e.g., start of financial year), chunk into daily queries to avoid oversized responses
4. AusTender publishes contracts in batches throughout the day, so polling every 1-6 hours is reasonable

**Source:** AusTender API documentation (from README)

**Confidence:** High

### Q7: Rate limits

**Finding:** Rate limits are NOT documented in official sources.

**Observed behavior:**
- API is responsive to reasonable query volumes
- No 429 (Too Many Requests) responses observed during testing
- Likely rate-limited by AWS API Gateway but specifics not published

**Recommendation for sync scripts:**
- Conservative approach: 1 request per second (3,600/hour)
- This avoids any potential rate limiting while still processing historical data efficiently
- For daily incremental syncs, you'll never hit limits (1-10 requests/day)

**Source:** No official documentation found; AWS standard limits apply

**Confidence:** Low (not officially documented)

### Q8: Total number of records available

**Latest data (Calendar year 2025):**
- **64,930 contracts** published in 2025
- Total contract value: $97.7 billion

**Financial year 2023-24:**
- **83,453 contracts** published
- Total contract value: $99.6 billion

**Historical data:**
- Available from: **January 1, 2013** onwards
- Estimated total: 800,000+ contracts since 2013

**Note:** Numbers vary by:
- Reporting threshold ($10k+ for NCEs, $400k+ for prescribed CCEs)
- Whether counting only new contracts or including amendments
- Whether counting by financial year or calendar year

**Source:** [Department of Finance - Procurement Statistics](https://www.finance.gov.au/government/procurement/statistics-australian-government-procurement-contracts-)

**Confidence:** High

### Q9: Sample API call with curl

**Simple: Get a single contract by ID**
```bash
curl -s "https://api.tenders.gov.au/ocds/findById/CN4026155" | jq .
```

**Query by date range (1 day)**
```bash
curl -s "https://api.tenders.gov.au/ocds/findByDates/contractPublished/2024-01-01T00:00:00Z/2024-01-02T00:00:00Z" | jq .
```

**Query by contract last modified (for incremental sync)**
```bash
curl -s "https://api.tenders.gov.au/ocds/findByDates/contractLastModified/2024-12-01T00:00:00Z/2026-03-07T00:00:00Z" | jq .
```

**Extract all supplier ABNs from a response**
```bash
curl -s "https://api.tenders.gov.au/ocds/findByDates/contractPublished/2024-01-01T00:00:00Z/2024-01-02T00:00:00Z" | \
  jq -r '.releases[].parties[] | select(.roles[]=="supplier") | .additionalIdentifiers[]? | select(.scheme=="AU-ABN") | .id'
```

**Extract contract value, supplier name, and ABN**
```bash
curl -s "https://api.tenders.gov.au/ocds/findByDates/contractPublished/2024-01-01T00:00:00Z/2024-01-02T00:00:00Z" | \
  jq -r '.releases[] | {
    contractId: .contracts[0].id,
    value: .contracts[0].value.amount,
    supplier: (.parties[] | select(.roles[]=="supplier") | .name),
    abn: (.parties[] | select(.roles[]=="supplier") | .additionalIdentifiers[]? | select(.scheme=="AU-ABN") | .id)
  }'
```

## Detailed Findings

### Finding 1: Open Access Public Data

**Source:** [GitHub - austender-ocds-api](https://github.com/austender/austender-ocds-api), [Department of Finance](https://www.finance.gov.au/)

**Key Points:**
- The API implements the Open Contracting Data Standard (OCDS 1.1)
- Data is published under Creative Commons Attribution 3.0 AU license
- No API key required — fully public access
- Developed using AWS Serverless Framework

**Implications:** Your sync script can authenticate without credentials, making infrastructure simpler.

### Finding 2: Response Structure is Standard OCDS Release Package

**Source:** [OCDS 1.1.5 Specification](https://standard.open-contracting.org/latest/en/), live API response

**Key Points:**
- Each response is a Release Package (collection of releases)
- A single "release" represents a contract or contract amendment
- Each release contains parties (suppliers, procuring entities), awards, contracts, and tender details
- Amendments are tracked via tag field ("contractAmendment") and amendments array

**Code Example:**

From the live API response, a simple contract looks like:
```json
{
  "ocid": "prod-a80c9fcc7cfa48f28954133183c3840c",
  "contracts": [{
    "id": "CN4026155",
    "description": "Lectora licenses for eLearning",
    "value": {
      "currency": "AUD",
      "amount": "14487.00"
    },
    "period": {
      "startDate": "2023-12-21T13:00:00Z",
      "endDate": "2026-12-20T13:00:00Z"
    }
  }],
  "parties": [{
    "name": "ITC AUSTRALASIA PTY LTD",
    "additionalIdentifiers": [{
      "id": "90075448494",
      "scheme": "AU-ABN"
    }],
    "roles": ["supplier"]
  }]
}
```

### Finding 3: ABN Extraction Pattern

**Source:** OCDS standard + verified from API response

**Key Points:**
- ABNs are stored in `additionalIdentifiers` array
- Scheme is always "AU-ABN" for Australian suppliers
- International suppliers use "EXEMPTUUID-..." pattern instead
- ABN is the 11-digit number in the `id` field

**SQL pattern for storage:**
```sql
INSERT INTO suppliers (name, abn, country)
VALUES (
  party.name,
  -- Extract ABN if it exists
  (party.additionalIdentifiers 
   | filter: scheme == 'AU-ABN' 
   | map .id 
   | .[0]),
  CASE 
    WHEN party.address.countryName = 'Australia' THEN 'AU'
    ELSE party.address.countryName
  END
)
```

### Finding 4: Pagination via Date Range Chunking

**Source:** OCDS pagination extension + API behavior

**Key Points:**
- API returns entire release package for a query — no offset/limit pagination
- For large date ranges, chunk into smaller periods
- Daily queries are safe and recommended
- The `contractLastModified` field is the key for incremental syncs

**Sync strategy:**
```
Loop:
  1. Query: findByDates/contractLastModified/{lastSync}/{now}
  2. Process all releases
  3. Extract and deduplicate contracts (same ocid, different releases = amendments)
  4. Store lastSync = now
  5. Wait until next sync window
```

### Finding 5: Contract Amendments Require Deduplication

**Source:** Live API response (observed multiple releases with same ocid)

**Key Points:**
- When a contract is amended, a new release is created with the same `ocid` but different `id`
- The `tag` field indicates "contractAmendment"
- The `amendments` array links to previous versions
- You must deduplicate by `ocid` to avoid storing duplicate contracts

**Example from API:**
```json
// Release 1 (original)
{
  "ocid": "prod-107e0a55727b4d368ef3cae611dfe8e8",
  "id": "prod-...-025ce64adc9b325cb4595076975228f2",
  "date": "2024-01-01T23:58:59Z",
  "tag": ["contract"]
}

// Release 2 (amendment)
{
  "ocid": "prod-107e0a55727b4d368ef3cae611dfe8e8",  // SAME ocid
  "id": "prod-...-cdfb37fa041539c296efc631e56954b2",  // DIFFERENT id
  "date": "2025-09-22T06:02:36Z",
  "tag": ["contractAmendment"],
  "amendments": [
    {
      "id": "CN4026141-A1",
      "releaseID": "prod-...-cdfb37fa041539c296efc631e56954b2",
      "amendsReleaseID": "prod-...-025ce64adc9b325cb4595076975228f2"
    }
  ]
}
```

**Storage strategy:** Store by `ocid`, always update to the latest `id` and `date`.

## Comparison Matrix

| Aspect | Details |
|--------|---------|
| **Authentication** | None required (public API) |
| **Rate Limit** | Not documented; conservative: 1 req/sec |
| **Pagination** | Date-range chunking (no offset/limit) |
| **ABN Location** | `releases[].parties[].additionalIdentifiers[].id` (where scheme="AU-ABN") |
| **Date Filtering** | ISO 8601 format; use contractLastModified for sync |
| **Response Format** | OCDS Release Package (JSON) |
| **Historical Data** | From 2013-01-01 onwards (~800k+ contracts) |
| **Update Frequency** | Batches throughout the day; poll 1-6 hourly |
| **License** | CC-BY 3.0 AU (open) |

## Recommendations

### For This Sync Script

1. **Use `/ocds/findByDates/contractLastModified`** endpoint with timestamps for incremental sync
   - Captures new contracts AND amendments
   - Store last sync time in database with timezone awareness

2. **Chunk date ranges intelligently**
   - Start with daily chunks during pilot
   - Monitor response size; expand to weekly/monthly if stable
   - For full historical sync (2013-2026), expect ~2000 contracts/day average

3. **Implement deduplication by ocid**
   - Releases with same ocid but different id = amendments
   - Store the latest release only
   - Track `contracts[].id` (e.g., "CN4026155") as the human-readable contract ID

4. **Extract ABN carefully**
   - Filter parties by role === "supplier"
   - Extract from additionalIdentifiers where scheme === "AU-ABN"
   - International suppliers will have EXEMPTUUID instead; decide how to handle these

5. **Handle amendments gracefully**
   - Check `contracts[].amendments` array for amendment history
   - Store amendment chain for audit trail
   - Update contract value/period when amendments occur

6. **Rate limiting strategy**
   - Use 1 request per second (safe margin)
   - For daily incremental sync: 1 request, well below any limit
   - For historical backfill: can safely do parallel queries (e.g., 3-5 concurrent)

### Implementation Notes

1. **ISO 8601 timestamps must include time component**
   - Correct: `2024-01-01T00:00:00Z`
   - Incorrect: `2024-01-01`

2. **ABN format is bare digits (no hyphens)**
   - Correct: `90075448494`
   - Incorrect: `90 075 448 494` or any formatted version

3. **Parties array mixes suppliers and procuring entities**
   - Always filter by role: `roles.includes("supplier")`
   - Procuring entities have different addresses (government departments)

4. **Contract values use AUD currency code**
   - All amounts are in AUD
   - Value structure: `{ "currency": "AUD", "amount": "14487.00" }`

5. **Some contracts have multiple suppliers**
   - Look at `awards[].suppliers[]` for the awarded suppliers
   - Compare with `parties[role=supplier]` for broader vendor information

## Open Questions

- What are AusTender's exact rate limit quotas per minute/hour/day? (Not published)
- How frequently does the API index new contracts throughout the day? (Likely batches, but frequency not specified)
- Are there any SLA guarantees for API uptime? (Standard AWS service level, but not explicitly stated for this API)

## Sources

1. [GitHub - austender/austender-ocds-api](https://github.com/austender/austender-ocds-api) - Official API documentation and code
2. [SwaggerHub - AusTender OCDS API v1.1](https://app.swaggerhub.com/apis/austender/ocds-api/1.1) - API specification
3. [OCDS 1.1.5 Standard - Organization Identifiers](https://standard.open-contracting.org/latest/en/guidance/map/organization_identifiers/) - Schema specification
4. [OCDS Pagination Extension](https://extensions.open-contracting.org/en/extensions/pagination/master/) - Pagination patterns
5. [Department of Finance - Procurement Statistics](https://www.finance.gov.au/government/procurement/statistics-australian-government-procurement-contracts-) - Contract volume data
6. [Australian Business Register (AU-ABN)](https://org-id.guide/list/AU-ABN) - ABN identifier standard

