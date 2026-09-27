#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseDetail } from './ingest-tenders-wa-recent.mjs';

const APPLY = process.argv.includes('--apply');
const ROOT = resolve('data/wa-tenders');
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  const paths = (await readdir(ROOT, { recursive: true }))
    .filter((path) => /(?:^|\/)details\/\d+\.html$/.test(path))
    .sort();
  const records = [];
  for (const path of paths) {
    const id = basename(path, '.html');
    const html = await readFile(resolve(ROOT, path), 'utf8');
    const parsed = parseDetail(html, { id, reference: null, agency: null, awardedDate: null, expiryDate: null, value: null });
    records.push({
      source_id: id,
      dcsp_policy_applicable: parsed.dcsp_policy_applicable,
      aboriginal_participation_requirements: parsed.aboriginal_participation_requirements,
    });
  }
  const unique = new Map(records.map((record) => [record.source_id, record]));
  if (unique.size !== records.length) throw new Error(`Duplicate detail IDs: ${records.length} files, ${unique.size} unique IDs`);

  if (APPLY) {
    const databaseRows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('state_tenders').select('*').eq('source', 'tenders-wa').order('id').range(from, from + 999);
      if (error) throw error;
      databaseRows.push(...data);
      if (data.length < 1000) break;
    }
    const rowBySource = new Map(databaseRows.map((row) => [row.source_id, row]));
    if (rowBySource.size !== unique.size) throw new Error(`Archive/database mismatch: ${unique.size} archive IDs, ${rowBySource.size} database IDs`);
    const updates = [...unique.values()].map((record) => ({
      ...rowBySource.get(record.source_id),
      dcsp_policy_applicable: record.dcsp_policy_applicable,
      aboriginal_participation_requirements: record.aboriginal_participation_requirements,
      updated_at: new Date().toISOString(),
    }));
    if (updates.some((record) => !record.id)) throw new Error('At least one archive contract is missing from the database');
    for (let index = 0; index < updates.length; index += 500) {
      const { error } = await db.from('state_tenders').upsert(updates.slice(index, index + 500), { onConflict: 'id' });
      if (error) throw error;
    }
  }

  const values = [...unique.values()];
  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    detail_files: paths.length,
    unique_contracts: unique.size,
    dcsp_policy_applicable: values.filter((record) => record.dcsp_policy_applicable).length,
    aboriginal_participation_requirements: values.filter((record) => record.aboriginal_participation_requirements).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-policy-signals] ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}`);
  process.exit(1);
});
