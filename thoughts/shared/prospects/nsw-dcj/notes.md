# NSW DCJ — lighthouse buyer notes

**Selected:** 2026-08-08 (Ben's call, buyer-wedge move 3).

## Why this buyer, over the alternatives

The next-phase plan framed the choice as federal-now versus VIC/SA-after-ingest, on the premise that
`se_buyer_prospects` was entirely Commonwealth. That premise was wrong. `austender_contracts` carries NSW
eTender disclosures alongside AusTender, so state buyers were already in the pool. NSW DCJ ranked eighth
overall and first among state buyers.

That made a third path available that neither of the two named options offered: a **state** buyer, with a
state social-procurement obligation, whose evidence is already assembled and dated. No ingest project.

Considered and set aside:

- **QLD justice and child-safety departments.** Larger justice-spend story via `state_tenders`
  (DCYJMA 61 SE suppliers, Child Safety 51), but that table has almost no date coverage. Only
  `qld_doe_disclosure` carries award dates and its latest is 2021-06-30. A pack that cannot say when
  anything happened is not a pack. Fixing date coverage is the unlock, and it is a real piece of work.
- **Federal DSS / NIAA.** Works today but carries no mandated weighting, so it is interesting rather than
  needed. Also, DSS's headline was the single worst casualty of the dedupe bug below.
- **VIC / SA.** Strategy-preferred and strongest urgency, but genuinely near-zero data: `state_tenders`
  holds 29 VIC rows with 0 ABNs, and nothing for SA. Weeks of ingest before any conversation.

## The bug this phase caught

`scripts/scout-se-buyers.mjs` deduped its ABN lookup on the whole tuple rather than the ABN, so 527
duplicate registry rows fanned the contract join out and inflated every buyer's contract count and dollar
total. Fixed and rebuilt the same day. Worst case was DSS at $10,862M against a true $3,983M, 2.7 times
over. DCJ was 9% over.

This was caught because the provenance guardrail forces a second independent derivation of any figure
headed for a buyer. It is the guardrail earning its keep. Anything quoted from `se_buyer_prospects` before
2026-08-08 should be re-derived.

## What is strong here

- 61 of 91 suppliers Indigenous-registered, $1,164.1M. NSW Aboriginal Procurement Policy sets a 3%
  minimum of addressable spend, so this maps onto an obligation they already report against.
- Zero suppliers in the `identified` tier. Every one carries an external mark or a statutory register
  entry, so the "you are showing me LLM guesses" objection does not apply to this buyer.
- Justice and community services is the part of this codebase with the deepest existing coverage.

## What is weak, and should be said out loud

- **NSW has policy targets, not Victoria's mandated SPF weightings.** Urgency is real but softer than the
  strategy assumed when it named VIC and SA. This is the trade Ben accepted in choosing DCJ.
- **Coverage ends January 2025.** Eighteen months stale at time of writing. Fine for a structural story,
  not fine for "here is your current year".
- **$3.69B is lifetime multi-year value.** It will be misread as annual spend by anyone skimming. The
  email draft deliberately omits it.

## Open questions before contact

1. Does DCJ publish its own social-procurement or APP performance numbers? If they do, theirs is
   authoritative and the pitch leads with the difference between the two, not with ours.
2. Who is the right recipient? No individual has been researched. Procurement, or the Aboriginal
   Outcomes area, are the plausible homes.
3. Which live DCJ procurement do we build the tender-pack against? Stage 3 item 2 of the `/lighthouse`
   workflow is not done, and it needs a real upcoming category to be worth anything.

## Next actions

- Ben: decide recipient and whether the APP angle or the sub-$150K reporting gap leads.
- Then: build the tender-pack against a named live procurement.
- Not yet done: `/ground` on the copy, `/act-voice` on the prose. Both required before sending.
