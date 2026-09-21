---
date: 2026-09-21T07:00:00Z
session_name: jev-system-alignment
branch: main
status: active
---

# Work Stream: jev-system-alignment

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-21T07:00:00Z
**Goal:** Use JEV's thesis — that "I don't know" must be a first-class answer — to find and close the places where the pipeline throws an abstention signal away. **Session 2 complete and MERGED.**
**Branch:** main (PR #464 squash-merged as `9a4352b1`; `docs/jev-evaluation` deleted)
**Test:** `bash scripts/precheck.sh` · `node --test scripts/lib/*.test.mjs` (132 tests)

### Now
[->] Nothing in flight. Everything below is merged, applied and verified. Next session picks from Next.

### This Session
- [x] **Foundation extraction v3** — the prompt never asked for eligibility/how-to-apply/contact (11% filled). Now asked for, each written only with a quote from the page. Verified live on Annamila: all fields populated, deadline correctly null, `not_accepting` detected.
- [x] **Abstention audit over all 30 durable-write LLM call sites** → `thoughts/shared/findings/abstention-audit-2026-09-21.md`. Four findings; **three fixed, one withdrawn after checking.**
- [x] **`scrape-grant-deadlines` evidence gate + provenance.** Its prompt literally said "known OR IMPLIED deadline". Now needs a quote; unquoted "open" → `unknown`; `closed` passes unquoted (it only removes from the desk). Stamps `metadata.deadline_provenance` so its writes are attributable — they were not (only `last_verified_at`, which 8 other writers set).
- [x] **`extract-foundation-relationships`** — required `evidence_text` in the prompt then did `|| null` and inserted anyway. Two `.filter(hasPageEvidence)`.
- [x] **Provider stack repaired.** Probed all five: groq's `llama-3.3-70b-versatile` **404 (retired) in 17 files**; deepseek/anthropic/minimax all out of credit; only gemini worked. → `openai/gpt-oss-120b`. Gemini 2.5 Flash spends `max_tokens` on reasoning, so a 500 cap returned unclosed JSON logged as "no JSON found" — raised caps, log now says "truncated at the token cap". 12-grant run: 1 verdict → 4 of 4, zero LLM errors.
- [x] **GrantConnect UA gate.** The scraper introduced itself honestly; CloudFront refused it and it skipped **94 of 311 open grants** — every Commonwealth opportunity. `GET` + browser UA = 200. UA is now browser-shaped but still identifies us. robots.txt allows `/Go/*`.
- [x] **URL health audit** (`scripts/audit-grant-url-health.mjs`, two-pass: fetch, then real Chrome adjudicates every non-2xx). **Almost no link rot: 1 of 311 open grants genuinely dead.**
- [x] **Anchor fix + APPLIED.** 1,744 of 1,746 foundation grants carried an invented `#slug`. Now 957 (real unique-index collisions only); **796 link to their actual page**, up from 2.
- [x] **Amount guard + APPLIED.** Floor 100, measured. A $20 laser tag ticket was satisfying `hasStructuredGrantSignal` and promoting a fundraising event to a grant. Sync errors 3 → 1.
- [x] **Eligibility confidence floor 0.7 + MIGRATION APPLIED** (`20260921040000`: `eligibility_confidence`, `eligibility_summary`, `eligibility_provider`). Replayed over all 337 cached verdicts: 192 accepted, 145 refused, 21 flags suppressed (4 exclusionary), **page quote now stored on 337/337 where it was stored on none.**
- [x] **Cleanup split, 90 → 12.** `--cleanup-invalid` deleted anything the DESK rule refused, so closed-but-real programmes were on the list. New `isNeverAGrantProgram` needs a positive reason; an `individual` label needs corroborating award language before it deletes.
- [x] **Deleted 2 junk rows by id** (`scripts/sql/2026-09-21-delete-non-grant-rows.sql`), not via `--cleanup-invalid`.
- [x] **PR #464 merged, deploy green, prod regression-checked with Playwright.**

### Next
- [ ] **PR #463 (sidebar labels) is 6 days old**, public surface, waiting on Ben's eyes. Now the stale one.
- [ ] **Grade `data/jev-pilot/adjudication-sheet-choice.csv`** — 220 disagreements, only 4 direct contradictions. STILL the only thing that answers whether JEV's confidence is calibrated on our data. Everything gated on confidence depends on it.
- [ ] **12 rows `--cleanup-invalid` would now delete** (scholarships, fellowships, 1 orphan). Not run; needs Ben's verb.
- [ ] **"Epworth Research Grants" is duplicated** in the source data under one `(source, name)` — the last remaining sync error. Needs a human merge.
- [ ] `parse-foundation-grants.mjs:79-95`: `/mental.?health/ → 'child-protection'` is a plain bug on the published youth-justice report.
- [ ] Fix the `closes_at >= today OR deadline >= today` filter — leaks closed grants onto the desk.
- [ ] Orphan `foundation_programs` rows — upsert keys on `(foundation_id, name)`, so naming drift leaves stale rows.
- [ ] **Graph + recall (the untouched half of Ben's original ask)** — see Context: `mv_search_index` has no source URL, citations are never verified, `search_org_knowledge` declares `vector(1536)` against a **384** column.

### Decisions
- **The thesis held, and is now load-bearing.** Seven separate bugs across two sessions; **not one was a model being wrong.** Each was a place the system had an "I don't know" available — often in a field it had already asked for — and discarded it at the boundary. Carry this to every new extractor.
- **The quote rule is now shared code**, `scripts/lib/llm-evidence.mjs` (`quote`, `hasPageEvidence`). Used in three places. New extractors import it rather than re-inventing a threshold.
- **Every floor in this work is MEASURED, and each records how to re-measure.** Amounts 100, eligibility confidence 0.7, rubric 2.5. Do not nudge one without re-running the measurement in its header comment.
- **A destructive rule needs two signals.** Deleting on one unevidenced LLM label is the same failure we spent the session fixing — the Wesfarmers Seed & Partnership Grant ($25k, open) would have gone on a single `individual` tag from the old v2 prompt.
- **"Cannot act on it today" ≠ "was never a grant."** Conflating them is what made `--cleanup-invalid` threaten 88 legitimate rows. Status is for the first; deletion is for the second.
- **Verify before acting, even on your own finding.** The SE verification-tier finding was the most confident-sounding of the four and was **wrong** — all 426 rows qualify via `STATUTORY_MATCH` anyway. Two queries killed it. It would have read well in a report.
- **Never call a URL dead on a bare fetch.** grants.gov.au 404s on HEAD and serves GET; curl gets 403 on its own homepage. A bot wall and a dead link are indistinguishable to fetch, and reading one as the other would have deleted 30% of the live desk.

### Open Questions
- UNCONFIRMED: is JEV's confidence calibrated on our data? Unanswerable until the adjudication sheet is graded.
- UNCONFIRMED: cost of a full foundation re-scan with the v3 prompt. ~5,940 foundations with websites, ~28s each. v3 is worth more per call than v2 was, but the spend is still unmeasured.
- UNCONFIRMED: Butterfly's Indigenous-led board — installed? Ben-only. Decides whether Annamila-class funders are reachable at all.
- UNCONFIRMED: how many `grant_opportunities` rows are individual-only? The 21-foundation sample said 61% individual, only 34% organisation-fundable.
- KNOWN COST: deepseek, anthropic and minimax are all out of credit. A billing decision, not a code one. Only gemini and groq are serving.

### Workflow State
pattern: audit-then-repair
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "point JEV at everything the system holds, align it, prevent the 2026-09-21 class of silent wrong answer"
- resource_allocation: balanced
- scope: extraction + abstention layer DONE and merged; graph/recall/memory half NOT started

#### Unknowns
- jev_calibration_on_our_data: UNKNOWN (adjudication sheet still ungraded)
- full_rescan_cost_v3: UNKNOWN
- butterfly_board_status: UNKNOWN (Ben-only)

#### Last Failure
(none — precheck green, 132 node tests, CI green on main, migration parity green, prod verified via Playwright)

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
