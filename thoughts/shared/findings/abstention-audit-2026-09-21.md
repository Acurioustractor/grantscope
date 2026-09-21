# Abstention audit — where the system lets a model answer instead of abstaining

**Date:** 2026-09-21 · **Method:** read-only. Every LLM call site in `scripts/`,
`apps/web/src` and `packages/` (39 files, 30 after removing embedding, benchmark and
smoke-test scripts), read for two things: does the prompt make "not stated" a real
answer, and does the consumer act on the abstention when it gets one.

The thesis being tested comes from the foundation-deadline bug: every significant
failure that day was *a model allowed to answer when it should have abstained*. The
fix is never a better model; it is making "I don't know" a first-class answer the
system can act on.

Three distinct failure shapes turned up, in descending order of what they cost.

---

## 1. Confidence asked for, then thrown away

The model is explicitly asked how sure it is. The answer is printed to the console and
never stored, never gated on. A 0.2 verdict writes exactly like a 0.95 one.

### `scripts/enrich-grant-eligibility.mjs` — worst of the three

The prompt is *good* (`if something is not stated, use null (do not guess)`) and asks
for `confidence: 0.0 to 1.0`. Line 189 logs it. The write at line 191 stores
`dgr_required`, `accepts_charity`, `accepts_pty_ltd`, `accepts_sole_trader`,
`accepts_unincorporated` and a timestamp — and no confidence.

These five flags decide whether ACT can apply to a grant at all. A low-confidence
`dgr_required: true` silently removes a grant from the desk, and nothing downstream can
tell it apart from a confident one. There is no column to put the confidence in.

### `scripts/ingest-report-outcomes.mjs`

Same shape. Prompt asks `"confidence": "high|medium|low"`. Line 226 logs it. The insert
at 243 does not carry it.

**Fix shape:** add a confidence column beside each enriched field group, write it, and
give consumers a floor. This is the JEV-shaped work — a typed Choice with a calibrated
score is exactly the primitive these two are hand-rolling badly.

---

## 2. A value written with no evidence and no provenance

### `scripts/scrape-grant-deadlines.mjs` — the foundation bug, on the main grants table

This is the same mechanism that put 22 invented deadlines into `grant_opportunities`
via foundations, except it writes to `grant_opportunities` directly and was never part
of that fix.

The prompt invites the inference outright:

> `"open" means currently accepting applications with a known **or implied** deadline`

and offers no evidence field. The writer (lines ~362-378) accepts any `YYYY-MM-DD` and
sets **both** `deadline` and `closes_at` when the existing value is null. Nothing
requires a quote from the page.

**Exposure is not measurable, and that is itself the finding.** The script stamps only
`last_verified_at`, which eight other writers also set, so there is no way to attribute
a deadline to it. 2,274 rows carry both a `last_verified_at` and a deadline; 302 of
those deadlines are in the future. How many this script wrote is unknown.

**Fix shape:** the `buildProgramRecord` quote-gate, ported. Plus a provenance stamp so
the question is answerable next time.

### `scripts/extract-foundation-relationships.mjs` — milder, same class

The prompt is careful: "Only include names explicitly present in the supplied text",
"If amount or year is not explicit, return null", and it requires `evidence_text` and
`source_url` per row. The writer then does `evidence_text: person.evidence_text || null`
(lines 1016, 1114, 1217) and inserts regardless. A person or grantee the model produced
with no evidence still lands in the person graph.

**Fix shape:** one line — refuse the row when the evidence is missing or too short.

---

## 3. A guess promoted to the same standing as a register

### `scripts/compute-se-verification-tiers.mjs:63` — buyer-facing

`'acnc-classified'` sits in the same `source_primary IN (...)` list as ORIC, SENVIC,
SECNA, WASEC, QSEC and SASEC — statutory registers — and therefore resolves to the
`verified` tier.

`acnc-classified` is the output of `classify-acnc-social-enterprises.mjs`: an LLM
reading a charity record and deciding whether it trades commercially. To that script's
credit it *does* gate on confidence (`--min-confidence`, default 0.7) — but the tier
computation neither knows nor checks that, and 0.7 is not a register.

**Measured:** 426 of 3,968 `verified` social enterprises (10.7%) carry
`source_primary = 'acnc-classified'`.

### Withdrawn the same day — verified before changing anything

**All 426 of them are in `acnc_charities` by ABN**, so they already qualify through
`STATUTORY_MATCH` regardless of `source_primary`. Dropping `'acnc-classified'` from
that list changes zero rows.

The tier also does not claim what this finding assumed. The script states *"Tier =
strength of external verification, NOT SE-ness"*. ACNC registration, ABN-matched, is
a statutory register. The LLM guessed whether the charity is a *social enterprise*,
which the tier does not measure, and the stored basis on all 426 rows reads
"ACNC-registered charity, ABN matched" — it never says "verified social enterprise".

**No change made.** The mechanism was real, the consequence was not.

**What is real, and small:** all 427 `acnc-classified` rows carry
`profile_confidence = 'low'`, a hardcoded literal rather than the model's 0.0-1.0
score. Same shape as §1 — conservative, so it does not over-claim, but a 0.95 and a
0.71 are stored identically.

---

## What came back clean

- `classify-acnc-social-enterprises.mjs` and `classify-directory-se-candidates.mjs`
  gate on confidence before inserting. The defect is downstream (§3), not in them.
- `discover-foundation-programs.mjs` / `sync-foundation-programs.mjs` — fixed earlier
  today; the quote-gate now covers deadline, eligibility, how-to-apply and contact.
- The `api/` routes (`ask`, `query`, `profile/enrich`, `answers/extract`) answer a user
  in the moment rather than writing durable facts, so an abstention failure there is
  visible to the person reading it. Lower priority, not zero.

## The pattern

Of the four defects, not one is a model being wrong. In §1 the model said how sure it
was and we discarded it. In §2 we never asked. In §3 the model's guess was correct
often enough — we just filed it next to the ABN register. **The abstention signal
mostly exists already. The system throws it away at the boundary.**
