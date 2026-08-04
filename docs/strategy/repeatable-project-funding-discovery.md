# Repeatable project funding discovery

## Purpose

This workflow turns a project brief into a repeatable, evidence-gated funding search. It is designed to find both grants and repayable capital without promoting a result merely because its language sounds relevant.

GOODS is the first benchmark project. The same workflow can be reused by supplying a different project profile and benchmark fixture.

## Model

The workflow keeps four questions separate:

1. **Project relevance** — does the opportunity address the project's themes and a named funding block?
2. **Source evidence** — does an official page verify the round, timing, amount, applicant type and supported costs?
3. **Entity eligibility** — which legal entity can receive the instrument, and is there an ownership, geography or organisation-type block?
4. **Pursue timing** — can a decision or signed commitment plausibly be secured inside the project's deadline?

An opportunity reaches the shortlist only when it is on an official source, has no hard block, scores at least 40, and maps to at least one explicit funding block. A high thematic score cannot override a failed eligibility rule.

## Pipeline

The research runner performs these stages:

1. Load the project profile and its curated official-source monitors.
2. Scan `grant_opportunities` and `foundations` in GrantScope.
3. Run lane-specific Octen searches when `OCTEN_API_KEY` is configured.
4. Deduplicate and rank source URLs before extraction.
5. Extract page content directly, with configured provider fallbacks.
6. Classify the specific named program and validate every evidence quote against the extracted page.
7. Apply the project fit model and hard rules.
8. Separate open opportunities, relationship funders, finance providers, historical records and non-funding pages.
9. Build a funding-block coverage portfolio and a separate research queue.
10. Write Markdown and JSON reports; write observatory rows only when `--apply` is supplied.

Curated profile facts override ambiguous page-level inference for fields such as a specific stream's ownership gate, record type and known status. A live page that explicitly says a program is closed still overrides a seeded open status.

## Project profile contract

The GOODS profile is at `scripts/funding-profiles/goods-on-country.json`. A reusable profile defines:

- legal receiving entities and accepted instruments;
- funding blocks, amount ranges and supported-cost keywords;
- themes and delivery geographies;
- lane-specific search queries;
- already-engaged funders;
- hard exclusions and timing rules;
- curated official-source monitors and their critical conditions.

For GOODS, the funding blocks are production equipment, working capital, a measured 50-bed run, operating cover, and servicing/site scoping. The charity and company pathways are scored separately. A 50% or 51% Indigenous-ownership requirement is a hard block because neither current receiving entity meets it.

## Commands

Run the benchmark before changing scoring rules:

```bash
npm run funding-fit:goods:evaluate
node --test scripts/lib/project-funding-fit.test.mjs
```

Run a full report-only sweep:

```bash
npm run funding:research:goods -- \
  --source=all \
  --count-per-query=10 \
  --extract-limit=60 \
  --extractor=direct \
  --llm-provider=openai
```

Refresh only curated official-source monitors and write them to the observatory:

```bash
npm run funding:research:goods -- \
  --source=profile \
  --extract-limit=10 \
  --extractor=direct \
  --llm-provider=openai \
  --output-dir=outputs/funding-research/profile-apply \
  --apply
```

Do not use `--apply` for broad exploratory runs until the generated report has been reviewed. The default mode is report-only.

## GOODS benchmark result

As at 1 August 2026, the benchmark contains 20 labelled cases:

- 6 relevant positives and 14 negatives;
- precision: 100%;
- recall: 100%;
- false-positive rate: 0%;
- hard-block accuracy: 100%;
- operating-cover representation in the top five: yes.

These metrics validate the labelled fixture, not the completeness of the live funding market. Live discovery remains constrained by source availability, extraction quality and whether funders publish enough eligibility detail.

The full GOODS sweep considered 25,738 GrantScope opportunity rows, 5,880 foundation records, 180 Octen results and 11,931 unique URLs. Sixty priority pages were extracted/classified. Only Export Finance Australia's Small Business Export Loan mapped to a current GOODS funding block without a known hard block, and it still requires verification of the export purpose, trading history, turnover, profitability and commitment timing.

No current source-verified opportunity covered the measured production run, operating cover or servicing/site-scoping blocks. That absence is a research result and should remain visible rather than being filled with weak matches.

## Operating routine

For each new project:

1. Copy the GOODS profile and replace all project-specific facts.
2. Create a labelled benchmark with both strong matches and realistic false-positive traps.
3. Run the evaluator and tests until the thresholds pass.
4. Run a report-only broad sweep.
5. Review the shortlist, explicit blocks and research queue against official pages.
6. Add durable official monitors to the profile with critical conditions.
7. Run the profile-only apply command to update the observatory.
8. Re-run on a schedule and compare changed status, deadline and eligibility evidence.

Never copy secrets into profiles, reports or source control. `OCTEN_API_KEY` belongs only in `.env`; `.env.example` contains the blank configuration key.
