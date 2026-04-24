#!/usr/bin/env node
/**
 * Import NSW eTendering Contracts from OCDS JSONL data
 *
 * Data source: https://data.open-contracting.org/en/publication/11
 * Pre-downloaded to: data/nsw-etendering/full.jsonl
 *
 * Maps NSW Contract Notices (CN) to the austender_contracts schema
 * so they join seamlessly with federal AusTender data.
 *
 * Usage:
 *   node --env-file=.env scripts/import-nsw-contracts.mjs [--apply] [--limit=1000]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const DATA_FILE = 'data/nsw-etendering/full.jsonl';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanHtml(s) {
  if (!s || typeof s !== 'string') return typeof s === 'number' ? String(s) : null;
  return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x2f;/g, '/').replace(/\s+/g, ' ').trim();
}

function cleanAbn(s) {
  if (!s) return null;
  return s.replace(/\s/g, '');
}

function mapContract(record) {
  const award = record.awards?.[0];
  if (!award) return null;

  const buyer = award.buyer || {};
  const supplier = award.suppliers?.[0] || {};
  const value = award.value?.amount;
  const title = award.title || record.tender?.title;
  const period = award.contractPeriod || {};
  const item = award.items?.[0] || {};
  const category = item.classification?.description || null;

  // Skip if no value
  if (!value && !title) return null;

  return {
    // AusTender-compatible schema
    cn_id: award.id?.trim() || record.ocid,
    agency: buyer.name || null,
    title: cleanHtml(title)?.slice(0, 2000) || null,
    description: cleanHtml(item.description)?.slice(0, 5000) || null,
    contract_value: value || null,
    supplier_name: supplier.name || null,
    supplier_abn: cleanAbn(supplier.identifier?.id) || null,
    buyer_name: buyer.name || null,
    contract_start: period.startDate?.split('T')[0] || null,
    contract_end: period.endDate?.split('T')[0] || null,
    publish_date: record.date?.split('T')[0] || null,
    category: category?.trim() || null,
    procurement_method: record.tender?.procurementMethod || null,
    source_system: 'nsw-etendering',
    // Extra fields for austender_contracts
    son_id: null,
    atm_id: null,
    contract_status: award.status || 'active',
  };
}

async function main() {
  const run = await logStart(db, 'import-nsw-contracts', 'Import NSW eTendering Contracts');

  try {
    console.log('=== NSW eTendering Contract Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log(`  Source: ${DATA_FILE}`);

    // Read JSONL
    const lines = readFileSync(DATA_FILE, 'utf8').trim().split('\n');
    console.log(`  ${lines.length} total OCDS records`);

    const contracts = [];
    let cnCount = 0;
    let skipped = 0;

    for (const line of lines) {
      const record = JSON.parse(line);

      // Only process Contract Notices (CN)
      if (!record.ocid?.includes('CN')) continue;
      cnCount++;

      const contract = mapContract(record);
      if (contract) {
        contracts.push(contract);
      } else {
        skipped++;
      }

      if (LIMIT && contracts.length >= LIMIT) break;
    }

    console.log(`  ${cnCount} Contract Notices found`);
    console.log(`  ${contracts.length} mapped to contracts`);
    console.log(`  ${skipped} skipped (no value or title)`);

    // Dedupe by cn_id
    const seen = new Set();
    const unique = contracts.filter(c => {
      const key = c.cn_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`  ${unique.length} unique after dedup`);

    // Stats
    const totalValue = unique.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    console.log(`\n  Total contract value: $${(totalValue / 1e9).toFixed(2)}B`);

    const withAbn = unique.filter(c => c.supplier_abn).length;
    console.log(`  Suppliers with ABN: ${withAbn}/${unique.length} (${(withAbn / unique.length * 100).toFixed(1)}%)`);

    // Top buyers
    const buyers = {};
    for (const c of unique) {
      const b = c.buyer_name || 'Unknown';
      buyers[b] = (buyers[b] || 0) + 1;
    }
    console.log('\n=== Top Buyers ===');
    const sortedBuyers = Object.entries(buyers).sort((a, b) => b[1] - a[1]);
    for (const [buyer, count] of sortedBuyers.slice(0, 15)) {
      console.log(`  ${count.toString().padStart(5)} | ${buyer}`);
    }

    // Top categories
    const cats = {};
    for (const c of unique) {
      const cat = c.category || 'Unknown';
      cats[cat] = (cats[cat] || 0) + 1;
    }
    console.log('\n=== Top Categories ===');
    const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sortedCats.slice(0, 10)) {
      console.log(`  ${count.toString().padStart(5)} | ${cat}`);
    }

    if (APPLY && unique.length > 0) {
      // Check austender_contracts schema for compatibility
      console.log('\nChecking austender_contracts schema...');
      const { data: cols } = await db.rpc('exec_sql', {
        query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'austender_contracts' ORDER BY ordinal_position"
      });

      // Map to austender_contracts columns
      const austenderRows = unique.map(c => ({
        ocid: `nsw-${c.cn_id}`,
        title: c.title,
        description: c.description,
        contract_value: c.contract_value,
        currency: 'AUD',
        supplier_name: c.supplier_name,
        supplier_abn: c.supplier_abn,
        buyer_name: c.buyer_name,
        contract_start: c.contract_start,
        contract_end: c.contract_end,
        date_published: c.publish_date ? new Date(c.publish_date).toISOString() : null,
        category: c.category,
        procurement_method: c.procurement_method,
        source_url: 'https://tenders.nsw.gov.au',
      }));

      console.log('Upserting to austender_contracts...');
      let upserted = 0;
      let errors = 0;

      for (let i = 0; i < austenderRows.length; i += 500) {
        const chunk = austenderRows.slice(i, i + 500);
        const { error } = await db
          .from('austender_contracts')
          .upsert(chunk, { onConflict: 'ocid' });

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          // Try inserting individually to find the problematic record
          if (errors === 0) {
            console.log('  Trying individual inserts to find issue...');
            for (const row of chunk.slice(0, 3)) {
              const { error: e2 } = await db.from('austender_contracts').upsert([row], { onConflict: 'ocid' });
              if (e2) console.error(`    Row ${row.cn_id}: ${e2.message}`);
              else console.log(`    Row ${row.cn_id}: OK`);
            }
          }
          errors++;
        } else {
          upserted += chunk.length;
        }
      }

      console.log(`\n  ${upserted} upserted, ${errors} batch errors`);
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: cnCount,
      items_new: unique.length,
      items_updated: APPLY ? unique.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
