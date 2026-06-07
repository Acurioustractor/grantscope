---
name: lighthouse
description: Lighthouse-buyer workflow — find and prepare the first paying government buyer for the SE evidence + tender-pack product. Mines se_buyer_prospects (buyers who already contract with registry SEs), shortlists VIC/SA buyers with social-procurement obligations, and assembles an evidence-led outreach pack. Use when the user says "/lighthouse", "find buyers", "prospect buyers", or wants outreach material for a procurement team.
---

# Lighthouse Buyer Workflow

Goal (buyer-wedge move 3): **one** Vic or SA government buyer using a tender-pack in a real procurement. The pitch is their own data: "your agency already bought $X from N social/Indigenous enterprises — here is the evidence, and here is the tool that makes your next tender's social-procurement weighting defensible."

## Stage 1 — Refresh prospects

```bash
node --env-file=.env scripts/scout-se-buyers.mjs            # dry run, top 20
node --env-file=.env scripts/scout-se-buyers.mjs --apply    # rebuild se_buyer_prospects
```

Table: `se_buyer_prospects` (buyer_name, se_supplier_count, contract_count, total_value, last_contract_end, certified_supplier_count, example_suppliers, states).

## Stage 2 — Shortlist

Query the table; prioritise in this order:
1. **VIC buyers** — Social Procurement Framework MANDATES weightings on government procurement. Strongest obligation = strongest pull.
2. **SA buyers** — SAIPP (min 20% economic-contribution weighting, Office of the Industry Advocate). Note: SA has NO mandated SE weighting (our tender-pack copy says so honestly — that honesty is part of the pitch).
3. High `se_supplier_count` + recent `last_contract_end` (active buyers, not historical).
4. `certified_supplier_count` > 0 (their suppliers carry marks a probity advisor recognises).

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
