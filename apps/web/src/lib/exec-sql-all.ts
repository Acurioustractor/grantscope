import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read every row of an exec_sql query. PostgREST caps an RPC result at 1,000 rows and says nothing:
 * /reports/community-efficiency showed "999 mainstream orgs with contracts" and 9 community-controlled
 * charities (of 543) because each query stopped at the cap.
 *
 * Each page re-runs the whole query, so keep the query itself small (filter to the keys the page
 * needs); paging a GROUP BY over a large table is how /reports/tax-transparency timed out. And
 * ORDER BY a unique key: without one, Postgres may return rows in a different order on each page,
 * so pages skip or repeat rows.
 */
export async function execSqlAll<T>(db: SupabaseClient, query: string, maxRows = 50_000): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await db.rpc('exec_sql', { query }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}
