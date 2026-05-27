# Goods on Country — repeat government buyers (procurement targets)

**Generated:** 2026-05-28 · `scripts/goods-repeat-buyer-intel.mjs` (read-only, no DB writes)
**Source:** `austender_contracts` (AusTender OCDS federal awarded contracts, ~672K rows)
**Method:** group by `buyer_name`, keep buyers with ≥2 contracts matching Goods product (word-boundary keyword on title/category OR Goods UNSPSC family 56 / 5210 / 5212 / 5213 / 5214). Ranked by contract count, then total value.

> These are agencies that **repeatedly buy beds / whitegoods / furniture / linen** — the warmest demand-side targets for Goods. A purchase order beats a grant and repeats. Verify each before outreach: AusTender records awarded *federal* contracts only (state/NT procurement is in separate tables), and keyword matching can still admit adjacent categories — read the sample titles.

## Headline
- **10626** goods-matching federal contracts across **366** distinct buyers, **$15,102,785,530** total.
- **31** of those buyers have a housing / community / First Nations / local-government remit — the actionable shortlist below. The raw top-60 list (which Defence & ATO dominate with barracks/office furniture) follows as context only.

## ⭐ Warm targets — housing / community / First Nations buyers
Filtered to buyers whose remit fits a remote-community bed+washer enterprise (`housing|communit|aborigin|indigenous|first nation|torres|land council|regional council|shire|district council|remote`).

| # | Buyer (agency) | Contracts | Total value | Years | Active yrs | Sample titles |
|---|----------------|-----------|-------------|-------|------------|---------------|
| 1 | NSW Department of Communities and Justice | 236 | $1,571,510,596 | 2008–2025 | 13 | A Place To Go (APTG) Home - Mackillop Family Services (prj_5068); Aboriginal Homelessness Support Service; Aboriginal Outreach Casework Project |
| 2 | NT Department of Infrastructure, Planning and Logistics - Housing Program Office | 91 | $211,957,652 | 2021–2024 | 4 | Alice Springs - Central Australia Region - Provision of Remote Housing Maintenance Service; Alice Springs - Mount Nancy Town Camp - Demolition and Construction of Housing on 9 lots; Alice Springs - Panel Contract for Responsive Maintenance Services to Urban Housing for a |
| 3 | NT Department of Housing - Housing | 36 | $39,172,650 | 2013–2015 | 3 | Alice Springs - Provision of Repairs and Maintenance Services to Evaporative Air Condition; Alice Springs - Provision of Vacate and Planned Works to Department of Housing Assets for; Alice Springs - Real Housing for Growth - Elliott Street Key Worker Rental Initiative Prop |
| 4 | ACT Community Services Directorate | 23 | $34,719,241 | 2013–2016 | 3 | Blue Door Family Service Samaritan House Young Parents Accommodation Support Program Stree; Community Development Services and Social Housing and Homelessness Services; Financial Analysis for Housing and Community Services Total Facilities Management Project |
| 5 | Department of Families, Housing, Community Services and Indigenous Affairs | 17 | $3,084,849 | 2012–2013 | 2 | 45408224; 90001410; 90001440 |
| 6 | Dept of Planning, Housing and Infrastructure | 15 | $33,880,203 | 2021–2024 | 3 | Architectural Services for the Low and Mid-Rise Housing Pattern Book - Low Rise Apartment; Architectural Services for the Low and Mid-Rise Housing Pattern Book - Semi-Detached Typol; Architectural Services for the Low and Mid-Rise Housing Pattern Book - Terrace Housing Typ |
| 7 | National Indigenous Australians Agency | 14 | $1,077,607 | 2019–2026 | 5 | NCD09258; NCD09453; NCD09530 |
| 8 | NT Department of Local Government, Housing and Community Development - Housing Program Delivery | 12 | $956,614 | 2019–2020 | 2 | $100m Stimulus - Alice Springs - Kitchen  Refurbish - Unit 7/57 Albrecht Drive, Larapinta; $100M Stimulus - Alice Springs - Kitchen Refurbishment - 11 Holtermann Court, Larapinta; $100M Stimulus - Alice Springs - Kitchen Refurbishment - 24 Engoordina Drive, Larapinta |
| 9 | NT Department of Housing - Service Delivery South | 11 | $12,219,588 | 2015–2016 | 2 | Alice Springs - Provision of Grounds Maintenance, Litter Control and Cleaning Services to; Alice Springs - Provision of Responsive Repairs and Maintenance Works to Department of Hou; Alice Springs - Yulara - Upgrades to Six (6) Government Employee Housing (GEH) Dwellings |
| 10 | NT Department of Housing - Housing Supply | 9 | $1,442,946 | 2015–2016 | 2 | Alice Springs - Provision of Marketing and Auctioneering Services of Department of Housing; Alice Springs - Provision of Real Housing for Growth Intitiative - Property and Tenancy Ma; Darwin - Consultancy - Business Documentation Consultancy - Real Housing for Growth |
| 11 | NT Department of Housing - Service Delivery North | 8 | $11,147,665 | 2015–2016 | 2 | Darwin - Batchelor - Provision of Grounds Maintenance, Litter Control and Cleaning Service; Darwin - Provision of Arboreal Services to Department of Housing Assets for a Period of 24; Darwin - Provision of Ground Maintenance, Litter Control and Cleaning Services to Departme |
| 12 | NT Power and Water Corporation - Remote Services | 8 | $1,406,311 | 2019–2019 | 1 | Engagement of Hydraulic Engineering Services to Support the Housing Program Works; Gunbalanya and Ramingining - Construction of New Water and Sewer Infrastructures Related t; Kalkarindji, Lajamanu and Pigeon Hole - Construction of New Water and Sewer Infrastructure |
| 13 | NT Department of Territory Families, Housing and Communities - Housing Programs and Support Services | 6 | $4,289,573 | 2021–2022 | 2 | Alice Springs, Darwin and Palmerston - Provision of Marketing and Auctioneering Services f; Consultancy - Assess The Economic Viability of Delivery Options and Pilot Sites under the; Darwin - Consultancy - Request for Services under Panel Contract - D18-0031 - Provision of |
| 14 | NT Department of Housing and Community Development - Housing Program Delivery | 6 | $1,782,715 | 2017–2018 | 2 | $69m Stimulus - Darwin - Painting, Kitchen Benches and Concreting - 114 Dickward Dr - Coco; $69m Stimulus - Darwin - Roof Replacements - 9 and 10 Bedwell Court, Gray, Palmerston; Darwin - Affordable Housing Head Leased Dwellings -  Servicing of Split System Air Conditi |
| 15 | NT Department of Housing - Contract Implementation | 6 | $1,729,301 | 2015–2016 | 2 | Alice Springs - Consultancy - Project  Development for Nyrripi, Kintore and Areyonga  SFNT; Alice Springs - Consultancy - Project Development for SFNT Housing Upgrades in Santa Teres; All Centres - Supply and Delivery of Stoves to Department of Housing for a Period of 12 Mo |
| 16 | NT Department of Logistics and Infrastructure - Housing Program Office | 5 | $26,410,525 | 2024–2025 | 2 | Alice Springs Region - Mutitjulu And Imanpa - Design, Construction, Demolition and Upgrade; Northern Region - Panel Contract - Design and Construct, Storage and Installation of Modul; Southern Region - Panel Contract - Design and Construct, Storage and Installation of Modul |
| 17 | NT Department of Logistics and Infrastructure - Housing and Land Services | 3 | $55,191,963 | 2025–2025 | 1 | Darwin Region - Wurrumiyanga - Demolition of 45 Dwellings and Construction of 44 Replaceme; Tennant Creek Region - Imangara and Wutungurra (Epenarra) - Security Upgrades and Refurbis; Tennant Creek Region - Rockhampton Downs (Wogyala) and Newcastle Waters - Security Upgrade |
| 18 | NT Department of Housing and Community Development - Remote Program Delivery Office | 3 | $2,546,585 | 2017–2018 | 2 | Alice Springs - Provision of Marketing and Auctioneering Services for Chief Executive Offi; Housing Maintenance Program - 2017/2018 - Fencing - Supply, Delivery and Installation of F; Nhulunbuy - Groote Eylandt - Consultancy - Architechtural Services to Assist with the Deli |
| 19 | NT Department of Housing - Executive | 3 | $1,199,688 | 2013–2014 | 2 | Darwin - Consultancy - Provision of Probity Assurance Advisor Services - Remote Housing NT; Darwin - Consultancy - Real Housing for Growth - Planning Consultant Runge Street Re-zonin; Darwin, Katherine, Palmerston - Real Housing for Growth Head-Leasing Initiative - Provisio |
| 20 | NT Department of Housing and Community Development - Housing Delivery | 3 | $648,946 | 2017–2017 | 1 | Alice Springs - Provision of Property and Tenancy Management of Affordable Housing Dwellin; Consultancy - Identification, Labelling, Recording and Assessment of Risk and Asbestos Con; Tennant Creek - Provision of Property and Tenancy Management of Affordable Housing Dwellin |
| 21 | ACT Justice and Community Safety Directorate | 3 | $280,988 | 2016–2016 | 1 | 12 Moore St - Lpp Level 4 Fitout; Provision of Linen Supply AMC; Supply and Delivery of Bed lights AMC |
| 22 | NT Department of Housing, Local Government and Community Development - Assets, Infrastructure and Maintenance | 2 | $5,288,199 | 2024–2024 | 1 | Alice Springs Region - Repairs and Maintenance of Remote Community Housing and Government; Tennant Creek Region - Repairs and Maintenance of Remote Community Housing and Government |
| 23 | Department of Communities Tasmania | 2 | $2,996,641 | 2018–2018 | 1 | Stronger Remote Aboriginal Services – Cape Barren Island Aboriginal Housing Upgrades; Stronger Remote Aboriginal Services – Flinders Island Aboriginal Housing Upgrades |
| 24 | NT Department of Housing and Community Development - Service Delivery South | 2 | $2,683,116 | 2017–2019 | 2 | Alice Springs - Provision of Housing Management Services in Alice Springs Town Camps for a; Alice Springs - Provision of Responsive Repairs and Maintenance to Public Housing Assets f |
| 25 | NT Department of Health - Remote Health | 2 | $1,618,940 | 2013–2013 | 1 | Alice Springs - Supply Delivery and Installation of EMERGENCY VEHICLE FITOUT REGO 826 783; Alice Springs, Darwin - Customised Fitout of Remote Emergency Vehicles - Toyota Troop Carr |
| 26 | NSW Aboriginal Housing Office | 2 | $497,842 | 2025–2025 | 1 | Aboriginal Housing Office Asset Portfolio Review |
| 27 | NT Department of Local Government, Housing and Community Development - Corporate Services | 2 | $125,814 | 2019–2020 | 2 | Darwin - Public Liability Insurance for Urban Public Housing; Public Liability Insurance for Urban Public Housing |
| 28 | NT Department of Housing and Community Development - Corporate Services | 2 | $104,671 | 2018–2018 | 1 | Darwin - Provision of Public Liability Insurance for Urban Public Housing; Darwin - Supply Delivery and Installation of Office Furniture for CASCOM 5 |
| 29 | NT Department of Local Government, Housing and Community Development - Remote Program Delivery | 2 | $91,177 | 2019–2019 | 1 | Katherine and Alice Springs - Peppimenarti and Willowra Community - Drone Services for Rem; Request for Quantity Surveyor Services - Housing Upgrades - Utopia Homelands |
| 30 | NT Department of Territory Families, Housing and Communities - Southern Region | 2 | $70,759 | 2021–2021 | 1 | Alice Springs - Supply and Delivery of Office Furniture; Supply Delivery and Installation of Elliot - Supply and Delivery of Office Furniture |
| 31 | NT Department of Correctional Services - NT Community Corrections | 2 | $64,658 | 2014–2016 | 2 | Alice Springs - Purchase od Two Beds in One Room at Stuart Lodge  for a Period of 14 Month; Alice Springs - Supply and Delivery of Office Furniture |

## All repeat buyers (context — includes off-target agencies)
| # | Buyer (agency) | Contracts | Total value | Years | Active yrs | Sample titles |
|---|----------------|-----------|-------------|-------|------------|---------------|
| 1 | Department of Defence | 3558 | $364,838,395 | 2007–2026 | 16 | 1900623817; 1900624455; 1900624503 |
| 2 | Services Australia | 1447 | $171,411,676 | 2011–2026 | 15 | 8100003176; 8100003799; 8100004513 |
| 3 | NT Department of Infrastructure, Planning and Logistics - Infrastructure, Investment and Contracts | 418 | $470,160,145 | 2016–2024 | 9 | Alice Spring Region - Nturiya - Remote Community Housing (RCH) Upgrade; Alice Springs - Alice Spring Correctional Centre - Supply and Delivery of Modular Accommod; Alice Springs - Anangu House  - Pandemic Coordination Cell - Fitout |
| 4 | Homes NSW | 251 | $419,091,953 | 2017–2025 | 7 | Architect for Seniors Housing - Merrylands; Architectural and Design Services - Seniors Housing - North St Marys; Architectural Design for Airds Stage 9 Seniors Housing |
| 5 | NSW Department of Communities and Justice | 236 | $1,571,510,596 | 2008–2025 | 13 | A Place To Go (APTG) Home - Mackillop Family Services (prj_5068); Aboriginal Homelessness Support Service; Aboriginal Outreach Casework Project |
| 6 | Australian Federal Police | 203 | $9,990,326 | 2013–2026 | 13 | 0030013644; 0030017050; 0030017950 |
| 7 | Department of Health and Human Services | 192 | $619,477,021 | 2002–2018 | 17 | 1 Carbeen Street Mornington Housing Construction; 1 Teal Street Claremont Housing Construction; 15 Murray St Evandale Housing Construction |
| 8 | Department of Industry, Science and Resources | 184 | $13,420,618 | 2011–2026 | 14 | AI Bendigo Accommodation MOU; CON000845; CON001652 |
| 9 | DoE | 138 | $12,570,069 | 2019–2019 | 1 | 0036-S00004352-002612 - Travel - Accommodation incl meals; 0059-S00057655-00002505 -Travel - Accommodation incl meals; 0074-S00012244-7787 -Travel - Accommodation incl meals |
| 10 | Australian Taxation Office | 135 | $17,535,647 | 2013–2026 | 12 | 06.296-0-2; 13.123-0-1; 13.129 |
| 11 | Department of Home Affairs | 131 | $24,272,611 | 2012–2025 | 13 | 0070000627; 0070006082; 0070007286 |
| 12 | Department of Parliamentary Services | 131 | $8,789,007 | 2013–2026 | 10 | 0000050855; 0000050925; 0000050950 |
| 13 | Department of Foreign Affairs and Trade | 111 | $23,353,082 | 2012–2026 | 14 | 4500000529; 4500000715; 4500000932 |
| 14 | Department of the House of Representatives | 101 | $7,444,955 | 2013–2026 | 10 | CON/GAUCON/CON000022/1; CON000154; D001470 |
| 15 | Department of the Prime Minister and Cabinet | 99 | $5,791,928 | 2013–2025 | 12 | CA000503; CA005537; CD007856 |
| 16 | Department of Finance | 93 | $5,995,519 | 2013–2026 | 12 | 2100003741; 2100004380; 2100004881 |
| 17 | NT Department of Infrastructure, Planning and Logistics - Housing Program Office | 91 | $211,957,652 | 2021–2024 | 4 | Alice Springs - Central Australia Region - Provision of Remote Housing Maintenance Service; Alice Springs - Mount Nancy Town Camp - Demolition and Construction of Housing on 9 lots; Alice Springs - Panel Contract for Responsive Maintenance Services to Urban Housing for a |
| 18 | Australian Electoral Commission | 89 | $21,391,548 | 2013–2023 | 11 | $700000.00; 001198; 001777 |
| 19 | Department of Agriculture, Fisheries and Forestry | 89 | $4,316,559 | 2013–2021 | 9 | 0045077507; 0045077715; 0045078290 |
| 20 | Australian Signals Directorate | 87 | $6,190,498 | 2018–2026 | 8 | 1900001258; 3000384431; 3000522246 |
| 21 | Department of Health and Aged Care | 79 | $7,976,024 | 2012–2022 | 11 | 4500103681; 4500108637; 4500109515 |
| 22 | Department of Agriculture | 77 | $7,333,058 | 2014–2019 | 6 | 21867; 22680; 22759 |
| 23 | Attorney-General's Department | 75 | $6,362,004 | 2013–2023 | 10 | 0041000641; 0041000705; 0041001052 |
| 24 | Department of the Treasury | 68 | $3,882,294 | 2012–2022 | 11 | 000503-0; 000544-0; 000573-0 |
| 25 | NT Department of Infrastructure - Construction | 66 | $40,829,602 | 2013–2014 | 2 | Alice Springs - Design and Construct a New Demountable Office/Training Accommodation for W; Alice Springs Hospital - Fire Indicator Panel Replacement At Nurses Quarters and Wedge Acc; Alice Springs Region  - Health Department - Refurbish Two Accommodation houses - Mandatory |
| 26 | Australian Securities and Investments Commission | 65 | $5,181,651 | 2013–2026 | 11 | 003086; 003087; 003526 |
| 27 | Austrade | 64 | $14,011,475 | 2010–2025 | 13 | 0046000536; 0046000607; 0046000627 |
| 28 | Geoscience Australia | 57 | $4,301,523 | 2013–2021 | 9 | 32172; 33212; 33217 |
| 29 | NT Department of Infrastructure - Building Services | 53 | $44,634,323 | 2014–2016 | 3 | Alice Springs Region - 1620 Larapinta Drive - Simpson's Gap National Park - Design, Docume; Alice Springs Region - Alice Plaza - Supply and Install Office Furniture; Alice Springs Region - Areyonga - Government Employees Housing Upgrade |
| 30 | IP Australia | 53 | $3,062,096 | 2012–2018 | 7 | 0000012585; 0000012725; 0000012986 |
| 31 | Bureau of Meteorology | 52 | $6,572,291 | 2010–2023 | 12 | 19006813; 19516620; 4500013556 |
| 32 | Australian Competition and Consumer Commission | 51 | $7,206,696 | 2012–2022 | 9 | 130138-C13098; 130139-C13099; 130176-C13105 |
| 33 | The University of Queensland | 48 | $1,830,393 | 2019–2019 | 1 | Homestay accommodation; Minor Equip / Furniture <$5000 |
| 34 | Department of Education | 44 | $14,750,809 | 2002–2020 | 15 | 4400030723; 4400035632; 4400041116 |
| 35 | Australian Bureau of Statistics | 41 | $5,131,127 | 2013–2021 | 9 | 236367; 236470; ABS2015.225d |
| 36 | Australian Customs and Border Protection Service | 41 | $2,106,069 | 2011–2015 | 4 | 102531; 128413; 1310472 |
| 37 | Royal Australian Mint | 40 | $1,056,063 | 2013–2026 | 11 | 25560; 28443; 28577 |
| 38 | NT Department of Housing - Housing | 36 | $39,172,650 | 2013–2015 | 3 | Alice Springs - Provision of Repairs and Maintenance Services to Evaporative Air Condition; Alice Springs - Provision of Vacate and Planned Works to Department of Housing Assets for; Alice Springs - Real Housing for Growth - Elliott Street Key Worker Rental Initiative Prop |
| 39 | Digital Transformation Agency | 36 | $2,023,202 | 2015–2021 | 7 | 4500141625; DTA-418; DTA-419 |
| 40 | HealthShare NSW | 33 | $35,256,307 | 2021–2024 | 3 | Agreement for the Provision of Accommodation and Care Services for  certain patients of HN; Agreement for the Provision of Accommodation and Care Services for certain patients of HNE; BEDS, MATTRESSES & COTS |
| 41 | Department of Social Services | 33 | $3,220,849 | 2014–2023 | 10 | 90003686; 90004522; 90005283 |
| 42 | Future Fund Management Agency | 32 | $2,119,711 | 2015–2026 | 8 | FFMA0720; FFMA0726; FFMA0730 |
| 43 | Old Parliament House | 32 | $1,313,374 | 2013–2022 | 9 | OPH 18/19-045; OPH12/13-016; OPH12/13-050 |
| 44 | Department of Communications and the Arts | 31 | $2,093,143 | 2012–2019 | 8 | 0004602849; 0004604036; 0004604265 |
| 45 | Department of Employment, Skills, Small and Family Business | 31 | $1,344,484 | 2014–2019 | 6 | 4400018040; 4400018190; 4400020624 |
| 46 | Federal Court of Australia | 30 | $2,663,092 | 2014–2025 | 10 | P0200023; P0200031; P0200041 |
| 47 | QUT | 30 | $1,116,854 | – | 0 | FURNITURE & FITTINGS < $5000; STAFF TRAVEL - DOMESTIC - ACCOMMODATION; STAFF TRAVEL - INTERNATIONAL - ACCOMMODATION |
| 48 | James Cook University | 28 | $866,385 | 2019–2019 | 1 | 0200046392 - Furniture & Equipment (<$5000); 0200046466 - Furniture & Equipment (<$5000); 0200047062 - Furniture & Equipment (<$5000) |
| 49 | NT Territory Families - Corporate Services | 27 | $8,632,241 | 2018–2020 | 2 | Alice Springs - BIG4 MacDonnell Range Holiday Park - COVID-19 - Accommodation and Meals; Alice Springs - COVID-19 - Aurora Resort - Accommodation and Meals; Alice Springs - COVID-19 - Desert Palms - Accommodation and Meals |
| 50 | Australian Criminal Intelligence Commission | 27 | $2,637,777 | 2013–2025 | 12 | 0000001595; 0000001609; 0000001663 |
| 51 | Family Court and Federal Circuit Court | 26 | $1,218,365 | 2013–2016 | 4 | P0203537; P0203550; P0203553 |
| 52 | NT Department of Infrastructure - Major Projects | 25 | $26,358,144 | 2016–2016 | 1 | Alice Springs Region - Areyonga - Demolition of 2 Dwellings and Construction of 2 x 3 Bedr; Alice Springs Region - Atitjere - Demolition of 1 Dwelling and Construct 1 x 3 Bedroom Dwe; Alice Springs Region - Engawala - Remote Community Housing (RCH) Upgrade |
| 53 | NT Department of Health - Top End Health Service | 25 | $3,172,286 | 2014–2021 | 6 | 20-1456 - Hill-Rom Pty Ltd - SmartCareTM Beds Preventative Maintenance Service Agreement(C; All Centres - Repairs and Maintenance of and Calibration of Blood Fridges and Freezers for; Covid-19 for PRH Supply Delivery of Mattresses and Consumbales |
| 54 | Australian Transaction Reports and Analysis Centre | 24 | $2,213,695 | 2013–2023 | 8 | AC1124; AC1126; AC1127 |
| 55 | ACT Community Services Directorate | 23 | $34,719,241 | 2013–2016 | 3 | Blue Door Family Service Samaritan House Young Parents Accommodation Support Program Stree; Community Development Services and Social Housing and Homelessness Services; Financial Analysis for Housing and Community Services Total Facilities Management Project |
| 56 | Department of Veterans' Affairs | 23 | $1,064,955 | 2014–2022 | 9 | CND002068/1; CND002132/2; CND002552/0 |
| 57 | Department of Infrastructure, Transport, Regional Development, Communications and the Arts | 23 | $985,260 | 2014–2023 | 9 | 0041006705; 0041007341; 0041007404 |
| 58 | Fire and Rescue NSW | 22 | $59,200,000 | 2021–2022 | 2 | Class 1 Firefighting Appliances for Fire and Rescue NSW; Class 2 Firefighting Appliances for Fire and Rescue NSW; Class 2 Refurbished Firefighting Appliances for Fire and Rescue NSW |
| 59 | National Archives of Australia | 22 | $2,600,972 | 2012–2022 | 10 | P12173; PO111200-PO1600167; PO1800047 |
| 60 | Central Queensland University | 22 | $681,526 | 2019–2019 | 1 | 50 days Consulting for Project 8 days Onsite Consulting/Training for Flights & Accommodati; Accommodation (including breakfast); Accommodation and Meals for Residential |

## Caveats / provenance
- **Federal only.** `austender_contracts` is the AusTender OCDS feed (federal). NT/state remote-housing procurement (the $4B whale, Phase 4) is **not** here.
- **Awarded, not open.** These are past awards (demand signal), not open tenders. Open tenders are the Phase-3 `austender-open-tenders` feed in `grant_opportunities`.
- **Keyword recall vs precision.** `bed`/`linen`/`kitchen` are word-boundary matched but adjacent categories can still appear — the sample titles are there to sanity-check each row.
- **No DB writes.** `--apply` is reserved; promoting top buyers into `goods_procurement_entities`/`_signals` is a later-phase decision.
