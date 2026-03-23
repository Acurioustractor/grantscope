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
 *   ?mode=hubs|justice|power|ndis|foundations|diary
 *   &entity_type=foundation|charity|company|...
 *   &topic=youth-justice|child-protection|...
 *   &state=NSW|VIC|QLD|...
 *   &min_amount=10000
 *   &limit=5000
 *   &hubs=20  (number of top hubs to show, default 20)
 *   &min_systems=3  (power mode: minimum systems an entity appears in)
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

    const topic = searchParams.get('topic') || (mode === 'alma' ? '' : 'youth-justice');
    const minSystems = Math.max(2, parseInt(searchParams.get('min_systems') || '3', 10));
    const supabase = getServiceSupabase();

    // ── Power mode: cross-system power concentration graph ──
    if (mode === 'power') {
      const stateFilter = state ? `AND pi.state = '${state.toUpperCase()}'` : '';

      // Step 1: Get multi-system entities from power index
      const powerEntities = await paginatedRpc<{
        id: string; canonical_name: string; entity_type: string;
        state: string | null; remoteness: string | null; lga_name: string | null;
        is_community_controlled: boolean;
        system_count: number; power_score: number;
        in_procurement: number; in_justice_funding: number; in_political_donations: number;
        in_charity_registry: number; in_foundation: number; in_alma_evidence: number; in_ato_transparency: number;
        procurement_dollars: number; justice_dollars: number; donation_dollars: number;
        total_dollar_flow: number; distinct_govt_buyers: number; distinct_parties_funded: number;
      }>(supabase,
        `SELECT pi.id, pi.canonical_name, pi.entity_type, pi.state, pi.remoteness, pi.lga_name,
                pi.is_community_controlled, pi.system_count, pi.power_score,
                pi.in_procurement, pi.in_justice_funding, pi.in_political_donations,
                pi.in_charity_registry, pi.in_foundation, pi.in_alma_evidence, pi.in_ato_transparency,
                pi.procurement_dollars, pi.justice_dollars, pi.donation_dollars,
                pi.total_dollar_flow, pi.distinct_govt_buyers, pi.distinct_parties_funded
         FROM mv_entity_power_index pi
         WHERE pi.system_count >= ${minSystems} ${stateFilter}
         ORDER BY pi.power_score DESC
         LIMIT ${Math.min(limit, 2000)}`,
        2000);

      if (powerEntities.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Get relationships between these entities
      const entityIds = powerEntities.map(e => e.id);
      const idList = entityIds.map(id => `'${id}'`).join(',');

      const edges = await paginatedRpc<EdgeRow>(supabase,
        `SELECT source_entity_id, target_entity_id, relationship_type, amount, dataset, year
         FROM gs_relationships
         WHERE source_entity_id IN (${idList})
           AND target_entity_id IN (${idList})
           AND source_entity_id != target_entity_id`,
        30000);

      // Step 3: Compute degree
      const degree = new Map<string, number>();
      for (const e of edges) {
        degree.set(e.source_entity_id, (degree.get(e.source_entity_id) || 0) + 1);
        degree.set(e.target_entity_id, (degree.get(e.target_entity_id) || 0) + 1);
      }

      // Step 4: Build nodes with power metadata
      const connectedIds = new Set<string>();
      for (const e of edges) {
        connectedIds.add(e.source_entity_id);
        connectedIds.add(e.target_entity_id);
      }

      // Include top power entities even if unconnected (up to 50), plus all connected
      const topUnconnected = powerEntities
        .filter(e => !connectedIds.has(e.id))
        .slice(0, 50);
      const includedEntities = powerEntities.filter(e => connectedIds.has(e.id) || topUnconnected.includes(e));

      const systems = (e: typeof powerEntities[0]) => {
        const s: string[] = [];
        if (e.in_procurement) s.push('procurement');
        if (e.in_justice_funding) s.push('justice');
        if (e.in_political_donations) s.push('donations');
        if (e.in_charity_registry) s.push('charity');
        if (e.in_foundation) s.push('foundation');
        if (e.in_alma_evidence) s.push('alma');
        if (e.in_ato_transparency) s.push('ato');
        return s;
      };

      const nodes = includedEntities.map(e => ({
        id: e.id,
        label: e.canonical_name,
        type: e.entity_type,
        state: e.state,
        remoteness: e.remoteness,
        community_controlled: e.is_community_controlled,
        degree: degree.get(e.id) || 0,
        system_count: Number(e.system_count),
        power_score: Number(e.power_score),
        systems: systems(e),
        procurement_dollars: Number(e.procurement_dollars),
        justice_dollars: Number(e.justice_dollars),
        donation_dollars: Number(e.donation_dollars),
        total_dollar_flow: Number(e.total_dollar_flow),
        distinct_govt_buyers: Number(e.distinct_govt_buyers),
        distinct_parties_funded: Number(e.distinct_parties_funded),
      }));

      const response = NextResponse.json({
        nodes,
        edges: edges.map(e => ({
          source: e.source_entity_id,
          target: e.target_entity_id,
          type: e.relationship_type,
          amount: e.amount,
          dataset: e.dataset,
          year: e.year,
        })),
        meta: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          filters: { mode: 'power', minSystems, state, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── Interlocks mode: people → organisations bipartite graph ──
    if (mode === 'interlocks') {
      const minBoards = Math.max(2, parseInt(searchParams.get('min_boards') || '2', 10));

      // Step 1: Get interlockers from MV
      const interlockers = await paginatedRpc<{
        person_name_normalised: string;
        person_name_display: string;
        board_count: number;
        organisations: string[];
        organisation_abns: string[];
        entity_ids: string[] | null;
        role_types: string[];
        interlock_score: number;
        total_procurement_dollars: number;
        total_justice_dollars: number;
        total_donation_dollars: number;
        max_entity_system_count: number;
        total_power_score: number;
        connects_community_controlled: boolean;
      }>(supabase,
        `SELECT person_name_normalised, person_name_display, board_count,
                organisations, organisation_abns, entity_ids, role_types,
                interlock_score, total_procurement_dollars, total_justice_dollars,
                total_donation_dollars, max_entity_system_count, total_power_score,
                connects_community_controlled
         FROM mv_board_interlocks
         WHERE board_count >= ${minBoards}
         ORDER BY interlock_score DESC
         LIMIT ${Math.min(limit, 500)}`,
        500);

      if (interlockers.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Collect all entity IDs for org node enrichment
      const allEntityIds = new Set<string>();
      for (const p of interlockers) {
        if (p.entity_ids) for (const eid of p.entity_ids) if (eid) allEntityIds.add(eid);
      }
      const entityDetails = allEntityIds.size > 0
        ? await fetchNodes(supabase, [...allEntityIds])
        : [];
      const entityMap = new Map(entityDetails.map(e => [e.id, e]));

      // Step 3: Build bipartite graph — person nodes + org nodes + edges
      const nodes: Array<Record<string, unknown>> = [];
      const graphEdges: Array<{ source: string; target: string; type: string; amount: number | null; dataset: string; year: number | null }> = [];

      // ABN → entity lookup
      const abnToEntity = new Map<string, NodeRow>();
      for (const e of entityDetails) {
        // Find ABN from interlockers' data
        for (const p of interlockers) {
          const idx = (p.entity_ids || []).indexOf(e.id);
          if (idx >= 0 && p.organisation_abns[idx]) {
            abnToEntity.set(p.organisation_abns[idx], e);
          }
        }
      }
      // Also build from entity_ids directly
      for (const p of interlockers) {
        if (p.entity_ids && p.organisation_abns) {
          for (let i = 0; i < p.organisation_abns.length; i++) {
            const abn = p.organisation_abns[i];
            if (p.entity_ids[i] && entityMap.has(p.entity_ids[i])) {
              abnToEntity.set(abn, entityMap.get(p.entity_ids[i])!);
            }
          }
        }
      }

      // Track org nodes by ABN to avoid dupes
      const orgNodesAdded = new Set<string>();

      for (const person of interlockers) {
        const personId = `person:${person.person_name_normalised}`;

        // Person node
        nodes.push({
          id: personId,
          label: person.person_name_display,
          type: 'person',
          state: null,
          sector: null,
          remoteness: null,
          community_controlled: person.connects_community_controlled,
          degree: person.board_count,
          board_count: person.board_count,
          interlock_score: Number(person.interlock_score),
          role_types: person.role_types,
          procurement_dollars: Number(person.total_procurement_dollars),
          justice_dollars: Number(person.total_justice_dollars),
          donation_dollars: Number(person.total_donation_dollars),
          max_system_count: Number(person.max_entity_system_count),
          total_power_score: Number(person.total_power_score),
        });

        // Organisation nodes + edges
        for (let i = 0; i < person.organisations.length; i++) {
          const orgAbn = person.organisation_abns[i];
          const orgKey = `org:${orgAbn}`;
          const entity = abnToEntity.get(orgAbn);

          if (!orgNodesAdded.has(orgAbn)) {
            orgNodesAdded.add(orgAbn);
            nodes.push({
              id: orgKey,
              label: entity?.canonical_name || person.organisations[i],
              type: entity?.entity_type || 'charity',
              state: entity?.state || null,
              sector: entity?.sector || null,
              remoteness: entity?.remoteness || null,
              community_controlled: entity?.is_community_controlled || false,
              degree: 0, // will compute below
            });
          }

          graphEdges.push({
            source: personId,
            target: orgKey,
            type: 'board_member',
            amount: null,
            dataset: 'person_roles',
            year: null,
          });
        }
      }

      // Compute degree
      const degree = new Map<string, number>();
      for (const e of graphEdges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }
      for (const n of nodes) {
        if (n.type !== 'person') n.degree = degree.get(n.id as string) || 0;
      }

      const response = NextResponse.json({
        nodes,
        edges: graphEdges,
        meta: {
          total_nodes: nodes.length,
          total_edges: graphEdges.length,
          total_persons: interlockers.length,
          total_orgs: orgNodesAdded.size,
          filters: { mode: 'interlocks', minBoards, state, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── NDIS mode: provider → LGA bipartite graph with thin market severity ──
    if (mode === 'ndis') {
      const stateFilter = state ? `AND dl.state = '${state.toUpperCase()}'` : '';

      // Step 1: Get disability landscape data (LGAs with NDIS participants)
      const lgaRows = await paginatedRpc<{
        lga_name: string; state: string; remoteness: string | null;
        ndis_participants: number; ndis_entities: number;
        ndis_avg_utilisation: number | null;
        seifa_decile: number | null; desert_score: number | null;
        procurement_entities: number; justice_entities: number;
        total_entities: number;
      }>(supabase,
        `SELECT dl.lga_name, dl.state, dl.remoteness,
                dl.ndis_participants, dl.ndis_entities,
                dl.ndis_avg_utilisation,
                dl.seifa_decile, dl.desert_score,
                dl.procurement_entities, dl.justice_entities,
                dl.total_entities
         FROM mv_disability_landscape dl
         WHERE dl.ndis_participants > 0 ${stateFilter}
         ORDER BY dl.ndis_participants DESC
         LIMIT ${Math.min(limit, 500)}`,
        500);

      if (lgaRows.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Get NDIS providers mapped to these LGAs via postcode_geo
      const lgaNames = lgaRows.map(l => l.lga_name);
      const lgaNameList = lgaNames.map(n => `'${n.replace(/'/g, "''")}'`).join(',');

      const providers = await paginatedRpc<{
        id: string; canonical_name: string; entity_type: string;
        state: string | null; lga_name: string | null;
        remoteness: string | null; is_community_controlled: boolean;
        sector: string | null; abn: string | null;
        system_count: number | null; power_score: number | null;
      }>(supabase,
        `SELECT ge.id, ge.canonical_name, ge.entity_type, ge.state, ge.lga_name,
                ge.remoteness, ge.is_community_controlled, ge.sector, ge.abn,
                pi.system_count, pi.power_score
         FROM gs_entities ge
         LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
         WHERE ge.sector = 'disability-services'
           AND ge.lga_name IN (${lgaNameList})
         ORDER BY pi.power_score DESC NULLS LAST
         LIMIT ${Math.min(limit, 3000)}`,
        3000);

      // Step 3: Build bipartite graph — LGA hub nodes + provider spoke nodes
      const nodes: Array<Record<string, unknown>> = [];
      const graphEdges: Array<{ source: string; target: string; type: string; amount: number | null; dataset: string; year: number | null }> = [];

      // Classify thin market severity
      const severity = (participants: number, entities: number): string => {
        if (participants > 0 && entities === 0) return 'critical';
        if (participants > 500 && entities < 3) return 'severe';
        if (participants > 100 && entities < 5) return 'moderate';
        return 'adequate';
      };

      // LGA nodes
      const lgaNodeIds = new Set<string>();
      for (const lga of lgaRows) {
        const lgaId = `lga:${lga.lga_name}`;
        lgaNodeIds.add(lgaId);
        nodes.push({
          id: lgaId,
          label: lga.lga_name,
          type: 'lga',
          state: lga.state,
          sector: null,
          remoteness: lga.remoteness,
          community_controlled: false,
          degree: 0,
          ndis_participants: Number(lga.ndis_participants),
          ndis_entities: Number(lga.ndis_entities),
          ndis_utilisation: lga.ndis_avg_utilisation ? Number(lga.ndis_avg_utilisation) : null,
          seifa_decile: lga.seifa_decile ? Number(lga.seifa_decile) : null,
          desert_score: lga.desert_score ? Number(lga.desert_score) : null,
          severity: severity(Number(lga.ndis_participants), Number(lga.ndis_entities)),
          cross_system_entities: Number(lga.total_entities),
        });
      }

      // Provider nodes + edges to LGAs
      const providerNodesAdded = new Set<string>();
      for (const prov of providers) {
        if (!prov.lga_name) continue;
        const lgaId = `lga:${prov.lga_name}`;
        if (!lgaNodeIds.has(lgaId)) continue;

        const provId = `provider:${prov.id}`;
        if (!providerNodesAdded.has(provId)) {
          providerNodesAdded.add(provId);
          nodes.push({
            id: provId,
            label: prov.canonical_name,
            type: prov.entity_type || 'company',
            state: prov.state,
            sector: prov.sector,
            remoteness: prov.remoteness,
            community_controlled: prov.is_community_controlled,
            degree: 0,
            system_count: prov.system_count ? Number(prov.system_count) : null,
            power_score: prov.power_score ? Number(prov.power_score) : null,
          });
        }

        graphEdges.push({
          source: provId,
          target: lgaId,
          type: 'ndis_provider',
          amount: null,
          dataset: 'ndis',
          year: null,
        });
      }

      // Compute degree
      const degree = new Map<string, number>();
      for (const e of graphEdges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }
      for (const n of nodes) {
        n.degree = degree.get(n.id as string) || 0;
      }

      // Count severities for meta
      const severityCounts = { critical: 0, severe: 0, moderate: 0, adequate: 0 };
      for (const lga of lgaRows) {
        const s = severity(Number(lga.ndis_participants), Number(lga.ndis_entities));
        severityCounts[s as keyof typeof severityCounts]++;
      }

      const response = NextResponse.json({
        nodes,
        edges: graphEdges,
        meta: {
          total_nodes: nodes.length,
          total_edges: graphEdges.length,
          total_lgas: lgaRows.length,
          total_providers: providerNodesAdded.size,
          severity_counts: severityCounts,
          filters: { mode: 'ndis', state, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── Dollar mode: trace program → recipient → contracts/donations/lobbying ──
    if (mode === 'dollar') {
      const stateFilter = state ? `AND jf.state = '${state.toUpperCase()}'` : '';
      const topicFilter = topic ? `AND jf.topics @> ARRAY['${topic.replace(/'/g, "''")}']` : '';

      // Step 1: Get top-funded recipients
      const recipients = await paginatedRpc<{
        gs_entity_id: string; recipient_name: string;
        total_amount: number; grant_count: number; programs: string;
      }>(supabase,
        `SELECT jf.gs_entity_id, jf.recipient_name,
                SUM(jf.amount_dollars) as total_amount, COUNT(*) as grant_count,
                STRING_AGG(DISTINCT jf.program_name, '; ' ORDER BY jf.program_name) as programs
         FROM justice_funding jf
         WHERE jf.gs_entity_id IS NOT NULL
           AND jf.amount_dollars > 0
           AND jf.program_name NOT LIKE 'ROGS%' AND jf.program_name NOT LIKE 'Total%'
           ${topicFilter} ${stateFilter}
         GROUP BY jf.gs_entity_id, jf.recipient_name
         ORDER BY total_amount DESC
         LIMIT ${Math.min(limit, 200)}`,
        200);

      if (recipients.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { mode: 'dollar', total_nodes: 0, total_edges: 0 } });
      }

      const recipientIds = recipients.map(r => r.gs_entity_id);
      const idList = recipientIds.map(id => `'${id}'`).join(',');

      // Step 2: Get program entities for these recipients
      const programEdges = await paginatedRpc<{
        source_entity_id: string; target_entity_id: string;
        amount: number | null; properties: { program?: string } | null;
      }>(supabase,
        `SELECT source_entity_id, target_entity_id, amount, properties
         FROM gs_relationships
         WHERE target_entity_id IN (${idList})
           AND relationship_type = 'grant'
           AND dataset = 'justice_funding'
         ORDER BY amount DESC NULLS LAST
         LIMIT 2000`,
        2000);

      // Step 3: Get downstream relationships (contracts, donations, lobbying)
      const [contracts, donations, lobbying] = await Promise.all([
        paginatedRpc<EdgeRow>(supabase,
          `SELECT source_entity_id, target_entity_id, relationship_type, amount, dataset, year
           FROM gs_relationships
           WHERE (source_entity_id IN (${idList}) OR target_entity_id IN (${idList}))
             AND relationship_type = 'contract'
           ORDER BY amount DESC NULLS LAST
           LIMIT 1000`, 1000),
        paginatedRpc<EdgeRow>(supabase,
          `SELECT source_entity_id, target_entity_id, relationship_type, amount, dataset, year
           FROM gs_relationships
           WHERE source_entity_id IN (${idList})
             AND relationship_type = 'donation'
           ORDER BY amount DESC NULLS LAST
           LIMIT 500`, 500),
        paginatedRpc<EdgeRow>(supabase,
          `SELECT source_entity_id, target_entity_id, relationship_type, amount, dataset, year
           FROM gs_relationships
           WHERE (source_entity_id IN (${idList}) OR target_entity_id IN (${idList}))
             AND relationship_type = 'lobbies_for'
           LIMIT 200`, 200),
      ]);

      // Step 4: Collect all entity IDs and fetch node details
      const allEntityIds = new Set<string>();
      for (const r of recipients) allEntityIds.add(r.gs_entity_id);
      for (const e of programEdges) { allEntityIds.add(e.source_entity_id); allEntityIds.add(e.target_entity_id); }
      for (const e of [...contracts, ...donations, ...lobbying]) {
        allEntityIds.add(e.source_entity_id);
        allEntityIds.add(e.target_entity_id);
      }
      const entityDetails = await fetchNodes(supabase, [...allEntityIds]);
      const entityMap = new Map(entityDetails.map(e => [e.id, e]));

      // Step 5: Build graph
      const nodes: Array<Record<string, unknown>> = [];
      const graphEdges: Array<{ source: string; target: string; type: string; amount: number | null; dataset: string; year: number | null }> = [];
      const seenNodes = new Set<string>();

      const addNode = (id: string, extra?: Record<string, unknown>) => {
        if (seenNodes.has(id)) return;
        seenNodes.add(id);
        const entity = entityMap.get(id);
        nodes.push({
          id,
          label: entity?.canonical_name || id,
          type: entity?.entity_type || 'unknown',
          state: entity?.state || null,
          sector: entity?.sector || null,
          remoteness: entity?.remoteness || null,
          community_controlled: entity?.is_community_controlled || false,
          degree: 0,
          ...extra,
        });
      };

      // Add recipient nodes with funding metadata
      const recipientIdSet = new Set(recipientIds);
      for (const r of recipients) {
        addNode(r.gs_entity_id, {
          funding: Number(r.total_amount),
          layer: 'recipient',
        });
      }

      // Add program→recipient edges and program source nodes
      for (const e of programEdges) {
        addNode(e.source_entity_id, { layer: 'program' });
        graphEdges.push({
          source: e.source_entity_id, target: e.target_entity_id,
          type: 'grant', amount: e.amount, dataset: 'justice_funding', year: null,
        });
      }

      // Add downstream edges and their connected nodes
      for (const e of contracts) {
        const otherId = recipientIdSet.has(e.source_entity_id) ? e.target_entity_id : e.source_entity_id;
        addNode(otherId, { layer: 'contract' });
        graphEdges.push({
          source: e.source_entity_id, target: e.target_entity_id,
          type: e.relationship_type, amount: e.amount, dataset: e.dataset, year: e.year,
        });
      }
      for (const e of donations) {
        addNode(e.target_entity_id, { layer: 'donation' });
        graphEdges.push({
          source: e.source_entity_id, target: e.target_entity_id,
          type: e.relationship_type, amount: e.amount, dataset: e.dataset, year: e.year,
        });
      }
      for (const e of lobbying) {
        const otherId = recipientIdSet.has(e.source_entity_id) ? e.target_entity_id : e.source_entity_id;
        addNode(otherId, { layer: 'lobbying' });
        graphEdges.push({
          source: e.source_entity_id, target: e.target_entity_id,
          type: e.relationship_type, amount: e.amount, dataset: e.dataset, year: e.year,
        });
      }

      // Compute degree
      const degree = new Map<string, number>();
      for (const e of graphEdges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }
      for (const n of nodes) n.degree = degree.get(n.id as string) || 0;

      const response = NextResponse.json({
        nodes,
        edges: graphEdges,
        meta: {
          mode: 'dollar',
          total_nodes: nodes.length,
          total_edges: graphEdges.length,
          recipients: recipients.length,
          contracts: contracts.length,
          donations: donations.length,
          lobbying: lobbying.length,
          filters: { mode: 'dollar', topic, state, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

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

    // ── Foundations mode: foundation → grantee graph from mv_foundation_grantees ──
    if (mode === 'foundations') {
      const stateFilter = state ? `AND fg.grantee_state = '${state.toUpperCase()}'` : '';
      const minGiving = parseInt(searchParams.get('min_giving') || '0', 10);
      const givingFilter = minGiving > 0 ? `AND fg.total_giving_annual >= ${minGiving}` : '';

      // Step 1: Get foundation → grantee edges
      const granteeRows = await paginatedRpc<{
        foundation_name: string;
        foundation_abn: string;
        total_giving_annual: number | null;
        grantee_name: string;
        grantee_abn: string | null;
        grant_amount: number | null;
        grant_year: number | null;
        grantee_entity_id: string | null;
        grantee_state: string | null;
      }>(supabase,
        `SELECT fg.foundation_name, fg.foundation_abn,
                fg.total_giving_annual, fg.grantee_name, fg.grantee_abn,
                fg.grant_amount, fg.grant_year,
                fg.grantee_entity_id, fg.grantee_state
         FROM mv_foundation_grantees fg
         WHERE fg.foundation_abn IS NOT NULL ${stateFilter} ${givingFilter}
         ORDER BY fg.total_giving_annual DESC NULLS LAST, fg.grant_amount DESC NULLS LAST
         LIMIT ${limit}`,
        limit);

      if (granteeRows.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Get foundation scores
      const foundationAbns = [...new Set(granteeRows.map(r => r.foundation_abn))];
      const abnList = foundationAbns.map(a => `'${a}'`).join(',');
      const scores = await paginatedRpc<{
        acnc_abn: string; foundation_score: number;
        transparency_score: number; need_alignment_score: number;
        evidence_score: number; concentration_score: number;
      }>(supabase,
        `SELECT acnc_abn, foundation_score, transparency_score,
                need_alignment_score, evidence_score, concentration_score
         FROM mv_foundation_scores WHERE acnc_abn IN (${abnList})`,
        5000);
      const scoreMap = new Map(scores.map(s => [s.acnc_abn, s]));

      // Step 3: Get regranting chains (foundation → regranter → ultimate grantee)
      const regrantRows = await paginatedRpc<{
        source_abn: string; regranter_name: string; regranter_abn: string;
        ultimate_grantee: string; ultimate_grantee_abn: string | null;
        downstream_amount: number | null;
      }>(supabase,
        `SELECT source_abn, regranter_name, regranter_abn,
                ultimate_grantee, ultimate_grantee_abn, downstream_amount
         FROM mv_foundation_regranting
         WHERE source_abn IN (${abnList})
         ORDER BY downstream_amount DESC NULLS LAST
         LIMIT 2000`,
        2000);

      // Step 4: Build graph
      const nodes: Array<Record<string, unknown>> = [];
      const graphEdges: Array<{ source: string; target: string; type: string; amount: number | null; dataset: string; year: number | null }> = [];

      // Foundation hub nodes (keyed by ABN)
      const foundationNodes = new Map<string, {
        name: string; giving: number; granteeCount: number;
        score: typeof scores[0] | undefined;
      }>();
      // Grantee spoke nodes (keyed by ABN or name)
      const granteeNodeMap = new Map<string, {
        name: string; abn: string | null; state: string | null;
        entityId: string | null; totalReceived: number; foundationCount: number;
        isRegranter: boolean;
      }>();

      const regranterAbns = new Set(regrantRows.map(r => r.regranter_abn));

      for (const row of granteeRows) {
        const fKey = `foundation:${row.foundation_abn}`;
        const gKey = row.grantee_abn ? `grantee:${row.grantee_abn}` : `grantee:${row.grantee_name}`;

        // Foundation node
        const fNode = foundationNodes.get(fKey) || {
          name: row.foundation_name, giving: Number(row.total_giving_annual || 0),
          granteeCount: 0, score: scoreMap.get(row.foundation_abn),
        };
        fNode.granteeCount++;
        foundationNodes.set(fKey, fNode);

        // Grantee node
        const gNode = granteeNodeMap.get(gKey) || {
          name: row.grantee_name, abn: row.grantee_abn, state: row.grantee_state,
          entityId: row.grantee_entity_id, totalReceived: 0, foundationCount: 0,
          isRegranter: row.grantee_abn ? regranterAbns.has(row.grantee_abn) : false,
        };
        gNode.totalReceived += Number(row.grant_amount || 0);
        gNode.foundationCount++;
        granteeNodeMap.set(gKey, gNode);

        // Edge: foundation → grantee
        graphEdges.push({
          source: fKey, target: gKey, type: 'grant',
          amount: Number(row.grant_amount || 0),
          dataset: 'foundation_grantees', year: row.grant_year,
        });
      }

      // Add regranting chain edges (regranter → ultimate grantee)
      for (const row of regrantRows) {
        const regranterKey = `grantee:${row.regranter_abn}`;
        const ultimateKey = row.ultimate_grantee_abn
          ? `grantee:${row.ultimate_grantee_abn}`
          : `grantee:${row.ultimate_grantee}`;

        // Ensure ultimate grantee node exists
        if (!granteeNodeMap.has(ultimateKey)) {
          granteeNodeMap.set(ultimateKey, {
            name: row.ultimate_grantee, abn: row.ultimate_grantee_abn,
            state: null, entityId: null, totalReceived: Number(row.downstream_amount || 0),
            foundationCount: 0, isRegranter: false,
          });
        }

        graphEdges.push({
          source: regranterKey, target: ultimateKey, type: 'regrant',
          amount: Number(row.downstream_amount || 0),
          dataset: 'foundation_regranting', year: null,
        });
      }

      // Compute degree
      const degree = new Map<string, number>();
      for (const e of graphEdges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }

      // Score tier for coloring
      const scoreTier = (score: number | undefined): string => {
        if (!score) return 'unscored';
        if (score >= 50) return 'high';
        if (score >= 20) return 'medium';
        return 'low';
      };

      // Build node list
      for (const [key, f] of foundationNodes) {
        nodes.push({
          id: key, label: f.name, type: 'foundation',
          state: null, sector: 'philanthropy', remoteness: null,
          community_controlled: false,
          degree: degree.get(key) || 0,
          funding: f.giving, grantee_count: f.granteeCount,
          foundation_score: f.score ? Number(f.score.foundation_score) : null,
          transparency_score: f.score ? Number(f.score.transparency_score) : null,
          need_alignment_score: f.score ? Number(f.score.need_alignment_score) : null,
          evidence_score: f.score ? Number(f.score.evidence_score) : null,
          score_tier: scoreTier(f.score ? Number(f.score.foundation_score) : undefined),
        });
      }

      for (const [key, g] of granteeNodeMap) {
        nodes.push({
          id: key, label: g.name, type: g.isRegranter ? 'regranter' : 'grantee',
          state: g.state, sector: null, remoteness: null,
          community_controlled: false,
          degree: degree.get(key) || 0,
          funding: g.totalReceived,
          foundation_count: g.foundationCount,
          is_regranter: g.isRegranter,
        });
      }

      const response = NextResponse.json({
        nodes,
        edges: graphEdges,
        meta: {
          total_nodes: nodes.length,
          total_edges: graphEdges.length,
          total_foundations: foundationNodes.size,
          total_grantees: granteeNodeMap.size,
          total_regrant_edges: regrantRows.length,
          filters: { mode: 'foundations', state, minGiving, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── Diary mode: minister → organisation meeting network ──
    if (mode === 'diary') {
      const ministerFilter = searchParams.get('minister');
      const ministerWhere = ministerFilter
        ? `AND d.minister_name ILIKE '%${ministerFilter.replace(/'/g, "''")}%'`
        : '';

      // Step 1: Get aggregated minister → entity meetings
      const diaryRows = await paginatedRpc<{
        minister_name: string;
        entity_id: string;
        entity_name: string;
        entity_type: string;
        entity_state: string | null;
        is_community_controlled: boolean;
        meeting_count: number;
        purposes: string;
      }>(supabase,
        `SELECT d.minister_name,
                d.linked_entity_id as entity_id,
                e.canonical_name as entity_name,
                e.entity_type,
                e.state as entity_state,
                COALESCE(e.is_community_controlled, false) as is_community_controlled,
                COUNT(*) as meeting_count,
                STRING_AGG(DISTINCT d.purpose, '; ' ORDER BY d.purpose) as purposes
         FROM civic_ministerial_diaries d
         JOIN gs_entities e ON e.id = d.linked_entity_id
         WHERE d.linked_entity_id IS NOT NULL ${ministerWhere}
         GROUP BY d.minister_name, d.linked_entity_id, e.canonical_name, e.entity_type, e.state, e.is_community_controlled
         ORDER BY meeting_count DESC
         LIMIT ${limit}`,
        limit);

      if (diaryRows.length === 0) {
        return NextResponse.json({ nodes: [], edges: [], meta: { mode: 'diary', total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Build bipartite graph — minister hubs + org spokes
      const nodes: Array<Record<string, unknown>> = [];
      const graphEdges: Array<{ source: string; target: string; type: string; amount: number | null; dataset: string; year: number | null }> = [];

      // Minister nodes
      const ministerNodes = new Map<string, { totalMeetings: number; orgCount: number }>();
      // Org nodes (keyed by entity_id)
      const orgNodes = new Map<string, {
        name: string; type: string; state: string | null;
        community_controlled: boolean;
        totalMeetings: number; ministerCount: number;
        purposes: Set<string>;
      }>();

      for (const row of diaryRows) {
        const minKey = `minister:${row.minister_name}`;
        const orgKey = `org:${row.entity_id}`;

        // Minister node
        const min = ministerNodes.get(minKey) || { totalMeetings: 0, orgCount: 0 };
        min.totalMeetings += Number(row.meeting_count);
        min.orgCount++;
        ministerNodes.set(minKey, min);

        // Org node
        const org = orgNodes.get(orgKey) || {
          name: row.entity_name, type: row.entity_type,
          state: row.entity_state, community_controlled: row.is_community_controlled,
          totalMeetings: 0, ministerCount: 0, purposes: new Set<string>(),
        };
        org.totalMeetings += Number(row.meeting_count);
        org.ministerCount++;
        if (row.purposes) {
          for (const p of row.purposes.split('; ')) org.purposes.add(p);
        }
        orgNodes.set(orgKey, org);

        // Edge
        graphEdges.push({
          source: minKey,
          target: orgKey,
          type: 'meeting',
          amount: Number(row.meeting_count),
          dataset: 'ministerial_diary',
          year: null,
        });
      }

      // Compute degree
      const degree = new Map<string, number>();
      for (const e of graphEdges) {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      }

      // Build node list
      for (const [key, m] of ministerNodes) {
        nodes.push({
          id: key,
          label: key.replace('minister:', ''),
          type: 'minister',
          state: null,
          sector: 'government',
          remoteness: null,
          community_controlled: false,
          degree: degree.get(key) || 0,
          meeting_count: m.totalMeetings,
          org_count: m.orgCount,
        });
      }

      for (const [key, o] of orgNodes) {
        nodes.push({
          id: key,
          label: o.name,
          type: o.type,
          state: o.state,
          sector: null,
          remoteness: null,
          community_controlled: o.community_controlled,
          degree: degree.get(key) || 0,
          meeting_count: o.totalMeetings,
          minister_count: o.ministerCount,
          purposes: [...o.purposes].slice(0, 5),
        });
      }

      const response = NextResponse.json({
        nodes,
        edges: graphEdges,
        meta: {
          mode: 'diary',
          total_nodes: nodes.length,
          total_edges: graphEdges.length,
          total_ministers: ministerNodes.size,
          total_orgs: orgNodes.size,
          filters: { mode: 'diary', minister: ministerFilter, limit },
        },
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // ── ALMA mode: intervention → entity graph from alma_interventions ──
    if (mode === 'alma') {
      const geoFilter = state ? `AND ai.geography::text ILIKE '%${state.replace(/'/g, "''")}%'` : '';
      const topicFilter = topic ? `AND ai.topics @> ARRAY['${topic.replace(/'/g, "''")}']` : '';

      // Step 1: Get ALMA interventions with linked entities
      const almaRows = await paginatedRpc<{
        id: string; name: string; type: string; evidence_level: string;
        target_cohort: string; gs_entity_id: string | null;
        entity_name: string | null; entity_type: string | null;
        entity_gs_id: string | null; entity_abn: string | null;
        entity_state: string | null; entity_remoteness: string | null;
        is_community_controlled: boolean;
      }>(supabase,
        `SELECT ai.id, ai.name, ai.type, ai.evidence_level, ai.target_cohort,
                ai.gs_entity_id,
                e.canonical_name as entity_name, e.entity_type, e.gs_id as entity_gs_id,
                e.abn as entity_abn, e.state as entity_state, e.remoteness as entity_remoteness,
                COALESCE(e.is_community_controlled, false) as is_community_controlled
         FROM alma_interventions ai
         LEFT JOIN gs_entities e ON e.id = ai.gs_entity_id
         WHERE 1=1 ${geoFilter} ${topicFilter}
         ORDER BY ai.type, ai.name`,
        1000
      );

      if (!almaRows.length) {
        return NextResponse.json({ nodes: [], edges: [], meta: { mode: 'alma', total_nodes: 0, total_edges: 0 } });
      }

      // Step 2: Build intervention type nodes (hub) and entity nodes (spokes)
      const nodes: Array<{
        id: string; label: string; type: string; size: number;
        color?: string; gs_id?: string; entity_type?: string;
        evidence_level?: string; intervention_type?: string;
        is_community_controlled?: boolean;
      }> = [];
      const edges: Array<{ source: string; target: string; value: number; label?: string }> = [];
      const seenNodes = new Set<string>();

      // Create intervention type hub nodes
      const typeGroups = new Map<string, typeof almaRows>();
      for (const row of almaRows) {
        if (!typeGroups.has(row.type)) typeGroups.set(row.type, []);
        typeGroups.get(row.type)!.push(row);
      }

      for (const [type, interventions] of typeGroups) {
        const typeNodeId = `type-${type}`;
        if (!seenNodes.has(typeNodeId)) {
          seenNodes.add(typeNodeId);
          nodes.push({
            id: typeNodeId,
            label: type,
            type: 'intervention_type',
            size: 8 + interventions.length * 2,
            intervention_type: type,
          });
        }

        for (const intervention of interventions) {
          const intNodeId = `int-${intervention.id}`;
          if (!seenNodes.has(intNodeId)) {
            seenNodes.add(intNodeId);
            nodes.push({
              id: intNodeId,
              label: intervention.name,
              type: 'intervention',
              size: 5,
              evidence_level: intervention.evidence_level,
              intervention_type: intervention.type,
            });
          }

          // Edge: type → intervention
          edges.push({
            source: typeNodeId,
            target: intNodeId,
            value: 1,
            label: type,
          });

          // If linked to an entity, add entity node + edge
          if (intervention.gs_entity_id && intervention.entity_name) {
            const entityNodeId = `entity-${intervention.gs_entity_id}`;
            if (!seenNodes.has(entityNodeId)) {
              seenNodes.add(entityNodeId);
              nodes.push({
                id: entityNodeId,
                label: intervention.entity_name,
                type: 'entity',
                size: 6,
                gs_id: intervention.entity_gs_id || undefined,
                entity_type: intervention.entity_type || undefined,
                is_community_controlled: intervention.is_community_controlled,
              });
            }

            edges.push({
              source: intNodeId,
              target: entityNodeId,
              value: 2,
              label: 'delivered_by',
            });
          }
        }
      }

      // Step 3: Add funding relationships between entities
      const entityIds = almaRows
        .filter(r => r.gs_entity_id)
        .map(r => `'${r.gs_entity_id}'`);

      if (entityIds.length > 1) {
        const fundingRows = await paginatedRpc<{
          source_entity_id: string; target_entity_id: string;
          relationship_type: string; amount: number | null;
        }>(supabase,
          `SELECT source_entity_id, target_entity_id, relationship_type, SUM(amount) as amount
           FROM gs_relationships
           WHERE source_entity_id IN (${entityIds.join(',')})
             AND target_entity_id IN (${entityIds.join(',')})
             AND source_entity_id != target_entity_id
           GROUP BY source_entity_id, target_entity_id, relationship_type`,
          1000
        );

        for (const row of fundingRows) {
          edges.push({
            source: `entity-${row.source_entity_id}`,
            target: `entity-${row.target_entity_id}`,
            value: row.amount || 1,
            label: row.relationship_type,
          });
        }
      }

      const response = NextResponse.json({
        nodes,
        edges,
        meta: {
          mode: 'alma',
          total_nodes: nodes.length,
          total_edges: edges.length,
          intervention_types: typeGroups.size,
          linked_entities: entityIds.length,
          filters: { mode: 'alma', topic, state, limit },
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
