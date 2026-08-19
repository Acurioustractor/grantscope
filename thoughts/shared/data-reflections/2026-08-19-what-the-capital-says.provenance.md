# Provenance: What the capital says

Every figure in `2026-08-19-what-the-capital-says.md`, with its source and confidence.
Queried 2026-08-19 against Supabase project `tednluwflfhxyucgwigh` via `scripts/gsql.mjs`.

## Standing caveat: the double-count

`justice_funding.measure_kind='expenditure_aggregate'` currently holds a duplicate ingest
(GitHub issue #299, migration written and not yet applied). **The essay is unaffected.**
Every ROGS figure used here is taken per `program_name` label, and the duplication is
across labels, not within them. A whole-lane `SUM` would be wrong by roughly 2x; nothing
in the essay does that. Re-verify after the migration lands anyway.

## Figures

**Recurrent expenditure by lane (the three-lane table).** Verified.
```sql
SELECT financial_year,
  round(sum(amount_dollars) FILTER (WHERE program_name LIKE 'ROGS%Detention%')/1e6) detention_m,
  round(sum(amount_dollars) FILTER (WHERE program_name LIKE 'ROGS%Community%')/1e6) community_m,
  round(sum(amount_dollars) FILTER (WHERE program_name LIKE 'ROGS%Group%')/1e6) conferencing_m
FROM justice_funding WHERE measure_kind='expenditure_aggregate' AND program_name LIKE 'ROGS%'
GROUP BY 1 ORDER BY 1 DESC;
```
2015-16: 592 / 274 / 59. 2019-20: 720 / 450 / 49. 2024-25: 1141 / 520 / 62.
Upstream source: Productivity Commission, Report on Government Services, Community
Services, Youth Justice. Growth rates (93%, 90%, 5%) derived from these.

**Net capital expenditure. $1,791M / $88M / $20M.** Verified. Same table,
`program_name LIKE 'Net capital expenditure%'`, 8 rows per lane. 94% derived
(1791 / 1899).

**Youth justice grants: $915.7M, 1,236 recipients, top 10 = 16.6%, 2008-09 to 2024-25.**
Verified. `measure_kind='grant'`, `is_aggregate IS NOT TRUE`, `amount_dollars IS NOT NULL`,
`topics @> ARRAY['youth-justice']`, aggregate-shaped recipient names excluded per the
mandatory filters in CLAUDE.md. 4,066 rows. Recipients counted on
`lower(trim(recipient_name))`, so the same organisation under two spellings counts twice
and 1,236 is an upper bound on distinct organisations.
**Stated in the essay as a floor**, because our grant coverage is known to be incomplete.

**Federal contracts: $1,268bn total, community-controlled $5.43bn (0.43%).** Verified.
`austender_contracts` LEFT JOIN `gs_entities` on `abn = supplier_abn`. 825,222 rows,
no join fan-out (bucket counts sum exactly to the total).
- Unmatched suppliers hold $68.37bn and are excluded from the numerator. If every
  unmatched supplier were community-controlled the share would still be under 6%.
- **Known bias, disclosed in the essay:** `supplier_abn` resolves to a registered address,
  not a delivery location. Documented intermediary artefact (remote NT funding routed via
  regional and land councils credits the hub). 0.43% is a floor.

**Remoteness split: Remote + Very Remote $3.1bn (0.24%), Major Cities $1,098bn.**
Verified, same join, `GROUP BY e.remoteness`. Same registered-address caveat.

**Contract date dirt.** 821,692 of 825,222 contract_start dates plausible; 557 pre-1990,
22 future-dated carrying $1.25bn, 2,951 null. Not material to any figure used.

## External sources

**Preston: 5% to 18.2% local retention, 39% to 79.2% across Lancashire, ~£70M rerouted,
4,500 jobs.** Unverified against primary documents. Taken from CLES and Preston City
Council summaries via web search, which agree with each other.
- https://cles.org.uk/community-wealth-building-in-practice/community-wealth-building-places/community-wealth-building-in-preston/
- https://pec.ac.uk/policy_briefing_entr/stimulating-local-growth-through-procurement-lessons-from-the-preston-model/
Before publishing, read the CLES evaluation directly. The jobs figure in particular is
the kind of number that gets repeated without a source.

## Claims made without a number

"Group conferencing is the lane with the evidence behind it" is asserted, not evidenced
here. It is defensible from the restorative justice literature but this document does not
cite it. Either cite it or soften it before the essay goes public.
