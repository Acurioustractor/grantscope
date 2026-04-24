#!/usr/bin/env node
/**
 * enrich-companies-from-abr.mjs
 *
 * Generates template descriptions for companies using ABR Bulk Extract XML data.
 * Extracts entity type (public/private), state, trading names, DGR and GST status.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-companies-from-abr.mjs              # dry run
 *   node --env-file=.env scripts/enrich-companies-from-abr.mjs --apply      # update DB
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, writeFileSync, unlinkSync, createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { Writable } from 'stream';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'abr');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout, maxBuffer: 200 * 1024 * 1024 }).trim();
}

function log(msg) {
  console.log(`[company-enrich] ${msg}`);
}

// --- State name mapping ---
const STATE_NAMES = {
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
  WA: 'Western Australia',
  SA: 'South Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

// --- Entity type mapping ---
const ENTITY_TYPE_MAP = {
  PUB: 'Australian public company',
  PRV: 'Australian private company',
  IND: 'sole trader',
  FXT: 'fixed trust',
  UIE: 'unincorporated entity',
  SGE: 'state government entity',
  CGE: 'Commonwealth government entity',
  LGE: 'local government entity',
  DES: 'discretionary trading trust',
  DTT: 'discretionary trading trust',
  DIT: 'discretionary investment trust',
  HYT: 'hybrid trust',
  FAM: 'family partnership',
  LPT: 'limited partnership',
  PTR: 'partnership',
  TRT: 'trust',
  NPF: 'not-for-profit company',
  COP: 'cooperative',
  SAF: 'SMSF',
  CSS: 'complying super fund',
  PST: 'pooled development fund',
  SUP: 'super fund',
};

// --- 1. Load ABNs of companies needing descriptions ---
log('Loading company ABNs needing descriptions...');
const raw = psql(`SELECT abn FROM gs_entities WHERE abn IS NOT NULL AND entity_type = 'company' AND description IS NULL`);
const needsDesc = new Set(raw.split('\n').filter(Boolean));
log(`  ${needsDesc.size} companies need descriptions`);

if (needsDesc.size === 0) {
  log('Nothing to do.');
  process.exit(0);
}

// --- 2. Parse ABR XML for company data ---
const zipFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.zip')).sort();
log(`Found ${zipFiles.length} ZIP files`);

// Store extracted data: ABN → { entityType, entityTypeText, state, tradingNames[], dgr, gst }
const companyData = new Map();

function extractField(line, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`);
  const m = line.match(re);
  return m ? m[1] : null;
}

function extractAttr(line, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*?${attr}="([^"]+)"`);
  const m = line.match(re);
  return m ? m[1] : null;
}

function decodeXmlEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractAllNames(line, type) {
  const re = new RegExp(`<NonIndividualName[^>]*type="${type}"[^>]*>\\s*<NonIndividualNameText>([^<]+)</NonIndividualNameText>`, 'g');
  const names = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    names.push(decodeXmlEntities(m[1]));
  }
  return names;
}

function processXmlStream(source, label) {
  log(`  Processing ${label}...`);
  let fileMatches = 0;

  try {
    // Stream the XML and process line by line (each <ABR> is one line)
    const result = execSync(
      `${source} | grep '<ABN status="ACT"'`,
      { encoding: 'utf8', maxBuffer: 500 * 1024 * 1024, timeout: 600000 }
    );

    for (const line of result.split('\n')) {
      if (!line) continue;

      // Extract ABN
      const abn = extractField(line, 'ABN');
      if (!abn || !needsDesc.has(abn)) continue;

      // Extract entity type
      const entityTypeInd = extractField(line, 'EntityTypeInd');
      const entityTypeText = extractField(line, 'EntityTypeText');
      const state = extractField(line, 'State');
      const gstStatus = extractAttr(line, 'GST', 'status');
      const dgrStatus = extractAttr(line, 'DGR', 'status');

      // Extract trading names
      const tradingNames = [
        ...extractAllNames(line, 'TRD'),
        ...extractAllNames(line, 'BN'),
      ];

      // Extract main name for cross-reference
      const mainName = extractField(line, 'NonIndividualNameText');

      companyData.set(abn, {
        entityTypeInd,
        entityTypeText,
        state,
        gstStatus,
        dgrStatus: dgrStatus === 'ACT' ? true : false,
        tradingNames: [...new Map(tradingNames.map(n => [n.toUpperCase(), n])).values()], // dedupe case-insensitive
        mainName,
      });

      fileMatches++;
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

log(`\nExtracted data for ${companyData.size} / ${needsDesc.size} companies`);

// --- 3. Generate descriptions ---
function titleCase(str) {
  return str.toLowerCase().replace(/(?:^|\s|[-/])\S/g, c => c.toUpperCase());
}

function generateDescription(abn, data, entityName) {
  const parts = [];

  // Entity type
  const typeLabel = ENTITY_TYPE_MAP[data.entityTypeInd] || data.entityTypeText?.toLowerCase() || 'company';
  parts.push(`${entityName} is an ${typeLabel}`);

  // State
  if (data.state && STATE_NAMES[data.state]) {
    parts.push(` registered in ${STATE_NAMES[data.state]}`);
  } else if (data.state) {
    parts.push(` registered in ${data.state}`);
  }

  // DGR status
  if (data.dgrStatus) {
    parts.push(', with deductible gift recipient (DGR) status');
  }

  // Trading names (limit to 3)
  const tradeNames = data.tradingNames
    .filter(n => n.toUpperCase() !== entityName.toUpperCase())
    .slice(0, 3);
  if (tradeNames.length > 0) {
    parts.push(`. Also trades as ${tradeNames.map(n => titleCase(n)).join(', ')}`);
  }

  parts.push('.');
  return parts.join('');
}

// --- 4. Apply updates ---
// First, get canonical names for the matched ABNs
log('Loading canonical names for matched companies...');
const abnList = Array.from(companyData.keys());
const CHUNK = 1000;
const nameMap = new Map();

for (let i = 0; i < abnList.length; i += CHUNK) {
  const chunk = abnList.slice(i, i + CHUNK);
  const inClause = chunk.map(a => `'${a}'`).join(',');
  const nameRows = psql(`SELECT abn, canonical_name FROM gs_entities WHERE abn IN (${inClause}) AND entity_type = 'company' AND description IS NULL`);
  for (const row of nameRows.split('\n').filter(Boolean)) {
    const [abn, ...nameParts] = row.split('|');
    nameMap.set(abn, nameParts.join('|')); // name might contain |
  }
}

log(`  Got names for ${nameMap.size} companies`);

// Generate descriptions
const updates = [];
for (const [abn, data] of companyData) {
  const name = nameMap.get(abn);
  if (!name) continue;
  const desc = generateDescription(abn, data, name);
  updates.push({ abn, desc });
}

log(`Generated ${updates.length} descriptions`);

if (DRY_RUN) {
  log('\nDRY RUN — sample descriptions:');
  for (const u of updates.slice(0, 10)) {
    log(`  ${u.desc}`);
  }
  log(`\nWould update ${updates.length} companies. Run with --apply to update.`);
  process.exit(0);
}

// Apply in batches
log(`\nApplying ${updates.length} description updates...`);
const BATCH_SIZE = 200;
let totalUpdated = 0;

for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE);
  const values = batch
    .map(u => {
      const escapedDesc = u.desc.replace(/'/g, "''");
      return `('${u.abn}', '${escapedDesc}')`;
    })
    .join(',\n');

  const sql = `
    UPDATE gs_entities e
    SET description = v.descr
    FROM (VALUES ${values}) AS v(abn, descr)
    WHERE e.abn = v.abn AND e.entity_type = 'company' AND e.description IS NULL
  `;

  const tmpFile = join(DATA_DIR, '_company_desc.sql');
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(`psql "${CONN}" -f "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
    const count = parseInt(result.match(/UPDATE (\d+)/)?.[1] || '0');
    totalUpdated += count;
  } catch (err) {
    log(`  Batch error at offset ${i}: ${err.message?.slice(0, 200)}`);
  }
  try { unlinkSync(tmpFile); } catch {}

  if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= updates.length) {
    log(`  Progress: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}, ${totalUpdated} updated`);
  }
}

log(`\nDone! Updated ${totalUpdated} company descriptions.`);

// Final stats
const descStats = psql(`SELECT entity_type, COUNT(*) as total, COUNT(description) as with_desc FROM gs_entities GROUP BY entity_type ORDER BY total DESC`);
log('\nDescription coverage:');
for (const row of descStats.split('\n').filter(Boolean)) {
  const [type, total, withDesc] = row.split('|');
  log(`  ${type}: ${withDesc}/${total} (${Math.round(withDesc/total*100)}%)`);
}
