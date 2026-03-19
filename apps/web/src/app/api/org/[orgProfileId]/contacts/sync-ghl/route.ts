import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../../_lib/auth';
import { upsertContact } from '@/lib/ghl';

type Params = { params: Promise<{ orgProfileId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  // Get org slug for tagging
  const { data: orgProfile } = await auth.serviceDb
    .from('org_profiles')
    .select('slug, name')
    .eq('id', orgProfileId)
    .single();

  if (!orgProfile) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  }

  const CIVICGRAPH_PROFILE_FIELD_ID = 'sGf7MWeuQTUuQIYp4VpS';

  // Get all contacts with emails, plus linked entity for CivicGraph URL
  const { data: contacts, error } = await auth.serviceDb
    .from('org_contacts')
    .select('id, name, email, organisation, contact_type, person_id, linked_entity_id')
    .eq('org_profile_id', orgProfileId)
    .not('email', 'is', null);

  // Build entity gs_id map for CivicGraph URLs
  const entityIds = (contacts ?? []).map(c => c.linked_entity_id).filter(Boolean) as string[];
  let entityGsIdMap: Record<string, string> = {};
  if (entityIds.length > 0) {
    const { data: entities } = await auth.serviceDb
      .from('gs_entities')
      .select('id, gs_id')
      .in('id', entityIds);
    for (const e of entities ?? []) {
      entityGsIdMap[e.id] = e.gs_id;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ contact_id: string; name: string; status: 'synced' | 'error'; ghl_contact_id?: string; error?: string }> = [];

  for (const contact of contacts ?? []) {
    if (!contact.email) continue;

    try {
      // Split name into first/last
      const nameParts = (contact.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const tag = `${orgProfile.slug}-${contact.contact_type}`;

      // Build CivicGraph profile URL
      const gsId = contact.linked_entity_id ? entityGsIdMap[contact.linked_entity_id] : null;
      const civicGraphUrl = gsId
        ? `https://civicgraph.com.au/entity/${encodeURIComponent(gsId)}`
        : `https://civicgraph.com.au/org/${orgProfile.slug}/contacts`;

      const { id: ghlContactId } = await upsertContact({
        email: contact.email,
        firstName,
        lastName,
        companyName: contact.organisation || orgProfile.name,
        tags: [tag, `civicgraph-${orgProfile.slug}`],
        source: 'CivicGraph',
        customFields: [{ id: CIVICGRAPH_PROFILE_FIELD_ID, value: civicGraphUrl }],
      });

      // Store ghl_contact_id on person_identity_map if person is linked
      if (contact.person_id) {
        await auth.serviceDb
          .from('person_identity_map')
          .update({ ghl_contact_id: ghlContactId })
          .eq('id', contact.person_id);
      }

      results.push({
        contact_id: contact.id,
        name: contact.name,
        status: 'synced',
        ghl_contact_id: ghlContactId,
      });
    } catch (err) {
      results.push({
        contact_id: contact.id,
        name: contact.name,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const synced = results.filter(r => r.status === 'synced').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({ synced, errors, details: results });
}
