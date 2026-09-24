# Buyers and procurement: what exists for FINDING BUYERS (Goods on Country first)

Reader: buyers-and-procurement. Date: 2026-09-24. Repo: /Users/benknight/Code/grantscope. Read-only.
All SQL run via `node --env-file=.env scripts/gsql.mjs "<sql>"`. Every number below is from a query in this file.

## 0. The one-paragraph verdict

There are THREE separate "buyer" systems that do not talk to each other, plus a tender feed that
never ran. (1) The Goods buyer pipeline (`goods_relationships` where `relationship_type='buyer'`,
131 rows) is a GHL mirror: warmth/stage/next-move, no product, no place, no contract evidence,
$0 asks on every row, and 59 of its rows are communities (GHL "Demand Register") not buyers.
(2) `goods_procurement_entities` (4,562 rows, last touched 2026-05-27) is the place-keyed buyer
census: every row has a community, a role, a product_fit and a fit_score, but it is read only by
the community dossier page and the signals workbench, never by the buyers tab. (3) The CivicGraph
buyer-wedge machinery (`se_buyer_prospects` 438 rows, `/lighthouse`, `/dashboard/browse/buyers`,
`/procurement/*`, `procurement_shortlists`) is about selling CivicGraph evidence TO government
procurement teams; it is not a Goods buyer finder and its shortlists are two test rows from March.
The open-tender feed (`sync-austender-open-tenders.mjs`) is registered, keyword+UNSPSC gated to
furniture/beds/whitegoods, and has 0 rows in `agent_runs`, no `agent_schedules` row, and 2 closed
rows from 2026-05-27 in `grant_opportunities`. `state_tenders` has zero NT or WA rows. The
revealed-demand query that would answer "who buys beds" (goods-repeat-buyer-intel.mjs) ran once
on 2026-05-28 into a markdown report and nothing reads it.

## 1. Surfaces

### 1a. /org/[slug]/goods/buyers (the Goods "Buyer pipeline" tab)

File: `apps/web/src/app/org/[slug]/goods/buyers/page.tsx`

- Data: `getGoodsBuyerPipeline()` + `getGoodsRelationshipPower()` + `getGoodsRelationshipFunding()` (page.tsx:162-166).
- One buyer row (`BuyerCard`, page.tsx:67-149) shows: name; a static "Buyer" pill; "Open in GHL"
  link if `ghl_contact_id` (page.tsx:78-104, via `ghlContactUrl`) else "No GHL signal"; `PowerChip`
  and `FundingChip` (page.tsx:105-106); `STAGE_LABEL[stage] · last touch relDays` (page.tsx:110);
  a red "Going quiet" badge if idle past the per-stage rot limit (`ROT_DAYS` page.tsx:54-56:
  identified 90d, researching 60d, contacted 21d, in_conversation 14d, proposal 10d); `Next: nextMove`
  with a due-date pill (page.tsx:118-129); `notes`; and on the right the warmth band pill
  (`{band} {warmth}`) plus `open ask` and `rec.` amounts only when > 0 (page.tsx:134-146).
- Header: `hasMoney = totalReceived>0 || openAskTotal>0` (page.tsx:176). When false it leads with
  "N buyers in the pipeline / N open conversations / N/N linked to GHL" and the footnote "No revenue
  or ask amounts recorded yet" (page.tsx:232-249). This is the live state (see §3: asks are NULL on
  every row, received is $106,150 on 2 rows, so `hasMoney` is true via totalReceived and the money
  hero renders with $106K received / $0 open asks / Expected $0).
- Filters: `?filter=open` and `?filter=no_next` (page.tsx:167-171, 261-286). That is the whole
  action set on this page: two list filters and an outbound GHL link. No add, no edit, no push, no
  product, no place, no tender.
- Footer explains the model (page.tsx:300-305): rows are `goods_relationships` `relationship_type='buyer'`;
  procurement is the earned track never mixed into grant totals.
- Reachable from the rail: `apps/web/src/app/org/[slug]/_components/act-workspace-shell.tsx:336`
  (`Delivery → ['buyers','Buyers']`) and the sub-nav `goods-sub-nav.tsx:23` (`['buyers','Buyer pipeline']`).
- Also consumed by: the hub `apps/web/src/app/org/[slug]/goods/page.tsx:101,183,197-199`
  ("Buyers in pipeline" stat + dest card) and the One Desk `apps/web/src/lib/services/act-one-desk.ts:136,238-245`
  (only `isOpen` buyers; row = name, `band warmth`, nextMove, dueDays, ask as `$NK`, GHL url).

Service: `apps/web/src/lib/services/goods-buyer-pipeline.ts`
- Query: `.from('goods_relationships').select('*').eq('relationship_type','buyer').order('warmth_display', desc).order('total_received_aud', desc)` (lines 150-155). LIVE client (`getServiceSupabase`).
- `OPEN_ASK_STAGES` = identified, researching, contacted, in_conversation, proposal (lines 23-25).
- `toPipelineRow` (86-106): warmth = `warmth_display`; `band = warmthBand(warmth)`; `nextMove = nextBestAction(r)`.
- Summary (108-136): total, open, totalReceived (sum `total_received_aud`), openAskTotal, weightedPipeline = ask × `STAGE_PROBABILITY[stage]`, withGhl (count `ghl_opportunity_id`).
- Ranking = warmth desc, then received desc. Nothing else.

Warmth/next-move logic: `apps/web/src/lib/services/goods-engagement-shared.ts`
- `nextBestAction` (203-221): returns `next_action` if set; else "Re-warm" if warmth ≥25 and >60d idle; else a per-stage canned string ("Qualify fit and confirm the program / procurement window", "Make first contact {warm_intro_path}", "Move to the ask: scope a beds / $ proposal", ...).
- Warmth itself is the DB generated column `warmth_display = COALESCE(warmth_override, warmth_computed)`; `goods_compute_warmth` weights Stage 40 / Recency 20 / History 20 / Alignment 15 / Advocacy 5 (memory project_goods_command_center.md, migration 20260609060000, not re-read this session: inferred).

Power/Funding chips: `goods-relationship-power.ts` reads `v_goods_relationship_power`; `goods-relationship-funding.ts` reads `v_goods_relationship_funding`. Both keyed by `goods_relationships.id` and only populated for entity-linked rows (funding.ts:12-15 says ~⅓ linked). The old "permission denied" gotcha (memory) is now FIXED for the app: grants query below shows `service_role SELECT` on both views (anon/authenticated still not granted, but the app reads via service role).

```sql
SELECT table_name, grantee, string_agg(privilege_type, ',') FROM information_schema.role_table_grants
WHERE table_name IN ('v_goods_relationship_power','v_goods_relationship_funding') GROUP BY 1,2
-- v_goods_relationship_funding: agent_readonly SELECT; postgres ALL; service_role SELECT
-- v_goods_relationship_power:   agent_readonly SELECT; postgres ALL; service_role SELECT
```

### 1b. /dashboard/browse/buyers (public "Government buyers" list)

File: `apps/web/src/app/dashboard/browse/buyers/page.tsx`
- RPCs `contract_buyer_browse(p_q, p_from_year, p_sort, p_dir, p_limit=200)` + `contract_browse_stats` (lines 12-15), `unstable_cache` 1h (line 20). Default from-year 2020 (line 31).
- Row = buyer_key, buyer_name, contract_count, total_value, supplier_count, top_supplier (40-55). Rendered by `ContractSideBrowser` with caveat "AusTender: Commonwealth agencies only" (line 77) which is WRONG per lighthouse SKILL.md:22 and the DB: `austender_contracts` carries NSW eTender rows (verified below by the NSW/NT buyer names in the keyword query).
- No product filter, no supplier-side pitch, no save. It is a browse of who lets contracts. Linked from the shell header/nav (`components/shell/shell-header.tsx:29`, `shell.tsx:139`).

### 1c. /lighthouse skill

File: `.claude/skills/lighthouse/SKILL.md`
- Goal (line 8): ONE government buyer using a tender-pack. Chosen 2026-08-08: NSW DCJ.
- Stage 1 (12-17): `scripts/scout-se-buyers.mjs --apply` rebuilds `se_buyer_prospects`.
- Stage 2 (19-36): prioritise state buyers with obligations, IPP angle for federal, `se_supplier_count` + recent `last_contract_end`, `certified_supplier_count`, QLD via state_tenders (dates broken), VIC/SA (no data). Line 34: any figure computed before 2026-08-08 is inflated (ABN dedupe bug).
- Stage 3 (38-44): outreach pack = one-pager + `/procurement/tender-pack` + email draft, saved under `thoughts/shared/prospects/<slug>/`. Stage 4 (46-48): `thoughts/shared/prospects/PIPELINE.md`.
- Constraints (50-54): never send; every claim traceable; 3-5 prospects max.
- This skill is about selling CivicGraph's evidence product to a procurement team. It is NOT a Goods buyer finder, and nothing in it filters to what Goods sells.

State of that pipeline (`thoughts/shared/prospects/PIPELINE.md`, lines 5-13): NSW DCJ "pack built" 2026-08-08; NIAA "pack built + demo ready" 2026-06-09 (figures stale); Defence / Services Australia / DSS / PM&C on hold; QLD blocked on dates; VIC/SA blocked on ingest. Goal line 15-16: "Do not build a third until one of them is contacted". Nothing has been contacted. PIPELINE.md:18 says "417 buyers, rebuilt 2026-08-08"; the table holds 438 (query §2). Discrepancy unexplained (unverified which is right; DB is authoritative for today).

Packs on disk: `thoughts/shared/prospects/nsw-dcj/{one-pager.md, one-pager.provenance.md, email-draft.md, notes.md}`, `thoughts/shared/prospects/niaa/{one-pager.md, email-draft.md, notes.md, tender-pack-demo.md}`.

### 1d. docs/strategy/buyer-wedge.md

- Status line 4: **PROVISIONAL as of 2026-08-19**, superseded on completion of map #303. Lines 6-20: 438 buyer prospects, zero paying buyers, `api_keys` 0 rows; #303/#304 decided the payer is a place-based intermediary (council, land council, regional body), a second lane; "prefer #303 where they conflict".
- The sentence (24): free registry for everyone, paid evidence + tender tools for buyers.
- Move 3 (44-46): lighthouse buyer, amended 2026-08-08 to NSW DCJ. Move 5 (48): data widening PAUSED.
- Need-first search spec (60-74): "I need beds in [place]" → ranked evidenced SUPPLIERS. That is the supplier-side flip of what Goods needs (Goods needs "who buys beds in [place]").

### 1e. /procurement/* (buyer-side CivicGraph product, not Goods)

- `apps/web/src/app/procurement/page.tsx` (client): upload a supplier list → IPP/SME compliance, breakdowns, recommendations (lines 8-50). Buyer's tool.
- `apps/web/src/app/procurement/tender-pack/page.tsx` (client) + `apps/web/src/app/api/procurement/tender-pack/route.ts`: POST {lgas, postcodes, states, entity_types, keywords, ipp_target 3.0, sme_target 30.0} → verified supplier shortlist + compliance forecast + gaps + `policyInsertsForStates` (route.ts:1-60). `requireModule('procurement')` (route.ts:38).
- `apps/web/src/lib/social-procurement.ts:17-58`: policy inserts for VIC (SPF), QLD (Buy Queensland + QIPP 3%), NSW (SE Policy <$150K + APP 3%), SA (SAIPP 20% weighting, Aboriginal direct engagement ≤$550K, 0.5% target).
- `apps/web/src/app/entities/[gsId]/procurement-workspace-card.tsx`: shortlist membership / tasks / decision tags for an entity (lines 1-50), reads `procurement_shortlist*`.
- `scripts/check-contract-alerts.mjs` (agent `contract-alert-checker`, lines 1-22): new AusTender contracts for ABNs on watched shortlists → `procurement_alerts` + outbox. Scheduled 24h, enabled, last run 2026-09-23, 116 runs.

## 2. Tables and views (schemas verified via information_schema; counts measured)

```sql
SELECT 'se_buyer_prospects' AS tbl, count(*) AS n FROM se_buyer_prospects UNION ALL ... (20 tables)
```
| object | rows | note |
|---|---|---|
| se_buyer_prospects | 438 | scout output, computed_at 2026-08-08 |
| procurement_shortlists | 2 | both org `8b6160a1…` (ACT), both `draft`, created 2026-03-11, names "Test" and "Primary Procurement Shortlist" |
| procurement_shortlist_items | 5 | QLD/ACT suppliers (Camp Fire Group, Murri Watch ×2, Gunggandji, Yamagigu) |
| procurement_shortlist_events | 37 | last 2026-03-12 |
| procurement_shortlist_comments | 3 | |
| procurement_shortlist_watches | 1 | |
| procurement_pack_exports | 5 | |
| procurement_alerts | 53,223 | 53,222 are `donor_contract_crossover` from 2026-03-13/14 with NULL shortlist_id (debris); 1 `new_contract` 2026-06-13 |
| procurement_tasks | 2 | |
| goods_relationships (buyer) | 131 | of 321 total |
| goods_procurement_entities | 4,562 | last updated_at 2026-05-27 |
| goods_procurement_signals | 1,258 | all status new except 1 reviewing |
| buyer_entity_links | 13 | all `reviewed`, last 2026-09-21 |
| v_act_procurement_buyers | 215 | agencies buying data/evaluation/research/mapping/consultation/storytelling/Indigenous services ≥$25K in 3y (view def below). This is ACT-the-consultancy's buyer list, not Goods |
| v_nt_community_buyer_crosswalk | 23 | nt_communities × entity matches, regex-typed store/health/housing/council |
| v_nt_community_procurement_summary | 75 | per nt_communities row: buyer_match_count by type |
| v_goods_central_channels | 478 | community-controlled orgs in Alice Springs/MacDonnell/Central Desert/Barkly LGAs from `v_org_funding_profile`, archetyped by name regex, LEFT JOIN goods_relationships |
| goods_communities | 1,543 | |
| goods_products | 4 | Stretch Bed (active, $749 wholesale), washer (prototype, $2,200), fridge (planned), mattress (planned) |
| state_tenders | 199,719 | see §5 |

### se_buyer_prospects
Columns: buyer_name PK, se_supplier_count, contract_count, total_value, last_contract_end, certified_supplier_count, example_suppliers jsonb, states jsonb, computed_at, evidence_basis, gs_entity_id, link_method.
Built by `scripts/scout-se-buyers.mjs` BUILD_SQL (lines 36-93): TEMP `_se_abns` = DISTINCT ON (abn) from `social_enterprises` ordered certified>verified>identified; TRUNCATE; INSERT = `austender_contracts ac JOIN _se_abns se ON se.abn = ac.supplier_abn WHERE ac.buyer_name IS NOT NULL GROUP BY ac.buyer_name` (73-87); then `SELECT link_se_buyer_prospects()` (92) defined in `supabase/migrations/20260922090000_key_buyer_prospects_and_funders.sql:52-91` (graph_edge → unique gov name → unique any name; names <6 chars never match). Later migrations 20260922100000/130000/150000/160000/170000/180000 add `unique_name_no_prefix`, reviewed links via `buyer_entity_links`, and specific fixes (Queensland Health, NSW DPI).

```sql
SELECT count(*) n, count(gs_entity_id) linked, min(computed_at)::date, count(*) FILTER (WHERE last_contract_end >= '2025-01-01') active_2025 FROM se_buyer_prospects
-- 438 | 438 | 2026-08-08 | 199
SELECT link_method, count(*) FROM se_buyer_prospects GROUP BY 1
-- graph_edge 189 | unique_name_no_prefix 144 | unique_name 92 | reviewed 13
SELECT evidence_basis, count(*) FROM se_buyer_prospects GROUP BY 1  -- contract-dates 430 | disclosure-period 8
SELECT buyer_name, se_supplier_count se, certified_supplier_count cert, contract_count k, round(total_value/1e6,1) value_m, last_contract_end FROM se_buyer_prospects ORDER BY se_supplier_count DESC, total_value DESC LIMIT 15
-- Defence 273/218/3661/$2,462.7M | Services Australia 177/82/1398/$257.5M | PM&C 149/107/529/$155.6M | DSS 142/109/397/$3,983.0M
-- NIAA 134/109/367/$78.5M | QLD DoE 122/95/794/$366.6M | DISR 120/96/543/$586.6M | DAFF 99/71/469/$152.2M
-- NSW DCJ 91/29/383/$3,692.2M | Health & Aged Care 91/63/857/$1,157.8M | DFAT 88 | AEC 83 | ATO 73 | DEWR 67 | Home Affairs 66
```
Ranking = `se_supplier_count DESC, total_value DESC` (scout RANK_SQL lines 95-101). Scoring is a count, not a score. Note `states` = supplier states, not buyer (SKILL.md:24). Every row is now keyed to a gs_entity (438/438), so a place join is possible via `gs_entities.state/postcode/lga_name` on the buyer entity; unverified whether government_body entities carry postcodes.

Consumers: only `scripts/scout-se-buyers.mjs`, `scripts/jev-entity-match.mjs`, the migrations, and the lighthouse skill (grep). **No app page reads se_buyer_prospects.**

### goods_relationships (the buyer pipeline's source)
Columns (verified): id, relationship_type, display_name, entity_id, ghl_contact_id, ghl_opportunity_id, stage, target_stage, warmth_computed, warmth_override, warmth_display, last_touch_at, total_received_aud, alignment_score, has_prior_support, advocacy_score, next_action, next_action_due, warm_intro_path, source_refs jsonb, notes, created_at, updated_at, dedupe_key, ghl_signal jsonb, ask_amount_aud, ask_purpose, framing jsonb.
No product column. No place column. No tender/contract link. Place only via `entity_id → gs_entities`.

```sql
SELECT stage, count(*) n, count(entity_id) with_entity, count(ghl_opportunity_id) with_ghl_opp, round(avg(warmth_display)) avg_warmth, sum(total_received_aud) received, sum(ask_amount_aud) asks, count(next_action_due) with_due, count(last_touch_at) with_touch FROM goods_relationships WHERE relationship_type='buyer' GROUP BY stage ORDER BY n DESC
-- identified      92 | 9  | 87 | 14 | 0      | NULL | 2 | 87
-- researching     29 | 26 | 29 | 23 | 0      | NULL | 0 | 3
-- in_conversation  5 | 3  | 5  | 36 | 0      | NULL | 4 | 5
-- repeat           2 | 0  | 2  | 70 | 106150 | NULL | 0 | 2
-- proposal         2 | 0  | 1  | 43 | 0      | NULL | 1 | 1
-- contacted        1 | 0  | 0  | 16 | 0      | NULL | 1 | 1
```
So: 131 buyers, 129 "open", 38 entity-linked, `ask_amount_aud` NULL on all 131, `total_received_aud` on 2 rows ($106,150: "Centrecorp: 130 Stretch Beds, paid and delivered" 75 warmth and "Homeland School Company" 65). Only 8 rows have a `next_action_due`.

```sql
SELECT source_refs->>'pipeline' pipeline, count(*) n, count(*) FILTER (WHERE display_name ILIKE '%Goods Demand%') demand_named, count(entity_id) linked FROM goods_relationships WHERE relationship_type='buyer' GROUP BY 1
-- Goods — Demand Register | 76 | 59 | 5
-- (null: seed/gpe/asset register) | 33 | 0 | 30
-- Goods — Buyer Pipeline  | 22 | 0 | 3
SELECT count(*) demand_rows, count(c.id) match_community FROM goods_relationships r LEFT JOIN goods_communities c ON upper(c.community_name)=upper(split_part(r.display_name,' — ',1)) WHERE r.relationship_type='buyer' AND r.display_name ILIKE '%Goods Demand%'
-- 59 | 58
```
**Finding:** `scripts/sync-goods-ghl.mjs:50-54` maps BOTH GHL pipelines `Goods — Buyer Pipeline` (FjMyJM3YzWQFmKqR9fur) and `Goods — Demand Register` (UQsrmuqzxMSdCTklxEcG) to `relationship_type='buyer'`. The Demand Register holds community demand opportunities pushed by `scripts/push-goods-top25-to-demand-register.mjs` and the signals sync ("Goods Demand: LINGARA — Unmet demand: LINGARA (NT) — 17 beds, 2 washers"). 58 of 59 such rows name a `goods_communities` row exactly. So 45% of the "buyers" on the buyers tab are places with unmet demand, not organisations that buy. The Buyer Pipeline proper has 22 rows.

Warmest buyers (top of the tab today):
```sql
SELECT display_name, stage, warmth_display, last_touch_at::date, entity_id IS NOT NULL linked, ghl_opportunity_id IS NOT NULL ghl, left(next_action,50) FROM goods_relationships WHERE relationship_type='buyer' ORDER BY warmth_display DESC, last_touch_at DESC NULLS LAST LIMIT 15
-- Centrecorp: 130 Stretch Beds, paid and delivered | repeat 75 | 2026-09-06 | unlinked | ghl
-- Homeland School Company | repeat 65 | 2026-09-06 | unlinked | ghl
-- Centrecorp Foundation - 130 Stretch Beds - June 26 board | proposal 43 | 2026-08-10
-- Aboriginal Hostels Limited (AHL) | proposal 43 | no touch | "FOUNDER CONFIRM: where does the AHL proposal actua…"
-- Miwatj Health Aboriginal Corporation | in_conversation 39 | linked | "Ask Amy Elson to land the Regina intro…"
-- Anyinginyi Health Aboriginal Corporation | in_conversation 39 | linked | "Chase Tony Miles on the 9 Feb washer quote (4 unit…"
-- Centrebuild Pty Ltd | in_conversation 39 | linked
-- Laura McConnell Conti | in_conversation 32 (a person)
-- Hewitt Agriculture | in_conversation 32
-- then 6× "researching 24" community stores (Peppimenarti, Daguragu, Lajamanu, Milingimbi, Papunya, Ngukurr) with next_action "Review match evidence and open intro pathway."
```
Centrecorp appears twice (name-key dedupe cannot collapse "Centrecorp: 130 Stretch Beds…" vs "Centrecorp Foundation - 130 Stretch Beds…"), confirming the near-dup gap in memory.

Place coverage of linked buyers:
```sql
SELECT count(*) linked, count(e.postcode) with_postcode, count(e.lga_name) with_lga, string_agg(DISTINCT e.state, ',') FROM goods_relationships r JOIN gs_entities e ON e.id=r.entity_id WHERE r.relationship_type='buyer'
-- 38 | 36 | 31 | NT,QLD
SELECT count(DISTINCT r.id) buyers_linked, count(DISTINCT r.id) FILTER (WHERE g.community_id IS NOT NULL) buyers_with_community FROM goods_relationships r LEFT JOIN goods_procurement_entities g ON g.entity_id=r.entity_id WHERE r.relationship_type='buyer' AND r.entity_id IS NOT NULL
-- 38 | 27
```
So 27 of 131 buyers can already be tied to a Goods community through `goods_procurement_entities.community_id`; the join exists in the data and is not drawn anywhere on the buyers tab.

### goods_procurement_entities (the place-keyed buyer census)
Columns (verified): id, community_id, entity_id, gs_id, entity_name, abn, entity_type, buyer_role, procurement_method, estimated_annual_spend, current_supplier, contract_cycle, relationship_status, contact_surface, last_contact_date, product_fit ARRAY, fit_score, next_action, govt_contract_count, govt_contract_value, is_community_controlled, website, created_at, updated_at, ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id, ghl_stage_id, ghl_stage_name, ghl_last_pushed_at, ghl_last_synced_at.

```sql
SELECT buyer_role, relationship_status, count(*) n, count(community_id) with_community, count(entity_id) with_entity, count(ghl_opportunity_id) ghl_pushed, round(avg(fit_score),1) avg_fit, count(*) FILTER (WHERE product_fit IS NOT NULL AND array_length(product_fit,1)>0) with_product_fit, sum(govt_contract_value) govt_value FROM goods_procurement_entities GROUP BY 1,2 ORDER BY n DESC
-- community_org    prospect 2393 | 2392 | 0   | 0  | 1.3  | 0   | $725.0M
-- council          prospect  931 |  925 | 920 | 5  | 71.3 | 920 | $12,789.2M
-- health_service   prospect  421 |  419 | 340 | 2  | 60.9 | 340 | $722.4M
-- education        prospect  375 |  375 | 0   | 0  | 0.5  | 0   | $507.4M
-- other            prospect  220 |  220 | 0   | 0  | 9.4  | 0   | $2,152.7M
-- government       prospect  115 |  115 | 0   | 0  | 21.8 | 0   | $104.9M
-- housing_provider prospect   51 |   51 | 19  | 1  | 27.9 | 19  | $52.6M
-- store            prospect   23 |   21 | 20  | 18 | 85.6 | 20  | $19.8M
-- land_council 19 | aged_care 12 | art_centre 1 | disability_service 1
SELECT unnest(product_fit) pf, count(*) FROM goods_procurement_entities GROUP BY 1
-- bed 1299 | mattress 1294 | washer 959 | fridge 959
SELECT count(*), count(contact_surface), count(procurement_method), count(next_action), count(last_contact_date), count(current_supplier), count(website), max(updated_at)::date, count(*) FILTER (WHERE fit_score>=70) fit70, count(*) FILTER (WHERE fit_score>=85) fit85 FROM goods_procurement_entities
-- 4562 | 0 | 4550 | 1299 | 0 | 0 | 656 | 2026-05-27 | 1031 | 30
```
Every row is `relationship_status='prospect'`. `contact_surface`, `last_contact_date`, `current_supplier` are empty on all 4,562. 26 rows were pushed to GHL (the 18 stores + 5 councils + 2 health + 1 housing). The whole table has not been touched since 2026-05-27.

fit_score formula: `scripts/hydrate-goods-procurement.mjs:164-168`: +50 if the entity's OWN AusTender contracts (as supplier) match GOODS_KEYWORDS, +20 if total contract value > $1M, +15 if >10 contracts, +15 if any gs_relationships amount. `product_fit` set elsewhere (seed/census scripts; not traced). **So fit_score measures whether the org has SUPPLIED goods-shaped contracts to government, not whether it BUYS beds.** The 71-avg councils and 85-avg stores are scored as suppliers of government.

Readers (grep): `goods-community-detail.ts:389-390` (community dossier, 8 mapped buyers with PushToGhl), `goods-communities-hub.ts:117` (mapped/GHL counts per community), `goods-signals-workbench.ts` (local buyer per signal), `engagement/page.tsx:173` (footer text only), plus scripts. Not the buyers tab.

### goods_procurement_signals
```sql
SELECT signal_type, status, priority, count(*) n, count(buyer_entity_id) with_buyer, count(community_id) with_community, sum(estimated_value) FROM goods_procurement_signals GROUP BY 1,2,3
-- demand_unmet      new medium 945 | 631 | 945 | NULL
-- asset_end_of_life new medium 310 | 147 | 310 | NULL
-- demand_unmet      new high     2 |   2 |   2
-- demand_unmet      reviewing high 1 | 1 | 1
```
Generated by `scripts/goods-procurement-matcher.mjs` (scheduled 24h, enabled, 165 runs, last 2026-09-24): per priority community with demand_beds/washers>0 and no assets → `demand_unmet` signal (matcher.mjs:253-272); "best buyer match" = the community's `goods_procurement_entities` row with the highest `govt_contract_value` (207-213); then top-3 grants (`goods_relevance_score>=30`, geography, amount band; 91-142) and top-3 foundations (theme/geo; 145-156). `estimated_value` is NULL on every row. Actions on a signal: `apps/web/src/app/api/goods/signals/[id]/action/route.ts:7` track | review | dismiss | reset; `track` writes `saved_grants` (60-80). 1,257 of 1,258 are untouched (`new`).

### v_act_procurement_buyers (def via pg_get_viewdef)
`austender_contracts WHERE buyer_name IS NOT NULL AND contract_value >= 25000 AND date_published >= now()-3y AND lower(title||' '||description) ~ '\m(data|analytics|dashboard|…|evaluation|…|research|…|mapping|gis|…|consultation|engagement|co-design|storytelling|…|indigenous|first nations|aboriginal|torres strait)\M'` grouped by buyer with topic_score and category mix. This is ACT's consultancy buyer list (who buys evaluation/data/storytelling). Readers: `scripts/build-entity-graph.mjs`, `scripts/lib/graph-edge-datasets.mjs` only. Grants: anon/authenticated have INSERT/UPDATE/DELETE/TRUNCATE on the VIEW (harmless on a non-updatable view but sloppy; flag for the schema register).

### v_nt_community_buyer_crosswalk / v_nt_community_procurement_summary
Built on `nt_communities` (not `goods_communities`) via `v_nt_community_entity_matches`; buyer_type by regex on entity name (store/health/housing/council). 23 and 75 rows. No app reader found (grep). Superseded in spirit by `goods_communities.buyer_entity_count` (657 warm + 46 active + 13 lead communities have buyer entities):
```sql
SELECT priority, count(*) n, count(known_buyer_name) known_buyer, count(*) FILTER (WHERE buyer_entity_count>0) has_buyer_entities, sum(demand_beds) beds, count(postcode) with_postcode, count(lga_code) with_lga FROM goods_communities GROUP BY priority
-- warm 1150 | 657 | 657 | 58,323 | 1150 | 735
-- background 176 | 173 | 173 | 232 | 176 | 5
-- monitor 153 | 150 | 150 | 1,075 | 153 | 2
-- active 50 | 46 | 46 | 5,787 | 50 | 2
-- lead 14 | 13 | 13 | 6,717 | 14 | 2
```

### procurement_shortlists (the CivicGraph buyer workspace)
2 rows, both ACT org, `draft`, 2026-03-11, filters `{lga: brisbane, state: QLD, entity_types: [indigenous_corp, social_enterprise…]}`. Rich workflow schema (approval_status, approval_lock, pack exports, watches, tasks, comments, events) that was exercised once in March 2026 and never since (last event 2026-03-12). Readers: `scripts/check-contract-alerts.mjs`, `scripts/watch-schema-health.mjs`; app reads via the procurement-workspace-card + API routes under `apps/web/src/app/api/procurement/*`.

## 3. Where the prospects come from and how they are ranked (answering the brief)

| system | source of rows | ranking/score | product aware? | place aware? |
|---|---|---|---|---|
| Goods buyers tab (`goods_relationships` buyer) | GHL sync of two pipelines (98), seed from goods_procurement_entities engaged rows (26), asset-register curated (2: AHL, Outback Stores), manual (5) | `warmth_display` desc (Stage 40/Recency 20/History 20/Alignment 15/Advocacy 5), then received desc | no | only via entity_id (38/131) |
| goods_procurement_entities | AGIL community census + curated anchors (`seed-goods-communities.mjs`, `add-goods-anchor-buyers.mjs`, `backfill-goods-anchor-councils-acchos-2026-05-27.mjs`) | `fit_score` = supplier-side contract heuristic (hydrate.mjs:164-168) | `product_fit` array, but it is a role default (bed/mattress on all 1,299 scored rows; washer/fridge on 959), not evidence | yes, `community_id` on 4,552/4,562 |
| se_buyer_prospects | austender_contracts × social_enterprises ABNs | `se_supplier_count` desc, `total_value` desc | no (any SE supplier) | supplier states only; buyer entity keyed (438/438) |
| v_act_procurement_buyers | austender_contracts regex on consultancy words | contract_count / spend / topic_score | ACT services, not Goods | no |
| goods-repeat-buyer-intel.mjs report | austender_contracts by buyer, Goods keyword + UNSPSC | contract count ≥2, value | YES (furniture/bed/mattress/whitegoods…) | no; report only, `thoughts/shared/reports/goods-repeat-buyers-2026-05-28.{md,json}`, `--apply` is a no-op (script header lines 13-15), never re-run |

## 4. Actions that exist today

- Buyers tab: filter open / no-next; "Open in GHL ↗" (page.tsx:78-97). Nothing writes.
- Community dossier `/org/[slug]/goods/community/[communityId]`: "Buyers and procurement pathways" section (page.tsx:360-405) lists up to 8 mapped `goods_procurement_entities` with role/status/next_action and a **PushToGhlButton** (`push-to-ghl-button.tsx`) → `POST /api/goods/buyer/push-ghl` (`route.ts:14-94`, `requireModule('tracker')`) → `pushGoodsBuyerToGHL` (`goods-buyer-ghl.ts`) upserts a GHL contact by synthetic email `<entity>-<community>@goods.civicgraph.io` with tags `Goods-Community-*`, `Goods-State-*`, `Goods-Role-*`, `Goods-Stage-*` (lines 35-62), writes ghl ids back to `goods_procurement_entities` (route.ts:41-85). This is the one "find → act" path, and it lives on the community page, not the buyers page.
- Signals: track/review/dismiss/reset (`api/goods/signals/[id]/action/route.ts`).
- Engagement tab: inline stage/override/next-action editor (memory; `engagement/actions.ts`, not re-read).
- Money tab "Scrape more" button POSTs `/api/mission-control/tasks {agent_id:'sync-austender-open-tenders'}` (memory). It has never produced an `agent_runs` row (see §5).
- Channels tab (`/org/[slug]/goods/channels`, `goods-channels.ts`, `v_goods_central_channels`): 478 Central Australian community-controlled orgs by archetype with their goods_relationship stage if any. Read-only.
- GHL pull-back `scripts/sync-ghl-goods-buyers.mjs` (stage names → goods_procurement_entities): 1 run, 2026-05-13, not scheduled.
- GHL push `scripts/sync-goods-ghl.mjs` → goods_relationships: scheduled 12h, 213 runs, **91 ok** (122 not ok: status vocabulary caveat, not checked).

## 5. Tender feeds: is anything filtered to what Goods sells?

**Awarded contracts (`austender_contracts`, 824K)**: `title` has a trgm GIN index (`idx_austender_title_trgm`), `buyer_name` and `category` btree. So a Goods keyword query is index-backed and cheap:
```sql
SELECT kw, count(*) n, round(sum(contract_value)/1e6,1) value_m, max(date_published)::date latest, count(DISTINCT buyer_name) buyers FROM (
  SELECT 'mattress' kw, contract_value, date_published, buyer_name FROM austender_contracts WHERE title ILIKE '%mattress%' UNION ALL
  SELECT 'furniture', … WHERE title ILIKE '%furniture%' UNION ALL
  SELECT 'beds', … WHERE title ILIKE '% beds%' OR title ILIKE 'beds%' UNION ALL
  SELECT 'washing machine', … WHERE title ILIKE '%washing machine%' UNION ALL
  SELECT 'whitegoods', … WHERE title ILIKE '%whitegoods%' OR title ILIKE '%white goods%') x GROUP BY kw
-- furniture 273 | $98.7M | 2025-11-27 | 78 buyers
-- beds       69 | $442.6M (hospital beds dominate) | 2025-11-20 | 28
-- mattress   25 | $13.4M | 2025-06-03 | 20
-- washing machine 9 | $0.7M | 2025-01-02 | 7
-- whitegoods 7 | $1.1M | 2023-03-02 | 5
```
NT buyers with Goods-shaped contracts (buyer filter + trgm title):
```sql
SELECT buyer_name, count(*) n, round(sum(contract_value)/1e3) value_k, max(date_published)::date latest FROM austender_contracts WHERE (title ILIKE '%furniture%' OR title ILIKE '%mattress%' OR title ILIKE '% beds%' OR title ILIKE '%whitegoods%' OR title ILIKE '%washing machine%' OR title ILIKE '%white goods%') AND (buyer_name ILIKE 'NT %' OR buyer_name ILIKE '%Northern Territory%' OR buyer_name ILIKE '%Aboriginal Hostels%' OR buyer_name ILIKE '%Indigenous%') GROUP BY buyer_name ORDER BY n DESC LIMIT 12
-- NT DIPL Transport & Civil 15 | $27.0M | 2024-10-07 (aerodrome furniture, airstrips: noise)
-- NT DIPL Infrastructure Investment & Contracts 12 | $2.2M | 2023-07-06 (Alice Springs Correctional Centre supply & deliver…)
-- NT Health Top End 10 | $1.2M | 2020-12-10 (hospital beds, mattresses)
-- NT Health Central Australia 5 | $1.1M | 2023-09-20 ("Alice Springs - Remote Health Centres - Supply and…", "Accommodation - 60 Bradshaw Drive")
-- NT Health NT Health 3 | $3.0M | 2024-06-03 (hospital beds)
-- NT Chief Minister NADO 3 | $0.1M | 2016
```
So the revealed-demand answer exists in the data and is one query away, but no table or page holds it. `austender_contracts.category` is a free-text category ("Office furniture", "Fit out and Interiors", "Supply and Delivery / Public", "Tier 2 Quote / Selected"), not UNSPSC, so the UNSPSC gate in the open-tenders script does not apply to awarded rows.

**Open tenders (`scripts/sync-austender-open-tenders.mjs`)**: the only Goods-filtered feed. Flow (header lines 4-40): AusTender Current ATM RSS (~90 ATMs) → keyword pre-filter `GOODS_KEYWORDS` (66-70: furniture, bed, mattress, housing, accommodation, white goods, whitegood, appliance, washing, refrigerat, linen, fitout, fit-out, furnish, kitchen, laundry, fridge, freezer, dryer) → per-ATM page fetch → UNSPSC precision gate `56xx` + `GOODS_UNSPSC_PREFIXES ['5210','5212','5213','5214']` (81, 184-197) → upsert `grant_opportunities` `source='austender-open-tenders', discovery_method='procurement', status='open'`, scored by `goods-relevance.mjs` (+25 procurement boost). Registered in `scripts/lib/agent-registry.mjs:46-53`.
```sql
SELECT count(*) runs, max(started_at) FROM agent_runs WHERE agent_id='sync-austender-open-tenders' OR agent_name ILIKE '%open tender%'  -- 0 | NULL
SELECT agent_id, enabled, interval_hours FROM agent_schedules WHERE agent_id='sync-austender-open-tenders'  -- (no row)
SELECT source, discovery_method, status, count(*), max(created_at)::date, max(closes_at) FROM grant_opportunities WHERE source='austender-open-tenders' OR discovery_method='procurement' GROUP BY 1,2,3
-- austender-open-tenders | procurement | closed | 2 | 2026-05-27 | 2026-06-12
-- manual-research-2026-05-27 | procurement | ongoing | 1
```
The script does not import `log-agent-run` at all (grep returned nothing), so the Money-tab "Scrape more" button cannot leave a trace even if it fires. Net: **the open-tender feed ran once by hand on 2026-05-27, produced 2 now-closed rows, and has been dead for four months.** Ben chose this as the Phase 3 priority on 2026-05-27 (`thoughts/shared/plans/2026-05-27-goods-capital-procurement-pipelines-scope.md:3, 62-66`).

**State tenders (`state_tenders`, 199,719)**:
```sql
SELECT source, state, count(*) n, count(supplier_abn) with_abn, count(awarded_date) with_award_date, count(closing_date) with_close, max(coalesce(awarded_date,published_date))::date latest, count(*) FILTER (WHERE status ILIKE '%open%') open_status FROM state_tenders GROUP BY 1,2 ORDER BY n DESC
-- qld_doe_disclosure QLD 94,628 | 92,414 | 1,353 | 0 | 2025-09-30 | 0
-- qld_dcyjma_disclosure QLD 45,665 | 45,664 | 0 | 0 | 2023-05-31
-- qld_dcssds_disclosure QLD 37,494 | 37,494 | 0 | 0 | 2024-10-31
-- qld_dcsyw_disclosure QLD 15,466 | 14,295 | 0 | 0 | 2020-11-30
-- qld_corrective 3,503 | qld_desbt 1,628 | qld_dyj 688 | qld_dyjvs 599
-- vic_buying VIC 30 | 0 abn | 11 open-status
-- nsw_etender NSW 10 | qld_qtenders QLD 8
SELECT state, count(*) … FROM state_tenders WHERE state IN ('NT','WA') GROUP BY state  -- (0 rows)
```
`state_tenders` is a QLD disclosure archive (owned by JusticeHub per CLAUDE.md) with 11 open VIC rows. **Zero NT, zero WA, zero SA.** For Goods (NT/WA/QLD/SA remote communities) it is not a tender feed. `closing_date` is NULL on every row.

**NT $4B remote housing (Phase 4 of the plan)**: grep for "remote housing|DHLGCD|HomeBuild|Room to Breathe" hits only scorer keyword lists, a seed script, a wiki index, and the JEV pilot. No ingest. Still zero, as the plan's gap #3 said on 2026-05-27.

## 6. Linking a buyer prospect to a community or place (what is possible today)

Joins that already exist in the data:
1. `goods_procurement_entities.community_id → goods_communities.id` (4,552/4,562 rows). Communities carry state, postcode (1,543/1,543), lga_code (746), lat/long, demand_beds, land_council, nearest_staging_hub, freight corridor.
2. `goods_relationships.entity_id → goods_procurement_entities.entity_id → community_id` gives 27 of 131 buyers a community today (query §2).
3. `goods_relationships.entity_id → gs_entities.postcode/lga_name/state` gives 36/38 linked buyers a place.
4. `se_buyer_prospects.gs_entity_id → gs_entities` (438/438) — but government_body entities' postcodes unverified.
5. `austender_contracts.title` often starts with the NT region ("Alice Springs Region - …", "Darwin - …") and `buyer_name` carries the NT department; a place can be derived by text, not by column.
6. The Demand Register rows in goods_relationships ARE communities (58/59 match `goods_communities.community_name`), so they could be re-typed as community demand and linked by name today.
7. GHL tags already encode place (`place:community:belyuen`, `place:nt`) in `ghl_signal.tags` (sample §2).

What does not exist: a `community_id` or `place` column on `goods_relationships`; any buyer row that says which PRODUCT it buys; any join from a tender/contract row to a community.

## 7. JEV, as it touches buyers

`scripts/jev-entity-match.mjs` (header 1-45): suggests entity links for the buyer/funder names the deterministic linker refused (157/438 buyers, 179/846 funders), WRITES NOTHING, outputs `data/jev-check/entity-match.jsonl` + `thoughts/shared/findings/jev-entity-match-2026-09-21.md` (exists, 20.7KB, 2026-09-22). Human confirms → `buyer_entity_links` `reviewed` (13 rows, last 2026-09-21). That is the only Jev use in the buyer subsystem, and it is identity resolution, not buyer finding. Per memory, Jev cannot count/order dates, so it must never rank buyers by spend or recency.

## 8. What is missing to make "find buyers" usable for Goods THIS MONTH (judgement)

Ordered by leverage, smallest first:

1. **Split communities out of the buyer cohort.** Map the GHL Demand Register to a new `relationship_type` (or a `community_demand` flag) in `sync-goods-ghl.mjs:53` and re-run. Today 59 of 131 "buyers" are places. Until this is done every count on the buyers tab and the One Desk is wrong by ~45%.
2. **Put the revealed-demand list in a table and on the tab.** `goods-repeat-buyer-intel.mjs` already has the right predicate (word-boundary keywords + UNSPSC, `MIN_CONTRACTS=2`). Give it a real `--apply` into a small table (`goods_buyer_evidence` or a column set on `goods_procurement_entities`: goods_contract_count, goods_contract_value, latest_goods_contract, example_titles) and render it as a "buys beds/furniture: N contracts, $X, last YYYY" line on each buyer card. This is the one thing that turns warmth into evidence. The query is index-backed (trgm on title) and ran in seconds above.
3. **Bring `goods_procurement_entities` onto the buyers tab.** The tab reads only `goods_relationships`; the census with community, role, product_fit and fit_score is invisible there. A "Prospects by community" section (top fit_score per active/lead community, with the PushToGhl button that already exists on the community page) closes the find → act loop on one screen.
4. **Fix `fit_score` semantics.** hydrate.mjs:164-168 rewards orgs that SUPPLY government. For a buyer, the signal should be: buys Goods-shaped products (from #2), controls housing/health/store spend in a demand community, and has a live contact. Re-score after #2.
5. **Resurrect the open-tender feed or delete the button.** Add `sync-austender-open-tenders` to `agent_schedules` (daily), make it log to `agent_runs`, and surface `discovery_method='procurement'` rows on the buyers tab (today only the wiki goods-signals page badges them). Or remove "Scrape more" from the Money tab so it stops showing a confident nothing.
6. **Enter the asks.** `ask_amount_aud` is NULL on all 131 buyer rows, so the money hero, weighted pipeline and One Desk `amount` are empty. Miwatj, Anyinginyi (4-unit washer quote), AHL and Centrecorp have real asks in their `next_action` text. Ten minutes of data entry through the engagement editor.
7. **Dedupe Centrecorp / near-names** (known gap; two Centrecorp rows in the top 4).
8. **State tenders for NT/WA/SA**: none exist. This is an ingest project, not a this-month item; say so on the tab instead of implying coverage.
9. **The CivicGraph buyer-wedge machinery is not Goods' problem.** `se_buyer_prospects`, `/lighthouse`, `procurement_shortlists` sell evidence to procurement teams. Leave them, but do not let the redesign conflate "buyers" (who pays CivicGraph) with "buyers" (who buys a Stretch Bed). Two words, two products.

## 9. Debris and hygiene noticed

- `procurement_alerts`: 53,222 `donor_contract_crossover` rows dated 2026-03-13/14 with no shortlist. Nothing reads them by that type (unverified beyond grep of the script header).
- `/dashboard/browse/buyers` caveat says "Commonwealth agencies only"; the table has NSW and NT buyers.
- `v_act_procurement_buyers` grants INSERT/UPDATE/DELETE/TRUNCATE to anon and authenticated (view; no effect on a non-updatable view but wrong per the platform rules).
- `sync-goods-ghl`: 91 ok of 213 runs; not investigated.
- `goods_procurement_entities.updated_at` max 2026-05-27; `sync-ghl-goods-buyers` ran once 2026-05-13; `hydrate-goods-procurement` has no `agent_runs` rows (may never have been run through the orchestrator).
- PIPELINE.md says 417 prospects; the table has 438.

## 10. Files read this session (for the citations above)

apps/web/src/app/org/[slug]/goods/buyers/page.tsx · apps/web/src/app/dashboard/browse/buyers/page.tsx · .claude/skills/lighthouse/SKILL.md · docs/strategy/buyer-wedge.md · apps/web/src/lib/services/goods-buyer-pipeline.ts · goods-relationship-power.ts · goods-relationship-funding.ts · goods-engagement-shared.ts (nextBestAction) · goods-buyer-ghl.ts · goods-channels.ts (head) · goods-signals-workbench.ts (head) · goods-community-detail.ts (grep) · goods-communities-hub.ts (grep) · act-one-desk.ts (buyer block) · apps/web/src/app/org/[slug]/goods/page.tsx (grep) · _components/goods-sub-nav.tsx · _components/act-workspace-shell.tsx (grep) · community/[communityId]/page.tsx (grep) + push-to-ghl-button.tsx · api/goods/buyer/push-ghl/route.ts · api/goods/signals/[id]/action/route.ts · api/procurement/tender-pack/route.ts (head) · procurement/page.tsx (head) · procurement/tender-pack/page.tsx (head) · entities/[gsId]/procurement-workspace-card.tsx (head) · lib/social-procurement.ts (head) · scripts/scout-se-buyers.mjs · scripts/sync-austender-open-tenders.mjs (header + gate) · scripts/goods-procurement-matcher.mjs · scripts/hydrate-goods-procurement.mjs (keywords + fit) · scripts/goods-repeat-buyer-intel.mjs (head) · scripts/push-goods-top25-to-demand-register.mjs (head) · scripts/sync-goods-ghl.mjs (pipeline + stage map) · scripts/sync-ghl-goods-buyers.mjs (head) · scripts/jev-entity-match.mjs (head) · scripts/check-contract-alerts.mjs (head) · scripts/lib/goods-relevance.mjs (head) · scripts/lib/agent-registry.mjs (entries) · supabase/migrations/20260922090000_key_buyer_prospects_and_funders.sql · thoughts/shared/prospects/PIPELINE.md · thoughts/shared/prospects/nsw-dcj/notes.md (head) · thoughts/shared/plans/2026-05-27-goods-capital-procurement-pipelines-scope.md · data/schema-cache.md (austender) · memory: project_goods_command_center.md, project_supply_base_evidence_layer.md.
