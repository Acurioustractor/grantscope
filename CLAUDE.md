# CivicGraph (GrantScope) — Project Instructions

## Rule #1: Supabase Access

Use the GrantScope Supabase MCP only when it is configured for project `tednluwflfhxyucgwigh`. If the MCP is unavailable or unauthenticated, fall back to `gsql.mjs` for `SELECT` queries and `psql` for DDL/migrations.

### How to query GrantScope's database

```bash
# SELECT queries — use gsql.mjs
node --env-file=.env scripts/gsql.mjs "SELECT COUNT(*) FROM gs_entities"

# DDL/migrations — ONE home, ONE apply path (decided 2026-09-05, see supabase/migrations/README.md)
#   write supabase/migrations/<14-digit-version>_<name>.sql, then:
scripts/db-apply.sh supabase/migrations/<version>_<name>.sql     # psql -f + tracker insert; Tier 3, Ben's verb
node --env-file=.env scripts/check-migration-parity.mjs          # folder vs supabase_migrations.schema_migrations
```

**Warning:** gsql.mjs `-c` flag mangles `$$` dollar-quoting — db-apply.sh uses `psql -f`, which does not.
**The baseline is `supabase/migrations/20260905130000_baseline_remote_schema.sql`** (the live schema, dumped 2026-09-05).
Everything older lives in `supabase/migrations_history/` and is never applied. Migrations applied from OTHER repos
or via the MCP `apply_migration` tool must be committed here with the same version in the same session; the parity
check names the ones that were not. Generated types: `supabase/types/database.types.ts`. Edge functions: `supabase/functions/`.

## How a change goes live (the whole path, decided 2026-09-05)

1. **Branch off `main`** (`git switch -c <type>/<slug>`). Never commit on `main`. One session per checkout.
2. **Database change?** Write `supabase/migrations/<version>_<name>.sql`, then `/db-apply` (Ben's verb). Nothing else
   touches the schema. `node --env-file=.env scripts/check-migration-parity.mjs` says whether the folder and the
   database agree. The data itself is legible at **`/ops/schema`** (owner, consumers, size, public-key exposure).
3. **Land with `/ship-merge`.** It runs the gate (`scripts/precheck.sh`), pushes, opens the PR, classifies:
   SAFE paths (`scripts/`, `supabase/`, `docs/`, `thoughts/`, `.github/`, `.claude/`, `lib/`, `api/`, `ops/`,
   `admin/`, tests) merge themselves on green; anything a visitor can render waits for Ben's preview and the word "merge".
4. **Merged = deployed.** Vercel builds `main`; `/config-truth` when something is set but inert.
5. **Nothing else.** No worktrees for Ben, no manual pushes, no MCP `apply_migration` without a committed file.

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

## SE Registry Strategy (decided 2026-06-08)

**"Free open registry for everyone; paid evidence + tender tools for buyers."**
Before building or prioritising any SE-registry/procurement/giving feature, check `docs/strategy/buyer-wedge.md` (or run `/wedge`). Data widening is paused; evidence depth and buyer UX are the priority. Lighthouse-buyer workflow: `/lighthouse`.

## Project Structure

- **Monorepo:** `apps/web` (Next.js 15, Tailwind 4), `scripts/` (data pipeline agents)
- **Agent registry:** `scripts/lib/agent-registry.mjs` (185 agents, 14 categories, measured 2026-09-05)
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

Row counts below are exact `count(*)` measured 2026-08-14. The previous version of this table
understated most of them by 3–8x and omitted the four largest datasets entirely. Re-measure before
trusting these again — do not let them rot a second time:
`node --env-file=.env scripts/gsql.mjs "SELECT count(*) FROM <table>"`

**The database holds 1,024 public-schema relations** (714 tables + 98 matviews + 212 views),
724 populated, 52.3M rows. This table is the top ~25. The full catalogue lives in
`thoughts/shared/data-map/` — go there before assuming something does not exist.

| Table | Rows | Key Columns |
|-------|------|-------------|
| `abr_registry` | 20.0M | the ABN register — largest object in the DB, undocumented until 2026-08-14 |
| `gs_relationships` | 3.43M | source_entity_id, target_entity_id, relationship_type, amount, year, dataset |
| `political_donations` | 2.55M | donor_name, donor_abn, donation_to, amount, financial_year, **receipt_type** |
| `asic_companies` | 2.17M | ASIC company register |
| `entity_xref` | 1.21M | the REAL graph crosswalk (covers 91.9% of gs_entities). Not `entity_identifiers`. |
| `austender_contracts` | 824K | title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, contract_end |
| `gs_entities` | 609K | gs_id, canonical_name, abn, entity_type, sector, postcode, state, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, lga_code |
| `acnc_ais` | 360K | ACNC Annual Information Statements (charity financials by year) |
| `mv_charity_network` | 351K | charity↔charity links via shared directors. Refreshed nightly, read by NO app code. |
| `person_roles` | 340K | person_name, person_name_normalised, role_type, entity_id, company_acn, confidence. NO is_nominee_block — that flag lives on `person_identities` (join by person_name_normalised); the wrong claim here failed a migration 2026-08-16 |
| `grantconnect_awards` | 291K | awarded Commonwealth grants. NOT empty — an old memory note claiming that is wrong. |
| `person_identities` | 230K | resolved person identities |
| `state_tenders` | 200K | **owned and scraped by JusticeHub**, read by GrantScope report pages |
| `mv_entity_power_index` | 188K | canonical_name, abn, system_count, power_score, in_* flags |
| `justice_funding` | 157K | recipient_name, recipient_abn, gs_entity_id, program_name, amount_dollars, state, financial_year, sector, topics, **measure_kind** |
| `organizations` | 104K | JusticeHub's org hub. `gs_entity_id` populated on 99.72% — the GS↔JH bridge. |
| `acnc_charities` | 66K | abn, name, charity_size, state, postcode, purposes, beneficiaries, is_foundation |
| `mv_board_interlocks` | 39.8K | person_name_normalised, person_name_display, board_count, organisations, organisation_abns, entity_ids, interlock_score |
| `entity_identifiers` | 31K | entity_id, identifier_type, identifier_value, source. **CRM store (LinkedIn/GHL/Xero ids), FK'd to `canonical_entities`, contains ZERO ABNs.** Not the graph crosswalk. |
| `ato_tax_transparency` | 26K | entity_name, abn, total_income, taxable_income, tax_payable, report_year |
| `grant_opportunities` | 26K | name, amount_min, amount_max, deadline, categories, focus_areas |
| `postcode_geo` | 12K | postcode, locality, state, sa2_code, remoteness_2021, lga_name, lga_code |
| `foundations` | 11K | name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus |
| `seifa_2021` | 10.6K | postcode, index_type, score, decile_national |
| `mv_funding_by_postcode` | 7.2K | postcode, state, remoteness, entity_count, total_funding |
| `alma_outcomes` | 2.9K | id, outcome_type, measurement_method, indicators — via `alma_intervention_outcomes` junction (NO direct intervention_id) |
| `alma_interventions` | 2.1K | name, type, description, evidence_level, evidence_strength_signal, portfolio_score, gs_entity_id, topics |
| `mv_funding_deserts` | 2.0K | LGA disadvantage vs funding. Grain is NOT unique per LGA — 1,130 distinct name\|state over 1,997 rows. |
| `mv_funding_by_lga` | 1.7K | per-LGA funding aggregates |
| `alma_evidence` | 631 | id, evidence_type, methodology, sample_size, effect_size — via `alma_intervention_evidence` junction (NO direct intervention_id) |
| `org_profiles` | 3 | user_id, name, abn, stripe_customer_id, subscription_plan. 24 tables FK to these 3 rows. |

### Three filters that are mandatory, not optional

These exist to separate incompatible measures that share one amount column.
Omitting them does not produce a slightly-off number, it produces a wrong one by an order of magnitude.

```sql
-- 1. justice_funding: 368 'expenditure_aggregate' rows are WHOLE-OF-STATE BUDGETS ($28.35bn),
--    not money to any organisation. For funding received by orgs:
WHERE measure_kind = 'grant'          -- 126,673 rows, $46.1bn

-- 2. justice_funding: measure_kind='grant' does NOT exclude source-spreadsheet TOTAL rows,
--    and does NOT imply is_aggregate=false. Both are needed; neither is a superset of the other.
AND is_aggregate IS NOT TRUE
AND lower(trim(recipient_name)) NOT IN
    ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')
                                      -- 125,300 rows, $33.98bn

-- 3. political_donations: 'other receipt' is 72% of rows and 85% of dollars and is NOT donations.
WHERE receipt_type = 'donation received'   -- 506,739 rows, $23.0bn (vs $186.7bn 'other receipt')
```

**Filter 2 was missing until 2026-08-16 and the omission is expensive.** Measured:

| filter | rows | total |
|---|---|---|
| `measure_kind = 'grant'` | 126,673 | **$46.10bn** |
| …and not an aggregate-shaped recipient name | 126,627 | $38.01bn |
| …**and `is_aggregate IS NOT TRUE`** | **125,300** | **$33.98bn** |

**Together these strip $12.12bn — 26% — from the headline `grant` figure.**

46 rows are aggregate-shaped names carrying $8.09bn. 35 are named literally `Total`
($8.07bn); the rest are `Various` (3, $12.7m), `na` (2, $1.3m) and `n/a` (6, no amount recorded).
Four are `qld-historical-grants` column totals
worth $617.9m sitting inside the `youth-justice` topic, where they rank as the **#1 and #2
recipients of youth justice funding in Australia**. One of them even carries an ABN, so an
ABN-based join will not save you.

**`is_aggregate` and `measure_kind` are independent — neither implies the other.** 1,358 rows are
`measure_kind='grant'` AND `is_aggregate` ($12.06bn of grant-shaped aggregates), while 180
`expenditure_aggregate` rows are `is_aggregate=false` ($6.77bn). Filtering on either alone leaves
billions behind.

**Re-measured 2026-08-19 after the ROGS dedupe (#299).** The `expenditure_aggregate` lane was
848 rows / $66.13bn, of which 483 were exact duplicates of a second ingest of the same
Productivity Commission table. It is now 368 rows / $28.35bn. The `is_aggregate=false` count
fell from 330 / $17.39bn to 180 / $6.77bn in the same fix, which also flagged the 80 ROGS
rollup rows that had been only 30/80 flagged. Per-lane figures (detention, community-based,
group conferencing) were never affected — the duplication was across `program_name` labels,
not within them.

`political_donations` was checked for the same defect and is clean — no aggregate-shaped donor
names. Filter 2 is specific to `justice_funding`.

**Run `/money-audit` before shipping any surface that renders a dollar figure.** It enumerates
every summing site, classifies each as grant-lane or expenditure-lane, and refuses to call a
filter applied without measuring the delta. It exists because `topicFilter()` mixed the two lanes
for months and published $31.66bn where the grant figure was $0.92bn.

Use `isRealRecipient()` / `themeMoney()` from `apps/web/src/lib/justice-money.ts` rather than
rewriting the predicate. Two further traps are handled there:

- **Postgres sorts NULLs FIRST in a `DESC` ordering.** A naive "top recipients by amount" query
  returns the rows with no amount at all. Add `amount_dollars IS NOT NULL` or `NULLS LAST`.
- **Topic tags overlap.** `youth-justice` ∩ `diversion` = 98 rows; `child-protection` ∩
  `family-services` = 2. Querying tag by tag and concatenating double-counts them — deduplicate by
  `id`.

**Unaudited, flagged 2026-08-16:** 100 files under `apps/web/src` reference `justice_funding` and
only 2 reference `measure_kind`. What the other 98 do has not been checked. Do not assume a figure
from an existing surface has been through any of these filters.

Topic tags use HYPHENS: `topics @> ARRAY['youth-justice']`. The underscore form returns zero rows silently.

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
3. **Before shipping a money surface:** `/money-audit` — figures are the product
4. **Before flipping a flag that changes what many pages read:** `/surface-sweep` — 200 is not working
5. **Ship:** Run `/ship-merge` — do NOT hand-roll push/PR/merge (see Landing Policy below)
6. **Close:** Run `/close` to verify, commit, and update handoff

**`/config-truth` when a feature is configured but inert.** `/preflight` checks env vars are
*present*; `/config-truth` checks their deployed values can satisfy the comparisons the code makes
on them. That gap hid a trailing newline that blanked 61 public pages for four months.

## Cutting scope: sweep the periphery (learned the hard way, 2026-08-18)

On **2026-04-24** the commit *"scope cut to portfolio mode — kill SaaS-shaped surfaces"* removed the
SaaS code cleanly. Nothing else moved. For **four months** afterwards:

- two Vercel crons kept calling `tender-intelligence` routes that no longer existed — hourly 404s;
- `/api/cron/usage-alerts` kept checking API-key rate limits against `api_keys`, which holds 0 rows;
- the ops dashboard kept showing an activation funnel for a product that was cut — `product_events`
  holds exactly one row, dated 2026-04-20;
- a duplicate ingest written that same week put **$304M of double-counted grant money** into every
  foundation figure, unnoticed until 2026-08-18.

**Deleting code does not propagate.** When a surface is cut, the code is the easy half. Sweep:

- [ ] **Crons** — `vercel.json` and pg_cron. A cron pointing at a deleted route 404s forever, silently.
      (Now guarded: `apps/web/src/lib/vercel-config.test.ts` fails the build if a cron path has no route.)
- [ ] **Scheduled agents** — `scripts/lib/agent-registry.mjs`, `agent_schedules`.
- [ ] **Datasets** — does an ingest still write rows nothing reads? Does it duplicate another
      `dataset` key? Check `gs_relationships` by `dataset` before assuming.
- [ ] **Instrumentation** — events still emitted for a dead flow, or a table that stopped receiving
      and nobody noticed.
- [ ] **Dashboard tiles** — a tile whose source is now empty reads as "zero", not as "gone".
- [ ] **The issue tracker** — close what the cut made moot.

**The tell:** any screen showing a confident zero. Of the four-month debris above, three surfaced as
zeros on a dashboard, and every one of them was mistaken for a measurement.

## The API-key surface is dormant by decision (2026-08-19)

`api_keys` holds 0 rows **on purpose** and has never held one — `api_usage`'s 25 rows are a single
two-hour smoke test on 2026-03-21, all with a NULL `key_id`. Every path by which a key could be
issued or displayed was deleted; `/api/v1/exposure`, `authenticateApiKey` and the table were kept,
because the dossier logic is the expensive half and key CRUD is a day's work.

**So an empty `api_keys` is not debris and the 401 from `/api/v1/exposure` is not a bug.** Both are
the decision. Do not sweep them.

Two traps for anyone touching this:
- **`/api/data` and `/api/agent` are anonymous-capable.** The key only raises a rate limit
  (20/min → 120/min on agent). They are live, free surfaces — `/api/data` is the Giving Data Commons
  API and Empathy Ledger consumes `/api/data/entity/{abn}` per `docs/integrations/`.
- **`api_usage` is live instrumentation**, not a dead log: `/api/agent` writes to it on every call,
  keyed or not. It is the only signal that would tell you the API started being used.

Reasoning: https://github.com/Acurioustractor/grantscope/issues/283

## Landing Policy (decided 2026-08-18)

**Standing authorization. This repo only — it does not loosen the global tier rules elsewhere.**

Landing work ate a large share of a whole session: many small commits, an essay per commit message,
and a "may I push?" round-trip at each step. Worse, `/ship-merge` — which automates exactly this —
existed the entire time and went uninvoked, and would only have half-worked because its adapters
were written for another repo. Both are fixed. The rule now:

**Never hand-roll the landing.** Use `/ship-merge`. If it fails, fix the adapter rather than doing
it by hand — every manual landing is the tax being paid again.

### What runs without asking

- **Never commit directly to `main`.** Branch first, always. This is what turned routine pushes into
  Tier 3 during the 2026-08-18 session.
- **SAFE changes** — `scripts/`, `migrations/`, `docs/`, `thoughts/`, `apps/web/src/lib/`,
  `app/api/`, `app/ops/`, `app/admin/`, tests, config: **branch → push → PR → watch CI → squash-merge
  on green, no permission needed.** Report the merged SHA afterwards.
- **VISIBLE changes** — anything else under `apps/web/src`, i.e. anything a visitor or buyer can
  render, INCLUDING shared chrome like `app/layout.tsx` and `components/shell/*`: **push and open the
  PR, then STOP.** Ben eyeballs the Vercel preview and says merge. Never auto-merge a public surface.
- `scripts/classify-changes.sh` decides which, and **fails toward VISIBLE** — an unrecognised path is
  treated as public. Being asked about a safe change costs one message; auto-merging a broken public
  page costs trust.

### Still Tier 3, still needs Ben's explicit verb

Force-push · deleting branches · `git rm` of tracked files · pushing straight to `main` · reverting
a merged PR · anything touching an external system of record (Xero, GHL, Notion, sent messages).

### The adapters

| script | what it is |
|---|---|
| `scripts/precheck.sh` | the health stack in one command (`tsc --noEmit` + `vitest run`); `--fast` for typecheck only, never for a push |
| `scripts/classify-changes.sh` | VISIBLE vs SAFE against `origin/main` |
| `scripts/ship-watch.mjs` | one background watcher: CI → merge → curl the live route. `--merge` only for SAFE |

**Batch before shipping.** Each PR costs a fixed few minutes of pipeline regardless of size. Related
fixes to one surface belong in ONE branch as separate commits, not a PR each. Split only when a
change needs independent revert, or when one part is VISIBLE and the rest SAFE.

**Commit messages: shorter.** A subject line plus the why, and the non-obvious trap if there is one.
The reasoning belongs in the findings doc or the migration header, where it is findable later.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Acurioustractor/grantscope` (via `gh`). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

---

<!-- BEGIN ACT-CONTEXT (auto-generated by sync-act-context.mjs — do not edit) -->

## ACT Context (auto-synced from `act-global-infrastructure/wiki/decisions/act-context-downstream-block.md`)

> Source upstream of this file: `act-global-infrastructure/wiki/concepts/soul.md`. The two humans and the why behind everything below.

> Last synced: 2026-07-25. **Do not edit this section directly.** Edit the projection file above, then run `node scripts/sync-act-context.mjs --apply` **from the act-global-infrastructure repo** (it resolves paths relative to cwd). Downstream edits get overwritten.

### Entities (as of 2026-07-19)
- **A Curious Tractor Pty Ltd** (ACN 697 347 676; **ABN 36 697 347 676, issued with GST 2026-06-01**). Registered ASIC 2026-04-24. Primary trading entity from 1 July 2026; **trades as "Goods on Country"** for the Goods commercial arm (contracting, product sales, R&D claimant). Shareholders: Knight Family Trust 50 + Marchesi Family Trust 50. Directors: Ben Knight + Nicholas Marchesi. Bank: NAB. Accountant: Standard Ledger.
- **Nicholas Marchesi sole trader** (ABN 21 591 780 066). Currently trading; hard cutover to Pty 30 June 2026.
- **The Butterfly Movement Ltd** (ACN 155 132 684; ABN 22 155 132 684, verified ABR 2026-06-02). **The Goods charity + DGR home: endorsed Item 1 DGR + PBI since 17 Jan 2012**, ACNC-registered since Dec 2012 — can auspice/receipt NOW. "TABOO Foundation" is a business name on the same ACN. Stewardship handover 26 Jun 2026; Indigenous-led board being installed. DGR runs ONLY through Butterfly — never ACT Pty or AKT.
- **A Kind Tractor Ltd** (ACN 669 029 341, ABN 73 669 029 341). Charitable CLG, ACNC-registered, **NOT DGR**, dormant. **NOT the Goods vehicle** — that is Butterfly.
- **Harvest entity** + **Farm entity**. Being designed pending Standard Ledger advice. **Interim operating decision (2026-07-19): Harvest trades through Nicholas Marchesi's sole trader and its existing Xero / ACT Everyday account until the whole ACT cutover moves to A Curious Tractor Pty Ltd.** Track all Harvest activity as ACT-HV; do not mix it into the future Pty tenant early.

**Do NOT** use "ACT Foundation" or "ACT Ventures" as legal entity names. They are conceptual labels in older docs, not real entities.

### Why this structure

Three trading entities, one charity, one winding-down sole trader. The point is not bureaucracy. Each project earns the right to grow on its own revenue. The Harvest's money funds The Harvest's growth. Farm money funds Farm growth. A Curious Tractor Pty Ltd is the holding muscle that carries the founder relationship and the cross-cutting work.

If we ran a single Pty Ltd with three project codes, the financial story would mash. Founders would have no clean way to see whether each project pays its way. The structure costs more in compliance and saves more in legibility. Legibility is what makes the soul able to read its own body.

For how money flows through these entities into the four lanes (To Us, To Down, To Grow, To Others), see `act-global-infrastructure/wiki/concepts/four-lanes.md`.

### Cutover (30 June 2026)
- **Rule 1.** Pre-cutover invoices stay with sole trader (no re-issue, no inter-entity loan). Novation letters say "existing invoices pay as normal; new tranches from 1 July to Pty".
- **Rule 2.** Honest-delay fallback: if Pty not invoice-ready 1 July, sole trader continues trading until Pty is genuinely live (no retroactive invoicing, no silent mis-attribution).
- **Rule 3.** Rotary INV-0222 ($82.5K, 380d) is a recovery problem, not a novation one.
- **Rule 4.** Shareholders Agreement is Week 1-2 (drafted by Standard Ledger's lawyer), not Week 4-5.

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
- **This block's source**: `act-global-infrastructure/wiki/decisions/act-context-downstream-block.md`
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

## Verifying a change: local first, previews for Ben (decided 2026-08-20)

A whole session went on trying to read Vercel previews. They are protected by SSO, an agent
cannot sign in, and every attempt cost an 8–11 minute build and ended at a login page. Meanwhile
everything that was actually found that day came from local:

| found by | what |
|---|---|
| `npm run dev` on 3013 | the 61-route sweep, the donor-contractors crash, the state-disclosure render, the influence-network zeros |
| a local production build | the 60s static-generation limit that failed a preview build (#344) |
| a Vercel preview | nothing |

**So: local for the agent's verification, previews for Ben's review. The agent does not try to
read previews.** Hand Ben the URL with the specific thing to look at, and say plainly what was
verified locally.

### Match the check to the risk — dev for data, a build for build-time behaviour

Corrected 2026-08-20, the same day the rule was written. The original said a production build was
needed before claiming any public-surface change was verified. That is true for one class of
problem and wasteful for the common one, and applying it to everything cost about an hour of
builds in a single afternoon.

**`npm run dev` (:3013) is sufficient when the change is a query, a filter or a render.** The SQL
runs against the same database and the same component renders. Measured: verifying a fixed query
on `/reports/picc` took **8 seconds** on dev and **~9 minutes** via a production build, for an
identical answer.

**`npm run preview` (production build, :3015) is required when the change could alter build-time
behaviour:**

- anything touching `next.config.ts`, the root layout, `revalidate`/`dynamic`, or `package.json`
- anything that could change how long a page takes to PRERENDER — the 60-second cap only exists
  at build time, which is why `/reports/community-efficiency` at 59.6s hid for four months
- when you need the build LOG, which is the only place per-surface query failures are listed

**The build log is a first-class verification tool**, not a side effect. Since `safe()` names its
surface, `grep '\[report-service\].*failed'` over a build turns "something is broken in reports"
into a list of pages — and a fix is verified by a named failure disappearing from it. That is
worth a build on its own.

`npm run preview` shares `.next` with the dev server, so stop dev first — `scripts/precheck.sh`
says the same thing for the same reason.

### Verifying PRODUCTION: Playwright, not curl, not the extension

`curl` against civicgraph.app returns **429** — Vercel's Security Checkpoint is a JS challenge no
HTTP client can solve, so every curl check yields a plausible-looking failure that means nothing.
The Chrome extension works but disconnects; on 2026-08-20 it was down for hours while five merged
PRs sat unverified.

**`mcp__playwright__browser_navigate` + `browser_evaluate` is the reliable path.** It drives a
real browser, passes the challenge, and needs no extension. It reads JSON API responses as easily
as pages.

Two traps when checking content this way, both hit on 2026-08-20:
- **Match case-insensitively.** CSS `text-transform` means `innerText` gives "NOT PUBLISHED" where
  the source says "Not published". Two changes were reported as "not deployed" when they were live.
- **Check the code path, not just the route.** `/api/data/graph` returned zero LGA nodes and looked
  broken; that layer only renders under `?mode=ndis`. A wrong probe reads exactly like a real
  regression.

### What local genuinely cannot tell you

Vercel build-machine limits, deployment protection behaviour, and the values of production env
vars. The first is mostly covered by `npm run preview`; for the third use `/config-truth`, because
a var can be set, non-empty and still wrong.
