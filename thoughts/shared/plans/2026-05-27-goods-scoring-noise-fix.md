---
title: Goods GrantScope scoring-noise fix
status: proposed
date: 2026-05-27
repo: grantscope
related:
  - act-infra thoughts/shared/handoffs/goods-grants-sweep-2026-05-27.md (§5)
  - act-infra memory goods-foundation-pipeline
---

# Goods GrantScope scoring-noise fix

## Problem (verified against live DB `tednluwflfhxyucgwigh`, 2026-05-27)

Of 195 rows at `goods_relevance_score >= 60`, **94 are `arc-grants` + 45 are `qld-arts-data` = 71% noise.** 315 rows sit at ≥50 (the `ACT-GD` tag threshold), so the noise is auto-tagging Goods onto grants it cannot apply to.

## Diagnosis correction (the sweep §5 hypothesis was partly wrong)

The grants-sweep §5 listed a **"SEDI↔sediment substring bug."** I verified against the code and DB — **it does not exist**:

- `scripts/lib/goods-relevance.mjs` has **no `sedi` keyword** and no substring matcher for it.
- The actual sediment grants score **low** (`Shallow water carbonate sediment dissolu…` = 21, `Sedimentary basins…` = 14, others 0). They are not the noise.
- The 94 high-scoring ARC rows are **real First Nations research projects** ("Settlement agreements between First Peoples…", "Policy for self-determination: ATSIC") scoring 100 on legitimate Tier-1 Indigenous keywords + big dollars.

So the real problem is **structural eligibility**, not a substring false-match: a Pty Ltd social enterprise cannot apply to ARC university research, no matter how Indigenous-themed. The fix is source/provider exclusion, not regex surgery. SEDI scored 6 simply because its row lacked Goods keywords — the fix there is to *add* a word-boundary SEDI acronym signal (which, as a bonus, will never match "sediment").

Eligibility booleans are too sparse to gate on: `accepts_pty_ltd` populated on only 1,746/24,977 rows (7%); `accepts_charity` 418 (2%). A "require accepts_pty_ltd=true" gate would zero almost everything. So the gate keys on **source + provider**, not the booleans.

## Fix (in `grantscope`, 2 code files + 1 test + rescore)

### 1. `scripts/lib/goods-relevance.mjs` — add source/provider-aware disqualifiers
- New early-return hard-zero when:
  - `source === 'arc-grants'` (94 rows; ARC = university research, structurally ineligible)
  - `source === 'qld-arts-data'` (45 rows; arts dataset — Goods is not an arts producer; §2 already excluded arts)
  - `provider` matches `/\buniversit(y|ies)\b/i` (belt-and-suspenders for research grants from other sources — **verified zero non-arc rows at ≥50 have a university provider**, so no legit loss today)
- New **positive** SEDI recognition (fixes SEDI scoring 6, and is the honest reading of the §5 "SEDI" item):
  - word-boundary `\bsedi\b` acronym match → Tier-1 strength (will not match "sediment")
  - `social enterprise development initiative` phrase + DSS/IIA provider → capability signal
- New forward-looking up-weight: `discovery_method ∈ {indigenous-finance, procurement}` → additive boost so capital/procurement rows (task 2/3) aren't squashed for not reading like a grant. (No such rows exist yet — this is a hook.)
- Function signature gains `source` + `discovery_method` (provider already passed).

### 2. `scripts/score-goods-relevance.mjs` — pass new fields + manual-score guard
- `pickColumns` + `fetchBatch` select: add `source`, `discovery_method`.
- **Manual-score guard** (mirrors act-infra auto-tagger guard): when applying scores, **skip rows where `source ILIKE 'manual%'`** — protects 19 curated rows incl. SEDI First Nations (88). Without this, `--rescore-all` clobbers them.
- **SEDI `dss` row**: source is `dss` not `manual`, so the manual guard won't save its curated 82 — but the new positive SEDI signal (#1) makes it score high on its own merits, surviving rescore. (Verify post-rescore; if it lands low, re-apply the §1c enrichment.)

### 3. `scripts/lib/goods-relevance.test.mjs` — new pure-function test
Lock the behaviour so it can't silently regress:
- arc-grants source → 0
- qld-arts-data source → 0
- university provider → 0
- "Sediment…" name → low (no SEDI boost)
- "SEDI Capability Building Grant" / DSS-IIA provider → high (≥ tag threshold)
- a real Indigenous-housing grant → high (unchanged)

### 4. Re-score + verify
- `cd grantscope && node --env-file=.env scripts/score-goods-relevance.mjs --rescore-all`
- Verify (SQL against live DB): **zero** arc-grants/qld-arts-data at ≥60; SEDI Capability + SEDI First Nations land high; the ≥50 survivors are Goods-shaped funders (Lotterywest, foundation_program, NSW Aboriginal Affairs/Housing, grantconnect). Spot-check top-20.

## NOT in this task (separate sessions, per handoff)
- Ingest the ~17 new source-vector programs (IBA/ILSC/NIAA/ABA/Westpac/Lowitja/Supply Nation).
- Build the capital + procurement pipelines.

## Decision needed from Ben
**Hard-zero `arc-grants` and `qld-arts-data` by source** (vs. down-weighting them). Recommendation: hard-zero — both are structurally ineligible for Goods and the sweep §5 + §2 already concluded this. Down-weighting leaves them lingering in the ≥50 tag pool.

## Risk / reversibility
- The rescore is a bulk UPDATE of `goods_relevance_score`/`goods_relevance_signals`/`aligned_projects` on ~24k rows in the shared GrantScope DB. Reversible by re-running the scorer (deterministic pure function). No schema change.
- Manual guard prevents loss of curated rows. University gate verified non-destructive to current data.
