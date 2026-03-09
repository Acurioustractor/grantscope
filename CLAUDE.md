# GrantScope — Project Instructions

## Rule #1: Supabase Access

**NEVER use `mcp__supabase__*` tools for GrantScope.** The Supabase MCP is connected to the ACT project (`uaxhjzqrdotoahjnxmbj`), NOT GrantScope (`tednluwflfhxyucgwigh`).

### How to query GrantScope's database

```bash
# SELECT queries — use gsql.mjs
node --env-file=.env scripts/gsql.mjs "SELECT COUNT(*) FROM gs_entities"

# DDL/migrations — use psql
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f <file.sql>
```

**Warning:** gsql.mjs `-c` flag mangles `$$` dollar-quoting — use `psql -f` for migrations with PL/pgSQL functions.

## Rule #2: Verify Schema Before Writing Queries

Never guess column names. Check `data/schema-cache.md` first — it has full schemas for the top 8 tables. For other tables:

```bash
node --env-file=.env scripts/gsql.mjs "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'TABLE_NAME' ORDER BY ordinal_position"
```

## Rule #3: Type Check After TypeScript Changes

After editing any `.ts` or `.tsx` file:

```bash
cd apps/web && npx tsc --noEmit
```

## Rule #4: Build, Don't Plan

Start implementing immediately. Only enter plan mode when explicitly asked. Default to action.

## Project Structure

- **Monorepo:** `apps/web` (Next.js 15, Tailwind 4), `scripts/` (data pipeline agents)
- **Agent registry:** `scripts/lib/agent-registry.mjs` (45 agents, 8 categories)
- **Orchestrator:** `scripts/agent-orchestrator.mjs`
- **Mission Control:** `apps/web/src/app/mission-control/`

## Design System

Bauhaus-inspired: `border-4 border-bauhaus-black`, `font-black uppercase tracking-widest`
Colors: `bauhaus-black`, `bauhaus-red`, `bauhaus-blue`, `bauhaus-muted`

## Key Tables Reference

| Table | Rows | Key Columns |
|-------|------|-------------|
| `gs_entities` | 92K | gs_id, canonical_name, abn, entity_type, sector, postcode, state, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, lga_code |
| `gs_relationships` | 65K | source_entity_id, target_entity_id, relationship_type, amount, year, dataset |
| `austender_contracts` | 672K | title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, contract_end |
| `acnc_charities` | 66K | abn, name, charity_size, state, postcode, purposes, beneficiaries, is_foundation |
| `justice_funding` | 53K | recipient_name, recipient_abn, program_name, amount_dollars, state, financial_year, sector |
| `political_donations` | 312K | donor_name, donor_abn, donation_to, amount, financial_year |
| `ato_tax_transparency` | 24K | entity_name, abn, total_income, taxable_income, tax_payable, report_year |
| `entity_identifiers` | 31K | entity_id, identifier_type, identifier_value, source |
| `foundations` | 10K | name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus |
| `grant_opportunities` | 17K | name, amount_min, amount_max, deadline, categories, focus_areas |
| `postcode_geo` | 12K | postcode, locality, state, sa2_code, remoteness_2021, lga_name, lga_code |
| `seifa_2021` | 11K | postcode, index_type, score, decile_national |
| `org_profiles` | — | user_id, name, abn, stripe_customer_id, subscription_plan |
| `agent_runs` | — | agent_id, agent_name, status, items_found, items_new, duration_ms |
| `agent_schedules` | — | agent_id, interval_hours, enabled, last_run_at, priority |
| `mv_funding_by_postcode` | 2.9K | postcode, state, remoteness, entity_count, total_funding |

## Materialized Views

- `mv_funding_by_lga` — per-LGA funding aggregates (492 LGAs)
- `mv_funding_by_postcode` — per-postcode funding aggregates
- `mv_gs_donor_contractors` — entities that both donate and contract
- `mv_gs_entity_stats` — entity-level stats rollup
- `mv_data_quality` — data quality metrics
- `mv_org_justice_signals` — justice funding signals per org
- `mv_acnc_latest` — latest ACNC snapshot per charity

## Common Query Cookbook

```sql
-- Entity lookup by ABN
SELECT * FROM gs_entities WHERE abn = '12345678901';

-- Entity lookup by name (fuzzy)
SELECT gs_id, canonical_name, abn, entity_type FROM gs_entities WHERE canonical_name ILIKE '%search term%' LIMIT 20;

-- All relationships for an entity
SELECT r.*, s.canonical_name as source_name, t.canonical_name as target_name
FROM gs_relationships r
JOIN gs_entities s ON s.id = r.source_entity_id
JOIN gs_entities t ON t.id = r.target_entity_id
WHERE s.gs_id = 'GS-XXXXX' OR t.gs_id = 'GS-XXXXX';

-- Funding to an entity (justice + contracts + donations)
SELECT 'justice' as source, recipient_name, SUM(amount_dollars) as total FROM justice_funding WHERE recipient_abn = '12345678901' GROUP BY recipient_name
UNION ALL
SELECT 'contracts', supplier_name, SUM(contract_value) FROM austender_contracts WHERE supplier_abn = '12345678901' GROUP BY supplier_name
UNION ALL
SELECT 'donations', donor_name, SUM(amount) FROM political_donations WHERE donor_abn = '12345678901' GROUP BY donor_name;

-- Place summary (postcode)
SELECT * FROM mv_funding_by_postcode WHERE postcode = '2000';

-- Funding gaps (top underserved areas)
SELECT * FROM get_funding_gaps() ORDER BY gap_score DESC LIMIT 20;

-- Agent run history
SELECT agent_name, status, items_found, items_new, duration_ms, started_at FROM agent_runs ORDER BY started_at DESC LIMIT 20;

-- Data freshness
SELECT agent_id, MAX(started_at) as last_run, COUNT(*) as total_runs FROM agent_runs GROUP BY agent_id ORDER BY last_run DESC;

-- Entity counts by type
SELECT entity_type, COUNT(*) FROM gs_entities GROUP BY entity_type ORDER BY count DESC;

-- Community-controlled orgs by remoteness
SELECT remoteness, COUNT(*) FROM gs_entities WHERE is_community_controlled = true GROUP BY remoteness ORDER BY count DESC;
```

## Daily Workflow

1. **Start:** Run `/preflight` to check database, env, git, and types
2. **Work:** Build features, fix bugs, run agents
3. **Close:** Run `/close` to verify, commit, and update handoff
