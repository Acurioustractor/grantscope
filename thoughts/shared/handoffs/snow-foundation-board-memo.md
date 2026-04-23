# Snow Foundation Portfolio Memo

Date: 2026-04-12
Status: Internal working memo
Audience: Founder / leadership / board-style discussion prep

## Decision

Approach Snow Foundation with a 30-minute working session around one pilot slice, not a generic software pitch and not a direct funding ask.

Recommended pilot order:

1. RHD and social determinants
2. ACT / NSW South Coast place-based portfolio

## Verified facts

### GrantScope / CivicGraph

- Snow annual giving baseline now stored from the 2024 annual report: `$13,704,202`
- `68` grantee rows are visible in the refreshed foundation views
- `58` distinct linked grantees are visible across `ACT, NSW, NT, QLD, VIC`
- `$4,923,622` is currently surfaced in the refreshed foundation view
- `44` verified 2024 annual-report grant rows are loaded in `foundation_grantees`
- all `44` verified 2024 rows are entity-matched
- `$4,823,622` of verified 2024 grant value is connected to named entities
- Snow foundation readiness tier in the refreshed view is `high`
- current foundation score is `60`

### Verified 2024 concentration by program

- `Our Country - Social Justice Issues`: `$1,331,000` across `6` grants
- `Our Place - Canberra Region Flagships`: `$1,260,000` across `7` grants
- `Our Place - Key Regions: NSW South Coast`: `$653,500` across `2` grants
- `Our Place - Sydney`: `$490,000` across `5` grants
- `Our Country - Social Entrepreneurs & Innovation`: `$400,000` across `3` grants

### Verified 2024 concentration by place

- `NSW`: `20` grants / `$1,896,000`
- `ACT`: `17` grants / `$1,599,122`
- `VIC`: `3` grants / `$813,500`
- `QLD`: `4` grants / `$515,000`

### Largest verified 2024 recipients currently visible

- Foundation for Rural & Regional Renewal: `$578,500`
- NACCHO: `$500,000`
- Sydney Women's Fund: `$305,000`
- Project Independence: `$300,000`
- EveryMan Australia: `$250,000`
- Tender Funerals Canberra Region: `$250,000`
- Orange Sky Australia: `$240,000`
- Equality Australia: `$200,000`

### Empathy Ledger

- Snow Foundation exists as a live organization
- canonical active organization membership count is `8`
- Snow currently has `1` live project: `Deadly Hearts Trek`
- Snow currently has `3` organization transcripts
- Snow currently has `0` published stories and `2` archived smoke-test artifacts
- the Deadly Hearts Trek project framing has been repaired to align with the RHD strategy and transcript layer

## Inference

Snow is a strong fit because the combined stack now mirrors Snow's own public logic back to them:

- place-based investment
- social justice and systems change
- First Nations-led RHD work
- shared intelligence
- community evidence close to decision-making

This is why the strongest opening is not "we have a platform."

It is:

"We made your portfolio more legible across capital, place, partners, and community evidence."

## What this lets us show Snow

### 1. Portfolio legibility

Snow can see one view of:

- where public capital is clustering
- which themes dominate the verified 2024 layer
- which recipient organizations sit inside that network
- how place-based and issue-based work overlap

### 2. Decision support

The stack can already support:

- leadership briefings
- board memos
- partner intelligence notes
- place-based portfolio reviews
- RHD portfolio working sessions

### 3. Evidence discipline

Empathy Ledger gives the portfolio a community-evidence layer instead of leaving it as funding metadata alone.

The strongest current proof is the Deadly Hearts Trek transcript layer and outcomes framing:

- early diagnosis
- community education
- reduced deaths

## Risks and limits

### Verified limitations

- the refreshed view is not the full Snow historical portfolio
- the strongest verified layer is the 2024 annual-report import plus the currently scraped public program surface
- Snow has no live annual-report artifact in Empathy Ledger today
- no active placeholder emails remain in the Snow member layer after the 2026-04-17 cleanup
- the member layer still should not be featured as contact-grade identity data because `7` of `8` active members now have blank/null email values
- the Snow tenant should still be demoed via a fixed route, not exploratory clicking

### Operational risk

- the Empathy Ledger E2E isolation fix is patched locally but still needs merge and deploy so future smoke tests cannot target Snow again

## Recommendation

Send the short email and one-pager only after two final actions:

1. merge and deploy the Empathy Ledger disposable-org E2E fix
2. confirm cultural safety and sharing permissions for the drafted Deadly Hearts Trek evidence pack

Then run the fixed Snow route:

- foundation profile
- funder search context
- briefing hub
- funding brief
- clarity handoff
- Snow dashboard
- Snow transcripts
- Snow analysis

## Bottom line

Snow is now credible enough for a curated outreach because the stack can show a real decision object:

- strategy
- capital
- program surface
- grantee network
- geography
- community evidence

That is materially stronger than sending Snow another abstract platform pitch.
