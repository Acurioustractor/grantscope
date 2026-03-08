#!/usr/bin/env node

/**
 * Flag ACNC Charities as Social Enterprises
 *
 * Cross-references social_enterprises ABNs against acnc_charities
 * and sets is_social_enterprise = true where matched.
 *
 * Usage:
 *   node scripts/flag-acnc-social-enterprises.mjs
 *   node scripts/flag-acnc-social-enterprises.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
  console.log(`[flag-acnc-se] ${msg}`);
}

async function run() {
  log('Starting ACNC social enterprise flagging...');

  // Step 1: Get all social enterprises with ABNs
  const { data: seWithAbn, error: seError } = await supabase
    .from('social_enterprises')
    .select('id, name, abn')
    .not('abn', 'is', null);

  if (seError) {
    log(`Error fetching SEs: ${seError.message}`);
    process.exit(1);
  }

  log(`Found ${seWithAbn.length} social enterprises with ABNs`);

  if (seWithAbn.length === 0) {
    log('No ABNs to cross-reference. Try running import scripts first.');
    // Also try fuzzy name matching for ORIC corps
    await matchByName();
    return;
  }

  // Step 2: Match ABNs against ACNC
  const abns = seWithAbn.map(se => se.abn.replace(/\s/g, ''));
  const BATCH_SIZE = 100;
  let matched = 0;
  let unmatched = 0;

  for (let i = 0; i < abns.length; i += BATCH_SIZE) {
    const batch = abns.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      const { data: existing } = await supabase
        .from('acnc_charities')
        .select('abn')
        .in('abn', batch);

      matched += (existing || []).length;
      unmatched += batch.length - (existing || []).length;
      continue;
    }

    const { data: existing, error: matchError } = await supabase
      .from('acnc_charities')
      .select('abn')
      .in('abn', batch);

    if (matchError) {
      log(`Error matching batch: ${matchError.message}`);
      continue;
    }

    const matchedAbns = (existing || []).map(r => r.abn);
    if (matchedAbns.length > 0) {
      const { error: updateError } = await supabase
        .from('acnc_charities')
        .update({ is_social_enterprise: true })
        .in('abn', matchedAbns);

      if (updateError) {
        log(`Error updating: ${updateError.message}`);
      } else {
        matched += matchedAbns.length;
      }
    }
    unmatched += batch.length - matchedAbns.length;
  }

  log(`\nABN matching: ${matched} matched, ${unmatched} unmatched`);

  // Step 3: Also try name matching for SEs without ABNs
  await matchByName();

  log('Done!');
}

async function matchByName() {
  log('\nAttempting name-based matching for SEs without ABNs...');

  // Get SEs without ABNs (mainly ORIC corps might match by name)
  const { data: seNoAbn } = await supabase
    .from('social_enterprises')
    .select('id, name, state')
    .is('abn', null)
    .limit(1000);

  if (!seNoAbn || seNoAbn.length === 0) {
    log('No SEs without ABNs to name-match');
    return;
  }

  log(`Trying name match for ${seNoAbn.length} SEs...`);
  let nameMatched = 0;

  for (const se of seNoAbn) {
    // Exact name match against ACNC
    const { data: match } = await supabase
      .from('acnc_charities')
      .select('abn')
      .ilike('name', se.name)
      .limit(1)
      .maybeSingle();

    if (match) {
      nameMatched++;

      if (!DRY_RUN) {
        // Update the SE with the matched ABN
        await supabase
          .from('social_enterprises')
          .update({ abn: match.abn })
          .eq('id', se.id);

        // Flag the charity
        await supabase
          .from('acnc_charities')
          .update({ is_social_enterprise: true })
          .eq('abn', match.abn);
      }
    }
  }

  log(`Name matching: ${nameMatched} additional matches found`);
}

run().catch(err => {
  console.error('[flag-acnc-se] Fatal:', err);
  process.exit(1);
});
