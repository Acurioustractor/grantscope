/**
 * QLD Grants Finder Source Plugin
 *
 * Fetches Queensland state grants from data.qld.gov.au CKAN API.
 * The QLD Grants Finder dataset is two-level:
 *   1. Meta-resource (cca41845) lists 25 agency resource IDs
 *   2. Each agency resource contains actual grant records
 *
 * API: https://www.data.qld.gov.au/api/3/action/datastore_search
 */

import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const QLD_CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';

// Meta-resource that lists all agency resource IDs
const GRANTS_FINDER_META_RESOURCE = 'cca41845-9898-4efe-9ca0-17fbd44a3321';

interface AgencyRecord {
  _id: number;
  Agency: string;
  'Agency name': string;
  Resource: string; // Resource ID containing actual grants
}

interface QLDGrantRecord {
  'Program title'?: string;
  'Sub-program title'?: string;
  'Funding agency'?: string;
  'Purpose'?: string;
  'Category1'?: string;
  'Category2'?: string;
  'Category3'?: string;
  'Status'?: string;
  'Opening date (date format)'?: string;
  'Closing date (date format)'?: string;
  'Financial year budget'?: string;
  'Website'?: string;
  'Maximum (indicative) grant amount (dollar amount)'?: string;
  'Maximum (indicative) grant amount (text)'?: string;
  'Eligibility'?: string;
  'Applicant type1'?: string;
  'Applicant type2'?: string;
  'Service ID'?: number;
  [key: string]: string | number | null | undefined;
}

interface DatastoreResult<T> {
  success: boolean;
  result: {
    total: number;
    records: T[];
  };
}

function inferCategories(title: string, description: string, category?: string): string[] {
  const text = `${title} ${description} ${category || ''}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|conservation/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry/.test(text)) cats.push('enterprise');
  if (/education|training|school|university/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/disaster|recovery|relief/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/research|science|innovation/.test(text)) cats.push('research');

  return cats;
}

function parseAmount(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

function parseDate(dateStr: string | undefined | null): string | undefined {
  if (!dateStr) return undefined;
  // Format: DD/MM/YYYY → YYYY-MM-DD
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return dateStr;
}

export function createQLDGrantsPlugin(): SourcePlugin {
  return {
    id: 'qld-grants',
    name: 'QLD Grants Finder',
    type: 'api',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      // Step 1: Fetch the meta-resource to get all agency resource IDs
      let agencyResourceIds: string[] = [];

      try {
        const metaResponse = await fetch(
          `${QLD_CKAN_BASE}/datastore_search?resource_id=${GRANTS_FINDER_META_RESOURCE}&limit=100`
        );
        if (!metaResponse.ok) {
          console.error(`[qld-grants] Meta-resource fetch failed: ${metaResponse.status}`);
          return;
        }

        const metaData = await metaResponse.json() as DatastoreResult<AgencyRecord>;
        if (!metaData.success || !metaData.result?.records) {
          console.error('[qld-grants] No agency records in meta-resource');
          return;
        }

        agencyResourceIds = metaData.result.records.map(r => r.Resource).filter(Boolean);
        console.log(`[qld-grants] Found ${agencyResourceIds.length} agency resources to query`);
      } catch (err) {
        console.error(`[qld-grants] Meta-resource error: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      // Step 2: Fetch grants from each agency resource
      let totalYielded = 0;

      for (const resourceId of agencyResourceIds) {
        try {
          const response = await fetch(
            `${QLD_CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=500`
          );
          if (!response.ok) {
            console.error(`[qld-grants] Resource ${resourceId} fetch failed: ${response.status}`);
            continue;
          }

          const data = await response.json() as DatastoreResult<QLDGrantRecord>;
          if (!data.success || !data.result?.records) continue;

          for (const record of data.result.records) {
            const name = record['Program title'] || '';
            if (!name) continue;

            // Only yield open grants (unless query asks for all)
            const status = record['Status']?.toLowerCase();
            if (query.status === 'open' && status && status !== 'open') continue;

            const subProgram = record['Sub-program title'];
            const fullName = subProgram ? `${name} — ${subProgram}` : name;
            const description = record['Purpose'] || '';
            const categories = inferCategories(
              fullName,
              description,
              record['Category1'] || undefined,
            );

            // Filter by query categories
            if (query.categories?.length) {
              const queryLower = query.categories.map(c => c.toLowerCase());
              if (categories.length > 0 && !categories.some(c => queryLower.includes(c))) continue;
            }

            // Filter by keywords
            if (query.keywords?.length) {
              const text = `${fullName} ${description}`.toLowerCase();
              if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
            }

            const maxAmount = parseAmount(record['Maximum (indicative) grant amount (dollar amount)']);
            const budget = parseAmount(record['Financial year budget']);

            yield {
              title: fullName,
              provider: record['Funding agency'] || 'Queensland Government',
              sourceUrl: record['Website'] || undefined,
              amount: {
                min: undefined,
                max: maxAmount || budget || undefined,
              },
              deadline: parseDate(record['Closing date (date format)']) || undefined,
              description: description.slice(0, 1000) || undefined,
              categories,
              program: name,
              sourceId: 'qld-grants',
              geography: ['AU-QLD'],
            };
            totalYielded++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[qld-grants] Error fetching resource ${resourceId}: ${msg}`);
        }
      }

      console.log(`[qld-grants] Yielded ${totalYielded} grants from ${agencyResourceIds.length} agencies`);
    },
  };
}
