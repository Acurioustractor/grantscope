# desk-surfaces — every grant/money surface in the signed-in ACT workspace and ops

Reader: desk-surfaces. Repo `/Users/benknight/Code/grantscope`, read-only, 2026-09-24.
All paths are under `apps/web/src/` unless stated. Every number below was run through
`node --env-file=.env scripts/gsql.mjs` on 2026-09-24 unless marked otherwise.

---

## 0. How the workspace is organised (layout, shell, gating)

### Layout — `app/org/[slug]/layout.tsx`
- L36-53: when `isActSlug(slug)`, wraps children in `<ActWorkspaceShell slug projects>`; projects come from `getOrgProjectSummaries(profile.id)` (or `ACT_E2E_PROJECTS` when `ACT_E2E_FIXTURES=1`).
- L56-91: non-ACT orgs get no shell, just an optional admin banner.
- No auth check in the layout itself. Gating is middleware + per-page.

### Middleware — `middleware.ts`
- L49-52: `SKIP_AUTH_LOCAL=1` (non-production only) lets everything through.
- L57-65: protected prefixes `/home`, `/tracker`, `/foundations/tracker`, `/foundations/backlog`, `/ops`, `/profile`, `/org`. Anything else (including `/grants`, `/grants/[id]`) is public.
- L70-74: outside production the auth cookie's mere presence is the gate (`fastCookieAuth`); production validates with `supabase.auth.getUser()` unless `FAST_LOCAL_AUTH=1`.
- So: every `/org/act/*` and `/ops/*` page needs *a session*, not an ACT role. Only two surfaces check WHO is looking (see Grants desk, and the API routes that call `requireAdminApi`).

### Shell / rail — `app/org/[slug]/_components/act-workspace-shell.tsx` (client component)
- L83-103 `workModes` — the rail ("Where you work"):
  1. **One Desk** `/org/{slug}/desk` (hint "What needs you"); also active on org root `?view=today`.
  2. **Orgs** `/org/{slug}/orgs`
  3. **People** `/org/{slug}/people`
  4. **Curiosity** → `/org/{slug}?view=opportunities#opportunities` (active for `view=opportunities|triage`)
  5. **Funding** `/org/{slug}/funding` (hint "Money worth chasing"; comment L93-97: cut 2026-08-05, came back 2026-08-08)
  6. **Grants** `/org/{slug}/grants` (hint "Every live grant")
- L99-102 comment: Action, Art, Money, Sources, Research were cut from the rail and stay URL-reachable (`?view=pipeline`, `?view=money`, `?view=evidence`, `/research`).
- L147-149: under One Desk, `DeskRailTree` renders the kind lenses (L343-353): Everything / Funders / Grant rounds / Buyers / Money owed to us / We owe / Follow-ups → `/org/{slug}/desk?kind=…&project=…`.
- L154-182 "Jump to a project": top 7 active projects ranked Goods, JusticeHub, Harvest, Empathy Ledger, CivicGraph, Palm Island, ALMA (L32-42), plus "All projects →" `/org/{slug}/projects`.
- L164-166: when on `/goods/*`, `GoodsRailTree` renders `GOODS_RAIL_SECTIONS` (L333-338): Work (today, portfolio, capital, matters, network, applications, learning) · **Money in (foundations, foundations/scan, grants, money)** · Delivery (funnel, map, communities, channels, **buyers**) · Trust (model, proof, governance).
- L184-186 utility: Atlas `/explore`, Queries `/queries`.
- Mobile header (L192-214) adds Money (`?view=money`), Sources (`?view=evidence`), Research.
- **Not reachable from any rail entry**: `/org/act/pipeline` (only via links inside `/funding`, `/projects`, and the org-root support hub), `/org/act/intelligence` (no inbound link found in the shell; org-root does not link it either), `/org/act/digest-preview` (no inbound link), `/ops/grant-recommendations` (no inbound link from the ACT rail; memory `project_act_money_surface` said the same on 2026-08-07 and it is still true), `/home` (separate product surface).

Goods sub-nav — `app/org/[slug]/goods/_components/goods-sub-nav.tsx` L81-98: renders only below `lg` (rail is hidden there); on desktop it renders nothing. `FUNDING_TABS` L29-33 = foundations, foundations/scan, money. Note L23 lists buyers under DELIVERY_TABS ("Buyer pipeline").

---

## 1. `/org/[slug]/desk` — One Desk

**Page** `app/org/[slug]/desk/page.tsx` (server, `force-dynamic` L12). Gate: `isActSlug(slug)` else 404 (L58). No admin check.
**Service** `lib/services/act-one-desk.ts`.

### Data source (six feeders merged into one ranked pool) — `act-one-desk.ts` L125-248
| kind | feeder | table/view | admission rule |
|---|---|---|---|
| obligation | `getDeskObligations(profile.id)` (`act-obligations.ts` L131-142) | `act_obligations` state=open | overdue, due ≤30d, or undated (L146-163) |
| person | `getDeskPeople(profile.id)` (`act-desk-people.ts`) | `act_people` | review_by ≤ 7d and next_action set (L45-49) |
| money | `getActRelationshipLedger(slug, profile.id)` (`act-relationship-ledger.ts` L475-487) | `xero_invoices` + org_contacts + opportunity_context_events + ghl_contacts | outstandingTotal>0 (L183-194); `project:'Goods'` hard-coded L186 |
| funder | `getFunderScan()` portfolio-wide (`goods-funder-scan.ts` L66-99, `.limit(500)` L76) | `org_project_foundations` join foundations, org_projects | stage not parked/declined; in GHL (ghl_tags after sync) OR `evidence_grade='A'` (L198-204); decision-due when not in GHL |
| grant | `getAllProjectsGrantsTriage()` (`act-project-grants-triage.ts` L37-78) | `grant_opportunities` status in (open,ongoing,upcoming) AND `aligned_projects && {ACT-GD,ACT-JH,ACT-EL,ACT-HV,ACT-FM,ACT-CN}`, `.limit(3000)` | in GHL (`ghl_opportunity_id`) OR deadline ≤30d OR fit ≥ bar (85 goods / 40 others) L222-226; one row per (grant × aligned project) L56-75 |
| buyer | `getGoodsBuyerPipeline()` (`goods-buyer-pipeline.ts` L147-169) | `goods_relationships` relationship_type='buyer' | `isOpen` (stage identified/researching/contacted/in_conversation/proposal) L237-246; `project:'Goods'` hard-coded L240 |

Target strip (L99-110): `getGoodsCapitalWorkspace()` — "Goods capital plan" need/committed/asked. Goods-only.
Handled state (L111-121): `getOrgDailyActionStates(profile.id)` reads `opportunity_context_events` where signal_kind='daily_action' and `source_ref like '{perth-day}:%'` (`act-daily-actions.ts` L138-160). A marked record is dropped from `active` for today only.
Ranking (L85-88, L247): dated first by dueDays (overdue most negative), undated by `500 - score`.

### Fields a row shows (page L144-160, detail pane L179-224)
List: kind chip (owed/we owe/person/funder/round/buyer), name, `next` (person rows), "decide" pill when `isDecision`, owedTo, via, amount (`$NNK`), dueDays pill (overdue red). Grouped under horizon headers Overdue / This fortnight / This quarter / No date · ranked by fit (`deskHorizon` L72-77). **Only the first 80 pool rows render** (L80).
Detail: kind chip + `signal`, name, amount, owedTo/via, due, "stale sync" badge for people (L195-197), "Next move" (`next`), buttons, "Open in GHL ↗" when `ghlUrl`, "Open full workspace →" (`workHref`).

### Filters (query string only, page L60-77)
`?kind=` (rail lenses), `?project=` (header chips built from the pool's project labels L119-123), `?rec=` selects the detail. No text search, no sort.

### Actions
- `DeskMarkButtons` (`desk/desk-mark-buttons.tsx`, client) — Done → next / Waiting / Tomorrow → `POST /api/org/{orgProfileId}/daily-actions` `{action_id, title, detail, status}` → `api/org/[orgProfileId]/daily-actions/route.ts` L73-172 upserts a row into **`opportunity_context_events`** (source_type='daily_action', signal_kind='daily_action', source_ref=`{day}:{actionId}`) via `requireOrgWriteAccess`. If `status=done` and a `decision_id` was passed (the desk never passes one), it also appends a `decision_outcome` event. Nothing is written to the grant, funder or buyer record itself — "Done" is a per-day mark, so the same row returns tomorrow (L118-121 of the service: `handled` is keyed on today's Perth day).
- `DeskObligationButtons` (`desk/desk-obligation-buttons.tsx`) — Done / Dropped (community-owed drop needs a reason) → `PATCH /api/org/{id}/obligations` → `act_obligations.state` terminal (route L56-115).
- Grant/funder rows have **no pursue/pass write on the desk**: `next` says "Decide: pursue (push to GHL) or pass" (service L210, L230) but the buttons offered are Done/Waiting/Tomorrow. The actual pursue lives on `/goods/grants` (Push to GHL) and `/funding` (Pursue → GHL); pass exists only on `/pipeline` and `/ops/grant-recommendations` for the *recommendation* pool, which is a different pool (see §12).

### Links out / in
Out: `workHref` = `/goods/we-owe` (obligations, Goods only), `/people`, `actOrgHref()` (money, buyers, in-GHL funders), `/goods/foundations/scan` (undecided funders), `/goods/grants` (Goods grants) or `/grants` (others). Empty-state links to `/goods/we-owe` and `/people`.
In: rail entry 01; `/digest-preview` rows (`?rec=`); the sent digest email (`act-desk-digest.ts` L48: `${SITE}/org/act/desk?rec=…`).

### What it would show today (SQL)
Grant rows admitted, per project, using the desk's own thresholds:
```sql
WITH m(project, code, bar) AS (VALUES ('goods','ACT-GD',85),('justicehub','ACT-JH',40),('empathy-ledger','ACT-EL',40),('harvest','ACT-HV',40),('farm','ACT-FM',40),('contained','ACT-CN',40))
SELECT m.project, count(*) AS triage_rows,
  count(*) FILTER (WHERE g.ghl_opportunity_id IS NOT NULL) AS in_ghl,
  count(*) FILTER (WHERE g.deadline IS NOT NULL AND g.deadline <= CURRENT_DATE + 30) AS closing30,
  count(*) FILTER (WHERE (CASE WHEN m.project='goods' THEN g.goods_relevance_score ELSE (g.project_relevance->m.project->>'score')::int END) >= m.bar) AS fit_ge_bar,
  count(*) FILTER (WHERE g.ghl_opportunity_id IS NOT NULL OR (g.deadline IS NOT NULL AND g.deadline <= CURRENT_DATE + 30) OR (CASE WHEN m.project='goods' THEN g.goods_relevance_score ELSE (g.project_relevance->m.project->>'score')::int END) >= m.bar) AS desk_grant_rows
FROM m JOIN grant_opportunities g ON m.code = ANY(g.aligned_projects)
WHERE g.status IN ('open','ongoing','upcoming') AND (g.deadline IS NULL OR g.deadline >= CURRENT_DATE)
GROUP BY m.project ORDER BY m.project
```
```
project        | triage_rows | in_ghl | closing30 | fit_ge_bar | desk_grant_rows
contained      | 4  | 0  | 2 | 1 | 2
empathy-ledger | 3  | 2  | 0 | 0 | 2
farm           | 5  | 0  | 0 | 0 | 0
goods          | 46 | 32 | 2 | 3 | 36
harvest        | 3  | 0  | 0 | 0 | 0
justicehub     | 6  | 2  | 0 | 1 | 3
```
→ **43 grant rows**, 36 of them Goods, 32 of those only because they are already in GHL ("Work the application"). Whole desk-eligible tagged pool is 67 rows across six projects.

Funder rows (the service's `.limit(500)` window, ordered evidence_grade then fit):
```sql
SELECT count(*) FILTER (WHERE (stage IS NULL OR stage NOT IN ('parked','declined')) AND ghl_synced_at IS NOT NULL AND ghl_tags IS NOT NULL AND cardinality(ghl_tags) > 0) AS funders_in_ghl,
       count(*) FILTER (WHERE (stage IS NULL OR stage NOT IN ('parked','declined')) AND NOT (ghl_synced_at IS NOT NULL AND ghl_tags IS NOT NULL AND cardinality(ghl_tags) > 0) AND evidence_grade='A') AS funders_decision_due,
       count(*) AS scan_total
FROM (SELECT * FROM org_project_foundations ORDER BY evidence_grade NULLS LAST, fit_score DESC NULLS LAST LIMIT 500) s
```
→ `funders_in_ghl 8 | funders_decision_due 173 | scan_total 500` (table holds 1,553 rows; 1,053 never reach the desk because of the 500 cap).

Buyers: `goods_relationships` type=buyer by stage → identified 92, researching 29, in_conversation 5, proposal 2, contacted 1, repeat 2 → **129 open buyer rows, every one labelled "Goods"**.
Money: `SELECT count(DISTINCT contact_name), count(*), round(sum(amount_due)) FROM xero_invoices WHERE type='ACCREC' AND status='AUTHORISED' AND amount_due > 0` → 9 orgs, 10 invoices, $285,068 (the ledger service applies its own grouping; treat 9 as approximate).
Obligations: `act_obligations` **0 rows**. People: `act_people` **0 rows**.
So the pool today is roughly 43 grants + 181 funders + 129 buyers + ~9 money = **~360 rows, of which the page renders 80**. Daily-action marks in the last 30 days: **0** (`opportunity_context_events` signal_kind='daily_action' since now()-30d → 0 rows). Nobody is working this queue from the desk.

---

## 2. `/org/[slug]/grants` — Grants desk (the private ACT grants list)

**Page** `app/org/[slug]/grants/page.tsx` (server, `force-dynamic`). **Gate** L63-72: `isActSlug` AND (dev bypass `SKIP_AUTH_LOCAL=1` OR `isAdminEmail(user.email)`), else 404. This is the only workspace page that checks admin identity, because it exposes `act_private_grant_rounds`.
**Service** `lib/services/act-grants-desk.ts` `getActGrantsDesk()` L144-150 → `fetchLive()` L128-142 pages `grant_opportunities` and `act_private_grant_rounds` (service role) with `status in ('open','ongoing','upcoming')`; `buildDesk()` L57-118 drops rows whose `COALESCE(closes_at, deadline)` is past, dedupes by normalised URL (public wins), attaches per-project `projectEligibility()` (`lib/act-grant-eligibility.ts` L96-107) and fit per project (goods from `goods_relevance_score`, others from `project_relevance.{project}.score`) L77-84, sorts soonest close first, undated last.

### Fields per row (L161-192)
Fit pill (project view only; ≥60 green, ≥20 yellow), Closes pill (≤14d red, ≤45d yellow) + date, Grant name (link to `url`) + provider, Amount (min–max), Where (`geography`), Can apply (project view only: overall verdict + place verdict + one verdict per entity Pty/Butterfly/AKT), Source (`source` or "Private" badge for `act-private`).
Stat strip (L133-145): Live grants, Close within 30 days, No close date, Private SmartyGrants rounds.

### Filters (query string, L59-60, L83-101)
`?project=` (goods|justicehub|empathy-ledger|harvest|farm|contained as pills L117-122) → ranks by fit desc then close; hides overall='no' and fit < 20 unless `?show=all`. `?limit=` (300 default, "Show 500 more" L196-201). No text search, no geography filter, no status filter.

### Actions
None. Every row's only interactive element is the external `url`. No pursue, pass, save, push-to-GHL, note. Read-only table.

### Links: out — external grant URLs only. In — rail entry 06 "Grants"; One Desk `workHref` for non-Goods grant rows; MatterDecisionRail "Evidence" for the resources desk points at public `/grants` (shell L243), not here.

### What it shows today
```sql
SELECT status, count(*) AS n,
  count(*) FILTER (WHERE COALESCE(closes_at, deadline) IS NULL OR COALESCE(closes_at, deadline) >= CURRENT_DATE) AS not_past,
  count(*) FILTER (WHERE COALESCE(closes_at,deadline) IS NOT NULL AND COALESCE(closes_at,deadline) >= CURRENT_DATE AND COALESCE(closes_at,deadline) <= CURRENT_DATE + 30) AS within30,
  count(*) FILTER (WHERE COALESCE(closes_at,deadline) IS NULL) AS undated,
  count(*) FILTER (WHERE url IS NULL) AS no_url,
  count(*) FILTER (WHERE ghl_opportunity_id IS NOT NULL) AS in_ghl
FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming') GROUP BY 1 ORDER BY 1
```
```
ongoing  | 210  | 207  | 0  | 207  | 2   | 11
open     | 2954 | 2950 | 87 | 2631 | 830 | 99
upcoming | 5    | 5    | 0  | 5    | 2   | 4
```
Plus private rounds: `SELECT count(*) FROM act_private_grant_rounds WHERE status IN ('open','ongoing','upcoming') AND (COALESCE(closes_at,deadline) IS NULL OR COALESCE(closes_at,deadline) >= CURRENT_DATE)` → **619** (665 total). Corpus `grant_opportunities` = 26,903.
→ "All grants" shows ≈ 3,162 public + 619 private (before URL dedupe) ≈ **3,780 rows; 87 close within 30 days; ~2,843 have no close date**. Eligibility flags on live public rows: `dgr_required` set on **7**, `accepts_pty_ltd` on **301** (of 3,169) — so "Can apply" is "unknown" on almost every row, exactly as the file header L1-4 says.
Fit scores exist on 3,169 live rows for both goods and project_relevance (`live_scored_projects 3169 | live_scored_goods 3169`), but the tag threshold admits only the 67 rows in §1.

---

## 3. `/org/[slug]/funding` — Weekly funding desk ("Five decisions, not five hundred grants")

**Page** `app/org/[slug]/funding/page.tsx` (server, `force-dynamic`). Gate: `getProjectFundingPortfolio(slug)` returns null unless `isActSlug` (service L247) → 404. No admin check on the page, but its write endpoints require admin (below).
**Services** `lib/services/project-funding-service.ts` and `lib/services/funding-weekly-digest.ts`.

### Data source — `project-funding-service.ts` L244-310
- `org_projects` (status=active), `project_funding_profiles` (is_current), `act_grant_recommendations_current` (is_strong_fit, top 1000 by fit), `act_grant_recommendation_decisions`.
- For every profile: `rpc('search_project_funding_hybrid', {p_org_project_id, p_match_count: 15})` (L288-291) → `buildHybridWeeklyQueue()` L183-242 (drops decided opportunity_ids, past deadlines, dedupes by funder+name fingerprint, ranks by hybrid_score, **limit 5**). Falls back to `buildWeeklyFundingQueue()` L115-181 over strong-fit recommendations if hybrid returns nothing.
- Digest strip: `getLatestFundingWeeklyDigest('act')` reads the latest `funding_weekly_cycles` row (written by `/api/cron/funding-weekly-digest`, Monday 00:00 UTC per `vercel.json` L48-49; `generateFundingWeeklyDigest` L17-50 upserts with `delivery_status:'in_app'` — nothing is sent).

### Fields per queue item (L60-96)
rank number, project pill, "Needs verification" pill (hard-coded L67 regardless of `eligibilityDecision`), opportunity name, funder + `fit N/100`, `eligibilityReason`, hybrid/lexical/semantic/project score chips, Deadline + days remaining, Maximum amount. Buttons: "Review project route" → `/org/{slug}/{projectSlug}/funding`, "Official evidence ↗".
Below: "Project funding readiness" cards (L104-118) per `project_funding_profiles` row: code, completeness pill, name, description, entities / blocks / gaps counts → `/org/{slug}/{projectSlug}/funding`.

### Filters — none. Fixed five.

### Actions
- `PursueFundingForm` (`funding/pursue-funding-form.tsx`, client): amount sought, applicant entity, relationship owner, next action, due date, confirm checkbox → `POST /api/ops/funding/pursue` (`requireAdminApi`, `confirm===true`) → `funding-ghl.ts pursueFundingInGhl()` L18-37: reads `org_projects` + `act_grant_recommendations_current` (the opportunity must still be in the view or it throws L23), upserts `funding_ghl_handoffs`, creates/updates a **GHL opportunity** in the configured Grants pipeline (`findGrantPipeline`, stage `GHL_GRANTS_INITIAL_STAGE_NAME` default "Grant Opportunity Identified", contact `GHL_GRANTS_TRIAGE_CONTACT_ID`), then upserts `act_grant_recommendation_decisions` decision='pursuing'. After success a second button "Create optional Notion brief" → `POST /api/ops/funding/notion-brief` → `funding-notion.ts createOrUpdateFundingBrief()` creates a page in `NOTION_OPPORTUNITIES_DB_ID` and stores `notion_page_id` on the decision.
- `CorrectionForm` (`funding/correction-form.tsx`): not_useful / good_result / wrong_eligibility(+label) / wrong_fact + rationale → `POST /api/ops/ask-grantscope/corrections` → `recordCorrection()` (benchmark memory; the form copy L80-83 says corrections do not change what production surfaces).

### Links: out — `/pipeline` ("Open pipeline"), org root `?view=opportunities` ("Explore evidence"), per-project `/funding`. In — rail entry 05, `/projects` header, per-project funding page back-link.

### What it shows today
```sql
SELECT week_start, generated_at::date, delivery_status, metrics->>'queueSize' AS queue, metrics->>'decisionsThisWeek' AS decisions_wk, metrics->>'applyNow' AS apply_now, metrics->>'decisionReadyProfiles' AS ready, metrics->>'activeProfiles' AS profiles FROM funding_weekly_cycles ORDER BY week_start DESC LIMIT 3
```
```
2026-09-21 | in_app | 5 | 0 | 11 | 0 | 14
2026-09-14 | in_app | 5 | 0 | 25 | 0 | 14
2026-09-07 | in_app | 5 | 0 | 43 | 0 | 14
```
`SELECT completeness_status, count(*) FROM project_funding_profiles WHERE is_current GROUP BY 1` → `partial | 14`. So every queue item is "needs verification", zero decisions have been made in three weeks, and `funding_ghl_handoffs` has **0 rows** — the Pursue → GHL form has never been submitted successfully.

---

## 4. `/org/[slug]/pipeline` — Decision kanban over the recommendation view

**Page** `app/org/[slug]/pipeline/page.tsx` (server) + `pipeline/pipeline-kanban.tsx` (client, `@hello-pangea/dnd`). Gate: profile lookup; `getOrgPipelineData` returns null unless `isActSlug` (service L146) → "No pipeline configured" card. No admin check on the page; the write route requires admin.
**Service** `lib/services/org-pipeline-service.ts` L141-382.

### Data source
`act_grant_recommendations_current` (all rows, `.range(0,9999)` L151-157), `act_grant_recommendation_decisions`, `act_grant_recommendation_projects` (in_scope), `funder_context_snapshot` (temperature). Dedupes by opportunity_id keeping best-fit project (L195-212). Undecided rows enter "Discovered" only if strong fit AND fit ≥ `?min` (60) AND theme ≥20 AND eligibility ≥10 AND has url AND has deadline AND not cold-and-closing AND no past year in name AND not restricted-round AND ≤5 per project (L236-276). `?history=1` appends read-only "won" cards from `v_act_income_by_funder` (xero paid > $1K) L311-370.

### Fields per card (kanban L377-462)
temperature (WARM/TEPID/LIGHT/COLD from `funder_context_snapshot.relationship_score`), Fit N, PAST/TIGHT/SOON pill, name, funder, deadline, amount range, project code + "also fits" chips, "↗ in /tracker" when mirrored. Slide panel: FunderDossier, FunderTimeline, fit breakdown (theme/50, geo/15, elig/20, timing/15), flags, Funder page / Apply form links, "Move to" buttons.

### Filters — client state only: search, project select, strong-only, column visibility (lost/passed hidden by default). Query string: `?min=` (discovered threshold), `?history=1`.

### Actions
Drag or "Move to" → `POST /api/ops/grant-recommendations/decide` (`requireAdminApi`) → route L58-160: for pursuing/applied/submitted, mirrors the **alma** row into `grant_opportunities` (source `civicscope-act-recommendation`) if no mirror yet, upserts `act_grant_recommendation_decisions`, and upserts `saved_grants` for the admin user (the `/tracker` vocabulary). Cannot move back to Discovered (L189-196).

### Links: out — org root, `?view=opportunities` ("Observatory"), `/grants/{grant_opportunity_id}` (mirrored public detail), `/tracker`. In — `/funding` "Open pipeline", `/projects` "Open pipeline", org-root support hub "Grant kanban", `?view=pipeline` "Open board" (act-operating-desk L1627).

### What it shows today
```sql
SELECT decision, count(*) FROM act_grant_recommendation_decisions GROUP BY 1 ORDER BY 2 DESC
```
→ `passed 62 | won 26 | watching 1`. **Zero `pursuing`, `applied`, `submitted`** — the "Decide and act" kanban has never carried a live application. Won = the 26 recorded historical wins feeding `track_record_score`.
Recommendation view: `SELECT count(*), count(DISTINCT opportunity_id), count(*) FILTER (WHERE is_strong_fit), count(DISTINCT opportunity_id) FILTER (WHERE is_strong_fit), max(computed_at)::date FROM act_grant_recommendations_current` → **6,157 rows, 697 distinct opportunities, 34 strong-fit rows over 20 opportunities**, computed 2026-09-23. Per project (`GROUP BY project_code`): ACT-PI 16 strong, ACT-GD 8, ACT-FM 3, ACT-MY 3, ACT-JH 2, ACT-HV 2, the other five projects **0 strong** (ACT-CN, ACT-CORE, ACT-CS, ACT-EL, ACT-GP; max fit 43–53). So "Discovered" today holds at most ~20 cards.

---

## 5. `/org/[slug]/intelligence` — Command Center (relationship intelligence)

**Page** `app/org/[slug]/intelligence/page.tsx` (server, `revalidate = 1800` L7). Gate: profile exists. Not ACT-specific.
**Data** — six `exec_sql` queries (L103-166) keyed on `profile.linked_gs_entity_id`: `relationship_health` × `ghl_contacts` × `contact_entity_links`; `gs_relationships` for the linked entity (top 50 by amount); tag counts; platform totals (`gs_entities`, `alma_interventions_valid`, `justice_funding` grant lane, `alma_evidence`, `gs_relationships`); contacts going cold.
**Fields** — Contacts, Avg temperature, Going cold, Partners, LCAA stages; LCAA pipeline bars; temperature histogram; "Needs re-engagement" table (name, org, temp, days silent, stage, trend); CONTAINED campaign tag tiles; network tags; entity relationships (entity link, type, amount, dataset); platform stats.
**Filters / actions** — none. Links: `/entities/{gs_id}`, back to org root. **Inbound: none found** (not on the rail, not linked from org root). It is a grant-adjacent surface only through the `justice_funding` "Recorded Grants" total; it holds no opportunity, funder-target or decision data. Style is a third frame (gray cards, rounded-sm) unlike Quiet Ledger or Bauhaus.

---

## 6. `/org/[slug]/digest-preview` — Desk digest mock-up

**Page** `app/org/[slug]/digest-preview/page.tsx` (server). Gate `isActSlug`. Reads `getOneDeskPool(slug)` (same pool as §1, minus the handled/target logic) and shows two lists: decisions (`isDecision`, up to 15) and going due (`dueDays ≤ 7`, up to 15). Rows: project label, name (→ `/desk?rec=`), `next`, dueDays. No filters, no actions, no inbound link. Header text says the digest is "Daily 07:00 Brisbane, delta-only".
The real sender is `lib/services/act-desk-digest.ts composeDeskDigest()` (L48+) via `/api/cron/desk-digest` at 21:00 UTC (`vercel.json` L44-45). `SELECT count(*), max(sent_at) FROM digest_log` → **3 rows, last 2026-09-21T21:00:43Z**. The digest works; the preview page is its shape-check.

---

## 7. `/org/[slug]/[projectSlug]` — Project workspace, and `/[projectSlug]/funding`

### `/org/[slug]/[projectSlug]/page.tsx` (2,055 lines, server)
Money-relevant pieces:
- `fastRouteHref` L144-152: route type `grant` → `/grants?type=open_opportunity&sort=closing_asc&project={projectSlug}&quality=ready`. **This URL is dead in meaning**: `app/grants/page.tsx` reads only `q,state,topic,from,to,sort,dir` (L38-45) and renders the *grant recipients* browser over `justice_funding` via `rpc('grant_recipient_browse')`. The same `open_opportunity` link pattern is emitted by `org/[slug]/page.tsx` L293, L349, L505, L554, L583, L689, L691, `act-project-field-map.tsx`, `wiki/*` and `lib/services/act-opportunity-context.ts` (grep: 13 files). Every "Open grant finder / Goods grant feed / Find local grants" button in the workspace lands on the public recipients table.
- Goods branch L163-590: "Fix the blockers before chasing more grants", "Funding + foundation pipeline" (from `goodsFundingPipelineRows`, a typed module), "Focused opportunity scan" (`goodsFocusedGrantRows` typed rows linking to `/opportunities/ecosystem?project=goods`).
- Generic branch: `getOrgFundingByProgram/ByYear` (ABN-based history), `getOrgPipeline(profile.id, project.id)` + keyword-matched unassigned pipeline (L905-932, `org_pipeline`), `getOrgFoundationPortfolio` filtered to the project (L904, `org_project_foundations`), `getMatchedGrantOpportunities` (L900), `#project-foundations` section (L742-806) rendered by `ProjectFoundationsClient` and `#project-pipeline` "Run next" cards (L807-828) whose href is `action.grant_finder_href` (again the dead `/grants?type=…` pattern).
- Actions (via `org/_components`): `matched-grants.tsx` L72 `POST /api/org/{id}/pipeline` (add a matched grant to `org_pipeline`); `project-foundations-client.tsx` L934-1143 GET/POST/PATCH/DELETE `/api/org/{id}/projects/{projectId}/foundations` (add/remove foundation targets, log interactions); `pipeline-filter.tsx` export link `/api/org/{id}/pipeline/export?id=`.

### `/org/[slug]/[projectSlug]/funding/page.tsx` (server, `force-dynamic`)
- Reads `getProjectFundingPortfolio(slug)` (profile card) and `getProjectApplyNow(projectSlug)` (`lib/services/act-project-apply-now.ts` L127-193): `org_projects` → `act_grant_recommendation_projects.org_project_id` → `act_grant_recommendations_current` where `project_code` (top 400 by fit), split into `dated` (feed_status=apply_now, soonest first, 10) and `rolling` (fit desc, 10).
- Fields per candidate (`CandidateCard` L29-94): Strong fit / Best available #n / "We have won from this funder" / Rolling pills, name, funder + fit, five factor chips (Theme, Geography, Eligibility, Timing, Track record), Closes + days, Maximum, Last verified, flags, Apply ↗ / Official source ↗.
- Also: funding-route note when `primary_funding_route` is buyers/overhead/earned (L120-129), the project's `next_question` (L133-144), unresolved profile decisions (L146-151).
- Filters: none. Actions: **none** (external links only). No pursue, no pass, no correction here.
- In: `/funding` queue "Review project route" and readiness cards; `/projects` "Funding →". Out: `/funding`.
- Registry today: `SELECT project_code, project_label, in_scope, primary_funding_route, left(next_question,60), org_project_id IS NOT NULL FROM act_grant_recommendation_projects` → 12 rows, 11 in scope (ACT-IN out), all linked to `org_projects`; routes: buyers (ACT-CS), overhead (ACT-CORE), mixed (ACT-GD), grants (the other 9). Every project has a `next_question`.

---

## 8. `/org/[slug]/goods/grants` — Goods grants triage

**Page** `app/org/[slug]/goods/grants/page.tsx` (server, `force-dynamic`). Gate: profile (fast local or DB). No admin check.
**Service** `lib/services/goods-grants-triage.ts` `getGoodsGrantsTriage()` L53-148: `grant_opportunities` status in (open,ongoing,upcoming) ordered by `goods_relevance_score` desc, `.limit(3000)`, drops past `deadline` (not `closes_at`), sorts deadline-first then fit, returns first 300; plus `agent_schedules`/`agent_runs` `ilike '%grant%'` for the source-freshness panel.
**Fields** (L210-243): Deadline pill, Grant (url) + `pipeline_stage` badge, Provider, Fit (`goods_relevance_score`), Amount, Where (`geography` normalised), Entity fit (via Butterfly / Pty OK / check from `dgr_required`, `accepts_pty_ltd`), Pipeline = `PushGrantGhlButton`.
Summary cells: Live, Closing ≤30, High fit (70+), With hard deadline. Coverage note L102-108 is hard-coded prose.
**Filters** (query string L52-66): `?scope=closing` (≤60d), `?fit=high` (≥70), `?geo=` (top 8 geographies as pills).
**Action**: `push-grant-ghl-button.tsx` → `POST /api/goods/grants/push-ghl` (`requireModule('tracker')`) → `goods-grant-ghl.ts pushGoodsGrantToGHL()` creates a GHL opportunity in the Grants pipeline attached to the triage contact, then writes `grant_opportunities.ghl_opportunity_id` (route L44-47). Idempotent on that column. This is the write that turns a One Desk grant row from "decision due" into "in GHL".
**Links**: in — Goods rail "Money in › Grants", One Desk `workHref` for Goods grant rows, `/goods` breadcrumb. Out — external urls.
**Today**: same live set as §2 public side (3,162 not-past), sliced to 300; `in_ghl` across the live set = 114 (11+99+4). Note this page ranks *every* live grant by Goods fit, not just the 46 tagged ACT-GD rows.

---

## 9. `/org/[slug]/goods/foundations` (+ `/scan`) — Foundation targets and Funder scan

### `/goods/foundations/page.tsx` (server, `force-dynamic`)
**Service** `lib/services/goods-foundation-targets.ts` L98-201: `v_goods_foundation_targets` (top 60 by `priority_score`, `?filter=bridged` → `has_bridge`), a second full read of the view for the summary, and an enrich pass on `foundations` (type → `requiresDgr`, vintage).
**Fields** (L115-183): Top target flag (top 10 by priority), name, DGR badge, "Ancillary fund · route via Butterfly DGR" link, matched theme chips, "data from YYYY" staleness, Warm bridge (connector + bridged org), geographic focus, giving/yr, grant range, `TrackButton`.
Stats: Total addressable giving/yr, Fit targets, Warm bridges, DGR-endorsed.
**Filters**: `?filter=bridged` only.
**Action**: `track-button.tsx` → server action `trackFoundationTarget()` (`foundations/actions.ts`, `'use server'`, `requireWriteAccess()`): inserts into **`goods_relationships`** (relationship_type='funder', stage='identified', `entity_id=gs_entity_id`, `source_refs.source='foundation-target'`) and revalidates `/goods/foundations` + `/goods/engagement`. The view excludes engaged entity_ids so the row disappears.
**Today**: `SELECT count(*) FROM v_goods_foundation_targets` → **2,098** targets (75 bridged); `SELECT count(*) FROM goods_relationships WHERE relationship_type='funder' AND source_refs->>'source'='foundation-target'` → **0** — Track has never been used. `goods_relationships` funders overall: identified 107, proposal 19, repeat 17, researching 13, contacted 12, committed 3, declined 1.

### `/goods/foundations/scan/page.tsx` (server)
**Service** `getGoodsFunderScan()` = `getFunderScan('goods')` (`goods-funder-scan.ts` L131-134) over `org_project_foundations` (a different table from the targets view and from `goods_relationships`).
**Fields**: foundation name + GHL email, GHL warmth chip (from cached `ghl_tags`; link to GHL contact), discovery stage, fit, giving/yr (placeholders 25K/100K/500K nulled L92-95), next step. Cells double as `?warmth=` filters; `?view=unworked` (warm in GHL but stage saved/parked) and `?view=unpushed` (grade A, not in GHL).
**Actions**: none by design (L189: "there is no one-click push here by design"; push happens in GHL itself).
**Today**: `org_project_foundations` for goods → 247 rows, 22 synced from GHL, 20 grade A (18 not in GHL). Whole table 1,553 rows across six projects; only Goods has any GHL sync (22) plus one Empathy Ledger row. Grade-A-not-in-GHL per project: justicehub 41, farm 33, empathy-ledger 31, harvest 31, picc 23, goods 18 = 177 (the "177 new decisions" the first digest reported).

---

## 10. `/org/[slug]/goods/buyers` — Buyers & procurement

**Page** `app/org/[slug]/goods/buyers/page.tsx` (server, `force-dynamic`). **Service** `goods-buyer-pipeline.ts` (`goods_relationships` type=buyer, `select('*')`) plus `getGoodsRelationshipPower()` / `getGoodsRelationshipFunding()` chips (views `v_goods_relationship_power` / `_funding`; memory notes they need grants to anon or chips render empty).
**Fields** (`BuyerCard` L67-149): name, Buyer badge, Open in GHL ↗ / GHL linked / No GHL signal, PowerChip, FundingChip, stage + last touch, "Going quiet" (stage-based rot L52-65), Next (computed `nextBestAction`), due pill, notes, band + warmth, open ask, received.
Header: leads with counts when no money is entered (L176, L232-249 — "No revenue or ask amounts recorded yet").
**Filters**: `?filter=open|no_next`. **Actions**: none (L100 title: "Push this buyer from its community dossier — pushes are deliberate, not inline"). Editing amounts happens "in the warmth registry" (i.e. `/goods/engagement`).
**Today**: 131 buyer rows, 129 open (see §1). One Desk imports all 129 as Goods rows.

---

## 11. `/org/[slug]/page.tsx` (workspace home) and `/org/[slug]/projects`

### Org root — `app/org/[slug]/page.tsx` (966 lines) → `FastOrgDashboard` L92-205 → `ActOperatingDesk` (`_components/act-operating-desk.tsx`, 2,106 lines, client)
Views via `?view=` (L65, L103-116): today (default), opportunities (Curiosity), triage, relationships, pipeline, money, evidence.
Data (L142-175): `getOrgFinancialPulse`, `getOrgOutstandingReceivables`, `getOrgVerificationStatus`, `getOrgFoundationPortfolio` (`org_project_foundations`), `getOrgProjectSummaries`, `getOrgPipeline` (`org_pipeline`), `getOrgContacts` (+GHL), `getMatchedGrantOpportunities` (the older grant matcher), `getWikiSupportFrontierQueue`, `getOrgOpportunityDecisions` (`opportunity_decisions`), `getActOpportunityContextStatus`, `getActFunderIntelligence` (870-line desk over `org_project_foundations` + interactions), `getActRelationshipLedger` (xero), daily-action states/memory.
- **Today** view: `ActTodayFocus` — same Done/Waiting/Tomorrow marks to `/api/org/{id}/daily-actions` as One Desk (L48, L74). The shell comment L85 says "Today retired 2026-08-05 — One Desk IS today", yet `/org/act` still renders it.
- **Curiosity** (`?view=opportunities`): `ActRecordReview` over `buildOpportunityRows({matchedGrants, foundationPortfolio, pipeline, frontierQueue, decisions})` (L1237-1244); verbs Pursue (`act`) / Pass (`close`) (act-record-review L101-102) → `POST /api/opportunity-intelligence/actions` kind `record_review` (L217) → `opportunity_decisions` + `opportunity_context_events`. `SELECT count(*) FROM opportunity_decisions WHERE org_profile_id='8b6160a1-…'` → **3**.
- **Triage** (`?view=triage`): `ActFunderIntelligenceDesk` → PATCH/POST `/api/org/{id}/funder-intelligence` (writes `org_project_foundations`, `org_project_foundation_interactions`, `opportunity_decisions`, `opportunity_context_events`). `org_project_foundation_interactions` → **6 rows**.
- **Pipeline** (`?view=pipeline`): `ActActionQueue` + `ActPipelineStatusControl` → PATCH `/api/org/{id}/pipeline` (`org_pipeline.status`, plus `opportunity_decisions` memory) ; "Open board" → `/pipeline`.
- **Money** (`?view=money`): `ActRelationshipLedger` (xero) with follow-up/contribution writes to `/api/org/{id}/relationship-follow-ups|contributions`.
- `OrgSupportHub` L207-700: "Best opportunities" via `GrantPreviewTrigger`, links to `/pipeline` "Grant kanban", `/reports/grant-frontier`, and six `/grants?type=open_opportunity…` links (dead, §7).
`org_pipeline` for ACT today: `prospect 78 ($7.50M) | passed 31 ($4.30M) | submitted 2 ($1.80M) | upcoming 1 ($30K)`; **0 with next_action** (the 2026-08-10 memory still holds), 18 linked to a `grant_opportunity_id`.

### `/org/[slug]/projects` — `app/org/[slug]/projects/page.tsx` (server) via `lib/services/act-cross-projects.ts`
Reads `org_projects` (active), `org_pipeline` (per project aggregates), `org_project_foundations` (stage counts). Columns: Project + code, Pipeline count, Value, Submitted (+upcoming), Next deadline, Foundations in motion (active/total), "Funding →". No filters, no actions. Links `/funding`, `/pipeline`, `/org/{slug}/{project}`, `/org/{slug}/{project}/funding`. In: rail "All projects →". Footer L131-135 discloses that owner/next-action columns are empty.

---

## 12. Ops and public surfaces

### `/ops/grant-recommendations` — `app/ops/grant-recommendations/page.tsx` (server) + `grant-recommendations-client.tsx` (1,263 lines, client)
Gate: middleware `/ops` prefix (session only); the decide/sync routes require admin.
Data: `act_grant_recommendations_current` (all rows to 10,000), `act_grant_recommendation_decisions`, `act_grant_recommendation_projects` (in_scope), `funder_context_snapshot`.
Fields (Recommendation interface L8-31): project, opportunity, funder, deadline, min/max, is_national, jurisdictions, eligible_org_types, focus_areas, keywords, source/application urls, theme/geo/eligibility/timing scores, fit, strong, flags. Per-project summary strip (total, strong, ≥80, max).
Filters (client state L140-149): project, strong-only, min score (40), search, deadline window (30/60/90/rolling), funder, dedupe by opportunity, pile by temperature|deadline|none, decision filter (active default).
Actions: Pursue/Watch/Pass/Applied/Submitted/Won/Lost → `POST /api/ops/grant-recommendations/decide` (same route as §4, mirrors alma → `grant_opportunities` → `saved_grants`); "Sync to Notion" → `POST /api/ops/grant-recommendations/sync-notion` (`include_undecided`), which maps decisions to Notion stages (route L11-20) — note this conflicts with `docs/specs/grants-notion-handoff-spec.md`'s rule that nothing lands in Notion automatically (memory `project_act_funding_radar`).
Links: `/ops/grant-recommendations/triage`. Inbound from ACT workspace: none.

### `/ops/grant-recommendations/triage` — `triage/page.tsx` + `triage-client.tsx`
Data: `alma_funding_opportunities` where `opportunity_type='unverified'`, plus `funder_context_snapshot`. Fields: name (source link), funder, amount, deadline, FunderDossier, description, focus areas. Filter: funder select. Action: seven classify buttons → `POST /api/ops/grant-recommendations/triage` → updates `alma_funding_opportunities.opportunity_type/verification_status`. `SELECT count(*) FROM alma_funding_opportunities WHERE opportunity_type='unverified'` → **14,516** of 23,705 — the page would render 14,516 cards with no pagination (L152-153 maps `filtered` with no slice).

### `/home` — `app/home/page.tsx` (882 lines) + `home-client.tsx` (2,782 lines)
Gate: middleware session. This is the per-user CivicGraph product home (saved_grants, saved_foundations, alerts, agent runs, source health). ACT-specific block L436-530: reads `act_grant_recommendations_current` (fit ≥50), decisions, `funder_context_snapshot` → `actUrgentRecs` (strong, deadline ≤14d) and `actProjectLenses` with **hard-coded status prose per project** (L513-520: "Blocked — entity option memo required…", "Scout —…"). Client renders "ACT Project Lenses · Grant Recommendations" (home-client L1160-1196). Actions on grants here: track → `POST /api/tracker/{grantId}` (saved_grants), pre-sweep, alerts. `saved_grants` today: discovered 2,158, lost 648, expired 84, researching 15, pursuing 10, submitted 1.

### `/grants` (public) — `app/grants/page.tsx`
**Not an opportunity list.** It is the *grant recipients* browser over `justice_funding` (`rpc('grant_recipient_browse')`, `grant_browse_stats`), filters `q,state,topic,from,to,sort,dir`. `/dashboard/browse/grants/page.tsx` is a 307 redirect to `/grants`. Every workspace link of the form `/grants?type=open_opportunity&…` (§7) therefore opens the wrong thing.

### `/grants/[id]` (public) — `app/grants/[id]/page.tsx` (610 lines)
Reads `grant_opportunities` by id (L116-120), `search_grants_semantic` (similar), `foundations` (thematic overlap), `get_grant_award_history` (tier-gated winners), and an `exec_sql` over `org_pipeline` for "In your pipeline" (L190-205). Actions via `GrantActions`/`GrantNotes`/`PartnerPicker` → `/api/tracker/{grantId}` (saved_grants stage/notes/partners), `/api/grants/send`. This is where `/pipeline`'s "↗ in /tracker" and the org-root `GrantPreviewTrigger` land. Not gated (public), though the page's award-history winners are tier-gated.

---

## 13. JEV — where it touches these surfaces

Verified in code:
- `scripts/score-project-rubric.mjs` (registry `score-project-rubric`, nightly `--apply`, `agent-registry.mjs` L1229-1230) asks JEV (`JEV_API_KEY`, model `jev-latest`, L61, L174-199) a written rubric per project and **writes into `grant_opportunities.project_relevance.<project>.rubric = {score, confidence, geography_excluded?}` and `project_relevance.rubric_meta`** (header L30-32). `applyProjectTags` ORs keyword|rubric and records `tagged_by`; Goods joined in #520 (`scripts/lib/goods-relevance.mjs` L299-323 `goodsRubricQualifies`), which writes `goods_relevance_signals.tagged_by='rubric'` (rubric L290-298). Incremental by default (L222-231) because JEV wobbles at the threshold.
- No table has a JEV column except `donor_entity_match_rejections.jev_confidence` (`SELECT table_name, column_name FROM information_schema.columns WHERE column_name ILIKE '%jev%'`). No `apps/web` page reads the rubric verdict directly: `grep -rli jev apps/web/src` → only `app/charities/[abn]/funders/page.tsx` and `lib/community-funders.ts` (donor matching, not grants).
- So JEV reaches the desk only as an **invisible tag**: a rubric-tagged grant appears on `/desk` and `/grants` with a keyword fit score (0 for non-Goods when the keyword scorer rejected it, since `project_relevance.{p}.score` is the keyword score), never with its rubric score or confidence, and nothing in the UI says "JEV put this here". Memory `project_jev_evaluation` records the desk moved 19 → 31 tagged; today's count of desk-eligible tagged rows is 67 (§1). No surface lets a human confirm or overturn a JEV verdict; the only correction loop is `/funding`'s CorrectionForm, which writes benchmark memory for the *hybrid recommender*, a different system.

---

## 14. Judgement

### The pools do not agree with each other
There are **four independent "what grants should ACT chase" engines** feeding different pages, and none of them shares a decision record:
1. `grant_opportunities` + `aligned_projects`/`project_relevance` (keyword + JEV) → `/desk`, `/grants`, `/goods/grants`. Decision write: `ghl_opportunity_id` (push to GHL). 67 desk-eligible rows.
2. `act_grant_recommendations_current` (alma MV, five-factor) → `/pipeline`, `/ops/grant-recommendations`, `/{project}/funding`, `/home` lens. Decision write: `act_grant_recommendation_decisions` (+ mirror into `grant_opportunities` + `saved_grants`). 697 opportunities, 20 strong.
3. `search_project_funding_hybrid` RPC (embeddings over `project_funding_profiles`) → `/funding` five-place queue. Decision write: `funding_ghl_handoffs` + `act_grant_recommendation_decisions`. 0 handoffs ever.
4. `getMatchedGrantOpportunities` (older matcher) → org-root Curiosity / support hub. Decision write: `opportunity_decisions` (3 rows) and `org_pipeline` (112 rows, 0 next actions).
Pass in one engine does not pass in another. A grant passed on `/pipeline` (62 passes) is still "decision due" on `/desk` if it carries an ACT tag, because the desk never reads `act_grant_recommendation_decisions`.

### Same story for funders
`org_project_foundations` (scan, funder-intelligence desk, One Desk funder rows), `v_goods_foundation_targets` (foundation targets), and `goods_relationships` type=funder (warmth registry, where Track writes) are three lists with three stage vocabularies (`saved/parked/approach_now/priority/in_conversation` vs `identified/researching/contacted/…`) and no join between them except entity id exclusion in the targets view. Buyers live only in `goods_relationships`.

### What each surface uniquely does (what retiring it would lose)
- **/desk**: the only cross-kind, deadline-first queue and the only thing the daily email links to. Unique: horizon grouping, "Do this now", obligations/people slots (both empty today). Loses nothing else; its Done/Waiting/Tomorrow marks are unused (0 in 30 days).
- **/grants**: the only place with per-entity eligibility verdicts (Pty/Butterfly/AKT × place) and the only reader of `act_private_grant_rounds` (619 live private rounds). Losing it loses eligibility and private rounds entirely.
- **/goods/grants**: the only "Push to GHL" for a grant, the only source-freshness panel, the only geography filter. Its ranking (every live grant by Goods fit) duplicates /grants?project=goods.
- **/funding**: the only Pursue → GHL form that carries amount/applicant/owner/next-action, and the only Notion brief creator, and the only human-correction form. Never used (0 handoffs, 0 decisions in 3 weeks, every profile `partial`).
- **/pipeline**: the only stage board (discovered → won) and the only funder dossier/timeline in the workspace. 0 live stages beyond watching.
- **/{project}/funding**: the only per-project ranked list with the five-factor breakdown, funding-route note and `next_question`. Read-only.
- **/goods/foundations**: the only net-new philanthropy target list (2,098) with warm board-bridges, and the only Track write. Never used.
- **/goods/foundations/scan**: the only GHL-truth vs discovery-stage mismatch view. Read-only, Goods-only (22 synced rows).
- **/goods/buyers**: the only buyer surface. Read-only; amounts all $0.
- **/projects**: the only side-by-side portfolio view. Aggregates only.
- **/org/act (root)**: Curiosity Pursue/Pass, funder triage, pipeline status control, relationship ledger writes — the richest set of writes, all into tables nothing else reads (`opportunity_decisions` 3 rows, `org_pipeline` next actions 0).
- **/ops/grant-recommendations** + **/triage**: the only full recommendation table with 9 filters and the only alma classifier UI (14,516 backlog, unpaginated). Not linked from the workspace.
- **/intelligence**, **/digest-preview**: no unique write; intelligence has no inbound link and a third visual frame.
- **/home**: per-user tracker home; its ACT lens duplicates /pipeline's strong-fit view with hard-coded status prose.

### Closest to "the one place"
**/org/act/desk** is the closest in shape (one ranked queue, kinds as filters, rail-owned lenses, the digest already points at it) and Ben's recorded taste says so (memory `feedback_ben_ux_taste_one_desk`). But it is the furthest in *substance*: it cannot pursue or pass anything, it renders 80 of ~360 rows, 129 of those are Goods buyers, 173 are grade-A foundations from a 500-row cap, its "decision due" grant rows ignore the 62 passes recorded elsewhere, and its only write is a per-day tick that expires overnight.
The decision **record** that already works is `act_grant_recommendation_decisions` (89 rows, stage vocabulary, GHL + Notion + tracker bridges, used by four surfaces). The eligibility and private-round **facts** live only behind `/grants`. The **relationship truth** is GHL, mirrored only for 23 foundations and 114 grants.
A one-place rebuild that keeps the desk's shape would need: one grant pool (either point the desk at `act_grant_recommendations_current` and give up per-entity eligibility, or bring eligibility + private rounds + JEV rubric fields into the alma view), one decision table the desk both reads and writes (pursue/pass on the row, not Done/Tomorrow), the GHL push moved onto the row, and a project/kind split that stops 129 Goods buyers burying six projects' grants.

### Things that are simply broken and cheap to fix
- Every `/grants?type=open_opportunity…` link in the workspace (13 files) opens the justice_funding recipients table.
- `/ops/grant-recommendations/triage` renders all 14,516 unverified rows at once.
- `/funding` marks every item "Needs verification" unconditionally (page L67) while computing `eligibilityDecision` it never shows.
- The desk's funder feed is capped at 500 of 1,553 rows by `.limit(500)` with a sort that puts grade A first, so grade B/C rows of any project can never appear.
- Two "Today" queues exist (`/org/act` view=today and `/desk`) writing the same `daily_action` events.
