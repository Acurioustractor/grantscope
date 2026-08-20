# The Empathy Ledger anchor card contradicts "stories link to projects, never to data"

**Status: needs Ben's decision.** Not a technical problem. Two documents in this repo say
opposite things and the newer one is aimed at another team.

## What the doc proposes

`docs/integrations/empathy-ledger-anchor-card.md`, framed as *"How to anchor Empathy Ledger
stories to a CivicGraph entity"*, offers two integrations. Both key on an **ABN**:

```html
<iframe src="https://civicgraph.app/embed/entity/12345678901" height="280" />
```

Its argument: *"The story (EL, the why) and the system (CivicGraph, the how and who). Together
they are journalism. Apart they are not."*

Searching that document for consent, permission or sovereignty returns **zero matches**.

## What the card actually puts under a story

From `components/civicgraph-entity-card.tsx`, fed by `/api/data/entity/{abn}`:

- the organisation's canonical name and description
- `contract_count`, `grant_count`, `alma_intervention_count`
- `total_government_funding`, formatted as `$12.4M`

So a story by a person about their experience renders with that organisation's contract count and
government funding total beneath it.

## What was already decided, four days earlier

From the clarity console work on 2026-08-16:

> **Stories link to projects, never to data.** Project-mediation is the only version that cannot
> re-identify. Place-mediation is the more dangerous version, because place is a quasi-identifier.

The anchor card is a story linked directly to data, keyed by ABN. That is the thing the principle
rules out, proposed four days later in a document written for another team.

## Why this is not hypothetical

**Re-identification.** A story anchored to one named organisation narrows the storyteller from
"someone in the system" to "someone at this org". For a large provider that is weak. For a small
community-controlled organisation in a small place, it is close to naming them.

**Framing without consent.** Consenting to tell your story is not consenting to have it used as
evidence beside a named organisation's funding total. The card supplies the second without asking.

**Live risk, until this morning.** The card reads `/api/data/entity/{abn}`, which until #358 today
reported **Westpac as donating $3,478.6m against a real $82.0m**, with 1,880 entities overstated
by more than 10x. Had the integration been built, a person's story could have carried a fabricated
dollar figure about a named organisation. That was fixed by accident, while checking the endpoint
before writing a note about it.

**The organisation may be the storyteller's employer or service provider.** ACT's other projects
treat that relationship carefully. This document does not mention it.

## What is already true, and worth keeping

- The **Atlas** has typed consent tiers enforced in code, and its Goods layer is genuinely gated.
- **#307** is a live consent process for per-place Goods data, and #311 was told not to front-run it.

The capability to do this properly exists in this codebase. It just is not applied here.

## The options

**A. Retire the document.** Say plainly that story-to-entity anchoring was proposed and rejected,
and why. Cheapest, loses a real idea.

**B. Rewrite it project-mediated.** Anchor the story to a PROJECT, and let the project carry the
entity links. That is what the principle prescribes, it keeps most of the editorial value, and it
cannot re-identify. Costs a design pass on what a project-level card shows.

**C. Keep entity anchoring, add a consent model.** Storyteller-level opt-in per anchor, recorded,
revocable, with the Atlas tiers as the pattern. Most work; the only option that keeps the original
idea intact.

**D. Decide the principle does not apply here, and write down why.** Legitimate. Right now the two
documents simply contradict each other and neither cites the other, which is the worst state.

## Recommendation

**B**, with **A** as the honest fallback if nobody has appetite for the design pass. What should
not continue is the current state: a document telling another team how to build something this
project has already ruled out, four days after ruling it out, with no mention of consent, aimed at
a project whose entire purpose is data sovereignty and community storytelling.

## Also, found while reading this

`app/embed/entity/[identifier]/page.tsx` still documents `https://civicgraph.com.au/embed/...` in
its comment. #359 fixed that dead domain in the integration doc and missed this one. Its dev
fallback is `localhost:3003`, where this repo's dev server is 3013.
