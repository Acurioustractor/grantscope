# justice_funding — who applies the mandatory filters, and what it costs

**Measured 2026-08-16.** Triggered by slice C of the clarity console, which needed an honest money
figure for a public theme page. Every figure below was queried directly; re-measure before
trusting them again.

## The short version

`justice_funding` needs three filters to answer "money to organisations for justice work", and
almost nothing applies them. The view named `justice_funding_clean` reports **3.1x the honest
figure**, and the entity-level rollup that 28 app files depend on lists **Queensland Rail as the
second-largest recipient of justice funding in Australia.**

None of this is new data corruption. The table is a broad ingest of government funding records and
its own catalogue entry says so plainly:

> *Not purely "justice funding" (verified): rows include `source='austender-direct'` with
> `measure_kind='contract_value'` (e.g. "Pump Repairs"). Filter on `topics`/`source`, never assume
> the whole table is justice.*

The caveat is correct, was written before this audit, and is ignored almost everywhere.

## The three filters

| # | Filter | Why |
|---|---|---|
| 1 | `measure_kind = 'grant'` | 848 `expenditure_aggregate` rows are whole-of-state budgets, not money to an organisation |
| 2 | recipient name not aggregate-shaped | 46 rows named `Total`/`Various`/`n/a` are source-spreadsheet totals ingested as recipients |
| 3 | `topics @> ARRAY[...]` or a `source` scope | the table is not all justice — it holds transport contracts, rail concessions, pump repairs |

Filter 1 was documented in CLAUDE.md. Filter 2 was found during slice C and is now documented.
Filter 3 was documented in the object's own caveat and in CLAUDE.md's topic note.

## Coverage — who actually applies them

**Database layer**

| | count |
|---|---|
| Views and matviews reading `justice_funding` | **47** |
| …that reference `measure_kind` | **4** |
| …that touch `amount_dollars` | 38 |
| …that sum money with **no** `measure_kind` filter | **35** |

**Application layer**

| | count |
|---|---|
| Files under `apps/web/src` referencing `justice_funding` | **100** |
| …referencing `measure_kind` | **2** (`api/ask/route.ts`, `clarity/q/refusal.test.ts`) |

App files reading an unfiltered money view, by view:

| View | app files |
|---|---|
| `mv_entity_power_index` | **28** |
| `mv_revolving_door` | **19** |
| `v_org_funding_profile` | 2 |
| `mv_justice_proven_suppliers` | 2 |
| `mv_org_justice_signals` | 1 |
| `mv_yj_report_state_top_orgs` | 1 |
| `mv_funding_outcomes_summary` | 1 |

## What it costs

### `justice_funding_clean` — the view named clean is the worst offender

```sql
-- its entire filter:
WHERE sector IS DISTINCT FROM 'procurement'
```

| | rows | total |
|---|---|---|
| `justice_funding_clean` | 151,866 | **$117.47bn** |
| honest (all three filters) | 126,627 | **$38.01bn** |

**3.1x overstated. $79.46bn of phantom money.**

And it cannot be fixed by a caller: **`justice_funding_clean` does not expose `measure_kind` as a
column.** A view named "clean" omits the one field that makes cleaning possible.

Composition of what it includes, `sector <> 'procurement'`:

| measure_kind | rows | total |
|---|---|---|
| `expenditure_aggregate` | 848 | $66.13bn |
| `grant` | 126,673 | $46.10bn |
| `contract_value` | 24,269 | $3.01bn |
| `budget_announcement` | 76 | $2.24bn |

### Budget rows are attributed to named organisations

**462 of the 848 whole-of-state budget rows carry a `gs_entity_id`, worth $37.49bn.** They are not
floating unattached — they land on specific entities:

| Entity | from budget rows | rows |
|---|---|---|
| Queensland Department of Youth Justice | $11.05bn | 66 |
| Department of Justice & Community Safety | $9.76bn | 66 |
| NSW Department of Communities and Justice | $9.04bn | 66 |
| Department of Justice | $4.85bn | 132 |
| Department of Human Services | $1.81bn | 66 |
| Community Services Directorate | $0.97bn | 66 |

Mitigating: all six are government departments, and a department genuinely does receive its own
budget. Not mitigating: mixed into a "funding received" figure, it puts departments above every
community organisation in the country.

### `mv_entity_total_funding.justice_total` — FIXED 2026-08-16 (partly)

Migration `20260816060000` applied. It violated **both** documented filters, not one:

| column | was | now |
|---|---|---|
| `justice_total` | $77.08bn | **$31.59bn** |
| `donations_total` | $77.99bn | **$12.00bn** |

The donations defect was missing `receipt_type = 'donation received'` — found while fixing the
justice one. $111.48bn of phantom money across the two columns.

Top entities after the fix: Queensland Rail $4.10bn · Legal Aid Queensland $1.15bn · TAFE
Queensland Brisbane $0.94bn · Brisbane City Council $0.84bn · Life Without Barriers $0.78bn ·
Blue Care $0.62bn · UnitingCare Community $0.52bn. The two government departments carrying budget
rows ($10.03bn and $1.87bn) are gone.

**Queensland Rail remains, and is now #1.** It is not fixable by filtering — see below. It is a
naming defect, and the fact that Queensland Rail, TAFE and a city council sit among genuine service
providers is now the clearest possible signal that this column means "money from the
justice_funding table", not "justice funding".

### `mv_entity_total_funding.justice_total` — the original finding

This is what the 28-file `mv_entity_power_index` chain rests on. Top entities by `justice_total`:

| Entity | justice_total |
|---|---|
| Department of Justice & Community Safety | $10.03bn |
| **QUEENSLAND RAIL LTD** | **$4.10bn** |
| Department of Human Services | $1.87bn |
| Legal Aid Queensland | $1.15bn |
| TAFE Queensland Brisbane | $0.94bn |
| BRISBANE CITY COUNCIL | $0.84bn |

Queensland Rail's $4.1bn is 13 rows from source `qgip`, all `measure_kind = 'grant'`, and they are:

| program | year | amount |
|---|---|---|
| Transport Service Contracts | 2024-25 | $2,410.4m |
| Transport Service Contracts | 2017-18 | $1,631.8m |
| Rail Concession Scheme | 2017-18 | $35.4m |
| Rail Concession Scheme | 2024-25 | $17.3m |

These are correctly labelled grants. They are simply not justice. **Filter 1 alone would not have
caught this — only filter 3 does.** That is the argument for the object caveat's rule: never assume
the whole table is justice.

### `mv_entity_power_index` — FIXED 2026-08-16, nine-object rebuild

Migration `20260816080000` applied. It does NOT derive from `mv_entity_total_funding`; it reads the
base tables directly and carried both defects independently, at **four** sites — two dollar sums
and two PRESENCE flags.

| | before | after |
|---|---|---|
| `justice_dollars` | $83.53bn | **$32.20bn** |
| `donation_dollars` | $77.99bn | **$12.00bn** |
| rows | 188,189 | 185,265 |

**$117.32bn removed**, and 2,924 entities that only ever appeared via aggregate or non-donation
rows have left the power rankings. `power_score` is a ranking read across 28 app files, so the
presence filters changed the order, not just the magnitudes.

Gone from the index: **Australian Electoral Commission** (was $1.04bn of "donations" — the
regulator that publishes the data) and **Sino Iron** (was $8.1bn). Queensland Rail remains at
$4.10bn justice / $0 donations, as designed — see the naming decision.

Required rebuilding all nine objects in dependency order: `mv_entity_power_index` →
`mv_funding_deserts` → `mv_board_interlocks` → `v_goods_relationship_power` →
`mv_disability_landscape` → `mv_foundation_need_alignment` → `mv_foundation_scores` →
`mv_foundation_readiness` → `v_goods_warm_intros`. All populated afterwards and matching documented
baselines (`mv_funding_deserts` 1,997, `mv_board_interlocks` 39,757), so the public Atlas is
unaffected. All 19 grants restored.

**Trap:** matview grants live in `pg_class.relacl`, NOT `information_schema.role_table_grants`.
The latter returns zero grants for every matview and would have silently stripped `service_role`
and `agent_readonly` on rebuild.

## What is NOT affected

- **The clarity console theme pages (slice C).** They apply all three filters and report $1.04bn
  for youth justice across 4,682 grants, which is why the numbers looked small and correct rather
  than large and wrong.
- **`political_donations`.** Checked for the same aggregate-name defect: clean. Its documented
  filter (`receipt_type = 'donation received'`, 506,739 rows, $22.97bn) reproduces exactly.
- **The 26 registered questions** were not individually re-audited here, but they carry sentinels
  and ingredient declarations, which is the mechanism designed for exactly this.

## What has not been checked

- Whether each of the 35 unfiltered views is actually *wrong* for its purpose. A view answering
  "total government expenditure by state" should include the budget rows. Only the ones presenting
  a figure as money-received-by-an-organisation are defective, and that judgement is per-view.
- Which of the 100 app files render a money figure versus merely referencing the table name.
- Whether the four filtering views filter *correctly*.

## Recommended order

1. ~~Add `measure_kind` to `justice_funding_clean`~~ — **DONE**, migration `20260816020000`.
2. ~~Register a question with a sentinel~~ — **DONE**, `20260816030000`/`40000`/`50000`. It caught a
   40% overstatement in `youth-justice-total` within minutes.
3. ~~Fix `mv_entity_total_funding`~~ — **DONE**, `20260816060000`. Both columns, $111.48bn.
3b. ~~Fix `mv_entity_power_index`~~ — **DONE**, `20260816080000`, nine-object rebuild. $117.32bn.
4. **Decide the `justice_total` naming.** It is not a justice figure and cannot become one by
   filtering. Either rename it across 28 call sites, or scope the table by source (`qgip` is 81% of
   grant rows and is a whole-of-government register, not a justice one).
5. Then work the remaining 34 views by whether they claim money-received. **A view answering "total
   state expenditure" should keep the budget rows** — this is per-view judgement, not a sweep.
