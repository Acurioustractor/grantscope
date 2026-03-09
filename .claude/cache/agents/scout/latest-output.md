# Supabase Database Access Audit - Executive Summary

**Generated:** 2026-03-09
**Full Audit:** `/Users/benknight/Code/grantscope/.claude/cache/agents/scout/database-access-audit.md`

## Critical Finding

**Supabase MCP is BROKEN for GrantScope** — only sees 153 of 571 tables. GrantScope-specific tables (`gs_entities`, `political_donations`, `acnc_charities`, `foundations`, etc.) are INVISIBLE to MCP.

## 5 Database Access Methods Identified

| Method | Auth | Reliability | Best For | Status |
|--------|------|-------------|----------|--------|
| **gsql.mjs** | Service role key | HIGH | Ad-hoc queries, health checks | ✅ PREFERRED |
| **getServiceSupabase()** | Service role key | HIGH | Scripts, API routes | ✅ PREFERRED |
| **psql** | Rotating password | MEDIUM | DDL only (CREATE TABLE, indexes) | ⚠️ DDL ONLY |
| **Supabase MCP** | Management API | LOW | Nothing (broken for GrantScope) | ❌ AVOID |
| **createSupabaseServer()** | User session | HIGH | Frontend auth checks | ✅ SSR ONLY |

## What Works Reliably

### 1. gsql.mjs (NEW - Created Mar 9 2026)
```bash
node scripts/gsql.mjs "SELECT COUNT(*) FROM gs_entities"
node scripts/gsql-health.mjs  # Health dashboard
```
- Uses `exec_sql` RPC function (SECURITY DEFINER)
- Service role key (stable, no rotation)
- Sees ALL 571 tables
- Cannot do DDL (use psql for that)

### 2. getServiceSupabase() (54+ scripts use this)
```javascript
import 'dotenv/config';  // CRITICAL — must be first!
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```
- PostgREST query builder
- Service role key (stable, no rotation)
- Used by ALL scripts and API routes
- Full CRUD, sees all tables

## What Failed

### Supabase MCP
- Only sees ~153 tables (Empathy Ledger migrations)
- GrantScope tables invisible
- Root cause: MCP Management API filters to migration-tracked tables
- Workaround: Use gsql.mjs or getServiceSupabase()

### psql with Rotating Password
- Password rotates frequently (unknown interval)
- Must fetch fresh password each time: `npx supabase db dump --linked --dry-run 2>&1 | grep PGPASSWORD`
- Only suitable for DDL operations (CREATE TABLE, indexes)
- NOT reliable for scripts (use service role key instead)

## Critical Pattern: dotenv Loading

**This bug has recurred multiple times. ~32 scripts still missing it.**

ALWAYS add as FIRST import:
```javascript
import 'dotenv/config';  // MUST be first line!
import { createClient } from '@supabase/supabase-js';
```

Without it, scripts silently fail with "All LLM providers exhausted" because `process.env.SUPABASE_SERVICE_ROLE_KEY` is undefined.

## Recommended Workflow

### For Scripts
1. Use `getServiceSupabase()` pattern (service role key + PostgREST)
2. ALWAYS add `import 'dotenv/config';` first
3. Use `.range()` for pagination (default limit is 1,000)

### For Ad-hoc Queries
```bash
node scripts/gsql.mjs "SELECT COUNT(*) FROM foundations WHERE website IS NOT NULL"
```

### For DDL (CREATE TABLE, indexes)
```bash
PASS=$(npx supabase db dump --linked --dry-run 2>&1 | grep PGPASSWORD | cut -d= -f2 | cut -d' ' -f1)
PGPASSWORD="$PASS" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
  -U "cli_login_postgres.tednluwflfhxyucgwigh" -d postgres \
  -c "SET ROLE postgres; CREATE INDEX ..."
```

### For API Routes
```javascript
import { getServiceSupabase } from '@/lib/supabase';
const db = getServiceSupabase();
const { data } = await db.from('foundations').select('*');
```

## Key Files

### Database Helpers
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase.ts` - `getServiceSupabase()`
- `/Users/benknight/Code/grantscope/apps/web/src/lib/supabase-server.ts` - `createSupabaseServer()`
- `/Users/benknight/Code/grantscope/scripts/gsql.mjs` - CLI query tool
- `/Users/benknight/Code/grantscope/scripts/gsql-health.mjs` - Health dashboard

### Environment Variables
Located in `/Users/benknight/Code/grantscope/.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (stable, preferred)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database Info
- **Project:** tednluwflfhxyucgwigh (Empathy Ledger)
- **Total Tables:** 571+
- **Migration-tracked:** ~153 (EL only)
- **Host:** aws-0-ap-southeast-2.pooler.supabase.com

## Common Errors & Solutions

### "All LLM providers exhausted"
Missing `import 'dotenv/config';` at top of script.

### "relation 'gs_entities' does not exist" (via MCP)
MCP can't see GrantScope tables. Use `gsql.mjs` or `getServiceSupabase()`.

### "Could not find the 'exec_sql' function"
RPC doesn't exist. Create via psql (see full audit for SQL).

### "password authentication failed"
psql password rotated. Fetch fresh password via `npx supabase db dump --linked --dry-run`.

## Next Actions

1. Audit scripts for missing dotenv (~32 scripts need fixing)
2. Document exec_sql RPC in migrations
3. Deprecate MCP usage for GrantScope
4. Standardize on getServiceSupabase() pattern
5. Create daily health cron (gsql-health.mjs)

---

**Full details:** `/Users/benknight/Code/grantscope/.claude/cache/agents/scout/database-access-audit.md`
