/**
 * Government Spend Watcher Agent
 *
 * Quarterly check for new budget papers and annual reports.
 * Searches data.gov.au CKAN for updated government spending datasets.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentConfig, AgentRunResult } from './agent-runner.js';

const CKAN_BASE = 'https://data.gov.au/data/api/3/action';

const SPEND_SEARCH_TERMS = [
  'budget appropriation',
  'government expenditure',
  'department spending',
  'youth justice budget',
  'health expenditure',
  'education spending',
];

interface CKANPackage {
  id: string;
  title: string;
  notes: string;
  organization: { title: string };
  metadata_modified: string;
  resources: Array<{ url: string; format: string; name: string }>;
}

export function createGovernmentSpendWatcher(): AgentConfig {
  return {
    id: 'government-spend',
    name: 'Government Spend Watcher',
    schedule: 'quarterly',
    enabled: true,

    async execute(supabase: SupabaseClient, log: (msg: string) => void): Promise<AgentRunResult> {
      let found = 0;
      let newItems = 0;
      const errors: string[] = [];
      const seen = new Set<string>();

      for (const term of SPEND_SEARCH_TERMS) {
        try {
          const params = new URLSearchParams({
            q: term,
            rows: '20',
            sort: 'metadata_modified desc',
          });

          const response = await fetch(`${CKAN_BASE}/package_search?${params}`);
          if (!response.ok) {
            errors.push(`CKAN search failed for "${term}": ${response.status}`);
            continue;
          }

          const data = await response.json() as {
            success: boolean;
            result: { count: number; results: CKANPackage[] };
          };

          if (!data.success) continue;

          log(`"${term}": ${data.result.count} results`);

          for (const pkg of data.result.results) {
            if (seen.has(pkg.id)) continue;
            seen.add(pkg.id);
            found++;

            // Check if we already have this dataset tracked
            const { data: existing } = await supabase
              .from('government_programs')
              .select('id')
              .eq('source_url', `https://data.gov.au/data/dataset/${pkg.id}`)
              .limit(1);

            if (existing?.length) continue;

            // Check if this looks like a budget/spending dataset
            const text = `${pkg.title} ${pkg.notes || ''}`.toLowerCase();
            const isBudget = /budget|expenditure|appropriation|spending|allocation/i.test(text);
            if (!isBudget) continue;

            // Determine domain
            let domain = 'general';
            if (/youth|justice|corrective/.test(text)) domain = 'youth_justice';
            else if (/health|medical/.test(text)) domain = 'health';
            else if (/education|school/.test(text)) domain = 'education';
            else if (/indigenous|first nations/.test(text)) domain = 'indigenous';

            // Determine jurisdiction
            let jurisdiction = 'federal';
            if (/queensland|qld/.test(text)) jurisdiction = 'qld';
            else if (/new south wales|nsw/.test(text)) jurisdiction = 'nsw';
            else if (/victoria|vic/.test(text)) jurisdiction = 'vic';
            else if (/western australia|wa/.test(text)) jurisdiction = 'wa';

            const { error } = await supabase.from('government_programs').insert({
              name: pkg.title.slice(0, 200),
              department: pkg.organization?.title || 'Unknown',
              jurisdiction,
              domain,
              source_url: `https://data.gov.au/data/dataset/${pkg.id}`,
              source_type: 'ckan',
              scraped_at: new Date().toISOString(),
            });

            if (error) {
              errors.push(`Insert failed for "${pkg.title}": ${error.message}`);
            } else {
              newItems++;
              log(`New dataset: ${pkg.title}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Search error for "${term}": ${msg}`);
        }
      }

      return { itemsFound: found, itemsNew: newItems, itemsUpdated: 0, errors };
    },
  };
}
