---
date: 2026-09-21T02:45:37Z
session_name: jev-system-alignment
branch: docs/jev-evaluation
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-21T02:45:37Z
**Goal:** Use JEV (typed, calibrated decisions) as a system-wide alignment layer — scan what CivicGraph already holds, stop the class of silent wrong answers found on 2026-09-21, and build better graph + recall + memory off the back of it.
**Branch:** docs/jev-evaluation (8 commits, UNPUSHED)
**Test:** `bash scripts/precheck.sh` · `node --test scripts/lib/project-relevance.test.mjs scripts/lib/foundation-program-gate.test.mjs`

### Now
[->] Nothing in flight. Next session starts fresh on the system-wide JEV scan (see Next).

### This Session
- [x] Audited every scoring / classifying / matching / retrieval decision in the repo for JEV fit. Doc: `thoughts/shared/findings/jev-evaluation-2026-09-21.md`
- [x] Built the JEV pilot, `scripts/jev-pilot/` (4 stages + README). 739 calls, 0 failures, p50 ~340ms, total spend under $0.10.
- [x] **Proved Choice > Noul** where "not stated" is a real answer: 0%→100%, 44→88, 20→88, 12→96, 36→92 agreement, same model and input.
- [x] Missed-money sweep: keyword scorers showed ACT **19 of 383** open grants. Found 37 rejected-but-plausible, 28 project-specific.
- [x] Fixed the keyword scorers (`3ac43c83`, narrowed in `4c3d60ef`): +`youth crime`, `bail and remand`, `remand support`, `arts touring`. 5 newly tagged over all 26,840 rows, 0 regressions.
- [x] Wired the rubric in as a **second tagging signal** (`885bc8f7`): `project_relevance.<project>.rubric` + `applyProjectTags` ORs keyword|rubric, records `tagged_by`. **ACT desk 19 → 31 open tagged.**
- [x] **APPLIED TO DB:** `score-project-relevance --rescore-all` (5 tags) and `score-project-rubric --apply` (9 tags).
- [x] **APPLIED TO DB (Ben ran psql):** `scripts/sql/2026-09-21-null-phantom-foundation-deadlines.sql` — nulled 22 invented deadlines. Verified 0 returned.
- [x] Fixed the root cause (`3346ebc8`): discovery now requires `deadline_evidence` (a quote from the page), asks `round_status` and `applicant_type`; sync stops treating an unevidenced deadline as proof of grant-hood. 9 tests.
- [x] Guarded `main()` in both foundation scripts — importing one for a test ran a LIVE 4,609-programme sync.
- [x] `/make-the-ask` on Annamila: **correctly refused to draft.** Round closed until further notice; requires majority Aboriginal/TSI-led applicant.

### Next
- [ ] **THE BIG ONE (Ben's ask):** point JEV at everything the system holds, to align it and prevent the 2026-09-21 class of failure. Scope it before building — see Decisions.
- [ ] **Upgrade foundation extraction before any re-scan.** `eligibility` 11%, `application_process` 11%, `notable_grants` 7%, no contact column, no assessment-cadence field. A re-scan that only fixes dates is not worth its cost — Ben's words: "just dates is dumb".
- [ ] Grade `data/jev-pilot/adjudication-sheet-choice.csv` — 220 disagreements, **only 4 are direct contradictions**; start with those. This is the only thing that answers whether JEV's confidence is calibrated on our data.
- [ ] Fix the `closes_at >= today OR deadline >= today` filter — leaks closed grants onto the desk (3 seen, months past).
- [ ] `parse-foundation-grants.mjs:79-95`: `/mental.?health/ → 'child-protection'` is a plain bug on the published youth-justice report.
- [ ] `compute-se-verification-tiers.mjs:63`: `acnc-classified` (an LLM guess, no confidence floor) counted as the **`verified`** tier in the buyer-facing registry.
- [ ] Orphan `foundation_programs` rows — upsert keys on `(foundation_id, name)`, so naming drift leaves stale rows (Annamila: 5 rows for 3 programmes). 209 old vs 41 new on the same 21 foundations.
- [ ] Push `docs/jev-evaluation` and open the PR (all SAFE paths, would auto-merge on green).
- [ ] `grantscope-scraping` clone still holds 8 unmerged files (community-directory ingest). Do not delete it.

### Decisions
- **Choice, never Noul, wherever "not stated"/"unknown" is a real answer.** The primitive mattered far more than the model. Carry this to every other JEV candidate.
- **`RUBRIC_FIT_AT = 2.5`, measured not guessed.** 2.0 → 46 tags (admitted a NZ grant + a closed programme); 2.5 → 21 tags, 6 of 7 hand-verified wins kept. Re-run the measurement before nudging it.
- **Geography, deadlines, amounts and entity eligibility stay in CODE.** JEV "is not a calculator", "does not count reliably", "reads dates as text, not as ordered quantities".
- **Rubric scoring is incremental by default, and that is load-bearing.** JEV wobbles at the threshold — three identical dry runs over 383 rows gave 8, 9 and 10 tags. Score once, never churn the desk.
- **A grant rated a fit for 3+ unrelated projects is a generic programme**, tagged for none.
- **The real diagnosis of the whole day:** every significant bug was *a model allowed to answer when it should have abstained* — the eligibility enricher guessing flags its own prompt said to leave null; discovery inventing deadlines when offered null; the keyword scorers unable to express doubt at all. The fix is never a better model; it is making "I don't know" a first-class answer the system can act on. **This is the thesis for the next session.**
- Funder-level knowledge is already strong (boards on 10,221, 87% of seats resolve into the person graph, 97% graph-linked). Application-level knowledge is 11%. Build the second, do not re-scan for the first.

### Open Questions
- UNCONFIRMED: is JEV's confidence actually calibrated on our data? Unanswerable until the adjudication sheet is graded. Everything gated on confidence depends on it.
- UNCONFIRMED: Butterfly's Indigenous-led board — installed? Decides whether Annamila (and funders like it) are reachable at all. Ben-only.
- UNCONFIRMED: cost of a full foundation re-scan. Gemini grounded search + multi-page scrape per foundation; ~28s each, 5,940 with websites ≈ 46 hours. **Unknown spend — not cents like JEV.**
- UNCONFIRMED: how many `grant_opportunities` rows are individual-only (scholarships/fellowships)? The 21-foundation sample said **61% individual, only 34% organisation-fundable**. If that holds, most of the grants table is not money ACT can apply for.

### Workflow State
pattern: audit-then-repair
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Use JEV to scan everything in the system, align it, prevent silent wrong answers, build better graph + recall + memory"
- resource_allocation: balanced

#### Unknowns
- jev_calibration_on_our_data: UNKNOWN (adjudication sheet ungraded)
- full_rescan_cost: UNKNOWN
- butterfly_board_status: UNKNOWN (Ben-only)

#### Last Failure
(none — precheck green at session end: tsc clean, 875 vitest, 42 node tests)

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

### The next session's actual question
Ben: *"come back for a big one that relates to JEV scanning all we have in the whole system, to align this better so fuck-ups like that don't happen, and we build a better graph and recall and memory."*

Read the Decisions block first, especially the diagnosis. Candidate shape, not yet agreed:
- **Alignment sweep:** JEV over existing rows to flag internal contradictions (a row claiming a deadline no source supports; an entity classified two ways; a "verified" tier resting on a guess).
- **Abstention retrofit:** the ~12 sites that ask a chat model for strict JSON and regex it back out (`auto-classify-llm`, `classify-acnc-social-enterprises`, the whole `enrich-*` family — none of which persist a confidence at all). Each is a Choice with an explicit unknown option.
- **Graph + recall:** retrieval provenance is the weak spot and JEV cannot fix it — `mv_search_index` carries **no external source URL**, `/api/chat` passages are truncated not verbatim, citations are model-written and never verified, `knowledge_chunks.file_path`/`.provenance` are never written, and `search_org_knowledge` is declared `vector(1536)` while the column is **384**. Fix ingest before filtering better.
- **Memory:** the durable lesson is that "unknown" must be representable end to end — in the extraction, in the column, and in the UI. Today it wasn't, at three separate layers.
