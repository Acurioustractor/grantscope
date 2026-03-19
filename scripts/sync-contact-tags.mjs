#!/usr/bin/env node

/**
 * Batch sync unified tags across GHL, CivicGraph, and person_identity_map.
 *
 * For each person in person_identity_map with a ghl_contact_id:
 * 1. Pull latest tags from GHL (ghl_contacts.tags)
 * 2. Pull contact_type from org_contacts
 * 3. Merge with existing unified_tags, alignment_tags, sector
 * 4. Write unified_tags back to person_identity_map
 * 5. Optionally push CivicGraph-originated tags back to GHL
 *
 * Usage:
 *   node --env-file=.env scripts/sync-contact-tags.mjs
 *   node --env-file=.env scripts/sync-contact-tags.mjs --push-to-ghl
 *   node --env-file=.env scripts/sync-contact-tags.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

// Note: logStart/logComplete/logFailed take (supabase, ...) as first arg

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PUSH_TO_GHL = process.argv.includes('--push-to-ghl');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tag normalization (mirrors tag-sync-service.ts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GHL_TAG_MAP = {
  dormant: 'engagement:dormant',
  responsive: 'engagement:responsive',
  active: 'engagement:active',
  storyteller: 'source:storyteller',
  elder: 'source:elder',
  'high priority': 'priority:high',
  'medium priority': 'priority:medium',
  'low priority': 'priority:low',
};

const CONTACT_TYPE_MAP = {
  governance: 'role:governance',
  funder: 'role:funder',
  partner: 'role:partner',
  supplier: 'role:supplier',
  political: 'role:political',
  community: 'role:community',
  advocacy: 'role:advocacy',
};

function normalizeGHLTag(raw) {
  const lower = raw.toLowerCase().trim();
  return GHL_TAG_MAP[lower] ?? `ghl:${lower.replace(/\s+/g, '-')}`;
}

function normalizeContactType(ct) {
  return CONTACT_TYPE_MAP[ct] ?? `role:${ct}`;
}

function mergeTagSources({ ghlTags, contactTypes, existingTags, alignmentTags, sector, isStoryteller, isElder }) {
  const tags = new Set();

  for (const t of ghlTags) tags.add(normalizeGHLTag(t));
  for (const ct of contactTypes) tags.add(normalizeContactType(ct));
  for (const t of existingTags) tags.add(t);
  for (const t of alignmentTags) {
    tags.add(t.includes(':') ? t : `topic:${t.toLowerCase().replace(/\s+/g, '-')}`);
  }
  if (sector) tags.add(`sector:${sector.toLowerCase().replace(/\s+/g, '-')}`);
  if (isStoryteller) tags.add('source:storyteller');
  if (isElder) tags.add('source:elder');

  return [...tags].sort();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  const run = await logStart(sb, 'sync-contact-tags', 'Sync Contact Tags');
  const runId = run?.id;
  console.log(`[sync-contact-tags] Starting tag sync${DRY_RUN ? ' (DRY RUN)' : ''}${PUSH_TO_GHL ? ' (pushing to GHL)' : ''}`);

  try {
    // Get all people (with or without GHL links)
    const { data: people, error: pErr } = await sb
      .from('person_identity_map')
      .select('person_id, ghl_contact_id, unified_tags, alignment_tags, sector, tags')
      .limit(5000);

    if (pErr) throw pErr;
    console.log(`[sync-contact-tags] Found ${people.length} people`);

    // Build GHL contacts map
    const ghlIds = people.map(p => p.ghl_contact_id).filter(Boolean);
    let ghlMap = {};
    if (ghlIds.length > 0) {
      const { data: ghlContacts } = await sb
        .from('ghl_contacts')
        .select('ghl_id, tags, is_storyteller, is_elder')
        .in('ghl_id', ghlIds);
      for (const g of ghlContacts ?? []) {
        ghlMap[g.ghl_id] = g;
      }
    }

    // Build org_contacts contact_type map (person_id → contact_types[])
    const personIds = people.map(p => p.person_id);
    const { data: orgContacts } = await sb
      .from('org_contacts')
      .select('person_id, contact_type')
      .in('person_id', personIds);

    const contactTypeMap = {};
    for (const oc of orgContacts ?? []) {
      if (!oc.person_id) continue;
      if (!contactTypeMap[oc.person_id]) contactTypeMap[oc.person_id] = new Set();
      contactTypeMap[oc.person_id].add(oc.contact_type);
    }

    let synced = 0;
    let unchanged = 0;
    let errors = 0;

    for (const person of people) {
      try {
        const ghl = person.ghl_contact_id ? ghlMap[person.ghl_contact_id] : null;
        const ctSet = contactTypeMap[person.person_id];

        const newTags = mergeTagSources({
          ghlTags: ghl?.tags ?? [],
          contactTypes: ctSet ? [...ctSet] : [],
          existingTags: person.unified_tags ?? [],
          alignmentTags: person.alignment_tags ?? [],
          sector: person.sector,
          isStoryteller: ghl?.is_storyteller ?? false,
          isElder: ghl?.is_elder ?? false,
        });

        // Check if tags changed
        const oldTags = (person.unified_tags ?? []).sort().join(',');
        const newTagStr = newTags.join(',');

        if (oldTags === newTagStr) {
          unchanged++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY] ${person.person_id}: ${oldTags || '(none)'} → ${newTagStr}`);
          synced++;
          continue;
        }

        await sb
          .from('person_identity_map')
          .update({ unified_tags: newTags, updated_at: new Date().toISOString() })
          .eq('person_id', person.person_id);

        synced++;
      } catch (err) {
        console.error(`  Error for ${person.person_id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`[sync-contact-tags] Done: ${synced} synced, ${unchanged} unchanged, ${errors} errors`);
    await logComplete(sb, runId, { items_found: people.length, items_new: synced });
  } catch (err) {
    console.error(`[sync-contact-tags] Fatal: ${err.message}`);
    await logFailed(sb, runId, err.message);
    process.exit(1);
  }
}

main();
