# Governed Proof User Needs And Strategy

## Core product role

Governed Proof is not a fourth disconnected product. It is the public and partner-safe summary layer that joins:

- GrantScope capital and allocation context
- JusticeHub intervention and evidence context
- Empathy Ledger governed community voice

GrantScope should be the front door.
JusticeHub should be the internal workbench.
Empathy Ledger should remain the source of truth for governed voice and publishability.

## Product promise

The promise is simple:

- show what is happening in a place
- show what money is already flowing
- show what interventions and evidence are visible
- show what governed community voice can safely be shared
- let a user move from context to decision without manually stitching systems together

## Primary users and jobs

The product is strongest when it is optimized for a small number of serious users with high-value jobs to do.

It should not be designed around generic “visitors”.

### 1. Funder or commissioning lead

Primary job:
- decide whether a place, organization, or intervention deserves deeper diligence, relationship-building, or funding attention

Needs:
- understand a place quickly
- see where money is already going
- understand whether evidence exists for interventions
- see whether governed community voice is present
- defend a decision internally
- move from scanning to briefing-ready confidence quickly

Entry points:
- `/for/funders`
- `/places/[postcode]`
- `/entities/[gsId]`
- `/for/funders/proof/[placeKey]`
- `/for/funders/proof/[placeKey]/system`

Success condition:
- they can move from curiosity to a briefing-ready view in under 5 minutes

Failure mode:
- they see a good-looking page but cannot tell what is evidence, what is narrative, and what is still weak

### 2. Internal analyst or partnership lead

Primary job:
- turn messy cross-system data into a promotable, governed, decision-safe proof surface

Needs:
- review bundle confidence and gaps
- decide whether a place is ready for partner/public exposure
- produce internal briefs and repair weak bundles
- understand what is missing in capital, evidence, or voice coverage
- control promotion safely

Entry points:
- JusticeHub `/admin/governed-proof`
- JusticeHub `/admin/governed-proof/[placeKey]/brief`

Success condition:
- they can repair, re-run, and promote proof without manually stitching systems together

Failure mode:
- they become the integration layer and have to explain system state from memory instead of from the product

### 3. Community or practice partner

Primary job:
- understand and trust how place, organization, and story are being represented in relation to funding and evidence

Needs:
- understand how their place or organisation is being represented
- trust that governed voice is not being extracted or overexposed
- see how narrative evidence sits next to money and intervention claims
- see that voice is treated as governed proof, not decorative storytelling

Entry points:
- selected public/partner place proof pages
- selected place pages and entity pages

Success condition:
- they can see that voice is governed, contextual, and not reduced to marketing garnish

Failure mode:
- the platform feels extractive, overclaims certainty, or treats story as a thin emotional add-on

## Secondary users

These matter, but they should not dictate the first product shape.

### Researchers, journalists, civic analysts

They want:
- place-level context
- entity-level traceability
- public proof signals

They should start in GrantScope and stay mostly in the public stack.

### Program managers and service operators

They want:
- to understand whether their organization or place is being represented fairly
- to see intervention and proof context without digging through all three systems

They may move between GrantScope public pages and JusticeHub internal workflows depending on access.

## Anti-users

These are people the first product should not be over-optimized for:

- casual browsers with no decision job
- people looking for a generic story gallery
- people who only want an internal CRM
- users expecting a single magical dashboard with no review process

If the product bends toward them, it gets fuzzy fast.

## User flow

### Public / funder path

1. start in GrantScope place or entity context
2. discover that governed proof exists for a place
3. open the governed proof page
4. open the system map if they need to understand how the layers fit together
5. decide whether to request a deeper briefing or continue exploring entities and places

### Internal path

1. assemble governed proof in JusticeHub
2. review confidence, strengths, and gaps
3. repair if needed
4. promote to partner/public
5. expose in GrantScope public routes

### Trust path

1. story governance and publishability begin in Empathy Ledger
2. only governed material enters the shared proof bundle
3. JusticeHub decides whether the bundle is good enough to promote
4. GrantScope only exposes promoted proof publicly

## Frontend strategy

### GrantScope

Role:
- public discovery
- place intelligence
- entity intelligence
- funder-facing proof presentation

Pages:
- `/places/[postcode]`
- `/entities/[gsId]`
- `/for/funders`
- `/for/funders/proof/[placeKey]`
- `/for/funders/proof/[placeKey]/system`

What the user should feel here:
- “I understand the place”
- “I understand the money”
- “I know whether this proof is decision-ready”

### JusticeHub

Role:
- proof assembly
- operator controls
- internal briefing

Pages:
- `/admin/governed-proof`
- `/admin/governed-proof/[placeKey]/brief`

What the user should feel here:
- “I can assess quality”
- “I can see what is missing”
- “I can promote safely”

### Empathy Ledger

Role:
- story governance
- publishability
- consent and cultural controls

Public role:
- indirect, through governed proof

What the user should feel here:
- “voice is being handled with care”
- “story is governed upstream, not improvised downstream”

## Correct starting point by user

- Funder or commissioner: start in GrantScope
- Internal analyst: start in JusticeHub
- Community/practice partner reviewing representation: start in the promoted GrantScope proof page, then trace inward if needed
- Story governance or consent work: start in Empathy Ledger

## Strategic discipline

The platform should keep making these distinctions clear:

- GrantScope answers: what is happening here, who is active, where is money flowing
- JusticeHub answers: what evidence or intervention logic exists, and is this proof good enough
- Empathy Ledger answers: what voice can be shown, under what governance, and how it should be interpreted

## Product discipline

Do not sell this as “storytelling software”.

Lead with:
- place intelligence
- governed proof
- decision support
- briefing and diligence

Use story as proof, not as the category.

Do not sell this as “one dashboard for everything”.

Sell it as:
- a front door for context
- a workbench for review
- a governed source for voice
- a proof layer for decisions

## What success looks like

### In the next product phase

- a funder can move through the public path without asking “which app am I in?”
- an internal operator can explain promotion status and gaps from the UI, not from tribal knowledge
- a community partner can see that voice is contextualized and governed
- a proof page can support a real meeting, not just a demo

### In the longer run

- governed proof becomes the standard way this ecosystem expresses “money + evidence + voice”
- GrantScope becomes the discovery surface
- JusticeHub becomes the review and synthesis surface
- Empathy Ledger remains the trust and governance backbone

## Immediate next UX tasks

1. Add one explicit “who this is for” block to the public proof stack so the user understands the intended use case.
2. Add one explicit handoff from GrantScope proof pages back into request-for-briefing or partnership workflow.
3. Keep JusticeHub as the internal review and print-brief surface.
4. Avoid exposing any bundle unless promotion status is `partner` or `public`.
5. Keep increasing bundle density so promoted proof feels usable, not performative.
