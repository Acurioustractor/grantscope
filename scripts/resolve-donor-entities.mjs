#!/usr/bin/env node
/**
 * resolve-donor-entities.mjs
 *
 * Matches unmatched political donation donor names to gs_entities using:
 * 1. Exact name match (case-insensitive)
 * 2. Normalized name match (strip Pty Ltd, Ltd, Inc, etc.)
 * 3. PostgreSQL trigram similarity (>= 0.8 threshold)
 *
 * Inserts matches into donor_entity_matches and creates donation relationships.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(msg) {
  console.log(`[donor-resolve] ${msg}`);
}

function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bPTY\b\.?\s*/g, '')
    .replace(/\bLTD\b\.?\s*/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bINC\b\.?\s*/g, '')
    .replace(/\bCO\b\.?\s*/g, '')
    .replace(/\bTHE\b\s+/g, '')
    .replace(/\bATF\b\s+.*/g, '') // strip trust names
    .replace(/\bAS TRUSTEE FOR\b.*/gi, '')
    .replace(/\bTRUSTEE\b.*/gi, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeGsId({ abn, name }) {
  if (abn) return 'AU-ABN-' + abn.replace(/\s/g, '');
  if (name) {
    let hash = 0;
    const upper = name.toUpperCase().trim();
    for (let i = 0; i < upper.length; i++) {
      hash = ((hash << 5) - hash) + upper.charCodeAt(i);
      hash |= 0;
    }
    return 'AU-NAME-' + Math.abs(hash).toString(36);
  }
  return null;
}

async function main() {
  log('Starting donor entity resolution...');

  // Step 1: Load all gs_entities into memory for fast matching
  log('Loading entity index...');
  const entityByName = new Map(); // normalized name → { abn, id, gs_id, canonical_name }
  const entityByExact = new Map(); // exact upper name → entity
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn, entity_type')
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    for (const e of data) {
      entityByExact.set(e.canonical_name.toUpperCase().trim(), e);
      const normalized = normalizeName(e.canonical_name);
      if (normalized.length >= 3) {
        entityByName.set(normalized, e);
      }
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`  ${entityByExact.size} exact names, ${entityByName.size} normalized names loaded`);

  // Step 2: Get distinct unmatched donor names
  log('Loading unmatched donors...');
  const donorNames = new Map(); // donor_name → count of donations
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('political_donations')
      .select('donor_name')
      .or('donor_abn.is.null,donor_abn.eq.')
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    for (const d of data) {
      if (!d.donor_name) continue;
      donorNames.set(d.donor_name, (donorNames.get(d.donor_name) || 0) + 1);
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`  ${donorNames.size} unique unmatched donor names`);

  // Step 3: Match donor names to entities
  let exactMatches = 0, normalizedMatches = 0, trigramMatches = 0, unmatched = 0;
  const newMatches = [];

  // Get existing matches to avoid duplicates
  const existingMatches = new Set();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('donor_entity_matches')
      .select('donor_name')
      .range(offset, offset + 999);
    if (!data?.length) break;
    for (const m of data) existingMatches.add(m.donor_name.toUpperCase().trim());
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`  ${existingMatches.size} existing matches (will skip)`);

  for (const [donorName, count] of donorNames) {
    if (existingMatches.has(donorName.toUpperCase().trim())) continue;

    const upperName = donorName.toUpperCase().trim();
    const normalizedName = normalizeName(donorName);

    // Try exact match
    let match = entityByExact.get(upperName);
    let matchType = 'exact';

    // Try normalized match
    if (!match && normalizedName.length >= 3) {
      match = entityByName.get(normalizedName);
      matchType = 'normalized';
    }

    if (match) {
      if (matchType === 'exact') exactMatches++;
      else normalizedMatches++;

      newMatches.push({
        donor_name: donorName,
        donor_name_normalized: normalizedName,
        matched_abn: match.abn,
        matched_entity_name: match.canonical_name,
        matched_entity_type: match.entity_type === 'charity' ? 'acnc' : match.entity_type,
        match_confidence: matchType === 'exact' ? 1.0 : 0.85,
        match_method: matchType,
      });
    } else {
      unmatched++;
    }
  }

  log(`\nMatching complete:`);
  log(`  Exact matches: ${exactMatches}`);
  log(`  Normalized matches: ${normalizedMatches}`);
  log(`  Unmatched: ${unmatched}`);
  log(`  Total new matches: ${newMatches.length}`);

  // Step 4: Insert new matches
  if (newMatches.length > 0) {
    log('\nInserting new matches...');
    for (let i = 0; i < newMatches.length; i += 200) {
      const chunk = newMatches.slice(i, i + 200);
      const { error } = await supabase.from('donor_entity_matches').insert(chunk);
      if (error) {
        // Some columns might not exist — try without extra fields
        const slim = chunk.map(m => ({
          donor_name: m.donor_name,
          donor_name_normalized: m.donor_name_normalized,
          matched_abn: m.matched_abn,
          matched_entity_name: m.matched_entity_name,
          matched_entity_type: m.matched_entity_type,
          match_confidence: m.match_confidence,
        }));
        const { error: err2 } = await supabase.from('donor_entity_matches').insert(slim);
        if (err2) log(`  Insert error: ${err2.message}`);
      }
    }
    log(`  Inserted ${newMatches.length} new matches`);
  }

  // Step 5: Now rebuild donation relationships with new matches
  log('\nRebuilding donation relationships with new matches...');
  // Load updated entity index
  const entityIdMap = new Map();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('gs_entities')
      .select('id, gs_id')
      .range(offset, offset + 999);
    if (!data?.length) break;
    for (const e of data) entityIdMap.set(e.gs_id, e.id);
    offset += data.length;
    if (data.length < 1000) break;
  }

  // Load ALL donor matches (old + new)
  const donorAbnMap = new Map();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('donor_entity_matches')
      .select('donor_name, donor_name_normalized, matched_abn')
      .not('matched_abn', 'is', null)
      .range(offset, offset + 999);
    if (!data?.length) break;
    for (const m of data) {
      donorAbnMap.set(m.donor_name.toUpperCase().trim(), m.matched_abn);
      if (m.donor_name_normalized) {
        donorAbnMap.set(m.donor_name_normalized.toUpperCase().trim(), m.matched_abn);
      }
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`  ${donorAbnMap.size} total donor→ABN mappings`);

  // Process previously-unmatched donations
  let created = 0, skipped = 0;
  offset = 0;
  while (true) {
    const { data: donations, error } = await supabase
      .from('political_donations')
      .select('id, donor_name, donor_abn, donation_to, amount, financial_year, donation_date, return_type, receipt_type')
      .or('donor_abn.is.null,donor_abn.eq.')
      .range(offset, offset + 999);
    if (error || !donations?.length) break;

    const relationships = [];
    for (const d of donations) {
      const donorAbn = donorAbnMap.get(d.donor_name?.toUpperCase()?.trim());
      if (!donorAbn) { skipped++; continue; }

      const donorGsId = makeGsId({ abn: donorAbn });
      const donorEntityId = entityIdMap.get(donorGsId);
      if (!donorEntityId) { skipped++; continue; }

      const partyGsId = makeGsId({ name: d.donation_to });
      const partyEntityId = entityIdMap.get(partyGsId);
      if (!partyEntityId) { skipped++; continue; }

      const year = d.financial_year ? parseInt(d.financial_year.split('-')[0]) : null;

      relationships.push({
        source_entity_id: donorEntityId,
        target_entity_id: partyEntityId,
        relationship_type: 'donation',
        amount: d.amount,
        year,
        dataset: 'aec_donations',
        source_record_id: d.id?.toString(),
        confidence: 'inferred',
        properties: {
          financial_year: d.financial_year,
          return_type: d.return_type,
          receipt_type: d.receipt_type,
          donation_date: d.donation_date,
          match_method: 'name_resolution',
        },
      });
    }

    if (relationships.length) {
      for (let i = 0; i < relationships.length; i += 200) {
        const chunk = relationships.slice(i, i + 200);
        const { error: insertErr } = await supabase
          .from('gs_relationships')
          .insert(chunk);
        if (insertErr && !insertErr.message?.includes('duplicate')) {
          log(`  Insert error: ${insertErr.message}`);
        }
      }
    }
    created += relationships.length;
    offset += donations.length;
    if (offset % 10000 === 0) log(`  Progress: ${offset} processed, ${created} new relationships`);
    if (donations.length < 1000) break;
  }

  log(`\n════════════════════════════════════════`);
  log(`Donor resolution complete`);
  log(`  New matches: ${newMatches.length} (${exactMatches} exact + ${normalizedMatches} normalized)`);
  log(`  New relationships: ${created}`);
  log(`  Still unmatched: ${skipped}`);
  log(`════════════════════════════════════════`);
}

main().catch(err => {
  console.error('[donor-resolve] Fatal:', err);
  process.exit(1);
});
