# JEV workspace audit — where typed decisions would help, across ten repos

**Date:** 2026-09-21
**Scope:** the ten repos in `~/Code` with a commit since 2026-09-06. The other 46 have been dormant
since August and were deliberately left out.
**Method:** three parallel read-only sub-agents, one per cluster, plus direct verification in
grantscope by the session itself.

## Provenance — read this before quoting anything below

This document mixes two kinds of claim and they are not equally reliable.

- **Verified by this session** (queried the database, ran the code, reproduced the error): everything
  in *§1 grantscope* only.
- **Agent-reported, unverified** (a sub-agent read the code and reported what it read; no query was
  run, no traffic measured): everything in §2 onward. File paths and line numbers come from those
  reads. **Re-read the file before acting on any of it.**

**Cost, call volume and latency are UNKNOWN for every incumbent call in every repo.** No LLM metering
table was found in any of them. Nothing here is a measurement of traffic. Any claim that JEV would be
cheaper or faster in a given path is currently unevidenced — the only measured JEV figures we have are
from our own pilot (`thoughts/shared/findings/jev-evaluation-2026-09-21.md`): p50 322ms at concurrency
4, $0.078 per 1,000 grants.

## What JEV is, and its two hard limits

typesafe.ai's "System One" model. Typed answers only, no text generation. Three primitives: **Choice**
(one of N labelled options, with a calibrated confidence), **Score** (a number on a declared scale),
**Noul** (a probability of a binary proposition).

1. **It cannot count, do arithmetic, or order dates.** Never on money figures, ratios or deadlines.
2. **When "not stated" is a real answer, it must be an explicit Choice option** — never inferred from
   the middle of a Noul probability range. Measured in our own pilot: 0% → 100% agreement on the same
   model and the same input, purely from reframing a Noul as a three-option Choice.

---

## The pattern, which is the same in every repo

**A chat model is asked for JSON, the JSON is regex-sliced back out of prose, and the only part used
downstream is one enum and one number.**

The tell is that several repos have a file that exists only because chat models do not return types:

- `JusticeHub/src/lib/ai/parse-json.ts` — 175 lines, five stages (strip `<think>`, strip fences, direct
  parse, regex-extract the first `{...}`, repair trailing commas and quotes), used at ~18 call sites.
- `JusticeHub/src/app/api/justice-matrix/ask/route.ts` carries `repairLlmJson`, which **inserts a
  missing closing brace** because gemini-2.5-flash drops one on roughly 1 in 8 rich answers, plus a
  hand-written unescaper for partially-streamed JSON. Three layers of repair for one typed answer.
- `act-global-infrastructure/scripts/lib/llm-client.mjs` — `extractJson`, with a `<think>`-leak
  stripper, a fence stripper, a greedy brace slice, and `return null` on total failure. Every grader in
  that repo routes through it and every one degrades to a fabricated score.
- `empathy-ledger-v2` inlines the same rescue in at least six places and has three routes with a bare
  unguarded `JSON.parse`.

**Token-budget archaeology is the same failure in another costume.** Two separate instances were found
where a `max_tokens` was raised repeatedly because JSON truncated mid-object: 400 → 900 in JusticeHub's
faithfulness judge, and 1100 → 2500 → 3200 → 4800 in its ask route. Neither failure can exist with a
typed call, which emits no reasoning trace and no prose.

**Second recurring shape, and it is our own abstention thesis again: self-reported confidence stored as
if it were a measurement.** The clearest cases:

- `act-regenerative-studio/src/app/api/knowledge/extract/route.ts` — a Mistral call is told "if
  confidence < 0.5, set isKnowledge to false", and the row is then **auto-rejected** on the model's own
  opinion of itself, nightly, at 2am.
- `JusticeHub` writes `yj_category` **completely unvalidated** (`result.yj_category || null`), so a
  hallucinated seventh label lands in the column. Its `yj_confidence` is a self-report. Same repo:
  `extraction_confidence` is stored and never read. The columns shaped for calibrated confidence
  already exist; there is nothing trustworthy to put in them.

---

## §1 grantscope — verified by this session

The graph/recall half that the abstention sessions never reached. **All three claims measured directly.**

### 1a. Org knowledge search was dead from the day it shipped — FIXED this session (`7e98ac3b`)

`knowledge_chunks.embedding` is `vector(384)` on all 19,413 rows. `/api/chat` sent the 1536 default, so
pgvector raised `different vector dimensions 384 and 1536` on every request, and the error was
destructured away at the call site. `scope=knowledge` had never returned a single chunk.

The writer is `act-global-infrastructure/scripts/embed-communications.mjs`, using **the same model** —
`text-embedding-3-small` — at `dimensions: 384`. Same Matryoshka space, so only the query width was
wrong; no re-embedding was needed.

The database has two deliberate families, and this is now recorded in code rather than folklore:

| width | tables |
|---|---|
| **384** | `knowledge_chunks`, `project_knowledge`, `memory_episodes`, `archival_memory`, `voice_notes`, `wiki_search_index`, `imessage_attachments`, `daily_reflections` |
| **1536** | `grant_opportunities`, `foundations`, `gs_entities`, `alma_*`, `org_profiles`, `project_profiles`, `wiki_pages`, `civic_intelligence_chunks` |

Verified after the fix: 1536 → error, 384 → 5 chunks at 0.530 top similarity.

### 1b. The provenance layer is stillborn

`knowledge_sources` has **12 rows, 0 with a `source_url`, 0 with `verified_at`**. `current_knowledge`
has **1 row**. Nothing in grantscope writes either table. So the accurate statement is not that
citations are unverified — **there are effectively no citations at all**, and the one consumer could
not run its query.

### 1c. `mv_search_index` carries no provenance

18 columns; `href` is an internal CivicGraph route, not a source link.

**JEV's role here: none for 1a or 1c.** Those are deterministic engineering. Passage relevance over
`knowledge_chunks` is a real Choice task, but it is worth nothing until retrieval runs at all — which,
as of `7e98ac3b`, it now does.

---

## §2 Live bugs found by the audit that have nothing to do with JEV

These are defects now, not proposals. **Unverified by this session — re-read each file first.**

### 2a. JusticeHub generates a grant acquittal report with no grounding check — highest severity

`JusticeHub/src/app/api/org-hub/[orgId]/report-draft/route.ts:126-148`. A grant acquittal for a
grassroots Indigenous organisation — sessions, participants, milestones, dollars spent — generated on
claude-sonnet-4-5 and returned **raw**: `message.content[0].text`, no parsing, no validation, no
grounding. Reported as the only surface in either repo where numbers destined for a funder pass through
a model unchecked.

JEV cannot fix this — money figures are outside its limits. `empathy-ledger-v2` already has a
verbatim-grounding pass (`gates.ts:141-247`) and the repos are adjacent.

### 2b. empathy-ledger-v2 fails open on cultural safety

`cultural_sensitivity_level` has three conflicting defaults across three code paths (`'low'` at the
ledger write, `'medium'` at salvage, `'medium'` at fallback), and `guardian-review.ts` defaults it to
`'low'` again when no analysis row exists. `'high'` is what caps the readiness score at 40 and routes to
elder review. **So a missing analysis silently produces a publishable draft.**

### 2c. The Knowledge Keeper's citations describe what was retrieved, not what was used

`empathy-ledger-v2/src/app/api/knowledge-keeper/ask/route.ts`. A comment says "extract citations from
the answer"; the code builds them from **every retained chunk**, then filters on a similarity number.
A chunk the model never touched still shows as a citation; a chunk it did cite but which scored low is
dropped. No chunk id and no URL reach the client at all.

Same file: the `privacy_level` / `cultural_sensitivity` filter is **vacuous for content-KB chunks**
because the hybrid-KB mapping never populates those fields. Only docs-KB chunks are actually screened.
That is a consent bug.

Also: the two search RPCs return scores that are **not commensurable** (`combined_score` vs raw cosine)
and the merge sorts them together with nothing normalising.

### 2d. act-regenerative-studio stamps an LCAA phase on almost every document

`src/lib/ai-intelligence/knowledge-ingestion-service.ts:128-144` — any document containing the word
"art" or "action" anywhere gets an LCAA phase.

### 2e. The studio's model-eval scorer rewards a string, not a meaning

`scripts/ai-continuous-evaluation.mjs:127-190`. Cultural safety is `if (text.includes('ocap')) score += 2`;
factual accuracy is 2.5 points per literal `listen`/`curiosity`/`action`/`art`; speed is hardcoded `7`.
A response that explains consent perfectly without those four letters scores low; "ignore OCAP" scores
+2. This is the same invisible-false-negative class our own keyword grant scorers had.

### 2f. JusticeHub auto-links entities on a fabricated probability

`src/lib/auto-linking/engine.ts`. Confidence is `pattern.confidence * stringSimilarity` — two
hand-picked constants times a string-edit ratio — and it **auto-applies at ≥0.90 and sets `is_featured`
at ≥0.95**, writing links with no review.

---

## §3 Candidates by repo

Ranked within each cluster. All line numbers are agent-reported.

### act-global-infrastructure

| id | task | file | why |
|---|---|---|---|
| A1 | Rubric grader Tier 2/3 verdict | `scripts/grade-pack.mjs:45-93` + 3 siblings | **The only place in the workspace with an eval set already built** — `thoughts/shared/rubrics/fixtures/` with a `good-*`/`bad-*` naming convention the harness keys off. The final score is already computed in JS; the model only contributes two booleans. |
| A2 | Receipt↔email match adjudication | `scripts/lib/receipt-ai-scorer.mjs:27-74` | The four `factors` enums are already Choice questions written as free text. Blocked on a ground-truth set that does not exist. Amount and date matching must stay in JS. |
| A6 | RAG rerank + sentence selection | `scripts/unified-search.mjs` | Cosine similarity is the only ranking signal; no reranker exists. Source links already survive properly — citations are not the weakness here. |
| A4 | Email → project code | `scripts/tag-emails-by-project.mjs:173-195` | Closed 72-code set in `config/project-codes.json`, the best-prepared reference in the workspace. |
| A3 | R&D Tier 3 eligibility | `scripts/tag-rd-eligibility.mjs:196-240` | **DO NOT AUTOMATE.** Feeds an AusIndustry R&D tax claim. Advisory column only. Also has the weakest reference: the core-vs-supporting rule is written nowhere. |

### Goods Asset Register

| id | task | file | why |
|---|---|---|---|
| G1 | Loop C `docFraming` + `isLiveDrift` | `scripts/loop-c-ingestion.workflow.js:49,91-99` | The most JEV-shaped thing found anywhere: a seven-option enum that **already includes `unknown` as an explicit member**, written by someone who arrived at our pilot's lesson independently. Load-bearing (everything not `current` is dropped before the expensive phase), dry-run, writes nothing, and canon guard tests give it ground truth. |

Everything else in Goods: **no JEV use.** md5 dedup is exact; admin search is lexical by design; the
consent-gated photo↔person UI is correctly human-gated; `canon.ts` + `.guards.test.ts` is the
typed-module-with-guards pattern done right and nothing belongs between the guard and the value.

### JusticeHub

| id | task | file | why |
|---|---|---|---|
| JH-2 | Faithfulness judge | `src/lib/justice-matrix/faithfulness.ts` | **Recommended pilot.** Already a three-option typed verdict; already behind `callBackgroundLLM()` so JEV drops in with no call-site change; can only ever clamp confidence *down*, never publish a claim; deterministic cache key allows replaying old vs new over identical inputs. |
| JH-6 | Data-sufficiency source scoring | `src/app/api/cron/data-sufficiency/agent/route.ts` | **Easiest second.** The 0–1 scale and *both* cut points (0.4 → finding, 0.7 → investigating) already exist and are tuned. Swap the estimator, change nothing downstream, measure disagreement. |
| JH-1 | Youth-justice grant classifier | `src/app/api/cron/civic/yj-classifier/route.ts:21-113` | Six-option enum already in the prompt. Needs a seventh: `insufficient_text` — `evidence_text` is `'n/a'` on some rows and those are currently forced into a wrong answer. **Note: `yj_category` has no consumer anywhere yet.** Cheap to get wrong today, expensive the day a surface reads it. |
| JH-4 | ALMA duplicate adjudication | `scripts/alma-deduplicate-enhanced.mjs:240-280` | The clearest "frontier model used as a two-option classifier and the answer string-compared" site found. `max_tokens: 10`, `=== 'SAME'`, exceptions swallowed into DIFFERENT, no confidence at all. **High blast radius — merges are destructive**, which is exactly why a threshold is needed and a string compare cannot express one. |
| JH-3 | Publication-law second gate | `scripts/justice-matrix-auto-publish.mjs:216-241` | **Add-only.** May raise a hold, must never clear one the regex held. Statutory non-publication exposure. |
| JH-7 | Auto-linking entity matcher | `src/lib/auto-linking/engine.ts` | See §2f. High blast radius. |

### empathy-ledger-v2

| id | task | file | why |
|---|---|---|---|
| EL-1 | Triage the 856 unexamined articles | `src/lib/syndication/article-consent-basis.ts` | **Biggest human win.** 856 of 867 articles sit in a state the rule refuses to default. As a queue *sorter that writes nothing*, this turns an unfinishable backlog into an afternoon. **JEV must never write `no_human_subject_confirmed_by`** — that column's entire meaning is "a named human looked". |
| EL-2 | Fabricated-name check | `src/lib/ai/guardian-checks.ts:248-300` | Retires a ~150-word hand-patched stoplist that now contains 'Bootstrap', 'Pandemic', 'Doors', 'Room', 'Ledger'. Every entry is a false positive someone hit. The list will never converge. |
| EL-3 | RAG rerank + citation grounding | `src/app/api/knowledge-keeper/ask/route.ts` | See §2c. Two jobs: a real reranker where none exists, and making the citation list describe what was *used* — which is what readers already believe it means. |
| EL-4 | Cultural sensitivity level | `src/lib/ai/transcript-analyzer-v3-claude.ts` | See §2b. **Raise-only, never lower.** `cannot_tell` must route to review. |
| EL-5 | Project suggestion | `src/app/api/admin/transcripts/[id]/suggest-project/route.ts` | Already correctly designed (suggest-only, validated, human confirms). JEV adds a calibrated confidence and deletes the regex slice. Add `no_good_match` — today a forced pick at `confidence: 'low'` is the only way to say it. |

### act-regenerative-studio

A1 wiki extraction keep/type (highest value — kills a regex-sliced auto-reject on a nightly cron);
A2 RAG passage relevance; A3 storyteller→project matching (**highest blast radius — decides who appears
on public project pages; shortlist narrower only, never the publisher**); A4 the model-eval scorer
(**lowest blast radius of anything in the workspace — offline weekly cron writing a JSON report — and
therefore the safest pilot in that repo**); A5 public-copy keyword classifiers as a second pass only.

### Repos with no JEV use, checked and closed out

- **fishers-oysters** — 43 files, marketing site. Zero AI dependencies.
- **Philanthrophy-vision** — 8 files, static D3 visualisation over read-only Airtable. The one thing it
  does is chart arithmetic, which is the category JEV must never touch.
- **The Harvest Website** — marginal. One candidate (moderation queue pre-screen), volume almost
  certainly single-digit per week; setup cost likely exceeds the value. Note `server/_core/llm.ts:268`
  is a full typed LLM abstraction with **zero callers** — dead scaffolding.
- **JusticeHub Tests** — not a test harness. An abandoned Next 14 + Airtable prototype. Archive it.

---

## §4 Where a typed classifier must not go

All three agents converged on the same rule independently: **a model may raise a review requirement and
never lower it.**

1. **Setting or relaxing any consent tier.** No model output touches these today and none should.
2. **Face-to-identity binding** (`empathy-ledger-v2/src/app/api/admin/face-clusters/name/route.ts`).
   Reported as the best-designed decision boundary in the workspace: three answers, elder validation,
   and a cross-community same-name collision returns **409 with candidates for the room to decide**
   rather than auto-linking. The ruling records `elder_confirmed` or `asserted`, **never `auto`**.
3. **Coverage gaps, money, ratios, dates.** JEV cannot count.
4. **Quote verification** — exact contiguous substring matching, with a comment explaining that
   bag-of-words overlap "can validate a sentence the storyteller never said". Correct as written.
5. **`sanitisePlan`** (`JusticeHub/src/lib/justice-matrix/query-understanding.ts:358-445`) — a
   deliberate distrust boundary. `region` is never trusted from the model because `cases.region` is 67%
   null and the model filled it with court names, zeroing result sets. **Better calibration does not fix
   a field that is 67% null in the data.**
6. **Federated external hits are surfaced without synthesis**, because handing a title-only hit to a
   model "would invite it to infer what the case decided from its name". Applies to JEV identically.

**The strongest evidence in the workspace, in both directions:** empathy-ledger measured a model's
self-reported confidence against **293 hand-judged photographs**, found it uncalibrated, and removed it
as a gate — replacing it with two-model agreement. That is the case for paying for calibration, and
simultaneously the case for leaving that particular gate conservative.

---

## §5 Missing references — the blockers

JEV checks a thing against a reference. These references do not exist:

1. **No labelled gold set anywhere, for any task, in any repo.** Every threshold in this document is a
   guess until one exists. The two nearest things that do exist: `thoughts/shared/rubrics/fixtures/` in
   act-global (A1) and the 293 hand-judged photographs in empathy-ledger. **This is the same gap as our
   own ungraded `data/jev-pilot/adjudication-sheet-choice.csv`.**
2. **OCAP® / cultural-protocol criteria** — named in code in at least three places across two repos,
   defined nowhere. Any JEV question touching cultural safety has nothing to check against. Keep human.
3. **The YJ category definitions live only inside a prompt string**, duplicated across a route and a
   script with a comment saying "keep prompts in sync" — i.e. they already drift. They need to be a
   typed module both import.
4. **No written AusIndustry core-vs-supporting R&D definition.** Highest blast radius, weakest
   reference.
5. **No consent-tier decision guide.** The four levels are a Zod enum with no written definition of what
   separates them.
6. **No moderation standard** for Harvest's three queues; **no canonical program registry** for ALMA
   dedup to adjudicate against; **no retrieval eval set** anywhere, so retrieval quality is currently
   unmeasurable in either direction.

---

## §6 Recommendation

**Pilot JH-2, JusticeHub's faithfulness judge.** It is the only candidate where the incumbent is already
a three-option typed verdict, the call site is already abstracted behind a provider interface, failure
is safe by construction (it can only clamp confidence down), and a deterministic cache key lets you
replay old and new over identical inputs. It also deletes a known failure outright: its token budget was
once eaten by the reasoning trace, so every answer silently read as "unchecked".

**Run JH-6 first if you want a demo where a number visibly moves** — its scale and both cut points
already exist, so nothing downstream changes.

**Biggest human win, separately: EL-1**, as a queue sorter that never writes.

**Do not automate: A3** (AusIndustry tax claim) and **the storyteller→project matcher** (decides who
appears on public pages).

**Before any of it: grade a gold set.** Everything above is gated on the same unanswered question as our
own pilot — is JEV's confidence calibrated on our data? Until `adjudication-sheet-choice.csv` is graded,
every threshold in this document is a number someone made up.

## Open questions

- UNKNOWN: cost, call volume and latency for every incumbent call in every repo. No metering exists.
- UNKNOWN: whether JEV's confidence is calibrated on our data. Blocks everything gated on a threshold.
- UNVERIFIED: every §2–§5 claim. Agent code-reads, not measurements. Re-read before acting.
- NOT INSPECTED: ~8.2GB of act-global (`archive/`, `ralph/`, `apps/`, `training-data/`) — and a
  `build-training-dataset.mjs` + `deploy-fine-tuned-model.mjs` + `monitor-training.mjs` trio there
  suggests a fine-tuning pipeline that may overlap or compete with a JEV decision. Worth a look before
  committing to anything.
