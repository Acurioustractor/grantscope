# CivicGraph (GrantScope) — Project Instructions

## Rule #1: Supabase Access

Use the GrantScope Supabase MCP only when it is configured for project `tednluwflfhxyucgwigh`. If the MCP is unavailable or unauthenticated, fall back to `gsql.mjs` for `SELECT` queries and `psql` for DDL/migrations.

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

## Rule #6: Architecture Constraints (Stop Guessing)

These defaults prevent the #1 friction source — picking the wrong approach and rewriting:

- **In-app, not CLI.** New features go into the Next.js app as pages/components. Never build CLI tools or standalone scripts for user-facing features unless explicitly asked.
- **Server Components by default.** Only use `"use client"` when the component needs interactivity (onClick, useState, useEffect). Never use `next/dynamic` in Server Components.
- **Bulk SQL, not API loops.** For data operations touching 50+ rows, use a single SQL query via gsql.mjs or psql, not individual API calls or Supabase SDK loops.
- **Ask before large queries.** Any ILIKE or JOIN on tables >100K rows needs pagination or a targeted WHERE clause. Never run unfiltered scans on gs_entities, gs_relationships, or austender_contracts.
- **When unsure, ask.** If the approach could go two ways (CLI vs UI, server vs client, SQL vs API), ask in one sentence before building.

## Rule #5: Protect Context — Clear, Don't Compact

Auto-compaction is lossy and compounds — each compression degrades context. After 2-3 compactions you're working with garbage. **This is the #1 productivity killer in this project.**

**HARD LIMITS (non-negotiable):**
- **MAX 5 background tasks per session.** Every background task completion notification consumes context even if you never read the output. 30 background tasks = 30 notifications = compaction trigger. If you need more than 5, run `/continuity_ledger` then suggest `/clear` first.
- **MAX 3 parallel Task agents at once.** Wait for results, summarize in 1-2 sentences each, then launch more if needed.
- **NEVER read background task output files into main context.** Use `tail -3` only. Summarize findings in your own words.
- **After ANY Task agent completes, summarize in ≤2 sentences.** Do not echo the agent's full output.

**Prevention:**
- Keep sub-agent results OUT of main context. Summarize agent outputs in 2-3 sentences, don't paste them.
- For background tasks: check output files with `tail -3`, don't read entire outputs into context.
- When running 3+ parallel agents, summarize their collective output — don't include each full report.
- Prefer `head -5` / `tail -5` over reading full script outputs.
- **Count your tool calls.** After 30+ tool calls in a session, proactively suggest `/clear`.

**When context gets heavy:**
- If you sense context is 60%+ used (many tool calls, long outputs, multiple agent results), proactively run `/continuity_ledger` and suggest `/clear`.
- After `/clear`, the SessionStart hook reloads the ledger — you'll have clean context with full signal.
- `/clear` + ledger reload > degraded compacted context. Always.

**After compaction (if it happens anyway):**
- Read the handoff/ledger file immediately to recover domain context.
- Don't guess — verify state by checking git status, running quick DB queries, and reading the plan file.

## Project Structure

- **Monorepo:** `apps/web` (Next.js 15, Tailwind 4), `scripts/` (data pipeline agents)
- **Agent registry:** `scripts/lib/agent-registry.mjs` (45 agents, 8 categories)
- **Orchestrator:** `scripts/agent-orchestrator.mjs`
- **Mission Control:** `apps/web/src/app/mission-control/`

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

**Quick reference:** Bauhaus Industrial — Satoshi (display), DM Sans (body), JetBrains Mono (code).
`border-4 border-bauhaus-black`, `font-black uppercase tracking-widest`, zero border-radius everywhere.
Colors: `bauhaus-black` #121212, `bauhaus-red` #D02020, `bauhaus-blue` #1040C0, `bauhaus-yellow` #F0C020, `bauhaus-canvas` #F0F0F0.

## Key Tables Reference

| Table | Rows | Key Columns |
|-------|------|-------------|
| `gs_entities` | 159K | gs_id, canonical_name, abn, entity_type, sector, postcode, state, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, lga_code |
| `gs_relationships` | 1.08M | source_entity_id, target_entity_id, relationship_type, amount, year, dataset |
| `austender_contracts` | 770K | title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, contract_end |
| `acnc_charities` | 66K | abn, name, charity_size, state, postcode, purposes, beneficiaries, is_foundation |
| `justice_funding` | 71K | recipient_name, recipient_abn, gs_entity_id, program_name, amount_dollars, state, financial_year, sector |
| `political_donations` | 312K | donor_name, donor_abn, donation_to, amount, financial_year |
| `ato_tax_transparency` | 24K | entity_name, abn, total_income, taxable_income, tax_payable, report_year |
| `entity_identifiers` | 31K | entity_id, identifier_type, identifier_value, source |
| `alma_interventions` | 1.2K | name, type, description, evidence_level, cultural_authority, target_cohort, geography, portfolio_score, gs_entity_id |
| `alma_evidence` | 570 | intervention_id, evidence_type, methodology, sample_size, effect_size |
| `alma_outcomes` | 506 | intervention_id, outcome_type, measurement_method, indicators |
| `foundations` | 10.8K | name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus |
| `grant_opportunities` | 18K | name, amount_min, amount_max, deadline, categories, focus_areas |
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
- `mv_entity_power_index` — cross-system power concentration (83K entities, 7 systems, power_score, system_count)
- `mv_funding_deserts` — LGA-level disadvantage vs funding (1.6K LGAs, desert_score, SEIFA + remoteness)
- `mv_revolving_door` — entities with 2+ influence vectors: lobbying, donations, contracts, funding (4.7K entities, revolving_door_score)
- `mv_board_interlocks` — people serving on multiple entity boards (person_name, entities, shared_board_count)
- `mv_person_entity_network` — person→entity connections with financial footprint (4.9K connections)
- `mv_person_influence` — per-person influence scores (4.8K people, board_count, financial_footprint)

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

## Health Stack

- typecheck: cd apps/web && npx tsc --noEmit
- test: cd apps/web && npx vitest run
- shell: shellcheck scripts/*.sh

## Daily Workflow

1. **Start:** Run `/preflight` to check database, env, git, and types
2. **Work:** Build features, fix bugs, run agents
3. **Close:** Run `/close` to verify, commit, and update handoff

---

<!-- BEGIN ACT-CONTEXT (auto-generated by sync-act-context.mjs — do not edit) -->

## ACT Context (auto-synced from `act-global-infrastructure/wiki/decisions/act-core-facts.md`)

> Last synced: 2026-04-24. **Do not edit this section directly** — edit the upstream file and run `node scripts/sync-act-context.mjs --apply`. Downstream edits get overwritten.

### Entities (as of 2026-04-25)
- **A Curious Tractor Pty Ltd** (ACN 697 347 676; ABN PENDING) — registered 2026-04-24. Primary trading entity from 1 July 2026. Shareholders: Knight Family Trust 50 + Marchesi Family Trust 50. Directors: Ben Knight + Nicholas Marchesi. Bank: NAB. Accountant: Standard Ledger.
- **Nicholas Marchesi sole trader** (ABN 21 591 780 066) — currently trading; hard cutover to Pty 30 June 2026.
- **A Kind Tractor Ltd** (ACN 669 029 341, ABN 73 669 029 341) — charitable CLG, ACNC-registered, **NOT DGR**, dormant.
- **Harvest entity** + **Farm entity** — being designed pending Standard Ledger advice.

**Do NOT** use "ACT Foundation" or "ACT Ventures" as legal entity names. They are conceptual labels in older docs, not real entities.

### Cutover (30 June 2026)
- **Rule 1** — pre-cutover invoices stay with sole trader (no re-issue, no inter-entity loan); novation letters say "existing invoices pay as normal; new tranches from 1 July to Pty"
- **Rule 2** — honest-delay fallback: if Pty not invoice-ready 1 July, sole trader continues trading until Pty is genuinely live (no retroactive invoicing, no silent mis-attribution)
- **Rule 3** — Rotary INV-0222 ($82.5K, 380d) is a recovery problem, not a novation one
- **Rule 4** — Shareholders Agreement is Week 1-2 (drafted by Standard Ledger's lawyer), not Week 4-5

### Active receivables on sole trader (~$507K total)
Snow $132K · Centrecorp DRAFT $84.7K · Rotary $82.5K · PICC $113.3K · Regional Arts $33K · Just Reinvest $27.5K · BG Fit $15.4K · Aleisha Keating $11.7K · Homeland $5K · SMART Recovery $2.2K

### Naming + voice
- "Australian Living Map of Alternatives" (never bare "ALMA")
- "Listen · Curiosity · Action · Art" (never bare "LCAA")
- Indigenous place names always; colonial in brackets
- No em-dashes in any ACT-facing writing
- For ANY public-facing copy, load `act-global-infrastructure/.claude/skills/act-brand-alignment/references/writing-voice.md`

### Cross-repo sources
- **Entity facts (source-of-truth)**: `act-global-infrastructure/wiki/decisions/act-core-facts.md`
- **Brand alignment map (READ BEFORE DESIGNING ANYTHING)**: `act-global-infrastructure/wiki/decisions/act-brand-alignment-map.md`
- **Parent brand identity**: `act-global-infrastructure/.claude/skills/act-brand-alignment/references/brand-core.md`
- **Parent writing voice (Curtis method, AI-tells blocklist)**: `act-global-infrastructure/.claude/skills/act-brand-alignment/references/writing-voice.md`
- **Migration plan**: `act-global-infrastructure/thoughts/shared/plans/act-entity-migration-checklist-2026-06-30.md`
- **Alignment Loop syntheses (weekly drift signal)**: `act-global-infrastructure/wiki/synthesis/`
- **CEO daily cockpit**: `act-global-infrastructure/wiki/cockpit/today.md` (refreshed daily 07:00 Brisbane)
- **Project codes (72 codes, all canonical)**: `act-global-infrastructure/config/project-codes.json`
- **Funder ledger**: `act-global-infrastructure/wiki/narrative/funders.json`

### Visual family (before designing anything in this repo)
This repo's cluster: see brand alignment map. The map says:
- **Editorial Warmth** parent: act-regenerative-studio (Fraunces + forest green + warm white)
- **Editorial Warmth** subfamily: JusticeHub (STAY journal heritage), empathy-ledger-v2 (multi-tenant earth-tone)
- **Civic Bauhaus**: CivicGraph / grantscope (Satoshi + black + signal red, intentional break)
- **Unscoped (need decision)**: goods, act-farm, The Harvest Website

**Rule**: read the map before designing. Update the map BEFORE shipping a new design. Never re-decide what's already decided.

<!-- END ACT-CONTEXT -->
