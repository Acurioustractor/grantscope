# National Philanthropy Operating System Blueprint

Date: 2026-04-18

## Purpose

Build a national operating system that makes Australian philanthropy legible.

Not just:

- who funds whom
- which grants are open
- which annual report said what

But the full operating picture:

- how each philanthropic place actually works
- which programs and portfolio strands it runs
- which people govern and carry those programs
- which organizations and communities they support
- what evidence exists from the work
- what need and place context surrounds that support
- how nonprofits can find, understand, approach, and build better relationships with aligned funders

This should be the combined system outcome of:

- `CivicGraph / GrantScope`
- `Empathy Ledger`
- the ACT-style `wiki / autoresearch / durable memory loop`

## Executive Thesis

The product is not a list of foundations.

It is a linked national memory of:

1. `institutions`
2. `programs and portfolio strands`
3. `people`
4. `relationships`
5. `place and need`
6. `evidence and consent`

That memory should be refreshed every year from annual reports, continuously enriched from transcripts and org activity, and surfaced through one clear interface for:

- funders
- nonprofits
- place-based leaders
- storytellers
- policy and philanthropy intermediaries

## Verified From The Snow Build

### CivicGraph / GrantScope already proves

- a foundation can be modeled as a real entity with ABN, board, giving scale, openness, and network position
- programs and grantee relationships can be connected to canonical external entities
- board roles can be linked to canonical people
- foundation records can become a public narrative + decision surface rather than just a backend row

### Empathy Ledger already proves

- an annual report can be stored, extracted, reviewed, and turned into structured objects
- those objects can link to:
  - contacts
  - services
  - projects
  - yearly service memory
- transcripts, storytellers, and analysis can sit beside the organizational record

### Snow-specific lessons already verified

Snow’s 2024 report can now yield real queue objects such as:

- `Snow Scholarships`
- `University of Canberra`
- `National Aboriginal Community Controlled Health Organisation`
- `RHD Strategy`
- `Tender Funerals Canberra Region`
- `Snow Entrepreneurs`

That is the key proof:

Annual reports can become portfolio maps, not just archived PDFs.

## Core System Model

### 1. CivicGraph / GrantScope = outside-in truth

This layer should answer:

- who the foundation is
- where it gives
- how much it gives
- who governs it
- which organizations and places it supports
- which open programs and opportunities it runs
- where it sits in the wider civic, philanthropic, and procurement system

Canonical objects:

- `foundation`
- `foundation_program`
- `person`
- `board_role`
- `grant_relationship`
- `partner_entity`
- `place`
- `need_signal`

### 2. Empathy Ledger = inside-out truth

This layer should answer:

- what the supported work actually is
- how the organization explains it
- which storytellers, staff, and partners belong to it
- which evidence is safe to use
- which stories, photos, and quotes are consented
- what annual reports and reporting artifacts say year by year

Canonical objects:

- `organization`
- `org_contact`
- `service`
- `project`
- `storyteller`
- `transcript`
- `annual_report`
- `annual_report_object`
- `service_year_snapshot`

### 3. Wiki / autoresearch loop = durable memory

This layer should answer:

- what a foundation’s portfolio strands mean
- what recurring programs are the same thing across years
- what place logic and philosophy a funder uses
- which source documents support those interpretations
- what has already been learned so the LLM does not re-derive everything every time

Canonical objects:

- `foundation_wiki_page`
- `program_wiki_page`
- `place_wiki_page`
- `evidence_pack`
- `research_brief`

## The Canonical Overlay For Every Foundation

Each foundation should resolve into one coherent overlay with these panes:

### A. Institutional profile

- ABN
- legal structure
- giving size
- board
- leadership
- staff / program leads
- geographic focus
- thematic focus
- openness / approachability / relationship posture

### B. Portfolio map

- named programs
- named initiatives
- named scholarship strands
- named place strategies
- recurring national / local priorities

Examples:

- `Snow Scholarships`
- `Snow Entrepreneurs`
- `RHD Strategy`

### C. Relationship graph

- grantees
- partners
- universities
- intermediaries
- place-based collaborators
- key people across those organizations

### D. Place + need overlay

- which parts of Australia the foundation is active in
- which need layers are present there
- where the capital is landing
- where the gaps remain

### E. Evidence and story layer

- annual reports
- reporting objects
- transcripts
- storytellers
- case examples
- consented media
- outcome evidence

### F. Opportunity and approach layer

- open grant programs
- inferred fit for nonprofits
- existing relationship paths
- adjacent trusted organizations
- language and strategic framing to use in outreach

## The Right Annual Report Model

Annual reports are the best national ingestion point because they already contain:

- the funder’s public self-description
- named programs
- partner organizations
- strategic language
- people
- financial splits
- outcomes
- photos and narrative evidence

But the main lesson from Snow is:

`PDF extraction is not the truth layer.`

The correct model is:

`PDF -> extracted objects -> human review -> durable linked memory`

### Recommended ingestion flow

1. `Capture`
   - add report PDF
   - create annual report row immediately

2. `Extract`
   - summary
   - sections
   - stats
   - achievements
   - financial highlights
   - photos

3. `Objectify`
   - create structured objects:
     - people
     - partners
     - services
     - programs
     - projects
     - outcomes
     - photos
     - financial lines

4. `Reconcile`
   - suggest links to existing:
     - services
     - projects
     - org contacts
     - storytellers
     - CivicGraph entities

5. `Review`
   - human accepts / edits / rejects objects

6. `Materialize`
   - accepted objects update durable records
   - service year snapshots created
   - project / service / contact memory extended

7. `Compose`
   - board memo
   - website copy
   - funder brief
   - story pack
   - place analysis

### Why this scales

Because every year becomes a structured delta, not a brand-new blob.

That allows:

- year-over-year program tracking
- recurring partner detection
- place strategy continuity
- better LLM retrieval
- easier nonprofit funder research

## Recommended Data Model

### Existing durable layers

Already the right shape:

- `foundations`
- `gs_entities`
- `gs_relationships`
- `person_roles`
- `foundation_people`
- `annual_reports`
- `org_contacts`
- `services`
- `projects`
- `storytellers`
- `project_storytellers`

### Required operating pattern

#### `service`

The durable thing the organization supports over time.

Examples:

- First Nations heart health support
- scholarship access
- social entrepreneur development

#### `project`

A year-specific, place-specific, or funding-specific expression of a service.

Examples:

- `Deadly Hearts Trek 2024`
- `Snow Scholarships 2024 intake`
- `Tender Funerals Canberra Region launch`

#### `service_year_snapshot`

The memory layer for what happened to a service in a specific year.

Fields should hold:

- fiscal year
- description
- activities
- outcomes
- metrics
- evidence
- linked projects

### Recommended new or extended object classes

For national scale, each report should be able to produce:

- `program`
  - recurring philanthropic strand
- `partner`
  - external organization or coalition
- `funder`
  - co-funder or aligned philanthropy actor
- `place_strategy`
  - ACT, South Coast, NT, remote, etc.
- `need_theme`
  - RHD, housing, domestic violence, sector capacity

Some of these can live initially as typed `annual_report_objects` before being normalized further.

## LLM Role Boundaries

The LLM should be used as a structuring and suggestion engine, not as the final authority.

### Good LLM jobs

- extract candidate objects from annual reports
- identify named programs, partners, and people
- suggest links to existing entities
- cluster recurring programs across years
- summarize portfolio strands
- draft board memos and outreach briefs
- suggest likely aligned funders for nonprofits

### Human review required for

- identity resolution of people
- new service creation
- new program normalization
- partner confirmation
- quotes
- photos
- consented story use
- any public narrative output

### Best practice

`LLM-assisted curation`, not `LLM-owned truth`

## How The ACT Wiki / Karpathy Loop Fits

The ACT infrastructure matters because this system needs durable memory, not one-off extraction.

### Correct division of labor

#### Supabase / app tables

Operational truth:

- entities
- reports
- contacts
- projects
- services
- story assets
- consent state

#### Wiki

Interpretive memory:

- what a portfolio strand is
- how Snow Entrepreneurs differs from Snow Scholarships
- which strategic pillar a program belongs to
- which organizations recur across years
- what is known but not yet normalized into structured tables

#### LLM loop

Ongoing research and synthesis:

- detect new annual reports
- detect changes in board / leadership
- propose new programs or partner links
- refresh foundation briefs
- draft comparison views across foundations

### Why this matters

Without the wiki layer, the system keeps rediscovering the same structure.

With the wiki layer, the system can remember:

- Snow Scholarships is a recurring scholarship strand
- RHD Strategy belongs to a First Nations health and systems-change portfolio
- Tender Funerals Canberra Region is both a place-based and social enterprise signal

That memory becomes reusable across:

- annual report review
- nonprofit pitch support
- relationship mapping
- landscape research

## What Nonprofits Need From This

This system should help nonprofits answer:

- which foundations are relevant to us
- how those foundations actually work
- what language they use
- what places and needs they prioritize
- who they already support
- who in their network overlaps with ours
- how to approach them with specificity

For each foundation, a nonprofit should be able to see:

- real programs and recurring strands
- real partner organizations
- real people
- real place logic
- real evidence of what the foundation cares about

That is how pitches improve:

- less generic asks
- better relationship paths
- better alignment to the funder’s actual behavior
- better long-term relationship building

## What Foundations Need From This

Foundations should be able to see:

- where their capital is actually landing
- which portfolio strands have evidence and which do not
- which places are over- or under-served
- which partners recur and why
- where community story evidence exists
- how board, staff, program, and community layers connect

That turns the system into:

- a board intelligence tool
- a reporting tool
- a portfolio learning tool
- a community evidence tool

## Product Surfaces To Build

### 1. Foundation profile

One page per foundation with:

- institutional profile
- board + leadership
- programs
- places
- partners
- recent annual reports
- current opportunities

### 2. Annual report review workspace

One page per report with:

- extracted objects
- exact-match suggestions
- create/link flows
- year snapshot generation

### 3. Portfolio strand view

One page per named strand:

- description
- years active
- linked projects
- linked partners
- linked places
- evidence and reporting artifacts

### 4. National philanthropy map

Cross-foundation view:

- who funds which themes
- where
- through whom
- with what gaps

### 5. Nonprofit funder-fit brief

Given an organization or project, produce:

- likely aligned foundations
- why they fit
- what relationship paths exist
- what language to use
- which evidence to lead with

## Scaling Model Across Australia

### Level 1: directory

Every foundation gets:

- identity
- ABN
- board
- annual giving
- open programs
- geography
- themes

### Level 2: portfolio intelligence

Each foundation gets:

- named programs
- partner graph
- annual report objects
- recurring strands across years

### Level 3: operating memory

Each foundation gets:

- staff and contact layer
- service and project history
- story and evidence layer
- consent-aware media and quotes

### Level 4: national intelligence

Cross-foundation analysis:

- overlap
- gaps
- place density
- theme density
- relationship pathways
- underfunded needs

## Concrete Next Build Steps

### P0

- generalize the Snow annual report object flow across more foundations
- create recurring-program normalization across years
- add canonical partner linking from annual report objects to CivicGraph entities

### P1

- add leadership / staff import alongside board
- add place strategy objects
- add need-theme overlays to foundation profiles

### P2

- build nonprofit-side funder-fit briefs
- build cross-foundation comparison pages
- build national philanthropy gap maps

## Minimal Technical Changes Still Needed

### In Empathy Ledger

- recurring strand normalization:
  - `programs` table or equivalent normalized program layer
- direct partner linking:
  - `linked_external_gs_id` on partner/project objects where appropriate
- annual report automation:
  - reliable extraction jobs with retry and completion tracking
- yearly memory:
  - keep generating `service_year_snapshots` from reviewed objects

### In CivicGraph / GrantScope

- richer foundation program ingestion from annual reports and websites
- partner and co-funder resolution into canonical entities
- place + need views for philanthropy overlays
- nonprofit-side discovery and pitch tooling

### In the wiki / research system

- one durable page per foundation
- one durable page per recurring program
- one durable page per place strategy
- automated research refresh prompts and review loops

## Biggest Strategic Insight

The moat is not “AI for grantseeking.”

The moat is:

- structured philanthropic memory
- linked to real entities
- linked to programs and partners
- linked to place and need
- linked to story, consent, and evidence
- refreshed every year through annual reports and live organizational activity

That is what can become the national philanthropic operating system for Australia.

## Final Position

Snow has shown the pattern.

The next move is not to build more one-off Snow pages.

It is to turn Snow’s working path into the default ingestion-and-review system for every foundation:

- capture
- extract
- review
- normalize
- link
- surface
- compare
- support better philanthropic relationships across the country
