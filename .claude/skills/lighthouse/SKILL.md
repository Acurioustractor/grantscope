---
name: lighthouse
description: Lighthouse-buyer workflow — find and prepare the first paying government buyer for the SE evidence + tender-pack product. Mines se_buyer_prospects (buyers who already contract with registry SEs), shortlists VIC/SA buyers with social-procurement obligations, and assembles an evidence-led outreach pack. Use when the user says "/lighthouse", "find buyers", "prospect buyers", or wants outreach material for a procurement team.
---

# Lighthouse Buyer Workflow

Goal (buyer-wedge move 3): **one** government buyer with a social-procurement obligation using a tender-pack in a real procurement. The strategy doc names Vic or SA for their mandated weightings; **NSW DCJ was chosen 2026-08-08** because it is a state buyer whose evidence already exists, where Vic and SA would each be an ingest project first. The pitch is their own data: "your agency already bought $X from N social/Indigenous enterprises — here is the evidence, and here is the tool that makes your next tender's social-procurement weighting defensible."

## Stage 1 — Refresh prospects

```bash
node --env-file=.env scripts/scout-se-buyers.mjs            # dry run, top 20
node --env-file=.env scripts/scout-se-buyers.mjs --apply    # rebuild se_buyer_prospects
```

Table: `se_buyer_prospects` (buyer_name, se_supplier_count, contract_count, total_value, last_contract_end, certified_supplier_count, example_suppliers, states).

## Stage 2 — Shortlist

**Data reality (re-verified 2026-08-08 — this section previously said the pool was federal-only, which was wrong):**
`austender_contracts` is misnamed. It carries **NSW eTender disclosures alongside Commonwealth AusTender rows** (check `source_url` — `tenders.nsw.gov.au` vs the AusTender/OCDS publication). So state buyers ARE in the pool: NSW DCJ (91 SE suppliers, $3.69B), Transport for NSW, HealthShare NSW, Homes NSW, Queensland Rail, Parks Victoria, Queensland Corrective Services. What is genuinely missing is VIC and SA.

**Read `states` carefully:** it lists where the *suppliers* are, not where the buyer sits. Misreading it as buyer coverage is what hid the state buyers for two months.

Prioritise in this order:
1. **State buyers with an obligation AND existing evidence** — the strategy wants a state buyer, and NSW delivers one today. NSW has the Social Enterprise Policy (direct engagement under $150K) and the Aboriginal Procurement Policy (3% of addressable spend). Weaker than VIC's mandated SPF weightings, stronger than federal.
2. **Federal buyers via the IPP angle** — the Indigenous Procurement Policy sets MANDATORY targets for commonwealth buyers, and ~80% of the registry is Supply Nation/ORIC. The pitch: "here is your agency's IPP delivery story, per-supplier, evidence-linked" — no one else can produce it.
3. High `se_supplier_count` + recent `last_contract_end` (active buyers, not historical).
4. `certified_supplier_count` > 0 (their suppliers carry marks a probity advisor recognises).
5. **QLD via `state_tenders`** — 199K rows with supplier ABNs, real justice/child-safety spend, but almost no date coverage (only `qld_doe_disclosure` has award dates, latest 2021-06-30). Fix dates before pitching.
6. **VIC/SA buyers** (SPF/SAIPP obligation) — genuinely NO evidence: 29 VIC rows with 0 ABNs, nothing for SA. Unblocking them needs a Buying-for-Victoria / SA Tenders ingest — raise with the user as a /wedge question before building (it's evidence-depth work, not widening, but it's still a build).

**Before quoting any stored figure:** anything computed before 2026-08-08 is inflated. The ABN lookup deduped on the whole tuple rather than the ABN, so 527 duplicate registry rows fanned the contract join out. Worst case was DSS at $10,862M against a true $3,983M. Re-run the scout, and derive the headline a second independent way before it reaches a buyer.

Cross-reference: which shortlisted buyers also appear as policy targets in `apps/web/src/lib/social-procurement.ts` (state policy inserts).

## Stage 3 — Outreach pack (per prospect)

Assemble, do not send (sending is Tier 3 — human does it):
1. **Evidence one-pager** — their SE spend story from our data: total value, supplier count, named examples (from `example_suppliers`), with per-claim provenance. Every dollar figure needs a source row.
2. **Live tender-pack** for a plausible upcoming category for that buyer (`/procurement/tender-pack`), state policy citations included.
3. **Draft email** — short, evidence-first, no marketing voice. Lead with their number ("Your agency contracted $X with N social enterprises since YYYY"). One ask: 30 minutes to show the tender-pack against a live procurement.
4. Save pack to `thoughts/shared/prospects/<buyer-slug>/` (one-pager.md, email-draft.md, notes.md).

## Stage 4 — Track

Keep a simple ledger at `thoughts/shared/prospects/PIPELINE.md`: buyer, stage (identified → pack built → contacted → meeting → live tender → paying), date, next action. Update it every time this skill runs.

## Constraints

- NEVER send outreach from a session (Tier 3 — drafts only, human sends).
- Every claim in an outreach pack must trace to a queryable row — provenance discipline applies doubly to material leaving the building.
- Don't spray: depth on 3-5 prospects beats packs for 20. The goal is ONE live procurement.
