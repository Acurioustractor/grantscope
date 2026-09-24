# Map 1: ten surfaces, periphery, one-pool row

Basis: desk-surfaces.md, periphery.md, followup-one-pool-row-contract.md, row-contract.sql (all 2026-09-24, counts via gsql.mjs). Paths under `apps/web/src/`. No new queries run.

## 1. The ten surfaces

| # | Route | Page file | Service -> source | Unique (lost if retired) | Writes | Nav | Rows today |
|---|---|---|---|---|---|---|---|
| 1 | /org/act/desk | org/[slug]/desk/page.tsx | act-one-desk.ts: grant tags, org_project_foundations (limit 500), goods buyers, xero_invoices, obligations 0, people 0 | Only cross-kind deadline queue; digest target | Done/Waiting/Tomorrow -> opportunity_context_events per Perth day, expires overnight; no pursue/pass | Rail 01; /org/act redirects here (page.tsx:706) | ~360 pool (43 grants + 181 funders + 129 buyers + ~9 money), 80 rendered (page L80); marks in 30d 0 |
| 2 | /org/act/grants | grants/page.tsx, admin gate L63-72 | act-grants-desk.ts:128-142: grant_opportunities UNION act_private_grant_rounds, service role | Only per-entity eligibility (act-grant-eligibility.ts:96-107); only reader of private rounds | None | Rail 06 | ~3,780 (3,162 public + 619 private); 87 close <=30d; ~2,843 undated |
| 3 | /org/act/funding | funding/page.tsx | project-funding-service.ts:244-310: rpc search_project_funding_hybrid (ALMA); funding_weekly_cycles | Only Pursue->GHL form, Notion brief, correction form | pursue -> funding_ghl_handoffs + GHL opp | Rail 05 | Fixed 5; decisions in 3 weeks 0; handoffs 0; 14/14 profiles partial |
| 4 | /org/act/pipeline | pipeline/page.tsx, pipeline-kanban.tsx | org-pipeline-service.ts:141-382: act_grant_recommendations_current (ALMA MV), _decisions, funder_context_snapshot | Only stage board, funder dossier/timeline | Move -> decide route (mirrors ALMA row into grant_opportunities, saved_grants) | Not on rail; 8 inbound links | 6,157 rec rows, 697 opps, 20 strong; decisions passed 62, won 26, watching 1, pursuing 0 |
| 5 | /org/act/intelligence | intelligence/page.tsx | six exec_sql (L103-166), no grant data | Third visual frame only | None | 1 button (org page.tsx:830) | n/a |
| 6 | /org/act/digest-preview | digest-preview/page.tsx | getOneDeskPool | Shape check of the email | None | 0 inbound | 15 + 15; digest_log 3, last 2026-09-21 |
| 7 | /org/act/[project] (+/funding) | [projectSlug]/page.tsx, /funding/page.tsx | act-project-apply-now.ts:127-193: act_grant_recommendations_current top 400 | Only per-project five-factor list, funding route, next_question | project page -> org_pipeline, foundation targets; /funding none | Rail project tabs | 12 registry rows, 11 in scope; 10 dated + 10 rolling |
| 8 | /org/act/goods/grants | goods/grants/page.tsx | goods-grants-triage.ts:53-148: grant_opportunities by goods_relevance_score, 3000 -> 300 | Only Push to GHL for a grant; only geo filter; freshness tile | push-ghl -> grant_opportunities.ghl_opportunity_id | Goods rail "Money in" | 3,162 live sliced to 300; live in GHL 114 |
| 9 | /org/act/goods/foundations (+/scan) | goods/foundations/page.tsx, scan/page.tsx | v_goods_foundation_targets; scan: goods-funder-scan.ts over org_project_foundations | Only net-new targets with board bridges; only GHL-truth vs stage view | Track -> goods_relationships funder | Goods rail | 2,098 targets, 75 bridged, Track used 0; scan 247 Goods of 1,553, 22 GHL-synced |
| 10 | /ops/grant-recommendations (+/triage) | ops/grant-recommendations/page.tsx, -client.tsx | act_grant_recommendations_current, _decisions; triage: alma_funding_opportunities | Only 9-filter table; only ALMA classifier; only Notion sync | decide; sync-notion; triage classify | nav.tsx:585, not ACT rail; public grant-frontier/page.tsx:579,590 | 6,157; triage 14,516 cards, unpaginated |

`/home` (home/page.tsx) duplicates 4 with hard-coded project prose (L513-520); saved_grants discovered 2,158, pursuing 10. Four engines, no shared decision record (desk-surfaces §14): P1 tags (`aligned_projects`) -> 1, 2, 8; P2 ALMA MV -> 3, 4, 7, 10, /home; hybrid RPC -> 3; old matcher -> org root. The 62 passes on /pipeline are still "decide" on /desk.

**Verdict.** `/org/act/desk` is closest in shape (one queue, kind lenses, digest and org-root point at it, Ben's recorded taste) and furthest in substance: no pursue/pass, 80 of ~360 rows, 129 Goods buyers bury six projects, funder feed capped at 500 of 1,553 (goods-funder-scan.ts:76). The decision record that works is `act_grant_recommendation_decisions` (89 rows, GHL/Notion/tracker bridges); eligibility and private rounds exist only behind `/grants`. Build on the desk's shape, `/grants`'s source, one decision table the row reads and writes.

## 9. Periphery checklist for the collapse

Classifier `scripts/classify-changes.sh:38`: SAFE = `scripts/`, `supabase/`, `docs/`, `thoughts/`, `.github/`, `.claude/`, `apps/web/src/lib/` (**`lib/services/` is SAFE**), `app/api/`, `app/ops/`, `app/admin/`, tests. **`app/org/[slug]/` is VISIBLE** (not in the regex; fails toward VISIBLE, :11-12), as is `vercel.json`; untracked files count (:24-30); a mixed PR is VISIBLE.

| Area | Change or check | Class |
|---|---|---|
| Redirects | `redirect()` stubs for the nine retired routes (precedent `org/[slug]/contacts/page.tsx:27`); org-root redirect `page.tsx:706` and `?view=` escape `:705` (E2E `act-field-desk.spec.ts` drives it); `next.config` has no `redirects()`; middleware unchanged | VISIBLE |
| Nav | ACT rail `act-workspace-shell.tsx:86,97,98`; `GOODS_RAIL_SECTIONS :335`; mobile `:232-250`; global `nav.tsx:585`; /home cards `home-client.tsx:1030,1058,1165,1207`; public `reports/grant-frontier/page.tsx:579,590` | VISIBLE |
| Cross-links | `act-one-desk.ts:213,233`; `[projectSlug]/funding/page.tsx:108`; `projects/page.tsx:48,51`; `funding/page.tsx:30`; `act-operating-desk.tsx:1627`; `financial-pulse-tile.tsx:75`; `income-history-section.tsx:56`; `payables/page.tsx:75`; org `page.tsx:343,681,830`; `pipeline-kanban.tsx:7-8` imports from ops (tsc catches); 13 files emit dead `/grants?type=open_opportunity` links | mixed |
| Digests | `vercel.json:43-50`: desk-digest 21:00 UTC (Resend, `digest_log`, GHL task bridge); funding-weekly-digest Mon 00:00 writes `funding_weekly_cycles`, read only by /funding, never sends; `act-desk-digest.ts:12,50,173` hard-codes `/org/act/desk` in the email; `vercel-config.test.ts` catches a missing route, not a pointless cron; 5 env vars via /config-truth | SAFE; vercel.json VISIBLE |
| Notion | sync-notion route (238 lines) + button; `funding-notion.ts` + notion-brief route; `sync-pipeline-to-notion.mjs` (off since 2026-08-09); `sync-act-opportunities-to-notion.mjs` (unregistered). `notion_page_id` set on 0 of 89 decisions: retiring loses nothing; spec says pages come from /make-the-ask | SAFE |
| GHL | Keep push-ghl route + `goods-grant-ghl.ts` (725 rows carry `ghl_opportunity_id`; desk reads it `act-one-desk.ts:224`) or Ask state is lost; retire `funding-ghl.ts` + `funding_ghl_handoffs` (0 rows); `sync-goods-ghl` 12h fails under PM2 since 2026-09-05 (401, stale key in PM2 env; crontab runs succeed): restart PM2 with a clean env; `reconcile-foundations-ghl` 24h; `sync-ghl-to-tracker` unscheduled | SAFE code; Tier 3 live writes |
| Crons | `agent_schedules`: 2 scorers, 3 pipeline phases + disabled monolith, match-foundations-for-projects, reconcile-foundations-ghl, sync-goods-ghl, sync-act-private-grant-rounds (168h), scout-grants-for-profiles + send-grant-alert-digests (771 outbox, 0 sent, scope-cut debris); crontab `0 */6 scheduler.mjs` ignores `params.phase` (`:76`): 93 dead monolith launches; pg_cron `expire-closed-grant-opportunities` (keep), `act-auto-pass-stale-pipeline` (no migration owns it; `cron.unschedule`), `mv_refresh_registry` act_grant_recommendations (disable if ALMA retired); registry `agent-registry.mjs` + TS mirror | /db-apply; crontab outside git |
| Pipelines, data | P1 writers of `aligned_projects`: 14 scripts + `decide/route.ts:96`; P2 readers of `act_grant_recommendations*`: 13 app files + plugin act-money-brain; readerless after: `funding_ghl_handoffs`, `funding_weekly_cycles`, `grant_notification_outbox`, `ghl_task_bridge`, `org_pipeline` grant rows (75) | SAFE |
| Tests | regen `table-readers.generated.json` (`UPDATE_TABLE_READERS=1 npx vitest run src/lib/table-readers.test.ts`) on any reader change; `act-grants-desk`, `act-grant-eligibility`, `funding-*`, `project-funding-service` tests follow their services; `pipeline-health.test.ts` + `/ops/health route.ts:205-216` assume the three phase ids; no vitest for act-one-desk, both grants-triage, act-desk-digest: add one for the survivor; `scripts/lib/*.test.mjs` not in CI | SAFE |
| Docs, skills | `CONTEXT.md:118`; 5 `docs/specs/*` (one-desk-widened-ux, grants-digest, grants-notion-handoff, delivery-surfaces, people-surface); `act-money-surface-audit-2026-08-07.md:156-375`; skills make-the-ask, polish:44; plugin act-money-brain; 7 handoffs; 5 memory files | SAFE |
| Ben's words | crontab edit, PM2 restart; any `agent_schedules` / `cron.unschedule` / `mv_refresh_registry` change; disabling the SmartyGrants sync once Our Community replies; merging the VISIBLE PR | Tier 3 |

## 12. The one-pool row contract

**Source:** `grant_opportunities UNION ALL act_private_grant_rounds`, `status IN ('open','ongoing','upcoming')`, `coalesce(closes_at, deadline)` not past, service role behind the admin gate (`act-grants-desk.ts:128-142` already does this). `row-contract.sql` returns 3,781 grants x 6 projects in ~1 s. Rejected: `v_funding_opportunities` (`is_open` tests closes_at only: 18,886 of 24,771 "open" grant rows are status closed; granted to authenticated, so private rounds can never join); `mv_search_index` (same rule, 18,948 closed rows served as grant_round); `search_project_funding_hybrid` (lexical 0 and semantic 0 on all 83 rows for Goods and JH; 0 of 14 profiles embedded; cross-joins ALMA).

Grant row (fields from `row-contract.sql`; coverage from the §6 summary run, 3,781 rows per project):

| Field | Source column | Freshness | Coverage today |
|---|---|---|---|
| origin, grant_id, name, funder, source, url | `g.provider` etc; `r.*` for private | public: ingest agents daily; private: `sync-act-private-grant-rounds` 168h (2026-09-22, 627 found/17 new) | url 2,329 public, 619 private |
| project, project_code | hard-coded six, `act-grant-eligibility.ts:30-37` | static; `org_projects` says ACT-JH-CT for contained, scorer tags ACT-CN (`project-relevance.mjs:203-209`) | 6 of 14 active org_projects |
| fit_keyword | `goods_relevance_score` (both tables); `project_relevance.<slug>.score` (public only) | goods: `score-goods-relevance` 24h (2026-09-24 06:45); others: one pass 2026-09-20, `score-project-relevance` unscheduled | >= bar: goods 47, JH 6, FM 3, HV 3, CN 1, EL 1 |
| fit_jev, fit_jev_confidence | `project_relevance.<slug>.rubric.{score,confidence}` | `score-project-rubric` 24h `--apply`; run state conflicts between notes (unverified) | 356 public, 0 private, 0 goods key; >= 2.5: CN 6, FM 5, JH 4, EL 2, HV 0 |
| tagged, tagged_by | `aligned_projects`; `project_relevance.<slug>.tagged_by`, `goods_relevance_signals.tagged_by` | with the scorers; ledger began 2026-09-14; private sync resets `aligned_projects` to [] each run (inferred from L43) | tagged 3-6 per project, goods 47; tagged_by 13 pairs + 3 goods |
| closes_at, days_to_close | `coalesce(closes_at, deadline)` | `expire-closed-grant-opportunities` pg_cron 16:30 UTC | 851 dated (319 public, 532 private) |
| amount_min, amount_max | same | ingest | 1,661 |
| pty/butterfly/akt_can_apply, can_apply | `dgr_required`, `accepts_pty_ltd` (`entityVerdict` L81-86); `accepts_charity` 108, `accepts_sole_trader` 39, `eligibility_criteria` 189 exist and are unread | `eligibility_signals_at` 397; no scheduled writer found | known 303 of 3,781; private 0 by schema |
| place_label, location | `metadata.place` {state, lga_name, national}, `geography` tokens (`locationVerdict` L65-78) | ingest | place: public 1, private 617 (LGA on 436); geography 2,976 public; no AU-NT in private |
| in_ghl, ghl_opportunity_id | `grant_opportunities.ghl_opportunity_id` (push-ghl `route.ts:45-48`) | at click | 725 rows, 703 ids, 114 live; 251 resolve in `ghl_opportunities` mirror (1,322 rows); private none |
| decision (missing) | `act_grant_recommendation_decisions` keys on ALMA opportunity_id; joins to this pool only via the mirror row (inferred) | last 2026-07-28 | 89 rows, none readable from the pool |
| handled (missing) | `opportunity_context_events` daily_action per Perth day | expires nightly | 0 in 30d |

Funder row (inferred from desk-surfaces §1 and §9; no contract SQL was run):

| Field | Source | Freshness | Coverage |
|---|---|---|---|
| name, project, stage, fit_score, evidence_grade, next step | `org_project_foundations` + `foundations` | `match-foundations-for-projects` 24h (2026-09-24 02:26, 12/12) | 1,553 rows, 6 projects; desk reads 500 |
| in_ghl, warmth | `ghl_synced_at`, `ghl_tags` | `reconcile-foundations-ghl` 24h (2026-09-23 20:30) | 22 Goods + 1 EL synced; grade A not in GHL 177 |
| giving/yr, range, dgr, bridge | `foundations.total_giving_annual` (25K/100K/500K placeholders nulled, scan `:92-95`); `v_goods_foundation_targets.has_bridge` | view; Goods only | 2,098 targets, 75 bridged |
| decision | none shared: Track -> `goods_relationships` funder (0 ever); triage -> `org_project_foundation_interactions` (6) | | three stage vocabularies, no join |

Buyer row (inferred; Goods only):

| Field | Source | Freshness | Coverage |
|---|---|---|---|
| name, stage, last touch, notes, band, warmth, open ask, received | `goods_relationships` type=buyer; project 'Goods' hard-coded `goods-buyer-pipeline.ts:240` | `sync-goods-ghl` 12h; PM2 runs fail since 2026-09-05, crontab runs succeed 02:00/14:00 UTC | 131 rows, 129 open; every amount $0 |
| ghl link, power, funding chips | `ghl_signal`; `v_goods_relationship_power`, `_funding` (need GRANT or chips render empty) | with sync | |
| next, due | computed `nextBestAction`, stage rot L52-65 | derived | |

Common to every kind (the desk row today): kind, project, name, amount, due/dueDays, next, isDecision, owedTo/via, ghlUrl, workHref. What the one place must add: pursue/pass on the row into one decision table keyed by (origin, id, project); GHL stage via the mirror join, not a boolean.
