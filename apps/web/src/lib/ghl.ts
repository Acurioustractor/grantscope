/**
 * GoHighLevel API service for grant pipeline sync.
 * Maps saved_grants stages ↔ GHL opportunity stages.
 */

const BASE_URL = 'https://services.leadconnectorhq.com';

const STAGE_TO_GHL: Record<string, string> = {
  pursuing: 'Application In Progress',
  submitted: 'Grant Submitted',
  approved: 'Approved',
  realized: 'Won',
  lost: 'Lost',
};

const GHL_TO_STAGE: Record<string, string> = {};
for (const [stage, ghl] of Object.entries(STAGE_TO_GHL)) {
  GHL_TO_STAGE[ghl.toLowerCase()] = stage;
}

async function ghlFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY not set');

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function createOpportunity(opts: {
  name: string;
  stage: string;
  monetaryValue?: number;
  pipelineId: string;
  pipelineStageId: string;
  contactId?: string;
}) {
  const locationId = process.env.GHL_LOCATION_ID;
  return ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      name: opts.name,
      pipelineId: opts.pipelineId,
      pipelineStageId: opts.pipelineStageId,
      status: 'open',
      monetaryValue: opts.monetaryValue ?? 0,
      ...(opts.contactId && { contactId: opts.contactId }),
    }),
  });
}

export async function updateOpportunity(
  opportunityId: string,
  updates: { pipelineStageId?: string; status?: string; monetaryValue?: number }
) {
  return ghlFetch(`/opportunities/${opportunityId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function getOpportunities(pipelineId: string) {
  const locationId = process.env.GHL_LOCATION_ID;
  return ghlFetch(
    `/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&limit=100`
  );
}

export async function getPipelines() {
  const locationId = process.env.GHL_LOCATION_ID;
  return ghlFetch(`/opportunities/pipelines?locationId=${locationId}`);
}

export async function addTagToContact(contactId: string, tag: string) {
  // Add tag in GHL
  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: [tag] }),
  });

  // Sync to Supabase
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const { data: contact } = await sb
    .from('ghl_contacts')
    .select('tags')
    .eq('id', contactId)
    .single();
  const existing: string[] = contact?.tags || [];
  if (!existing.includes(tag)) {
    await sb
      .from('ghl_contacts')
      .update({ tags: [...existing, tag] })
      .eq('id', contactId);
  }
}

export async function removeTagFromContact(contactId: string, tag: string) {
  // Remove tag in GHL
  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'DELETE',
    body: JSON.stringify({ tags: [tag] }),
  });

  // Sync to Supabase
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const { data: contact } = await sb
    .from('ghl_contacts')
    .select('tags')
    .eq('id', contactId)
    .single();
  const existing: string[] = contact?.tags || [];
  await sb
    .from('ghl_contacts')
    .update({ tags: existing.filter((t) => t !== tag) })
    .eq('id', contactId);
}

export async function findContactByEmail(email: string): Promise<{ id: string } | null> {
  const locationId = process.env.GHL_LOCATION_ID;
  const data = await ghlFetch(
    `/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`
  );
  const contact = data?.contact;
  return contact?.id ? { id: contact.id } : null;
}

export async function upsertContact(opts: {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
}): Promise<{ id: string }> {
  const locationId = process.env.GHL_LOCATION_ID;
  const data = await ghlFetch('/contacts/upsert', {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      email: opts.email,
      firstName: opts.firstName,
      lastName: opts.lastName,
      companyName: opts.companyName,
      tags: opts.tags,
      source: opts.source,
    }),
  });

  const contactId = data?.contact?.id;
  if (!contactId) throw new Error('GHL upsert did not return a contact ID');

  // Sync to local ghl_contacts table
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  await sb.from('ghl_contacts').upsert(
    {
      id: contactId,
      email: opts.email,
      first_name: opts.firstName || null,
      last_name: opts.lastName || null,
      company_name: opts.companyName || null,
      tags: data.contact.tags || opts.tags || [],
    },
    { onConflict: 'id' }
  );

  return { id: contactId };
}

export { STAGE_TO_GHL, GHL_TO_STAGE };
