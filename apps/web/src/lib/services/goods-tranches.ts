import { getServiceSupabase } from '@/lib/supabase';
import {
  rollupByFunder,
  rollupByTrack,
  allocationStats,
  tranchesTotal,
  type TrancheRow,
  type FunderRollup,
  type TrackRollup,
  type AllocationStats,
} from './goods-tranches-shared';

/**
 * Goods on Country — tranche register fetch.
 *
 * Reads goods_tranches (paid Xero ACT-GD invoices, one row per tranche) and
 * rolls them up for the Proof Pack and Money page. Every row is Xero-derived,
 * so the byFunder totals carry a "verified" claim. allocation is still NULL on
 * every seeded row, so allocationStats reports the honest curation gap.
 *
 * Follows the error-honesty pattern in goods-governance.ts: on any failure we
 * return empty rollups plus a fetchError string, never throw at the page.
 */

export interface GoodsTranches {
  /** Raw tranche rows, newest invoice first. */
  rows: TrancheRow[];
  /** Per-funder rollup, biggest total first. */
  byFunder: FunderRollup[];
  /** Per-track totals, biggest total first. */
  byTrack: TrackRollup[];
  /** Allocated versus unallocated tranche counts. */
  allocationStats: AllocationStats;
  /** Grand total across every tranche, in AUD. */
  total: number;
  fetchError: string | null;
}

const EMPTY: GoodsTranches = {
  rows: [],
  byFunder: [],
  byTrack: [],
  allocationStats: { allocated: 0, unallocated: 0, total: 0 },
  total: 0,
  fetchError: null,
};

export async function getGoodsTranches(): Promise<GoodsTranches> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('goods_tranches')
      .select(
        'id, relationship_id, funder_name, xero_invoice_number, amount_aud, invoice_date, funding_track, purpose, allocation, source, notes',
      )
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('[goods-tranches] query failed:', error.message);
      return { ...EMPTY, fetchError: error.message };
    }

    const rows = (data as TrancheRow[] | null) ?? [];
    return {
      rows,
      byFunder: rollupByFunder(rows),
      byTrack: rollupByTrack(rows),
      allocationStats: allocationStats(rows),
      total: tranchesTotal(rows),
      fetchError: null,
    };
  } catch (e) {
    console.error('[goods-tranches] unexpected:', e);
    return { ...EMPTY, fetchError: e instanceof Error ? e.message : 'unexpected error' };
  }
}
