# Phase 7 — The ACT Opportunity Engine

**Proposed 2026-07-06. Status: IN BUILD — reality-corrected 2026-07-06.**

---

## ⚠️ REALITY CORRECTION (2026-07-06) — the plan below was written against a greenfield that does not exist

A pre-build DB + code audit found **Bricks 1–3 already exist and are wired to live UI** (built by a prior session / the seed scripts). Do NOT rebuild them:

| Plan brick | Actual state |
|---|---|
| **1. Project profiles** | ✅ `org_projects` (11 ACT projects, `code` = ACT-GD/JH/HV/FM/PI/EL…) + `act_grant_recommendation_projects` (12 in-scope, `theme_keywords`, `home_states`, `entity_preference`, `dgr_required`, `qbe_ready`). Richer than proposed. |
| **2. Unified feed** | ✅ Grants: `act_grant_recommendations` **MV** (grant→project fit, nightly-refreshed by agent `nightly-grant-pipeline`), rendered in `/org/[slug]/pipeline` kanban + `/ops/grant-recommendations`. Foundations: `org_project_foundations` (per-project fit) rendered on `/org/[slug]` + per-project page, full CRUD API. |
| **3. Engagement pipeline** | ✅ `org_project_foundations` engagement cols (stage/engagement_status/next_touch, 16 live rows) + `act_grant_recommendation_decisions` (90 grant decisions). |
| **4. Daily agent loop** | ◐ EXISTS for grants (nightly MV refresh). **MISSING for foundations.** |
| **5. Outcome feedback** | ✗ decisions logged, not fed back to scorer/funders.json. |

**Orphaned (decide keep/drop later):** `opportunities_unified` (17.8K rows, retired platform-wide concept, no app code writes it), `funding_relationship_engagements` (0 consumers).

### The real gap → what's being built
The sharp asymmetry: **grants self-populate per project; foundations were hand-fed.** Ben's decision (2026-07-06): build the **foundation matching agent** first — the philanthropy analogue of the nightly grant pipeline.

**SHIPPED this session:**
- `scripts/match-foundations-for-projects.mjs` — scores every foundation against each active ACT project (theme-overlap 55 + target-recipient 15 + geography 20 + giving-scale 10; faith-purpose funders excluded; must share ≥1 theme), lands top fits into `org_project_foundations` as `stage='saved', engagement_status='researching'` (candidates awaiting human review). **Dry-run verified: 35 matches across 6 projects, quality good** (ACT-PI→Port Curtis Coral Coast Aboriginal/WCCT trusts; ACT-FM/HV→Burnett Mary NRM/QLD Farmers' Fed/NQ Dry Tropics). Default `--dry-run` (Tier 1); `--apply` inserts via psql (Tier 2/3, explicit go).
- Registered in `scripts/lib/agent-registry.mjs` as `match-foundations-for-projects` (dry-run command; flip to `--apply` for nightly once first apply is human-approved).
- Crosswalk (project coarse-themes) lives in-script (`CROSSWALK` const) — transparent; hardening follow-up = move to an `act_grant_recommendation_projects.foundation_themes` column.

**NEXT (foundation-match agent):**
- Ben authorizes first `--apply` run (Tier 3 — write to shared prod), then eyeball in `/org` pipeline UI.
- Extractive-industry funders (BHP/Rio Tinto Foundations rank high mechanically) = **values decision** for Ben — kept as candidates, not auto-filtered.

### Item 4 — Brick 5 (won/lost feedback) + /find-grants→engine rewire — BUILT 2026-07-06 (awaiting Ben's Tier 3 apply)
Ben's scope decisions: scorer sink = **the per-project engine MV** (not the web-app org scorer); funders.json = **draft-a-diff, Ben applies** (no cross-repo write).

1. **Scorer (Brick 5) — `supabase/migrations/20260706120000_act_grant_recommendations_track_record.sql`.** Rebuilds the `act_grant_recommendations` MV with a decisions-derived `track_record_score` (−10…+15) folded into `fit_score`:
   - +15 `won_funder_boost` if ACT has a `won` decision with this funder (org-level, any project) → `won_funder=true`, `won_funder` flag.
   - −10 `passed_penalty` if ACT `passed` on this funder ≥2× for THIS project → `repeatedly_passed` flag.
   - Excludes terminally-decided opps (won/passed/pursuing) so the feed stays fresh; `watching` kept.
   - New additive cols: `track_record_score`, `won_funder`. Dependent view `v_act_pipeline_unified` dropped/recreated verbatim; indexes + grants restored.
   - **Validated in a rolled-back prod txn:** DDL runs clean, 0 decided opps leak, 12 boosts / 25 penalties, `theme_score>0` gate still governs `is_strong_fit`, dependent view resolves. **NOT YET APPLIED — Ben runs psql (Tier 3), then nightly-grant-pipeline's `REFRESH … CONCURRENTLY` keeps it live.**
2. **Rewire — `act-grant-triage.md`** (skill behind `/find-grants`, canonical in `~/Code/act-claude-plugins`, synced to active plugin dir). Now reads the `act_grant_recommendations` engine MV per project (was raw `grant_opportunities` JOIN `foundations`) — inherits verification gating, blocklist, the decision loop, and per-project `fit_score`/`is_strong_fit`. Plugins repo has one uncommitted file for Ben to commit.
3. **funders.json half — `scripts/draft-funders-json-from-wins.mjs`** (read-only, never writes the cross-repo ledger). Emits `thoughts/shared/plans/funders-json-from-wins.proposal.md`: 22 proposed updates (add project_code to `projects_funded`, advance genuine funders' pre-funded stage → `active-partner`, bump `last_communicated_at`). Commercial customers already in the ledger at `stage=needs-writeup` are correctly left un-advanced. **Ben reviews + applies by hand.** Note surfaced: the ledger was previously bulk-seeded with commercial customers (Berry Obsession, Bigmeats, etc.) — a hygiene call for Ben, out of scope here.

---

## Original proposal (superseded above — kept for context)

**Proposed 2026-07-06. Status: PROPOSAL (awaiting Ben's scope decision).**

> One pipeline, three sources, per-project: `find → engage → learn`. Make A Curious Tractor the live pilot account for an agentic system that finds AND engages philanthropy, grants, and procurement support across all ACT projects.

## The gap (why this phase)

The **FIND** half is largely built and live:
- Grant finder overhauled (trust layer, CLASSIE tags, award-history join, vector org→grant matching, scorer with proven-track-record boost). Shipped in PR #101.
- Substrate exists for the other two sources: `foundations` (10.8K, thematic_focus/geographic_focus/total_giving_annual), `grant_opportunities` (18K), `austender_contracts` (770K) + state tenders scrapable (VIC/SA), `funders.json` ledger (ACT's actual funder relationships), `act-money-brain` skills (`find-grants`, `brief-funder`, `draft-funder`, `decision`).

Three things are missing to reach the vision:
1. **Per-project grain.** Matching is org-level. ACT is 72 project codes / multiple entities (Harvest, Farm, Goods, etc.), each with distinct thematic fit, stage, and $ need. A grant/funder should route to the *right project*.
2. **Engagement pipeline.** The skills draft one-offs. Nothing persists state, tracks status, schedules follow-up, or learns from outcomes. "Find" never becomes "engage."
3. **Unified three-source feed.** Grants are a first-class flow; philanthropy (foundations) and procurement (tenders ACT could bid on, esp. Goods on Country contracting) are not yet.

## The build (connect/deepen, not widen — respects the data-widening pause)

Every brick reuses existing substrate.

### Brick 1 — Project profiles (the unlock for "across all projects")
Seed ~5–8 active ACT projects as matchable profiles at project grain, reusing the org-profile/vector infra.
- Source of truth: `act-global-infrastructure/config/project-codes.json` (72 codes) — pick the ~5–8 actively fundraising ones.
- Each profile: thematic tags (CLASSIE-compatible), stage, $ need band, geography, entity (which ACT vehicle receives — Butterfly for DGR, ACT Pty for contracting, etc. per act-core-facts).
- Table: `act_project_profiles` (or extend `org_profiles` with a project_code dimension).

### Brick 2 — Unified opportunity feed (per project)
Extend the finder to emit **grants + foundations (philanthropy)** as one ranked feed per project profile.
- Grants: reuse the live vector path.
- Philanthropy: foundation→project fit on thematic_focus ∩ project tags + geographic_focus + giving-history signal. New matcher, same shape as grant matcher.
- Procurement/tenders: **Phase 7b** (austender/state tenders as bid opportunities for Goods on Country). Deferred from the pilot slice — needs the UNSPSC→theme crosswalk that's already on the deferred list.

### Brick 3 — Engagement pipeline (the state an agent works down)
Table `opportunity_engagements`: `project_code, opportunity_ref, source (grant|foundation|tender), status (new→matched→drafted→sent→followup→won|lost|ghosted), next_action_at, draft_text, notes, updated_at`.
This is the CRM spine. Nothing here sends — it holds drafts awaiting human approval.

### Brick 4 — Daily agent loop
Scheduled agent (night shift, Tier 1–2 only): scan new opportunities across sources → match per project → draft outreach in ACT voice (reuse `draft-funder` + writing-voice.md) for top matches → land in pipeline as **"drafted, awaiting approval."**
**Human does SEND/ENGAGE** (Tier 3, day shift, explicit verb). This respects the AFK boundary in workflow.md exactly — never queue an external send into an AFK backlog.

### Brick 5 — Outcome feedback loop
won/lost/ghosted updates:
- the scorer's proven-track-record signal (already has the hook), and
- the `funders.json` ledger (ACT's real relationship state).

## Wedge alignment
This is on-wedge: it dogfoods the paid product direction ("paid evidence + tender tools for buyers") using ACT as the test account. Building ACT's engagement loop = building the engagement tools the paid product will sell. Check `docs/strategy/buyer-wedge.md` before hardening any of it into a public feature.

## Boundary guardrails (non-negotiable)
- Agent FINDS + DRAFTS (night shift, Tier 1–2). Human SENDS (day shift, Tier 3, explicit verb). No autonomous outreach, ever.
- No new data widening — connect/deepen the estate we have.
- Money/entity routing must respect act-core-facts (DGR only through Butterfly; contracting through ACT Pty t/a Goods on Country).

## Open decision for Ben (scopes the pilot slice)
1. **Lead source:** grants-only (fastest, extends what's live) · grants+philanthropy (foundations — the real unlock) · all three incl. procurement (biggest, needs the UNSPSC crosswalk first).
2. **First brick:** project profiles (Brick 1) vs the pipeline table + daily loop (Bricks 3–4). Recommend Brick 1 first — nothing routes per-project without it.

**Recommendation:** pilot slice = Bricks 1 → 2 (grants+philanthropy) → 3, with ACT's ~5 active fundraising projects. Prove `find→draft→track` end-to-end for ACT, then add procurement (7b) and the daily agent loop (Brick 4) once the manual loop is trusted.
