# Life Course Longitudinal Data: Feasibility Assessment

## What Is It?

"Life Course Data" links an individual's records across health, education, welfare, disability, and justice systems over time — enabling analysis like "children who experienced X at age 3 had Y outcomes at age 18." Australia's major assets:

- **PLIDA** (Person-Level Integrated Data Asset) — ABS-managed, 39.9M person records across 37+ datasets (ATO, Centrelink, MBS/PBS, Census)
- **NDDA** (National Disability Data Asset) — Links NDIS + state health/education/justice/housing. $31.4M establishment cost. Operational 2026.
- **NSW Human Services Dataset** — All births from 1990+, linked to justice/health/education
- **SA BEBOLD** — 32 birth cohorts, 640K children tracked to age 30+
- **Vic VAED+LEAP** — Hospital admissions linked to police/justice contacts

## Can CivicGraph Access This?

### Short answer: No — not directly, not as a private company.

The **DATA Act 2022** explicitly limits Accredited Users to **government bodies and universities**. Private companies can become Accredited Data Service Providers, but this requires:
- 2-3 year track record handling sensitive data
- IRAP assessment at PROTECTED level
- National Data Commissioner accreditation
- Demonstrated Five Safes compliance

### Legal barriers (non-negotiable)

| Legislation | What It Blocks |
|---|---|
| DATA Act 2022 | Private companies cannot be Accredited Users |
| Privacy Act 1988 | Person-level data requires ethics + custodian approval |
| Census & Statistics Act 1905 | ABS data carries criminal penalties for misuse |
| State Health Records Acts | Health data requires HREC ethics approval per state |
| State child protection secrecy provisions | CP data is the most restricted category |

### Timeline if we tried anyway

| Phase | Duration | Cost |
|---|---|---|
| University partnership negotiation | 6-12 months | $5-15K |
| HREC ethics approval (per state) | 6-12 months | $5-10K per application |
| Data custodian agreements | 12-24 months | $20-50K legal |
| Secure research environment build | 6-12 months | $50-100K |
| **Total** | **2-4 years** | **$100-200K minimum** |

And even then, the data stays inside the secure environment — it cannot be exported to CivicGraph's platform.

## What CivicGraph Should Build Instead

### The "Area-Level Life Course Proxy"

Instead of linking individual records (legally impossible), link **publicly available aggregate data at postcode/LGA level** to create a "place-based life course view":

```
EARLY YEARS                    EDUCATION                JUSTICE                 DISABILITY
AEDC vulnerability     →    NAPLAN results by LGA  →  Youth justice rates  →  NDIS participation
(by postcode)               (MySchool)                (ROGS/AIHW)             (by service district)
                                    ↓                        ↓
                            School attendance         Incarceration rates
                            (by remoteness)           (by LGA - BOCSAR)
```

All of this data is **publicly available** and **already partially in CivicGraph**:
- `seifa_2021` — 11K postcodes with disadvantage deciles
- `justice_funding` — 64,560 records by state/program
- NDIS participation data — by service district
- `mv_funding_by_postcode` — 2.9K postcodes with entity counts + funding totals
- BOCSAR crime data — by LGA (already imported)
- Closing the Gap indicators — youth justice metrics (already imported)

### What it costs

| Item | Cost | Timeline |
|---|---|---|
| AEDC data integration (public, by community) | $5K | 2 weeks |
| NAPLAN/MySchool scrape by LGA | $5K | 2 weeks |
| ROGS youth justice indicators | Already done | — |
| AIHW child protection indicators by state | $3K | 1 week |
| NDIS participation by service district | Already done | — |
| Linking layer (postcode → LGA → SA2 → service district) | $10K | 4 weeks |
| Dashboard + API | $15K | 4 weeks |
| **Total** | **~$30-40K** | **10-12 weeks** |

### Limitations (be honest about these)

- **Ecological fallacy** — area-level correlations don't prove individual causation
- **Resolution** — postcode/LGA level, not person level
- **No causal inference** — can show "places with X also have Y", not "X causes Y"

### Why this is still powerful

The document you sent identifies that governments spend **$5-50M per bespoke data linkage engagement**. CivicGraph's area-level proxy:
1. Answers 80% of the same questions at 0.1% of the cost
2. Is available immediately, not after 2-4 years of ethics approval
3. Can be shared publicly — no secure environment needed
4. Contextualises the person-level data that IS inside PLIDA/NDDA
5. Shows the **structural gaps** (underfunded postcodes, thin provider markets, missing community-controlled orgs) that person-level data never reveals

## Recommendation

**Don't chase person-level access. Build the area-level life course proxy in 12 weeks for $40K, and position it as the complementary public layer that makes the expensive secure data environments actionable.**

The pitch: "PLIDA tells you that children in disadvantaged areas have worse outcomes. CivicGraph tells you *which* disadvantaged areas have no community-controlled services, no justice diversion funding, and captured disability markets — and which funders and partners could change that."
