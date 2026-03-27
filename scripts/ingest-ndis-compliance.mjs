#!/usr/bin/env node
/**
 * Ingest NDIS Commission Compliance Actions from data.gov.au
 * Source: https://data.gov.au/dataset/ndis-commission-compliance-actions-24-03-2026
 *
 * 2,328 enforcement actions against NDIS providers including:
 * - Compliance notices (1,232)
 * - Banning orders (689)
 * - Revocation of registration (311)
 * - Refusal to re-register (54)
 * - Suspension of registration (37)
 * - Enforceable undertakings (5)
 *
 * 1,815 have ABNs for cross-referencing with gs_entities.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ndis-compliance.mjs [--csv=/tmp/ndis-compliance-actions.csv] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const csvArg = process.argv.find(a => a.startsWith('--csv='))?.split('=')[1];
const CSV_PATH = csvArg || '/tmp/ndis-compliance-actions.csv';
const BATCH_SIZE = 200;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[ndis-compliance] ${msg}`);

function parseAusDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const parts = dateStr.trim().split(' ');
  const dateParts = parts[0].split('/');
  if (dateParts.length !== 3) return null;
  const [day, month, year] = dateParts;
  const time = parts[1] || '00:00';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00+10:00`;
}

function cleanAbn(abn) {
  if (!abn) return null;
  const cleaned = abn.replace(/\s/g, '');
  if (cleaned.length !== 11 || !/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data;
}

function psql(query) {
  const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
  const user = `postgres.tednluwflfhxyucgwigh`;
  const cmd = `PGPASSWORD="${process.env.DATABASE_PASSWORD}" psql -h ${host} -p 5432 -U "${user}" -d postgres -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
}

async function main() {
  log(`Reading ${CSV_PATH}...`);
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  log(`Parsed ${records.length} records`);

  // Transform records
  const rows = records.map(r => ({
    action_type: r['Type']?.trim() || '',
    date_effective: parseAusDate(r['Date effective from']),
    date_no_longer_in_force: parseAusDate(r['Date no longer in force']),
    provider_name: r['Name']?.trim() || '',
    abn: cleanAbn(r['ABN']),
    city: r['City']?.trim() || null,
    state: r['State']?.trim() || null,
    postcode: r['Postcode']?.trim() || null,
    provider_number: r['Provider Number']?.trim() || null,
    registration_groups: (r['Registration Groups '] || r['Registration Groups'])?.trim() || null,
    relevant_information: r['Relevant information']?.trim() || null,
    other_relevant_info: r['Other relevant info']?.trim() || null,
  }));

  if (DRY_RUN) {
    log('DRY RUN: would insert these action types:');
    const types = {};
    rows.forEach(r => { types[r.action_type] = (types[r.action_type] || 0) + 1; });
    Object.entries(types).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => log(`  ${k}: ${v}`));
    const withAbn = rows.filter(r => r.abn).length;
    log(`With ABN: ${withAbn}/${rows.length}`);
    return;
  }

  // Batch insert via Supabase
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('ndis_compliance_actions')
      .upsert(batch, {
        onConflict: 'action_type,provider_name,date_effective',
        ignoreDuplicates: true,
      });

    if (error) {
      log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
      // Try individual inserts for failed batch
      for (const row of batch) {
        const { error: err2 } = await supabase
          .from('ndis_compliance_actions')
          .upsert([row], {
            onConflict: 'action_type,provider_name,date_effective',
            ignoreDuplicates: true,
          });
        if (err2) {
          errors++;
          if (errors <= 5) log(`  Error (${row.provider_name}): ${err2.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 1000 < BATCH_SIZE) {
      log(`Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }

  log(`Inserted: ${inserted}, Errors: ${errors}`);

  // Link to gs_entities via ABN
  log('Linking to gs_entities via ABN...');
  try {
    const result = psql(`
      UPDATE ndis_compliance_actions nca
      SET gs_entity_id = ge.id
      FROM gs_entities ge
      WHERE nca.abn = ge.abn
        AND nca.gs_entity_id IS NULL
        AND ge.abn IS NOT NULL
    `);
    log(`Entity linking result: ${result.trim()}`);
  } catch (err) {
    log(`Entity linking error: ${err.message}`);
  }

  // Summary stats
  log('\nFinal summary:');
  try {
    const countResult = await sql(`
      SELECT
        action_type,
        COUNT(*) as total,
        COUNT(gs_entity_id) as linked,
        COUNT(abn) as with_abn
      FROM ndis_compliance_actions
      GROUP BY action_type
      ORDER BY total DESC
    `);
    if (Array.isArray(countResult)) {
      countResult.forEach(r =>
        log(`  ${r.action_type}: ${r.total} total, ${r.linked} linked, ${r.with_abn} with ABN`)
      );
    } else {
      log(`  Raw result: ${JSON.stringify(countResult).substring(0, 300)}`);
    }
  } catch (err) {
    log(`Summary error: ${err.message}`);
  }

  log('Done!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
