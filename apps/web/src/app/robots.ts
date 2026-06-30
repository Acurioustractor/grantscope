import type { MetadataRoute } from 'next';

// See sitemap.ts — civicgraph.com.au does not resolve, civicgraph.app is the
// real production domain.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://civicgraph.app';

/**
 * Open robots policy for the accountability atlas.
 *
 * Indexable: reports, entity pages, graph, foundations, grants, about.
 * Disallowed: ops/admin surfaces, auth flows, embed routes (designed for
 * iframe consumption, not search indexing), API endpoints (data is the
 * point but the URLs aren't user-facing).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/ops',
          '/api/',
          '/embed/',
          '/login',
          '/register',
          '/profile',
          '/settings',
          '/admin',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
