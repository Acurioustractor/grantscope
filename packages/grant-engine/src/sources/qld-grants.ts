/**
 * QLD Grants Finder Source Plugin
 *
 * Fetches Queensland state grants from data.qld.gov.au CKAN API.
 * The QLD Grants Finder dataset contains structured grant data.
 *
 * API: https://www.data.qld.gov.au/api/3/action/datastore_search
 */

import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const QLD_CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';

// Known resource IDs for QLD grants datasets
const GRANTS_RESOURCE_IDS = [
  'd54f7b60-8153-44a4-8a2d-055234703372', // QLD Grants Finder
];

interface QLDGrantRecord {
  'Grant Name'?: string;
  'Program Name'?: string;
  'Department'?: string;
  'Description'?: string;
  'Open Date'?: string;
  'Close Date'?: string;
  'Minimum Amount'?: string;
  'Maximum Amount'?: string;
  'Website'?: string;
  'Status'?: string;
  'Category'?: string;
  [key: string]: string | undefined;
}

interface DatastoreResult {
  success: boolean;
  result: {
    total: number;
    records: QLDGrantRecord[];
  };
}

function inferCategories(title: string, description: string, category?: string): string[] {
  const text = `${title} ${description} ${category || ''}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic/.test(text)) cats.push('enterprise');
  if (/education|training|school/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');

  return cats;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

export function createQLDGrantsPlugin(): SourcePlugin {
  return {
    id: 'qld-grants',
    name: 'QLD Grants Finder',
    type: 'api',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      for (const resourceId of GRANTS_RESOURCE_IDS) {
        try {
          // First try datastore_search
          const params = new URLSearchParams({
            resource_id: resourceId,
            limit: '500',
          });

          const response = await fetch(`${QLD_CKAN_BASE}/datastore_search?${params}`);
          if (!response.ok) {
            console.error(`[qld-grants] API error for ${resourceId}: ${response.status}`);
            continue;
          }

          const data = await response.json() as DatastoreResult;
          if (!data.success || !data.result?.records) {
            console.error(`[qld-grants] No records for ${resourceId}`);
            continue;
          }

          console.log(`[qld-grants] Found ${data.result.total} grants in QLD Grants Finder`);

          for (const record of data.result.records) {
            const name = record['Grant Name'] || record['Program Name'] || '';
            if (!name) continue;

            const description = record['Description'] || '';
            const categories = inferCategories(name, description, record['Category']);

            // Filter by query categories
            if (query.categories?.length) {
              const queryLower = query.categories.map(c => c.toLowerCase());
              if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
            }

            // Filter by keywords
            if (query.keywords?.length) {
              const text = `${name} ${description}`.toLowerCase();
              if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
            }

            yield {
              title: name,
              provider: record['Department'] || 'Queensland Government',
              sourceUrl: record['Website'] || undefined,
              amount: {
                min: parseAmount(record['Minimum Amount']),
                max: parseAmount(record['Maximum Amount']),
              },
              deadline: record['Close Date'] || undefined,
              description: description.slice(0, 1000) || undefined,
              categories,
              program: record['Program Name'] || undefined,
              sourceId: 'qld-grants',
              geography: ['AU-QLD'],
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[qld-grants] Error: ${msg}`);
        }
      }

      // Also try CKAN package search for additional grant datasets
      try {
        const params = new URLSearchParams({
          q: 'grants',
          rows: '50',
        });

        const response = await fetch(`${QLD_CKAN_BASE}/package_search?${params}`);
        if (response.ok) {
          const data = await response.json() as { success: boolean; result: { results: Array<{ title: string; notes: string; id: string; organization: { title: string } }> } };
          if (data.success) {
            console.log(`[qld-grants] Found ${data.result.results.length} additional datasets`);
          }
        }
      } catch {
        // Non-critical
      }
    },
  };
}
