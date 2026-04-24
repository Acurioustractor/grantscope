# GrantScope Operating Plan

Last updated: 2026-04-20

## Mission

GrantScope exists to make Australian philanthropy legible enough that:

- analysts can trust which foundations are real benchmark peers
- organisations and charities can work out which foundations are the best fit for their mission
- teams can move from vague prospecting to evidence-backed engagement strategy

The core shift is:

- from "find grants"
- to "understand foundations, align a mission, and build the right relationship strategy"

This is not just a foundation directory.
It is a philanthropy intelligence and engagement system.

## Product Promise

For any organisation, project, or mission, GrantScope should help a user answer:

- which foundations are relevant
- why they are relevant
- whether they are truly the best fit
- how to frame the work in that foundation's language
- what message, proof, and engagement path will most likely move the relationship forward

## Primary Users

### 1. Foundation analyst / philanthropy researcher

Job:

- decide which foundations are real benchmark peers or relevant prospects

Needs:

- reliable reviewability
- verified grants
- year memory
- source-backed evidence
- strong compare surfaces

Success:

- can confidently say which foundations are stable, developing, weak, or outside the benchmark lane

### 2. Organisation or charity seeking philanthropic partners

Example:

- A Curious Tractor

Job:

- decide which foundations to pursue for a given project, save them, compare fit, and shape a credible engagement strategy

Needs:

- shortlist foundations by mission fit, not only grant availability
- save foundations by project
- compare multiple foundations against one project
- see historical signals, themes, and likely appetite
- convert foundation research into outreach strategy and message alignment

Success:

- can answer "Should we pursue this foundation, for this project, now, and if so how?"

### 3. Internal partnerships / development lead

Job:

- turn project context, evidence, and foundation fit into a live prospecting pipeline

Needs:

- saved target lists
- project-specific fit notes
- talking points
- proof assets
- next action states

Success:

- can move from "interesting foundation" to "outreach-ready strategy" without stitching five systems together

## Core User Outcome

The most important user outcome is:

An organisation can take a real project, map it to the right philanthropic prospects, save those prospects, evaluate fit, and generate a relationship strategy grounded in each foundation's goals, evidence, and history.

That is the real product job.

Not:

- prettier compare pages
- more directory polish
- more one-off route work

## Canonical Workflow

### Benchmark workflow

Used by analysts and internal teams.

1. Open a foundation or compare route.
2. Assess whether the foundation is:
   - stable review
   - developing review
   - early review
   - outside benchmark lane
3. Understand what evidence is missing.
4. Upgrade via backlog or automation if the foundation matters.

### Engagement workflow

Used by organisations and charities.

1. Start with an organisation or project.
2. Define the project frame:
   - issue
   - geography
   - community
   - stage
   - evidence base
   - voice/story assets
3. Generate a fit-ranked foundation shortlist.
4. Save foundations into a project-specific prospect set.
5. For each foundation, answer:
   - why this foundation
   - why this project now
   - where the fit is strongest
   - where the mismatch is
6. Produce engagement strategy:
   - framing
   - key proof points
   - likely philanthropic language
   - first approach
   - relationship sequence

## Example: Curious Tractor

Curious Tractor is the clearest operating example because the work is not generic grant-seeking.
It is project-based, place-based, and narrative-heavy.

Example jobs:

- Which foundations are the best fit for JusticeHub?
- Which foundations are the best fit for The Three Circles?
- How should the same organisation frame different projects for different philanthropies?
- Which foundations care about:
  - communities
  - youth justice
  - early intervention
  - Indigenous leadership
  - systems change
  - place-based infrastructure
  - storytelling and field leadership

The system should let Curious Tractor:

- save Minderoo, Snow, PRF, Ian Potter, and others against a project
- compare them not just as foundations, but as project-fit options
- see the exact philanthropic hooks for each project
- track message alignment and next outreach move

## Example: Minderoo + JusticeHub / Three Circles

This is the best current proof of the deeper product direction.

The useful outcome was not merely:

- "Minderoo looks relevant"

The useful outcome was:

- align The Three Circles to Minderoo's Communities logic
- tie the work to Minderoo's own reports and strategic language
- show why the project sits upstream of major public system costs
- translate local governance, youth voice, and systems evidence into funder-native framing
- shape a message and artefact strategy that supports real engagement

This is the pattern to productise:

- project context
- foundation fit
- evidence alignment
- messaging alignment
- engagement strategy

## Product Modules

### 1. Foundation reviewability layer

Purpose:

- tell the truth about how trustworthy each foundation profile is

Current strength:

- strong and already partly built

Outputs:

- stable / developing / early / outside benchmark lane
- grants, year memory, provenance, governance

### 2. Foundation benchmark set

Purpose:

- create a trusted set of stable foundation references

Current strength:

- working

Outputs:

- review routes
- compare surfaces
- review set hub

### 3. Reviewability backlog and automation

Purpose:

- upgrade more foundations without manual rework

Current strength:

- working

Outputs:

- blocked vs actionable queues
- batch runner
- automation cadence

### 4. Organisation-to-foundation fit layer

Purpose:

- move from foundation intelligence to project-specific engagement decisions

This is the next major product layer.

Outputs:

- saved foundation lists per organisation/project
- project-to-foundation fit scoring
- "best fit for this project" views
- fit rationale and mismatch flags

### 5. Engagement strategy layer

Purpose:

- help users work out how to approach the foundation, not just whether to look at it

Outputs:

- project framing by foundation
- message alignment
- proof stack
- outreach sequence
- likely decision hooks

## Product North Star

GrantScope should become the place where a serious organisation can answer:

"Who should we engage, for which project, and how should we frame the work to fit that foundation's actual priorities?"

## KPIs

### System KPIs

- number of stable review foundations
- number of benchmark-ready compare pairs
- number of blocked foundations with explicit blocker reason
- foundations upgraded per week

### User KPIs

- number of saved foundations per organisation/project
- number of project-fit shortlists created
- number of engagement briefs generated
- time from project definition to outreach-ready shortlist

### Strategic KPI

- number of projects for which GrantScope can produce a credible "best-fit philanthropy strategy" without manual external synthesis

## What Has Actually Been Built

The work so far has created the base machinery for this product:

- the foundation reviewability model
- the stable benchmark set
- the compare truth layer
- the backlog and blocker taxonomy
- the batch upgrade runner
- live examples proving project-to-foundation strategy value, especially Minderoo / JusticeHub / Three Circles

This means the platform is no longer blocked on concept.
It is blocked on turning the foundation engine into a user-facing engagement workflow.

## What To Stop Doing

Stop spending primary energy on:

- more compare-page polish
- more backlog-page chrome
- more one-off navigation refinement
- bespoke foundation route work for weak foundations

These are now secondary.

## Highest-Impact Next Steps

### 1. Build project-based saved foundation sets

For an organisation or user, enable:

- create a project
- attach mission, place, issue, and proof context
- save candidate foundations to that project

This is the first real bridge from benchmark intelligence to user value.

### 2. Build foundation-fit notes per saved project

For each saved foundation, support:

- fit summary
- strongest alignment
- likely objection or mismatch
- suggested next move

### 3. Build project-to-foundation compare

Not only:

- foundation vs foundation

But:

- project vs foundation
- project vs shortlisted foundations

This is the real decision surface for organisations.

### 4. Build engagement strategy output

For each saved foundation:

- key framing
- language to lean into
- evidence to lead with
- relationship strategy
- outreach brief

### 5. Use Curious Tractor as the canonical operating example

Set up at least three live example projects:

- JusticeHub
- The Three Circles
- one additional project with a clearly different philanthropic fit

This will prove:

- one organisation
- multiple projects
- different best-fit philanthropies
- different messages and strategies

## Suggested 2-Week Milestone

Ship the first end-to-end engagement workflow for one organisation.

Recommended milestone:

- "Curious Tractor can create a project, save foundations, compare fit, and generate an outreach-ready strategy for Minderoo and at least two other foundations."

Definition of done:

- saved project set exists
- foundation shortlist exists
- fit reasoning exists
- engagement notes exist
- the system can explain why one foundation is stronger than another for the same project

## Strategic Discipline

The platform should keep these roles clear:

- foundation reviewability tells you whether the foundation profile is trustworthy
- benchmark comparison tells you how foundations relate to each other
- project fit tells you whether a foundation is right for your specific mission
- engagement strategy tells you what to do next

That sequence is the real product arc.

## Final Product Test

GrantScope is succeeding when a user can say:

- "I know which foundations matter."
- "I know which one fits this project best."
- "I know why."
- "I know how to approach them."

That is the mission-aligned result.
