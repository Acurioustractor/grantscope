# Notes on a TypeSafe-centric coding agent, from one day of evidence

**Date:** 2026-09-21
**In response to:** the "Why yet another agent?" design doc
**Evidence base:** a single grantscope session, 2026-09-21, which produced eight confident wrong
results and a measured calibration figure. Nothing here is hypothetical; every failure below has a
commit.

---

## The short version

The doc treats **efficiency** as the bottleneck: routing cost, KV cache, context compression,
cheaper subagents. In a full day of hard agent work, **not one thing that went wrong was an
efficiency problem.** Eight things went wrong, all of them the same shape: a check ran, passed, and
did not test the claim being made.

Cheaper routing would have produced those eight results faster.

The KV-cache question in the doc is a good one. It has a sibling worth asking beside it:

> **How would you design an agent if the model could not be trusted to know when it was wrong?**

That constraint is the one that bit, every time, all day.

---

## The evidence: eight confident wrong results in one session

| # | What was claimed | Why it was wrong | How it was caught |
|---|---|---|---|
| 1 | "177 tables censused" → reported 43 | PostgREST's 1000-row cap truncated the query. No error. | Noticing 43 ≠ 724 known tables |
| 2 | `remoteness`, `seifa`, `state`, `lga_*` offered as classification targets | They are derived from `postcode_geo` by a join. A model would fabricate what SQL already knows. | Reading the output list |
| 3 | The catalogue's headline omitted `gs_entities.sector` | A 60-option "is this an enum" cap silently dropped the single largest gap in the database (182 values, 70% null) | Noticing the biggest thing was missing |
| 4 | `acnc_ais.association_numbers.nsw` is "a 6-value enum" | They are state **registration numbers**. The threshold was `distinct <= 25` tested against a **50-row sample**, where distinct can never exceed 50, so it was always true. | Reading the flagged rows |
| 5 | `gs_relationships.properties` holds `financial_year`, `receipt_type`, `return_type` | Unordered `LIMIT` returned the first pages of the heap: 200 rows of one ingest out of 3M. Under `TABLESAMPLE` the same column returns entirely different keys. | Reading the output against a caveat I had already written |
| 6 | "Index created and used — Index Scan confirmed" | I tested it by writing the index's own predicate back at it. Through the view that consumers use, it was a **Parallel Seq Scan over 3.0M rows**. **This one reached production.** | A query timing out when I finally used it for real |
| 7 | "No deterministic separator exists in this table" | `serves_youth_justice` was sitting there. I had checked one column and stopped. | Re-reading the schema for an unrelated reason |
| 8 | "248 contradicting rows" | The guard counted `IS NOT TRUE`, folding "never assessed" (154 NULLs) into "assessed as false". Real figure: **94**. The guard written to catch this class of error contained it. | Splitting a query for a different purpose |

### Three things this table says

**None of the eight was a model capability failure.** A smarter model does not fix any of them. A
cheaper or faster model makes none of them worse. They are all the same defect: *the check I ran
did not test the claim I made.*

**Green checks caught zero of eight.** Every one was caught by a human-ish act of looking at output
and noticing it disagreed with something known. That is not a scalable detection mechanism, and it
is the actual gap.

**Number 6 is the one to design around.** It had a passing verification step, a green CI run, and a
migration applied to production. It was wrong because the test restated the implementation instead
of exercising the consumer's path. No amount of context management prevents that.

---

## Where the doc's framing holds

**Thing 3 (compaction) and query-aware compression.** Correct, and the reason is visible above:
compression without knowing the query is how items 1, 3 and 5 happened. Each was a silent drop that
left output looking complete. Query-aware beats query-blind for exactly that reason.

**Appendix 2 (background, read-only tasks) is the strongest section.** It is also the robust version
of the routing argument. The Thing 1 maths depends entirely on vibed constants (X=0.65, Y=0.12,
Z=0.23 came from ChatGPT), and the 1.5x conclusion is downstream of them. But the narrower claim
survives any constants: **routing costs you when context has to transfer, so route at boundaries
where it does not.** Read-only background tasks are precisely those boundaries. Build from there,
not from the arithmetic.

**Thing 2 (tool calling), with an amendment.** I made **139 failed API calls** in one session
learning a contract by trial: `questions` had to be an object not an array (116 failures), then the
model name was wrong (23 failures). A better schema would have helped a little. What actually saved
the session is that **every failure was loud and wrote nothing** — no results file was created,
nothing was inferred from a malformed request. Design principle the doc does not state outright:

> The cost of a wrong call should be zero, and it must be impossible to mistake for success.

---

## Three pushbacks

### 1. "Meta-attention" is a silent-drop machine

Scoring each context chunk and dropping the low scorers has the same shape as items 1, 3 and 5: a
threshold quietly discarding evidence, leaving output that looks whole. A dropped chunk is
unrecoverable within the turn and the agent cannot notice an absence.

If it gets built, it has to **report its own coverage**, the way the scripts in this session
eventually did: "40% of context dropped, here is the distribution". The check-loop script now
refuses to be read at all below 40% confident coverage, printing `UNDERPOWERED` instead of a
ranked table, because an 18%-coverage result next to a tidy table reads as a finding.

The general rule, learned by breaking it repeatedly: **a filter must report what it removed, or it
will be mistaken for a measurement.**

### 2. The subagent problem is trust, not state

Three subagents ran today. They compressed roughly 460K tokens of reading into ~15K of report,
which worked well, and the doc's state question (what to pass in, what to merge back) is real
plumbing.

But their reports presented **code-reads in the same register as measurements**. I had to caveat
every one by hand, and one inherited claim was wrong. Figuring out what context to pass is
solvable. Knowing which parts of a returned report are *verified* is the thing that bit.

This is a concrete TypeSafe-shaped job, and it maps onto a rule that already exists in this repo
(`~/.claude/rules/verification.md`): every claim is **verified** (source queried), **inferred**
(derived, not confirmed) or **unverified** (taken on faith). A cheap typed classifier over each
claim in a subagent report, with an explicit "cannot tell", would do it.

### 3. Efficiency work is worth nothing on a wrong answer

Every idea in the doc makes the agent cheaper or faster per unit of output. None makes the output
more likely to be right. On this evidence the ratio is backwards: eight correctness failures,
zero efficiency failures, in one day.

---

## What I would build first: a claim ledger

Not routing. Not context filtering. The smallest thing that addresses the eight.

**Every assertion the agent makes is tagged at the moment it is made: verified / inferred /
unverified. Promotion to "verified" requires a recorded check that actually ran.**

Why this and not a rule: **`verification.md` already says exactly this, it was in my context all
day, and I violated it eight times.** The repo's own `skills-routing.md` records the same lesson in
its own words:

> "Rules did not stop it. A gate does."

That generalises well past skills. A rule in context is a suggestion to a system that cannot tell
when it is wrong. The whole design question is which rules become mechanisms.

Concretely, the cheapest version is a wrapper that refuses to emit the word "verified" unless a
check is on record for that claim, and which distinguishes:

- a check that **passed**
- a check that **could not run** (missing credentials, empty sample, truncated result)
- a check that **ran but does not test the claim** — item 6, the hardest and most valuable case

Item 6 is the one worth real design effort, because it is the one that shipped.

---

## The measured numbers, for anyone costing this

From the same session, against 291,264 agency-assigned labels that nobody here had to grade:

| | |
|---|---|
| typed classifier, correct at >= 0.90 confidence | **95%** |
| share of answers landing in that band | **86%** |
| below 0.90 | **not established** — bands of n=7, 5, 5 cannot support a threshold |
| abstention rate | 15%, and it **tracked difficulty** (39% on one category, 0% on another) |
| cost | ~$0.042/M input, output free. The whole database's free text is ~392M tokens, about **$16 to read once** |

The abstention behaviour is the part that matters for agent design. A judge that returns "cannot
tell" on the hard 15% and is 95% right on the rest is usable as a gate. A judge that always answers
is not.

---

## What this evidence does not support

- **One session, one person, one codebase.** The eight failures are real and the pattern is
  consistent, but n=1 for the session.
- **No cost or latency data for agent operation.** No metering exists in any repo I looked at
  today, across ten repos. Every efficiency claim in the doc, and every counter-claim here, is
  currently unmeasured on real traffic.
- **The calibration figure is for one task shape** — short, clean prose against a closed taxonomy.
  It does not transfer to API exhaust or one-line name fields without measuring again. Measured on
  a thinner column the same day, confident coverage fell from 86% to **18%**, which made that audit
  unusable.
- **I did not test any of the doc's proposals.** This is evidence about where agents fail, offered
  against a design that has not been built.
