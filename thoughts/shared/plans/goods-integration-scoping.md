# Goods ↔ CivicGraph Integration — Scoping Design Doc

**Status:** DESIGN DOC. Not code yet.
**Updated:** 2026-04-24
**Owner:** Ben Knight
**Blocked on:** Indigenous advisory formation (Oonchiumpa + Walter + one peak body). Do not start implementation of Indigenous-facing features until advisory is in place.

---

## Purpose

Goods is the commerce lens of the A Curious Tractor portfolio. CivicGraph is the power atlas. This doc scopes how they integrate so Goods benefits from CivicGraph&rsquo;s entity graph, procurement data, and Indigenous-org flags, and CivicGraph benefits from Goods as a consumption surface that turns accountability data into buyer action.

Three integrations under one umbrella idea. Each can ship independently.

---

## Integration 1 — Supplier verification card

**What:** Every Indigenous-led supplier listed on Goods gets a CivicGraph-powered verification card showing ABN, community-controlled status, past government contract history, ACNC charity registration, and region. Trust signal for buyers who need more than &ldquo;take their word for it.&rdquo;

**Data already in CivicGraph:**
- `gs_entities.is_community_controlled` flag
- ACNC Indigenous-focused charity filter (via `purposes` or `beneficiaries` fields)
- `austender_contracts.supplier_abn` + `contract_value` (contract history)
- `entity_identifiers` (Supply Nation cert, AIATSIS-known lists if already ingested)
- Foundation grant history via cross-system joins

**Data we still need to ingest:**
- Supply Nation registered businesses directory (scrape or API partnership)
- Black Business Finder directory
- Each state&rsquo;s Aboriginal business enterprise register (NSW, VIC, QLD, WA, NT, SA)

**Implementation shape:**
- Reuse `<CivicGraphEntityCard>` from PR #26 (already built for Empathy Ledger)
- Or: Goods pulls `/api/data/entity/{abn}` JSON and renders in its own styling
- Both patterns are supported — pick based on Goods&rsquo; stack

**Effort:** 2 weeks of work once Supply Nation data is ingested. 4 weeks if Supply Nation scrape needs building from scratch.

**Sensitivity:** HIGH. Indigenous supplier identification needs advisory sign-off on how &ldquo;verified&rdquo; is defined, who&rsquo;s included, who&rsquo;s excluded, and how errors are corrected. **Do not launch this feature before advisory is seated.**

---

## Integration 2 — IPP buyer scorecards

**What:** Indigenous Procurement Policy (IPP) requires federal agencies to hit 3% Indigenous-supplier contract targets by 2027. Most miss. They don&rsquo;t know where the suppliers are. Scorecards show how each agency is tracking plus a live sourcing tool.

**Two audiences:**
- **Advocacy/accountability:** &ldquo;Agencies tracking below IPP target&rdquo; — public scorecard
- **Procurement officers:** &ldquo;Indigenous suppliers in [category] within [region]&rdquo; — sourcing tool

**Data:**
- `austender_contracts` filtered by `supplier_abn` that matches known Indigenous-led ABN lists
- Aggregate against agency annual contract spend to calculate percentage
- Surface gaps: agencies with high non-IPP contract spend in sectors with available Indigenous suppliers

**Implementation shape:**
- New endpoints:
  - `GET /api/data/procurement/ipp-scorecards` — agency-level compliance ranking
  - `GET /api/data/indigenous-suppliers?category=X&region=Y` — sourcing query
- Optional: a public-facing `/reports/ipp-scorecard` page that names names

**Effort:** 3 weeks. Most of it is IPP dataset preparation — agency mappings, category crosswalks, eligibility criteria. Governance review on how &ldquo;non-compliant&rdquo; is framed.

**Sensitivity:** MEDIUM-HIGH. Agency-level &ldquo;below target&rdquo; reporting is politically loaded but factually defensible. Important: never misclassify an agency as non-compliant without a right-of-reply process or a clear complaint channel.

**Revenue angle:** This is the feature government agencies would most likely pay to subscribe to. Procurement teams need it. Budget exists. Institutional commission via ACT Pty potentially fits.

---

## Integration 3 — Indigenous operator discovery (for Goods governance)

**What:** Goods shouldn&rsquo;t be &ldquo;Ben runs an Indigenous marketplace.&rdquo; It needs Indigenous operators and governance. CivicGraph identifies candidates.

**Approach:**
- Query community-controlled orgs with commerce/social-enterprise purposes
- Filter by jurisdiction: one operator per major region (NT, WA, QLD, NSW, VIC, SA)
- Rank by governance quality (board composition visible, board tenure, public reporting)
- Cross-ref with existing partnerships (Supply Nation, AIATSIS, state peaks)

**Implementation:**
- Internal tool, not public. A short-listing helper for human conversation.
- Single SQL-backed dashboard in `/ops` (admin only).
- Output: 10-20 named orgs per region with contact details, not a public directory.

**Effort:** 1 week. Mostly SQL, no new ingest.

**Sensitivity:** HIGH (governance implications) but INTERNAL (not published).

---

## Architecture

```
  ┌──────────────────────────────────────────────────────────┐
  │                       GOODS                                │
  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐   │
  │  │ Supplier cards  │  │ IPP scorecards │  │ Operator   │   │
  │  │ (pub)           │  │ (pub + ops)    │  │ shortlist  │   │
  │  └────────┬────────┘  └────────┬───────┘  │ (ops)      │   │
  └───────────┼────────────────────┼──────────┴────┬───────┘   │
              │                     │                │           │
              └─────────────────────┼────────────────┘           │
                                    │                             │
                                    ▼                             │
  ┌──────────────────────────────────────────────────────────┐   │
  │                    CIVICGRAPH API                          │   │
  │  /api/data/entity/[abn]         (EXISTING — PR #26)        │   │
  │  /api/data/indigenous-suppliers (NEW)                      │   │
  │  /api/data/procurement/ipp-scorecards (NEW)                │   │
  └──────────────┬───────────────────────────────────────────┘   │
                 │                                                 │
                 ▼                                                 │
  ┌──────────────────────────────────────────────────────────┐   │
  │                      SUPABASE                              │   │
  │  gs_entities (559K)                                        │   │
  │  austender_contracts (770K)                                │   │
  │  entity_identifiers (Supply Nation — if ingested)          │   │
  └──────────────────────────────────────────────────────────┘   │
                                                                   │
  New data pipelines needed:                                       │
  - Supply Nation directory scrape                                 │
  - State-level Aboriginal business registers                      │
  - IPP target/actual reporting ingest (PM&C dataset)              │
```

---

## Order of operations

**Phase 0 (now → 2 weeks):** DO NOT DO INTEGRATION WORK YET.
- Form Indigenous advisory (Oonchiumpa + Walter + one peak body)
- Draft &ldquo;Indigenous data standards&rdquo; document for the portfolio
- Confirm Goods is proceeding as a real product (not aspirational)

**Phase 1 (2-6 weeks after Phase 0):** Internal + low-risk.
- Integration 3 (operator shortlist — internal, admin-only). Zero public risk.
- Build Supply Nation ingest pipeline (scraper + ABN matching)
- Advisory reviews &ldquo;who counts as Indigenous-led&rdquo; definitions

**Phase 2 (6-10 weeks):** Public integration 2 (IPP scorecards).
- Build scorecards + sourcing endpoints
- Advisory reviews framing before any public scorecard goes live
- Target first government pilot: Data.Vic or a single federal agency as soft-launch partner

**Phase 3 (10-16 weeks):** Public integration 1 (supplier cards).
- Only ships after Goods has operators in place (per Phase 0 governance)
- Supplier cards render inside Goods marketplace UI
- CivicGraph entity pages show &ldquo;Available on Goods&rdquo; reverse link for Indigenous-led suppliers

---

## Open questions

1. **Is Goods a live product or planning artifact?** Answer changes everything. Live = build integrations into existing surface. Planning = design first, build when product exists.

2. **Supply Nation data license.** Their directory is public but republication may need permission. Phone call before scraping.

3. **IPP enforcement stance.** Does CivicGraph publicly name non-compliant agencies? Advisory call. Framing options range from &ldquo;reporting&rdquo; (neutral) to &ldquo;accountability&rdquo; (pressure) to &ldquo;naming&rdquo; (confrontational). Pick one, stick with it.

4. **Data sovereignty layer.** Maiam nayri Wingara principles require Indigenous governance over Indigenous data. What does that mean operationally for &ldquo;I&rsquo;m showing a list of Indigenous-led businesses&rdquo;? Advisory question.

5. **Revenue or public good?** If agencies pay for the IPP scorecard, is it a commercial tool? If it&rsquo;s free, who funds the maintenance? Business model question for ACT Pty.

---

## Decisions needed before first line of code

- [ ] Advisory seated (3 people minimum)
- [ ] Goods product status confirmed (live / planning / paused)
- [ ] Supply Nation license / data agreement clarified
- [ ] IPP framing stance agreed with advisory
- [ ] Revenue model locked (commercial IPP for agencies vs. free public good)

None of these are solvable by writing code. All of them are solved by conversations.
