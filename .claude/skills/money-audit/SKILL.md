---
name: money-audit
description: Audit a surface's dollar figures against the three mandatory justice_funding filters before anyone reads them. Enumerates every money-summing site, classifies each as grant-lane or expenditure-lane, MEASURES the delta in SQL before changing anything, then applies the canonical predicate. Use on /money-audit, "audit the money on X", "are these figures filtered", "check this page's numbers", or before shipping any surface that renders a dollar amount from justice_funding, political_donations or austender_contracts.
---

# /money-audit — do the figures survive their own filters

CivicGraph's entire claim is that its numbers are trustworthy. `justice_funding.amount_dollars`
carries **two incompatible measures in one column**: grants paid to organisations, and
whole-of-state expenditure budgets. Adding them does not produce a slightly-off number.

Measured 2026-08-20 on the youth-justice topic:

| filter | rows | total |
|---|---|---|
| topic tag alone | 5,100 | **31.66bn dollars** |
| topic tag + grant lane | 4,090 | **915.7m dollars** |

**34x.** It was published as "funding by state" and "top funded programs" for months. This skill
exists because that is not a bug you find by reading code — you find it by measuring.

## The rule that makes this skill necessary

**Never state that a figure is "fixed" without stating the delta.** A filter applied without a
before-and-after is indistinguishable from a filter that did nothing. Every finding in this audit
ends with a number that changed, or it is not a finding.

## Procedure

### 1. Enumerate, do not sample

Every site on the surface that sums, averages, ranks or counts money:

```bash
grep -nE '^export (async )?function |justice_funding|political_donations|austender_contracts' <file>
```

Read the body of each function that appears near a table name.

Ranking and averaging count — a `MAX`, an `ORDER BY amount DESC` and a
`SUM(x)/COUNT(y)` are all money figures.

### 2. Classify each site into a lane — this is judgement, not a sweep

| lane | means | filter |
|---|---|---|
| **grant** | money that reached a named organisation | `grantFilterSql(alias)` — all three filters |
| **expenditure** | what a government spent running a system | **NO grant filter.** Scope by `source` instead |
| **count-only** | rows, sources, coverage; no dollars | nothing |

**Sweeping is how you replace one silent error with another.** `getRogsExpenditure`,
`getBudgetTotals`, `getBudgetCommitments` and the `getQgip*` pair are expenditure BY DESIGN —
17 of the 18 `%-budget-sds` rows are `is_aggregate = true` and that IS the measurement. Applying
the grant filter to those empties them.

The tell: **does the site scope by `source`, or by topic?** Source-scoped is usually a deliberate
expenditure lane. Topic-scoped is asking about organisations and needs the grant filter.

### 3. MEASURE before you change anything

For each grant-lane site, run the before and after:

```bash
node --env-file=.env scripts/gsql.mjs "
SELECT 'unfiltered' AS lane, count(*) AS n, sum(amount_dollars) AS amt
  FROM justice_funding WHERE <the site's existing predicate>
UNION ALL SELECT 'filtered', count(*), sum(amount_dollars)
  FROM justice_funding WHERE <existing> AND measure_kind='grant' AND is_aggregate IS NOT TRUE"
```

`gsql.mjs` chokes on `UNION ALL` of bare literals — if it errors with `row_to_json(text) does not
exist`, use a single row of subqueries instead.

**If the delta is zero, say so and move on.** A site that was already correct is a finding worth
recording, not a place to add a redundant filter.

### 4. Apply the canonical predicate — never retype it

`apps/web/src/lib/justice-money.ts` exports all of it:

- `grantFilterSql(alias?)` — the three filters as SQL, column-prefixed
- `donationFilterSql(alias?)` — `receipt_type = 'donation received'`
- `applyGrantFilters(query)` — the PostgREST builder form
- `isRealRecipient(name)` / `themeMoney(topics)` — the in-memory forms

Retyping the predicate is how the drift starts: two functions in `report-service.ts` carried
hand-rolled copies, and the other eighteen call sites had none.

**Prefer folding the filter into the shared helper over adding it at N call sites.** If every
caller of a filter function wants the grant lane, put it in the filter function.

### 5. Check the traps that are not about filters

- **NULLs sort FIRST in a `DESC` ordering.** A naive "top recipients" returns the rows with no
  amount. Needs `amount_dollars IS NOT NULL` or `NULLS LAST`.
- **Topic tags overlap** — `youth-justice ∩ diversion` = 98 rows. Querying tag by tag and
  concatenating double-counts. Deduplicate by `id`.
- **Hyphens, not underscores.** `topics @> ARRAY['youth_justice']` returns zero rows silently.
- **Postgres array columns come back NULL, not empty.** One NULL crashes any `for…of`.

### 6. Report

For each site: lane, delta, action. Then the two things that are easy to skip:

- **What you did NOT change, and why.** The expenditure lane needs naming, or the next reader
  "fixes" it.
- **What the change does to the page.** After filtering, youth-justice grant money is 99.99% QLD —
  seven states' tables go empty. A correct number that renders as a confident zero is not finished
  work; it needs a disclosure, per CLAUDE.md.

## Definition of done

- [ ] Every money site on the surface enumerated, none sampled
- [ ] Each classified grant / expenditure / count-only, with the reason recorded
- [ ] Every grant-lane change has a measured before-and-after
- [ ] Predicates come from `justice-money.ts`, not retyped
- [ ] The expenditure lane is commented so nobody "fixes" it
- [ ] Any figure that now renders empty has a disclosure, or is flagged as needing one

## Reference

CLAUDE.md, "Three filters that are mandatory, not optional" — the source of truth for the filters
and the measured national impact (12.12bn dollars, 26%, stripped by filters 1 and 2 together).

## A note on writing this file

A dollar sign immediately followed by a digit is substituted with the skill's arguments when this
file loads. The first run of this skill printed a file path where a figure should have been, and a
mangled awk expression, because two such sequences were sitting in the text.

So: write money figures so they never start with a dollar sign followed by a digit that could read
as a positional parameter — use the full amount (915.7m rather than a leading zero), and prefer
`grep` over `awk` field references in examples. This paragraph is deliberately written without a
single instance of the pattern it describes.
