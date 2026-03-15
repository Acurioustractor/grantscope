#!/usr/bin/env node

/**
 * Fuzzy ABN Matcher Agent
 *
 * Uses PostgreSQL trigram similarity to match gs_entities missing ABN
 * directly against abr_registry. Handles abbreviations, typos, and
 * name variations that exact matching misses.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-fuzzy-abn-match.mjs [--threshold=0.5] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const THRESHOLD = parseFloat(process.argv.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.5');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// Run a raw SQL query via psql and return JSON rows
function rawSql(sql) {
  writeFileSync('/tmp/fuzzy_query.sql', sql);
  try {
    const result = execSync(
      `source ${process.cwd()}/.env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -t -A -F '|' -f /tmp/fuzzy_query.sql`,
      { shell: '/bin/bash', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000 }
    ).toString().trim();
    if (!result) return [];
    return result.split('\n').filter(Boolean);
  } catch (e) {
    log(`  SQL error: ${e.message.slice(0, 200)}`);
    return [];
  }
}

async function main() {
  log(`=== Fuzzy ABN Matcher (threshold=${THRESHOLD}) ===`);
  const t0 = Date.now();

  // Get entities missing ABN (excluding persons)
  log('Loading entities missing ABN...');
  const PAGE = 1000;
  let entities = [];
  let offset = 0;

  while (true) {
    const { data } = await db.from('gs_entities')
      .select('id, canonical_name, entity_type, state')
      .is('abn', null)
      .neq('entity_type', 'person')
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    entities = entities.concat(data);
    offset += PAGE;
  }

  log(`${entities.length.toLocaleString()} entities missing ABN`);
  if (LIMIT) entities = entities.slice(0, LIMIT);

  let matched = 0;
  let checked = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const e of entities) {
    checked++;

    const cleanName = e.canonical_name
      .replace(/'/g, "''")  // Escape SQL quotes
      .trim();

    if (cleanName.length < 5) { skipped++; continue; }

    // Build state filter if available
    const stateFilter = e.state ? `AND a.state = '${e.state}'` : '';

    // Use trigram similarity search on abr_registry
    const sql = `
      SELECT a.abn, a.entity_name, a.state, a.postcode,
             similarity(a.entity_name, '${cleanName}') as sim
      FROM abr_registry a
      WHERE a.entity_name % '${cleanName}'
        AND a.status = 'Active'
        ${stateFilter}
        AND similarity(a.entity_name, '${cleanName}') >= ${THRESHOLD}
      ORDER BY sim DESC
      LIMIT 3;
    `;

    const rows = rawSql(sql);

    if (rows.length === 0) {
      // Try without state filter
      if (stateFilter) {
        const sql2 = `
          SET statement_timeout = '30s';
          SELECT a.abn, a.entity_name, a.state, a.postcode,
                 similarity(a.entity_name, '${cleanName}') as sim
          FROM abr_registry a
          WHERE a.entity_name % '${cleanName}'
            AND a.status = 'Active'
            AND similarity(a.entity_name, '${cleanName}') >= ${THRESHOLD}
          ORDER BY sim DESC
          LIMIT 3;
        `;
        const rows2 = rawSql(sql2);
        if (rows2.length === 0) { noMatch++; continue; }
        rows.push(...rows2);
      } else {
        noMatch++;
        continue;
      }
    }

    // Parse best match
    const parts = rows[0].split('|');
    const bestAbn = parts[0];
    const bestName = parts[1];
    const bestState = parts[2];
    const bestPostcode = parts[3];
    const bestSim = parseFloat(parts[4]);

    // Check ABN not already used
    const { data: existing } = await db.from('gs_entities')
      .select('id').eq('abn', bestAbn).maybeSingle();
    if (existing && existing.id !== e.id) continue;

    // Update entity
    const update = { abn: bestAbn };
    if (!e.state && bestState) update.state = bestState;
    if (bestPostcode) update.postcode = bestPostcode;

    const { error } = await db.from('gs_entities').update(update).eq('id', e.id);
    if (!error) {
      matched++;
      if (matched <= 30) {
        log(`  MATCH: "${e.canonical_name}" → "${bestName}" (${bestAbn}) sim=${bestSim.toFixed(2)}`);
      }
    }

    if (checked % 100 === 0) {
      log(`  [${checked}/${entities.length}] matched=${matched} noMatch=${noMatch} skipped=${skipped}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${matched} matched out of ${entities.length} (${noMatch} no match, ${skipped} skipped) in ${elapsed} min`);

  // Updated coverage
  const types = ['indigenous_corp', 'company', 'charity', 'government_body', 'political_party'];
  for (const t of types) {
    const { count: total } = await db.from('gs_entities').select('*', { count: 'exact', head: true }).eq('entity_type', t);
    const { count: noAbn } = await db.from('gs_entities').select('*', { count: 'exact', head: true }).eq('entity_type', t).is('abn', null);
    log(`  ${t}: ${noAbn}/${total} missing ABN (${((1 - noAbn/total) * 100).toFixed(1)}% coverage)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
