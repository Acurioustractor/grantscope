import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc, validateGsId } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit({ max: 10 }); // Lower limit for heavy queries

const schema = z.object({
  gsId: z.string().min(3).max(100),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const gsId = validateGsId(parsed.data.gsId);
  if (!gsId) return NextResponse.json({ error: 'Invalid gs_id format' }, { status: 400 });

  try {
    const supabase = getServiceSupabase();

    // Get entity base info
    const entity = await safe(supabase.rpc('exec_sql', {
      query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector, state, lga_name, is_community_controlled
         FROM gs_entities WHERE gs_id = '${esc(gsId)}' LIMIT 1`,
    }));

    if (!entity?.[0]) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    const e = entity[0] as { id: string; gs_id: string; canonical_name: string; abn: string | null; entity_type: string; sector: string; state: string; lga_name: string; is_community_controlled: boolean };

    // Run investigation queries in parallel
    const [
      contractAlerts,
      fundingTimeline,
      boardConnections,
      relatedEntities,
      anomalies,
      revolvingDoor,
    ] = await Promise.all([
      // Recent large contracts (>$100K)
      e.abn ? safe(supabase.rpc('exec_sql', {
        query: `SELECT title, contract_value::bigint as value, buyer_name,
                  contract_start, contract_end,
                  CASE WHEN contract_value > 1000000 THEN 'critical'
                       WHEN contract_value > 500000 THEN 'significant'
                       ELSE 'notable' END as severity
           FROM austender_contracts
           WHERE supplier_abn = '${e.abn}' AND contract_value > 100000
           ORDER BY contract_start DESC LIMIT 20`,
      })) : null,

      // Funding timeline by year
      e.abn ? safe(supabase.rpc('exec_sql', {
        query: `SELECT financial_year, program_name, SUM(amount_dollars)::bigint as total, COUNT(*)::int as records
           FROM justice_funding
           WHERE recipient_abn = '${e.abn}'
           GROUP BY financial_year, program_name
           ORDER BY financial_year DESC, total DESC`,
      })) : null,

      // Board member connections — who else do board members serve on?
      e.abn ? safe(supabase.rpc('exec_sql', {
        query: `WITH board AS (
            SELECT DISTINCT person_name FROM person_roles
            WHERE company_abn = '${e.abn}' AND cessation_date IS NULL
          )
          SELECT pr.person_name, pr.company_name, pr.company_abn, pr.role_type,
                 ge.gs_id as linked_gs_id, ge.entity_type as linked_type,
                 ge.is_community_controlled as linked_cc
          FROM board b
          JOIN person_roles pr ON pr.person_name = b.person_name AND pr.company_abn != '${e.abn}'
          LEFT JOIN gs_entities ge ON ge.abn = pr.company_abn
          WHERE pr.cessation_date IS NULL
          ORDER BY pr.person_name, pr.company_name
          LIMIT 50`,
      })) : null,

      // Top related entities by relationship value
      safe(supabase.rpc('exec_sql', {
        query: `SELECT
                  CASE WHEN r.source_entity_id = '${e.id}' THEN t.canonical_name ELSE s.canonical_name END as name,
                  CASE WHEN r.source_entity_id = '${e.id}' THEN t.gs_id ELSE s.gs_id END as gs_id,
                  CASE WHEN r.source_entity_id = '${e.id}' THEN t.entity_type ELSE s.entity_type END as entity_type,
                  r.relationship_type, r.amount::bigint, r.year, r.dataset
           FROM gs_relationships r
           JOIN gs_entities s ON s.id = r.source_entity_id
           JOIN gs_entities t ON t.id = r.target_entity_id
           WHERE (r.source_entity_id = '${e.id}' OR r.target_entity_id = '${e.id}')
             AND r.source_entity_id != r.target_entity_id
           ORDER BY r.amount DESC NULLS LAST
           LIMIT 30`,
      })),

      // Anomaly detection: entities with unusual patterns
      safe(supabase.rpc('exec_sql', {
        query: `SELECT power_score, system_count, total_dollar_flow,
                  procurement_dollars, justice_dollars, donation_dollars,
                  distinct_govt_buyers, distinct_parties_funded
           FROM mv_entity_power_index WHERE id = '${e.id}' LIMIT 1`,
      })),

      // Revolving door check
      safe(supabase.rpc('exec_sql', {
        query: `SELECT influence_vectors, revolving_door_score,
                  lobbies, donates, contracts, receives_funding,
                  total_donated, total_contracts, total_funded
           FROM mv_revolving_door WHERE id = '${e.id}' LIMIT 1`,
      })),
    ]);

    // Build investigation findings
    const findings: Array<{ type: string; severity: string; title: string; detail: string; data?: unknown }> = [];

    // Revolving door alert
    const rd = (revolvingDoor as Array<{ influence_vectors: number; revolving_door_score: number; lobbies: boolean; donates: boolean; contracts: boolean; receives_funding: boolean }>)?.[0];
    if (rd && Number(rd.influence_vectors) >= 2) {
      const vectors = [rd.lobbies && 'lobbying', rd.donates && 'political donations', rd.contracts && 'government contracts', rd.receives_funding && 'government funding'].filter(Boolean);
      findings.push({
        type: 'revolving_door',
        severity: Number(rd.influence_vectors) >= 3 ? 'critical' : 'significant',
        title: `Revolving Door: ${rd.influence_vectors} influence vectors`,
        detail: `Active in: ${vectors.join(', ')}. Score: ${Number(rd.revolving_door_score).toFixed(1)}`,
      });
    }

    // Board interlock alert
    const boardConns = boardConnections as Array<{ person_name: string; company_name: string; linked_gs_id: string }> | null;
    if (boardConns && boardConns.length > 5) {
      const people = [...new Set(boardConns.map(b => b.person_name))];
      findings.push({
        type: 'board_interlock',
        severity: boardConns.length > 15 ? 'significant' : 'notable',
        title: `Board interlocks: ${people.length} directors serve on ${boardConns.length} other boards`,
        detail: `Key people: ${people.slice(0, 5).join(', ')}`,
      });
    }

    // Large contract alerts
    const contracts = contractAlerts as Array<{ title: string; value: number; severity: string; buyer_name: string }> | null;
    const criticalContracts = contracts?.filter(c => c.severity === 'critical') ?? [];
    if (criticalContracts.length > 0) {
      const topTitle = criticalContracts[0]?.title || criticalContracts[0]?.buyer_name || 'Unknown';
      findings.push({
        type: 'large_contracts',
        severity: 'significant',
        title: `${criticalContracts.length} contracts over $1M`,
        detail: `Largest: ${String(topTitle).slice(0, 80)}`,
      });
    }

    // Power concentration
    const power = (anomalies as Array<{ power_score: number; system_count: number; total_dollar_flow: number }>)?.[0];
    if (power && Number(power.system_count) >= 4) {
      findings.push({
        type: 'power_concentration',
        severity: Number(power.system_count) >= 5 ? 'critical' : 'notable',
        title: `High power concentration: ${power.system_count} of 7 systems`,
        detail: `Power score: ${Number(power.power_score).toFixed(1)}, total dollar flow: $${(Number(power.total_dollar_flow) / 1e6).toFixed(1)}M`,
      });
    }

    const response = NextResponse.json({
      entity: e,
      findings: findings.sort((a, b) => {
        const order = { critical: 0, significant: 1, notable: 2 };
        return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
      }),
      contractAlerts: contractAlerts ?? [],
      fundingTimeline: fundingTimeline ?? [],
      boardConnections: boardConns ?? [],
      relatedEntities: relatedEntities ?? [],
      power: power ?? null,
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Investigation error:', error);
    return NextResponse.json({ error: 'Investigation failed' }, { status: 500 });
  }
}
