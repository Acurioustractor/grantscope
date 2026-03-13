/**
 * data.gov.au Source Plugin
 *
 * Uses the CKAN API to search for grant-related datasets.
 * data.gov.au hosts 3,700+ grant datasets with structured metadata.
 *
 * API: https://data.gov.au/data/api/3/action/package_search
 */

import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types';

const CKAN_BASE = 'https://data.gov.au/data/api/3/action';

interface CKANPackage {
  id: string;
  title: string;
  notes: string;
  url: string;
  organization: { title: string };
  metadata_created: string;
  metadata_modified: string;
  tags: Array<{ name: string }>;
  resources: Array<{ url: string; format: string; name: string }>;
}

interface CKANSearchResult {
  success: boolean;
  result: {
    count: number;
    results: CKANPackage[];
  };
}

function inferCategories(title: string, notes: string): string[] {
  const text = `${title} ${notes}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|aged/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|biodiversity/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|employment/.test(text)) cats.push('enterprise');
  if (/education|training|research|school/.test(text)) cats.push('education');
  if (/justice|youth|diversion/.test(text)) cats.push('justice');
  if (/technolog|digital|innovat/.test(text)) cats.push('technology');

  return cats;
}

export function createDataGovAuPlugin(): SourcePlugin {
  return {
    id: 'data-gov-au',
    name: 'data.gov.au (CKAN)',
    type: 'api',
    geography: ['AU'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      const searchTerms = [
        'grants program',
        'grant funding',
        'grant opportunities',
        ...(query.keywords || []),
      ];

      const seen = new Set<string>();

      for (const term of searchTerms) {
        const params = new URLSearchParams({
          q: term,
          rows: '100',
          sort: 'metadata_modified desc',
        });

        try {
          const response = await fetch(`${CKAN_BASE}/package_search?${params}`);
          if (!response.ok) {
            console.error(`[data-gov-au] API error: ${response.status}`);
            continue;
          }

          const data = await response.json() as CKANSearchResult;
          if (!data.success) continue;

          console.log(`[data-gov-au] "${term}": ${data.result.count} results (showing ${data.result.results.length})`);

          for (const pkg of data.result.results) {
            // Skip duplicates across search terms
            if (seen.has(pkg.id)) continue;
            seen.add(pkg.id);

            // Only include if it looks like an actual grant program
            const title = pkg.title || '';
            const notes = pkg.notes || '';
            if (!title.toLowerCase().includes('grant') && !notes.toLowerCase().includes('grant')) continue;

            const categories = inferCategories(title, notes);

            // Filter by query categories if specified
            if (query.categories?.length) {
              const queryLower = query.categories.map(c => c.toLowerCase());
              if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
            }

            // Find a useful resource URL
            const pageUrl = `https://data.gov.au/data/dataset/${pkg.id}`;

            yield {
              title: title.slice(0, 200),
              provider: pkg.organization?.title || 'Australian Government',
              sourceUrl: pageUrl,
              description: notes.slice(0, 1000) || undefined,
              categories,
              sourceId: 'data-gov-au',
              geography: ['AU'],
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[data-gov-au] Error searching "${term}": ${msg}`);
        }
      }
    },
  };
}
