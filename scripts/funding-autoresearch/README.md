# Funding Autoresearch

Use this harness to improve CivicGraph's funding-network intelligence against fixed scenarios and fixed evaluation rules.

## Commands

```bash
node scripts/funding-autoresearch/build-benchmark-set.mjs
node scripts/funding-autoresearch/evaluate.mjs --save --verbose
node scripts/funding-autoresearch/autoresearch.mjs --budget=30 --iterations=6 --dry-run
```

## What It Covers

- grant discovery
- foundation discovery
- charity delivery matching
- social-enterprise delivery matching
- need-gap place search

## Design

- `program.md` is the research agenda and guardrail set
- `build-benchmark-set.mjs` builds 50 real scenarios from live GrantScope data
- `evaluate.mjs` is fixed and should not be changed by the loop
- `strategy.mjs` is the mutable ranking logic
- `autoresearch.mjs` improves `strategy.mjs` using the fixed evaluator
