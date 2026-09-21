---
date: 2026-09-22T02:30:00Z
session_name: jev-system-alignment
branch: main
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-22T02:30:00Z
**Goal:** Point a typed classifier at everything the database holds, then use it to find data that lies. **Done, merged, and guarded in CI.** Nothing in flight.
**Branch:** `main` — everything landed across grantscope, JusticeHub and empathy-ledger
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/completion-receipts.mjs` · `scripts/check-data-contradictions.mjs` · `scripts/check-migration-parity.mjs`

### Now
[->] Nothing in flight. Only open PR is #463 (sidebar labels), 7+ days old and not from this work.

### This Session
- [x] **Org knowledge search was dead since it shipped** (#467). `knowledge_chunks.embedding` is vector(384), `/api/chat` sent 1536, pgvector errored every request and the error was destructured away. Same model both sides at `dimensions:384`, so **no re-embedding needed**.
- [x] **JEV workspace audit, 10 repos** (`bb4368e1`). Every candidate is one shape: a chat model asked for JSON, regex-sliced back out, only an enum and a number used.
- [x] **JusticeHub #485:** grant acquittal for a grassroots Indigenous org returned the model's prose RAW. Grounding check added; prompt demanded 6 sections, the data supports 4. MERGED.
- [x] **empathy-ledger #662:** two cultural-safety fail-opens. A missing analysis defaulted to `'low'` so an unassessed transcript could publish itself, and `'sacred'` fell through the gate scoring HIGHER than `'high'`. MERGED.
- [x] **Whole-database catalogue + JSONB census** (`494ed875`). 1,135 prose columns, ~392M tokens, ~$16 to read all free text once. 261 tables hold prose with NO typed column to fill. 220 jsonb keys are enums in hiding (a migration, not a model).
- [x] **Four migrations applied**, all parity-green: jsonb expression indexes, the predicate fix, the `philanthropic` fold, the 64-tag strip.
- [x] **CALIBRATION ANSWERED.** Against 291,264 agency-assigned labels: **95% correct at >= 0.90**, carrying 86% of answers. Below 0.90 nothing is conclusive (n of 7, 5, 5).
- [x] **ALMA: 64 wrong youth-justice tags stripped on TWO signals** (`cee49e78`). 248 was wrong and my own guard caused it — `IS NOT TRUE` folded 154 never-assessed NULLs in with false. Real figure 94, now 30.
- [x] **Four guards now run in CI**: migration parity, private exposure, data contradictions, completion receipts (`--strict`, all three proving, including the index claim that shipped broken).
- [x] **`gen-types.sh` works** — blocker was Docker not running. Check loop **batched** (several judgments per call, dependency test as the rule).
- [x] **Agent-design response written** with the session's failures as the evidence base (`ee1018c0`, `0cf891b1`).
- [x] **Cleanup:** both worktrees removed, both local branches and the stray remote branch deleted, verified by file presence on main (squash-merge makes ancestry checks lie).

### Next
- [ ] **30 contradicting ALMA rows** the classifier could not confidently judge, plus **154 tagged-but-never-assessed** — a backlog, NOT a defect. Do not set the flag false on rows nobody has looked at.
- [ ] **131 alma rows with regex-detectable scraper artefacts** (URL in the name, markdown, "Print this page"). Free and deterministic.
- [ ] `grantconnect_awards.category` is a PROGRAMME label, not a topic. Find what reads it as a subject classifier.
- [ ] **PR #463** (sidebar labels) is 7+ days old.
- [ ] Sweep merged branches still on grantscope's remote.
- [ ] Carried: `parse-foundation-grants.mjs:79-95` mental-health→child-protection mis-tag; the `closes_at >= today OR deadline >= today` leak; orphan `foundation_programs`; "Epworth Research Grants" duplicate.
- [ ] empathy-ledger `requires_elder_review ?? false` has the same fabrication shape. Left deliberately; policy call.

### Decisions
- **The thesis held across three repos.** Every bug was a system with an "I don't know" available, discarded at the boundary. Not one was a model being wrong.
- **ELEVEN confident-wrong results from me in one session, each now a guard.** A 1000-row PostgREST cap reading as "43 tables"; join-derived columns offered as model work; a 60-option cap dropping the biggest field; a distinct threshold tested against a smaller sample; first-page sampling on a phase-written table; **a green EXPLAIN on an index the planner never used, which REACHED PRODUCTION**; "no separator exists" when `serves_youth_justice` was right there; `IS NOT TRUE` inside the guard built to catch that; reading `head`'s exit code instead of the script's; "does not resolve" for a host that is IPv6-only; an interpretation printed in the check loop that its own data contradicted.
- **Green checks caught ZERO of them.** Every one was caught by reading output and noticing it disagreed with something known. That is the gap.
- **Verify the guard against the BROKEN state.** A test that would also pass on the bug is decoration.
- **Check the code path, not the object.** The index EXPLAIN restated the implementation.
- **A proof may not name what the change created** — enforced in `completion-receipts.mjs`, which refuses before running.
- **"Not checked" is its own answer**, never a quiet pass. Three outcomes: proven / disproven / not checked.
- **Give it one decision with a small answer space, then let code enforce the branch** (Ben). Necessary, not sufficient: the evidence must be able to answer it (coverage, not accuracy), and you must be asking the right question (validity before classification).
- **Cardinality from a sample is a LOWER BOUND.** `original_role` read as 12; it is 999.
- **A null is not a gap.** `gs_entities.sector`: 428,449 nulls, but 240,584 are people. Real gap 185,504 organisations.
- **Enums in hiding are a migration, not a model.**
- **Report patterns, not rows.** Baselines, not zero.
- **I made 13 PRs when four would have done.** CLAUDE.md says batch by surface; I split by idea and charged Ben a round-trip each time.

### Open Questions
- UNCONFIRMED: does `/api/chat` scope=knowledge work END TO END? Query layer proven live; the request path needs an authenticated org user that cannot be made locally. **Ben is the first to see it.**
- UNKNOWN: **the ingest that wrote the bad youth-justice tags was never found.** Provenance `template_generated` (85) and `web_scraped` (55), Jan 2026. No writer in this repo. The guard is keyed on the symptom for that reason.
- UNKNOWN: calibration below 0.90. Bands of n=7, 5, 5 cannot support a threshold.
- UNKNOWN: LLM cost, volume and latency in every repo. **No metering exists anywhere.**
- UNVERIFIED: the workspace audit's §2–§5 are agent code-reads, not measurements. Re-read before acting.
- NOTE: `DATABASE_URL`'s host is IPv6-only (not dead), and it is a **different credential** from `DATABASE_PASSWORD`, which is now also a GitHub repo secret.

### Workflow State
pattern: catalogue-measure-repair
phase: 6
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "point a typed classifier at the whole database; catalogue, calibrate, then find data that lies"
- resource_allocation: balanced
- scope: all of it landed and guarded in CI

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
