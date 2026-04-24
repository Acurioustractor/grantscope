# Bittensor Outreach Messages

**Date:** 2026-03-29
**Context:** GrantScope/CivicScope seeking consumer-level integration with Bittensor subnet services

---

## 1. Djinn (SN103) — Web Attestation Partnership

### Target contacts
- **Harry Crane** — Co-founder, Professor of Statistics at Rutgers. [@HarryDCrane on X](https://x.com/HarryDCrane). Also reachable via [Rutgers faculty page](https://statistics.rutgers.edu/people-pages/faculty/people/373-harry-crane) or his Substack.
- **Iosif Gershteyn** — Co-founder, CEO of ImmuVia. LinkedIn.
- **@djinn_gg** — Project X/Twitter account
- **Discord** — likely the fastest path for technical questions

### Channel recommendation
DM Harry Crane on X first (he's active), then follow up on Discord for technical details.

### Message (X DM to Harry Crane)

```
Hi Harry — I run GrantScope (civicgraph.app), an open intelligence platform
mapping $800M+ in Australian grant funding, 795K government contracts, and
312K political donations across 587K entities.

We're building "attested intelligence" — cryptographic proof that our source
data (AusTender procurement notices, foundation websites, ACNC filings)
showed specific content at specific times. Our customers (funders, procurement
teams, government) need evidence-grade data, not just scraped snapshots.

Djinn's web attestation is exactly the infrastructure layer we need. We don't
want to build MPC/TLSNotary ourselves — we want to use yours as a service.

Specific integration: we'd submit ~100-500 URLs/day for attestation, store
the proof bundles, and surface "cryptographically verified" badges on our
decision packs and due diligence reports. Our enterprise customers would
pay premium for attested vs unattested intelligence.

Questions:
1. Is the attestation product available for programmatic/API access today?
2. What's the cost per attestation at that volume?
3. Is there a developer sandbox or testnet we can build against?
4. Open to a 15-min call this week to explore?

This feels like a non-sports vertical that proves Djinn's general-purpose
thesis — accountable intelligence for procurement and funding decisions,
not just predictions.

Ben Knight
A Curious Tractor / GrantScope
benjamin@act.place
```

### Why this message works
- Leads with our data scale (587K entities, $800M grants) — shows we're real
- Positions us as a paying customer, not a competitor or feature request
- Names the exact volume (100-500/day) so they can price it
- Frames it as proof of their "beyond sports" thesis — they want this narrative
- Asks 4 specific questions — easy to respond to
- Short enough for a DM

---

## 2. Macrocosmos (SN13) — Data Enrichment Access

### Target contacts
- **hello@macrocosmos.ai** — official contact
- **Will Squires** — CEO, co-founder (ex-OpenTensor Foundation)
- **Steffen Cruz** — CTO, co-founder (ex-OpenTensor Foundation)
- **Discord** — Macrocosmos server for technical support

### Channel recommendation
Email hello@macrocosmos.ai first (they have a proper developer relations flow), then sign up for the free tier simultaneously.

### Message (email to hello@macrocosmos.ai)

```
Subject: Bulk data enrichment for Australian civic intelligence platform — API access

Hi Macrocosmos team,

I'm Ben Knight, founder of GrantScope (civicgraph.app) — an open intelligence
platform for Australian grants, procurement, and civic accountability. We track
587K entities, 30K grants, 795K government contracts, and 1.5M relationship
edges across government registries.

We have a specific enrichment gap: 569K of our entities have source_count ≤ 1
(single registry source). We need web/social data to triangulate and enrich
these records — foundation website content, social media presence, news
mentions, and activity signals.

We've reviewed the Gravity API docs and the Python SDK looks like a clean fit
for our existing pipeline (we already run a multi-provider enrichment queue
with claim_next_task() concurrency control in Supabase).

Our planned usage:
- Initial backfill: ~10K queries (3,304 foundations with websites but no
  enrichment, plus top community organisations)
- Ongoing: ~500-2K queries/day for new entities and stale-record refresh
- Sources of interest: Twitter/X, Reddit, news, web content
- We'd gate all results through a confidence threshold before ingesting
  into our production graph

Questions:
1. Is the free tier ($5 credits) sufficient for a proof-of-concept batch
   of ~200 queries?
2. What's the pricing model for the volumes above?
3. Are there rate limits or batch endpoints for bulk enrichment?
4. Do you have Australian-specific data coverage, or is it primarily
   US/global? (Our entities are Australian orgs, foundations, and
   government bodies)
5. Any existing integrations with Supabase/PostgreSQL pipelines?

Happy to share more about our data model and enrichment architecture if
helpful. We're looking for a data vendor relationship, not mining — your
subnet does the hard work, we consume the results.

Ben Knight
A Curious Tractor / GrantScope
benjamin@act.place
https://civicgraph.app
```

### Why this message works
- Professional vendor inquiry tone — they're used to this from enterprise
- Specific volumes so they can route to the right pricing tier
- Mentions their SDK by name — shows we've done homework
- Asks about Australian coverage — critical qualifier before we invest time
- Frames as "data vendor relationship" — clear expectation setting

---

## 3. Follow-up sequence

### If Djinn responds positively
1. Get API/contract docs
2. Build proof-of-concept: attest 10 AusTender pages
3. Measure: time to proof, cost per attestation, proof bundle size
4. If viable: propose case study / co-marketing ("first non-sports vertical")

### If Djinn doesn't respond in 7 days
1. Try Discord (often faster than DMs)
2. If still no response in 14 days: evaluate TLSNotary direct integration (open source, more work, no dependency)
3. Fallback: signed timestamps + Merkle proofs (simpler, less impressive, but shippable)

### If Macrocosmos responds positively
1. Sign up for free tier immediately
2. Run 50 test queries: Australian foundation names → evaluate hit rate
3. If hit rate > 40%: negotiate bulk pricing
4. If hit rate < 20%: Australian coverage is insufficient, deprioritize

### If Macrocosmos Australian coverage is poor
1. Stick with existing enrichment pipeline (Firecrawl + multi-LLM)
2. Revisit in 6 months as their crawler coverage grows
3. Consider contributing Australian seed URLs to improve their coverage (goodwill play)

---

## 4. What NOT to say in outreach

- Don't mention "we want to mine" — we don't, and it changes the conversation
- Don't mention TAO price or token economics — we're customers, not speculators
- Don't oversell our scale — 587K entities is real but modest by global standards
- Don't promise integration timelines — wait for their API reality before committing
- Don't mention other subnets — keep each conversation focused
- Don't share sensitive data details (JusticeHub, Indigenous community data) — only public registry data
