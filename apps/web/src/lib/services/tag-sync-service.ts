/**
 * Tag sync service — merges tags from GHL, CivicGraph, and person_identity_map
 * into a canonical unified_tags array on person_identity_map.
 *
 * Tag format: prefix:value
 *   role:funder, role:partner, role:governance
 *   org:justicehub, org:qcoss
 *   sector:youth-justice, sector:indigenous
 *   engagement:active, engagement:dormant, engagement:responsive
 *   priority:high, priority:medium, priority:low
 *   topic:child-protection, topic:diversion
 *   source:storyteller, source:elder
 */

import { getServiceSupabase } from '@/lib/supabase';
import { addTagToContact } from '@/lib/ghl';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tag normalization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GHL_TAG_MAP: Record<string, string> = {
  dormant: 'engagement:dormant',
  responsive: 'engagement:responsive',
  active: 'engagement:active',
  storyteller: 'source:storyteller',
  elder: 'source:elder',
  'high priority': 'priority:high',
  'medium priority': 'priority:medium',
  'low priority': 'priority:low',
};

const CONTACT_TYPE_MAP: Record<string, string> = {
  governance: 'role:governance',
  funder: 'role:funder',
  partner: 'role:partner',
  supplier: 'role:supplier',
  political: 'role:political',
  community: 'role:community',
  advocacy: 'role:advocacy',
};

function normalizeGHLTag(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return GHL_TAG_MAP[lower] ?? `ghl:${lower.replace(/\s+/g, '-')}`;
}

function normalizeContactType(contactType: string): string {
  return CONTACT_TYPE_MAP[contactType] ?? `role:${contactType}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Build unified tags for a person
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TagSources {
  ghlTags: string[];
  contactTypes: string[];
  existingTags: string[];
  alignmentTags: string[];
  sector: string | null;
  isStoryteller: boolean;
  isElder: boolean;
}

export function mergeTagSources(sources: TagSources): string[] {
  const tags = new Set<string>();

  // GHL tags → normalized
  for (const t of sources.ghlTags) {
    tags.add(normalizeGHLTag(t));
  }

  // Contact types from org_contacts
  for (const ct of sources.contactTypes) {
    tags.add(normalizeContactType(ct));
  }

  // Existing unified_tags (preserves manually added tags)
  for (const t of sources.existingTags) {
    tags.add(t);
  }

  // Alignment tags from person_identity_map
  for (const t of sources.alignmentTags) {
    if (t.includes(':')) {
      tags.add(t);
    } else {
      tags.add(`topic:${t.toLowerCase().replace(/\s+/g, '-')}`);
    }
  }

  // Sector
  if (sources.sector) {
    tags.add(`sector:${sources.sector.toLowerCase().replace(/\s+/g, '-')}`);
  }

  // GHL boolean fields
  if (sources.isStoryteller) tags.add('source:storyteller');
  if (sources.isElder) tags.add('source:elder');

  return Array.from(tags).sort();
}

export async function buildUnifiedTags(personId: string): Promise<string[]> {
  const supabase = getServiceSupabase();

  // Get person record
  const { data: person } = await supabase
    .from('person_identity_map')
    .select('unified_tags, alignment_tags, sector, tags, ghl_contact_id')
    .eq('person_id', personId)
    .single();

  if (!person) return [];

  // Get GHL contact data if linked
  let ghlTags: string[] = [];
  let isStoryteller = false;
  let isElder = false;
  if (person.ghl_contact_id) {
    const { data: ghl } = await supabase
      .from('ghl_contacts')
      .select('tags, is_storyteller, is_elder')
      .eq('ghl_id', person.ghl_contact_id)
      .single();
    if (ghl) {
      ghlTags = ghl.tags ?? [];
      isStoryteller = ghl.is_storyteller ?? false;
      isElder = ghl.is_elder ?? false;
    }
  }

  // Get all contact_type values for this person from org_contacts
  const { data: contacts } = await supabase
    .from('org_contacts')
    .select('contact_type')
    .eq('person_id', personId);
  const contactTypes = [...new Set((contacts ?? []).map(c => c.contact_type))];

  return mergeTagSources({
    ghlTags,
    contactTypes,
    existingTags: person.unified_tags ?? [],
    alignmentTags: person.alignment_tags ?? [],
    sector: person.sector,
    isStoryteller,
    isElder,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sync operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Write merged tags to person_identity_map */
export async function saveUnifiedTags(personId: string, tags: string[]): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase
    .from('person_identity_map')
    .update({ unified_tags: tags, updated_at: new Date().toISOString() })
    .eq('person_id', personId);
}

/** Push CivicGraph-originated tags to GHL contact */
export async function syncTagsToGHL(personId: string): Promise<{ pushed: number }> {
  const supabase = getServiceSupabase();

  const { data: person } = await supabase
    .from('person_identity_map')
    .select('ghl_contact_id, unified_tags')
    .eq('person_id', personId)
    .single();

  if (!person?.ghl_contact_id || !person.unified_tags?.length) {
    return { pushed: 0 };
  }

  // Get existing GHL tags
  const { data: ghl } = await supabase
    .from('ghl_contacts')
    .select('tags')
    .eq('ghl_id', person.ghl_contact_id)
    .single();

  const existingGHL = new Set((ghl?.tags ?? []).map((t: string) => t.toLowerCase()));

  // Only push tags that don't already exist in GHL (as-is or normalized)
  // Convert prefix:value back to human-readable for GHL
  const toGHLFormat = (tag: string) => tag.replace(':', ': ').replace(/-/g, ' ');
  const tags: string[] = person.unified_tags ?? [];
  const newTags = tags
    .filter((t: string) => t.startsWith('role:') || t.startsWith('sector:') || t.startsWith('topic:') || t.startsWith('priority:'))
    .map(toGHLFormat)
    .filter((t: string) => !existingGHL.has(t.toLowerCase()));

  let pushed = 0;
  for (const tag of newTags) {
    try {
      await addTagToContact(person.ghl_contact_id, tag);
      pushed++;
    } catch {
      // GHL API errors are non-fatal for tag sync
    }
  }

  return { pushed };
}

/** Pull GHL tags into unified_tags */
export async function syncTagsFromGHL(ghlContactId: string): Promise<string[]> {
  const supabase = getServiceSupabase();

  // Find person by GHL contact ID
  const { data: person } = await supabase
    .from('person_identity_map')
    .select('person_id')
    .eq('ghl_contact_id', ghlContactId)
    .single();

  if (!person) return [];

  const tags = await buildUnifiedTags(person.person_id);
  await saveUnifiedTags(person.person_id, tags);
  return tags;
}

/** Batch sync all people with GHL contact IDs */
export async function batchSyncTags(): Promise<{ synced: number; errors: number }> {
  const supabase = getServiceSupabase();

  const { data: people } = await supabase
    .from('person_identity_map')
    .select('person_id')
    .not('ghl_contact_id', 'is', null)
    .limit(1000);

  let synced = 0;
  let errors = 0;

  for (const p of people ?? []) {
    try {
      const tags = await buildUnifiedTags(p.person_id);
      await saveUnifiedTags(p.person_id, tags);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
