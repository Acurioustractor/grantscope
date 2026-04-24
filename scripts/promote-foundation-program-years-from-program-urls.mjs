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

function getArgValue(prefix) {
  const arg = process.argv.find((entry) => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const FOUNDATION_ID = getArgValue('--foundation-id');

if (!FOUNDATION_ID) {
  console.error('Pass --foundation-id=<uuid>');
  process.exit(1);
}

const VERIFIED_AT = new Date().toISOString();

function isNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch failed') || message.includes('enotfound') || message.includes('network');
}

function emitBlocked(error) {
  console.log(JSON.stringify({
    blocked: true,
    reason: 'Database connection unavailable for foundation program year promotion.',
    foundation_id: FOUNDATION_ID,
    error: String(error?.message || error || 'Unknown error'),
  }, null, 2));
}

function ensureUrl(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function getHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function inferSourceType(programUrl, foundationWebsite) {
  const url = ensureUrl(programUrl);
  const website = ensureUrl(foundationWebsite);
  const urlHost = getHost(url);
  const websiteHost = getHost(website);

  if (!urlHost) return null;
  if (websiteHost && urlHost === websiteHost) return 'official_program_page';
  return 'official_partner_program_page';
}

async function main() {
  const { data: foundation, error: foundationError } = await supabase
    .from('foundations')
    .select('id, name, website')
    .eq('id', FOUNDATION_ID)
    .single();

  if (foundationError || !foundation) throw foundationError || new Error('Foundation not found');

  const { data: rows, error } = await supabase
    .from('foundation_program_years')
    .select('id, foundation_program_id, source_report_url, metadata, foundation_programs(name, url)')
    .eq('foundation_id', FOUNDATION_ID);

  if (error) throw error;

  const updates = [];

  for (const row of rows || []) {
    const program = Array.isArray(row.foundation_programs) ? row.foundation_programs[0] : row.foundation_programs;
    const sourceUrl = ensureUrl(program?.url || row.source_report_url);
    if (!sourceUrl) continue;

    const sourceType = inferSourceType(sourceUrl, foundation.website);
    if (!sourceType) continue;

    updates.push({
      id: row.id,
      source_report_url: sourceUrl,
      metadata: {
        ...(row.metadata || {}),
        source: sourceType === 'official_program_page'
          ? 'official_program_url_verified'
          : 'official_partner_program_url_verified',
        source_type: sourceType,
        source_title: program?.name || foundation.name,
        verified_at: VERIFIED_AT,
        confidence: 'verified',
      },
    });
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({
      foundation: foundation.name,
      promoted_rows: updates.length,
      remaining_without_url: Math.max((rows?.length || 0) - updates.length, 0),
      updates,
    }, null, 2));
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
    foundation: foundation.name,
    promoted_rows: updates.length,
    remaining_without_url: Math.max((rows?.length || 0) - updates.length, 0),
    source_modes: [
      'official_program_url_verified',
      'official_partner_program_url_verified',
    ],
  }, null, 2));
}

main().catch((error) => {
  if (isNetworkError(error)) {
    emitBlocked(error);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
