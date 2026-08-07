---
date: 2026-08-07T22:53:28Z
session_name: act-money-surface
branch: fix/act-grant-feed-status-filter
status: active
---

# Work Stream: act-money-surface

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T00:05:00Z
**Goal:** Make grants and philanthropy findable and actionable across ALL ACT projects, not just Goods. Done when every active project has a working funding page ranked on evidence rather than invented numbers.
**Branch:** feat/funding-rail-slot (PR #172 merged to main as 17acf23)
**Test:** `cd apps/web && npx tsc --noEmit && npx vitest run`

### Now
[->] PR #173 (funding rail slot) is green and awaiting Ben's merge decision (Tier 3 — needs explicit verb). PR #172 is MERGED.

### This Session
- [x] Audit written: `docs/strategy/act-money-surface-audit-2026-08-07.md` (audits Phase 1 plan, 3 Aug)
- [x] Feed unstarved 18 → ~1,535 opportunities (387 apply_now + 1,572 rolling)
- [x] Root cause 1: `application_status='open'` filter — `not_applied` holds 4,087 of 4,463 future-deadline grants
- [x] Root cause 2: alignment gate passed 94% (substring match on flattened keywords; 43% of pool is university research)
- [x] Root cause 3: LLM classifier dead since ~2026-05-16 on an out-of-credit key, logging `status: success` throughout
- [x] Classifier made multi-provider with fallback + backoff; 2,662-row backlog cleared in 66 min on Gemini free tier, no cost
- [x] Rolling lane added — undated verified programs are open, not timing failures
- [x] Foundations regraded on evidence (A/B/C), not placeholder giving; 534 fabricated summaries corrected
- [x] Goods hardcode removed — `getFunderScan(slug?)` portfolio-wide; One Desk shows real project
- [x] Two project registries reconciled — canonical FK, 12/12 linked, 3 missing `org_projects` rows created
- [x] Per-project "Apply now" built — all 11 projects resolve their own ranked list
- [x] Ranking tightened — dedupe, extractive blocklist parity, real strong-fit bar, geography exclusion
- [x] Opportunities tagged from their own text (theme matching read a closed 17-word taxonomy)
- [x] `project_rank` / "Best available" for projects with nothing clearing the absolute bar
- [x] `primary_funding_route` + `next_question` surfaced per project
- [x] PR #172 opened, body + title rewritten to match all 15 commits, CI green
- [x] **PR #172 MERGED** to main as 17acf23 (Ben, 2026-08-08)
- [x] All four open judgement calls answered by Ben and recorded in the audit
- [x] `/org/act/funding` given rail room 05 — "Funding · Money worth chasing"
- [x] Found + fixed two vacuous E2E rail guards (anchored/exact matchers can never match a numbered room)
- [x] PR #173 opened for the rail slot, CI green

### Next
- [ ] Ben's merge decision on PR #173 (Tier 3 — do NOT merge without an explicit verb)
- [ ] Optional: schedule the classifier now that it no longer depends on one provider
- [ ] Content problem, not pipeline: Gold.Phone, CivicGraph, Contained and ACT Core have thin theme keywords, which is why they clear zero strong fits

### Decisions
- **Grade evidence, don't gate on money.** Only 6 of 5,190 themed grantmakers have a real giving figure, so gating on verified money would empty the queue. A = recorded grants on file, B = DGR or verified giving, C = theme overlap only (never written to the pipeline).
- **Undated ≠ unknown.** A verified, URL-live row with no deadline is a rolling program, not a timing failure. Recovered 337 opportunities on day one.
- **Don't lower the strong-fit bar.** Four projects clear nothing; relabelling weak rounds as strong everywhere was the wrong fix. Two signals instead: `is_strong_fit` (absolute) and `project_rank` (relative, labelled "Best available").
- **Zero strong fits can be correct.** CivicGraph has 2 civic-tech grants in the entire corpus and its route is buyers per `buyer-wedge.md`; ACT Core is overhead. Recorded as `primary_funding_route` so nobody "fixes" it by loosening the matcher.
- **Ask rather than guess.** `next_question` surfaced above each ranking, with the ranking marked as a best guess until answered. Guessing past it is how 1,005 foundation matches ended up ranked on invented money.
- **Multi-provider by default.** A single-provider dependency is what killed the classifier for three months. Chain: groq → gemini → ollama → deepseek → anthropic.

### Open Questions
All four resolved by Ben on 2026-08-08. Recorded in `docs/strategy/act-money-surface-audit-2026-08-07.md` under "Ben's calls (2026-08-08)".
- RESOLVED: extractive funders (BHP, Fortescue, Rio Tinto, Santos) stay blocked on **both** paths, grants and philanthropy. It is a values decision about whose money ACT takes, so it does not care which door the money comes through. Do not split.
- RESOLVED: Gold.Phone / Mounty Yarns / ACT Core **stay** as `org_projects` rows.
- RESOLVED: ALMA / Elders Room / Station Precinct **fundraise through a parent**. No rows, no funding pages; their money shows on the parent's page. Absence from the registry is now a decision, not a gap to close.
- RESOLVED: `/org/act/funding` **gets a rail slot** rather than deletion. Note this reverses the 2026-08-05 cut, knowingly: the room was cut when the feed held 18 opportunities and is back now it holds ~1,535. The rest of that cut stands.

### Workflow State
pattern: diagnose-then-fix
phase: 6
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "make all opportunities and grants in the ACT part of the site easy to use, to find grants, engage philanthropy and get investment for all ACT projects"
- resource_allocation: aggressive (max effort session)

#### Unknowns
- extractive_funder_policy_for_grants: RESOLVED — blocked on both paths
- sub_project_fundraising_model: RESOLVED — sub-projects fundraise through a parent

#### Last Failure
(none — CI green: Type Check, Unit & Integration, E2E, Vercel all pass)

---

## Context

### Where the work lives
- **PR #172** — https://github.com/Acurioustractor/grantscope/pull/172 · 15 commits · 1,555 insertions / 14 files · **not merged**
- **Audit** — `docs/strategy/act-money-surface-audit-2026-08-07.md` (the reasoning; audits `phase-1-project-funding-operating-system.md` from 3 Aug)
- **SQL, with rollback notes** — `scripts/sql/2026-08-07-rolling-funding-lane.sql`, `2026-08-07-tighten-grant-ranking.sql`, `2026-08-08-geography-and-program-dedupe.sql`, `2026-08-08-tag-opportunities-from-text.sql`, `2026-08-08-project-rank-best-available.sql`, `2026-08-08-funding-route-and-open-question.sql`
- **Memory** — `memory/project_act_money_surface.md` carries the durable gotchas

### CRITICAL: database changes are already live
All DB work was applied via Supabase MCP and **does not depend on the merge**. Merging only lands the code that maintains it. Applied: both view rewrites, `evidence_grade` column + backfill on 1,063 rows, 534 corrected fit summaries, registry FK, 3 new `org_projects` rows, 596-row grant promotion, 2,662-row classifier backlog, 2,907 + 175 duplicate rows parked, `primary_funding_route` column.

### Traps that cost real time this session
1. **`act_grant_recommendations` is a MATERIALIZED view.** Dedupe, blocklist and tag changes stay inert until `REFRESH MATERIALIZED VIEW CONCURRENTLY act_grant_recommendations`. I almost reported a fix as working when it wasn't.
2. **Theme matching reads only `focus_areas || keywords`** — a closed 17-word taxonomy (community, health, arts, indigenous, education, research, enterprise, environment, youth, regenerative, sport, disability, human_rights, justice, disaster_relief, technology, regional). Anything outside cannot match. If a project matches nothing, check this *before* rewriting its keywords.
3. **`nightly-grant-pipeline.mjs` has no `--only=` flag** (it's `--skip=` / `--phase=`). Passing it silently ran the entire nightly pipeline including ingest.
4. **PostgREST silently caps a response at 1,000 rows.** `.limit(2300)` returns 1,000 and a half-finished run looks complete.
5. **`grant_opportunities.application_status` is ACT's own application state, not round liveness.** `not_applied` is the discovery pool.
6. **The ACT feed reads `alma_funding_opportunities`, not `grant_opportunities`.** Pipeline: promote → `auto-classify-llm.mjs` → `verify-alma-opportunities.mjs` → `act_funding_opportunity_current_status` → `act_grant_recommendations_current`.

### Classifier throughput, measured
llama-3.1-8b (groq) 0.13s/row until 429 · gemini-2.5-flash 1.7s/row steady, no throttle · llama-3.3-70b (groq) 2.5s/row throttled · gpt-oss:20b (local ollama) 6.0s/row. Run unpinned to get the fallback chain; `--provider=` pins and disables it.

### Corrections made during the session (don't re-litigate)
- `closes_at` was not the bug — it's better populated than `deadline`, only 2 rows affected.
- `next_question` lives on `act_grant_recommendation_projects`, **not** `project_funding_profiles` (which has no such column).
- My first tag stoplist excluded `tour`, `touring`, `events`, `experience` as generic — true for most projects, false for Contained, whose identity they are. Restored.
