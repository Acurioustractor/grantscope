# Cross-System Alignment: GrantScope + JusticeHub + Empathy Ledger

**Updated:** 2026-03-10
**Database:** Shared Supabase `tednluwflfhxyucgwigh` (GS + JH), separate `yvnuayzslukamizrlhwb` (EL, synced via `push-sync.ts`)
**Canonical reference:** This file + `/Users/benknight/Code/JusticeHub/thoughts/shared/cross-system-alignment.md`

## The Three Systems

| System | Purpose | Core Tables | Status |
|--------|---------|-------------|--------|
| **GrantScope (GS)** | Funding intelligence — entity graph, money flows, place analysis | `gs_entities` (93K), `gs_relationships` (66K), `austender_contracts` (670K) | Active, Phase 2 |
| **JusticeHub (JH)** | Justice sector evidence — interventions, outcomes, organizations | `organizations` (556), `alma_interventions` (1.1K), `alma_evidence` (570) | Active |
| **Empathy Ledger (EL)** | Community voice — storytellers, stories, lived experience | `storytellers` (226), `story_analysis` (9), `tour_stops` (4) | Early, separate DB |

## Current Integration State

### What's Connected

| Bridge | How | Records | Status |
|--------|-----|---------|--------|
| JH orgs → GS entities | `organizations.gs_entity_id` (uuid FK) | 266 linked | **LIVE** |
| JH orgs by ABN | `organizations.abn` → `gs_entities.abn` | 315 with ABN | **LIVE** |
| JH funding → GS entities | `justice_funding.gs_entity_id` (backfilled) | 26,361 linked | **LIVE** |
| GS reads JH funding | Entity dossier queries `justice_funding` by ABN | 52K records | **LIVE** |
| JH reads GS enrichment | `/api/organizations/[id]/enrichment` (SEIFA, remoteness, revenue) | 266 orgs | **LIVE** |
| JH interventions → orgs | `alma_interventions.operating_organization_id` | 619 linked | **LIVE** |
| JH data health → EL sync | `getELSyncHealth()` in admin dashboard | monitoring | **LIVE** |
| JH morning briefing | `/morning-briefing` skill | daily check | **LIVE** |
| EL orgs → JH orgs | `organizations.empathy_ledger_org_id` | Exists but unused | DORMANT |
| Campaign alignment | `campaign_alignment_entities` (63K) | Political donation cross-ref | **LIVE** |

### What's NOT Connected

| Gap | Impact | Fix | Effort |
|-----|--------|-----|--------|
| GS entity dossier → JH org page | No cross-platform navigation | Add link when `gs_entity_id` match exists | 20 min |
| ALMA evidence → GS entity dossier | Evidence not visible on entity pages | Query via org → intervention → evidence chain | 1 hr |
| EL stories → GS place pages | Community voice missing from place context | Query `storytellers` by location/postcode | 45 min |
| JH orgs → GS entity source | `build-entity-graph.mjs` doesn't ingest JH orgs | Add as source dataset | 30 min |
| GS enrichment → JH org pages | JH org pages show "Data Insights" but not LGA yet | Update enrichment API to include LGA | 15 min |
| 49 unlinked JH orgs | 315 have ABN but only 266 have `gs_entity_id` | Re-run ABN match | 10 min |

## Shared Database Objects

### Tables by System

```
GS (GrantScope):     gs_*, austender_*, acnc_*, ato_*, political_*, foundations,
                     grant_opportunities, postcode_geo, seifa_2021, entity_identifiers,
                     org_profiles, agent_runs, agent_schedules

JH (JusticeHub):     alma_*, justice_*, organizations, organizations_profiles,
                     campaign_*, justicehub_nodes, organization_*

EL (Empathy Ledger): storytellers, storyteller_*, story_*, elder_review_queue,
                     tour_stops, tour_stories, tour_reactions
```

### Shared Materialized Views

| View | Owner | Used By |
|------|-------|---------|
| `mv_org_justice_signals` | GS | GS + JH (justice funding per org) |
| `mv_funding_by_postcode` | GS | GS + JH (place-based funding context) |
| `mv_funding_by_lga` | GS | GS + JH (LGA-level analysis) |
| `mv_gs_donor_contractors` | GS | GS + JH (140 dual-role entities) |
| `alma_dashboard_*` (7 views) | JH | JH dashboard |
| `alma_daily_sentiment` | JH | JH sentiment tracking |
| `alma_sentiment_program_correlation` | JH | JH program analysis |

## The Universal Join Key: ABN

ABN is the primary bridge between all three systems:

```
gs_entities.abn ←→ organizations.abn ←→ justice_funding.recipient_abn
                                      ←→ austender_contracts.supplier_abn
                                      ←→ political_donations.donor_abn
                                      ←→ ato_tax_transparency.abn
                                      ←→ acnc_charities.abn
                                      ←→ foundations.acnc_abn
```

Secondary join: `organizations.gs_entity_id` → `gs_entities.id` (266 direct links)

## API & Data Access Patterns

### Current Access (All Systems)

All three systems hit the same Supabase via service role key:
- **SELECT queries:** `supabase.rpc('exec_sql', { query })` or Supabase client `.from().select()`
- **DDL/migrations:** `psql` with `DATABASE_PASSWORD`
- **NEVER use Supabase MCP** — it's connected to the ACT project, not this database

### Cross-System Query Patterns

```sql
-- GS entity → JH org → ALMA interventions (the full chain)
SELECT e.canonical_name, o.name as jh_name, i.name as intervention, i.type
FROM gs_entities e
JOIN organizations o ON o.gs_entity_id = e.id
JOIN alma_interventions i ON i.operating_organization_id = o.id;

-- GS entity → justice funding (already in entity dossier)
SELECT * FROM justice_funding WHERE recipient_abn = 'ENTITY_ABN';

-- JH org → GS place context (postcode enrichment)
SELECT o.name, e.postcode, e.remoteness, e.lga_name, e.seifa_irsd_decile
FROM organizations o
JOIN gs_entities e ON e.id = o.gs_entity_id;

-- EL storytellers in a place (for place pages)
SELECT s.display_name, s.location, s.bio
FROM storytellers s
WHERE s.location ILIKE '%postcode%' OR s.location ILIKE '%locality%';
```

## Process Alignment

### Shared Conventions

| Convention | Standard | Notes |
|------------|----------|-------|
| Entity identifier | ABN (11-digit, no spaces) | Universal join key |
| Money format | `numeric` type, AUD assumed | No currency column needed domestically |
| ABN validation | `/^\d{11}$/` after stripping spaces | Validate before INSERT |
| Timestamps | `timestamptz` (UTC) | All `created_at`/`updated_at` |
| Materialized views | Prefix `mv_` for materialized, `v_` for regular | Refreshed via `scripts/refresh-views.mjs` |
| Agent runs | Logged to `agent_runs` table | agent_id, status, items_found, duration_ms |
| Geographic | postcode → `postcode_geo` for locality/state/LGA/remoteness/SEIFA | GS is source of truth |

### What Each System Should Own

| Data Domain | Owner | Others Read |
|-------------|-------|-------------|
| Entity resolution (canonical names, ABN matching) | **GS** | JH, EL |
| Geographic enrichment (postcode, LGA, remoteness, SEIFA) | **GS** | JH, EL |
| Funding relationships (contracts, donations, grants) | **GS** | JH |
| Justice funding records | **JH** | GS |
| Interventions + evidence + outcomes | **JH** | GS |
| Organization profiles (JH-specific) | **JH** | GS reads |
| Community voice, stories, consent | **EL** | GS, JH |
| Storyteller profiles + media | **EL** | GS, JH |

## Priority Actions

### Immediate (This Session)

1. **Backfill JH orgs with GS enrichment** — 266 linked orgs should have remoteness, LGA, SEIFA from GS
2. **Fix 49 unlinked JH orgs** — 315 have ABN but only 266 have `gs_entity_id`. Match the remaining 49.

### Next Session

3. **Add JH orgs as entity source** in `build-entity-graph.mjs` — auto-link new JH orgs to GS entities
4. **Cross-link in UI** — entity dossier links to JH org page when match exists
5. **ALMA evidence on entity dossier** — show intervention evidence count + link

### Later

6. **EL stories on GS place pages** — community voice as the 4th truth layer
7. **Unified morning briefing** — single health check across all three systems (already partially done with `/health`)
8. **Shared entity enrichment interface** — standardize how all three systems enrich entities

## Health Check Coverage

The `/health` command now covers:
- **GS data:** Entity coverage (postcode, remoteness, LGA, SEIFA, ABN, website, description)
- **GS agents:** All 25 agents with success rates and stuck detection
- **JH views:** 7 `alma_dashboard_*` + `alma_daily_sentiment` + `alma_sentiment_program_correlation` in MV refresh
- **Missing:** JH-specific agent health, EL data health

### Gaps to Close
- Add `organizations` count + linkage rate to `/health`
- Add `alma_interventions` count + evidence coverage
- Add `storytellers` count + story coverage
- Add cross-system linkage rate (266/556 = 48% of JH orgs linked to GS)
