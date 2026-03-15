#!/usr/bin/env node

/**
 * ALMA Entity Linker v3 — multi-stage linkage through hard identifiers
 *
 * Architecture: alma_interventions → organizations (operating_organization_id)
 *               → gs_entities (via ABN, ORIC, or name match)
 *
 * Stages:
 *   1. Backfill organizations.gs_entity_id via ABN match to gs_entities
 *   2. Link interventions that have operating_organization_id → org.gs_entity_id
 *   3. Link remaining interventions: match operating_organization text → organizations.name
 *   4. Fallback: fuzzy match operating_organization → gs_entities.canonical_name
 *
 * Usage:
 *   node --env-file=.env scripts/link-alma-entities.mjs [--apply] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Stage 1: Backfill organizations.gs_entity_id via ABN ───────────────────

async function stage1_backfillOrgEntityLinks() {
  log('=== Stage 1: Backfill organizations → gs_entities via ABN ===');
  return await stage1_paginated();
}

async function stage1_paginated() {
  // Get all orgs with ABN but no gs_entity_id
  let allOrgs = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await db
      .from('organizations')
      .select('id, name, abn')
      .is('gs_entity_id', null)
      .not('abn', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (error) { log(`  Error fetching orgs: ${error.message}`); break; }
    if (!data?.length) break;
    allOrgs.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  log(`  Found ${allOrgs.length} orgs with ABN but no gs_entity_id`);

  // Batch ABN lookups in chunks
  let linked = 0;
  const CHUNK = 50;

  for (let i = 0; i < allOrgs.length; i += CHUNK) {
    const chunk = allOrgs.slice(i, i + CHUNK);
    const abns = chunk.map(o => o.abn).filter(Boolean);

    const { data: entities } = await db
      .from('gs_entities')
      .select('id, abn')
      .in('abn', abns);

    if (!entities?.length) continue;

    const abnToEntityId = new Map();
    for (const e of entities) abnToEntityId.set(e.abn, e.id);

    for (const org of chunk) {
      const entityId = abnToEntityId.get(org.abn);
      if (!entityId) continue;

      if (APPLY) {
        const { error } = await db
          .from('organizations')
          .update({ gs_entity_id: entityId })
          .eq('id', org.id);
        if (!error) linked++;
      } else {
        linked++;
      }
    }

    if (i % 500 === 0 && i > 0) log(`  Progress: ${i}/${allOrgs.length}, linked: ${linked}`);
  }

  log(`  Linked ${linked} organizations via ABN${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Stage 2: Link interventions via organizations.gs_entity_id ─────────────

async function stage2_linkViaOrganizations() {
  log('=== Stage 2: Link interventions via organizations.gs_entity_id ===');

  // Find interventions with operating_organization_id → org with gs_entity_id
  // but intervention.gs_entity_id is still null
  const { data: interventions } = await db
    .from('alma_interventions')
    .select('id, operating_organization, operating_organization_id')
    .is('gs_entity_id', null)
    .not('operating_organization_id', 'is', null);

  if (!interventions?.length) {
    log('  No unlinked interventions with operating_organization_id');
    return 0;
  }

  // Get org → entity mappings
  const orgIds = [...new Set(interventions.map(i => i.operating_organization_id))];
  const orgToEntity = new Map();

  for (let i = 0; i < orgIds.length; i += 50) {
    const chunk = orgIds.slice(i, i + 50);
    const { data: orgs } = await db
      .from('organizations')
      .select('id, gs_entity_id')
      .in('id', chunk)
      .not('gs_entity_id', 'is', null);

    for (const o of orgs || []) orgToEntity.set(o.id, o.gs_entity_id);
  }

  log(`  ${interventions.length} interventions have org link, ${orgToEntity.size} orgs have gs_entity_id`);

  let linked = 0;
  for (const intv of interventions) {
    const entityId = orgToEntity.get(intv.operating_organization_id);
    if (!entityId) continue;

    if (APPLY) {
      const { error } = await db
        .from('alma_interventions')
        .update({ gs_entity_id: entityId })
        .eq('id', intv.id);
      if (!error) linked++;
    } else {
      linked++;
    }
  }

  log(`  Linked ${linked} interventions via organizations${APPLY ? '' : ' (dry run)'}`);

  // Stage 2b: For orgs without gs_entity_id, try to match org name → gs_entities
  const unmatchedOrgIds = orgIds.filter(id => !orgToEntity.has(id));
  if (unmatchedOrgIds.length) {
    log(`  Stage 2b: ${unmatchedOrgIds.length} orgs without gs_entity_id — trying name match`);

    // Get org names
    const orgNames = new Map();
    for (let i = 0; i < unmatchedOrgIds.length; i += 50) {
      const chunk = unmatchedOrgIds.slice(i, i + 50);
      const { data: orgs } = await db
        .from('organizations')
        .select('id, name, abn')
        .in('id', chunk);
      for (const o of orgs || []) orgNames.set(o.id, o);
    }

    // Try to match each org name to gs_entities
    let linked2b = 0;
    for (const [orgId, org] of orgNames) {
      const name = org.name?.trim();
      if (!name || name.length < 5 || name.match(/^(Multiple|Various|Unknown)/i)) continue;

      // Exact ILIKE match
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, canonical_name')
        .ilike('canonical_name', `%${name.replace(/[()[\]]/g, '').trim()}%`)
        .limit(5);

      if (!entities?.length) continue;

      // Pick best by trigram similarity
      let best = null, bestScore = 0;
      for (const e of entities) {
        const score = trigramSimilarity(name.toLowerCase(), e.canonical_name.toLowerCase());
        if (score > bestScore) { bestScore = score; best = e; }
      }

      if (best && bestScore >= 0.45) {
        if (VERBOSE) log(`    2b: "${name}" → "${best.canonical_name}" (${bestScore.toFixed(3)})`);

        if (APPLY) {
          // Update the organization's gs_entity_id
          await db.from('organizations').update({ gs_entity_id: best.id }).eq('id', orgId);

          // Link all interventions pointing to this org
          const intvForOrg = interventions.filter(i => i.operating_organization_id === orgId);
          for (const intv of intvForOrg) {
            const { error } = await db
              .from('alma_interventions')
              .update({ gs_entity_id: best.id })
              .eq('id', intv.id);
            if (!error) linked2b++;
          }
        } else {
          linked2b += interventions.filter(i => i.operating_organization_id === orgId).length;
        }
      }
    }

    log(`  Stage 2b linked ${linked2b} interventions via org name match${APPLY ? '' : ' (dry run)'}`);
    linked += linked2b;
  }

  return linked;
}

// ─── Stage 3: Match operating_organization text → organizations.name ────────

async function stage3_matchOrgNameToOrganizations() {
  log('=== Stage 3: Match operating_organization text → organizations table ===');

  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, operating_organization')
    .is('gs_entity_id', null)
    .is('operating_organization_id', null)
    .not('operating_organization', 'is', null);

  if (!unlinked?.length) {
    log('  No interventions need org-name matching');
    return 0;
  }

  // Dedupe by org name
  const orgMap = new Map();
  for (const row of unlinked) {
    const org = row.operating_organization?.trim();
    if (!org || org.length < 3 || org.match(/^(Multiple|Various|Community org|Unknown|N\/A|TBC|http)/i)) continue;
    if (!orgMap.has(org)) orgMap.set(org, []);
    orgMap.get(org).push(row.id);
  }

  log(`  ${orgMap.size} unique org names to match against organizations table`);

  let linked = 0;
  let matched = 0;

  for (const [orgName, ids] of orgMap) {
    // Try exact match first
    let { data: orgs } = await db
      .from('organizations')
      .select('id, gs_entity_id, abn, name')
      .ilike('name', orgName)
      .not('gs_entity_id', 'is', null)
      .limit(1);

    // Try ILIKE containment
    if (!orgs?.length) {
      const cleanName = orgName.replace(/[()[\]]/g, '').trim();
      if (cleanName.length >= 8) {
        ({ data: orgs } = await db
          .from('organizations')
          .select('id, gs_entity_id, abn, name')
          .ilike('name', `%${cleanName}%`)
          .not('gs_entity_id', 'is', null)
          .limit(5));

        // Filter to best containment match
        if (orgs?.length > 1) {
          orgs = orgs.filter(o => {
            const sim = trigramSimilarity(orgName.toLowerCase(), o.name.toLowerCase());
            return sim >= 0.4;
          });
        }
      }
    }

    if (!orgs?.length) continue;

    const bestOrg = orgs[0];
    matched++;
    if (VERBOSE) log(`  "${orgName}" → "${bestOrg.name}" (org) → gs_entity`);

    if (APPLY) {
      // Link intervention to gs_entity AND set operating_organization_id
      for (const id of ids) {
        const { error } = await db
          .from('alma_interventions')
          .update({ gs_entity_id: bestOrg.gs_entity_id, operating_organization_id: bestOrg.id })
          .eq('id', id);
        if (!error) linked++;
      }
    } else {
      linked += ids.length;
    }
  }

  log(`  Matched ${matched} org names, linked ${linked} interventions${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Stage 4: Fallback fuzzy match → gs_entities directly ───────────────────

async function stage4_fuzzyMatchEntities() {
  log('=== Stage 4: Fuzzy match remaining → gs_entities ===');

  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, name, operating_organization')
    .is('gs_entity_id', null);

  if (!unlinked?.length) {
    log('  All interventions linked!');
    return 0;
  }

  // Dedupe
  const orgMap = new Map();
  for (const row of unlinked) {
    const searchName = row.operating_organization?.trim() || row.name?.trim();
    if (!searchName || searchName.length < 5
      || searchName.match(/^(Multiple|Various|Community org|Unknown|N\/A|TBC|http)/i)) continue;
    if (!orgMap.has(searchName)) orgMap.set(searchName, []);
    orgMap.get(searchName).push(row.id);
  }

  log(`  ${orgMap.size} unique names for fuzzy matching, ${unlinked.length} interventions remain`);

  let linked = 0;
  let matched = 0;
  const HIGH_THRESHOLD = 0.55;

  for (const [searchName, ids] of orgMap) {
    const words = searchName.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 3);
    if (!words.length) continue;

    const allCandidates = new Map();

    // Search with first significant word
    const { data: c1 } = await db
      .from('gs_entities')
      .select('id, canonical_name, gs_id, abn')
      .ilike('canonical_name', `%${words[0]}%`)
      .limit(20);
    for (const c of c1 || []) allCandidates.set(c.id, c);

    // Two-word search
    if (words.length > 1) {
      const { data: c2 } = await db
        .from('gs_entities')
        .select('id, canonical_name, gs_id, abn')
        .ilike('canonical_name', `%${words[0]}%`)
        .ilike('canonical_name', `%${words[1]}%`)
        .limit(20);
      for (const c of c2 || []) allCandidates.set(c.id, c);
    }

    const candidates = [...allCandidates.values()];
    if (!candidates.length) continue;

    // Score
    let bestMatch = null;
    let bestScore = 0;
    const searchLower = searchName.toLowerCase();

    for (const c of candidates) {
      const candLower = c.canonical_name.toLowerCase();
      const tSim = trigramSimilarity(searchLower, candLower);
      const wOvlp = wordOverlap(searchName, c.canonical_name);
      const score = Math.max(tSim * 0.6 + wOvlp * 0.4, wOvlp * 0.7 + tSim * 0.3);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    }

    if (bestMatch && bestScore >= HIGH_THRESHOLD) {
      matched++;
      if (VERBOSE) log(`  ${bestScore.toFixed(3)} | "${searchName}" → "${bestMatch.canonical_name}" (${bestMatch.gs_id}) [${ids.length}]`);

      if (APPLY) {
        for (const id of ids) {
          const { error } = await db
            .from('alma_interventions')
            .update({ gs_entity_id: bestMatch.id })
            .eq('id', id);
          if (!error) linked++;
        }
      } else {
        linked += ids.length;
      }
    }
  }

  log(`  Fuzzy matched ${matched} names, linked ${linked} interventions${APPLY ? '' : ' (dry run)'}`);
  return linked;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function trigramSimilarity(a, b) {
  const tA = new Set(trigrams(a));
  const tB = new Set(trigrams(b));
  let intersection = 0;
  for (const t of tA) if (tB.has(t)) intersection++;
  const union = tA.size + tB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(s) {
  const padded = `  ${s} `;
  const r = [];
  for (let i = 0; i < padded.length - 2; i++) r.push(padded.slice(i, i + 3));
  return r;
}

function wordOverlap(a, b) {
  const wA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const wB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  if (!wA.size || !wB.size) return 0;
  let n = 0;
  for (const w of wA) if (wB.has(w)) n++;
  return n / Math.max(wA.size, wB.size);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('========================================');
  log('  ALMA Entity Linker v3 — Multi-stage');
  log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  log('========================================');

  // Initial stats
  const { count: totalCount } = await db.from('alma_interventions').select('*', { count: 'exact', head: true });
  const { count: linkedBefore } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);
  log(`\nBefore: ${linkedBefore}/${totalCount} interventions linked (${((linkedBefore / totalCount) * 100).toFixed(1)}%)`);

  const s1 = await stage1_backfillOrgEntityLinks();
  const s2 = await stage2_linkViaOrganizations();
  const s3 = await stage3_matchOrgNameToOrganizations();
  const s4 = await stage4_fuzzyMatchEntities();

  // Final stats
  const { count: linkedAfter } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);
  const newLinks = linkedAfter - linkedBefore;

  log('\n========================================');
  log('  SUMMARY');
  log('========================================');
  log(`  Stage 1 (org→entity via ABN): ${s1} orgs backfilled`);
  log(`  Stage 2 (intervention→org→entity): ${s2} interventions`);
  log(`  Stage 3 (org name→organizations): ${s3} interventions`);
  log(`  Stage 4 (fuzzy→gs_entities): ${s4} interventions`);
  log(`  Total new links: ${newLinks}`);
  log(`  After: ${linkedAfter}/${totalCount} interventions linked (${((linkedAfter / totalCount) * 100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
