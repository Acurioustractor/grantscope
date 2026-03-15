#!/usr/bin/env node

/**
 * ASIC Company Register Bulk Import Agent
 *
 * Imports the ASIC company register CSV into asic_companies table.
 * The CSV is tab-delimited with multiple rows per ACN (name history).
 * We pick the current name (Current Name Indicator = 'Y') and collect former names.
 *
 * Source: ASIC company register (~370MB, ~3M rows, ~2.8M unique ACNs)
 *
 * Columns:
 *   Company Name | ACN | Type | Class | Sub Class | Status |
 *   Date of Registration | Date of Deregistration | Previous State of Registration |
 *   State Registration number | Modified since last report | Current Name Indicator |
 *   ABN | Current Name | Current Name Start Date
 *
 * Usage:
 *   node --env-file=.env scripts/import-asic-bulk.mjs [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const CSV_PATH = '/tmp/asic-bulk/asic-companies.csv';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function parseDate(d) {
  if (!d) return null;
  // Format: DD/MM/YYYY
  const parts = d.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ─── First pass: Group rows by ACN, pick current name ─────────────────

async function main() {
  log('=== ASIC Company Register Import ===');
  const t0 = Date.now();

  // Stream the CSV and group by ACN
  // Since multiple rows per ACN (name changes), we need to:
  // 1. Find the row with Current Name Indicator = 'Y' (that's the current name)
  // 2. Collect all other names as former_names
  // 3. Use company metadata from the current-name row

  const companies = new Map(); // ACN -> company record

  const rl = createInterface({
    input: createReadStream(CSV_PATH, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let skipped = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // Skip BOM + header

    const cols = line.split('\t');
    if (cols.length < 13) { skipped++; continue; }

    const [
      companyName, acn, type, cls, subClass, status,
      dateReg, dateDereg, prevState, stateRegNum,
      modified, currentNameInd, abn, currentName, currentNameStartDate
    ] = cols;

    if (!acn) { skipped++; continue; }

    const isCurrent = currentNameInd === 'Y';
    const existing = companies.get(acn);

    if (!existing) {
      // First row for this ACN
      companies.set(acn, {
        acn,
        company_name: companyName,
        company_type: type || null,
        company_class: cls || null,
        company_subclass: subClass || null,
        status: status || 'REGD',
        date_of_registration: parseDate(dateReg),
        date_of_deregistration: parseDate(dateDereg) || null,
        previous_state: prevState || null,
        state_registration_number: stateRegNum || null,
        abn: abn || null,
        former_names: [],
        _is_current: isCurrent,
      });

      // If this row has a "Current Name" that differs, it means this row is a former name
      if (currentName && currentName !== companyName) {
        companies.get(acn).former_names.push(companyName);
        companies.get(acn).company_name = currentName;
        companies.get(acn)._is_current = true;
      }
    } else {
      // Additional row for same ACN = name change history
      if (isCurrent) {
        // This row IS the current name — swap
        if (existing.company_name !== companyName) {
          existing.former_names.push(existing.company_name);
        }
        existing.company_name = companyName;
        existing._is_current = true;
        // Also update ABN if present on current row
        if (abn) existing.abn = abn;
      } else {
        // Former name
        if (companyName && companyName !== existing.company_name) {
          existing.former_names.push(companyName);
        }
      }
    }

    if (lineNum % 500000 === 0) {
      log(`  Read ${lineNum.toLocaleString()} lines, ${companies.size.toLocaleString()} unique ACNs`);
    }

    if (LIMIT && companies.size >= LIMIT) break;
  }

  log(`Parsed ${lineNum.toLocaleString()} lines → ${companies.size.toLocaleString()} companies (${skipped} skipped)`);

  // ─── Upsert in batches ──────────────────────────────────────────────

  const BATCH_SIZE = 500;
  let imported = 0;
  let errors = 0;
  const entries = [...companies.values()];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(c => ({
      acn: c.acn,
      company_name: c.company_name,
      company_type: c.company_type,
      company_class: c.company_class,
      company_subclass: c.company_subclass,
      status: c.status,
      date_of_registration: c.date_of_registration,
      date_of_deregistration: c.date_of_deregistration,
      previous_state: c.previous_state,
      state_registration_number: c.state_registration_number,
      abn: c.abn,
      former_names: c.former_names.slice(0, 10), // Cap at 10 former names
    }));

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await db
          .from('asic_companies')
          .upsert(batch, { onConflict: 'acn', ignoreDuplicates: false });

        if (error) throw new Error(error.message);
        imported += batch.length;
        break;
      } catch (e) {
        if (attempt === 2) {
          log(`  FAILED batch at ${i}: ${e.message}`);
          errors++;
        } else {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (imported % 25000 === 0 && imported > 0) {
      const pct = ((imported / entries.length) * 100).toFixed(1);
      const rate = (imported / ((Date.now() - t0) / 1000)).toFixed(0);
      log(`  [${imported.toLocaleString()}/${entries.length.toLocaleString()}] ${pct}% (${rate}/s)`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${imported.toLocaleString()} companies imported in ${elapsed} min (${errors} errors)`);

  // Quick stats
  const { count } = await db.from('asic_companies').select('*', { count: 'exact', head: true });
  log(`asic_companies total rows: ${count?.toLocaleString()}`);

  const { count: regdCount } = await db.from('asic_companies').select('*', { count: 'exact', head: true }).eq('status', 'REGD');
  log(`  Registered: ${regdCount?.toLocaleString()}`);

  const { count: abnCount } = await db.from('asic_companies').select('*', { count: 'exact', head: true }).not('abn', 'is', null);
  log(`  With ABN: ${abnCount?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
