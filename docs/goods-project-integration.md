# Accessing CivicGraph (GrantScope) from the Goods Project

This guide explains how the Goods project can connect to and query the CivicGraph platform for procurement, grant, and foundation tracking data.

---

## 1. Base URL

| Environment | URL |
|-------------|-----|
| Production  | `https://civicgraph.vercel.app` |
| Local dev   | `http://localhost:3003` |

All API endpoints are relative to this base URL.

---

## 2. Public Data API (No Authentication Required)

The `/api/data` endpoint provides open, read-only access to CivicGraph datasets. No API key or login is needed.

### Discovery

```
GET /api/data
```

Returns a directory of all available data types and their query parameters.

### Available Data Types

| Type | Endpoint | Description |
|------|----------|-------------|
| `entities` | `/api/data?type=entities` | 100K+ organisations (charities, companies, government bodies, Indigenous orgs) |
| `relationships` | `/api/data?type=relationships` | 199K+ funding/contractual links between entities |
| `foundations` | `/api/data?type=foundations` | 10.8K philanthropic foundations with giving data |
| `grants` | `/api/data?type=grants` | 18K grant opportunities with deadlines and amounts |
| `social-enterprises` | `/api/data?type=social-enterprises` | Social enterprises including Supply Nation suppliers |
| `money-flows` | `/api/data?type=money-flows` | Cross-sector funding flow data |
| `community-orgs` | `/api/data?type=community-orgs` | Community organisations by domain |
| `government-programs` | `/api/data?type=government-programs` | Government funding programs by jurisdiction |
| `reports` | `/api/data?type=reports` | Published analysis reports |

### Common Query Parameters

All data types support:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `limit` | Number of results (max 500) | `100` |
| `offset` | Pagination offset | `0` |
| `format` | Response format: `json` or `csv` | `json` |

### Example Requests

```bash
# List all entities in Queensland
curl "https://civicgraph.vercel.app/api/data?type=entities&state=QLD&limit=50"

# Search entities by name
curl "https://civicgraph.vercel.app/api/data?type=entities&q=salvation%20army"

# Look up entity by ABN
curl "https://civicgraph.vercel.app/api/data?type=entities&abn=12345678901"

# Open grants above $10,000
curl "https://civicgraph.vercel.app/api/data?type=grants&min_amount=10000"

# Foundations focused on indigenous issues in QLD
curl "https://civicgraph.vercel.app/api/data?type=foundations&focus=indigenous&state=qld"

# Social enterprises from Supply Nation
curl "https://civicgraph.vercel.app/api/data?type=social-enterprises&source=supply_nation"

# Community-controlled organisations only
curl "https://civicgraph.vercel.app/api/data?type=entities&community_controlled=true"

# Government programs in QLD
curl "https://civicgraph.vercel.app/api/data?type=government-programs&jurisdiction=qld"

# Export as CSV
curl "https://civicgraph.vercel.app/api/data?type=foundations&format=csv" -o foundations.csv
```

### Type-Specific Filters

**Entities** (`type=entities`)
| Filter | Example |
|--------|---------|
| `entity_type` | `charity`, `company`, `government`, `foundation` |
| `state` | `QLD`, `NSW`, `VIC`, `WA`, `SA`, `TAS`, `NT`, `ACT` |
| `postcode` | `2000`, `4000` |
| `abn` | `12345678901` |
| `q` | Name search (fuzzy match) |
| `community_controlled` | `true` |

**Relationships** (`type=relationships`)
| Filter | Example |
|--------|---------|
| `relationship_type` | `donated_to`, `contracted`, `funded` |
| `dataset` | Source dataset name |
| `min_amount` | Minimum dollar amount |
| `year` | Financial year |

**Grants** (`type=grants`)
| Filter | Example |
|--------|---------|
| `min_amount` | Minimum grant value |
| `max_amount` | Maximum grant value |
| `category` | Grant category |

**Foundations** (`type=foundations`)
| Filter | Example |
|--------|---------|
| `focus` | Thematic focus (e.g. `indigenous`, `environment`) |
| `state` | Geographic focus state |

---

## 3. Search API (No Authentication Required)

### Basic Search

```
GET /api/search?q=<query>
```

Searches across grants, foundations, and programs simultaneously.

| Parameter | Description |
|-----------|-------------|
| `q` | Search term (required) |
| `type` | Filter to `grant`, `foundation`, or `program` |
| `category` | Filter by category |
| `limit` | Max results per type (max 100, default 25) |
| `offset` | Pagination offset |

```bash
curl "https://civicgraph.vercel.app/api/search?q=indigenous+health&type=grant"
```

### Global Search

```
GET /api/global-search?q=<query>
```

Parallel search across entities, grants, and foundations. Returns results grouped by type.

| Parameter | Description |
|-----------|-------------|
| `q` | Search term, minimum 2 characters (required) |
| `limit` | Max entity results (max 50, default 20) |

```bash
curl "https://civicgraph.vercel.app/api/global-search?q=red+cross"
```

**Response format:**

```json
{
  "entities": [
    {
      "type": "entity",
      "id": "GS-12345",
      "name": "Australian Red Cross",
      "entityType": "charity",
      "abn": "...",
      "state": "VIC"
    }
  ],
  "grants": [...],
  "foundations": [...]
}
```

---

## 4. Authenticated API Access (API Key Required)

For higher rate limits, write access, or user-scoped features, generate an API key.

### Step 1: Create a CivicGraph Account

1. Go to `https://civicgraph.vercel.app/login`
2. Sign up with email and password
3. Complete your organisation profile

### Step 2: Generate an API Key

1. Log in to your account
2. Navigate to your profile/settings
3. Generate an API key via the dashboard

Or programmatically (requires active session):

```bash
curl -X POST "https://civicgraph.vercel.app/api/keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "name": "Goods Project Integration",
    "permissions": ["read"],
    "rate_limit_per_hour": 100
  }'
```

**Response:**

```json
{
  "key": {
    "id": "uuid",
    "key_prefix": "cg_abcdef12",
    "name": "Goods Project Integration",
    "raw_key": "cg_abc123...full_key_here..."
  },
  "warning": "Save this key now. It cannot be retrieved again."
}
```

**Important:** Save the `raw_key` immediately. It is shown only once and cannot be recovered.

### Step 3: Use the API Key

Include the key in the `Authorization` header:

```bash
curl "https://civicgraph.vercel.app/api/discover" \
  -H "Authorization: Bearer cg_your_api_key_here"
```

### API Key Details

| Property | Value |
|----------|-------|
| Format | `cg_` followed by 64 hex characters |
| Storage | SHA-256 hashed (never stored in plain text) |
| Rate limit | Configurable per key (default: 100 requests/hour) |
| Permissions | `read` (default) |

---

## 5. Data Export

```
GET /api/data/export?type=<type>&format=csv
```

Download data as CSV or JSON for offline use or bulk import into the Goods project.

```bash
# Export all foundations as CSV
curl "https://civicgraph.vercel.app/api/data/export?type=foundations&format=csv" -o foundations.csv

# Export grants as JSON
curl "https://civicgraph.vercel.app/api/data/export?type=grants&format=json" -o grants.json
```

---

## 6. Direct Database Access (Advanced)

For partners requiring direct database queries, CivicGraph uses Supabase (PostgreSQL).

### Connection Details

| Property | Value |
|----------|-------|
| Host | `aws-0-ap-southeast-2.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| Project ID | `tednluwflfhxyucgwigh` |

**Access requires credentials.** Contact `hello@civicgraph.au` to request read-only database credentials or a dedicated service role key for the Goods project.

### Supabase Client (JavaScript/TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tednluwflfhxyucgwigh.supabase.co',
  'YOUR_ANON_OR_SERVICE_KEY'
);

// Query entities
const { data } = await supabase
  .from('gs_entities')
  .select('gs_id, canonical_name, abn, entity_type, state')
  .ilike('canonical_name', '%search term%')
  .limit(20);
```

### Supabase Client (Python)

```python
from supabase import create_client

supabase = create_client(
    "https://tednluwflfhxyucgwigh.supabase.co",
    "YOUR_ANON_OR_SERVICE_KEY"
)

result = supabase.table("gs_entities") \
    .select("gs_id, canonical_name, abn, entity_type, state") \
    .ilike("canonical_name", "%search term%") \
    .limit(20) \
    .execute()
```

---

## 7. Troubleshooting Connection Issues

### "Cannot connect" or "Not found" errors

| Problem | Solution |
|---------|----------|
| `404 Not Found` | Verify the URL is correct: `https://civicgraph.vercel.app/api/data` |
| `ECONNREFUSED` | The app may be redeploying. Wait 30 seconds and retry. |
| `401 Unauthorized` | API key missing or invalid. Public endpoints (`/api/data`, `/api/search`) do not require auth. |
| `403 Forbidden` | Your API key lacks the required permission. |
| `429 Too Many Requests` | Rate limit exceeded. Default is 100 requests/hour per key. |
| `CORS error` in browser | CivicGraph APIs are same-origin only. Use server-side requests from the Goods backend, not browser JavaScript. |
| `timeout` | Use smaller `limit` values. Max is 500 per request. |
| Empty results | Check filter values. Use `/api/data` (no params) to see the endpoint directory. |

### CORS Workaround

CivicGraph does not set CORS headers, so browser-based requests from a different domain will fail. The Goods project should make API calls from its **backend server**, not from client-side JavaScript:

```javascript
// WRONG: Browser-side fetch (will fail with CORS error)
// fetch("https://civicgraph.vercel.app/api/data?type=grants")

// CORRECT: Server-side fetch from your Goods backend
// In your Goods API route or server action:
const res = await fetch("https://civicgraph.vercel.app/api/data?type=grants&limit=50");
const data = await res.json();
```

### Testing Connectivity

```bash
# Quick health check — should return the endpoint directory
curl -s "https://civicgraph.vercel.app/api/data" | head -20

# Search test
curl -s "https://civicgraph.vercel.app/api/global-search?q=test"

# Check a specific entity
curl -s "https://civicgraph.vercel.app/api/data?type=entities&limit=1"
```

---

## 8. Contact & Support

| Channel | Detail |
|---------|--------|
| Email | `hello@civicgraph.au` |
| Subject | "Goods Project Integration — Access Request" |

Include your organisation name, ABN, and intended use case when requesting elevated access or direct database credentials.
