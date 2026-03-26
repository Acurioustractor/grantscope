import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { gsId } = await context.params;
  const db = getServiceSupabase();

  // Look up entity
  const { data: entity } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name, entity_type')
    .eq('gs_id', gsId)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Person entities: return board network with co-directors
  if (entity.entity_type === 'person') {
    return handlePersonNetwork(db, entity);
  }

  // Get top 50 connected entities
  // For person entities: include all relationships (directorships have no amount)
  // For orgs: prefer relationships with amounts, but include non-financial too
  const isPerson = entity.entity_type === 'person';

  const [{ data: outbound }, { data: inbound }] = await Promise.all([
    db
      .from('gs_relationships')
      .select('target_entity_id, relationship_type, amount')
      .eq('source_entity_id', entity.id)
      .limit(500),
    db
      .from('gs_relationships')
      .select('source_entity_id, relationship_type, amount')
      .eq('target_entity_id', entity.id)
      .limit(500),
  ]);

  // Aggregate by counterparty
  const counterpartyStats = new Map<string, { total: number; count: number; types: Set<string> }>();

  for (const r of outbound || []) {
    const id = r.target_entity_id;
    const existing = counterpartyStats.get(id) || { total: 0, count: 0, types: new Set() };
    existing.total += r.amount || 0;
    existing.count += 1;
    existing.types.add(r.relationship_type);
    counterpartyStats.set(id, existing);
  }

  for (const r of inbound || []) {
    const id = r.source_entity_id;
    const existing = counterpartyStats.get(id) || { total: 0, count: 0, types: new Set() };
    existing.total += r.amount || 0;
    existing.count += 1;
    existing.types.add(r.relationship_type);
    counterpartyStats.set(id, existing);
  }

  // Get top 50 — sort by amount for orgs, by count for persons
  const topCounterparties = Array.from(counterpartyStats.entries())
    .sort((a, b) => isPerson
      ? b[1].count - a[1].count || b[1].total - a[1].total
      : b[1].total - a[1].total || b[1].count - a[1].count)
    .slice(0, 50);

  if (topCounterparties.length === 0) {
    return NextResponse.json({
      nodes: [],
      edges: [],
      center: { id: entity.id, gs_id: entity.gs_id, name: entity.canonical_name, entity_type: entity.entity_type },
      entityTypes: {},
    });
  }

  // Fetch entity details for top counterparties
  const cpIds = topCounterparties.map(([id]) => id);
  const entityMap = new Map<string, { id: string; gs_id: string; canonical_name: string; entity_type: string }>();

  for (let i = 0; i < cpIds.length; i += 100) {
    const chunk = cpIds.slice(i, i + 100);
    const { data: entities } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type')
      .in('id', chunk);
    for (const e of entities || []) {
      entityMap.set(e.id, e);
    }
  }

  // Build nodes
  const nodes = topCounterparties.map(([id, stats]) => {
    const e = entityMap.get(id);
    return {
      id,
      gs_id: e?.gs_id || '',
      name: e?.canonical_name || 'Unknown',
      entity_type: e?.entity_type || 'unknown',
      total_amount: stats.total,
      relationship_types: Array.from(stats.types),
    };
  });

  // Build edges (simplified: one edge per counterparty with dominant type)
  const edges = topCounterparties.map(([id, stats]) => ({
    source: entity.id,
    target: id,
    amount: stats.total,
    relationship_type: Array.from(stats.types)[0], // dominant type
  }));

  // Entity type distribution
  const entityTypes: Record<string, number> = {};
  for (const node of nodes) {
    entityTypes[node.entity_type] = (entityTypes[node.entity_type] || 0) + 1;
  }

  return NextResponse.json({
    nodes,
    edges,
    center: {
      id: entity.id,
      gs_id: entity.gs_id,
      name: entity.canonical_name,
      entity_type: entity.entity_type,
    },
    entityTypes,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePersonNetwork(db: any, entity: { id: string; gs_id: string; canonical_name: string; entity_type: string }) {
  const nameNormalised = entity.canonical_name.toUpperCase();

  // 1. Get all orgs this person sits on
  const { data: myRoles } = await db
    .from('person_roles')
    .select('role_type, company_name, company_abn, entity_id, properties')
    .or(`person_entity_id.eq.${entity.id},person_name_normalised.eq.${nameNormalised}`)
    .order('company_name');

  if (!myRoles || myRoles.length === 0) {
    return NextResponse.json({ type: 'person', boards: [], person: entity });
  }

  // 2. Get entity details for orgs
  const entityIds = [...new Set(myRoles.map((r: { entity_id: string }) => r.entity_id).filter(Boolean))];
  const { data: orgEntities } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name, entity_type, latest_revenue')
    .in('id', entityIds);

  const orgById = new Map((orgEntities || []).map((o: { id: string; gs_id: string; canonical_name: string; entity_type: string; latest_revenue: number | null }) => [o.id, o]));

  // 3. Get co-directors for each org
  const { data: allRolesAtOrgs } = await db
    .from('person_roles')
    .select('person_name, person_name_normalised, role_type, entity_id, person_entity_id, properties')
    .in('entity_id', entityIds)
    .neq('person_name_normalised', nameNormalised)
    .order('person_name');

  // Group co-directors by org
  const coDirectorsByOrg = new Map<string, Array<{ person_name: string; role_type: string; person_entity_id: string | null; properties: Record<string, string> | null }>>();
  for (const r of allRolesAtOrgs || []) {
    const list = coDirectorsByOrg.get(r.entity_id) || [];
    list.push({ person_name: r.person_name, role_type: r.role_type, person_entity_id: r.person_entity_id, properties: r.properties });
    coDirectorsByOrg.set(r.entity_id, list);
  }

  // 4. Count how many orgs each co-director appears across (interlock strength)
  const personOrgCount = new Map<string, number>();
  for (const r of allRolesAtOrgs || []) {
    const key = r.person_name_normalised;
    personOrgCount.set(key, (personOrgCount.get(key) || 0) + 1);
  }

  // 5. Look up gs_ids for co-directors — by person_entity_id AND by name
  const personEntityIds = [...new Set((allRolesAtOrgs || []).map((r: { person_entity_id: string | null }) => r.person_entity_id).filter(Boolean))];
  const personGsIdMap = new Map<string, string>();

  // By person_entity_id
  if (personEntityIds.length > 0) {
    const { data: personEntities } = await db
      .from('gs_entities')
      .select('id, gs_id')
      .in('id', personEntityIds);
    for (const p of personEntities || []) {
      personGsIdMap.set((p as { id: string; gs_id: string }).id, (p as { id: string; gs_id: string }).gs_id);
    }
  }

  // By canonical_name for those without person_entity_id (mega-linker created these)
  const namesWithoutLink = Array.from(new Set(
    (allRolesAtOrgs || [])
      .filter((r: { person_entity_id: string | null }) => !r.person_entity_id)
      .map((r: { person_name: string }) => r.person_name as string)
  )) as string[];
  const nameToGsId = new Map<string, string>();
  if (namesWithoutLink.length > 0) {
    // Use exec_sql for case-insensitive matching (ACNC stores some names in ALL CAPS)
    const { data: nameMatches } = await db.rpc('exec_sql', {
      query: `SELECT canonical_name, gs_id FROM gs_entities WHERE entity_type = 'person' AND UPPER(canonical_name) IN (${namesWithoutLink.map((n: string) => `'${n.toUpperCase().replace(/'/g, "''")}'`).join(',')})`,
    });
    for (const m of nameMatches || []) {
      const match = m as { canonical_name: string; gs_id: string };
      nameToGsId.set(match.canonical_name, match.gs_id);
      nameToGsId.set(match.canonical_name.toUpperCase(), match.gs_id);
    }
  }

  // 6. Build response
  const boards = myRoles.map((role: { entity_id: string; role_type: string; company_name: string; properties: Record<string, string> | null }) => {
    const org = orgById.get(role.entity_id) as { gs_id: string; canonical_name: string; entity_type: string; latest_revenue: number | null } | undefined;
    const coDirectors = (coDirectorsByOrg.get(role.entity_id) || []).map((cd) => {
      let gsId: string | null = null;
      if (cd.person_entity_id) {
        gsId = personGsIdMap.get(cd.person_entity_id) || null;
      }
      if (!gsId) {
        gsId = nameToGsId.get(cd.person_name) || nameToGsId.get(cd.person_name.toUpperCase()) || null;
      }
      return {
        name: cd.person_name,
        role: cd.role_type,
        title: cd.properties?.title || null,
        gs_id: gsId,
        shared_boards: personOrgCount.get(cd.person_name.toUpperCase()) || 0,
      };
    });

    return {
      org_name: org?.canonical_name || role.company_name,
      org_gs_id: org?.gs_id || null,
      org_type: org?.entity_type || null,
      org_revenue: org?.latest_revenue || null,
      my_role: role.properties?.title || role.role_type,
      co_directors: coDirectors,
    };
  });

  return NextResponse.json({
    type: 'person',
    person: { id: entity.id, gs_id: entity.gs_id, name: entity.canonical_name },
    boards,
  });
}
