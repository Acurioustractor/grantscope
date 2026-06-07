---
name: wedge
description: Buyer-wedge strategy guardrail — evaluate any proposed feature, data work, or product decision against the SE-registry strategy (free open registry for everyone; paid evidence + tender tools for buyers). Use when deciding whether to build something, when scoping a feature, when prioritising between work items, or when the user asks "should we build X" / "/wedge".
---

# Wedge Check

The strategy is decided and written down. Your job is to apply it, not re-litigate it.

## Procedure

1. Read `docs/strategy/buyer-wedge.md` (the source of truth — one sentence, five moves, tier definitions, need-first-search spec, the NOT-building list).
2. State the proposed work in one sentence.
3. Score it against these questions, in order:
   - **Does it serve the buyer wedge?** (evidence depth, tender tools, need-first search, lighthouse-buyer motion) → green light.
   - **Is it free supply-side magnet work?** (claim-your-profile, grant matching for SEs, registry openness) → fine, but it must stay light-touch and free; it is never the revenue product.
   - **Is it data WIDENING?** (new scrapers, more states, more rows) → PAUSED per move 5. Exception: already-scheduled agents keep running; fixing a broken scheduled agent is maintenance, not widening.
   - **Is it on the NOT-building list?** (grants portal for everyone, certification scheme, breadth scrapers) → stop, flag to user with the doc reference.
4. Give a verdict: **build now / build later / don't build**, with the one-line reason anchored to the doc.
5. If the user overrules, that's a strategy change: update `docs/strategy/buyer-wedge.md` FIRST (with date + reason), then build. Never let the doc and the work drift apart.

## Tie-breakers

- Evidence depth beats row count. Always.
- One real buyer using a tender-pack beats any amount of speculative feature work.
- "Would a procurement officer pay for this?" is the revenue question; "does this make the registry more trustworthy?" is the legitimacy question. Work should answer one of the two crisply.

## Current move status (update as moves complete)

- Move 1 (wedge picked): DONE 2026-06-08
- Move 2 (need-first search front door): **SHIPPED 2026-06-08** — `/suppliers` (SSR, GET form), `search_suppliers` RPC over `se_search_index` (capability text = AusTender contract titles, weight A; tier + evidence boosts). Index rebuilt by `build-se-search-index` agent
- Move 3 (lighthouse buyer): NIAA pack built + demo verified; waiting on Ben (named contact, PDF)
- Move 4 (confidence strata): data layer + tier badges live on /suppliers; v2 statutory cross-check active. Remaining: badges on profile pages
- Move 5 (widening paused): ACTIVE
