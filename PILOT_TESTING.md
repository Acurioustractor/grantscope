# Funding Pilot Testing

## Goal
Prove that GrantScope can help a real organisation quickly:

- find good-fit funders
- understand why they fit
- decide whether the move is apply now, open program, or relationship-led
- know the next concrete step

## Why Now
The data layer is no longer the main blocker.

Verified current state:

- the reviewability backlog has produced a large pilot-ready set
- the current database now has more than `40` strong pilot-ready foundations
- that means user learning should now outrank more long-tail backlog burn-down

## Who To Test With
Run `3 to 5` tightly supported sessions:

- `1` ORIC
- `1 to 2` charities
- `1` social enterprise
- optionally `A Curious Tractor` as the first internal proving case

## Product Surface
Use the existing funding workspace:

- [Funding Workspace](/Users/benknight/Code/grantscope/apps/web/src/app/funding-workspace/page.tsx)

Suggested starting URL pattern:

`/funding-workspace?mission=<mission>&state=<state>&org_type=<org_type>`

## Core Test Script
Use a `20 to 30` minute session.

### Part 1: Setup
Ask the participant for:

- mission in one sentence
- primary geography
- org type

Then enter those into the funding workspace.

### Part 2: Task
Ask them to do three things:

1. Find `3` funding matches they would seriously consider.
2. Explain why each one looks relevant.
3. Say what they would do next for each:
   - apply now
   - investigate more
   - build relationship

### Part 3: Debrief
Ask:

- Did the matches feel relevant?
- Did the difference between grant, open program, and relationship-led feel clear?
- Did you know what to do next?
- What felt confusing or missing?

## Success Criteria
The product is working if the user can:

- identify `3 to 5` plausible matches in under `10` minutes
- explain why at least `2 to 3` feel like a genuine fit
- state a believable next step without facilitator help

## Failure Signals
Fix the product before broad rollout if users:

- do not trust why a match was shown
- cannot tell whether something is open now or relationship-led
- cannot decide what to do next
- feel buried by too much data or too many options

## What To Capture
For each session, record:

- organisation name
- mission
- top `5` matches chosen
- which ones they saved
- where they got stuck
- what extra information they wanted

## Immediate Next Step
Use the pilot cohort export to choose the first `20 to 25` strongest foundations for testing and briefing:

- run `node --env-file=.env scripts/export-funding-pilot-cohort.mjs --limit=25 --out=output/funding-pilot-cohort.md`

That file becomes the working shortlist for the first real-user sessions.
