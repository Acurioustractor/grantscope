import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contacts/graph?contactId=xxx
 * GET /api/contacts/graph?email=xxx
 *
 * Returns the contact's linked entities + their graph relationships.
 * Powers the Relationship Flywheel — "You know Sarah at Org X,
 * she sits on the board of Foundation Y which funded $500K last year."
 *
 * Requires 'relationships' module (organisation tier+).
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('relationships');
  if (auth.error) return auth.error;

  const contactId = request.nextUrl.searchParams.get('contactId');
  const email = request.nextUrl.searchParams.get('email');

  if (!contactId && !email) {
    return NextResponse.json(
      { error: 'contactId or email required' },
      { status: 400 }
    );
  }

  const db = getServiceSupabase();

  // Resolve contact
  let resolvedContactId = contactId;
  if (!resolvedContactId && email) {
    const { data: contact } = await db
      .from('ghl_contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    resolvedContactId = contact.id;
  }

  // Get linked entities with confidence scores
  const { data: links, error: linkErr } = await db
    .from('contact_entity_links')
    .select(`
      confidence_score,
      link_method,
      link_evidence,
      verified,
      entity:gs_entities (
        id,
        gs_id,
        canonical_name,
        abn,
        entity_type,
        sector,
        state,
        website,
        description
      )
    `)
    .eq('contact_id', resolvedContactId)
    .order('confidence_score', { ascending: false });

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  if (!links || links.length === 0) {
    return NextResponse.json({
      contact_id: resolvedContactId,
      linked_entities: [],
      relationships: [],
      insights: [],
    });
  }

  // Get graph relationships for all linked entities (funding, contracts, board positions)
  // Supabase returns foreign key joins as arrays for .select()
  const entityIds = links
    .map((l) => {
      const e = l.entity;
      if (Array.isArray(e)) return (e as { id: string }[])[0]?.id;
      return (e as { id: string } | null)?.id;
    })
    .filter(Boolean) as string[];

  const { data: relationships } = await db
    .from('gs_relationships')
    .select(`
      id,
      relationship_type,
      amount,
      year,
      dataset,
      source_entity:gs_entities!gs_relationships_source_entity_id_fkey (
        id, gs_id, canonical_name, entity_type
      ),
      target_entity:gs_entities!gs_relationships_target_entity_id_fkey (
        id, gs_id, canonical_name, entity_type
      )
    `)
    .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
    .limit(200);

  // Normalize links — Supabase may return entity as array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedLinks: Link[] = (links as any[]).map((l) => ({
    ...l,
    entity: Array.isArray(l.entity) ? l.entity[0] ?? null : l.entity,
  }));

  // Generate insights
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedRels: Relationship[] = ((relationships || []) as any[]).map((r) => ({
    ...r,
    source_entity: Array.isArray(r.source_entity) ? r.source_entity[0] ?? null : r.source_entity,
    target_entity: Array.isArray(r.target_entity) ? r.target_entity[0] ?? null : r.target_entity,
  }));

  const insights = generateInsights(normalizedLinks, normalizedRels);

  return NextResponse.json({
    contact_id: resolvedContactId,
    linked_entities: normalizedLinks,
    relationships: normalizedRels,
    insights,
  });
}

interface EntityRef {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
}

interface Link {
  confidence_score: number;
  link_method: string;
  link_evidence: Record<string, unknown>;
  verified: boolean;
  entity: EntityRef | null;
}

interface Relationship {
  id: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  dataset: string | null;
  source_entity: EntityRef | null;
  target_entity: EntityRef | null;
}

function generateInsights(
  links: Link[],
  relationships: Relationship[]
): string[] {
  const insights: string[] = [];

  for (const link of links) {
    const entity = link.entity;
    if (!entity) continue;

    // Find relationships where this entity is involved
    const entityRels = relationships.filter(
      (r) =>
        r.source_entity?.id === entity.id || r.target_entity?.id === entity.id
    );

    // Foundation funding insights
    const fundingReceived = entityRels.filter(
      (r) =>
        r.relationship_type === 'grant' && r.target_entity?.id === entity.id
    );
    if (fundingReceived.length > 0) {
      const totalFunding = fundingReceived.reduce(
        (sum, r) => sum + (r.amount || 0),
        0
      );
      const funders = [
        ...new Set(fundingReceived.map((r) => r.source_entity?.canonical_name)),
      ].filter(Boolean);
      if (totalFunding > 0) {
        insights.push(
          `${entity.canonical_name} has received $${(totalFunding / 1e6).toFixed(1)}M in tracked funding from ${funders.length} source(s)`
        );
      }
    }

    // Contract insights
    const contracts = entityRels.filter(
      (r) => r.relationship_type === 'contract'
    );
    if (contracts.length > 0) {
      const totalContracts = contracts.reduce(
        (sum, r) => sum + (r.amount || 0),
        0
      );
      insights.push(
        `${entity.canonical_name} has $${(totalContracts / 1e6).toFixed(1)}M in government contracts (${contracts.length} contracts)`
      );
    }

    // Board/director connections (2nd degree)
    const boardRels = entityRels.filter(
      (r) =>
        r.relationship_type === 'director_of' ||
        r.relationship_type === 'board_member'
    );
    if (boardRels.length > 0) {
      const connectedOrgs = boardRels
        .map((r) =>
          r.source_entity?.id === entity.id
            ? r.target_entity?.canonical_name
            : r.source_entity?.canonical_name
        )
        .filter(Boolean);
      insights.push(
        `${entity.canonical_name} has board connections to: ${connectedOrgs.slice(0, 5).join(', ')}`
      );
    }
  }

  return insights;
}
