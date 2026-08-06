# Funder-pipeline gap audit — "what exactly is in our pipeline of potential funders?"

Wayfinder research ticket [#163](https://github.com/Acurioustractor/grantscope/issues/163)
(map #158, Engagement layer). Audited 2026-08-06 from primary sources: the page
and service code, not docs. Vocabulary per `CONTEXT.md` (Ask / Signal / Grant
Round, five stages) and `docs/specs/one-desk-widened-ux-spec.md`.

## What each surface actually shows

### 1. Funder Scan — `/org/act/goods/foundations/scan`
Code: `apps/web/src/app/org/[slug]/goods/foundations/scan/page.tsx`,
service `apps/web/src/lib/services/goods-funder-scan.ts`.

- **Records**: up to 500 rows of `org_project_foundations` joined to
  `foundations` (name, giving) for the `goods` project, ordered fit-desc
  (`goods-funder-scan.ts:63-68`).
- **Fields per row**: name, discovery `stage`, `fit_score`, `next_step`,
  giving/yr, GHL warmth derived from cached `ghl_tags`
  (`warmthFromTags`, lines 35-44 — `goods-hot`…`goods-cold`, else
  `not_in_ghl`), GHL contact link + email, sync timestamp.
- **Summary**: counts by warmth, synced count, and two mismatch views —
  **warm-but-unworked** (GHL hot/warm but discovery stage null/saved/parked,
  line 99) and **push-next queue / hotButUnpushed** (fit ≥ 85 with no GHL
  contact, line 100).
- **Source of truth**: Supabase `org_project_foundations` (+ cached GHL signal
  written by `scripts/reconcile-foundations-ghl.mjs`). Not live GHL.
- **What it does NOT show**: no stage totals in the five-stage vocabulary, no
  dollar amounts asked/target per funder (only the foundation's annual
  giving), no deadlines, no grouping into a pipeline funnel.

### 2. Foundations tab — `/org/act/goods/foundations`
Code: `apps/web/src/app/org/[slug]/goods/foundations/page.tsx`,
service `apps/web/src/lib/services/goods-foundation-targets.ts`.

- **Records**: net-new **Signals only** — foundations NOT yet in the warmth
  registry, from the CivicGraph view `v_goods_foundation_targets`
  (`goods-foundation-targets.ts:115`), ranked by priority score = theme-fit +
  warm board-bridge + DGR + giving capacity.
- **Fields**: name, DGR / ancillary-fund routing badge, matched themes, warm
  bridge (connector person + bridged org), geography, giving/yr, grant
  min–max, a **Track** button that mints the record into the warmth registry
  (page.tsx:172-180), after which it leaves this list.
- **Filters**: top-fit vs warm-bridge-only; top-10 highlighted.
- **Explicitly candidate-side**: page footer (page.tsx:187-191) says tracked
  targets leave the list — so this surface and the Scan never show the same
  record, by design.

### 3. Capital tab — `/org/act/goods/capital`
Code: `apps/web/src/app/org/[slug]/goods/capital/page.tsx`,
service `apps/web/src/lib/services/goods-capital-workspace.ts`.

- **Records**: the QBE capital plan — 5 `goods_capital_blocks`, funding
  matters/routes/allocations/tranches from Supabase tables
  (`goods-capital-workspace.ts:1130-1134`).
- **Fields**: evidence-gated money ladder — CRM targets → ask-made (requires
  `ask_made_at`, line 1211) → offered → committed (written evidence only,
  line 1214) → cash received (Xero tranches); per-block coverage bars,
  remaining min/max; ~6 CRM-target matter cards with route type, commitment
  state, QBE match assessment, target amount, application-room links.
- **Scope limit**: only the handful of hand-entered matters/routes — this is
  the deep end of the pipeline, disconnected from the ~500-row Scan and the
  Signals list. A funder in the Scan has no representation here until someone
  hand-creates a matter/route.

### 4. Grants tab — `/org/act/goods/grants`
Code: `apps/web/src/app/org/[slug]/goods/grants/page.tsx`,
service `apps/web/src/lib/services/goods-grants-triage.ts`.

- **Records**: **Grant Rounds** — live `grant_opportunities`
  (status open/ongoing/upcoming, limit 3000, shown 300), deadline-first then
  fit (`goods-grants-triage.ts:60-66,100-106`).
- **Fields**: name, provider, goods_relevance_score, deadline/days-to,
  amount min/max, geography, DGR-required, accepts-Pty-Ltd,
  `pipeline_stage`, `ghl_opportunity_id` (whether it's already an Ask).
- **Summary/filters**: live vs corpus counts, closing ≤30d, high-fit ≥70,
  by-geography; filters geo / fit≥70 / closing ≤60d; source-freshness panel
  from `agent_schedules`/`agent_runs`.

### 5. One Desk — `/org/act/desk`
Code: `apps/web/src/app/org/[slug]/desk/page.tsx`,
service `apps/web/src/lib/services/act-one-desk.ts`.

- **Records**: one ranked pool of five kinds (funder / grant / buyer / money /
  commitment) merged from the Scan, grants triage (`scope:'closing'`), buyer
  pipeline, relationship ledger (outstanding invoices) and pipeline cards
  (`act-one-desk.ts:113-121`).
- **Funder rows** (lines 156-168): only if stage is set and not
  parked/declined; not-in-GHL rows only at fit ≥ 85 (decision-due: "pursue —
  mint the Ask — or pass"). In-GHL rows show warmth + next step. **Funder rows
  carry no amount and no due date** (`dueDays: null, amount: null`, line
  164-165), so they always rank by fit in the undated group.
- **Grant rows** (172-185): in-GHL = Ask being worked; else decision-due when
  closing ≤ 30d or fit ≥ 85. Carry amountMax and days-to-deadline.
- **Header Target** (page.tsx:104-110): committed / needed / asked from the
  capital workspace summary — the only dollar-weighted pipeline read anywhere.
- Deadline-first horizon groups (Overdue / fortnight / quarter / undated),
  "Do this now" hero, detail pane with next move + GHL/workspace links.

## Gaps against "see exactly what is in our pipeline of potential funders"

1. **No single pipeline view.** The funder story is split across four surfaces
   with disjoint record sets: candidate Signals (Foundations tab), worked
   discovery rows (Scan), the desk's thresholded slice, and the hand-curated
   capital matters. Nowhere is there one screen showing every potential funder
   with its stage — the exact thing Ben asked for.
2. **No five-stage vocabulary anywhere.** CONTEXT.md defines Open door → In
   conversation → Asked → Won/Lost (+Dormant), but the Scan shows raw
   discovery `stage` strings plus a warmth chip, grants show raw
   `pipeline_stage`, and capital routes use a separate 10-state
   `GoodsApplicationState` enum. No surface renders stage totals ("N in
   conversation, M asked") in the canonical five.
3. **No dollar-weighted pipeline.** The desk Target line gives committed /
   asked totals from the ~6 capital routes only. Scan funder rows carry no ask
   amount (only the foundation's annual giving); desk funder rows render
   `amount: null`. There is no "in flight" number (open Asks × stage weight)
   that CONTEXT.md's Target section calls for, and no per-stage $ rollup.
4. **Candidates-not-yet-Asks are threshold-hidden.** The desk drops
   non-GHL funders below fit 85 and skips stage-null Scan rows
   (`act-one-desk.ts:157-159`); the Foundations tab shows only never-tracked
   Signals. A funder that was tracked but not yet pushed to GHL and sits at
   fit 70-84 is visible only by scrolling the 500-row Scan table — effectively
   invisible.
5. **Next-action coverage is partial.** Scan `next_step` is free text on
   discovery rows and null for most; only capital routes carry owner +
   next_action + due date. There is no "funders with no next action" mismatch
   view, and funder rows are perpetually undated on the desk (gap #4 in
   ranking terms: they can never be overdue).
6. **Scan ↔ Capital disconnect.** Nothing links an `org_project_foundations`
   row to a `goods_funding_matters`/`goods_funding_routes` record; promotion
   from worked funder to capital matter is manual and untracked, so the "top
   of funnel → capital plan" hand-off is invisible.
7. **GHL warmth is a cached signal, not a stage.** The Scan derives warmth
   from `ghl_tags` synced by a script that requires a rotated API key
   (scan/page.tsx:190); `not_in_ghl` conflates "never pushed" with "not yet
   synced". Staleness is shown only as a synced count, not the per-row
   `last_synced_at` age badge the data-trust rules require.
8. **Buyer and grant Asks have amounts and dates; funder Asks have neither** —
   so within the one desk pool the funder pipeline is structurally the least
   legible kind.

## Shortest path (implied by the code, not prescriptive)

A "Funder pipeline" view = the Scan's record set + the five-stage mapping
table (CONTEXT.md says the mapping lives in code — it doesn't yet exist) +
per-stage counts and $ (target amount per funder needs a home on
`org_project_foundations` or a route link) + the Foundations-tab Signals as an
explicit "not yet decided" column, feeding the desk's decision rows.
