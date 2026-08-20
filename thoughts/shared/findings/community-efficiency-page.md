# /reports/community-efficiency — six defects, and why a partial fix makes it worse

**Measured 2026-08-20.** Found via #363's column guard, which flagged two wrong column names;
reading the page to fix them turned up four more.

**Do not fix defects 1 and 2 on their own.** Doing so takes the page from "these panels show
nothing" to "these panels show statistics computed from an arbitrary 3–4% sample, presented as
findings". That is strictly worse than blank.

## The six

| # | defect | consequence |
|---|---|---|
| 1 | Both `exec_sql` calls pass `{ sql: … }`; the parameter is `query` | `isReadOnlyExecSql` gets `undefined` and rejects them. **Neither query has ever run.** Zero calls in the file use the right name. |
| 2 | `p.total_dollars` (real: `total_dollar_flow`), `p.entity_id` (real: `id`) | would still fail after fixing 1 |
| 3 | Query 2 paginates **all 609,000 `gs_entities` rows** at 1,000/request | ~609 sequential round-trips. **This is the 59.6s prerender** that forced the `staticPageGenerationTimeout` bump in #344. It exists to fetch two fields: `is_community_controlled` and `state`. |
| 4 | Contract aggregate returns **34,541 rows**; `exec_sql` caps at 1,000 | the published "Procurement gap" would be computed from **3%** of suppliers |
| 5 | Power query matches **24,163** rows, `LIMIT 2000`, cap 1,000, and **no `ORDER BY`** | `PowerStats` from an arbitrary **4%** — arbitrary literally, since nothing orders it |
| 6 | `powerMap` is built and never read | dead code (`powerData` itself IS used, by `PowerStats`) |

## The fix is SQL-side aggregation, not repair

The page reduces everything to group statistics. It does not need 42,515 AIS rows, 609,000 entity
rows or 34,541 contract rows in memory to do that.

Proven for the procurement gap — **two rows, 3.4s**, replacing 34,541-truncated-to-1,000:

```sql
SELECT COALESCE(e.is_community_controlled, false) AS is_acco,
       count(*) AS entities,
       sum(c.total_contracts) AS total_contracts,
       sum(c.cnt) AS contract_count
FROM (SELECT supplier_abn, SUM(contract_value) total_contracts, COUNT(*) cnt
        FROM austender_contracts WHERE supplier_abn IS NOT NULL
       GROUP BY supplier_abn HAVING SUM(contract_value) > 100000) c
JOIN acnc_ais a ON a.abn = c.supplier_abn AND a.ais_year = 2023 AND a.total_revenue > 0
JOIN gs_entities e ON e.abn = c.supplier_abn
GROUP BY 1
```

Result — and this is a real finding the page has never been able to show:

```
non-ACCO   1,788 entities   $38.89bn   23,608 contracts
ACCO         116 entities    $0.94bn    1,398 contracts
```

ACCOs are 6.1% of contracted charities and 2.4% of the dollars.

The same shape applies to the AIS/entity join (42,515 rows, 99.8% match, 3.4s) and to the power
stats. Whether the group stats can be done entirely in SQL or need one paginated pass depends on
what the page renders per-record; that is the first thing to settle when picking this up.

## Why this is a document and not a PR

Six defects across 859 lines, three of them silent truncations feeding published statistics. A
safe fix is a rewrite of the data layer, and a partial one is a regression. Written down so the
diagnosis is not re-derived — the measurement above cost about forty minutes.

Two of these remain in the `ALLOWED` list of `apps/web/src/lib/column-manifest.test.ts`
(`mv_entity_power_index.total_dollars`, `.entity_id`), annotated, so the guard stays green until
this is picked up.
