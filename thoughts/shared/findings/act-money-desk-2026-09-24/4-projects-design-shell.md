# 4. Projects and communities, design and shell, sibling money tables

Sections 7, 8, 15. 2026-09-24, from four reader notes (communities-and-projects, design-and-ui, shell-auth-actions, followup-sibling-repos-money-tables). SQL ran via `scripts/gsql.mjs`; nothing new run here. Paths under `apps/web/src/` unless rooted.

## 7. Projects and communities

### 7.1 Project list (no canonical one: 8 registries, 3 code namespaces)

Entities and areas are Ben's 2026-09-14 answers as coded in `lib/act-grant-eligibility.ts:22-37`; org codes from `org_projects` (14 rows, ACT org `8b6160a1…`).

| project | JSON code | org_projects | can apply (TS) | area (TS) |
|---|---|---|---|---|
| Goods on Country | ACT-GD | ACT-GD | pty, butterfly | NT QLD WA |
| JusticeHub | ACT-JH | ACT-JH | pty, akt | national |
| Empathy Ledger | ACT-EL | ACT-EL | pty, butterfly | national |
| Harvest | ACT-HV | ACT-HV | pty, butterfly | LGA Sunshine Coast QLD |
| Farm / BCV | ACT-FM | ACT-FM | pty, butterfly | LGA Sunshine Coast QLD |
| Contained | ACT-CN | **ACT-JH-CT** | pty, butterfly | national |

Not on the desk but in `act_grant_recommendation_projects` (12 rows): PICC ACT-PI (abn 14640793728), Mounty Yarns ACT-MY, Gold.Phone ACT-GP, CivicGraph ACT-CS (org code **ACT-JH-CG**, legacy ACT-CG), ACT Core ACT-CORE, ACT-IN out of scope. PICC and Mounty Yarns hold 290 and 49 strong ALMA fits (`is_strong_fit`). Geography disagrees by file: Goods is NT/QLD/WA in TS (:31) and `scripts/score-project-rubric.mjs:83`, NT/WA/QLD/SA in `scripts/lib/goods-relevance.mjs:58`, home QLD,NT in the rec table. No project row anywhere carries an LGA code or community id; "Sunshine Coast" is a TS literal (:34-35).

**Entities.** Legal (CLAUDE.md): Pty ABN 36697347676 (no DGR), Butterfly 22155132684 (DGR), AKT 73669029341 (no DGR). DB: `org_applicant_entities` has 2 rows, "A Curious Tractor" carrying the **sole-trader ABN 21591780066** with `dgr_status unknown`, plus AKT. **No Butterfly row; the Pty ABN is nowhere in the DB.** `project_applicant_routes` (14 rows, all `direct`) has no reader. `entityVerdict` (`act-grant-eligibility.ts:81-86`) answers only when the grant recorded `dgr_required` (7 of 5,246 live) or `accepts_pty_ltd` (365).

**Themes.** Five unlinked, undated vocabularies: `org_projects.metadata.funding_tags` (4 of 14 projects), `act_grant_recommendation_projects.theme_keywords` (7 to 23 each), `project-relevance.mjs` + `goods-relevance.mjs` tiers, rubric prose judged by JEV (theme only, `score-project-rubric.mjs:128`), `project-codes.json` `alma_program`.

### 7.2 Where communities live

| store | rows | place? | read by |
|---|---|---|---|
| `act_communities` | 3: Barkly, Urapuntja, Bwgcolman | `geo='{}'` on all; 0 links, 0 obligations | `lib/services/act-communities.ts:55-135` |
| `goods_communities` | 1,543 | postcode on all; `lga_code` 746; NT lead/active 60: `lga_name` null 52, `lga_code` null 58, `local_government` (council) on 58, read by nothing | goods hub; detail joins `phidu_lga_health` on the null `lga_code` (`goods-community-detail.ts:374-378`) |
| `nt_communities` | 75 | postcode, region, land council; no FK | `v_nt_community_buyer_crosswalk` |
| `ACT_PLACE_FIELDS` | 2 TS literals (`act-place-fields.ts:43-170`) | display strings | `act-barkly-field.ts:492-560` (ILIKE; `justice_funding` read without `measure_kind` at :512-518) |

`SELECT count(*) FILTER (WHERE lga_code IS NULL), count(local_government) FROM goods_communities WHERE state='NT' AND priority IN ('lead','active')` gives 58 | 58 of 60. 236 NT rows say `lga_name='Laverton'` (WA) from postcode 0872, which spans 7 LGAs in `postcode_geo`; 0822 spans 14, so postcode cannot backfill remote NT. Barkly: geo `{}`; 24 Barkly-ish goods rows keyed three ways; no grant carries `70420` or `Barkly` in a structured field.

### 7.3 Grants carry almost no place

```sql
SELECT count(*), count(*) FILTER (WHERE geography<>''), count(*) FILTER (WHERE metadata ? 'place'), count(dgr_required), count(accepts_pty_ltd)
FROM grant_opportunities WHERE status IN ('open','upcoming') OR status IS NULL   -- 5246 | 2859 | 1 | 7 | 365
```
ALMA lane: `geography_score = 0` on all 35,761 `act_grant_recommendations` rows because `is_national` (21) and `jurisdictions` (337) are empty on over 98% of 23,705 opportunities. `locationVerdict` (`act-grant-eligibility.ts:65-78`) is a state-token gate: Harvest says yes to any `AU-QLD` grant. `aligned_projects` mixes namespaces: `ACT-GD` 67, `goods` 63, `WATCH` 133.

### 7.4 Missing before "fits Goods because it funds X in Barkly" computes

| gap | fix | today |
|---|---|---|
| A one project identity | `org_projects.id` (only FK-backed key); map slugs, codes, `aligned_projects` to it | none |
| B entity truth | Butterfly row (dgr endorsed); Pty ABN on the ACT row; `dgr` routes plus a reader | TS boolean |
| C project to community edge | `project_place(project_id, community_id / lga_code / state, role, source, since)` | none; spec allows (`docs/specs/community-records-spec.md:37`) |
| D community to LGA key | write `act_communities.geo`; map `local_government` to ABS codes; re-derive 0872/0822 from ILOC/SAL | `local_government` 58/60 |
| E grant to place key | `grant_place(grant_id, level, code, source, confidence)` from the JEV read that already extracts DGR | 1 grant |
| F one theme vocabulary | derive tags from rubric prose + JEV, with source and date | 5 lists |

Then the sentence is a join: project_place ∧ grant_place ∧ rubric score ∧ applicant route satisfies `dgr_required`.

## 8. Design, shell, auth, recipe

### 8.1 The skin is Quiet Ledger (`ql-*`), not Bauhaus, not `.shell`

`/org/act/*` renders inside `<div class="ws act-workspace">` + `ActWorkspaceShell` (`app/org/[slug]/layout.tsx:36-53`), chromeless (`lib/public-frame.ts:24,32-34`). DESIGN.md never names Quiet Ledger; specs do (`docs/specs/one-desk-widened-ux-spec.md:8`). Of 138 files under `app/org`: `ql-*` 14, `bauhaus-*` 83 (softened by `app/globals.css:290-333`), raw palette 81, raw hex 34. Ben must confirm this frame once; DESIGN.md `:127-144` reads as if `.shell` were the signed-in frame.

Tokens (`app/globals.css:9-27`; `--ws-*` vars `:247-260` mirror them):

| use | class | hex |
|---|---|---|
| page ground | `bg-ql-surface2` / `--ws-surface-0` | #F6F1E8 |
| panel / selected | `bg-ql-surface` / `bg-ql-warm` | #FFFCF7 / #F2E5D6 |
| text / secondary / tertiary | `text-ql-ink` / `-text2` / `-muted` | #27221D / #70685F / #AAA49B |
| dark bar, primary button | `bg-ql-bar text-ql-inverse` | #211F1C |
| eyebrow / positive money / alert | `text-ql-accent` / `-moss` / `-alert` | #9A673B / #5F725C / #A44A3B |
| hairline | `border-ql-border` | #DDD4C7 |
| kind chips | `bg-ql-kind-{money,funder,grant,buyer,obligation,person}` | |

Fonts: `font-ql-display` Newsreader for the one H1; `font-ql-mono` IBM Plex Mono for figures; body is system-ui (`globals.css:240`). Radius at most `rounded-md`, 1px borders, no shadow, 11px floor (DESIGN.md:37). Never `--shell-*` inside `/org` (unscoped, resolves to nothing). Rail colours are hard-coded hex (`act-workspace-shell.tsx:18,129,138`).

### 8.2 Primitives

| name | path | props / use |
|---|---|---|
| `ActWorkspaceShell` | `app/org/[slug]/_components/act-workspace-shell.tsx:61` | `{slug, projects, children}`; rail entry = one object in `workModes` `:83-103`; lenses `DESK_LENSES :343-353` |
| `ActWorkspacePageHeader` | `_components/act-workspace-page-header.tsx:3` | `{eyebrow, title, description?, controls?, meta?, sticky}`; eyebrow required (anti-pattern) |
| `DeskMarkButtons` / `DeskObligationButtons` | `desk/desk-mark-buttons.tsx:8`, `desk-obligation-buttons.tsx:9` | `{orgProfileId, actionId, title, detail}` POST; `{orgProfileId, obligationId, owedTo}` PATCH; then `router.refresh()` |
| `Due`, `KindChip`, `chip()` | `desk/page.tsx:38-51,87-90` | not exported; lift into `_components/desk-ui.tsx` first |
| `getOneDesk(slug)` | `lib/services/act-one-desk.ts:99-123` | `{active: DeskRecord[], handled, orgProfileId, target}`; `DeskRecord :32-59`; extend, do not fork |
| `getActGrantsDesk()` | `lib/services/act-grants-desk.ts:31-57` | `DeskGrant`; pure `buildDesk` with a test |
| `Stat`, `StatRow`, `Panel`, `FactList`, `DataTable`, `Callout`, `SourceLine` | `components/data/*` | Bauhaus parts that soften inside `.ws`; usable as a bridge |
| avoid | `app/org/_components/ui.tsx`, `components/ui/*`, `components/browse/*` | raw palette fails `lib/palette-ratchet.test.ts:48-58`; browse needs `.shell` |

**Money.** `money(n)` in `lib/format.ts:8-15` (`$1.2B / $3.4M / $56K`, null → a dash). Under `/org` 2 files import it; 33 local formatters. `act-one-desk.ts:191,232,243` prints K only, so the desk shows `$22039K` where the grants desk shows `$12.6M`. Keep amounts numeric on the record; format at render.

### 8.3 Auth, client, caching

| layer | checks | file |
|---|---|---|
| middleware | a session exists (`getUser()` in prod; cookie only when `NODE_ENV!=='production'` or `FAST_LOCAL_AUTH=1`; `SKIP_AUTH_LOCAL=1` dev bypass) | `middleware.ts:50-52,72-109` |
| `/org/[slug]/layout.tsx` ACT branch | nothing: no `getUser`, no `org_members` | `:35-54` |
| per-page admin gate | `getUser()` + `isAdminEmail` (4 emails, `lib/admin.ts:5-15`) | `grants/page.tsx:61-72` |
| API write guard | `requireOrgWriteAccess(orgProfileId)`: owner/admin/editor of that org, or super-admin | `app/api/org/_lib/auth.ts:25-69` |
| server-action guard | `requireWriteAccess()`: super-admin in prod; **allows everyone when `NODE_ENV!=='production'`** | `lib/services/goods-write-guard.ts:18-25` |

Client: `getServiceSupabase()` from `@/lib/supabase` (live, service role, `:177-186`). Never `@/lib/report-supabase`: an empty Proxy unless `CIVICGRAPH_LIVE_REPORTS=true` (`:27-33`). `act_obligations`, `goods_relationships` have RLS on with 0 policies, so app guards are the only guards. Write tables are empty in prod: `act_obligations` 0, `daily_action` events 0. Caching: React `cache()` on `getOrgProfileBySlug` (`org-dashboard-service.ts:520`), the ledger, the capital workspace; `unstable_cache(['act-people-directory-v2'], revalidate 300)` on the people index only; desk loaders uncached, pages `force-dynamic`. Bump the `-vN` key when the cached shape changes. `revalidateTag('act-funder-intelligence')` invalidates nothing now (`act-funder-intelligence.ts:1334-1353` is a TTL memo).

### 8.4 Recipe: a page plus a mutation on `/org/act`

1. Service `lib/services/<thing>.ts`: `getServiceSupabase()`, `.eq('org_profile_id', id)`, throw on error; ranking in a pure `buildX(rows, today)` with a colocated test (copy `act-grants-desk.test.ts:1-17`).
2. Page `app/org/[slug]/<room>/page.tsx`: `dynamic='force-dynamic'`; `isActSlug(slug) || notFound()`; `getOrgProfileBySlug(slug)`; filters as URL state rendered as `<Link>` chips (`desk/page.tsx:59-77`); admin block from `grants/page.tsx:67-72` if ACT-private. The layout adds the rail.
3. Rail: one object in `workModes` (`act-workspace-shell.tsx:83-103`).
4. Mutation, Pattern A (recommended): `app/api/org/[orgProfileId]/<room>/route.ts` copying `obligations/route.ts:1-53`: `requireOrgWriteAccess`, hand validators `text(v, limit)` / `isoDate`, insert with `org_profile_id` and `created_by: auth.userId`, one-sentence errors. **Add the path to `ROUTES` in `tests/unit/api/org/route-access-policy.test.ts:5-16`.** Client leaf copies `desk-mark-buttons.tsx`.
5. Pattern B (ACT-only, admin-only): `<room>/actions.ts` copying `goods/foundations/actions.ts:1-66` (`'use server'`, `requireWriteAccess()`, `revalidatePath`), called with `useTransition` (`track-button.tsx:20-44`).
6. New table: migration + `/db-apply` (Ben's verb), RLS on, no anon grant.
7. Gates once: `scripts/precheck.sh`. Anything under `app/org/` is VISIBLE (`scripts/classify-changes.sh:38`), so the PR waits for Ben. Dev: API routes need a real session or the button 401s.

Live examples: daily actions (`daily-actions/route.ts:75-128`, upsert on `org_profile_id,source_system,source_ref,signal_kind`); obligations (`obligations/route.ts:58-116`, terminal states, `drop_reason` required when community-owed); pipeline (`pipeline/route.ts:26-40`, POST spreads the body with no allow-list). Tests: route handlers via `vi.mock('@/app/api/org/_lib/auth')` + dynamic import + `new Request` (`tests/unit/api/opportunity-intelligence/actions-route.test.ts:1-49`); pages only via Playwright with `SKIP_AUTH_LOCAL=1, ACT_E2E_FIXTURES=1` and stubbed `page.route('**/api/org/act-fast-local/…')`. No test imports `act-one-desk`.

### 8.5 Anti-patterns per Ben's taste (each live today)

| do not | seen at |
|---|---|
| eyebrow + H1 + explainer stacks; one heading, one contract line | `funding/page.tsx:23-27`, `grants/page.tsx:109-115` |
| header chip rows that read as tabs; lenses live in the rail | `desk/page.tsx:117-124`, `grants/page.tsx:117-122` |
| 8px nav hints that truncate the label they explain | `act-workspace-shell.tsx:86-98,326` |
| DB vocabulary on screen (`foundation_program`, `AU-QLD`, `Hybrid 21.0`) | grants Source column, `funding/page.tsx:109` |
| riddles for verbs: a "decide" pill beside Done / Waiting / Tomorrow; the verbs are Pursue → GHL and Pass (CONTEXT.md:124-125) | `desk/page.tsx:203-212` |
| confident zeros ("0 OWED · 0 PEOPLE", rail "CivicGraph 0") | desk header |
| rows hiding project, funder, fit, close date, entity; per-project matches look like duplicates | `act-one-desk.ts:198-216` |
| local money formatters; type below 11px; raw palette, hex, shadows, hover lifts | 33 formatters under `/org`; `funding/page.tsx:20-31` |
| `window.prompt` for a required reason; lenses unreachable on a phone | `desk-obligation-buttons.tsx:21`; `act-workspace-shell.tsx:129,196-213` |

## 15. Money tables in sibling repos the one place could read

| table | rows (basis) | writer, alive? | read for | caveat |
|---|---|---|---|---|
| `ghl_opportunities` | 4,499 (`ghl_sync_log` full_sync 2026-09-24 02:00Z) | act-global PM2 `ghl-sync` on Ben's Mac, 6-hourly, LIVE; the Actions copy has 0 successes in 100 (GHL 401) | relationship state: `pipeline_name`, `stage_name`, `status`, `monetary_value` | stops when the laptop sleeps; `project_code` never written by the sync: 22 values on Grants + GOODS-Funding, 13 unknown to grantscope, `WATCH` on 141 of 291 Grants rows; `pile` is a fourth taxonomy |
| `grant_opportunities.ghl_opportunity_id` | 26 live-stage rows real ids; 290 UUID-shaped = mirror row ids, all resolve | act-global `sync-grants-ghl.mjs`, `seed-ghl-grants.mjs`, manual | which grants are in GHL | resolve UUIDs via `ghl_opportunities.id` first (`enrich-ghl-grants.mjs:229-231`); the `fit_score>=50` push filled GHL with 239 open + 52 lost |
| `grant_opportunities.application_status` | awarded 12,367, not_applied 10,368, 12 more values | act-global manual scripts | nothing | mixes lifecycle with grant status; decisions belong in `act_grant_recommendation_decisions` |
| `alma_funding_opportunities` | 23,705; 99.8% from grantscope promotion | grantscope nightly; JusticeHub scraper DEAD-QUIET (env unset, `tee` masks exit 1) | already the ALMA lane | owner label says JusticeHub; human writes via the JH admin API only |
| `act_grant_recommendation_decisions` | 89: passed 62, won 26 (Xero backfill), watching 1 | grantscope + one act-global one-off | won-from-Xero evidence | 0 rows carry a GHL id |
| `opportunities_unified`, `project_pipelines`, `fundraising_pipeline`, `sprint_suggestions` | 17,790 (max 2026-06-15); 63 / 14 / 573 | none, frozen by neglect | nothing | 8 command-center routes read it and show June numbers; re-point to a view, then drop |
| `saved_grants`; JusticeHub funding OS tables | 2,916 (GHL id null on all); 2 / 2 / 34 / 3 / 5 rows | dead tracker path; JH admin on request | nothing | other-tenant product on `organizations`; leave alone |
| `funding_ghl_handoffs`, `act_ask_warmers` | 0 / 0 | grantscope pursue route, unused | the intended mint path | build Pursue here, not on the act-global push |
| Notion Grant Pipeline Tracker `2784ae13…` | not counted | two retired syncs (`[CG:]`, `[gs:]`), neither runs; daily act-global job fails on a legacy key behind `continue-on-error` | nothing | two Stage vocabularies in one DB; declare dead or give it one writer |

Sizing: `SELECT pipeline_name, coalesce(project_code,'<null>'), count(*) FROM ghl_opportunities WHERE pipeline_name IN ('Grants','GOODS - Funding') GROUP BY 1,2`.

**Unverified:** prod values of `FAST_LOCAL_AUTH` / `SKIP_AUTH_LOCAL`; `packages/notion-workers` not read; the 2026-09-20 hand run of `sync-grants-ghl.mjs` inferred from `updated_at`; `pencil-new.pen` (stated `ql-*` source, `globals.css:8`) not in the repo; whether "0 owed / 0 people" are empty mirrors or broken reads.
