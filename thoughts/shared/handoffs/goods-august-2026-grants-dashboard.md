# Goods August 2026 Grants Dashboard

Last checked: 2026-08-10.

Production fixes applied: `scripts/sql/2026-08-10-goods-august-grant-triage-fixes.sql`.

Purpose: one triage view for the BFGN August 2026 grant list, showing where each item is tracked across GrantScope, GoHighLevel, and Notion.

## Summary

| Grant | Due | Amount | Goods fit | GrantScope | GoHighLevel | Notion | Next move |
|---|---:|---:|---|---|---|---|---|
| SEDI First Nations Capability Building Grants | Rolling, likely through early 2027 | $50k-$120k | High if applicant is First Nations-owned or controlled and spend is capability services | Tracked: `89e7a97d-6d2d-43d1-8d27-e1d690968702`; score 88; `reviewing`; stale duplicate `db732049b...` archived as duplicate | Tracked: `154zaX1MsHfD15BD8IjM`; Grants pipeline; Grant Opportunity Identified; plus Goods Supporter Journey SEDI capability build `Wx35axGV7phZbXvtKIbn` | Search found Goods-specific SEDI pages; mirror tables have no `notion_grants` row | Keep as priority. Confirm applicant ownership/control and capability-provider scope. |
| QLD Safe Futures Scoping Grants | 2026-08-14 5pm AEST | Up to $30k | Low-medium; only fits QLD domestic/family violence primary prevention and smaller/FN/community-led orgs | Not found | Not found | Only BFGN email hit | Do not promote unless there is a QLD DFV/community partner. Deadline is close. |
| QLD Multicultural Connect Grants Program | 2026-08-30 12:00am AEST | $10k-$500k matched funding | Low unless Goods has a QLD multicultural permanent-facility project and match funding | Not found | Not found | Not found | Park. Needs facility, multicultural-community purpose, and matched funding. |
| VIC Community Recovery 2026-28 Grants | 2026-08-31 11:59pm AEST | Up to $75k | Low unless a January 2026 Victorian bushfire-affected partner leads | Tracked: `332ff88d-b558-41ad-91e4-f09455489362`; open; not_applied; verified 2026-08-09 | Not found | Not found | Keep as data item, not Goods action, unless a Vic affected-community partner appears. |
| Brisbane Youth Climate Action Fund | 2026-08-26 | $1.5k-$7.5k | Low-medium; only through Brisbane youth leads and nonprofit auspice | Tracked: `3030c0bb-a97d-4fb1-bf6a-18c4deb8361b`; `deadline` and `closes_at` corrected to 2026-08-26 | Not found | Not found | Promote only if Brisbane youth-led project exists. |
| TAS Tell Someone Child Safety Small Grants | 2026-08-25 2pm | $500-$10k | Low unless Tasmanian child/youth safety partner leads | Not found | Not found | Only BFGN email hit | Do not promote for Goods unless TAS child-safe practice partner is active. |
| ANZ CEW Woman Leader in Sustainability Scholarship | 2026-08-31 | $25k individual scholarship | Not a Goods organisational grant | Not found | Not found | Not found | Exclude from Goods grant pipeline; route to individual leadership/professional development if relevant. |
| NT Community Benefit Fund Major Community Grants | 2026-08-31 | $15,001-$250k | Medium-high for NT partner-led asset/community benefit work; direct ACT application likely ineligible | Strategy doc only: verified section 13.3 in `docs/strategy/goods-relationship-led-funding-intelligence.md` | Not found for this round | Search found related Aboriginal Investment NT page, not this round | Promote to GrantScope/GHL only if NT-based nonprofit/regional council applicant, authority, budget, and project scope are confirmed. |

## Verified Sources

- SEDI: DSS confirms SEDI grants up to $120k and First Nations grants opened 2026-07-22; IIA says First Nations grants are $50k-$120k and rolling.
- Safe Futures: Queensland DFSDSCS confirms scoping grants opened 2026-07-17 and close 2026-08-14 at 5pm, up to $30k.
- Multicultural Connect: Queensland SmartyGrants confirms Category A/B close 2026-08-30 at 12:00am AEST.
- VIC Community Recovery: vic.gov.au confirms open, closes 2026-08-31, funding up to $75k.
- Brisbane Youth Climate Action Fund: Brisbane City Council confirms applications open until 2026-08-26.
- Tell Someone: Tasmanian Tell Someone page confirms applications close 2026-08-25 at 2pm, $500-$10k tiers.
- ANZ CEW: CEW confirms applications close 2026-08-31 and scholarship value is $25,000 AUD.
- NT CBF Major Community Grants: NT Government confirms Round 1 opens 2026-07-01 and closes 2026-08-31, $15,001-$250,000.

## System Findings

- GrantScope currently tracks SEDI First Nations, VIC Community Recovery, and Brisbane Youth Climate Action Fund from this list.
- Brisbane Youth Climate Action Fund now has `deadline=2026-08-26`, `closes_at=2026-08-26`, and a fresh `last_verified_at`.
- Empty duplicate SEDI row `db732049-bb83-43ea-902e-26288ab7684e` is archived with `application_status=duplicate` and metadata `duplicate_of=89e7a97d-6d2d-43d1-8d27-e1d690968702`.
- GoHighLevel currently mirrors SEDI only from this list:
  - `154zaX1MsHfD15BD8IjM` - SEDI First Nations Social Enterprise Grants, Grants pipeline, Grant Opportunity Identified.
  - `D1LETnsjVjmMqa0877Yd` - SEDI Capability Building Grant, Grants pipeline, Grant Opportunity Identified.
  - `Wx35axGV7phZbXvtKIbn` - SEDI Capability Building Grants - Goods capability build, Goods Supporter Journey, Qualified.
  - `gkQc9FSKuVQYTfv3E5pN` - SEDI Capability Building Grants (DSS), Grants pipeline, declined.
- Notion search finds multiple SEDI pages and the `Goods Pipeline Command Centre`, but the mirrored `notion_grants` and `notion_opportunities` tables have no exact rows for this August list.
- There are no project-level `act_grant_recommendation_decisions` or `funding_ghl_handoffs` for these exact GrantScope rows.

## Actions

1. Done: fixed Brisbane Youth Climate Action Fund close date in GrantScope from `2026-07-22` to `2026-08-26`.
2. Done: consolidated the duplicate/stale SEDI First Nations GrantScope row by archiving the empty duplicate and pointing it to the verified scored row.
3. Promote NT CBF Major Community Grants only after confirming an NT-based applicant and project authority.
4. Leave Safe Futures, Multicultural Connect, VIC Recovery, Tell Someone, and ANZ CEW out of active Goods pursuit unless a matching partner/use case is named.
5. Done: added a simple Notion dashboard block under `Goods Pipeline Command Centre` and kept this repo file as the audit trail.
