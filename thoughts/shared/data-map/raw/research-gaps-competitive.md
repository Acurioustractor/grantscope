# Competitive and Gap Research — CivicGraph / JusticeHub

**Written:** 2026-08-14
**Scope:** who already does this in Australia, what this database uniquely holds, and where to cast the net wider.
**Method:** web research (cited inline) + direct verification against the shared Supabase project `tednluwflfhxyucgwigh` and the census files in this scratchpad. Every DB claim below is marked **[verified]** (I ran the query or read the census file), **[inferred]**, or **[unverified]**.

---

## 0. The one-paragraph answer

Australia has excellent *vertical* public data and almost no *horizontal* joins. ACNC publishes charity financials, AusTender publishes contracts, GrantConnect publishes grants, AEC publishes donations, AIHW publishes youth justice, ABS publishes places — each is machine-readable, each is siloed, and every one of them stops at the boundary of its own regulator. Nobody publishes the join. The three genuine white spaces are: **(a) governance-to-money** (which people sit on which boards, and what those boards receive), **(b) place-resolved cross-system flow** (all money types resolved to the same LGA/postcode spine), and **(c) high-cadence carceral facts** (facility-level, near-daily). CivicGraph already holds all three in raw form. It has 52.3M rows across 724 populated objects, including 440,128 directorship edges and a QLD watchhouse series at a granularity no public source publishes. The gap is not acquisition, it is *exposure and provenance* — and the one acquisition that would change the shape of the asset is ASIC officeholders, which is licensed, not free.

---

## 1. Who already does this in Australia

### 1.1 Charity + philanthropy

| Source | What it covers | Granularity | Machine-readable? | Blind spot |
|---|---|---|---|---|
| **ACNC Charity Register** ([data.gov.au/dataset/acnc-register](https://data.gov.au/data/dataset/acnc-register)) | Every registered charity: ABN, name, size, address, purposes, DGR status | Entity-level, national | **Yes** — CSV/XLSX bulk, CC BY 3.0 AU, updated regularly | Register bulk file **does not include Responsible Persons names**. Those live only on the per-charity web page "People" tab ([ACNC](https://www.acnc.gov.au/charity/about-charity-register)). Charities can also apply to have information withheld. |
| **ACNC Annual Information Statement (AIS)** | 60+ financial fields per charity per year: revenue by source, government revenue, grants made, employee expenses, assets, liabilities, KMP count and total pay, volunteers | Entity × year | **Yes** — bulk AIS published annually, updated weekly ([ACNC](https://www.acnc.gov.au/2025-bulk-annual-information-statement)) | Reported figures only, no program-level or geographic split of a charity's *spend*. Basic religious charities exempt. |
| **Australian Charities Report (11th ed.)** | The authoritative sector aggregate: $222bn revenue (+10.7%), 52,267 statements for 2023, XL charities take 51.8% of revenue from government vs 8.1% for XS ([ACNC](https://www.acnc.gov.au/tools/reports/australian-charities-report-11th-edition)) | National / size band / state | Report + a Charity Data Explorer | Aggregate only. Cannot be drilled to entity, and does not connect to procurement or donations. |
| **Foundation Maps: Australia** (Candid + Philanthropy Australia) | Interactive map of who funds what and where | Grant-level, but **only from foundations that voluntarily submit a grants file** | No open export; **members-only** via Better Giving Hub ([Philanthropy Australia](https://www.philanthropy.org.au/about-us/publications/foundation-maps-australia/), [share your grants data](https://www.philanthropy.org.au/guidance-and-tools/grantmaking-resources/share-your-grants-data/)) | This is the closest direct competitor to a "philanthropy map" — and its coverage is opt-in and paywalled. There is **no Australian 360Giving**. |
| **Our Community / SmartyGrants + CLASSIE** | Australia's most-used grants administration system; CLASSIE is the AU/NZ classification standard, adopted by ACNC's Register, CSI's Amplify and ChangePath ([Our Community](https://www.ourcommunity.com.au/classie)) | Application-level, inside customer tenancies | Standard is open; **the grant data is not** | SmartyGrants sits on the richest un-published grantmaking dataset in the country (applications, assessments, outcomes) and does not open it. CLASSIE is a taxonomy, not a data release. |
| **JBWere (Charitable Giving Index, Support Report)** | Giving trends from NAB transaction data; PAF/PubAF counts (2,388 PAFs at June 2025) ([JBWere](https://www.jbwere.com.au/campaigns/jbwere-nab-charitable-giving-index-)) | National, cause-band, some state | No — PDF reports | Proprietary transaction panel. Not reproducible, not joinable. |
| **ChangePath / CSI Amplify** | Charity transparency and financial ratings built on ACNC data ([ChangePath](https://www.changepath.com.au/)) | Entity-level | Website | Derivative of ACNC. No procurement, no donations, no governance. |
| **Productivity Commission, *Future foundations for giving* (Report 104, 10 May 2024, released 18 Jul 2024)** | 9 findings, 19 recommendations. Explicitly recommends government "create more value for the public from the data collected about charities" — improve the Register, and **collect and publish additional data on ancillary funds, corporate giving, volunteering and charitable bequests** ([PC inquiry page](https://www.pc.gov.au/inquiries-and-research/philanthropy/report/), [full report PDF](https://assets.pc.gov.au/inquiries/completed/philanthropy/report/philanthropy.pdf)) | — | — | **This is the policy tailwind.** The PC has publicly named the exact data gaps CivicGraph fills. Nobody has built the thing the PC asked for. |

### 1.2 Government money

| Source | What it covers | Granularity | Machine-readable? | Blind spot |
|---|---|---|---|---|
| **AusTender** | Commonwealth contract notices; also carries some state disclosures (NSW eTender) [per buyer-wedge.md, verified 2026-08-08] | Contract-level: value, buyer, supplier, ABN, dates, category | Yes — bulk CSV | No supplier ownership, no director link, no outcome. Supplier name inconsistency is severe. |
| **GrantConnect** | Commonwealth grant opportunities + grants awarded, published within 21 days of announcement, updated daily ([GrantConnect help](https://help.grants.gov.au/getting-started-with-grantconnect/information-made-easy/awards-by-agency/)) | Grant-level: recipient, ABN, value, program, dates, location | Yes | Commonwealth only. No link to whether the recipient is a charity, who runs it, or what happened. |
| **State grant portals** | QLD publishes many recipient-level grant datasets on data.qld.gov.au ([grants tag](https://www.data.qld.gov.au/dataset?tags=grants)); NSW and VIC are patchier | Program-by-program datasets | Partly — CKAN, inconsistent schemas | **No national state-grants aggregation exists.** Each program is its own CSV with its own columns. This is exactly where a normalising layer earns its keep. |
| **data.gov.au** | ~7,200+ federal/state datasets ([Open Council Data toolkit](https://opencouncildata.org/australia/)) | Varies | CKAN API | Discovery layer, not a join layer. Datasets are not entity-resolved to each other. |
| **Local government** | Open Council Data Standards, developed with Open Knowledge Australia, MAV Technology and the LG Spatial Reference Group ([standards.opencouncildata.org](https://standards.opencouncildata.org/)) | Council-level | Standards exist; adoption is thin | **Council grants and community funding are effectively invisible nationally.** Hundreds of councils, no aggregation. |

### 1.3 Influence and governance

| Source | What it covers | Granularity | Machine-readable? | Blind spot |
|---|---|---|---|---|
| **AEC Transparency Register** | Annual disclosure returns from parties, donors, third parties, associated entities. 2024–25 returns published 2 Feb 2026 ([AEC](https://www.aec.gov.au/media/2026/02-02.htm)); threshold for 2024–25 was $16,900 | Donor × recipient × FY | Yes — [transparency.aec.gov.au](https://transparency.aec.gov.au/) with filters and data export | Annual lag of up to 19 months; high threshold hides most giving; donor ABN often absent or inconsistent. |
| **AEC reform — Electoral Legislation Amendment (Electoral Reform) Act 2025** | **From 1 July 2026:** disclosure threshold drops to **$5,000**; reporting moves from financial year to **calendar year**; gift and electoral expenditure **caps** introduced; **donations for a federal purpose must be reported as fast as within 24 hours during an election period** ([AEC explainer PDF, Oct 2025](https://aec.gov.au/FADReform/files/Changes-to-Funding-and-Disclosure-Explained-Oct-2025.pdf)) | Same, but far denser and near-real-time | New AEC digital platform being built | **The single biggest incoming data event in this space.** Volume and cadence of political donation data are about to step-change. Whoever has the entity-resolution spine ready when it lands owns the analysis. |
| **ASIC Company Dataset (free)** | ~3.4m companies, weekly point-in-time snapshot on data.gov.au ([ASIC](https://www.asic.gov.au/online-services/search-asic-registers/data-gov-au/)) | Company-level | Yes, XLSX/CSV weekly | **Contains no officeholders.** [verified: our `asic_companies` table's 23 columns are exactly the free-file fields — acn, abn, names, type/class/subclass, status, registration dates, state reg number, current-name indicator. No director column exists.] |
| **ASIC officeholders / ASCOT** | Director and secretary names, positions, appointment dates, addresses | Company × person | **Only via paid per-company extract or a commercial bulk data licensing agreement**; no public real-time API ([businessdataguide 2026 guide](https://businessdataguide.com/blog/jurisdictions/australia-company-search-guide), [Kyckr guide](https://kyckr.com/guides-and-reports/australia-business-register-asic-guide-2025)) | **The paywall that defines the whole Australian governance-transparency problem.** Redistributing ASIC extract data commercially without a licence is restricted. |
| **Beneficial ownership register** | Would name real controllers behind companies | — | — | **Not happening soon.** Government abandoned the "unlisted entities maintain their own public register" model in favour of a centralised ASIC-aligned register; detailed policy work resumes **early 2027**, public consultation after that ([HSF Kramer, Oct 2025](https://www.hsfkramer.com/insights/2025-10/beneficial-ownership-reporting-for-unlisted-entities-an-update), [Treasury minister release](https://ministers.treasury.gov.au/ministers/andrew-leigh-2025/media-releases/improving-transparency-true-owners-companies)). ASIC received $207m over 2025–26 to 2026–27 to stabilise the register first. |
| **OpenCorporates** | Mirrors ASIC and ORIC registers ([registers/16](https://opencorporates.com/registers/16), [registers/17](https://opencorporates.com/registers/17)) | Company-level | API, licensed | AU officer coverage is thin because the upstream free feed has none. Not a shortcut around the ASIC paywall. |
| **ORIC** | CATSI Act corporations register, including officers on the public register | Corporation-level | **No bulk export.** ORIC states it "does not have a data export function on the public register for privacy and other reasons" and its policy is not to provide data outside the public domain ([ORIC data about corporations](https://www.oric.gov.au/corporations-and-registers/data-about-corporations)). A registered/deregistered corporations dataset exists on [data.gov.au](https://www.data.gov.au/data/dataset/aboriginal-and-torres-strait-islander-corporations-oric) | Officers are visible per-corporation but not obtainable in bulk without scraping. |
| **Lobbyist registers** | Federal ([lobbyists.ag.gov.au](https://lobbyists.ag.gov.au/register), Excel export of lobbyists + clients), NSW ([Data.NSW dataset](https://data.nsw.gov.au/data/dataset/register-of-third-party-lobbyists), includes **client ABNs**), VIC, QLD | Lobbyist × client | Federal Excel, NSW CKAN; VIC/QLD unconfirmed | Third-party lobbyists only. In-house lobbying invisible. No meeting-level record except ministerial diaries. |
| **OpenAustralia Foundation** — They Vote For You, OpenAustralia Hansard, Right To Know, PlanningAlerts | Parliamentary voting, Hansard, FOI, development applications | Vote/speech level | **Yes — open API** ([openaustralia.org.au/api](https://www.openaustralia.org.au/api/), [TVFY GitHub](https://github.com/openaustralia/theyvoteforyou)) | Federal parliament focus, one part-time researcher. No connection to money. |

### 1.4 Youth justice, child protection, crime

| Source | What it covers | Granularity | Cadence | Blind spot |
|---|---|---|---|---|
| **AIHW *Youth detention population in Australia*** | Detention population; June qtr 2025: 884 young people on an average night, 91% male, 81% aged 14–17, **56% First Nations** ([AIHW 2025](https://www.aihw.gov.au/reports/youth-justice/youth-detention-population-in-australia-2025/contents/summary)) | **State/territory** | **Quarterly** | No facility, no LGA, no organisation. Reports average nightly population per quarter. |
| **AIHW *Youth justice in Australia*** (annual, from YJ NMDS) | Full supervision picture — community + detention, orders, characteristics | State/territory; published breakdowns include **remoteness area** and **socioeconomic area** [verified from the 2024–25 report's contents structure] | Annual | SA4 exists *in the NMDS* — AIHW technical notes list Australia, states/territories and **SA4** as main geographic structures, with exclusions for out-of-jurisdiction or unmatched postcodes ([AIHW YJ collection](https://www.aihw.gov.au/about-our-data/our-data-collections/youth-justice), [Indigenous Justice Clearinghouse on JJ NMDS](https://www.indigenousjustice.gov.au/datasets/juvenile-justice-national-minimum-data-set/)). **Direct NMDS access is restricted, requires application and may attract fees.** |
| **AIHW *Child protection Australia*** | Notifications, substantiations, orders, out-of-home care; ~179,000 children in contact in 2023–24; OOHC rate stable ~8.0/1,000 ([AIHW](https://www.aihw.gov.au/reports-data/health-welfare-services/child-protection/data)) | **State/territory**, plus Indigenous status, age, sex, remoteness | Annual, XLSX data tables | **No sub-state geography in the published tables.** |
| **Report on Government Services (RoGS), Part F** | Child protection **$10.2bn**, youth justice **$1.5bn**; 60 notifications/1,000 children; 45,936 children on care and protection orders at 30 June 2025 ([RoGS 2025 Part F](https://assets.pc.gov.au/ongoing/report-on-government-services/2025/community-services/rogs-2025-partf-overview-and-sections.pdf), [RoGS 2026 youth justice](https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/)) | **State/territory columns** | Annual (January) | Wide-format tables with a state column per jurisdiction. Spending is service-type, never provider-level. |
| **Closing the Gap dashboard, Outcome 11** | First Nations 10–17 detention rate 25.7 per 10,000 in 2024–25; **no change from baseline, worsening since 2022**; QLD and NT worsening ([PC dashboard](https://www.pc.gov.au/closing-the-gap-data/dashboard/outcome-area/youth-justice/)) | State/territory, sex, age band | Annual | Target-tracking, not causal. No spend link. |
| **ABS *Recorded Crime — Offenders*** | 44,583 offenders aged 10–17 proceeded against in 2024–25 (−5%); youth offender rate fell 1,764 → 1,660 per 100,000 ([ABS latest release](https://www.abs.gov.au/statistics/people/crime-and-justice/recorded-crime-offenders/latest-release)) | State/territory and **SA4** (QLD commentary references its 19 SA4 regions) | Annual | Police-proceedings basis, not court or detention. |
| **State crime agencies** (BOCSAR NSW, CSA VIC, QGSO QLD, SA OCSAR) | Recorded offences | **LGA-level, and NSW back a decade** | Quarterly/annual | Different offence taxonomies per state. No national concordance. |
| **Guardian Australia *Deaths Inside*** | Indigenous deaths in custody, compiled from coronial inquests plus media/police statements; hosted on the [Indigenous Justice Clearinghouse](https://www.indigenousjustice.gov.au/datasets/deaths-inside/) | Individual case | Irregular | The best example of what data journalism does here: one dimension, deeply, non-joinable to money. |
| **Children's Commissioners / Guardians (8 jurisdictions)** | Inspection reports, systemic reviews | Narrative PDFs | Irregular | Findings and recommendations are unstructured. Nobody has made them queryable. |

### 1.5 Identity / place backbone

- **ABR / ABN Lookup** — the universal join key. Bulk extract available. [verified: our `abr_registry` holds **20,006,350** rows.]
- **ABS** — SEIFA 2021, ASGS (SA1–SA4, LGA, POA/SAL concordances), ERP. All free, all machine-readable, all essential, all already ingested here.
- **AIHW RIFIC** — technical notes and indicator definitions ([rific.gov.au](https://www.rific.gov.au/resources/technical-notes/closing-the-gap/target-11)).

---

## 2. The overlap gap — cross-sections nobody publishes

Below: **12 cross-sections**, each stated as a testable question, each checked against `populated_objects.md` and (where marked) a live query. "Rows" are exact counts from the 2026-08-14 census.

> **Standing caveat for all of them.** These are *answerable*, not *published-ready*. Every one carries entity-resolution risk, and #1–#3 additionally carry person-resolution risk (see §3.3).

| # | Cross-section nobody in Australia publishes | Tables that answer it | Status |
|---|---|---|---|
| **1** | **"Which people sit on multiple charity boards, and how much public money flows to the boards they sit on?"** | `mv_board_interlocks` 39,757 rows. [verified by query] **8,781** of those multi-board people connect to procurement dollars, **11,226** to justice funding, **1,194** to political donations, **3,510** connect at least one community-controlled org. | **Answerable today.** Nothing public does this. Caveat: `max(board_count)=745`, a nominee-block artifact — the cap discipline in MEMORY.md is load-bearing. |
| **2** | **"Which foundation trustees also sit on the boards of the organisations their foundation funds?"** | `mv_trustee_grantee_chain` 79,535 rows. [verified by query] But: only **195 distinct trustees**, **25 foundations**, 4,649 grantees, and **87 rows where `trustee_on_grantee_board` is true**. | **Answerable but narrow.** The MV is a wide cross-product off a small trustee base. This is a genuine world-first *shape* and an honest-scope problem. Widening the foundation-board base is the highest-leverage governance work available. |
| **3** | **"Which entities appear in two or more influence systems at once — lobbying, donating, contracting, receiving funding?"** | `mv_revolving_door` 6,976 rows (`lobbies`, `donates`, `contracts`, `receives_funding`, `influence_vectors`, `revolving_door_score`). Backed by `gs_relationships` [verified] **2,452 `lobbies_for` edges**. | **Answerable today.** No public source has all four vectors on one key. |
| **4** | **"Did a donation to a party precede a contract from that government, and by how many days?"** | `mv_donation_contract_timing` 232,474 rows — carries `donation_date`, `contract_start`, `days_between`, `timing_window`, `roi_multiple`. Plus `mv_gs_donor_contractors` 2,097, `mv_fy_donation_contracts` 50,685. | **Answerable today, at scale.** WHY.md's "140 entities, $80m donated, $4.7bn contracts" claim now sits on a 2.5m-row donation table. This is the single most publishable finding in the database — and the most defamation-sensitive. Correlation only. |
| **5** | **"For a given LGA: disadvantage, crime rate, youth offenders, funding received, and how many organisations are actually there?"** | `mv_funding_deserts` 1,997 LGA rows (SEIFA + remoteness + 6 system flows + NDIS + `desert_score`); `crime_stats_lga` 58,125 rows; `mv_funding_by_lga` 1,729; `lga_cross_system_stats` 361 rows (carries `youth_offenders`, `detention_beds`, `ndis_youth_participants`, `avg_icsea`, `crime_rate_per_100k` in one row). | **Answerable today for 361 LGAs.** [verified] `crime_stats_lga` coverage is uneven: NSW 51,480 rows / 99 LGAs / **2015-16 through 2024-25**; QLD 4,082 / 78 LGAs / 1 period; VIC 1,873 / 79; SA 617 / 69; NT 60 / 6; ACT 13. **WA and TAS absent.** |
| **6** | **"Which organisations receive justice funding, hold government contracts, AND have evidence of what works?"** | `mv_youth_justice_entities` 5,469 rows joining `justice_funding` + contracts + `alma_interventions` + evidence levels + `avg_cost_per_person`; `mv_evidence_backed_funding` 415; `mv_intervention_funding_chain` 341; `alma_interventions` 2,136 / `alma_evidence` 631 / `alma_outcomes` 2,869. | **Answerable today.** Absolutely nobody publishes funding-to-evidence links. This is the "Governed Proof" product and it has data under it. |
| **7** | **"Who is in a Queensland police watchhouse tonight — which watchhouse, what age, First Nations status, and how long have they been there?"** | `qld_watchhouse_snapshot_rows` **8,488** rows / `qld_watchhouse_snapshots` 201. [verified by query] **63 distinct watchhouses**, **2026-04-28 → 2026-08-13**, with `age_group`, `first_nations`, `custody_0_2_days` / `3_7_days` / `over_7_days`, `longest_days`. | **Answerable today, and this is the crown jewel.** AIHW is quarterly and state-level. This is **facility-level and near-daily**. No public dataset in Australia has this shape. |
| **8** | **"Which ministers met which organisations, and did those organisations subsequently win contracts?"** | `civic_ministerial_diaries` 1,728 rows with `organisation_abn` and `linked_entity_id` → `austender_contracts` 823,620 / `grantconnect_awards` 291,264. | **Answerable today at small scale.** 1,728 meetings is a pilot, not a corpus. Ministerial diaries are published by several jurisdictions and are almost entirely unmined. |
| **9** | **"Is the charity delivering this government service financially healthy, and how dependent is it on that one contract?"** | `acnc_ais` **360,488** rows × 60+ financial fields (`revenue_from_government`, `total_revenue`, `net_surplus_deficit`, `net_assets_liabilities`, `total_paid_key_management`) joined by ABN to contracts. `mv_justice_charity_financial_health` 5,898 rows already does this for the justice subset. | **Answerable today.** This is the commissioning question every government buyer has and cannot answer. Directly serves the buyer wedge. |
| **10** | **"Where are NDIS participants and providers relative to disadvantage and to where the money goes?"** | `ndis_utilisation` 143,987; `ndis_active_providers` 134,572; `ndis_participants` 67,353; `ndis_registered_providers` 48,510; `ndis_market_concentration` 14,915; `ndis_participants_lga` 8,329 (LGA + service district + quarter); `ndis_first_nations` 1,486; `mv_disability_landscape` 598. | **Answerable today.** NDIS market concentration × SEIFA × remoteness is publishable research nobody has done. |
| **11** | **"Which schools with low ICSEA sit in LGAs with high youth-offender rates and low community-org density?"** | `acara_schools` 9,755 (ICSEA, indigenous_pct, LGA, lat/lon) × `crime_stats_lga` × `mv_funding_deserts` × `gs_entities` LGA spine. | **Answerable today** for the states where `crime_stats_lga` has coverage. |
| **12** | **"What did parliament say about this program, and what did the coroner find, and who is funded to do it?"** | `civic_hansard` 647 (with `mentioned_orgs`, `mentioned_amounts`, `linked_funding_ids`, `linked_intervention_ids`), `parliament_bills` 249, `coroners_findings` 39 (with `is_youth_justice`, `is_in_custody`, `recommendations_count`), `children_commissioner_reports` 11, `alma_media_articles` 872, `civic_intelligence_claims` 88. | **Structurally answerable, evidentially thin.** The schema for narrative→money linking exists and is good. The corpus is a demo. This is where "media" in the vision currently lives, and it is the weakest limb. |

### Cross-sections that are *claimed* but do not hold up

Honesty matters more than the pitch here.

- **`mv_board_contractor_links` has 4 rows. `mv_board_donor_links` has 2. `mv_multi_board_persons` has 1.** [verified from census] These three MVs are supposed to be exactly cross-sections #1 and #4 and they are effectively empty, while `mv_board_interlocks` (39,757) carries the real signal. Either they are stale, or their join predicate is broken. **Do not cite them, and do not build UI on them until someone reads their definitions.** This is a live bug, not a data gap.
- **`aihw_youth_justice_stats` has 13 rows.** [verified by query] One year (2024-25), state-level, `source_table = 'PDF_HEADLINE'` — scraped from a report headline, **NT missing entirely**. Any map or dashboard framed as "AIHW youth detention data" is currently standing on 13 numbers.
- **`bocsar_youth_offending`, `youth_survey_results`, `abs_indigenous_population_by_lga` are all EMPTY** [verified from `empty_objects.md`]. Three declared intentions, zero rows. `abs_indigenous_population_by_lga` in particular is the denominator you need before any Indigenous over-representation map is honest.
- **`mv_indigenous_funding_by_disadvantage` is EMPTY.** Also a declared intention.

---

## 3. Director and governance links

### 3.1 What Australia actually publishes

There is a hard, well-defined wall.

1. **ASIC's free weekly file has no officeholders.** [verified — our 23-column `asic_companies` mirror contains no person field.] Directors sit behind either a per-company paid extract or a commercial bulk **data licensing agreement**, and ASIC restricts commercial redistribution of extract data without one ([ASIC data.gov.au page](https://www.asic.gov.au/online-services/search-asic-registers/data-gov-au/), [businessdataguide](https://businessdataguide.com/blog/jurisdictions/australia-company-search-guide)).
2. **ACNC publishes Responsible Persons on the Register web pages but not in the bulk file** ([ACNC](https://www.acnc.gov.au/charity/about-charity-register)). The register data is CC BY 3.0 AU. Charities may apply to withhold.
3. **ORIC publishes officers per-corporation and explicitly refuses bulk export** ([ORIC](https://www.oric.gov.au/corporations-and-registers/data-about-corporations)).
4. **Beneficial ownership is deferred.** Policy work resumes early 2027, consultation after ([HSF Kramer](https://www.hsfkramer.com/insights/2025-10/beneficial-ownership-reporting-for-unlisted-entities-an-update)). Plan for it as a 2028+ dataset, not a roadmap item.
5. **OpenCorporates mirrors ASIC** but inherits the same officer gap ([OpenCorporates register 16](https://opencorporates.com/registers/16)). Not a workaround.
6. **LinkedIn-style scraping** is the wrong door: it breaches ToS, it is personal information under the Privacy Act with no public-register basis, and it would poison an otherwise defensible provenance story for the whole graph. There is a `linkedin_contacts` table with 13,810 rows in this database — its provenance and lawful basis should be checked before any of it touches a public surface. [flagged, not investigated]

### 3.2 What this database already has

[verified by query unless noted]

- **`person_roles` — 339,698 rows.** Source breakdown: `acnc_register` **334,152** (director 87,234 / other 68,418 / officeholder 55,501 / board_member 50,346 / secretary 30,037 / chair 25,436 / trustee 9,591 / public_officer 7,589), `foundation_board` 4,522, parliamentary registers (`openpolitics_au`, `nsw_parliament`, `vic_parliament`, `qld_parliament`) 582, `acnc` 423, `web_research` 7. **Zero rows from ASIC.**
- **Linkage is near-total:** 339,086 rows carry `company_abn`, **338,999 carry `entity_id`** — 99.8% of person-roles are attached to a resolved graph entity.
- **`gs_relationships` carries the governance graph directly:** `directorship` **440,128** edges, `shared_director` **95,476**, `member_of` 221,563, `lobbies_for` 2,452, `subsidiary_of` 1,267.
- **`person_identities` 230,434** (`identity_key`, `cluster_size`, `is_nominee_block`, `confidence`, `method`) plus `person_identity_map` 14,919 and `person_entity_links` 2,571.
- Six overlapping person MVs at 237K–336K rows (`mv_person_entity_network`, `mv_person_identity_network`, `mv_person_network`, `mv_person_influence`, `mv_person_identity_influence`, `_v2`). Several are almost certainly superseded — the `_v2` pair differs by 9 rows.
- The ingest path for ASIC officeholders **already exists and has never been fed**: `scripts/ingest-asic-directors.mjs --officeholders <file>`, with the column mapping stubbed pending "actual ASIC officeholder extract schema". [verified by reading the file header.]

**How the ACNC person data was obtained matters.** There are three scrapers in `scripts/` — `scrape-acnc-people.mjs`, `scrape-acnc-persons.mjs`, `scrape-acnc-responsible-persons.mjs`. So 334K responsible-person rows came from scraping per-charity Register pages, not from a bulk file. The Register content is CC BY 3.0 AU, which supports reuse with attribution, but the *method* is scraping and the *content* is named individuals. Before any of this becomes a public surface, two things need writing down: the licence basis (CC BY 3.0 AU, attribute ACNC), and a takedown/withheld-information policy that honours the ACNC's own withholding regime.

### 3.3 The honest limitation

`max(board_count)` in `mv_board_interlocks` is **745** [verified]. No human sits on 745 boards. That is name-collision — the nominee-block problem MEMORY.md already flags with a standing instruction not to drop `MAX_PLAUSIBLE_BOARDS`. **Any public "director network" feature must show a confidence tier per person, or it will publish a defamatory-adjacent claim about a common name.** `person_identities.is_nominee_block` and `.confidence` exist for exactly this; use them as a display gate, not just an internal filter.

### 3.4 Realistic next acquisitions, in order

1. **ACNC responsible-persons refresh discipline** — the cheapest real win. It is already the backbone; make it dated, versioned and re-scraped on a schedule so board *changes* become visible. Board change is a leading indicator; a static snapshot is not. `watch-board-changes.mjs` exists.
2. **ORIC officers, targeted** — per-corporation, ~7,369 corporations, respectful rate limits. ORIC refuses bulk but the pages are public. This closes the community-controlled governance picture, which is the part of the graph most aligned with the mission and least served by anyone else.
3. **Foundation trustees at scale** — widen cross-section #2 from 195 trustees. Sources: ACNC responsible persons for the ~11,159 `foundations` rows (already in `person_roles`, needs joining, not acquiring), plus PAF/PubAF trustee names on the register. **This is a join problem, not an acquisition problem** — which makes it the best value on this list.
4. **ASIC officeholders under licence** — the step change. It converts the graph from a charity-governance graph to a *whole-economy* governance graph, and it is the only way to see the for-profit directors behind government suppliers. Scope it as a licensing conversation with ASIC's data licensing team, budget it, and be clear that redistribution terms will constrain what the public surface can show. Do not scrape around it.
5. **Parliamentary/ministerial registers of interests** — public, unstructured, and nobody has parsed them nationally.

---

## 4. Youth detention and child protection — the granularity ceiling

This section exists to stop an honest project from drawing a dishonest map.

### What the numbers actually are

| Dataset | Geography | Cadence | Lag |
|---|---|---|---|
| AIHW youth detention population | **State/territory** | Quarterly | ~2 quarters |
| AIHW youth justice annual (YJ NMDS) | State/territory + **remoteness** + **socioeconomic area**; SA4 exists in the NMDS but access is restricted, by application, possibly fee-bearing | Annual | ~6–9 months |
| AIHW child protection | **State/territory** + Indigenous status, age, sex, remoteness | Annual | ~9 months |
| RoGS Part F | **State/territory columns** | Annual (January) | ~7 months |
| Closing the Gap Outcome 11 | State/territory, sex, age band | Annual | ~9 months |
| ABS Recorded Crime — Offenders | State/territory **and SA4** | Annual | ~5 months |
| State crime agencies (BOCSAR etc.) | **LGA** | Quarterly/annual | 3–6 months |
| **QLD watchhouse snapshots (this DB)** | **Facility (63)** | **Near-daily** | ~1 day |

### The rule this implies

> **Detention and child protection numbers are state-level. Crime and offender numbers are LGA/SA4-level. Organisations and money are entity-level with a postcode.**

So:

- **An LGA choropleth of youth detention rate is not honest** unless it is explicitly labelled as a state value painted across LGAs. Do not build it.
- **An LGA choropleth of youth offender rate, crime rate, or funding received IS honest** — for the states where `crime_stats_lga` has rows. NSW has a decade; QLD/VIC/SA have one period each; **WA and TAS have nothing**. Any national crime map today would silently invent WA and TAS.
- **The honest join is: state-level outcome ÷ LGA-level input.** "This state's detention rate rose 12% while funding to prevention organisations in these LGAs fell" is defensible. "This LGA's detention rate" is not.
- **`abs_indigenous_population_by_lga` being empty blocks every rate-per-1000-Indigenous-young-people map.** Population denominators must land before over-representation is mapped at any sub-state level. This is the highest-priority empty table in the database.
- **The watchhouse series breaks the ceiling and should be treated as the flagship.** Facility-level, near-daily, First Nations status, custody duration bands, 63 facilities, 108 days and counting. It needs: a documented scrape provenance, a stated source URL, a retention policy, and a public time-series page. It is the strongest single argument that this project sees something nobody else does.

### How they join to org/funding data

Four defensible joins exist today:

1. **State × financial year.** `justice_funding` (157,116 rows, `state`, `financial_year`, FY2008-09→2026-2030, **147,130 rows linked to a `gs_entity_id`, 149,714 with a recipient ABN** [verified by query]) against `rogs_justice_spending` (22,364 rows, wide-format with one numeric column per jurisdiction) and `aihw_child_protection` (2,981 rows; [verified] **state × 4 years × ~360 metrics**, AUS series has 7 years). Clean, honest, publishable.
2. **LGA.** Organisation counts, funding flows, crime stats, ICSEA, NDIS participants — all real at LGA. The LGA attribution rebuild documented in MEMORY.md is what makes this trustworthy; `lga_source` provenance stamps mean the map can say *how sure* it is per row.
3. **Facility.** `youth_detention_facilities` (21 rows, with lat/lon, capacity, operator, `government_department`, `managing_agency`) × the QLD watchhouse series × contracts to the managing agency. Twenty-one rows is small but it is the *only* facility-level spine anyone has.
4. **Narrative.** `coroners_findings` (39, `is_youth_justice`/`is_in_custody`), `children_commissioner_reports` (11), `civic_hansard` (647), `alma_media_articles` (872). Thin, but the schema is right.

---

## 5. Net-widening shortlist — the next 10 datasets

Ranked by **unlocked insight per unit effort**. Effort is S (a day), M (a week), L (a month+).

> **Strategy check.** `docs/strategy/buyer-wedge.md` move 5 says *data widening is PAUSED* — evidence depth and buyer UX are the scarce things, with an explicit exception for scheduled grant-ingest agents. Items **1, 2, 3, 4 and 8 below are evidence-depth or provenance work on data already held**, which the wedge favours. Items **5, 6, 7, 9, 10 are genuine widening** and should wait behind a lighthouse buyer unless the AEC reform timing (item 5) forces the issue. I have ranked to respect that, not to cut against it.

| # | Dataset | Source & access | Licence | Effort | New cross-section unlocked |
|---|---|---|---|---|---|
| **1** | **ABS Indigenous population by LGA/SA2 (ERP + Census)** | ABS bulk download / ABS Data API | CC BY 4.0, clean | **S** | Fills the empty `abs_indigenous_population_by_lga`. **Unlocks every per-capita and over-representation rate at sub-state level.** Without it, no Indigenous-focused map in this project is honest. Highest value-to-effort in the entire list. |
| **2** | **Fix the three broken board MVs + the 6-way person-MV duplication** | Internal — read the MV definitions, repair, refresh, retire the superseded ones | n/a | **S** | Not an acquisition, but it *restores* cross-sections #1 and #4 (board→contractor, board→donor) which currently return 4 and 2 rows against a 39,757-row interlock table. Cheapest insight recovery available. |
| **3** | **Watchhouse series — provenance, continuity, and a public page** | Internal + the existing QLD source | Public data; document the source URL | **S–M** | Turns the DB's single most distinctive asset into a citable public time series. Facility × day × First Nations × custody duration. Nothing in Australia competes. |
| **4** | **Foundation trustee join at scale** | Internal — join `foundations` (11,159) to existing `person_roles` ACNC responsible-persons rows | CC BY 3.0 AU (ACNC), attribute | **M** | Widens `mv_trustee_grantee_chain` from **195 trustees / 25 foundations** to potentially thousands. "Which foundations fund organisations their own trustees govern" becomes a real finding rather than an anecdote. |
| **5** | **AEC post-reform disclosures** | [transparency.aec.gov.au](https://transparency.aec.gov.au/) export, plus the new AEC digital platform | Public, open | **M**, but **time-critical** | From 1 July 2026: threshold **$5,000**, **calendar-year** periods, **24-hour** disclosure in election periods. Donation volume and cadence step-change. Whoever has the ABN spine ready owns the near-real-time donor→contract analysis. **This is the one widening item with a deadline.** |
| **6** | **BOCSAR + state crime agencies, full coverage (esp. WA and TAS)** | BOCSAR open data; CSA VIC; QGSO; WA Police; TAS DPFEM (some scrape/FOI) | Mostly open; WA/TAS need checking | **M** | Fills the empty `bocsar_youth_offending` and closes the two-state hole in `crime_stats_lga`. Makes a **national** LGA crime × funding map possible for the first time. Today's map silently omits WA and TAS. |
| **7** | **Ministerial diaries, all jurisdictions** | Published per-jurisdiction, mostly HTML/PDF, scrape | Public | **M** | Scales cross-section #8 from 1,728 meetings to a corpus. "Who met the minister before winning the contract" is the highest-impact accountability question with a public-record answer, and it is essentially unmined nationally. |
| **8** | **AIHW youth justice — SA4 via formal data request** | AIHW customised data service; application, restricted, possibly fee-bearing ([AIHW YJ collection](https://www.aihw.gov.au/about-our-data/our-data-collections/youth-justice)) | Restricted — expect conditions on republication | **M–L** | The only lawful route below state level for supervision data. Would let the org/funding layer meet the outcome layer at SA4 instead of state. **Check republication conditions before investing** — a dataset you cannot show is worth less than one you can. |
| **9** | **State grants awarded, normalised nationally** | data.qld.gov.au has many recipient-level sets; data.nsw / data.vic patchier; some FOI | Mostly CC BY | **L** | There is **no national state-grants aggregation in Australia.** Combined with `grantconnect_awards` (291,264) and `state_tenders` (199,719), this would make CivicGraph the only place all three tiers of government money sit on one key. Big prize, big effort, schema-per-program. |
| **10** | **ASIC officeholders under a data licence** | ASIC data licensing team, commercial agreement | **Licensed, redistribution restricted** | **L** + cost | The structural change: charity-governance graph → whole-economy governance graph. Would let cross-section #1 cover for-profit government suppliers, not just charities. **Blocker is commercial and legal, not technical** — the ingest script is already written and waiting for a file. Do not attempt to route around it via scraping or resellers. |

### Explicitly not recommended

- **LinkedIn / people-aggregator scraping.** ToS breach, Privacy Act exposure, and it contaminates the provenance of a graph whose whole value is that it is defensibly sourced. Also: check the existing `linkedin_contacts` (13,810 rows) before it reaches a public surface.
- **ORIC bulk data requests.** ORIC has stated its policy. Per-corporation public-page reading at respectful rates is the only path, and even that deserves a conversation given the Indigenous data governance principles that apply to CATSI corporations.
- **Paying a commercial ASIC reseller to sidestep licensing.** Same restriction flows through, and it costs more.
- **Buying a media corpus (GDELT/Media Cloud/commercial).** GDELT and Media Cloud exist and are usable ([GDELT](https://blog.gdeltproject.org/mapping-the-media-a-geographic-lookup-of-gdelts-sources/)), but "media" is the weakest limb of the vision and the least differentiated. `alma_media_articles` (872 rows) with `organizations_mentioned` / `key_claims` / `linked_funding_ids` is the right *schema*; deepen that against existing entities before buying volume.

---

## 6. What to tell Ben

**The competitive read.** Nobody in Australia is trying to do what this is. Foundation Maps Australia is the nearest thing to a philanthropy map and it is opt-in and members-only. SmartyGrants holds the richest un-published grantmaking data in the country and will not open it. ACNC, AusTender, GrantConnect, AEC, AIHW and ABS each publish one clean vertical and stop. The Productivity Commission has publicly asked government to publish more and better data on giving. **The horizontal join is genuinely vacant, and a national policy body has said out loud that it should exist.**

**The honest read on "biggest dataset".** The database is already large — 52.3m rows, 724 populated objects. But three of the vision's named pillars are thin: youth detention numbers are **13 scraped rows**, media is **872 articles**, and the Indigenous population denominator table is **empty**. Meanwhile the QLD watchhouse series — 63 facilities, near-daily, First Nations status, custody duration — is a world-class asset that nothing public matches, and it is not on the front page of anything.

**The single highest-value move** is not acquisition. It is **§5 items 1, 2 and 4**: land the Indigenous population denominators, repair the three broken board MVs, and join foundations to the responsible-persons data already sitting in the database. That is roughly two weeks of work and it converts three "almost" cross-sections into three real ones — without spending a dollar, without a licence negotiation, and without cutting against the buyer wedge's pause on widening.

**The one clock that is running** is the AEC reform. From 1 July 2026 the disclosure threshold drops to $5,000, reporting moves to calendar years, and election-period donations must be disclosed within 24 hours. The donor-to-contract analysis this database can already do at 232,474 rows becomes near-real-time. That is a reason to have the ingest ready, and it is the only widening item I would let jump the queue.

---

## Sources

- [data.gov.au — ACNC Register](https://data.gov.au/data/dataset/acnc-register)
- [ACNC — About the Charity Register](https://www.acnc.gov.au/charity/about-charity-register)
- [ACNC — Download Charity Register data](https://www.acnc.gov.au/charity/about-charity-register/download-charity-register-data)
- [ACNC — 2025 Bulk Annual Information Statement](https://www.acnc.gov.au/2025-bulk-annual-information-statement)
- [ACNC — Australian Charities Report, 11th edition](https://www.acnc.gov.au/tools/reports/australian-charities-report-11th-edition)
- [ACNC — Charity Data Hub](https://www.acnc.gov.au/tools/other-resources/charity-data-hub)
- [Productivity Commission — Philanthropy inquiry report, *Future foundations for giving*](https://www.pc.gov.au/inquiries-and-research/philanthropy/report/)
- [Productivity Commission — full report PDF (Report 104, 10 May 2024)](https://assets.pc.gov.au/inquiries/completed/philanthropy/report/philanthropy.pdf)
- [Philanthropy Australia — Foundation Maps: Australia](https://www.philanthropy.org.au/about-us/publications/foundation-maps-australia/)
- [Philanthropy Australia — Share your grants data](https://www.philanthropy.org.au/guidance-and-tools/grantmaking-resources/share-your-grants-data/)
- [Our Community — CLASSIE](https://www.ourcommunity.com.au/classie)
- [SmartyGrants](https://www.smartygrants.com.au/)
- [ChangePath](https://www.changepath.com.au/)
- [CSI — Amplify Social Impact](https://www.csi.edu.au/amplify-social-impact/)
- [JBWere — NAB Charitable Giving Index](https://www.jbwere.com.au/campaigns/jbwere-nab-charitable-giving-index-)
- [360Giving — Data Standard](https://www.360giving.org/about/data-standard/)
- [GrantConnect — Grants Awarded by Agency](https://help.grants.gov.au/getting-started-with-grantconnect/information-made-easy/awards-by-agency/)
- [Department of Finance — Find a grant (GrantConnect)](https://www.finance.gov.au/individuals/find-grant-grantconnect)
- [data.qld.gov.au — datasets tagged "grants"](https://www.data.qld.gov.au/dataset?tags=grants)
- [Open Council Data Standards](https://standards.opencouncildata.org/)
- [Open Council Data — who is publishing open data in Australia](https://opencouncildata.org/australia/)
- [AEC — Transparency Register](https://transparency.aec.gov.au/)
- [AEC — 2024-25 annual disclosure returns published 2 Feb 2026](https://www.aec.gov.au/media/2026/02-02.htm)
- [AEC — Funding and disclosure legislative changes](https://www.aec.gov.au/FADReform/)
- [AEC — Explaining the changes to political funding and disclosure (Oct 2025, PDF)](https://aec.gov.au/FADReform/files/Changes-to-Funding-and-Disclosure-Explained-Oct-2025.pdf)
- [ASIC — data.gov.au](https://www.asic.gov.au/online-services/search-asic-registers/data-gov-au/)
- [data.gov.au — ASIC Company Dataset](https://data.gov.au/data/dataset/asic-companies)
- [businessdataguide — Australia Company Search Guide 2026](https://businessdataguide.com/blog/jurisdictions/australia-company-search-guide)
- [Kyckr — Australia's Business Register (2025 update)](https://kyckr.com/guides-and-reports/australia-business-register-asic-guide-2025)
- [HSF Kramer — Beneficial ownership reporting for unlisted entities: an update (Oct 2025)](https://www.hsfkramer.com/insights/2025-10/beneficial-ownership-reporting-for-unlisted-entities-an-update)
- [Treasury Ministers — Improving transparency of the true owners of companies](https://ministers.treasury.gov.au/ministers/andrew-leigh-2025/media-releases/improving-transparency-true-owners-companies)
- [OpenCorporates — ASIC register](https://opencorporates.com/registers/16)
- [OpenCorporates — ORIC register](https://opencorporates.com/registers/17)
- [ORIC — Data about corporations](https://www.oric.gov.au/corporations-and-registers/data-about-corporations)
- [data.gov.au — Aboriginal and Torres Strait Islander corporations (ORIC)](https://www.data.gov.au/data/dataset/aboriginal-and-torres-strait-islander-corporations-oric)
- [Attorney-General's Department — Lobbyists Register](https://lobbyists.ag.gov.au/register)
- [Data.NSW — Register of Third-Party Lobbyists](https://data.nsw.gov.au/data/dataset/register-of-third-party-lobbyists)
- [OpenAustralia.org — API](https://www.openaustralia.org.au/api/)
- [They Vote For You — GitHub](https://github.com/openaustralia/theyvoteforyou)
- [AIHW — Youth detention population in Australia 2025, Summary](https://www.aihw.gov.au/reports/youth-justice/youth-detention-population-in-australia-2025/contents/summary)
- [AIHW — Youth justice in Australia 2024–25](https://www.aihw.gov.au/reports/youth-justice/youth-justice-in-australia-2024-25/contents/about)
- [AIHW — Youth Justice data collection (YJ NMDS)](https://www.aihw.gov.au/about-our-data/our-data-collections/youth-justice)
- [Indigenous Justice Clearinghouse — Juvenile Justice NMDS](https://www.indigenousjustice.gov.au/datasets/juvenile-justice-national-minimum-data-set/)
- [AIHW — Child protection data](https://www.aihw.gov.au/reports-data/health-welfare-services/child-protection/data)
- [AIHW — Child protection Australia 2023–24](https://www.aihw.gov.au/reports/child-protection/child-protection-australia-2023-24/contents/insights/supporting-children)
- [Productivity Commission — RoGS 2025 Part F, Community services (PDF)](https://assets.pc.gov.au/ongoing/report-on-government-services/2025/community-services/rogs-2025-partf-overview-and-sections.pdf)
- [Productivity Commission — RoGS, Youth justice services](https://www.pc.gov.au/ongoing/report-on-government-services/community-services/youth-justice/)
- [Productivity Commission — Closing the Gap dashboard, Outcome 11](https://www.pc.gov.au/closing-the-gap-data/dashboard/outcome-area/youth-justice/)
- [AIHW RIFIC — Closing the Gap Target 11 technical notes](https://www.rific.gov.au/resources/technical-notes/closing-the-gap/target-11)
- [ABS — Recorded Crime: Offenders, 2024-25](https://www.abs.gov.au/statistics/people/crime-and-justice/recorded-crime-offenders/latest-release)
- [Indigenous Justice Clearinghouse — Deaths Inside (Guardian Australia)](https://www.indigenousjustice.gov.au/datasets/deaths-inside/)
- [Supply Nation](https://supplynation.org.au/)
- [GDELT — Mapping the media](https://blog.gdeltproject.org/mapping-the-media-a-geographic-lookup-of-gdelts-sources/)
