#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const FOUNDATION_ID = '25b80b63-416e-4aaa-b470-2f8dc6fa835f';
const VERIFIED_AT = new Date().toISOString();

function isConnectionError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function printBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for Ecstra program year promotion.',
    foundation_id: FOUNDATION_ID,
    error: String(error?.message || error || 'unknown error'),
  }, null, 2));
}

function inferSourceType(url) {
  if (!url) return 'official_program_page';
  if (url.includes('talkmoney.org.au')) return 'official_partner_program_page';
  if (url.includes('/completed-grants')) return 'official_completed_grants_page';
  return 'official_program_page';
}

async function main() {
  const { data: rows, error } = await supabase
    .from('foundation_program_years')
    .select('id, foundation_program_id, fiscal_year, source_report_url, metadata')
    .eq('foundation_id', FOUNDATION_ID);

  if (error) throw error;

  const programIds = [...new Set((rows || []).map((row) => row.foundation_program_id).filter(Boolean))];
  const { data: programs, error: programError } = await supabase
    .from('foundation_programs')
    .select('id, name, url')
    .in('id', programIds);

  if (programError) throw programError;
  const programMap = new Map((programs || []).map((program) => [program.id, program]));

  const updates = [];
  const programUrlUpdates = [];

  for (const row of rows || []) {
    const program = programMap.get(row.foundation_program_id);
    const programName = program?.name;
    const programUrl = program?.url || row.source_report_url;
    if (!programName || !programUrl) continue;

    const nextMetadata = {
      ...(row.metadata || {}),
      source: 'official_ecstra_program_page_verified',
      source_type: inferSourceType(programUrl),
      source_title: programName,
      verified_at: VERIFIED_AT,
      confidence: 'verified',
    };

    updates.push({
      id: row.id,
      source_report_url: programUrl,
      metadata: nextMetadata,
    });

    if (program?.url !== programUrl) {
      programUrlUpdates.push({
        id: row.foundation_program_id,
        url: programUrl,
      });
    }
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({ updates, programUrlUpdates }, null, 2));
    return;
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('foundation_program_years')
      .update({
        source_report_url: update.source_report_url,
        metadata: update.metadata,
      })
      .eq('id', update.id);

    if (updateError) throw updateError;
  }

  for (const update of programUrlUpdates) {
    const { error: updateError } = await supabase
      .from('foundation_programs')
      .update({ url: update.url })
      .eq('id', update.id);

    if (updateError) throw updateError;
  }

  console.log(JSON.stringify({
    promoted_rows: updates.length,
    updated_program_urls: programUrlUpdates.length,
    source: 'official_ecstra_program_page_verified',
    remaining_inferred: Math.max((rows?.length || 0) - updates.length, 0),
  }, null, 2));
}

main().catch((error) => {
  if (isConnectionError(error)) {
    printBlocked(error);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
