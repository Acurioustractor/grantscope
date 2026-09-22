# Community money finder

*Plan, 2026-09-22. Ben's question: what would community and small organisations search for to grow and reach resources, and how do they tap into the money Australia already has?*

## The idea

A small organisation cannot see who funds organisations like it, where money is held in its name, or who is connected to whom. Big institutions pay people to know. CivicGraph already holds most of it. Turn it round and hand it to them, free, from public records, every figure sourced.

Built on the power-and-philanthropy story (`thoughts/shared/drafts/2026-09-22-who-holds-the-giving.md`): the finding is that about 4.5 cents in each dollar raised for Aboriginal people reaches community-controlled organisations. The finder is the practical answer to that.

## Six questions, in build order

| # | The question they ask | Data we have | What's missing | Size |
|---|---|---|---|---|
| 1 | Who has funded organisations like mine? | `grantconnect_awards` (291K, 72% linked to an entity), `justice_funding` grant lane (38K recipients), Jev sector labels (running 2026-09-22) | "Like mine" = same Jev sector + state + size band. Foundation grants are thin (a few hundred edges) | **First. A page.** |
| 2 | Who is holding money in my name? | ACNC filings + Jev community-control labels + postcode | Region match for big mainstream charities (they report head office, not where they work) | Medium |
| 3 | Which foundations are sitting on money? | `foundations`, ACNC assets and grants paid | Foundation profile data is being wiped by the ACNC sync until PR #506 merges | Small after #506 |
| 4 | Who is connected to that funder? | ACNC responsible persons (`person_roles`), nominee blocks removed | Company boards (ASIC directorships) not loaded. Privacy rule: organisations only, people only where on a public register | Medium, careful |
| 5 | What's open that I can actually win? | `v_funding_opportunities` (29K) | Jev eligibility check: the grant's criteria against the org's own ACNC description | Medium |
| 6 | What evidence backs my approach? | Australian Living Map of Alternatives (ALMA) interventions and evidence | Link from sector to evidence | Small |

## Step 1: "Who funds organisations like mine"

- **Route:** `/charities/[abn]/funders` (charity pages already exist at `/charities/[abn]`).
- **In:** an ABN.
- **Peers:** charities with the same Jev main sector (confidence >= 0.9), same state, same ACNC size band.
- **Out:** funders that paid those peers in the last five years, ranked by how many peers they funded (breadth beats one big cheque), with typical grant size, most recent year, and three example grants with source.
- **Money rules:** justice money through `isRealRecipient()` / grant lane only; `/money-audit` before it ships.
- **Visible surface:** local dev first, Ben looks, Ben says merge.

## Principles

- Free for community organisations.
- Public records only. Every figure shows its source.
- Jev judges organisations, never people, and its confidence is shown.
- Points small organisations at money, not money at small organisations.

## Decided (grill, 2026-09-22)

- **First user:** a community Goods on Country already works with. Worth it = a funder list they can act on.
- **Peers:** same Jev main sector + same state + same ACNC size band.
- **Strategy:** the finder is the free community half of "free registry, paid evidence". Buyers stay the revenue.
- **Tone:** say it plainly. The page headlines the finding, as the story does.

## Open questions (before the grill)

- Who is the first real user, by name?
- Does this compete with the buyer-wedge strategy, or feed it?
- "Like mine" by sector, place and size: is that how a community organisation thinks of its peers?
- Does showing where money is held in Aboriginal people's name create risk for the organisations named, or for ACT?
