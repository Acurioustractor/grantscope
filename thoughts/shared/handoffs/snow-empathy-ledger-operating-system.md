# Snow + Empathy Ledger Operating System

Date: 2026-04-18

## Verified Current State

### CivicGraph / GrantScope

- Snow foundation: `The Trustee For The Snow Foundation`
- ABN: `49411415493`
- Foundation ID: `d242967e-0e68-4367-9785-06cf0ec7485e`
- Annual giving: `$13.7M`
- Verified 2024 grants: `44`
- Open programs: `12`
- Snow board roles in `person_roles`: `9`
- Snow board roles linked to canonical people: `9`
- Snow rows in `foundation_people`: `9`

### Empathy Ledger

- Snow organization ID: `4a1c31e8-89b7-476d-a74b-0c8b37efc850`
- Active projects: `1`
- Active Snow-linked project: `Deadly Hearts Trek`
- Storyteller links via `project_storytellers`: `7`
- Transcripts: `4`
- Annual reports: `0`

### Existing Empathy Ledger schema already relevant

- `annual_reports`
  - holds `pdf_url`, `pdf_storage_path`, `report_year`, `fiscal_year`, `extracted_sections`, `extracted_stats`, `extracted_summary`, `readiness_score`, `readiness_breakdown`, `sections_config`
- `projects`
  - holds `organization_id`, `name`, `description`, `status`, `service_id`, `act_project_code`, `external_references`
- `services`
  - holds `organization_id`, `name`, `description`, `service_type`, `gallery_id`, `metadata`
- `org_contacts`
  - holds `display_name`, `role_category`, `role_title`, `organization_name`, `external_gs_id`, `linked_storyteller_id`, `abn`, `bio`
- `storyteller_organizations`
  - org-level storyteller relationship layer
- `project_storytellers`
  - project-level storyteller assignment layer

### Existing Empathy Ledger APIs already relevant

- annual report section generation:
  - `/src/app/api/organizations/[id]/annual-reports/[reportId]/sections/[key]/generate/route.ts`
- annual report readiness scoring:
  - `/src/app/api/organizations/[id]/annual-reports/[reportId]/readiness/route.ts`
- services/project content summary:
  - `/src/app/api/organizations/[id]/services-overview/route.ts`

## What This Means

The system is closer than it looks.

We do not need to invent a brand-new annual-report platform.

Empathy Ledger already has:

- a report container
- extraction fields
- AI section generation
- readiness scoring
- project/storyteller linkage
- a service layer

What is missing is not the existence of the parts. What is missing is the operating loop that keeps them fed, linked, and reviewable year after year.

## Best System Model

### 1. CivicGraph = outside-in truth

This is where the system should answer:

- who the organization is
- who governs it
- where capital flows
- what programs and grants it runs
- what entities, board members, and partners sit around it

For Snow specifically, CivicGraph should remain the place where:

- board members are canonical people
- foundation programs are tracked
- grantee entities are linked
- philanthropic network intelligence is computed

### 2. Empathy Ledger = inside-out truth

This is where the system should answer:

- what projects and services actually feel like
- who can speak from them
- what is safe to share
- which photos, quotes, and stories are consented
- how the organization explains its year in human terms

### 3. Wiki / Karpathy-style loop = durable memory

This is where the system should answer:

- what something is
- how it fits into the wider field
- which sources support that interpretation
- what has already been learned and should not be re-derived every time

The ACT model is already explicit:

- wiki = brain
- Empathy Ledger = live field layer
- Supabase = ledger
- websites = public composition

That is the right pattern for a Snow-like system too.

## The Missing Operating Loop

The missing loop is:

1. capture annual report
2. parse and chunk it
3. extract structured portfolio objects
4. link those objects to real services/projects/people
5. score readiness
6. generate reviewable sections
7. publish only what has human and consent review
8. keep the extracted objects reusable for next year

Right now, Empathy Ledger has pieces of steps 2, 5, and 6, but not the full end-to-end loop.

## How Annual Reports Should Enter Empathy Ledger

### Recommended ingestion flow

1. Upload PDF into `annual_reports`
2. Create one `annual_reports` row immediately with:
   - `organization_id`
   - `report_year`
   - `fiscal_year`
   - `pdf_storage_path`
   - `pdf_url`
   - `status = 'draft'`
   - `extraction_status = 'queued'`
3. Run document extraction job
4. Save outputs into:
   - `extracted_summary`
   - `extracted_sections`
   - `extracted_stats`
   - `extracted_photos`
   - `statistics`
   - `metadata`
5. Run section readiness scoring
6. Generate report sections against the extracted data plus live org data
7. Require human review before any section becomes approved

### Recommended chunking model

The report should be chunked into four parallel layers:

- `narrative chunks`
  - chair message, CEO report, about, outlook
- `program/service chunks`
  - named services, named programs, named projects, named partner initiatives
- `financial chunks`
  - revenue, expenses, grants, program spend, year-specific numbers
- `media/evidence chunks`
  - photos, captions, quoted evidence, named case examples

That matters because a single chunk should be reusable across:

- annual report generation
- website updates
- board memo generation
- funder brief generation
- storyteller or photo matching
- future year comparisons

### Minimal TS / data changes needed

Not a rewrite. A small extension.

#### Add an extraction job layer

Current `annual_reports` already has enough fields to receive extraction output. What is missing is a durable job orchestration path.

Recommended addition:

- `annual_report_jobs`
  - `report_id`
  - `job_type`
  - `status`
  - `attempt_count`
  - `started_at`
  - `completed_at`
  - `error`
  - `output_metadata`

This avoids overloading `annual_reports.extraction_status` as the only state surface.

#### Add structured extracted objects

Current `extracted_sections` and `extracted_stats` are useful, but not enough if we want reuse across years.

Recommended addition:

- `annual_report_objects`
  - `report_id`
  - `object_type`
    - `service`
    - `program`
    - `project`
    - `partner`
    - `funder`
    - `board_member`
    - `staff_member`
    - `quote`
    - `photo`
    - `financial_line`
  - `label`
  - `source_page`
  - `raw_excerpt`
  - `structured_payload`
  - `link_status`
  - `linked_service_id`
  - `linked_project_id`
  - `linked_storyteller_id`
  - `linked_contact_id`
  - `linked_external_gs_id`

This becomes the review queue.

### Why this is better than only storing JSON in `annual_reports`

Because JSON is fine for one report, but weak for:

- year-over-year comparison
- analytics
- reuse across multiple views
- explicit human review workflows
- linking to storytellers, contacts, services, projects, and CivicGraph entities

## How Services and Programs Should Be Added By Year

The current EL schema is already very close:

- `services` = durable operating service
- `projects` = initiative / strand / campaign / funded work
- `projects.service_id` = existing bridge

That means the clean model is:

- `service` = durable thing the org does
  - example: RHD support / community heart health / women’s leadership / regional place work
- `project` = year-specific or funding-specific expression of that service
  - example: Deadly Hearts Trek 2024
  - example: South Coast capacity program 2025

### Recommended pattern

#### Durable layer

Use `services` for the things that persist across years.

Fields already exist:

- `organization_id`
- `name`
- `description`
- `service_type`
- `metadata`

Recommended `metadata` additions:

- `start_year`
- `end_year`
- `program_codes`
- `focus_areas`
- `geographies`
- `primary_partner_ids`
- `external_gs_ids`

#### Year / funding layer

Use `projects` for year-specific portfolio objects.

Recommended pattern:

- one project row per meaningful annual strand or funding-backed initiative
- always attach `service_id` when the project is one year of a recurring service
- use `act_project_code` or `external_references` for annual report or funder identifiers

Examples for Snow:

- `service`: Rheumatic Heart Disease Systems Change
- `project`: Deadly Hearts Trek 2024
- `project`: Deadly Hearts Trek 2025
- `service`: South Coast Place-Based Community Strengthening
- `project`: South Coast Snapshot 2025

### Missing yearly comparison layer

Recommended addition:

- `service_year_snapshots`
  - `service_id`
  - `report_id`
  - `year`
  - `summary`
  - `participants_count`
  - `locations`
  - `funders`
  - `budget`
  - `outcomes`
  - `evidence_count`
  - `photo_count`
  - `storyteller_count`
  - `metadata`

This gives the report system something much stronger than ad hoc project counting.

## How Staff, Board, Partners, and Storytellers Should Work

### Board / leadership / staff

Use `org_contacts` as the primary people registry for institutional roles.

Use `role_category` consistently:

- `board`
- `leadership`
- `staff`
- `partner`
- `funder`
- `supporter`
- `advisor`

Important additions in practice:

- `external_gs_id` should hold the CivicGraph person/entity link when available
- `linked_storyteller_id` should only be used where a contact is also an actual storyteller
- board and staff should not be forced into the storyteller model unless they are telling lived or field-grounded story content

### Storytellers

Use `storyteller_organizations` for organization membership and `project_storytellers` for actual project assignment.

That is already the correct pattern in EL.

The main discipline required:

- org-level relationship does not imply project-level relevance
- storyteller inclusion in reports should be project-specific where possible
- photos and quotes should resolve back to storyteller and consent state at query time

### Partners and funders

Use `org_contacts` for relationship owners and partner/funder records.

For Snow-like orgs, this matters because a single annual report should be able to say:

- who governed the organization
- who led it
- who funded or partnered specific strands
- which storytellers or communities can speak from those strands

That is much richer than a flat donor list.

## Photo, Consent, and Real Story

This is where the system becomes meaningfully different.

The ACT wiki material is right about this: consent is not a checkbox. It is ongoing infrastructure.

That means:

- annual-report ingestion should never auto-publish extracted photos
- photos should link back to `media_assets`
- any quote or image used in generated sections should be checked against current consent state
- attribution and syndication permissions should be separate from simple “public/private”

### Practical rule

The report generator can suggest:

- quotes
- stories
- photos
- partner mentions

But it should not silently embed them into publishable output without:

- current consent check
- attribution check
- cultural or elder review check where required

That is how Snow or any other funder gets closer to real story without reverting to extractive storytelling.

## How the ACT / Karpathy Wiki Loop Supports This

The ACT wiki is useful here because it prevents EL and Supabase from becoming a second fuzzy knowledge base.

### What the wiki should hold

- durable explanation of a funder or org
- recurring services and program logic
- named clusters or portfolio strands
- project context
- partner context
- editorial and strategic synthesis

### What EL should hold

- live stories
- live transcripts
- live photos and video
- storyteller assignments
- annual report drafts and review state

### What Supabase should hold

- object links
- extraction results
- readiness scores
- year-specific snapshots
- relationship and sync state

### What this means in practice

The Karpathy-style loop scales because agents do not have to “remember” the system from scratch every time.

They can:

1. read the wiki for durable framing
2. read CivicGraph for system and relationship data
3. read EL for live story/media/proof
4. emit new structured objects back into Supabase
5. write synthesis back into the wiki

That is the compounding loop.

Without it, each annual report becomes a one-off project.

With it, every annual report makes the system better for next year.

## How This Scales Across Organizations

This system scales well if the boundary between layers stays strict.

### Scale rule

Do not make every organization into a custom product.

Instead:

- keep the shared schema
- let each org differ through linked objects and content volume
- let CivicGraph provide outside-in structure
- let EL provide inside-out evidence
- let the wiki provide durable meaning only where needed

### What changes per organization

- number of services
- number of projects
- number of storytellers
- number of partners/funders
- consent complexity
- annual report shape

### What should not change per organization

- the ingestion loop
- the object model
- the readiness scoring model
- the project/service/storyteller/contact relationship logic
- the split between durable memory and live content

## How Much Technical Change Is Actually Needed

Less than it seems.

### Already present

- annual report container
- section generation
- readiness scoring
- service table
- project table
- storyteller org/project junctions
- contact table
- content and media layers
- CivicGraph outside-in graph

### Needs adding

- extraction jobs
- extracted object review layer
- service-year snapshot layer
- stronger org contact discipline
- explicit CivicGraph IDs on people/partners/funders
- current-consent checks inside report/media composition

### Estimated change shape

- TypeScript/API work: moderate
- schema work: moderate
- analysis/prompting work: moderate
- product architecture rewrite: not required

This is extension work, not reinvention.

## What This Opens Up

For Snow:

- board-ready reports grounded in real people, programs, and evidence
- partner and grantee maps tied to real projects
- year-over-year portfolio memory
- ethical use of quotes and photos
- clearer link from philanthropy to lived experience

For other organizations:

- one content system instead of scattered docs, PDFs, stories, and CRM notes
- stronger annual reports with less manual rework
- durable service/program memory by year
- a shared operating model for staff, board, partners, and storytellers
- better grant, procurement, and partnership opportunities because the org becomes legible

For ACT overall:

- the ability to treat annual reporting as a compounding knowledge loop
- better field-level evidence without flattening community context
- a path from funder intelligence to community story that is consent-aware and operationally reusable

## Recommended Next Build Order

1. Add Snow board and leadership contacts into EL `org_contacts`
2. Create the first Snow `annual_reports` row and upload the 2024 PDF
3. Add extraction job orchestration and review state
4. Create extracted object review for services, projects, partners, board/staff, and quotes
5. Backfill Snow service + project structure
   - durable service rows
   - project rows by year / strand
6. Link project rows to storytellers, transcripts, and media
7. Add consent-aware quote/photo suggestion inside annual report generation
8. Generalize the loop so other organizations can use the same pattern

## Recommendation

Do not think of this as “Snow’s annual report feature.”

Think of it as:

`CivicGraph relationship intelligence + Empathy Ledger annual report operating system + wiki memory loop`

That stack is the product.

Snow is just the clearest first demonstration of it.
