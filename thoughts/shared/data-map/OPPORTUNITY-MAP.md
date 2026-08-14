> **⚠ READ `VERIFICATION.md` BEFORE ACTING ON THIS DOCUMENT.**
> An adversarial pass checked 41 claims here: 34 CONFIRMED (most to the exact digit), 7 corrected.
> The corrections are not cosmetic. In particular:
> - **19 objects on the DELETE/DROP list are read or written by live application code.** The
>   analysis equated "empty" with "unused"; they are write-first tables. Do not drop anything
>   from this document without first grepping both `src` trees AND `pg_proc.prosrc`.
> - The justice drill-through gap is **100%, not 82%** — `gs_relationships.source_record_id` is a
>   dead key namespace, not a partial-orphan problem.
> - QLD watchhouse figures need rebaselining: the first monthly bucket is n=2 snapshots.
>   On a May baseline it is 2.7x (not 3.0x) and non-Indigenous +476% (not +868%).
> - "290 dark objects" means *unreferenced by application code*, not unused — the scan never read
>   410 database function bodies or 227 triggers (measured 23% false-positive rate on a sample).
> - This document covers 812 tables/matviews. The schema actually holds **1,024 relations** —
>   212 views and 409 functions were never inventoried. See `COMPLETENESS.md`.

---

# THE OPPORTUNITY MAP
## What this data can uniquely reveal, and what to acquire next

**Written:** 2026-08-14
**Method:** read `research-gaps-competitive.md` and `join-spine.md` in full; skimmed the three inventory shards; ran **7 batched psql sessions (≈30 statements)** against `tednluwflfhxyucgwigh` to verify feasibility and produce real numbers.
**Marking convention:** every number is **[RAN]** (I executed the query this session, SQL and output shown in §2), **[CENSUS]** (read from `census.csv` / `populated_objects.md`), **[PRIOR]** (verified by an earlier agent, cited), or **[INFERRED]**.

---

## 0. The one-paragraph answer

The unique asset is not the 52.3 million rows. It is that **four normally-siloed spines meet on one key**: money (contracts + grants + donations + philanthropy), governance (339,698 board roles), place (LGA/postcode with reason-coded provenance), and evidence (what actually works). No Australian publisher joins any two of those, let alone four. I verified **nine** cross-sections that are answerable today and **ran six of them for real** — including a QLD watchhouse child population that **tripled in under four months** driven almost entirely by non-Indigenous children, and **85% of organisations receiving youth-justice grant money having no recorded evidence of what works**. But the same session found three headline numbers in this database that are **wrong by an order of magnitude or more**: political "donations" are 89% non-donation receipts, 29.4% of all recorded Commonwealth contract value sits in **13 rows** (one of which is a $121bn law-firm contract that cannot be real), and `justice_funding` mixes state budget aggregates with individual grants so a naive sum overstates youth-justice money **45×**. The opportunity and the risk are the same fact: nobody else can compute these numbers, so nobody else will catch them being wrong. **Ship the cross-sections with the sentinels attached, or don't ship them.**

---

## 1. THE SIGNATURE QUESTIONS

### 1A. Ship now — verified feasible

Feasibility was checked against measured join coverage in `join-spine.md` §4 and, for Q1–Q9, by running the query. Coverage floor applied: I rejected anything whose binding join measured below ~45% unless the question is explicitly *about* the gap.

---

#### Q1. How many children are held in Queensland police watchhouses tonight, in which watchhouse, for how long, and is that changing? ✅ **RAN — §2.1**

- **Tables:** `qld_watchhouse_snapshots` (201) · `qld_watchhouse_snapshot_rows` (8,488, 63 facilities) [CENSUS]
- **Join:** none needed — self-contained, `snapshot_id` FK, `raw_pdf_sha256` provenance
- **Shape:** a daily time series per facility × age group × First Nations status × custody-duration band
- **Why nowhere else:** AIHW publishes youth detention **quarterly, state-level, ~2 quarters lagged**. This is **facility-level, near-daily, ~1 day lagged** [PRIOR]. Watchhouses are police custody, not detention centres, so they fall in the gap *between* AIHW's collection and QLD Corrections reporting. Nothing public in Australia has this shape.
- **Caveat that must ship with it:** counts are **person-observations per snapshot**, not distinct children. Coverage begins 2026-04-28; August is partial.

```sql
SELECT date_trunc('month', source_generated_date)::date AS month,
       count(*) snaps, round(avg(total_children),1) avg_children,
       round(avg(child_first_nations),1) avg_fn, round(avg(child_non_indigenous),1) avg_nonind,
       round(avg(child_over_7_days),2) avg_over_7d, max(child_longest_days) max_days
FROM qld_watchhouse_snapshots GROUP BY 1 ORDER BY 1;
```

---

#### Q2. Which organisations are governed by someone who also sits on another board, and how much public money do those organisations hold? ✅ **RAN — §2.2**

- **Tables:** `mv_board_interlocks` (39,757) → `unnest(entity_ids)` → `mv_entity_total_funding` (94,088) [CENSUS]
- **Join:** uuid array → `mv_entity_total_funding.entity_id`
- **Shape:** a deduplicated organisation set with a money rollup, plus a board-count band
- **Why nowhere else:** requires ACNC Responsible Persons (web-page only, not in the bulk file) joined to AusTender + GrantConnect + justice funding on one entity key [PRIOR]. ASIC's free file has no officeholders at all.
- **Hard rule:** band by `board_count`, cap at 10. §2.2 shows *why* — the >10 bands have 4–17× the average procurement dollars, which is the nominee-block artefact inflating the most attractive-looking numbers.

---

#### Q3. How much money goes to organisations with no recorded evidence of what works — by topic? ✅ **RAN — §2.3**

- **Tables:** `justice_funding` (157,116, `gs_entity_id` **93.65%** stamped [PRIOR]) × `alma_interventions` (2,136, 70.27% stamped) via `gs_entity_id`
- **Shape:** two rows per topic — has-evidence vs no-evidence, org count and grant dollars
- **Why nowhere else:** there is no Australian funding→evidence linkage at all. ALMA is a purpose-built evidence register; no regulator collects this.
- **Mandatory filters (both discovered this session, §2.3):** `measure_kind = 'grant'` (excludes RoGS/AIHW state budget aggregates) **and** `topics && ARRAY['youth-justice']` — note **hyphens, not underscores**.

---

#### Q4. Is the charity delivering this government service financially able to survive the contract? ✅ **RAN — §2.4**

- **Tables:** `mv_justice_charity_financial_health` (5,898) built on `acnc_ais` (360,488, ABN match **94.08%** [PRIOR])
- **Shape:** a fragility tier per charity with government-revenue share, deficit flag, months of reserves
- **Why nowhere else:** ACNC publishes the AIS and AusTender publishes the contracts; neither joins them. This is the single question every government commissioner has and cannot answer. Directly serves the buyer wedge.
- **Caveat:** use **median** months-of-reserves, not mean — the `watch` tier's mean is 1,956 months, obvious outlier contamination (§2.4).

---

#### Q5. Which entities both give money to political parties and take money from government? ⚠️ **RAN — SHIP ONLY AFTER TWO FIXES — §2.5**

- **Tables:** `mv_donor_contract_crossref` (2,175) over `political_donations` (2,549,483) + `austender_contracts` (823,620)
- **Why nowhere else:** AEC and AusTender share no key. Donor→supplier resolution is name-based and nobody has built it.
- **Two fixes that are non-negotiable before this is publishable, both found this session:**
  1. **89% of `political_donations.amount` is `receipt_type = 'other receipt'`, not donations** — 1,838,739 rows / $186.7bn vs 506,739 rows / $22.97bn of actual `donation received`. The MV sums all types.
  2. **The contract side has a $121bn phantom row.** `Gilbert and Tobin` / Dept of the Treasury / 2018-06-03 / **$121,149.1m** is 99.96% of that supplier's total and cannot be real.
- This is simultaneously the most publishable and the most defamation-sensitive question in the database. Correlation only, never causation.

---

#### Q6. Which of Australia's most disadvantaged places receive essentially no recorded money? ✅ **RAN — §2.6**

- **Tables:** `mv_funding_deserts` (1,997 rows — **NOT one per LGA**, see below) × `gs_entities` LGA spine
- **Shape:** ranked LGA list — IRSD decile, org count, community-controlled count, total dollar flow
- **Why nowhere else:** requires SEIFA + remoteness + six money systems resolved to a common LGA key. ABS publishes SEIFA; nobody attaches money to it.
- **Grain hazard [RAN]:** 1,997 rows, **551 distinct LGA names, 717 distinct name|state**. You must `GROUP BY lga_name, state` or you triple-count.
- **Caveat that must ship with it:** remote NT/WA/SA communities are funded through regional and land councils whose registered address credits the hub, not the community [PRIOR, MEMORY]. "$0 recorded" means *not visible in this data*, which is a finding about the money's legibility as much as its destination.

---

#### Q7. How much Commonwealth grant money goes to organisations this graph has never heard of? ✅ **RAN — §2.7**

- **Tables:** `grantconnect_awards` (291,264) × `gs_entities` × `abr_registry` (20,006,350)
- **Shape:** one number, plus a fixable backlog
- **Why nowhere else:** it is a question *about* the graph. But it is the honest denominator for every "total grants" figure the project publishes, and it is a one-bulk-insert fix from `abr_registry` [PRIOR: 99.97% of these ABNs are real].

---

#### Q8. Who says they serve people leaving prison, and does any money reach them? ✅ **RAN — §2.8**

- **Tables:** `acnc_charities` (66,023, ABN match **100%** [PRIOR]) × `gs_entities` × `mv_entity_total_funding`
- **Shape:** counts by self-declared beneficiary flag, with money attached to the subset that has a rollup
- **Why nowhere else:** ACNC's 30+ boolean beneficiary flags (`ben_pre_post_release`, `ben_aboriginal_tsi`, `ben_youth`, `ben_victims_of_crime`…) are published and, as far as I can find, **never joined to money by anyone**. They are the cheapest sector taxonomy in Australia and they sit unused.
- **Caveat:** "no funding rollup" conflates *no money* with *rollup coverage* — `mv_entity_total_funding` reaches only 15.4% of the spine [PRIOR]. State it as a coverage fact, not a funding fact.

---

#### Q9. Which charitable-foundation grantees also hold government contracts? ✅ **RAN — §2.9**

- **Tables:** `foundation_grantees` (6,001, `grantee_abn` **100% match** on the 97.7% that have one [PRIOR]) × `austender_contracts.supplier_abn`
- **Shape:** overlap count + contract value, per foundation
- **Why nowhere else:** Foundation Maps Australia is opt-in and members-only, with no export; AusTender knows nothing about philanthropy [PRIOR]. This is the philanthropy↔procurement seam and it is genuinely vacant.
- **Caveat:** apply the Q5 outlier sentinel — I did not check whether any of the 13 mega-rows land in this set.

---

#### Q10. Which entities appear in three or more influence systems at once? ✅ Feasible, not run

- **Tables:** `mv_revolving_door` (6,976) — carries `lobbies`, `donates`, `contracts`, `receives_funding`, `influence_vectors`, `revolving_door_score` [column list verified via `pg_attribute` this session]
- **Backed by** `gs_relationships`: 2,452 `lobbies_for` edges [PRIOR]
- **Why nowhere else:** four registers, four regulators, no shared key.

```sql
SELECT influence_vectors, count(*), round(sum(total_contracts)/1e9,2) contracts_bn
FROM mv_revolving_door GROUP BY 1 ORDER BY 1 DESC;
```

---

#### Q11. Which charities are most dependent on government revenue, and does dependence track size, state or sector? ✅ Feasible, not run

- **Tables:** `acnc_ais` (360,488; `revenue_from_government` / `total_revenue`) × `gs_entities` by ABN (94.08%)
- **Why nowhere else:** ACNC's own Australian Charities Report gives this **by size band nationally** and stops. Per-entity, per-state, per-sector, joined to *which contracts caused it* — nobody.
- **Coverage hazard [PRIOR]:** `acnc_ais` has **no FY2024 rows at all**, and exactly one 2025 row. Always `GROUP BY ais_year` before trusting a trend.

---

#### Q12. For one ABN, what is every dollar from every tier of Australian government? ✅ Feasible, not run

- **Tables:** `austender_contracts` (93.0% ABN-linkable) + `grantconnect_awards` (72.4% stamped) + `state_tenders` (81.7% stamped) + `justice_funding` (93.65%) + `vic_grants_awarded` (65.5%) + `research_grants` (95.5%) [all PRIOR]
- **Why nowhere else:** **there is no national state-grants aggregation in Australia** [PRIOR]. Federal contracts + federal grants + state tenders on one key is, as far as the competitive research found, unique.
- **Must show per-source linkage rate in the UI** — a single-entity total assembled from six sources with 65–95% coverage is a floor, not a total, and should be labelled "at least".

---

#### Q13. Does executive pay track government dependence? ✅ Feasible, not run

- **Tables:** `acnc_ais.total_paid_key_management` / `num_key_management_personnel` / `revenue_from_government` / `total_revenue`
- **Why nowhere else:** the fields are published in the bulk AIS and, as far as I can tell, never crossed against procurement. Politically potent, high accuracy risk (KMP pay is a total, not a salary), so it needs a strong caveat and per-charity drill-through to the source AIS row.

---

#### Q14. In the LGAs where community-controlled organisations exist, what share of the money do they get? ✅ Feasible, not run

- **Tables:** `gs_entities.is_community_controlled` + `community_controlled_tier` + `cc_confidence` × `lga_code` × `mv_entity_total_funding`
- **Why nowhere else:** no regulator flags community control. This is a derived attribute unique to this database, and `cc_confidence` lets the view gate on it.
- **Honest at:** LGA, for the 48.3% of entities with an LGA [RAN, §2.10].

---

#### Q15. Which ministers met which organisations, and did those organisations subsequently win contracts? ⚠️ Feasible at pilot scale only

- **Tables:** `civic_ministerial_diaries` (1,728, has `organisation_abn` + `linked_entity_id`) × `austender_contracts` / `grantconnect_awards`
- **Verdict:** the join is real and the schema is right; 1,728 meetings is a demo, not a corpus. **Ship as a worked example, not as a finding.** Scaling it is roadmap item #7.

---

#### Q16. Where does NDIS market concentration sit against disadvantage? ⚠️ Feasible at **state level only**

- **Tables:** `ndis_market_concentration` (14,915) · `ndis_utilisation` (143,987) · `ndis_participants` (67,353) · `ndis_registered_providers` (48,510, **100% stamped** [PRIOR])
- **Hard ceiling [PRIOR, verified]:** `ndis_participants_lga.lga_code` is **100% NULL** — `count(DISTINCT lga_code) = 0`. Nothing in this database maps an NDIS service district to an LGA or postcode. 362,313 rows are stranded at state level.
- **Verdict:** ship the provider side at entity level (100% stamped) and the district side at state level. **Do not draw an LGA choropleth of NDIS anything.**

---

### 1B. Needs work — do not build UI on these yet

| # | The question | Why it fails today | What would fix it |
|---|---|---|---|
| N1 | Youth detention rate by LGA | `aihw_youth_justice_stats` = **13 rows**, one year, `source_table='PDF_HEADLINE'`, NT missing [PRIOR]. AIHW is state-level by design. | Nothing cheap. State ÷ LGA framing only (§4 roadmap #8). **An LGA detention choropleth is not honest — do not build it.** |
| N2 | Indigenous over-representation per capita, sub-state | `abs_indigenous_population_by_lga` is **EMPTY** [CENSUS]. No denominator. | Roadmap #1. Highest value-to-effort in the whole document. |
| N3 | Board→contractor and board→donor links | `mv_board_contractor_links` = **4 rows**, `mv_board_donor_links` = **2**, `mv_multi_board_persons` = **1** [CENSUS] — against a 39,757-row interlock MV with the same columns. Broken join predicate, not a data gap. | Roadmap #2. Read the three definitions, repair, refresh. |
| N4 | Any dollar total from `gs_relationships WHERE dataset='justice_funding'` | 857,798 edges against a 157,116-row source table; ~700K edges (82%) point at source records that exist nowhere [PRIOR]. Drill-through 404s for 4 edges in 5. | Delete the orphan edges, or add a validity join. Until then, take justice dollars from `justice_funding` directly. |
| N5 | National LGA crime map | `crime_stats_lga`: NSW 51,480 rows / 99 LGAs / a decade; QLD 4,082 / 78 / one period; VIC 1,873; SA 617; NT 60; ACT 13. **WA and TAS = zero** [PRIOR]. | Roadmap #6. Until then a national map silently invents two states. |
| N6 | Foundation trustees on grantee boards, at scale | **[RAN]** 79,535 rows but only **195 trustees, 25 foundations**, and **27 trustees / 87 rows** where `trustee_on_grantee_board` is true. A wide cross-product off a tiny base. | Roadmap #4 — a join problem, not an acquisition problem. |
| N7 | Attribute a political donation to an entity | Only 24.8% of `political_donations` carry `donor_abn`; name-matching the remainder recovers ~31%. **~48% attributable overall** [PRIOR]. Plus the receipt_type contamination (§2.5). | Name normalisation + the AEC reform ingest (roadmap #5). |
| N8 | Anything at SA2 | `gs_entities.sa2_code` populated on **14.4%**; `postcode_geo` is not a complete SA2 register (DSS SA2 rows match only 59.17%) [PRIOR]. | Ingest ABS SA2 boundaries. Not currently in the database. |
| N9 | Media sentiment around program announcements | `alma_sentiment_program_correlation` is analytically the most interesting object in shard A and is built on **872 articles** [PRIOR]. | Deepen the existing schema against known entities before buying volume. |
| N10 | "Total funding" from `mv_entity_total_funding.grants_total` | **[RAN, suspicious]** summing `grants_total` across 5,359 interlock-linked orgs returned **< $5m**, while `grantconnect_awards` alone has $195.55bn linked. The column looks unpopulated. | Read the MV definition. Flagged, not diagnosed. |

---

## 2. SIX RUN FOR REAL

All output below is literal psql output from this session. Connection: `tednluwflfhxyucgwigh` via the pooler, 2026-08-14.

---

### 2.1 — Children in Queensland watchhouses tripled in under four months, and the growth is non-Indigenous children

```sql
SELECT date_trunc('month', source_generated_date)::date AS month, count(*) snaps,
 round(avg(total_children),1) avg_children, max(total_children) max_children,
 round(avg(child_first_nations),1) avg_fn, round(avg(child_non_indigenous),1) avg_nonind,
 round(avg(child_other_status),1) avg_other,
 round(avg(child_over_7_days),2) avg_child_over7d, max(child_longest_days) max_child_days,
 round(avg(child_watchhouse_count),1) avg_wh_holding_children
FROM qld_watchhouse_snapshots GROUP BY 1 ORDER BY 1;
```

```
month     |snaps|avg_children|max|avg_fn|avg_nonind|avg_other|avg_over7d|max_days|avg_wh
2026-04-01|    2|        13.0| 15|  10.5|       2.5|      0.0|      0.00|       5|   6.0
2026-05-01|   59|        14.2| 24|   9.9|       4.2|      0.0|      0.07|       7|   7.1
2026-06-01|   52|        24.8| 44|  15.5|       9.3|      0.1|      1.71|      12|  11.0
2026-07-01|   62|        28.6| 44|  15.8|      12.8|      0.0|      3.56|      14|  12.6
2026-08-01|   26|        38.8| 50|  14.6|      24.2|      0.0|      8.35|      14|  13.4
```

**The finding.** Average children held in QLD police watchhouses rose from **13.0 to 38.8** between late April and mid-August 2026 — a **3.0× increase in 15 weeks**. Peak single-day count: **50 children**. The number held **more than seven days** went from effectively zero (0.00) to **8.35 on an average day**. The longest any child was held rose from 5 days to **14**. The number of separate watchhouses holding children rose from 6 to 13.4.

**I checked whether the First Nations share decline was a data artefact. It is not.** `child_other_status` (unknown) is ~0 in every month, so the denominator is clean. First Nations child numbers rose modestly (10.5 → 14.6, +39%); **non-Indigenous child numbers rose 2.5 → 24.2, +868%.** The First Nations *share* fell from 80.8% to 37.6% because the non-Indigenous population grew nearly ten-fold, not because fewer Aboriginal children are being held. Both readings are true and the second one is the one that will get misreported if the first is published alone.

Facility level, children only:

```sql
SELECT watchhouse_name, count(*) obs, round(avg(total_in_custody),1) avg_children, max(total_in_custody) peak,
 sum(first_nations) fn_person_obs, sum(non_indigenous) nonind_person_obs,
 max(longest_days) max_days, sum(custody_over_7_days) over7d_obs
FROM qld_watchhouse_snapshot_rows WHERE age_group='Child'
GROUP BY 1 ORDER BY avg_children DESC LIMIT 8;
```

```
watchhouse_name             |obs|avg |peak|fn_obs|nonind_obs|max_days|over7d
Cairns Watch-house          |187| 5.1|  13|   897|        52|      14|    64
Brisbane Watch-house        |138| 3.7|  11|   121|       386|      11|    38
Townsville Watch-house      |175| 3.3|  11|   486|        98|      12|    37
Caloundra Watch-house       | 68| 2.7|   9|    31|       150|      12|    47
Ipswich District Watch-house|121| 2.6|   8|    79|       238|      12|    38
Southport Watch-house       |153| 2.3|   7|    94|       259|      12|    25
Richlands Watch-house       | 89| 2.3|   6|    18|       186|      14|    29
Caboolture Watch-house      |141| 2.1|   9|    32|       263|      11|    16
```

**Cairns holds the most children of any watchhouse in Queensland and its child population is 94.5% First Nations** (897 vs 52 person-observations). Brisbane is the inverse (121 vs 386). Murgon and Aurukun (further down the list) are 100% First Nations. That geographic split of who is held where is invisible in every published source.

**Caveats:** counts are person-observations per snapshot, not distinct children — the same child appears in every snapshot they are present for. April = 2 snapshots; August = 26 snapshots to the 13th. This is a **police custody** series, not detention; it is not comparable to AIHW detention figures without saying so.

---

### 2.2 — 41,614 organisations are governed by an interlocked director; only 12.9% have a money rollup

```sql
SELECT count(*) people_total,
 count(*) FILTER (WHERE board_count BETWEEN 2 AND 10) people_capped,
 count(*) FILTER (WHERE board_count > 10) people_over_cap, max(board_count) max_boards
FROM mv_board_interlocks;

WITH cap AS (SELECT unnest(entity_ids) AS eid FROM mv_board_interlocks WHERE board_count BETWEEN 2 AND 10),
     d AS (SELECT DISTINCT eid FROM cap)
SELECT (SELECT count(*) FROM cap) AS person_board_seats,
       (SELECT count(*) FROM d) AS distinct_orgs,
       count(f.entity_id) AS orgs_with_funding_rollup,
       round(sum(f.grand_total_funding)/1e9,2) AS total_bn,
       round(sum(f.contracts_total)/1e9,2) AS contracts_bn,
       round(sum(f.grants_total)/1e9,2) AS grants_bn,
       round(sum(f.justice_total)/1e6,1) AS justice_m
FROM d LEFT JOIN mv_entity_total_funding f ON f.entity_id = d.eid;
```

```
people_total|people_capped|people_over_cap|max_boards
       39757|        39139|            618|       745

person_board_seats|distinct_orgs|orgs_with_rollup|total_bn|contracts_bn|grants_bn|justice_m
            106138|        41614|            5359|   63.04|       47.41|     0.00|  15064.6
```

**The finding.** Within a defensible 2–10 board cap, **39,139 people hold 106,138 board seats across 41,614 distinct organisations**. The 5,359 of those organisations that have a computed funding rollup account for **$63.04bn**, of which $47.41bn is contracts and $15.06bn is justice funding.

**Three things this immediately exposes, all of which are more valuable than the dollar figure:**

1. **Only 5,359 of 41,614 organisations (12.9%) have a funding rollup at all.** `mv_entity_total_funding` reaches 15.4% of the spine [PRIOR]. The $63bn is a floor over an eighth of the set.
2. **`grants_total` summed to $0.00bn across 5,359 organisations** while `grantconnect_awards` alone holds $195.55bn linked to entities (§2.7). The column appears unpopulated. Logged as N10 — needs the MV definition read, not more querying.
3. **The cap is load-bearing and the data proves it:**

```sql
SELECT CASE WHEN board_count BETWEEN 2 AND 3 THEN '2-3' WHEN board_count BETWEEN 4 AND 5 THEN '4-5'
 WHEN board_count BETWEEN 6 AND 10 THEN '6-10' WHEN board_count BETWEEN 11 AND 20 THEN '11-20'
 ELSE '21+' END band, count(*) people, round(avg(total_procurement_dollars)/1e6,2) avg_proc_m
FROM mv_board_interlocks GROUP BY 1 ORDER BY 1;
```

```
band |people|avg_proc_m
2-3  | 32710|      3.62
4-5  |  4454|     13.68
6-10 |  1975|     25.48
11-20|   411|     61.59
21+  |   207|     48.67
```

**Average procurement dollars per "person" rises 17× from the 2–3 band to the 11–20 band.** That is not a discovery about powerful directors; it is name-collision hoovering up entities. The most attractive-looking rows are the least trustworthy ones. Any ranked "most connected directors" list sorted by money will be sorted by error.

---

### 2.3 — 85% of organisations receiving youth-justice grant money have no recorded evidence of what works

First, the contamination check that forced this number to be recomputed:

```sql
SELECT source, measure_kind, count(*) rows, round(sum(amount_dollars)/1e6,1) total_m
FROM justice_funding GROUP BY 1,2 ORDER BY 4 DESC NULLS LAST LIMIT 8;
```

```
source                 |measure_kind         | rows  |total_m
rogs-yj-expenditure    |expenditure_aggregate|    504|39677.3
rogs-2026              |expenditure_aggregate|    320|25544.8
qgip                   |grant                | 101709|20533.7
qld-historical-grants  |grant                |  12141|16131.5
nsw-facs-ngo-grants    |grant                |   5790| 3593.9
austender-direct       |contract_value       |   5250| 3098.2
foundation-notable-grants|grant              |   2034| 3096.1
qld_contract_disclosure|contract_value       |  23713| 2821.2
```

```sql
SELECT measure_kind, count(*) rows, round(sum(amount_dollars)/1e6,1) m
FROM justice_funding WHERE topics && ARRAY['youth-justice'] GROUP BY 1 ORDER BY 3 DESC;
```

```
measure_kind         |rows|      m
expenditure_aggregate| 848|66125.6
budget_announcement  |  57| 1583.1
grant                |4111| 1534.2
contract_value       | 564|  194.9
```

**`justice_funding` mixes three incompatible things in one `amount_dollars` column.** 848 rows of RoGS/AIHW **state budget aggregates** carry **$66.1bn** — 95.3% of the youth-justice topic's dollars — while the actual grants to actual organisations total **$1.53bn across 4,111 rows**. A naive `SUM` on the youth-justice topic overstates the money reaching organisations by **45×**. This is the single most dangerous number in the database.

The corrected cross-section:

```sql
WITH jf AS (SELECT gs_entity_id, sum(amount_dollars) amt, count(*) n FROM justice_funding
  WHERE measure_kind='grant' AND gs_entity_id IS NOT NULL AND topics && ARRAY['youth-justice'] GROUP BY 1)
SELECT (a.gs_entity_id IS NOT NULL) AS has_alma_evidence_record, count(*) orgs,
 round(sum(jf.amt)/1e6,1) grant_m, sum(jf.n) rows
FROM jf LEFT JOIN (SELECT DISTINCT gs_entity_id FROM alma_interventions WHERE gs_entity_id IS NOT NULL) a
 ON a.gs_entity_id=jf.gs_entity_id GROUP BY 1 ORDER BY 1;
```

```
has_alma_evidence_record|orgs|grant_m|rows
f                       | 662|  663.9|1746
t                       | 116|  478.2|2029
```

**Youth justice: 662 of 778 organisations (85.1%) receiving grant funding have no evidence record. They hold $663.9m of $1,142.1m (58.1%).**

Same query, `child-protection`:

```
has_alma_evidence_record|orgs|grant_m|rows
f                       |1623| 5419.3|4624
t                       |  99| 2439.2|2440
```

**Child protection: 1,623 of 1,722 organisations (94.3%) have no evidence record, holding $5.42bn of $7.86bn (69.0%).**

**Note the honest reading.** This measures *evidence recorded in ALMA*, not evidence that exists. ALMA holds 2,136 interventions [CENSUS] — it is a curated register, not a census of practice. So the finding is "the evidence base is not connected to the money", which is the true and useful claim, rather than "these organisations have no evidence", which would be a slur. The UI must say the first sentence.

---

### 2.4 — 773 justice-funded charities have 1.1 months of reserves

```sql
WITH latest AS (SELECT DISTINCT ON (abn) * FROM mv_justice_charity_financial_health ORDER BY abn, ais_year DESC)
SELECT fragility_tier, count(*) charities, round(avg(govt_revenue_share)::numeric,3) avg_govt_rev_share,
 count(*) FILTER (WHERE is_deficit) in_deficit, count(*) FILTER (WHERE low_reserves) low_reserves,
 count(*) FILTER (WHERE high_govt_dependency) high_govt_dep,
 round(avg(months_of_reserves)::numeric,1) avg_months_reserves
FROM latest GROUP BY 1 ORDER BY 2 DESC;
```

```
fragility_tier|charities|avg_govt_rev_share|in_deficit|low_reserves|high_govt_dep|avg_months
healthy       |     3124|             0.416|         0|           0|          789|     156.4
watch         |     1776|             0.415|      1460|         295|          462|    1956.1
fragile       |      773|             0.447|       530|         634|          253|       1.1
unknown       |      225|                  |        14|           3|            0|     436.4
```

**The finding.** Of 5,898 charities with justice-related government funding and an AIS record, **773 are financially fragile: 530 are running a deficit, 634 have low reserves, and the tier averages 1.1 months of operating reserves.** A further 1,776 are on "watch", 1,460 of them in deficit. Government revenue is ~42–45% of income across every tier, so dependence is not what separates fragile from healthy — **liquidity is**.

**This is the buyer-wedge question answered.** A commissioner choosing between providers can see, before signing, that a bidder has five weeks of cash. No public source offers this; ACNC publishes the AIS and AusTender publishes the contract, and the join has never been made.

**Caveat found in the same output:** the `watch` tier's mean months-of-reserves is **1,956** — obvious outlier contamination (a charity with near-zero expenses and any assets produces an enormous ratio). **Use the median.** The `fragile` tier's 1.1 is credible precisely because the tier is defined by low reserves.

---

### 2.5 — The donor↔contractor crossover is real, and both its columns are currently wrong

```sql
SELECT count(*) entities, round(sum(total_donated)/1e6,1) donated_m,
 round(sum(total_contract_value)/1e9,2) contracts_bn FROM mv_donor_contract_crossref;
```

```
entities|  donated_m|contracts_bn
    2175|   713456.3|      451.64
```

$713,456m of "donations" is $713bn — which is not plausible for Australian political donations by three orders of magnitude. Two separate defects, both isolated:

```sql
SELECT receipt_type, count(*) rows, round(sum(amount)/1e6,1) total_m
FROM political_donations GROUP BY 1 ORDER BY 3 DESC NULLS LAST;
```

```
receipt_type      |   rows |  total_m
other receipt     |1838739|186724.0
donation received | 506739| 22971.5
public funding    |   6595|  3465.1
subscription      |  37717|  2209.8
unspecified       |  90404|  2011.6
(blank)           |  69289|  1505.2
```

**Defect 1: 72.1% of rows and 88.6% of dollars in `political_donations` are `other receipt` — not donations.** Every figure this project has ever published from `SUM(political_donations.amount)` is inflated roughly 8×.

```sql
SELECT count(*) rows, round(sum(contract_value)/1e6,1) total_m, round(max(contract_value)/1e6,1) max_m
FROM austender_contracts WHERE supplier_name ILIKE 'Gilbert %Tobin%';

SELECT supplier_name, buyer_name, round(contract_value/1e6,1) value_m, contract_start
FROM austender_contracts WHERE supplier_name ILIKE 'Gilbert %Tobin%' ORDER BY contract_value DESC LIMIT 3;
```

```
rows|  total_m|   max_m
  90| 121194.6|121149.1

supplier_name    |buyer_name                  | value_m|contract_start
Gilbert and Tobin|Department of the Treasury  |121149.1|2018-06-03
Gilbert & Tobin  |Attorney-General's Department|   13.3|2018-12-13
Gilbert & Tobin  |Attorney-General's Department|    9.5|2016-11-16
```

**Defect 2: one AusTender row records a $121.1 billion contract to a law firm.** It is 99.96% of that supplier's recorded total, larger than the entire annual Defence budget, and it made Gilbert + Tobin the #1 "donor-contractor" in the crossref MV. Scale of the problem:

```sql
SELECT count(*) FILTER (WHERE contract_value >= 1e9) ge_1bn,
       count(*) FILTER (WHERE contract_value >= 5e9) ge_5bn,
       count(*) FILTER (WHERE contract_value >= 2e10) ge_20bn,
       round(max(contract_value)/1e9,1) max_bn, round(sum(contract_value)/1e9,1) all_bn,
       round(sum(contract_value) FILTER (WHERE contract_value >= 5e9)/1e9,1) bn_from_ge5bn_rows
FROM austender_contracts;
```

```
ge_1bn|ge_5bn|ge_20bn|max_bn| all_bn|bn_from_ge5bn_rows
   115|    13|      3| 123.0| 1266.0|             372.5
```

**29.4% of all recorded Commonwealth contract value ($372.5bn of $1,266.0bn) sits in 13 rows**, three of which exceed $20bn and at least one of which is demonstrably wrong. **No total contract value should ever be published from this table without an outlier sentinel** (gaps-view metric G7, §5).

The underlying cross-section is still the most publishable thing here — with `receipt_type = 'donation received'` and a value ceiling, it becomes defensible. Without them it is a lawsuit.

---

### 2.6 — The most disadvantaged places in Australia with no recorded money

```sql
SELECT count(*) rows, count(DISTINCT lga_name) d_name,
       count(DISTINCT (lga_name||'|'||state)) d_name_state FROM mv_funding_deserts;
```
```
rows|d_name|d_name_state
1997|   551|         717
```

```sql
SELECT lga_name, state, round(avg(avg_irsd_decile),1) irsd, sum(indexed_entities) orgs,
 sum(community_controlled_entities) cc_orgs, round(sum(total_dollar_flow)/1e6,1) dollars_m,
 round(max(desert_score),1) desert_score
FROM mv_funding_deserts WHERE avg_irsd_decile <= 2 AND indexed_entities > 0
GROUP BY 1,2 ORDER BY sum(total_dollar_flow) ASC NULLS FIRST, sum(indexed_entities) DESC LIMIT 12;
```

```
lga_name                             |state|irsd|orgs|cc_orgs|dollars_m|desert
Orroroo Carrieton                    |SA   | 1.0|   7|      0|      0.0| 160.0
Pingelly                             |WA   | 2.0|   6|      0|      0.0| 165.0
West Daly                            |NT   | 1.0|   5|      4|      0.0| 155.0
Coolgardie                           |WA   | 1.2|  17|      4|      0.0| 172.7
Mount Magnet                         |WA   | 1.0|   3|      1|      0.1| 185.0
Southern Mallee                      |SA   | 2.0|   9|      0|      0.1| 155.0
Kowanyama                            |QLD  | 1.0|   2|      1|      0.2| 185.0
Anangu Pitjantjatjara Yankunytjatjara|SA   | 1.0|   8|      8|      0.2| 140.0
Cue                                  |WA   | 1.0|   2|      0|      0.2| 170.0
Coober Pedy                          |SA   | 1.0|  11|      6|      0.3| 185.0
Glamorgan-Spring Bay                 |TAS  | 2.0|  12|      0|      0.3| 140.0
Dundas                               |WA   | 1.0|   6|      2|      0.4| 170.0
```

**The finding.** Australia's most disadvantaged LGAs (SEIFA IRSD decile 1–2) with recorded organisations but essentially zero recorded dollar flow. **West Daly (NT)** has 5 indexed organisations, 4 of them community-controlled, and **$0.0m** of recorded money. **APY Lands (SA)** has 8 organisations, **all 8 community-controlled**, and $0.2m. **Kowanyama (QLD)** — 2 organisations, $0.2m.

**Grain hazard, verified:** `mv_funding_deserts` is **1,997 rows over 551 LGA names and 717 name|state pairs** — roughly 2.8 rows per LGA. Any "top desert LGAs" list that does not `GROUP BY lga_name, state` will report the same place several times with different numbers.

**The caveat that must be on the same screen.** Remote NT/WA/SA communities are frequently funded through regional and land councils, whose registered address credits the hub rather than the community [PRIOR, MEMORY]. So "$0 recorded" is a statement about *where money becomes visible*, not necessarily where it lands. That is still a finding — it is the strongest available evidence that remote funding is structurally illegible — but it must be framed as such or it is simply wrong.

---

### 2.7 — $11.83 billion of Commonwealth grants goes to organisations the graph has never created

```sql
SELECT gs_entity_id IS NULL AS unlinked, count(*) awards, count(DISTINCT recipient_abn) distinct_abns,
 round(sum(value_aud)/1e9,2) value_bn
FROM grantconnect_awards WHERE recipient_abn IS NOT NULL AND length(recipient_abn)=11
GROUP BY 1 ORDER BY 1;
```

```
unlinked|awards |distinct_abns|value_bn
f       |210761 |        37562|  195.55
t       | 68175 |        30129|   11.83
```

**The finding.** **68,175 GrantConnect awards worth $11.83bn** point at **30,129 distinct, valid-length ABNs** that have no entity in `gs_entities`. That is 24.4% of award rows and 5.7% of award dollars invisible to every entity-level view in the product. The prior join-spine work measured that **99.97% of GrantConnect recipient ABNs exist in `abr_registry`** [PRIOR] — so these are real Australian organisations, not bad data. They can be created from `abr_registry` in one bulk insert.

Note the shape: 30,129 unlinked ABNs against 37,562 linked ones means the unlinked set is **long-tail** — many small recipients, few awards each ($174k average vs $928k for linked). These are exactly the small community organisations the mission is about.

---

### 2.8 — Four in five charities that serve people leaving prison have no money recorded at all

```sql
SELECT count(*) FILTER (WHERE ben_pre_post_release) pre_post_release,
       count(*) FILTER (WHERE ben_youth) youth, count(*) FILTER (WHERE ben_aboriginal_tsi) atsi,
       count(*) FILTER (WHERE ben_victims_of_crime) victims,
       count(*) FILTER (WHERE ben_pre_post_release AND ben_aboriginal_tsi) both
FROM acnc_charities;

WITH c AS (SELECT abn FROM acnc_charities WHERE ben_pre_post_release)
SELECT count(DISTINCT c.abn) charities, count(DISTINCT f.entity_id) with_funding_rollup,
 round(sum(f.grand_total_funding)/1e6,1) total_m, round(sum(f.contracts_total)/1e6,1) contracts_m,
 round(sum(f.justice_total)/1e6,1) justice_m
FROM c LEFT JOIN gs_entities e ON e.abn=c.abn LEFT JOIN mv_entity_total_funding f ON f.entity_id=e.id;
```

```
pre_post_release|youth|atsi |victims|both
            4629|29297|16551|   6750|4065
charities|with_funding_rollup|total_m|contracts_m|justice_m
     4629|                862|15154.2|     9011.1|    6129.5
```

**The finding.** **4,629 Australian charities self-declare that they serve people before or after release from prison. 4,065 of them (87.8%) also declare Aboriginal and Torres Strait Islander beneficiaries.** Only **862 (18.6%)** appear in the funding rollup at all; those 862 hold $15.15bn.

**Why this is a cross-section nobody does:** ACNC publishes 30+ boolean beneficiary flags in its bulk Register file. They are the cheapest, most complete sector taxonomy in Australia and nobody joins them to money. `ben_pre_post_release`, `ben_victims_of_crime`, `ben_people_at_risk_of_homelessness` and `ben_aboriginal_tsi` are all free, national, and unused.

**Caveat:** "no funding rollup" is a compound of *no money* and *rollup coverage* (`mv_entity_total_funding` reaches 15.4% of the spine). The honest headline is the coverage fact, and the fix is roadmap-adjacent: widening the rollup would convert this from a gap metric into a funding finding.

---

### 2.9 — Nearly a quarter of foundation grantees also hold Commonwealth contracts

```sql
WITH g AS (SELECT DISTINCT grantee_abn abn FROM foundation_grantees WHERE grantee_abn IS NOT NULL)
SELECT count(*) grantees_with_abn, count(*) FILTER (WHERE ac.n IS NOT NULL) also_hold_fed_contracts,
 round(sum(ac.v)/1e6,1) their_contract_m
FROM g LEFT JOIN (SELECT supplier_abn abn, count(*) n, sum(contract_value) v
                  FROM austender_contracts WHERE supplier_abn IS NOT NULL GROUP BY 1) ac USING (abn);
```

```
grantees_with_abn|also_hold_fed_contracts|their_contract_m
             4167|                    949|         25435.9
```

**The finding.** Of 4,167 organisations receiving grants from Australian charitable foundations, **949 (22.8%) also hold Commonwealth government contracts**, worth $25.4bn on the contract side. Philanthropy and procurement are funding the same organisations and neither sector can see the other.

**Caveat:** apply the §2.5 outlier sentinel before publishing the dollar figure — I did not check whether any of the 13 mega-rows fall in this set.

### 2.10 — Two supporting measurements used throughout

```sql
SELECT count(*) entities, count(*) FILTER (WHERE entity_type<>'person') non_person,
 count(*) FILTER (WHERE lga_code IS NOT NULL) with_lga,
 count(*) FILTER (WHERE lga_code IS NULL AND postcode IS NOT NULL) pc_no_lga,
 count(*) FILTER (WHERE postcode IS NULL) no_postcode,
 count(*) FILTER (WHERE abn IS NOT NULL) with_abn FROM gs_entities;
```
```
entities|non_person|with_lga|pc_no_lga|no_postcode|with_abn
  609448|    368606|  294214|    34223|     282171|  351455
```

```sql
SELECT count(DISTINCT mv_name) FROM mv_refresh_log;   -- 44
SELECT mv_name, max(started_at)::date FROM mv_refresh_log GROUP BY 1 ORDER BY 2 DESC LIMIT 3;
-- mv_donor_contract_crossref | 2026-08-13 ; mv_funding_deserts | 2026-08-13 ; mv_entity_power_index | 2026-08-13
```

**Only 44 of 98 materialized views have ever appeared in the refresh log.** The logged ones are fresh (refreshed yesterday). The other 54 have no observable refresh path — including, per the shard research, the corrected `mv_person_identity_influence_v2` while the superseded v1 refreshes nightly [PRIOR].

---

## 3. THE DIRECTOR-LINKS DOSSIER

### 3.1 What exists

| Object | Rows | What it is | Measured quality |
|---|---:|---|---|
| `person_roles` | 339,698 | The base fact: person × organisation × role | **334,152 from `acnc_register`** (director 87,234 / other 68,418 / officeholder 55,501 / board_member 50,346 / secretary 30,037 / chair 25,436 / trustee 9,591 / public_officer 7,589); 4,522 `foundation_board`; 582 parliamentary; **ZERO from ASIC** [PRIOR]. **338,999 (99.8%) carry a resolved `entity_id`.** |
| `person_identities` | 230,434 | Identity clustering verdict, one per `role_id` | Covers **67.8%** of `person_roles` [PRIOR]. **[RAN]** quality split below. |
| `mv_board_interlocks` | 39,757 | People on 2+ boards, with money attached | **[RAN]** 39,139 within a 2–10 cap; 618 above it; max 745 |
| `gs_relationships` | — | The governance edges | `directorship` **440,128** · `shared_director` **95,476** · `member_of` 221,563 [PRIOR] |
| `mv_person_identity_influence_v2` | 241,260 | Per-director **attributed** money (not affiliated totals) | Carries `attributed_procurement/justice/donations` + `is_nominee_block` + `acco_boards`. **Not on any refresh schedule; v1 is** [PRIOR] |
| `mv_board_contractor_links` / `_donor_links` / `mv_multi_board_persons` | **4 / 2 / 1** | Named for exactly the flagship cross-sections | **Broken.** [CENSUS] |

### 3.2 Measured quality of the identity layer [RAN]

```sql
SELECT is_nominee_block, confidence, count(*) role_rows, count(DISTINCT identity_key) identities
FROM person_identities GROUP BY 1,2 ORDER BY 3 DESC;
```
```
is_nominee_block|confidence|role_rows|identities
f               |high      |   202541|    197724
t               |high      |    19403|       142
f               |medium    |     4613|       627
f               |low       |     3877|      3789
```

**Read this carefully. 19,403 role rows collapse into just 142 identity keys.** That is an average of **137 roles per nominee block** — "Mark Smith" with 689 boards is not an outlier, it is the design of the trap. 8.4% of clustered roles are in 142 name-blocks that must never be shown as people.

The good news: **202,541 roles (87.9% of the clustered set) are high-confidence, non-nominee, resolving to 197,724 distinct identities** — an average of 1.02 roles per identity, which is what a healthy clustering looks like.

### 3.3 The three hard limits

1. **The 17.5% ceiling.** 64,139 distinct companies have any board data, out of ~368,606 non-person entities [PRIOR + RAN]. **Absence of directors in this database is not absence of governance**, and a UI that does not say so will be read as an accusation.
2. **The name-key generation gap.** All six `mv_person_*` matviews still group on `person_name_normalised`, not `identity_key` [PRIOR]. The identity clustering exists and the analytics layer does not use it.
3. **`MAX_PLAUSIBLE_BOARDS` STAYS.** Project memory carries a standing instruction not to remove the cap, and §2.2 is the empirical proof of why: average procurement dollars per person rise **17×** from the 2–3 board band to the 11–20 band. Removing the cap does not reveal more powerful directors; it promotes name collisions to the top of every ranking. **Do not remove it. Do not raise it "just for this view".**

### 3.4 The concrete next step

**One step, in this order, and only this order:**

1. **Read the three broken MV definitions** (`mv_board_contractor_links` 4 rows, `mv_board_donor_links` 2, `mv_multi_board_persons` 1) against `mv_board_interlocks` (39,757). Same columns, 10,000× the rows. This is a predicate bug, and repairing it restores two flagship cross-sections for a day's work. **Nothing else on this list beats it.**
2. **Re-key the person MVs onto `identity_key`** and retire the superseded generation. Schedule `_v2`; unschedule v1.
3. **Add a display gate, not just an internal filter.** Every public person surface must render `is_nominee_block` and `confidence` as a visible tier. A person with `confidence='low'` (3,877 roles) or in a nominee block (19,403 roles) must be shown as a *name block*, never as a person.
4. **Then** widen: date and version the ACNC responsible-persons scrape so board *changes* become visible (`watch-board-changes.mjs` exists), and join `foundations` (11,159) to the responsible-persons rows already present to widen §2/N6 beyond 195 trustees.
5. **Write the licence basis down before any of this is public.** 334K responsible-person rows were scraped from ACNC Register pages [PRIOR]. Register content is CC BY 3.0 AU (attribution supports reuse), but the content is named individuals and ACNC operates a withholding regime. A stated licence basis and a takedown policy are prerequisites, not follow-ups.

---

## 4. THE NET-WIDENING ROADMAP

Refined against what the inventory actually shows. **Effort:** S = a day, M = a week, L = a month+. The strategy note in `docs/strategy/buyer-wedge.md` pauses data widening in favour of evidence depth — items 1–4 and 9 respect that (they are repair/join work on data already held); items 5–8 and 10 are genuine widening and are ranked behind, with one exception noted.

| # | What | Cross-section unlocked | Effort | Licence risk | Joins to (by key) |
|---|---|---|---|---|---|
| **1** | **Repair the 3 broken board MVs + re-key the person MVs to `identity_key`** | Restores board→contractor and board→donor (currently 4 and 2 rows against a 39,757-row interlock MV). Also retires ~1.4M rows of duplicated person matviews. | **S** | none | internal — `mv_board_interlocks` ↔ `person_identities.identity_key` |
| **2** | **ABS Indigenous population by LGA/SA2 (ERP + Census)** | Fills the empty `abs_indigenous_population_by_lga`. **Every per-capita and over-representation rate below state level.** Without it no Indigenous-focused map here is honest. | **S** | CC BY 4.0, clean | `postcode_geo.lga_code` / `sa2_code` |
| **3** | **Backfill 30,129 GrantConnect ABNs from `abr_registry`** | **[RAN]** Brings $11.83bn / 68,175 awards onto the spine. Lifts `grantconnect_awards` stamp rate from 72.4% toward ~96%. Long-tail small recipients — the mission population. | **S** | ABR is public | `recipient_abn` → `abr_registry.abn` → new `gs_entities` rows |
| **4** | **Watchhouse series: provenance, continuity, public page** | **[RAN §2.1]** Turns the single most distinctive asset in the database into a citable public time series. Facility × day × First Nations × custody duration. Nothing in Australia competes. | **S–M** | public data; document source URL + retention | self-contained; optionally `youth_detention_facilities` (21) by facility name |
| **5** | **Two data-integrity sentinels: `receipt_type` filter + contract-value ceiling** | **[RAN §2.5]** Makes the donor↔contractor cross-section publishable instead of litigable. Fixes an 8× overstatement of donations and a 29.4%-of-total outlier exposure. | **S** | none | internal — `political_donations.receipt_type`, `austender_contracts.contract_value` |
| **6** | **Foundation trustee join at scale** | **[RAN §D5]** Widens `mv_trustee_grantee_chain` from **195 trustees / 25 foundations / 27 actual overlaps** to potentially thousands, using responsible-persons rows already in `person_roles`. A join problem, not an acquisition. | **M** | CC BY 3.0 AU (ACNC), attribute | `foundations.acnc_abn` → `person_roles.company_abn` |
| **7** | **AEC post-reform disclosures** | From 1 Jul 2026: threshold $5,000, calendar-year periods, 24-hour disclosure in election periods [PRIOR]. Donation volume and cadence step-change; near-real-time donor→contract analysis. **The only widening item with a deadline.** | **M**, time-critical | public, open | `donor_abn` → `gs_entities.abn`; name path for the ~75% without |
| **8** | **BOCSAR + WA + TAS crime data** | Fills the empty `bocsar_youth_offending` and closes the two-state hole. Makes a **national** LGA crime × funding map possible for the first time — today's map silently invents WA and TAS. | **M** | mostly open; WA/TAS need checking | `crime_stats_lga.lga_name` → `postcode_geo.lga_name` (91.65% match) |
| **9** | **Widen `mv_entity_total_funding` coverage + fix `grants_total`** | **[RAN §2.2/2.8]** The rollup reaches 15.4% of the spine, and `grants_total` summed to ~$0 across 5,359 orgs. Fixing it converts three gap metrics into funding findings (Q2, Q8, Q14). | **M** | none | internal — `mv_entity_total_funding.entity_id` |
| **10** | **ASIC officeholders under a data licence** | The structural change: charity-governance graph → **whole-economy** governance graph. The only route to for-profit directors behind government suppliers. Ingest script `scripts/ingest-asic-directors.mjs --officeholders` already written and never fed [PRIOR]. | **L** + cost | **licensed, redistribution restricted** | `acn` → `asic_companies.acn`; `abn` → `gs_entities.abn` |

**Explicitly not recommended** (carried forward from the gaps research, unchanged): LinkedIn-style scraping — and check the provenance of the existing `linkedin_contacts` (13,810 rows) before it touches any public surface; ORIC bulk requests (ORIC has published its refusal; Indigenous data governance applies); commercial ASIC resellers (same restriction, higher cost); buying a media corpus before deepening the existing 872-article schema.

**Ministerial diaries at scale** and **national state-grants normalisation** remain the two big-prize L-effort items behind a lighthouse buyer. Neither is blocked; both are expensive.

---

## 5. THE "GAPS" VIEW SPEC

**Design premise, from the dashboard research:** absence must be an **affirmative glyph that is also the affordance to fix it** — Monte Carlo's `+` symbol for "no monitor deployed", where a vertical run of `+` is a hole visible from two metres. Blank space reads as "loading" or "fine". It must never be either.

**Palette semantics** (the Bauhaus set has no green, which is an accidental accessibility win — red/yellow/blue avoids the deuteranopia failure):
- **RED `#D02020` — the data is wrong or absent.** Empty table, contaminated column, outlier above the plausibility ceiling, state with no rows.
- **BLUE `#1040C0` — our metadata is missing.** No owner, no description, no refresh path, no domain. *Not the same thing*, and conflating them is what makes catalogs feel accusatory and get ignored.
- **YELLOW `#F0C020` — deliberate refusal.** A null that is a decision, not a gap. Non-negotiable for `lga_source`: 34,223 entities have a postcode and no LGA **because the rebuild refused to be confidently wrong** [RAN §2.10]. Painting those red would be a lie about our own data.

**Architecture:** one `data_inventory` snapshot table, refreshed nightly, never live queries against `gs_entities` / `abr_registry` on page load. Server-render the full ~812-row payload; one client island filters in memory. At 812 objects this is trivially under Shneiderman's 100ms dynamic-query target.

---

### G1 — Spine attachment rate

- **What:** for each source object, the share of rows that reach `gs_entities` by any mechanism (uuid stamp, ABN equality, name equality).
- **Compute:** nightly per object — `count(*) FILTER (WHERE gs_entity_id IS NOT NULL) / count(*)`, falling back to an ABN existence test where there is no stamp column. Store the *mechanism* alongside the rate.
- **Known values [PRIOR]:** ndis_registered_providers 100% · organizations 99.72% · justice_funding 93.65% · state_tenders 81.71% · grantconnect_awards 72.36% · community_directory_orgs **9.78%** · nz_charities **0.00%**.
- **Look:** a right-aligned percentage with an inline bar in the ledger row, plus a **`+` glyph in the coverage matrix when the rate is 0** — `nz_charities` has a declared FK to `gs_entities` and not one populated row, which is exactly the case a blank cell would hide.

### G2 — Unattached dollars

- **What:** money that exists in the database but cannot be attributed to an organisation.
- **Compute:** `SUM(value) WHERE <link column> IS NULL`, per money table, per reason code.
- **Known values [RAN]:** GrantConnect **$11.83bn / 68,175 awards / 30,129 ABNs**. Political donations ~52% of rows unattributable [PRIOR].
- **Look:** **a permanent "unplaced $" bar beside every money chart**, split by reason code and **clickable to filter the chart to the unplaced set**. This is the single thing that would most distinguish these views from every government dashboard, and the LGA rebuild already reason-codes every unplaced row.

### G3 — Place-resolution ladder, with refusals separated from gaps

- **What:** what share of entities are resolvable at each geography, and why the rest are not.
- **Compute [RAN §2.10]:** 609,448 total · 294,214 with LGA (48.3%) · **34,223 postcode-but-no-LGA (deliberate refusal)** · 282,171 no postcode at all · sa2 14.4% [PRIOR].
- **Look:** one stacked bar with **three** segments, not two: RESOLVED (blue-black) / REFUSED (yellow, with the `lga_source` reason on hover) / MISSING (red). Legend text: *"Yellow means we know where it isn't. That is not the same as not knowing."*

### G4 — Honest-at geography, per claim

- **What:** the coarsest grain at which a claim survives its own caveat — the existing `atlas/layers.ts` concept, generalised.
- **Compute:** declared in a typed registry, guarded by a test, not computed. A layer without an `honestAt` value **must not compile** (the Atlas registry already enforces exactly this for caveats).
- **Known values:** youth detention → **STATE** (13 rows, PDF headline scrape). Child protection → **STATE**. NDIS districts → **STATE** (`lga_code` 100% NULL). Crime → **LGA, six jurisdictions only**. Money/orgs → **ENTITY**.
- **Look:** a mono chip in the corner of every chart — `HONEST AT: STATE`. It reads as precision, not apology, and it makes the N1 mistake (an LGA detention choropleth) structurally impossible to ship.

### G5 — Freshness, with a third state for "unmonitored"

- **What:** when each object was last refreshed, and whether anything watches it.
- **Compute [RAN]:** `max(started_at)` per `mv_name` from `mv_refresh_log` — but **only 44 of 98 matviews have ever appeared in it**. The other 54 need a distinct state.
- **Look:** three badges, not two. **FRESH** (dated) · **STALE** (dated, past SLA, red) · **UNMONITORED** (blue, no date — *"we do not know"*). Do not render unmonitored as stale; they are different failures and the fixes differ. This is also how the `mv_person_identity_influence_v2` problem surfaces on its own: the corrected view shows UNMONITORED while the superseded one shows FRESH.

### G6 — Evidence coverage, by topic

- **What:** share of funded organisations with a recorded evidence link.
- **Compute [RAN §2.3]:** per topic, `count(DISTINCT gs_entity_id)` in `justice_funding` (`measure_kind='grant'`) with vs without a match in `alma_interventions`.
- **Known values:** youth-justice **14.9% covered** (116 of 778) · child-protection **5.7%** (99 of 1,722).
- **Look:** a coverage-matrix row per topic, and — critically — **label it "evidence linked", never "has evidence"**. The first is a fact about this database; the second is a claim about an organisation.

### G7 — Outlier sentinel

- **What:** rows whose value exceeds a plausibility ceiling, and what share of the total they carry.
- **Compute [RAN §2.5]:** per money table — `count(*)` and `sum(value)` above a fixed ceiling (start: $5bn for a single Commonwealth contract). Current state: **13 rows carry $372.5bn = 29.4% of all recorded contract value**; max $123.0bn; one verified-implausible $121.1bn row.
- **Look:** a red flag **in the header of any total that includes flagged rows**, printing the count and the share — `⚑ 13 rows (29.4%) above plausibility ceiling`. Clicking lists them for adjudication. Once adjudicated, an object-level exclusion, so the fix is permanent and auditable.

### G8 — Jurisdictional completeness

- **What:** which states and territories actually have rows in each place-keyed dataset.
- **Compute:** `count(DISTINCT state)` and per-state row counts, per place-keyed object.
- **Known values [PRIOR]:** `crime_stats_lga` — NSW 51,480 / QLD 4,082 / VIC 1,873 / SA 617 / NT 60 / ACT 13 / **WA 0 / TAS 0**.
- **Look:** an **eight-cell state strip** per dataset (NSW VIC QLD WA SA TAS ACT NT). Empty cells get the `+` glyph and link straight to the acquisition backlog item. This is the cheapest possible guard against the N5 failure of silently inventing two states, and it is legible at a glance from across a room.

**Two rules that govern all eight.** Every metric must be **derivable by a scheduled job with zero human input** — description and owner are enrichment shown as a completeness *metric*, never as blanks that make the page look broken. And every CRUFT/deprecation flag requires a **written reason** (Alation's rule): 14 backup-named objects carrying ~1.52M rows [PRIOR] should be flagged red with reasons **on first render**, not discovered later.

---

## 6. CONFIDENCE REGISTER

**Verified by direct query this session (7 batched psql sessions, ~30 statements, all targeted/LIMITed):** every number in §2 and every figure marked [RAN]. Specifically — QLD watchhouse monthly aggregates, child status raw counts, and the 15-facility child ranking; `mv_board_interlocks` cap distribution, board-count bands, and the deduplicated entity/funding rollup; `justice_funding` composition by source × measure_kind and by topic × measure_kind; the corrected youth-justice and child-protection evidence gaps; `mv_justice_charity_financial_health` fragility tiers on latest AIS year per ABN; `political_donations` receipt_type composition; the Gilbert + Tobin contract rows and the AusTender outlier bands; `mv_funding_deserts` grain and the disadvantage/low-flow ranking; the GrantConnect linked/unlinked split; ACNC beneficiary-flag counts and their funding rollup; foundation-grantee ↔ AusTender overlap; `mv_trustee_grantee_chain` distinct trustees/foundations; `person_identities` quality split; `gs_entities` place/ABN coverage; `mv_refresh_log` distinct objects and latest dates; the 714/98 object census. Matview column lists were pulled from `pg_attribute` (matviews are absent from `columns.csv`).

**Verified from supplied files, not re-queried:** all row counts from `census.csv`; all table column lists from `columns.csv`; join coverage rates cited as [PRIOR] from `join-spine.md` §4; competitive/source claims and licence positions from `research-gaps-competitive.md`, which cites its web sources inline.

**Inferred, not confirmed:** that the $121.1bn Gilbert and Tobin row is a units or data-entry error (I verified it is 99.96% of that supplier's total and larger than the annual Defence budget; I did not check AusTender's published notice). That `mv_entity_total_funding.grants_total` is unpopulated rather than correctly near-zero (N10) — I observed <$5m across 5,359 orgs against $195.55bn of linked GrantConnect value, but did not read the MV definition. That the three broken board MVs have a predicate bug rather than a deliberately narrow definition — I have the row counts and matching column names, not the SQL.

**Not checked at all:** RLS or grants on any object, so no claim here describes current exposure. Whether the 54 unlogged matviews are refreshed by pg_cron or an edge function — "absent from `mv_refresh_log` and absent from the refresh scripts" is strong evidence, not proof. Whether any of the 13 AusTender mega-rows fall inside the §2.9 foundation-grantee set. Whether `mv_donor_contract_crossref` also inherits the `receipt_type` problem on its `donation_count` column (I verified the dollar column only). The provenance and lawful basis of `linkedin_contacts` (13,810 rows) — flagged in the prior research and still unexamined.

**Method caveat on §2.2 and §2.8:** both use `mv_entity_total_funding` as the money source, which reaches 15.4% of the spine. Their dollar figures are floors over a small, non-random subset (organisations large enough to have been rolled up), and both should be read as coverage findings first and money findings second. That is stated inline in each.
