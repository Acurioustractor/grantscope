/**
 * Grant Monitor Agent
 *
 * Daily check of known grant portals for new/changed grants.
 * Uses the existing source plugins (GrantConnect, QLD Grants, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentConfig, AgentRunResult } from './agent-runner.ts';
import { SourceRegistry } from '../sources/registry.ts';
import { createGrantConnectPlugin } from '../sources/grantconnect.ts';
import { createQLDGrantsPlugin } from '../sources/qld-grants.ts';
import { createDataGovAuPlugin } from '../sources/data-gov-au.ts';
import { normalize } from '../normalizer.ts';

export function createGrantMonitor(): AgentConfig {
  return {
    id: 'grant-monitor',
    name: 'Grant Monitor',
    schedule: 'daily',
    enabled: true,

    async execute(supabase: SupabaseClient, log: (msg: string) => void): Promise<AgentRunResult> {
      const registry = new SourceRegistry();

      // Register available sources (skip Firecrawl-dependent ones if no key)
      if (process.env.FIRECRAWL_API_KEY) {
        registry.register(createGrantConnectPlugin());
      } else {
        log('Skipping GrantConnect (no FIRECRAWL_API_KEY)');
      }

      registry.register(createQLDGrantsPlugin());
      registry.register(createDataGovAuPlugin());

      let found = 0;
      let newGrants = 0;
      const errors: string[] = [];

      // Get existing grants for dedup
      const { data: existing } = await supabase
        .from('grant_opportunities')
        .select('name, url');

      const existingNames = new Set(
        (existing || []).map(g => g.name?.toLowerCase())
      );
      const existingUrls = new Set(
        (existing || [])
          .map(g => g.url)
          .filter((url): url is string => typeof url === 'string' && url.length > 0)
      );

      for await (const event of registry.discoverAll({ status: 'open' })) {
        if (event.kind !== 'grant') continue;
        found++;

        // Check if this is new
        const grant = event.grant;
        const normalized = normalize(grant);
        if (existingNames.has(normalized.name.toLowerCase())) continue;
        if (normalized.url && existingUrls.has(normalized.url)) continue;

        // Insert new grant
        const { error } = await supabase.from('grant_opportunities').insert({
          name: normalized.name,
          provider: normalized.provider,
          program: normalized.program,
          source: grant.sourceId || normalized.provider || 'unknown',
          amount_min: normalized.amountMin,
          amount_max: normalized.amountMax,
          closes_at: normalized.closesAt,
          url: normalized.url,
          description: normalized.description,
          categories: normalized.categories,
          geography: normalized.geography,
          discovery_method: grant.sourceId,
          sources: [{ pluginId: grant.sourceId, foundAt: new Date().toISOString() }],
        });

        if (error) {
          if (/duplicate key value/i.test(error.message)) {
            if (normalized.url) existingUrls.add(normalized.url);
            existingNames.add(normalized.name.toLowerCase());
            continue;
          }
          errors.push(`Insert failed for "${grant.title}": ${error.message}`);
        } else {
          newGrants++;
          existingNames.add(normalized.name.toLowerCase());
          if (normalized.url) existingUrls.add(normalized.url);
          log(`New grant: ${grant.title}`);
        }
      }

      return { itemsFound: found, itemsNew: newGrants, itemsUpdated: 0, errors };
    },
  };
}
