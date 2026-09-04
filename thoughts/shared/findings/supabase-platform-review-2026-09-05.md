---
date: 2026-09-05
topic: How CivicGraph, JusticeHub, Empathy Ledger, Harvest, Goods and ACT's business systems use Supabase, and how to make the grants focus sustainable
method: single-session review against the live project (catalog queries, advisor dumps, read-only REST probes with the publishable key) plus greps across six local repos
status: findings and a sequenced plan; Phase 0 remediation APPLIED 2026-09-05 (Ben's verb), verified by catalog post-check and publishable-key re-probe
remediation: supabase/migrations/20260905120000_close_private_view_and_anon_rebuild_exposure.sql
---

# Supabase platform review

**Confidence tags.** `[V]` = queried the live database, the advisor API, or the REST API in this session, or read the file
line by line. `[G]` = grep counts across repos (exact for what the pattern matches, blind to what it does not). `[I]` = inferred
from `[V]` facts, not independently tested. `[P]` = prior finding cited from an existing doc, not re-derived.

## The headline

One Supabase project, named "JusticeHub + GrantScope" in the dashboard, is the database for six codebases and holds both the
public civic graph and A Curious Tractor's private CRM, accounts mirror and inbox. Four things follow from that, in order of urgency:

1. **ACT's Xero payables, expense history, all 5,509 GHL contacts and 315 newsletter emails are readable today with only the
   public API key and no login** `[V]`. Not through the tables (their RLS holds) but through 15 SECURITY DEFINER views that run
   as `postgres`. 48 views also carry anon write grants, and three anon-callable functions wipe and rebuild whole tables.
   Any signup on JusticeHub or CivicGraph additionally gets read and write on the GHL and comms tables `[V]`.
2. **No repository can reproduce the schema.** The database tracks 418 migrations; 313 of them exist in no local repo. Six
   migration folders across five repos hold 974 files, 116 of which are tracked `[V]`. The database is the only source of truth.
3. **The app is a service-role app that writes SQL in strings.** 349 files use the service key, 607 `exec_sql` call sites in 130
   files, zero generated types `[G]`. That one RPC accounts for 3.7M calls and 94 hours of database time since 12 August `[V]`.
4. **"Grants" is rendered by four front ends, scored by four engines, and modelled by 17 tables**, eight of which hold fewer
   than ten rows `[V][G]`. The four ADRs already decided GHL owns the Ask; the tables and the crons have not caught up.

None of this needs a rebuild. It needs one migration this week, one migrations home this month, and a tenant split this quarter.

## 1. Topology: what talks to what

Eight Supabase projects sit in the org `[V]`:

| project | ref | region | role |
|---|---|---|---|
| JusticeHub + GrantScope | `tednluwflfhxyucgwigh` | Sydney | **the shared project.** 27 GB, 776 tables, 230 views, 104 matviews, 461 functions, 13 schemas, 27 auth users, 18 storage buckets, 13 edge functions |
| Empathy Ledger | `yvnuayzslukamizrlhwb` | Sydney | EL's own project |
| Goods | `cwsyhpiuepvdjtxaozwf` | Tokyo | Goods project; the `goods` repo has no env file, and CivicGraph's 30 Goods tabs read `goods_*` tables in the shared project instead `[V]` |
| ACT Farmhand | `bhwyqqbovcjoefezgfnq` | Mumbai | knowledge hub |
| Knight Finances, Barkly Backbone, SMART Connect (Singapore), Palm Island On Country Server | | | separate |

Who points at the shared project `[V]` (env files, names only):

| repo | primary Supabase URL | also reaches | migration files |
|---|---|---|---|
| grantscope | shared | | `supabase/migrations` 318 + `migrations/` 84 date-named |
| JusticeHub | shared | Empathy Ledger | 422 |
| The Harvest Website | shared (Next and Vite keys) | Empathy Ledger | 8 + Drizzle (`drizzle` schema in the shared DB) |
| act-global-infrastructure | shared | EL, Farmhand, Goods | 123 |
| act-regenerative-studio | shared | | 19 |
| act-farm | shared | | 0 |
| empathy-ledger-v2 | its own | **shared, directly, with a publishable key** (`CIVICGRAPH_SUPABASE_URL`) from 2 API routes and 3 scripts | 549 (own project) |

The Empathy Ledger seam is documented as an HTTP API (`docs/integrations/empathy-ledger-anchor-card.md`, `/api/data/entity/{abn}`)
but implemented as a direct database client in `src/lib/civicgraph/client.ts` `[V]`. Its grant-matching, funder-portfolio and
funding-gap routes read `gs_entities`, `gs_relationships` and `acnc_ais` with their own queries `[G]`.

What the shared project holds, by the 2026-08-14 data map `[P]`: 14 domains, of which D14 "ACT private business systems" is 237
objects (29% of all objects) and D12 "Media, story and consent" is a 77-object, 4,501-row near-empty duplicate of Empathy
Ledger's schema (`stories`, `storytellers`, `media_assets`, `transcripts`, `profiles` all exist in both projects `[V]`).

ACT's business data in the shared project, measured today `[V]`:

| table | rows | latest |
|---|---|---|
| `communications_history` | 33,230 | |
| `linkedin_contacts` | 13,810 | |
| `ghl_contacts` | 5,509 | 2026-09-04 |
| `xero_transactions` | 5,299 | 2026-09-03 |
| `receipt_matches` | 2,972 | |
| `xero_invoices` | 2,391 | 2026-09-03 |
| `ghl_opportunities` | 1,131 | 2026-09-04 |
| `project_knowledge` | 1,003 | |
| `email_financial_documents` | 332 | |

Written by act-global-infrastructure's 134 pm2 processes (Xero, GHL, Notion, iMessage, LinkedIn, receipts) `[V]`, read by
CivicGraph's `/org/act/*` desk (65 pages) and by the command-center's 231 server routes `[G]`.

## 2. Security: what is exposed, verified

Supabase's advisor returns 805 security lints, 105 of them ERROR, all 105 the same class: `security_definer_view` `[V]`.
Measured against the live catalog `[V]`:

| measure | count |
|---|---|
| views in `public` | 230 |
| views running as definer (not `security_invoker`) | 112 |
| definer views over ACT-private tables, readable by anon or authenticated | 15 |
| auto-updatable views with INSERT/UPDATE/DELETE granted to anon | 48 |
| SECURITY DEFINER functions executable by anon | 23, of which 3 `DELETE` and re-`INSERT` a whole table |
| tables with RLS on and zero policies | 280 |
| tables with a `USING (true)` write policy for anon, authenticated or public | 49 |
| policies granting anon | 284 |
| functions with mutable `search_path` | 59 |
| matviews exposed through the API | 27 (public civic data; acceptable, flagged) |

**Read-only probe with the publishable key and no login, 2026-09-05** `[V]`. Column names only were captured, never values:

| endpoint | result |
|---|---|
| `xero_invoices`, `ghl_contacts`, `linkedin_contacts`, `communications_history`, `email_financial_documents` | 200, **0 rows**. Table RLS holds. |
| `v_act_payables_triage` | 200, **262 rows**: invoice_id, invoice_number, payee_name, project_code, invoice_date, due_date |
| `v_act_expense_history` | 200, **2,064 rows**, same shape |
| `v_canonical_contacts` | 200, **5,509 rows**: id, ghl_id, first_name, last_name, full_name, ... |
| `v_newsletter_reprompt_candidates` | 200, **315 rows**: id, ghl_id, full_name, **email**, newsletter_segment, projects |
| `org_pipeline`, `act_communities` | 401 permission denied. Correct. |
| `gs_entities` | 200, 1 row. Correct: the open registry. |

The 48 anon-writable views include the two Xero views, the two GHL views, `xero_overdue_receivables`, `xero_upcoming_payables`
and `justice_funding_clean`. Fifteen of the 48 are definer views, so a write through them would run as `postgres` `[I]`. Writes
were not tested. The three anon-callable rebuild functions (`rebuild_funder_board_paths`, `rebuild_funder_intelligence`,
`rebuild_place_funding_snapshot`) start with `DELETE FROM ...` `[V]`.

**Any signup is `authenticated`.** JusticeHub `/signup` and CivicGraph `/register` both call `auth.signUp` into the one auth pool
`[V]`. `authenticated` holds `USING (true)` policies: `ALL` on `communications_history`, `ghl_contacts`, `ghl_opportunities`,
`knowledge_chunks`, `relationship_health`; `SELECT` on `xero_invoices`; anon+authenticated `SELECT` on `grant_applications` `[V]`.

**What is fine.** `exec_sql` is SECURITY DEFINER but executable only by the service role, and the app-side proxy in
`lib/supabase.ts` rejects anything but a single SELECT/WITH `[V]`. The `_browse` family of definer functions is the intended
public read path. `gs_entities` has a deliberate `Public read` policy. Legacy JWT API keys are disabled on the project
(a call with the old anon JWT returns 401 "Legacy API keys are disabled") `[V]`; `supabase-env.ts` already prefers the
publishable and secret keys, so the app works, but `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still in `.env` as a trap for scripts.

**The RLS-on-no-policy class has no live victim that I found.** I first read `/home`'s `source_frontier` calls as going through
the cookie client; on tracing the file they use `getServiceSupabase()` (`apps/web/src/app/home/page.tsx:211`), so the panel
works. The cookie client there is used only for the session. The 280 no-policy tables remain a trap for any future SSR or
browser read, to be handled with a policy or a service read when such a read is written, not now. (Corrected 2026-09-05
after first reporting it as a live bug.)

**Edge functions** `[V]`: 13 on the project, deployed from five different local paths, including `~/Downloads/witta-swot-analysis`
(`app-user-sync`) and `~/Code/CRM` (`embeddings`, `query`). `ghl-webhook` and `intake` run with `verify_jwt = false`.

## 3. Schema governance: the database is the only source of truth

`supabase_migrations.schema_migrations` tracks 418 versions, January to August 2026, 33 to 91 per month `[V]`. Matching those
versions against every migration folder on this machine `[V]`:

| folder | files | 14-digit stamped | tracked in the DB |
|---|---|---|---|
| grantscope `supabase/migrations` | 318 | 206 | 4 |
| grantscope `migrations/` | 84 | 0 (date-named, applied by `psql -f`) | 0 |
| JusticeHub `supabase/migrations` | 422 | 374 | 23 |
| act-global-infrastructure `supabase/migrations` | 123 | 123 | 89 |
| act-regenerative-studio | 19 | 6 | 0 |
| The Harvest Website | 8 | 8 | 0 (plus Drizzle) |
| **DB versions with no file in any repo** | | | **313 of 418** |
| **repo-stamped files not in the tracker** | | | **583** |

The latest eight tracked versions (`schema_ownership_and_index_cost`, `make_open_data_explicit_and_stop_public_delete`,
`act_intake`, `el_sync_results`, ...) exist in no repo `[V]`: they were applied through the MCP `apply_migration` tool in
sessions and never committed. The 2026-08-30 findings file in this folder describes exactly that for `schema_ownership`.

`schema_ownership`, the register meant to say who owns what, has 18 rows for 1,024 relations and is already wrong on
`justice_funding` `[P]`. Cross-writes are routine: JusticeHub writes GS-core tables from 11 files and 43 of its migration files
alter them; grantscope writes JusticeHub-owned tables from 5 scripts; `justice_funding` is dual-written `[G]`.

## 4. How the app reads the database

| pattern | count | note |
|---|---|---|
| files using the service-role client | 349 | the app is the trust boundary; RLS is irrelevant to its own reads `[G]` |
| files using the cookie (SSR) client | 2, browser client 1 | auth pages and `/home` `[G]` |
| `exec_sql` call sites / files | 607 / 130 | 22 files under `app/api/data`, 13 under `reports/youth-justice` `[G]` |
| distinct tables via `.from()` | 270 | `[G]` |
| typed RPCs via `.rpc()` | 57 distinct | `[G]` |
| generated database types | 0 | JusticeHub generates them; CivicGraph does not `[G]` |
| routes `force-dynamic` / with `revalidate` | 252 / 79 | most pages hit the database per request `[G]` |
| `unstable_cache` sites | 46 | key-versioning trap already documented in memory `[P]` |
| `lib/services` files | 150, largest 2,209 lines | `[G]` |

`pg_stat_statements` since its 2026-08-12 reset `[V]`: the `exec_sql` shape is the top consumer at 3,707,364 calls, 94 hours,
mean 91 ms. Next: a browse RPC at 118,606 calls, mean 1.1 s; an `org_governance` select at 41,580 calls, mean 1.2 s;
`grant_browse_stats` at 7,358 calls, mean 1.5 s; the nightly matview refresh at 26 calls, mean 11.5 minutes. JusticeHub's
`justice_matrix_cases` selects run 1.6M and 1.5M calls at 2 to 3 ms.

The snapshot-versus-live report client (`report-supabase.ts`) is a second client with its own env flag, imported by 69 files
against 352 for the main one `[G]`. It exists because report pages once read a snapshot database; the trailing-newline env bug
it documents is the reason `/config-truth` exists.

## 5. Cost and performance

| measure | value |
|---|---|
| database size | 27 GB `[V]` |
| indexes in `public` | 3,352, 12 GB `[V]` |
| indexes never scanned (non-unique, non-PK) | 1,227, 1.77 GB `[V]` |
| `idx_gs_entities_embedding` | 2.8 GB, 2 scans `[P]` |
| two vector indexes on `grant_opportunities` | 443 MB, 14 scans between them `[P]` |
| vector columns | 27, including two backup tables carrying embeddings `[V]` |
| backup or staging tables | 31, 213 MB `[V]` |
| performance lints | 1,849: unused_index 1,227; multiple_permissive_policies 305; unindexed FKs 233; auth_rls_initplan 40; no_primary_key 40 `[V]` |
| connections | 120 max, about 30 in use at probe time `[V]`; pooler saturation history in memory `[P]` |

## 6. The grants focus: four front ends, four engines, seventeen tables, dead pipes

**Front ends that render grants or funders** `[V]`:

| surface | pages | what it reads |
|---|---|---|
| CivicGraph public: `/foundations` 11, `/giving` 8, `/charities` 5, `/grants` 2, `/reports` 86, `/search`, `/procurement` | 305 total, 230 API routes | `grant_opportunities`, `foundations`, `gs_*`, `acnc_*` |
| CivicGraph ACT desk: `/org/[slug]/desk`, `/funding`, `/pipeline`, `/goods/grants`, `/goods/foundations`, `/goods/money`, `/payables`, `/people` | 65 | the same plus `ghl_*`, `xero_*`, `org_pipeline`, `act_grant_recommendations_current` |
| JusticeHub: `/find-funding`, `/for-funders/*` (calculator, compare, evidence-gaps, landscape, proof, report), `/funding/*`, `/follow-the-money`, `/funders`, `/atlas/money` | 483 total, 507 API routes, 51 crons | `alma_funding_opportunities`, `funding_*`, `organizations`, `gs_entities`, `foundations`, `justice_funding` |
| Empathy Ledger: `org/[slug]/funding`, `organisations/[id]/funding`, `grants-given`; intelligence APIs grant-matching, funder-portfolio, funding-gap | 381 total, 909 API routes | `gs_entities`, `gs_relationships`, `acnc_ais` directly from the shared DB |
| Notion "Funders & Opportunities" board (122 rows), GHL pipelines, act-global dashboards | | `[P]` funding radar findings |

**Scoring engines** `[G]` (files referencing each):

| identifier | CivicGraph | JusticeHub | Empathy Ledger | act-global |
|---|---|---|---|---|
| `fit_score` | 55 | 5 | 0 | 21 |
| `relevance_score` | 22 | 33 | 4 | 17 |
| `match_score` | 15 | 9 | 4 | 14 |
| `alignment_score` | 13 | 13 | 4 | 0 |
| `goods_relevance_score` | 10 | 1 | 0 | 0 |
| `act_grant_recommendations_current` | 12 | 1 | 0 | 0 |

act-global also runs its own scout (`alta-grant-scout.mjs`) writing `grant_opportunities` and `ghl_opportunities`; JusticeHub
keeps `alma_funding_opportunities` (13,102 rows) as a second opportunities table beside `grant_opportunities` (26,690) `[V]`.

**Tables that model "a fundable thing" or "an ask"** `[V]`: `grant_opportunities` 26,690 · `alma_funding_opportunities` 13,102 ·
`foundations` 11,205 · `act_grant_recommendations_current` 5,995 · `foundation_programs` 4,445 · `saved_grants` 2,736 ·
`ghl_opportunities` 1,131 · `org_pipeline` 125 · `act_grant_recommendation_decisions` 89 · `grant_applications` 33 ·
`opportunity_decisions` 7 · `funding_awards` 5 · `funding_programs` 4 · `funding_sources` 3 · `funder_profiles` 3 ·
`funding_match_recommendations` 3 · `alma_funding_applications` 2.

**Delivery pipes** `[V]`: `grant_notification_outbox` last row 2026-05-15 (771 rows, dead since May). `funding_ghl_handoffs` has
0 rows while `/api/cron/funding-ghl-sync` runs every 15 minutes to sync it; the writer (`lib/services/funding-ghl.ts`) is only
reached when a human pushes a grant to GHL, which has never happened. `act_obligations` 0 rows. The desk digest dies on a
missing `RESEND_API_KEY` in production `[P]`. Agent health over 30 days: `Sync Goods GHL Warmth` 21 ok / 41 failed;
`VIC Grants Gateway (Open)` 6 ok / 50 failed; `Trust Remediation Loop` 38 / 26; `alma/enrich` 17 failed. The registry
holds 185 agents in 14 categories; CLAUDE.md still says 45 in 8.

## 7. Search and recall for charities, philanthropy and brokerage

What exists `[V]`: 17 `search_*` functions, 17 `*_browse` functions, `/api/search/{semantic,universal}`, 27 vector columns,
14 tsvector columns, 27 trigram indexes, and one purpose-built index table, `se_search_index` (social enterprises only:
name, ABN, place, sectors, verification tier, contract counts and value, a tsvector), which is the one browse that runs in
92 ms `[P]`. Every other noun (charity, foundation, grant recipient, donor, supplier, person, place) has its own browse RPC,
its own stats RPC and its own filters. There is no index that answers "show me everything about this ABN or this name across
giving, receiving, contracting, boards and place" in one call; the `/api/data/entity/{abn}` route assembles it per request.

## 8. Recommendations, in order

### Phase 0, this week: close the exposure (one migration, Ben's verb)

`supabase/migrations/20260905120000_close_private_view_and_anon_rebuild_exposure.sql`, **applied 2026-09-05 with `psql -f`**. Post-check: 0 private definer views readable by anon, 0 anon-writable views, 0 anon-or-authenticated rebuild functions, 0 permissive policies left. Re-probe with the publishable key: the seven private views now return 401 `permission denied`; `gs_entities` and `justice_funding_clean` still serve rows as intended. Service-role reads of the same views still work, so the desk is unaffected. It flips
the 15 private definer views to `security_invoker` and revokes anon on them; revokes anon writes on the 48 updatable views and
authenticated writes on the private 31; makes the three rebuild functions service-role only; drops the five `USING (true)`
policies on the GHL, comms, Xero and applications tables. Every ACT reader uses the service role (verified for grantscope,
the command center's 231 server routes, and the sync scripts), so nothing of Ben's breaks. Apply with `psql -f`, then re-run
the four publishable-key probes in the header: they must return 0 rows.

Same week, no SQL: delete `NEXT_PUBLIC_SUPABASE_ANON_KEY` from every `.env` and from Vercel, run `/config-truth` on the
publishable key in production.

### Phase 1, this month: one migrations home

- Baseline once with `supabase db pull` into ONE repo's `supabase/migrations` (grantscope, which the dashboard already names
  as the owner). Every later change is a file in that folder, applied by `supabase db push` or by MCP `apply_migration` from a
  session that commits the file in the same turn. The other five folders become history and get archived, not deleted.
- CI check: `supabase db diff` against live must be empty on main. This is the guard that makes the DB stop being the only
  source of truth.
- Extend `schema_ownership` from 18 rows to every object, seeded from the data map's 14 domains, and add a pre-apply check
  that a migration touches only objects its repo owns or `shared`.
- Generate types once (`supabase gen types`) into a small shared package consumed by grantscope, JusticeHub and Empathy
  Ledger; CI fails on drift.
- Bring the 13 edge functions into the same repo; redeploy the Downloads one from source control.
- Finish the security sweep: the remaining 97 definer views (convert to `security_invoker` unless a documented anon consumer
  needs them), `SET search_path` on the 59 functions, and `ALTER DEFAULT PRIVILEGES ... REVOKE INSERT, UPDATE, DELETE ON
  TABLES FROM anon` so new views stop inheriting write grants.

### Phase 2, this quarter: split private from public

Move data-map domain D14 (237 objects: `xero_*`, `ghl_*`, `linkedin_*`, `communications_*`, `email_*`, receipts,
`project_knowledge`, iMessage, voice notes, calendar) to its own project. The org already has two candidates by name
(Knight Finances, ACT Farmhand). After the move the civic project has one rule that every reader can hold in their head:
**public read, service-role write, nothing private in the project.** Today's leak class becomes impossible rather than patched.

The `/org/act/*` desk becomes the one app holding two clients, which is the shape Empathy Ledger already has for CivicGraph.
Cross-links stay on ABN and `gs_id`; the desk reads civic evidence through the same RPCs the public site uses.

In the same pass: drop the near-empty Empathy Ledger schema duplicate (D12) after confirming Harvest reads stories from the EL
project; delete the 31 backup tables and the 1,227 never-scanned indexes in tranches with a 30-day `pg_stat_user_indexes`
watch; decide the 2.8 GB entity embedding index as a product question, per the 2026-08-30 finding.

### Phase 3: named SQL instead of strings

Every `exec_sql` string in `apps/web` becomes a named `security_invoker` view or a typed RPC in the migrations repo, called
through the generated types. Order by database time: `app/api/data` (22 files) and `reports/youth-justice` (13) first. Keep
`exec_sql` for scripts and agents only; target zero call sites in the app. Move the 252 `force-dynamic` routes to ISR with
`revalidate` wherever the data is nightly anyway (the matviews refresh at 17:00 UTC). Fold `report-supabase.ts` into the main
client once no page reads a snapshot.

### Phase 4: one search index over the spine

Generalise `se_search_index` into `search_index(kind, id, abn, name, aliases, place, sector, money_given, money_received,
contract_value, board_count, verification_tier, tsv)` for kinds charity · foundation · grant round · supplier · person · place
· program, refreshed nightly, one RPC `search(q, kinds[], filters)` on trigram plus tsvector, semantic optional behind it.
Pre-compute the facets in the row, never at query time (the RPC-generic-plan lesson). The 17 `search_*` functions become
wrappers, then go. This is the answer to "charities, philanthropy, brokerage: easy to search".

### Phase 5: one grants front end, one engine, GHL owns the Ask

- CivicGraph is the grants and funders product. JusticeHub's `/find-funding`, `/for-funders/*` and `/funding/*` and Empathy
  Ledger's funding pages read CivicGraph RPCs or `/api/data`, not `gs_*` tables with their own SQL. Freeze "direct reads of
  `gs_*` from another repo" as a lint.
- Merge `alma_funding_opportunities` into `grant_opportunities` with a `lens`/`topics` tag, or make it a view over it.
- One scorer: `act_grant_recommendations_current` and `fit_score` in CivicGraph. Retire JusticeHub `relevance_score`,
  `funding_match_recommendations` (3 rows), and act-global `alta-grant-scout`. Fix the Goods gravity by ranking on org fit
  rather than `goods_relevance_score` (the funding radar finding).
- Archive the eight sub-ten-row funding tables; ADRs 0001 to 0004 already say Asks and People live in GHL, Obligations and
  Communities in Supabase.
- Wire the desk's "pursue" to `funding_ghl_handoffs` (the minting path) or delete the 15-minute cron. Retire
  `grant_notification_outbox`. Fix the Resend key. Disable the two agents failing more than they succeed.
- Harvest and Goods get a per-org desk in `/org/[slug]`, which already exists for ACT, rather than their own funding pages.

## 9. What not to do

- Do not split JusticeHub from CivicGraph's project. They share the civic corpus legitimately; the split that matters is
  private versus public.
- Do not add an eighteenth funding table, a fifth scorer, or a new definer view before Phases 1 and 2.
- Do not rebuild the front ends. The 305 + 483 + 381 pages are mostly fine; the duplication is in the data access under them.
- Do not test the write path through the definer views on production to "confirm" it. Apply Phase 0 instead.

## Provenance

Live project queried with `scripts/gsql.mjs` (service role, `exec_sql`) against `pg_class`, `pg_policy`, `pg_proc`,
`pg_depend`, `pg_stat_statements`, `pg_stat_user_indexes`, `supabase_migrations.schema_migrations`, `auth.users`,
`storage.buckets`, `cron.job`, and row counts on the named tables. Advisor dumps from the Supabase MCP (`get_advisors`,
security 573 KB, performance 1.3 MB) aggregated by lint name with Python. REST probes with the project's publishable key
against `/rest/v1/*`, capturing HTTP status, row count and column names only. Repo counts from `grep -rl` over
`apps/web/src`, `scripts`, and the sibling repos' `src`, `scripts`, `supabase/migrations`. Prior findings cited:
`thoughts/shared/data-map/README.md` (2026-08-14), `thoughts/shared/findings/schema-ownership-index-impact-2026-08-30.md`,
`thoughts/shared/findings/act-funding-radar-2026-08-29.md`, `docs/adr/0001` to `0004`. A DB password appeared in one env
listing during the session and was not recorded anywhere.
