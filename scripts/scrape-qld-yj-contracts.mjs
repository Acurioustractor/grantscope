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

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { psql } from './lib/psql.mjs';

// ── Config ────────────────────────────────────────────────

const AGENT_ID = 'scrape-qld-yj-contracts';
const AGENT_NAME = 'QLD DCYJMA Contract Disclosure Scraper';

const CKAN_PACKAGE_URL =
  'https://data.qld.gov.au/api/3/action/package_show?id=dcyjma-contract-disclosure-report';
const SOURCE = 'qld_contract_disclosure';
const SOURCE_BASE_URL =
  'https://www.data.qld.gov.au/dataset/dcyjma-contract-disclosure-report';
const JINA_HTTP_PREFIX = 'https://r.jina.ai/http://';
const CKAN_RESOURCE_SHOW_URL = 'https://data.qld.gov.au/api/3/action/resource_show?id=';

const LIVE = process.argv.includes('--live');
const DRY_RUN = !LIVE;
/** Required before this scraper will delete rows that carry an organisation link. */
const ALLOW_ATTRIBUTED_DELETES = process.argv.includes('--allow-attributed-deletes');
const BATCH_SIZE = 50;
const MIN_RETAIN_RATIO = 0.8;
const resourceArchiveCache = new Map();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function stripJinaWrapper(text) {
  if (!text) return text;
  const marker = 'Markdown Content:\n';
  const markerIndex = text.indexOf(marker);
  let cleaned = markerIndex >= 0 ? text.slice(markerIndex + marker.length).trim() : text.trim();

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split(/\r?\n/);
    if (lines.length > 2) {
      lines.shift();
      while (lines.length && lines.at(-1)?.trim() === '```') {
        lines.pop();
      }
      cleaned = lines.join('\n').trim();
    }
  }

  return cleaned;
}

async function fetchTextAttempt({ url, via, headers, transform }) {
  try {
    const res = await fetch(url, {
      headers,
      redirect: 'follow',
    });

    if (!res.ok) {
      return {
        text: null,
        via: null,
        error: `HTTP ${res.status} via ${via}`,
      };
    }

    const rawText = await res.text();
    const text = transform ? transform(rawText) : rawText;
    if (!text || text.trim().length === 0) {
      return {
        text: null,
        via: null,
        error: `Empty response via ${via}`,
      };
    }

    return {
      text,
      via,
      sourceUrl: url,
    };
  } catch (err) {
    return {
      text: null,
      via: null,
      error: `${via} error: ${err.message}`,
    };
  }
}

async function fetchResourceArchiveUrl(resource) {
  if (!resource?.id) return null;
  if (resourceArchiveCache.has(resource.id)) {
    return resourceArchiveCache.get(resource.id);
  }

  try {
    const res = await fetch(`${CKAN_RESOURCE_SHOW_URL}${resource.id}`, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
    });
    if (!res.ok) {
      resourceArchiveCache.set(resource.id, null);
      return null;
    }

    const body = await res.json();
    const cacheUrl = body?.result?.archiver?.cache_url || null;
    resourceArchiveCache.set(resource.id, cacheUrl);
    return cacheUrl;
  } catch {
    resourceArchiveCache.set(resource.id, null);
    return null;
  }
}

async function fetchCsvText(resource) {
  const resourceUrl = resource?.url || resource;
  const attempts = [
    {
      via: 'direct',
      url: resourceUrl,
      headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
    },
    {
      via: 'jina',
      url: `${JINA_HTTP_PREFIX}${resourceUrl.replace(/^https?:\/\//, '')}`,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/plain',
      },
      transform: stripJinaWrapper,
    },
  ];

  let lastFailure = null;

  for (const attempt of attempts) {
    const result = await fetchTextAttempt(attempt);
    if (result.text) return result;
    lastFailure = result.error;
  }

  return {
    text: null,
    via: null,
    error: lastFailure || 'Unknown fetch failure',
  };
}

async function fetchArchiveCsvText(resource) {
  const cacheUrl = await fetchResourceArchiveUrl(resource);
  if (!cacheUrl) {
    return {
      text: null,
      via: null,
      error: 'No CKAN archive URL available',
    };
  }

  return fetchTextAttempt({
    via: 'ckan-archive',
    url: cacheUrl,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv,text/plain,*/*' },
  });
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

function isLikelyDisclosureHeader(headers) {
  const normalized = headers.map((header) => header.toLowerCase().replace(/\s+/g, ' ').trim());
  const hasSupplier = normalized.some((header) => header.includes('supplier name') || header === 'supplier');
  const hasContractShape = normalized.some(
    (header) =>
      header.includes('contract description') ||
      header.includes('contract title') ||
      header.includes('contract description/name') ||
      header.includes('contract description/ name'),
  );
  const hasValue = normalized.some((header) => header.includes('contract value') || header === 'value');
  return hasSupplier && hasContractShape && hasValue;
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

function dedupKeyForInsert(recipientName, programName, amountDollars) {
  return [
    SOURCE,
    (recipientName || '').toLowerCase().trim(),
    (programName || '').toLowerCase().trim(),
    amountDollars == null ? '' : String(amountDollars),
  ].join('|');
}

function dedupeInsertRows(rows) {
  const deduped = [];
  const seen = new Set();

  for (const row of rows) {
    const key = dedupKeyForInsert(
      row.recipient_name,
      row.program_name,
      row.amount_dollars
    );
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
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
      let fetched = await fetchCsvText(resource);
      if (!fetched.text) {
        log(`    ${fetched.error || 'Fetch failed'}; trying CKAN archive`);
        fetched = await fetchArchiveCsvText(resource);
        if (!fetched.text) {
          log(`    ${fetched.error || 'Archive fetch failed'}, skipping`);
          continue;
        }
      }

      let csvText = fetched.text;
      let rows = parseCsv(csvText);
      let headers = rows.length > 0 ? Object.keys(rows[0]) : [];

      if (rows.length === 0 || !isLikelyDisclosureHeader(headers)) {
        log(`    ${rows.length === 0 ? 'No data rows found' : 'Header did not match contract disclosure shape'}; trying CKAN archive`);
        const archiveFetched = await fetchArchiveCsvText(resource);
        if (archiveFetched.text) {
          fetched = archiveFetched;
          csvText = archiveFetched.text;
          rows = parseCsv(csvText);
          headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        }
      }

      if (rows.length === 0) {
        log(`    No data rows found after fallback, skipping`);
        continue;
      }

      if (!isLikelyDisclosureHeader(headers)) {
        log(`    Header did not match contract disclosure shape after fallback, skipping`);
        continue;
      }

      log(`    Loaded via ${fetched.via}`);
      const mapRow = buildRowMapper(headers);

      log(`    Parsed ${rows.length} rows (columns: ${headers.join(', ')})`);

      let resourceContracts = 0;
      for (const row of rows) {
        const mapped = mapRow(row);
        const supplierName = (mapped.supplier_name || '').trim();

        // Skip rows without a supplier name
        if (!supplierName)
          continue;

        const title = (mapped.title || '').trim();
        const category = (mapped.category || '').trim();
        const contractValue = parseContractValue(mapped.value);
        const programName = title || `DCYJMA Contract - ${category || 'Unspecified'}`;

        // Deduplicate against the same uniqueness shape enforced by justice_funding
        const key = dedupKeyForInsert(
          supplierName,
          programName,
          contractValue
        );
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const abn = normalizeAbn(mapped.abn);
        const startDate = parseDate(mapped.start_date);
        const endDate = parseDate(mapped.end_date);
        const topics = autoTagTopics(title, category);
        const sector = classifySector(title, category);
        const financialYear = deriveFinancialYear(startDate);

        allContracts.push({
          supplier_name: supplierName,
          abn,
          title,
          contract_value: contractValue,
          start_date: startDate,
          end_date: endDate,
          category,
          topics,
          sector,
          financial_year: financialYear,
          resource_name: resourceName,
          resource_url: fetched.sourceUrl || resource.url,
        });
        resourceContracts++;
      }

      log(`    Kept ${resourceContracts} contracts (after dedup)`);

      // Per-resource category coverage, using the real CSV parser rather than a naive split.
      // Category is the only structured field that says what a contract is FOR, and it is
      // populated on recent vintages and absent on older ones. Whether that is upstream or a
      // column-name mismatch on our side decides whether 53% of the rows can be scoped at all.
      const fromThis = allContracts.slice(allContracts.length - resourceContracts);
      const withCat = fromThis.filter((c) => (c.category || '').trim()).length;
      const sampleCats = [...new Set(fromThis.map((c) => (c.category || '').trim()).filter(Boolean))].slice(0, 4);
      log(
        `    Category: ${withCat}/${resourceContracts} populated` +
          (sampleCats.length ? ` e.g. ${sampleCats.map((c) => JSON.stringify(c)).join(', ')}` : ''),
      );

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

/**
 * A stable identity for a contract row, derived from what the contract IS.
 *
 * Deliberately computed from fields that exist as COLUMNS on justice_funding, not from
 * the scraper's raw CSV shape. That way the same function keys both sides of the
 * reconciliation, and no backfill is needed: the 23,713 rows already mirrored carry the
 * old positional source_statement_id, and matching on stored ids would miss every one of
 * them and delete the lot. Content matching recognises them as they are.
 *
 * Verified unique across all 23,713 mirrored rows: zero collisions on this tuple.
 */
function rowKey(r) {
  const parts = [
    r.recipient_name || '',
    r.recipient_abn || '',
    r.program_name || '',
    // DB numerics come back as strings, CSV values as numbers. Normalise both.
    r.amount_dollars === null || r.amount_dollars === undefined
      ? ''
      : Number(r.amount_dollars).toFixed(2),
    r.financial_year || '',
    r.project_description || '',
  ].join('|');
  return createHash('md5').update(parts).digest('hex');
}

/**
 * Fields the scraper owns. Everything else on an existing row is left alone, which is the
 * point: alma_organization_id, link_basis and linked_at are NOT here, so attribution
 * survives a re-ingest.
 *
 * source_statement_id is deliberately NOT here. New rows get the stable content-hash form,
 * but the 23,713 already mirrored keep their legacy positional ids. Converging them would
 * mean 23,713 updates on the first run for a purely cosmetic gain, which is a good way to
 * make this change look like a regression the first time it runs. Nothing depends on those
 * ids any more: reconciliation matches on content.
 */
const SCRAPER_OWNED = [
  'source_url',
  'recipient_name',
  'recipient_abn',
  'program_name',
  'amount_dollars',
  'state',
  'sector',
  'funding_type',
  'project_description',
  'financial_year',
  'announcement_date',
  'topics',
  'gs_entity_id',
];

/**
 * Read-only classification of fetched rows against what is already mirrored.
 *
 * Deliberately separate from the writing so DRY RUN exercises exactly the logic that LIVE
 * will use. The first version of this reconciliation could only be rehearsed by writing to
 * 23,713 production rows, which is not a rehearsal.
 */
async function reconcile(rows) {
  const existing = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('justice_funding')
      .select(`id, alma_organization_id, link_basis, ${SCRAPER_OWNED.join(', ')}`)
      .eq('source', SOURCE)
      .range(from, from + 999);
    if (error) throw new Error(`Read existing failed: ${error.message}`);
    if (!data?.length) break;
    existing.push(...data);
    if (data.length < 1000) break;
  }

  // Keyed on content, computed identically for both sides.
  const byKey = new Map();
  for (const e of existing) byKey.set(rowKey(e), e);

  const fetchedKeys = new Set(rows.map((r) => rowKey(r)));
  const toInsert = rows.filter((r) => !byKey.has(rowKey(r)));
  const toUpdate = rows.filter((r) => byKey.has(rowKey(r)));
  const goneUpstream = existing.filter((e) => !fetchedKeys.has(rowKey(e)));
  const attributedAtRisk = goneUpstream.filter((e) => e.alma_organization_id);

  return {
    existing,
    existingCount: existing.length,
    byKey,
    toInsert,
    toUpdate,
    goneUpstream,
    attributedAtRisk,
  };
}

/**
 * Field equality across the CSV/Postgres boundary.
 *
 * The naive String(a) === String(b) reports every row as changed, because amount_dollars
 * arrives from the CSV as the number 62621190 and comes back from Postgres numeric as the
 * string "62621190.00". That produced 23,713 pointless UPDATEs per run, which is how a fix
 * for silent data loss turns into an agent timeout.
 */
function sameValue(a, b) {
  const aNil = a === undefined || a === null || a === '';
  const bNil = b === undefined || b === null || b === '';
  if (aNil || bNil) return aNil && bNil;
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  }
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') {
    return an === bn;
  }
  return String(a) === String(b);
}

/** The patch needed to bring an existing row up to date, or {} if nothing changed. */
function changedFields(fetched, existingRow) {
  const patch = {};
  for (const f of SCRAPER_OWNED) {
    if (fetched[f] === undefined) continue;
    if (!sameValue(fetched[f], existingRow[f])) patch[f] = fetched[f];
  }
  return patch;
}

function logReconcile(r) {
  log(
    `  Reconcile: existing ${r.existingCount}, matched ${r.toUpdate.length}, new ${r.toInsert.length}, gone upstream ${r.goneUpstream.length}`,
  );
  if (r.attributedAtRisk.length > 0) {
    log(`  ${r.attributedAtRisk.length} of the rows gone upstream carry an organisation link:`);
    for (const e of r.attributedAtRisk.slice(0, 10)) {
      log(`      ${e.recipient_name} | ${e.link_basis || 'no basis'}`);
    }
    if (r.attributedAtRisk.length > 10) log(`      ... and ${r.attributedAtRisk.length - 10} more`);
  }
}

async function upsertContracts(contracts, abnToEntity) {
  log(`\nPhase 4: Upserting ${contracts.length} contracts into justice_funding...`);

  // Build justice_funding rows
  const rawRows = contracts.map((c) => {
    const entity = c.abn ? abnToEntity.get(c.abn) : null;

    const row = {
      source: SOURCE,
      source_url: c.resource_url || SOURCE_BASE_URL,
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

    // Content hash, computed from the row AFTER it is built so it uses exactly the same
    // fields, in the same shape, as rowKey() reads back off justice_funding.
    //
    // This used to be `dcyjma-{supplier}-{idx}`, where idx was the row's position in the
    // fetched batch. That is a position, not an identity: add or reorder one row upstream
    // and every id after it refers to a different contract. With no way to recognise a row
    // across runs, the scraper's only correct option was to delete everything and start
    // over, which is what destroyed attribution on every run.
    row.source_statement_id = `dcyjma-${rowKey(row)}`;
    return row;
  });
  let rows = dedupeInsertRows(rawRows);
  const removedAtInsertStage = rawRows.length - rows.length;
  if (removedAtInsertStage > 0) {
    log(
      `  Removed ${removedAtInsertStage} duplicate rows at final insert-key stage`,
    );
  }

  if (DRY_RUN) {
    log('  DRY RUN -- showing summary:');

    // Run the real reconciliation, read only. This is what LIVE will do, so a dry run is a
    // genuine rehearsal rather than a parse check. Healthy output against an already-current
    // mirror is: matched == existing, new 0, gone upstream 0.
    try {
      const rec = await reconcile(rows);
      logReconcile(rec);
      const fieldTally = {};
      const wouldChange = rec.toUpdate.filter((r) => {
        const patch = changedFields(r, rec.byKey.get(rowKey(r)));
        for (const f of Object.keys(patch)) fieldTally[f] = (fieldTally[f] || 0) + 1;
        return Object.keys(patch).length > 0;
      }).length;
      if (wouldChange > 0) {
        log(
          `    Fields driving updates: ${Object.entries(fieldTally)
            .sort((a, b) => b[1] - a[1])
            .map(([f, n]) => `${f}=${n}`)
            .join(', ')}`,
        );
      }
      log(`    Of the matched rows, ${wouldChange} would be updated and ${rec.toUpdate.length - wouldChange} left untouched.`);
      if (rec.attributedAtRisk.length > 0) {
        log('    LIVE WOULD REFUSE: rows carrying an organisation link are due for deletion.');
      }
    } catch (err) {
      log(`    Reconcile preview failed: ${err.message}`);
    }

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

    const { count: existingCount } = await supabase
      .from('justice_funding')
      .select('id', { count: 'exact', head: true })
      .eq('source', SOURCE);
    if (existingCount > 0 && rows.length < existingCount * MIN_RETAIN_RATIO) {
      log(
        `    Guardrail: live replace would be blocked because fetched rows (${rows.length}) are below ${Math.round(
          MIN_RETAIN_RATIO * 100,
        )}% of existing source rows (${existingCount}).`,
      );
    }

    return { inserted: 0, errors: 0, skipped: false, guardReason: null };
  }

  // Live mode: RECONCILE against what is already mirrored. Do not delete and re-insert.
  //
  // The old path deleted every row for this source and inserted fresh ones. That threw
  // away all attribution each run, because alma_organization_id, link_basis and linked_at
  // live on these rows and a new row has none. On 2026-07-30 it silently destroyed 800
  // rows and $124,683,339 of reviewed attribution, mid-session, while someone was working
  // on exactly that data. The MIN_RETAIN_RATIO guardrail did not fire because it counts
  // rows, and the row count was fine. It had no idea attribution existed.
  //
  // Now: rows still present upstream are UPDATED in place on the fields this scraper owns,
  // so their attribution survives. Rows genuinely gone upstream are deleted individually.
  // New rows are inserted.
  log('  Reading existing records to reconcile against...');
  const rec = await reconcile(rows);
  const { existingCount, byKey, toInsert, toUpdate, goneUpstream, attributedAtRisk } = rec;
  logReconcile(rec);

  if (existingCount > 0 && rows.length < existingCount * MIN_RETAIN_RATIO) {
    const guardReason = `Guardrail blocked live replace: fetched ${rows.length} rows, existing mirror has ${existingCount} rows`;
    log(`  ${guardReason}`);
    return { inserted: 0, errors: 0, skipped: true, guardReason };
  }

  // HARD STOP: never delete a row that carries attribution without a person saying so.
  //
  // MIN_RETAIN_RATIO counts rows, so it cannot see this. If upstream reformats any field in
  // the content key (the dates inside project_description are the obvious candidate), every
  // row looks new AND every existing row looks gone. The row count stays identical, the 0.8
  // ratio passes happily, and the result is the old delete-and-reinsert behaviour with all
  // attribution silently dropped. That is precisely the failure this rewrite exists to end,
  // and it would look like a successful run.
  if (attributedAtRisk.length > 0 && !ALLOW_ATTRIBUTED_DELETES) {
    const guardReason =
      `Refusing to continue: ${attributedAtRisk.length} rows due for deletion carry an organisation link. ` +
      `Either upstream genuinely dropped them, or a content-key field changed shape and the match broke. ` +
      `Inspect, then re-run with --allow-attributed-deletes if the deletions are real.`;
    log(`  ${guardReason}`);
    return { inserted: 0, errors: 0, skipped: true, guardReason };
  }

  // A large disappearance with no attribution attached is still worth a human look.
  const GONE_ALARM = Math.max(50, Math.floor(existingCount * 0.02));
  if (goneUpstream.length > GONE_ALARM && !ALLOW_ATTRIBUTED_DELETES) {
    const guardReason =
      `Refusing to continue: ${goneUpstream.length} rows look gone upstream, above the ${GONE_ALARM} alarm ` +
      `threshold. A content-key field changing shape looks exactly like this. Re-run with ` +
      `--allow-attributed-deletes to proceed.`;
    log(`  ${guardReason}`);
    return { inserted: 0, errors: 0, skipped: true, guardReason };
  }

  // Only write where something actually changed.
  //
  // A row matched by content hash has, by definition, identical content on every field in
  // the key. So the steady state is zero writes, and only the non-key owned fields
  // (source_url, sector, topics, gs_entity_id, the converging statement id) can differ.
  // Writing all 23,713 unconditionally would be tens of thousands of sequential updates
  // for no change, which is how an agent hits its timeout and gets called broken.
  // Batched, not one request per row.
  //
  // The mirror is currently missing gs_entity_id on 23,686 rows and topics on 23,671, so the
  // first run after this change legitimately updates nearly everything. At one HTTP request
  // per row that is over 20,000 sequential calls and a likely agent timeout. Upserting on the
  // primary key takes the ON CONFLICT UPDATE branch and touches only the columns provided.
  let updated = 0;
  let unchanged = 0;
  const patches = [];
  for (const r of toUpdate) {
    const target = byKey.get(rowKey(r));
    const patch = changedFields(r, target);
    if (Object.keys(patch).length === 0) {
      unchanged++;
      continue;
    }
    patches.push({ id: target.id, ...patch });
  }

  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('justice_funding').upsert(batch, { onConflict: 'id' });
    if (error) {
      log(`    Update batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
    } else {
      updated += batch.length;
    }
    if ((i + BATCH_SIZE) % 2000 === 0) log(`    Updated ${updated}/${patches.length}`);
  }
  log(`  Matched ${toUpdate.length}: ${unchanged} unchanged, ${updated} updated. Attribution preserved on all of them.`);

  // Individually, and only for rows the upstream source no longer publishes.
  let deleted = 0;
  for (let i = 0; i < goneUpstream.length; i += 100) {
    const ids = goneUpstream.slice(i, i + 100).map((e) => e.id);
    const { error } = await supabase.from('justice_funding').delete().in('id', ids);
    if (error) log(`    Delete error: ${error.message}`);
    else deleted += ids.length;
  }
  if (deleted) log(`  Deleted ${deleted} rows no longer published upstream`);

  rows = toInsert;

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
  return { inserted, errors, skipped: false, guardReason: null };
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
    const { inserted, errors, skipped, guardReason } = await upsertContracts(contracts, abnToEntity);

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
      if (skipped && guardReason) {
        log(`  Skipped update: ${guardReason}`);
      }
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
      status: skipped ? 'partial' : 'success',
      errors: skipped && guardReason ? [guardReason] : [],
    });
  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(supabase, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
