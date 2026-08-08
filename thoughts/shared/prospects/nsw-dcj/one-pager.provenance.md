# Provenance — NSW DCJ one-pager

**Figures computed:** 2026-08-08 · **Database:** `tednluwflfhxyucgwigh`
**Note:** `thoughts/shared/templates/provenance-template.md` is referenced by the lighthouse guardrails but
does not exist in the repo. This file follows its documented intent: every dollar figure carries the query
that produced it.

## Source chain

`tenders.nsw.gov.au` (NSW eTender disclosures, published to the Open Contracting Data Standard)
→ ingested into `austender_contracts` (the table name is a misnomer; it carries NSW state contracts as
well as Commonwealth AusTender rows — confirmed via `source_url`)
→ joined by `supplier_abn` to `social_enterprises.abn`
→ aggregated into `se_buyer_prospects` by `scripts/scout-se-buyers.mjs`.

## The dedupe that changes the numbers

`scout-se-buyers.mjs` originally built its ABN lookup with `SELECT DISTINCT abn, name, verification_tier,
state`, which dedupes on the whole tuple. 527 registry rows share an ABN with a differing name, tier or
state, so each duplicate fanned the contract join out and multiplied `contract_count` and `total_value`.

Fixed 2026-08-08 to `SELECT DISTINCT ON (abn) ... ORDER BY abn, <tier strength>, name`. Effect on the
figures in this pack:

| Figure | Before fix | After fix |
|---|---|---|
| DCJ contracts | 447 | **383** |
| DCJ value | $4,015.9M | **$3,692.2M** |

The corrected figure was independently reproduced by a separate hand-written query before the script was
changed, and the two agree exactly. Other buyers were inflated far worse — DSS read $10,862M against a
true $3,983M — so any figure taken from `se_buyer_prospects` before 2026-08-08 is not trustworthy.

## Base CTE used by every query below

```sql
WITH se AS (
  SELECT DISTINCT ON (abn) abn, name, verification_tier, source_primary
  FROM social_enterprises
  WHERE abn IS NOT NULL AND abn <> ''
  ORDER BY abn,
    CASE verification_tier WHEN 'certified' THEN 1 WHEN 'verified' THEN 2
                           WHEN 'identified' THEN 3 ELSE 4 END,
    name
)
```

## Figure by figure

| Claim in one-pager | Value | Query |
|---|---|---|
| SE suppliers | 91 | `COUNT(DISTINCT ac.supplier_abn)` over the join, `buyer_name = 'NSW Department of Communities and Justice'` |
| Contracts | 383 | `COUNT(*)` over the same join |
| Total value | $3,692.2M | `SUM(ac.contract_value)` over the same join |
| Still running | 84 | same join, `WHERE ac.contract_end >= CURRENT_DATE` (as at 2026-08-08) |
| Certified tier | 29 suppliers / 158 contracts / $1,862.4M | group by `se.verification_tier` |
| Verified tier | 62 / 225 / $1,829.8M | same |
| Identified tier | 0 | same — returned no rows |
| ORIC | 45 / 137 / $1,043.1M | group by `se.source_primary` |
| Supply Nation | 16 / 52 / $121.0M | same |
| BuyAbility | 7 / 74 / $1,284.5M | same |
| Social Traders | 6 / 32 / $456.8M | same |
| ACNC-classified | 10 / 60 / $628.1M | same |
| SENVIC + SECNA | 2 + 2 / 10 + 4 / $106.0M + $8.6M | same |
| Indigenous combined | 61 / 189 / $1,164.1M | ORIC + Supply Nation rows added |
| Contract window | 2008-11-13 → 2025-01-22 | `MIN/MAX(ac.contract_start)` |
| Smallest contract | exactly $150,000 | `MIN(ac.contract_value)` |
| Median contract | $1.56M | `percentile_cont(0.5)` |
| Largest contract | $334.2M | `MAX(ac.contract_value)` |
| Named suppliers table | as listed | group by `se.name, se.verification_tier` ordered by value |

## Known limits, stated in the pack

- **Lifetime value, not annual.** Multi-year agreements count at full value from their start year. The
  2022 cohort alone carries $2,556.8M of the $3,692.2M total.
- **Coverage ends 2025-01-22.** By start year: 2020 = $325.1M, 2021 = $166.8M, 2022 = $2,556.8M,
  2023 = $158.6M, 2024 = $42.2M, 2025 = $0.5M. The 2023–2025 taper reflects disclosure publishing lag,
  not a measured decline. **Do not present it as a trend.**
- **$150K disclosure floor.** No sub-threshold engagement is visible. Absence of small contracts is a
  reporting artifact, not a finding about DCJ behaviour.
- **Our definition of social enterprise**, not DCJ's: presence in the CivicGraph registry with an external
  verification mark or statutory register entry.
- **Supplier-side attribution.** ORIC / Supply Nation registration is the supplier's own status. It does
  not imply DCJ counted that contract toward any Aboriginal Procurement Policy target.

## Not yet verified

- Whether DCJ publishes its own social-procurement or APP performance figures, and how ours compare. If
  they do and the numbers differ, theirs is authoritative and we lead with the difference, not our number.
- Current DCJ procurement contacts. No named individual has been researched or contacted.
