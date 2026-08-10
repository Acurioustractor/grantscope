# Goods investment portfolio alignment

**Purpose:** make Goods funding decisions start with a community and its pathway, then connect the right partner, investment need and opportunity. This is not a grant tracker.

## The decision model

```
Community decision
  -> relationship and authority
  -> pathway module / next proof
  -> investment need and money door
  -> named partner and opportunity
  -> application, agreement or order
  -> delivered asset and learning
```

The asset register is the evidence at the right-hand end of this chain. It proves delivery and gives each place a service history. It must not be treated as a demand list, authority record, or investment portfolio on its own.

GrantScope should be the decision layer across the chain. Notion should hold the working brief and application-writing materials. GoHighLevel should hold the people, organisations, commitments and next conversations.

## What each system owns

| System | Owns | Must not decide |
|---|---|---|
| Goods Asset Register | Deployed assets, service/check-in history, product evidence | Current community request, authority, investment readiness |
| GrantScope | Canonical community crosswalk, evidence status, investment case, opportunity eligibility and portfolio coverage | Community consent or relationship truth by inference |
| Notion | Writing brief, budget version, documents, reviewer notes and application tasks | Canonical opportunity identity or CRM follow-up |
| GoHighLevel | Partner/contact relationship, owner, next touch, commitment and application movement | Community approval, financial truth, or grant eligibility |

## The portfolio view to use every week

One row per community pathway, not one row per grant. A row is eligible for investment work only when it has a named next community decision and a relationship owner.

| Community pathway | Current stage | Relationship / authority state | Next decision or proof | Right investment use | Current money route | Do not do yet |
|---|---|---|---|---|---|---|
| Oonchiumpa / Alice Springs | Resource | Oonchiumpa leads the REAL consortium; production pathway is active | Keep the submitted facility pathway, governance and seller-of-record logic current | Production infrastructure, measured production and wraparound | REAL Innovation Fund is submitted; suitable grants or capital only after entity/eligibility checks | Present site pricing as a community-agreed commitment or treat CRM status as approval |
| Utopia / Urapuntja | Shape | Community pathway is present; the intended module is a shredder, not a full facility | Agree the module, operator, place and maintenance arrangement | Scoping, module selection, servicing and learning | Small scoping/capability money; later partner-led enterprise route | Force it into a whole-site capital case or count delivered assets as a current request |
| Tennant Creek / Wumpurrarni | Yarn | Existing relationships, but reconnection is still unresolved | Send and receive a response to the reconnection conversation; establish what the shed/partners want | Relationship work, scoping and buyer proof | Centrecorp/buyer route after a real purchase or partner proposition exists | Write a production or capital application before the community direction is current |
| Palm Island / Bwgcolman | Yarn | Council and PICC relationship records exist; no current authorised request is established | Ask where this sits and what governance work is wanted | Governance, relationship, service/asset learning | Place-based partner or foundation conversation after a request | Turn prior delivery or paid non-product work into a demand claim |
| Maningrida | Delivery evidence, not a community production site | Homeland School partnership and the 40-bed farm-pressed run provide proof | Capture production-rate cost and operational learning from the measured run | Evidence, quality, service and production learning | Evidence/support funding; buyer proof | Claim a community-owned site or use the run as measured unit economics |

These stage readings come from the Goods decision log: Tennant Creek and Palm Island are at Yarn, Utopia at Shape and Oonchiumpa at Resource. No community site is currently eligible for an ownership claim.

## Investment lenses

Every investment or opportunity must declare one primary use. This is the field that makes grants useful rather than noisy.

| Investment use | Suitable capital | Evidence required before pursuit |
|---|---|---|
| Community relationship and scoping | Grant, philanthropy | Named conversation, relationship owner, scope question and community-controlled next step |
| Community wraparound | Grant, donation, philanthropic support | Participant/support design, delivery partner, cost centre separated from product making |
| Product making / production equipment | Repayable capital, productive-asset finance, order-backed pre-purchase | Asset owner, repayment source, buyer or order pathway, release gates |
| Measured production run | Grant, catalytic funding | 50-bed measurement plan, cost capture and learning/reporting plan |
| Buyer delivery / procurement | Purchase order, pre-purchase, contract | Product bundle, price, freight, warranty/support and contracting party |
| Shared Goods network | Grant, philanthropy, shared-service revenue | Explicit network costs: design, quality, training, back office and field travel |

## The one practical dashboard

Build a **Goods Investment Portfolio** view in GrantScope, then link out to the existing Notion brief and GHL opportunity. It needs only these columns:

1. Community pathway
2. Relationship owner and authority status
3. Current stage and next community decision
4. Evidence already held: asset/service history, request, invoice/order, partner artefact
5. Investment use and required money door
6. Named partner/funder/buyer
7. Opportunity fit and hard eligibility blocks
8. Application or relationship next action, owner and due date
9. Decision status: `listen`, `scope`, `ready to pursue`, `submitted`, `funded/delivering`, `hold`

This gives a simple weekly meeting order: start with the community decision; check the relationship; decide whether investment is appropriate; only then look at the grant, buyer or lender work.

## Immediate portfolio decisions

1. Treat Oonchiumpa as the only active production-investment case, while keeping the submitted REAL route separate from generic grant discovery.
2. Treat Utopia, Tennant Creek and Palm Island as relationship/scoping portfolios, each with a different first investment need. They should not compete on a generic grant score.
3. Use Maningrida and the wider asset register as proof and learning evidence, not as a fifth capital case.
4. Route every open grant through one of the six investment uses above. If it cannot fund a named use for a named community or the shared network, leave it outside the active portfolio.
5. Keep the three cost centres separate: product making, Goods network and community wraparound. No opportunity should cover all three by implication.

## Known data limits

- The asset CSV contains 389 individual records, while Goods canon says 540 deployed beds and 22 washers in community. It is operational evidence, but not the portfolio aggregate source of truth.
- The REAL pathway is recorded as approximately $2m over three years in the Goods decision log, while an older GrantScope operating-system row says $1.2m over four years. Treat that as a source conflict and use the newer Goods ruling until reconciled.
- Current partner records and CRM stages support internal coordination only. They do not prove a community request or approval.

## Implementation sequence

1. Create four community-pathway records above in GrantScope with clear crosswalk IDs.
2. Add the portfolio columns to the existing Goods operating surface, without changing the asset register or broad grant sync.
3. Link each row to one Notion application brief and its relevant GHL relationship/opportunity.
4. Backfill only the named Oonchiumpa, Utopia, Tennant Creek and Palm Island rows, then review the decision read with the Goods team.
5. Only after that, attach open opportunities that satisfy a named investment use and eligibility check.

## Source basis

- `/Users/benknight/Code/Goods Asset Register/STRATEGY.md`
- `/Users/benknight/Code/Goods Asset Register/DECISIONS.md`
- `/Users/benknight/Code/Goods Asset Register/GRANTSCOPE.md`
- `/Users/benknight/Code/Goods Asset Register/data/expanded_assets_final.csv`
- `/Users/benknight/Code/grantscope/scripts/funding-profiles/goods-on-country.json`
- `/Users/benknight/Code/grantscope/docs/strategy/repeatable-project-funding-discovery.md`
