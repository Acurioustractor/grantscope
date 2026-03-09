# Research Report: Supabase Database Access for Mixed Migration/Untracked Tables
Generated: 2026-03-09

## Summary

Supabase does NOT provide a way to execute arbitrary SQL programmatically via Management API or SQL Editor API. The recommended approaches are: (1) use `supabase db pull` to bring untracked tables under migration control, (2) use direct psql connections with stable passwords from dashboard, (3) create PostgreSQL functions (SECURITY DEFINER) and call via PostgREST RPC, or (4) use server-side PostgreSQL clients. Password rotation is MANUAL not automatic. PostgREST schema cache reloads are event-driven, not time-based.

## Questions Answered

### Q1: Supabase direct database connection (non-pooler) with stable password
**Answer:** Stable passwords ARE available. Database passwords are set manually via the Supabase Dashboard and do NOT auto-rotate. Password resets must be initiated manually via Dashboard Settings > Database > Reset database password. The Supabase CLI `supabase db dump --linked` command that shows rotating passwords is actually generating short-lived CLI session tokens, NOT the main database password.

**Source:** [How do I reset my Supabase database password?](https://github.com/orgs/supabase/discussions/20929), [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)

**Confidence:** High

**Action:** Use the database password from Supabase Dashboard > Settings > Database. This password is stable until you manually reset it. For direct connections (not pooler), use the connection string on port 5432 with your project's direct connection endpoint.

### Q2: Supabase MCP limitations — making MCP see all tables
**Answer:** The Supabase MCP `execute_sql` tool DOES execute queries against all tables (tracked or untracked). The limitation is that `apply_migration` only tracks DDL operations it performs. To bring untracked tables under migration control, use `supabase db pull` which generates migration files from the current remote schema state.

**Source:** [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Supabase db pull CLI reference](https://supabase.com/docs/reference/cli/supabase-db-pull)

**Confidence:** High

**Implementation:**
```bash
# Link to your remote project
supabase link --project-ref tednluwflfhxyucgwigh

# Pull all current schema as migration
supabase db pull

# This creates: supabase/migrations/<timestamp>_remote_schema.sql
# Contains ALL tables, views, functions from remote database
```

**Note:** After running `supabase db pull`, subsequent pulls will only diff changes (not full schema dump). The initial pull when no migration history exists uses `pg_dump` to capture everything.

### Q3: PostgREST schema cache reload timing
**Answer:** PostgREST schema cache reload is EVENT-DRIVEN, not time-based. There is no fixed auto-reload interval. Reloading happens via `NOTIFY pgrst, 'reload schema';` or automatically if event triggers are configured.

**Source:** [Reload/refresh postgrest schema](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema), [PostgREST Schema Cache](https://docs.postgrest.org/en/latest/references/schema_cache.html)

**Confidence:** High

**How to force immediate reload:**
```sql
-- Manual reload
NOTIFY pgrst, 'reload schema';

-- Auto-reload on every DDL operation (recommended)
CREATE OR REPLACE FUNCTION pgrst_watch() 
RETURNS event_trigger 
LANGUAGE plpgsql AS $$ 
BEGIN 
  NOTIFY pgrst, 'reload schema'; 
END; 
$$;

CREATE EVENT TRIGGER pgrst_watch 
ON ddl_command_end 
EXECUTE PROCEDURE pgrst_watch();
```

**Known Issue:** Reload notifications can be dropped if a schema reload is already in progress. Adding `SELECT pg_sleep(1);` before `NOTIFY` may help reliability.

**Workaround for Hosted Supabase:** The `NOTIFY pgrst, 'reload schema';` command SHOULD work through the connection pooler on Supabase hosted instances. If not working, check if event triggers are set up (they may not be by default).

### Q4: Best practice for shared Supabase database with multiple applications
**Answer:** Bring ALL tables under migration control using `supabase db pull`, treat schema changes as code changes, use version control (Git), and deploy via CI/CD pipelines. Do NOT rely on automatic schema syncing between applications.

**Source:** [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments), [Multiple environments and migrations – best practices](https://github.com/orgs/supabase/discussions/542)

**Confidence:** High

**Recommended Workflow:**
1. Use `supabase db pull` to capture current schema as migration (one-time operation)
2. Make all future schema changes via migration files in `supabase/migrations/`
3. Test migrations locally with `supabase db reset` (applies all migrations to local DB)
4. Apply to staging: `supabase db push --linked` (or via GitHub Actions)
5. Apply to production: via CI/CD pipeline, NOT from local machine
6. Write rollback migrations for every schema change

**For Multiple Applications Sharing Database:**
- Each application can have its own `supabase/migrations/` folder
- Coordinate schema changes via shared Git repository
- Use a single "source of truth" migration folder if possible
- Test cross-application compatibility before production deployment

### Q5: Supabase Management API SQL execution endpoint
**Answer:** The Management API v1 DOES have a query endpoint, but it ONLY executes SQL queries on the project's LOGS (not the database). There is NO general-purpose SQL execution endpoint for security reasons.

**Source:** [Management API v1 run a query](https://supabase.com/docs/reference/api/v1-run-a-query), [Execute SQL in Supabase API Discussion](https://github.com/orgs/supabase/discussions/3419)

**Confidence:** High

**Endpoint Details:**
- **URL:** `POST https://api.supabase.com/v1/projects/{ref}/analytics/query`
- **Purpose:** Query logs ONLY (auth_logs, postgres_logs, edge_logs, etc.)
- **Auth:** Personal access token (PAT) in Authorization header
- **Rate limit:** 60 requests per minute per user
- **Time range:** Max 24 hours, defaults to last 1 minute if not specified

**Why No General SQL Execution:**
> "SQL cannot be fully exposed to frontend clients because it opens a door for forcing inefficient/slow queries that can starve your database of resources."

**Alternative Approaches:**
1. **PostgreSQL Functions (RPC):** Create `SECURITY DEFINER` functions and call via PostgREST
2. **Server-side PostgreSQL client:** Use `node-postgres` or similar with service role connection
3. **Edge Functions:** Create custom API routes with database access

## Detailed Findings

### Finding 1: Connection Types — Direct vs Pooler
**Source:** [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)

**Key Points:**
- **Direct connection (port 5432):** For single sessions, database GUIs, pg_dump, migrations. Requires IPv6 by default (IPv4 is paid add-on). Password is stable until manually reset.
- **Pooler transaction mode (port 6543):** For serverless/edge functions. Shares connections, releases after 5 minutes of inactivity.
- **Pooler session mode (port 5432 on pooler URL):** For long-lived application connections in IPv4 environments. One client per direct connection, supports prepared statements.

**Connection String Examples:**
```bash
# Direct connection (IPv6)
postgres://postgres:[PASSWORD]@db.xxxxxxxxxx.supabase.co:5432/postgres

# Pooler transaction mode
postgres://postgres.xxxxxxxxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Pooler session mode  
postgres://postgres.xxxxxxxxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**For Your Use Case:**
Use the **direct connection** with the stable password from the dashboard. This is the most reliable for running DDL operations, creating functions, and executing `NOTIFY pgrst, 'reload schema';`.

### Finding 2: Supabase CLI Database URL Behavior
**Source:** [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Connecting with PSQL](https://supabase.com/docs/guides/database/psql)

**Key Points:**
- The CLI command `supabase db dump --linked --dry-run` shows a TEMPORARY session password in the output (this is what you saw rotating every 30-60 seconds)
- This is NOT your main database password — it's a short-lived CLI authentication token
- Your actual database password is in Dashboard > Settings > Database and is stable
- When linked (`supabase link`), the CLI authenticates via access token and generates these temporary credentials for you

**Action:**
STOP using `supabase db dump` to get passwords. Instead:
1. Go to Supabase Dashboard > Settings > Database
2. Copy the stable password shown there (or reset it if needed)
3. Use this password with the direct connection string for all psql operations

### Finding 3: Migration Pull Strategy
**Source:** [Supabase db pull CLI reference](https://supabase.com/docs/reference/cli/supabase-db-pull)

**How `supabase db pull` Works:**
1. **First run (no migration history):** Uses `pg_dump` to capture ALL schemas
2. **Subsequent runs:** Only diffs changes against last migration
3. **Schema filtering:** By default excludes `auth` and `storage` schemas (can include with `--schema auth,storage`)

**For Your GrantScope + Empathy Ledger Shared Database:**
```bash
cd /Users/benknight/Code/grantscope
supabase link --project-ref tednluwflfhxyucgwigh

# Pull ALL tables (GrantScope + EL) into migration
supabase db pull

# Result: supabase/migrations/<timestamp>_remote_schema.sql
# This file will contain CREATE statements for all 571 tables
```

**Warning:** This will create a LARGE migration file (571 tables). Consider:
- Splitting into multiple migration files by schema/application
- Using `--schema` flag to pull only specific schemas
- Creating a separate migration folder for shared infrastructure vs application-specific schemas

### Finding 4: PostgreSQL Function Approach (RPC)
**Source:** [Database Functions](https://supabase.com/docs/guides/database/functions), [Execute SQL in Supabase API Discussion](https://github.com/orgs/supabase/discussions/3419)

**Recommended Pattern:**
Instead of trying to execute arbitrary SQL via API, create typed PostgreSQL functions and call them via PostgREST RPC.

**Example — Your `exec_sql` Function:**
```sql
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE query INTO result;
  RETURN result;
END;
$$;
```

**Call via PostgREST:**
```bash
curl -X POST "https://tednluwflfhxyucgwigh.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM untracked_table LIMIT 10"}'
```

**Schema Cache Issue:**
When you update the function definition (ALTER FUNCTION), PostgREST won't see it until cache reloads. Solutions:
1. Run `NOTIFY pgrst, 'reload schema';` immediately after updating function
2. Set up auto-reload event trigger (recommended)
3. Wait for automatic reload (timing unknown, likely several minutes)

## Comparison Matrix

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Direct psql (stable password)** | Full PostgreSQL access, DDL support, immediate execution | Requires managing connection strings | One-off admin operations, migrations |
| **Supabase CLI (linked)** | Integrated with migration workflow, handles auth automatically | Temporary credentials, complex for custom SQL | Migration management, schema diffs |
| **PostgREST RPC functions** | Works through connection pooler, stable auth (service role key), type-safe | Requires creating function for each operation, schema cache lag | Repeated queries, application integration |
| **Supabase MCP** | Easy to use from Claude Code, sees all tables for SELECT | Only tracks migrations it applies, not arbitrary DDL | Development exploration, querying data |
| **Server-side PostgreSQL client** | Full control, no API limits | Requires managing connection lifecycle, credentials | Custom APIs, background jobs |

## Recommendations

### For This Codebase (GrantScope + Empathy Ledger Shared DB)

**1. IMMEDIATE: Switch to stable password for psql operations**

```bash
# Get your stable password from:
# https://supabase.com/dashboard/project/tednluwflfhxyucgwigh/settings/database

# Use direct connection (NOT pooler):
PGPASSWORD="<stable_password_from_dashboard>" psql \
  -h db.tednluwflfhxyucgwigh.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "YOUR SQL HERE"
```

**2. RECOMMENDED: Bring all tables under migration control**

```bash
cd /Users/benknight/Code/grantscope
supabase link --project-ref tednluwflfhxyucgwigh
supabase db pull

# This creates a baseline migration with ALL 571 tables
# Commit this to Git as the "source of truth"
git add supabase/migrations/
git commit -m "feat: baseline migration from remote schema (571 tables)"
```

**3. RECOMMENDED: Set up PostgREST auto-reload event trigger**

```sql
-- Run this once via direct psql connection
CREATE OR REPLACE FUNCTION pgrst_watch() 
RETURNS event_trigger 
LANGUAGE plpgsql AS $$ 
BEGIN 
  NOTIFY pgrst, 'reload schema'; 
END; 
$$;

CREATE EVENT TRIGGER pgrst_watch 
ON ddl_command_end 
EXECUTE PROCEDURE pgrst_watch();
```

After this, every DDL operation (CREATE FUNCTION, ALTER TABLE, etc.) will automatically reload PostgREST's schema cache within seconds.

**4. FUTURE: Refactor to PostgreSQL functions for repeated operations**

For operations you run frequently (like your `exec_sql` RPC), create properly typed functions:

```sql
-- Instead of exec_sql(text) → jsonb, create specific functions:
CREATE OR REPLACE FUNCTION get_grant_deadlines(days_ahead int DEFAULT 30)
RETURNS TABLE (
  foundation_name text,
  program_name text,
  deadline_date date,
  days_until_deadline int
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    f.name,
    p.name,
    p.deadline,
    (p.deadline - CURRENT_DATE) AS days_until_deadline
  FROM foundation_programs p
  JOIN foundations f ON f.id = p.foundation_id
  WHERE p.deadline > CURRENT_DATE
    AND p.deadline <= CURRENT_DATE + days_ahead
  ORDER BY p.deadline;
$$;
```

Call via PostgREST:
```bash
curl "https://tednluwflfhxyucgwigh.supabase.co/rest/v1/rpc/get_grant_deadlines?days_ahead=60" \
  -H "apikey: SERVICE_ROLE_KEY"
```

### Implementation Notes

**Migration File Organization:**
- Consider splitting the initial `supabase db pull` output into multiple files by schema
- GrantScope tables in one migration file
- Empathy Ledger tables in another
- Shared infrastructure (auth, extensions) in a third

**Schema Change Workflow Going Forward:**
1. Make changes locally via Supabase Studio or direct SQL
2. Generate migration: `supabase db diff -f <migration_name>`
3. Review generated SQL in `supabase/migrations/<timestamp>_<migration_name>.sql`
4. Test locally: `supabase db reset` (wipes local DB and reapplies all migrations)
5. Push to remote: `supabase db push --linked`
6. Commit migration file to Git

**Password Management:**
- Store stable database password in environment variables
- Use 1Password or similar for team password sharing
- Rotate password manually via Dashboard when needed (e.g., quarterly, after team member departure)
- Update all scripts/tools that use the password after rotation

**Supabase MCP Usage:**
- Continue using for data exploration and SELECT queries
- Use `apply_migration` for new DDL operations (will be tracked)
- Existing untracked tables will remain visible to `execute_sql` after running `supabase db pull`

## Sources

1. [Connect to your database | Supabase Docs](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. [Supavisor FAQ | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
3. [Supavisor and Connection Terminology Explained | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)
4. [How do I reset my Supabase database password? | GitHub Discussion](https://github.com/orgs/supabase/discussions/20929)
5. [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations)
6. [Supabase db pull CLI reference | Supabase Docs](https://supabase.com/docs/reference/cli/supabase-db-pull)
7. [Local development with schema migrations | Supabase Docs](https://supabase.com/docs/guides/local-development/overview)
8. [Reload/refresh postgrest schema | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)
9. [PostgREST Schema Cache | PostgREST Docs](https://docs.postgrest.org/en/latest/references/schema_cache.html)
10. [Management API v1 run a query | Supabase Docs](https://supabase.com/docs/reference/api/v1-run-a-query)
11. [Execute SQL in Supabase API | GitHub Discussion](https://github.com/orgs/supabase/discussions/3419)
12. [Database Functions | Supabase Docs](https://supabase.com/docs/guides/database/functions)
13. [Managing Environments | Supabase Docs](https://supabase.com/docs/guides/deployment/managing-environments)
14. [Multiple environments and migrations – best practices | GitHub Discussion](https://github.com/orgs/supabase/discussions/542)
15. [Connecting with PSQL | Supabase Docs](https://supabase.com/docs/guides/database/psql)
16. [Backup and Restore using the CLI | Supabase Docs](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Open Questions

1. **PostgREST schema cache timing:** While event-driven reload is documented, the actual timing for automatic reload (without event triggers) is not specified in documentation. Testing needed to determine if there's a background interval.

2. **Migration file size limits:** The initial `supabase db pull` for 571 tables will create a very large SQL file. Are there practical limits on migration file size? Should it be split?

3. **Cross-application migration coordination:** With GrantScope and Empathy Ledger sharing a database, how should migration files be organized? Separate repos with shared migration folder? Monorepo with both applications?

4. **IPv4 Add-on necessity:** Current setup uses connection pooler (IPv4 compatible). If switching to direct connections, is the IPv4 Add-on required? (Direct connections default to IPv6 only)
