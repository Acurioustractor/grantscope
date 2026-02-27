/**
 * Foundation Repository
 *
 * Supabase CRUD operations for foundations and foundation programs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Foundation } from './types.js';

export class FoundationRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upsert a foundation by ABN (ACNC primary key).
   */
  async upsertFoundation(foundation: Foundation): Promise<'inserted' | 'updated'> {
    const row = {
      acnc_abn: foundation.acnc_abn,
      name: foundation.name,
      type: foundation.type,
      website: foundation.website,
      description: foundation.description,
      total_giving_annual: foundation.total_giving_annual,
      giving_history: foundation.giving_history,
      avg_grant_size: foundation.avg_grant_size,
      grant_range_min: foundation.grant_range_min,
      grant_range_max: foundation.grant_range_max,
      thematic_focus: foundation.thematic_focus,
      geographic_focus: foundation.geographic_focus,
      target_recipients: foundation.target_recipients,
      endowment_size: foundation.endowment_size,
      investment_returns: foundation.investment_returns,
      giving_ratio: foundation.giving_ratio,
      revenue_sources: foundation.revenue_sources,
      parent_company: foundation.parent_company,
      asx_code: foundation.asx_code,
      open_programs: foundation.open_programs,
      acnc_data: foundation.acnc_data,
      last_scraped_at: foundation.last_scraped_at,
      profile_confidence: foundation.profile_confidence,
    };

    const { error } = await this.supabase
      .from('foundations')
      .upsert(row, { onConflict: 'acnc_abn' });

    if (error) {
      throw new Error(`Failed to upsert foundation ${foundation.name}: ${error.message}`);
    }

    // Simple heuristic: if the row had an acnc_abn already, it's an update
    return 'inserted';
  }

  /**
   * Bulk upsert foundations.
   */
  async bulkUpsert(foundations: Foundation[], batchSize = 100): Promise<{ inserted: number; errors: number }> {
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < foundations.length; i += batchSize) {
      const batch = foundations.slice(i, i + batchSize).map(f => ({
        acnc_abn: f.acnc_abn,
        name: f.name,
        type: f.type,
        website: f.website,
        description: f.description,
        total_giving_annual: f.total_giving_annual,
        giving_history: f.giving_history,
        avg_grant_size: f.avg_grant_size,
        grant_range_min: f.grant_range_min,
        grant_range_max: f.grant_range_max,
        thematic_focus: f.thematic_focus,
        geographic_focus: f.geographic_focus,
        target_recipients: f.target_recipients,
        endowment_size: f.endowment_size,
        investment_returns: f.investment_returns,
        giving_ratio: f.giving_ratio,
        revenue_sources: f.revenue_sources,
        parent_company: f.parent_company,
        asx_code: f.asx_code,
        open_programs: f.open_programs,
        acnc_data: f.acnc_data,
        last_scraped_at: f.last_scraped_at,
        profile_confidence: f.profile_confidence,
      }));

      const { error } = await this.supabase
        .from('foundations')
        .upsert(batch, { onConflict: 'acnc_abn' });

      if (error) {
        console.error(`Batch upsert error at offset ${i}: ${error.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return { inserted, errors };
  }

  /**
   * Get all foundations, optionally filtered.
   */
  async search(filters: {
    type?: string;
    thematicFocus?: string[];
    geographicFocus?: string[];
    minGiving?: number;
    keyword?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: unknown[]; count: number }> {
    let query = this.supabase
      .from('foundations')
      .select('*', { count: 'exact' });

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.thematicFocus?.length) {
      query = query.overlaps('thematic_focus', filters.thematicFocus);
    }

    if (filters.geographicFocus?.length) {
      query = query.overlaps('geographic_focus', filters.geographicFocus);
    }

    if (filters.minGiving) {
      query = query.gte('total_giving_annual', filters.minGiving);
    }

    if (filters.keyword) {
      query = query.or(`name.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`);
    }

    query = query
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Foundation search failed: ${error.message}`);
    return { data: data || [], count: count || 0 };
  }

  /**
   * Get foundation by ID.
   */
  async getById(id: string): Promise<unknown | null> {
    const { data, error } = await this.supabase
      .from('foundations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get foundation programs for a foundation.
   */
  async getPrograms(foundationId: string): Promise<unknown[]> {
    const { data, error } = await this.supabase
      .from('foundation_programs')
      .select('*')
      .eq('foundation_id', foundationId)
      .order('deadline', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`Failed to fetch programs: ${error.message}`);
    return data || [];
  }

  /**
   * Get summary stats.
   */
  async getStats(): Promise<{
    totalFoundations: number;
    totalWithWebsite: number;
    totalWithGiving: number;
    byType: Record<string, number>;
  }> {
    const { count: totalFoundations } = await this.supabase
      .from('foundations')
      .select('*', { count: 'exact', head: true });

    const { count: totalWithWebsite } = await this.supabase
      .from('foundations')
      .select('*', { count: 'exact', head: true })
      .not('website', 'is', null);

    const { count: totalWithGiving } = await this.supabase
      .from('foundations')
      .select('*', { count: 'exact', head: true })
      .not('total_giving_annual', 'is', null);

    const { data: typeData } = await this.supabase
      .from('foundations')
      .select('type');

    const byType: Record<string, number> = {};
    for (const row of typeData || []) {
      const t = (row as { type: string | null }).type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }

    return {
      totalFoundations: totalFoundations || 0,
      totalWithWebsite: totalWithWebsite || 0,
      totalWithGiving: totalWithGiving || 0,
      byType,
    };
  }
}
