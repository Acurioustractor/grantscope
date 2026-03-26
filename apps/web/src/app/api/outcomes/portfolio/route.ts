import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/outcomes/portfolio — PRF portfolio outcomes dashboard
 *
 * Returns funding → outcomes chain status for PRF Justice Reinvestment partners.
 * Optional ?program= filter for other funding programs.
 */
export async function GET(request: NextRequest) {
  const program =
    request.nextUrl.searchParams.get('program') ||
    'PRF Justice Reinvestment Portfolio';

  const db = getServiceSupabase();

  // Query the PRF portfolio outcomes view
  const { data: portfolio, error: pErr } = await db.rpc('exec_sql', {
    query: `SELECT * FROM v_prf_portfolio_outcomes`,
  });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // Get summary stats from mv_funding_outcomes_summary for the portfolio
  const { data: summary, error: sErr } = await db.rpc('exec_sql', {
    query: `
      SELECT
        outcomes_status,
        COUNT(*) as entity_count,
        SUM(total_funding) as total_funding,
        AVG(proof_completeness) as avg_proof_completeness
      FROM mv_funding_outcomes_summary
      WHERE entity_id IN (
        SELECT gs_entity_id FROM justice_funding
        WHERE program_name = '${program.replace(/'/g, "''")}'
      )
      GROUP BY outcomes_status
      ORDER BY entity_count DESC
    `,
  });

  // Get pending tasks
  const { data: tasks, error: tErr } = await db.rpc('exec_sql', {
    query: `
      SELECT
        status,
        COUNT(*) as count
      FROM governed_proof_tasks
      WHERE target_id IN (
        SELECT gs_id FROM gs_entities
        WHERE id IN (
          SELECT gs_entity_id FROM justice_funding
          WHERE program_name = '${program.replace(/'/g, "''")}'
        )
      )
      GROUP BY status
    `,
  });

  return NextResponse.json({
    program,
    partners: portfolio || [],
    summary: summary || [],
    tasks: tasks || [],
    meta: {
      total_partners: (portfolio || []).length,
      proven: (portfolio || []).filter(
        (p: Record<string, unknown>) => p.status === 'proven',
      ).length,
      evidence_exists: (portfolio || []).filter(
        (p: Record<string, unknown>) => p.status === 'evidence_exists',
      ).length,
      awaiting: (portfolio || []).filter(
        (p: Record<string, unknown>) => p.status === 'awaiting_submission',
      ).length,
    },
  });
}
