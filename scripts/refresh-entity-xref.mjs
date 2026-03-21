#!/usr/bin/env node
/**
 * refresh-entity-xref.mjs — Refresh entity_xref table in staged batches
 *
 * The old mv_entity_xref MV timed out on REFRESH because 6 UNION ALL branches
 * each scanned gs_entities (566K rows). This script populates entity_xref as a
 * regular table in stages, each completing within Supabase's statement timeout.
 *
 * Usage: node --env-file=.env scripts/refresh-entity-xref.mjs
 */
import { execSync } from 'child_process';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'ACT'];

function psql(query, timeout = 180000) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) throw new Error('DATABASE_PASSWORD not set in .env');
  const result = execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "SET statement_timeout = '150s'; ${query.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }
  );
  return result.trim();
}

function extractCount(result) {
  const match = result.match(/INSERT 0 (\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function stage(label, query) {
  const start = performance.now();
  try {
    const result = psql(query);
    const count = extractCount(result);
    const ms = Math.round(performance.now() - start);
    console.log(`  ✅ ${label.padEnd(30)} ${count.toLocaleString().padStart(8)} rows  ${ms}ms`);
    return count;
  } catch (e) {
    const ms = Math.round(performance.now() - start);
    const err = e.stderr?.split('\n').find(l => l.includes('ERROR:'))?.slice(0, 80) || 'timeout';
    console.log(`  ❌ ${label.padEnd(30)} ${err}  ${ms}ms`);
    return 0;
  }
}

console.log('\n  entity_xref Refresh\n');
const totalStart = performance.now();

// Truncate
psql('TRUNCATE entity_xref');
console.log('  Truncated entity_xref\n');

let total = 0;

// Stage 1: GS_ID
total += stage('GS_ID', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT id, gs_id, canonical_name, 'GS_ID', gs_id, 'gs_entities' FROM gs_entities WHERE gs_id IS NOT NULL`);

// Stage 2: ABN
total += stage('ABN', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT id, gs_id, canonical_name, 'ABN', abn, 'gs_entities' FROM gs_entities WHERE abn IS NOT NULL`);

// Stage 3: ACN
total += stage('ACN', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT ge.id, ge.gs_id, ge.canonical_name, 'ACN', ar.acn, 'abr_registry' FROM gs_entities ge JOIN abr_registry ar ON ar.abn = ge.abn WHERE ge.abn IS NOT NULL AND ar.acn IS NOT NULL AND ar.acn <> ''`);

// Stage 4: ACNC_ABN
total += stage('ACNC_ABN', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT ge.id, ge.gs_id, ge.canonical_name, 'ACNC_ABN', f.acnc_abn, 'foundations' FROM foundations f JOIN gs_entities ge ON ge.abn = f.acnc_abn WHERE f.acnc_abn IS NOT NULL`);

// Stage 5: ORIC_ICN
total += stage('ORIC_ICN', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT DISTINCT ge.id, ge.gs_id, ge.canonical_name, 'ORIC_ICN', pr.company_acn, 'person_roles_oric' FROM person_roles pr JOIN gs_entities ge ON ge.abn = pr.company_abn WHERE pr.source = 'oric_register' AND pr.company_acn IS NOT NULL AND pr.company_acn <> '' AND pr.company_abn IS NOT NULL`);

// Stage 6: TRADING_NAME (batched by state to avoid timeout)
console.log('  --- TRADING_NAME (batched by state) ---');
for (const st of STATES) {
  total += stage(`TRADING_NAME [${st}]`, `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT ge.id, ge.gs_id, ge.canonical_name, 'TRADING_NAME', unnest(ar.trading_names), 'abr_registry' FROM gs_entities ge JOIN abr_registry ar ON ar.abn = ge.abn WHERE ge.abn IS NOT NULL AND ge.state = '${st}' AND ar.trading_names IS NOT NULL AND array_length(ar.trading_names, 1) > 0`);
}
// Remaining states + NULL
total += stage('TRADING_NAME [other]', `INSERT INTO entity_xref (entity_id, gs_id, canonical_name, identifier_type, identifier_value, source) SELECT ge.id, ge.gs_id, ge.canonical_name, 'TRADING_NAME', unnest(ar.trading_names), 'abr_registry' FROM gs_entities ge JOIN abr_registry ar ON ar.abn = ge.abn WHERE ge.abn IS NOT NULL AND (ge.state NOT IN ('NSW','VIC','QLD','WA','SA','ACT') OR ge.state IS NULL) AND ar.trading_names IS NOT NULL AND array_length(ar.trading_names, 1) > 0`);

const totalMs = Math.round(performance.now() - totalStart);
console.log(`\n  Total: ${total.toLocaleString()} rows in ${Math.round(totalMs / 1000)}s\n`);
