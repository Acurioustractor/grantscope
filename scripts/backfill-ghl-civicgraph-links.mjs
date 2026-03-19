#!/usr/bin/env node

/**
 * Backfill CivicGraph Profile URL on existing GHL contacts.
 *
 * For each person in person_identity_map with a ghl_contact_id:
 * 1. Find their linked entity via org_contacts → gs_entities
 * 2. Build the CivicGraph URL (entity page or org contacts page)
 * 3. Write to GHL custom field "CivicGraph Profile"
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-ghl-civicgraph-links.mjs
 *   node --env-file=.env scripts/backfill-ghl-civicgraph-links.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GHL_API_KEY = process.env.GHL_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const CIVICGRAPH_PROFILE_FIELD_ID = 'sGf7MWeuQTUuQIYp4VpS';
const BASE_URL = 'https://services.leadconnectorhq.com';

if (!SUPABASE_URL || !SUPABASE_KEY || !GHL_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GHL_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function ghlUpdate(contactId, customFields) {
  const res = await fetch(`${BASE_URL}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify({ customFields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`[backfill-ghl-links] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // Get all people with GHL contact IDs
  const { data: people } = await sb
    .from('person_identity_map')
    .select('person_id, ghl_contact_id, full_name')
    .not('ghl_contact_id', 'is', null)
    .limit(2000);

  console.log(`[backfill-ghl-links] Found ${people.length} people with GHL links`);

  // Build GHL contact ID → person_id map
  const ghlToPersonId = {};
  for (const p of people) {
    ghlToPersonId[p.ghl_contact_id] = p.person_id;
  }

  // Get entity links via contact_entity_links → ghl_contacts
  // This is the main link path: ghl_contacts.id → contact_entity_links.contact_id → entity_id
  const ghlIds = people.map(p => p.ghl_contact_id);
  const { data: ghlContacts } = await sb
    .from('ghl_contacts')
    .select('id, ghl_id')
    .in('ghl_id', ghlIds);

  const ghlDbIdToGhlId = {};
  const ghlDbIds = [];
  for (const gc of ghlContacts ?? []) {
    ghlDbIdToGhlId[gc.id] = gc.ghl_id;
    ghlDbIds.push(gc.id);
  }

  // Get entity links in batches (contact_entity_links uses ghl_contacts.id as contact_id)
  let entityLinks = [];
  for (let i = 0; i < ghlDbIds.length; i += 500) {
    const batch = ghlDbIds.slice(i, i + 500);
    const { data } = await sb
      .from('contact_entity_links')
      .select('contact_id, entity_id, confidence_score')
      .in('contact_id', batch)
      .gte('confidence_score', 0.5);
    entityLinks.push(...(data ?? []));
  }

  console.log(`[backfill-ghl-links] Found ${entityLinks.length} entity links (confidence >= 0.5)`);

  // Get gs_ids for linked entities
  const entityIds = [...new Set(entityLinks.map(l => l.entity_id))];
  let entityGsIdMap = {};
  if (entityIds.length > 0) {
    for (let i = 0; i < entityIds.length; i += 500) {
      const batch = entityIds.slice(i, i + 500);
      const { data: entities } = await sb
        .from('gs_entities')
        .select('id, gs_id')
        .in('id', batch);
      for (const e of entities ?? []) {
        entityGsIdMap[e.id] = e.gs_id;
      }
    }
  }

  // Build ghl_contact_id → CivicGraph URL map
  // Pick highest confidence entity link per GHL contact
  const ghlContactUrlMap = {};
  const linksByContact = {};
  for (const link of entityLinks) {
    const ghlId = ghlDbIdToGhlId[link.contact_id];
    if (!ghlId) continue;
    if (!linksByContact[ghlId] || link.confidence_score > linksByContact[ghlId].confidence_score) {
      linksByContact[ghlId] = link;
    }
  }
  for (const [ghlId, link] of Object.entries(linksByContact)) {
    const gsId = entityGsIdMap[link.entity_id];
    if (gsId) {
      ghlContactUrlMap[ghlId] = `https://civicgraph.com.au/entity/${encodeURIComponent(gsId)}`;
    }
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const person of people) {
    const url = ghlContactUrlMap[person.ghl_contact_id];
    if (!url) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${person.full_name} (${person.ghl_contact_id}) → ${url}`);
      updated++;
      continue;
    }

    try {
      await ghlUpdate(person.ghl_contact_id, [
        { id: CIVICGRAPH_PROFILE_FIELD_ID, value: url },
      ]);
      updated++;
      // Rate limit: GHL allows ~100 req/min
      if (updated % 50 === 0) {
        console.log(`  ... ${updated} updated so far`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`  Error for ${person.full_name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[backfill-ghl-links] Done: ${updated} updated, ${skipped} skipped (no URL), ${errors} errors`);
}

main();
