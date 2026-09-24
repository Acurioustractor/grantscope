# 3. Actions, funders, buyers, GHL, people (sections 4, 5, 6, 13, 14)

Basis: the five reader notes of 2026-09-24. Every count is a `gsql.mjs` query run that day unless marked inferred or unverified. ACT org id `8b6160a1`.

## 4. Every action and where it lands

| action (file) | lands in | works? | evidence |
|---|---|---|---|
| Push grant to GHL, A1 (`api/goods/grants/push-ghl/route.ts:8-51`) | GHL Grants opp on triage contact + stamp `civicgraph-grant:<id>`; `grant_opportunities.ghl_opportunity_id` | code ok; no proof ever pressed | the 725 stamped ids came from act-global `sync-grants-ghl.mjs:177,377`; of 114 open rounds the desk calls "in GHL", 0 resolve to a live opp (64 deleted, 10 deleted by UUID, 40 unknown, 2 sampled 404). The 15 live engine-stamped opps are the 2026-07-07 CLI seeder's |
| Push buyer to GHL, A2 (`api/goods/buyer/push-ghl/route.ts:14-94`) | GHL contact on synthetic email + opp; `goods_procurement_entities.ghl_*` | contact yes, opp no | 26 rows; `GHL_GOODS_BUYER_STAGE_ID` unset so `goods-buyer-ghl.ts:117-123` skips the opp; 22 of 26 opp ids point at deleted mirror rows |
| Pursue form + Notion brief, A3/A4 (`funding-ghl.ts:14-38`, `funding-notion.ts:33-54`) | `funding_ghl_handoffs`, GHL opp, decision 'pursuing', Notion page | never once | handoffs 0 rows, 0 'pursuing', notion_page_id 0 of 89; needs `GHL_GRANTS_TRIAGE_CONTACT_ID`, unset in .env (Vercel unverified) |
| Task bridge, A9 (`act-ghl-task-bridge.ts:61-132`) | one GHL task per due desk row | works, write-only | 8 rows, all 2026-09-14, June-dated buyer asks |
| Dormant pushers A5/A7/A8/C7 | GHL opp + org_pipeline; ghl_contacts; act_ask_artefacts | no | send_to_ghl has no UI caller; signals sync 0 runs; contacts sync writes the GHL id into `ghl_contacts.id` uuid PK (`ghl.ts:216-226`); act_ask_artefacts 0 rows |
| Decide apply/watch/pass, B1 (`decide/route.ts:25-164`) | `act_grant_recommendation_decisions` | code ok, unused since July | 89 rows: 62 passed (last 2026-07-28), 26 won (Xero backfill), 1 watching, 0 pursuing |
| Decide on the desk, B7 (`act-one-desk.ts:210,230` says "Decide: pursue or pass") | only Done/Waiting/Tomorrow, a per-day mark in `opportunity_context_events` | pursue and pass do not exist here | no `foundations/push-ghl` route; desk ignores opportunity_decisions; `digest_log`: "177 new decisions" 09-14, "177 open" 09-20 |
| Other decide stores B2-B6 | org_pipeline (owner/next_action 0 of 125), opportunity_decisions (7, last 2026-08-11), saved_grants goods_signal (0) | routes work, unused | four decision stores, none read by the desk |
| Save / watch / track, C1-C3, C6 | saved_grants; saved_foundations; entity_watches; goods_relationships | scorers fill them | saved_grants 2,916: 1,923 by nightly scout, human 'pursuing' 10 (last 2026-05-15), 0 ghl ids (tracker sends no contactId); saved_foundations 182: 178 scorer, 4 human; entity_watches 0; Track works |
| Notion, D1-D3, D6 (`sync-act-opportunities-to-notion.mjs`, `sync-pipeline-to-notion.mjs`, /make-the-ask) | Notion DBs, notion_page_id | disconnected; the skill is the one working path | 0 page ids; pipeline sync disabled since 2026-04-22; skill step 6 artefact 0 rows, step 7 "funder scan button" does not exist; `opportunity_promotions` 7 rows, writer not found (unverified) |
| Desk digest, E1 (`act-desk-digest.ts:48-130`, cron 21:00 UTC) | Resend email, `digest_log` | works | 3 sends (09-14, 09-20, 09-21) |
| Other digests E2/E4 | Gmail; `funding_weekly_cycles` 'in_app' | send nothing | 25 runs, 0 sent, outbox starved since 2026-05-15; 8 in-app cycles |
| GHL read-back F1/F2 (`sync-goods-ghl.mjs` 12h, `reconcile-foundations-ghl.mjs` 24h) | goods_relationships warmth; `org_project_foundations.ghl_*` | F1 broken, F2 thin | F1 401 every run since 2026-09-23 02:04 UTC with the same token bytes act-global used at 02:00 (cause unverified); F2 22 rows, synced 2026-09-21 |

Sum: 4 pursue paths, 4 decision stores, 6 save tables. Only A1 and A2 reach a screen; the desk can neither pursue nor pass, so its 177 decisions never fall.

## 5. Philanthropy: what a funder row can honestly show

Three matchers, three tables, none reads another: `org_project_foundations` 1,553 (nightly, per project), `v_goods_foundation_targets` 2,098 (view, Goods-only themes), `saved_foundations` 182 (weekly, per user). `funder_intelligence` 11,159 rows (2026-08-03) has no app reader.

| field | real source | status |
|---|---|---|
| name, ABN, entity | `foundations.acnc_abn` 11,214 of 11,235; gs_entity_id 10,836 | real |
| grants made last year | `acnc_ais.grants_donations_au`: 8,307 AIS-linked rows, $1.70bn | real, shown nowhere |
| total_giving_annual (what every page shows) | size guess, `acnc-importer.ts:188-195` (25k / 100k / 500k) | PLACEHOLDER on 9,161 of 11,235 (81.5%). Migration 20260907130000 fixed it; `sync-acnc-register` rewrote 10,101 rows 2026-09-22 02:35Z; PR #506 stops the next run; repair not re-run. `enrichment_source` still says `acnc_ais_2024` on 8,196 wrong rows; truth survives in `metadata->>'giving_source'` (9,242 rows) |
| grant_range_min/max | same guess | placeholder, printed as "grants $X-$Y" |
| funds other charities | `acnc_charities.ben_other_charities`: 2,312 true, 1,435 giving > 0, $952m | real, used by no matcher |
| requires DGR | `foundations.type`, `funder_allowlist.requires_dgr`; Goods page routes via Butterfly | real, partial |
| theme, geography | thematic_focus 6,731; category_assignments 10,945; geo_focus | self-described, scrape + LLM; no place grain |
| observed grantees | `foundation_grantees` 5,695 rows, 24 publishers, FRRR + Ian Potter = 92%, 20 publishers have no amounts | real for 24 funders, nothing for 11,211 |
| relationship state | `funder_context_snapshot` 1,196 (name-keyed, score 0 on 879); Xero `v_funder_summary` 47 (half customers); GHL goods-* tags 98 contacts | real, thin |
| money to ACT | `v_act_income_by_funder` (Xero) | real |
| pitch, claims | act-global `wiki/narrative/funders.json`: 25 entries, 9 stubs, last edit 2026-07-07, no reader | stale |
| fit score, grade | four scores, all partly on the placeholder; grade A = LLM-scraped `notable_grants` (Goods: 18 of 20 grade-A rows have 0 grantees) | not evidence |

Reversion proof: `SELECT count(*) FILTER (WHERE f.total_giving_annual <> a.grants_donations_au) FROM foundations f LEFT JOIN LATERAL (SELECT grants_donations_au FROM acnc_ais a WHERE a.abn=f.acnc_abn ORDER BY ais_year DESC LIMIT 1) a ON true WHERE f.enrichment_source LIKE 'acnc_ais_%'` = 8,196; $630m shown vs $1.70bn in the AIS.

Traps: rank on AIS giving, never total_giving_annual; `v_goods_foundation_targets` has no grantmaker gate and a bridge is worth 1,000 points, so ACU, Uniting Church bodies and a school foundation top it; fit >= 85 is 471 rows and 1,044 of 1,553 summaries are "[auto-matched]" templates; snapshot keys on name (Snow twice, 75 and 70); `funder_board_paths` 2,651 rows are 100% unverified by construction; 6 of 14 org_projects have no crosswalk and get zero matches. Real for Goods today: Xero funders (Snow $402,930, Centrecorp $123,332, VFFF $50,000), 172 goods_relationships funder rows, giving history for Snow (44 grantees) and Origin (8) only.

## 6. Buyers: what exists, how ranked, what is missing for Goods

| system | rows | ranking | product / place aware | read by |
|---|---|---|---|---|
| `goods_relationships` buyer (the /goods/buyers tab); GHL sync 98, seed 26, curated 2, manual 5 | 131 | `warmth_display` desc (stage 40 / recency 20 / history 20 / alignment 15 / advocacy 5), then received | no / entity_id on 38 | tab, hub, One Desk |
| `goods_procurement_entities`, AGIL census + anchors, untouched since 2026-05-27 | 4,562 | `fit_score` = supplier heuristic (`hydrate-goods-procurement.mjs:164-168`: +50 if the org's OWN AusTender contracts match Goods keywords) | `product_fit` is a role default / community_id on 4,552 | community dossier, signals; NOT the tab |
| `se_buyer_prospects`, austender x SE ABNs | 438 | se_supplier_count, total_value | no / supplier states | no app page; /lighthouse sells CivicGraph evidence to procurement teams, not a Goods finder |
| `goods-repeat-buyer-intel.mjs`, austender by buyer, Goods keywords + UNSPSC | report | >= 2 contracts | yes / no | nothing; ran once 2026-05-28 |
| `sync-austender-open-tenders.mjs`, ATM RSS + UNSPSC 56xx gate | 2 closed | goods-relevance +25 | yes / no | 0 agent_runs, no schedule, no logging; "Scrape more" fires into nothing |
| `state_tenders`, QLD disclosure archives (JusticeHub-owned) | 199,719 | n/a | no / QLD | 0 NT, 0 WA, 0 SA; closing_date NULL on every row |

Tab state (`relationship_type='buyer'`): 129 open, 38 entity-linked, `ask_amount_aud` NULL on all 131, `total_received_aud` on 2 rows ($106,150: Centrecorp 130 beds, Homeland School), 8 with a due date. 59 of 131 "buyers" are GHL Demand Register rows naming a `goods_communities` row (58 of 59 match) because `sync-goods-ghl.mjs:50-54` maps both pipelines to 'buyer': every buyer count on the tab and desk is ~45% places. Centrecorp appears twice. 27 of 131 already tie to a community via `goods_procurement_entities.community_id`; not drawn. Tab actions: two filters and "Open in GHL"; the only find-to-act path (PushToGhlButton) sits on the community page.

Revealed demand is one indexed query away (trgm on `austender_contracts.title`): furniture 273 contracts $98.7m 78 buyers; beds 69 $442.6m (hospital beds); mattress 25 $13.4m; NT Health Central Australia 5 incl. "Alice Springs - Remote Health Centres - Supply and…". No table or page holds it.

Missing, smallest first: split communities out of the buyer cohort; put revealed demand on the card ("buys beds: N contracts, $X, last YYYY"); bring `goods_procurement_entities` onto the tab with the existing push button; re-score fit for buying not supplying; schedule the open-tender feed and log it, or delete the button; enter the asks (Miwatj, Anyinginyi washer quote, AHL, Centrecorp live in next_action text); say on the tab that NT/WA/SA tenders do not exist; never conflate CivicGraph buyers (who pays for evidence) with Goods buyers (who buys a bed).

## 13. GHL as system of record

Live via MCP 2026-09-24: 11 pipelines (mirror `ghl_pipelines` holds 19; 8 gone). Money pipelines, live = mirror `sync_status='synced'`, 0 drift on 213 rows:

| pipeline (id) | live | stages |
|---|---|---|
| Grants `scom3L0kNwA1W0zPIzMe` | 32: 16 open at Identified, 16 lost at Declined; all updatedAt 2026-08-30, no stage change since 2026-08-10 | Identified `8124c61a`, App In Progress, Submitted, Awarded, Reporting Due, Report Submitted, Declined |
| GOODS - Funding `JvBFYpVpyKsw899lkFgj` (was "Goods Supporter Journey", renamed 2026-08-13) | 69: 59 open, 5 won, 4 lost, 1 abandoned; last change 2026-09-20 | Identified, Qualified, Cultivating, Ask made, Committed, Delivering, Stewarding, Renewing, Lapsed, Declined/Parked |
| GOODS - Buyers `FjMyJM3YzWQFmKqR9fur` | 21: 8 open, 2 won, 11 abandoned | Outreach Queued … Paid (12) |
| GOODS - Demand `UQsrmuqzxMSdCTklxEcG` | 75 open | Signal, Buyer Matched, Converted, Dormant |
| GOODS - Community `0m9teeEQFiq6I7GB5xiP` (new 2026-07-24; no grantscope code knows it) | 16 open | Invitation … Paused/closed (12) |

Grants is an engine-seed sink; money is worked in GOODS - Funding (8 at "Ask made": QBE Stage 2, Rotary Global Grant, SEDI, SEFA, Bryan, Ian Potter, Tim Fairfax, Brian M Davis). Inferred from data.

Mirror trap: `ghl_opportunities` 1,322 rows, 562 deleted (259 of 291 Grants); any reader grouping by `pipeline_name` without `sync_status='synced'` counts ghosts (act-global `sync-grants-ghl.mjs:108-111`, `enrich-ghl-grants.mjs:212-216`). `ghl_contacts` 3,729 synced, 1,859 deleted. Freshness: 6-hourly full sync by act-global pm2 `ghl-sync` (`ghl_sync_log` 2026-09-24 02:00-02:17, 4,499 records); the webhook has only ever carried contacts. The four act-global Grants writers are configured but not in pm2.

Read rule: `LEFT JOIN ghl_opportunities o ON o.ghl_id = g.ghl_opportunity_id AND o.sync_status='synced'`; in_ghl = o.ghl_id IS NOT NULL (a non-null id proves nothing: 725 of 725 today); worked = status='open' AND stage not in (Declined, Lapsed, Grant Declined); last_touch = greatest(last_stage_change_at, last_status_change_at, ghl_updated_at), never updated_at; as_of = last_synced_at, stale past 12h. A funder is in GHL if a synced opp on its contact exists in GOODS - Funding: `goods_relationships.ghl_opportunity_id` keys 59 of 59 open Funding rows, `org_project_foundations.ghl_contact_id` only 10, so the funder scan misses 49 funders being worked.

Contract: `ghl_opportunity_id` holds the 20-char GHL id, never the mirror UUID (290 grant_opportunities rows hold UUIDs, all deleted); store pipeline id + stage id, render names from `ghl_pipelines.stages`; stamp in custom field `eZoHX9Y7dIZBhXM3i6Kx` (`custom_fields` is a jsonb ARRAY; act-global `enrich-ghl-grants.mjs:133` overwrites it with source names, one writer must win); contact anchor = triage `uAsIUWBHez3DzVex8rtm`, never the deleted test contact `AXrbvQAQKR0TcTcZL71H`. The funding-callback stage map (`funding-callback/route.ts:2`) names stages no live pipeline has.

Tags: `goods-hot/warm/steady/cooling/cold` on 98 of 5,588 contacts (`ghl-tag-registry.mjs:19-25`, one per contact); no live script writes them, `setWarmthTag` never fired. `place:*` 252, `record:person` 454, `philanthropic` 39 (no writer). The `org_project_foundations.ghl_tags` cache agrees 22 of 22 with the mirror and is 3 days staler: read `ghl_contacts.tags` on `ghl_id`. `ghl_contacts.last_contact_date` is not carried by the sync; last touch is `relationship_health.last_contact_at` (3,401 rows, daily 03:00).

## 14. The people layer: who to call

`act_people`, `act_person_roles`, `act_ask_warmers`: 0 rows each. The mint path (`api/org/[id]/people/route.ts:32-97`, GHL contact with source `civicgraph-people-mint`) is complete and was never pressed: 0 `ghl_contacts` with that source; `reconcile-act-people-ghl.mjs` in no registry. Three consumers read the empty table (`act-desk-people.ts:35-62`, `act-desk-digest.ts:102-125`, `act-people.ts:67-118`). `person_identity_map` (14,919 rows, last update 2026-03-19) is dead; `ghl_contacts` (5,588, 6-hourly) is the only person spine with a live refresh.

| field | source | join | fresh | coverage on 192 desk funder rows |
|---|---|---|---|---|
| name, email | `funder_context_snapshot.contacts[]` (ghl_contacts by company ILIKE + email domain, `refresh-funder-context.mjs:361-377`); dedupe on lower(email) | foundation_id | nightly, 2026-09-23 | 39 rows (46 of 710 matched foundations) |
| role | `person_roles` via `foundations.gs_entity_id` (name + role, no email) | entity_id | 2026-06-18 | 95 of 100 desk foundations |
| warmth, human | one goods-* tag on `ghl_contacts.tags` | ghl_id | 6h | 21 of 153 contacts |
| warmth, machine | `relationship_health.temperature` + lcaa_stage | ghl_id | daily, 2026-09-23 | 126 of 153 contacts; 38 desk rows |
| last touch | greatest(rh.last_contact_at, snapshot date, communications_history.occurred_at) | ghl_id | comms latest 2026-09-07 | 14 rows inside 180d |
| via | `act_people.warm_via` / `act_ask_warmers`: designed, 0 rows; fallback dossier org bridge (`act-funder-intelligence.ts:832-871`), unverified | org_contacts.linked_entity_id | n/a | 7 foundations, 4 connectors, 2 ACT contacts, whole portfolio |
| GHL link | `ghl_contacts.ghl_id` | | 6h | every matched contact |

Do not read: `org_contacts` funder rows (37, 0 emails, 33 org placeholders); `contact_entity_links` (643, 0 verified, subset of the snapshot); `funder_board_paths` (2,651, 100% unverified, built 2026-08-03, nothing calls the rebuild); `v_goods_foundation_targets.has_bridge` (name match only); `goods_relationships.warmth_display` as a person's warmth.

Net: 39 of 192 desk rows (20%) get a person with an email; 148 get nobody; 0 get a human-asserted warm path. The two warmths disagree on Snow (two goods-hot people with no temperature, three with a temperature and no tag). Buyers take the same shape via `goods_relationships.ghl_contact_id` (188 rows, 62 tagged); buyer-side coverage not measured.
