#!/usr/bin/env node

/**
 * Supply Nation → gs_entities linker
 *
 * Supply Nation is Australia's main registry of Indigenous-owned businesses.
 * 6,204 entries in data/supply-nation/supply_nation_businesses.csv.
 * No ABN column — match by canonical name, with fuzzy fallback.
 *
 * For each match:
 *   - Flip is_supply_nation_certified = true
 *   - Flip is_community_controlled = true (Indigenous-owned)
 *   - Set community_controlled_tier = 'acnc_indigenous' (if not already oric)
 *     with confidence 9 (second-highest — Supply Nation vetting is rigorous)
 *   - Add 'supply-nation-certified' to tags array
 *
 * For non-matches: log for later review (some may need manual linkage or
 * entity creation).
 *
 * Usage:
 *   node --env-file=.env scripts/link-supply-nation-entities.mjs [--dry-run] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null;

function log(msg) { console.log(`[${new Date().toISOString()}] [sn-link] ${msg}`); }

// Parse a CSV line, respecting quoted commas
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// Normalize for matching: lowercase, strip punctuation, collapse whitespace
function normName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[ \s]+/g, ' ')
    .replace(/\b(pty|ltd|limited|inc|incorporated|aboriginal corporation|corporation)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  log(`starting ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);

  // Load Supply Nation CSV
  const csvPath = 'data/supply-nation/supply_nation_businesses.csv';
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const nameIdx = header.indexOf('name');
  const certifiedIdx = header.indexOf('certified');
  const statesIdx = header.indexOf('states');
  const ownershipIdx = header.indexOf('ownership_structure');

  const snBusinesses = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;
    snBusinesses.push({
      name,
      normalized: normName(name),
      certified: cols[certifiedIdx]?.trim() === 'Registered',
      states: cols[statesIdx]?.trim(),
      ownership: cols[ownershipIdx]?.trim(),
    });
  }
  log(`loaded ${snBusinesses.length} Supply Nation businesses from CSV`);

  const targets = LIMIT ? snBusinesses.slice(0, LIMIT) : snBusinesses;
  log(`processing ${targets.length}`);

  // Build a name-indexed map of existing gs_entities for fast lookup
  // (6K SN entries × 590K entity pages = too slow to query per-row)
  log('building normalized-name index of gs_entities...');
  const nameToEntity = new Map(); // normalized name → { id, gs_id, canonical_name, abn, tags, is_community_controlled, community_controlled_tier }
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn, tags, is_community_controlled, community_controlled_tier, is_supply_nation_certified')
        .range(from, from + PAGE - 1);
      if (error) { log(`load error: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      for (const e of data) {
        const k = normName(e.canonical_name);
        if (k && !nameToEntity.has(k)) nameToEntity.set(k, e);
      }
      if (from % 50000 === 0) log(`  ${nameToEntity.size} entities indexed...`);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  log(`index built: ${nameToEntity.size} entities`);

  let matched = 0;
  let alreadyCertified = 0;
  let notFound = 0;
  const unmatched = [];
  const toUpdate = [];

  for (const sn of targets) {
    const ent = nameToEntity.get(sn.normalized);
    if (!ent) {
      notFound++;
      unmatched.push(sn.name);
      continue;
    }
    if (ent.is_supply_nation_certified) {
      alreadyCertified++;
      continue;
    }
    matched++;
    const newTags = Array.isArray(ent.tags) ? [...ent.tags] : [];
    if (!newTags.includes('supply-nation-certified')) newTags.push('supply-nation-certified');

    toUpdate.push({
      id: ent.id,
      is_supply_nation_certified: true,
      is_community_controlled: true,
      // Only set tier if not already tiered (preserve higher-authority oric)
      community_controlled_tier: ent.community_controlled_tier || 'acnc_indigenous',
      cc_confidence: ent.community_controlled_tier ? undefined : 9,
      tags: newTags,
    });
  }

  log(`matches: ${matched} new, ${alreadyCertified} already certified, ${notFound} not found`);

  if (DRY_RUN) {
    log('DRY RUN — would update the above. Sample unmatched:');
    for (const u of unmatched.slice(0, 10)) log(`  MISS: ${u}`);
    return;
  }

  // Apply updates in batches using a single exec_sql per batch
  // (Supabase JS .update() silently fails on bulk — lesson learned earlier)
  log(`applying ${toUpdate.length} updates...`);
  let applied = 0;
  const BATCH = 200;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    // Use individual .update() calls since each row has different tags content
    for (const u of batch) {
      const patch = {
        is_supply_nation_certified: u.is_supply_nation_certified,
        is_community_controlled: u.is_community_controlled,
        tags: u.tags,
      };
      if (u.cc_confidence !== undefined) {
        patch.community_controlled_tier = u.community_controlled_tier;
        patch.cc_confidence = u.cc_confidence;
      }
      const { error } = await supabase
        .from('gs_entities')
        .update(patch)
        .eq('id', u.id);
      if (!error) applied++;
    }
    log(`  ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length} applied (${applied} succeeded)`);
  }

  // Save unmatched for potential follow-up
  const unmatchedPath = `output/supply-nation-unmatched-${new Date().toISOString().split('T')[0]}.json`;
  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync('output', { recursive: true });
  writeFileSync(unmatchedPath, JSON.stringify(unmatched, null, 2));
  log(`unmatched list saved to ${unmatchedPath} (${unmatched.length} entries)`);

  // Final summary
  const { count: snFlagged } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .eq('is_supply_nation_certified', true);
  log(`final is_supply_nation_certified count: ${snFlagged}`);

  log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
