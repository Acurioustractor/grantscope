# Pilot Session Briefs

## Purpose
These are the first three tightly-supported user tests to run now that the pilot-ready foundation set is strong enough.

Use them with:

- [Funding Workspace](/Users/benknight/Code/grantscope/apps/web/src/app/funding-workspace/page.tsx)
- [Pilot Testing](/Users/benknight/Code/grantscope/PILOT_TESTING.md)
- [Funding Pilot Cohort](/Users/benknight/Code/grantscope/output/funding-pilot-cohort.md)

## Session 1: ORIC

### Archetype
Community-controlled organisation working on First Nations youth development, leadership, and employment pathways in Queensland and the Northern Territory.

### Test Prompt
“We support First Nations young people through on-Country learning, leadership, employment pathways, and community-led capability building.”

### Workspace URL
`/funding-workspace?mission=First%20Nations%20youth%20leadership%20employment%20on-country&state=Queensland&org_type=ORIC`

### Funders To Watch For
- `Minderoo Foundation`
- `THE TRUSTEE FOR TIM FAIRFAX FAMILY FOUNDATION`
- `The Goodes O'Loughlin Foundation Limited`
- `Paul Ramsay Foundation Limited`
- `CBA Foundation`

### Why These Are Good Checks
- they cover Indigenous, youth, community, and regional/rural themes
- they test whether the product can distinguish:
  - relationship-led philanthropy
  - open programs
  - broader community funders

### Success Looks Like
- the user finds at least `3` plausible matches quickly
- at least `2` feel genuinely mission-aligned
- the user can say which are:
  - build relationship
  - apply now

### Failure To Watch
- Indigenous/community-controlled intent is not obvious in the results
- generic large foundations crowd out stronger cultural-fit funders
- the user cannot tell why one Indigenous-aligned funder is stronger than another

## Session 2: Charity

### Archetype
Health or family-support charity focused on serious illness, children, or medical research, operating nationally or in Queensland/Western Australia.

### Test Prompt
“We support children and families affected by serious illness through care, family support, and research-backed health outcomes.”

### Workspace URL
`/funding-workspace?mission=children%20families%20serious%20illness%20health%20research&state=Queensland&org_type=Charity`

### Funders To Watch For
- `Children's Hospital Foundation Queensland`
- `Perth Childrens Hospital Foundation Limited`
- `Snowdome Foundation Limited`
- `Paul Ramsay Foundation Limited`
- `Minderoo Foundation`

### Why These Are Good Checks
- they test whether the product can surface both:
  - specialist health/research funders
  - broader strategic philanthropy
- they check whether state-specific and national health signals are handled properly

### Success Looks Like
- the user can identify which matches are clearly health-specific
- the user can explain why a strategic foundation like `Paul Ramsay` might still matter
- the user knows the next move for at least `3` matches

### Failure To Watch
- all health-related foundations look interchangeable
- the user cannot distinguish research funders from general care/community funders
- the next move is unclear for relationship-led funders

## Session 3: Social Enterprise

### Archetype
Social enterprise working on financial wellbeing, digital inclusion, employment, and practical capability building for young people and underserved communities.

### Test Prompt
“We build financial capability, digital inclusion, and employment pathways for young people and underserved communities.”

### Workspace URL
`/funding-workspace?mission=financial%20wellbeing%20digital%20inclusion%20employment%20youth&state=Victoria&org_type=Social%20enterprise`

### Funders To Watch For
- `ECSTRA FOUNDATION LIMITED`
- `Good Things Foundation Limited`
- `CBA Foundation`
- `Woolworths Group Foundation`
- `The Trustee for Westpac Scholars Trust`

### Why These Are Good Checks
- they test a more mixed lane:
  - financial wellbeing
  - digital inclusion
  - employment
  - social enterprise / leadership
- they should reveal whether the workspace can handle blended missions rather than a single clean theme

### Success Looks Like
- the user sees both direct-fit and adjacent-fit funders
- the user understands why `ECSTRA` and `Good Things` are likely stronger than more generic corporate funders
- the user can shortlist `3 to 5` realistic next moves

### Failure To Watch
- broad corporate foundations dominate over higher-fit specialist funders
- the user cannot tell whether a result is genuinely enterprise-relevant
- the reasons shown are too vague to support confident shortlisting

## Facilitation Notes

### What To Record In Every Session
- organisation name
- mission statement used
- state and org type used
- top `5` matches the participant chose
- which they would save
- what confused them
- what extra detail they wanted before contacting or applying

### What To Compare Across Sessions
- time to first believable match
- number of matches the user would seriously pursue
- whether “apply now” versus “relationship-led” is understood
- whether the reasons shown feel trustworthy

## Immediate Next Step
Run these three sessions before doing more backlog cleanup.

The current data layer is already strong enough for this:
- verified pilot-ready foundations in DB: `152`

That means the next big learning should come from users, not more long-tail reviewability burn-down.
