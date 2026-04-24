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
const FOUNDATION_ID = '85f0de43-d004-4122-83a6-287eeecc4da9';
const VERIFIED_AT = new Date().toISOString();

function getSourceType(url) {
  if (!url) return null;
  if (url.includes('riotinto.com')) return 'official_program_page';
  if (url.includes('ashburton.wa.gov.au')) return 'official_partner_program_page';
  if (url.includes('wa.gov.au')) return 'official_government_partner_page';
  if (url.includes('ajif.org.au')) return 'official_partner_program_page';
  if (url.includes('energyres.com.au')) return 'official_company_partner_page';
  if (url.includes('foundersfactory.com')) return 'official_partner_program_page';
  return 'official_external_program_page';
}

async function main() {
  const { data: rows, error } = await supabase
    .from('foundation_program_years')
    .select('id, foundation_program_id, source_report_url, metadata')
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

  for (const row of rows || []) {
    const program = programMap.get(row.foundation_program_id);
    const sourceUrl = program?.url || row.source_report_url;
    if (!sourceUrl) continue;

    updates.push({
      id: row.id,
      source_report_url: sourceUrl,
      metadata: {
        ...(row.metadata || {}),
        source: 'official_rio_tinto_program_page_verified',
        source_type: getSourceType(sourceUrl),
        source_title: program?.name || null,
        verified_at: VERIFIED_AT,
        confidence: 'verified',
      },
    });
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({ updates }, null, 2));
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

  console.log(JSON.stringify({
    promoted_rows: updates.length,
    source: 'official_rio_tinto_program_page_verified',
    remaining_inferred: Math.max((rows?.length || 0) - updates.length, 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
