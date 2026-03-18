import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Graph Data API — serves nodes and edges for force-directed visualization.
 *
 * Modes:
 *   1. Hub mode (mode=hubs): Find top-connected entities of a type, show their full neighborhoods.
 *   2. Justice mode (mode=justice): Build graph from justice_funding table.
 *      Programs as hub nodes → recipients as spokes. ALMA intervention enrichment.
 *      ?topic=youth-justice (default) filters by topic tag.
 *   3. Edge-first (default, no entity_type): fetch top edges by amount, resolve nodes.
 *
 * GET /api/data/graph
 *   ?mode=hubs|justice
 *   &entity_type=foundation|charity|company|...
 *   &topic=youth-justice|child-protection|...
 *   &state=NSW|VIC|QLD|...
 *   &min_amount=10000
 *   &limit=5000
 *   &hubs=20  (number of top hubs to show, default 20)
 */

type EdgeRow = {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number | null;
  dataset: string;
  year: number | null;
};

type NodeRow = {
  id: string; gs_id: string; canonical_name: string; entity_type: string;
  sector: string | null; state: string | null; postcode: string | null;
  remoteness: string | null; is_community_controlled: boolean; lga_name: string | null;
};

type JusticeFundingRow = {
  program_name: string;
  recipient_name: string;
  gs_entity_id: string | null;
  amount_dollars: number | null;
  state: string | null;
  financial_year: string | null;
};

type AlmaEnrichment = {
  gs_entity_id: string;
  intervention_type: string;
  evidence_level: string | null;
  name: string;
};

const NODE_COLS = 'id, gs_id, canonical_name, entity_type, sector, state, postcode, remoteness, is_community_controlled, lga_name';
const EDGE_COLS = 'source_entity_id, target_entity_id, relationship_type, amount, dataset, year';

type SupabaseClient = ReturnType<typeof getServiceSupabase>;

/** Paginate exec_sql using .range() */
async function paginatedRpc<T>(supabase: SupabaseClient, sql: string, maxRows = 10000): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data) all.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

/** Fetch nodes by ID in parallel batches */
async function fetchNodes(supabase: SupabaseClient, ids: string[]): Promise<NodeRow[]> {
  const all: NodeRow[] = [];
  const BATCH = 200;
  const CONCURRENCY = 5;
  for (let i = 0; i < ids.length; i += BATCH * CONCURRENCY) {
    const queries = [];
    for (let j = 0; j < CONCURRENCY && i + j * BATCH < ids.length; j++) {
      const batch = ids.slice(i + j * BATCH, i + (j + 1) * BATCH);
      queries.push(supabase.from('gs_entities').select(NODE_COLS).in('id', batch));
    }
    const results = await Promise.all(queries);
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      if (data) all.push(...data);
    }
  }
  return all;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || '';
    const entityType = searchParams.get('entity_type') || 'foundation';
    const state = searchParams.get('state');
    const minAmount = parseInt(searchParams.get('min_amount') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 60000);
    const hubCount = Math.min(parseInt(searchParams.get('hubs') || '30', 10), 100);

    const topic = searchParams.get('topic') || 'youth-justice';
    const supabase = getServiceSupabase();

    // ── Justice mode: program → recipient graph from justice_funding ──
    if (mode === 'justice') {
      const stateFilter = state ? `AND jf.state = '${state.toUpperCase()}'` : '';
      const topicFilter = `AND jf.topics @> ARRAY['${topic.replace(/'/g, "''")}']`;

      // Step 1: Get aggregated program → recipient edges
      const fundingRows = await paginatedRpc<{
        program_name: string;
        recipient_name: string;
        gs_entity_id: string | null;
        total_amount: number;
        grant_count: number;
        state: string | null;
      }>(supabase,
        `SELECT jf.program_name, jf.recipient_name, jf.gs_entity_id,
                SUM(jf.amount_dollars) as total_amount, COUNT(*) as grant_count,
                jf.state
         FROM justice_funding jf
         WHERE 1=1 ${topicFilter} ${stateFilter}
           AND jf.program_name NOT LIKE 'ROGS%'
           AND jf.program_name NOT LIKE 'Total%'
         GROUP BY jf.program_name, jf.recipient_name, jf.gs_entity_id, jf.state
         ORDER BY total_amount DESC
         LIMIT ${limit}`,
        limit);

      // Step 2: Get ALMA enrichment for linked entities
      const linkedEntityIds = [...new Set(fundingRows.filter(r => r.gs_entity_id).map(r => r.gs_entity_id!))];
      let almaMap = new Map<string, { type: string; evidence: string | null; name: string }>();
      if (linkedEntityIds.length > 0) {
        const idList = linkedEntityIds.map(id => `'${id}'`).join(',');
        const almaRows = await paginatedRpc<AlmaEnrichment>(supabase,
          `SELECT ai.gs_entity_id, ai.type as intervention_type, ai.evidence_level, ai.name
           FROM alma_interventions ai
           WHERE ai.gs_entity_id IN (${idList})`,
          5000);
        for (const a of almaRows) {
          if (!almaMap.has(a.gs_entity_id)) {
            almaMap.set(a.gs_entity_id, { type: a.intervention_type, evidence: a.evidence_level, name: a.name });
          }
        }
      }

      // Step 3: Build nodes and edges
      // Programs as hub nodes, recipients as spoke nodes
      const programNodes = new Map<string, { totalFunding: number; recipientCount: number }>();
      const recipientNodes = new Map<string, {
        gsEntityId: string | null; state: string | null;
        totalFunding: number; programCount: number;
        alma: { type: string; evidence: string | null; name: string } | null;
      }>();
      const edges: { source: string; target: string; amount: number; grants: number }[] = [];

      for (const row of fundingRows) {
        const progKey = `prog:${row.program_name}`;
        const recipKey = row.gs_entity_id ? `entity:${row.gs_entity_id}` : `name:${row.recipient_name}`;

        // Program node
        const prog = programNodes.get(progKey) || { totalFunding: 0, recipientCount: 0 };
        prog.totalFunding += Number(row.total_amount || 0);
        prog.recipientCount++;
        programNodes.set(progKey, prog);

        // Recipient node
        const recip = recipientNodes.get(recipKey) || {
          gsEntityId: row.gs_entity_id, state: row.state,
          totalFunding: 0, programCount: 0,
          alma: row.gs_entity_id ? almaMap.get(row.gs_entity_id) || null : null,
        };
        recip.totalFunding += Number(row.total_amount || 0);
        recip.programCount++;
        recipientNodes.set(recipKey, recip);

        // Edge
        edges.push({
          source: progKey,
          target: recipKey,
          amount: Number(row.total_amount || 0),
          grants: Number(row.grant_count || 0),
        });
      }

      // Step 4: Resolve entity details for linked recipients
      const entityIds = [...recipientNodes.values()]
        .filter(r => r.gsEntityId)
        .map(r => r.gsEntityId!);
      const entityDetails = entityIds.length > 0
        ? await fetchNodes(supabase, entityIds)
        : [];
      const entityMap = new Map(entityDetails.map(e => [e.id, e]));

      // Build response
      const degree = new Map<string, number>();
      for (const e of edges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }

      const nodes: Array<Record<string, unknown>> = [];

      // Shorten verbose program names for display
      const shortenProgram = (name: string): string => {
        return name
          .replace(/Community[\s,&]+(?:and\s+)?Youth Justice Services[\s,&]+(?:and\s+)?Aboriginal[\s,&]+(?:and\s+)?Torres Strait Islander Services/i, 'Youth Justice & ATSI Services')
          .replace(/Community[\s,&]+(?:and\s+)?Youth Justice Services[\s,&]+(?:and\s+)?Women/i, 'Youth Justice & Women')
          .replace(/Community[\s,&]+(?:and\s+)?Youth Justice\s+/i, 'Youth Justice ')
          .replace(/ Incorporated| Inc\.?| Pty Ltd| Ltd/gi, '');
      };

      // Program nodes
      for (const [key, prog] of programNodes) {
        nodes.push({
          id: key,
          label: shortenProgram(key.replace('prog:', '')),
          type: 'program',
          state: null,
          sector: 'justice',
          remoteness: null,
          community_controlled: false,
          degree: degree.get(key) || 0,
          funding: prog.totalFunding,
          alma_type: null,
          alma_evidence: null,
        });
      }

      // Recipient nodes
      for (const [key, recip] of recipientNodes) {
        const entity = recip.gsEntityId ? entityMap.get(recip.gsEntityId) : null;
        nodes.push({
          id: key,
          label: entity?.canonical_name || key.replace('name:', '').replace('entity:', ''),
          type: entity?.entity_type || 'unknown',
          state: entity?.state || recip.state,
          sector: entity?.sector || null,
          remoteness: entity?.remoteness || null,
          community_controlled: entity?.is_community_controlled || false,
          degree: degree.get(key) || 0,
          funding: recip.totalFunding,
          alma_type: recip.alma?.type || null,
          alma_evidence: recip.alma?.evidence || null,
        });
      }

      const response = NextResponse.json({
        nodes,
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          type: 'grant',
          amount: e.amount,
          dataset: 'justice_funding',
          year: null,
        })),
        meta: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          filters: { mode: 'justice', topic, state, minAmount, limit },
          alma_enriched: almaMap.size,
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    let allNodes: NodeRow[] = [];
    let allEdges: EdgeRow[] = [];

    if (mode === 'hubs' || (!mode && entityType)) {
      // ── Hub mode: find top-connected entities, show their neighborhoods ──
      // Step 1: Get top hubs by edge count
      // Find hubs by counting edges in BOTH directions, then merge
      const stateFilter = state ? `AND e.state = '${state.toUpperCase()}'` : '';
      const [srcHubs, tgtHubs] = await Promise.all([
        paginatedRpc<{ id: string; cnt: number }>(supabase,
          `SELECT e.id, COUNT(*) as cnt FROM gs_entities e
           JOIN gs_relationships r ON r.source_entity_id = e.id
           WHERE e.entity_type = '${entityType}' ${stateFilter}
           GROUP BY e.id ORDER BY cnt DESC LIMIT ${hubCount * 2}`,
          hubCount * 2),
        paginatedRpc<{ id: string; cnt: number }>(supabase,
          `SELECT e.id, COUNT(*) as cnt FROM gs_entities e
           JOIN gs_relationships r ON r.target_entity_id = e.id
           WHERE e.entity_type = '${entityType}' ${stateFilter}
           GROUP BY e.id ORDER BY cnt DESC LIMIT ${hubCount * 2}`,
          hubCount * 2),
      ]);

      // Merge counts from both directions
      const hubDegree = new Map<string, number>();
      for (const h of srcHubs) hubDegree.set(h.id, (hubDegree.get(h.id) || 0) + Number(h.cnt));
      for (const h of tgtHubs) hubDegree.set(h.id, (hubDegree.get(h.id) || 0) + Number(h.cnt));

      // Take top N by combined degree
      const hubIds = [...hubDegree.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, hubCount)
        .map(([id]) => id);

      // Step 2: Fetch edges per hub using exec_sql (no 1000-row PostgREST cap)
      const hubIdList = hubIds.map(id => `'${id}'`).join(',');
      const amountFilter = minAmount > 0 ? `AND r.amount >= ${minAmount}` : '';

      // Get all source + target edges for these hubs in two paginated queries
      const [srcEdges, tgtEdges] = await Promise.all([
        paginatedRpc<EdgeRow>(supabase,
          `SELECT r.source_entity_id, r.target_entity_id, r.relationship_type, r.amount, r.dataset, r.year
           FROM gs_relationships r
           WHERE r.source_entity_id IN (${hubIdList}) ${amountFilter}`,
          50000),
        paginatedRpc<EdgeRow>(supabase,
          `SELECT r.source_entity_id, r.target_entity_id, r.relationship_type, r.amount, r.dataset, r.year
           FROM gs_relationships r
           WHERE r.target_entity_id IN (${hubIdList}) ${amountFilter}`,
          50000),
      ]);

      const edgeKey = (e: EdgeRow) => `${e.source_entity_id}:${e.target_entity_id}:${e.dataset}`;
      const seenEdges = new Set<string>();
      for (const e of [...srcEdges, ...tgtEdges]) {
        const k = edgeKey(e);
        if (!seenEdges.has(k)) { seenEdges.add(k); allEdges.push(e); }
      }

      // Step 3: Resolve all connected nodes
      const entityIds = new Set<string>();
      for (const e of allEdges) {
        entityIds.add(e.source_entity_id);
        entityIds.add(e.target_entity_id);
      }
      allNodes = await fetchNodes(supabase, [...entityIds].slice(0, limit));

      // Apply state filter on non-hub nodes
      if (state) {
        const stateUpper = state.toUpperCase();
        const hubIdSet = new Set(hubIds);
        allNodes = allNodes.filter(n => n.state === stateUpper || hubIdSet.has(n.id));
        const nodeIds = new Set(allNodes.map(n => n.id));
        allEdges = allEdges.filter(e => nodeIds.has(e.source_entity_id) && nodeIds.has(e.target_entity_id));
      }

    } else {
      // ── Edge-first mode: fetch top edges, then resolve nodes ──
      const targetEdges = Math.min(limit * 2, 10000);
      const PAGE = 1000;
      const totalPages = Math.ceil(targetEdges / PAGE);
      const CONCURRENCY = 3;

      for (let g = 0; g < totalPages; g += CONCURRENCY) {
        const batch = Array.from({ length: Math.min(CONCURRENCY, totalPages - g) }, (_, i) => {
          const pageIdx = g + i;
          let q = supabase.from('gs_relationships').select(EDGE_COLS)
            .order('amount', { ascending: false, nullsFirst: false })
            .range(pageIdx * PAGE, (pageIdx + 1) * PAGE - 1);
          if (minAmount > 0) q = q.gte('amount', minAmount);
          return q;
        });

        const results = await Promise.all(batch);
        let done = false;
        for (const { data, error } of results) {
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          if (data) allEdges.push(...data);
          if (!data || data.length < PAGE) done = true;
        }
        if (done) break;
      }

      const entityIds = new Set<string>();
      for (const e of allEdges) {
        entityIds.add(e.source_entity_id);
        entityIds.add(e.target_entity_id);
      }
      allNodes = await fetchNodes(supabase, [...entityIds].slice(0, limit));

      if (state) {
        const stateUpper = state.toUpperCase();
        allNodes = allNodes.filter(n => n.state === stateUpper);
        const nodeIds = new Set(allNodes.map(n => n.id));
        allEdges = allEdges.filter(e => nodeIds.has(e.source_entity_id) && nodeIds.has(e.target_entity_id));
      }
    }

    // Compute degree counts
    const degree = new Map<string, number>();
    for (const e of allEdges) {
      degree.set(e.source_entity_id, (degree.get(e.source_entity_id) || 0) + 1);
      degree.set(e.target_entity_id, (degree.get(e.target_entity_id) || 0) + 1);
    }

    const response = NextResponse.json({
      nodes: allNodes.map(n => ({
        id: n.id,
        label: n.canonical_name,
        type: n.entity_type,
        state: n.state,
        sector: n.sector,
        remoteness: n.remoteness,
        community_controlled: n.is_community_controlled,
        degree: degree.get(n.id) || 0,
      })),
      edges: allEdges.map(e => ({
        source: e.source_entity_id,
        target: e.target_entity_id,
        type: e.relationship_type,
        amount: e.amount,
        dataset: e.dataset,
        year: e.year,
      })),
      meta: {
        total_nodes: allNodes.length,
        total_edges: allEdges.length,
        filters: { mode: mode || 'hubs', entityType, state, minAmount, limit, hubCount },
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
