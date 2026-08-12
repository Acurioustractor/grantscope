import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';

const GRANT_OPPORTUNITY_CACHE_SECONDS = 60 * 60;
const GRANT_OPPORTUNITY_SAMPLE_ROWS = 1000;

const inFlightGrantOpportunityFetches = new Map<string, Promise<unknown[]>>();

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
    maxRows = GRANT_OPPORTUNITY_SAMPLE_ROWS,
    excludeDuplicates = true,
  }: {
    maxRows?: number;
    excludeDuplicates?: boolean;
  } = {},
): Promise<T[]> {
  const fetchKey = JSON.stringify({ select, maxRows, excludeDuplicates });
  const inFlight = inFlightGrantOpportunityFetches.get(fetchKey);
  if (inFlight) return (await inFlight) as T[];

  const promise = fetchGrantOpportunityRowsOnce<T>(select, { maxRows, excludeDuplicates });
  inFlightGrantOpportunityFetches.set(fetchKey, promise as Promise<unknown[]>);

  try {
    return await promise;
  } finally {
    inFlightGrantOpportunityFetches.delete(fetchKey);
  }
}

async function fetchGrantOpportunityRowsOnce<T>(
  select: string,
  {
    maxRows,
    excludeDuplicates,
  }: {
    maxRows: number;
    excludeDuplicates: boolean;
  },
): Promise<T[]> {
  const db = getServiceSupabase();
  let query = db
    .from('grant_opportunities')
    .select(select)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(maxRows);

  if (excludeDuplicates) {
    query = query.or('status.is.null,status.neq.duplicate');
  }

  const { data, error } = await query;
  if (error) {
    console.error('[grant-opportunity-cache] grant_opportunities sample failed:', error.message);
    return [];
  }

  return ((data || []) as unknown) as T[];
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
