# CivicGraph Funding Autoresearch Program

This loop exists to make CivicGraph the strongest funding-network graph system in Australia, not another polished directory.

## Mission

Shift money, relationship attention, and discovery power toward communities and delivery organisations that are systematically under-seen by philanthropy, corporate giving, and traditional grant search.

## What We Are Optimising

1. Need-first search
   - Start with place, disadvantage, remoteness, community control, beneficiary cohort, and coverage gap.
   - Do not default to funder-name or keyword-only discovery.

2. Relationship-first funding intelligence
   - Rank funders by plausibility, not just topical overlap.
   - Reward giving history, openness, geographic relevance, and target-recipient fit.

3. Delivery-organisation discovery
   - Surface charities and social enterprises that can actually deliver, not only the largest or loudest organisations.
   - Reward evidence, enrichment, mission clarity, and geographic specificity.

4. Diversity and justice weighting
   - Increase meaningful exposure of Indigenous, community-controlled, regional, disability-led, and grassroots organisations.
   - Penalise rankings that collapse back into familiar metro incumbents.

5. Actionability
   - Favour results a human would act on now: live URLs, recent verification, clear programs, relevant notes, clear next-step fit.

## Benchmark Families

1. `grant_discovery`
   - Open opportunities for a specific mission, place, and beneficiary cohort.

2. `foundation_discovery`
   - Plausible philanthropic funders and relationship targets for the same mission and place.

3. `charity_delivery_match`
   - Charities already doing relevant work, especially where community need or coverage gaps exist.

4. `social_enterprise_delivery_match`
   - Social enterprises and Indigenous businesses that could deliver, employ, or partner.

5. `need_gap_search`
   - Postcodes/LGAs where money is thin relative to need and delivery presence.

## Fixed Metrics

The strategy can change. The evaluator cannot.

- `precision_at_10`
- `recall_at_10`
- `mean_relevance`
- `justice_exposure`
- `actability`
- `relationship_utility`
- `overall_score`

## Constraints

1. Do not reward rankings that only surface large metro organisations.
2. Do not hallucinate evidence or pretend source quality exists where it does not.
3. Do not treat philanthropy, grants, charities, social enterprise, and need as separate products.
4. Do not optimise only for lexical relevance.
5. Do not mutate the evaluator to make the strategy look better.

## Harsh Questions

Every iteration should be judged against these:

- Would a real charity or social enterprise act on these top 10 results?
- Would a real philanthropy team trust these top 10 delivery matches?
- Are Indigenous and community-controlled organisations meaningfully visible where they should be?
- Are remote and low-funding places surfacing when the scenario is explicitly about need?
- Are we still over-recommending institutions that already hold too much power?

## First Research Agenda

1. Improve need-first postcode/LGA ranking.
2. Improve philanthropy plausibility ranking.
3. Improve charity and social-enterprise matching for delivery readiness.
4. Improve justice weighting so community-controlled and Indigenous organisations are not buried.
5. Improve explanation quality so every high-ranked result is legible to humans.
