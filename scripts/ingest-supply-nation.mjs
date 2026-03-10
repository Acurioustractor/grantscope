#!/usr/bin/env node

/**
 * Ingest Supply Nation IBD directory into GrantScope
 *
 * Source: data/supply-nation/supply_nation_businesses.csv (scraped from IBD)
 * Target: social_enterprises table + gs_entities cross-referencing
 *
 * Usage: node --env-file=.env scripts/ingest-supply-nation.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const CSV_PATH = join(PROJECT_ROOT, 'data', 'supply-nation', 'supply_nation_businesses.csv');

function log(msg) {
  console.log(`[supply-nation] ${msg}`);
}

// ─── CSV Parser ────────────────────────────────────────────────────
function parseCSV(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Deduplicate services ──────────────────────────────────────────
function deduplicateServices(servicesStr) {
  if (!servicesStr) return [];
  const services = servicesStr.split(';').map(s => s.trim()).filter(Boolean);
  return [...new Set(services)];
}

// ─── Map states to primary state ───────────────────────────────────
function primaryState(statesStr) {
  if (!statesStr) return null;
  const states = statesStr.split(',').map(s => s.trim()).filter(Boolean);
  // Return first state as primary (or null if empty)
  return states.length > 0 ? states[0] : null;
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  log(`Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  // Start agent run logging
  let runId = null;
  if (!DRY_RUN) {
    const run = await logStart(supabase, 'supply-nation-sync', 'Sync Supply Nation IBD');
    runId = run?.id;
  }

  try {
    // Parse CSV
    const rows = parseCSV(CSV_PATH);
    log(`Loaded ${rows.length} businesses from CSV`);

    // Load existing supply-nation records for dedup
    const { data: existing } = await supabase
      .from('social_enterprises')
      .select('id, name, source_primary')
      .eq('source_primary', 'supply-nation');

    const existingNames = new Map();
    for (const e of existing || []) {
      existingNames.set(e.name.toUpperCase().trim(), e.id);
    }
    log(`Existing Supply Nation records: ${existingNames.size}`);

    let itemsNew = 0;
    let itemsUpdated = 0;
    const errors = [];
    const BATCH_SIZE = 100;

    // Process in batches for upsert
    const newRecords = [];
    const updateRecords = [];

    for (const row of rows) {
      const name = row.name?.trim();
      if (!name) continue;

      const services = deduplicateServices(row.services);
      const stateStr = row.states?.trim() || '';
      const state = primaryState(stateStr);
      const allStates = stateStr.split(',').map(s => s.trim()).filter(Boolean);

      const certType = row.certified === 'Certified'
        ? 'Supply Nation Certified'
        : 'Supply Nation Registered';

      const record = {
        name,
        source_primary: 'supply-nation',
        org_type: 'indigenous_business',
        certifications: [certType],
        sector: services.length > 0 ? services : null,
        state,
        geographic_focus: allStates.length > 0 ? allStates : null,
        target_beneficiaries: ['Indigenous peoples'],
        business_model: row.ownership_structure || null,
        sources: {
          supply_nation: {
            supplier_profile_id: row.supplier_profile_id,
            account_id: row.account_id,
            certified: row.certified === 'Certified',
            indigenous_marketplace: row.indigenous_marketplace === 'Yes',
            services_all_australia: row.services_all_australia === 'Yes',
            states: allStates,
            annual_revenue: row.annual_revenue || null,
            employees: row.employees ? parseInt(row.employees, 10) : null,
            ownership_structure: row.ownership_structure || null,
            services,
            synced_at: new Date().toISOString(),
          },
        },
      };

      const existingId = existingNames.get(name.toUpperCase().trim());
      if (existingId) {
        updateRecords.push({ id: existingId, ...record });
      } else {
        newRecords.push(record);
      }
    }

    log(`To insert: ${newRecords.length}, To update: ${updateRecords.length}`);

    // Insert new records in batches
    if (!DRY_RUN) {
      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = newRecords.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('social_enterprises').insert(batch);
        if (error) {
          errors.push(`Insert batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
          // Try one-by-one for the failed batch
          for (const rec of batch) {
            const { error: singleErr } = await supabase.from('social_enterprises').insert(rec);
            if (singleErr) {
              errors.push(`${rec.name}: ${singleErr.message}`);
            } else {
              itemsNew++;
            }
          }
        } else {
          itemsNew += batch.length;
        }

        if ((i / BATCH_SIZE) % 10 === 0) {
          log(`  Inserted ${Math.min(i + BATCH_SIZE, newRecords.length)}/${newRecords.length}...`);
        }
      }
    } else {
      itemsNew = newRecords.length;
      log(`  Would insert ${newRecords.length} new records`);
    }

    // Update existing records in batches
    if (!DRY_RUN) {
      for (let i = 0; i < updateRecords.length; i += BATCH_SIZE) {
        const batch = updateRecords.slice(i, i + BATCH_SIZE);
        for (const rec of batch) {
          const { id, name: _, ...updateData } = rec;
          const { error } = await supabase
            .from('social_enterprises')
            .update(updateData)
            .eq('id', id);
          if (error) {
            errors.push(`Update ${rec.name}: ${error.message}`);
          } else {
            itemsUpdated++;
          }
        }
      }
    } else {
      itemsUpdated = updateRecords.length;
      log(`  Would update ${updateRecords.length} existing records`);
    }

    log(`Results: ${itemsNew} new, ${itemsUpdated} updated, ${errors.length} errors`);

    // ─── Cross-reference with gs_entities ──────────────────────────
    if (!DRY_RUN) {
      log('Cross-referencing with gs_entities...');

      // Get all Supply Nation business names
      const { data: snRecords } = await supabase
        .from('social_enterprises')
        .select('id, name')
        .eq('source_primary', 'supply-nation');

      let matchedEntities = 0;
      let linkedEntities = 0;

      for (const sn of snRecords || []) {
        // Try exact name match against gs_entities
        const escapedName = sn.name.replace(/'/g, "''").replace(/%/g, '\\%');
        const { data: entities } = await supabase
          .from('gs_entities')
          .select('id, canonical_name, source_datasets')
          .ilike('canonical_name', escapedName)
          .limit(1);

        if (entities && entities.length > 0) {
          const entity = entities[0];
          matchedEntities++;

          // Add social_enterprises to source_datasets if not already present
          if (!entity.source_datasets?.includes('social_enterprises')) {
            const datasets = [...(entity.source_datasets || []), 'social_enterprises'];
            await supabase.from('gs_entities')
              .update({ source_datasets: datasets, source_count: datasets.length })
              .eq('id', entity.id);
            linkedEntities++;
          }
        }
      }

      log(`Matched ${matchedEntities} businesses to gs_entities`);
      log(`Linked ${linkedEntities} entities with social_enterprises dataset`);
    }

    // Log agent run
    if (!DRY_RUN && runId) {
      await logComplete(supabase, runId, {
        items_found: rows.length,
        items_new: itemsNew,
        items_updated: itemsUpdated,
      });
    }

    log(`Done! ${errors.length > 0 ? `(${errors.length} errors)` : ''}`);
    if (errors.length > 0) {
      log('First 10 errors:');
      errors.slice(0, 10).forEach(e => log(`  - ${e}`));
    }

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    if (!DRY_RUN && runId) {
      await logFailed(supabase, runId, err);
    }
    throw err;
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
