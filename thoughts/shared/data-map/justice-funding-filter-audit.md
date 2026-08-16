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

### `mv_entity_total_funding.justice_total` — the visible harm

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

1. **Add `measure_kind` to `justice_funding_clean`** — one migration, unblocks every downstream
   caller. Does not change any current number.
2. **Register a question with a sentinel** on the honest total, so a regression is caught rather
   than rediscovered.
3. **Fix `mv_entity_total_funding.justice_total`** — the 28-file blast radius, and the one with a
   publicly visible wrong answer.
4. Then work the remaining views by whether they claim money-received.
