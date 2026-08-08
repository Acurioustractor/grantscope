# IRSEO ingest — scope

**Date:** 2026-08-08
**Status:** scoped, not built. Needs a go/no-go.

## What it is

IRSEO — Indigenous Relative Socioeconomic Outcomes — is a socioeconomic index built specifically for the First Nations population, from the 2021 Census. Produced by Biddle & Markham at ANU CAEPR.

**401 Indigenous Areas.** Nine component outcomes, including **housing adequacy (overcrowding)**, employment, full-time employment, professional qualifications, educational attainment, income and home ownership.

## Why it is worth having

**SEIFA measures the wrong population here.** We hold SEIFA for 10,572 postcodes and use it on every place page. SEIFA is a *total population* index. In a community that is 96% Indigenous it is approximately right; in Alice Springs at 37% Indigenous it describes mostly non-Indigenous circumstances and is presented as if it described the place. IRSEO has no such problem.

**It carries overcrowding, which is the measure Goods actually responds to.** The chain is crowding → streptococcal transmission → acute rheumatic fever → rheumatic heart disease. That is the reason bedding and washing capacity are health infrastructure rather than furniture. We hold no crowding data of any kind today.

**It brings a geography designed for these places.** Indigenous Areas were built by ABS for First Nations statistics. Every failure mode this codebase documented on 8 August — hub administration, gazetteer absence, confident-wrong placement, cross-border misattribution — is a *council attribution* problem. A unit built for the population in question sidesteps the class of error rather than mitigating it.

## The source

| | |
|---|---|
| File | `irseo_pinirseo_2021.csv`, 38.9 KB |
| Where | ANU Open Research Repository, item `0049eaaf-c094-4485-abce-5c909ab5c9d8` |
| Grain | one row per Indigenous Area (401) |
| Licence | Open Access; **authors retain copyright** — attribution required, terms to confirm before publishing derived figures |
| Paper | `CAEPR_WP_Biddle_and_Markham_2023`, 1.93 MB |

**Rejected source:** the Indigenous HPF measure 2.09 XLSX. Downloaded and inspected — sheets `D2.09.1` through `D2.09.4` carry national, jurisdiction and remoteness aggregates only, 78–83 rows each. No Indigenous Area grain. It cannot be joined to any place page. Useful as a citation, not as data.

## The real cost: joining IARE to anything we hold

The CSV is trivial to ingest. The work is the join. We hold nothing keyed on Indigenous Area.

**Option A — spatial join via ABS Indigenous Structure boundaries.** Download ASGS Ed3 Indigenous Structure (IARE boundaries), assign each of our located things to an IARE by point-in-polygon.

- Best quality. `acara_schools` has 9,755 real coordinates, so schools get a true IARE.
- `postcode_geo` has 11,131 centroids, so postcodes get an approximate IARE — and a large remote postcode like 0872 will land in one IARE while spanning several, which is the same distortion we just spent a day documenting. **Postcode centroids must not be used for this.**
- Cost: boundary file (tens of MB), a point-in-polygon step, one new correspondence table.

**Option B — ABS correspondence file (IARE → SA2 or LGA).** Cheaper, no geometry.

- We already hold `sa2_code` on 12,041 postcodes, so an IARE↔SA2 correspondence would connect through what we have.
- Correspondences are many-to-many with population weights. Applying them to *counts* is fine; applying them to an *index* like IRSEO is not — you cannot population-weight a rank without care.
- Cost: one file, one table, but a real methodological caveat.

**Recommendation: Option A, restricted to schools first.** Schools are the only thing we hold with genuine coordinates. Join schools → IARE, then IRSEO attaches to the need signal already shipped. That gives a defensible Indigenous-specific measure on every place page without ever pretending a postcode is a point.

## Proposed shape

```
irseo_2021              iare_code, iare_name, state, irseo_score, irseo_rank,
                        irseo_decile, <9 component outcomes>, population
iare_school_map         acara_id, iare_code, method='point_in_polygon'
```

Then `getSchoolNeedSignal` gains an IRSEO figure alongside ICSEA, weighted by enrolments the same way, and every council and region page shows both:

- **ICSEA** — how schools here compare on socio-educational advantage (total population)
- **IRSEO** — how First Nations people here compare (First Nations population)

Where those two diverge is itself the finding, and Alice Springs at 37% Indigenous enrolment is exactly where it will.

## Effort

| Step | Size |
|---|---|
| Ingest CSV → `irseo_2021` | small |
| Obtain + load IARE boundaries | medium, largest single piece |
| Point-in-polygon for 9,755 schools | small |
| Extend `school-need-signal.ts` + card | small |
| Guards + verify by render | small |

One focused session, with the boundary file the only thing that could turn into a rabbit hole.

## Decisions needed before building

1. **Licence.** "Authors retain copyright" is not a stated CC licence. Publishing derived IRSEO figures on a public page needs the terms confirmed, or an email to CAEPR. **This is the blocking item** — everything else is mechanical.
2. **Second geography.** Indigenous Areas alongside councils is a genuine complexity increase. Worth it only if IRSEO earns its place beside ICSEA, which already has 100% council coverage and no acquisition cost.
3. **Whether crowding alone is the goal.** If Goods only needs the crowding component for the RHD case, that is one column and the case for the whole index weakens.

## What this does not give us

Not RHD or acute rheumatic fever. Those come from AIHW's *Acute rheumatic fever and rheumatic heart disease in Australia* series and the state RHD registers (NT, Qld, WA, SA), at jurisdiction and some regional grain. IRSEO gives the **predictor** (crowding), not the **outcome** (RHD). For Goods the predictor is arguably the more useful of the two, because it is what a bed changes.
