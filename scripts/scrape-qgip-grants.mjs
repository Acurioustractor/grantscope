#!/usr/bin/env node
/**
 * scrape-qgip-grants.mjs
 *
 * Scrapes QLD Government Investment Portal (QGIP) expenditure data —
 * actual grant payments with recipient names and amounts.
 *
 * Data source: https://www.data.qld.gov.au/dataset/queensland-government-investment-portal-expenditure-data-consolidated-view
 * CKAN API:    https://www.data.qld.gov.au/api/3/action/datastore_search
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qgip-grants.mjs           # dry-run (default)
 *   node --env-file=.env scripts/scrape-qgip-grants.mjs --live    # insert into DB
 *   node --env-file=.env scripts/scrape-qgip-grants.mjs --live --full   # full rescrape (not just delta)
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

// ── Config ────────────────────────────────────────────────

const AGENT_ID = 'scrape-qgip-grants';
const AGENT_NAME = 'QGIP Expenditure Scraper';

const CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';
const PACKAGE_ID = 'queensland-government-investment-portal-expenditure-data-consolidated-view';
const SOURCE = 'qgip';
const SOURCE_URL = 'https://www.data.qld.gov.au/dataset/queensland-government-investment-portal-expenditure-data-consolidated-view';

const LIVE = process.argv.includes('--live');
const FULL = process.argv.includes('--full');
const DRY_RUN = !LIVE;
const BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── psql helper ──────────────────────────────────────────

function psql(query) {
  const connStr = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  const tmpFile = `/tmp/qgip-${Date.now()}.sql`;
  writeFileSync(tmpFile, query);
  try {
    const result = execSync(
      `psql "${connStr}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    );
    unlinkSync(tmpFile);
    const lines = result.trim().split('\n').filter(l => l.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
        cur += ch;
      }
      vals.push(cur);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    log(`psql error: ${err.message}`);
    return [];
  }
}

// ── Topic classification ─────────────────────────────────

const TOPIC_PATTERNS = [
  { topic: 'youth-justice', pattern: /youth justice|juvenile|young offend|youth detention|youth diversion/i },
  { topic: 'child-protection', pattern: /child protect|child safety|foster|kinship|out.of.home/i },
  { topic: 'family-services', pattern: /family|parenting|domestic violence|DV|women.*shelter/i },
  { topic: 'indigenous', pattern: /indigenous|aboriginal|torres strait|first nations|closing the gap/i },
  { topic: 'legal-services', pattern: /legal|law|justice|court|tribunal|advocacy/i },
  { topic: 'diversion', pattern: /diversion|restorative|mediat|conferenc/i },
  { topic: 'prevention', pattern: /prevent|early interven|community safety|crime prevent/i },
  { topic: 'community-led', pattern: /community.led|community.based|grassroots|place.based/i },
  { topic: 'ndis', pattern: /ndis|disability|disab/i },
  { topic: 'wraparound', pattern: /wraparound|wrap.around|holistic|intensive support/i },
];

function classifyTopics(programName, recipientName, description) {
  const text = `${programName} ${recipientName} ${description || ''}`;
  return TOPIC_PATTERNS
    .filter(p => p.pattern.test(text))
    .map(p => p.topic);
}

function classifySector(programName, recipientName) {
  const text = `${programName} ${recipientName}`.toLowerCase();
  if (/youth justice|juvenile|detention|youth offend/.test(text)) return 'youth_justice';
  if (/child protect|child safety|foster/.test(text)) return 'child_protection';
  if (/family|domestic violence/.test(text)) return 'family_services';
  if (/legal|law|court/.test(text)) return 'legal_services';
  if (/disability|ndis/.test(text)) return 'disability';
  if (/health|mental health/.test(text)) return 'health';
  if (/education|school|training/.test(text)) return 'education';
  if (/housing|homelessness/.test(text)) return 'housing';
  return 'community_services';
}

// ── Phase 1: Discover CKAN resources ─────────────────────

async function discoverResources() {
  log('Phase 1: Discovering CKAN resources...');
  const res = await fetch(`${CKAN_BASE}/package_show?id=${PACKAGE_ID}`, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research)' },
  });
  if (!res.ok) throw new Error(`CKAN package_show failed: ${res.status}`);
  const pkg = await res.json();
  // Only active datastore CSV resources, deduplicate by FY (keep first/newest)
  const seenFY = new Set();
  const resources = pkg.result.resources.filter(r => {
    if (!r.datastore_active) return false;
    const fyMatch = (r.name || '').match(/(\d{4}-\d{2})/);
    if (!fyMatch) return false;
    if (seenFY.has(fyMatch[1])) return false;
    seenFY.add(fyMatch[1]);
    return true;
  });
  log(`  Found ${resources.length} datastore resources (${[...seenFY].sort().join(', ')})`);
  return resources;
}

// ── Phase 2: Fetch all records from a resource ───────────

async function fetchResourceRecords(resourceId, resourceName) {
  const records = [];
  let offset = 0;

  while (true) {
    const url = `${CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (research)' },
    });
    if (!res.ok) {
      log(`  Warning: fetch failed for ${resourceName} at offset ${offset}: ${res.status}`);
      break;
    }
    const data = await res.json();
    const batch = data.result?.records || [];
    records.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await delay(200); // Be polite
  }

  return records;
}

// ── Phase 3: Transform records ───────────────────────────

function parseAmount(val) {
  if (!val) return null;
  const s = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseFY(val) {
  if (!val) return null;
  const s = String(val).trim();
  // Handle "2020-21", "2020/21", "2020-2021"
  const m = s.match(/(\d{4})\s*[-\/]\s*(\d{2,4})/);
  if (m) {
    const end = m[2].length === 2 ? m[2] : m[2].slice(2);
    return `${m[1]}-${end}`;
  }
  // Handle just a year "2020"
  if (/^\d{4}$/.test(s)) {
    const yr = parseInt(s);
    return `${yr}-${String(yr + 1).slice(2)}`;
  }
  return s;
}

function transformRecord(rec, resourceFY) {
  // QGIP actual field names (from CKAN datastore)
  const recipientName = rec['Legal entity name'] || rec['Service provider name'] || '';
  const programName = rec['Program title'] || rec['Sub-program title'] || '';
  const amount = parseAmount(rec['Financial year expenditure']);
  const totalAgreement = parseAmount(rec['Total funding under this agreement to date']);
  const fy = resourceFY; // FY comes from the resource name, not the record
  const abn = rec['Australian Business Number (ABN)'] || null;
  const description = rec['Purpose'] || null;
  const location = rec['Service delivery suburb/locality'] || rec['Legal entity suburb/locality'] || null;
  const lga = rec['Service delivery LGA'] || rec['Legal entity LGA'] || null;
  const category = rec['Category1'] || null;
  const fundingAgency = rec['Funding agency'] || null;
  const subProgram = rec['Sub-program title'] || null;

  if (!recipientName && !programName) return null;
  // Skip zero/null expenditure
  if (!amount && amount !== 0) return null;

  const fullProgram = subProgram && subProgram !== programName
    ? `${programName} — ${subProgram}` : programName;
  const topics = classifyTopics(fullProgram, recipientName, `${description || ''} ${category || ''}`);

  return {
    source: SOURCE,
    source_url: SOURCE_URL,
    source_statement_id: `qgip-${rec._id}-${fy}`,
    recipient_name: recipientName.trim(),
    recipient_abn: abn ? String(abn).replace(/\s/g, '').padStart(11, '0') : null,
    program_name: fullProgram.trim(),
    amount_dollars: amount,
    financial_year: fy,
    state: 'QLD',
    location: [location, lga].filter(Boolean).join(', ') || null,
    sector: classifySector(fullProgram, recipientName),
    project_description: description?.trim() || null,
    topics: topics.length > 0 ? topics : null,
  };
}

// ── Phase 4: Match ABNs to entities ──────────────────────

async function matchEntities(records) {
  const abns = [...new Set(records.filter(r => r.recipient_abn).map(r => r.recipient_abn))];
  if (abns.length === 0) return records;

  log(`  Matching ${abns.length} ABNs to gs_entities...`);
  const abnList = abns.map(a => `'${a}'`).join(',');
  const matches = psql(`SELECT abn, id FROM gs_entities WHERE abn IN (${abnList})`);
  const abnToEntityId = {};
  for (const m of matches) {
    abnToEntityId[m.abn] = m.id;
  }
  log(`  Matched ${Object.keys(abnToEntityId).length}/${abns.length} ABNs`);

  return records.map(r => ({
    ...r,
    gs_entity_id: r.recipient_abn ? (abnToEntityId[r.recipient_abn] || null) : null,
  }));
}

// ── Phase 5: Upsert to justice_funding via psql ──────────
// PostgREST can't handle partial unique indexes (WHERE clause),
// so we use psql with ON CONFLICT on the partial index directly.

function escSql(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function upsertRecords(records) {
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const values = batch.map(r => {
      const topics = r.topics ? `ARRAY[${r.topics.map(t => `'${t}'`).join(',')}]::text[]` : 'NULL';
      return `(${escSql(r.source)}, ${escSql(r.source_url)}, ${escSql(r.source_statement_id)}, ${escSql(r.recipient_name)}, ${escSql(r.recipient_abn)}, ${escSql(r.program_name)}, ${r.amount_dollars ?? 'NULL'}, ${escSql(r.financial_year)}, ${escSql(r.state)}, ${escSql(r.location)}, ${escSql(r.sector)}, ${escSql(r.project_description)}, ${topics}, ${r.gs_entity_id ? escSql(r.gs_entity_id) : 'NULL'})`;
    }).join(',\n');

    const sql = `INSERT INTO justice_funding (source, source_url, source_statement_id, recipient_name, recipient_abn, program_name, amount_dollars, financial_year, state, location, sector, project_description, topics, gs_entity_id)
VALUES ${values}
ON CONFLICT (source, source_statement_id) WHERE source_statement_id IS NOT NULL
DO UPDATE SET
  recipient_name = EXCLUDED.recipient_name,
  amount_dollars = EXCLUDED.amount_dollars,
  program_name = EXCLUDED.program_name,
  location = EXCLUDED.location,
  sector = EXCLUDED.sector,
  project_description = EXCLUDED.project_description,
  topics = EXCLUDED.topics,
  gs_entity_id = COALESCE(EXCLUDED.gs_entity_id, justice_funding.gs_entity_id),
  updated_at = NOW()`;

    const result = psql(sql);
    // psql returns empty for successful INSERT
    inserted += batch.length;

    if (i % (BATCH_SIZE * 20) === 0 && i > 0) {
      log(`  Progress: ${i}/${records.length} upserted`);
    }
  }

  return { inserted, updated: 0 };
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  try {
    // Check existing count for delta detection
    const existing = psql(`SELECT COUNT(*)::int as cnt FROM justice_funding WHERE source = '${SOURCE}'`);
    const existingCount = parseInt(existing[0]?.cnt || '0');
    log(`Existing QGIP records: ${existingCount}`);

    // Phase 1: Discover resources
    const resources = await discoverResources();

    // Phase 2: Fetch all records (skip PDF data dictionary, only CSV datastore resources)
    let allRecords = [];
    for (const resource of resources) {
      if (!resource.datastore_active) continue; // skip PDFs
      const name = resource.name || resource.description || resource.id;
      // Extract FY from resource name like "2024-25 consolidated QGIP expenditure"
      const fyMatch = name.match(/(\d{4})-(\d{2})/);
      const fy = fyMatch ? `${fyMatch[1]}-${fyMatch[2]}` : null;
      if (!fy) { log(`  Skipping ${name} (no FY in name)`); continue; }

      log(`  Fetching: ${name} (FY ${fy})...`);
      const records = await fetchResourceRecords(resource.id, name);
      // Tag each record with the resource FY
      for (const r of records) r._resourceFY = fy;
      log(`    → ${records.length} records`);
      allRecords.push(...records);
      await delay(300);
    }
    log(`Total raw records: ${allRecords.length}`);

    // Phase 3: Transform
    const transformed = allRecords
      .map(r => transformRecord(r, r._resourceFY))
      .filter(r => r !== null);
    log(`Transformed records: ${transformed.length}`);

    // Deduplicate by source_statement_id
    const seen = new Set();
    const deduped = transformed.filter(r => {
      if (seen.has(r.source_statement_id)) return false;
      seen.add(r.source_statement_id);
      return true;
    });
    log(`After dedup: ${deduped.length} unique records`);

    if (DRY_RUN) {
      log('DRY RUN — showing sample records:');
      for (const r of deduped.slice(0, 15)) {
        log(`  ${r.program_name} → ${r.recipient_name} | ${r.amount_dollars ? '$' + r.amount_dollars.toLocaleString() : 'no amount'} | ${r.financial_year}`);
      }
      const withAmounts = deduped.filter(r => r.amount_dollars);
      const withAbns = deduped.filter(r => r.recipient_abn);
      log(`\nStats: ${deduped.length} total, ${withAmounts.length} with amounts, ${withAbns.length} with ABNs`);
      log(`New vs existing: ${deduped.length} scraped vs ${existingCount} in DB`);
      await logComplete(supabase, run.id, {
        items_found: deduped.length,
        items_new: Math.max(0, deduped.length - existingCount),
        status: 'dry_run',
      });
      return;
    }

    // Phase 4: Match entities
    const matched = await matchEntities(deduped);

    // Phase 5: Upsert
    log('Phase 5: Upserting to justice_funding...');
    const { inserted } = await upsertRecords(matched);
    const newCount = Math.max(0, deduped.length - existingCount);
    log(`Done: ${inserted} upserted (${newCount} estimated new)`);

    await logComplete(supabase, run.id, {
      items_found: deduped.length,
      items_new: newCount,
      items_updated: inserted - newCount,
      status: 'success',
    });

  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err.stack);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();
