/**
 * Grant Repository
 *
 * Supabase CRUD operations for grants, discovery runs, and source plugins.
 * Handles upsert logic and source tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanonicalGrant, DiscoveryRunResult, ExistingGrantRecord, GrantApplicationStatus, GrantSource } from '../types';

const AUSTRALIA_TIME_ZONE = 'Australia/Brisbane';

function todayInAustralia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AUSTRALIA_TIME_ZONE,
  }).format(new Date());
}

function resolveGrantStatuses(
  applicationStatus: GrantApplicationStatus | null | undefined,
  closesAt: string | null | undefined,
): { status: string; applicationStatus: string } {
  if (applicationStatus === 'closed') {
    return { status: 'closed', applicationStatus };
  }

  if (applicationStatus === 'upcoming') {
    return { status: 'closed', applicationStatus };
  }

  if (applicationStatus === 'ongoing' || applicationStatus === 'unknown') {
    return { status: applicationStatus, applicationStatus };
  }

  if (applicationStatus === 'open') {
    return { status: 'open', applicationStatus };
  }

  if (!closesAt) {
    return { status: 'open', applicationStatus: 'open' };
  }

  return closesAt < todayInAustralia()
    ? { status: 'closed', applicationStatus: 'closed' }
    : { status: 'open', applicationStatus: 'open' };
}

export function resolveCanonicalSourceIdentity(
  existingSourceId: string | null | undefined,
  incomingDiscoveryMethod: string | null | undefined,
): { sourceId: string | null; discoveryMethod: string | null } {
  const currentSourceId = existingSourceId?.trim() || null;
  const incomingSourceId = incomingDiscoveryMethod?.trim() || null;
  const canonicalSourceId = currentSourceId && !currentSourceId.includes('::duplicate::')
    ? currentSourceId
    : incomingSourceId;

  return {
    sourceId: canonicalSourceId ?? null,
    discoveryMethod: canonicalSourceId ?? incomingSourceId ?? null,
  };
}

function confidenceScore(confidence: GrantSource['confidence']): number {
  if (confidence === 'verified') return 3;
  if (confidence === 'scraped') return 2;
  return 1;
}

function normalizeExistingSources(existingSources: unknown): GrantSource[] {
  let parsedSources = existingSources;

  if (typeof existingSources === 'string') {
    try {
      parsedSources = JSON.parse(existingSources);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedSources)) return [];

  return parsedSources.filter((source): source is GrantSource => {
    if (!source || typeof source !== 'object') return false;
    const maybeSource = source as Partial<GrantSource>;
    return typeof maybeSource.pluginId === 'string'
      && typeof maybeSource.foundAt === 'string'
      && (maybeSource.confidence === 'verified' || maybeSource.confidence === 'scraped' || maybeSource.confidence === 'llm_knowledge');
  });
}

export function mergeGrantSources(existingSources: unknown, incomingSources: GrantSource[]): GrantSource[] {
  const merged = new Map<string, GrantSource>();

  for (const source of normalizeExistingSources(existingSources)) {
    merged.set(source.pluginId, source);
  }

  for (const incomingSource of incomingSources) {
    const existingSource = merged.get(incomingSource.pluginId);
    if (!existingSource) {
      merged.set(incomingSource.pluginId, incomingSource);
      continue;
    }

    merged.set(incomingSource.pluginId, {
      pluginId: incomingSource.pluginId,
      foundAt: new Date(incomingSource.foundAt) > new Date(existingSource.foundAt)
        ? incomingSource.foundAt
        : existingSource.foundAt,
      rawUrl: existingSource.rawUrl || incomingSource.rawUrl,
      confidence: confidenceScore(incomingSource.confidence) >= confidenceScore(existingSource.confidence)
        ? incomingSource.confidence
        : existingSource.confidence,
    });
  }

  return [...merged.values()];
}

export class GrantRepository {
  constructor(private supabase: SupabaseClient) {}

  private buildGrantRow(grant: CanonicalGrant) {
    const statuses = resolveGrantStatuses(grant.applicationStatus, grant.closesAt);
    return {
      name: grant.name,
      provider: grant.provider,
      program: grant.program,
      description: grant.description,
      amount_min: grant.amountMin,
      amount_max: grant.amountMax,
      closes_at: grant.closesAt,
      url: grant.url,
      categories: grant.categories,
      sources: grant.sources,
      discovery_method: grant.discoveryMethod,
      source_id: grant.discoveryMethod || null,
      last_verified_at: grant.sources.some(s => s.confidence === 'verified')
        ? new Date().toISOString()
        : null,
      discovered_by: 'grant_engine',
      source: grant.discoveryMethod || 'grant_engine',
      application_status: statuses.applicationStatus,
      status: statuses.status,
    };
  }

  private buildGrantUpdateRow(
    grant: CanonicalGrant,
    existingClosesAt: string | null = null,
    existingSourceId: string | null = null,
    existingSources: unknown = null,
  ): Record<string, unknown> {
    const statuses = resolveGrantStatuses(grant.applicationStatus, grant.closesAt);
    const sourceIdentity = resolveCanonicalSourceIdentity(existingSourceId, grant.discoveryMethod);
    const mergedSources = mergeGrantSources(existingSources, grant.sources);
    const updateRow: Record<string, unknown> = {
      sources: mergedSources,
      discovery_method: sourceIdentity.discoveryMethod,
      source_id: sourceIdentity.sourceId,
      last_verified_at: new Date().toISOString(),
      application_status: statuses.applicationStatus,
      status: statuses.status,
    };
    if (grant.description) updateRow.description = grant.description;
    if (grant.closesAt) updateRow.closes_at = grant.closesAt;
    if (!grant.closesAt && existingClosesAt && existingClosesAt < todayInAustralia() && statuses.applicationStatus === 'open') {
      updateRow.closes_at = null;
    }
    return updateRow;
  }

  async updateExistingGrant(grant: CanonicalGrant): Promise<'updated' | 'skipped'> {
    if (!grant.url) return 'skipped';
    const { data: existingGrant, error: existingError } = await this.supabase
      .from('grant_opportunities')
      .select('id, closes_at, source_id, sources')
      .eq('url', grant.url)
      .neq('status', 'duplicate')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error(`Failed to load existing grant "${grant.name}": ${existingError.message}`);
      return 'skipped';
    }

    if (!existingGrant?.id) {
      console.error(`Failed to locate canonical existing grant "${grant.name}" for URL update`);
      return 'skipped';
    }

    const updateRow = this.buildGrantUpdateRow(
      grant,
      existingGrant.closes_at ?? null,
      existingGrant.source_id ?? null,
      existingGrant.sources ?? null,
    );

    const { error, count } = await this.supabase
      .from('grant_opportunities')
      .update(updateRow, { count: 'exact' })
      .eq('id', existingGrant.id);

    if (error) {
      console.error(`Failed to update existing grant "${grant.name}": ${error.message}`);
      return 'skipped';
    }

    return count && count > 0 ? 'updated' : 'skipped';
  }

  /**
   * Mark abandoned runs as failed so run history reflects reality.
   */
  async cleanupStaleRuns(maxAgeMs = 6 * 60 * 60 * 1000): Promise<number> {
    const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
    const { data, error } = await this.supabase
      .from('grant_discovery_runs')
      .select('id')
      .eq('status', 'running')
      .is('completed_at', null)
      .lt('started_at', cutoffIso);

    if (error) throw new Error(`Failed to fetch stale discovery runs: ${error.message}`);
    if (!data?.length) return 0;

    const completedAt = new Date().toISOString();
    const hours = Math.round(maxAgeMs / (60 * 60 * 1000));
    const staleIds = data.map(row => row.id);
    const { error: updateError } = await this.supabase
      .from('grant_discovery_runs')
      .update({
        completed_at: completedAt,
        status: 'failed',
        errors: [{ source: 'system', error: `Marked stale after exceeding ${hours}h without completion` }],
      })
      .in('id', staleIds);

    if (updateError) throw new Error(`Failed to close stale discovery runs: ${updateError.message}`);
    return staleIds.length;
  }

  /**
   * Get existing grants for dedup comparison.
   */
  async getExistingGrants(): Promise<ExistingGrantRecord[]> {
    const pageSize = 1000;
    const rows: ExistingGrantRecord[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from('grant_opportunities')
        .select('url, name')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Failed to fetch existing grants: ${error.message}`);
      const batch = (data || []) as ExistingGrantRecord[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }

  /**
   * Upsert a canonical grant. Returns true if inserted (new), false if skipped.
   */
  async upsertGrant(grant: CanonicalGrant): Promise<'inserted' | 'updated' | 'skipped'> {
    const row = this.buildGrantRow(grant);

    // Try insert first
    const { error } = await this.supabase
      .from('grant_opportunities')
      .insert(row);

    if (!error) return 'inserted';

    // Log insert error for debugging
    console.error(`[repository] Insert failed for "${grant.name}": ${error.message} (code: ${error.code})`);

    // Duplicate URL — try to update with new source info
    if (error.code === '23505' && grant.url) {
      return this.updateExistingGrant(grant);
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
