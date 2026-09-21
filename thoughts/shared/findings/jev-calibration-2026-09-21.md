# JEV measured against a label we did not write

**Date:** 2026-09-21
**Script:** `scripts/jev-purpose-sample.mjs` · **Data:** `data/jev-purpose/results.jsonl`

Every previous JEV number in this repo compared two systems that could both be wrong. The
pilot's 88-100% figures were *agreement* with an incumbent chat model, and the adjudication
sheet that would have turned them into accuracy is still ungraded.

`grantconnect_awards` closes that gap without anyone grading anything. 291,264 rows carry both
a free-text `purpose` and a `category` assigned by the granting agency: 119 values, 100% filled,
written by the Commonwealth before the question existed.

## Result

155 rows, 8 categories, deduplicated by purpose text.

| | |
|---|---|
| abstained (`not_stated`) | 23 (15%) — counted separately, not as error |
| scored | 132 |
| **correct** | **120 (91% of scored)** |

### Calibration, which is the number everything else depended on

| stated confidence | n | actually correct |
|---|---|---|
| **0.90 – 1.00** | **113** | **95%** |
| 0.80 – 0.90 | 7 | 57% |
| 0.70 – 0.80 | 5 | 80% |
| 0.50 – 0.70 | 5 | 80% |
| 0.00 – 0.50 | 2 | 50% |

**At >= 0.90, JEV is 95% correct on our data** — if anything slightly conservative. That band
carries 86% of the scored answers, so the common case is the calibrated one.

**Below 0.90 nothing here is conclusive.** n of 7, 5, 5 and 2 cannot support a threshold. The
0.80-0.90 band reading 57% is four errors in seven rows, which is noise, not a measurement. Do
not quote it.

So: the >= 0.85-0.90 auto-act thresholds proposed in
`jev-workspace-audit-2026-09-21.md` are defensible at the top of the range and **unevidenced in
the middle band**. Anything routing on 0.7 or 0.8 still needs its own measurement.

## Per category

| agency label | n | correct | abstained |
|---|---|---|---|
| aged_care | 11 | 100% | 18% |
| child_care | 17 | 100% | 18% |
| trade_tourism | 11 | 100% | 0% |
| medical_research | 33 | 100% | 0% |
| legal_services | 13 | 100% | 8% |
| indigenous_arts | 4 | 100% | 50% |
| industry_innovation | 33 | 90% | 39% |
| **disaster_relief** | **33** | **68%** | 6% |

Abstention tracks difficulty rather than being spread evenly: 39% on industry innovation and 50%
on Indigenous arts, 0% on medical research and trade. That is the behaviour the three-option
design was for.

## The misses are mostly not errors, and that is a finding about the data

12 misses. **8 are one pattern: `disaster_relief -> trade_tourism`.**

> "Respond to the collapse of international airfreight capacity in and out of Australia as a
> result of COVID-19..." — agency label **Disaster Relief**, JEV **trade_tourism** at 0.86.

> "Improving Mental Health Outcomes and Reducing Suicide across the Emergency Services Sector
> under Post-traumatic Stress Disorder" — agency label **Disaster Relief**, JEV
> **medical_research** at 0.71.

Read on their own terms, JEV's answers are the better description of the work. The agency label
records **which programme paid**, not **what the work is**: a COVID-era trade measure is Disaster
Relief because a disaster programme funded it.

Two consequences:

1. **91% is a floor, not a ceiling.** The residual disagreement is largely definitional.
2. **`grantconnect_awards.category` is a programme label, not a topic label.** Anything using it
   as a subject classifier — a topic facet, a sector rollup, a "what does this fund" chart — is
   mislabelling by construction, and the error is concentrated in crisis-era programmes. This is
   worth checking wherever that column is read.

## Limits

- **n=155**, and unevenly spread: indigenous_arts got 4 rows because deduplication by purpose
  text left few unique ones. Per-category figures on n<15 are indicative only.
- One taxonomy, eight of 119 categories, chosen as the ones a reader could tell apart without
  knowing the scheme. A 119-option question would measure the question, not the model.
- Grant purposes are unusually clean prose. Nothing here transfers to `properties`-style API
  exhaust or to a one-line `name` field without measuring again.
- Cost was not separately metered this run; the pilot's $0.078/1,000 stands as the estimate.

## What this does not settle

The ungraded `data/jev-pilot/adjudication-sheet-choice.csv` still measures a different thing —
eligibility extraction from scraped pages, where no independent label exists. This result does
not substitute for it.

## Three API facts, each learned by a failed call

- `questions` is an **object keyed by question id**, not an array. An array returns 422
  `"Input should be a valid dictionary"`.
- Each question is `{ type, instructions, criteria: { answer: description } }`.
- The model is **`jev-latest`**. `systemone-v1` returns 400 `"Unknown model"`.

All three failed loudly with nothing written, which is the right behaviour: 116 then 23 calls
failed and produced no results file rather than inventing rows from a malformed request.
