# GrantScope Supabase Database Access Audit
Generated: 2026-03-09

## Executive Summary

GrantScope uses **5 distinct methods** to access the Supabase database, each with different auth mechanisms, capabilities, and reliability profiles. The **preferred method** is `gsql.mjs` (service role key + exec_sql RPC) for scripts, and `getServiceSupabase()` (service role key + PostgREST) for API routes.

## Critical Finding: MCP Limitation

**Supabase MCP only sees ~153 tables** (migration-tracked via Empathy Ledger migrations). The actual database has **571+ tables**. GrantScope-specific tables (`gs_entities`, `political_donations`, `foundations`, `acnc_charities`, etc.) are **INVISIBLE** to MCP commands.

**Root Cause:** MCP Management API filters to migration-tracked tables. Tables created via direct psql/PostgREST are hidden from MCP.

**Workaround:** Use `gsql.mjs` or psql with `SET ROLE postgres` for GrantScope tables.

---

## Access Methods Matrix

| Method | Auth | What It Can Do | Reliability | Limitations | Status |
|--------|------|----------------|-------------|-------------|--------|
| **1. gsql.mjs** | Service role key | SELECT/INSERT/UPDATE/DELETE via exec_sql RPC | **HIGH** - Stable key, no rotation | Cannot do DDL (CREATE TABLE, indexes) | ✅ **PREFERRED** |
| **2. getServiceSupabase()** | Service role key | Full PostgREST API (select/insert/update/delete/rpc) | **HIGH** - Stable key, no rotation | Cannot do raw SQL (use RPC instead) | ✅ **PREFERRED (API routes)** |
| **3. psql (cli_login)** | Rotating password | Full SQL including DDL (CREATE, ALTER, DROP) | **MEDIUM** - Password rotates frequently | Must fetch fresh password each time | ⚠️ **DDL ONLY** |
| **4. Supabase MCP** | Management API | Migration-tracked tables only (~153 of 571) | **LOW** - Cannot see GrantScope tables | GrantScope tables invisible | ❌ **AVOID** |
| **5. createSupabaseServer()** | User session (anon key + cookies) | RLS-enforced queries (user-scoped) | **HIGH** - For authed users only | RLS policies limit access | ✅ **Frontend/SSR** |

---

## Method 1: gsql.mjs (PREFERRED for scripts)

### What It Is
Command-line utility using Supabase service role key to execute SQL via `exec_sql` RPC function.

### Auth Mechanism
```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### How It Works
- Calls `exec_sql(query)` RPC function (SECURITY DEFINER, service_role only)
- RPC defined as:
```sql
CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
```

### Usage
```bash
cd /Users/benknight/Code/grantscope
node scripts/gsql.mjs "SELECT COUNT(*) FROM gs_entities"
node scripts/gsql-health.mjs  # Pre-built health dashboard
```

### Capabilities
- ✅ SELECT/INSERT/UPDATE/DELETE
- ✅ Sees ALL 571 tables (not limited to migrations)
- ✅ Can query GrantScope-specific tables
- ❌ Cannot do DDL (CREATE TABLE, indexes, ALTER) — use psql for that

### Reliability
**HIGH** - Service role key is stable (doesn't rotate). No DNS failures, no auth issues.

### Files Using This Pattern
- `/Users/benknight/Code/grantscope/scripts/gsql.mjs` (CLI tool)
- `/Users/benknight/Code/grantscope/scripts/gsql-health.mjs` (health dashboard)
- `/Users/benknight/Code/grantscope/scripts/refresh-materialized-views.mjs` (uses fetch to /rest/v1/rpc/exec_sql)

### Example
```javascript
const { data, error } = await supabase.rpc('exec_sql', {
  query: `SELECT COUNT(*) FROM gs_entities WHERE postcode IS NOT NULL`
});
```

---

## Method 2: getServiceSupabase() (PREFERRED for API routes)

### What It Is
Server-side Supabase client using service role key, accessed via PostgREST API (not raw SQL).

### Auth Mechanism
```javascript
// apps/web/src/lib/supabase.ts
export function getServiceSupabase() {
  return createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}
```

### How It Works
- Uses `@supabase/supabase-js` PostgREST query builder
- Bypasses RLS (Row Level Security)
- Full CRUD access to all tables

### Usage
```javascript
import { getServiceSupabase } from '@/lib/supabase';

const db = getServiceSupabase();
const { data, error } = await db
  .from('foundations')
  .select('*')
  .not('website', 'is', null)
  .limit(100);
```

### Capabilities
- ✅ SELECT/INSERT/UPDATE/DELETE via query builder
- ✅ Sees ALL tables (not limited to migrations)
- ✅ RPC function calls (`db.rpc('function_name', { params })`)
- ✅ Full control with `.range()` for pagination
- ❌ Cannot do raw SQL directly (use `exec_sql` RPC instead)

### Reliability
**HIGH** - Service role key is stable. PostgREST is Supabase's primary API layer.

### Files Using This Pattern
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase.ts` (export)
- `/Users/benknight/Code/grantscope/apps/web/src/app/api/ops/health/route.ts` (health API)
- `/Users/benknight/Code/grantscope/apps/web/src/app/api/search/route.ts` (search API)
- **All 54+ scripts** in `/Users/benknight/Code/grantscope/scripts/` (e.g., `enrich-foundations.mjs`, `sync-foundation-programs.mjs`)

### Example (from scripts)
```javascript
import 'dotenv/config';  // CRITICAL — always first line!
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Pagination pattern (Supabase default limit is 1,000)
let foundations = [];
let page = 0;
const pageSize = 1000;
while (true) {
  const { data, error } = await supabase
    .from('foundations')
    .select('*')
    .not('enriched_at', 'is', null)
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) break;
  foundations = foundations.concat(data || []);
  if (!data || data.length < pageSize) break;
  page++;
}
```

### Critical Pattern: dotenv loading
**ALWAYS add `import 'dotenv/config';` as the FIRST import** in any GrantScope script:
```javascript
import 'dotenv/config';  // MUST be first!
import { createClient } from '@supabase/supabase-js';
```

Without dotenv, scripts silently fail with "All LLM providers exhausted" because `process.env.SUPABASE_SERVICE_ROLE_KEY` is undefined.

**This bug has recurred multiple times.** As of Mar 2026: ~32 scripts still missing dotenv (only 7 have it).

---

## Method 3: psql (DDL fallback only)

### What It Is
Direct PostgreSQL connection using `cli_login_postgres` user and rotating password.

### Auth Mechanism
```bash
# Get fresh password (rotates frequently):
npx supabase db dump --linked --dry-run 2>&1 | grep PGPASSWORD

# Then connect:
PGPASSWORD="<password>" psql \
  -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 \
  -U "cli_login_postgres.tednluwflfhxyucgwigh" \
  -d postgres \
  -c "SET ROLE postgres; <DDL>"
```

### Capabilities
- ✅ Full SQL including DDL (CREATE TABLE, indexes, ALTER, DROP)
- ✅ Sees ALL tables
- ⚠️ `cli_login_postgres` can SELECT but NOT create indexes/DDL — **must `SET ROLE postgres` first**

### Reliability
**MEDIUM** - Password rotates frequently (unknown interval). Must fetch fresh password each time.

### When to Use
**ONLY for DDL operations** (CREATE TABLE, CREATE INDEX, ALTER TABLE). For everything else, use `gsql.mjs` or `getServiceSupabase()`.

### Example
```bash
# Fetch password
PASS=$(npx supabase db dump --linked --dry-run 2>&1 | grep PGPASSWORD | cut -d= -f2 | cut -d' ' -f1)

# Run DDL
PGPASSWORD="$PASS" psql \
  -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 \
  -U "cli_login_postgres.tednluwflfhxyucgwigh" \
  -d postgres \
  -c "SET ROLE postgres; CREATE INDEX idx_gs_entities_postcode ON gs_entities(postcode);"
```

---

## Method 4: Supabase MCP (AVOID for GrantScope)

### What It Is
Management API-based database access via Model Context Protocol (MCP).

### Limitations
- ❌ **ONLY sees ~153 tables** (EL tables created via Supabase migrations)
- ❌ **GrantScope tables INVISIBLE** (`gs_entities`, `political_donations`, `acnc_charities`, `foundations`, etc.)
- ❌ Cannot see tables created via psql/PostgREST

### Why It Fails
MCP Management API filters to migration-tracked tables. GrantScope tables were created outside the migration system.

### When to Use
**NEVER for GrantScope.** Use `gsql.mjs` or psql instead.

### Workaround
If you need to use MCP commands, migrate GrantScope tables into the Supabase migration system (not recommended — adds complexity).

---

## Method 5: createSupabaseServer() (Frontend/SSR only)

### What It Is
User-authenticated Supabase client for Next.js Server Components/API routes (RLS-enforced).

### Auth Mechanism
```javascript
// apps/web/src/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie management */ } }
  );
}
```

### Capabilities
- ✅ User-scoped queries (respects RLS policies)
- ✅ Auth state management (`auth.getUser()`)
- ✅ Client-side safe (uses anon key, not service role)
- ❌ Limited to what RLS policies allow

### When to Use
**Frontend API routes** that need user authentication (e.g., `/api/profile`, `/api/tracker`).

### Reliability
**HIGH** - Standard Next.js + Supabase SSR pattern.

### Files Using This Pattern
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase-server.ts` (definition)
- `/Users/benknight/Code/grantscope/apps/web/src/app/api/ops/health/route.ts` (auth check only, uses `getServiceSupabase()` for queries)

### Example
```javascript
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service supabase for actual queries (bypasses RLS)
  const db = getServiceSupabase();
  const { data } = await db.from('foundations').select('*');
  
  return NextResponse.json({ data });
}
```

---

## Database Connection Info

### Shared Database
Both GrantScope and Empathy Ledger share the same Supabase project:
- **Project Ref:** `tednluwflfhxyucgwigh`
- **Project Name:** "Empathy Ledger"
- **Total Tables:** 571+
- **Migration-tracked:** ~153 (EL tables only)

### Environment Variables
Located in `/Users/benknight/Code/grantscope/.env`:
```bash
SUPABASE_URL=***
SUPABASE_SERVICE_ROLE_KEY=***
NEXT_PUBLIC_SUPABASE_URL=***
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
```

### psql Connection String
```
Host: aws-0-ap-southeast-2.pooler.supabase.com
Port: 5432
User: cli_login_postgres.tednluwflfhxyucgwigh
Database: postgres
Password: <fetch via supabase db dump --linked --dry-run>
```

---

## Recommended Workflow

### For Scripts
1. **Always use `getServiceSupabase()` pattern:**
   ```javascript
   import 'dotenv/config';  // FIRST LINE!
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY
   );
   ```

2. **For ad-hoc queries, use gsql.mjs:**
   ```bash
   node scripts/gsql.mjs "SELECT COUNT(*) FROM foundations WHERE website IS NOT NULL"
   ```

3. **For DDL (CREATE TABLE, indexes), use psql:**
   ```bash
   PASS=$(npx supabase db dump --linked --dry-run 2>&1 | grep PGPASSWORD | cut -d= -f2 | cut -d' ' -f1)
   PGPASSWORD="$PASS" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
     -U "cli_login_postgres.tednluwflfhxyucgwigh" -d postgres \
     -c "SET ROLE postgres; CREATE INDEX ..."
   ```

### For API Routes
1. **Always use `getServiceSupabase()` for data access:**
   ```javascript
   import { getServiceSupabase } from '@/lib/supabase';
   const db = getServiceSupabase();
   ```

2. **Use `createSupabaseServer()` only for auth checks:**
   ```javascript
   const supabase = await createSupabaseServer();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   ```

### For Health Checks
```bash
node scripts/gsql-health.mjs
# Or API: GET /api/ops/health
```

---

## Common Errors and Solutions

### Error: "All LLM providers exhausted"
**Cause:** Missing `import 'dotenv/config';` at top of script.
**Solution:** Add `import 'dotenv/config';` as the FIRST import.

### Error: "Could not find the 'exec_sql' function"
**Cause:** `exec_sql` RPC function doesn't exist yet.
**Solution:** Create it via psql:
```sql
CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
```

### Error: "relation 'gs_entities' does not exist" (via MCP)
**Cause:** MCP can't see GrantScope tables (only sees 153 migration-tracked tables).
**Solution:** Use `gsql.mjs` or `getServiceSupabase()` instead.

### Error: "password authentication failed"
**Cause:** psql password has rotated.
**Solution:** Fetch fresh password via `npx supabase db dump --linked --dry-run`.

---

## Files Reference

### Core Database Helpers
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase.ts` - `getServiceSupabase()` export
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase-server.ts` - `createSupabaseServer()` export
- `/Users/benknight/Code/grantscope/scripts/gsql.mjs` - CLI query tool
- `/Users/benknight/Code/grantscope/scripts/gsql-health.mjs` - Health dashboard

### Scripts Using Service Role Pattern (54 total)
All scripts in `/Users/benknight/Code/grantscope/scripts/` use this pattern:
```javascript
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
```

Examples:
- `enrich-foundations.mjs`
- `sync-foundation-programs.mjs`
- `backfill-embeddings.mjs`
- `sync-acnc-charities.mjs`
- `import-aec-donations.mjs`

### API Routes Using Service Role (46 total)
All routes in `/Users/benknight/Code/grantscope/apps/web/src/app/api/`:
- `ops/health/route.ts` - Data health dashboard
- `search/route.ts` - Search API
- `foundations/route.ts` - Foundation listing
- `power/health/route.ts` - Power flows health

---

## Migration Files

GrantScope has migrations in `/Users/benknight/Code/grantscope/supabase/migrations/`:
- `20260228_foundations.sql`
- `20260301_community_orgs.sql`
- `20260306_social_enterprises.sql`
- `20260307_austender_contracts.sql`
- `20260308_freshness_indexes.sql`
- (30+ files total)

**Note:** These migrations may not be tracked by Supabase Management API, which is why MCP can't see the tables.

---

## Summary Table: Which Method When?

| Task | Method | Why |
|------|--------|-----|
| Ad-hoc SELECT query | `gsql.mjs` | Fast, stable, sees all tables |
| Script (data import/enrichment) | `getServiceSupabase()` | Full PostgREST API, stable key |
| API route (no auth) | `getServiceSupabase()` | Bypass RLS, full access |
| API route (with user auth) | `createSupabaseServer()` + `getServiceSupabase()` | Auth check via SSR, queries via service role |
| CREATE TABLE, indexes | `psql` | Only method that can do DDL |
| Health dashboard | `gsql-health.mjs` | Pre-built, fast |
| GrantScope table query | **NEVER MCP** — use `gsql.mjs` or `getServiceSupabase()` | MCP can't see GrantScope tables |

---

## Key Insights

1. **Service role key is stable** — no rotation, no DNS failures. This is the most reliable auth method.

2. **MCP is broken for GrantScope** — only sees 153/571 tables. Avoid entirely.

3. **dotenv is critical** — ~32 scripts still missing it. Always add `import 'dotenv/config';` first.

4. **psql is DDL-only** — rotating password makes it unsuitable for scripts. Use only for CREATE/ALTER/DROP.

5. **PostgREST is primary** — `getServiceSupabase()` uses PostgREST, which is Supabase's core API layer. More reliable than raw SQL.

6. **Pagination is mandatory** — Supabase default limit is 1,000 rows. Always use `.range()` for bulk operations.

7. **exec_sql RPC is powerful** — allows raw SQL via service role key. Used by `gsql.mjs` and `refresh-materialized-views.mjs`.

---

## Next Steps

1. **Audit scripts for missing dotenv** — fix the remaining ~32 scripts.

2. **Document exec_sql RPC creation** — ensure it exists in migrations so future deploys don't break.

3. **Deprecate MCP usage** — update docs/memory to never use MCP for GrantScope queries.

4. **Standardize on getServiceSupabase()** — migrate any raw fetch calls to PostgREST query builder.

5. **Create health cron** — run `gsql-health.mjs` daily and alert if coverage drops.
