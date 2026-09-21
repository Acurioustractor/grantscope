---
date: 2026-09-21T20:45:00Z
session_name: jev-system-alignment
branch: fix/knowledge-embedding-dims
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-21T20:45:00Z
**Goal:** Finish the half of Ben's original ask the abstention sessions never reached (graph/recall), then audit the whole workspace for where JEV would help. **Both done. Three repos touched, one merge, three PRs open.**
**Branch:** grantscope `fix/knowledge-embedding-dims` · JusticeHub `fix/acquittal-report-grounding` (worktree) · empathy-ledger `fix/cultural-sensitivity-fail-open` (worktree)
**Test:** `bash scripts/precheck.sh` (grantscope) · `npx jest src/__tests__/lib/acquittal-grounding.test.ts` (JusticeHub) · `npx vitest run src/lib/ai` (empathy-ledger)

### Now
[->] Three PRs open across three repos, all green, all waiting on Ben's eyes. Nothing in flight.

### This Session
- [x] **grantscope: org knowledge search was dead from the day it shipped. FIXED, PR #467.** `knowledge_chunks.embedding` is `vector(384)` on all 19,413 rows; `/api/chat` sent the 1536 default; pgvector raised `different vector dimensions 384 and 1536` on every request and the error was destructured away. Writer is act-global's `embed-communications.mjs` using the SAME model (`text-embedding-3-small`) at `dimensions: 384`, so it is the same Matryoshka space and **no re-embedding was needed** — only the query width was wrong. Verified live: 1536 errors, 384 returns 5 chunks at 0.530.
- [x] **grantscope: the provenance layer is stillborn.** `knowledge_sources` has 12 rows, **0 with a `source_url`, 0 with `verified_at`**; `current_knowledge` has 1 row; nothing in grantscope writes either. `mv_search_index` has no provenance column (`href` is an internal route). So it is not that citations are unverified — **there are effectively none**.
- [x] **Workspace JEV audit, 10 active repos, 3 parallel read-only agents. MERGED `bb4368e1`** → `thoughts/shared/findings/jev-workspace-audit-2026-09-21.md`.
- [x] **JusticeHub: grant acquittal had no grounding check. FIXED, PR #485.** Generated a funder-facing acquittal for a grassroots Indigenous org — sessions, participants, dollars — and returned the model's text raw. New `acquittal-grounding.ts` compares every number in the prose against the figures we handed over; flags computed percentages on purpose; checks `stop_reason`; renders the warning above the draft. 13 tests.
- [x] **empathy-ledger: two cultural-safety fail-opens. FIXED, PR #662.** (a) A missing analysis row defaulted to `'low'`, so an unassessed transcript could publish itself (readiness `approved` writes `story_drafts.status`). (b) `computeReadinessScore` tested only for `'high'`, so **SACRED fell through and scored higher than HIGH**. Plus five defaults across two vocabularies, incl. the persistence layer writing `'standard'` (kinship/tags enum, not this one) which the cultural flag never matches. All five now route through `cultural-sensitivity-level.ts`.

### Next
- [ ] **Merge the three PRs.** grantscope #467 (VISIBLE, needs Ben's preview), JusticeHub #485, empathy-ledger #662. All green.
- [ ] **Clean up two worktrees** once merged: `~/Code/JusticeHub-acquittal`, `~/Code/el-failopen`. Tier 3.
- [ ] **Grade `data/jev-pilot/adjudication-sheet-choice.csv`** — STILL the blocker. Every threshold in the audit is a made-up number until this is graded.
- [ ] **Pilot JH-2**, JusticeHub's faithfulness judge: already a 3-option typed verdict, already behind `callBackgroundLLM()`, can only clamp confidence DOWN, deterministic cache key for replay. JH-6 (data-sufficiency scorer) is the easier demo — its 0-1 scale and both cut points already exist.
- [ ] **EL-1**, the 856 unexamined articles, as a queue sorter that NEVER writes `no_human_subject_confirmed_by`.
- [ ] **PR #463 (sidebar labels) is now 6+ days old.** Still unlooked-at.
- [ ] Carried from last session: `parse-foundation-grants.mjs:79-95` mental-health→child-protection mis-tag; the `closes_at >= today OR deadline >= today` leak; orphan `foundation_programs` rows; "Epworth Research Grants" duplicate.
- [ ] `requires_elder_review ?? false` in empathy-ledger has the same fabrication shape. Left alone deliberately — flipping it would hold every fallback-analysed transcript. Policy call.

### Decisions
- **The thesis held a third time, across three repos.** Every bug this session was the system having an "I don't know" available and discarding it at the boundary: a pgvector error destructured into silence, model prose accepted as fact because nothing compared it to the rows, a missing analysis row read as `'low'`. **Not one was a model being wrong.**
- **Match the dimension AND the model.** Same width is not enough — two different embedding models at the same width give plausible nonsense instead of an error, which is worse. Always find the writer first. grantscope has two deliberate families: **384** (knowledge_chunks, project_knowledge, memory_episodes, archival_memory, voice_notes, wiki_search_index) and **1536** (grants, foundations, gs_entities, alma_*, org_profiles, wiki_pages).
- **A model is never the check on a model's numbers.** The acquittal check is arithmetic, in code. It flags an arithmetically-correct percentage on purpose: nothing in the data states it, and a funder cannot tell a measured figure from a computed one.
- **Verify the guard against the OLD code.** 4 of 7 empathy-ledger tests fail pre-fix and pass after; the other 3 are controls proving the gate was not simply made to refuse everything. A guard that would also pass on the broken code is worthless.
- **Bind tests to the real function, not a copy of it.** First version of the persistence test re-implemented the rule and would have kept passing while the service drifted. Extracted the rule into a module instead.
- **`--no-verify` is not a fix.** empathy-ledger's pre-push hook wanted Supabase env; symlinked the gitignored `.env.local` rather than skipping a gate the repo means to run.
- **Worktrees when the tree is dirty.** JusticeHub had 164 uncommitted files on an unrelated branch, empathy-ledger 12 on `main`. Neither was touched.
- **Split SAFE from VISIBLE before pushing.** Batching the docs commit onto the code branch would have parked a docs-only change behind a preview for no reason.

### Open Questions
- UNCONFIRMED: **is JEV's confidence calibrated on our data?** Unanswerable until the adjudication sheet is graded. Gates everything.
- UNCONFIRMED: **does `/api/chat` scope=knowledge now work END TO END?** The query layer is proven against the live DB; the request path is NOT — it needs an authenticated user with an org, which cannot be produced locally. Ben is the first to see it work. If it still blanks, the fault is upstream in `getEffectiveOrgId` or the scope plumbing.
- UNKNOWN: cost, call volume and latency for every incumbent LLM call in every repo. **No metering table exists anywhere.** The whole audit is code-reads, not traffic measurements.
- UNVERIFIED: every §2-§5 claim in the audit doc is an agent code-read. Re-read the file before acting on any of it.
- NOT INSPECTED: ~8.2GB of act-global (`archive/`, `ralph/`, `apps/`, `training-data/`). A `build-training-dataset` + `deploy-fine-tuned-model` + `monitor-training` trio there may overlap or compete with a JEV decision.
- UNCONFIRMED: empathy-ledger's `transcript_analysis_results` schema was read from MIGRATIONS, not queried — that repo uses its own Supabase project, not `tednluwflfhxyucgwigh`. The column is `TEXT DEFAULT NULL` with no CHECK per `20260202000001`.

### Workflow State
pattern: audit-then-repair
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "finish the graph/recall half, then find where JEV helps across the workspace"
- resource_allocation: balanced
- scope: graph/recall DONE · workspace audit DONE and merged · 3 repair PRs open

#### Unknowns
- jev_calibration_on_our_data: UNKNOWN (adjudication sheet still ungraded)
- chat_knowledge_end_to_end: UNKNOWN (needs an authenticated org user)
- llm_cost_and_volume_anywhere: UNKNOWN (no metering exists)

#### Last Failure
(none — grantscope precheck green 875 tests; JusticeHub 20 tests; empathy-ledger 136 tests; tsc clean on every touched file in all three)

---

## Context

### Where everything lives
- **Audit + reasoning:** `thoughts/shared/findings/jev-evaluation-2026-09-21.md` (corrected twice by the pilot; confidence-tagged `[V]`/`[D]`/`[?]`)
- **Pilot:** `scripts/jev-pilot/` — `1-fetch-pages` (corpus; the cache stores verdicts ONLY, no url/page text), `2-ask-jev` (both primitives, `--primitive=choice`), `3-compare` (blind adjudication sheet), `4-missed-money` (the sweep). README carries the measurements.
- **Production rubric scorer:** `scripts/score-project-rubric.mjs` → writes `project_relevance.<p>.rubric` + `rubric_meta`. No migration; it uses the existing jsonb.
- **Gate tests:** `scripts/lib/project-relevance.test.mjs` (33), `scripts/lib/foundation-program-gate.test.mjs` (9).

### What JEV is (docs.typesafe.ai, read 2026-09-21)
`POST https://api.typesafe.ai/v1/systemone`, Bearer auth, one `state` + named `questions`. **Noul** → probability, *no confidence field*. **Choice** → label + per-option probabilities + confidence. **Score** → 2–10 rubric levels + confidence. `jev-1.13.0`, 64k context (32k state+question), **$0.042 per million input tokens, output free**, 1,200 rpm. `JEV_API_KEY` is in `.env`.

Hard limits, quoted: "not a calculator", "does not count reliably", "reads dates as text, not as ordered quantities", cannot judge whether two values are near each other, "context rot" from unrelated detail, and `P(noul)` vs `1 - P(not noul)` are not comparable.

### Traps hit this session, so they are not re-hit
1. `applyProjectTags` **replaces the whole per-project object** — a stored `rubric` must be carried across or a keyword rescore silently wipes it.
2. Regression-testing on the 383 OPEN grants missed collateral across all 26,840. `'exhibitions'` in tier1 tagged craft fairs; `'touring'` tagged 160+ orchestra tours. **Measure on the full corpus.**
3. The overseas geography gate must apply to NATIONAL projects too — Contained is national, so the per-state check never ran and a `geography='NZ'` grant got tagged.
4. `person_name_normalised` is **UPPERCASE**. A lowercase join reported 0% board→graph linkage; the truth is 87%.
5. Naive name joins produce "Mark Smith, 714 boards". Cap board_count (`person-cluster.mjs` already does).
6. `logStart(supabase, agentId, agentName)` takes supabase FIRST and returns a ROW `{id}`, not a bare id.
7. `nohup ... &` inside a backgrounded Bash tool call orphans the process. Let the tool own it.
8. Importing a script whose `main()` is unguarded executes it. Both foundation scripts are now guarded.
9. The auto-mode classifier blocks `psql` writes as [Modify Shared Resources]. Commit the SQL with the apply command in the header; Ben runs it with `! cd ... && set -a && source .env && set +a && PGPASSWORD=... psql ...`.

### Traps added 2026-09-21 (session 2)
10. **A failing `HEAD` is not a dead URL.** grants.gov.au answers HEAD with 404 and GET with 200. Always retry with GET before concluding anything, and adjudicate any non-2xx in a real browser.
11. **`grant_opportunities_url_idx` is UNIQUE on `url`.** That is why foundation programmes carried a `#slug`. Any URL change must keep rows distinct — `assignProgramUrls` handles it, including two identically named programmes on one page.
12. **`grant_opportunities.amount_*` are INTEGER; `foundation_programs.amount_*` are NUMERIC.** A fractional value kills the whole row.
13. **Gemini 2.5 Flash spends `max_tokens` on reasoning before writing.** A tight cap returns unclosed JSON that reads as a parser bug. Check `finish_reason` before blaming the regex.
14. **The sync takes >10 minutes.** Run it backgrounded; `pgrep -f sync-foundation-programs.mjs` in an until-loop is the way to wait. stderr does not always reach the task output file — redirect to a file explicitly if you need the errors.
15. **`scripts/gsql.mjs` is SELECT-only.** Data deletions go in `scripts/sql/<date>-<name>.sql` applied with `psql -f`.

### The next session's actual question
Ben: *"come back for a big one that relates to JEV scanning all we have in the whole system, to align this better so fuck-ups like that don't happen, and we build a better graph and recall and memory."*

Read the Decisions block first, especially the diagnosis. Candidate shape, not yet agreed:
- **Alignment sweep:** JEV over existing rows to flag internal contradictions (a row claiming a deadline no source supports; an entity classified two ways; a "verified" tier resting on a guess).
- **Abstention retrofit:** the ~12 sites that ask a chat model for strict JSON and regex it back out (`auto-classify-llm`, `classify-acnc-social-enterprises`, the whole `enrich-*` family — none of which persist a confidence at all). Each is a Choice with an explicit unknown option.
- **Graph + recall:** retrieval provenance is the weak spot and JEV cannot fix it — `mv_search_index` carries **no external source URL**, `/api/chat` passages are truncated not verbatim, citations are model-written and never verified, `knowledge_chunks.file_path`/`.provenance` are never written, and `search_org_knowledge` is declared `vector(1536)` while the column is **384**. Fix ingest before filtering better.
- **Memory:** the durable lesson is that "unknown" must be representable end to end — in the extraction, in the column, and in the UI. Today it wasn't, at three separate layers.
