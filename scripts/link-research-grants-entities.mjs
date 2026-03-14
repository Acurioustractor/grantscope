#!/usr/bin/env node
/**
 * Link research_grants to gs_entities by admin_organisation name matching.
 *
 * Only 80 unique admin_organisations in research_grants — mostly universities.
 * Strategy: exact match on canonical_name, then fuzzy match, then manual map.
 *
 * Usage:
 *   node --env-file=.env scripts/link-research-grants-entities.mjs [--apply]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Manual mapping for known name mismatches
const MANUAL_MAP = {
  'AUSTRALIAN MARITIME COLLEGE': 'Australian Maritime College',
  'BOTANIC GARDENS & PARKS AUTHORITY': 'Botanic Gardens and Parks Authority',
  'MURDOCH CHILDREN\'S RESEARCH INSTITUTE': 'Murdoch Children\'s Research Institute',
  'NATIONAL STEM CELL FOUNDATION OF AUSTRALIA': 'National Stem Cell Foundation of Australia',
  'THE HEART RESEARCH INSTITUTE LTD': 'Heart Research Institute',
  'THE MENTAL HEALTH RESEARCH INSTITUTE PTY LTD': 'Mental Health Research Institute',
  'AUSTRALIAN AND NEW ZEALAND COUNCIL FOR THE CARE OF ANIMALS IN RESEARCH AND TEACHING LIMITED': 'ANZCCART',
  'Macfarlane Burnet Institute for Medical Research and Public Health Ltd.': 'Burnet Institute',
  'National ICT Australia': 'NICTA',
  'Baker IDI Heart and Diabetes Institute': 'Baker Heart and Diabetes Institute',
  'Museum Victoria': 'Museums Victoria',
  'University of Wollongong': 'University of Wollongong',
  'RMIT University': 'Royal Melbourne Institute of Technology',
  'The University of Western Australia': 'University of Western Australia',
  'The University of Melbourne': 'University of Melbourne',
  'The University of New South Wales': 'University of New South Wales',
};

// Direct entity ID overrides for names that fuzzy-match to wrong entities
const ENTITY_ID_OVERRIDES = {
  'The University of Western Australia': '64f3d362-7067-4648-879e-438745dd3753',
  'RMIT University': '1a719161-0d62-4153-b152-26fa6bb7af1d',
};

async function main() {
  const run = await logStart(db, 'link-research-grants-entities', 'Link ARC/NHMRC grants to CG entities');

  try {
    console.log('=== Link Research Grants → Entities ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    // Get all unique admin_organisations
    const { data: orgs } = await db
      .from('research_grants')
      .select('admin_organisation')
      .is('gs_entity_id', null)
      .not('admin_organisation', 'is', null);

    const uniqueOrgs = [...new Set(orgs.map(o => o.admin_organisation))];
    console.log(`  ${uniqueOrgs.length} unique admin_organisations to match`);

    // Build entity lookup (all entities with canonical_name)
    let matched = 0;
    let unmatched = 0;
    const results = [];

    for (const orgName of uniqueOrgs) {
      // Try direct entity ID override first
      if (ENTITY_ID_OVERRIDES[orgName]) {
        results.push({ orgName, entityId: ENTITY_ID_OVERRIDES[orgName], entityName: `(override)`, method: 'override' });
        matched++;
        continue;
      }

      // Try exact match first
      const { data: exact } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn')
        .ilike('canonical_name', orgName)
        .limit(1);

      if (exact?.length) {
        results.push({ orgName, entityId: exact[0].id, entityName: exact[0].canonical_name, method: 'exact' });
        matched++;
        continue;
      }

      // Try manual map
      const mappedName = MANUAL_MAP[orgName];
      if (mappedName) {
        const { data: manual } = await db
          .from('gs_entities')
          .select('id, canonical_name, abn')
          .ilike('canonical_name', `%${mappedName}%`)
          .limit(1);

        if (manual?.length) {
          results.push({ orgName, entityId: manual[0].id, entityName: manual[0].canonical_name, method: 'manual' });
          matched++;
          continue;
        }
      }

      // Try fuzzy - strip common prefixes/suffixes and search
      const simplified = orgName
        .replace(/^The /, '')
        .replace(/ Ltd\.?$/, '')
        .replace(/ Limited$/, '')
        .replace(/ Pty Ltd$/, '')
        .replace(/ Inc\.?$/, '');

      const { data: fuzzy } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn')
        .ilike('canonical_name', `%${simplified}%`)
        .limit(20);

      // Find best match - prefer shortest name that contains our search term
      // (avoids matching long consortium names that happen to contain the org name)
      const candidates = (fuzzy || [])
        .filter(e =>
          e.canonical_name.toLowerCase().includes(simplified.toLowerCase()) ||
          simplified.toLowerCase().includes(e.canonical_name.toLowerCase())
        )
        .sort((a, b) => a.canonical_name.length - b.canonical_name.length);

      const best = candidates[0];

      if (best) {
        results.push({ orgName, entityId: best.id, entityName: best.canonical_name, method: 'fuzzy' });
        matched++;
      } else {
        results.push({ orgName, entityId: null, entityName: null, method: 'unmatched' });
        unmatched++;
      }
    }

    console.log(`\n  Matched: ${matched}/${uniqueOrgs.length}`);
    console.log(`  Unmatched: ${unmatched}`);

    // Show matches
    console.log('\n=== Match Results ===');
    for (const r of results.sort((a, b) => a.method.localeCompare(b.method))) {
      const icon = r.entityId ? '✓' : '✗';
      console.log(`  ${icon} [${r.method}] "${r.orgName}" → ${r.entityName || 'NO MATCH'}`);
    }

    if (APPLY) {
      console.log('\n--- Applying updates ---');
      let totalUpdated = 0;

      for (const r of results.filter(r => r.entityId)) {
        const { data, error } = await db
          .from('research_grants')
          .update({ gs_entity_id: r.entityId })
          .eq('admin_organisation', r.orgName)
          .is('gs_entity_id', null)
          .select('id');

        const updated = data?.length || 0;
        totalUpdated += updated;
        if (updated > 0) {
          console.log(`  Updated ${updated} grants for "${r.orgName}"`);
        }
        if (error) {
          console.error(`  Error for "${r.orgName}": ${error.message}`);
        }
      }

      console.log(`\n  Total: ${totalUpdated} grants linked to entities`);

      await logComplete(db, run.id, {
        items_found: uniqueOrgs.length,
        items_new: totalUpdated,
        items_updated: totalUpdated,
      });
    } else {
      console.log('\n  (DRY RUN — use --apply to write)');
      await logComplete(db, run.id, {
        items_found: uniqueOrgs.length,
        items_new: 0,
      });
    }

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
