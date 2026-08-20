# #311 — three conversations, one page

**For Ben. Not a product, not a pitch deck.** #311 says do not build anything first and that
today's figures are enough. Every figure below was re-verified against the live database on
2026-08-20; the one that was mis-stated in the ticket is corrected here.

## The four figures you can say

| figure | what it is | status |
|---|---|---|
| **85.1% of awards** and **59.6% of dollars** stay in the LGA where the work happens | 85,898 federal grant awards, $33.75bn, from `v_grant_place_capture` | Verified live |
| **97.5% of awards / 96.8% of dollars stay in-state** | the leak is almost entirely *within* states, not across them | Verified |
| **$5.43bn of $1,268bn is community-controlled** — 0.43% | the split that #304 point 5 says must be on every figure | Verified |
| **We can see about 2.5% of tracked money** | $33.75bn of roughly $1.36tn | Verified |

## The one the ticket gets wrong

#311 says the bias moves "26.6%/35.6%/22.5% of Outer Regional/Remote/Very Remote dollars into
the cities". The percentages are right. **"Into the cities" is not.**

```
                  by delivery   by registered address    shift
Major Cities         15,214            15,597           +2.5%
Inner Regional        2,831             2,691           -4.9%
Outer Regional        1,680             1,233          -26.6%
Remote                  536               345          -35.6%
Very Remote             445               345          -22.5%
postcode unmapped     2,354             2,851          +21.1%
```

Of the $878m that shifts, **only $383m lands in Major Cities. $497m lands in "postcode
unmapped".** Say "into the cities" and you have overstated the city-ward flow by more than half.

Also: this table covers **$23.06bn**, the awards where both ends resolve. The 85.1%/59.6% figures
cover $33.75bn. Quoting them in one breath implies one population.

**The sentence that survives scrutiny:**

> Attribute the money by registered address instead of by where the work happens, and Remote
> Australia's recorded total drops 35.6 per cent. Outer Regional drops 26.6. Very Remote drops
> 22.5. That is on the 23 billion where we can see both ends.

## Say this before they ask

- **We see about 2.5% of the money.** Federal grants with a resolvable delivery place. The
  $1.27tn contract lane is **absent, not zero**. A payer who signs without understanding that is
  a payer who churns.
- **Contracts do not record delivery location at all.** Zero deliveryAddress across 100 live OCDS
  releases. This is not a gap we can close by trying harder.
- **The top of the leak is corporate, not intermediary.** The largest very-remote-delivered,
  city-received awards go to Santos, Lynas, Metso and Engie. The mechanism is real and measured.
  The population is mostly resource companies. If they ask whose money is leaving, that is the
  answer, and it is not the answer a land council expects.

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
