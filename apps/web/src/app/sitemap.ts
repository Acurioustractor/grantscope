import type { MetadataRoute } from 'next';
import { getServiceSupabase } from '@/lib/supabase';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://civicgraph.com.au';
const MAX_ENTITIES_IN_SITEMAP = 5000;

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * Public sitemap — lets Google, journalist-tooling, and researchers discover
 * the investigations and entity pages. Without this the accountability atlas
 * is invisible to search.
 *
 * Includes:
 *  - Top-level pages (home, about, support, reports index)
 *  - All public reports (~30+)
 *  - Top N entities by power score (proxy for "investigatable interest")
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about/curious-tractor`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/reports`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/graph`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/power`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/grants`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/foundations`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/entities`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/snow-foundation`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Discover all public report pages by scanning the filesystem at build time
  // Note: this is a runtime sitemap, so we hard-list known reports.
  const reportSlugs = [
    'civicgraph-thesis',
    'consulting-class',
    'indigenous-proxy',
    'big-philanthropy',
    'board-interlocks',
    'charity-contracts',
    'child-protection',
    'community-efficiency',
    'community-parity',
    'community-power',
    'convergence',
    'cross-reference',
    'data-health',
    'data-quality',
    'desert-overhead',
    'disability',
    'donor-contractors',
    'education',
    'exec-remuneration',
    'funding-deserts',
    'funding-equity',
    'grant-frontier',
    'influence-network',
    'money-flow',
    'ndis',
    'ndis-market',
    'reallocation-atlas',
    'access-gap',
  ];
  const reportRoutes: MetadataRoute.Sitemap = reportSlugs.map((slug) => ({
    url: `${SITE_URL}/reports/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Top entities — the most-investigated organisations
  let entityRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('mv_entity_power_index')
      .select('gs_id')
      .order('power_score', { ascending: false })
      .limit(MAX_ENTITIES_IN_SITEMAP);

    if (data) {
      entityRoutes = data
        .filter((row) => row.gs_id)
        .map((row) => ({
          url: `${SITE_URL}/entities/${encodeURIComponent(row.gs_id as string)}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        }));
    }
  } catch {
    // If MV is unavailable, fall back to no entities — sitemap still ships
  }

  return [...staticRoutes, ...reportRoutes, ...entityRoutes];
}
