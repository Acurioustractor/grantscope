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
const FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';
const VERIFIED_AT = new Date().toISOString();

const OFFICIAL_URL = 'https://www.ianpotter.org.au/can-we-apply/funding-rounds';

const PROGRAM_SOURCES = {
  'Round 1, 2026 - Environment (EOI)': {
    url: OFFICIAL_URL,
    title: 'Funding rounds',
    source: 'official_ian_potter_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
  'Round 1, 2026 - Medical Research (Applications)': {
    url: OFFICIAL_URL,
    title: 'Funding rounds',
    source: 'official_ian_potter_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
};

async function main() {
  const { data: rows, error } = await supabase
    .from('foundation_program_years')
    .select('id, foundation_program_id, fiscal_year, source_report_url, metadata, foundation_programs(name, url)')
    .eq('foundation_id', FOUNDATION_ID);

  if (error) throw error;

  const updates = [];
  const programUrlUpdates = [];

  for (const row of rows || []) {
    const program = Array.isArray(row.foundation_programs) ? row.foundation_programs[0] : row.foundation_programs;
    const programName = program?.name;
    if (!programName) continue;

    const verifiedSource = PROGRAM_SOURCES[programName];
    if (!verifiedSource) continue;

    const nextMetadata = {
      ...(row.metadata || {}),
      source: verifiedSource.source,
      source_type: verifiedSource.sourceType,
      source_title: verifiedSource.title,
      source_published_year: verifiedSource.publishedYear,
      verified_at: VERIFIED_AT,
      confidence: 'verified',
    };

    updates.push({
      id: row.id,
      source_report_url: verifiedSource.url,
      metadata: nextMetadata,
    });

    if (!program?.url || program.url !== verifiedSource.url) {
      programUrlUpdates.push({
        id: row.foundation_program_id,
        url: verifiedSource.url,
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
    const { error: programError } = await supabase
      .from('foundation_programs')
      .update({ url: update.url })
      .eq('id', update.id);

    if (programError) throw programError;
  }

  console.log(JSON.stringify({
    promoted_rows: updates.length,
    updated_program_urls: programUrlUpdates.length,
    source: 'official_ian_potter_program_page_verified',
    remaining_inferred: Math.max((rows?.length || 0) - updates.length, 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
