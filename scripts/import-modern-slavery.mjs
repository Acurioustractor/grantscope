#!/usr/bin/env node
/**
 * Import Australian Modern Slavery Register
 *
 * Downloads all-statement-information CSV from modernslaveryregister.gov.au
 * and imports entities into the GrantScope entity graph (gs_entities).
 *
 * Data: ~17,000 statements from ~8,200 unique entities ($100M+ revenue)
 * Fields: ABN, ACN, entity name, revenue band, industry sectors, statement URL
 * ABN coverage: 89.2%
 *
 * Usage:
 *   node scripts/import-modern-slavery.mjs              # full import
 *   node scripts/import-modern-slavery.mjs --dry-run    # count only
 *   node scripts/import-modern-slavery.mjs --skip-download  # use cached CSV
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');
const BATCH_SIZE = 200;
const CSV_PATH = '/tmp/msr-all.csv';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (msg) => console.log(`[modern-slavery] ${msg}`);

function makeGsId(abn) {
  return 'AU-ABN-' + abn.replace(/\s/g, '');
}

function parseRevenueBand(band) {
  // Convert revenue band string to approximate numeric value (midpoint)
  const map = {
    '0-99M': 50_000_000,
    '100-150M': 125_000_000,
    '150-200M': 175_000_000,
    '200-250M': 225_000_000,
    '250-300M': 275_000_000,
    '300-350M': 325_000_000,
    '350-400M': 375_000_000,
    '400-450M': 425_000_000,
    '450-500M': 475_000_000,
    '500-600M': 550_000_000,
    '600-700M': 650_000_000,
    '700-800M': 750_000_000,
    '800-900M': 850_000_000,
    '900M-1BN': 950_000_000,
    '1BN+': 2_000_000_000,
  };
  return map[band] || null;
}

function inferSector(industrySectors) {
  if (!industrySectors) return null;
  const text = industrySectors.toLowerCase();
  if (/mining|metals|oil|gas|resources/.test(text)) return 'mining';
  if (/financ|insurance|real estate|banking/.test(text)) return 'finance';
  if (/construction|building|civil/.test(text)) return 'construction';
  if (/food|beverage|agriculture|fishing/.test(text)) return 'agriculture';
  if (/health|pharma/.test(text)) return 'health';
  if (/information technology|telecom/.test(text)) return 'technology';
  if (/transport|logistics|storage/.test(text)) return 'transport';
  if (/retail|wholesale|consumer/.test(text)) return 'retail';
  if (/energy|electricity|utilities/.test(text)) return 'energy';
  if (/education/.test(text)) return 'education';
  if (/manufactur/.test(text)) return 'manufacturing';
  if (/defence|security/.test(text)) return 'defence';
  return null;
}

async function downloadCsv() {
  if (SKIP_DOWNLOAD && existsSync(CSV_PATH)) {
    log('Using cached CSV (--skip-download)');
    return;
  }

  if (existsSync(CSV_PATH)) {
    log('CSV already cached at /tmp/msr-all.csv');
    return;
  }

  log('Downloading Modern Slavery Register CSV...');
  // The date in the filename changes — try today's date first, then fall back to undated
  const today = new Date().toISOString().split('T')[0];
  try {
    execSync(
      `curl -sL -o "${CSV_PATH}" "https://modernslaveryregister.gov.au/resources/all-statement-information_${today}.csv"`,
      { timeout: 60000 }
    );
    // Verify it's actual CSV (not an error page)
    const head = readFileSync(CSV_PATH, 'utf-8').slice(0, 100);
    if (!head.includes('IDX')) {
      throw new Error('Downloaded file does not look like MSR CSV');
    }
    log('Download complete');
  } catch (err) {
    console.error(`Download failed: ${err.message}`);
    console.error('Try downloading manually from https://modernslaveryregister.gov.au/resources/');
    process.exit(1);
  }
}

async function main() {
  log('=== Import Modern Slavery Register ===');
  if (DRY_RUN) log('(DRY RUN — no data will be written)');

  await downloadCsv();

  // Parse CSV
  const csvText = readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  log(`Parsed ${records.length} statements`);

  // Deduplicate by ABN — keep the latest statement per entity
  // Joint statements have comma-separated ABNs — explode them
  const entityMap = new Map(); // abn → entity data

  for (const r of records) {
    const abns = (r.ABN || '').split(',').map(a => a.trim()).filter(a => a.length >= 9);
    const names = (r.ReportingEntities || '').split(',').map(n => n.trim()).filter(Boolean);

    if (abns.length === 0) continue; // Skip records without ABN (10.8%)

    // For joint statements, use the first ABN as primary
    // but create entities for each ABN if we have matching names
    for (let i = 0; i < abns.length; i++) {
      const abn = abns[i].replace(/\s/g, '');
      if (abn.length < 9) continue;

      const name = names[i] || names[0] || r.ReportingEntities;
      if (!name) continue;

      const existing = entityMap.get(abn);
      const year = parseInt(r.IDX?.split('-')[0] || '0');

      // Keep the latest statement's data
      if (!existing || year > existing.year) {
        entityMap.set(abn, {
          abn,
          name: name.trim().slice(0, 200),
          revenue_band: r.AnnualRevenue,
          revenue_approx: parseRevenueBand(r.AnnualRevenue),
          industry_sectors: r.IndustrySectors,
          sector: inferSector(r.IndustrySectors),
          country: r.HeadquarteredCountries,
          statement_url: r.Link,
          statement_type: r.Type,
          year,
          acns: (r.ACN || '').split(',').map(a => a.trim()).filter(Boolean),
        });
      }
    }
  }

  log(`Unique entities with ABN: ${entityMap.size}`);

  // Upsert into gs_entities
  const entities = Array.from(entityMap.values());
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      created += batch.length;
      if (i === 0) {
        log('Sample entities:');
        for (const e of batch.slice(0, 3)) {
          log(`  ${e.name} (ABN: ${e.abn}, Revenue: ${e.revenue_band}, Sector: ${e.sector})`);
        }
      }
      continue;
    }

    // Check which ABNs already exist
    const abns = batch.map(e => e.abn);
    const { data: existing } = await supabase
      .from('gs_entities')
      .select('id, abn, source_datasets')
      .in('abn', abns);

    const existingMap = new Map((existing || []).map(e => [e.abn, e]));

    // Update existing entities (add modern_slavery to source_datasets)
    const toUpdate = [];
    const toInsert = [];

    for (const e of batch) {
      const ex = existingMap.get(e.abn);
      if (ex) {
        const sources = ex.source_datasets || [];
        if (!sources.includes('modern_slavery')) {
          toUpdate.push({
            id: ex.id,
            source_datasets: [...sources, 'modern_slavery'],
            source_count: sources.length + 1,
            latest_revenue: e.revenue_approx || undefined,
            sector: e.sector || undefined,
            updated_at: new Date().toISOString(),
          });
        }
        updated++;
      } else {
        toInsert.push({
          entity_type: 'company',
          canonical_name: e.name,
          abn: e.abn,
          acn: e.acns[0] || null,
          gs_id: makeGsId(e.abn),
          sector: e.sector,
          tags: e.industry_sectors ? e.industry_sectors.split(',').map(s => s.trim()).filter(Boolean) : [],
          source_datasets: ['modern_slavery'],
          source_count: 1,
          confidence: 'registry',
          latest_revenue: e.revenue_approx,
          website: e.statement_url,
        });
        created++;
      }
    }

    // Batch update existing
    for (const u of toUpdate) {
      const { error } = await supabase
        .from('gs_entities')
        .update({
          source_datasets: u.source_datasets,
          source_count: u.source_count,
          ...(u.latest_revenue ? { latest_revenue: u.latest_revenue } : {}),
          ...(u.sector ? { sector: u.sector } : {}),
          updated_at: u.updated_at,
        })
        .eq('id', u.id);
      if (error) errors++;
    }

    // Batch insert new
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('gs_entities')
        .upsert(toInsert, { onConflict: 'gs_id', ignoreDuplicates: true });
      if (error) {
        log(`Insert error at batch ${i}: ${error.message}`);
        errors++;
      }
    }

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= entities.length) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, entities.length)}/${entities.length}`);
    }
  }

  log(`\n=== Results ===`);
  log(`  Statements parsed: ${records.length}`);
  log(`  Unique entities: ${entityMap.size}`);
  log(`  New entities created: ${created}`);
  log(`  Existing entities enriched: ${updated}`);
  log(`  Errors: ${errors}`);

  // Final stats
  if (!DRY_RUN) {
    const { count } = await supabase
      .from('gs_entities')
      .select('*', { count: 'exact', head: true })
      .contains('source_datasets', ['modern_slavery']);
    log(`  Total entities with modern_slavery source: ${count}`);
  }

  log('Done.');
}

main().catch(err => {
  console.error('[modern-slavery] Fatal error:', err);
  process.exit(1);
});
