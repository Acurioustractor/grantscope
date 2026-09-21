# alma_interventions contains a generic charity corpus

**Date:** 2026-09-21
**Found by:** `scripts/jev-check-loop.mjs --audit alma_intervention_validity`
**Status:** measured, nothing changed

## What

`alma_interventions` is read by at least six published surfaces, including
`/closing-the-gap`, `/evidence-packs`, the board report and the entity pages. Every row in it
asserts that it is a youth justice, early intervention or community support programme.

A large share are not. Confidently flagged as belonging to an unrelated domain, verbatim:

| | |
|---|---|
| Heart Week | "Australia's national heart health awareness week... to educate the pub..." |
| 12-Step Action Plan | "A guide outlining 12 changes individuals can make to reduce their personal emissions" |
| Transport Projects | "reducing transport emissions, including promoting electric vehicles" |
| Papua New Guinea Snakebite Partnership | "addressing snakebite issues in Papua New Guinea" |
| Family Poultry Farming | "trains villagers to build chicken coops and improve poultry farming" |
| Women's Sewing Skills Training | "Skills training for women in rural villages" |
| MMMA Awards | "Annual awards ceremony celebrating Australian music for children" |

Their `operating_organization` values name the source: **Melbourne Full Gospel Church Inc**,
**Touching Hearts Animal Rescue Inc**, **The Trustee For The Australian Gas Industry Trust**,
**Celestial Church of Christ**, **Nutrition Biomed Research Institute Ltd**. This is a generic
ACNC-style charity-programme corpus that has been loaded into a youth justice table.

## How much — stated carefully

275 rows sampled, after excluding rows a regex already catches (see below).

| | |
|---|---|
| sampled | 275 |
| scored (not abstained) | 265 |
| **confident at >= 0.90** | **112 (42% coverage)** |
| confidently off-domain | **53** |
| as a share of confident answers | **47%** |
| as a share of the whole sample | **19%** |

**Quote the 19%, not the 47%.** 47% is the rate among rows the classifier could judge
confidently, and coverage was 42% — only just above the 40% line at which this same script
declares an audit underpowered. The honest floor is: **at least 53 of 275 sampled rows are
confidently off-domain.** The true rate is somewhere at or above 19% and is not established
here.

## A second, separate problem: scraped page furniture

Measured deterministically across all 2,154 rows, no model involved:

| signal | rows |
|---|---|
| `name` is a URL | 18 |
| markdown link syntax in description | 115 |
| page chrome ("Print this page", "social media sharing") | 35 |
| markdown heading at the start | 31 |
| **any of the above** | **131 (6.1%)** |

Example: a row whose `name` is `https://www.sa.gov.au/topics/care-and-su...` and whose
description begins `Ancestry\n--------\n[Aboriginal Affairs and Reconciliation](...)`. Another
reading `# Youth justice\n\nPrint this pageClick to open the social media sharing optionsShare`.
Both are typed `Prevention`.

These were **excluded from the model run**. A regex settles them for nothing, and including
them would have inflated the finding with rows that were never in question. They are a separate
cleanup, and a cheaper one.

So roughly **6% is scraped page furniture** and a further **19%+ of what remains is a real
programme in the wrong domain**.

## Why this needed a classifier

There is no deterministic separator. `operating_organization` is present on 1,558 of 2,154 rows
and does not split curated from dumped; both groups carry the same `type` values, the same
`evidence_level` coverage, and `source_documents` is set on every row. Nothing in the schema
distinguishes "Heart Week" from a real diversion programme except the meaning of the text.

## What was NOT the question

The obvious audit here was `type` — 10 values, 100% filled. That would have measured the wrong
thing. Six random rows contained two scraped web pages and an Air Force commemoration
programme, all carrying a confident-looking `type`. Asking "which of ten intervention types is
this" would have returned a confident answer to a question that should never have been asked.

The claim worth auditing was the one the table makes by existing: that every row is an
intervention.

## What this does not say

- It does not say which rows to delete. A confident flag is a suspect row, not a verdict, and
  the classifier is ~95% correct at this threshold, so roughly 1 in 20 flags is wrong.
- It does not establish the total contamination rate, for the coverage reason above.
- It does not identify the ingest. The rows arrived from somewhere; no writer in this repo was
  traced during this work.

## Suggested next steps, in order of cost

1. **Find the ingest.** Until it is found, anything cleaned comes back.
2. **Clean the 131 regex-detectable artefact rows.** Deterministic, free, no judgement needed.
3. **Decide the scope question.** ALMA is the Australian Living Map of Alternatives. If its scope
   is genuinely broader than youth justice, then the six published surfaces reading it need a
   filter, not the table. If its scope is youth justice, the rows do not belong.
4. **Only then** consider a flag column populated from a full run at >= 0.90, reviewed before it
   gates anything public.
