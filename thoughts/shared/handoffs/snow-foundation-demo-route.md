# Snow Foundation Fixed Demo Route

Date: 2026-04-12
Status: Internal
Purpose: Fixed public walkthrough across GrantScope and Empathy Ledger

## Local origins

- GrantScope: `http://localhost:3003`
- Empathy Ledger: `http://localhost:3030`

## Rule

Do not freestyle.

Open these screens in order.

Do not open raw story lists or unfinished admin views.

## Screen 1 — Snow demo route

URL:

`http://localhost:3003/snow-foundation`

What to say:

- This is the public starting screen for the Snow walkthrough.
- It packages the repaired Snow baseline, the core verified portfolio signals, and the exact demo sequence.
- Use this instead of the internal briefing or report-builder routes.

## Screen 2 — Snow Foundation detail

URL:

`http://localhost:3003/foundations/d242967e-0e68-4367-9785-06cf0ec7485e`

What to say:

- This is the Snow foundation profile after repairing the 2024 baseline.
- Annual giving is now anchored to the annual report at `$13,704,202`.
- This is the anchor surface for the rest of the walkthrough.

## Screen 3 — Snow funder search context

URL:

`http://localhost:3003/foundations?q=Snow%20Foundation`

What to say:

- This shows Snow in the wider funder landscape instead of as an isolated profile.
- It positions Snow as part of a broader capital map, not only a single foundation card.

## Screen 4 — Clarity handoff

URL:

`http://localhost:3003/clarity?subject=Deadly%20Hearts%20Trek&state=NT&output=story-handoff&lanes=clarity,entity,place`

What to say:

- This is where the evidence chain is made explicit before narrative work.
- It keeps the portfolio surface and the story surface tied together.

## Screen 5 — Snow dashboard in Empathy Ledger

URL:

`http://localhost:3030/organisations/4a1c31e8-89b7-476d-a74b-0c8b37efc850/dashboard`

What to say:

- This is the Snow tenant, but only the curated dashboard view.
- It is not for raw exploration.
- The key point is that a real Snow project and transcript layer exist here.

## Screen 6 — Snow transcripts

URL:

`http://localhost:3030/organisations/4a1c31e8-89b7-476d-a74b-0c8b37efc850/transcripts`

What to say:

- The transcript layer is the strongest current live evidence surface.
- This is what gives the portfolio view community texture instead of only grant metadata.

## Screen 7 — Snow analysis view

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

`This page is the fixed operator frame. The next view shows Snow on its own.`

### Screen 2 → 3

`This is Snow on its own. The next view places Snow inside the wider funding landscape.`

### Screen 3 → 4

`The question is not just who Snow is. The question is how the portfolio view stays accountable to the evidence chain.`

### Screen 4 → 5

`Now we move from the portfolio map into the community evidence layer.`

### Screen 5 → 6

`The dashboard shows the tenant exists. The transcript layer is where the real texture lives.`

### Screen 6 → 7

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
