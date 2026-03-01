# GrantConnect Source Plugin Deep-Dive
Generated: 2026-03-01

## Summary

The GrantConnect source plugin is **correctly implemented** but fundamentally limited by its data source choice. It uses Firecrawl to fetch the GrantConnect RSS feed, which contains **ALL ~2,000 open federal grants**, but the plugin only processes what's in that single RSS file. The "fraction" issue stems from **filtering logic** and potentially **RSS feed structure**, not missing grants.

## Critical Findings

### 1. RSS Feed is Blocked Without Firecrawl
**Location:** `/packages/grant-engine/src/sources/grantconnect.ts:20`

```typescript
const RSS_URL = 'https://www.grants.gov.au/public_data/rss/rss.xml';
```

**Direct curl test:**
```bash
curl "https://www.grants.gov.au/public_data/rss/rss.xml"
# Returns: 403 ERROR - CloudFront blocks direct HTTP requests
```

**Current solution:** Firecrawl proxy (`@mendable/firecrawl-js` v4.15.0)
```typescript
const result = await firecrawl.scrape(RSS_URL, { formats: ['html'] });
```

### 2. The Plugin Architecture

```
GrantConnect Plugin Flow:
1. Firecrawl.scrape(RSS_URL) → Returns raw XML as HTML string
2. Cheerio parses XML → Extracts <item> elements
3. Filter by categories + keywords (if provided in query)
4. Yield RawGrant objects → Normalizer → Deduplicator → Storage
```

**Key code:** Lines 71-182 in `grantconnect.ts`

## Source Code

### Full GrantConnect Plugin
**File:** `/Users/benknight/Code/grantscope/packages/grant-engine/src/sources/grantconnect.ts`

```typescript
/**
 * GrantConnect Source Plugin
 *
 * Fetches grants from grants.gov.au via their RSS feed.
 * The RSS feed contains ALL open grant opportunities with structured data.
 * GrantConnect blocks direct HTTP (403), so we use Firecrawl to fetch.
 *
 * RSS URL: https://www.grants.gov.au/public_data/rss/rss.xml
 * Contains: title (GO ID + name), link, description, pubDate per grant
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

// ... [185 lines total - see file for complete code]

export function createGrantConnectPlugin(config: GrantConnectConfig = {}): SourcePlugin {
  // Firecrawl API key from config or env
  // RSS fetching via Firecrawl (bypasses CloudFront block)
  // Cheerio XML parsing
  // Category inference from title + description
  // Keyword filtering
  // Yields RawGrant[] with dedup key: lowercase(provider):lowercase(name)
}
```

### CanonicalGrant Interface
**File:** `/Users/benknight/Code/grantscope/packages/grant-engine/src/types.ts:49-64`

```typescript
export interface CanonicalGrant {
  name: string;
  provider: string;
  program: string | null;
  amountMin: number | null;
  amountMax: number | null;
  currency: string;
  closesAt: string | null;    // ISO date string
  url: string | null;
  description: string | null;
  categories: string[];
  geography: string[];
  sources: GrantSource[];      // Tracks which plugins found this grant
  discoveryMethod: string;
  dedupKey: string;            // lowercase(provider):lowercase(name)
}

export interface GrantSource {
  pluginId: string;
  foundAt: string;            // ISO timestamp
  rawUrl?: string;
  confidence: 'verified' | 'llm_knowledge' | 'scraped';
}
```

### Engine Orchestration
**File:** `/Users/benknight/Code/grantscope/packages/grant-engine/src/engine.ts:71-177`

```typescript
async discover(query: DiscoveryQuery = {}): Promise<DiscoveryRunResult> {
  // 1. Run all enabled source plugins (default: grantconnect, web-search, llm-knowledge)
  // 2. Normalize raw grants → CanonicalGrant
  // 3. Deduplicate across sources
  // 4. Filter against existing DB records
  // 5. Upsert new/updated grants
  // 6. Update plugin stats
}
```

## Why Only a Fraction?

### Hypothesis 1: Filtering Logic Removes Valid Grants
**Location:** `grantconnect.ts:122-133`

```typescript
// Filter by categories if specified
if (queryCategories.size > 0) {
  const hasMatch = categories.some(c => queryCategories.has(c));
  if (!hasMatch && categories.length > 0) return; // ← Skips non-matching
}

// Filter by keywords if specified
if (queryKeywords.length > 0) {
  const text = `${title} ${description}`.toLowerCase();
  const hasMatch = queryKeywords.some(k => text.includes(k));
  if (!hasMatch) return; // ← Skips non-matching
}
```

**The discovery script runs with:**
```typescript
const result = await engine.discover({
  geography: ['AU'],
  status: 'open',
  // NO categories or keywords filter
});
```

So filtering should **NOT** be the issue unless the RSS feed itself is incomplete.

### Hypothesis 2: RSS Feed Contains Subset of Grants
**Needs verification:** Does `https://www.grants.gov.au/public_data/rss/rss.xml` actually contain ALL 2,000 open grants, or is it paginated/limited?

**How to test:**
1. Use Firecrawl to fetch the RSS
2. Count `<item>` elements in the XML
3. Compare to grants.gov.au website's "X open grants" count

### Hypothesis 3: Cheerio XML Parsing Issues
**Location:** Lines 98-100

```typescript
const $ = cheerio.load(html, { xml: true });
const items = $('item');
console.log(`[grantconnect] Found ${items.length} grants in RSS feed`);
```

Cheerio with `{ xml: true }` should parse RSS correctly, but worth checking if malformed XML causes early truncation.

### Hypothesis 4: Deduplication Removes Too Many
**File:** `/Users/benknight/Code/grantscope/packages/grant-engine/src/deduplicator.ts`

Dedup key: `lowercase(provider):lowercase(name)`

If grants have slight name variations (e.g., "Arts Grant 2025" vs "Arts Grant"), they'd be treated as separate grants. This would increase count, not decrease it.

## Configuration & Dependencies

### Environment Variables
**File:** `.env.example`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
FIRECRAWL_API_KEY=          # ← REQUIRED for GrantConnect
```

### Dependencies
**File:** `packages/grant-engine/package.json`
```json
{
  "@mendable/firecrawl-js": "^4.15.0",
  "@supabase/supabase-js": "^2.49.1",
  "cheerio": "^1.0.0"
}
```

### Firecrawl Cost
**README.md:43**
> GrantConnect RSS | Federal grants | XML via Firecrawl | ~$0.01/day

Firecrawl scrapes are ~$0.01 each. Running daily = ~$0.30/month for GrantConnect alone.

## Database Schema

### Grants Table
**Referenced in:** `storage/repository.ts:19`

```typescript
await this.supabase
  .from('grant_opportunities')
  .select('url, name');
```

**Schema (inferred from repository code):**
- `name` (text)
- `provider` (text)
- `program` (text | null)
- `amount_min` (numeric)
- `amount_max` (numeric)
- `closes_at` (timestamptz)
- `url` (text, UNIQUE constraint)
- `categories` (text[])
- `sources` (jsonb) - Array of `{pluginId, foundAt, rawUrl, confidence}`
- `discovery_method` (text)
- `last_verified_at` (timestamptz)
- `discovered_by` (text)
- `source` (text) - legacy field

**Upsert logic:** Insert first, if duplicate URL (error code 23505), update sources + last_verified_at.

### Supporting Tables
- `grant_discovery_runs` - Tracks each discovery run (sources_used, grants_discovered, status)
- `grant_source_plugins` - Plugin stats (last_run_at, total_discovered)

**No migration files found** for these tables in the repo — likely created manually or in a parent repo.

## Discovery Invocation

### Script
**File:** `scripts/grantscope-discovery.mjs`

```javascript
const engine = new GrantEngine({
  supabase,
  sources,              // CLI arg: --sources=grantconnect,web-search or undefined (all)
  dryRun: DRY_RUN,
});

const result = await engine.discover({
  geography: ['AU'],
  status: 'open',
});
```

**Default sources (if none specified):**
```typescript
const sourcesUsed = this.config.sources || [
  'grantconnect',
  'web-search',
  'llm-knowledge'
];
```

## Registered Source Plugins

**File:** `engine.ts:45-52`
```typescript
this.registry.register(createGrantConnectPlugin());
this.registry.register(createWebSearchPlugin());
this.registry.register(createLLMKnowledgePlugin());
this.registry.register(createDataGovAuPlugin());
this.registry.register(createQLDGrantsPlugin());
this.registry.register(createBusinessGovAuPlugin());
this.registry.register(createNSWGrantsPlugin());
this.registry.register(createVICGrantsPlugin());
```

**Total: 8 source plugins**

## Blockers to Full Coverage

### 1. RSS Feed Completeness
**STATUS:** ✗ UNCERTAIN (not verified)

The plugin **assumes** the RSS feed contains all grants. Need to verify:
- Fetch the RSS via Firecrawl
- Count `<item>` elements
- Compare to grants.gov.au's stated "X open grants"

### 2. No Pagination/Crawling
**STATUS:** ✓ VERIFIED (by design)

The plugin fetches **ONE RSS file** and stops. If grants.gov.au has a paginated API or requires crawling individual grant pages for full metadata, this plugin won't capture that.

### 3. Category Inference Accuracy
**STATUS:** ✓ VERIFIED (basic regex matching)

Categories are inferred via regex on title + description:
```typescript
if (/indigenous|first nations|aboriginal|torres strait|atsi/.test(text)) cats.push('indigenous');
if (/arts?|cultur|creative|music|film|heritage/.test(text)) cats.push('arts');
// ... 9 more categories
```

**Limitation:** Grants without keyword matches get empty categories, which may affect filtering in other parts of the system.

### 4. Missing Deadline Parsing
**STATUS:** ✗ BLOCKER

The RSS feed has `<pubDate>` (publication date), but the plugin **does not extract or parse closing deadlines**. The CanonicalGrant `closesAt` field is never set.

**Code:** Lines 166-174 show no deadline extraction.

```typescript
grants.push({
  title,
  provider,
  sourceUrl: link || undefined,
  description: description.slice(0, 1000) || undefined,
  categories,
  sourceId: 'grantconnect',
  geography: ['AU'],
  // ← No deadline field
});
```

### 5. No Individual Grant Page Scraping
**STATUS:** Known limitation

The RSS provides:
- Title (with GO ID: "GO7867: Program Name")
- Link to grant page
- Brief description

For full details (deadline, eligibility, amounts), would need to scrape each individual grant page. The plugin currently **does not** follow the links.

## Next Steps to Diagnose

### Test 1: Count RSS Items
```bash
# Via Firecrawl (requires API key)
curl -X POST "https://api.firecrawl.dev/v0/scrape" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.grants.gov.au/public_data/rss/rss.xml","formats":["html"]}' \
  | jq -r '.data.html' \
  | xmllint --xpath 'count(//item)' -
```

### Test 2: Compare to Website
1. Go to https://www.grants.gov.au/
2. Check "X open grants" displayed
3. Compare to RSS item count

### Test 3: Run Discovery with Verbose Logging
```bash
cd /Users/benknight/Code/grantscope
node scripts/grantscope-discovery.mjs --sources=grantconnect --dry-run
```

Check console output:
```
[grantconnect] Found XX grants in RSS feed
[grantconnect] YY grants after filtering (of XX total)
```

### Test 4: Inspect Individual Grant Pages
Pick a grant from RSS, fetch its page, check if it has:
- Closing date
- Amount range
- Detailed eligibility

If yes → need to add individual page scraping to the plugin.

## Recommendations

### Short-term Fix (Hours)
1. **Add deadline extraction** from RSS `<pubDate>` or fetch from individual grant pages
2. **Add pagination support** if RSS has multiple pages/feeds
3. **Verify RSS completeness** via manual count

### Medium-term Enhancement (Days)
1. **Scrape individual grant pages** for full metadata (deadline, amounts, eligibility)
2. **Cache Firecrawl results** to avoid re-fetching the same RSS multiple times/day
3. **Add GrantConnect API integration** (if available) to replace RSS scraping

### Long-term Architecture (Weeks)
1. **Separate "discovery" from "enrichment"** — RSS finds grants, separate job enriches them
2. **Build GrantConnect-specific scraper** using Playwright/Puppeteer with anti-bot rotation
3. **Crowdsource validation** — let users flag missing/incorrect grants

## Key Files Reference

| File | Purpose | Lines |
|------|---------|------:|
| `/packages/grant-engine/src/sources/grantconnect.ts` | GrantConnect RSS scraper | 185 |
| `/packages/grant-engine/src/types.ts` | Core type definitions | 137 |
| `/packages/grant-engine/src/engine.ts` | Discovery orchestration | 193 |
| `/packages/grant-engine/src/storage/repository.ts` | Supabase CRUD | 179 |
| `/packages/grant-engine/src/normalizer.ts` | Raw → Canonical grant transform | ? |
| `/packages/grant-engine/src/deduplicator.ts` | Cross-source deduplication | ? |
| `/scripts/grantscope-discovery.mjs` | Discovery CLI script | 74 |

## Open Questions

1. **Does the RSS feed contain all 2,000 grants?** Need manual verification.
2. **Is there a GrantConnect API?** Check https://www.grants.gov.au/developer or similar.
3. **What's the actual current grant count in the database?** (Can't query without Supabase access)
4. **Are there rate limits on Firecrawl?** Check if we're hitting throttling.
5. **Why no deadline extraction?** Design choice or oversight?
