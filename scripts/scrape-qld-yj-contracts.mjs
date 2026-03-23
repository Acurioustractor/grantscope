#!/usr/bin/env node
/**
 * scrape-qld-yj-contracts.mjs
 *
 * Scrapes DCYJMA Contract Disclosure CSVs from the QLD Open Data Portal
 * and upserts into justice_funding table.
 *
 * Data source: https://www.data.qld.gov.au/dataset/dcyjma-contract-disclosure-report
 * CKAN API:    https://data.qld.gov.au/api/3/action/package_show?id=dcyjma-contract-disclosure-report
 *
 * Each CSV resource contains contract disclosures for a reporting period with columns:
 *   Supplier Name, ABN, Contract Title/Description, Contract Value, Start Date, End Date, Category
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-yj-contracts.mjs           # dry-run (default)
 *   node --env-file=.env scripts/scrape-qld-yj-contracts.mjs --live    # insert into DB
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

// ── Config ────────────────────────────────────────────────

const AGENT_ID = 'scrape-qld-yj-contracts';
const AGENT_NAME = 'QLD DCYJMA Contract Disclosure Scraper';

const CKAN_PACKAGE_URL =
  'https://data.qld.gov.au/api/3/action/package_show?id=dcyjma-contract-disclosure-report';
const SOURCE = 'qld_contract_disclosure';
const SOURCE_BASE_URL =
  'https://www.data.qld.gov.au/dataset/dcyjma-contract-disclosure-report';

const LIVE = process.argv.includes('--live');
const DRY_RUN = !LIVE;
const BATCH_SIZE = 50;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ── psql helper (from watch-outcomes-changes pattern) ──────

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/qld-yj-contracts-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    unlinkSync(tmpFile);
    const lines = result
      .trim()
      .split('\n')
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = [];
      let cur = '',
        inQ = false;
      for (const ch of line) {
        if (ch === '"') {
          inQ = !inQ;
          continue;
        }
        if (ch === ',' && !inQ) {
          vals.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      vals.push(cur);
      const obj = {};
      headers.forEach((h, i) => (obj[h] = vals[i] || ''));
      return obj;
    });
  } catch (err) {
    try {
      unlinkSync(tmpFile);
    } catch {}
    console.error('psql error:', err.message?.slice(0, 200));
    return [];
  }
}

// ── Topic auto-tagging ────────────────────────────────────

const TOPIC_KEYWORDS = {
  'youth-justice': [
    'youth',
    'young people',
    'young person',
    'juvenile',
    'youth justice',
    'youth detention',
    'youth offend',
  ],
  'child-protection': [
    'child protection',
    'child safety',
    'out-of-home care',
    'out of home care',
    'foster care',
    'kinship care',
    'residential care',
    'child abuse',
    'family intervention',
  ],
  'family-services': [
    'family support',
    'family services',
    'parenting',
    'domestic violence',
    'domestic and family violence',
    'family wellbeing',
    'family and child',
  ],
  indigenous: [
    'aboriginal',
    'torres strait',
    'indigenous',
    'first nations',
    'first peoples',
    'murri',
    'atsi',
  ],
  diversion: [
    'diversion',
    'restorative',
    'conferencing',
    'caution',
    'bail support',
  ],
  prevention: [
    'prevention',
    'early intervention',
    'early support',
    'preventative',
  ],
  'community-led': [
    'community-led',
    'community led',
    'community-based',
    'community based',
    'community organisation',
    'community organization',
  ],
  wraparound: [
    'wraparound',
    'wrap around',
    'holistic',
    'integrated support',
    'case management',
  ],
  'legal-services': [
    'legal aid',
    'legal service',
    'legal support',
    'court support',
    'advocacy',
  ],
  disability: ['disability', 'ndis'],
  'mental-health': [
    'mental health',
    'counselling',
    'counseling',
    'psychological',
    'wellbeing',
  ],
  housing: ['housing', 'homelessness', 'accommodation', 'tenancy'],
};

/**
 * Auto-tag a description with matching topics.
 * @param {string} description - Contract title/description
 * @param {string} category - Contract category (if available)
 * @returns {string[]} Array of topic tags
 */
function autoTagTopics(description, category = '') {
  const text = `${description} ${category}`.toLowerCase();
  const matched = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matched.push(topic);
        break; // one match per topic is enough
      }
    }
  }

  // DCYJMA contracts are always youth-justice or child-protection related by default
  if (matched.length === 0) {
    matched.push('youth-justice');
  }

  return matched;
}

// ── Sector classification ─────────────────────────────────

/**
 * Classify sector from contract description/category.
 * @param {string} description
 * @param {string} category
 * @returns {string}
 */
function classifySector(description, category = '') {
  const text = `${description} ${category}`.toLowerCase();

  if (
    text.includes('youth justice') ||
    text.includes('youth detention') ||
    text.includes('juvenile')
  )
    return 'youth_justice';
  if (
    text.includes('child protection') ||
    text.includes('child safety') ||
    text.includes('foster') ||
    text.includes('kinship')
  )
    return 'child_protection';
  if (
    text.includes('domestic violence') ||
    text.includes('family violence') ||
    text.includes('dvfv')
  )
    return 'family_violence';
  if (text.includes('disability') || text.includes('ndis'))
    return 'disability';
  if (text.includes('housing') || text.includes('homelessness'))
    return 'housing';
  if (text.includes('mental health') || text.includes('counselling'))
    return 'mental_health';
  if (text.includes('multicultural') || text.includes('settlement') || text.includes('refugee'))
    return 'community_services';
  if (text.includes('aboriginal') || text.includes('torres strait') || text.includes('indigenous') || text.includes('first nations'))
    return 'indigenous_services';

  // Default — DCYJMA covers children, youth justice, multicultural affairs
  return 'community_services';
}

// ── CSV Parsing ──────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects using header row.
 * Handles quoted fields with commas and newlines.
 * @param {string} csvText
 * @returns {Object[]}
 */
function parseCsv(csvText) {
  const rows = [];
  let current = '';
  let inQuote = false;
  const lines = [];

  // Split into lines, handling quoted newlines
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = '';
      // Skip \r\n
      if (ch === '\r' && csvText[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) lines.push(current);

  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]);

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (vals[idx] || '').trim();
    });
    rows.push(obj);
  }

  return rows;
}

/**
 * Parse a single CSV line into field values.
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Column name normalization ────────────────────────────

/**
 * Normalize column headers from the CSV.
 * QLD DCYJMA CSVs may have varying column names across reporting periods.
 * Returns a mapper function that extracts standardized fields from a row.
 */
function buildRowMapper(headers) {
  const headerLower = headers.map((h) => h.toLowerCase().trim());

  const find = (...candidates) => {
    for (const c of candidates) {
      const idx = headerLower.findIndex((h) => h.includes(c));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };

  const supplierCol =
    find('supplier name', 'supplier', 'vendor name', 'vendor', 'contractor') ||
    headers[0];
  const abnCol = find('abn', 'a.b.n') || null;
  const titleCol =
    find(
      'contract title',
      'contract description',
      'description',
      'title',
      'contract name'
    ) || null;
  const valueCol =
    find('contract value', 'value', 'amount', 'total value', 'gst') || null;
  const startCol =
    find('commence date', 'start date', 'commencement', 'contract start', 'effective date') ||
    null;
  const awardCol =
    find('award contract date', 'award date', 'date awarded') || null;
  const endCol =
    find('finish date', 'end date', 'expiry', 'contract end', 'completion date') || null;
  const categoryCol = find('category', 'contract category', 'classification', 'type') || null;

  return (row) => ({
    supplier_name: row[supplierCol] || '',
    abn: row[abnCol] || '',
    title: row[titleCol] || '',
    value: row[valueCol] || '',
    start_date: row[startCol] || row[awardCol] || '',
    end_date: row[endCol] || '',
    category: row[categoryCol] || '',
  });
}

// ── Value parsing helpers ────────────────────────────────

function parseContractValue(val) {
  if (!val) return null;
  // Remove $, commas, whitespace
  const cleaned = val.replace(/[$,\s]/g, '').replace(/\(.*\)/, '').trim();
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a')
    return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (!val || val === '-' || val.toLowerCase() === 'n/a') return null;
  // Try DD/MM/YYYY (common Australian format)
  const ddmmyyyy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  // Try "Month YYYY" or "DD Month YYYY"
  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const monthMatch = val.match(
    /(\d{1,2})?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i
  );
  if (monthMatch) {
    const day = monthMatch[1] ? monthMatch[1].padStart(2, '0') : '01';
    const month = months[monthMatch[2].toLowerCase().slice(0, 3)];
    return `${monthMatch[3]}-${month}-${day}`;
  }
  return null;
}

function normalizeAbn(abn) {
  if (!abn) return null;
  // Strip spaces, dashes, and non-digit characters
  const cleaned = abn.replace(/\D/g, '');
  // ABNs are 11 digits
  if (cleaned.length === 11) return cleaned;
  // ACNs are 9 digits — not an ABN
  return null;
}

/**
 * Derive a financial_year string from a date (YYYY-MM-DD).
 * Australian FY: Jul 1 to Jun 30.
 */
function deriveFinancialYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  if (month >= 7) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

// ── Dedup key ────────────────────────────────────────────

function dedupKey(supplierName, title, value) {
  return `${(supplierName || '').toLowerCase().trim()}|${(title || '').toLowerCase().trim()}|${value || ''}`;
}

// ── Phase 1: Fetch CKAN package and discover CSV resources ─

async function fetchCsvResources() {
  log('Phase 1: Fetching CKAN package metadata...');

  const res = await fetch(CKAN_PACKAGE_URL, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
  });

  if (!res.ok) {
    throw new Error(`CKAN API returned HTTP ${res.status}`);
  }

  const body = await res.json();
  if (!body.success) {
    throw new Error(`CKAN API error: ${JSON.stringify(body.error)}`);
  }

  const resources = body.result.resources || [];
  // Filter to CSV resources only
  const csvResources = resources.filter(
    (r) =>
      r.format?.toLowerCase() === 'csv' ||
      r.url?.toLowerCase().endsWith('.csv') ||
      r.mimetype?.includes('csv')
  );

  log(
    `  Found ${resources.length} resources, ${csvResources.length} are CSV files`
  );

  for (const r of csvResources) {
    log(`    - ${r.name || r.description || 'unnamed'}: ${r.url}`);
  }

  return csvResources;
}

// ── Phase 2: Download and parse CSV files ──────────────────

async function downloadAndParseCsvs(resources) {
  log(`\nPhase 2: Downloading ${resources.length} CSV files...`);
  const allContracts = [];
  const seenKeys = new Set();

  for (const resource of resources) {
    const resourceName = resource.name || resource.description || 'unnamed';
    log(`  Downloading: ${resourceName}`);

    try {
      const res = await fetch(resource.url, {
        headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
        redirect: 'follow',
      });

      if (!res.ok) {
        log(`    HTTP ${res.status}, skipping`);
        continue;
      }

      const csvText = await res.text();
      if (!csvText || csvText.trim().length === 0) {
        log(`    Empty response, skipping`);
        continue;
      }

      const rows = parseCsv(csvText);
      if (rows.length === 0) {
        log(`    No data rows found, skipping`);
        continue;
      }

      // Build column mapper from actual headers
      const headers = Object.keys(rows[0]);
      const mapRow = buildRowMapper(headers);

      log(`    Parsed ${rows.length} rows (columns: ${headers.join(', ')})`);

      let resourceContracts = 0;
      for (const row of rows) {
        const mapped = mapRow(row);

        // Skip rows without a supplier name
        if (!mapped.supplier_name || mapped.supplier_name.trim() === '')
          continue;

        // Deduplicate by supplier+title+value
        const key = dedupKey(
          mapped.supplier_name,
          mapped.title,
          mapped.value
        );
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const abn = normalizeAbn(mapped.abn);
        const contractValue = parseContractValue(mapped.value);
        const startDate = parseDate(mapped.start_date);
        const endDate = parseDate(mapped.end_date);
        const topics = autoTagTopics(mapped.title, mapped.category);
        const sector = classifySector(mapped.title, mapped.category);
        const financialYear = deriveFinancialYear(startDate);

        allContracts.push({
          supplier_name: mapped.supplier_name.trim(),
          abn,
          title: mapped.title.trim(),
          contract_value: contractValue,
          start_date: startDate,
          end_date: endDate,
          category: mapped.category.trim(),
          topics,
          sector,
          financial_year: financialYear,
          resource_name: resourceName,
          resource_url: resource.url,
        });
        resourceContracts++;
      }

      log(`    Kept ${resourceContracts} contracts (after dedup)`);

      // Be polite — 300ms between downloads
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      log(`    Error: ${err.message}`);
    }
  }

  log(`  Total contracts parsed: ${allContracts.length}`);
  return allContracts;
}

// ── Phase 3: Match ABNs to gs_entities ─────────────────────

async function matchEntities(contracts) {
  log(`\nPhase 3: Matching suppliers to gs_entities...`);

  // Collect unique ABNs
  const uniqueAbns = [
    ...new Set(contracts.filter((c) => c.abn).map((c) => c.abn)),
  ];
  log(`  ${uniqueAbns.length} unique ABNs to look up`);

  if (uniqueAbns.length === 0) return new Map();

  // Batch lookup via psql for speed
  const abnList = uniqueAbns.map((a) => `'${a}'`).join(',');
  const entityRows = psql(`
    SELECT id, abn, canonical_name
    FROM gs_entities
    WHERE abn IN (${abnList})
      AND abn IS NOT NULL
  `);

  const abnToEntity = new Map();
  for (const row of entityRows) {
    abnToEntity.set(row.abn, { id: row.id, name: row.canonical_name });
  }

  log(`  Matched ${abnToEntity.size}/${uniqueAbns.length} ABNs to entities`);
  return abnToEntity;
}

// ── Phase 4: Upsert into justice_funding ────────────────────

async function upsertContracts(contracts, abnToEntity) {
  log(`\nPhase 4: Upserting ${contracts.length} contracts into justice_funding...`);

  // Build justice_funding rows
  const rows = contracts.map((c, idx) => {
    const entity = c.abn ? abnToEntity.get(c.abn) : null;

    return {
      source: SOURCE,
      source_url: c.resource_url || SOURCE_BASE_URL,
      source_statement_id: `dcyjma-${(c.supplier_name || '').slice(0, 30).replace(/\s+/g, '-').toLowerCase()}-${idx}`,
      recipient_name: c.supplier_name,
      recipient_abn: c.abn || null,
      program_name: c.title || `DCYJMA Contract - ${c.category || 'Unspecified'}`,
      amount_dollars: c.contract_value,
      state: 'QLD',
      sector: c.sector,
      funding_type: 'contract',
      project_description: c.category
        ? `Category: ${c.category}${c.start_date ? `. Contract period: ${c.start_date} to ${c.end_date || 'ongoing'}` : ''}`
        : null,
      financial_year: c.financial_year,
      topics: c.topics,
      gs_entity_id: entity?.id || null,
    };
  });

  if (DRY_RUN) {
    log('  DRY RUN -- showing summary:');
    log(`    Total rows: ${rows.length}`);
    const totalValue = rows.reduce(
      (sum, r) => sum + (r.amount_dollars || 0),
      0
    );
    log(
      `    Total value: $${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    );
    const linked = rows.filter((r) => r.gs_entity_id).length;
    log(`    Entity matches: ${linked}/${rows.length}`);
    const uniqueSuppliers = new Set(rows.map((r) => r.recipient_name)).size;
    log(`    Unique suppliers: ${uniqueSuppliers}`);

    // Topic distribution
    const topicCounts = {};
    for (const r of rows) {
      for (const t of r.topics || []) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }
    log('    Topics:');
    for (const [topic, count] of Object.entries(topicCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      log(`      ${topic}: ${count}`);
    }

    // Sample rows
    log('\n    Sample rows:');
    for (const r of rows.slice(0, 8)) {
      log(
        `      ${r.recipient_name} | ${r.program_name.slice(0, 60)} | $${r.amount_dollars || 0} | entity: ${r.gs_entity_id ? 'YES' : 'NO'} | topics: ${(r.topics || []).join(',')}`
      );
    }

    return { inserted: 0, errors: 0 };
  }

  // Live mode: delete existing source records then re-insert
  log('  Checking for existing records...');
  const { count: existingCount } = await supabase
    .from('justice_funding')
    .select('id', { count: 'exact', head: true })
    .eq('source', SOURCE);

  if (existingCount > 0) {
    log(`  Deleting ${existingCount} existing '${SOURCE}' records...`);
    const { error: delError } = await supabase
      .from('justice_funding')
      .delete()
      .eq('source', SOURCE);
    if (delError) throw new Error(`Delete failed: ${delError.message}`);
    log(`  Deleted ${existingCount} records`);
  }

  // Insert in batches
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('justice_funding').insert(batch);

    if (error) {
      log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
      // Fall back to individual inserts for this batch
      for (const row of batch) {
        const { error: e2 } = await supabase
          .from('justice_funding')
          .insert(row);
        if (e2) {
          errors++;
          log(`    Error: ${row.recipient_name}: ${e2.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= rows.length) {
      log(`  Progress: ${Math.min(inserted + errors, rows.length)}/${rows.length}`);
    }
  }

  log(`  Inserted: ${inserted}, Errors: ${errors}`);
  return { inserted, errors };
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  log('==================================================');
  log('  QLD DCYJMA Contract Disclosure Scraper');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN (pass --live to insert)' : 'LIVE'}`);
  log('==================================================');

  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Discover CSV resources via CKAN API
    const resources = await fetchCsvResources();
    if (resources.length === 0) {
      log('No CSV resources found. Check the CKAN package ID.');
      await logComplete(supabase, runId, {
        items_found: 0,
        items_new: 0,
      });
      return;
    }

    // Phase 2: Download and parse all CSVs
    const contracts = await downloadAndParseCsvs(resources);
    if (contracts.length === 0) {
      log('No contracts extracted from CSV files.');
      await logComplete(supabase, runId, {
        items_found: 0,
        items_new: 0,
      });
      return;
    }

    // Phase 3: Match ABNs to gs_entities
    const abnToEntity = await matchEntities(contracts);

    // Phase 4: Upsert into justice_funding
    const { inserted, errors } = await upsertContracts(contracts, abnToEntity);

    // ── Summary ──
    const uniqueSuppliers = new Set(contracts.map((c) => c.supplier_name))
      .size;
    const totalValue = contracts.reduce(
      (sum, c) => sum + (c.contract_value || 0),
      0
    );
    const linkedCount = contracts.filter(
      (c) => c.abn && abnToEntity.has(c.abn)
    ).length;

    log('\n--- Summary ---');
    log(`  CSV resources processed: ${resources.length}`);
    log(`  Total contracts: ${contracts.length}`);
    log(`  Unique suppliers: ${uniqueSuppliers}`);
    log(
      `  Total value: $${totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
    );
    log(`  Entity-linked: ${linkedCount}/${contracts.length}`);
    if (!DRY_RUN) {
      log(`  Inserted: ${inserted}`);
      log(`  Errors: ${errors}`);
    }

    // Sector breakdown
    const bySector = {};
    for (const c of contracts) {
      bySector[c.sector] = (bySector[c.sector] || 0) + 1;
    }
    log('\n  By sector:');
    for (const [sector, count] of Object.entries(bySector).sort(
      (a, b) => b[1] - a[1]
    )) {
      log(`    ${sector}: ${count}`);
    }

    // Financial year breakdown
    const byFy = {};
    for (const c of contracts) {
      const fy = c.financial_year || 'unknown';
      byFy[fy] = (byFy[fy] || 0) + 1;
    }
    log('\n  By financial year:');
    for (const [fy, count] of Object.entries(byFy).sort()) {
      log(`    ${fy}: ${count}`);
    }

    await logComplete(supabase, runId, {
      items_found: contracts.length,
      items_new: inserted,
      items_updated: 0,
    });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(supabase, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
