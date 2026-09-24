# Follow-up reader: one-pool row contract

Date 2026-09-24. Repo /Users/benknight/Code/grantscope, branch feat/act-money-desk, read-only. Every number below was run today
with `node --env-file=.env scripts/gsql.mjs "<sql>"` unless marked inferred/unverified. Companion: critic.md §3.C,
grant-data-model.md §3 and §6, desk-surfaces.md §2-3. The runnable contract SQL is also at `row-contract.sql` in this directory.

## 0. The answer in one paragraph

`v_funding_opportunities` is not the source for the one place. Its `is_open` is `closes_at IS NULL OR closes_at >= CURRENT_DATE`
with **no status test**, so 24,771 of its 26,903 grant rows are "open", of which **18,886 carry status `closed`** and 2,287 `NULL`.
It carries none of the fit, tag, eligibility, place or GHL columns, and it is granted to `authenticated` (anyone who signs up), so
the 619 live private SmartyGrants rounds can never be unioned into it. `mv_search_index` has the same closes_at-only rule
(18,948 closed-status rows are served as `grant_round`) and excludes private rounds by construction. The hybrid RPC behind
`/funding` scores nothing but the ALMA recommendation: on a live run for Goods and for JusticeHub every one of the 83 rows returned
had `lexical_score = 0` and `semantic_score = 0`, because no project profile has an embedding (0 of 14) and the lexical query ANDs
the whole profile text (729 tsquery nodes for Goods). It cross-joins `alma_funding_opportunities` and dies with the ALMA lane.
**The one source that can return the whole row contract today is `grant_opportunities` (status live, not past close) UNION ALL
`act_private_grant_rounds` (same rule), read with the service role**, which is exactly what `act-grants-desk.ts:128-142` already
does. The SQL in §6 returns the contract from that source: 3,781 grant rows × 6 projects. What is missing is not a column
but data: Jev fit on 356 of 3,162 live public rows and 0 private; eligibility known on 303; `tagged_by` on 3-5 rows per project.

## 1. `v_funding_opportunities`: the exact definition

Source of truth: `pg_get_viewdef('v_funding_opportunities'::regclass, true)` (verified, 6,189 chars) and the migrations
`supabase/migrations/20260905180000_v_funding_opportunities.sql` (179 lines, header L1-27 states intent) and
`20260905181000_v_funding_opportunities_dedupe_by_name.sql` (146 lines, L1-9). Both read.

### 1.1 Shape

Five CTEs, one final SELECT:

| CTE | source | filter | notes |
|---|---|---|---|
| `alma_enrichment` | `alma_funding_opportunities` | `name IS NOT NULL` | `DISTINCT ON (lower(trim(name)))` ordered `updated_at DESC NULLS LAST, created_at DESC NULLS LAST`; carries `verification_status, opportunity_type, is_national, jurisdictions, eligible_org_types, requires_deductible_gift_recipient AS requires_dgr` |
| `rounds` | `grant_opportunities g LEFT JOIN foundations f ON f.id = g.foundation_id` | **none** | `funder = coalesce(g.provider, f.name)`, `closes_at = coalesce(g.closes_at, g.deadline)`, `href = '/grants/' || g.id` |
| `programs` | `foundation_programs p LEFT JOIN foundations f` | not promoted (`NOT EXISTS g.source='foundation_program' AND g.source_id = p.id::text`) AND no GO row with the same `lower(trim(name))` | `source = 'foundation_program'`, `grant_type = p.program_type`, `updated_at = p.scraped_at`, `href = '/foundations/' || foundation_id` |
| `alma_native` | `alma_funding_opportunities a` | `coalesce(scrape_source,'') NOT IN ('promotion-from-grant_opportunities','promotion-from-foundation-programs')` AND no GO and no FP with the same name | `url = coalesce(application_url, source_url)`, `categories NULL`, `foundation_id NULL`, `href NULL` |
| `unified` | UNION ALL of the three | | 17 columns |

Final SELECT adds:
- `opportunity_key = origin || ':' || origin_id`, e.g. `grant_opportunities:8da81910-…`, `foundation_programs:<uuid>`, `alma_funding_opportunities:<uuid>`.
- **`is_open = closes_at IS NULL OR closes_at >= CURRENT_DATE`**. That is the whole test. `grant_opportunities.status` is not read anywhere in the view.
- `LEFT JOIN alma_enrichment e ON e.name_key = lower(trim(u.name))` → `verification_status, alma_opportunity_type, is_national, jurisdictions, eligible_org_types, requires_dgr, in_alma = e.name_key IS NOT NULL`.
- `WHERE u.name IS NOT NULL AND length(trim(u.name)) > 1`.

26 output columns (critic already listed them). `security_invoker = true` (reloptions), granted `agent_readonly=r, authenticated=r, service_role=r`, no anon:

```sql
SELECT c.relname, c.relkind, c.relrowsecurity AS rls, array_to_string(c.relacl,' | ') AS acl, (SELECT string_agg(option_value,',') FROM pg_options_to_table(c.reloptions)) AS opts
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('v_funding_opportunities','act_private_grant_rounds','grant_opportunities','mv_search_index','alma_funding_opportunities','project_funding_profiles')
-- act_private_grant_rounds   r  rls=true   postgres | agent_readonly=r | service_role=arwd
-- alma_funding_opportunities r  rls=true   anon=arwdDxtm | authenticated=arwdDxtm | service_role | agent_readonly=r
-- grant_opportunities        r  rls=true   anon=arwdDxtm | authenticated=arwdDxtm | service_role | agent_readonly=r   (autovacuum opts 0.02,0.05)
-- mv_search_index            m  rls=false  agent_readonly=r | service_role=r
-- project_funding_profiles   r  rls=true   agent_readonly=r | authenticated=r | service_role=arwd
-- v_funding_opportunities    v  rls=false  agent_readonly=r | authenticated=r | service_role=r   opts=security_invoker true
```

### 1.2 Measured, by origin

```sql
SELECT origin, count(*) AS n, count(*) FILTER (WHERE is_open) AS open, count(*) FILTER (WHERE closes_at IS NOT NULL) AS dated,
  count(*) FILTER (WHERE is_open AND closes_at IS NOT NULL) AS open_dated, count(*) FILTER (WHERE in_alma) AS in_alma,
  count(*) FILTER (WHERE requires_dgr IS NOT NULL) AS dgr_known, count(*) FILTER (WHERE cardinality(eligible_org_types) > 0) AS org_types_known,
  count(*) FILTER (WHERE cardinality(jurisdictions) > 0) AS juris_known, count(*) FILTER (WHERE amount_max > 0 OR amount_min > 0) AS with_amount,
  count(*) FILTER (WHERE url IS NOT NULL) AS with_url
FROM v_funding_opportunities GROUP BY origin ORDER BY n DESC
```
| origin | n | open | dated | open_dated | in_alma | dgr_known | org_types_known | juris_known | with_amount | with_url |
|---|---|---|---|---|---|---|---|---|---|---|
| grant_opportunities | 26,903 | 24,771 | 2,464 | 332 | 2,960 | 2,960 | 165 | 137 | 24,048 | 25,697 |
| foundation_programs | 2,602 | 2,445 | 174 | 17 | 224 | 224 | 3 | 2 | 280 | 2,373 |
| alma_funding_opportunities | 58 | 39 | 26 | 7 | 58 | 58 | 32 | 32 | 30 | 32 |

Total 29,563 (matches the brief), 27,255 `is_open`.

**What `is_open` actually admits** (the view row joined back to its source row):
```sql
SELECT coalesce(g.status,'<null>') AS go_status, count(*) AS n, count(*) FILTER (WHERE v.closes_at IS NOT NULL) AS dated
FROM v_funding_opportunities v JOIN grant_opportunities g ON g.id::text = v.origin_id
WHERE v.origin='grant_opportunities' AND v.is_open GROUP BY 1 ORDER BY n DESC
-- closed 18,886 (4 dated) · open 2,950 (319) · <null> 2,287 (1) · unknown 395 (8) · ongoing 207 · duplicate 38 · upcoming 5 · pending 2 · archived 1
```
So of 24,771 "open" grant rows, **3,162 are live by the desk's definition** (`open`+`ongoing`+`upcoming`) and 21,609 are not. The view's
`openOnly` in `apps/web/src/lib/funding/opportunities.ts:62` (`q.eq('is_open', true)`) and the API `?open=1`
(`apps/web/src/app/api/data/funding-opportunities/route.ts:19`) both inherit this. That route has no auth check and uses
`getServiceSupabase()` (`opportunities.ts:59`), so it is anonymous-capable and cached 300s (`route.ts:34`); its header L8-10 names
JusticeHub, Empathy Ledger and act-global as intended consumers. `table-readers.generated.json:2409-2411` lists
`lib/funding/opportunities.ts` as the only in-app reader, and a grep over `apps/web/src` finds only that route importing it (verified).

**What `requires_dgr` means on the view:**
```sql
SELECT requires_dgr, in_alma, count(*) FROM v_funding_opportunities WHERE is_open GROUP BY 1,2 ORDER BY 3 DESC
-- NULL/false 24,277 · false/true 2,976 · true/true 2
```
It is ALMA's `requires_deductible_gift_recipient`, false on 2,976 of the 2,978 rows that have it. That is a column default riding
along by name match, not a recorded fact; the desk's `dgr_required` (7 live rows set, all deliberate) is the honest one.

### 1.3 ALMA enrichment is joined by name, and the name space is inflated

`e.name_key = lower(trim(u.name))`, DISTINCT ON latest `updated_at`. grant-data-model §6.2 measured the ALMA table at 23,705 rows over
3,300 distinct (name, funder) pairs with up to 37 copies of one round. The DISTINCT ON protects the view from fan-out (verified: 26,903
GO rows in, 26,903 out), but it means the enrichment on a canonical row is whichever copy was touched last, and 2,960 of 26,903 grant
rows match at all.

### 1.4 View change or model change, column by column

| wanted column | where it lives today | adding it to the view is… |
|---|---|---|
| `project_relevance` (jsonb, keyword+rubric per project slug) | `grant_opportunities.project_relevance` (26,827 rows scored 2026-09-20; live 3,104; rubric_meta on 356) | **view change** for a jsonb passthrough (`CREATE OR REPLACE VIEW` may append columns at the end; the FP and ALMA branches supply `NULL::jsonb`). A **model change** if the desk wants it as typed columns: the row grain is "one fundable thing", fit is per (thing, project); six `fit_*` columns or a separate `(grant_id, project_code)` fit table |
| `aligned_projects` | `grant_opportunities.aligned_projects text[]` (+ `act_private_grant_rounds.aligned_projects`) | view change (append, NULL on other origins) |
| `goods_relevance_score` (+ `goods_relevance_signals.tagged_by`) | both tables | view change (append) |
| `dgr_required`, `accepts_pty_ltd` (also `accepts_charity`, `accepts_sole_trader`, `accepts_unincorporated`, `eligibility_confidence`, `eligibility_summary`, `eligibility_provider`) | `grant_opportunities` only; live coverage dgr 7, pty 300, charity 108, sole trader 39, unincorporated 37, `eligibility_signals_at` 397, `eligibility_criteria` non-empty 189, `eligibility_summary` 0 | view change (append). Name clash with the existing `requires_dgr` (ALMA default false) must be resolved: keep both and label, or drop the ALMA one |
| `ghl_opportunity_id` | `grant_opportunities.ghl_opportunity_id` (725 rows, 703 distinct, 114 live); `act_grant_recommendation_decisions.ghl_opportunity_id` (0 of 89 set); `funding_ghl_handoffs` (0 rows) | view change (append). Semantics need a decision, see §7 |
| `status` (so `is_open` can mean live) | `grant_opportunities.status` | **view change but a semantic change for the API**: `is_open` for the GO origin would go from 24,771 to 3,162 rows. `foundation_programs` has `status` and `deadline` columns (verified `information_schema`) but the view does not read `status`; ALMA rows use `deadline` only |
| `place` | `grant_opportunities.metadata->'place'` (6 rows total, 1 live) and `geography` (2,976 live); `act_private_grant_rounds.metadata->'place'` (617 of 619 live) | view change (append `geography`, `metadata->'place'`) |
| UNION of `act_private_grant_rounds` | own table, RLS on, no policies, `service_role` only (`20260914170000` L18-28, `20260914190000` L8) | **not a view change: a security-boundary change.** The view is `security_invoker` and granted to `authenticated`; a union would either leak the private rows to every signed-up user or (under RLS with no policies) silently return zero private rows for everyone but service role. Migration `20260914170000` L2-6 moved these rows OUT of `grant_opportunities` precisely because "v_funding_opportunities and mv_search_index read the table" and "signup is open so authenticated is anyone" |

Conclusion: the columns are a view change; the private lane and the per-project grain are model decisions. A view that carries the
private rows must be a second, service-role-only object (`v_act_funding_pool` or a function), which is what §6 is.

## 2. `mv_search_index` and `search_index_query`

`pg_get_viewdef('mv_search_index'::regclass, true)` substr 3000-6400 read (verified). The `grants` CTE:
```sql
SELECT 'grant_round' AS kind, g.id::text AS id, g.name, NULL abn, NULL state, NULL place,
       array_to_string(g.categories, ', ') AS sector, g.amount_max::numeric AS money_in, NULL money_out,
       g.application_status AS tier,
       NULLIF(concat_ws(' · ', g.provider, CASE WHEN g.closes_at IS NOT NULL THEN 'closes ' || to_char(g.closes_at, 'DD Mon YYYY') END), '') AS meta,
       '/grants/' || g.id AS href, NULL source_count, g.closes_at, g.amount_min::numeric, NULL postcode
FROM grant_opportunities g
WHERE g.closes_at IS NULL OR g.closes_at >= CURRENT_DATE
```
Same source text in `supabase/migrations/20260922210000_entity_stats_share_positive_only.sql:230-245` (the latest rebuild), and the
original `20260905160000_mv_search_index.sql` header L1-13 says "open grant round" and L13: "Private data is excluded by construction:
no ACT, Goods, GHL, Xero or Empathy Ledger object is a source."

Which grant rows are excluded and why:
```sql
SELECT 'go_total', count(*) FROM grant_opportunities                                                     -- 26,903
UNION ALL SELECT 'go_closes_at_past', count(*) FROM grant_opportunities WHERE closes_at < CURRENT_DATE     -- 2,063
UNION ALL SELECT 'go_closes_at_null_or_future', count(*) ... WHERE closes_at IS NULL OR closes_at >= CURRENT_DATE  -- 24,840
UNION ALL SELECT 'go_name_null_or_short', count(*) ... WHERE name IS NULL OR length(trim(name)) <= 1      -- 0
UNION ALL SELECT 'msi_grant_round', count(*) FROM mv_search_index WHERE kind='grant_round'                -- 24,831
UNION ALL SELECT 'go_deadline_past_closes_null', count(*) ... WHERE closes_at IS NULL AND deadline < CURRENT_DATE  -- 69
UNION ALL SELECT 'go_status_closed_but_in_msi_window', count(*) ... WHERE (closes_at IS NULL OR closes_at >= CURRENT_DATE) AND status NOT IN ('open','ongoing','upcoming')  -- 19,391
UNION ALL SELECT 'go_status_null_in_msi_window', count(*) ... WHERE (closes_at IS NULL OR closes_at >= CURRENT_DATE) AND status IS NULL  -- 2,287
SELECT max(built_at) FROM mv_search_index   -- 2026-09-23 17:13:22+00
```
So the 2,072 missing = **2,063 rows whose `closes_at` is before today** + 9 rows of drift between the 23 Sep 17:13 build and now
(24,840 qualify now vs 24,831 built). The branch reads `closes_at` only, never `deadline` (69 rows have a past `deadline` and null
`closes_at` and are still indexed). And, like the view, it has no status test:
```sql
SELECT coalesce(g.status,'<null>'), count(*) FROM mv_search_index s JOIN grant_opportunities g ON g.id::text = s.id WHERE s.kind='grant_round' GROUP BY 1 ORDER BY 2 DESC
-- closed 18,948 · open 2,948 · <null> 2,287 · unknown 395 · ongoing 207 · duplicate 38 · upcoming 5 · pending 2 · archived 1
```
**18,948 of 24,831 "open grant rounds" in site search have status `closed`.** `tier` carries `application_status`, which on live rows is
`open 2,868 / not_applied 179 / ongoing 111 / reviewing 2 / monitor 1 / upcoming 1`, so a reader could filter on it but the RPC does not.

`search_index_query(q, kinds[], p_state, p_limit)` (`pg_get_functiondef`, verified): SECURITY DEFINER, `plan_cache_mode force_custom_plan`,
executable by anon/authenticated/service_role; predicate `s.name % q OR s.tsv @@ websearch_to_tsquery('simple', q) OR abn OR postcode`;
score = greatest(exact 3.0, prefix 2.0, abn 3.0, own-postcode 3.5, postcode 2.5) + similarity + ts_rank; `ORDER BY score DESC,
money_in DESC NULLS LAST, name`; limit ≤ 100. For grant rows `money_in = amount_max`, so ties break toward the biggest grant. It returns
`kind, id, name, abn, state, place, sector, money_in, money_out, tier, meta, href, source_count, closes_at, amount_min, postcode, score`:
no `source`, no `amount_max` as such, no fit, no eligibility. Matview columns (`pg_attribute`, 18): those 16 plus `tsv`, `built_at`.

Verdict: the index can be the one place's public search box for grant names/funders only after a status filter is added to the
branch (a `DROP`+recreate, per memory `project_search_index`: column changes need recreate, and this is a filter change so
`CREATE OR REPLACE` might work but the nightly `mv_refresh_registry` rebuild rule applies). It can never hold private rounds, and it
holds no ALMA rows, `foundation_programs` or fit. Private-round search must be a service-role query on `act_private_grant_rounds`.

## 3. `search_project_funding_hybrid`: what it embeds, what it scores, and whether it survives

`pg_get_functiondef('search_project_funding_hybrid'::regproc)` (verified). `LANGUAGE sql STABLE SECURITY DEFINER`, executable by
`authenticated` and `service_role` (`pg_proc.proacl`). Signature `(p_org_project_id uuid, p_query_embedding vector DEFAULT NULL, p_match_count int DEFAULT 50)`.

```sql
WITH project AS (
  SELECT op.code, profile.profile_version, profile.completeness_status, profile.profile, profile.embedding,
         coalesce(nullif(profile.embedding_text,''), concat_ws(' ', op.name, op.description, profile.profile->'purpose'->>'publicSummary',
                  array_to_string(ARRAY(SELECT jsonb_array_elements_text(coalesce(profile.profile->'geographies','[]'))), ' '))) AS query_text
  FROM org_projects op JOIN project_funding_profiles profile ON profile.org_project_id = op.id AND profile.is_current
  WHERE op.id = p_org_project_id),
candidate AS (
  SELECT DISTINCT ON (opportunity.id, project.project_code) opportunity.*, current_status.deadline AS safe_deadline, ...,
    ts_rank_cd(to_tsvector('english', coalesce(opportunity.search_text,'')), websearch_to_tsquery('english', project.query_text), 32) AS lexical,
    CASE WHEN coalesce(p_query_embedding, project.embedding) IS NOT NULL AND opportunity.embedding IS NOT NULL
         THEN 1 - (opportunity.embedding <=> coalesce(p_query_embedding, project.embedding)) ELSE 0 END AS semantic,
    coalesce(recommendation.fit_score, 0) AS recommendation
  FROM project
  CROSS JOIN alma_funding_opportunities opportunity
  JOIN act_funding_opportunity_current_status current_status ON current_status.opportunity_id = opportunity.id AND current_status.feed_status = 'apply_now'
  LEFT JOIN act_grant_recommendations_current recommendation ON recommendation.opportunity_id = opportunity.id AND recommendation.project_code = project.project_code
  ORDER BY opportunity.id, project.project_code, coalesce(recommendation.fit_score,0) DESC)
SELECT ..., (least(lexical*100,100)*0.35 + semantic*100*0.35 + recommendation*0.30) AS hybrid,
  CASE WHEN completeness_status <> 'decision_ready' THEN 'needs_verification'
       WHEN requires_deductible_gift_recipient AND NOT (profile->'entities' @> '[{"attributes":["dgr_item_1"]}]') THEN 'eligible_partner_led'
       WHEN coalesce(array_length(eligible_org_types,1),0) = 0 THEN 'needs_verification' ELSE 'eligible_direct' END AS eligibility_decision,
  jsonb_build_object('profile_completeness', ..., 'requires_dgr', ..., 'requires_abn', ..., 'eligible_org_types', ..., 'jurisdictions', ..., 'evidence_status','apply_now', 'official_source', ..., 'application_url', ..., 'deadline', ...) AS eligibility_evidence
FROM candidate WHERE lexical > 0 OR semantic > 0 OR recommendation > 0
ORDER BY hybrid DESC, safe_deadline ASC LIMIT greatest(1, least(p_match_count, 100))
```

What it embeds against: `project_funding_profiles.embedding` (or the caller's `p_query_embedding`, which `project-funding-service.ts:288-291`
never passes) versus `alma_funding_opportunities.embedding`. What it ranks lexically: `alma_funding_opportunities.search_text` versus the
project's whole profile text as one `websearch_to_tsquery`. Candidate pool: ALMA rows with `feed_status = 'apply_now'` in
`act_funding_opportunity_current_status` (view def read: `opportunity_type = 'open_grant'`, verified, verified_at within 7 days, has
source_url and application_url, deadline in the future and not null).

Measured today:
```sql
SELECT p.completeness_status, op.code, p.embedding IS NOT NULL AS has_embedding, jsonb_array_length(coalesce(p.profile->'unresolvedDecisions','[]')) AS unresolved,
       jsonb_array_length(coalesce(p.profile->'entities','[]')) AS entities, jsonb_array_length(coalesce(p.profile->'geographies','[]')) AS geos, p.updated_at::date
FROM project_funding_profiles p JOIN org_projects op ON op.id=p.org_project_id WHERE p.is_current ORDER BY op.code
-- 14 rows: ACT-CORE, ACT-EL, ACT-FM, ACT-GD, ACT-GP, ACT-HV, ACT-JH, ACT-JH-AL, ACT-JH-CG, ACT-JH-CT, ACT-MY, ACT-PI, ACT-PI-ER, ACT-PI-SP
-- all partial · has_embedding FALSE on all 14 · unresolved 3 (Goods 2) · entities 1 (Goods 2) · geographies 0 (Goods 5) · updated 2026-08-30 · schema project-funding-profile-v1
SELECT 'apply_now_status_rows', count(*) FROM act_funding_opportunity_current_status WHERE feed_status='apply_now'   -- 409
SELECT 'apply_now_distinct_names', count(DISTINCT lower(trim(a.name))) FROM act_funding_opportunity_current_status s JOIN alma_funding_opportunities a ON a.id=s.opportunity_id WHERE s.feed_status='apply_now'  -- 131
SELECT 'alma_with_embedding', count(*) FROM alma_funding_opportunities WHERE embedding IS NOT NULL   -- 19 of 23,705
SELECT op.code, length(query_text), numnode(websearch_to_tsquery('english', query_text)) FROM ...   -- ACT-GD 3,224 chars / 729 nodes · ACT-JH 1,121 / 271 · ACT-HV 156 / 37
```
Live run (1.7 s wall for the 100-row call):
```sql
SELECT count(*), count(*) FILTER (WHERE lexical_score > 0), count(*) FILTER (WHERE semantic_score > 0), count(*) FILTER (WHERE recommendation_score > 0),
       count(DISTINCT lower(trim(opportunity_name))), max(hybrid_score), min(hybrid_score), string_agg(DISTINCT eligibility_decision, ','), string_agg(DISTINCT profile_completeness, ',')
FROM search_project_funding_hybrid('01359765-a88c-4ac2-8e4d-c40beb01c299'::uuid, NULL, 100)   -- Goods (org_projects.id for ACT-GD)
-- 83 | 0 | 0 | 83 | 82 | 18.00 | 2.70 | needs_verification | partial
... same for 'b1ab7f56-50eb-4408-bcbc-9ef59351528b' (ACT-JH)   -- 83 | 0 | 0 | 83 | max 15
```
Top of the Goods list: "Reconciliation Week + NAIDOC Week Funding" (City of Darwin, rec 60 → hybrid 18), "Aboriginal Justice Agreement
Bail and Remand Support Program" (rec 60), "Skills NT Grant" (60), then a run of 50s including "Disaster Recovery Funding Arrangements
– Tropical Cyclone Fina", "WCH Foundation Research Grant", "Great Western Highway Closure Small Business Support Grant" and two Redland
City Council grants; every row `needs_verification`.

So: **`hybrid_score = 0.30 × act_grant_recommendations_current.fit_score`, nothing else, for every project.** `lexical` is 0 because
`websearch_to_tsquery` ANDs all 729 (Goods) terms and no `search_text` contains them all; `semantic` is 0 because no profile has an
embedding and only 19 ALMA rows do. `eligibility_decision` is `needs_verification` on every row by the first CASE branch because no
profile is `decision_ready`. The 409-row candidate pool holds only 131 distinct names (the duplication defect from grant-data-model
§6.2); `DISTINCT ON (opportunity.id, project_code)` does not collapse copies, `buildHybridWeeklyQueue` (`project-funding-service.ts:183-242`)
does it in TypeScript by a funder|name fingerprint (`:228-234`) after dropping decided ids (`:199`) and past deadlines (`:202-203`), then takes 5 (`:241`).

Does it survive the ALMA lane being retired? **No.** `CROSS JOIN public.alma_funding_opportunities`, the status view
(`act_funding_opportunity_current_status` def position of 'alma_funding_opportunities' = 1771, 'grant_opportunities' = 0) and the
recommendation matview (`act_grant_recommendations` position 906 / 0) are all ALMA-only. The fallback in
`getProjectFundingPortfolio` (`project-funding-service.ts:303-305`) is `buildWeeklyFundingQueue` over `act_grant_recommendations_current`,
also ALMA. Retire ALMA and `/org/act/funding` shows an empty queue. Re-pointing the RPC at `grant_opportunities` is possible in
principle: it has `embedding`, `embedding_model`, `embedded_at` columns and **3,162 of 3,162 live rows carry an embedding** (measured below),
so the semantic branch would work on the public corpus the day the 14 profiles get embeddings; the lexical branch needs an OR-query or
a per-project keyword list, not the whole profile; and the 0.30 recommendation term would have to become `project_relevance` /
`goods_relevance_score`, which is the desk's fit already.

## 4. Private rounds: `act_private_grant_rounds`

Columns (`information_schema`, 22, verified): `id uuid, name, provider, program, description, amount_min int, amount_max int, closes_at date,
deadline date, url, status, application_status, geography, metadata jsonb, categories text[], aligned_projects text[], goods_relevance_score int,
goods_relevance_signals jsonb, source, discovery_method, created_at, updated_at`. No `project_relevance`, no `dgr_required`/`accepts_*`,
no `ghl_opportunity_id`, no `embedding`, no `status`-adjacent `pile`/`pipeline_stage`. Created by `20260914170000` L11-16 as
`CREATE TABLE AS SELECT … FROM grant_opportunities WHERE source = 'smartygrants'` (595 rows then), PK + `UNIQUE (url)` L18-23, RLS on, PUBLIC/anon/authenticated
revoked L25-26, service_role grant added by `20260914190000` L8 after the dry run failed 42501.

**How a row becomes live** (`scripts/sync-act-private-grant-rounds.mts`, 81 lines, whole file read):
- L33-52: iterate `createSmartyGrantsPlugin().discover({})` (from `packages/grant-engine/src/sources/smartygrants.ts`), dedupe by `sourceUrl`,
  `placeFromGeography(g.geography)` (`packages/grant-engine/src/storage/repository.ts:97-107`: first `AU-<STATE>` tag or `AU-National`,
  optional `LGA:` tag → `place = {national:true} | {state, lga_name?}`), Goods keyword score + tag (`scoreGrantForGoods`, `applyGoodsTag`
  from `scripts/lib/goods-relevance.mjs`, L42-43), then `status = g.applicationStatus === 'upcoming' ? 'upcoming' : 'open'` (L46),
  `application_status = g.applicationStatus ?? 'unknown'` (L47), `metadata = {place?, last_seen_at}` (L48), `source = 'smartygrants'` (L50).
- L54-57: rows in the table that are not `closed` and either vanished from the crawl (`!seen.has(r.url)`) or have `closes_at < today` are set `closed` (L66-70).
- L63: upsert `onConflict: 'url'` in chunks of 200. `aligned_projects` starts from `[]` each run (L43), so a hand-added tag would be wiped on the next sync (inferred from the code; no hand tags exist to test).
- Registered `scripts/lib/agent-registry.mjs:440-447` (category discovery, 45-min timeout, "~25 min for 149 SmartyGrants tenants"); scheduled 168 h
  (`20260914180000` L10-12). `agent_schedules`: `enabled=true, last_run_at 2026-09-22 03:20`. `agent_runs`: 2026-09-22 03:09 success 627 found / 17 new / 25 closed;
  2026-09-17 23:30 success 632 / 53 / 16 (each run also logs a 0/0/0 twin one second earlier, cause not investigated).

The desk (`act-grants-desk.ts:69-71`) then requires `status IN ('open','ongoing','upcoming')` and `coalesce(closes_at, deadline)` not in the past.

Measured:
```sql
SELECT status, application_status, count(*) n, count(*) FILTER (WHERE closes_at IS NOT NULL) dated, count(*) FILTER (WHERE closes_at >= CURRENT_DATE) dated_future,
  count(*) FILTER (WHERE geography IS NOT NULL AND geography <> '') with_geo, count(*) FILTER (WHERE metadata ? 'place') with_place,
  count(*) FILTER (WHERE amount_max > 0 OR amount_min > 0) with_amount, count(*) FILTER (WHERE cardinality(aligned_projects) > 0) tagged,
  count(*) FILTER (WHERE goods_relevance_score >= 50) goods50, count(*) FILTER (WHERE description IS NOT NULL) with_desc, count(*) FILTER (WHERE program IS NOT NULL) with_program
FROM act_private_grant_rounds GROUP BY 1,2 ORDER BY 1,2
-- closed/open     41 | 40 dated | 5 future | geo 41 | place 41 | amount 0 | tagged 0 | goods50 0 | desc 41 | program 0
-- open/open      597 | 537      | 532      | 597    | 597      | 23       | 1        | 1         | 597     | 0
-- upcoming/upcoming 27 | 0      | 0        | 25     | 25       | 1        | 0        | 0         | 27      | 0
```
Live by the desk rule: **619** (597 open not past + 27 upcoming − 5 open past close), 532 dated, 24 with an amount, 1 tagged `ACT-GD`,
1 goods ≥ 50 (20 ≥ 30), place on 617, 23 national, url on all 619; first created 2026-09-14, all updated 2026-09-22 (`last_seen_at` 2026-09-22).
```sql
SELECT geography, count(*) FROM act_private_grant_rounds WHERE status IN ('open','upcoming') GROUP BY 1 ORDER BY 2 DESC
-- AU-VIC 152 · AU-QLD 151 · AU-WA 136 · AU-NSW 63 · AU-SA 53 · AU-TAS 26 · AU-National 23 · AU-ACT 18 · (blank) 2
SELECT (metadata->'place'->>'national'), metadata->'place'->>'state', metadata->'place'->>'lga_name' IS NOT NULL, count(*) FROM act_private_grant_rounds WHERE status IN ('open','upcoming') GROUP BY 1,2,3 ORDER BY 4 DESC
-- VIC+lga 141 · QLD+lga 127 · WA+lga 100 · NSW+lga 48 · WA 36 · SA 33 · QLD 24 · national 23 · SA+lga 20 · ACT 18 · TAS 16 · NSW 15 …
```
Geography coverage is the best in the whole pool: state on 617/619 and **an LGA name on 436**, because SmartyGrants tenants are mostly
councils. Note `AU-NT` does not appear at all, so Goods' NT area gets nothing from this lane. Eligibility coverage is zero by schema.

Overlap with the public table (hash joins, the correlated form timed out at 8 s):
```sql
WITH r AS (SELECT id, url, lower(trim(name)) nk FROM act_private_grant_rounds WHERE status IN ('open','ongoing','upcoming') AND (coalesce(closes_at,deadline) IS NULL OR coalesce(closes_at,deadline) >= CURRENT_DATE)),
u AS (SELECT r.id FROM r JOIN grant_opportunities g ON g.url = r.url),
n AS (SELECT DISTINCT r.id FROM r JOIN (SELECT lower(trim(name)) nk FROM grant_opportunities) g ON g.nk = r.nk)
SELECT (SELECT count(*) FROM r), (SELECT count(*) FROM u), (SELECT count(*) FROM n)   -- 619 | 1 | 12
```
The desk's URL dedupe (`act-grants-desk.ts:51-54, 72-76`) removes 1; 12 share a name with a public row (different URL, most likely the
same round listed on a council site and on its SmartyGrants portal; not checked row by row).

**Policy.** Migration `20260914160000` L2-7 quotes Our Community's ToU cl 1.1, 2(i), 4.3(e) and stops the public crawl;
`20260914180000` L4-7 records Ben's decision to run the private sync "for ACT's own grant-seeking, not sold or shown to anyone" while a
permission request is drafted (`thoughts/shared/drafts/2026-09-14-our-community-permission-ask.md` is untracked in `git status`);
`20260914170000` L2-6 explains why the rows had to leave the public table. Memory `feedback_terms_before_scraper.md`: "A platform that
sells the data needs a licence, not a crawler." So yes: **private rounds are a separate lane by policy, not just by schema.** They may be
read by the admin-gated desk with the service role and by nothing anonymous, authenticated, public-API or search-index shaped, until
Our Community answers. The one place can show them only behind the same admin gate `/org/[slug]/grants/page.tsx:63-72` uses, and the
"one SQL" must run as service role.

## 5. The pool under each candidate definition

| definition | rows | dated | with amount | tagged (six codes) | fit ≥ threshold | eligibility known | place known | in GHL |
|---|---|---|---|---|---|---|---|---|
| **A** `v_funding_opportunities WHERE is_open` | 27,255 (GO 24,771 + FP 2,445 + ALMA 39) | 356 | 24,358 | not in the view | not in the view | `requires_dgr` non-null 2,978, of which 2,976 are `false` by default; `eligible_org_types` 200 | not in the view (`is_national` 2,978, `jurisdictions` 171) | not in the view |
| **B** `grant_opportunities` status live AND not past close (the desk's public half; = view ∩ live status, since the view's `closes_at` is the same `coalesce`) | 3,162 | 319 | 1,637 | 68 (any tag 90) | goods ≥50: 46; keyword ≥30: JH 6, HV 3, FM 3, CN 1, EL 1; rubric ≥2.5: CN 6, FM 5, JH 4, EL 2, HV 0; rubric present 356 | 303 (dgr 7, pty 300) | geography 2,976 (state/national token 2,927), `metadata.place` 1 | 112 |
| **C** B ∪ `act_private_grant_rounds` live | 3,781 (3,780 after URL dedupe) | 851 | 1,661 | 69 (goods 47) | goods ≥50: 47 | 303 (0 private) | 3,593 | 112 |
| **D** the view with a status test added (`origin='grant_opportunities' AND status live`) | 3,162 + FP 2,445 + ALMA 39 = 5,646 if FP/ALMA are kept | 319 + 17 + 7 | | as B for GO, none for FP/ALMA | | as B | | |

SQL for B (the per-project fit rows) and C are in the contract summary below; A's numbers from §1.2; the B aggregates:
```sql
WITH live AS (SELECT * FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming') AND (coalesce(closes_at, deadline) IS NULL OR coalesce(closes_at, deadline) >= CURRENT_DATE))
SELECT 'B_desk_public_live', count(*) FROM live                                                   -- 3,162
UNION ALL SELECT 'B_dated', count(*) FROM live WHERE coalesce(closes_at, deadline) IS NOT NULL     -- 319
UNION ALL SELECT 'B_with_amount', count(*) FROM live WHERE amount_max > 0 OR amount_min > 0        -- 1,637
UNION ALL SELECT 'B_tagged_any', count(*) FROM live WHERE cardinality(aligned_projects) > 0        -- 90
UNION ALL SELECT 'B_tagged_six_codes', count(*) FROM live WHERE aligned_projects && ARRAY['ACT-GD','ACT-JH','ACT-EL','ACT-HV','ACT-FM','ACT-CN']  -- 68
UNION ALL SELECT 'B_elig_dgr_known', count(*) FROM live WHERE dgr_required IS NOT NULL             -- 7
UNION ALL SELECT 'B_elig_pty_known', count(*) FROM live WHERE accepts_pty_ltd IS NOT NULL          -- 300
UNION ALL SELECT 'B_elig_any_known', count(*) FROM live WHERE dgr_required IS NOT NULL OR accepts_pty_ltd IS NOT NULL  -- 303
UNION ALL SELECT 'B_elig_summary', count(*) FROM live WHERE eligibility_summary IS NOT NULL        -- 0
UNION ALL SELECT 'B_place_geo', count(*) FROM live WHERE nullif(trim(geography),'') IS NOT NULL    -- 2,976
UNION ALL SELECT 'B_place_metadata', count(*) FROM live WHERE metadata ? 'place'                   -- 1
UNION ALL SELECT 'B_place_state_or_national', count(*) FROM live WHERE geography ~* '(AU-(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)|national)'  -- 2,927
UNION ALL SELECT 'B_in_ghl', count(*) FROM live WHERE ghl_opportunity_id IS NOT NULL               -- 112
UNION ALL SELECT 'B_with_url', count(*) FROM live WHERE url IS NOT NULL                            -- 2,329
UNION ALL SELECT 'B_goods_scored', count(*) FROM live WHERE goods_relevance_score IS NOT NULL      -- 3,162
UNION ALL SELECT 'B_goods_ge50', count(*) FROM live WHERE goods_relevance_score >= 50              -- 46
UNION ALL SELECT 'B_pr_scored', count(*) FROM live WHERE project_relevance <> '{}'                 -- 3,104
UNION ALL SELECT 'B_rubric_meta', count(*) FROM live WHERE project_relevance ? 'rubric_meta'       -- 356
UNION ALL SELECT 'B_embedding', count(*) FROM live WHERE embedding IS NOT NULL                     -- 3,162
```
Per-project fit on B (keys are project slugs, `project_relevance.<slug>.score` keyword 0-100, `.rubric.score` Jev 0-4, `.tagged_by`):
```sql
WITH live AS (...same...), p AS (SELECT unnest(ARRAY['justicehub','empathy-ledger','harvest','farm','contained']) slug)
SELECT p.slug, count(*) FILTER (WHERE (l.project_relevance->p.slug->>'score')::int >= 30) kw_ge30, count(*) FILTER (WHERE (l.project_relevance->p.slug->>'score')::int >= 50) kw_ge50,
  count(*) FILTER (WHERE (l.project_relevance->p.slug->'rubric'->>'score')::numeric >= 2.5) rubric_ge25, count(*) FILTER (WHERE l.project_relevance->p.slug ? 'rubric') rubric_any,
  count(*) FILTER (WHERE l.project_relevance->p.slug->>'tagged_by' IS NOT NULL) tagged_by_set, count(*) FILTER (WHERE ...='keyword') tb_keyword, ... ='rubric' tb_rubric, ...='both' tb_both
FROM p CROSS JOIN live l GROUP BY p.slug ORDER BY p.slug
-- contained      kw30 1 | kw50 0 | rubric≥2.5 6 | rubric 356 | tagged_by 5 (rubric 4, both 1)
-- empathy-ledger        1 |      0 |            2 |        356 |           2 (rubric 2)
-- farm                  3 |      0 |            5 |        356 |           3 (rubric 3)
-- harvest               3 |      0 |            0 |        356 |           0
-- justicehub            6 |      0 |            4 |        356 |           3 (both 3)
SELECT 'goods', count(*) FILTER (WHERE goods_relevance_score >= 50) ge50, ... >= 30 ge30, count(*) FILTER (WHERE goods_relevance_signals->>'tagged_by' IS NOT NULL) tagged_by_set, ... FROM live
-- goods  ge50 46 | ge30 333 | tagged_by 3 (all keyword) | project_relevance ? 'goods' 0 | tagged ACT-GD 46
```
Reading: the keyword scorer never reaches 50 for the five non-Goods projects on any live row; the Jev rubric has scored 356 live rows
and clears 2.5 on 17 row-project pairs; `tagged_by` provenance exists on 13 pairs + 3 goods rows. Everything else is unscored by Jev or
tagged before the ledger existed.

## 6. The deliverable: one SQL that returns the desk row contract from one source

Source = `grant_opportunities` ∪ `act_private_grant_rounds`, both filtered the way `act-grants-desk.ts:8, 69-71` does, one row per
(grant, project). The project table hard-codes `ACT_PROJECTS` from `apps/web/src/lib/act-grant-eligibility.ts:30-37` (entities and
operating areas are Ben's 2026-09-14 answers, header L1-4) and the verdict rules from `entityVerdict` L81-86, `locationVerdict` L65-78,
`projectEligibility` L96-107. Runs in ~1 s as service role; ran today and produced the tables below. Saved as `row-contract.sql` in this directory.

```sql
WITH projects AS (
  SELECT * FROM (VALUES
    ('goods',          'ACT-GD', ARRAY['pty','butterfly'], false, ARRAY['NT','QLD','WA'], NULL::text),
    ('justicehub',     'ACT-JH', ARRAY['pty','akt'],       true,  ARRAY[]::text[],        NULL),
    ('empathy-ledger', 'ACT-EL', ARRAY['pty','butterfly'], true,  ARRAY[]::text[],        NULL),
    ('harvest',        'ACT-HV', ARRAY['pty','butterfly'], false, ARRAY[]::text[],        'Sunshine Coast'),
    ('farm',           'ACT-FM', ARRAY['pty','butterfly'], false, ARRAY[]::text[],        'Sunshine Coast'),
    ('contained',      'ACT-CN', ARRAY['pty','butterfly'], true,  ARRAY[]::text[],        NULL)
  ) AS p(slug, code, entities, national, states, lga)
),
pool AS (
  SELECT 'public'::text AS origin, g.id, g.name, g.provider, g.source, g.url, g.status,
         coalesce(g.closes_at, g.deadline) AS closes_at, g.amount_min, g.amount_max,
         nullif(trim(g.geography), '') AS geography, g.metadata->'place' AS place,
         coalesce(g.aligned_projects, '{}') AS aligned_projects,
         g.goods_relevance_score, g.goods_relevance_signals, coalesce(g.project_relevance, '{}'::jsonb) AS project_relevance,
         g.dgr_required, g.accepts_pty_ltd, g.ghl_opportunity_id
  FROM grant_opportunities g
  WHERE g.status IN ('open','ongoing','upcoming')
  UNION ALL
  SELECT 'act-private', r.id, r.name, r.provider, r.source, r.url, r.status,
         coalesce(r.closes_at, r.deadline), r.amount_min, r.amount_max,
         nullif(trim(r.geography), ''), r.metadata->'place',
         coalesce(r.aligned_projects, '{}'),
         r.goods_relevance_score, r.goods_relevance_signals, '{}'::jsonb,
         NULL::boolean, NULL::boolean, NULL::text
  FROM act_private_grant_rounds r
  WHERE r.status IN ('open','ongoing','upcoming')
),
live AS (
  SELECT p.*,
         ARRAY(SELECT regexp_replace(upper(trim(t)), '^AU-', '') FROM unnest(string_to_array(coalesce(p.geography,''), ',')) t) AS geo_tokens
  FROM pool p
  WHERE p.closes_at IS NULL OR p.closes_at >= CURRENT_DATE
),
placed AS (
  SELECT l.*,
         (l.place->>'national')::boolean IS TRUE OR 'NATIONAL' = ANY(l.geo_tokens) AS g_national,
         l.place->>'lga_name' AS g_lga,
         CASE WHEN l.place->>'state' IS NOT NULL THEN ARRAY[upper(l.place->>'state')]
              ELSE ARRAY(SELECT t FROM unnest(l.geo_tokens) t WHERE t IN ('NSW','VIC','QLD','WA','SA','TAS','NT','ACT')) END AS g_states
  FROM live l
),
rows_ AS (
  SELECT
    pl.origin, pl.id AS grant_id, pl.name, pl.provider AS funder, pl.source, pl.url,
    pr.slug AS project, pr.code AS project_code,
    CASE WHEN pr.slug = 'goods' THEN pl.goods_relevance_score
         ELSE (pl.project_relevance->pr.slug->>'score')::int END                                   AS fit_keyword,
    (pl.project_relevance->pr.slug->'rubric'->>'score')::numeric                                     AS fit_jev,
    (pl.project_relevance->pr.slug->'rubric'->>'confidence')::numeric                                AS fit_jev_confidence,
    CASE WHEN pr.slug = 'goods' THEN pl.goods_relevance_signals->>'tagged_by'
         ELSE pl.project_relevance->pr.slug->>'tagged_by' END                                        AS tagged_by,
    pr.code = ANY(pl.aligned_projects)                                                               AS tagged,
    pl.closes_at, pl.closes_at - CURRENT_DATE                                                        AS days_to_close,
    pl.amount_min, pl.amount_max,
    -- entity verdicts: act-grant-eligibility.ts entityVerdict() L81-86
    CASE WHEN pl.dgr_required IS TRUE THEN 'no'
         WHEN pl.accepts_pty_ltd IS NOT NULL THEN CASE WHEN pl.accepts_pty_ltd THEN 'yes' ELSE 'no' END
         ELSE 'unknown' END                                                                          AS pty_can_apply,
    CASE WHEN pl.dgr_required IS TRUE THEN 'yes' ELSE 'unknown' END                                  AS butterfly_can_apply,
    CASE WHEN pl.dgr_required IS TRUE THEN 'no'  ELSE 'unknown' END                                  AS akt_can_apply,
    coalesce(pl.g_lga, CASE WHEN pl.g_national THEN 'National' END, array_to_string(pl.g_states, ','), pl.geography) AS place_label,
    -- location verdict: act-grant-eligibility.ts locationVerdict() L65-78
    CASE WHEN pl.place IS NULL AND NOT pl.g_national AND cardinality(pl.g_states) = 0 THEN 'unknown'
         WHEN pl.g_national THEN 'yes'
         WHEN pl.g_lga IS NOT NULL THEN
              CASE WHEN pr.lga IS NOT NULL AND lower(pl.g_lga) LIKE '%' || lower(pr.lga) || '%' THEN 'yes'
                   WHEN pr.national THEN 'unknown' ELSE 'no' END
         WHEN pl.g_states && (pr.states || CASE WHEN pr.lga IS NOT NULL THEN ARRAY['QLD'] ELSE ARRAY[]::text[] END) THEN 'yes'
         WHEN pr.national THEN 'unknown' ELSE 'no' END                                               AS location,
    pl.ghl_opportunity_id IS NOT NULL                                                                AS in_ghl,
    pl.ghl_opportunity_id,
    pr.entities
  FROM placed pl CROSS JOIN projects pr
),
contract AS (
  SELECT r.*,
    -- overall: act-grant-eligibility.ts projectEligibility() L103-105
    CASE WHEN r.location = 'no'
           OR NOT EXISTS (SELECT 1 FROM unnest(r.entities) e
                          WHERE (e='pty' AND r.pty_can_apply <> 'no') OR (e='butterfly' AND r.butterfly_can_apply <> 'no') OR (e='akt' AND r.akt_can_apply <> 'no'))
         THEN 'no'
         WHEN r.location = 'yes'
           AND EXISTS (SELECT 1 FROM unnest(r.entities) e
                       WHERE (e='pty' AND r.pty_can_apply = 'yes') OR (e='butterfly' AND r.butterfly_can_apply = 'yes') OR (e='akt' AND r.akt_can_apply = 'yes'))
         THEN 'yes' ELSE 'unknown' END AS can_apply
  FROM rows_ r
)
SELECT origin, grant_id, name, funder, source, url, project, project_code,
       fit_keyword, fit_jev, fit_jev_confidence, tagged_by, tagged,
       closes_at, days_to_close, amount_min, amount_max,
       pty_can_apply, butterfly_can_apply, akt_can_apply, can_apply,
       place_label, location, in_ghl, ghl_opportunity_id
FROM contract
ORDER BY closes_at NULLS LAST, fit_keyword DESC NULLS LAST, name
```

Summary run (`SELECT project, count(*) … FROM contract GROUP BY project`):

| project | rows | public | private | dated | amount | fit_kw ≥ thr (50 goods / 30 others) | fit_jev ≥ 2.5 | jev scored | tagged | tagged_by | can_apply yes / no / unknown | location yes / no / unknown | in_ghl |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| contained | 3,781 | 3,162 | 619 | 851 | 1,661 | 1 | 6 | 356 | 5 | 5 | 33 / 0 / 3,748 | 738 / 0 / 3,043 | 112 |
| empathy-ledger | 3,781 | | | | | 1 | 2 | 356 | 3 | 2 | 33 / 0 / 3,748 | 738 / 0 / 3,043 | 112 |
| farm | 3,781 | | | | | 3 | 5 | 356 | 6 | 3 | 43 / 2,499 / 1,239 | 1,086 / 2,499 / 196 | 112 |
| goods | 3,781 | | | | | 47 | 0 | 0 | 47 | 3 | 194 / 1,364 / 2,223 | 2,221 / 1,364 / 196 | 112 |
| harvest | 3,781 | | | | | 3 | 0 | 356 | 3 | 0 | 43 / 2,499 / 1,239 | 1,086 / 2,499 / 196 | 112 |
| justicehub | 3,781 | | | | | 6 | 4 | 356 | 6 | 3 | 32 / 7 / 3,742 | 738 / 0 / 3,043 | 112 |

Sample (Goods, tagged or keyword ≥ 50, soonest close first):
```
public | Aboriginal Community Initiatives Fund: 2026–27   | Dept of Families (VIC) | kw 55 | jev - | tagged_by - | tagged | 2026-09-28 (4d) | $100,000 | pty unknown | VIC       | loc no      | can_apply no      | ghl no  | vic-grants-gateway
public | Alcohol and Other Drugs Youth Grants 2026/27     | Department of Health   | kw 73 |       | keyword     | tagged | 2026-10-09 (15d)| $20,000  | unknown     | NT        | yes         | unknown           | no      | Department of Health
public | 2026/2027 Barkly Regional Deal Local Community … | Dept of Housing (NT)   | kw 78 |       | keyword     | tagged | 2026-11-08 (45d)| $50,000  | unknown     | NT        | yes         | unknown           | no      | …
public | SEDI Capability Building Grant                   | Impact Investing Aust  | kw 82 |       |             | tagged | 2027-06-30      | $120,000 | pty yes     | (none)    | unknown     | unknown           | yes     | manual-research-2026-05-27
public | Remote Australia Employment Service Closed Non-C | NIAA                   | kw 50 |       |             | tagged | 2029-06-30      |          | pty yes     | National  | yes         | yes               | no      | grantconnect
public | Aboriginal and Torres Strait Islander (ATSI) ini | DTMR                   | kw 82 |       |             | tagged | (none)          | $12.61m  | unknown     | QLD       | yes         | unknown           | yes     | DTMR
```
That is the row the desk renders today (`/org/[slug]/grants` fields, desk-surfaces §2), from SQL instead of two paged selects and
TypeScript; and it is the shape the one place needs. Differences from `buildDesk()`: no URL dedupe (1 row), `norm()` of LGA names
approximated by `LIKE`, and `place_label` added.

## 7. What is missing from the contract, and where each piece would come from

| contract field | present? | source today | gap and where it would come from |
|---|---|---|---|
| project | yes | hard-coded six from `act-grant-eligibility.ts:30-37`; `org_projects` has 14 active (`ACT-GP`, `ACT-MY`, `ACT-PI*`, `ACT-JH-AL/CG` have profiles but no scorer). **Code drift:** `org_projects.code` for `contained` is `ACT-JH-CT`, the scorer tags `ACT-CN` (`scripts/lib/project-relevance.mjs:203-209`); the contract uses the scorer's code so `tagged` works. Pick one. |
| fit, keyword | yes | `goods_relevance_score` (both tables, daily, 3,162+619 scored) and `project_relevance.<slug>.score` (public only, one pass 2026-09-20; `score-project-relevance.mjs` is unscheduled per grant-data-model §3.1) | private rounds have no non-Goods keyword score: run `applyProjectTags` in `sync-act-private-grant-rounds.mts` next to `applyGoodsTag` (L42-43), or a nightly scorer over the private table |
| fit, Jev | partly | `project_relevance.<slug>.rubric.score/confidence` on 356 of 3,162 live public rows; `rubric_meta.organisation_fundable`; Goods rubric key absent (0 rows) | the scheduled `score-project-rubric` (24 h, `last_run_at` NULL, `agent_schedules` verified) has not written a row yet; private rounds have no column: `project_relevance jsonb` would have to be added to `act_private_grant_rounds` and the rubric scorer pointed at both tables |
| tagged_by | partly | `project_relevance.<slug>.tagged_by` (13 pairs), `goods_relevance_signals.tagged_by` (3 public, private not checked per row) | ledger began 2026-09-14; older tags have no provenance and never will unless re-scored |
| close date | yes | `coalesce(closes_at, deadline)` | 851 of 3,781 dated; 2,843 public rows undated is the corpus, not a schema gap |
| amount | yes | `amount_min/max` | 1,661 of 3,781 |
| entity that can apply | schema yes, data mostly unknown | `dgr_required` (7), `accepts_pty_ltd` (300); `accepts_charity` (108), `accepts_sole_trader` (39), `accepts_unincorporated` (37), `eligibility_criteria` (189), `eligibility_signals_at` (397) exist on GO and are **not read** by `entityVerdict` | Butterfly/AKT verdicts could use `accepts_charity`; a Jev pass over `eligibility_criteria`/`description` is the obvious filler (JEV `Choice` with "not stated" as a real answer per memory `project_jev_evaluation`); private table has no eligibility columns at all |
| place | yes | `geography` (2,976 public), `metadata.place` (1 public, 617 private, with LGA on 436 private) | Harvest/Farm need LGA-grade place and the public corpus has 1 row of it: `placeFromGeography` only writes `place` when the source plugin emits `LGA:` tags |
| source | yes | `source` + `origin` | |
| in-GHL | yes, semantics unclear | `grant_opportunities.ghl_opportunity_id` non-null on 725 rows / 703 distinct ids / 114 live; 251 of those ids exist in the `ghl_opportunities` mirror (1,322 rows). Writers: `apps/web/src/app/api/goods/grants/push-ghl/route.ts:45-48` (`update({ghl_opportunity_id}).eq('id', grantId)` after `goods-grant-ghl.ts` creates the GHL opportunity); `api/tracker/[grantId]/route.ts:112` writes `saved_grants.ghl_opportunity_id` (0 rows set); `funding-ghl.ts:29-35` writes `funding_ghl_handoffs` (0 rows) and `act_grant_recommendation_decisions` (0 of 89 with a GHL id). 260 rows have `source='ghl_sync'` (created 2026-03-05, status `unknown` 255, none live): GHL→GO mirror-ins whose writer is not in this repo's current scripts (unverified). The 657 rows with `updated_at` 2026-09-20 coincide with the all-row keyword pass that night (inferred, not a GHL write). | one boolean is not enough: the contract should carry `ghl_opportunity_id` plus the mirror's `stage_name`/`status` via `LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id` (251 would resolve). Private rounds have no GHL column |

## 8. Judgement

1. **Source:** `grant_opportunities` ∪ `act_private_grant_rounds`, service role, status live, not past close. Not the view, not the
   search index, not ALMA. The desk service already reads exactly this; the redesign should move that read into one SQL object
   (a service-role-only view or a `SECURITY DEFINER` function with the admin check in the caller) so every ACT surface shares the
   same 3,781 rows and the same verdict rules, and stop re-implementing `projectEligibility` in TypeScript per page.
2. **`v_funding_opportunities` needs a status test before anyone else builds on it.** As shipped, `?open=1` on the public API returns
   18,886 closed grants as open. That is a one-line view change (`AND g.status IN ('open','ongoing','upcoming')` in `rounds`, or a
   `status` passthrough), SAFE path, but it changes what JusticeHub/Empathy Ledger see, so tell them. The same one-liner belongs in
   the `grants` CTE of `mv_search_index`.
3. **The hybrid RPC is decorative.** Two of its three terms are structurally zero; the third is the ALMA recommendation the `/pipeline`
   kanban already shows. `/org/act/funding` is therefore the `/pipeline` top-5 with a "needs verification" label on every card. If the
   ALMA lane is retired, delete the RPC and the page together; if the one place wants semantic search, the assets are on the public
   corpus (3,162 live embeddings), not on ALMA (19).
4. **Private rounds stay a lane by policy**, admin-gated and service-role only, until Our Community replies. The one SQL can include
   them because it runs as service role behind the gate; the public API and the search index cannot.
5. **The real shortage is data, not columns.** Fit ≥ threshold exists on ≤ 47 rows per project; eligibility is known on 303 of 3,781;
   Jev has touched 356 public rows and 0 private. The scheduled rubric run (`score-project-rubric`, 24 h) has never completed an
   `--apply`; that, plus the private table getting `project_relevance`, is what moves the numbers.
6. Two ALMA-side defects the one place inherits if it keeps any ALMA read: the 23,705-row duplication (grant-data-model §6.2) and the
   name-keyed enrichment that makes `requires_dgr=false` look like knowledge on 2,976 rows.

## 9. Questions for Ben

1. Is `contained` `ACT-CN` (scorer) or `ACT-JH-CT` (`org_projects`)? The tag and the profile disagree today.
2. Should the one place show foundation programs that are not rounds (2,445 "open" `foundation_programs` rows, 17 dated)? They are in
   the view and not in the desk.
3. May the public API's `is_open` change meaning (24,771 → 3,162 grant rows) now, or does JusticeHub/Empathy Ledger need notice first?
4. Once Our Community answers: if yes, do private rounds merge into `grant_opportunities` (and so into the view and search)? If no, is
   the weekly sync switched off and the 665 rows kept or deleted?
5. Does "in GHL" mean "an opportunity exists" (725 rows) or "an opportunity exists in the Grants pipeline at a live stage" (needs the
   mirror join; 251 resolve today)?

## Appendix: files and objects read (all verified by reading)

- `supabase/migrations/20260905180000_v_funding_opportunities.sql` L1-60, `20260905181000_…dedupe_by_name.sql` L1-60
- `supabase/migrations/20260914160000_disable_smartygrants_discovery.sql`, `20260914170000_act_private_grant_rounds.sql`, `20260914180000_schedule_…`, `20260914190000_grant_service_role_…` (whole)
- `supabase/migrations/20260905160000_mv_search_index.sql` L1-40; `20260922210000_entity_stats_share_positive_only.sql` L228-245
- `apps/web/src/lib/funding/opportunities.ts` (whole, 86 lines); `apps/web/src/app/api/data/funding-opportunities/route.ts` L1-40
- `apps/web/src/lib/services/act-grants-desk.ts` L1-150; `apps/web/src/lib/act-grant-eligibility.ts` L1-107
- `apps/web/src/lib/services/project-funding-service.ts` L183-310
- `scripts/sync-act-private-grant-rounds.mts` (whole, 81 lines); `scripts/lib/upsert-grant-opportunities.mjs` (whole, 180 lines; it writes `grant_opportunities` only, resolves by url then (source,name), never `name,source_id`; the private sync does not use it)
- `scripts/lib/agent-registry.mjs` L438-447; `scripts/lib/project-relevance.mjs` L200-209; `packages/grant-engine/src/storage/repository.ts` L97-107, L143-158
- `apps/web/src/app/api/goods/grants/push-ghl/route.ts` L35-50; `apps/web/src/lib/services/goods-grant-ghl.ts` L1-30; `funding-ghl.ts` L22-37; `api/tracker/[grantId]/route.ts` L62-112 (grep)
- DB: `pg_get_viewdef` of `v_funding_opportunities`, `mv_search_index` (substr 3000-6400), `act_funding_opportunity_current_status`; `pg_get_functiondef` of `search_project_funding_hybrid`, `search_index_query`; `information_schema.columns` for `grant_opportunities` (69), `act_private_grant_rounds` (22), `project_funding_profiles` (16), `funding_ghl_handoffs`, `org_projects`, `ghl_opportunities`, `act_grant_recommendation_decisions`, `foundation_programs` (status/deadline/eligibility), `alma_funding_opportunities` (12 named); `pg_class` acl/reloptions; `pg_proc` acl; `agent_schedules`, `agent_runs`, `cron.job` (no private entry)
- Memory: `solution_unified_funding_view.md`, `project_search_index.md`, `feedback_terms_before_scraper.md`
