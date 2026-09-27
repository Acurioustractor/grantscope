# WA SFPP Kimberley services: incumbent access routes (2026-09-27)

Read-only web research. Labels: **Verified** (source read, quoted), **Inferred**, **Unknown**. No provider is guessed.

## Summary

| SFPP ref | Service | Incumbent | End date |
|---|---|---|---|
| 2025DOC-99 | Kimberley Empowered Youth Network | Unknown | Unknown |
| 2026DOC-14 | Mercycare Boab House (Broome) | MercyCare operates Boab House (Verified); that the Communities agreement is with MercyCare is Inferred | Unknown |
| MHCSFFP-21 | Broome Step Up Step Down | None: new service, pre-procurement (Verified) | n/a |
| MHCSFFP-36 | Kimberley Youth AOD Service | None: service not yet contracted (Verified per MHC page) | n/a |

The main finding: two of the four have **no incumbent**. They are new services, so the empty award feed is correct and not a gap in the data.

## 1. 2025DOC-99 Kimberley Empowered Youth Network

| Claim | Label | Source |
|---|---|---|
| No public page uses the exact name "Kimberley Empowered Youth Network" | Verified (search returned no exact match) | web search 2026-09-27 |
| Empowered Young Leaders (EYL) is "the representative body and advocates for young people in the Kimberley" and became "a legally incorporated entity", first AGM 4 Sep 2023 | Verified | https://wkfec.org/home |
| EYL came out of the Kimberley Aboriginal Suicide Prevention Trial, with KAMS co-chairing the working group | Verified | https://news.wapha.org.au/young-aboriginal-leaders-driving-change-in-the-kimberley/ |
| EYL (Empowered Young Leaders Aboriginal Corporation) or West Kimberley Futures Empowered Communities is the Communities-funded party | Inferred from the name only. Not evidence | none |
| Funder, agreement, end date | Unknown. The EYL/WKFEC pages name no funder | |

Next step: look up an ORIC record for Empowered Young Leaders Aboriginal Corporation (annual financial report, grant income lines), then ask Communities.

## 2. 2026DOC-14 Mercycare Boab House (Broome)

| Claim | Label | Source |
|---|---|---|
| Boab House is a MercyCare service: "safe transitional accommodation in Broome for women aged 45 and over who are experiencing or at risk of homelessness or family and domestic violence" | Verified | https://www.mercycare.com.au/community-services/family-children-and-community/broome-transitional-accommodation |
| That page names no funder | Verified | same |
| Communities funds it under a service agreement with MercyCare (ABN 31098197490) | Inferred from the SFPP title and the MercyCare page together | |
| MercyCare runs another Communities-built Broome service, BASSA ("The Department of Communities built the facility"), opened April 2019 | Verified. This is a different service; it only shows the relationship | https://www.mercycare.com.au/news-and-information/new-service-open-in-broome |
| Agreement ID, value, end date | Unknown | |

Next step: the MercyCare ACNC AIS and annual report (government grant totals only, likely not per service).

## 3. MHCSFFP-21 Broome Step Up Step Down

| Claim | Label | Source |
|---|---|---|
| "The six-bed Broome Step Up/Step Down Service will be located at the Yinajalan Ngarrungunil Health and Wellbeing Campus" | Verified | https://www.mhc.wa.gov.au/news-and-resources/latest-news/service-provider-registration-of-interest-now-live |
| The ROI was open to ACCHO and/or ACCO providers and "closes at 2.30pm, Friday 21 November 2025" | Verified | same |
| MHC's SUSD page lists seven operating services (Albany, Bunbury, Geraldton, Joondalup, Kalgoorlie, Karratha, Rockingham). Broome is not among them. A construction partner was appointed in January 2025 | Verified | https://www.mhc.wa.gov.au/our-initiatives/our-projects/step-up-step-down-services ; https://www.wa.gov.au/government/media-statements/Cook%20Labor%20Government/Construction-partner-appointed-for-Broome-SUSD-20250128 |
| No incumbent operator. SFPP 2026-27 is the procurement that follows the ROI | Inferred (strong) | |

## 4. MHCSFFP-36 Kimberley Youth AOD Service

| Claim | Label | Source |
|---|---|---|
| The 2019-20 budget allocated $9.2m over three years to design and commission the service | Verified (search summary of MHC/media). Re-read before citing | https://www.broomead.com.au/news/broome-advertiser/kimberleys-youth-to-receive-specialised-addiction-service-post-redesign-c-13340726 |
| "The Commission will continue to work in collaboration with the ARGG on the approach to procurement and delivery on the Kimberley Youth AOD Service" | Verified | https://www.mhc.wa.gov.au/about-us/major-projects/enhancing-alcohol-and-other-drug-services-in-the-kimberley/ |
| Milliya Rumurra Aboriginal Corporation was "contracted to assess and prioritise the findings and recommendations from the Service Model Report". That is a design role, not service delivery. The report got ARGG in-principle endorsement in early 2026 | Verified | same |
| No delivery incumbent. The existing youth-relevant AOD services are WACHS KMHDS/CADS, which are government services and not an NGO contract | Inferred | https://www.wacountry.health.wa.gov.au/Our-services/Kimberley/Kimberley-health-services/Mental-health-services/Community-Alcohol-and-Drug-Service |
| Co-design summary exists | Verified (URL) | https://www.mhc.wa.gov.au/awcontent/Web/Documents/2015-2024/kimberley-youth-aod-service-co-design-summary.pdf |

## Repeatable routes: SFPP line to incumbent (ranked by value/effort)

| Rank | Route | URL | Fields | Coverage | Terms / automation | Effort |
|---|---|---|---|---|---|---|
| 1 | Agency project/news pages (MHC "our projects", ROI notices) | mhc.wa.gov.au | status, location, provider type, ROI dates, sometimes operator | Good for new or major MHC services; weak for rollovers | Public pages. Check robots and terms before automating; manual reading is fine | Low |
| 2 | Provider websites plus ACNC AIS/annual reports | acnc.gov.au, provider sites | service name, sometimes funder; AIS gives only total government revenue | Good for naming who operates a service; poor for end dates | ACNC data is open (data.gov.au CSV) | Low to medium |
| 3 | Questions on Notice / Estimates (WA Parliament) | parliament.wa.gov.au (QoN search, Estimates hearings) | agency lists of funded NGOs, value, term, on request | Whatever an MP asks; answers are often full tables | Public. Search is manual; bulk download is untested | Medium; an MP question is a lever |
| 4 | Tenders WA tender notices (not awards) | tenders.wa.gov.au | ROI/RFT docs, often "current provider" or term in the spec, contract length | Only services that go to open market | Terms of use apply. Read them before any scraping | Medium |
| 5 | Agency annual reports (MHC, Communities) | mhc.wa.gov.au, wa.gov.au | aggregate NGO spend; sometimes funded-organisation appendices | Patchy, per-service detail rare | PDF | Medium |
| 6 | FOI to Communities / MHC | agency FOI pages; disclosure logs | full agreement register (provider, value, start/end) | Complete when granted | Formal request, fees, about 45 days; outreach, so needs Ben | High effort, high yield |
| 7 | WAPHA commissioned services | wapha.org.au | Commonwealth-funded (PHN) Kimberley providers | Different funder, so useful only for ruling things out | Public | Low |
| 8 | ORIC register (for ACCO candidates) | oric.gov.au | financial reports, grant income | ACCO providers only | Public | Medium |

Not checked this pass (Unknown): WA Budget Paper service lists, Auditor General reports, HealthDirect entries for Boab House, Communities funded-services pages, Data WA datasets beyond the known award feed.
