---
date: 2026-09-22T00:15:00Z
session_name: jev-system-alignment
branch: main
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-22T00:15:00Z
**Goal:** Point a typed classifier at everything the database holds: catalogue where it could help, measure whether its confidence is real, then use it to find data that lies. **Done and merged.** Three repair PRs in other repos still await Ben.
**Branch:** grantscope `main` (PRs #466 #468 #469 #470 #471 merged) · JusticeHub + empathy-ledger worktrees still on disk
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/check-data-contradictions.mjs` · `node --env-file=.env scripts/check-migration-parity.mjs`

### Now
[->] Nothing in flight in grantscope. Three PRs in other repos waiting on Ben's eyes.

### This Session
- [x] **grantscope #467 (OPEN, waiting on Ben):** org knowledge search was dead since it shipped. `knowledge_chunks.embedding` is vector(384), `/api/chat` sent 1536, pgvector errored every request and the error was destructured away. Same model both sides (`text-embedding-3-small` at `dimensions:384`), so **no re-embedding needed**. Verified live.
- [x] **JEV workspace audit, 10 active repos, MERGED `bb4368e1`.** Every candidate has one shape: a chat model asked for JSON, regex-sliced back out, only an enum and a number used.
- [x] **JusticeHub #485 (OPEN):** grant acquittal for a grassroots Indigenous org returned the model's prose RAW. Added an arithmetic-in-code grounding check. Prompt demanded 6 sections; the data supports 4.
- [x] **empathy-ledger #662 (OPEN):** two cultural-safety fail-opens. Missing analysis defaulted to `'low'` so an unassessed transcript could publish itself; `'sacred'` fell through the gate and scored HIGHER than `'high'`. Five defaults across two vocabularies now route through one module.
- [x] **Whole-database catalogue, MERGED `494ed875`.** 1,135 prose-bearing columns, ~392M tokens, ~$16 to read every piece of free text once. 261 tables hold prose with NO typed column to fill — the larger half, which the first version missed entirely.
- [x] **JSONB census.** 215 columns, 220 keys are enums in hiding (a migration, not a model), 58 hold prose.
- [x] **Two migrations applied + a third:** jsonb expression indexes, the predicate fix, `philanthropic-grant` folded into `philanthropic` (20 rows, $1.749M, exactly reversible via `source`).
- [x] **`gen-types.sh` works.** The blocker was Docker not running, not the pooler. `DATABASE_URL` in .env is stale: `db.<ref>.supabase.co` does not resolve, direct IPv4 is gone.
- [x] **CALIBRATION ANSWERED.** Measured against 291,264 agency-assigned labels: **95% correct at >= 0.90**, which carries 86% of answers. Below 0.90 nothing is conclusive (n of 7, 5, 5).
- [x] **Check loop + contradiction guard, both in CI.** Flagged alma rows where `topics` says youth-justice and `serves_youth_justice` disagrees.
- [x] **RESOLVED, merged `cee49e78`.** The 248 was wrong and the guard caused it: `IS NOT TRUE` folded NULL in with false, and 154 of those rows were simply never assessed. Real contradiction: **94**. Adjudicated with two signals (the flag AND a classifier at >= 0.90, 70% coverage); **64 tags stripped, 94 -> 30**. 28 below threshold untouched; 1 kept ("Youth Justice System Statistics - ROGS 2025", correct tag). Guard now uses `= false` and tracks the 154 unassessed separately as a backlog. Baselines 30 / 154.

### Next
- [ ] **Merge the three open PRs:** grantscope #467 (VISIBLE, needs preview), JusticeHub #485, empathy-ledger #662. All green.
- [ ] **30 contradicting rows remain** (flag false, tag present, classifier not confident). Plus **154 tagged-but-never-assessed** — a backlog, NOT a defect: do not set the flag false on rows nobody has looked at.
- [ ] **Clean 131 alma rows with regex-detectable scraper artefacts** (URL in name, markdown, "Print this page"). Free, deterministic.
- [ ] **Clean up two worktrees** once PRs land: `~/Code/JusticeHub-acquittal`, `~/Code/el-failopen`. Tier 3.
- [ ] `grantconnect_awards.category` is a PROGRAMME label, not a topic. Find what reads it as a subject classifier.
- [ ] **PR #463 (sidebar labels) is now 7+ days old.**
- [ ] Carried: `parse-foundation-grants.mjs:79-95` mental-health→child-protection mis-tag; `closes_at >= today OR deadline >= today` leak; orphan `foundation_programs`; "Epworth Research Grants" duplicate.
- [ ] empathy-ledger `requires_elder_review ?? false` has the same fabrication shape. Left deliberately; policy call.

### Decisions
- **The thesis held across three repos.** Every bug was a system with an "I don't know" available, discarded at the boundary. Not one was a model being wrong.
- **I produced SEVEN confident-but-wrong results today and each is now a guard.** A 1000-row PostgREST cap reading as "43 tables"; a filter offering join-derived columns as model work; a 60-option cap silently dropping the biggest field; a distinct-count threshold tested against a smaller sample; first-page sampling on a phase-written table; **a green post-check on an index the planner never used, which reached production**; "no separator exists" when `serves_youth_justice` was right there. **Scripts now refuse to be read past their evidence:** UNDERPOWERED below 40% coverage, "a pattern of three is noise", exit 2 on missing credentials.
- **Verify the guard against the BROKEN state, not the passing one.** 4 of 7 empathy-ledger tests fail pre-fix; the contradiction guard exits 1 at baseline 29 and 0 at 30. A test that would also pass on the bug is decoration.
- **Check the code path, not the object.** The index EXPLAIN was green because I wrote the index's own predicate back at it. Through the view it was a Seq Scan over 3M rows.
- **Match the embedding MODEL, not just the width.** Two models at one width return plausible nonsense instead of an error. 384 family = ACT knowledge tables; 1536 = CivicGraph domain.
- **Cardinality from a sample is a LOWER BOUND.** `original_role` read as 12 distinct on 200 rows; it is 999.
- **A null is not a gap.** `gs_entities.sector` looks like 428,449 missing until you split by entity_type: 240,584 are people. Real gap 185,504 organisations.
- **Enums in hiding are a migration, not a model.** Never pay a classifier to read what `->>` already knows.
- **Report patterns, not rows.** 8 of 12 disagreements were one pair: the column's meaning, not 12 bad rows.
- **Baselines, not zero.** A check red on the day it ships gets muted within a week.

### Open Questions
- UNCONFIRMED: does `/api/chat` scope=knowledge work END TO END? Query layer proven live; the request path needs an authenticated org user that cannot be made locally. **Ben is the first to see it.**
- RESOLVED: for the 64 stripped rows the TAG was wrong, confirmed by two independent signals. For the remaining 30 the question is still open, and for the 154 unassessed there is no question yet, because nobody has assessed them.
- **A guard can carry the bug it hunts.** `IS NOT TRUE` folded "never assessed" into "assessed as false" and overstated a defect 2.5x. Split null from false in every check of this shape.
- UNKNOWN: **the ingest that wrote those tags was never found.** Provenance `template_generated` (85) and `web_scraped` (55), Jan 2026. No writer in this repo. The guard is keyed on the symptom for that reason.
- UNKNOWN: calibration below 0.90. Bands of n=7, 5, 5, 2 cannot support a threshold. Anything routing on 0.7–0.8 needs its own measurement.
- UNKNOWN: LLM cost, volume and latency in every repo. No metering exists anywhere. The workspace audit is code-reads, not traffic.
- UNVERIFIED: every §2–§5 claim in the workspace audit is an agent code-read. Re-read before acting.

### Workflow State
pattern: catalogue-measure-repair
phase: 6
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "point a typed classifier at the whole database; catalogue, calibrate, then find data that lies"
- resource_allocation: balanced
- scope: catalogue DONE · calibration DONE (95% @ >=0.90) · check loop DONE and in CI · three repair PRs OPEN

#### Unknowns
- alma_remaining_30_contradictions: UNKNOWN (classifier not confident; needs a human)
- alma_tagging_ingest: UNKNOWN (not in this repo)
- jev_calibration_below_0.90: UNKNOWN (n too small)
- chat_knowledge_end_to_end: UNKNOWN (needs an authenticated org user)

#### Last Failure
(none — main green: parity 466/47, contradiction guard clean and passing in CI, precheck green)

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
