# Provenance for posts.md

Measured 2026-09-06 inside a rolled-back dry run of migrations 20260906120100 and 20260906120200 on
`tednluwflfhxyucgwigh`. The same SQL produces the same rows on apply; re-measure after apply and
before posting.

| figure | source | confidence |
|---|---|---|
| Cherbourg 1,264 people, decile 1.0, 1 org placed, 1% sure | `mv_lga_allocation` dry run (ABS ERP 2023; SEIFA IRSD 2021 weighted by `abs_poa_lga_ratio`; `gs_entities.lga_code`) | verified (dry run, re-measured live 2026-09-06, unchanged) |
| 114 unplaced sharing Cherbourg's postcode | `mv_lga_allocation.unplaced_sharing_postcodes`, live 2026-09-06 | verified |
| 546 councils | `abs_lga_population` rows after dropping codes starting with 9 | verified |
| $82.0bn government revenue, $10.8bn donations, 2023, placed charities | sums in `mv_lga_allocation`, live 2026-09-06 ($82.03bn, $10.83bn) | verified |
| $107bn and $18.5bn, whole register 2023 | `SELECT sum(revenue_from_government), sum(donations_and_bequests) FROM acnc_ais WHERE ais_year=2023` ($107.27bn, $18.54bn, 53,207 statements) | verified |
| eight councils named, all decile 1.0, gov $/head 0, sure 1–25% | dry-run query `WHERE population > 1000 ORDER BY irsd_decile, gov_revenue_per_head LIMIT 8` | verified (dry run, re-measured live 2026-09-06, unchanged) |
| NIAA $3.84bn, 3,434 awards, delivery state on all, four-digit delivery postcode on 0, "Multiple" on 79 | `grantconnect_awards WHERE approval_date >= current_date - interval '2 years' AND agency = 'National Indigenous Australians Agency'`, live 2026-09-07; window Sep 2024 to Jul 2026, export of 2026-08-04 | verified |
| Health, Disability and Ageing 2% of $21.4bn | same window, agency = 'Department of Health, Disability and Ageing': 2.28% of value, 0.7% of rows, 248 "Multiple" | verified |
| ARC delivery postcode on every dollar | same window, 2,217 rows, 100% of value | verified (control: the field is mapped by `scripts/ingest-grantconnect.mjs` and all agencies were imported the same day, so the silence is GrantConnect's, not the ingest's) |
| 63,565 charities with a statement | `mv_charity_trajectory` count | verified (dry run, re-measured live 2026-09-06, unchanged) |
| 12,114 shrinking · 6,057 lapsed | trend counts | verified (dry run, re-measured live 2026-09-06, unchanged) |
| 3,919 three-year deficits | 1,113 + 761 + 1,621 + 424 + 0 across trends | verified (dry run, re-measured live 2026-09-06, unchanged) |
| 7,431 government-dependent (≥70%) | 4,497 + 1,005 + 579 + 952 + 398 across trends | verified (dry run, re-measured live 2026-09-06, unchanged) |
| $556,330 grant and philanthropic receipts; Snow, VFFF, QIC, Villiers | Goods Asset Register `DECISIONS.md` ruling Z (5 Sep 2026) | verified in repo, not in Xero |
| Centrecorp $123,332, 130 beds, two invoices (INV-0259, INV-0291), Utopia | `DECISIONS.md` ruling Z and line 104 | verified in repo |
| $0 signed for next round | Goods `CONTEXT.md` "0 rows at Committed" | verified: Ben confirmed 2026-09-06 nothing signed since the 25 July snapshot |
| Snow moved first | `CONTEXT.md` "Snow $100K first-mover" | verified in repo; amount withheld from the post |
| QBE $400,000, $750 a bed, 533 beds | `DECISIONS.md` ruling Y | verified in repo |
| "not anti-philanthropy, anti pretending" | studio `docs/strategy/confessions-launch-and-content-engine.md` | verified in repo |
| "we sell foundations nothing and represent none of them" | studio `business/philanthropy-australia-positioning-brief.md` | verified in repo |

Ground pass on the NIAA paragraph run 2026-09-07 against the live table. First wording ("states no
delivery postcode") was held: NIAA states a delivery state on every award and "Multiple" on 79, so
the post says that. Ground pass run 2026-09-06 against the live views after apply. Verdict: PASS, no flags remaining
(Ben cleared the "nothing signed" line on 2026-09-06). Struck: the claimed order in which Fairfax, QIC and Villiers funded (no
source). Reworded: the $82bn/$10.8bn line, which had read as the whole register when it is the
placed subset.
