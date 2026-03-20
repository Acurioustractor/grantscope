import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Political Money API — donations data cross-referenced with contracts.
 *
 * GET /api/data/political-money
 *   Returns all sections needed for the Political Money report page:
 *   - Summary stats
 *   - Party funding breakdown
 *   - Top donors
 *   - Pay-to-play (donors who also hold contracts)
 *   - Donations by financial year
 */

interface DonorRow {
  donor_name: string;
  donor_abn: string | null;
  total: string;
  parties: string;
  years_active: string;
  party_list: string;
}

interface PartyRow {
  donation_to: string;
  total: string;
  donors: string;
  avg_donation: string;
}

interface YearRow {
  financial_year: string;
  total: string;
  donors: string;
}

interface PayToPlayRaw {
  gs_id: string;
  canonical_name: string;
  entity_type: string;
  abn: string;
  state: string | null;
  donation_dollars: number;
  procurement_dollars: number;
  distinct_parties_funded: number;
  contract_count: number;
  revolving_door_score: number;
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Run all queries in parallel — no JOINs between large tables
    const [
      summaryResult,
      partyResult,
      topDonorsResult,
      yearResult,
      payToPlayResult,
    ] = await Promise.all([
      // 1. Summary stats
      supabase.rpc('exec_sql', {
        query: `SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT donor_name) as unique_donors,
          ROUND(SUM(amount)) as total_amount,
          COUNT(DISTINCT donor_abn) FILTER (WHERE donor_abn IS NOT NULL) as donors_with_abn,
          MIN(financial_year) as min_year,
          MAX(financial_year) as max_year
        FROM political_donations`,
      }),

      // 2. Party funding breakdown — top 20
      supabase.rpc('exec_sql', {
        query: `SELECT
          donation_to,
          ROUND(SUM(amount)) as total,
          COUNT(DISTINCT donor_name) as donors,
          ROUND(AVG(amount)) as avg_donation
        FROM political_donations
        WHERE donation_to IS NOT NULL
        GROUP BY donation_to
        ORDER BY total DESC
        LIMIT 20`,
      }),

      // 3. Top donors — top 50 by total
      supabase.rpc('exec_sql', {
        query: `SELECT
          donor_name,
          donor_abn,
          ROUND(SUM(amount)) as total,
          COUNT(DISTINCT donation_to) as parties,
          COUNT(DISTINCT financial_year) as years_active,
          STRING_AGG(DISTINCT donation_to, ', ' ORDER BY donation_to) as party_list
        FROM political_donations
        GROUP BY donor_name, donor_abn
        ORDER BY total DESC
        LIMIT 50`,
      }),

      // 4. Donations by financial year
      supabase.rpc('exec_sql', {
        query: `SELECT
          financial_year,
          ROUND(SUM(amount)) as total,
          COUNT(DISTINCT donor_name) as donors
        FROM political_donations
        GROUP BY financial_year
        ORDER BY financial_year`,
      }),

      // 5. Pay-to-play: entities that both donate and hold contracts
      // Use mv_revolving_door which already has this cross-reference
      supabase
        .from('mv_revolving_door')
        .select('gs_id, canonical_name, entity_type, abn, state, donation_dollars, procurement_dollars, distinct_parties_funded, contract_count, revolving_door_score')
        .eq('in_political_donations', true)
        .eq('in_procurement', true)
        .gt('donation_dollars', 0)
        .gt('procurement_dollars', 0)
        .order('procurement_dollars', { ascending: false })
        .limit(100),
    ]);

    // Parse results
    const summary = (summaryResult.data as Record<string, string>[])?.[0] || {};
    const parties = (partyResult.data as PartyRow[]) || [];
    const topDonors = (topDonorsResult.data as DonorRow[]) || [];
    const byYear = (yearResult.data as YearRow[]) || [];
    const payToPlayRaw = (payToPlayResult.data || []) as PayToPlayRaw[];

    // Compute pay-to-play ratio
    const payToPlay = payToPlayRaw.map(e => ({
      ...e,
      ratio: Number(e.donation_dollars) > 0
        ? Math.round(Number(e.procurement_dollars) / Number(e.donation_dollars))
        : 0,
    }));

    // Count pay-to-play totals
    const payToPlayCount = payToPlay.length;
    const payToPlayDonationTotal = payToPlay.reduce((sum, e) => sum + Number(e.donation_dollars), 0);
    const payToPlayContractTotal = payToPlay.reduce((sum, e) => sum + Number(e.procurement_dollars), 0);

    // Cross-reference top donors with contract ABNs
    const payToPlayAbns = new Set(payToPlay.map(e => e.abn));
    const topDonorsWithContracts = topDonors.map(d => ({
      ...d,
      has_contracts: d.donor_abn ? payToPlayAbns.has(d.donor_abn) : false,
      contract_entity: d.donor_abn ? payToPlay.find(e => e.abn === d.donor_abn) : null,
    }));

    const response = NextResponse.json({
      summary: {
        total_records: Number(summary.total_records) || 0,
        unique_donors: Number(summary.unique_donors) || 0,
        total_amount: Number(summary.total_amount) || 0,
        donors_with_abn: Number(summary.donors_with_abn) || 0,
        min_year: summary.min_year || '',
        max_year: summary.max_year || '',
        pay_to_play_count: payToPlayCount,
        pay_to_play_donation_total: payToPlayDonationTotal,
        pay_to_play_contract_total: payToPlayContractTotal,
      },
      parties,
      top_donors: topDonorsWithContracts,
      by_year: byYear,
      pay_to_play: payToPlay,
      meta: {
        generated: new Date().toISOString(),
        sources: ['political_donations (AEC)', 'mv_revolving_door (cross-referenced)'],
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
