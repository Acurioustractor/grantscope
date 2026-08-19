# What "bankable" means, measurably, from data we already hold

Issue #308, part of map #303. Date: 2026-08-19.
All figures below are **Verified** unless labelled otherwise — each was produced by a `SELECT`
run against Supabase `tednluwflfhxyucgwigh` via `scripts/gsql.mjs` on 2026-08-19. Queries are
inlined so they can be re-run.

**No score is built here.** The output is a signal inventory with coverage and reliability, plus
the empirical difference between two populations.

---

## 1. The two populations

Cohorts, defined over `gs_entities WHERE is_community_controlled = true AND abn IS NOT NULL`
(9,167 of 12,479 community-controlled orgs carry an ABN — **the other 3,312 cannot be joined to
any money at all**, which is itself the first coverage finding):

| cohort | definition | n |
|---|---|---|
| **contract** | ABN appears in `austender_contracts.supplier_abn` | **1,048** |
| **grant_only** | receives `justice_funding` (grant filters) or `grantconnect_awards`, no contract | **1,448** |
| **neither** | in neither | **6,671** |

Money: contracts $5.433bn · justice grants $1.618bn (661 orgs) · GrantConnect $22.973bn
(1,758 orgs). This reproduces the ticket's $5.43bn / ~$1.65bn framing. Verified.

`justice_funding` figures carry the three mandatory filters from CLAUDE.md
(`measure_kind='grant' AND is_aggregate IS NOT TRUE`).

### The first correction to the ticket's framing

**Contract-holders are not grant-holders who graduated.** Of the 1,048 contract-holders,
**541 (52%) have never received a recorded grant** and 507 hold both. Verified.

So the gap is not one population maturing into another. It is substantially two different
populations that both satisfy `is_community_controlled`.

---

## 2. What contract-holders have that grant-only ones do not

### 2a. Scale, by a factor of five

Latest ACNC AIS per ABN, `ais_year >= 2021`:

| cohort | n | has AIS | median total revenue | median total assets | median net assets | median FTE | median current ratio | earned-income share | govt-revenue share |
|---|---|---|---|---|---|---|---|---|---|
| contract | 1,048 | 168 (16.0%) | **$4,092,000** | $5,498,440 | $2,693,946 | **18.0** | 1.90 | 0.129 | 0.701 |
| grant_only | 1,448 | 265 (18.3%) | $808,587 | $2,991,626 | $1,962,354 | 3.0 | 2.17 | 0.090 | 0.720 |
| neither | 6,671 | 217 (3.3%) | $110,998 | $288,653 | $179,076 | 0.0 | 4.72 | 0.000 | 0.000 |

**Revenue 5.1x. Paid staff 6x.** Assets and net assets differ by less than 2x. The separation is
in *throughput and payroll*, not in balance sheet.

### 2b. Reserves are NOT the differentiator — they run the wrong way

Months of reserves = `12 * net_assets_liabilities / total_expenses`, median of latest AIS:

| cohort | n with AIS | median months of reserves | negative equity | median volunteers |
|---|---|---|---|---|
| contract | 168 | **7.8** | 8 | 0 |
| grant_only | 265 | **17.9** | 8 | 3 |
| neither | 217 | 30.9 | 10 | 2 |

Contract-holders hold **less than half** the reserve cover of grant-only orgs. This is the single
most counter-intuitive result here and it should stop any design that treats reserves as the
bankability proxy. The mechanism is arithmetic: reserves are measured *against expenses*, and a
trading organisation has large expenses. A dormant organisation with $180K in the bank and no
activity scores 30.9 months and is not bankable by any reading.

**Implication:** "months of reserves" is a *liquidity* signal, not a *capability* signal, and
inverts against capability across this population. Do not combine the two.

### 2c. Registered size, where ACNC covers the org

`acnc_charities.charity_size`, among those matched:

| cohort | matched to ACNC | Large | Medium | Small |
|---|---|---|---|---|
| contract | 429 (40.9%) | **139** | 47 | 19 |
| grant_only | 900 (62.2%) | 108 | 111 | 105 |
| neither | 814 (12.2%) | 24 | 58 | 187 |

Among sized rows, contract-holders are 68% Large; grant-only are 33% Large.
Note grant-only orgs are **more likely to be ACNC-registered at all** (62% vs 41%) — see §2d.

### 2d. Legal form is the sharpest single split

`gs_entities.entity_type`:

| entity_type | contract | grant_only | neither |
|---|---|---|---|
| social_enterprise | 404 | 167 | 3,036 |
| indigenous_corp | 337 | **958** | 3,096 |
| company | **155** | 50 | 137 |
| charity | 129 | 252 | 267 |
| foundation | 23 | 15 | 82 |

Grant-only is **66% indigenous_corp**. Contract is 39% social_enterprise + 15% company.
`company`-typed community-controlled entities are **3.1x more likely to hold a contract than to
hold only grants** — the only form where that ratio exceeds 1 by a wide margin. Read the honesty
caveat in §4 before using this.

### 2e. Place: proximity to Canberra is a real edge

| state | contract | grant_only |
|---|---|---|
| NSW | 291 | 340 |
| QLD | 205 | 456 |
| NT | 188 | 191 |
| WA | 140 | 253 |
| **ACT** | **85** | **16** |
| VIC | 67 | 86 |
| SA | 49 | 67 |
| TAS | 12 | 14 |

**ACT is the only jurisdiction where contract-holders outnumber grant-only orgs, and it does so
5.3:1.** Everywhere else the ratio runs 0.4–1.0. QLD is the worst at 0.45.
Remote/very-remote counts are similar between cohorts (278 vs 470), so remoteness is not the
primary axis — *distance from the buyer* is.

### 2f. Repeat is where the money actually is

Contract counts per community-controlled supplier:

| contracts held | orgs | contracts | total value | median org total | median largest contract | avg distinct buyers | avg span (yrs) |
|---|---|---|---|---|---|---|---|
| 1 | 328 | 328 | $233.7M | $50,000 | $50,000 | 1.0 | 0.0 |
| 2–4 | 372 | 965 | $1,171.0M | $377,960 | $205,425 | 1.6 | 1.9 |
| 5–20 | 265 | 2,480 | $1,650.2M | $1,189,350 | $349,491 | 3.3 | 6.4 |
| **21+** | **83** | **7,144** | **$2,378.3M** | $11,087,388 | $1,964,780 | **12.8** | 12.8 |

**83 organisations — 0.9% of the ABN-bearing community-controlled population — hold 65% of the
contracts and 44% of the dollars.** Buyer diversity rises monotonically with contract count and
is the cleanest continuous correlate available (1.0 → 12.8).

### 2g. Entry contract size does NOT predict compounding

First contract by `contract_start`, against lifetime contract count:

| first contract value | orgs | avg lifetime contracts | % reaching 5+ contracts |
|---|---|---|---|
| < $50K | 431 | 11.5 | **32.7%** |
| $50–250K | 342 | 10.1 | 30.1% |
| $250K–1M | 177 | 5.8 | 26.6% |
| $1M+ | 98 | 9.2 | 28.6% |

Flat-to-inverse. **Starting small does not cap an organisation** — the sub-$50K entrants have the
*highest* rate of reaching five contracts. This is the most product-relevant finding in the note:
the barrier is at contract #1, not at contract size. A community organisation does not need to be
big to enter; it needs to enter at all.

---

## 3. Signal inventory: coverage and reliability

| signal | source | coverage over CC orgs | reliability | verdict |
|---|---|---|---|---|
| **Repeat-contract count + distinct buyers** | `austender_contracts` | 1,048 / 12,479 (8.4%) of CC orgs; 60,603 distinct suppliers overall | High. First-party AusTender notices, ABN-keyed. Known defect: ~$126bn of contracts have no matched supplier entity (#303), and ~658K dual-key duplicate rows exist in the graph build — but the *per-supplier* aggregation used here reads the source table, not the graph. | **Most trustworthy.** Use it. |
| **ACNC AIS financials** | `acnc_ais`, 360K rows | **16–18% of contract/grant cohorts; 3.3% of "neither"** | Medium, with two hard caveats: (a) **latest year is 2023** — one stray 2025 row (FECCA, ABN 23684792947) and nothing for 2024. The data is ~3 years stale. (b) Coverage is a *selection* — being ACNC-registered is itself correlated with the cohort (62% grant-only vs 41% contract), so any AIS-derived median is computed on a biased 1-in-6 subsample. | Usable for **direction**, not for a per-org verdict. Never show an org "you have N months of reserves" from a 2023 filing. |
| **Reserves / current ratio** | `acnc_ais` derived | as above | **Actively misleading in this population** (§2b). Inverts against capability. | Do not use as a bankability signal. Keep as a disclosed liquidity fact only. |
| **`mv_entity_power_index`** | matview, 185,393 rows | **3,010 of 12,479 CC orgs (24%)** | The ticket's suspicion is **confirmed for `system_count`** and **wrong about the MV as a whole**. `system_count` distribution: 161,227 at 1, 21,078 at 2, 2,529 at 3, 483 at 4, 72 at 5, 4 at 6. For CC orgs, rising system_count tracks median dollar flow strongly ($0 → $117K → $1.52M → $3.60M → $9.09M) but tracks contract count only weakly (3.1 → 4.6 → 5.2 → 6.4 → 4.8, non-monotonic at 5). It measures **dataset presence and money size**, not capability. | Use the MV's *columns* — it already carries `contract_count`, `distinct_govt_buyers`, `distinct_grant_programs`, `total_dollar_flow`, `charity_size`. Do **not** use `system_count` or `power_score`. |
| **`grantconnect_awards` repeat receipt** | 291K rows | 1,758 CC orgs | High for the award facts, ABN-keyed. **Place fields are hazardous** — `delivery_postcode` contains literal `'Multiple'`, `delivery_state` holds 318 values including comma-lists and `National`/`Overseas` (#303 standing hazard). | Usable for repeat/program-diversity. Never for place without the #303 corrections. |
| **`justice_funding`** | 157K rows | 661 CC orgs after filters | High **only with all three mandatory filters**. Without them the headline is overstated by 26% ($12.12bn). | Usable, filters non-negotiable. |
| **`v_grant_place_capture`** | view | verified live, returns `captured_locally` boolean with `delivery_lga`/`recipient_lga` | Inherits the #301 `postcode_geo` SA3 fan-out risk and the #303 delivery-field hazards; it already encodes the four corrections from `2026-08-19-grant-place-capture.md`. | Usable as an "already cleared a bar" flag. Not a financial signal. |
| **Board composition** | `person_roles`, `mv_board_interlocks` | — | **Unusable as-is.** `mv_board_interlocks` max `board_count` is 745, a known nominee-block artefact (see memory `project_person_disambiguation`). Raw board counts are not real. | Excluded from this analysis deliberately. Would need the nominee-block cap applied first. |
| **Organisation age** | — | — | **Not available.** No reliable incorporation-date column was found on `gs_entities`; `abr_registry` and `asic_companies` hold registration dates but were not joined here. **Unverified — flagged as a gap.** | Untested. Worth a follow-up: age is the one classic lender signal absent from this note. |

---

## 4. The honesty caveat that must travel with this

The 83 highest-volume community-controlled contract holders are, by value:

| org | type | state | contracts | buyers | $M |
|---|---|---|---|---|---|
| AMNESIUM PTY LTD | company | ACT | 1,173 | 59 | 229 |
| Pacific Services Group Holdings Pty Ltd | company | NSW | 111 | 12 | 208 |
| Servegate Australia Pty Ltd | charity | ACT | 272 | 17 | 148 |
| National Aboriginal Community Controlled Health Organisation Ltd | foundation | ACT | 30 | 8 | 135 |
| E-Bisglobal Pty Ltd | social_enterprise | NSW | 24 | 10 | 107 |
| Kennelly Constructions Pty Ltd | social_enterprise | QLD | 32 | 6 | 94 |
| GULANGA GROUP PTY LTD | company | ACT | 275 | 54 | 80 |
| First Grade Group | company | QLD | 448 | 27 | 68 |
| Ninti One Limited | charity | NT | 57 | 16 | 68 |
| Pattemore Consultants Pty Ltd | social_enterprise | NT | 27 | 2 | 63 |
| GEBIE CIVIL AND CONSTRUCTION PTY LTD | social_enterprise | NT | 45 | 13 | 59 |
| CALLEO INDIGENOUS PTY LTD | company | ACT | 161 | 34 | 56 |

These are **Supply-Nation-shaped Indigenous-owned commercial businesses** — labour hire, ICT
resale, facilities, civil construction — clustered in Canberra and Sydney. They are not the
community service organisations the map's primary user is.

So the honest statement of the finding is:

> **Empirically, "bankable" in this dataset means: a trading Pty Ltd or social enterprise, in or
> near a capital city, with paid staff and multi-million-dollar throughput, selling a
> commoditised service to many government buyers under IPP-style set-asides. It does not mean a
> well-reserved, well-governed, remotely-located community service organisation — those sit
> almost entirely in the grant-only cohort.**

The gap between the cohorts is therefore **partly a capability gap and partly a business-model
gap**. Nothing in the data separates the two. Presenting the difference as "here is what you must
become" would be telling remote Aboriginal corporations that bankability means becoming a
Canberra labour-hire company. That is a real finding about Commonwealth procurement, and it is
not advice.

---

## 5. What this means for the map (#303)

1. **Do not build a bankability score.** Two of the classic inputs (reserves, board counts) are
   respectively inverted and artefactual in this population, and the ACNC financial layer covers
   one org in six and is three years stale. Any composite would dress that noise as signal.
2. **The one honest, well-covered, actionable signal is the contract ladder itself**: contract
   count, distinct buyers, span. It is 100%-covered for the orgs that have one and unambiguously
   absent for those that do not.
3. **The product question is entry, not growth.** §2g shows entry contract size does not cap the
   trajectory and §2f shows a third of contract-holders never got a second contract. The
   measurable bar is *the first contract*, and 11,431 of 12,479 community-controlled
   organisations have not cleared it.
4. **Legal form and location are the strongest structural correlates and are both actionable in
   principle** (incorporate a trading arm; register against the right buyer), unlike revenue,
   which is a consequence rather than a cause.
5. **Follow-ups worth a ticket:** organisation age from `abr_registry`/`asic_companies` (§3 gap);
   whether the 3,312 ABN-less community-controlled orgs are a data gap or a real population; and
   whether the ACT effect survives controlling for entity_type.

## 6. Every query in this note

Run from repo root: `node --env-file=.env scripts/gsql.mjs "<sql>"`. All SELECT-only.
The cohort CTE reused throughout:

```sql
WITH cc AS (SELECT abn FROM gs_entities
            WHERE is_community_controlled = true AND abn IS NOT NULL),
con AS (SELECT DISTINCT supplier_abn AS abn FROM austender_contracts
        WHERE supplier_abn IN (SELECT abn FROM cc)),
gr AS (SELECT DISTINCT abn FROM (
         SELECT recipient_abn abn FROM justice_funding
          WHERE measure_kind='grant' AND is_aggregate IS NOT TRUE
            AND recipient_abn IN (SELECT abn FROM cc)
         UNION
         SELECT recipient_abn FROM grantconnect_awards
          WHERE recipient_abn IN (SELECT abn FROM cc)) z),
coh AS (SELECT cc.abn,
          CASE WHEN con.abn IS NOT NULL THEN 'contract'
               WHEN gr.abn IS NOT NULL THEN 'grant_only'
               ELSE 'neither' END AS cohort
        FROM cc LEFT JOIN con ON con.abn=cc.abn LEFT JOIN gr ON gr.abn=cc.abn)
```

Latest-AIS CTE:

```sql
ais AS (SELECT DISTINCT ON (abn) abn, charity_size, total_revenue,
          revenue_from_government, revenue_from_goods_services, total_assets,
          net_assets_liabilities, total_current_assets, total_current_liabilities,
          total_expenses, staff_fte, staff_volunteers
        FROM acnc_ais WHERE ais_year >= 2021 ORDER BY abn, ais_year DESC)
```
