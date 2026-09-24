# communities-and-projects — reader notes

Reader: subsystem `communities-and-projects`. Date: 2026-09-24. Repo: /Users/benknight/Code/grantscope (read-only).
All SQL below was run with `node --env-file=.env scripts/gsql.mjs "<sql>"` against project tednluwflfhxyucgwigh. Every file:line cites a file I read in this session.

## 0. Verdict in six lines

1. There is **no canonical ACT project list**. I found eight registries (JSON, three DB tables, three TS/MJS literals, one generated JSON), with three different code namespaces for the same project (Contained is `ACT-CN` in project-codes.json and `act_grant_recommendation_projects`, `ACT-JH-CT` in `org_projects`, slug `contained` in `ACT_PROJECTS`).
2. **Operating geography is encoded four ways and they disagree.** Goods is NT/QLD/WA in `apps/web/src/lib/act-grant-eligibility.ts:31`, NT/QLD/WA in `scripts/score-project-rubric.mjs:83`, home QLD,NT + secondary NSW,WA,SA,VIC in `act_grant_recommendation_projects`, and NT/WA/QLD/SA in `scripts/lib/goods-relevance.mjs:58`. No project row anywhere carries an LGA code or a community id; "Sunshine Coast" for Harvest/Farm is a TypeScript string literal (`act-grant-eligibility.ts:34-35`).
3. **The entity that can apply is wrong in the database.** `org_applicant_entities` has two rows: "A Curious Tractor" with `abn = 21591780066` (Nic's sole-trader ABN) + `acn = 697347676`, and A Kind Tractor Ltd. There is **no Butterfly Movement row**, the Pty ABN `36 697 347 676` appears nowhere in the DB, `act_entities` has one row (the sole trader), and `project_applicant_routes` (14 rows, all `direct`, all pointing at that one applicant, created by `applicant-route-backfill`) is read by no app code.
4. **Communities served exist in two unlinked shapes.** `act_communities` (3 hand-minted rows: Barkly, Urapuntja/Utopia, Bwgcolman/Palm Island) all have `geo = '{}'`, zero edges in `act_community_links`, zero obligations. `goods_communities` (1,543 rows) has a postcode on every row, but for the 60 NT lead/active communities `lga_name` is NULL on 52 and `lga_code` NULL on 58, while the correct NT council name sits in the **`local_government`** column (58/60) that no page or matcher reads. 236 NT rows say `lga_name = 'Laverton'` (a WA shire; postcode 0872 straddles NT/SA/WA).
5. **Grants carry almost no place.** Of 5,246 public grants with status open/upcoming/null, 2,859 (54%) have a `geography` string (state-level tokens like `AU-NSW`), **exactly one** has `metadata.place`, 7 record `dgr_required`, 365 `accepts_pty_ltd`. In the ALMA lane `act_grant_recommendations.geography_score = 0` on all 35,761 rows (21 of 23,705 opportunities are `is_national`, 337 have `jurisdictions`).
6. So "this grant fits Goods because it funds X in Barkly" cannot be computed today: there is no project→community edge, no community→LGA key for NT, no grant→LGA key, and no shared theme vocabulary. What exists is a state-level yes/no/unknown gate (`locationVerdict`) and keyword scores.

## 1. The project registries (eight of them)

### 1.1 `/Users/benknight/Code/act-global-infrastructure/config/project-codes.json` (declared source of truth)

- `_meta.description: "ACT Unified Project Codes - Use these codes across ALL systems"`, version 1.8.0, updated 2026-04-24 (lines 2-15). Systems listed: notion, supabase, ghl, xero, dext, empathy-ledger, alma, syndication.
- 78 project codes (`jq '.projects | length'`). Tiers: ecosystem / studio / satellite / background (lines 23-34). Statuses: active / ideation / sunsetting / archived / transferred.
- Per project it holds: name, code, canonical_slug, category, tier, priority, status, description, leads, notion ids, ghl_tags, xero_tracking, dext_category, alma_program, lcaa_themes, github/vercel/empathy_ledger ids. **Geography: only `ACT-HV` carries `location` / `place`** (`"9 Gumland Dr, Maleny QLD (601 Maleny Kenilworth Rd, Witta QLD 4552)"`, `"Gubbi Gubbi Country"`, lines 870-871). No state, LGA, region or community field exists on any other code (verified with `jq ... select(.value | has("location") or has("place") or has("state") or has("lga") or has("region") or has("communities") or has("geography"))`).
- The five "ecosystem" tier codes are ACT-JH, ACT-GD, ACT-EL, ACT-CORE, ACT-FM, ACT-HV, ACT-IN (seven carry tier=ecosystem despite `_meta` saying "The 5 core"). Contained is `ACT-CN` tier studio (line 920-925). CivicGraph is `ACT-CS` (legacy `ACT-CG`, lines 1581-1591) and there is a second `ACT-GS  GrantScope (CivicGraph)` code tier background.
- Place-shaped codes exist as *projects*: `ACT-BB Barkly Backbone` (ideation), `ACT-MN Maningrida` (archived), `ACT-PI PICC` (Palm Island), `ACT-BG BG Fit` "Mount Isa and Doomadgee" (line 1538, prose only).

### 1.2 `projects` table (81 rows) — a DB mirror of the JSON plus strays

```sql
SELECT code, act_project_code, name, category, tier, status, alma_program FROM projects ORDER BY code
```
81 rows. Columns: `code, name, description, category, tier, importance_weight, status, priority, leads, notion_page_id, notion_pages, ghl_tags, xero_tracking, dext_category, alma_program, lcaa_themes, cultural_protocols, parent_project, metadata, organization_id, act_project_code, external_references, cover_image_url`. Has `act_project_code` as a mapping column (e.g. `ACT-CG → ACT-CS`, `ACT-HQ → ACT-CORE`, `ACT-PC → ACT-PI`, `ACT-BV → ACT-BV` even though the JSON merged ACT-BV into ACT-FM on 2026-06-08). Extra codes not in the JSON: `ACT-AMT API Migration Test`, `ACT-APO`, `ACT-DLB DeadlyLabs`, `ACT-PB Place-Based Policy Lab`, `ACT-QD Quandamooka Justice and Healing Strategy`, `ACT-RS ReSOLEution`. Ownership seed says created by `justicehub,act`, read by five repos (`supabase/migrations/20260905140000_schema_ownership_seed.sql:783`). No geography column.

### 1.3 `org_projects` (14 rows for the ACT org) — the app's project list

```sql
SELECT p.code, p.slug, p.name, p.tier, p.category, p.status, p.abn, pp.code AS parent
FROM org_projects p LEFT JOIN org_projects pp ON pp.id = p.parent_project_id
WHERE p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0' ORDER BY p.sort_order, p.code
```
| code | slug | tier | parent |
|---|---|---|---|
| ACT-JH | justicehub | major | |
| ACT-JH-CG | civicgraph | sub | ACT-JH |
| ACT-JH-AL | alma | sub | ACT-JH |
| ACT-JH-CT | contained | sub | ACT-JH |
| ACT-PI | picc | major (abn 14640793728) | |
| ACT-PI-SP | station-precinct | sub | ACT-PI |
| ACT-PI-ER | elders-room | sub | ACT-PI |
| ACT-GD | goods | major | |
| ACT-HV | harvest | major | |
| ACT-FM | farm | major | |
| ACT-EL | empathy-ledger | major | |
| ACT-GP | gold-phone | major | |
| ACT-MY | mounty-yarns | major | |
| ACT-CORE | act-core | major | |

Only the ACT org has rows (`SELECT org_profile_id, count(*) FROM org_projects GROUP BY 1` → one group, 14). Constraints: `tier IN (major, sub, micro)`, `status IN (active, planned, archived)`, `UNIQUE (org_profile_id, slug)`. **Own code namespace**: `ACT-JH-CG`, `ACT-JH-CT`, `ACT-JH-AL`, `ACT-PI-SP`, `ACT-PI-ER` exist nowhere in project-codes.json. No place column; `linked_gs_entity_id` set only on PICC.

Metadata (`SELECT code, metadata->>'pillar', jsonb_object_keys(metadata) ...`): `funding_tags` on 4 of 14 (ACT-JH 10 tags, ACT-GD 11, ACT-EL 12, ACT-JH-CT 8), plus `required_grant_terms`, `blocked_grant_names`, `preferred_foundation_types`, `funding_brief`, `profile_summary`, `proof_points`, `source_paths` on those four. ACT-HV and ACT-FM carry only `{"pillar":"regenerative"}`; ACT-GP, ACT-MY, ACT-CORE are `{}`.

### 1.4 `act_grant_recommendation_projects` (12 rows) — the ALMA-lane scoring config

```sql
SELECT project_code, project_label, in_scope, layer, readiness, home_states, secondary_states, dgr_required, entity_preference, primary_funding_route, org_project_id IS NOT NULL, array_length(theme_keywords,1) FROM act_grant_recommendation_projects ORDER BY in_scope DESC, project_code
```
| code | label | in_scope | home | secondary | entity_preference | route | themes |
|---|---|---|---|---|---|---|---|
| ACT-CN | Contained | t | QLD,NSW,VIC | National | sole_trader_then_pty | grants | 12 |
| ACT-CORE | ACT Core | t | QLD,NSW | National | sole_trader_then_pty | overhead | 7 |
| ACT-CS | CivicGraph | t | QLD,NSW,VIC | National,ACT,WA,SA | sole_trader_then_pty | buyers | 13 |
| ACT-EL | Empathy Ledger | t | QLD,NSW | VIC,National,NT | sole_trader_then_pty | grants | 16 |
| ACT-FM | Farm / BCV | t | QLD | NSW | pty_ltd | grants | 23 |
| ACT-GD | Goods on Country | t | QLD,NT | NSW,WA,SA,VIC | sole_trader_then_pty | mixed | 18 |
| ACT-GP | Gold.Phone | t | QLD,NSW | VIC,National | sole_trader_then_pty | grants | 7 |
| ACT-HV | Harvest | t | QLD | NSW,National | pty_ltd | grants | 19 |
| ACT-JH | JusticeHub | t | QLD,NT | NSW,VIC,WA,National | sole_trader_then_pty | grants | 22 |
| ACT-MY | Mounty Yarns | t | QLD | NT | sole_trader_then_pty | grants | 13 |
| ACT-PI | PICC | t | QLD | NT,National | sole_trader_then_pty | grants | 18 |
| ACT-IN | Infrastructure/ALMA | **f** | QLD,NSW | VIC,National | sole_trader_then_pty | grants | 21 |

`dgr_required = false` on all 12; `act_context = {}` and `evidence_we_have = {}` on the three I checked (GD, HV, JH). `org_project_id` FK → `org_projects` maps the JSON code onto the org_projects code (`ACT-CN → ACT-JH-CT`, `ACT-CS → ACT-JH-CG`, `ACT-IN → ACT-JH-AL`), verified with a LEFT JOIN. Goods theme_keywords in full: `community | social procurement | supply nation | rural | place-based | ipp | circular | circular economy | nova peris | manufacturing | micro business | innovation fund | supply chain | goods | social enterprise | indigenous procurement policy | real innovation | indigenous enterprise`. Consumers: `apps/web/src/app/ops/grant-recommendations/page.tsx`, `apps/web/src/lib/services/act-project-apply-now.ts`, `act-atlas-context.ts:1180`, `act-research.ts`, `org-pipeline-service.ts`, and the `act_grant_recommendations_current` view.

### 1.5 `ACT_PROJECTS` in `apps/web/src/lib/act-grant-eligibility.ts:22-37` — the grants desk list

```ts
export type ActProject = 'goods' | 'justicehub' | 'empathy-ledger' | 'harvest' | 'farm' | 'contained';   // :22
export const ACT_PROJECTS = {
  goods:            { entities: ['pty','butterfly'], area: { national: false, states: ['NT','QLD','WA'], lgas: [] } },          // :31
  justicehub:       { entities: ['pty','akt'],       area: { national: true,  states: [], lgas: [] } },                         // :32
  'empathy-ledger': { entities: ['pty','butterfly'], area: { national: true,  states: [], lgas: [] } },                         // :33
  harvest:          { entities: ['pty','butterfly'], area: { national: false, states: [], lgas: [{ state:'QLD', lga:'Sunshine Coast' }] } }, // :34
  farm:             { ... same as harvest ... },                                                                                 // :35
  contained:        { entities: ['pty','butterfly'], area: { national: true,  states: [], lgas: [] } },                         // :36
};
```
Header (lines 1-4): "on 2026-09-14 only 7 of 3,088 live public grants recorded dgr_required and 302 recorded accepts_pty_ltd. Entities and places are Ben's answers of 2026-09-14." No codes, no ids. Consumers: `apps/web/src/app/org/[slug]/grants/page.tsx:7,33,119-125`, `apps/web/src/lib/services/act-grants-desk.ts:2,80-107`, tests `act-grant-eligibility.test.ts`. Six projects only; PICC, Mounty Yarns, Gold.Phone, CivicGraph, ACT Core are absent from the desk.

### 1.6 The scorers' lists (three more copies)

- `scripts/lib/project-relevance.mjs:35-100` `PROJECT_CONFIGS` for justicehub, empathy-ledger, harvest (`states: ['QLD']` :72), farm (`states: ['QLD']` :82), contained; keyword tiers tier1/tier2/tier3/disqualifiers. `PROJECT_CODES` at :203-208 maps the five slugs to `ACT-JH, ACT-EL, ACT-HV, ACT-FM, ACT-CN`. Goods is scored separately by `scripts/lib/goods-relevance.mjs` with `GOODS_GEOGRAPHIES = new Set(['AU-NT','AU-WA','AU-QLD','AU-SA'])` (:58) — note SA is here and not in the TS module.
- `scripts/score-project-rubric.mjs:78-104` `PROJECTS` (the JEV rubric): six projects with a prose `what` and an `area` **copied by hand** from the TS module (`goods: area { national:false, states:['NT','QLD','WA'] }` :83; harvest/farm `['QLD']` :95,:99). The header at :76 says "`area` is applied in CODE below, never asked of the model". `geographyExcluded()` at :148-159 is a state-string gate; unknown geography passes.
- `apps/web/src/lib/generated/wiki-support-index.json`: `generated_at 2026-04-28T03:21:17Z`, 6 projects (`goods ACT-GD`, `civicgraph ACT-CG` (legacy code), `justicehub`, `empathy-ledger`, `picc` (no code), `the-harvest ACT-HV`), each with `themes`, `search_terms`, `routes`. Read by `apps/web/src/lib/services/wiki-support-index.ts` and used as a fallback project source in `fast-local-org.ts:29-51` (`fastProjectFromWiki`).

### 1.7 Other project-shaped tables (not consulted by the money pages)

`clarity_project_code` (74 rows, synced 2026-08-16, columns code/name/category/tier/status/summary/repo), `ecosystem_projects` (7 rows, seeded 2026-01-25, describes JusticeHub as "Open justice data portal for Aotearoa" — seed junk), `notion_projects` (80), `studio_projects` (2), `project_profiles` (7), `project_strategic_profile` (8), `project_focus_areas` (12 rows keyed by JSON code; e.g. `ACT-PI ILA grant submission critical`), `org_profiles.projects` jsonb (7 items on the act row, with a `geographic` string per item, e.g. `"Witta, Sunshine Coast Hinterland, QLD"`), `location_project_rules` (73 rows). CRM-side link tables use the JSON codes plus strays: `communication_project_links` has `GOODS` (29) beside `ACT-GD` (161); `contact_project_links` uses ACT-JH/ACT-CORE/ACT-GD/ACT-HV.

### 1.8 Cross-walk for the six desk projects

| Desk slug (TS) | project-codes.json | org_projects code / slug | recommendation code | rubric key | wiki slug |
|---|---|---|---|---|---|
| goods | ACT-GD | ACT-GD / goods | ACT-GD | goods | goods |
| justicehub | ACT-JH | ACT-JH / justicehub | ACT-JH | justicehub | justicehub |
| empathy-ledger | ACT-EL | ACT-EL / empathy-ledger | ACT-EL | empathy-ledger | empathy-ledger |
| harvest | ACT-HV | ACT-HV / harvest | ACT-HV | harvest | the-harvest |
| farm | ACT-FM (ACT-BV merged in) | ACT-FM / farm | ACT-FM | farm | — |
| contained | ACT-CN | **ACT-JH-CT** / contained | ACT-CN | contained | — |

The only FK-backed link between any two registries is `act_grant_recommendation_projects.org_project_id → org_projects.id`.

## 2. Entities that can apply or contract

Legal truth per CLAUDE.md (ACT Context section): A Curious Tractor Pty Ltd ABN 36 697 347 676 / ACN 697 347 676 (trades as Goods on Country); The Butterfly Movement Ltd ABN 22 155 132 684 (Item 1 DGR + PBI since 2012, the only DGR vehicle); A Kind Tractor Ltd ABN 73 669 029 341 (charity, not DGR, dormant); Nicholas Marchesi sole trader ABN 21 591 780 066 (cutover to Pty 30 June 2026).

What the code and DB hold:

- `act-grant-eligibility.ts:8-20`: `ActEntity = 'pty' | 'butterfly' | 'akt'`; `ENTITY_FACTS` = pty {isCompany, no DGR}, butterfly {charity, DGR}, akt {charity, no DGR}. No ABNs. `entityVerdict` (:81-86) answers yes/no only when the grant recorded `dgr_required` or `accepts_pty_ltd`; otherwise unknown.
- `org_applicant_entities` (2 rows, `SELECT * FROM org_applicant_entities`): `A Curious Tractor` entity_type company, **abn 21591780066** (the sole-trader ABN), acn 697347676, `dgr_status unknown`, is_default true, note "Preferred operating/applicant vehicle ... once the Pty registration is complete. Replace the name, ABN, and graph link when registration lands." (updated 2026-08-30, verification_source org_profiles); `A Kind Tractor Ltd` charity abn 73669029341, is_default false. **No Butterfly row.** Ownership seed: "created by none found", read only by grantscope (seed :649).
- `act_entities` (1 row): `ACT-ST | Nicholas Marchesi T/as A Curious Tractor | sole_trader | 21591780066 | active_from 2024-01-01`. Owned by the act repo (seed :54).
- `project_applicant_routes` (14 rows): one per org_project, all `applicant_entity_id = 4ca51011-…` (the "A Curious Tractor" row), `route_type direct`, `status ready`, `is_default true`, `eligible_instruments {contract,commercial,grant_non_dgr}`, `constraints {"DGR-required opportunities need a separately verified endorsed route.", "Charity-only opportunities need an eligible charity or auspice route."}`, `created_by applicant-route-backfill`. Route type check allows `direct|charity|auspice|dgr|partner|commercial` but no `dgr`/`charity` route exists. **Zero consumers** in `apps/web/src` or `scripts` (grep); ownership seed says `unknown, no evidence` (seed :756).
- `org_profiles` act row: `abn 21591780066`, `acn 697347676`, `additional_abns {73669029341}`, `org_type Social Enterprise Ecosystem`, `linked_gs_entity_id 7ff9f2e8-…`. `ACT_FAST_PROFILE` in `fast-local-org.ts:4-19` hard-codes the same three numbers with the comment "sole trader (where the historical data lives)".
- `act_grant_recommendation_projects.entity_preference`: `sole_trader_then_pty` ×10, `pty_ltd` ×2 (FM, HV).

Judgement: the desk's entity gate is the only place Butterfly exists, and it exists as a boolean. Every DB row still says "sole trader first" three months after the declared cutover. `SELECT count(*) FROM gs_entities WHERE abn = '36697347676'` was not run (no unfiltered scan); the memory file `project_act_business_model.md:65` says a `Goods on Country` registry row with the Pty ABN was inserted 2026-06-08 — unverified here.

## 3. Operating geography — four encodings, no LGA anywhere

| Project | TS `ACT_PROJECTS.area` | rubric `PROJECTS.area` | recommendation home / secondary | relevance scorer | Ben's answer (memory 2026-09-14) |
|---|---|---|---|---|---|
| Goods | states NT,QLD,WA | NT,QLD,WA | QLD,NT / NSW,WA,SA,VIC | NT,WA,QLD,SA (`goods-relevance.mjs:58`) | "remote NT / QLD / WA communities" |
| Harvest | lga Sunshine Coast (QLD) | QLD | QLD / NSW,National | QLD (`project-relevance.mjs:72`) | Sunshine Coast Council QLD |
| Farm | lga Sunshine Coast (QLD) | QLD | QLD / NSW | QLD (:82) | Sunshine Coast Council QLD |
| JusticeHub | national | national | QLD,NT / NSW,VIC,WA,National | none | national |
| Empathy Ledger | national | national | QLD,NSW / VIC,National,NT | none | national |
| Contained | national | national | QLD,NSW,VIC / National | none | national |

Other place hints: `org_profiles.geographic_focus` = `Queensland, Australia, Palm Island, Sunshine Coast, Northern Territory, Witta, Jinibara Country, North Queensland` (free strings). `location_project_rules` (73 rows, owned by act repo, unread by grantscope) maps Xero expense localities to codes: Goods = ALICE SPRINGS, CICCONE, BRAITLING, MOUNT ISA, TENNANT CREEK, PALM ISLAND, MANINGRIDA, AMPILATWATJA, YULARA, ERLDUNDA, PETERMANN, DAVENPORT, CAIRNS; Farm = MALENY, WITTA, MOOLOOLAH, PALMWOODS, BEERWAH, MAROOCHYDORE, LANDSBOROUGH, GLASS HOUSE, MAPLETON, NORTH LAKES; Harvest = GARBUTT/TOWNSVILLE/KIRWAN… (labelled "Townsville — Harvest/PICC", which contradicts Harvest = Witta); ACT-IN = Slovenia, Budapest, Berlin, Doha (travel). It is an expense auto-tagger, not a geography.

How the TS module matches place (`act-grant-eligibility.ts`): `grantPlace(geography, place)` :49-60 prefers `metadata.place` ({national|state|lga_name}) then tokenises `geography` on commas, strips `AU-`, keeps tokens in the 8-state list, `NATIONAL` → national; anything else → `known:false`. `locationVerdict` :65-78: unknown → unknown; national → yes; LGA present → name-normalised match against the project's `lgas` (`norm` :62 strips city/shire/regional/council/of) else `no` (or `unknown` for national projects); state list → intersection with `area.states ∪ lgas[].state`. So Harvest/Farm answer `yes` to any `AU-QLD` grant (test :37) — the LGA only ever *narrows* when the grant itself carries an LGA, which one grant does (§7).

## 4. Themes — five vocabularies

1. `org_projects.metadata.funding_tags` (4 projects; e.g. ACT-GD: circular economy, indigenous partnership, remote communities, manufacturing, durable goods, housing, community infrastructure, procurement, employment, plastic waste, social enterprise) + `required_grant_terms`, `blocked_*`. Read by `org-dashboard-service.ts:1199-1233` (`getMatchedGrantOpportunities`, keyword ranking; it explicitly drops `geography` from the output at :1265-1268).
2. `act_grant_recommendation_projects.theme_keywords` (7-23 per project) → `theme_score_raw` in the recommendation view = 10 × distinct keyword hits against `focus_areas || keywords`, capped 50 (baseline :19945-19950).
3. `project-relevance.mjs` tier1/2/3 keyword sets + `goods-relevance.mjs` sets (`GOODS_SHAPE_TIER2`, `IDENTITY`, capital/procurement terms :186-198).
4. `score-project-rubric.mjs` `what` prose per project, judged by JEV "THEME AND PURPOSE only. Ignore geography…" (:128).
5. project-codes.json `alma_program` (Goods = economic-empowerment), `category`, `lcaa_themes`; wiki-support-index `themes` (Goods 5); `org_profiles.domains` (30 strings).

None of these reference each other; none carry a source or date.

## 5. Where communities served are stored

### 5.1 `act_communities` — the CONTEXT.md "Community" (3 rows)

Spec: `docs/specs/community-records-spec.md` (decided 2026-08-06): "A Community is a place ACT is deliberately engaged with — Barkly, Utopia (Urapuntja), Palm Island (Bwgcolman). Human-minted… Identity is the name Ben's team actually uses, not an ABS code… Geo codes are annotations, not identity… A Community with zero geo codes is valid." `CONTEXT.md:76-86` repeats it. ADR `docs/adr/0004-communities-live-in-supabase.md`: Supabase-native, GHL involvement zero.

```sql
SELECT slug, name, minted_by, minted_at::date, geo::text, left(notes,120) FROM act_communities ORDER BY minted_at
-- barkly      | Barkly                  | ben-charting-2026-08-06 | 2026-08-06 | {} | Tennant Creek and the Barkly region — Goods channels and delivery relationships.
-- utopia      | Urapuntja (Utopia)      | ben-charting-2026-08-06 | 2026-08-06 | {} | Utopia homelands, Alyawarre and Anmatyerre country.
-- palm-island | Bwgcolman (Palm Island) | ben-charting-2026-08-06 | 2026-08-06 | {} | Palm Island community.
SELECT count(*) FROM act_community_links   -- 0
SELECT count(*), count(community_id) FROM act_obligations   -- 0 | 0
```
Columns: `id, org_profile_id, name, slug, notes, geo jsonb, minted_by, minted_at`. Edge table `act_community_links(community_id, subject_type org|person, subject_ref text, link_type in|distributes-into|anchored-in)` — `subject_ref` is free text, no FK to `gs_entities`/`org_contacts`. Consumers: `apps/web/src/lib/services/act-communities.ts:55-135`, `act-obligations.ts`, `app/org/[slug]/goods/we-owe/page.tsx`. **All three `geo` values are `{}`**, so the record page's postcode/LGA rows (`communities/[community]/page.tsx:114-125`) never render.

### 5.2 `goods_communities` — the operational register (1,543 rows, 82 columns)

Place columns: `state, postcode, lga_name, lga_code, region_label, service_region, land_council, remoteness, latitude, longitude, local_government, agil_code, bushtel_id, abs_iloc_code, abs_sal_code`. Need/supply: `demand_beds…, assets_deployed, occupied_dwellings, overcrowded_dwellings, overcrowded_pct, additional_bedrooms_needed, dss_*`. Money: `total_govt_contract_value, total_justice_funding, total_foundation_grants`.

```sql
SELECT count(*) n, count(postcode), count(lga_code), count(lga_name), count(abs_iloc_code), count(land_council), count(region_label), count(service_region), count(DISTINCT lga_name), count(DISTINCT state) FROM goods_communities
-- 1543 | 1543 | 746 | 1369 | 187 | 669 | 77 | 71 | 84 | 8
SELECT state, priority, count(*), count(lga_code), count(lga_name), count(abs_iloc_code), count(overcrowded_dwellings), sum(demand_beds) FROM goods_communities GROUP BY 1,2
-- NT lead 14 rows: lga_code 2, lga_name 2, iloc 14, overcrowding 14, demand 6,717 beds
-- NT active 46: lga_code 0, lga_name 6, iloc 39, overcrowding 39, demand 5,503
-- NT warm 408: lga_code 2, lga_name 327; NT background 171; NT monitor 151
-- QLD warm 197 (lga_code 188); WA warm 341 (341); SA warm 142 (142); NSW warm 55; also 1 ACT, 4 TAS, 2 VIC
SELECT count(*) FILTER (WHERE lga_name IS NULL), count(*) FILTER (WHERE lga_code IS NULL), count(*) FROM goods_communities WHERE state='NT' AND priority IN ('lead','active')
-- 52 | 58 | 60
SELECT count(*), count(local_government), count(region_label), count(land_council) FROM goods_communities WHERE state='NT' AND priority IN ('lead','active')
-- 60 | 58 | 56 | 58
```
So for the 60 NT lead/active communities the ABS-style `lga_name`/`lga_code` are missing on 52/58, but **`local_government`** holds the council on 58 (Macdonnell 11, Central Desert 10, East Arnhem 8, Roper Gulf 8, Barkly 5, West Arnhem 4, Victoria Daly 4, Tiwi Islands 3, West Daly 2, Alice Springs 1, Katherine 1, Belyuen 1). Nothing reads `local_government` for matching: `goods-community-detail.ts:374-378` joins `phidu_lga_health` on `lga_code` (null for 58/60), `goods-communities-hub`/`v_goods_community_priority` join SEIFA on `postcode`, `act-barkly-field.ts:500-504` selects by `state` + ILIKE on `region_label, service_region, community_name`.

**Mis-joined LGAs:**
```sql
SELECT g.lga_name, count(*), string_agg(...) FILTER (WHERE priority IN ('lead','active')) FROM goods_communities g WHERE g.state='NT' AND g.lga_name NOT IN (SELECT DISTINCT lga_name FROM postcode_geo WHERE state='NT' AND lga_name IS NOT NULL) GROUP BY 1
-- Laverton | 236 | ALPURRURULAM, MUTITJULU, PMARA JUTUNTA
-- Carpentaria | 2
SELECT postcode, state, count(*) FROM goods_communities WHERE lga_name='Laverton' GROUP BY 1,2   -- 0872 | NT | 236
SELECT state, lga_name, count(*) FROM postcode_geo WHERE postcode='0872' GROUP BY 1,2
-- NT: Alice Springs 1, Barkly 6, Central Desert 11, MacDonnell 23, Unincorporated NT 1; SA: APY 3; WA: Ngaanyatjarraku 1; null 34
SELECT postcode, count(DISTINCT lga_name) FROM postcode_geo WHERE postcode IN ('0822','0852','0872','0880','0860') GROUP BY 1
-- 0822 → 14 LGAs; 0852 → 5; 0860 → 1 (Barkly); 0872 → 7; 0880 → 2
```
Laverton WA is not even in the 0872 list, so the 236 rows came from an older postcode join. Postcode → LGA cannot backfill remote NT (0822 spans 14 councils). Other wrong rows seen: GAWA lga_name Palmerston; LANGI (QLD, lga Aurukun) with `land_council = Tiwi Land Council`; KALKA (SA) with Central Land Council; ALPURRURULAM lga Laverton but `local_government`/`region_label` Barkly. Provenance: `data_sources` agil 1,537 / postcode_geo 750 / bushtel 670; `bushtel_id` 0 rows populated; `abs_sal_code` 0; `abs_iloc_code` 187 (the 2026-08-24 backfill per memory `project_goods_supply_context.md`).

### 5.3 `nt_communities` (75 rows) — the older NT list the buyer crosswalk hangs off

Columns: `community_name, aliases, state, region_label, service_region, land_council, postcode, remoteness, is_official_remote_community, goods_focus_priority (background|lead), goods_signal_*, known_buyer_name, demand_beds, demand_washers, proof_line`. 71 of 75 names match `goods_communities` by upper(name); no FK between them. `v_nt_community_entity_matches` and `v_nt_community_buyer_crosswalk` are built `FROM nt_communities c CROSS JOIN LATERAL (aliases)` matched to `gs_entities` by name regex (exact_name 40 / exact_community 36 / community_word …), then filtered to store/health/housing/council names. So "buyers in community X" is keyed to this 75-row table, not to the 1,543-row register the hub shows.

### 5.4 `ACT_PLACE_FIELDS` in `apps/web/src/lib/services/act-place-fields.ts:43-170` (2 TS literals)

`barkly` (kind region, state NT, `memberCommunities: ['Tennant Creek','Ali Curung','Alpurrurulam','Ampilatwatja','Canteen Creek','Elliott','Epenarra','Mungkarta']`, `queryTerms ['Barkly','Tennant Creek']`, 28 Barkly Regional Deal initiatives, five outcomes) and `palm-island` (kind community, QLD, `memberCommunities ['Palm Island']`). `/org/[slug]/barkly/page.tsx:22` redirects to `/org/[slug]/explore/place/barkly`, whose page calls `loadActPlaceField` (`act-barkly-field.ts:492-560`): `goods_communities` by `state = place.state` + `or(region_label/service_region/community_name ILIKE %Barkly%|%Tennant Creek%)`, `gs_entities` by state + ILIKE on `lga_name/canonical_name` (limit 500), `justice_funding` by state + ILIKE on location/recipient/program (limit 24, **no measure_kind filter** — see CLAUDE.md filter 1), then `org_contacts` by linked entity and `austender_contracts` by supplier ABN. `memberCommunities` is never used for the query; it is display text.

### 5.5 Others

`alma_community_contexts` (10 rows) are ALMA case contexts (Alice Springs Intake and Transfer Facility, Holtze, NSW Youth Justice…) not ACT communities. `org_profiles.geographic_focus` (§3). `goods_relationships` has no place column at all (only `entity_id`). `org_pipeline` carries `project_code`/`project_id`/`funder_entity_id`, no place.

### 5.6 Barkly worked example (the brief's sentence)

- `act_communities.barkly`: geo `{}`.
- `goods_communities` rows that could be Barkly, keyed three different ways (`WHERE lga_name ILIKE '%barkly%' OR region_label ILIKE '%barkly%' OR service_region ILIKE '%barkly%' OR community_name ILIKE '%tennant%' OR community_name ILIKE '%utopia%'` → 24 rows): `lga_name = 'Barkly'` on 16 (incl. ARLPARRA/ARAWERR stamped `lga_code 70420`, per the Utopia ruling), `region_label = 'Barkly'` on 8 (ALPURRURULAM lga Laverton, AMPILATWATJA/CANTEEN CREEK/WUTUNUGURRA/ALI CURUNG/TARA with null lga, KYBROOK FARM lga Victoria Daly), TENNANT CREEK (lead, `assets_deployed 146`, `demand_beds 0`, lga null, region Barkly); `local_government = 'Barkly'` on 87 rows (5 lead/active).
- LGA matviews resolve it: `mv_funding_by_lga` → `Barkly | NT | 70420 | 126 entities | $614,845,973.98` (plus a second `Barkly | null state | 70420 | 5 | 0` row); `mv_funding_deserts` → two rows `Barkly | NT | desert_score 150` and `120` (grain not unique per CLAUDE.md).
- Grant side: no grant row carries `70420` or `Barkly` in a structured field; `alma_funding_opportunities.regions` values include `Mount Isa (2), Central Australia (1), Mparntwe (1), Eastern Arrernte Country (1)` — 23 rows total have any region.

## 6. Pages and what they read

| Route | Service | Tables |
|---|---|---|
| `/org/[slug]/communities` (`communities/page.tsx`, "Quiet Ledger" skin, ACT-only via `isActSlug`) | `act-communities.ts:getCommunities` | `act_communities`, `act_community_links` (count), `act_obligations` (open count) |
| `/org/[slug]/communities/[community]` (`[community]/page.tsx`) | `getCommunityRecord` | same + `goods_relationships` by `display_name` for warmth; renders `geo.postcodes`/`geo.lga_codes` when present (:114-125) |
| `/org/[slug]/projects` (`projects/page.tsx:25-139`) | `act-cross-projects.ts:56-143` | `org_projects` (status active, by sort_order), `org_pipeline` matched by `project_code` OR `project_id` (:88), `org_project_foundations` by `org_project_id`. Comment :10-11: owner/next_action "100% empty across all 125 pipeline rows". Pipeline rows by code: ACT-CORE 31, ACT-GP 13, ACT-IN 13 (no org_project → dropped), ACT-EL 12, ACT-GD 11, ACT-HV 7, ACT-MY 6, ACT-FM 6, ACT-PI 4, ACT-CS 4 (no org_project code match → dropped), ACT-JH 3, ACT-CN 2 (dropped; org code is ACT-JH-CT). Foundations per project: EL 295, PI 283, JH 275, FM 265, GD 247, HV 188 |
| `/org/[slug]/[projectSlug]` (2,055 lines) | `getOrgProjectBySlug` (`org-dashboard-service.ts:382-393`, `org_projects` by slug) + `wiki-support-index` + `getMatchedGrantOpportunities` (:1180-1275, keyword rank over `grant_opportunities`, 200 due + 200 fresh) | |
| `/org/[slug]/[projectSlug]/funding` | `act-project-apply-now.ts` | `act_grant_recommendations_current` joined through `act_grant_recommendation_projects.org_project_id` (header :14-17) |
| `/org/[slug]/goods/communities` (`goods/communities/page.tsx`) | `goods-communities-hub.ts` | `goods_communities` + `v_goods_community_priority` (SEIFA IRSD by postcode → `serve_next_score = unmet_beds × (1 + (10-decile)/9)`) |
| `/org/[slug]/goods/community/[communityId]` | `goods-community-detail.ts:358-635` | `goods_communities`, `abs_iloc_health`, `phidu_lga_health` (by `lga_code`), `goods_procurement_entities` (FK community_id → goods_communities), `gs_entities` by postcode, `goods_procurement_signals.matched_grant_ids` → `grant_opportunities` (:447-462), `foundations`, `goods_asset_lifecycle`, `goods_deployment_batches`, `mv_funding_by_postcode`, GHL/contact links |
| `/org/[slug]/barkly` → `/org/[slug]/explore/place/[placeSlug]` | `act-place-fields.ts` + `act-barkly-field.ts` | §5.4 |
| `/org/[slug]/grants` (admin-gated, `grants/page.tsx:60-72`) | `act-grants-desk.ts` | `grant_opportunities` (status open/ongoing/upcoming, paged 1000) + `act_private_grant_rounds`; `projectEligibility` × 6 projects per grant (:95-102); fit from `goods_relevance_score` and `project_relevance.<project>.score` (:80-87); project view hides `overall === 'no'` and fit < 20 (`page.tsx:80-87`) |
| `/ops/grant-recommendations` | | `act_grant_recommendation_projects` |

## 7. How a grant is matched to a project and a place today

### 7.1 Public corpus (`grant_opportunities`)
```sql
SELECT count(*) n, count(*) FILTER (WHERE geography IS NOT NULL AND geography <> '') with_geography,
       count(*) FILTER (WHERE metadata ? 'place') with_place,
       count(*) FILTER (WHERE metadata->'place'->>'lga_name' IS NOT NULL) place_lga,
       count(dgr_required) dgr_recorded, count(accepts_pty_ltd) pty_recorded,
       count(*) FILTER (WHERE aligned_projects IS NOT NULL AND array_length(aligned_projects,1)>0) with_aligned_projects,
       count(project_relevance) with_project_relevance
FROM grant_opportunities WHERE status IN ('open','upcoming') OR status IS NULL
-- 5246 | 2859 | 1 | 1 | 7 | 365 | 104 | 5246
SELECT geography, count(*) FROM grant_opportunities GROUP BY 1 ORDER BY 2 DESC LIMIT 15
-- '' 20013 | AU-NSW 2019 | AU-WA 1132 | QLD 907 | AU-National 602 | AU-QLD 384 | National 247 | AU-VIC 240 | national 229 | AU-NT 150 | AU-TAS 119 | AU-ACT 119 | AU-SA 100 | VIC 93 | 'AU-WA, AU-QLD, AU-National, International' 52
SELECT metadata->'place'->>'state', metadata->'place'->>'lga_name', count(*) FROM grant_opportunities WHERE metadata->'place'->>'lga_name' IS NOT NULL GROUP BY 1,2
-- QLD Fraser Coast 1 | QLD Gold Coast 1 | QLD Brisbane 1 | VIC Glenelg 1   (4 rows over all statuses; none Sunshine Coast)
SELECT unnest(aligned_projects), count(*) FROM grant_opportunities WHERE aligned_projects IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20
-- ACT-HV 213 | WATCH 133 | ACT-GD 67 | goods 63 | ACT-OO 24 | ACT-CORE 19 | ACT-JH 19 | ACT-PI 16 | ACT-FM 14 | ACT-CN 11 | ACT-AI 10 | ACT-EL 9 | harvest 9 | ...   (mixed code + slug namespaces)
```
Live fit signal:
```sql
SELECT k, count(*), count(*) FILTER (WHERE (project_relevance->k->>'score')::numeric >= 20), count(*) FILTER (WHERE project_relevance->k->'signals'->>'geography' IS NOT NULL)
FROM grant_opportunities, jsonb_object_keys(project_relevance) k WHERE status IN ('open','ongoing','upcoming') GROUP BY 1
-- contained 3110 scored / 2 ≥20 / 0 geo ; empathy-ledger 3110 / 1 / 0 ; farm 3110 / 4 / 1026 ; harvest 3110 / 4 / 1026 ; justicehub 3110 / 6 / 0 ; rubric_meta 359 ; tag_changes 28
SELECT count(*), count(goods_relevance_score), count(*) FILTER (WHERE goods_relevance_score >= 20), count(*) FILTER (WHERE goods_relevance_score >= 60) FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming')
-- 3169 | 3169 | 917 | 27
```
The `geography` signal exists only for farm/harvest because only they have `states` in `PROJECT_CONFIGS` (`project-relevance.mjs:161-168`: "projects scoped to specific states get a small boost"). Writers: `scripts/score-project-relevance.mjs`, `scripts/score-goods-relevance.mjs` (agent `score-goods-relevance`, `agent-registry.mjs:1221`), `scripts/score-project-rubric.mjs` (JEV).

### 7.2 JEV rubric (`scripts/score-project-rubric.mjs`)
Writes `project_relevance.<project>.rubric = { score, confidence, geography_excluded? }` (:31). The model judges theme only (:128); geography is `geographyExcluded()` in code (:148-159), state-string based, unknown passes. Goods joined the rubric on 2026-09-24 (:79-80, PR #520 per git log) but no live row has `goods.rubric` yet:
```sql
SELECT count(*) FILTER (WHERE project_relevance ? 'rubric_meta'), count(*) FILTER (WHERE project_relevance->'goods'->'rubric' IS NOT NULL), count(*) FILTER (WHERE (project_relevance->'harvest'->'rubric'->>'geography_excluded')::boolean) FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming')
-- 359 | 0 | 203
```
JEV pilot (`scripts/jev-pilot/README.md`): evaluates replacing the chat-model eligibility enricher for `dgr_required`/`accepts_pty_ltd`; "Use Choice, not Noul". JEV never sees place or community data anywhere in this subsystem.

### 7.3 ALMA lane (`act_grant_recommendations` → `act_grant_recommendations_current`)
```sql
SELECT project_code, count(*), count(*) FILTER (WHERE geography_score > 0), count(*) FILTER (WHERE is_strong_fit) FROM act_grant_recommendations GROUP BY 1
-- 11 projects × 3,251 opportunities; geo_gt0 = 0 for every project; strong: PI 290, GD 60, MY 49, JH 20, FM 10, HV 7, others 0
SELECT max(computed_at), count(DISTINCT opportunity_id) FROM act_grant_recommendations   -- 2026-09-23T20:35:37Z | 3251
SELECT count(*), count(*) FILTER (WHERE is_national), count(*) FILTER (WHERE jurisdictions IS NOT NULL AND cardinality(jurisdictions)>0), count(*) FILTER (WHERE regions IS NOT NULL AND cardinality(regions)>0) FROM alma_funding_opportunities
-- 23705 | 21 | 337 | 23
```
`geography_score` is `CASE WHEN o.is_national THEN 15 WHEN o.jurisdictions && pt.home_states THEN 15 WHEN o.jurisdictions && pt.secondary_states THEN 9 ELSE 0 END` (baseline `supabase/migrations/20260905130000_baseline_remote_schema.sql:19952-19957`), and since `is_national`/`jurisdictions` are empty on >98% of opportunities it is 0 on every recommended row. The view's `eligible` CTE then excludes by `ok_states` (home ∪ secondary) using `jurisdictions` or a funder-name regex ("Victorian Government" → VIC) — `scripts/sql/2026-08-08-geography-and-program-dedupe.sql:6-17` explains: "94% of rows declare no jurisdiction, so the funder name is the fallback". `is_strong_fit` additionally requires `geography_score > 0 OR max ≥ $50k OR won_funder`, so with geography dead it is the dollar threshold doing the work.

### 7.4 Goods per-community grants
`goods_procurement_signals` (1,258 rows, FK community_id → goods_communities) all carry `matched_grant_ids`; 954 communities have at least one. The detail page lists them (`goods-community-detail.ts:453-462`). How the ids were assigned is in `scripts/goods-procurement-matcher.mjs` (writer of `goods_relevance_score` per grep) — **not read this session; method unverified**. Buyers: `goods_procurement_entities` 4,562 rows, 4,551 with community_id, 912 communities.

### 7.5 Keyword matcher on project pages
`getMatchedGrantOpportunities` (`org-dashboard-service.ts:1180-1275`) builds `keywordTerms` from org_projects name/description/profile_summary/funding_brief/proof_points and `priorityTerms` from `funding_tags`/`required_grant_terms`, ranks 400 candidate rows, and strips `geography` and `target_recipients` from the result (:1265-1268). No place.

## 8. What is missing to make "this grant fits Goods because it funds X in Barkly" computable

A. **One project identity.** Pick `org_projects.id` (the only thing with FKs) or the JSON code, and make the TS `ActProject` slugs, `PROJECT_CONFIGS`, rubric `PROJECTS`, `aligned_projects` values (`ACT-GD` and `goods` both present), and `communication_project_links.GOODS` resolve to it. Today the desk's six slugs are a hand list that skips PICC and Mounty Yarns (which carry 290 and 49 strong ALMA fits respectively).

B. **Entity truth in the DB.** A Butterfly row in `org_applicant_entities` with ABN 22155132684 and `dgr_status = endorsed`; the Pty ABN 36697347676 on the "A Curious Tractor" row (it still carries the sole-trader ABN with `dgr_status unknown`); `project_applicant_routes` rows of type `dgr` for the Butterfly-eligible projects, and a consumer for that table (currently none). Without this `entityVerdict` stays a boolean in TS and the DB contradicts CLAUDE.md.

C. **Project ↔ community edges.** Nothing links `ACT-GD` to any `goods_communities` or `act_communities` row. The place field's `memberCommunities` (8 Barkly names) are display strings; `location_project_rules` is an expense tagger. A `project_place(project_id, community_id | lga_code | state, role in served|operates|prospect, source, since)` table is the missing join, and the spec already allows it ("Ask / Target community_id (nullable)", spec line 37).

D. **Community → place keys.** `act_communities.geo` is `{}` on all three; the spec allows LGA/postcode/SA2 annotations, none were written. `goods_communities` needs `lga_code` for NT: the truth is already in `local_government` (58/60 lead/active) and could be mapped to ABS LGA codes (Barkly = 70420, West Arnhem = 74660, West Daly = 74680 already appear), while the 236 `Laverton` rows and `lga_name` on 0872 need a re-derivation from ILOC/SAL rather than postcode (0822 spans 14 LGAs; postcode is not an LGA key in remote NT).

E. **Grant → place keys.** `metadata.place` exists on one grant; `geography` is state tokens on 54%; ALMA `jurisdictions` on 1.4%, `regions` on 0.1%. A `grant_place(grant_id, level national|state|lga|community, code, source text|funder-name|enricher, confidence)` populated by the eligibility enricher (JEV is already reading grant pages for DGR; the same pass could answer "which states / LGAs / named communities does this page fund" as a Choice) would give the LGA/community side. Until then the best computable statement is "funds NT" not "funds Barkly".

F. **One theme vocabulary with provenance.** Five keyword lists (§4) and free-text `focus_areas` on the grant. The rubric prose plus JEV verdict is the most defensible; `funding_tags`/`theme_keywords` should be derived from or reconciled to it, with a source path and date (today `act_context`/`evidence_we_have` are `{}`).

G. **Then the sentence is a join**: `project_place(ACT-GD, lga 70420)` ∧ `grant_place(g, lga 70420 | state NT)` ∧ `rubric(g, goods).score ≥ threshold` ∧ `applicant_route(ACT-GD, dgr|direct) satisfies g.dgr_required` → "fits Goods: funds <theme hit> in Barkly (LGA 70420), apply as Butterfly". Every term has a home today except `project_place` and `grant_place` at LGA grain.

## 9. Data-quality flags met along the way

- `org_profiles` has 4 rows, not the 3 CLAUDE.md states (`Oak Tree Devanning`, slug null, org_status exploring).
- `goods_communities.lga_name = 'Laverton'` ×236 (NT, postcode 0872); `'Carpentaria'` ×2 NT; GAWA → Palmerston; LANGI (QLD, Aurukun) with Tiwi Land Council; KALKA (SA) with Central Land Council; ALPURRURULAM, MUTITJULU, PMARA JUTUNTA (active) → Laverton.
- `location_project_rules` says GARBUTT/TOWNSVILLE/KIRWAN = `ACT-HV` "Townsville — Harvest/PICC", contradicting Harvest = Witta.
- `ecosystem_projects` seed row: JusticeHub "Open justice data portal for Aotearoa"; `goods` → goods.global.
- `wiki-support-index.json` generated 2026-04-28; CivicGraph code `ACT-CG` (legacy per project-codes.json).
- `act_grant_recommendation_projects.ACT-IN` (in_scope false) is FK-linked to `org_projects.ACT-JH-AL` (ALMA) — the "Infrastructure / ALMA / Wiki / AI systems" label is doing double duty.
- `act-barkly-field.ts:512-518` reads `justice_funding` with no `measure_kind`/`is_aggregate` filter (CLAUDE.md's mandatory filters).
- `aligned_projects` mixes codes and slugs (`ACT-GD` 67 + `goods` 63; `ACT-HV` 213 + `harvest` 9) and contains `WATCH` 133.

## 10. Questions for Ben

1. Which is the project identity going forward: `org_projects.id` (has the FKs), the JSON code, or the TS slug? Contained is ACT-CN / ACT-JH-CT / contained today.
2. Should Butterfly be a row in `org_applicant_entities` now, and should the "A Curious Tractor" row carry the Pty ABN 36 697 347 676 instead of the sole-trader ABN?
3. Goods' states: NT/QLD/WA (TS + rubric), NT/QLD/WA/SA (goods-relevance), or home QLD,NT + secondary NSW,WA,SA,VIC (recommendations)? Kalka (SA) is an active community; Kalgoorlie (WA) has 20 assets.
4. Is `local_government` the NT council you want as the LGA key, and may the 236 `Laverton` rows be re-derived?
5. Is `act_communities` (3 hand-minted) meant to be the list grants are aligned to, or `goods_communities.priority IN (lead, active)` (64)? The spec says 5-15 hand-minted; Goods works in 64.
6. Should JEV's grant read also extract place (states / LGAs / named communities) as a Choice, given it already reads the page for DGR?

## Appendix A — files read (with the lines cited)

- `apps/web/src/lib/act-grant-eligibility.ts` (all 108 lines) and `.test.ts`
- `/Users/benknight/Code/act-global-infrastructure/config/project-codes.json` lines 1-1892 read, rest summarised with jq (78 codes)
- `apps/web/src/app/org/[slug]/communities/page.tsx`, `communities/[community]/page.tsx`, `projects/page.tsx`, `goods/communities/page.tsx`, `barkly/page.tsx`, `grants/page.tsx:1-110`, `explore/place/[placeSlug]/page.tsx` (imports), `[projectSlug]/page.tsx` (imports), `[projectSlug]/act-project-field-map.tsx:1-40`
- `apps/web/src/lib/services/act-communities.ts`, `act-cross-projects.ts`, `act-place-fields.ts`, `act-barkly-field.ts:1-80,470-560`, `act-grants-desk.ts:1-140`, `act-project-apply-now.ts:1-50`, `fast-local-org.ts:4-51`, `wiki-support-index.ts:1-120`, `org-dashboard-service.ts:382-393,1180-1275`, `goods-community-detail.ts` (grep of table reads)
- `scripts/lib/project-relevance.mjs` (grep), `scripts/lib/goods-relevance.mjs` (grep), `scripts/score-project-rubric.mjs:76-106,136-160`, `scripts/jev-pilot/README.md:1-40`, `scripts/sql/2026-08-08-geography-and-program-dedupe.sql:3-17,86-97`, `supabase/migrations/20260905130000_baseline_remote_schema.sql:19925-19960`, `supabase/migrations/20260905140000_schema_ownership_seed.sql` (grep)
- `docs/specs/community-records-spec.md`, `docs/adr/0004-communities-live-in-supabase.md:1-19`, `CONTEXT.md:76-86`
- Memory: `project_act_grant_eligibility.md`, `project_act_business_model.md`, `project_goods_command_center.md`, `project_goods_supply_context.md`

## Appendix B — row counts measured

`SELECT count(*) FROM <t>` each: act_communities 3 · act_community_links 0 · act_entities 1 · org_applicant_entities 2 · org_projects 14 · projects 81 · project_focus_areas 12 · project_applicant_routes 14 · location_project_rules 73 · act_grant_recommendation_projects 12 · nt_communities 75 · goods_communities 1,543 · v_goods_community_priority 1,543 · ecosystem_projects 7 · studio_projects 2 · notion_projects 80 · project_profiles 7 · project_strategic_profile 8 · alma_community_contexts 10 · org_profiles 4 · clarity_project_code 74 · act_obligations 0 · act_grant_recommendations 35,761 (3,251 × 11) · alma_funding_opportunities 23,705 · act_private_grant_rounds 665 (663 with geography, 624 live) · goods_procurement_entities 4,562 · goods_procurement_signals 1,258.
