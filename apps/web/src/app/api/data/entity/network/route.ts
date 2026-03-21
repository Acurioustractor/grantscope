import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { validateUuid } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 3600;

const limiter = rateLimit();

const schema = z.object({
  id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const limited = limiter(req);
  if (limited) return limited;

  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const id = validateUuid(parsed.data.id);
  if (!id) return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });

  const supabase = getServiceSupabase();

  // Fetch entity's direct relationships + connected entity metadata
  // Limit to 60 edges to keep the mini-graph readable
  const { data: edges, error: edgeErr } = await supabase.rpc('exec_sql', {
    query: `
      WITH rels AS (
        SELECT
          r.source_entity_id,
          r.target_entity_id,
          r.relationship_type,
          r.amount::bigint as amount,
          r.year,
          r.dataset
        FROM gs_relationships r
        WHERE (r.source_entity_id = '${id}' OR r.target_entity_id = '${id}')
          AND r.source_entity_id != r.target_entity_id
        ORDER BY r.amount DESC NULLS LAST
        LIMIT 60
      )
      SELECT
        rels.*,
        s.gs_id as source_gs_id, s.canonical_name as source_name,
        s.entity_type as source_type, s.sector as source_sector,
        s.is_community_controlled as source_cc,
        t.gs_id as target_gs_id, t.canonical_name as target_name,
        t.entity_type as target_type, t.sector as target_sector,
        t.is_community_controlled as target_cc
      FROM rels
      JOIN gs_entities s ON s.id = rels.source_entity_id
      JOIN gs_entities t ON t.id = rels.target_entity_id
    `,
  });

  if (edgeErr) return NextResponse.json({ error: edgeErr.message }, { status: 500 });

  // Also fetch board members as person nodes (up to 15)
  const { data: board } = await supabase.rpc('exec_sql', {
    query: `
      SELECT DISTINCT ON (pr.person_name)
        pr.person_name, pr.role_type
      FROM person_roles pr
      JOIN gs_entities ge ON ge.abn = pr.company_abn
      WHERE ge.id = '${id}' AND pr.cessation_date IS NULL
      ORDER BY pr.person_name, pr.appointment_date DESC NULLS LAST
      LIMIT 15
    `,
  });

  // Build graph nodes and edges
  type Row = Record<string, unknown>;
  const nodeMap = new Map<string, { id: string; label: string; type: string; sector: string | null; cc: boolean; isCenter: boolean }>();

  for (const row of (edges as Row[] || [])) {
    const sid = row.source_entity_id as string;
    const tid = row.target_entity_id as string;
    if (!nodeMap.has(sid)) {
      nodeMap.set(sid, {
        id: sid,
        label: row.source_name as string,
        type: row.source_type as string,
        sector: row.source_sector as string | null,
        cc: row.source_cc as boolean,
        isCenter: sid === id,
      });
    }
    if (!nodeMap.has(tid)) {
      nodeMap.set(tid, {
        id: tid,
        label: row.target_name as string,
        type: row.target_type as string,
        sector: row.target_sector as string | null,
        cc: row.target_cc as boolean,
        isCenter: tid === id,
      });
    }
  }

  // Add board member pseudo-nodes
  const boardEdges: { source: string; target: string; type: string; amount: number | null }[] = [];
  for (const row of (board as Row[] || [])) {
    const personId = `person:${row.person_name}`;
    if (!nodeMap.has(personId)) {
      nodeMap.set(personId, {
        id: personId,
        label: row.person_name as string,
        type: 'person',
        sector: 'individual',
        cc: false,
        isCenter: false,
      });
    }
    boardEdges.push({ source: personId, target: id, type: 'board_member', amount: null });
  }

  const graphEdges = [
    ...(edges as Row[] || []).map((r: Row) => ({
      source: r.source_entity_id as string,
      target: r.target_entity_id as string,
      type: r.relationship_type as string,
      amount: r.amount ? Number(r.amount) : null,
    })),
    ...boardEdges,
  ];

  return NextResponse.json({
    nodes: Array.from(nodeMap.values()),
    edges: graphEdges,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
}
