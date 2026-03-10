#!/usr/bin/env node

/**
 * ingest-asic-directors.mjs
 *
 * Two modes:
 *
 * 1. --officeholders <file>  Ingest ASIC officeholder/person extract into person_roles table
 *    Expected columns: Company Name, ACN, Person Name, Role, Appointment Date, Cessation Date
 *    (Adjust column mapping once actual ASIC officeholder extract schema is known)
 *
 * 2. --aliases               Extract former company names from ASIC company CSV into gs_entity_aliases
 *    Source: data/asic/company_202603.csv (tab-delimited, ~4.3M rows)
 *    Rows where Current Name Indicator is NOT 'Y' are former names.
 *
 * Both modes use streaming (readline) to handle 370MB+ files without loading into memory.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-asic-directors.mjs --aliases              # extract former names
 *   node --env-file=.env scripts/ingest-asic-directors.mjs --aliases --apply       # write to DB
 *   node --env-file=.env scripts/ingest-asic-directors.mjs --officeholders <file>  # ingest directors
 *   node --env-file=.env scripts/ingest-asic-directors.mjs --officeholders <file> --apply
 *   node --env-file=.env scripts/ingest-asic-directors.mjs --stats                # show network stats
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const MODE_ALIASES = process.argv.includes('--aliases');
const MODE_STATS = process.argv.includes('--stats');
const offIdx = process.argv.indexOf('--officeholders');
const MODE_OFFICEHOLDERS = offIdx !== -1;
const OFFICEHOLDER_FILE = MODE_OFFICEHOLDERS ? process.argv[offIdx + 1] : null;

const DATA_DIR = join(import.meta.dirname, '..', 'data', 'asic');
const COMPANY_CSV = join(DATA_DIR, 'company_202603.csv');
const BATCH_SIZE = 500;

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function psqlFile(filePath, timeout = 120000) {
  const cmd = `psql "${CONN}" -f "${filePath}"`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function log(msg) {
  console.log(`[asic-directors] ${msg}`);
}

function escSql(s) {
  if (!s) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

function parseDate(d) {
  if (!d || !d.trim()) return null;
  // ASIC format: DD/MM/YYYY
  const parts = d.trim().split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --aliases — Extract former company names from ASIC company CSV
// ─────────────────────────────────────────────────────────────────────────────
async function extractAliases() {
  log('Extracting former company names from ASIC company CSV...');
  log(`Source: ${COMPANY_CSV}`);

  // Load gs_entities ACN set for matching
  log('Loading gs_entities ACN set...');
  const acnRaw = psql(`SELECT acn FROM gs_entities WHERE acn IS NOT NULL`);
  const entityAcns = new Set(acnRaw.split('\n').filter(Boolean));
  log(`  ${entityAcns.size} entities with ACN in database`);

  // Stream the CSV
  const rl = createInterface({
    input: createReadStream(COMPANY_CSV, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let headerParsed = false;
  let colIdx = {};
  const aliases = []; // { acn, formerName, currentName, currentNameStartDate }
  let totalFormerNames = 0;
  let matchedFormerNames = 0;

  for await (const line of rl) {
    lineNum++;
    if (!headerParsed) {
      const header = line.replace(/^\uFEFF/, '').split('\t').map(h => h.trim());
      header.forEach((h, i) => colIdx[h] = i);
      headerParsed = true;
      continue;
    }

    const fields = line.split('\t');
    const currentIndicator = fields[colIdx['Current Name Indicator']]?.trim();

    // We want rows that are NOT the current name (historical names)
    if (currentIndicator === 'Y') continue;

    totalFormerNames++;
    const acn = fields[colIdx['ACN']]?.trim();
    if (!acn) continue;

    // Only care about companies we have in gs_entities
    if (!entityAcns.has(acn)) continue;

    const formerName = fields[colIdx['Company Name']]?.trim();
    const currentName = fields[colIdx['Current Name']]?.trim();
    const currentNameStartDate = fields[colIdx['Current Name Start Date']]?.trim();

    if (!formerName) continue;

    matchedFormerNames++;
    aliases.push({
      acn,
      formerName,
      currentName: currentName || null,
      nameChangeDate: parseDate(currentNameStartDate),
    });

    if (lineNum % 500000 === 0) {
      log(`  Processed ${lineNum.toLocaleString()} lines, ${matchedFormerNames} matched aliases...`);
    }
  }

  log(`\nFormer name extraction complete:`);
  log(`  Total rows: ${(lineNum - 1).toLocaleString()}`);
  log(`  Former name rows: ${totalFormerNames.toLocaleString()}`);
  log(`  Matched to gs_entities: ${matchedFormerNames.toLocaleString()}`);

  if (!APPLY) {
    log('\nDRY RUN — sample aliases:');
    for (let i = 0; i < Math.min(20, aliases.length); i++) {
      const a = aliases[i];
      log(`  ACN ${a.acn}: "${a.formerName}" → "${a.currentName || '?'}" (changed ${a.nameChangeDate || 'unknown'})`);
    }
    log(`\nRun with --apply to insert ${aliases.length} aliases into gs_entity_aliases.`);
    return;
  }

  // Get ACN → entity_id mapping for matched ACNs
  const matchedAcns = [...new Set(aliases.map(a => a.acn))];
  const entityMap = new Map(); // acn → entity_id
  for (let i = 0; i < matchedAcns.length; i += 500) {
    const chunk = matchedAcns.slice(i, i + 500);
    const inClause = chunk.map(a => `'${a}'`).join(',');
    const rows = psql(`SELECT acn, id FROM gs_entities WHERE acn IN (${inClause})`);
    for (const row of rows.split('\n').filter(Boolean)) {
      const [acn, id] = row.split('|');
      entityMap.set(acn, id);
    }
  }
  log(`  Mapped ${entityMap.size} ACNs to entity IDs`);

  // Insert aliases in batches
  let inserted = 0;
  for (let i = 0; i < aliases.length; i += BATCH_SIZE) {
    const batch = aliases.slice(i, i + BATCH_SIZE);
    const values = batch
      .filter(a => entityMap.has(a.acn))
      .map(a => {
        const entityId = entityMap.get(a.acn);
        return `('${entityId}', 'former_name', ${escSql(a.formerName)}, 'asic', false)`;
      })
      .join(',\n');

    if (!values) continue;

    const sql = `INSERT INTO gs_entity_aliases (entity_id, alias_type, alias_value, source, is_primary)
VALUES ${values}
ON CONFLICT DO NOTHING`;

    const tmpFile = join(DATA_DIR, `_alias_batch_${i}.sql`);
    writeFileSync(tmpFile, sql);
    try {
      const result = psqlFile(tmpFile);
      const count = parseInt(result.match(/INSERT 0 (\d+)/)?.[1] || '0');
      inserted += count;
    } catch (err) {
      log(`  Batch ${i} error: ${err.message?.slice(0, 200)}`);
    }
    try { unlinkSync(tmpFile); } catch {}

    if ((i + BATCH_SIZE) % 5000 === 0) {
      log(`  Inserted ${inserted} aliases so far (batch ${i / BATCH_SIZE + 1})...`);
    }
  }

  log(`\nDone! Inserted ${inserted} former-name aliases into gs_entity_aliases.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --officeholders — Ingest ASIC officeholder data into person_roles
// ─────────────────────────────────────────────────────────────────────────────
async function ingestOfficeholders() {
  if (!OFFICEHOLDER_FILE) {
    console.error('Usage: --officeholders <path-to-csv>');
    process.exit(1);
  }

  log(`Ingesting officeholder data from: ${OFFICEHOLDER_FILE}`);
  log(`NOTE: Adjust column mapping once actual ASIC officeholder extract schema is confirmed.`);

  // Expected ASIC officeholder extract columns (based on ASIC documentation):
  // Company Name, ACN, Person Title, Given Name 1, Given Name 2, Family Name,
  // Role Type, Appointment Date, Cessation Date, Date of Birth, Place of Birth,
  // State/Country of Residence
  //
  // The exact column names will vary — adjust the mapping below.

  const ROLE_TYPE_MAP = {
    'DIR': 'director',
    'DIRECTOR': 'director',
    'SEC': 'secretary',
    'SECRETARY': 'secretary',
    'ADIR': 'alternate_director',
    'ALTERNATE DIRECTOR': 'alternate_director',
    'PUBOFF': 'public_officer',
    'PUBLIC OFFICER': 'public_officer',
    'CHAIR': 'chair',
  };

  // Load ACN→ABN mapping from asic_companies for cross-ref
  log('Loading ACN→ABN mapping...');
  const acnAbnRaw = psql(`SELECT acn, abn FROM asic_companies WHERE abn IS NOT NULL`);
  const acnToAbn = new Map();
  for (const row of acnAbnRaw.split('\n').filter(Boolean)) {
    const [acn, abn] = row.split('|');
    if (acn && abn) acnToAbn.set(acn, abn);
  }
  log(`  ${acnToAbn.size} ACN→ABN mappings loaded`);

  // Load gs_entities ACN set for cross-ref
  const acnEntityRaw = psql(`SELECT acn, id FROM gs_entities WHERE acn IS NOT NULL`);
  const acnToEntityId = new Map();
  for (const row of acnEntityRaw.split('\n').filter(Boolean)) {
    const [acn, id] = row.split('|');
    if (acn && id) acnToEntityId.set(acn, id);
  }
  log(`  ${acnToEntityId.size} ACN→entity_id mappings loaded`);

  // Stream the officeholder CSV
  const rl = createInterface({
    input: createReadStream(OFFICEHOLDER_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let headerParsed = false;
  let colIdx = {};
  const batch = [];
  let totalParsed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  async function flushBatch() {
    if (batch.length === 0) return;

    const values = batch.map(r => {
      const entityId = acnToEntityId.get(r.acn);
      return `(${escSql(r.personName)}, ${escSql(r.roleType)}, ${escSql(r.acn)}, ${escSql(r.companyName)}, ${escSql(r.abn)}, ${entityId ? `'${entityId}'` : 'NULL'}, ${r.appointmentDate ? escSql(r.appointmentDate) : 'NULL'}, ${r.cessationDate ? escSql(r.cessationDate) : 'NULL'}, 'asic', ${escSql(OFFICEHOLDER_FILE)})`;
    }).join(',\n');

    const sql = `INSERT INTO person_roles (person_name, role_type, company_acn, company_name, company_abn, entity_id, appointment_date, cessation_date, source, source_file)
VALUES ${values}
ON CONFLICT (person_name_normalised, role_type, company_acn, COALESCE(appointment_date, '1900-01-01')) DO NOTHING`;

    const tmpFile = join(DATA_DIR, `_officer_batch.sql`);
    writeFileSync(tmpFile, sql);
    try {
      const result = psqlFile(tmpFile);
      const count = parseInt(result.match(/INSERT 0 (\d+)/)?.[1] || '0');
      totalInserted += count;
    } catch (err) {
      log(`  Batch error at line ${lineNum}: ${err.message?.slice(0, 200)}`);
    }
    try { unlinkSync(tmpFile); } catch {}
    batch.length = 0;
  }

  for await (const line of rl) {
    lineNum++;
    if (!headerParsed) {
      const header = line.replace(/^\uFEFF/, '').split('\t').map(h => h.trim());
      header.forEach((h, i) => colIdx[h] = i);
      log(`  Columns found: ${header.join(', ')}`);

      // Verify expected columns exist — adjust these based on actual schema
      const expectedCols = ['ACN', 'Company Name'];
      const missing = expectedCols.filter(c => colIdx[c] === undefined);
      if (missing.length > 0) {
        log(`  WARNING: Missing expected columns: ${missing.join(', ')}`);
        log(`  Available columns: ${header.join(', ')}`);
        log(`  You may need to adjust the column mapping in this script.`);
      }

      headerParsed = true;
      continue;
    }

    const fields = line.split('\t');
    const acn = fields[colIdx['ACN']]?.trim();
    if (!acn) continue;

    // Build person name from available fields
    // Common ASIC patterns: "Given Name 1", "Given Name 2", "Family Name"
    // Or: "Person Name" as a single field
    let personName;
    if (colIdx['Person Name'] !== undefined) {
      personName = fields[colIdx['Person Name']]?.trim();
    } else if (colIdx['Family Name'] !== undefined) {
      const given1 = fields[colIdx['Given Name 1']]?.trim() || '';
      const given2 = fields[colIdx['Given Name 2']]?.trim() || '';
      const family = fields[colIdx['Family Name']]?.trim() || '';
      const title = fields[colIdx['Person Title']]?.trim() || '';
      personName = [given1, given2, family].filter(Boolean).join(' ');
      if (title) personName = `${title} ${personName}`;
    } else {
      // Try other common patterns
      const nameFields = ['Name', 'Full Name', 'Officeholder Name'];
      for (const f of nameFields) {
        if (colIdx[f] !== undefined) {
          personName = fields[colIdx[f]]?.trim();
          break;
        }
      }
    }

    if (!personName) {
      totalSkipped++;
      continue;
    }

    // Role type
    let roleRaw = fields[colIdx['Role Type']]?.trim()
      || fields[colIdx['Role']]?.trim()
      || fields[colIdx['Position']]?.trim()
      || 'officeholder';
    const roleType = ROLE_TYPE_MAP[roleRaw.toUpperCase()] || 'other';

    const companyName = fields[colIdx['Company Name']]?.trim() || null;
    const abn = acnToAbn.get(acn) || null;

    const appointmentDate = parseDate(
      fields[colIdx['Appointment Date']]?.trim()
      || fields[colIdx['Start Date']]?.trim()
    );
    const cessationDate = parseDate(
      fields[colIdx['Cessation Date']]?.trim()
      || fields[colIdx['End Date']]?.trim()
    );

    totalParsed++;
    batch.push({
      personName,
      roleType,
      acn,
      companyName,
      abn,
      appointmentDate,
      cessationDate,
    });

    if (batch.length >= BATCH_SIZE) {
      if (APPLY) {
        await flushBatch();
      } else {
        batch.length = 0;
      }
    }

    if (lineNum % 100000 === 0) {
      log(`  Processed ${lineNum.toLocaleString()} lines, ${totalParsed.toLocaleString()} officeholders parsed...`);
    }
  }

  // Flush remaining
  if (APPLY && batch.length > 0) {
    await flushBatch();
  }

  log(`\nOfficeholder ingestion complete:`);
  log(`  Total rows: ${(lineNum - 1).toLocaleString()}`);
  log(`  Officeholders parsed: ${totalParsed.toLocaleString()}`);
  log(`  Skipped (no name): ${totalSkipped.toLocaleString()}`);

  if (APPLY) {
    log(`  Inserted: ${totalInserted.toLocaleString()}`);

    // Cross-reference: create gs_relationships for directorships
    log('\nCreating directorship relationships in gs_relationships...');
    const relSql = `INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, dataset, start_date, end_date, confidence) SELECT pr.person_entity_id, pr.entity_id, 'directorship', 'asic-officeholders', pr.appointment_date, pr.cessation_date, 'registry' FROM person_roles pr WHERE pr.person_entity_id IS NOT NULL AND pr.entity_id IS NOT NULL AND pr.role_type IN ('director', 'alternate_director', 'chair') ON CONFLICT DO NOTHING`;
    try {
      psql(relSql, 300000);
      log('  Directorship relationships created.');
    } catch (err) {
      log(`  Relationship creation deferred — person_entity_id needs population first.`);
    }
  } else {
    log(`\nDRY RUN — sample officeholders:`);
    // Re-stream a small sample
    const rl2 = createInterface({
      input: createReadStream(OFFICEHOLDER_FILE, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    let shown = 0;
    let skip = true;
    for await (const line of rl2) {
      if (skip) { skip = false; continue; }
      if (shown >= 10) break;
      log(`  ${line.substring(0, 120)}`);
      shown++;
    }
    log(`\nRun with --apply to insert into person_roles.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode: --stats — Show director network statistics
// ─────────────────────────────────────────────────────────────────────────────
async function showStats() {
  log('Director Network Statistics\n');

  const personCount = psql(`SELECT COUNT(*) FROM person_roles`);
  log(`Total person_roles records: ${parseInt(personCount).toLocaleString()}`);

  if (parseInt(personCount) === 0) {
    log('\nNo officeholder data ingested yet.');
    log('The ASIC free dataset (data.gov.au) only contains company registration data.');
    log('Director/officeholder data requires a paid ASIC Company Extract.');
    log('\nTo obtain ASIC officeholder data:');
    log('  1. Purchase from ASIC: https://asic.gov.au/online-services/search-asic-s-registers/');
    log('  2. Or use an ASIC information broker (InfoTrack, etc.)');
    log('\nOnce obtained, ingest with:');
    log('  node --env-file=.env scripts/ingest-asic-directors.mjs --officeholders <file> --apply');

    log('\n--- Alternative: ACNC Responsible Persons ---');
    const acncCount = psql(`SELECT COUNT(*) FROM acnc_charities WHERE abn IS NOT NULL`);
    log(`ACNC charities in database: ${parseInt(acncCount).toLocaleString()}`);
    log('ACNC Annual Information Statements include responsible persons (directors/trustees).');
    log('This is a free alternative for charity-sector board networks.');

    log('\n--- Former Company Names (available now) ---');
    const aliasCount = psql(`SELECT COUNT(*) FROM gs_entity_aliases WHERE alias_type = 'former_name' AND source = 'asic'`);
    log(`Former name aliases from ASIC: ${parseInt(aliasCount).toLocaleString()}`);
    if (parseInt(aliasCount) === 0) {
      log('Run: node --env-file=.env scripts/ingest-asic-directors.mjs --aliases --apply');
    }

    log('\n--- gs_entities Overlap ---');
    const overlap = psql(`SELECT COUNT(DISTINCT ge.acn) as gs_entities_with_acn_in_asic FROM gs_entities ge JOIN asic_companies ac ON ge.acn = ac.acn`);
    log(`gs_entities matching asic_companies by ACN: ${parseInt(overlap).toLocaleString()}`);

    return;
  }

  // If we have data, show full stats
  const roleBreakdown = psql(`SELECT role_type, COUNT(*), COUNT(DISTINCT person_name_normalised) as unique_persons FROM person_roles GROUP BY role_type ORDER BY count DESC`);
  log('\nRole breakdown:');
  for (const row of roleBreakdown.split('\n').filter(Boolean)) {
    const [role, count, persons] = row.split('|');
    log(`  ${role}: ${parseInt(count).toLocaleString()} appointments, ${parseInt(persons).toLocaleString()} unique persons`);
  }

  const activeDirectors = psql(`SELECT COUNT(DISTINCT person_name_normalised) FROM person_roles WHERE cessation_date IS NULL AND role_type IN ('director', 'alternate_director', 'chair')`);
  log(`\nActive directors: ${parseInt(activeDirectors).toLocaleString()}`);

  const multiBoard = psql(`SELECT COUNT(*) FROM (SELECT person_name_normalised FROM person_roles WHERE cessation_date IS NULL AND role_type IN ('director', 'alternate_director', 'chair') GROUP BY person_name_normalised HAVING COUNT(DISTINCT company_acn) >= 2) t`);
  log(`People on 2+ boards: ${parseInt(multiBoard).toLocaleString()}`);

  const maxBoards = psql(`SELECT person_name_normalised, COUNT(DISTINCT company_acn) as seats FROM person_roles WHERE cessation_date IS NULL AND role_type IN ('director', 'alternate_director', 'chair') GROUP BY person_name_normalised ORDER BY seats DESC LIMIT 10`);
  log('\nTop board accumulators:');
  for (const row of maxBoards.split('\n').filter(Boolean)) {
    const [name, seats] = row.split('|');
    log(`  ${name}: ${seats} board seats`);
  }

  const entityOverlap = psql(`SELECT COUNT(DISTINCT entity_id) FROM person_roles WHERE entity_id IS NOT NULL`);
  log(`\nCompanies linked to gs_entities: ${parseInt(entityOverlap).toLocaleString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  if (MODE_STATS) {
    await showStats();
  } else if (MODE_ALIASES) {
    await extractAliases();
  } else if (MODE_OFFICEHOLDERS) {
    await ingestOfficeholders();
  } else {
    console.log(`Usage:
  node --env-file=.env scripts/ingest-asic-directors.mjs --aliases [--apply]
  node --env-file=.env scripts/ingest-asic-directors.mjs --officeholders <file> [--apply]
  node --env-file=.env scripts/ingest-asic-directors.mjs --stats`);
  }
}

main().catch(err => {
  console.error('[asic-directors] Fatal error:', err);
  process.exit(1);
});
