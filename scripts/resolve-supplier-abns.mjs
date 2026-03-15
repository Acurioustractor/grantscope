#!/usr/bin/env node

/**
 * High-Confidence Supplier ABN Resolution
 *
 * Resolves austender_contracts.supplier_abn by matching supplier_name
 * against gs_entities canonical_name (which have ABNs from ABR/ACNC/etc).
 *
 * Strategy:
 * 1. Exact match (case-insensitive, trimmed): highest confidence
 * 2. Normalized match (strip PTY LTD, THE, etc): high confidence
 * 3. For names matching multiple ABNs: skip (ambiguous)
 *
 * Usage: node --env-file=.env scripts/resolve-supplier-abns.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function normalizeName(name) {
  return name
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bPTY\b\.?\s*/g, '')
    .replace(/\bLTD\b\.?\s*/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bTHE\b\s+/g, '')
    .replace(/\bINC\b\.?\s*/g, '')
    .replace(/\bCO\b\.?\s*/g, '')
    .replace(/\bCORP\b\.?\s*/g, '')
    .replace(/\bCORPORATION\b/g, '')
    .replace(/\bAUSTRALIA\b/g, 'AU')
    .replace(/\bAUSTRALIAN\b/g, 'AU')
    .replace(/[.,&()\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const t0 = Date.now();
  log(`=== Supplier ABN Resolution ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  // Step 1: Get all distinct unresolved supplier names with contract counts
  log('Loading unresolved supplier names...');
  const PAGE = 1000;
  const supplierNames = new Map(); // name -> contract count
  let offset = 0;

  // Use raw SQL to get distinct names with counts efficiently
  while (true) {
    const { data, error } = await db.rpc('exec_sql', {
      query: `SELECT supplier_name, COUNT(*) as cnt
              FROM austender_contracts
              WHERE (supplier_abn IS NULL OR supplier_abn = '')
                AND supplier_name IS NOT NULL AND supplier_name != ''
              GROUP BY supplier_name
              ORDER BY cnt DESC
              OFFSET ${offset} LIMIT ${PAGE}`
    });

    // Fallback: use supabase query if RPC not available
    if (error) {
      // Just load them via regular query
      const { data: contracts } = await db
        .from('austender_contracts')
        .select('supplier_name')
        .is('supplier_abn', null)
        .not('supplier_name', 'is', null)
        .neq('supplier_name', '')
        .range(offset, offset + PAGE - 1);
      if (!contracts || contracts.length === 0) break;
      for (const c of contracts) {
        supplierNames.set(c.supplier_name, (supplierNames.get(c.supplier_name) || 0) + 1);
      }
      offset += PAGE;
      if (contracts.length < PAGE) break;
      continue;
    }

    if (!data || data.length === 0) break;
    for (const row of data) {
      supplierNames.set(row.supplier_name, row.cnt);
    }
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  log(`Found ${supplierNames.size} distinct unresolved supplier names`);

  // Step 2: Build lookup map of entity names -> ABN
  log('Loading entity name -> ABN map...');
  const entityMap = new Map(); // UPPER(name) -> { abn, gs_id, count }
  const normalizedMap = new Map(); // normalized(name) -> { abn, gs_id, count, ambiguous }
  offset = 0;

  while (true) {
    const { data } = await db
      .from('gs_entities')
      .select('canonical_name, abn, gs_id')
      .not('abn', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;

    for (const e of data) {
      const upper = e.canonical_name.toUpperCase().trim();
      // For exact matches, keep the first one (by ABN uniqueness)
      if (!entityMap.has(upper)) {
        entityMap.set(upper, { abn: e.abn, gs_id: e.gs_id });
      }

      // For normalized matches, track ambiguity
      const norm = normalizeName(e.canonical_name);
      if (norm.length < 3) continue; // Too short
      const existing = normalizedMap.get(norm);
      if (!existing) {
        normalizedMap.set(norm, { abn: e.abn, gs_id: e.gs_id, ambiguous: false });
      } else if (existing.abn !== e.abn) {
        existing.ambiguous = true; // Different ABN for same normalized name
      }
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  log(`Entity map: ${entityMap.size} exact, ${normalizedMap.size} normalized`);

  // Step 3: Match and update
  let exactMatches = 0;
  let normalizedMatches = 0;
  let ambiguousSkips = 0;
  let noMatch = 0;
  let contractsResolved = 0;
  let errors = 0;
  const BATCH_SIZE = 50;
  let batch = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    if (DRY_RUN) {
      batch = [];
      return;
    }

    // Update contracts in batch by supplier_name
    for (const item of batch) {
      const { error } = await db
        .from('austender_contracts')
        .update({ supplier_abn: item.abn })
        .is('supplier_abn', null)
        .eq('supplier_name', item.supplier_name);
      if (error) {
        errors++;
        if (errors <= 5) log(`  ERROR updating "${item.supplier_name}": ${error.message}`);
      }
    }
    batch = [];
  }

  for (const [name, count] of supplierNames) {
    const upper = name.toUpperCase().trim();

    // Skip junk names
    if (upper.length < 3 || upper === 'AUD' || upper.startsWith('SEE MORE INFO')) {
      noMatch++;
      continue;
    }

    // Try exact match first
    const exact = entityMap.get(upper);
    if (exact) {
      exactMatches++;
      contractsResolved += count;
      batch.push({ supplier_name: name, abn: exact.abn });
      if (batch.length >= BATCH_SIZE) await flushBatch();
      continue;
    }

    // Try normalized match
    const norm = normalizeName(name);
    const normMatch = normalizedMap.get(norm);
    if (normMatch && !normMatch.ambiguous) {
      normalizedMatches++;
      contractsResolved += count;
      batch.push({ supplier_name: name, abn: normMatch.abn });
      if (batch.length >= BATCH_SIZE) await flushBatch();
      continue;
    }

    if (normMatch?.ambiguous) {
      ambiguousSkips++;
    } else {
      noMatch++;
    }
  }

  await flushBatch();

  const duration = Date.now() - t0;
  log(`\n=== Results ===`);
  log(`Exact matches:     ${exactMatches.toLocaleString()} names`);
  log(`Normalized matches: ${normalizedMatches.toLocaleString()} names`);
  log(`Ambiguous (skipped): ${ambiguousSkips.toLocaleString()} names`);
  log(`No match:          ${noMatch.toLocaleString()} names`);
  log(`Contracts resolved: ${contractsResolved.toLocaleString()}`);
  log(`Errors:            ${errors}`);
  log(`Duration:          ${(duration / 1000).toFixed(1)}s`);

  // Log agent run
  try {
    const run = await logStart(db, 'resolve-supplier-abns', 'Supplier ABN Resolution');
    await logComplete(db, run.id, {
      items_found: exactMatches + normalizedMatches,
      items_new: contractsResolved,
      status: errors === 0 ? 'success' : 'partial',
    });
  } catch (e) {
    log(`Warning: could not log agent run: ${e.message}`);
  }
}

main().catch((e) => { log(`FATAL: ${e.message}`); process.exit(1); });
