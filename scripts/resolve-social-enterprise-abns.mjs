#!/usr/bin/env node
/**
 * resolve-social-enterprise-abns.mjs
 *
 * Resolves ABNs for social enterprises (Supply Nation, Social Traders, etc.)
 * by matching names against the ABR Bulk Extract XML files.
 *
 * Strategy:
 *   1. Load social enterprises without ABNs from DB
 *   2. Parse ABR XML files, building name→ABN index (normalised)
 *   3. Match and update
 *
 * Usage:
 *   node --env-file=.env scripts/resolve-social-enterprise-abns.mjs              # dry run
 *   node --env-file=.env scripts/resolve-social-enterprise-abns.mjs --apply      # update DB
 */

import { execSync, spawn } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'abr');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function normaliseName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bPTY\.?\s*/g, 'PTY ')
    .replace(/\bLTD\.?\b/g, 'LTD')
    .replace(/\bLIMITED\b/g, 'LTD')
    .replace(/\bINCORPORATED\b/g, 'INC')
    .replace(/\bCORPORATION\b/g, 'CORP')
    .replace(/[.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function log(msg) {
  console.log(`[abn-resolve] ${msg}`);
}

// --- 1. Load social enterprises without ABNs ---
log('Loading social enterprises without ABNs...');
const raw = psql(`SELECT id || '|' || name FROM social_enterprises WHERE abn IS NULL ORDER BY name`);
const needsAbn = [];
for (const line of raw.split('\n').filter(Boolean)) {
  const pipeIdx = line.indexOf('|');
  if (pipeIdx === -1) continue;
  const id = line.substring(0, pipeIdx);
  const name = line.substring(pipeIdx + 1);
  needsAbn.push({ id, name, normalised: normaliseName(name) });
}
log(`  ${needsAbn.length} social enterprises need ABN resolution`);

if (needsAbn.length === 0) {
  log('Nothing to do.');
  process.exit(0);
}

// Build lookup map: normalised name → social enterprise
const seLookup = new Map();
for (const se of needsAbn) {
  if (!seLookup.has(se.normalised)) {
    seLookup.set(se.normalised, se);
  }
}
log(`  ${seLookup.size} unique normalised names`);

// --- 2. Parse ABR XML and match ---
log('Checking ABR data...');
if (!existsSync(DATA_DIR)) {
  console.error('No ABR data directory at data/abr/. Download first.');
  process.exit(1);
}

const zips = readdirSync(DATA_DIR).filter(f => f.endsWith('.zip'));
if (zips.length === 0) {
  console.error('No ZIP files found in data/abr/');
  process.exit(1);
}

// Stream-parse ABR XML via unzip -p | readline (avoids buffering 500MB+ files)
const matches = new Map(); // se_id → { abn, matchedName }
let totalRecords = 0;
let totalMatches = 0;

async function parseXmlStream(zipPath, xmlFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-p', zipPath, xmlFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

    let buffer = '';

    rl.on('line', (line) => {
      buffer += line + '\n';

      // Process complete <ABR>...</ABR> records
      const abrPattern = /<ABR[^>]*>([\s\S]*?)<\/ABR>/g;
      let match;
      while ((match = abrPattern.exec(buffer)) !== null) {
        totalRecords++;
        const record = match[1];

        const abnMatch = record.match(/<ABN[^>]*>(\d{11})<\/ABN>/);
        if (abnMatch) {
          const abn = abnMatch[1];
          const names = [];
          const namePatterns = [
            /<NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/g,
            /<OrganisationName>([^<]+)<\/OrganisationName>/g,
          ];
          for (const pat of namePatterns) {
            let nm;
            while ((nm = pat.exec(record)) !== null) {
              names.push(nm[1].replace(/&amp;/g, '&'));
            }
          }
          for (const name of names) {
            const normalised = normaliseName(name);
            const seMatch = seLookup.get(normalised);
            if (seMatch && !matches.has(seMatch.id)) {
              matches.set(seMatch.id, { abn, matchedName: name });
              totalMatches++;
            }
          }
        }

        if (totalRecords % 500000 === 0) {
          log(`    ${totalRecords.toLocaleString()} records, ${totalMatches} matches`);
        }
      }

      // Keep only the last partial record (after last </ABR>)
      const lastClose = buffer.lastIndexOf('</ABR>');
      if (lastClose !== -1) {
        buffer = buffer.substring(lastClose + 6);
      }
    });

    rl.on('close', () => resolve());
    proc.on('error', reject);
    proc.stderr.on('data', () => {}); // ignore stderr
  });
}

for (const zipFile of zips) {
  const zipPath = join(DATA_DIR, zipFile);
  log(`Processing ${zipFile}...`);

  const zipList = execSync(`unzip -l "${zipPath}" | grep '\\.xml$' | awk '{print $NF}'`, { encoding: 'utf8' });
  const xmlFiles = zipList.trim().split('\n').filter(Boolean);

  for (const xmlFile of xmlFiles) {
    log(`  Parsing ${xmlFile}...`);
    await parseXmlStream(zipPath, xmlFile);
    log(`    Cumulative: ${totalRecords.toLocaleString()} records, ${totalMatches} matches`);
  }
}

log(`\nParsed ${totalRecords.toLocaleString()} ABR records, found ${totalMatches} matches`);

if (totalMatches === 0) {
  log('No matches found.');
  process.exit(0);
}

// --- 3. Update database ---
if (DRY_RUN) {
  log('\nDRY RUN — would update:');
  let shown = 0;
  for (const [seId, { abn, matchedName }] of matches) {
    const se = needsAbn.find(s => s.id === seId);
    if (shown < 20) {
      log(`  ${se?.name} → ABN ${abn} (matched: ${matchedName})`);
    }
    shown++;
  }
  if (shown < matches.size) log(`  ... and ${matches.size - shown} more`);
  log(`\nRun with --apply to update database.`);
} else {
  log('\nUpdating database...');
  const BATCH_SIZE = 100;
  const entries = [...matches.entries()];
  let updated = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const cases = batch.map(([id, { abn }]) => `WHEN '${id}'::uuid THEN '${abn}'`).join(' ');
    const ids = batch.map(([id]) => `'${id}'::uuid`).join(',');

    psql(`UPDATE social_enterprises SET abn = CASE id ${cases} END, updated_at = NOW() WHERE id IN (${ids})`);
    updated += batch.length;
    if (updated % 500 === 0) log(`  Updated ${updated}/${matches.size}`);
  }

  log(`Updated ${updated} social enterprises with ABNs`);
}

log('Done.');
