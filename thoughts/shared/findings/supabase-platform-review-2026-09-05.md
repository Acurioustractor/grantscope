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

## 10. Phase 1 progress (started 2026-09-05, same session)

**Done and live**

- **One migrations home.** `supabase/migrations/20260905130000_baseline_remote_schema.sql` is the live schema dumped with
  `supabase db dump --linked` (pg_dump 17 in the CLI's container; local pg_dump 16 refuses the server): 3.45 MB, 774 tables,
  460 functions, 714 policies. The 312 files of `supabase/migrations` and the 84 of `migrations/` moved to
  `supabase/migrations_history/` with a `RESTORE.md`, alongside a snapshot of the tracker as it stood (419 versions) `[V]`.
  The baseline is recorded in `supabase_migrations.schema_migrations` as `20260905130000`.
- **One apply path.** `scripts/db-apply.sh <file>` runs the file with `psql -v ON_ERROR_STOP=1`, refuses anything outside the
  folder, refuses a version already in the tracker, and writes the version into the tracker on success. `supabase db push` is
  deliberately not used: it refuses to run while the tracker holds the 419 pre-baseline versions, and resetting those would
  erase the only record of the 313 orphans.
- **Parity check.** `scripts/check-migration-parity.mjs` fails when the tracker holds a post-baseline version with no file
  (applied and never committed) and reports unapplied drafts as pending (`--strict` fails on those too, for CI on main).
  Verified against live: 421 tracker versions, 419 pre-baseline, drafts listed, exit 0 `[V]`.
- **Generated types** for the whole project in `supabase/types/database.types.ts` (69,270 lines) `[V]`.
- **Edge functions** in `supabase/functions/`: 12 of 13 downloaded from the project; `newsletter-subscribe` was listed ACTIVE (v35) at the
  start of the review but both the CLI download and the MCP reader now return 404, and no local source exists in any sibling
  repo; if it is still deployed, its only copy is the deployed bundle `[V]`.
- **Two more exposures closed with the new apply path** (both verified 401 for the publishable key afterwards, service-role
  reads unchanged): `v_project_funding_position` (12 rows of committed amounts by funder) and `v_project_pipeline_totals`
  (30 rows) in `20260905143000`; the seven `v_goods_*` relationship-intelligence views (warm intros with persons and roles,
  power scores, foundation targets; 459 + 2,085 + 1,543 + 475 + 141 + 104 + 102 rows) in `20260905144000`. Every reader of
  these is a service-role server path `[V]`.
- **Convention written down** in `supabase/migrations/README.md` and CLAUDE.md Rule #1; comment paths in
  `refresh-views-v2.mjs`, `grantee-migration.mjs` and the scan list in `scan-clarity-code-refs.mjs` updated.

**Applied 2026-09-05 on Ben's verb, with two corrections found by the apply itself**

| file | what | risk |
|---|---|---|
| `20260905140000_schema_ownership_seed.sql` | one `schema_ownership` row per public relation (owner, consumers, evidence with the rule used); widens the owner CHECK to add act, empathy-ledger, harvest, studio; keeps the 18 declared owners; fixes `justice_funding` consumers. Generated by `scripts/build-schema-ownership-seed.mjs --siblings ~/Code`, re-runnable. First attempt rolled back because `consumers` is `text[]` and the generator wrote a comma string; fixed to an array literal. Result on 2026-09-05: 1,000 relations, owners grantscope 359 · justicehub 255 · act 235 · unknown 103 · empathy-ledger 20 · studio 14 · harvest 8 · shared 6; rules prefix 573 · sole creator 244 · no evidence 67 · sole consumer 62 · consumers disagree 34 · declared 18 · creators disagree 2. | none to behaviour; rows are a register |
| `20260905141000_definer_views_security_invoker_flip_safe.sql` | **tightened from 63 to 48 before applying**: re-measured by policy CONTENT (a base is open to a role only if a permissive read policy is literally `true`), 15 views over filtering bases (`assertions`, `civic_org_classifications`, `alma_interventions`, `outcome_submissions`, `social_posts`, `harvest_events`, `clarity_object`, `catalog_object_scope`, `schema_ownership`, `api_pricing`/`llm_usage`) were excluded and join the decision list. Applied; anon probe of all 48 before and after: 46 identical, 2 improved from HTTP 500 to rows (`v_act_procurement_buyers`, `v_ndis_registered_provider_graph_match`), none lost. 40 definer views remain. | applied |
| `20260905142000_function_search_path.sql` | pins `search_path = public, extensions, pg_temp` on the 59 flagged functions. First attempt rolled back on `refresh_civicgraph_mvs_run(text)`, a PROCEDURE; regenerated from `prokind`. Applied; 0 still mutable; `search_entities_fuzzy`, `search_entities_prefix_fast`, `mv_refresh_plan` smoke-tested | applied |

**Still a decision: 33 definer views that cannot flip neutrally, plus the 15 excluded from the flip above** (a base table lacks an anon or authenticated read policy,
so flipping would remove today's public read). Four groups:

- ACT/Goods private, now closed above: `v_project_funding_position`, `v_project_pipeline_totals`, the seven `v_goods_*`.
- ACT finance aggregates already 0 rows for anon since Phase 0 (they sit over the flipped private views): `v_act_expense_by_payee`,
  `v_act_expense_by_project`, `v_act_income_by_funder`, `v_act_income_by_project`, `v_funder_next_move`. Revoke anon anyway.
- Public civic reads that depend on definer semantics because the base lacks an anon policy: `v_charity_detail`,
  `v_charity_explorer`, `v_lga_place_profile`, `v_org_funding_profile` (609,411 rows), `org_governance` (339,086),
  `v_state_ecosystem_summary`, `v_chain_summary`, `v_grant_place_capture`, `v_harvest_public_stories`,
  `v_harvest_public_social_posts`, `v_prf_portfolio_outcomes`. Either keep definer and record why in `schema_ownership`, or add
  anon read policies to the bases and flip. JusticeHub reads several with the anon client.
- JusticeHub-owned or ops: `jr_site_front_door`, `v_funding_pipeline` (alma opportunities + applications, 12,877 rows),
  `v_funding_award_community_accountability`, `v_governed_proof_hot_lane`, `v_governed_proof_density_summary`,
  `v_data_catalog_latest`, `v_data_health`, `v_mv_refresh_drift`. JusticeHub decides the first four; the ops three should
  lose anon.

Full verdict table:

| view | anon reads today | authenticated reads today | why flipping is not neutral |
|---|---|---|---|
| `jr_site_front_door` | yes | yes | base lacks anon read policy or grant |
| `org_governance` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_act_expense_by_payee` | yes | yes | base lacks anon read policy or grant |
| `v_act_expense_by_project` | yes | yes | base lacks anon read policy or grant |
| `v_act_income_by_funder` | yes | yes | base lacks anon read policy or grant |
| `v_act_income_by_project` | yes | yes | base lacks anon read policy or grant |
| `v_chain_summary` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_charity_detail` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_charity_explorer` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_data_catalog_latest` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_data_health` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_funder_next_move` | yes | yes | base lacks anon read policy or grant |
| `v_funding_award_community_accountability` | yes | yes | base lacks anon read policy or grant |
| `v_funding_pipeline` | yes | yes | base lacks anon read policy or grant |
| `v_goods_central_channels` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_community_priority` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_foundation_targets` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_life_events` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_relationship_funding` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_relationship_power` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_goods_warm_intros` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_governed_proof_density_summary` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_governed_proof_hot_lane` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_grant_place_capture` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_harvest_public_social_posts` | yes | yes | base lacks anon read policy or grant |
| `v_harvest_public_stories` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_lga_place_profile` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_mv_refresh_drift` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_org_funding_profile` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_prf_portfolio_outcomes` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_project_funding_position` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_project_pipeline_totals` | yes | yes | base lacks anon and authenticated read policy or grant |
| `v_state_ecosystem_summary` | yes | yes | base lacks anon and authenticated read policy or grant |

**Default privileges, measured, no change needed for postgres-created objects.** `pg_default_acl` for role `postgres` in
`public` grants tables to `postgres` and `agent_readonly` only; the anon/authenticated ALL defaults exist only for objects
created by `supabase_admin`, which nothing here uses. The 48 anon-writable views were explicit historical grants, now revoked.
`ALTER DEFAULT PRIVILEGES` for `supabase_admin` needs that role and is not worth the ceremony.

**Not started in Phase 1:** the shared types package consumed by JusticeHub and Empathy Ledger (CivicGraph has the file;
wiring `Database` into the clients is Phase 3 work), and the CI job for `check-migration-parity.mjs --strict` (CI has no
service-role secret today; only the legacy anon key, which is dead).

**Legibility slice (same day, after the applies).** `/ops/schema` renders the register live: one row per relation with
owner, consumers, size, kind, definer flag and whether the public key can read it, and a red count of private objects
readable by anon (must be 0). `scripts/classify-changes.sh` no longer counts a symlinked `node_modules` as a changed
file (two false VISIBLE verdicts on 2026-09-05). CI gains a `Migration Parity` job that runs `check-migration-parity.mjs`
(`--strict` on main) once `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist as repo secrets, and warns until then.
`/preflight` runs the parity check. `20260905150000_act_finance_aggregate_views_anon_revoke.sql` is drafted for the five
ACT finance aggregates that still carry definer + anon grants (0 rows today, wrong shape). PR #408 (three server actions
reading the connection through `supabase-env`) waits for a preview check of the feedback, get-a-report and partner forms.

**What the register page measured on its first run.** By RLS state, 42 private-owner objects are open to the public key:
33 tables with a permissive anon policy, 1 matview, 8 definer views. 36 are meant to be: consent- and approval-gated
publishing rows (Empathy Ledger stories, quotes, storytellers with consent; Harvest approved businesses and events; studio
approved media and reviews; ACT's public key-people and PMPP knowledge). The remaining six are ACT context or ops with a
plain "Public read" policy or a bare matview grant, closed by `20260905151000_act_context_tables_anon_revoke.sql`, and
the five ACT finance definer views by `20260905150000`, both applied 2026-09-05 on Ben's verb; the register's open-private
count went from 42 to 31, all 31 consent-gated publishing rows by design. The same day the ACT Context block was re-synced
into seven repos with a "Shared Supabase project" section carrying the six rules (the sync template had fallen behind the
downstream copies and would have dropped the 19 July Harvest decision; fixed on act-global branch `sync/shared-supabase-rules`). Grant alone is not exposure: 288 objects carry an anon
SELECT grant that RLS blocks, 140 of them private; the page shows those as "grant, RLS blocks", never red.

## 11. Phase 4 progress (started 2026-09-05, on "do all")

**One search index over the spine, first slice.** `mv_search_index` (`supabase/migrations/20260905160000`) folds every
public noun into one row shape: kind, id, name, ABN, state, place, sector, money in and out (from the already-audited
`mv_entity_total_funding` and `foundations.total_giving_annual`, whose placeholder nature the tier column discloses), tier,
a one-line meta and the app href. Sources: `gs_entities` (charity, company, indigenous_corp, government_body, program),
`se_search_index` (social enterprises with contracts), `foundations`, open `grant_opportunities`, `mv_board_interlocks`
(people), `mv_funding_by_lga` (council areas, slugged the way `placeSlug()` does), published `alma_interventions`. Private
objects are excluded by construction. Unique `(kind, id)` for concurrent refresh, trigram and tsvector GIN indexes,
nightly via `mv_refresh_registry`; `mv_entity_total_funding` promoted from `on_demand` to `nightly` because it feeds it.

`search_index_query(q, kinds[], state, limit)` is the one RPC (definer, public civic data, executable by anon): exact and
prefix name matches first, then trigram similarity plus tsvector rank, ABN when the query is eleven digits. The app fronts
it with `/api/search/index` and `lib/search/search-index.ts` (input whitelist, tested). The `/search` page moves onto it
in its own PR because it is a public surface.

Three more builds the same afternoon (`20260905162000`, `163000`, `164000`): structured `source_count`, `closes_at`,
`amount_min` and `postcode` columns; a twelfth kind, one row per postcode with an ABS-style locality label (3,243 rows);
ranking by the greatest applicable bonus (the first-branch CASE let "0870 Charles" take the prefix bonus over the
postcode-row bonus). Each rebuild is about thirteen seconds. Two unique-index rollbacks taught two grain facts:
`mv_funding_by_lga` is not one row per council (case and whitespace variants), and `mv_gs_entity_stats` is not one row per
entity. `/api/global-search`, the live lanes behind the header box and `/search`, now makes one call to the RPC instead
of five separate lanes; the client is unchanged. Council-area rows have no lane in that client yet.

Still to do in Phase 4: aliases from `gs_entity_aliases`, a council lane in the search client, retiring the 17 `search_*`
functions to wrappers, and the semantic path behind the lexical one.

## 12. Phase 5 progress (started 2026-09-05)

Phase 5 was framed as consolidating four grant front ends and four scorers. Measuring first moved the priority: the
grants **intake** had a reproducible bug, and the duplication is smaller and more mechanical than the review assumed.

### The one that was actually broken

`grant_opportunities` carries THREE unique indexes and the ingest agents target one each:

| index | agents targeting it |
|---|---|
| `grant_opportunities_url_idx` (url) | `sync-austender-open-tenders` |
| `grant_opportunities_source_name_full_uniq` (source, name) | `ingest-grantconnect-go`, `ingest-vic-grants-open`, `sync-foundation-programs` |
| `idx_grant_opp_name_source_id` (name, source_id) | five importers |

`ON CONFLICT` resolves exactly the index it names, so an agent that targets one key still raises a duplicate-key error
on either of the others. **"VIC Grants Gateway (Open)" failed 51 of 57 nightly runs** on the url index: those Victorian
grants had been ingested earlier under the source label "Victorian Government / Regional Development VIC" and kept their
URLs, so the (source, name) upsert tried to INSERT and hit the url index `[V]`.

Switching the conflict target to `url` was tried and moved the failure rather than fixing it: a re-published grant
arrives with a new URL under a name already taken, which then violates (source, name). Measured on the live source:
29 of 30 rows written, one failure of the mirror-image kind.

`scripts/lib/upsert-grant-opportunities.mjs` is now the one write path. It de-duplicates inside the batch, resolves each
row against the table by url and by (source, name) in bulk, then writes **by primary key**, so no unique index is ever
crossed. A row that resolves to two different existing rows is a genuine duplicate pair already in the table; it is
reported, not guessed at, because merging them is a human call. Chunked, with row-by-row retry so one bad row cannot
cost the run, and failures returned rather than thrown so the agent logs a partial.

Proven on the live source, in `agent_runs`:

| run | result |
|---|---|
| 02:01, old code | `failed`, 0 rows |
| 08:10, url-key attempt | 30 found, 29 written, 1 duplicate-key error |
| 08:14, resolve-then-write | 30 found, **30 written, no errors** |

### Two corrections to what the run log looks like it says

- **`timed_out` is not a timeout.** `scripts/scheduler.mjs` has a janitor (`cleanupStaleRuns`) that marks any run still
  `running` after four hours as `timed_out`. 227 of the last 30 days' runs carry it, including 71 for the nightly grant
  orchestrator. It means the process was interrupted (or crashed before logging completion), not that the agent failed.
  The orchestrator's registry timeout is already 60 minutes, so the scheduler is not killing it.
- **"Sync Foundation Programs" is not failing.** It is marked `partial` because of embedding errors (560 in the latest
  run) while its ingest works: 936 found, 42 new. Counting `partial` as failure overstated the breakage. The embedding
  errors are a separate, unexamined problem.

### The duplication, measured

`alma_funding_opportunities` (13,102 rows) is **99.5% a copy**: 6,642 rows are `promotion-from-grant_opportunities` and
6,402 are `promotion-from-foundation-programs`, leaving 58 rows of its own (26 unlabelled, 21 a manual seed, 9 from an
oracle research run, 2 smoke-test rows) `[V]`. Merging it is therefore a view or a promotion job, not a data migration.

`grant_opportunities` itself is dominated by two sources: `brisbane-grants` 12,271 and `arc-grants` 5,598 of 26,695
(75% between them), so "22,691 open grant rounds" is mostly Brisbane City Council and ARC research grants. That is a
number to qualify before putting it on a public surface.

The pipeline tables the review flagged as near-empty are confirmed: `funding_ghl_handoffs` 0, `opportunity_decisions` 7,
`funding_awards` 5, `funding_programs` 4, `funding_match_recommendations` 3, `funding_sources` 3,
`alma_funding_applications` 2. `grant_notification_outbox` holds 771 rows and has not been written to since 15 May.

### Next in Phase 5

Point the other `source,name` agents at the shared contract; decide whether `idx_grant_opp_name_source_id` earns its
place; make `alma_funding_opportunities` a view over the two tables it is promoted from; then the front-end and scorer
consolidation the review describes.
