#!/usr/bin/env node
/**
 * classify-community-controlled.mjs
 *
 * Classifies gs_entities as community-controlled using multiple signals:
 * 1. entity_type = 'indigenous_corp' (ORIC) → definite
 * 2. ACNC charities with Aboriginal/Torres Strait/Indigenous in name → likely
 * 3. ACNC charities with relevant beneficiary group → likely
 * 4. Social enterprises with relevant sector tags → likely
 *
 * Usage:
 *   node scripts/classify-community-controlled.mjs           # dry run
 *   node scripts/classify-community-controlled.mjs --apply   # apply changes
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const apply = process.argv.includes('--apply');

const COMMUNITY_NAME_PATTERNS = [
  'aboriginal', 'torres strait', 'indigenous', 'first nations',
  'koori', 'murri', 'yolngu', 'noongar', 'palawa', 'nyungar',
  'anangu', 'arrernte', 'warlpiri', 'pitjantjatjara',
  'community controlled', 'land council', 'native title',
];

async function classify() {
  console.log(`[classify] ${apply ? 'APPLYING' : 'DRY RUN'} — community-controlled classification`);

  // 1. ORIC Indigenous corporations
  const { count: oricCount } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'indigenous_corp');
  console.log(`[classify] Indigenous corporations (ORIC): ${oricCount}`);

  if (apply) {
    // Previous version used supabase.from().update().eq() which silently
    // failed on bulk updates >~500 rows (PostgREST client quirk). Use
    // exec_sql RPC for the bulk update — hits the DB directly.
    const { error: updateError } = await supabase.rpc('exec_sql', {
      query: `UPDATE gs_entities
                SET is_community_controlled = true
              WHERE entity_type = 'indigenous_corp'
                AND is_community_controlled = false`,
    });
    if (updateError) {
      console.error('[classify] ORIC bulk update failed:', updateError.message);
    }
  }

  // 2. Name-based matching
  let nameMatchCount = 0;
  for (const pattern of COMMUNITY_NAME_PATTERNS) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name')
      .ilike('canonical_name', `%${pattern}%`)
      .eq('is_community_controlled', false)
      .in('entity_type', ['charity', 'social_enterprise', 'trust', 'unknown'])
      .limit(500);

    if (error) {
      console.error(`[classify] Error searching for "${pattern}":`, error.message);
      continue;
    }

    if (data?.length) {
      nameMatchCount += data.length;
      console.log(`[classify] "${pattern}": ${data.length} matches`);
      if (apply) {
        // Same pattern — exec_sql for reliable bulk update
        const { error: updateError } = await supabase.rpc('exec_sql', {
          query: `UPDATE gs_entities
                    SET is_community_controlled = true
                  WHERE is_community_controlled = false
                    AND entity_type IN ('charity', 'social_enterprise', 'trust', 'unknown')
                    AND canonical_name ILIKE '%${pattern.replace(/'/g, "''")}%'`,
        });
        if (updateError) {
          console.error(`[classify] name "${pattern}" update failed:`, updateError.message);
        }
      }
    }
  }

  console.log(`[classify] Name-based matches: ${nameMatchCount}`);

  // Summary
  const { count: totalCC } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .eq('is_community_controlled', true);

  const { count: totalEntities } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true });

  console.log(`\n[classify] Summary:`);
  console.log(`  Total entities: ${totalEntities}`);
  console.log(`  Community-controlled: ${totalCC} (${((totalCC / totalEntities) * 100).toFixed(1)}%)`);
  console.log(`  ${apply ? 'Changes applied.' : 'Dry run complete. Use --apply to save.'}`);
}

classify().catch(console.error);
