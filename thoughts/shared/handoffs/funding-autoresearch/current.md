# Funding Autoresearch — Current State

## What This Is

CivicGraph now has a funding-specific autoresearch harness in:

- `/Users/benknight/Code/grantscope/scripts/funding-autoresearch`

It is modeled on the `autoresearch` pattern, but adapted for funding intelligence rather than model training:

- fixed live-data benchmark scenarios
- fixed evaluator with justice, actionability, and relationship metrics
- mutable ranking strategy
- LLM-driven improvement loop that keeps or reverts changes based on score

## Canonical Commands

Build benchmark set:

```bash
cd /Users/benknight/Code/grantscope
node scripts/funding-autoresearch/build-benchmark-set.mjs
```

Run baseline evaluation:

```bash
cd /Users/benknight/Code/grantscope
node scripts/funding-autoresearch/evaluate.mjs --save --verbose
```

Run the improvement loop without git commits:

```bash
cd /Users/benknight/Code/grantscope
node scripts/funding-autoresearch/autoresearch.mjs --budget=10 --iterations=2 --dry-run
```

## Current Benchmark

- Benchmark file: `/Users/benknight/Code/grantscope/scripts/funding-autoresearch/data/funding-benchmark.json`
- Scenarios: `50`
- Families:
  - `grant_discovery`
  - `foundation_discovery`
  - `charity_delivery_match`
  - `social_enterprise_delivery_match`
  - `need_gap_search`
- Data sources:
  - `grant_opportunities`
  - `foundations`
  - `v_charity_explorer`
  - `social_enterprises`
  - `mv_funding_by_postcode`
  - `postcode_geo`
  - `seifa_2021`
  - `org_profiles`

## Latest Baseline

Latest saved result:

- `/Users/benknight/Code/grantscope/scripts/funding-autoresearch/data/results/latest.json`

Current baseline metrics after adding philanthropy plausibility and delivery-readiness signals:

- `precision@10`: `88.6%`
- `recall@10`: `62.6%`
- `mean_relevance`: `95.4%`
- `ndcg@10`: `99.9%`
- `justice_exposure`: `93.6%`
- `actability`: `67.3%`
- `relationship_utility`: `83.9%`
- `overall_score`: `86.3%`

Interpretation:

- Precision is no longer artificially perfect, which is healthier and more honest.
- The stronger gains came from actability and relationship utility, which means the system is getting better at surfacing funders and delivery organisations a human could actually work with.
- The real weak spots are now concentrated in regional, disability, remote, and social-enterprise delivery matching rather than generic keyword search.

## Weakest Scenarios Right Now

These are the clearest areas to improve first:

1. `foundation_discovery:regional-regenerative`
2. `social_enterprise_delivery_match:regional-regenerative`
3. `grant_discovery:regional-regenerative`
4. `charity_delivery_match:foundation-before-intro-campaign`
5. `social_enterprise_delivery_match:housing-homelessness-remote`
6. `social_enterprise_delivery_match:remote-youth-justice`
7. `social_enterprise_delivery_match:csr-social-enterprise-employment`
8. `foundation_discovery:regional-regenerative`
9. `charity_delivery_match:disability-services-qld`
10. `foundation_discovery:first-nations-leadership-women`

## What The Baseline Is Telling Us

The current funding graph is still strongest at:

- obvious topical alignment
- clean state matches
- opportunities/foundations with strong public metadata

It is still weak at:

- need-first discovery
- regional/regenerative matching
- surfacing community-controlled and Indigenous delivery options consistently
- disability and youth delivery matching when metadata is thin
- relationship-first philanthropy matching
- distinguishing “plausible to approach” from “thematically adjacent”

## Immediate Research Agenda

1. Add more delivery-side signals for charities and social enterprises:
   - beneficiary specificity
   - delivery proof
   - community control
   - regional footprint
2. Tighten disability, youth, and homelessness matching where the current metadata is sparse.
3. Penalize generic national incumbents when a scenario is explicitly place-based or community-led.
4. Add explicit need-gap linkage between postcode underfunding and organisation/funder ranking.
5. Feed the stronger funder-plausibility and delivery-readiness signals into the product surfaces, not just the benchmark.

## Provider Notes

- Anthropic is currently configured but returned a billing/credit error during live testing.
- The autoresearch loop now falls back to OpenAI automatically when Anthropic is unavailable.
- First dry-run improvement iteration completed successfully and reverted a non-improving strategy change, which is the expected behavior.

## Next Builder Protocol

Do not treat this as “done” because the scaffold exists.

The next serious work should be:

1. Tighten the benchmark further so precision is not artificially saturated.
2. Run targeted strategy experiments against the weakest scenario families.
3. Feed successful ranking ideas back into the grants/foundations/funding-workspace product surfaces.
4. Make need-first and relationship-first ranking first-class features, not just benchmark ideas.
