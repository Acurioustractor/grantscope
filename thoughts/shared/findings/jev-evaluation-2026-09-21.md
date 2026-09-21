---
date: 2026-09-21
topic: Where JEV (typesafe.ai's System One model) could replace judgement code in CivicGraph, and which tasks it must never touch
method: read-only audit of three local grantscope clones — greps and file reads across every scoring, classifying, matching and retrieval decision point; run frequency measured from agent_runs; JEV capabilities read from docs.typesafe.ai including the model-jaggedness page
status: audit + a pilot built and run on 25 grants (scripts/jev-pilot/). Latency and cost are now MEASURED; accuracy is not — 9 disagreements await blind adjudication in data/jev-pilot/adjudication-sheet-choice.csv
recommendation: grant-eligibility extraction as five three-option CHOICE questions (not Nouls — see Candidate 1), replayed over data/grant-eligibility-cache.jsonl
---

# JEV evaluation

**Confidence tags.** `[V]` = read the file line by line, or queried the live database in this session.
`[G]` = grep across the local trees (exact for what the pattern matches, blind to what it does not).
`[D]` = read from typesafe.ai's published documentation, not independently tested.
`[I]` = inferred from `[V]`/`[D]` facts, not tested.
`[?]` = unknown, flagged deliberately.

## The headline

`JEV_API_KEY` is in `.env` and, before this session, **nothing in any of the three local trees
referenced it** `[G]`. The pilot in `scripts/jev-pilot/` is the first use. Latency and cost below are
now measured on 50 real calls; **accuracy is still `[?]`** until the adjudication sheet is graded.

JEV is not a chat model. It answers typed questions about a state blob and returns calibrated
probabilities, with no text generation. That makes it a candidate for exactly one pattern in this
repo, and that pattern is everywhere: **we ask a chat model a structured question, tell it to return
strict JSON, and then regex the JSON back out of free text.** There are at least a dozen sites doing
this, each with its own provider-failover chain and its own brace-slicing parser.

It is simultaneously the wrong tool for a large fraction of what CivicGraph does, because the
published limitations rule out arithmetic, counting and date ordering — which is most of our
surface area.

Four things follow, in order of usefulness:

1. **Grant eligibility extraction is the pilot, and it is built.** `act-grant-eligibility.ts:1-4`
   records that only **7 of 3,088 live grants** have `dgr_required` populated and 302 have
   `accepts_pty_ltd` `[V]`. The ACT desk answers "unknown" for almost every grant. Measured on 25
   pages: p50 **322ms**, p95 861ms, **$0.078 per 1,000 grants**, 0 failures in 50 calls `[V]`.
   **The primitive mattered far more than the model:** Nouls agreed with the incumbent 0-44% per
   field, three-option Choices 88-100%, on identical input `[V]`.
2. **Never point it at money, place or dates.** See "Where JEV has no use" — this is a hard boundary,
   not a preference.
3. **Two bugs surfaced that are independent of JEV** and should be fixed regardless: a topic regex
   maps mental health to child-protection on the published youth-justice report, and an LLM guess is
   counted as a `verified` tier in the buyer-facing SE registry.
4. **Retrieval provenance is broken in ways JEV cannot fix.** The main search index carries no
   external source URL at all. Better passage filtering does not restore provenance never captured.

---

## What JEV is `[D]`

`POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`, one `state` (string,
object or array) plus a map of named `questions`. Three primitives:

| primitive | asks | returns |
|---|---|---|
| **Noul** | "is this statement true?" | `noul`: probability 0–1. **No confidence field.** |
| **Choice** | one option from up to 255 | `choice`, `probabilities` per option, `confidence` 0–1 |
| **Score** | rate against 2–10 ordered rubric levels | `score` (probability-weighted), `probabilities`, `confidence` |

`jev-1.13.0`. Context 64k per request, of which 32k for state plus the longest question.
**$42 per billion input tokens ($0.042 per million); output tokens free.** 1,200 requests/minute,
250k tokens/second, "adjusting dynamically… without notice". Python and JS SDKs. Text only, English
best. Errors: 401, 422, 429, 529.

Confidence is derived from the shape of the probability distribution, not a separate estimate: a
distribution concentrated on one outcome is confident, a spread one is not. Their suggested pattern is
risk-scaled gating — 0.5 as a floor below which you do not act at all, 0.9+ for anything destructive —
with the explicit caveat that "the correct threshold values depend on your domain… test with your own
data".

### The limitations that decide most of this document `[D]`

From `docs.typesafe.ai/model-jaggedness/jev-1.13`, quoted:

- "Jev is not a calculator" and "does not count reliably" — errors grow with input size.
- It "reads dates as text, not as ordered quantities" and struggles with "which of two dates comes
  first, how far apart they are, or whether one falls inside a window".
- It cannot "reliably judge whether two values are near each other".
- "Context rot": accuracy declines as state grows with content unrelated to the decision.
- No structural invariants — "P(noul) and 1 - P(not noul) may not be directly comparable".
- Multi-hop reasoning and double negatives cost accuracy.
- Not trained to generate text.

---

## Measured run frequency `[V]`

`agent_runs`, last 30 days, filtered to classify/enrich/dedup/link/match/fit:

```
vercel-cron:alma/enrich          120    enrich-grants-free                22
enrich-charities                  40    nightly-grant-pipeline-enrich     18
enrich-foundations                33    classify-acnc-social-enterprises  12
enrich-social-enterprises         33    auto-classify-llm                  9
vercel-cron:civic/yj-classifier   30    classify-community-controlled      3
match-foundations-for-projects    29
goods-procurement-matcher         28
```

Anything not in that list runs manually or one-off; its frequency is `[?]`. Cadence for registered
agents lives in the `agent_schedules` table, not the repo — not queried this session.

---

## Candidate 1 — grant eligibility extraction `[V]` — PILOT BUILT AND RUN

**Files.** `scripts/enrich-grant-eligibility.mjs` (prompt L54-76, provider table L45-52),
cache `data/grant-eligibility-cache.jsonl` (337 rows).

> **Corrected 2026-09-21, after building the pilot.** An earlier version of this document said the
> reference text is stored beside every verdict so nothing needs re-scraping. **That is wrong.** The
> cache holds verdicts only — `id, name, the five flags, eligible_summary, confidence, provider`. No
> url, no page text. A replay has to re-fetch the pages, which moves this row's setup effort from Low
> to Medium and is why the pilot has a separate fetch stage. `[V]`

**Today.** Playwright fetches the grant's `url`, takes the first 6,000 characters of page text, and
asks an LLM for `dgr_required, accepts_charity, accepts_pty_ltd, accepts_sole_trader,
accepts_unincorporated, eligible_summary, confidence`. The instruction is "Answer ONLY from the text —
if something is not stated, use null (do not guess)". Six providers round-robin: groq
llama-3.3-70b → MiniMax-M3 → gpt-4o-mini → gemini-2.5-flash → deepseek-chat → claude-haiku-4-5.
Output parsed by slicing to the outer braces and `JSON.parse`. Writes only under `--apply`; NULL is an
honest unknown by design (header L16).

**Where JEV helps.** Five independent questions over one document, sent as one fan-out request. It
deletes the JSON-parsing failure mode outright — there is no text to parse — and replaces a
self-reported confidence, which a chat model invents, with a calibrated one.

> **Use Choice, not Noul. Measured 2026-09-21 on 25 pages `[V]`.** The obvious design is five Nouls,
> and it is wrong here. Noul has two outcomes, so "the page is silent" has to be folded into `false` —
> and JEV then answered `dgr_required` at 0.03–0.12 on all 25 pages (confidently *false*) where the
> incumbent answered `null` (*not stated*). Both defensible; different questions; the comparison was
> meaningless. Re-asked as a three-option Choice (`required` / `not_required` / `not_stated`) on the
> same pages, same model, same 6,000 characters, agreement with the incumbent went:
>
> | field | Noul | **Choice** |
> |---|---|---|
> | dgr_required | 0% | **100%** |
> | accepts_charity | 44% | **88%** |
> | accepts_pty_ltd | 20% | **88%** |
> | accepts_sole_trader | 12% | **96%** |
> | accepts_unincorporated | 36% | **92%** |
>
> Choice also returns a `confidence`, which **Noul does not** — and confidence was what we wanted to
> gate on in the first place. The general lesson, worth carrying to every other candidate in this
> document: **when "not stated" or "unknown" is a real answer in the domain, it needs to be an
> option, not an inference from the middle of a probability range.**

- **State:** the 6,000 chars of page text plus grant name and funder. (JEV's 32k state budget means
  we could stop truncating, but see "context rot" — more unrelated text may hurt, so keep the
  truncation for the pilot and test widening separately.)
- **References to check against:** the page text is the authority. Nothing external needed.
- **One question it should answer:** *"What does this funding page say about whether applicants must
  hold DGR endorsement?"* — three options: `required` ("The page states applicants must hold DGR
  status, Item 1 DGR, deductible gift recipient endorsement, or must be able to receive
  tax-deductible donations"), `not_required` ("The page explicitly states DGR endorsement is not
  required"), `not_stated` ("The page says nothing either way").
- **Allowed answer:** one of those three, with per-option probabilities and a confidence 0–1.
- **What the app does:** confidence ≥ 0.5 → map `required`/`not_required` to true/false and
  `not_stated` to null; below 0.5 → null. Null already means "unknown" to
  `act-grant-eligibility.ts:82-88`, which renders it as such, so the uncertain path costs nothing.
- **If wrong or uncertain:** a false `dgr_required=true` hides real money from A Curious Tractor Pty
  Ltd; a false `false` puts Butterfly-only grants in front of the wrong entity. These columns feed the
  ACT desk (`act-grant-eligibility.ts:82-88`) and the SE match gate
  (`se-grant-match.ts:140-145`). Recoverable — it is a column, and the script is re-runnable.

**Concrete example, real.** `apps/web/src/lib/act-grant-eligibility.ts:1-4` states in a header comment
that only 7 of 3,088 live grants record `dgr_required` and 302 record `accepts_pty_ltd`. Nearly every
verdict the desk renders is 'unknown'. That coverage gap is the single largest measured number in this
audit and it is what the pilot is for.

---

## Candidate 2 — grant opportunity type `[V]`

**File.** `scripts/auto-classify-llm.mjs` — rubric L122-146, parser L186-199,
`MIN_CONFIDENCE = 0.7` at L36, registry entry `agent-registry.mjs:523-525` (`--limit=300`),
9 runs in 30 days `[V]`.

**Today.** Six buckets — `open_grant | invitation_only | award | placeholder | policy_framework |
partnership` — each with a one-line definition and named examples ("PRF's named fellowships, Cath Leary
Award"). Output contract, verbatim: `Return STRICT JSON only. No prose, no markdown. Schema:
{"items":[{"id","classification","confidence","reason"}]}`. Parser strips markdown fences, slices first
`{` to last `}`, `JSON.parse`, asserts `.items` is an array. Five-provider fallback. Writes
`opportunity_type` only at self-reported confidence ≥ 0.7; below that it stores
`auto_classify_confidence/reason/model/at` and leaves the column null.

**Where JEV helps.** A six-option Choice whose `criteria` map is the existing rubric text, unchanged.
Per-option probabilities are strictly more information than one label plus an invented confidence —
we would see when it is torn between `award` and `invitation_only`, which is the genuinely hard case.

- **Reads:** id, name, funder_name, description (currently truncated to 400 chars), focus_areas,
  amount min/max. `source_url` is passed but never fetched.
- **Question:** *"Which of these six categories best describes this funding record?"*
- **Returns:** one of six, with probabilities and confidence.
- **App does:** ≥0.7 → write `opportunity_type`, as now; below → store probabilities, leave null.
- **If wrong:** a false `open_grant` puts an invitation-only round in front of an applicant who wastes
  a week on it; a false `policy_framework` silently buries a live round.
- **Free comparison set:** every classified row already carries `auto_classify_confidence`,
  `auto_classify_reason`, `auto_classify_model` and `_at`, so JEV can be diffed against the incumbent
  on hundreds of rows with no labelling work.

---

## Candidate 3 — "is this charity a social enterprise?" `[V]`

**Files.** `scripts/classify-acnc-social-enterprises.mjs` (prompt L60-83, parse L183-201, providers
L46-51, registry `agent-registry.mjs:981-988`, `--limit=200 --apply`), 12 runs in 30 days `[V]`. And
`scripts/compute-se-verification-tiers.mjs:63`.

**Today.** An LLM reads name, purposes, beneficiaries, charity_size, state, postcode and returns
`{"is_social_enterprise", "confidence", "sector" (13 fixed values), "business_model"}`, capped at 80
tokens, parsed by `match(/\{[\s\S]*\}/)` then `JSON.parse`. Five providers round-robin; a bad-JSON
counter disables a provider. Rows are inserted into `social_enterprises` with
`source_primary='acnc-classified'`.

**Flag, independent of JEV.** `compute-se-verification-tiers.mjs:63` includes `acnc-classified` in the
source list that produces the **`verified`** tier `[V]`. No confidence floor is applied at that stage.
So a single LLM guess, made from purpose text alone, becomes a buyer-facing justification string that
reads as statutory verification, in the registry we are asking government buyers to trust. That is a
trust problem today, whatever we decide about JEV.

**Where JEV helps.** One Noul — *"Does this organisation trade goods or services as a primary means of
fulfilling a social, cultural or environmental mission, reinvesting the majority of its profit?"* —
with the definition already written at L60-83 as `criteria.true`. The calibrated probability gives a
defensible floor to gate the `verified` tier on, which is precisely what is missing.

- **If wrong:** a false positive puts a parish op-shop into a buyer-facing registry. Reversible in the
  database, less so in a buyer's confidence.
- **Honest limit:** the inputs contain nothing about actual trading revenue. Both the incumbent and
  JEV are inferring commerce from purpose text. **JEV does not fix a missing-input problem.**

---

## Candidate 4 — search by meaning, passage filtering and citations

### How retrieval works today `[V]`

Correcting a common assumption first: **`/api/ask` is not RAG.** It is text-to-SQL — a hand-written
`SCHEMA_CONTEXT` prompt (`ask/route.ts:8-96`), `temperature: 0`, validated by
`sql-validation.ts` (SELECT/WITH only, keyword blocklist, auto `LIMIT 100`), executed through
`exec_sql`. Its prose is deterministic (`buildDeterministicExplanation`, L369-395), so there are no
citations to verify. **`/api/chat` is the only RAG surface.**

Three retrieval paths, partly overlapping:

1. **Lexical spine search** — `/api/search/index` and `/api/global-search` call RPC
   `search_index_query` over `mv_search_index` (~440k rows, refreshed nightly). **No vectors.**
   Trigram + tsvector + exact-match boosts: postcode-kind exact 3.5, name-exact and ABN 3.0, prefix
   2.0, `+ similarity(name, raw) + ts_rank(tsv, tsq)`. `/api/global-search` runs five lanes with
   `LANE_CAP = 8`. **No relevance threshold at all** beyond pg_trgm's default, which this repo never
   sets. No reranking.
2. **Semantic lanes** — `/api/search/semantic` (threshold default 0.7), `/api/search/universal`
   (0.5, caller-overridable and unclamped), similar-grants on a grant page. `text-embedding-3-small`
   at 1536 dims, **no chunking** ("One vector per grant — descriptions are short enough",
   `embeddings.ts:5`). Category and grant_type filters are applied in JS **after** the SQL LIMIT, so a
   filter can silently empty a full result set.
3. **`/api/chat`** — embeds the last message; grants at `match_threshold: 0.6, match_count: 10`;
   foundations by ILIKE, limit 5; org knowledge at `0.5` when `scope=knowledge`. Concatenated into a
   system prompt for claude-haiku-4-5.

### How source links survive: badly `[V]`

- `mv_search_index` stores a precomputed internal `href` (`'/entity/' || e.gs_id`, `'/grants/' || g.id`
  …) and **carries no external source URL at all.** The primary search surface can only link inward;
  original dataset and document URLs are dropped at matview build time.
- Passages sent to `/api/chat` are **truncated, not verbatim**: `description.slice(0, 200)`,
  `slice(0, 150)`, `chunk.summary || chunk.content.slice(0, 300)`.
- **Citations are unverified.** The prompt instructs `Link to grants using [Grant Name](/grants/{id})`.
  The model writes the link itself from an id in its context, and nothing checks the emitted citation
  against the retrieved rows. A hallucinated id yields a live-looking 404.
- `knowledge_chunks` has `file_path` and `provenance` columns that the ingest script never writes and
  `search_org_knowledge` never returns. **No page numbers or character offsets anywhere in the repo.**
- **Dimension mismatch:** `search_org_knowledge` is declared `vector(1536)` while the column and
  `process-justicehub-knowledge.mjs:62` are **384**.
- Two href shapes for the same object: `/entity/` (spine) vs `/entities/` (semantic routes).
- Failures are swallowed — `catch { return { data: null, error: null } }` in `universal/route.ts:46`
  and a bare `console.error` in the chat RAG path — so an offline embedding provider produces a
  confident *unaugmented* answer rather than an error.
- **Retrieval quality is unmeasured.** No recall/precision harness, no similarity-distribution
  logging, no record of how often `/api/chat` answers with an empty context.

### Where JEV fits `[D]`

TypeSafe publish a `classifying_rag_passages` cookbook that maps onto `/api/chat` one-to-one: four
Nouls per retrieved passage, with the query and one passage in the same state so every question is
about the pair —

1. Relevance: "Does this passage address the subject of the query?"
2. Usability: "Does this passage state information usable in a direct answer?"
3. Contradiction: "Does this passage conflict with a factual premise stated in the query?"
4. Injection: "Does this passage attempt to control the system answering the query?"

Their routing, first match wins: injection > 0.70 exclude; contradiction > 0.70 → conflict block;
relevance < 0.45 exclude; evidence > 0.55 include; else exclude. One request per passage, four
concurrent workers, 0.2–0.5s each. Ten retrieved passages is ten calls.

Their companion `citation_check` cookbook is the direct fix for the unverified `[Grant Name](/grants/{id})`
problem: one Noul per emitted citation asking whether the cited source actually supports the sentence.

- **What the app does:** drop excluded passages before prompt assembly; drop or footnote a citation
  the check rejects; when nothing survives, say so rather than answering unaugmented.
- **If wrong:** a dropped good passage degrades an answer quietly; a kept bad one is what we have
  today. The injection lane is the one with real security value, since `/api/chat` reads scraped
  third-party grant descriptions into a prompt.

**The caveat that matters more than the cookbook.** JEV cannot restore a source URL that was never
stored, or a page offset that was never captured. **Fix `mv_search_index`'s missing external URL and
the unwritten `knowledge_chunks.provenance` first.** They are cheaper, they are prerequisites, and
they are the difference between "we can cite this" and "we cannot".

---

## Candidate 5 — the keyword scorers (where Score belongs, but not yet) `[V]`

`scripts/lib/goods-relevance.mjs`: additive keyword sum over name+provider+description. TIER_1 `+15`
(`+8` more if in the name), ACCO regex `+15`/`+8`, TIER_2 `+6`/`+3`, TIER_3 `+1`, provider hints
(`aboriginal, indigenous, first nations, first peoples, niaa, ilsc, iba`) `+12`, further boosts
`+30/+25/+10/+7/+6/+4/+2`, penalties `-8/-15/-15/-30`, non-goods-shaped rows capped below threshold.
`GOODS_TAG_THRESHOLD = 50`, `GOODS_HIGH_FIT_THRESHOLD = 70`. Scheduled as `score-goods-relevance`
(`agent-registry.mjs:1207-1214`).

`scripts/lib/project-relevance.mjs`: `PROJECT_TAG_THRESHOLD = 30`; per-project keyword tiers,
disqualifiers `-25`, geography match `+6`, state mismatch `-30`, thematic-only capped below threshold.
It documents its own failure mode at L24-29: ACT Government rounds share one boilerplate description
across siblings, so "Support for veterans and their families" scored a tier-1 hit on "youth justice",
patched with a `NAME_ONLY_SOURCES` set.

`scripts/lib/project-funding-fit.mjs` (570 lines) is the densest — a weighted sum of blockScore,
themeScore, geographyScore, entityScore, instrumentScore, amountScore, timingScore and
evidenceScore, labelled `strong_fit` ≥75, `good_fit` ≥60, `possible_fit` ≥40, plus hard blocks
(closed statuses, deadline passed, ownership gate, amount bounds, geography mismatch).

**Where JEV would fit.** Their composite-scoring pattern is built for this: replace each keyword tier
with one atomic Score against a written rubric, and keep the weighting arithmetic in our code — which
we must do anyway, since JEV cannot add up. The gain is that a rubric is explainable and immune to the
boilerplate-description class of bug; the cost is retuning weights that currently pass their tests.

**Why not first.** `project-funding-fit` has the only genuine human-labelled golden set in the repo —
`scripts/fixtures/goods-funding-fit-benchmark.json`, `benchmarkVersion: goods-funding-fit-v2`, 20 cases
with `expectedRelevant`/`expectedBlocked` covering operating-cost-foundation, ownership-gate,
deadline-too-late, buyer-not-funder, scholarship-noise and outside-delivery-footprint — with a runner
at `scripts/evaluate-project-funding-fit.mjs`. **It passes.** This is a task the existing code already
handles well, and changing it is low upside against real regression risk.

---

## Candidate 6 — entity resolution `[V]`

Trigram thresholds are scattered and mutually inconsistent: `0.85` in `backfill-se-abns-fuzzy.mjs:154`
and `link-vic-grants-fuzzy.mjs:172-176`; `0.7` in `link-indigenous-abns.mjs:148-160`; **`0.4`** in
`link-people-to-entities.mjs:11` for LinkedIn company matching, the loosest in the repo. Several build
SQL by string interpolation escaping only `'`. `merge-duplicate-entities.mjs` uses no similarity at
all — exact normalised-name grouping.

TypeSafe's `entity_alignment` cookbook uses a 3-level Score over candidate pairs: "two different
products" / "closely related, may or may not be the same" / "one and the same", rounding at 0.5 and
1.5 into unlinked / curator-queue / merge (80% / 11% / 9% on their benchmark), with auxiliary Nouls on
shared attributes for diagnosing the middle band.

That structure suits the ORIC and ACNC name-matching work, and the curator-queue middle band matches
how this work is actually done — the 2026-08-09 ORIC session was nine batches of human verdicts with
20 hub-bias corrections. **Keep trigram as the candidate generator**: JEV adjudicates pairs, it does not
scan 609k entities.

**Do not point it at `scripts/lib/person-cluster.mjs`.** That is union-find over a co-director graph
with `HIGH_DEGREE: 10`, `MIN_SHARED: 2`, `NOMINEE_MIN: 20`, `DOMINANCE: 0.5` — counting, which is the
documented weakness, and the contract is deliberately shared between the writer
(`build-person-identities.mjs`) and a probe (`person-disambig-probe.mjs`) "so the contract can't
drift". Leave it alone.

---

## Candidate 7 — two small, high-irreversibility ones `[V]`

**Topic tagging.** `scripts/parse-foundation-grants.mjs:79-95`, `inferTopics()`, nine regexes over
grant text. Two of them are wrong:

```js
if (/child|youth|young/i.test(combined)) topics.push('youth-justice')
if (/mental.?health/i.test(combined)) topics.push('child-protection')
```

Any mention of youth becomes youth-justice, and mental health becomes child protection. These feed
`topics @> ARRAY['youth-justice']`, the headline filter in
`build-youth-justice-report-snapshot.mjs:249-250` and `enrich-justicehub.mjs`. **This is a plain bug
and should be fixed whatever we decide about JEV.** A Choice over the topic vocabulary is the durable
fix; the hand-curated tags in `ingest-prf-portfolio.mjs:29-141` (~15 grants) are the de-facto golden
set for that vocabulary.

**Community-controlled latch.** `scripts/classify-community-controlled.mjs:26-31` ILIKEs 17 substrings
(`aboriginal`, `torres strait`, `land council`, `native title` …) against `canonical_name` and sets
`gs_entities.is_community_controlled`. It is a **one-way latch — only ever set true, never cleared** —
so a substring hit on a non-community-controlled org is unrecoverable by that script. 3 runs in 30
days, so low urgency but high irreversibility. One Noul with the ACCO definition as criteria, gated
high, would be safer.

---

## Where JEV has no use

Recording these so nobody relitigates them:

- **Every money surface.** `isRealRecipient()`, `themeMoney()`, the three mandatory `justice_funding`
  filters, the aggregate-name exclusions. Deterministic SQL, correct, and "Jev is not a calculator".
- **Place attribution.** The whole `poa_ratio_dominant` / straddler-refill lane is ratio arithmetic
  over ABS boundaries.
- **Deadline and timing logic.** `verify-alma-opportunities.mjs`, `CLOSED_STATUSES`, "closes in 60
  days", `deadlineOnOrBefore`. JEV "reads dates as text, not as ordered quantities".
- **`scripts/lib/grant-evidence-gate.mjs`.** Deterministic, unit-tested, requires a URL plus an ≥8-char
  quote per claim across seven evidence types, with an aggregator-host blocklist. It works. (A
  citation-check Noul could verify the quote actually appears at the URL — a complement, not a
  replacement.)
- **`refresh-entity-xref.mjs`.** Identifier joins. Two records sharing an ABN are the same entity by
  construction. No judgement involved.
- **`person-cluster.mjs`.** See above.
- **Migration parity, `/config-truth`, `/surface-sweep`, the exposure checks.** Mechanical.
- **`validateSql` in `/api/ask`.** A security boundary. Never gate one on a probability.

---

## Comparison

| Candidate | Usefulness | Setup effort | Testability | Frequency | Cost of a wrong answer |
|---|---|---|---|---|---|
| Grant eligibility (Choice ×5) | **High** — closes a 7-of-3,088 gap | **Medium** — pages must be re-fetched; cache has verdicts only | **High** — 337 ids to replay, page is the authority | manual now; would be nightly | Medium, reversible |
| Opportunity type (Choice ×6) | Medium-high | Low — rubric is already criteria-shaped | **High** — hundreds of stored prior verdicts | 9 runs/30d × 300 rows | Medium |
| SE classification (Noul) | High (trust) | Low | Medium — no labels, thin inputs | 12 runs/30d | **High** — feeds a buyer-facing "verified" tier |
| RAG filter + citation check | High for `/api/chat` | Medium — provenance bugs first | **Low** — zero tests, no golden questions | `[?]` — no usage logging | Medium |
| Keyword scorers → Score | Low-medium (already works) | High — rewrite rubrics, retune | **Highest** — 20 labelled cases + runner | goods scheduled; project manual | Medium |
| Entity pair adjudication (Score) | Medium | Medium — needs a pair harness | Medium — ORIC verdict history | one-off campaigns | **High** — bad merges unwind painfully |
| Community-controlled (Noul) | Medium | Low | Low — no labels | 3 runs/30d | **High** — one-way, never cleared |

**Cost is a rounding error at our volumes.** 337 eligibility rows × ~2,000 tokens ≈ 674k input tokens
≈ **$0.03** `[I]`. A full re-run of every classifier in the repo is cents. **Latency and accuracy on
our data: `[?]`.** TypeSafe publish no accuracy benchmarks, and their rate limits change without
notice.

---

## Recommendation: what to test first

**Grant eligibility, replayed over `data/grant-eligibility-cache.jsonl`.**

The questions are factual, "not stated" is already a first-class answer the UI renders, the gap it
closes is concrete and large, and disagreements are cheap to adjudicate — open the URL, read a
paragraph. The page text must be re-fetched (the cache stores verdicts only), which is a one-off cost
the pilot's stage 1 pays once.

**One caveat, stated plainly:** those 337 rows are *machine*-generated verdicts, not human-reviewed.
The only genuinely human-labelled set in this repo is the 20-case
`goods-funding-fit-benchmark.json`. So run it as two steps:

1. **Zero-setup sanity check.** Put JEV's Score primitive behind the existing
   `scripts/evaluate-project-funding-fit.mjs` harness against the 20 labelled cases. Inside an hour it
   says whether JEV's judgement is in the right postcode at all, against labels we wrote ourselves.
2. **The real pilot.** Replay all 337 eligibility rows through five Nouls. Review the rows where JEV
   and the incumbent disagree, plus any where JEV lands between 0.15 and 0.85 — expected to be a few
   dozen. **That review is the golden set**, and it is reusable for every future change to this path.

### How to compare quality, latency and cost

- **Quality.** On the disagreement set only, adjudicate **blind** — do not show which system produced
  which answer. Report per-field agreement, and separately the **abstention rate**: how often each
  system correctly says "not stated" when the page genuinely does not say. Then bucket JEV's
  probabilities into five bands and plot observed correctness against them. **If 0.9 does not mean
  roughly 90% correct on our data, the calibration claim does not hold here and the entire
  confidence-routing design dies with it.** That plot is the decision, not the headline accuracy.
- **Latency.** Wall-clock per row for both paths, same machine, four concurrent. Report **p95, not the
  mean** — the incumbent's six-provider failover makes its tail far worse than its median, and the
  tail is what makes a nightly job overrun.
- **Cost.** JEV returns `usage.input_tokens` on every response. The incumbent's cost is whichever
  provider answered, which the run log records. Expect JEV to be roughly two orders of magnitude
  cheaper and for that to be **irrelevant** at this volume. The reason to switch is the removed
  JSON-parsing failure mode and the calibrated abstention, not the price.

### Fix first, regardless

1. `parse-foundation-grants.mjs:79-95` — the `mental health → child-protection` mapping.
2. `compute-se-verification-tiers.mjs:63` — an LLM guess counted as `verified`.
3. `mv_search_index`'s missing external source URL, and `knowledge_chunks.provenance` never being
   written, if the RAG work is ever picked up.

---

## What could not be inspected

- `agent_schedules` — the real cadence of every registered agent. Measured `agent_runs` instead.
- `thoughts/shared/handoffs/` — ~45 topic directories not opened; review batches may be recorded there.
- Anything behind Vercel SSO, and production env values.
- **JEV's actual behaviour on our data.** Nothing has been sent to it. Every accuracy, latency and
  calibration claim in this document is `[D]` from their docs or `[?]`.

## Note on the three local clones `[V]`

`~/Code/grantscope`, `~/Code/grantscope-atlas` and `~/Code/grantscope-scraping` are three full clones
of this repo, same root commit `b9e4f168`, left by old sessions that cloned instead of branching.
`grantscope-atlas` (detached at `87b90b1e`, 2026-08-09) has all 9 of its changed files present on
current `main` — landed, deletable. **`grantscope-scraping` (branch `claude/scraping-funding-orgs-TeFjK`,
2026-06-07) holds 8 files that are NOT on main**: a community-directory ingest lane
(`scrape-community-directories.mjs`, `ingest-infoxchange-services.mjs`,
`ingest-open-community-directories.mjs`, `bridge-community-directories.mjs`,
`enrich-entity-contacts-v2.mjs`), migration `20260606161000_community_directory_upsert_index.sql`, and
two research docs. Do not delete it until that work is landed or abandoned. Test landing by file
presence, not commit ancestry — squash merges break SHA ancestry.
