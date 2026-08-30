/**
 * GoHighLevel API service for grant pipeline sync.
 * Maps saved_grants stages ↔ GHL opportunity stages.
 */

const BASE_URL = 'https://services.leadconnectorhq.com';

const STAGE_TO_GHL: Record<string, string> = {
  pursuing: 'Application In Progress',
  submitted: 'Grant Submitted',
  approved: 'Grant Awarded',
  realized: 'Grant Awarded',
  lost: 'Grant Declined',
  expired: 'Grant Declined',
};

const GHL_TO_STAGE: Record<string, string> = {};
for (const [stage, ghl] of Object.entries(STAGE_TO_GHL)) {
  GHL_TO_STAGE[ghl.toLowerCase()] = stage;
}
GHL_TO_STAGE['grant opportunity identified'] = 'discovered';
GHL_TO_STAGE['grant reporting due'] = 'approved';
GHL_TO_STAGE['grant report submitted'] = 'realized';

const PIPELINE_NAMES = {
  grants: 'Grants',
  goodsBuyer: 'Goods — Buyer Pipeline',
  goodsDemand: 'Goods — Demand Register',
} as const;

async function ghlFetch(endpoint: string, options: RequestInit = {}, version = '2021-07-28') {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY not set');

  const method = options.method || 'GET';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: version,
        ...options.headers,
      },
    });
    if (res.ok) return res.json();
    const text = await res.text();
    const transientReadFailure = method === 'GET' && (
      res.status === 429 ||
      res.status >= 500 ||
      (res.status === 401 && /timed out/i.test(text))
    );
    if (transientReadFailure && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 250 * (2 ** attempt)));
      continue;
    }
    throw new Error(`GHL API ${res.status}: ${text}`);
  }
  throw new Error('GHL API read failed after retries');
}

export async function createOpportunity(opts: {
  name: string;
  stage: string;
  monetaryValue?: number;
  pipelineId: string;
  pipelineStageId: string;
  contactId?: string;
  assignedTo?: string;
  customFields?: Array<{ id: string; fieldValue: string }>;
}) {
  const locationId = process.env.GHL_LOCATION_ID;
  const apiVersion = opts.assignedTo || opts.customFields?.length ? 'v3' : '2021-07-28';
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
      ...(opts.assignedTo && { assignedTo: opts.assignedTo }),
      ...(opts.customFields?.length && { customFields: opts.customFields }),
    }),
  }, apiVersion);
}

export async function updateOpportunity(
  opportunityId: string,
  updates: {
    pipelineStageId?: string;
    status?: string;
    monetaryValue?: number;
    contactId?: string;
    assignedTo?: string;
    customFields?: Array<{ id: string; fieldValue: string }>;
  }
) {
  const customFields = updates.customFields?.map(field => ({ id: field.id, field_value: field.fieldValue }));
  return ghlFetch(`/opportunities/${opportunityId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...updates, ...(customFields?.length && { customFields }) }),
  });
}

export type GhlOpportunityCustomField = {
  id: string;
  fieldValueString?: unknown;
  fieldValueNumber?: unknown;
  fieldValueDate?: unknown;
  fieldValue?: unknown;
  field_value?: unknown;
  value?: unknown;
};

export type GhlOpportunityContact = {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  customFields?: GhlOpportunityCustomField[];
  createdAt?: string;
  updatedAt?: string;
  dateAdded?: string;
  dateUpdated?: string;
};

export type GhlOpportunity = {
  id: string;
  _id?: string;
  name?: string;
  contactId?: string;
  contact?: GhlOpportunityContact;
  pipelineId?: string;
  pipelineStageId?: string;
  assignedTo?: string;
  status?: string;
  monetaryValue?: number | string;
  customFields?: GhlOpportunityCustomField[];
  createdAt?: string;
  updatedAt?: string;
  dateAdded?: string;
  dateUpdated?: string;
  lastStageChangeAt?: string;
  lastStatusChangeAt?: string;
};

export type GhlOpportunitySearchPage = {
  opportunities: GhlOpportunity[];
  meta?: {
    total?: number;
    nextPage?: boolean;
    nextPageUrl?: string;
    startAfter?: number | string;
    startAfterId?: string;
  };
};

export async function searchOpportunitiesPage(input: {
  pipelineId: string;
  startAfter?: number | string;
  startAfterId?: string;
  limit?: number;
}): Promise<GhlOpportunitySearchPage> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');
  const query = new URLSearchParams({
    locationId,
    pipelineId: input.pipelineId,
    status: 'all',
    limit: String(Math.min(Math.max(input.limit || 100, 1), 100)),
  });
  if (input.startAfter !== undefined) query.set('startAfter', String(input.startAfter));
  if (input.startAfterId) query.set('startAfterId', input.startAfterId);
  const payload = await ghlFetch(`/opportunities/search?${query.toString()}`, {}, 'v3');
  return {
    opportunities: Array.isArray(payload?.opportunities)
      ? payload.opportunities as GhlOpportunity[]
      : [],
    meta: payload?.meta && typeof payload.meta === 'object'
      ? payload.meta as GhlOpportunitySearchPage['meta']
      : undefined,
  };
}

export async function getOpportunities(pipelineId: string): Promise<GhlOpportunitySearchPage> {
  return searchOpportunitiesPage({ pipelineId, limit: 100 });
}

export async function getPipelines() {
  const locationId = process.env.GHL_LOCATION_ID;
  return ghlFetch(`/opportunities/pipelines?locationId=${locationId}`);
}

export type GhlCustomField = {
  id: string;
  name: string;
  fieldKey?: string;
  dataType?: string;
  model?: string;
};

export type GhlLocationUser = {
  id: string;
  name: string;
  email?: string;
  deleted?: boolean;
  roles?: { role?: string };
};

export async function getOpportunityCustomFields(): Promise<GhlCustomField[]> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');
  const payload = await ghlFetch(`/locations/${locationId}/customFields?model=opportunity`, {}, 'v3');
  return Array.isArray(payload?.customFields) ? payload.customFields as GhlCustomField[] : [];
}

export async function createOpportunityCustomField(input: {
  name: string;
  dataType: 'TEXT' | 'LARGE_TEXT' | 'DATE';
}): Promise<GhlCustomField> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');
  const payload = await ghlFetch(`/locations/${locationId}/customFields`, {
    method: 'POST',
    body: JSON.stringify({ ...input, model: 'opportunity' }),
  }, 'v3');
  const field = payload?.customField as GhlCustomField | undefined;
  if (!field?.id) throw new Error(`GHL did not return the custom field ${input.name}`);
  return field;
}

export async function getLocationUsers(): Promise<GhlLocationUser[]> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');
  const payload = await ghlFetch(`/users/?locationId=${encodeURIComponent(locationId)}`, {}, '2023-02-21');
  return Array.isArray(payload?.users)
    ? (payload.users as GhlLocationUser[]).filter(user => user.id && !user.deleted)
    : [];
}

export function findPipelineByName<T extends { name?: string }>(
  pipelines: T[] | undefined,
  pipelineName: string
): T | undefined {
  return pipelines?.find((pipeline) => pipeline.name?.toLowerCase() === pipelineName.toLowerCase());
}

export function findGrantPipeline<T extends { name?: string }>(pipelines: T[] | undefined): T | undefined {
  const configuredName = process.env.GHL_GRANTS_PIPELINE_NAME;
  return (
    (configuredName ? findPipelineByName(pipelines, configuredName) : undefined) ||
    findPipelineByName(pipelines, PIPELINE_NAMES.grants)
  );
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
    .eq('ghl_id', contactId)
    .single();
  const existing: string[] = contact?.tags || [];
  if (!existing.includes(tag)) {
    await sb
      .from('ghl_contacts')
      .update({ tags: [...existing, tag] })
      .eq('ghl_id', contactId);
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
    .eq('ghl_id', contactId)
    .single();
  const existing: string[] = contact?.tags || [];
  await sb
    .from('ghl_contacts')
    .update({ tags: existing.filter((t) => t !== tag) })
    .eq('ghl_id', contactId);
}

export async function findContactByEmail(email: string): Promise<{ id: string } | null> {
  const locationId = process.env.GHL_LOCATION_ID;
  const data = await ghlFetch(
    `/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`
  );
  const contact = data?.contact;
  return contact?.id ? { id: contact.id } : null;
}

export async function updateContactCustomField(contactId: string, fieldId: string, value: string) {
  await ghlFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({
      customFields: [{ id: fieldId, value }],
    }),
  });
}

export async function upsertContact(opts: {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
  customFields?: Array<{ id: string; value: string }>;
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
      ...(opts.customFields && { customFields: opts.customFields }),
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
  const firstName = data.contact.firstName || opts.firstName || null;
  const lastName = data.contact.lastName || opts.lastName || null;
  const fullName = data.contact.name || [firstName, lastName].filter(Boolean).join(' ') || null;
  const mirror = await sb.from('ghl_contacts').upsert(
    {
      ghl_id: contactId,
      ghl_location_id: locationId,
      email: opts.email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      company_name: data.contact.companyName || opts.companyName || null,
      tags: data.contact.tags || opts.tags || [],
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
    },
    { onConflict: 'ghl_id' }
  );
  if (mirror.error) throw new Error(`GHL contact mirror failed: ${mirror.error.message}`);

  return { id: contactId };
}

export { STAGE_TO_GHL, GHL_TO_STAGE, PIPELINE_NAMES };
