# Project codes across systems, audited 2026-09-26 (read-only)

Source of truth: act-global-infrastructure/config/project-codes.json (78 projects). V = queried, I = inferred.

| System | Uses | Main drift |
|---|---|---|
| Xero live (Project Tracking, 31 options) V | file codes | 31 match exactly; extra options ReefTO, Unassigned; active codes with no option: CORE, CS, CE, CM, CT, CP, RT, OS, GS, PB, DLB, CVN, PK, CTP, FG |
| Supabase xero_* V | derived project_code | ACT-CORE on 472 txns though live Xero has no CORE option; tracking_option empty on 2,447 of 2,448 invoices |
| GHL opportunities V | project_code | 321 of ~760 synced have none (Harvest Membership 181, Harvest Inbox 64); GOODS pipelines carry FP, WE, SH, SE, MN, BB |
| GHL contact tags V | project:act-xx | duplicate name tags: project:goods-on-country 468, project:contained 115, project:contained-adelaide-2026 111; file ghl_tags barely used |
| CivicGraph org_projects V | codes | ACT-JH-CT (Contained, file ACT-CN), ACT-JH-CG (CivicGraph, file ACT-CS and ACT-GS), ACT-PI-ER (file ACT-ER), ACT-JH-AL, ACT-PI-SP (no file code) |
| grant_opportunities.aligned_projects V | 63 values | WATCH 133, goods 63, harvest 9, Harvest 2, The Farm 2, ACT-BV 3, ACT-PC 1, ACT-CG 1 |
| Scorers V | codes + slugs | act-grant-eligibility.ts keys by slug |
| Notion V (3 of 9) | ACT Project Code property | only 9 of 78 have notion_page_id, 4 of those archived; titles drift ("Goods. HQ") |
| Gmail V | 7 ACT/ name labels | no codes; "Justice + CONTAINED" merges JH and CN |
| Calendar V | 8 calendars | no codes in events |
| Dext V | no category column | dext_category cannot be compared |

Dead file codes (in no system): RT, GS, PB, DLB, CVN, PK, CTP, TV, QF, BM, TW, HS, DH, MM, SF, SX.
Orphans (in systems, not in file): WATCH, ACT-BV, ACT-PC, ACT-CG, ACT-JH-CT/CG/AL, ACT-PI-ER/SP, name tags, ReefTO, Unassigned.

Proposal (not done): Gmail labels `ACT/<CODE> <Name>` generated from the file, split JH and CN, non-project labels under `ACT/_ops/`; Calendar `[ACT-XX]` title prefix plus a calendar_keyword field. Add gmail_label and calendar_keyword to the file.
