# #311 — three conversations, one page

**For Ben. Not a product, not a pitch deck.** #311 says do not build anything first and that
today's figures are enough. Every figure below was re-verified against the live database on
**2026-08-21**; the one that was mis-stated in the ticket is corrected here.

> **Updated 2026-08-21.** The capture figures changed materially after #301's `postcode_geo`
> repair let the SA3 exclusion be narrowed: coverage rose 28% and the headline dollar share moved
> a long way. **Do not use any printout of this brief dated 2026-08-20.** One table has been
> WITHDRAWN rather than restated — see "The table you cannot use yet".

## The four figures you can say

| figure | what it is | status |
|---|---|---|
| **90.4% of awards** and **84.3% of dollars** stay in the LGA where the work happens | 110,267 federal grant awards, $42.37bn, from `v_grant_place_capture`. Of the awards where the recipient's location also resolves. | Verified 2026-08-21 |
| **86.1% of awards / 56.9% of dollars** on the wider base | the same measure counting the 5,216 awards ($13.78bn) whose recipient location does NOT resolve as "not local". Gloomier, and only right if you mean "we cannot tell" to count as "not here". **Say which one you are quoting.** | Verified 2026-08-21 |
| **97.5% of awards / 96.8% of dollars stay in-state** | the leak is almost entirely *within* states, not across them | Verified |
| **$5.43bn of $1,268bn is community-controlled** — 0.43% | the split that #304 point 5 says must be on every figure | Verified |
| **We can see about 3.1% of tracked money** | $42.37bn of roughly $1.36tn | Verified 2026-08-21 |

## The one the ticket gets wrong

#311 says the bias moves "26.6%/35.6%/22.5% of Outer Regional/Remote/Very Remote dollars into
the cities". **Two separate problems: the wording, and now the numbers themselves.**

**The wording.** "Into the cities" was never right. Most of what shifts does not land in Major
Cities at all — it lands in postcodes we cannot map. Say "into the cities" and you overstate the
city-ward flow by more than half.

## The table you cannot use yet

**WITHDRAWN 2026-08-21. Do not quote the remoteness shift percentages.**

The 26.6 / 35.6 / 22.5 figures were measured on the old $23.06bn resolved base. That base is now
larger, and re-deriving the table produced **two different answers that disagree with each other
and with the original**, because resolving a recipient's remoteness is genuinely hard:

- resolving via the recipient's COUNCIL means picking one remoteness class for councils that span
  several — arbitrary, and it flipped Outer Regional from -26.6% to **+2.1%**, a sign change;
- resolving via the recipient's POSTCODE drops every postcode spanning two classes, which pushed
  **$16.2bn into "postcode unmapped"** on the address side against $3.6bn on the delivery side.

Neither is trustworthy. A third number invented in an afternoon, quoted to a council, and later
corrected is worse than not having the number.

**What to say instead, which is still true and still lands:**

> Money is recorded where the organisation is registered, not where the work happens. In remote
> Australia those are routinely different places, and the gap runs against the remote end. We
> measure it per council rather than nationally, because the national average hides it.

If they press for the national number, say it is being re-derived and you will send it. Then
re-derive it properly.

## Say this before they ask

- **We see about 3.1% of the money.** Federal grants with a resolvable delivery place. The
  $1.27tn contract lane is **absent, not zero**. A payer who signs without understanding that is
  a payer who churns.
- **Contracts do not record delivery location at all.** Zero deliveryAddress across 100 live OCDS
  releases. This is not a gap we can close by trying harder.
- **The top of the leak is corporate, not intermediary.** The largest very-remote-delivered,
  city-received awards go to Santos, Lynas, Metso and Engie. The mechanism is real and measured.
  The population is mostly resource companies. If they ask whose money is leaving, that is the
  answer, and it is not the answer a land council expects.

- **A place that keeps little of the money may still keep most of the opportunities**, and you
  should raise this before they do. Gladstone keeps **0.3% of the dollars** delivered into it but
  **70.4% of the awards**: the money is a handful of hydrogen and critical-minerals grants received
  by head offices in Sydney and Perth, while the many small grants stay local. Measured
  2026-08-21, every one of the twelve worst dollar-capturing councils has high award capture and
  one award carrying 38%-96% of its money. **If you lead with a dollar figure alone you will be
  told, correctly, that it is one grant.** Lead with both.

## The five questions (#311)

1. Do they already know their local capture rate? From where, and is it any good? If not, is the
   absence felt or unnoticed?
2. **Would they pay, and roughly what?** A number, however soft. "Useful" is not an answer.
3. Who holds the budget: economic development, procurement, the CEO, a grant?
4. What would they do differently on the Monday after seeing the figure? If nothing, this is
   interesting rather than valuable.
5. **Does the community-controlled split help or threaten them?** Most diagnostic question on the
   list. A council whose "local" means the big local employer may not want it split.

## Done when

Three conversations, a written answer to Q2 from each, and a call on whether the intermediary
payer survives or #304 reopens.

---

# Where this sits in the wider ACT picture

**This is the only live test of whether anything CivicGraph does can be sold.** Worth being blunt
about the position it is being asked to rescue.

**The buyer wedge is already dead as a live plan.** #304 established it: ten weeks ACTIVE, 438
prospects, **zero paying buyers**, `api_keys` 0 rows by decision. `docs/strategy/buyer-wedge.md`
is now PROVISIONAL. So the intermediary is not one revenue theory among several. It is the
replacement for the one that did not survive.

**And #304 named its own defect.** The intermediary payer has exactly the same untested-demand
problem the wedge had: a named payer nobody has asked. #311 exists so that is tested in
conversations rather than in eighteen months of building. **It has been open two days and is the
only item on this project that touches revenue.**

## Three things the wider ACT context changes

**1. Palm Island Community Company is the obvious first call and the wrong first call.** It is one
of only three `org_profiles` rows, so the relationship exists. But PICC is a **community
organisation**, the beneficiary in #304's model, not an **intermediary** buying on behalf of
others. Talking to PICC tests whether the product is useful. It does not test whether an
intermediary will pay, which is the actual question. It also runs straight at #307's consent
process, which #311 says must not be front-run. **Use PICC to sharpen the questions; find a
council or regional development body to answer them.**

**2. Goods on Country is already in this room.** ACT Pty trades as Goods on Country and works with
communities on country. A council or land council buying place-capital evidence is adjacent to
Goods' customers, possibly the same people. Two questions follow, and neither has been asked:
does a CivicGraph subscription compete with a Goods conversation for the same budget line, and
would it be better sold *through* Goods than beside it? A single buyer with two ACT invoices in
front of them is a worse position than one.

**3. Consent is handled three different ways across three ACT projects, and nobody has reconciled
them.** Same day as this brief:
- **CivicGraph / place** — #307 has a consent process, deliberately gating public per-place Goods
  data. Careful.
- **Empathy Ledger** — the integration doc proposes anchoring a person's story to an entity
  dossier by ABN, with **zero mentions of consent**, four days after "stories link to projects,
  never to data" was established here.
- **Atlas** — typed consent tiers in code, enforced, with the org-gated layer genuinely gated.

Three projects, three postures, one community on the other side of all of them. That is not a
CivicGraph question and it will not be settled by a council conversation, but a place-based
intermediary is exactly the counterparty who will eventually ask it.

## What a yes would actually mean

If one intermediary says a number, the honest reading is narrow: **one buyer, for a measure
covering 2.5% of the money, in one place**. That is still more than the wedge produced in ten
weeks. If all three say no, #304 reopens and the live options are ACT cross-subsidy or accepting
that this is public infrastructure funded some other way. **Both are survivable. Eighteen more
months of building for an unasked payer is not.**
