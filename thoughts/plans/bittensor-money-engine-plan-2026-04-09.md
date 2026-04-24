# Bittensor Money Engine Plan — CivicGraph (2026-04-09)

## Goal

Build a high-margin data and intelligence business that uses Bittensor as a compute/refinement layer, while CivicGraph remains the source of truth and product surface.

This plan is intentionally commercial-first:
- **Track 1:** Monetize better data (SN13 enrichment)
- **Track 2:** Monetize trust (SN103 attestation)
- **Track 3:** Monetize speed + interpretation (signals, API, decision packs)
- **Track 4:** Add mining only when it beats Track 1-3 ROI

---

## Current baseline (from live DB)

- `gs_entities`: **587,307**
- `source_count <= 1`: **569,424** (largest immediate value gap)
- `foundations` in entity graph: **10,748**
- `enrichment_candidates`: **0 rows** (SN13 loop not yet producing reviewable candidates)

Interpretation: the highest-value arbitrage right now is **coverage/refinement**, not token speculation.

---

## Core thesis: where money comes from

### 1) Subnet Consumer Products (highest near-term certainty)

Use SN13 and SN103 to improve CivicGraph output, then sell:
- enriched entity dossiers,
- attested due diligence packs,
- premium monitoring/alerts.

Why this wins:
- you already own the demand surface (`/tender-intelligence`, entity dossiers, due diligence pack flows),
- this can invoice in AUD today,
- no dependency on miner emissions volatility.

### 2) Signals + Intelligence Products

Productize:
- monthly sector/region watch briefs,
- API access to scored/attested signals,
- high-ticket custom intelligence for buyers/funders/government teams.

Why this wins:
- moves value from raw data to “decision speed + judgement,”
- direct path to enterprise revenue bands.

### 3) Mining Operations (conditional)

Run miners only when:
- measured net USD/TAO yield after infra and operations is positive for 8+ weeks,
- and does not cannibalize product shipping velocity.

Why conditional:
- emissions and subnet economics are volatile,
- teams routinely over-invest in mining infra before proving commercial pull.

---

## 90-day execution plan

## Phase 1 (Days 1-21): Revenue rail before scale

1. Turn on SN13 enrichment loop to `enrichment_candidates` (staging only).
2. Add acceptance gate (confidence + provenance + URL validation).
3. Expose “enriched” badge + source trail in paid outputs only.
4. Ship attestation-ready field model (even before SN103 API automation is complete).
5. Launch one paid offer:
   - **Attested Due Diligence Pack** (fixed-price SKU).

Exit criteria:
- 1,000+ enrichment candidates generated.
- 60%+ acceptance into production fields.
- first paid attested/enriched output sold.

## Phase 2 (Days 22-56): Productized recurring revenue

1. Add subscription modules:
   - monitored entities,
   - change alerts,
   - attested export allowance.
2. Launch “Signals API” for shortlisted customers.
3. Implement packaging tiers around:
   - unverified vs enriched vs attested intelligence.
4. Formalize outbound with proof-rich case studies.

Exit criteria:
- 10+ paying customers,
- recurring monthly revenue across at least 2 products,
- established COGS/GM by SKU.

## Phase 3 (Days 57-90): Mining decision gate

1. Run controlled mining pilot (small miner set).
2. Track weekly:
   - TAO earned,
   - net USD after infra,
   - engineering hours consumed.
3. Compare mining ROI against direct product ROI.

Decision:
- scale mining only if 8-week net return beats equivalent product investment.
- otherwise keep Bittensor usage focused on consumer layer and ship faster.

---

## Non-negotiable rules

1. **No sensitive community data to public subnet tasks.**
2. **All subnet outputs go to staging first, never direct-to-truth.**
3. **Every accepted result has provenance metadata.**
4. **Commercial KPI beats vanity KPI.**
5. **Do not treat TAO emissions as primary business model.**

---

## KPI stack (weekly)

- Revenue:
  - MRR,
  - attested pack sales,
  - API revenue.
- Data quality:
  - enrichment acceptance rate,
  - source_count uplift in target segments,
  - stale-record reduction.
- Unit economics:
  - COGS per enriched entity,
  - COGS per attested pack,
  - gross margin by SKU.
- Mining (pilot only):
  - net TAO yield in USD,
  - infra cost per TAO,
  - engineering hours per $1k generated.

---

## Immediate actions this week

1. Run `node scripts/enrich-from-sn13.mjs --dry-run --limit=100 --source=x`.
2. Run live SN13 sweep on a constrained segment (e.g. foundations only).
3. Build reviewer workflow for `enrichment_candidates` acceptance.
4. Price and publish one attested pack offer.
5. Track economics with `node scripts/bittensor-money-model.mjs`.

---

## Why this is the practical path

If the objective is “make serious money,” your fastest route is:
- use Bittensor to improve output quality and trust,
- sell higher-trust decisions,
- only scale mining when it is a proven multiplier.

That order preserves focus, protects cash, and compounds your existing CivicGraph moat.
