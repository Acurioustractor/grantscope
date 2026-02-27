/**
 * Grant Repository
 *
 * Supabase CRUD operations for grants, discovery runs, and source plugins.
 * Handles upsert logic and source tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanonicalGrant, DiscoveryRunResult, ExistingGrantRecord } from '../types.js';

export class GrantRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get existing grants for dedup comparison.
   */
  async getExistingGrants(): Promise<ExistingGrantRecord[]> {
    const { data, error } = await this.supabase
      .from('grant_opportunities')
      .select('url, name');

    if (error) throw new Error(`Failed to fetch existing grants: ${error.message}`);
    return (data || []) as ExistingGrantRecord[];
  }

  /**
   * Upsert a canonical grant. Returns true if inserted (new), false if skipped.
   */
  async upsertGrant(grant: CanonicalGrant): Promise<'inserted' | 'updated' | 'skipped'> {
    const row = {
      name: grant.name,
      provider: grant.provider,
      program: grant.program,
      amount_min: grant.amountMin,
      amount_max: grant.amountMax,
      currency: grant.currency,
      closes_at: grant.closesAt,
      url: grant.url,
      categories: grant.categories,
      sources: JSON.stringify(grant.sources),
      discovery_method: grant.discoveryMethod,
      last_verified_at: grant.sources.some(s => s.confidence === 'verified')
        ? new Date().toISOString()
        : null,
      discovered_by: 'grant_engine',
    };

    // Try insert first
    const { error } = await this.supabase
      .from('grant_opportunities')
      .insert(row);

    if (!error) return 'inserted';

    // Duplicate URL — try to update with new source info
    if (error.code === '23505' && grant.url) {
      const { error: updateError } = await this.supabase
        .from('grant_opportunities')
        .update({
          sources: JSON.stringify(grant.sources),
          discovery_method: grant.discoveryMethod,
          last_verified_at: new Date().toISOString(),
        })
        .eq('url', grant.url);

      if (!updateError) return 'updated';
    }

    return 'skipped';
  }

  /**
   * Start a discovery run and return the run ID.
   */
  async startRun(sourcesUsed: string[]): Promise<string> {
    const { data, error } = await this.supabase
      .from('grant_discovery_runs')
      .insert({
        sources_used: sourcesUsed,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to start discovery run: ${error.message}`);
    return data.id;
  }

  /**
   * Complete a discovery run with stats.
   */
  async completeRun(runId: string, result: Partial<DiscoveryRunResult>): Promise<void> {
    const { error } = await this.supabase
      .from('grant_discovery_runs')
      .update({
        completed_at: new Date().toISOString(),
        grants_discovered: result.grantsDiscovered || 0,
        grants_new: result.grantsNew || 0,
        grants_updated: result.grantsUpdated || 0,
        errors: result.errors || [],
        status: result.status || 'completed',
      })
      .eq('id', runId);

    if (error) {
      console.error(`Failed to complete discovery run: ${error.message}`);
    }
  }

  /**
   * Update source plugin stats after a run.
   */
  async updatePluginStats(pluginId: string, discovered: number, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('grant_source_plugins')
      .upsert({
        id: pluginId,
        name: pluginId,
        type: 'auto',
        last_run_at: new Date().toISOString(),
        last_run_status: status,
        total_discovered: discovered,
      }, { onConflict: 'id' });

    if (error) {
      console.error(`Failed to update plugin stats for ${pluginId}: ${error.message}`);
    }
  }

  /**
   * Search grants with keyword and filters.
   */
  async searchGrants(filters: {
    keyword?: string;
    categories?: string[];
    geography?: string[];
    minAmount?: number;
    maxAmount?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: unknown[]; count: number }> {
    let query = this.supabase
      .from('grant_opportunities')
      .select('*', { count: 'exact' });

    if (filters.keyword) {
      query = query.or(`name.ilike.%${filters.keyword}%,provider.ilike.%${filters.keyword}%`);
    }

    if (filters.categories?.length) {
      query = query.overlaps('categories', filters.categories);
    }

    if (filters.minAmount) {
      query = query.gte('amount_max', filters.minAmount);
    }

    if (filters.maxAmount) {
      query = query.lte('amount_min', filters.maxAmount);
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    query = query
      .order('closes_at', { ascending: true, nullsFirst: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Search failed: ${error.message}`);
    return { data: data || [], count: count || 0 };
  }
}
