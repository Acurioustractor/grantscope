# Phase 1 — Project Funding Operating System

**Status:** implementation-ready plan  
**Date:** 3 August 2026  
**Primary user:** Ben / ACT  
**Portfolio:** all canonical A Curious Tractor projects and initiatives  
**Phase length:** four weeks  

## Outcome

At the end of phase one, Ben can open ACT, choose any core A Curious Tractor project, and receive a small list of grants and other funding routes that are:

- current and linked to official evidence;
- legally eligible or explicit about the partner/applicant route required;
- matched to a concrete project funding need;
- clear about amount, deadline, effort, missing evidence and next action;
- promotable by a human into the HighLevel Grants pipeline;
- linked to a Notion application brief only after promotion; and
- refreshed automatically before a bounded weekly review.

Goods on Country and Harvest are benchmark cases because they exercise difficult applicant, geography and private/public-benefit rules. They are not the boundary of the product. Phase one is successful when this becomes a dependable portfolio-wide weekly operating habit, not when the database contains more rows.

## Product decision

Use one system for each job:

| System | Owns |
|---|---|
| GrantScope | Project profiles, source evidence, eligibility, matching, decision, freshness and learning |
| HighLevel | Promoted opportunity, responsible person, concrete next action, operational stage and due date |
| Notion / Drive | Working application brief, narrative, budget draft, attachments and collaborative review |
| Gmail | Communication evidence |
| Xero | Invoices and realised money |
| Goods Asset Register | Goods production and deployment truth |

GrantScope is the only funding discovery and decision pipeline. HighLevel and Notion receive explicit handoffs; neither sends unreviewed bulk records back into the weekly queue.

## User experience

### Project funding page

Route shape:

`/org/act/projects/{project}/funding`

The first release is generated from the canonical ACT project registry and has five sections. Adding or archiving a project must not require a new hard-coded page or matching implementation.

### 1. Funding need

Show the active project profile:

- applicant entities and partner routes;
- beneficiaries and delivery geography;
- outcomes;
- funding blocks and amounts;
- eligible instruments;
- evidence already available;
- legal/ownership constraints;
- missing decisions.

The user can edit or confirm the profile. Every match is versioned against the profile used.

### 2. Apply now

Maximum ten verified candidates, ordered by actionability rather than generic similarity.

Each card shows:

- opportunity and funder;
- official source and last verified time;
- amount and deadline;
- recommended applicant;
- fundable project block;
- hard eligibility result;
- why it fits;
- why it might fail;
- missing evidence;
- effort estimate;
- relationship route;
- `Pursue`, `Watch`, `Pass` and `Verify` actions.

### 3. Major opportunities

Maximum five strategic opportunities across grants, philanthropy, procurement, investment, loans or in-kind support.

An opportunity appears here only when it has:

- material value or strategic leverage;
- a concrete use of funds;
- a plausible applicant/partner route;
- current evidence or a named relationship pathway; and
- a next decision or action.

### 4. Weekly queue

Maximum five matters across both projects. A matter enters because:

- a deadline is approaching;
- an official source changed;
- eligibility evidence was resolved;
- a relationship or commitment changed;
- a human review is due; or
- a promoted pursuit has an overdue action.

### 5. Source health

Show only actionable health information:

- failing priority source;
- source returning zero records unexpectedly;
- current grants lacking recent verification;
- scheduled job timed out;
- project geography with weak coverage.

## Portfolio and project profiles

### Canonical ACT portfolio

Phase one must support every canonical active ACT project, currently including:

- ACT Core / studio operating model;
- CivicGraph / GrantScope;
- Empathy Ledger;
- Goods on Country;
- Harvest;
- Farm / BCV;
- Contained;
- Gold.Phone;
- JusticeHub;
- Mounty Yarns;
- PICC / Palm Island Community Company work; and
- shared infrastructure / ALMA / Wiki / AI systems when returned to active funding scope.

The list is data-driven from `org_projects` plus explicit aliases. The recommendation registry must reference canonical project IDs rather than acting as a second project registry.

Each project receives the same profile contract. Profile depth can mature over time, but no active project is excluded from discovery because it lacks a bespoke JSON file.

### Common project profile contract

Every project profile contains:

- canonical project identity and aliases;
- project purpose, outcomes and current maturity;
- applicant and contracting entities;
- partner-led or auspice pathways;
- delivery places and eligible geographies;
- beneficiaries and community-authority requirements;
- evidence, proof and reusable assets;
- funding blocks, target amounts and eligible costs;
- acceptable capital instruments;
- arts and cultural dimensions where relevant;
- legal, ownership, consent and private-benefit constraints;
- relationships and potential connectors; and
- unresolved decisions that block credible pursuit.

Profiles should be stored in the database as versioned portfolio data. Existing project-specific JSON profiles become importable evidence or test fixtures, not the only way a project participates.

### Goods on Country

Extend the existing `scripts/funding-profiles/goods-on-country.json` and make it visible/editable in the project page.

Required profile facts:

- ACT / Goods trading entities;
- The Butterfly Movement and other potential charity routes;
- Indigenous ownership/control facts must be explicit and never inferred;
- NT-based partner and Aboriginal corporation routes;
- product/manufacturing, community infrastructure, digital-public-benefit, training and evaluation funding blocks;
- commercial, community-owned and public-good boundaries;
- current canonical Goods evidence references.

### Harvest

Create a Harvest profile at the same resolution:

- Witta and Sunshine Coast geography;
- current property/lease and operating entity;
- private-benefit constraints;
- charity/auspice options;
- regenerative agriculture, farmer wellbeing, youth, food, community activation and infrastructure funding blocks;
- public access and community-benefit evidence;
- funding that must wait for an entity or governance decision.

### Arts and cultural opportunity lane

Arts must be a first-class portfolio lane, not a keyword attached only to Contained or Gold.Phone. It covers opportunities relevant to:

- Contained and participatory experience design;
- Gold.Phone and civic listening;
- Empathy Ledger and community-governed storytelling;
- JusticeHub and community media;
- Mounty Yarns and place-based narrative;
- Harvest cultural programming and gatherings;
- First Nations arts, cultural maintenance and language work led by appropriate partners;
- public art, festivals, residencies, commissions and touring;
- screen, audio, digital culture and interactive work;
- creative development, artist employment and professional development;
- cultural infrastructure and community facilities; and
- philanthropic cultural partnerships and commissioning, not only competitive grants.

The source estate must therefore include Creative Australia, state and territory arts agencies, Regional Arts Australia and regional arts bodies, local-council cultural programs, screen agencies, festivals and commissioning calls, cultural foundations, prizes, residencies and relevant international opportunities. Eligibility must distinguish artist/individual, sole trader, company, charity, collective and partner-led applications.

## Source pipeline

### Source classes

1. **Official structured feeds:** GrantConnect, government APIs and datasets.
2. **Government directories:** NT, state portals and business.gov.au.
3. **Program detail pages:** current round, eligibility, guidelines and application page.
4. **Local government:** project-geography councils first.
5. **Philanthropy:** foundation programs, community foundations, regrantors and giving circles.
6. **Relationship-led sources:** annual reports, prior grants, GHL/Gmail context and invitation pathways.
7. **Other capital:** tenders, procurement pilots, loans, investment, rebates and sponsorship.

### Phase-one source priorities

#### P0 — repair and make dependable

- GrantConnect current and forecast opportunities;
- business.gov.au full program coverage;
- Queensland official source;
- NT directory → detail page → GrantsNT status reconciliation;
- Sunshine Coast and Noosa;
- FRRR;
- Australian Communities Foundation current rounds;
- existing foundation-program frontier;
- auDA and other user-submitted sources.
- Creative Australia and all state/territory arts funding portals;
- Regional Arts Australia and relevant regional arts organisations;
- screen, public-art, residency, commission and festival opportunity sources relevant to active projects.

#### P1 — add after P0 health passes

- national council source registry with project-based activation;
- Indigenous trusts, Aboriginal corporations and community-benefit funds relevant to active Goods geographies;
- corporate community-investment pages relevant to Goods production and Harvest place-based work;
- giving circles and Impact100 chapters;
- state procurement and social procurement portals.

### NT implementation slice

Replace directory-stub behaviour with:

1. directory category and canonical program capture;
2. crawl of every linked program page and relevant child tab;
3. extraction of amount, active round, deadline, legal applicant, geography, supported and excluded costs;
4. GrantsNT current-round reconciliation;
5. recurring-round schedule storage;
6. evidence spans and retrieval dates;
7. explicit project-specific applicant-route classification;
8. closure or quarantine of unsupported `open` NT rows.

## Matching pipeline

### Gate 1 — current evidence

An `apply now` result must have:

- official or authoritative source;
- currently open or confirmed evergreen intake;
- application URL;
- verified retrieval time;
- timing evidence;
- amount or explicit `unknown` warning;
- eligibility evidence.

### Gate 2 — deterministic eligibility

Evaluate before semantic fit:

- legal applicant;
- DGR/ACNC;
- Indigenous ownership/control;
- geography;
- turnover/trading history;
- co-contribution;
- prior-recipient rules;
- eligible activities and costs;
- private/commercial benefit restrictions.

Output one of:

- `eligible_direct`;
- `eligible_partner_led`;
- `needs_verification`;
- `ineligible`.

### Gate 3 — retrieval and ranking

- PostgreSQL full-text/BM25-equivalent candidate retrieval for exact terms;
- pgvector semantic retrieval for mission, outcome and project similarity;
- combine lexical, vector, relationship, award-history, project maturity, funding-block, freshness and evidence confidence;
- rerank only the top 30–50 candidates against the complete project profile;
- select a portfolio across funding blocks rather than returning near-duplicate grants.

### Gate 4 — human promotion

No external system write from model ranking.

Ben chooses:

- `Pursue` — create/update GHL and create/link Notion brief;
- `Watch` — keep in GrantScope and monitor source/relationship change;
- `Verify` — create a bounded evidence question;
- `Pass` — record reason and suppress until material facts change.

## HighLevel integration

### Promotion rule

Only `Pursue` creates a HighLevel opportunity.

Required GHL fields:

- GrantScope opportunity ID;
- ACT project ID and project code;
- opportunity/funder name;
- amount sought, not automatically the maximum available;
- deadline;
- applicant entity;
- relationship owner;
- next action and due date;
- GrantScope decision URL;
- Notion brief URL when available.

Stages:

1. Scoping
2. Eligibility confirmed
3. Relationship / partner work
4. Application in progress
5. Internal review
6. Submitted
7. Awarded
8. Declined / withdrawn / expired
9. Reporting due
10. Acquitted

Do not create GHL contacts or monetary pipeline value from modelled community need. Do not set monetary value to `amount_max` unless that is the actual approved ask.

### Sync contract

- GrantScope → GHL only after explicit promotion.
- GHL returns stage, owner, next action, due date and outcome.
- GHL does not overwrite GrantScope evidence, eligibility or project fit.
- All writes are idempotent using the GrantScope opportunity/assessment ID.

## Notion integration

Notion is optional and created only for `Pursue`.

One page per project × funding round, containing:

- opportunity summary and official links;
- applicant and partner route;
- eligibility decision;
- fundable project statement;
- application questions;
- evidence checklist;
- answer-bank suggestions;
- budget draft;
- working narrative;
- review comments;
- links back to GrantScope and GHL.

Notion never owns status. GrantScope owns the decision; GHL owns operational stage.

## Weekly operating rhythm

### Automated before Monday

1. Poll priority source frontier.
2. Run active source plugins.
3. Deep-fetch changed program pages and attachments.
4. Reconcile open/closed status.
5. Deduplicate and version opportunities.
6. Apply evidence and eligibility gates.
7. Refresh matches for every active canonical ACT project.
8. Import GHL operational outcomes.
9. Build a maximum-five weekly queue.
10. Send a short digest with links to the project pages.

### Ben's weekly review — 60 minutes maximum

1. Resolve source-health red flags that affect current applications — 10 minutes.
2. Review up to five changed/due matters — 25 minutes.
3. Promote, watch, verify or pass — 15 minutes.
4. Confirm GHL owners/actions for promoted work — 10 minutes.

## Four-week delivery plan

### Week 1 — truthful foundation

- Establish current production health baseline and source inventory.
- Repair nightly ingest/enrich/finalise timeouts.
- Repair GrantConnect GO ingestion.
- Surface source-level yield, failure and staleness.
- Define the evidence-backed status contract.
- Quarantine unsupported open records from the project feed.

**Exit:** priority-source failures are visible; weekly jobs finish; an unsupported row cannot appear as `apply now`.

### Week 2 — portfolio profiles and NT

- Establish the versioned common profile contract and canonical project aliases.
- Generate a baseline profile for every active ACT project from existing project, evidence and recommendation context.
- Validate and deepen profiles through portfolio review, using Goods and Harvest as hard eligibility benchmarks and the arts lane as a coverage benchmark.
- Build the NT directory/detail/GrantsNT reconciler.
- Repair current NT statuses and recurring-round records.
- Confirm P0 source monitoring cadence.

**Exit:** every active ACT project can receive matches; benchmark profiles pass hard-gate test cases; arts coverage is visible; NT opportunities have real round evidence.

### Week 3 — project funding page and matching

- Build the project funding page.
- Implement `Apply now`, `Major opportunities`, `Watch` and `Verify` views.
- Combine deterministic gates, lexical retrieval and existing semantic matching.
- Add evidence/freshness explanations.
- Build bounded portfolio and weekly queue selection.

**Exit:** Ben can select any active ACT project and assess its verified live candidates without consulting the raw grants table.

### Week 4 — promotion and weekly loop

- Implement idempotent GHL promotion.
- Implement optional Notion application-brief creation/linking.
- Import GHL stage/action/outcome state.
- Send the weekly digest.
- Run one complete portfolio review, including at least one commercial/public-benefit case, one community-partner-led case and one arts/cultural case.
- Capture corrections and tune gates/ranking.

**Exit:** at least one real opportunity completes Discover → Verify → Decide → GHL/Notion → Action, with no duplicate external records.

## Acceptance criteria

### Data trust

- 100% of `Apply now` opportunities have an official source, application URL and verification timestamp.
- 100% have a deadline or explicit confirmed-evergreen evidence.
- Zero unsupported directory stubs appear as currently open.
- P0 source jobs have a recorded successful run within their cadence.
- Source failures and zero-yield regressions are visible within one cycle.

### Match quality

- Every active project has a baseline labelled set; the three phase-one benchmark lanes—commercial/public benefit, community partner-led and arts/cultural—each have at least 20 human-labelled cases.
- Precision@10 is at least 80% for verified eligible candidates.
- Hard-gate accuracy is at least 95%.
- Every top match names the applicant route and funding block.

### Workflow

- Weekly queue never exceeds five matters.
- External writes require explicit `Pursue`.
- GHL promotion is idempotent.
- Notion creates one linked application page per pursued project/round.
- GHL stage/outcome returns to GrantScope.
- The weekly review takes no more than 60–90 minutes for four consecutive weeks.

## Deliberately out of scope

- autonomous outreach or application submission;
- bulk pushing strong-fit rows to Notion;
- adding every Australian council before P0 sources are reliable;
- training a complex recommendation model before enough balanced labels exist;
- replacing HighLevel, Notion, Gmail, Xero or the Goods Asset Register;
- deleting legacy history during the first phase.

## First implementation tickets

1. `FUND-101` — production grant pipeline health and timeout repair.
2. `FUND-102` — evidence-backed current-status contract and feed quarantine.
3. `FUND-103` — NT directory/detail/GrantsNT reconciler.
4. `FUND-104` — canonical ACT portfolio and versioned project funding profiles.
5. `FUND-105` — project funding page and bounded weekly queue.
6. `FUND-106` — hybrid candidate retrieval and eligibility explanation.
7. `FUND-107` — explicit idempotent GHL promotion and callback.
8. `FUND-108` — optional Notion application brief.
9. `FUND-109` — weekly funding digest and operating-cycle instrumentation.

## Phase-one decision

Build the truthful weekly loop before widening the source estate further:

`fresh sources → evidence → project eligibility → short decision queue → explicit GHL/Notion promotion → outcome learning`

This gives Ben a usable portfolio funding system while creating the operational foundation required to expand toward comprehensive Australian and relevant international opportunity coverage.
