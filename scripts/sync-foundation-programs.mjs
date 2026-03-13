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

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const CLEANUP_INVALID = process.argv.includes('--cleanup-invalid');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PUBLIC_GRANT_SIGNALS = /(grant|grant round|community giving|fellowship|scholarship|award|bursary|funding round|apply now|how to apply|applications? open|grant guidelines|expression of interest|eoi)/i;
const URL_GRANT_SIGNALS = /(\/grants?\/|\/grant-programs?\/|\/funding\/|\/apply\/|\/applications?\/|\/community-giving\/|\/fellowships?\/|\/scholarships?\/)/i;
const NON_GRANT_SIGNALS = /(appeal|donation|donate|sponsorship|sponsor a child|child sponsorship|orphan sponsorship|water project|food packs?|relief fund|crisis relief|family support|support program|housing support|clean water|fiscal sponsorship|disaster relief|donations program|community support|direct sponsorship)/i;
const DIRECT_SERVICE_SIGNALS = /(supports? .*famil(y|ies)|provides? (financial|emotional|practical) support|regular donations|major sponsors?|channeling donations|fundraising campaign|supports the creation of|responding to global disasters|provides access to clean water|vouchers|care packages|hospital stays)/i;

const GRANT_DEPENDENCIES = [
  { table: 'grant_feedback', column: 'grant_id' },
  { table: 'saved_grants', column: 'grant_id' },
  { table: 'org_deadlines', column: 'grant_id' },
  { table: 'org_milestones', column: 'grant_id' },
  { table: 'org_sessions', column: 'grant_id' },
  { table: 'org_grant_budget_lines', column: 'grant_id' },
  { table: 'org_grant_transactions', column: 'grant_id' },
  { table: 'bgfit_budget_items', column: 'grant_id' },
  { table: 'bgfit_deadlines', column: 'grant_id' },
  { table: 'bgfit_transactions', column: 'grant_id' },
  { table: 'grant_answer_bank', column: 'source_grant_id' },
];

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function hasPastDeadline(deadline) {
  if (!deadline) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today;
}

function isGrantLikeFoundationProgram(program, foundation) {
  const text = `${program.name || ''} ${program.description || ''} ${program.eligibility || ''} ${program.application_process || ''}`;
  const url = String(program.url || foundation.website || '').toLowerCase();
  const foundationType = String(foundation.type || '').toLowerCase();
  const hasGrantLanguage = PUBLIC_GRANT_SIGNALS.test(text);
  const hasGrantUrl = URL_GRANT_SIGNALS.test(url);
  const hasStructuredGrantSignal = Boolean(program.amount_min || program.amount_max || program.deadline);
  const looksLikeNonGrant = NON_GRANT_SIGNALS.test(text) || DIRECT_SERVICE_SIGNALS.test(text);
  const trustedFoundationType = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation', 'grantmaker'].includes(foundationType);

  if (looksLikeNonGrant && !hasGrantLanguage && !hasGrantUrl) return false;
  if (!trustedFoundationType) return false;
  return hasGrantLanguage || hasGrantUrl || hasStructuredGrantSignal;
}

function getDesiredProgramStatus(program, foundation) {
  if (!isGrantLikeFoundationProgram(program, foundation)) return 'non_grant';
  return hasPastDeadline(program.deadline) ? 'closed' : 'open';
}

async function main() {
  console.log('=== Sync Foundation Programs → Grant Opportunities ===');
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Cleanup invalid: ${CLEANUP_INVALID}`);

  // Fetch all foundation programs with their foundation details (paginated)
  let programs = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error: pageError } = await supabase
      .from('foundation_programs')
      .select(`
        id, name, url, description, amount_min, amount_max, deadline,
        status, categories, eligibility, application_process, program_type,
        foundations!inner(id, name, type, website, thematic_focus, geographic_focus)
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

  const eligiblePrograms = programs.filter((program) => isGrantLikeFoundationProgram(program, program.foundations));
  const filteredPrograms = programs.length - eligiblePrograms.length;
  console.log(`  ${eligiblePrograms.length} look like public grant opportunities`);
  if (filteredPrograms > 0) {
    console.log(`  ${filteredPrograms} skipped as non-grant / direct-service / appeal programs`);
  }

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
  let cleaned = 0;
  let statusesUpdated = 0;

  if (CLEANUP_INVALID) {
    const existingProgramsByKey = new Map(
      programs.map((program) => [`${program.foundations.id}::${program.name}`, program])
    );
    const statusBuckets = new Map();
    for (const program of programs) {
      const desiredStatus = getDesiredProgramStatus(program, program.foundations);
      if (program.status !== desiredStatus) {
        const bucket = statusBuckets.get(desiredStatus) || [];
        bucket.push(program.id);
        statusBuckets.set(desiredStatus, bucket);
      }
    }

    if (statusBuckets.size > 0) {
      for (const [status, ids] of statusBuckets.entries()) {
        console.log(`  ${ids.length} foundation programs should be marked ${status}`);
        if (!DRY_RUN) {
          for (const idBatch of chunkArray(ids, 250)) {
            const { error: statusUpdateError } = await supabase
              .from('foundation_programs')
              .update({ status })
              .in('id', idBatch);
            if (statusUpdateError) {
              console.error(`Failed to update foundation_programs status -> ${status}: ${statusUpdateError.message}`);
              process.exit(1);
            }
          }
          statusesUpdated += ids.length;
        }
      }
    }

    const { data: existingFoundationGrants, error: existingFoundationGrantsError } = await supabase
      .from('grant_opportunities')
      .select('id, foundation_id, name')
      .eq('source', 'foundation_program')
      .not('foundation_id', 'is', null);

    if (existingFoundationGrantsError) {
      console.error('Failed to fetch existing foundation-program grants for cleanup:', existingFoundationGrantsError.message);
      process.exit(1);
    }

    const invalidGrantIds = (existingFoundationGrants || [])
      .filter((grant) => {
        const program = existingProgramsByKey.get(`${grant.foundation_id}::${grant.name}`);
        return !program || !isGrantLikeFoundationProgram(program, program.foundations);
      })
      .map((grant) => grant.id);

    if (invalidGrantIds.length > 0) {
      console.log(`  Cleaning up ${invalidGrantIds.length} invalid foundation-program grants already in search`);
      if (!DRY_RUN) {
        for (const dependency of GRANT_DEPENDENCIES) {
          const { error: dependencyDeleteError } = await supabase
            .from(dependency.table)
            .delete()
            .in(dependency.column, invalidGrantIds);
          if (dependencyDeleteError) {
            console.error(`Failed to delete dependent ${dependency.table} rows: ${dependencyDeleteError.message}`);
            process.exit(1);
          }
        }
        const { error: deleteError } = await supabase
          .from('grant_opportunities')
          .delete()
          .in('id', invalidGrantIds);
        if (deleteError) {
          console.error('Failed to delete invalid foundation-program grants:', deleteError.message);
          process.exit(1);
        }
        cleaned = invalidGrantIds.length;
      }
    }
  }

  for (const program of eligiblePrograms) {
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
      source_id: program.id,
      grant_type: 'open_opportunity',
      foundation_id: foundation.id,
      program_type: program.program_type || detectProgramType(program.name, program.description),
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
    items_updated: skipped + statusesUpdated,
  });

  console.log(`\nComplete: ${synced} synced, ${skipped} skipped (already exist), ${cleaned} cleaned, ${statusesUpdated} status updates, ${errors} errors`);
  console.log(`Total foundation programs in grants: ${existingKeys.size - cleaned + synced}`);

  if (synced > 0 && !DRY_RUN) {
    console.log('\nNote: Run scripts/backfill-embeddings.mjs to embed the new grants for semantic search.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
