# The unfiltered money views — per-view verdicts

**Date:** 2026-08-16 · **Method:** every view/matview reading `justice_funding` (42 via `pg_depend`),
judged FOR ITS PURPOSE by probing its top rows for the two contamination signatures: whole-of-state
budget recipients (departments at $bn) and aggregate-shaped names (TOTAL RPA, Queensland Rail's
mislabelled rows). A "state expenditure" view SHOULD include budget rows; an "organisations" view
must not. Consumer counts are `grep -rl` over `apps/web/src`.

**The mandate:** ledger item "decide per-view whether each of the 35 unfiltered money views is
wrong FOR ITS PURPOSE." All figures below were measured this session, live.

## SEVERE — wrong for purpose, actively consumed. Fix in this order.

| view | consumers | evidence | why it's wrong |
|---|---|---|---|
| `mv_revolving_door` | **19 files** | TOTAL RPA $4.74bn and QUEENSLAND RAIL $4.10bn in `total_funded`; depts at $10bn | "Entities with 2+ influence vectors" — a spreadsheet total row cannot lobby. `receives_funding` presence flag inflates `influence_vectors`, which reorders `revolving_door_score`, a RANKING. Same defect class as the power index, fixed the same way. |
| `mv_yj_report_recipients` | 0 app, **but feeds the public QLD youth-justice snapshot** via `build-youth-justice-report-snapshot.mjs` / `refresh-youth-justice-report-cache.mjs` | Top "recipients": Dept of Youth Justice $11.40bn, DJCS $10.03bn — budget rows | "Top youth-justice funding recipients" led by five departments' whole-of-state budgets, in the most-sourced public report in the repo. |
| `mv_funding_outcomes_summary` | 1 | QLD Dept of Youth Justice **$258.50bn** `total_funding` | Contamination × join fan-out — an entity showing ~8x the whole table's honest total. Proof-completeness scores built on this are noise. |
| `mv_justice_proven_suppliers` | 2 | Dept of Justice & Community Safety $10.03bn as a "proven supplier" | "A supplier with justice funding history" — departments are the buyers, not suppliers. |
| `mv_grant_contract_overlap` | 1 | Depts at $10.03bn / $9.18bn as grant recipients | "Organisation receiving both grants and contracts" (the Double-Dippers lane) — budget rows counted as received grants. |
| `mv_youth_justice_entities` | 1 | Dept of Justice $1.02bn, Qld Dept of Youth Justice $938m in an org list | Topic scoping shrinks but does not remove the budget rows. |
| `mv_person_network` + `mv_person_entity_network` + `mv_person_entity_crosswalk` | 3 + 4 + 1 | People "linked" to $1.6bn via unfiltered sums | The known person→money lane. Fix belongs with the person-influence work (the `_v2` de-collide pattern), not piecemeal. |

## MILD — real organisations, unfiltered residual. Fix opportunistically.

| view | consumers | evidence | note |
|---|---|---|---|
| `mv_trustee_grantee_overlaps` | 1 | LWB `funding_to_recipient` $1.29bn vs ~$0.95bn filtered elsewhere | Real orgs; ~25% overstatement on the largest. |
| `v_goods_relationship_funding` | 1 | Barnardos $132.8m top — plausible | Goods relationships are real orgs; aggregates rarely attach. Filter anyway when touched (its `justice_total` name is also the old vocabulary). |
| `mv_triple_proof_suppliers` | 1 | Legal Aid Qld $1.15bn top, no depts visible | Join to contracts+ALMA already excludes most junk. |
| `v_org_funding_profile` | 2 | WAPHA $3.19bn grants_received — plausibly GrantConnect PHN money | Verify which lane feeds `grants_*` before judging further. |
| `mv_org_justice_signals` | 1 | Signals view; money incidental | Low stakes. |

## OK FOR PURPOSE — no action

`mv_yj_report_acco_gap` (totals $1.02bn ≈ the honest youth-justice figure; the public "12% ACCO"
claim checks out) · `v_acco_yj_retention_qld` (counts, not dollars) · `mv_lga_indigenous_proxy_score`
(plausible magnitudes) · `v_prf_portfolio_outcomes` ($3.5m scale, PRF partners) ·
`justice_funding_clean`, `v_announced_money_by_kind`, `v_award_rows`, `v_program_spine`,
`v_program_deliverers`, `v_youth_justice_recipients`, `v_entity_name_candidates` (carry
measure_kind and/or is_aggregate already) · `mv_justice_charity_financial_health`,
`v_funding_ingest_health`, `v_funding_program_names` (no money) · `mv_entity_power_index`,
`mv_entity_total_funding` (fixed 2026-08-16).

## UNCONSUMED — defer; judge only if something starts reading them

`v_entity_360` · `v_funding_outcomes_chain` · `v_justice_funding_by_org` ·
`v_justice_funding_by_program` · `v_justice_funding_summary` · `v_goods_life_events` (6 consumers
but amounts are per-event rows on real orgs — borderline, listed here for the money lane only) ·
`mv_yj_report_coverage` / `_remoteness` / `_state_programs` / `_state_program_partners` (the last
two carry `is_aggregate` already; all script-fed into the same snapshot as `_recipients` — fix as
one family) · `mv_yj_report_state_top_orgs` · `v_youth_justice_entities`.

## The fix pattern

Same as the power-index chain: capture `pg_get_viewdef`, add
`measure_kind = 'grant' AND is_aggregate IS NOT TRUE` (and the name residual via
`lower(btrim(recipient_name))` where a sum must be exact) at the `justice_funding` read site,
enumerate dependents with `BEGIN; DROP ... CASCADE; ROLLBACK;` first, restore indexes and
`pg_class.relacl` grants exactly. Each is a production rebuild Ben applies.

**Recommended order:** 1. `mv_revolving_door` (19 consumers, a public ranking) →
2. the `mv_yj_report_*` family as one migration (public report) → 3. `mv_funding_outcomes_summary`
(also fix the fan-out, not just the filter) → 4. `mv_justice_proven_suppliers` +
`mv_grant_contract_overlap` + `mv_youth_justice_entities` → 5. the person trio, with the
person-influence lane.
