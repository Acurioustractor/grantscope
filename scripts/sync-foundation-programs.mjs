#!/usr/bin/env node

/**
 * Sync Foundation Programs → Grant Opportunities
 *
 * Upserts foundation_programs into grant_opportunities so they appear
 * in search results alongside government grants. Uses a composite
 * dedup key (foundation_id + program name) to avoid duplicates.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-foundation-programs.mjs [--dry-run]
 *
 * Run daily to pick up newly discovered programs from foundation enrichment.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Sync Foundation Programs → Grant Opportunities ===');
  console.log(`  Dry run: ${DRY_RUN}`);

  // Fetch all foundation programs with their foundation details (paginated)
  let programs = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error: pageError } = await supabase
      .from('foundation_programs')
      .select(`
        id, name, url, description, amount_min, amount_max, deadline,
        status, categories, eligibility,
        foundations!inner(id, name, website, thematic_focus, geographic_focus)
      `)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (pageError) {
      console.error('Failed to fetch foundation programs:', pageError.message);
      process.exit(1);
    }
    programs = programs.concat(data || []);
    if (!data || data.length < pageSize) break;
    page++;
  }
  const fetchError = null;

  if (fetchError) {
    console.error('Failed to fetch foundation programs:', fetchError.message);
    process.exit(1);
  }

  console.log(`  Found ${programs.length} foundation programs`);

  // Check which programs are already synced (paginated)
  let existing = [];
  let ePage = 0;
  while (true) {
    const { data, error: existError } = await supabase
      .from('grant_opportunities')
      .select('name, foundation_id')
      .eq('source', 'foundation_program')
      .not('foundation_id', 'is', null)
      .range(ePage * 1000, (ePage + 1) * 1000 - 1);
    if (existError) {
      console.error('Failed to check existing:', existError.message);
      process.exit(1);
    }
    existing = existing.concat(data || []);
    if (!data || data.length < 1000) break;
    ePage++;
  }

  const existingKeys = new Set(
    existing.map(e => `${e.foundation_id}::${e.name}`)
  );

  console.log(`  ${existingKeys.size} already synced`);

  const run = await logStart(supabase, 'sync-foundation-programs', 'Sync Foundation Programs');

  function detectProgramType(name, description) {
    const text = `${name} ${description || ''}`.toLowerCase();
    if (/fellowship/.test(text)) return 'fellowship';
    if (/scholarship|bursary|bursaries/.test(text)) return 'scholarship';
    if (/award|prize/.test(text)) return 'award';
    if (/grant/.test(text)) return 'grant';
    if (/program|programme|initiative|project/.test(text)) return 'program';
    return 'grant';
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const program of programs) {
    const foundation = program.foundations;
    const key = `${foundation.id}::${program.name}`;

    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    // Build categories from foundation thematic_focus + program categories
    const categories = [
      ...(program.categories || []),
      ...(foundation.thematic_focus || []),
    ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

    const grant = {
      name: program.name,
      provider: foundation.name,
      program: program.name,
      description: program.description,
      amount_min: program.amount_min ? Number(program.amount_min) : null,
      amount_max: program.amount_max ? Number(program.amount_max) : null,
      closes_at: program.deadline,
      url: program.url || (foundation.website?.startsWith('http') ? foundation.website : `https://${foundation.website}`),
      source: 'foundation_program',
      grant_type: 'foundation',
      foundation_id: foundation.id,
      program_type: detectProgramType(program.name, program.description),
      categories,
    };

    if (DRY_RUN) {
      console.log(`  Would sync: ${program.name} (${foundation.name})`);
      synced++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('grant_opportunities')
      .insert(grant);

    if (insertError) {
      // Might be a unique constraint — try update instead
      if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
        skipped++;
      } else {
        console.error(`  Error syncing "${program.name}": ${insertError.message}`);
        errors++;
      }
    } else {
      synced++;
    }
  }

  await logComplete(supabase, run.id, {
    items_found: programs.length,
    items_new: synced,
    items_updated: skipped,
  });

  console.log(`\nComplete: ${synced} synced, ${skipped} skipped (already exist), ${errors} errors`);
  console.log(`Total foundation programs in grants: ${existingKeys.size + synced}`);

  if (synced > 0 && !DRY_RUN) {
    console.log('\nNote: Run scripts/backfill-embeddings.mjs to embed the new grants for semantic search.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
