# Goods Project — CivicGraph Integration Guide

How the Goods project connects to CivicGraph for procurement intelligence, grant tracking, and foundation data.

---

## Quick Start (Test Account)

| Field | Value |
|-------|-------|
| Account | `benjamin@act.place` |
| Login URL | `https://civicgraph.vercel.app/login` |
| Base URL | `https://civicgraph.vercel.app` |
| Local dev | `http://localhost:3003` |

Log in at the login URL with the benjamin@act.place account to generate an API key and test the authenticated procurement endpoints.

---

## 1. What Goods Can Access

CivicGraph provides two tiers of access relevant to the Goods project:

### Public (No Auth) — Read-Only Data

| Endpoint | What It Does |
|----------|-------------|
| `GET /api/data?type=entities` | 100K+ orgs (charities, companies, Indigenous corps, government) |
| `GET /api/data?type=grants` | 18K grant opportunities with deadlines and amounts |
| `GET /api/data?type=foundations` | 10.8K foundations with annual giving data |
| `GET /api/data?type=social-enterprises` | Social enterprises incl. Supply Nation suppliers |
| `GET /api/data?type=relationships` | 199K funding/contract links between entities |
| `GET /api/search?q=<term>` | Cross-type search (grants, foundations, programs) |
| `GET /api/global-search?q=<term>` | Parallel search across entities, grants, foundations |
| `GET /api/procurement/analyse?abns=<csv>` | Social impact analysis for supplier ABNs |

### Authenticated — Procurement Intelligence (Requires Login)

| Endpoint | What It Does |
|----------|-------------|
| `POST /api/tender-intelligence/discover` | Find suppliers by geography, type, certifications |
| `POST /api/tender-intelligence/enrich` | Bulk-enrich supplier lists (up to 200 per request) |
| `POST /api/tender-intelligence/compliance` | Score procurement against Commonwealth targets |
| `POST /api/tender-intelligence/pack` | Generate full Tender Intelligence Pack (5-section report) |

---

## 2. Setting Up the Connection

### Step 1: Log In and Generate an API Key

1. Go to `https://civicgraph.vercel.app/login`
2. Sign in with `benjamin@act.place`
3. Once logged in, generate an API key:

```bash
# From an authenticated browser session, call the keys endpoint.
# The session cookie handles auth automatically.
curl -X POST "https://civicgraph.vercel.app/api/keys" \
  -H "Content-Type: application/json" \
  -b "your-session-cookie" \
  -d '{
    "name": "Goods Project — Procurement",
    "permissions": ["read"],
    "rate_limit_per_hour": 200
  }'
```

Response:

```json
{
  "key": {
    "id": "uuid",
    "key_prefix": "cg_abcdef12",
    "name": "Goods Project — Procurement",
    "raw_key": "cg_<64-hex-characters>"
  },
  "warning": "Save this key now. It cannot be retrieved again."
}
```

**Save `raw_key` immediately.** It is shown once and cannot be recovered.

### Step 2: Store Credentials in Goods

Add to the Goods project `.env`:

```env
CIVICGRAPH_BASE_URL=https://civicgraph.vercel.app
CIVICGRAPH_API_KEY=cg_your_key_here
```

### Step 3: Test the Connection

```bash
# Public endpoint — should work immediately
curl -s "$CIVICGRAPH_BASE_URL/api/data?type=entities&limit=1"

# Authenticated endpoint — requires session (see Section 4 for session auth)
curl -s "$CIVICGRAPH_BASE_URL/api/tender-intelligence/discover" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"state": "ACT", "entity_types": ["indigenous_corp", "social_enterprise"], "limit": 5}'
```

---

## 3. Procurement API Reference

### 3a. Supplier Discovery

Find suppliers matching procurement criteria with contract history from AusTender (672K federal contracts).

```
POST /api/tender-intelligence/discover
```

**Request body:**

```json
{
  "state": "ACT",
  "postcode": "2600",
  "lga": "Canberra",
  "entity_types": ["indigenous_corp", "social_enterprise", "charity", "company"],
  "remoteness": "Major Cities of Australia",
  "community_controlled": false,
  "min_contracts": 0,
  "limit": 50
}
```

All fields are optional. `entity_types` defaults to all four types.

**Response:**

```json
{
  "suppliers": [
    {
      "gs_id": "GS-12345",
      "canonical_name": "Example Indigenous Corp",
      "abn": "12345678901",
      "entity_type": "indigenous_corp",
      "state": "ACT",
      "postcode": "2600",
      "remoteness": "Major Cities of Australia",
      "seifa_irsd_decile": 7,
      "is_community_controlled": true,
      "lga_name": "Canberra",
      "latest_revenue": 5000000,
      "sector": "community_services",
      "contracts": { "count": 12, "total_value": 3400000 }
    }
  ],
  "summary": {
    "total_found": 42,
    "indigenous_businesses": 8,
    "social_enterprises": 15,
    "community_controlled": 5,
    "with_federal_contracts": 22,
    "avg_seifa_decile": 5.3
  }
}
```

### 3b. Supplier List Enrichment

Upload your existing supplier list and get it matched against CivicGraph's entity database.

```
POST /api/tender-intelligence/enrich
```

**Request body:**

```json
{
  "suppliers": [
    { "name": "Supplier One Pty Ltd", "abn": "12345678901" },
    { "name": "Another Supplier" }
  ]
}
```

Max 200 suppliers per request. ABN is optional but improves match accuracy.

**Response includes:** resolution rate %, Indigenous/social enterprise flags, contract counts per supplier.

### 3c. Compliance Scoring

Score a supplier list against Commonwealth procurement policy targets.

```
POST /api/tender-intelligence/compliance
```

**Request body:**

```json
{
  "suppliers": [
    { "name": "Supplier A", "abn": "12345678901", "contract_value": 500000 },
    { "name": "Supplier B", "abn": "98765432101", "contract_value": 250000 }
  ],
  "total_contract_value": 750000,
  "state": "ACT"
}
```

**Targets scored against:**

| Target | Threshold |
|--------|-----------|
| Indigenous participation | 3.0% (Commonwealth Indigenous Procurement Policy) |
| Social enterprise | 5.0% (aspirational) |
| SME | 35.0% |
| Regional suppliers | 20.0% |

**Response includes:** percentage by count and by value, meets_target boolean, shortfall_value, recommended alternative suppliers if targets not met.

### 3d. Full Tender Intelligence Pack

Generate a printable 5-section procurement intelligence report.

```
POST /api/tender-intelligence/pack
```

**Request body:**

```json
{
  "state": "ACT",
  "lga": "Canberra",
  "total_contract_value": 2000000,
  "existing_suppliers": "Supplier A, 12345678901, 500000\nSupplier B, 98765432101, 250000"
}
```

**Sections returned:**
1. Market Capability Overview
2. Compliance Analysis (Indigenous %, SE %, regional %)
3. Supplier Shortlist (top 20 by contract history)
4. Bid Strength Analysis (natural language insights)
5. Recommended Partners (top 10 Indigenous/SE/community-controlled)

### 3e. Procurement Social Impact Analyser (Public)

No authentication required. Analyse a supplier list by ABN for social impact metrics.

```
POST /api/procurement/analyse
```

```json
{
  "abns": ["12345678901", "98765432101"],
  "values": {
    "12345678901": 500000,
    "98765432101": 250000
  }
}
```

Or as a quick GET:

```
GET /api/procurement/analyse?abns=12345678901,98765432101
```

Max 500 ABNs per request.

**Response includes:**
- Indigenous / social enterprise / community-controlled counts and percentages
- Breakdown by remoteness, state, and SEIFA disadvantage decile
- Per-supplier flags: `is_indigenous`, `is_social_enterprise`, `is_community_controlled`, `is_charity`

---

## 4. Authentication for Goods Backend

The Tender Intelligence endpoints (`/api/tender-intelligence/*`) require a Supabase session, not a Bearer token. Here is how to authenticate from the Goods backend:

### Option A: Supabase Auth (Recommended)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tednluwflfhxyucgwigh.supabase.co',
  process.env.CIVICGRAPH_ANON_KEY  // sb_publishable_7WrSXaJoGbP5btr1k7EYXQ_ZDJeWrc_
);

// Sign in as benjamin@act.place (do once, cache the session)
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'benjamin@act.place',
  password: process.env.CIVICGRAPH_PASSWORD,
});

// Use the access token for API calls
const res = await fetch('https://civicgraph.vercel.app/api/tender-intelligence/discover', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `sb-tednluwflfhxyucgwigh-auth-token=${session.access_token}`,
  },
  body: JSON.stringify({
    state: 'ACT',
    entity_types: ['indigenous_corp', 'social_enterprise'],
    limit: 20,
  }),
});

const data = await res.json();
```

**Goods `.env` for this approach:**

```env
CIVICGRAPH_BASE_URL=https://civicgraph.vercel.app
CIVICGRAPH_SUPABASE_URL=https://tednluwflfhxyucgwigh.supabase.co
CIVICGRAPH_ANON_KEY=sb_publishable_7WrSXaJoGbP5btr1k7EYXQ_ZDJeWrc_
CIVICGRAPH_EMAIL=benjamin@act.place
CIVICGRAPH_PASSWORD=<password>
```

### Option B: Public Endpoints Only (No Auth)

If the Goods project only needs supplier lookup and social impact analysis, these endpoints work without authentication:

```typescript
// Procurement analysis — no auth needed
const res = await fetch(
  'https://civicgraph.vercel.app/api/procurement/analyse',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      abns: ['12345678901', '98765432101'],
      values: { '12345678901': 500000 },
    }),
  }
);

// Public data queries — no auth needed
const entities = await fetch(
  'https://civicgraph.vercel.app/api/data?type=entities&state=ACT&entity_type=indigenous_corp&limit=50'
).then(r => r.json());

// Search — no auth needed
const results = await fetch(
  'https://civicgraph.vercel.app/api/global-search?q=indigenous+supplier'
).then(r => r.json());
```

---

## 5. Typical Goods Integration Flow

```
Goods User uploads supplier list (ABNs)
        |
        v
POST /api/procurement/analyse          <-- Public, no auth
  Returns: Indigenous %, SE %, remoteness, SEIFA breakdown
        |
        v
POST /api/tender-intelligence/enrich   <-- Requires auth
  Returns: Matched entities, contract history, resolution rate
        |
        v
POST /api/tender-intelligence/compliance  <-- Requires auth
  Returns: Scores vs Commonwealth targets, shortfalls
        |
        v
POST /api/tender-intelligence/pack     <-- Requires auth
  Returns: Full 5-section report (PDF-ready)
        |
        v
Goods displays results / exports CSV/PDF
```

---

## 6. Public Data Endpoints Reference

These all work without authentication.

### Entity Search

```bash
# By state
curl "https://civicgraph.vercel.app/api/data?type=entities&state=ACT&limit=50"

# By name
curl "https://civicgraph.vercel.app/api/data?type=entities&q=salvation%20army"

# By ABN
curl "https://civicgraph.vercel.app/api/data?type=entities&abn=12345678901"

# Community-controlled only
curl "https://civicgraph.vercel.app/api/data?type=entities&community_controlled=true&state=ACT"

# Social enterprises (Supply Nation)
curl "https://civicgraph.vercel.app/api/data?type=social-enterprises&source=supply_nation"
```

### Grants and Foundations

```bash
# Open grants above $10K
curl "https://civicgraph.vercel.app/api/data?type=grants&min_amount=10000"

# Foundations focused on indigenous issues
curl "https://civicgraph.vercel.app/api/data?type=foundations&focus=indigenous&state=act"

# Government programs in ACT
curl "https://civicgraph.vercel.app/api/data?type=government-programs&jurisdiction=act"
```

### Pagination and Export

All endpoints support `limit` (max 500), `offset`, and `format` (`json` or `csv`):

```bash
# Page 2 of results
curl "https://civicgraph.vercel.app/api/data?type=entities&state=ACT&limit=50&offset=50"

# Export as CSV
curl "https://civicgraph.vercel.app/api/data?type=foundations&format=csv" -o foundations.csv
```

### Endpoint Directory

```bash
# Returns all available types and example queries
curl "https://civicgraph.vercel.app/api/data"
```

---

## 7. Important: CORS

CivicGraph does not set CORS headers. Browser-side JavaScript from a different domain will fail.

**All API calls must come from the Goods backend (server-side), not from client-side JavaScript.**

```typescript
// In a Goods API route or server action — this works:
const res = await fetch('https://civicgraph.vercel.app/api/data?type=grants&limit=50');
const data = await res.json();

// In browser JavaScript on the Goods frontend — this will fail with CORS error:
// fetch('https://civicgraph.vercel.app/api/data?type=grants')
```

---

## 8. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `404` | Wrong URL path | Check endpoint spelling against this doc |
| `401 Authentication required` | No session for TI endpoints | Use Supabase auth (Section 4, Option A) |
| `400 At least one valid entity_type required` | Invalid entity type | Use: `indigenous_corp`, `social_enterprise`, `charity`, `company`, `foundation`, `government_body` |
| `CORS error` | Browser-side fetch | Move API calls to Goods backend (Section 7) |
| `429` | Rate limit exceeded | Reduce request frequency or increase key limit |
| Empty `suppliers` array | No matches for filters | Broaden filters (remove postcode, try state-only) |
| `ECONNREFUSED` | App redeploying | Retry after 30 seconds |

### Quick Connectivity Test

```bash
# Should return JSON with endpoint directory
curl -s "https://civicgraph.vercel.app/api/data" | head -5

# Should return entity data
curl -s "https://civicgraph.vercel.app/api/data?type=entities&limit=1"

# Should return social impact analysis
curl -s -X POST "https://civicgraph.vercel.app/api/procurement/analyse" \
  -H "Content-Type: application/json" \
  -d '{"abns": ["25009942998"]}'
```

---

## 9. Contact

| | |
|-|-|
| Email | `hello@civicgraph.au` |
| Test account | `benjamin@act.place` |
| Subject line | "Goods Project Integration" |
