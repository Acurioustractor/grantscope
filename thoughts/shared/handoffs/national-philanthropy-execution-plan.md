# National Philanthropy Operating System Execution Plan

Date: 2026-04-18

Companion documents:

- [national-philanthropy-operating-system-blueprint.md](/Users/benknight/Code/grantscope/thoughts/shared/handoffs/national-philanthropy-operating-system-blueprint.md)
- [snow-empathy-ledger-operating-system.md](/Users/benknight/Code/grantscope/thoughts/shared/handoffs/snow-empathy-ledger-operating-system.md)

## Objective

Turn the Snow pattern into a repeatable national system that:

- maps how philanthropic institutions actually operate
- turns annual reports into structured portfolio memory
- links programs, people, partners, place, and evidence
- helps nonprofits find, understand, and approach aligned funders better

This plan covers:

1. exact schema changes
2. exact UI surfaces
3. exact ingestion jobs
4. first five foundations to onboard after Snow

## What Is Already Proven

Verified from current Snow work:

- CivicGraph can represent a funder with board, programs, giving scale, and linked people
- Empathy Ledger can store annual reports, extract them, create review objects, and link those objects to services, projects, contacts, and yearly service memory
- Snow’s live queue now contains named objects including:
  - `Snow Scholarships`
  - `University of Canberra`
  - `National Aboriginal Community Controlled Health Organisation`
  - `RHD Strategy`
  - `Tender Funerals Canberra Region`
  - `Snow Entrepreneurs`

That means the architecture is no longer hypothetical.

## Build Sequence

### Phase 1: normalize Snow into a reusable pattern

- finish program normalization across years
- add partner linking from annual report objects to CivicGraph entities
- add staff / leadership import alongside board
- stabilize extract job orchestration

### Phase 2: onboard five additional foundations

- use the same report-object review flow
- compare where the model holds and where new object types are needed
- build common abstractions only after the second and third foundation, not before

### Phase 3: expose nonprofit-facing discovery and pitch support

- funder fit briefs
- relationship path views
- place and need overlays

### Phase 4: cross-foundation intelligence

- theme density
- place density
- co-funding overlap
- underfunded needs
- portfolio comparisons

## Exact Schema Changes

### A. Empathy Ledger

These are the minimum durable additions beyond what already exists.

#### 1. `programs`

Purpose:

- hold recurring philanthropic portfolio strands across years
- sit above year-specific `projects`

Suggested fields:

- `id`
- `organization_id`
- `name`
- `slug`
- `description`
- `program_type`
- `status`
- `start_year`
- `end_year`
- `thematic_tags text[]`
- `place_tags text[]`
- `external_references jsonb`
- `metadata jsonb`

Relationships:

- `projects.program_id -> programs.id`
- optional `annual_report_objects.linked_program_id -> programs.id`

Why:

- `Snow Scholarships` is not just a one-year project
- `Snow Entrepreneurs` is a recurring strand
- `RHD Strategy` is a portfolio strand, not just one output

#### 2. Extend `annual_report_objects`

Current shape is good, but extend it for national foundation onboarding.

Add:

- `linked_program_id uuid`
- `linked_external_gs_id uuid`
- `linked_foundation_id uuid`
- `normalized_name text`
- `object_group text`
- `review_priority integer default 0`
- `source_page_range text`
- `raw_excerpt text`

Why:

- we need direct bridge points into CivicGraph entities and recurring programs
- we need better human-review prioritization

#### 3. `annual_report_jobs`

Purpose:

- separate document-processing job state from the report row itself

Fields:

- `id`
- `report_id`
- `job_type`
  - `download`
  - `extract`
  - `objectify`
  - `reconcile`
  - `readiness`
  - `section_generate`
- `status`
- `attempt_count`
- `started_at`
- `completed_at`
- `error_message`
- `output_metadata jsonb`

Why:

- `annual_reports.extraction_status` is too coarse for a multi-step job graph

#### 4. `program_year_snapshots`

Purpose:

- preserve what happened for recurring programs each year, not just services

Fields:

- `id`
- `program_id`
- `report_id`
- `fiscal_year`
- `snapshot_status`
- `summary`
- `outcomes_summary`
- `activities_summary`
- `metrics jsonb`
- `evidence jsonb`
- `metadata jsonb`

Why:

- some foundation logic is program-led rather than service-led

#### 5. Extend `org_contacts`

Add or ensure:

- `external_gs_id`
- `foundation_role_type`
  - `board`
  - `leadership`
  - `staff`
  - `program_lead`
  - `partner_lead`
- `program_id`
- `project_id`

Why:

- people need to sit inside the operating picture, not just the org shell

### B. CivicGraph / GrantScope

#### 1. `foundation_programs`

Purpose:

- normalize the named public-facing program layer for foundations

Fields:

- `id`
- `foundation_id`
- `name`
- `slug`
- `description`
- `program_type`
- `status`
- `place_focus text[]`
- `thematic_focus text[]`
- `application_mode`
- `source_urls text[]`
- `metadata jsonb`

Why:

- `open_programs` JSON is not enough for a durable national product

#### 2. `foundation_program_years`

Purpose:

- preserve how programs evolve each year

Fields:

- `id`
- `foundation_program_id`
- `report_year`
- `fiscal_year`
- `summary`
- `reported_amount`
- `partners jsonb`
- `places jsonb`
- `outcomes jsonb`
- `source_report_url`
- `metadata jsonb`

#### 3. `foundation_partner_relationships`

Purpose:

- canonical foundation -> partner organization links

Fields:

- `id`
- `foundation_id`
- `partner_entity_id`
- `relationship_type`
  - `grant_recipient`
  - `program_partner`
  - `co_funder`
  - `intermediary`
  - `delivery_partner`
- `amount`
- `year`
- `source`
- `source_record_id`
- `properties jsonb`

#### 4. `foundation_place_strategies`

Purpose:

- distinguish broad national giving from explicit place-based strategy

Fields:

- `id`
- `foundation_id`
- `place_key`
- `place_name`
- `place_type`
- `strategy_name`
- `summary`
- `thematic_focus text[]`
- `source_urls text[]`
- `metadata jsonb`

#### 5. Extend foundation people model

Ensure all candidate foundations support:

- board
- leadership
- program leads
- partner leads where public

If `foundation_people` remains board-only, add `role_scope` and `role_category` support.

## Exact UI Surfaces

### A. GrantScope / CivicGraph

#### 1. `/foundations/[id]`

Upgrade foundation detail to include:

- institutional profile
- canonical board and leadership
- recurring programs
- partner network
- place strategies
- annual report timeline
- open opportunities
- “fit and approach” guidance for nonprofits

#### 2. `/foundations/[id]/programs/[programId]`

New surface:

- recurring program strand
- years active
- partners
- places
- linked annual report mentions
- linked projects in Empathy Ledger

#### 3. `/foundations/[id]/places/[placeKey]`

New surface:

- place strategy
- active partners
- known need signals
- grants and projects in that geography

#### 4. `/foundations/[id]/network`

New surface:

- graph of foundation, programs, people, partners, and places

#### 5. `/fit/foundations?q=...`

New nonprofit-side surface:

- ranked aligned funders
- why they fit
- key programs
- who they already support
- likely approach language

### B. Empathy Ledger

#### 1. `/organisations/[id]/annual-report`

Extend current builder with:

- object review queue tabs by type
- exact-match and fuzzy-match suggestions
- “promote to program” action
- “link to CivicGraph entity” action
- yearly snapshot generation status

#### 2. `/organisations/[id]/programs`

New surface:

- recurring portfolio strands
- linked projects by year
- linked storytellers
- linked annual reports

#### 3. `/organisations/[id]/programs/[programId]`

New surface:

- strand summary
- timeline by year
- partner orgs
- contacts
- storytellers
- evidence packs
- photos and consent state

#### 4. `/organisations/[id]/relationships`

New surface:

- board
- leadership
- staff
- partner leads
- linked storytellers
- external CivicGraph entities

#### 5. `/organisations/[id]/portfolio-map`

New surface:

- organization
- programs
- projects
- services
- partners
- storytellers
- evidence

### C. Cross-system shared surface

#### `/snow-foundation` pattern generalized to `/foundations/[id]/overview`

One public-facing decision page that can bridge:

- CivicGraph foundation detail
- annual report intelligence
- Clarity handoff
- Empathy Ledger evidence surfaces

## Exact Ingestion Jobs

### A. Foundation discovery jobs

#### 1. `foundation-profile-refresh`

Inputs:

- foundation website
- ACNC / ABN metadata
- known scraped URLs

Outputs:

- refreshed profile copy
- board candidate rows
- program candidate rows
- place strategy candidates

Cadence:

- monthly

#### 2. `foundation-opportunities-refresh`

Inputs:

- website
- grants portal
- application pages

Outputs:

- normalized `grant_opportunities`
- `foundation_programs` updates

Cadence:

- daily or weekly for active opportunity sources

### B. Annual report jobs

#### 3. `annual-report-detect`

Inputs:

- known foundation report URLs
- sitemap pages
- annual report landing pages

Outputs:

- new `annual_reports` rows
- queued extraction jobs

Cadence:

- monthly

#### 4. `annual-report-download`

Outputs:

- stored PDF
- document metadata

#### 5. `annual-report-extract`

Outputs:

- summary
- sections
- stats
- achievements
- financial highlights
- photos

#### 6. `annual-report-objectify`

Outputs:

- `annual_report_objects`
  - people
  - partners
  - programs
  - projects
  - services
  - outcomes
  - financial lines
  - photos

#### 7. `annual-report-reconcile`

Outputs:

- suggested matches to:
  - programs
  - projects
  - services
  - contacts
  - storytellers
  - CivicGraph entities

#### 8. `annual-report-materialize`

Human-approved outputs become:

- `programs`
- `projects`
- `services`
- `org_contacts`
- `program_year_snapshots`
- `service_year_snapshots`
- CivicGraph partner / program links

### C. Relationship intelligence jobs

#### 9. `foundation-partner-entity-linker`

Purpose:

- resolve named partner objects into canonical CivicGraph entities

#### 10. `recurring-program-clusterer`

Purpose:

- detect when program names across years represent the same strand

#### 11. `funder-fit-brief-generator`

Purpose:

- given a nonprofit or project, produce a shortlist of aligned foundations with reasoning

## LLM System Design

### Role of the LLM

The LLM should do:

- extraction
- candidate naming
- reconciliation suggestion
- clustering suggestion
- summarization
- drafting

The LLM should not be the final source of truth for:

- identity resolution
- consent
- quote publication
- partner confirmation
- public claims

### Recommended system layering

#### Layer 1: extraction agents

- read PDFs
- return typed candidate objects

#### Layer 2: reconciliation agents

- compare candidates against:
  - known programs
  - known projects
  - known people
  - known CivicGraph entities

#### Layer 3: research agents

- update foundation wiki
- refresh comparative briefs
- surface missing data and likely new sources

#### Layer 4: composition agents

- board memo
- portfolio brief
- nonprofit fit brief
- story pack

### Required review controls

- show exact source text for every extracted object
- require human review for high-impact link actions
- track who approved each object
- keep raw extraction separate from normalized truth

## First Five Foundations After Snow

Selection criteria:

- real philanthropic operating system, not just large charity revenue
- enough current data to make onboarding efficient
- diversity of philanthropic model
- national product value
- good test of the annual-report object flow

### 1. Paul Ramsay Foundation

Why first:

- strongest current coverage after Snow
- `high` profile confidence
- `$320M` annual giving
- `17` board members already present
- `17` `foundation_people` rows already linked
- `9` linked opportunities
- broad national social impact footprint

What it tests:

- high-scale independent philanthropy
- strong governance layer
- likely richer annual report and portfolio structure

### 2. Minderoo Foundation

Why second:

- `high` profile confidence
- `$210.1M` annual giving
- major thematic spread across:
  - Indigenous
  - early childhood
  - environment
  - gender equality
  - health
  - AI
- national + WA + international footprint

What it tests:

- multi-domain portfolio logic
- complex place + theme overlays
- broad recurring program taxonomy

### 3. Rio Tinto Foundation

Why third:

- `high` profile confidence
- `$153.7M` annual giving
- `1` open program already
- `9` linked opportunities
- explicit Indigenous, place, employment, and cultural heritage themes

What it tests:

- corporate-foundation model
- community investment plus opportunity program layer
- strong place-based mining-region logic

### 4. The Ian Potter Foundation

Why fourth:

- `high` profile confidence
- established private philanthropy brand
- strong thematic breadth with arts, health, education, environment, rural/remote
- useful contrast to Snow and Paul Ramsay

What it tests:

- classic private foundation structure
- broad but curated grantmaking logic
- nonprofit-side fit and approach tooling

### 5. ECSTRA Foundation

Why fifth:

- `high` profile confidence
- `4` open programs already
- unusually explicit issue framing around:
  - financial wellbeing
  - financial literacy
  - financial inclusion
  - women
  - youth
  - Indigenous communities
- easier program normalization because the portfolio language is clearer

What it tests:

- smaller but cleaner program-led foundation model
- explicit recurring program architecture
- strong use case for funder-fit briefs

### Reserve candidates

These should follow next depending on product priority:

- `AUSTRALIAN COMMUNITIES FOUNDATION`
  - tests intermediary / community foundation model
- `The Myer Foundation`
  - important heritage funder, but current record is lower-confidence
- `BHP Foundation`
  - large, but current governance / people data is thinner

## Exact Rollout Order

### Sprint 1

- Snow hardening
- Paul Ramsay Foundation onboarding
- program normalization schema

### Sprint 2

- Minderoo Foundation onboarding
- partner entity linking
- place strategy surfaces

### Sprint 3

- Rio Tinto Foundation onboarding
- corporate foundation model refinements
- open opportunity + annual report merger

### Sprint 4

- Ian Potter Foundation onboarding
- nonprofit-side fit briefs

### Sprint 5

- ECSTRA Foundation onboarding
- recurring program comparison view

## Deliverables By End Of Phase 2

- 6 fully modeled foundations including Snow
- normalized recurring program layer
- annual report object review flow stable across multiple institutions
- linked people / partners / places / programs
- public foundation overlays
- internal nonprofit funder-fit brief generator

## Immediate Next Build Tasks

1. Add `programs` and `program_year_snapshots` to Empathy Ledger.
2. Add `foundation_programs` and `foundation_program_years` to CivicGraph.
3. Extend `annual_report_objects` with program and CivicGraph link fields.
4. Add `annual_report_jobs`.
5. Build the `/organisations/[id]/programs` and `/foundations/[id]/programs/[programId]` surfaces.
6. Onboard Paul Ramsay Foundation as the first non-Snow validation case.
