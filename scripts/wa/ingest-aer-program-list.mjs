#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE_PATH = resolve(ROOT, 'data/wa-aer/2023-24/profile.json');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function artifactRecord(profile) {
  return {
    reporting_period: '2021-22 to 2023-24',
    source_page_url: profile.source_page,
    source_file_url: profile.source_url,
    source_sha256: profile.sha256,
    source_bytes: profile.bytes,
    fetched_at: profile.fetched_at,
    parser_version: 'wa-aer-program-list-v1',
    row_count: profile.workbook.program_rows,
    profile: {
      workbook: profile.workbook,
      validation: profile.validation,
      coverage: profile.coverage,
    },
  };
}

function programRecord(row, sourceArtifactId) {
  return {
    source_artifact_id: sourceArtifactId,
    source_row: row.source_row,
    program_key: row.program_key,
    expenditure_type: row.expenditure_type,
    agency: row.agency,
    program_name: row.program_name,
    funding_source: row.funding_source,
    statewide: row.statewide,
    metro_perth_peel: row.metro_perth_peel,
    south_west_great_southern: row.south_west_great_southern,
    kimberley: row.kimberley,
    pilbara: row.pilbara,
    mid_west_gascoyne: row.mid_west_gascoyne,
    goldfields_esperance: row.goldfields_esperance,
    wheatbelt: row.wheatbelt,
    ctg_targets: row.ctg_targets,
    priority_reform_area: row.priority_reform_area,
    wa_government_only: row.wa_government_only,
    wa_government_external_parties: row.wa_government_external_parties,
    external_parties_only: row.external_parties_only,
    aboriginal_organisation_or_acco: row.aboriginal_organisation_or_acco,
    aboriginal_organisation_or_acco_only: row.aboriginal_organisation_or_acco_only,
  };
}

async function main() {
  const profile = JSON.parse(await readFile(PROFILE_PATH, 'utf8'));
  if (profile.workbook.program_rows !== profile.rows.length) {
    throw new Error('Profile row count does not match parsed rows');
  }

  const preview = {
    mode: DRY_RUN ? 'dry-run' : 'write',
    source_sha256: profile.sha256,
    artifacts: 1,
    programs: profile.rows.length,
    kimberley_programs: profile.rows.filter((row) => row.kimberley).length,
    acco_involvement_rows: profile.rows.filter((row) => row.aboriginal_organisation_or_acco || row.aboriginal_organisation_or_acco_only).length,
  };
  if (DRY_RUN) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: artifact, error: artifactError } = await db
    .from('wa_aer_source_artifacts')
    .upsert(artifactRecord(profile), { onConflict: 'source_sha256' })
    .select('id')
    .single();
  if (artifactError) throw artifactError;

  const records = profile.rows.map((row) => programRecord(row, artifact.id));
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const { error } = await db
      .from('wa_aer_programs')
      .upsert(records.slice(offset, offset + BATCH_SIZE), { onConflict: 'source_artifact_id,source_row' });
    if (error) throw error;
  }

  const { count, error: countError } = await db
    .from('wa_aer_programs')
    .select('id', { count: 'exact', head: true })
    .eq('source_artifact_id', artifact.id);
  if (countError) throw countError;
  if (count !== profile.rows.length) {
    throw new Error(`Post-write row count mismatch: expected ${profile.rows.length}, found ${count}`);
  }
  console.log(JSON.stringify({ ...preview, artifact_id: artifact.id, verified_programs: count }, null, 2));
}

main().catch((error) => {
  const detail = error instanceof Error
    ? error.stack || error.message
    : JSON.stringify(error, null, 2);
  console.error(`[wa-aer-ingest] ${detail}`);
  process.exit(1);
});
