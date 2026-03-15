import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/relationship-intel — Relationship Intelligence Engine
 *
 * Maps your organisation's contacts against CivicGraph's entity graph,
 * finds warm paths to target funders/suppliers, and recommends engagement
 * strategies based on relationship proximity, shared networks, and timing.
 *
 * Query params:
 *   action   — 'map' | 'warmpath' | 'recommend' | 'dashboard' (default: 'dashboard')
 *   target   — target entity gs_id (for warmpath)
 *   limit    — max results (default: 20)
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') || 'dashboard';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  const supabase = getServiceSupabase();

  try {
    // Get user's org profile
    const { data: profile } = await supabase
      .from('org_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Organisation profile required. Set up your profile first.' }, { status: 400 });
    }

    switch (action) {
      case 'map':
        return handleContactMap(supabase, user.id, profile, limit);
      case 'warmpath':
        return handleWarmPath(supabase, user.id, profile, searchParams.get('target') || '', limit);
      case 'recommend':
        return handleRecommendations(supabase, user.id, profile, limit);
      case 'dashboard':
        return handleDashboard(supabase, user.id, profile, limit);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// MAP: Link your contacts to CivicGraph entities
// ─────────────────────────────────────────────────────────────────
async function handleContactMap(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  profile: Record<string, unknown>,
  limit: number
) {
  // Get user's GHL contacts
  const { data: contacts } = await supabase
    .from('ghl_contacts')
    .select('id, email, first_name, last_name, company_name, tags')
    .limit(200);

  if (!contacts?.length) {
    return NextResponse.json({
      contact_map: [],
      message: 'No contacts found. Sync your contacts from GoHighLevel or add them manually.',
    });
  }

  // Extract company names and try to match against gs_entities
  const companyNames = [...new Set(
    contacts.filter(c => c.company_name).map(c => c.company_name!.trim())
  )];

  const entityMatches: Array<{
    contact: typeof contacts[0];
    entity: Record<string, unknown> | null;
    match_type: 'company' | 'name' | 'none';
    relationship_strength: 'direct' | 'indirect' | 'unknown';
  }> = [];

  // Batch match companies against entities
  if (companyNames.length > 0) {
    const { data: matchedEntities } = await supabase
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, state, sector, latest_revenue, website')
      .or(companyNames.slice(0, 50).map(n => `canonical_name.ilike.%${n.replace(/[%_]/g, '')}%`).join(','))
      .limit(100);

    const entityLookup = new Map(
      (matchedEntities || []).map(e => [e.canonical_name.toLowerCase(), e])
    );

    for (const contact of contacts.slice(0, limit)) {
      const companyLower = (contact.company_name || '').toLowerCase();
      let matched = false;

      for (const [name, entity] of entityLookup) {
        if (companyLower && (name.includes(companyLower) || companyLower.includes(name))) {
          entityMatches.push({
            contact,
            entity,
            match_type: 'company',
            relationship_strength: 'direct',
          });
          matched = true;
          break;
        }
      }

      if (!matched) {
        entityMatches.push({
          contact,
          entity: null,
          match_type: 'none',
          relationship_strength: 'unknown',
        });
      }
    }
  }

  const matched = entityMatches.filter(m => m.entity);
  const unmatched = entityMatches.filter(m => !m.entity);

  return NextResponse.json({
    contact_map: entityMatches,
    summary: {
      total_contacts: contacts.length,
      matched: matched.length,
      unmatched: unmatched.length,
      match_rate: contacts.length > 0 ? +(matched.length / contacts.length).toFixed(2) : 0,
      entity_types: Object.entries(
        matched.reduce((acc, m) => {
          const t = (m.entity as Record<string, unknown>)?.entity_type as string || 'unknown';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => ({ type, count })),
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// WARM PATH: Find shortest path to a target entity through your network
// ─────────────────────────────────────────────────────────────────
async function handleWarmPath(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  profile: Record<string, unknown>,
  targetGsId: string,
  limit: number
) {
  if (!targetGsId) {
    return NextResponse.json({
      error: 'Provide target entity: ?action=warmpath&target=GS-12345',
    }, { status: 400 });
  }

  // Get target entity
  const { data: target } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name, entity_type, state, sector, website')
    .eq('gs_id', targetGsId)
    .single();

  if (!target) {
    return NextResponse.json({ error: `Entity ${targetGsId} not found` }, { status: 404 });
  }

  // Get all entities connected to the target
  const { data: targetConnections } = await supabase
    .from('gs_relationships')
    .select(`
      id, relationship_type, amount, year, dataset,
      source_entity_id, target_entity_id
    `)
    .or(`source_entity_id.eq.${target.id},target_entity_id.eq.${target.id}`)
    .order('amount', { ascending: false, nullsFirst: false })
    .limit(50);

  // Get connected entity IDs
  const connectedIds = new Set<string>();
  for (const r of targetConnections || []) {
    connectedIds.add(r.source_entity_id);
    connectedIds.add(r.target_entity_id);
  }
  connectedIds.delete(target.id);

  // Get entity details for connected nodes
  const { data: connectedEntities } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name, abn, entity_type, state')
    .in('id', [...connectedIds].slice(0, 30));

  const entityLookup = new Map(
    (connectedEntities || []).map(e => [e.id, e])
  );

  // Get user's contacts and match against connected entities
  const { data: contacts } = await supabase
    .from('ghl_contacts')
    .select('id, email, first_name, last_name, company_name')
    .limit(200);

  // Find warm paths: contacts whose companies match entities connected to the target
  const warmPaths: Array<{
    contact: Record<string, unknown>;
    intermediary_entity: Record<string, unknown>;
    relationship_to_target: Record<string, unknown>;
    path_strength: 'strong' | 'moderate' | 'weak';
    suggested_action: string;
  }> = [];

  for (const contact of contacts || []) {
    if (!contact.company_name) continue;
    const companyLower = contact.company_name.toLowerCase();

    for (const [entityId, entity] of entityLookup) {
      const entityNameLower = entity.canonical_name.toLowerCase();
      if (companyLower.includes(entityNameLower) || entityNameLower.includes(companyLower)) {
        // Found a warm path: contact → their org → target
        const rel = (targetConnections || []).find(
          r => r.source_entity_id === entityId || r.target_entity_id === entityId
        );

        const strength = rel?.amount && rel.amount > 100000 ? 'strong' :
          rel?.amount && rel.amount > 10000 ? 'moderate' : 'weak';

        warmPaths.push({
          contact: {
            name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
            email: contact.email,
            company: contact.company_name,
          },
          intermediary_entity: {
            gs_id: entity.gs_id,
            name: entity.canonical_name,
            type: entity.entity_type,
          },
          relationship_to_target: {
            type: rel?.relationship_type || 'unknown',
            amount: rel?.amount || null,
            year: rel?.year || null,
          },
          path_strength: strength,
          suggested_action: strength === 'strong'
            ? `Ask ${contact.first_name || 'contact'} for a direct introduction to ${target.canonical_name}`
            : strength === 'moderate'
              ? `Mention your connection to ${entity.canonical_name} when reaching out to ${target.canonical_name}`
              : `Research ${entity.canonical_name}'s relationship with ${target.canonical_name} before reaching out`,
        });
      }
    }
  }

  // Also find shared board members / directors
  const { data: targetDirectors } = await supabase
    .from('person_roles')
    .select('person_name_normalised, role_type')
    .eq('company_acn', target.abn?.slice(0, 9) || '___')
    .is('cessation_date', null)
    .limit(20);

  // Build engagement strategies for the target
  const strategies: Array<{
    type: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }> = [];

  if (warmPaths.length > 0) {
    strategies.push({
      type: 'warm_intro',
      action: `Get introduced via ${warmPaths[0].contact.name} at ${(warmPaths[0].intermediary_entity as { name: string }).name}`,
      priority: 'high',
      reasoning: `You have ${warmPaths.length} warm path(s) to ${target.canonical_name}`,
    });
  }

  if (target.entity_type === 'foundation') {
    strategies.push({
      type: 'event',
      action: `Attend ${target.canonical_name}'s next public event or grant information session`,
      priority: 'high',
      reasoning: 'Foundations typically hold annual events and info sessions for prospective grantees',
    });
    strategies.push({
      type: 'social_media',
      action: `Follow and engage with ${target.canonical_name} on LinkedIn and Twitter before reaching out`,
      priority: 'medium',
      reasoning: 'Building social proof before a formal approach increases response rates',
    });
  }

  if (target.entity_type === 'government_body') {
    strategies.push({
      type: 'direct_contact',
      action: `Find the procurement or grants officer at ${target.canonical_name} and request a capabilities briefing`,
      priority: 'high',
      reasoning: 'Government bodies have formal engagement pathways — use them',
    });
  }

  if (target.sector) {
    strategies.push({
      type: 'event',
      action: `Attend ${target.sector} sector conferences where ${target.canonical_name} is likely to present`,
      priority: 'medium',
      reasoning: `Sector events are the natural meeting point for ${target.sector} organisations`,
    });
  }

  strategies.push({
    type: 'content',
    action: `Publish a case study or thought piece relevant to ${target.canonical_name}'s focus area, then share directly`,
    priority: 'medium',
    reasoning: 'Demonstrating domain expertise creates inbound interest',
  });

  if ((targetDirectors || []).length > 0) {
    strategies.push({
      type: 'network',
      action: `Research board members: ${(targetDirectors || []).slice(0, 3).map(d => d.person_name_normalised).join(', ')} — find mutual connections`,
      priority: 'medium',
      reasoning: `${target.canonical_name} has ${(targetDirectors || []).length} known board/leadership roles`,
    });
  }

  return NextResponse.json({
    target: {
      gs_id: target.gs_id,
      name: target.canonical_name,
      type: target.entity_type,
      state: target.state,
      sector: target.sector,
      website: target.website,
    },
    warm_paths: warmPaths.slice(0, limit),
    strategies,
    network: {
      total_connections: (targetConnections || []).length,
      directors: (targetDirectors || []).map(d => ({
        name: d.person_name_normalised,
        role: d.role_type,
      })),
      top_relationships: (targetConnections || []).slice(0, 10).map(r => {
        const otherId = r.source_entity_id === target.id ? r.target_entity_id : r.source_entity_id;
        const otherEntity = entityLookup.get(otherId);
        return {
          entity: otherEntity?.canonical_name || 'Unknown',
          entity_type: otherEntity?.entity_type || 'unknown',
          gs_id: otherEntity?.gs_id || null,
          relationship: r.relationship_type,
          amount: r.amount,
          year: r.year,
        };
      }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// RECOMMEND: Engagement recommendations across your whole network
// ─────────────────────────────────────────────────────────────────
async function handleRecommendations(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  profile: Record<string, unknown>,
  limit: number
) {
  const orgName = profile.name as string || '';
  const orgAbn = profile.abn as string || '';
  const domains = (profile.domains || profile.focus_areas || []) as string[];
  const geoFocus = (profile.geographic_focus || []) as string[];

  // 1. Find foundations matching our focus areas
  const focusFilters = domains.length > 0
    ? domains.slice(0, 5).map(d => `thematic_focus.cs.{${d}}`).join(',')
    : 'thematic_focus.cs.{community}';

  const { data: matchedFoundations } = await supabase
    .from('foundations')
    .select('id, name, type, total_giving_annual, thematic_focus, geographic_focus, website')
    .or(focusFilters)
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(limit);

  // 2. Find grants closing soon that match
  const { data: upcomingGrants } = await supabase
    .from('grant_opportunities')
    .select('id, name, provider, amount_min, amount_max, closes_at, url, categories')
    .gt('closes_at', new Date().toISOString())
    .order('closes_at', { ascending: true })
    .limit(limit);

  // 3. Find entities in our sector/geography we should know
  const stateFilter = geoFocus.length > 0
    ? geoFocus.map(g => g.replace('AU-', '')).filter(s => s.length <= 3)
    : [];

  let entityQuery = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, entity_type, state, sector, latest_revenue, website')
    .in('entity_type', ['foundation', 'government_body', 'indigenous_corp'])
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (stateFilter.length > 0) {
    entityQuery = entityQuery.in('state', stateFilter);
  }

  const { data: keyEntities } = await entityQuery;

  // 4. Check which entities we already have contacts at
  const { data: contacts } = await supabase
    .from('ghl_contacts')
    .select('company_name')
    .limit(500);

  const knownCompanies = new Set(
    (contacts || []).map(c => (c.company_name || '').toLowerCase()).filter(Boolean)
  );

  // Build recommendations
  const recommendations: Array<{
    type: 'foundation' | 'grant' | 'entity' | 'event' | 'social';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    action: string;
    entity_name?: string;
    gs_id?: string;
    url?: string | null;
    deadline?: string | null;
    already_connected: boolean;
  }> = [];

  // Upcoming grants
  for (const grant of upcomingGrants || []) {
    const daysUntilClose = grant.closes_at
      ? Math.ceil((new Date(grant.closes_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    recommendations.push({
      type: 'grant',
      priority: daysUntilClose && daysUntilClose <= 14 ? 'urgent' : daysUntilClose && daysUntilClose <= 30 ? 'high' : 'medium',
      title: grant.name,
      detail: `${grant.provider || 'Unknown funder'} — $${(grant.amount_min || 0).toLocaleString()} to $${(grant.amount_max || 0).toLocaleString()}`,
      action: daysUntilClose && daysUntilClose <= 14
        ? `URGENT: Apply within ${daysUntilClose} days`
        : `Research and prepare application — ${daysUntilClose || '?'} days remaining`,
      url: grant.url,
      deadline: grant.closes_at,
      already_connected: false,
    });
  }

  // Foundation engagement
  for (const foundation of matchedFoundations || []) {
    const isConnected = knownCompanies.has(foundation.name.toLowerCase());
    recommendations.push({
      type: 'foundation',
      priority: (foundation.total_giving_annual || 0) > 1000000 ? 'high' : 'medium',
      title: `Engage ${foundation.name}`,
      detail: `Annual giving: $${((foundation.total_giving_annual || 0) / 1000).toFixed(0)}K — Focus: ${(foundation.thematic_focus || []).join(', ')}`,
      action: isConnected
        ? `You have a contact here — schedule a catch-up and discuss your latest work`
        : `No contact yet — follow on LinkedIn, attend their events, or request an introductory meeting`,
      entity_name: foundation.name,
      url: foundation.website,
      already_connected: isConnected,
    });
  }

  // Key entities to know
  for (const entity of keyEntities || []) {
    const isConnected = knownCompanies.has(entity.canonical_name.toLowerCase());
    if (isConnected) continue; // Skip already-connected entities

    recommendations.push({
      type: 'entity',
      priority: entity.entity_type === 'government_body' ? 'high' : 'medium',
      title: `Connect with ${entity.canonical_name}`,
      detail: `${entity.entity_type?.replace(/_/g, ' ')} in ${entity.state || 'unknown state'} — ${entity.sector || 'general sector'}`,
      action: entity.entity_type === 'government_body'
        ? `Find the relevant program officer and request a capability briefing`
        : entity.entity_type === 'foundation'
          ? `Research their grant cycles and submit an expression of interest`
          : `Reach out for a partnership conversation — mutual benefit in ${entity.sector || 'your sector'}`,
      entity_name: entity.canonical_name,
      gs_id: entity.gs_id,
      url: entity.website,
      already_connected: false,
    });
  }

  // Generic high-value strategies
  recommendations.push({
    type: 'social',
    priority: 'medium',
    title: 'Publish a sector impact report',
    detail: 'Share your outcomes data on LinkedIn — tag key funders and government contacts',
    action: 'Draft a 1-page impact summary and publish as a LinkedIn article. Tag all foundation contacts.',
    already_connected: false,
  });

  recommendations.push({
    type: 'event',
    priority: 'medium',
    title: 'Attend sector conferences in your focus areas',
    detail: `Look for events in: ${domains.join(', ') || 'your sector'}`,
    action: 'Search for upcoming conferences, AIATSIS events, philanthropy sector meetups, and government industry briefings',
    already_connected: false,
  });

  // Sort: urgent first, then high, medium, low
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return NextResponse.json({
    recommendations: recommendations.slice(0, limit * 2),
    summary: {
      total: recommendations.length,
      urgent: recommendations.filter(r => r.priority === 'urgent').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      already_connected: recommendations.filter(r => r.already_connected).length,
      new_opportunities: recommendations.filter(r => !r.already_connected).length,
    },
    org: {
      name: orgName,
      focus_areas: domains,
      geographic_focus: geoFocus,
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD: Full relationship intelligence overview
// ─────────────────────────────────────────────────────────────────
async function handleDashboard(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  profile: Record<string, unknown>,
  limit: number
) {
  // Run all three in parallel
  const [mapRes, recRes] = await Promise.all([
    handleContactMap(supabase, userId, profile, 10),
    handleRecommendations(supabase, userId, profile, 10),
  ]);

  const mapData = await mapRes.json();
  const recData = await recRes.json();

  // Get saved grants pipeline summary
  const { data: savedGrants } = await supabase
    .from('saved_grants')
    .select('stage, stars')
    .eq('user_id', userId);

  const pipeline = {
    total: (savedGrants || []).length,
    by_stage: Object.entries(
      (savedGrants || []).reduce((acc, g) => {
        acc[g.stage] = (acc[g.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([stage, count]) => ({ stage, count })),
  };

  return NextResponse.json({
    org: {
      name: profile.name,
      abn: profile.abn,
      focus_areas: profile.domains || profile.focus_areas || [],
    },
    contact_map: mapData.summary,
    recommendations: recData.recommendations?.slice(0, 5),
    recommendation_summary: recData.summary,
    pipeline,
    next_actions: [
      ...(recData.recommendations || [])
        .filter((r: { priority: string }) => r.priority === 'urgent')
        .slice(0, 3)
        .map((r: { title: string; action: string }) => ({ title: r.title, action: r.action })),
      ...(recData.recommendations || [])
        .filter((r: { priority: string }) => r.priority === 'high')
        .slice(0, 3)
        .map((r: { title: string; action: string }) => ({ title: r.title, action: r.action })),
    ],
    generated_at: new Date().toISOString(),
  });
}
