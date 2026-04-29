import { getServiceSupabase } from '@/lib/supabase';
import type { WikiSupportRouteType } from '@/lib/services/wiki-support-index';

type FrontierMetadata = {
  project_slug?: string;
  project_name?: string;
  project_code?: string | null;
  route_type?: WikiSupportRouteType;
  query?: string;
  next_step?: string;
  grant_finder_href?: string;
  promotion_rule?: string;
};

type RawFrontierRow = {
  id: string;
  source_key: string;
  source_name: string | null;
  target_url: string;
  priority: number;
  enabled: boolean;
  metadata: FrontierMetadata | null;
  updated_at: string | null;
};

export interface WikiSupportFrontierRow {
  id: string;
  source_key: string;
  source_name: string | null;
  target_url: string;
  priority: number;
  enabled: boolean;
  project_slug: string;
  project_name: string;
  project_code: string | null;
  route_type: WikiSupportRouteType | 'unknown';
  query: string;
  next_step: string | null;
  grant_finder_href: string | null;
  promotion_rule: string | null;
  updated_at: string | null;
}

export interface WikiSupportFrontierQueue {
  total: number;
  rows: WikiSupportFrontierRow[];
  by_route: Array<{ route_type: string; count: number }>;
}

function normalizeRow(row: RawFrontierRow): WikiSupportFrontierRow {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    source_key: row.source_key,
    source_name: row.source_name,
    target_url: row.target_url,
    priority: row.priority,
    enabled: row.enabled,
    project_slug: metadata.project_slug || 'unknown',
    project_name: metadata.project_name || 'Unknown project',
    project_code: metadata.project_code || null,
    route_type: metadata.route_type || 'unknown',
    query: metadata.query || row.source_name || row.target_url,
    next_step: metadata.next_step || null,
    grant_finder_href: metadata.grant_finder_href || null,
    promotion_rule: metadata.promotion_rule || null,
    updated_at: row.updated_at,
  };
}

function groupByRoute(rows: WikiSupportFrontierRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.route_type, (counts.get(row.route_type) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([route_type, count]) => ({ route_type, count }))
    .sort((left, right) => right.count - left.count || left.route_type.localeCompare(right.route_type));
}

export async function getWikiSupportFrontierQueue(projectSlug?: string, limit = 12): Promise<WikiSupportFrontierQueue> {
  const db = getServiceSupabase();
  let query = db
    .from('source_frontier')
    .select('id, source_key, source_name, target_url, priority, enabled, metadata, updated_at', { count: 'exact' })
    .eq('discovery_source', 'wiki-support-index')
    .eq('source_kind', 'support_discovery_query')
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (projectSlug) {
    query = query.eq('metadata->>project_slug', projectSlug);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('[wiki-support-frontier] queue failed:', error.message);
    return {
      total: 0,
      rows: [],
      by_route: [],
    };
  }

  const rows = ((data || []) as RawFrontierRow[]).map(normalizeRow);
  return {
    total: count ?? rows.length,
    rows,
    by_route: groupByRoute(rows),
  };
}
