# QLD Crime Prevention Schools Investigation

Date: 2026-04-10
Author: Codex working from GrantScope local data + current public sources

## Question

Can CivicGraph/GrantScope investigate the emerging Queensland "crime prevention schools" controversy using the youth justice spending mirror, provider graph, Hansard, ministerial statements, and public tender traces?

Short answer: yes, partially.

We can already separate:

- the public political commitments
- the named providers in speeches/statements
- the visible contract/spend field in QLD youth justice
- the community-controlled providers already active in that field

We cannot yet prove the alleged selection-panel/process claims from the screenshoted Brisbane Times story using current local data alone. That requires direct procurement records, QON/estimates answers, RTI material, or released evaluation documents.

## Executive Read

The current record points to a three-layer story:

1. The Crisafulli Government made a clear public commitment to fund four crime prevention schools, with Men of Business publicly named as the first provider on the Gold Coast and the other sites intended for later tender/EOI.
2. The local data mirror shows `Men of Business Academy` only as a ministerial-statement-linked youth justice row with no amount recorded, while `OHANA EDUCATION LTD` already appears in DYJVS contract disclosure data with a `$1.65M` outsourced service-delivery contract.
3. The wider QLD youth justice provider field is already large and real. Outside the aggregate budget rows, GrantScope currently sees about `$1.15B` in non-aggregate QLD youth justice-linked funding rows, including about `$181.2M` in DYJVS contract-disclosure rows and about `$115.5M` flowing to community-controlled entities.

That means the current issue is not "there is no provider ecosystem". The live question is closer to:

- which providers were pre-favoured politically
- whether the later selection process was genuinely open
- which existing youth justice/community providers were positioned to bid
- and whether community-controlled/regionally grounded providers were meaningfully included

## What the Public Record Says

### 1. Initial political commitment

On 10 December 2024, Queensland Hansard recorded the government commitment for:

- `$40M` for two youth justice schools
- `$40M` for four early intervention schools
- locations: Ipswich, Townsville, Gold Coast, Rockhampton

Source:
- https://documents.parliament.qld.gov.au/events/han/2024/2024_12_10_WEEKLY.pdf

Relevant lines in the public PDF:
- p.90 lines 4869-4874

### 2. Budget-era provider naming

On 23 June 2025, the official ministerial statement explicitly said:

- `$50M over five years` for four new or expanded Crime Prevention Schools
- Men of Business would be the first school/provider
- `$10M` would go to expand Men of Business on the Gold Coast
- tenders would be called later for Townsville, Rockhampton, and Ipswich

Source:
- https://statements.qld.gov.au/statements/102828

### 3. Broader youth justice budget framing

On 24 June 2025, the QLD budget statement said the budget delivered:

- `$560M` in new early intervention and rehabilitation programs
- `$215M` in new early intervention programs including Gold Standard Early Intervention, Crime Prevention Schools, and Regional Reset
- `$40M` for two Youth Justice Schools

Source:
- https://statements.qld.gov.au/statements/102882

### 4. Ohana rollout became concrete

On 4 February 2026, the official Logan Youth Justice School statement said:

- Ohana for Youth would deliver the Logan Youth Justice School
- the first Ohana Academy site would be in Logan Central
- a second youth justice school would be based in Cairns
- the two youth justice schools sat inside a `$40M` package

Source:
- https://statements.qld.gov.au/statements/104436

### 5. Public procurement trace exists

There was a QTenders/VendorPanel record for `Crime Prevention Schools`:

- tender number: `VP476087`
- issued by Department of Youth Justice
- released: 29 Aug 2025
- closed: 26 Sep 2025
- described as an `EXPRESSION OF INTEREST (EOI)` for a Special Assistance School

Public search snippet:
- https://qtenders.epw.qld.gov.au/qtenders/tender/display/tender-details.do?action=display-tender-details&id=55096

Important note:
- the live page currently throws an error when opened directly in-browser, but the tender metadata is still visible through cached/public search results.

## What GrantScope Data Says

## 1. The mirror is big, but much of it is aggregate reporting

QLD youth justice rows in `justice_funding` with `topics @> ['youth-justice']` and excluding `austender-direct`:

- rows: `5,056`
- total: `$20,572,477,880.61`
- providers: `1,533`
- programs: `75`

That headline number is not the operational provider field.

The biggest sources are:

- `rogs-yj-expenditure`: `$10.81B`
- `rogs-2026`: `$6.95B`
- `qld-historical-grants`: `$1.24B`
- `qld-budget-sds`: `$795.55M`
- `qgip`: `$333.43M`
- `dyjvs-contracts`: `$181.25M`
- `qld_contract_disclosure`: `$13.64M`
- `qld_ministerial_statement`: `$3.52M`

Interpretation:

- the mirror is good for context and political framing
- but procurement/process analysis should focus on non-aggregate rows, especially `dyjvs-contracts`, `qld_contract_disclosure`, `qgip`, and ministerial-statement-linked provider rows

## 2. The useful provider/service slice is much smaller

If we remove aggregate rows and obvious department/roll-up recipients, the visible provider/service slice becomes:

- rows: `4,932`
- total: `$1,150,492,344`

That is the more useful field for actual provider-market analysis.

## 3. Community-controlled presence is material, not marginal

Joining `justice_funding.gs_entity_id` to `gs_entities` where `is_community_controlled = true` gives:

- rows: `361`
- total: `$115,545,902`
- distinct entities: `82`

Top community-controlled entities visible in the QLD youth justice funding mirror include:

- Townsville Aboriginal and Torres Strait Islander Corporation for Health Services: `$12.22M`
- Murri Watch Aboriginal and Torres Strait Islander Corporation: `$10.37M`
- Indigenous Youth Service: `$9.57M`
- Gallang Place Aboriginal and Torres Strait Islanders Corporation: `$9.07M`
- Mithangkaya Nguli - Young People Ahead: `$7.40M`
- Central Queensland Indigenous Development Limited: `$6.37M`
- Aboriginal and Torres Strait Islander Community Health Service Brisbane: `$6.36M`
- Yabun Panjoo Aboriginal Corporation: `$5.26M`
- Cairns Regional Community Development & Employment ATSI Corporation: `$4.11M`

Interpretation:

- if a future procurement process sidelines community-controlled providers, that is not because Queensland lacks a community-controlled youth justice/provider base

## 4. Visible direct contract field

QLD youth justice rows from `dyjvs-contracts`:

- rows: `555`
- total: `$181,246,833`

Top visible DYJVS contract recipients include:

- The Corporation of the Synod of the Diocese of Brisbane: `$21.60M`
- The Ted Noffs Foundation: `$16.63M`
- Shine For Kids Limited: `$13.31M`
- Life Without Barriers: `$12.19M`
- Bridges Health & Community Care Ltd: `$11.22M`
- Fearless Towards Success Ltd: `$6.49M`
- Kurbingui Youth Development Limited: `$6.47M`
- Save The Children Australia: `$6.40M`
- Youth Insearch Foundation: `$5.55M`
- Kokoda Youth Foundation: `$5.55M`
- Gallang Place Aboriginal and Torres Strait Islanders Corporation: `$5.41M`
- Yabun Panjoo Aboriginal Corporation: `$5.26M`
- OHANA EDUCATION LTD: `$1.65M`

## 5. The "crime prevention schools" trail is thin in the funding mirror

Direct `justice_funding` rows matching this program language currently show:

- `Men of Business Academy` -> `Crime Prevention Youth Justice Schools` -> `qld_ministerial_statement` -> no amount captured
- no contract or payment row yet for Men of Business inside the youth-justice funding mirror
- no direct `Crime Prevention Youth Justice Schools` contract/award rows beyond the ministerial statement record

Direct query result:

- rows with `program_name ILIKE '%Crime Prevention Youth Justice Schools%'`: `1`
- recorded total: `NULL`

Interpretation:

- the politics is present
- the tender trace is present
- but the awarded spend is not yet visible in our structured mirror

## 6. Ohana has a more concrete spend trail

Relevant local findings:

- `OHANA EDUCATION LTD` appears in `dyjvs-contracts`
- program: `General Goods and Services`
- amount: `$1,650,000`
- description: `OUTSOURCED SERVICE DELIVERY`
- source file: DYJVS contract disclosure open-data CSV

At the same time:

- official statement 104436 publicly names Ohana for Youth as the Logan/Cairns Youth Justice School operator

Interpretation:

- Ohana is not just rhetorical in the public record; it is already visible in the contract-disclosure layer
- but the contract classification is broad, so we still need exact contract metadata to prove it is the school-delivery contract rather than another service arrangement

## Provider Field Around the Target Regions

Using non-aggregate QLD youth-justice rows with locations linked to Logan/Gold Coast, Ipswich, Rockhampton, Townsville, Cairns/Yarrabah:

### Logan / Gold Coast

Visible providers include:

- Life Without Barriers
- YFS Ltd
- Corporate Development Services (Aust) Pty Ltd & Wapdas Pty Ltd
- Men of Business Australia Limited
- Ohana Education Ltd

### Ipswich

Visible providers include:

- ICYS - Ipswich Youth Support Service
- ICYS - Regional Youth Support Service (Lockyer and Somerset)
- Inspire Youth and Family Services

### Rockhampton

Visible providers include:

- Regional Youth Support Service
- Darumbal Community Youth Service
- CentacareCQ Youth Support Service
- DCYSI Bail Support / Walali Bili

### Townsville

Visible providers include:

- TAIHS Bail Support Townsville
- TAIHS Youth Support Services
- Queensland Youth Services Inc
- Palm Island Young Offender Support Service
- Townsville Aboriginal and Islanders Health Service

### Cairns / Yarrabah

Visible providers include:

- Anglicare Youth Support Program
- Youth Empowered Towards Independence
- Cairns Regional Community Development & Employment ATSI Corporation
- Industry Education Networking Pty Ltd
- ARC Disability Services Inc

Interpretation:

- there is already a substantial youth-justice-adjacent provider ecosystem in the same geographic catchments as the proposed/announced school network
- the real investigative question is therefore process design and selection logic, not lack of provider capacity

## Hansard and Political Speech Read

Direct Queensland Hansard hits for:

- `youth justice school`
- `crime prevention school`
- `Men of Business`
- `Ohana`

Current local hit count:

- `4`

The meaningful ones are:

### 10 Dec 2024 Hansard

Public commitment phase:

- two youth justice schools
- four early intervention schools
- named locations for the four crime prevention schools

Source:
- https://documents.parliament.qld.gov.au/events/han/2024/2024_12_10_WEEKLY.pdf

### 16 Oct 2025 Hansard

Operational/political endorsement phase:

- ministerial reference to "crime prevention schools like Ohana associated with Griffith University in Logan and Men of Business"
- still no visible operational detail about tender evaluation, panel composition, or why particular providers were preferred

Source:
- https://documents.parliament.qld.gov.au/events/han/2025/2025_10_16_WEEKLY.pdf

Interpretation:

- Hansard currently tells us how the schools were sold politically
- it does not tell us how provider selection was actually governed

## What We Can Say With Confidence

We can already say:

- the government clearly promised these schools in public and parliamentary language
- Men of Business was publicly singled out early as the first crime prevention school operator
- a later public EOI/tender trace exists for the remaining crime prevention school rollout
- Ohana is visible both in official statements and in the DYJVS contract-disclosure layer
- the QLD youth justice delivery market is already populated with many providers, including community-controlled providers
- the current structured funding mirror does not yet show a clean awarded-spend trail for the crime prevention school package

## What We Cannot Yet Prove

We cannot yet prove from current local data alone:

- whether Men of Business or any other provider sat on assessment or selection panels
- the exact evaluation criteria used for the later school-selection process
- whether the Cairns site/provider was formally awarded then withdrawn
- whether there was a process reset, cancellation, or internal dispute
- whether the process disadvantaged existing local/community-controlled providers

Those claims need direct procurement/process evidence.

## What Data We Need Next

To turn this into a hard public-interest investigation rather than a strong early brief, we should add:

1. QTenders / VendorPanel ingestion
- tender number
- release/close dates
- amendments
- Q&A
- shortlisted/awarded supplier names where public

2. Ministerial statement coverage fix
- `civic_ministerial_statements` currently has the Logan/Ohana rollout but appears to be missing some later crime-prevention-school statement coverage

3. Estimates / QON / committee answers
- parliamentary committee transcripts
- questions on notice
- budget estimates responses

4. Queensland contract award/payment trace
- not just tender notices but actual contract award metadata
- supplier
- start date
- end date
- contract value
- procurement method

5. RTI-linked document ingest
- if evaluation docs, panel docs, or briefing notes become public

## Best CivicGraph Product Move

The strongest immediate product move is a dedicated investigation view for:

- QLD youth justice early intervention pipeline
- promised program
- tender/EOI stage
- named provider
- visible spend
- location
- community-controlled alternatives in-region
- confidence level

For this story specifically, the key visual should be:

`promise -> named provider -> tender trace -> award trace -> payment trace -> local provider field`

That would let us show exactly where the current public record is strong and where it becomes opaque.

## Bottom Line

Yes, we can absolutely use our data to investigate this.

Right now, the data already supports a strong first conclusion:

- the political commitments and named providers are real
- the tender/EOI trail is real
- the provider ecosystem is real
- but the auditable award/process layer is still too thin in our mirror

That means this is already a credible CivicGraph investigation, but the next high-value step is to ingest the procurement-process record itself so we can test the harder claim:

`was this a genuinely open provider process, or a politically pre-shaped pathway dressed up later as open selection?`
