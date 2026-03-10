#!/usr/bin/env node
/**
 * resolve-donation-abns.mjs
 *
 * Resolves ABNs for political donations where donor_abn IS NULL.
 *
 * Strategy:
 *   1. Load distinct donor names without ABNs from political_donations
 *   2. First pass: match against gs_entities (cheap — already in DB)
 *   3. Second pass: stream ABR XML files and match remaining names
 *   4. Apply matches to database
 *
 * Usage:
 *   node --env-file=.env scripts/resolve-donation-abns.mjs              # dry run
 *   node --env-file=.env scripts/resolve-donation-abns.mjs --apply      # update DB
 */

import { execSync, spawn } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'abr');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function spawnPsql(sql) {
  return new Promise((resolve, reject) => {
    const proc = spawn('psql', [CONN, '-t', '-A', '-c', sql], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', () => {}); // ignore warnings
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`psql exited with code ${code}`));
      else resolve(Buffer.concat(chunks).toString('utf8').trim());
    });
    proc.on('error', reject);
  });
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
  console.log(`[donation-abn] ${msg}`);
}

// --- Main ---
const run = await logStart(supabase, 'resolve-donation-abns', 'Resolve Donation ABNs');

try {
  // --- 1. Load distinct donor names without ABNs ---
  log('Loading distinct donor names without ABNs...');
  const donorRaw = await spawnPsql(`SELECT DISTINCT donor_name FROM political_donations WHERE donor_abn IS NULL AND donor_name IS NOT NULL ORDER BY donor_name`);
  const uniqueDonorNames = donorRaw.split('\n').filter(Boolean);
  log(`  ${uniqueDonorNames.length} unique donor names need ABN resolution`);

  if (uniqueDonorNames.length === 0) {
    log('Nothing to do.');
    await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
    process.exit(0);
  }

  // Build lookup map: normalised name -> original donor_name
  const donorLookup = new Map(); // normalised -> donor_name
  for (const name of uniqueDonorNames) {
    const normalised = normaliseName(name);
    if (!donorLookup.has(normalised)) {
      donorLookup.set(normalised, name);
    }
  }
  log(`  ${donorLookup.size} unique normalised names`);

  // Track matches: donor_name -> abn
  const matches = new Map();

  // --- 2. First pass: match against gs_entities ---
  log('Matching against gs_entities...');
  let entityMatches = 0;
  const entityRaw = await spawnPsql(`SELECT canonical_name || '|' || abn FROM gs_entities WHERE abn IS NOT NULL AND canonical_name IS NOT NULL`);

  for (const line of entityRaw.split('\n').filter(Boolean)) {
    const pipeIdx = line.lastIndexOf('|');
    if (pipeIdx === -1) continue;
    const entityName = line.substring(0, pipeIdx);
    const abn = line.substring(pipeIdx + 1);
    if (!abn || abn.length !== 11) continue;

    const normalised = normaliseName(entityName);
    const donorName = donorLookup.get(normalised);
    if (donorName && !matches.has(donorName)) {
      matches.set(donorName, abn);
      entityMatches++;
    }
  }
  log(`  ${entityMatches} matches from gs_entities`);

  // Build remaining set for ABR pass
  const remainingLookup = new Map();
  for (const [normalised, donorName] of donorLookup) {
    if (!matches.has(donorName)) {
      remainingLookup.set(normalised, donorName);
    }
  }
  log(`  ${remainingLookup.size} names remaining for ABR lookup`);

  // --- 3. Second pass: stream ABR XML ---
  if (remainingLookup.size > 0) {
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

    let totalRecords = 0;
    let abrMatches = 0;

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
                const donorName = remainingLookup.get(normalised);
                if (donorName && !matches.has(donorName)) {
                  matches.set(donorName, abn);
                  abrMatches++;
                }
              }
            }

            if (totalRecords % 500000 === 0) {
              log(`    ${totalRecords.toLocaleString()} records, ${abrMatches} ABR matches`);
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
        log(`    Cumulative: ${totalRecords.toLocaleString()} records, ${abrMatches} ABR matches`);
      }
    }

    log(`\nParsed ${totalRecords.toLocaleString()} ABR records, found ${abrMatches} ABR matches`);
  }

  // --- 4. Summary and apply ---
  const totalMatches = matches.size;
  log(`\n=== Summary ===`);
  log(`  Total donor names checked: ${uniqueDonorNames.length}`);
  log(`  Matches from gs_entities:  ${entityMatches}`);
  log(`  Matches from ABR:          ${totalMatches - entityMatches}`);
  log(`  Total resolved:            ${totalMatches}`);

  if (totalMatches === 0) {
    log('No matches found.');
    await logComplete(supabase, run.id, { items_found: uniqueDonorNames.length, items_new: 0 });
    process.exit(0);
  }

  if (DRY_RUN) {
    log('\nDRY RUN — would update:');
    let shown = 0;
    for (const [donorName, abn] of matches) {
      if (shown < 20) {
        log(`  ${donorName} -> ABN ${abn}`);
      }
      shown++;
    }
    if (shown < matches.size) log(`  ... and ${matches.size - shown} more`);
    log(`\nRun with --apply to update database.`);
    await logComplete(supabase, run.id, { items_found: uniqueDonorNames.length, items_new: 0 });
  } else {
    log('\nUpdating database...');
    const BATCH_SIZE = 100;
    const entries = [...matches.entries()];
    let updated = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const cases = batch
        .map(([donorName, abn]) => {
          const escapedName = donorName.replace(/'/g, "''");
          return `WHEN donor_name = '${escapedName}' THEN '${abn}'`;
        })
        .join(' ');
      const whereNames = batch
        .map(([donorName]) => {
          const escapedName = donorName.replace(/'/g, "''");
          return `'${escapedName}'`;
        })
        .join(',');

      await supabase.rpc('exec_sql', {
        query: `UPDATE political_donations SET donor_abn = CASE ${cases} END WHERE donor_name IN (${whereNames}) AND donor_abn IS NULL`
      });
      updated += batch.length;
      if (updated % 500 === 0 || updated === entries.length) {
        log(`  Updated ${updated}/${matches.size} donor names`);
      }
    }

    log(`Updated ${updated} donor names with ABNs`);
    await logComplete(supabase, run.id, {
      items_found: uniqueDonorNames.length,
      items_new: totalMatches,
      items_updated: totalMatches,
    });
  }

  log('Done.');
} catch (err) {
  console.error('[donation-abn] Fatal error:', err);
  await logFailed(supabase, run.id, err);
  process.exit(1);
}
