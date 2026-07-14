import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';

type RouteContext = { params: Promise<{ orgProfileId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const contactId = typeof body.contact_id === 'string' ? body.contact_id.trim() : '';
  const entityId = typeof body.entity_id === 'string' ? body.entity_id.trim() : '';
  if (!UUID_RE.test(contactId) || !UUID_RE.test(entityId)) {
    return NextResponse.json({ error: 'Valid contact_id and entity_id values are required' }, { status: 400 });
  }

  const { data: entity, error: entityError } = await auth.serviceDb
    .from('gs_entities')
    .select('id, canonical_name, abn, entity_type')
    .eq('id', entityId)
    .maybeSingle();
  if (entityError || !entity) {
    return NextResponse.json({ error: entityError?.message || 'CivicGraph entity not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: contact, error: contactError } = await auth.serviceDb
    .from('org_contacts')
    .update({ linked_entity_id: entityId, updated_at: now })
    .eq('id', contactId)
    .eq('org_profile_id', orgProfileId)
    .is('linked_entity_id', null)
    .select('id, name, organisation, email, linked_entity_id')
    .maybeSingle();
  if (contactError) return NextResponse.json({ error: contactError.message }, { status: 500 });
  if (!contact) {
    return NextResponse.json({ error: 'Contact is already linked or no longer exists' }, { status: 409 });
  }

  const { error: auditError } = await auth.serviceDb.from('opportunity_context_events').upsert({
    org_profile_id: orgProfileId,
    source_system: 'civicgraph',
    source_type: 'contact_resolution',
    source_ref: `contact-resolution:${contactId}`,
    title: `${contact.name}: entity linked`,
    summary: `${contact.organisation || contact.name} linked to ${entity.canonical_name}`,
    actor_name: contact.name,
    actor_email: contact.email,
    organisation: entity.canonical_name,
    lane: 'relationship',
    signal_kind: 'crm_entity_link',
    confidence: 1,
    happened_at: now,
    metadata: {
      contact_id: contactId,
      entity_id: entityId,
      entity_abn: entity.abn,
      entity_type: entity.entity_type,
      recorded_by: auth.userId,
    },
    updated_at: now,
  }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' });

  revalidateTag('act-funder-intelligence');
  return NextResponse.json({
    contact,
    entity,
    audit_recorded: !auditError,
    audit_warning: auditError?.message ?? null,
  });
}
