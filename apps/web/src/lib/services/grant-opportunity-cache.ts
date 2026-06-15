import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';

const GRANT_OPPORTUNITY_CACHE_SECONDS = 10 * 60;
const GRANT_OPPORTUNITY_PAGE_SIZE = 500;
const GRANT_OPPORTUNITY_MAX_ROWS = 5000;

export interface GrantCoverageRow {
  source: string | null;
  provider: string | null;
  geography: string | null;
  status: string | null;
  application_status: string | null;
  closes_at: string | null;
  grant_type: string | null;
  updated_at: string | null;
  last_verified_at: string | null;
}

export interface GrantSourceCoverageRow {
  source: string | null;
  amount_max: number | null;
}

async function fetchGrantOpportunityRows<T>(
  select: string,
  {
    maxRows = GRANT_OPPORTUNITY_MAX_ROWS,
    pageSize = GRANT_OPPORTUNITY_PAGE_SIZE,
    excludeDuplicates = true,
  }: {
    maxRows?: number;
    pageSize?: number;
    excludeDuplicates?: boolean;
  } = {},
): Promise<T[]> {
  const db = getServiceSupabase();
  const rows: T[] = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const end = Math.min(offset + pageSize, maxRows) - 1;
    let query = db
      .from('grant_opportunities')
      .select(select);

    if (excludeDuplicates) {
      query = query.or('status.is.null,status.neq.duplicate');
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(offset, end);
    if (error) {
      console.error('[grant-opportunity-cache] grant_opportunities page failed:', error.message);
      break;
    }

    const pageRows = ((data || []) as unknown) as T[];
    rows.push(...pageRows);

    if (pageRows.length < end - offset + 1) {
      break;
    }
  }

  return rows;
}

export const getCachedGrantCoverageRows = unstable_cache(
  async () =>
    fetchGrantOpportunityRows<GrantCoverageRow>(
      'source, provider, geography, status, application_status, closes_at, grant_type, updated_at, last_verified_at',
    ),
  ['grant-opportunities', 'coverage-v1'],
  { revalidate: GRANT_OPPORTUNITY_CACHE_SECONDS },
);

export const getCachedGrantSourceCoverageRows = unstable_cache(
  async () => fetchGrantOpportunityRows<GrantSourceCoverageRow>('source, amount_max'),
  ['grant-opportunities', 'source-coverage-v1'],
  { revalidate: GRANT_OPPORTUNITY_CACHE_SECONDS },
);
