import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contacts/analyze?contactId=xxx
 * GET /api/contacts/analyze?email=xxx
 *
 * Stage 3 (ANALYZE) of the Relationship Flywheel.
 * Returns:
 *   - Warm paths (1st/2nd/3rd degree connections to target entities)
 *   - Foundation intent signals (what foundations actually fund vs what they say)
 *   - Procurement intelligence (contract renewal timing)
 *   - Network gaps (high-value entities with no contacts)
 *
 * Requires 'relationships' module (organisation tier+).
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('relationships');
  if (auth.error) return auth.error;

  const contactId = request.nextUrl.searchParams.get('contactId');
  const personId = request.nextUrl.searchParams.get('personId');
  const email = request.nextUrl.searchParams.get('email');
  const targetEntityId = request.nextUrl.searchParams.get('targetEntityId');

  if (!contactId && !personId && !email) {
    return NextResponse.json({ error: 'contactId, personId, or email required' }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Resolve to person_id and/or contact_id
  let resolvedContactId = contactId;
  let resolvedPersonId = personId;

  if (!resolvedContactId && !resolvedPersonId && email) {
    // Try GHL first
    const { data: contact } = await db
      .from('ghl_contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (contact) resolvedContactId = contact.id;

    // Try person_identity_map
    const { data: person } = await db
      .from('person_identity_map')
      .select('person_id')
      .eq('email', email)
      .maybeSingle();
    if (person) resolvedPersonId = person.person_id;

    // Try LinkedIn contacts
    if (!resolvedPersonId) {
      const { data: linkedin } = await db
        .from('linkedin_contacts')
        .select('person_id')
        .eq('email_address', email)
        .maybeSingle();
      if (linkedin) resolvedPersonId = linkedin.person_id;
    }

    if (!resolvedContactId && !resolvedPersonId) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
  }

  // Get linked entities from both bridge tables
  let ghlLinks: { entity_id: string; confidence_score: number; link_method: string }[] = [];
  if (resolvedContactId) {
    const { data } = await db
      .from('contact_entity_links')
      .select('entity_id, confidence_score, link_method')
      .eq('contact_id', resolvedContactId);
    ghlLinks = data || [];
  }

  // Resolve person_id from GHL contact if not already set
  if (!resolvedPersonId && resolvedContactId) {
    const { data: personRecord } = await db
      .from('person_identity_map')
      .select('person_id')
      .eq('ghl_contact_id', resolvedContactId)
      .maybeSingle();
    if (personRecord) resolvedPersonId = personRecord.person_id;
  }

  let personLinks: { entity_id: string; confidence_score: number; link_method: string }[] = [];
  if (resolvedPersonId) {
    const { data } = await db
      .from('person_entity_links')
      .select('entity_id, confidence_score, link_method')
      .eq('person_id', resolvedPersonId);
    personLinks = data || [];
  }

  // Merge and deduplicate (prefer higher confidence)
  const entityMap = new Map<string, { confidence_score: number; link_method: string }>();
  for (const l of [...(ghlLinks || []), ...personLinks]) {
    const existing = entityMap.get(l.entity_id);
    if (!existing || l.confidence_score > existing.confidence_score) {
      entityMap.set(l.entity_id, l);
    }
  }
  const firstDegreeIds = [...entityMap.keys()];

  const identifiers = {
    contact_id: resolvedContactId || null,
    person_id: resolvedPersonId || null,
  };

  // If targeting a specific entity, find warm paths
  if (targetEntityId) {
    const warmPaths = await findWarmPaths(db, resolvedContactId || resolvedPersonId!, firstDegreeIds, targetEntityId);
    return NextResponse.json({ ...identifiers, warm_paths: warmPaths });
  }

  // Full analysis: warm paths to high-value entities, foundation intent, procurement timing
  const [warmPathOpportunities, foundationIntent, procurementTiming, networkGaps] =
    await Promise.all([
      findWarmPathOpportunities(db, resolvedContactId!, firstDegreeIds),
      analyzeFoundationIntent(db, firstDegreeIds),
      findProcurementTiming(db, firstDegreeIds),
      findNetworkGaps(db, firstDegreeIds),
    ]);

  return NextResponse.json({
    ...identifiers,
    first_degree_entities: firstDegreeIds.length,
    warm_path_opportunities: warmPathOpportunities,
    foundation_intent: foundationIntent,
    procurement_timing: procurementTiming,
    network_gaps: networkGaps,
  });
}

/**
 * Find warm paths from contact's entities to a target entity.
 * Returns 1st, 2nd, 3rd degree paths.
 */
async function findWarmPaths(
  db: ReturnType<typeof getServiceSupabase>,
  contactId: string,
  firstDegreeIds: string[],
  targetEntityId: string
) {
  const paths: WarmPath[] = [];

  // 1st degree: contact directly linked to target
  if (firstDegreeIds.includes(targetEntityId)) {
    const { data: contact } = await db
      .from('ghl_contacts')
      .select('first_name, last_name, email, company_name')
      .eq('id', contactId)
      .single();
    paths.push({
      degree: 1,
      path: [`You → ${contact?.first_name} ${contact?.last_name} (direct link)`],
      via_entity: null,
      confidence: 0.95,
    });
  }

  if (firstDegreeIds.length === 0) return paths;

  // 2nd degree: contact's entities have relationships to target
  const { data: secondDegree } = await db
    .from('gs_relationships')
    .select(`
      relationship_type, amount, year,
      source_entity_id, target_entity_id
    `)
    .or(
      `and(source_entity_id.in.(${firstDegreeIds.join(',')}),target_entity_id.eq.${targetEntityId}),` +
      `and(target_entity_id.in.(${firstDegreeIds.join(',')}),source_entity_id.eq.${targetEntityId})`
    )
    .limit(20);

  if (secondDegree && secondDegree.length > 0) {
    // Get entity names for the paths
    const bridgeIds = [...new Set(secondDegree.map((r) =>
      firstDegreeIds.includes(r.source_entity_id) ? r.source_entity_id : r.target_entity_id
    ))];

    const { data: bridgeEntities } = await db
      .from('gs_entities')
      .select('id, canonical_name')
      .in('id', bridgeIds);

    const nameMap = new Map((bridgeEntities || []).map((e) => [e.id, e.canonical_name]));

    for (const rel of secondDegree) {
      const bridgeId = firstDegreeIds.includes(rel.source_entity_id)
        ? rel.source_entity_id
        : rel.target_entity_id;
      paths.push({
        degree: 2,
        path: [`Your org → ${nameMap.get(bridgeId)} → target (${rel.relationship_type})`],
        via_entity: nameMap.get(bridgeId) || null,
        relationship_type: rel.relationship_type,
        amount: rel.amount,
        confidence: 0.7,
      });
    }
  }

  // 3rd degree: find entities connected to contact's entities, then connected to target
  if (paths.length === 0 && firstDegreeIds.length > 0) {
    let thirdDegree = null;
    try {
      const result = await db.rpc('find_third_degree_paths', {
        source_ids: firstDegreeIds,
        target_id: targetEntityId,
        max_results: 10,
      });
      thirdDegree = result.data;
    } catch {
      // RPC may not exist yet — skip 3rd degree
    }

    if (thirdDegree) {
      for (const p of thirdDegree) {
        paths.push({
          degree: 3,
          path: p.path_description ? [p.path_description] : ['3rd degree connection found'],
          via_entity: p.intermediate_entity,
          confidence: 0.4,
        });
      }
    }
  }

  return paths;
}

/**
 * Find warm path opportunities — high-value entities reachable through
 * the contact's network via 2nd degree relationships.
 */
async function findWarmPathOpportunities(
  db: ReturnType<typeof getServiceSupabase>,
  contactId: string,
  firstDegreeIds: string[]
) {
  if (firstDegreeIds.length === 0) return [];

  // Find entities connected to contact's orgs that are foundations or funders
  const { data: opportunities } = await db
    .from('gs_relationships')
    .select(`
      relationship_type, amount, year,
      source_entity:gs_entities!gs_relationships_source_entity_id_fkey (
        id, canonical_name, entity_type, sector
      ),
      target_entity:gs_entities!gs_relationships_target_entity_id_fkey (
        id, canonical_name, entity_type, sector
      )
    `)
    .or(`source_entity_id.in.(${firstDegreeIds.join(',')}),target_entity_id.in.(${firstDegreeIds.join(',')})`)
    .in('relationship_type', ['grant', 'contract', 'director_of', 'board_member'])
    .order('amount', { ascending: false, nullsFirst: false })
    .limit(50);

  if (!opportunities) return [];

  // Deduplicate and rank by value
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (opportunities as any[])
    .map((r) => {
      const source = Array.isArray(r.source_entity) ? r.source_entity[0] : r.source_entity;
      const target = Array.isArray(r.target_entity) ? r.target_entity[0] : r.target_entity;
      // The "other" entity is the one NOT in firstDegreeIds
      const other = firstDegreeIds.includes(source?.id) ? target : source;
      const bridge = firstDegreeIds.includes(source?.id) ? source : target;
      if (!other || seen.has(other.id)) return null;
      seen.add(other.id);
      return {
        entity: other,
        via: bridge?.canonical_name,
        relationship_type: r.relationship_type,
        amount: r.amount,
        year: r.year,
        degree: 2,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Analyze foundation intent — what do connected foundations actually fund
 * vs what they claim to fund?
 */
async function analyzeFoundationIntent(
  db: ReturnType<typeof getServiceSupabase>,
  firstDegreeIds: string[]
) {
  if (firstDegreeIds.length === 0) return [];

  // Find foundations connected to contact's entities
  const { data: foundationRels } = await db
    .from('gs_relationships')
    .select('source_entity_id, target_entity_id, amount, year')
    .eq('relationship_type', 'grant')
    .or(`source_entity_id.in.(${firstDegreeIds.join(',')}),target_entity_id.in.(${firstDegreeIds.join(',')})`)
    .limit(200);

  if (!foundationRels || foundationRels.length === 0) return [];

  // Get connected foundation IDs (sources of grants)
  const foundationIds = [...new Set(foundationRels.map((r) => r.source_entity_id))];
  if (foundationIds.length === 0) return [];

  // Get foundation details
  const { data: foundations } = await db
    .from('gs_entities')
    .select('id, canonical_name, sector, description')
    .in('id', foundationIds.slice(0, 20))
    .eq('entity_type', 'foundation');

  if (!foundations || foundations.length === 0) return [];

  // For each foundation, summarize actual funding pattern
  return foundations.map((f) => {
    const grants = foundationRels.filter((r) => r.source_entity_id === f.id);
    const totalAmount = grants.reduce((sum, r) => sum + (r.amount || 0), 0);
    const years = [...new Set(grants.map((r) => r.year).filter(Boolean))].sort();
    return {
      foundation: f.canonical_name,
      foundation_id: f.id,
      stated_focus: f.sector || f.description?.slice(0, 100) || 'Unknown',
      actual_grants: grants.length,
      actual_total: totalAmount,
      active_years: years,
      insight: totalAmount > 0
        ? `${f.canonical_name} gave ${grants.length} grants totalling $${(totalAmount / 1e6).toFixed(1)}M (${years[0]}–${years[years.length - 1]})`
        : `${f.canonical_name} — connected but no tracked funding`,
    };
  });
}

/**
 * Find procurement timing — government contracts linked to contact's
 * entities that are expiring soon.
 */
async function findProcurementTiming(
  db: ReturnType<typeof getServiceSupabase>,
  firstDegreeIds: string[]
) {
  if (firstDegreeIds.length === 0) return [];

  // Get ABNs for linked entities
  const { data: entities } = await db
    .from('gs_entities')
    .select('id, canonical_name, abn')
    .in('id', firstDegreeIds)
    .not('abn', 'is', null);

  if (!entities || entities.length === 0) return [];

  const abns = entities.map((e) => e.abn).filter(Boolean);
  if (abns.length === 0) return [];

  // Find contracts expiring in next 180 days
  const now = new Date();
  const sixMonths = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const { data: expiringContracts } = await db
    .from('austender_contracts')
    .select('title, contract_value, buyer_name, supplier_name, supplier_abn, contract_start, contract_end')
    .in('supplier_abn', abns)
    .gte('contract_end', now.toISOString().split('T')[0])
    .lte('contract_end', sixMonths.toISOString().split('T')[0])
    .order('contract_end', { ascending: true })
    .limit(20);

  return (expiringContracts || []).map((c) => ({
    title: c.title,
    value: c.contract_value,
    buyer: c.buyer_name,
    supplier: c.supplier_name,
    expires: c.contract_end,
    days_until_expiry: Math.ceil(
      (new Date(c.contract_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
    insight: `Contract "${c.title?.slice(0, 60)}..." ($${((c.contract_value || 0) / 1e6).toFixed(1)}M) with ${c.buyer_name} expires in ${Math.ceil((new Date(c.contract_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`,
  }));
}

/**
 * Find network gaps — high-value entities where the contact has
 * no connections but should.
 */
async function findNetworkGaps(
  db: ReturnType<typeof getServiceSupabase>,
  firstDegreeIds: string[]
) {
  // Find foundations with high grant activity but zero contact links
  const { data: topFunders } = await db
    .from('gs_relationships')
    .select('source_entity_id')
    .eq('relationship_type', 'grant')
    .limit(1000);

  if (!topFunders) return [];

  // Count grants per source entity
  const funderCounts = new Map<string, number>();
  for (const r of topFunders) {
    funderCounts.set(r.source_entity_id, (funderCounts.get(r.source_entity_id) || 0) + 1);
  }

  // Sort by grant count, exclude already-linked entities
  const linkedSet = new Set(firstDegreeIds);
  const gaps = [...funderCounts.entries()]
    .filter(([id]) => !linkedSet.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (gaps.length === 0) return [];

  // Get entity details
  const gapIds = gaps.map(([id]) => id);
  const { data: gapEntities } = await db
    .from('gs_entities')
    .select('id, canonical_name, entity_type, sector, state')
    .in('id', gapIds);

  if (!gapEntities) return [];

  // Also check if ANY contact is linked to these entities
  const { data: existingLinks } = await db
    .from('contact_entity_links')
    .select('entity_id')
    .in('entity_id', gapIds);

  const anyLinked = new Set((existingLinks || []).map((l) => l.entity_id));

  return gapEntities.map((e) => {
    const grantCount = funderCounts.get(e.id) || 0;
    return {
      entity: e,
      grant_activity: grantCount,
      any_contact_linked: anyLinked.has(e.id),
      insight: `${e.canonical_name} (${e.entity_type}) — ${grantCount} grants tracked, ${anyLinked.has(e.id) ? 'other contacts linked' : 'NO contacts linked anywhere'}`,
    };
  }).sort((a, b) => b.grant_activity - a.grant_activity);
}

interface WarmPath {
  degree: number;
  path: string[];
  via_entity: string | null;
  relationship_type?: string;
  amount?: number | null;
  confidence: number;
}
