# The Data Standard — what this data is for, and what it has to be true enough for

**Written:** 2026-08-19, after a full day of data-integrity work
**Status:** proposed. Companion to `buyer-wedge.md` (PROVISIONAL) and map #303.

## Why this document exists

On 19 August 2026 a day that was meant to be a short cleanup found, in order:

| defect | scale |
|---|---|
| Duplicated relationship rows | 71,166 rows, **$36.03bn** |
| Organisations filed under the wrong council | **9,101**, plus 5,741 unplaceable |
| Edges attributed to an unrelated party by a sentinel value | **53,109** under one small company's name |
| Fictional foundation giving | $98.69M |
| Palm Island | filed under **Croydon**, a shire 700km away |

None of it was new. The duplication mechanism had been running since at least March. The Croydon
error had been in the data long enough to have a ticket that said it was blocked on a file that was
already in the database. Two real named individuals were sitting on contracts and donations that
were not theirs.

**Every one of these would have produced a confident, wrong number in front of a community.** That
is the reason this document is a strategy document and not an engineering note.

## The mission, stated so it can be failed

> **Make the flow of public capital legible to the people it is supposed to reach, at a standard of
> accuracy where the community itself is the auditor.**

The second clause is the whole thing. It is what separates this from every other data product in
the sector, and it is a much harder bar than it sounds.

A government buyer or a philanthropic funder reading a dashboard has no independent way to check
it. They accept the number because it is plausible and because it came from a system. **A community
reading a figure about its own place knows the ground truth.** Palm Island knows it is not in
Croydon. The Bwgcolman organisations know which of them received money and which did not. The
Shire Council knows it took most of it.

So the audience we are building for is the only audience that can catch us. That is not a risk to
manage. It is the design constraint, and it is the reason the accuracy bar is set where it is.

## The asymmetry that should govern every decision

**A funder who is given a wrong number asks for a correction. A community that is given a wrong
number about itself stops trusting the source, permanently, and is right to.**

Communities in this sector have been measured, surveyed, indexed and reported on for decades,
mostly by people who were wrong about them and did not have to live with it. There is no reservoir
of goodwill to draw down. The first wrong figure is the last figure anyone reads.

This means the usual trade of coverage against accuracy runs the wrong way here. **Fewer figures,
each of which survives being checked by the person it is about, beats a complete picture with a
soft floor.**

## Six rules that follow, and are already partly in force

1. **Never publish a figure a community can falsify.** Place attribution is fixed before place
   figures are shown. This is why the Palm Island repair came before the Palm Island place cut, and
   why 5,741 organisations were left deliberately unplaced rather than confidently misplaced.
   *Unplaced and honest beats placed and wrong* is now a standing rule, not a judgement call.

2. **Report a range when the data supports a range.** Queensland youth justice is
   "**10.5% to 18.9%** community-controlled, floor and ceiling", never "10.5%". 311 grants worth
   $76.7M never matched an entity, and pretending otherwise would be the lie. The range still makes
   the argument; it just makes it honestly.

3. **Refuse at the claim, not at the index.** Hold everything; publish only what survives. This is
   the Clarity console's existing principle and it generalises.

4. **Every dollar figure carries its provenance.** A `.provenance.md` sidecar, the filters applied,
   and the date measured. The three mandatory `justice_funding` filters exist because omitting them
   does not produce a slightly-off number, it produces one wrong by an order of magnitude.

5. **Consent ships with the row, not with the project.** Empathy Ledger's job. The storytelling
   booth at a partner's event recorded young people and said an AI would anonymise them. That is a
   consent decision made casually, and it is exactly the gap this rule closes.

6. **Verify against the source, never against the derived artefact.** See below. This is the rule
   that today's work argues for most strongly, and it is the one most often skipped.

## The evidence for rule 6, which is uncomfortable

In one working session, on this data, an agent with full database access and no time pressure
produced **five confident, specific, wrong answers**:

| claim | reality |
|---|---|
| "The nightly matview refresh has stopped" | It had run fine. The views measured were on a weekly tier. |
| "The CI hang is a dpkg lock" | An unreachable apt mirror. A network stall. |
| **"$31.2bn of duplication in `aec_donations`"** | **Phantom.** The source genuinely holds 374 identical receipts, verified 374-for-374. |
| "There is no distinguishing key, so duplication is unmeasurable" | `source_record_id` exists and is 100% populated. |
| "The merge map is government-versus-ABN" | That is 59 of 836 pairs. The dominant case is ABN-to-ABN. |

Every one came from **inferring a mechanism from data instead of checking it against its source.**
Every one was caught by going to the source. The $31.2bn was the closest call, and the tell was
that the number was large and alarming, which is precisely when the instinct to publish is
strongest.

If the fastest, most tireless reader of this data does that five times in a day, then no process
that depends on care alone will hold. The rule has to be structural: **a figure is not reportable
until it has been checked against the system of record, not against another view of itself.**

## What the three systems are each for

The Custodian Futures conversation named people, process and place without naming what would hold
them. That already exists, in three places, and the division of labour should stay clean.

| system | question it answers | what it must never do |
|---|---|---|
| **CivicGraph** | Where did the money go, and who received it | Claim a place figure before the place data is right |
| **JusticeHub** | What works, and who says so | Score an intervention without community authority weighted |
| **Empathy Ledger** | Whose story is this, and who agreed | Hold a story whose consent is assumed rather than given |

**The gap none of them holds is the weaver** — the aunties and connectors who make any of it work,
unfunded because relational work does not fit a reporting framework. The instinct to make that
measurable should be resisted. Make it **visible** instead. Visibility is a claim we can support;
measurement of relational work is a claim we cannot.

## What this does not settle, and must not pretend to

**No payer has been tested.** Map #303 concluded that the payer is a place-based intermediary
buying to keep spend local. That is a theory. It has the same untested-demand problem that killed
the buyer wedge, where 438 prospects produced zero paying buyers over ten weeks. Issue #311 is the
test and it is a human conversation, not a query.

Everything in this document makes the argument sharper and the numbers trustworthy. **None of it
establishes that anyone will pay for it.** Holding both of those at once is the honest position,
and writing a mission statement does not change it.

## The one-line test

Before any figure goes in front of a community:

> **Could the person this number is about check it, and would it survive?**

If the answer is no, it is not ready. If the answer is unknown, it is not ready either.
