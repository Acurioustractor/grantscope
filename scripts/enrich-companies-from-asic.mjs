#!/usr/bin/env node
/**
 * enrich-companies-from-asic.mjs
 *
 * Enriches gs_entities companies with data from ASIC Company Dataset (data.gov.au):
 * - Company class (limited by shares, limited by guarantee, unlimited)
 * - Company sub-class (proprietary, public listed, public unlisted)
 * - ASIC status (registered, deregistered, struck off)
 * - Registration date
 * - ACN (if missing)
 *
 * Data source: https://data.gov.au/data/dataset/asic-companies
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-companies-from-asic.mjs              # dry run
 *   node --env-file=.env scripts/enrich-companies-from-asic.mjs --apply      # update DB
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'asic');
const CSV_PATH = join(DATA_DIR, 'company_202603.csv');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function log(msg) {
  console.log(`[asic-enrich] ${msg}`);
}

// --- Code mappings ---
const TYPE_MAP = {
  APTY: 'Australian proprietary company',
  APUB: 'Australian public company',
  FNOS: 'registered foreign company',
  RACN: 'registered Australian body',
  CCIV: 'corporate collective investment vehicle',
};

const CLASS_MAP = {
  LMSH: 'limited by shares',
  LMGT: 'limited by guarantee',
  LMSG: 'limited by shares and guarantee',
  UNLM: 'unlimited',
  NONE: '',
  NLIA: 'no liability',
};

const SUBCLASS_MAP = {
  PROP: 'proprietary',
  PSTC: 'proprietary (SMSF trustee)',
  LIST: 'listed',
  LISN: 'listed (no liability)',
  LISS: 'listed (special purpose)',
  ULSN: 'unlisted public',
  ULST: 'unlisted public',
  ULSS: 'unlisted special purpose',
  PNPC: 'proprietary non-profit',
  HUNT: 'proprietary (converted from SA)',
  NLTD: 'no liability',
  RACA: 'registered body (association)',
  RACO: 'registered body (other)',
  PUBF: 'public (fundraising)',
  WHSL: 'wholesale',
  EXPT: 'exempt',
  NONE: '',
  STFI: 'stapled financial instrument',
};

const STATUS_MAP = {
  REGD: 'registered',
  DRGD: 'deregistered',
  SOFF: 'struck off',
  EXAD: 'external administration',
  NOAC: 'no activity',
  CNCL: 'cancelled',
  DISS: 'dissolved',
};

// --- 1. Load company ABNs from database ---
log('Loading company ABNs from database...');
const raw = psql(`SELECT abn FROM gs_entities WHERE abn IS NOT NULL AND entity_type = 'company'`);
const companyAbns = new Set(raw.split('\n').filter(Boolean));
log(`  ${companyAbns.size} companies in database`);

// --- 2. Parse ASIC CSV ---
log(`Reading ASIC dataset: ${CSV_PATH}`);
const csv = readFileSync(CSV_PATH, 'utf8');
const lines = csv.split('\n');
log(`  ${lines.length} lines in CSV`);

// Parse header (tab-delimited, BOM)
const header = lines[0].replace(/^\uFEFF/, '').split('\t').map(h => h.trim());
log(`  Columns: ${header.join(', ')}`);

const colIdx = {};
header.forEach((h, i) => colIdx[h] = i);

// Extract data for our companies
const enrichData = new Map(); // ABN → { type, class, subClass, status, regDate, acn }
let matched = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  const fields = line.split('\t');
  let abn = fields[colIdx['ABN']]?.trim();
  if (!abn) continue;

  // ASIC ABN format might be different — normalize
  abn = abn.replace(/\s/g, '');
  if (!companyAbns.has(abn)) continue;

  // Only take the "current name" row (has Current Name Indicator = Y or is only row)
  const currentIndicator = fields[colIdx['Current Name Indicator']]?.trim();
  // Skip rows that are historical names (not current)
  if (enrichData.has(abn) && currentIndicator !== 'Y') continue;

  const type = fields[colIdx['Type']]?.trim();
  const cls = fields[colIdx['Class']]?.trim();
  const subClass = fields[colIdx['Sub Class']]?.trim();
  const status = fields[colIdx['Status']]?.trim();
  const regDate = fields[colIdx['Date of Registration']]?.trim();
  const acn = fields[colIdx['ACN']]?.trim();

  enrichData.set(abn, { type, cls, subClass, status, regDate, acn });
  matched++;
}

log(`  Matched ${enrichData.size} companies (${matched} rows processed)`);

// --- 3. Generate enriched descriptions ---
// Update descriptions to include ASIC-specific detail
const updates = [];

// Get current names
const abnList = Array.from(enrichData.keys());
const CHUNK = 1000;
const nameMap = new Map();

for (let i = 0; i < abnList.length; i += CHUNK) {
  const chunk = abnList.slice(i, i + CHUNK);
  const inClause = chunk.map(a => `'${a}'`).join(',');
  const nameRows = psql(`SELECT abn, canonical_name, description, acn FROM gs_entities WHERE abn IN (${inClause}) AND entity_type = 'company'`);
  for (const row of nameRows.split('\n').filter(Boolean)) {
    const parts = row.split('|');
    nameMap.set(parts[0], {
      name: parts[1],
      hasDesc: !!parts[2],
      hasAcn: !!parts[3],
    });
  }
}

// Count what we can enrich
let acnFills = 0;
let nfpFlags = 0;

for (const [abn, data] of enrichData) {
  const entity = nameMap.get(abn);
  if (!entity) continue;

  // Fill ACN if missing
  if (!entity.hasAcn && data.acn && data.acn !== '000000000') {
    acnFills++;
  }

  // Flag limited-by-guarantee as potential NFP
  if (data.cls === 'LMGT') {
    nfpFlags++;
  }
}

log(`\nEnrichment summary:`);
log(`  Companies matched: ${enrichData.size}`);
log(`  ACN fills available: ${acnFills}`);
log(`  Limited by guarantee (potential NFP): ${nfpFlags}`);
log(`  Status breakdown:`);

const statusCounts = {};
for (const [, data] of enrichData) {
  const label = STATUS_MAP[data.status] || data.status;
  statusCounts[label] = (statusCounts[label] || 0) + 1;
}
for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
  log(`    ${status}: ${count}`);
}

if (DRY_RUN) {
  log('\nDRY RUN — sample enrichments:');
  let i = 0;
  for (const [abn, data] of enrichData) {
    if (i++ >= 10) break;
    const entity = nameMap.get(abn);
    const typeLabel = TYPE_MAP[data.type] || data.type;
    const clsLabel = CLASS_MAP[data.cls] || data.cls;
    log(`  ${entity?.name || abn}: ${typeLabel}, ${clsLabel}, ${STATUS_MAP[data.status]}, reg ${data.regDate}`);
  }
  log(`\nRun with --apply to update database.`);
  process.exit(0);
}

// --- 4. Apply ACN backfill ---
log('\nBackfilling ACN from ASIC data...');
const acnUpdates = [];
for (const [abn, data] of enrichData) {
  const entity = nameMap.get(abn);
  if (entity && !entity.hasAcn && data.acn && data.acn !== '000000000') {
    acnUpdates.push({ abn, acn: data.acn });
  }
}

let acnUpdated = 0;
for (let i = 0; i < acnUpdates.length; i += 500) {
  const batch = acnUpdates.slice(i, i + 500);
  const values = batch.map(u => `('${u.abn}', '${u.acn}')`).join(',\n');
  const sql = `UPDATE gs_entities e SET acn = v.acn FROM (VALUES ${values}) AS v(abn, acn) WHERE e.abn = v.abn AND e.acn IS NULL`;
  const tmpFile = join(DATA_DIR, '_acn.sql');
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(`psql "${CONN}" -f "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
    acnUpdated += parseInt(result.match(/UPDATE (\d+)/)?.[1] || '0');
  } catch (err) {
    log(`  ACN batch error: ${err.message?.slice(0, 200)}`);
  }
  try { unlinkSync(tmpFile); } catch {}
}
log(`  ACN updated: ${acnUpdated}`);

// --- 5. Tag limited-by-guarantee companies ---
log('\nTagging limited-by-guarantee companies...');
const lmgtAbns = [];
for (const [abn, data] of enrichData) {
  if (data.cls === 'LMGT') lmgtAbns.push(abn);
}

// We could add a column or tag, but for now let's just count
log(`  ${lmgtAbns.length} companies are limited by guarantee (likely NFP)`);

// Final stats
const finalAcn = psql(`SELECT COUNT(*) as total, COUNT(acn) as with_acn FROM gs_entities WHERE entity_type = 'company'`);
const [total, withAcn] = finalAcn.split('|');
log(`\nFinal ACN coverage: ${withAcn}/${total} (${Math.round(withAcn/total*100)}%)`);
