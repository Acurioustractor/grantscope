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

**Data reality (verified 2026-06-08):** the prospect pool is FEDERAL — AusTender is commonwealth procurement; VIC/SA SPF/SAIPP obligation-holders tender through state systems we don't ingest yet. Top of pool: Defence (255 SE suppliers, $2.3B), Services Australia (174), PM&C (145), DSS (137), NIAA (132).

Prioritise in this order:
1. **Federal buyers via the IPP angle** — the Indigenous Procurement Policy sets MANDATORY targets for commonwealth buyers, and ~80% of the registry is Supply Nation/ORIC. The pitch: "here is your agency's IPP delivery story, per-supplier, evidence-linked" — no one else can produce it. Strongest combination of obligation + our evidence.
2. High `se_supplier_count` + recent `last_contract_end` (active buyers, not historical).
3. `certified_supplier_count` > 0 (their suppliers carry marks a probity advisor recognises).
4. **VIC/SA buyers** (SPF/SAIPP obligation) — currently NO contract evidence in our DB. Unblocking them needs a Buying-for-Victoria / SA Tenders ingest — raise with the user as a /wedge question before building (it's evidence-depth work, not widening, but it's still a build).

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
