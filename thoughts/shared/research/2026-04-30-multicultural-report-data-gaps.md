# Multicultural Sector Report — Data Audit & Idea Generation

**Date:** 2026-04-30  
**Scope:** `apps/web/src/app/reports/multicultural-sector/fecca-eccv/page.tsx` + the broader multicultural sector dataset

After today's session the page is meaningfully richer (9 sections, $484M of new VIC grants visible across 3 years, 64% linked to entities). This document is what's still missing — both data we have but don't render, and data we don't have but should ingest.

---

## What the page already shows

| § | Title | Source |
|---|---|---|
| Anchor cards | FECCA + ECCV identity | acnc_charities + acnc_ais latest |
| §1 | Financial Trajectories — both FECCA + ECCV revenue bars over time | acnc_ais multi-year |
| §1b | Where the Money Goes — latest year revenue/spend/staff per anchor | acnc_ais latest |
| §2 | FECCA Commonwealth Contracts | austender_contracts |
| §2b | Cross-System Power Profile | mv_entity_power_index |
| §3 | FECCA Board (directors + portfolios) | gs_relationships + mv_person_influence |
| §4 | ECCV Board (directors + portfolios + roles) | gs_relationships + mv_person_influence |
| §5 | Annual Report cards (impact summary, beneficiaries, programs, **funders mentioned**, **key quotes**) | charity_impact_reports (newly LLM-enriched) |
| §6 | VIC State Grants — to FECCA/ECCV/cluster | vic_grants_awarded (now 5,202 rows, 64% linked) |
| §7 | Cluster Siblings — sister ECCs receiving VIC grants | vic_grants_awarded ABN-list join |

---

## Data we already have but don't render

### A. **AMES is the elephant in the room.**
- `austender_contracts` shows Adult Multicultural Education Services (AMES) holds **$1.85B+ across 66 federal contracts** — overwhelmingly the dominant federal funder of the multicultural sector
- Top single contract: **$1.4B** to "ADULT MULTICULTURAL EDUCATION SERVICES"
- For comparison FECCA's lifetime austender contracts: $0.91M
- **The page positions FECCA/ECCV as "the federation's anchors" but federally, the real anchor is AMES, and they're invisible.** Either reframe the report's title, or add a §2c "The AMES Asymmetry" panel.

### B. **VIC grant topic concentration**
The 5,202 newly-ingested grants split (by `program_name` keyword):
- **First Peoples / Treaty: $91M (35 grants)**  ← largest single bucket
- Family / children: $14.3M (71 grants)
- **Multicultural / ethnic: $8.6M (137 grants)**
- Youth: $2.2M (32)
- Other: $141M (531)

The multicultural sector receives ~10× less than First Peoples / Treaty work through these state channels. **§6 currently shows only the top-30 individual grants — it should include this topic-mix chart at the top.**

### C. **Year-over-year totals are now comparable**
- FY2021-22: $103.9M total (from DPC + DFFH)
- FY2022-23: $158.9M
- FY2023-24: $221.5M (DPC + DFFH + DJSIR)
- **Growth + dept-mix should be a §6 header chart.**

### D. **Top recipients by amount, NOT linked to anchors**
Most-funded VIC recipients in our dataset are First-Peoples bodies, not multicultural orgs:
- Munarra Limited: $31.5M (2 grants, DPC)
- First Peoples' Assembly of Victoria: $24.2M
- Treaty Authority: $20.9M
- Centre for Multicultural Youth: $18.0M (closest "multicultural" org by amount)
- Dja Dja Wurrung: $7.7M

**Ideas:** Add a "Top 20 Recipients in our Annual-Report-Sourced Dataset" panel. Highlight that the largest ABN-unlinked recipient is the **Self-Determination Fund Trustee at $35M** (single grant) — needs ingestion.

### E. **ACNC beneficiaries vs reality**
- ECCV's ACNC registration claims it serves: **Aged · Ethnic Groups · Families · Financially Disadvantaged · Homelessness Risk · Chronic Illness · Disability · Rural & Remote · Veterans · Disaster Victims** (10 groups)
- Their actual programs (per annual reports) are much narrower
- Worth a 1-line callout in §5 cards: "ACNC registered to serve N beneficiary groups; programs delivered focus on M of them"

### F. **AustEnder contracts going TO multicultural-sector orgs**
Top 10 multicultural suppliers by $:
- AMES (Adult Multicultural Education Services) — $1.85B
- Multicultural Australia Ltd — $78M
- Multicultural Development Association Inc — $137M
- ETHNIC INTERPRETERS PTY LTD — $40M
- Centre for Multicultural Youth — $9M

**Adding a §2.5 "Federal Procurement of Multicultural Services" cross-section table** would massively expand the federal funding picture.

### G. **Foundation grant flow**
`foundations` table shows two large foundations with refugee/migrant in thematic_focus:
- Australian Red Cross Society — $266M annual giving
- United Israel Appeal Refugee Relief Fund — $69M annual giving

**Page doesn't currently surface foundation giving at all** — which matters because FECCA explicitly cites Department of Infrastructure / Department of Home Affairs as funders, but foundations like Snow / Helen Macpherson Smith are major multicultural-sector funders not currently in the picture.

### H. **Geographic story we're not telling**
- ECCV is in postcode 3058 (Coburg North, Darebin LGA)
- FECCA is in 2601 (Canberra)
- We have `postcode_geo` (lat/lng/SA2/remoteness) and `seifa_2021` (disadvantage index) for both
- Could overlay grant-recipient postcodes against CALD population by LGA — **does VIC funding actually go to LGAs with high CALD populations, or to orgs based in Darebin?**

### I. **Director board-interlock data exists but partial**
- `mv_board_interlocks` has 39,757 rows of cross-board people
- We render board_count + organisations in §3/§4 via mv_person_influence — but NOT the cross-org connection structure
- **A graph-style "FECCA board's external network" sankey or chord diagram** would tell the federation-shadow-network story we describe in §3 prose

### J. **Political donations**
- ECCV/FECCA themselves don't donate
- BUT **The Ethnic Communities Council of Queensland Limited has 3 donations totalling $3,000** in our data — small, but worth a mention as the only ECC entity that donates
- Worth a 1-line footnote in §7 (Cluster Siblings) about which sister ECCs are politically active

---

## Data we don't have but should

### 1. **Federal Department of Home Affairs settlement grants** (CRITICAL GAP)
- SETS (Settlement Engagement and Transition Support) — multi-million annual program
- NMRP (National Multicultural Resilience Program)
- AMEP (Adult Migrant English Program) — already partly visible via AMES contracts
- These are the **dominant** federal multicultural funding streams; we have ZERO direct data
- **Action:** Adapt our pdftotext scraper for Home Affairs annual reports; or look for grants.gov.au listings

### 2. **VIC Multicultural Commission disbursements**
- VMC publishes annual community-grants lists, distinct from DPC/DFFH/DJSIR streams
- Probably ~$15-30M/year direct to orgs
- **Action:** Single PDF scrape against multicultural.vic.gov.au

### 3. **NSW + QLD + WA + SA + NT + ACT state ECCs**
- Federation has a dozen+ state/regional ECCs; we link 7 in §7
- Missing: Multicultural Council of WA, Multicultural Communities Council SA, ECC of QLD (full grant flow), Multicultural Council of NT
- **Action:** Add these ABNs to the §7 hardcoded list AND scrape NSW/QLD state-dept annual reports to get their funding

### 4. **Triennial vs annual funding agreements**
- Our data shows totals but not duration. ECCV's $962,500 DPC grant in 2023 might be a 3-year agreement
- **Action:** Either parse `start_date` / `end_date` from PDF tables (already in our schema, mostly NULL), or scrape program-funding-agreement metadata from VAGO reports

### 5. **Director appointment / resignation dates**
- We have current board, not tenure
- ACNC's responsible-persons feed has start/end dates we're not pulling
- **Action:** Augment the ACNC director scrape to capture appointment_date

### 6. **Director ↔ political party links via shared employer**
- Many ECC directors come from labor / liberal advisory roles before joining the board
- We could match against `political_donations` donor names and our own data
- **Action:** Cross-reference person_id with mv_revolving_door

### 7. **CALD population counts per LGA** (DEMOGRAPHICS)
- ABS 2021 Census has language-spoken-at-home, country-of-birth by SA2
- **We have postcode_geo + sa2_code, but no demographic table.** Worth ingesting `abs_cald_2021` from data.gov.au
- Would unlock a "funded LGAs vs CALD-density LGAs" map

### 8. **Settlement Council of Australia (SCA)**
- Peak body for settlement service providers, distinct from FECCA but adjacent ecosystem
- Should be in `gs_entities` and linked via shared directors

### 9. **Cross-program rollups**
- Many DFFH grants belong to named programs ("Building Equality Strategy", "Stronger Communities Fund", etc.)
- Currently each grant is a row; we never roll up by program
- **Action:** Add a `program_rollup_view` MV that groups by program_name and shows total + recipient count

### 10. **Trustee-of normalisation** (DATA QUALITY)
- "Trustee for the Lake Tyers Aboriginal Trust" / "THE TRUSTEE FOR FRAMLINGHAM ABORIGINAL TRUST" / "First Peoples Assembly of Victoria Ltd" / "First Peoples' Assembly of Victoria Ltd"
- Even after fuzzy linking, these duplicate-row patterns persist
- **Action:** A second-pass canonicaliser that strips "Trustee for" / "The Trustee" / leading "THE " and resolves apostrophe vs no-apostrophe conflicts; aim to bump 64% → 80%+ linked

### 11. **DPC 2022-23 was probably under-extracted**
- We got 85 grants worth $71M
- The actual DPC grants disclosure for 2022-23 is likely $200M+
- The script's `SECTION_END_RE` matched "Section 4: Other disclosures" early; the grants table continues into Appendices 2 + 3
- **Action:** Tighten section-end detection to ignore false-positive section-headings within the grants section

### 12. **Service-level data**
- ECCV's 2022 annual report claims X clients served; FECCA reports policy submissions made
- This is in the LLM-enriched `total_beneficiaries` / `programs_delivered` for some orgs
- For peak/policy bodies (FECCA, ECCV) these are usually NULL
- **Action:** Add a peak/policy-body-specific extraction prompt that captures "submissions filed", "consultations led", "media mentions" instead of "people served"

---

## Big-picture report ideas

### Idea 1: "The Asymmetry of Multicultural Funding"
A new top-of-page section that opens with the AMES vs FECCA disparity, the First-Peoples-vs-multicultural ratio in VIC grants, and the federal-vs-state mix. Frames the report less as "FECCA & ECCV's two anchors" and more as "where the multicultural sector's money actually comes from."

### Idea 2: "Map of Funded Multicultural Services in Victoria"
Use postcode_geo + grant data to plot funded recipient locations. Overlay with CALD population data once ingested. Would visually answer "is funding tracking need?"

### Idea 3: "The Settlement Sector's Federal Procurement Story"
Dedicated chart of the AMES + Multicultural Development Association + Multicultural Australia + ethnic interpreters chain. ~$2B of federal procurement, almost entirely opaque. This is the multicultural sector's biggest dollar story and we're not telling it.

### Idea 4: "Director Networks — The 250-person Federation Shadow Map"
Pull every cluster-director's other boards from `mv_board_interlocks`. Render as a force graph. Would reveal whether the multicultural federation is highly interconnected (small cabal) or distributed.

### Idea 5: "Triennial-Cycle Risk"
Once we have start_date/end_date data, plot a Gantt-like chart of every multicultural-sector funding agreement. Surfaces the "what happens when this 3-year cycle ends?" risk for each org.

### Idea 6: "Beneficiary-Group Reality Check"
Per-charity comparison of ACNC-registered beneficiaries vs program-mentioned beneficiaries. Would expose the gap between registration boilerplate and actual delivery.

### Idea 7: "Where ECCs Don't Exist"
There are LGAs with high CALD populations but no funded multicultural service org. A heatmap of "underserved" LGAs would be a Newman-Foundation-aligned story.

---

## Concrete near-term actions (ranked)

1. **Add the AMES asymmetry panel** to §2 — uses data we already have
2. **Add the topic-mix chart** to §6 — uses data we already have
3. **Add the year-over-year stacked bar** to §6 — uses data we already have
4. **Scrape VIC Multicultural Commission grants** — single PDF, high signal
5. **Better trustee/apostrophe canonicalisation pass** — push linker from 64% to 80%+
6. **Re-scrape DPC 2022-23 with looser SECTION_END_RE** — likely 100+ more grants
7. **Add Home Affairs SETS/AMEP grants ingestion** — biggest federal multicultural story
8. **Scrape NSW + QLD state ECCs** — completes the federation picture
9. **Ingest ABS CALD data by LGA** — unlocks geographic story
