/**
 * GrantScope Discovery Engine
 *
 * Main orchestrator that ties sources, normalization, dedup, and storage together.
 *
 * Usage:
 *   const engine = new GrantEngine({
 *     supabase,
 *     sources: ['grantconnect', 'web-search'],
 *   });
 *   const result = await engine.discover({ geography: ['AU'] });
 */

import type {
  GrantEngineConfig,
  DiscoveryQuery,
  DiscoveryRunResult,
  CanonicalGrant,
  GrantScorer,
} from './types';
import { SourceRegistry } from './sources/registry';
import { normalize } from './normalizer';
import { deduplicateGrants, filterExisting } from './deduplicator';
import { GrantRepository } from './storage/repository';
import { createWebSearchPlugin } from './sources/web-search';
import { createLLMKnowledgePlugin } from './sources/llm-knowledge';
import { createGrantConnectPlugin } from './sources/grantconnect';
import { createDataGovAuPlugin } from './sources/data-gov-au';
import { createQLDGrantsPlugin } from './sources/qld-grants';
import { createBusinessGovAuPlugin } from './sources/business-gov-au';
import { createNSWGrantsPlugin } from './sources/nsw-grants';
import { createVICGrantsPlugin } from './sources/vic-grants';
import { createARCGrantsPlugin } from './sources/arc-grants';
import { createNHMRCGrantsPlugin } from './sources/nhmrc-grants';
import { createTASGrantsPlugin } from './sources/tas-grants';
import { createACTGrantsPlugin } from './sources/act-grants';
import { createNTGrantsPlugin } from './sources/nt-grants';
import { createSAGrantsPlugin } from './sources/sa-grants';
import { createWAGrantsPlugin } from './sources/wa-grants';

export class GrantEngine {
  private registry: SourceRegistry;
  private repo: GrantRepository;
  private config: GrantEngineConfig;

  constructor(config: GrantEngineConfig) {
    this.config = config;
    this.registry = new SourceRegistry();
    this.repo = new GrantRepository(config.supabase);

    // Register built-in plugins
    this.registry.register(createGrantConnectPlugin());
    this.registry.register(createWebSearchPlugin());
    this.registry.register(createLLMKnowledgePlugin());
    this.registry.register(createDataGovAuPlugin());
    this.registry.register(createQLDGrantsPlugin());
    this.registry.register(createBusinessGovAuPlugin());
    this.registry.register(createNSWGrantsPlugin());
    this.registry.register(createVICGrantsPlugin());
    this.registry.register(createARCGrantsPlugin());
    this.registry.register(createNHMRCGrantsPlugin());
    this.registry.register(createTASGrantsPlugin());
    this.registry.register(createACTGrantsPlugin());
    this.registry.register(createNTGrantsPlugin());
    this.registry.register(createSAGrantsPlugin());
    this.registry.register(createWAGrantsPlugin());
  }

  private log(message: string): void {
    if (this.config.onProgress) {
      this.config.onProgress(message);
    }
    console.log(message);
  }

  /**
   * Run full discovery pipeline:
   * 1. Run source plugins
   * 2. Normalize raw grants
   * 3. Deduplicate across sources
   * 4. Filter against existing DB records
   * 5. Optionally score
   * 6. Upsert to database
   */
  async discover(query: DiscoveryQuery = {}): Promise<DiscoveryRunResult> {
    const startedAt = new Date().toISOString();
    const sourcesUsed = this.config.sources || ['grantconnect', 'web-search', 'llm-knowledge'];

    // Start run record
    let runId: string;
    try {
      runId = await this.repo.startRun(sourcesUsed);
    } catch {
      runId = crypto.randomUUID();
    }

    this.log(`[GrantScope] Discovery run ${runId.slice(0, 8)}`);
    this.log(`[GrantScope] Sources: ${sourcesUsed.join(', ')}`);

    // Step 1: Discover from all sources
    const allRaw: CanonicalGrant[] = [];
    const errors: Array<{ source: string; error: string }> = [];
    const pluginStats = new Map<string, number>();

    for await (const { grant, stats } of this.registry.discoverAll(query, sourcesUsed)) {
      const canonical = normalize(grant);
      allRaw.push(canonical);

      const current = pluginStats.get(stats.source) || 0;
      pluginStats.set(stats.source, current + 1);

      if (stats.errors.length > 0) {
        for (const err of stats.errors) {
          errors.push({ source: stats.source, error: err });
        }
      }
    }

    this.log(`[GrantScope] Discovered ${allRaw.length} raw grants`);

    // Step 2: Deduplicate across sources
    const deduped = deduplicateGrants(allRaw);
    this.log(`[GrantScope] After dedup: ${deduped.length} unique grants (${allRaw.length - deduped.length} merged)`);

    // Step 3: Filter against existing DB records
    let grantsNew = 0;
    let grantsUpdated = 0;

    if (!this.config.dryRun) {
      const existing = await this.repo.getExistingGrants();
      const { newGrants, duplicates } = filterExisting(deduped, existing);
      this.log(`[GrantScope] ${newGrants.length} new, ${duplicates} already in DB`);

      // Step 4: Upsert new grants
      for (const grant of newGrants) {
        const result = await this.repo.upsertGrant(grant);
        if (result === 'inserted') {
          grantsNew++;
          this.log(`  + ${grant.name} (${grant.provider})`);
        } else if (result === 'updated') {
          grantsUpdated++;
        }
      }

      // Also try to update existing grants with new source info
      for (const grant of deduped) {
        if (!newGrants.includes(grant) && grant.url) {
          const result = await this.repo.upsertGrant(grant);
          if (result === 'updated') grantsUpdated++;
        }
      }
    } else {
      this.log('[GrantScope] DRY RUN — would insert:');
      for (const grant of deduped) {
        this.log(`  ${grant.name} — ${grant.provider} — ${grant.url || 'no URL'}`);
      }
      grantsNew = deduped.length;
    }

    // Step 5: Update plugin stats
    for (const [pluginId, count] of pluginStats) {
      try {
        await this.repo.updatePluginStats(pluginId, count, 'success');
      } catch {
        // Non-critical
      }
    }

    // Step 6: Complete run record
    const completedAt = new Date().toISOString();
    const result: DiscoveryRunResult = {
      runId,
      startedAt,
      completedAt,
      sourcesUsed,
      grantsDiscovered: allRaw.length,
      grantsNew,
      grantsUpdated,
      errors,
      status: errors.length > 0 ? 'partial' : 'completed',
    };

    try {
      await this.repo.completeRun(runId, result);
    } catch {
      // Non-critical
    }

    this.log(`[GrantScope] Complete: ${grantsNew} new, ${grantsUpdated} updated, ${errors.length} errors`);
    return result;
  }

  /**
   * Get the underlying registry for custom plugin registration.
   */
  getRegistry(): SourceRegistry {
    return this.registry;
  }

  /**
   * Get the repository for direct queries.
   */
  getRepository(): GrantRepository {
    return this.repo;
  }
}
