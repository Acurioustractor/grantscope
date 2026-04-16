# Snow Foundation Fixed Demo Route

Date: 2026-04-12
Status: Internal
Purpose: Fixed 8-screen walkthrough across GrantScope and Empathy Ledger

## Local origins

- GrantScope: `http://localhost:3003`
- Empathy Ledger: `http://localhost:3030`

## Rule

Do not freestyle.

Open these screens in order.

Do not open raw story lists or unfinished admin views.

## Screen 1 — Snow Foundation detail

URL:

`http://localhost:3003/foundations/d242967e-0e68-4367-9785-06cf0ec7485e`

What to say:

- This is the Snow foundation profile after repairing the 2024 baseline.
- Annual giving is now anchored to the annual report at `$13,704,202`.
- This is the anchor surface for the rest of the walkthrough.

## Screen 2 — Snow funder search context

URL:

`http://localhost:3003/foundations?q=Snow%20Foundation`

What to say:

- This shows Snow in the wider funder landscape instead of as an isolated profile.
- It positions Snow as part of a broader capital map, not only a single foundation card.

## Screen 3 — Briefing Hub with Snow funding context

URL:

`http://localhost:3003/briefing?start=funding&output=funding-brief&subject=Snow%20Foundation&topic=rheumatic%20heart%20disease&state=ACT&lanes=funding,place,clarity#composer`

What to say:

- This is where the decision object gets composed.
- We are not jumping straight from profile to story.
- We are defining the evidence lanes first: funding, place, and story handoff.

## Screen 4 — Funding brief handoff

URL:

`http://localhost:3003/home/report-builder?topic=rheumatic%20heart%20disease&state=ACT&focus=Snow%20Foundation&autogenerate=1&output=funding-brief&lanes=funding,place,clarity`

What to say:

- This is the layer that turns the funder view into a decision-ready brief.
- The point is memo generation from a defined evidence chain, not a static profile.

## Screen 5 — Clarity handoff

URL:

`http://localhost:3003/clarity?subject=Deadly%20Hearts%20Trek&state=NT&output=story-handoff&lanes=clarity,entity,place`

What to say:

- This is where the evidence chain is made explicit before narrative work.
- It keeps the portfolio surface and the story surface tied together.

## Screen 6 — Snow dashboard in Empathy Ledger

URL:

`http://localhost:3030/organisations/4a1c31e8-89b7-476d-a74b-0c8b37efc850/dashboard`

What to say:

- This is the Snow tenant, but only the curated dashboard view.
- It is not for raw exploration.
- The key point is that a real Snow project and transcript layer exist here.

## Screen 7 — Snow transcripts

URL:

`http://localhost:3030/organisations/4a1c31e8-89b7-476d-a74b-0c8b37efc850/transcripts`

What to say:

- The transcript layer is the strongest current live evidence surface.
- This is what gives the portfolio view community texture instead of only grant metadata.

## Screen 8 — Snow analysis view

URL:

`http://localhost:3030/organisations/4a1c31e8-89b7-476d-a74b-0c8b37efc850/analysis`

What to say:

- This is where the project evidence moves into structured interpretation.
- The key outcomes frame is:
  - early diagnosis
  - community education
  - reduced deaths

## Transition lines

Use these exact transitions if helpful.

### Screen 1 → 2

`This is Snow on its own. The next view places Snow inside the wider funding landscape.`

### Screen 2 → 3

`The question is not just who Snow is. The question is what decision we are trying to support.`

### Screen 3 → 4

`Once the evidence lanes are set, the system can produce an actual working brief instead of a loose exploration.`

### Screen 4 → 5

`Before story work starts, we make the evidence chain visible so the narrative is accountable to the underlying portfolio.`

### Screen 5 → 6

`Now we move from capital and geography into the community evidence layer.`

### Screen 6 → 7

`The dashboard shows the tenant exists. The transcript layer is where the real texture lives.`

### Screen 7 → 8

`The final move is from transcript material into structured project understanding.`

## What not to click

- `stories`
- `members`, unless asked directly
- unfinished admin-only routes
- anything that invites raw exploration beyond these eight screens

## Current live caveats

- Snow currently has `0` published stories and `2` archived smoke-test artifacts in Empathy Ledger
- no active placeholder emails remain in the Snow member layer after the 2026-04-17 cleanup
- the member layer still should not be used as contact-grade data because `7` of `8` active members now have blank/null email values
- this route is ready for a curated walkthrough, not an open-ended product demo
