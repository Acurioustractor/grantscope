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
const FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';
const VERIFIED_AT = new Date().toISOString();

function isConnectionError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function printBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for Minderoo program year promotion.',
    foundation_id: FOUNDATION_ID,
    error: String(error?.message || error || 'unknown error'),
  }, null, 2));
}

const PROGRAM_SOURCES = {
  'Artist Fund': {
    url: 'https://www.minderoo.org/artistfund/',
    title: 'Minderoo Artist Fund',
    source: 'official_minderoo_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
  'Forrest Research Foundation Post-doctoral Fellowships': {
    url: 'https://forrestresearch.org.au/fellowships/',
    title: 'Forrest Fellowships',
    source: 'official_forrest_program_page_verified',
    sourceType: 'official_partner_program_page',
    publishedYear: 2025,
  },
  'Forrest Scholarships': {
    url: 'https://forrestresearch.org.au/scholarships/',
    title: 'Forrest Scholarships',
    source: 'official_forrest_program_page_verified',
    sourceType: 'official_partner_program_page',
    publishedYear: 2025,
  },
  'Georgia Malone Prize': {
    url: 'https://www.minderoo.org/artistfund/',
    title: 'Minderoo Artist Fund',
    source: 'official_minderoo_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
  'Minderoo Artist Fund 2026': {
    url: 'https://grants.minderoo.org/',
    title: 'Minderoo Grants Portal',
    source: 'official_minderoo_program_page_verified',
    sourceType: 'official_program_portal',
    publishedYear: 2025,
  },
  'Minderoo Artist Fund Award': {
    url: 'https://www.minderoo.org/artistfund/',
    title: 'Minderoo Artist Fund',
    source: 'official_minderoo_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
  'Minderoo Foundation Artist Fund (Project Grants and Residencies)': {
    url: 'https://www.minderoo.org/artistfund/',
    title: 'Minderoo Artist Fund',
    source: 'official_minderoo_program_page_verified',
    sourceType: 'official_program_page',
    publishedYear: 2025,
  },
  'Scholarships for For-Purpose Board Directors': {
    url: 'https://www.csi.edu.au/news/400-to-benefit-from-scholarships-and-access-to-transformative-governance-training/',
    title: 'Scholarships for For-Purpose Board Directors',
    source: 'official_csi_partner_program_page_verified',
    sourceType: 'official_partner_program_page',
    publishedYear: 2026,
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
    const { error: updateError } = await supabase
      .from('foundation_programs')
      .update({ url: update.url })
      .eq('id', update.id);

    if (updateError) throw updateError;
  }

  console.log(JSON.stringify({
    promoted_rows: updates.length,
    updated_program_urls: programUrlUpdates.length,
    sources: [
      'official_minderoo_program_page_verified',
      'official_forrest_program_page_verified',
      'official_csi_partner_program_page_verified',
    ],
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
