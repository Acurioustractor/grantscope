# Provenance for posts.md

Measured 2026-09-06 inside a rolled-back dry run of migrations 20260906120100 and 20260906120200 on
`tednluwflfhxyucgwigh`. The same SQL produces the same rows on apply; re-measure after apply and
before posting.

| figure | source | confidence |
|---|---|---|
| Cherbourg 1,264 people, decile 1.0, 1 org placed, 1% sure | `mv_lga_allocation` dry run (ABS ERP 2023; SEIFA IRSD 2021 weighted by `abs_poa_lga_ratio`; `gs_entities.lga_code`) | verified (dry run) |
| "about a hundred more share its postcode" | 1% placed share with 1 placed implies ~99 unplaced sharing postcodes; exact `unplaced_sharing_postcodes` not printed | inferred, re-check |
| 546 councils | `abs_lga_population` rows after dropping codes starting with 9 | verified |
| $82.0bn government revenue, $10.8bn donations, 2023 | sum of `charity_gov_revenue`, `charity_donations` in `mv_lga_allocation` (acnc_ais 2023 joined to placed entities; charities NOT placed in a council are excluded, so the whole-register figure is higher) | verified (dry run) |
| eight councils named, all decile 1.0, gov $/head 0, sure 1–25% | dry-run query `WHERE population > 1000 ORDER BY irsd_decile, gov_revenue_per_head LIMIT 8` | verified (dry run) |
| 63,565 charities with a statement | `mv_charity_trajectory` count | verified (dry run) |
| 12,114 shrinking · 6,057 lapsed | trend counts | verified (dry run) |
| 3,919 three-year deficits | 1,113 + 761 + 1,621 + 424 + 0 across trends | verified (dry run) |
| 7,431 government-dependent (≥70%) | 4,497 + 1,005 + 579 + 952 + 398 across trends | verified (dry run) |
| $556,330 grant and philanthropic receipts; Snow, VFFF, QIC, Villiers | Goods Asset Register `DECISIONS.md` ruling Z (5 Sep 2026) | verified in repo, not in Xero |
| Centrecorp $123,332, 130 beds, two invoices (INV-0259, INV-0291), Utopia | `DECISIONS.md` ruling Z and line 104 | verified in repo |
| $0 signed for next round | Goods `CONTEXT.md` "0 rows at Committed" | verified in repo (CRM snapshot 2026-07-25) |
| Snow moved first | `CONTEXT.md` "Snow $100K first-mover" | verified in repo; amount withheld from the post |
| QBE $400,000, $750 a bed, 533 beds | `DECISIONS.md` ruling Y | verified in repo |
| "not anti-philanthropy, anti pretending" | studio `docs/strategy/confessions-launch-and-content-engine.md` | verified in repo |
| "we sell foundations nothing and represent none of them" | studio `business/philanthropy-australia-positioning-brief.md` | verified in repo |

Not run: `/ground` refute pass. Run it after the migrations are applied so the refute can query the
live views.
