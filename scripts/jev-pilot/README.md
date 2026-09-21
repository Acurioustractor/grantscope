# JEV pilot — grant eligibility extraction

Evaluates whether [JEV](https://docs.typesafe.ai/) (typesafe.ai's "System One" model: typed
Choice/Score/Noul answers with calibrated probabilities, no text generation) should replace the
chat-model call in `scripts/enrich-grant-eligibility.mjs`.

Full reasoning, and the audit of every other candidate in this repo:
`thoughts/shared/findings/jev-evaluation-2026-09-21.md`.

## Why this task

`apps/web/src/lib/act-grant-eligibility.ts:1-4` records that **7 of 3,088 live grants** have
`dgr_required` populated and 302 have `accepts_pty_ltd`. The ACT grants desk therefore answers
"unknown" for almost every grant. The incumbent enricher asks one of six chat providers for a JSON
object and regex-slices the JSON back out of free text; JEV returns typed answers, so that whole
parse-failure class disappears.

## Run it

```bash
node --env-file=.env scripts/jev-pilot/1-fetch-pages.mjs --limit=40      # build the corpus (slow, once)
node --env-file=.env scripts/jev-pilot/2-ask-jev.mjs --primitive=choice  # ask JEV (fast, cheap, resumable)
node scripts/jev-pilot/3-compare.mjs --primitive=choice                  # compare + emit the blind sheet
```

Stage 1 is the expensive one and exists because **`data/grant-eligibility-cache.jsonl` stores verdicts
only — no url, no page text.** A like-for-like replay has to re-fetch the pages, using the same browser
config and the same DOM extraction as the incumbent. Don't "improve" that extraction independently or
the comparison measures the scraper, not the model.

All three stages are append-only and resumable; rerunning skips ids already done.

## Use Choice, not Noul

Both question sets live in `2-ask-jev.mjs`. The Noul set is kept because the mistake is instructive.

Noul has two outcomes, so "the page is silent" has to be folded into `false`. Measured on 25 pages,
JEV then returned `dgr_required` at 0.03–0.12 on every one — confidently *false* — where the incumbent
returned `null`, *not stated*. Both defensible. Different questions. Worthless comparison.

Re-asked as a three-option Choice (`required` / `not_required` / `not_stated`), same pages, same model,
same 6,000 characters:

| field | Noul agreement | Choice agreement |
|---|---|---|
| `dgr_required` | 0% | **100%** |
| `accepts_charity` | 44% | **88%** |
| `accepts_pty_ltd` | 20% | **88%** |
| `accepts_sole_trader` | 12% | **96%** |
| `accepts_unincorporated` | 36% | **92%** |

Choice also returns a `confidence`; Noul does not. **When "not stated" is a real answer in the domain,
it has to be an option — not an inference from the middle of a probability range.** That lesson
applies to every other JEV candidate in this repo.

## Measured so far (25 grants, 50 calls, 2026-09-21)

- latency p50 **322ms**, p95 861ms at concurrency 4
- **$0.078 per 1,000 grants** ($0.042/M input tokens, output free)
- 0 failures, 0 parse errors — there is nothing to parse
- 9 disagreements with the incumbent out of 125 field-decisions (7.2%)

**Accuracy is still unmeasured.** Agreement is not accuracy — both systems can be wrong together.

## Grading the sheet

`3-compare.mjs` writes a **blind** sheet: each disagreement shows option A and option B with the
systems shuffled by a seeded coin, and the key goes to a separate file.

1. Open `data/jev-pilot/adjudication-sheet-choice.csv`. Leave the key closed.
2. For each row, open the url, read the eligibility section, put `A`, `B` or `neither` in the last column.
3. Then open `data/jev-pilot/adjudication-key-choice.csv` to see which system was which.

That graded sheet is the golden set. It is reusable for every future change to this path, and it is
the only thing that can answer the question that actually decides this: **does a JEV confidence of
0.9 mean roughly 90% correct on our data?** If it does not, the confidence-routing design fails here
and the thresholds in `2-ask-jev.mjs` are meaningless.

## If it wins

Replace the `callLLM` + `buildPrompt` pair in `scripts/enrich-grant-eligibility.mjs`, keep the
Playwright fetch and the `--apply` / NULL-is-honest-unknown semantics exactly as they are, and keep
the JSONL cache — but **add the page text and url to it**, so the next evaluation doesn't have to
re-scrape.
