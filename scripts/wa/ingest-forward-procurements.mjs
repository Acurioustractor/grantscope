#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_PATH = resolve(ROOT, 'data/wa-forward-procurement/kimberley-community-services-2026-09-21.json');
const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function recordFor(source, row) {
  return {
    ...row,
    source_owner_page_url: source.owner_page_url,
    source_report_url: source.report_url,
    source_refreshed_on: source.report_refreshed_on,
    captured_at: source.captured_at,
    capture_method: source.capture_method,
    capture_filters: source.filters,
    source_evidence: {
      reported_agencies: source.reported_agencies,
      reported_procurements: source.reported_procurements,
      coverage_note: source.coverage_note,
    },
  };
}

async function main() {
  const artifact = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const records = artifact.records.map((row) => recordFor(artifact.source, row));
  const uniqueRefs = new Set(records.map((row) => row.source_ref));

  if (records.length !== artifact.source.reported_procurements || uniqueRefs.size !== records.length) {
    throw new Error('Captured rows do not reconcile to the public report count or contain duplicate references');
  }

  const preview = {
    mode: DRY_RUN ? 'dry-run' : 'write',
    source_refreshed_on: artifact.source.report_refreshed_on,
    filters: artifact.source.filters,
    records: records.length,
    human_services_review: records.filter((row) => row.review_classification === 'human_services_review').length,
    source_classification_anomalies: records.filter((row) => row.review_classification === 'source_classification_anomaly').length,
  };
  if (DRY_RUN) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await db
    .from('wa_forward_procurements')
    .upsert(records, { onConflict: 'source_ref,source_refreshed_on' });
  if (error) throw error;

  const { data: verified, error: verifyError } = await db
    .from('wa_forward_procurements')
    .select('source_ref,review_classification,existing_contract_match_status')
    .eq('source_refreshed_on', artifact.source.report_refreshed_on)
    .in('source_ref', [...uniqueRefs]);
  if (verifyError) throw verifyError;
  if (verified.length !== records.length) {
    throw new Error(`Post-write row count mismatch: expected ${records.length}, found ${verified.length}`);
  }

  console.log(JSON.stringify({ ...preview, verified_records: verified.length }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-forward-procurement-ingest] ${error instanceof Error ? error.stack || error.message : JSON.stringify(error)}`);
  process.exit(1);
});
