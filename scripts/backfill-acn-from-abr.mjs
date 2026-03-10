#!/usr/bin/env node
/**
 * backfill-acn-from-abr.mjs
 *
 * Extracts ASIC Numbers (ACN) from ABR Bulk Extract XML and backfills
 * the `acn` column on gs_entities for companies.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-acn-from-abr.mjs              # dry run
 *   node --env-file=.env scripts/backfill-acn-from-abr.mjs --apply      # update DB
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'abr');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function log(msg) {
  console.log(`[acn-backfill] ${msg}`);
}

// --- 1. Load ABNs needing ACN ---
log('Loading companies with ABN but no ACN...');
const raw = psql(`SELECT abn FROM gs_entities WHERE abn IS NOT NULL AND entity_type = 'company' AND acn IS NULL`);
const needsAcn = new Set(raw.split('\n').filter(Boolean));
log(`  ${needsAcn.size} companies need ACN`);

if (needsAcn.size === 0) {
  log('Nothing to do.');
  process.exit(0);
}

// --- 2. Extract ABN → ASIC number from ABR XML ---
const zipFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.zip')).sort();
log(`Found ${zipFiles.length} ZIP files`);

const matches = new Map(); // ABN → ACN

function processXmlStream(source, label) {
  log(`  Processing ${label}...`);
  let fileMatches = 0;

  try {
    const result = execSync(
      `${source} | grep -o '<ABN status="ACT"[^>]*>[0-9]\\{11\\}</ABN>.*<ASICNumber[^>]*>[0-9]\\{9\\}</ASICNumber>' | sed 's/.*<ABN[^>]*>\\([0-9]\\{11\\}\\)<\\/ABN>.*<ASICNumber[^>]*>\\([0-9]\\{9\\}\\)<\\/ASICNumber>.*/\\1|\\2/'`,
      { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 600000 }
    );

    for (const line of result.split('\n')) {
      if (!line) continue;
      const [abn, acn] = line.split('|');
      if (abn && acn && needsAcn.has(abn) && acn !== '000000000') {
        matches.set(abn, acn);
        fileMatches++;
      }
    }
    log(`    ${fileMatches} matches`);
  } catch (err) {
    if (err.status !== 1) {
      log(`    Error: ${err.message?.slice(0, 200)}`);
    } else {
      log(`    0 matches`);
    }
  }
}

for (const zf of zipFiles) {
  const zipPath = join(DATA_DIR, zf);
  const listing = execSync(`unzip -l "${zipPath}" | grep '\\.xml$' | awk '{print $4}'`, { encoding: 'utf8' });
  const xmlInZip = listing.trim().split('\n').filter(Boolean);
  for (const xmlName of xmlInZip) {
    processXmlStream(`unzip -p "${zipPath}" "${xmlName}"`, `${zf}/${xmlName}`);
  }
}

log(`\nFound ACN for ${matches.size} / ${needsAcn.size} companies`);

if (matches.size === 0) {
  log('No matches found.');
  process.exit(0);
}

if (DRY_RUN) {
  log('\nDRY RUN — sample matches:');
  let i = 0;
  for (const [abn, acn] of matches) {
    if (i++ >= 10) break;
    log(`  ABN ${abn} → ACN ${acn}`);
  }
  log(`\nWould update ${matches.size} companies. Run with --apply to update.`);
  process.exit(0);
}

// --- 3. Apply ---
log(`\nApplying ${matches.size} ACN updates...`);
const BATCH_SIZE = 500;
const entries = Array.from(matches.entries());
let updated = 0;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const values = batch.map(([abn, acn]) => `('${abn}', '${acn}')`).join(',\n');

  const sql = `
    UPDATE gs_entities e
    SET acn = v.acn
    FROM (VALUES ${values}) AS v(abn, acn)
    WHERE e.abn = v.abn AND e.entity_type = 'company' AND e.acn IS NULL
  `;

  const tmpFile = join(DATA_DIR, '_acn_update.sql');
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(`psql "${CONN}" -f "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
    const count = parseInt(result.match(/UPDATE (\d+)/)?.[1] || '0');
    updated += count;
  } catch (err) {
    log(`  Batch error at offset ${i}: ${err.message?.slice(0, 200)}`);
  }
  try { unlinkSync(tmpFile); } catch {}
}

log(`Done! Updated ${updated} companies with ACN.`);
const acnStats = psql(`SELECT COUNT(*) as total, COUNT(acn) as with_acn FROM gs_entities WHERE entity_type = 'company'`);
const [total, withAcn] = acnStats.split('|');
log(`ACN coverage: ${withAcn}/${total} (${Math.round(withAcn/total*100)}%)`);
