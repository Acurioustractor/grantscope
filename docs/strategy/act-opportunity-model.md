# ACT Opportunity Model

ALMA is the Australian Living Map of Alternatives. It remains the evidence map
for community-led interventions, their delivery organisations, places, outcomes
and research. It is especially important to JusticeHub and youth justice.

ACT uses a separate operating model for finding resources that may help its
projects.

## The five moves

1. **Observe** — collect grants, procurement, capital, partnership and
   relationship signals from official sources.
2. **Verify** — prove the source, named opening, timing, eligibility, amount,
   project fit and retrieval provenance.
3. **Decide** — a person chooses to watch, pursue or pass.
4. **Act** — assign an owner, next action and next-action date.
5. **Learn** — record the outcome and feed it back into relationships, project
   fit and future discovery.

## System boundaries

| System | Purpose | A record means |
| --- | --- | --- |
| ALMA | Community intervention and evidence map | This work exists and has contextual or outcome evidence |
| ACT Opportunity Observatory | Broad research and verified signals | This may help an ACT project |
| ACT Decision Pipeline | Deliberate operating commitments | ACT has chosen what to do next |
| Relationship graph | Organisations, people and interactions | ACT has a real connection or pathway |

An Observatory signal is never automatically pipeline work. Passing the
evidence gate only makes it eligible for human review.

## Evidence gate

Every signal must carry:

- an official source;
- a named funding or opportunity round;
- a current closing date or formally documented rolling intake;
- applicant eligibility;
- a funding amount or explicit evidence that it is not published;
- concrete fit to one or more ACT projects;
- an evidence URL and retrieval timestamp.

The physical `alma_funding_opportunities` table remains temporarily as a legacy
compatibility store. New discovery should enter `act_opportunity_observatory`
first. Existing consumers can migrate without conflating ALMA with ACT
opportunity work.
