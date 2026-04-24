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
const FOUNDATION_ID = '4ee5baca-c898-4318-ae2b-d79b95379cc7';
const VERIFIED_AT = new Date().toISOString();

function isConnectionError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function printBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for PRF program year promotion.',
    foundation_id: FOUNDATION_ID,
    error: String(error?.message || error || 'unknown error'),
  }, null, 2));
}

const PROGRAM_SOURCES = {
  'Experimental Evaluation Open Grant Round': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/experimental-evaluation-open-grant-round',
    title: 'Experimental Evaluation Open Grant Round',
    publishedYear: 2025,
  },
  'First Nations Targeted Grant': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/first-nations-targeted-grant-round',
    title: 'First Nations Targeted Grant Round',
    publishedYear: 2024,
  },
  'Just Futures: National Open Grant Round': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/new-open-grant-round-to-help-prevent-contact-with-the-justice-system',
    title: 'New open grant round to help prevent contact with the justice system',
    publishedYear: 2023,
  },
  'Peer to Peer Program': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/paul-ramsay-foundation-peer-to-peer-program',
    title: 'Paul Ramsay Foundation – Peer to Peer Program',
    publishedYear: 2019,
  },
  'PRF Fellowship Program': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/2026-fellowships',
    title: 'Applications open for 2026 PRF Fellowships',
    publishedYear: 2025,
  },
  'Program Related Investments (Impact Investing EOI)': {
    url: 'https://www.paulramsayfoundation.org.au/invest',
    title: 'Invest',
    publishedYear: 2025,
  },
  'Strengthening Family-Centred Collaborations Grant Round': {
    url: 'https://www.paulramsayfoundation.org.au/news-resources/strengthening-family-centred-collaborations-grant-round',
    title: 'Strengthening Family-Centred Collaborations Grant Round',
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
      source: 'official_prf_program_page_verified',
      source_type: 'official_program_page',
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
    source: 'official_prf_program_page_verified',
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
