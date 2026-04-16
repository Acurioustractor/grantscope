#!/usr/bin/env node
/**
 * scrape-grants-sa.mjs
 *
 * Ingests South Australia grants data from data.sa.gov.au CKAN portal.
 * 4 datasets (~1,064 records total, 2013-2018):
 *   - Grants SA 2016-17 (318 rows)
 *   - Grants SA 2017-18 (360 rows)
 *   - Multicultural Grants 2014-15 (185 rows)
 *   - Multicultural Grants 2013-14 (201 rows)
 *
 * No ABNs available — entity linking via name matching against gs_entities.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-grants-sa.mjs           # dry-run
 *   node --env-file=.env scripts/scrape-grants-sa.mjs --live    # insert into DB
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { psql } from './lib/psql.mjs';

// ── Config ────────────────────────────────────────────────

const AGENT_ID = 'scrape-grants-sa';
const AGENT_NAME = 'SA Grants Scraper';

const CKAN_BASE = 'https://data.sa.gov.au/data/api/3/action';
const SOURCE = 'sa-grants-portal';
const SOURCE_URL = 'https://data.sa.gov.au/data/dataset/';

const LIVE = process.argv.includes('--live');
const DRY_RUN = !LIVE;

// SA datasets with known resource IDs and field mappings
const DATASETS = [
  {
    name: 'Grants SA 2017-18',
    packageId: 'grants-sa-funded-projects-2017-2018',
    resourceId: '36f0af29-ef87-4793-a290-7061144e078f',
    fy: '2017-18',
    fields: {
      recipient: 'Organisation Name',
      project: 'Project Title',
      description: 'Project Description',
      region: 'Region',
      amount: 'Amount',
    },
  },
  {
    name: 'Grants SA 2016-17',
    packageId: 'grants-sa-funded-projects-2016-2017',
    resourceId: '0760d21e-8344-4462-b305-2f7f92f22f72',
    fy: '2016-17',
    fields: {
      recipient: 'Organisation Name',
      project: 'Project Title',
      description: 'Project Description',
      region: 'Region',
      amount: 'Amount',
    },
  },
  {
    name: 'Multicultural Grants 2014-15',
    packageId: 'multicultural-grants-2014-2015',
    resourceId: null, // discover at runtime
    fy: '2014-15',
    fields: {
      recipient: 'Organisation Name',
      project: 'Project Purpose',
      description: null,
      region: null,
      amount: 'Funded',
    },
  },
  {
    name: 'Multicultural Grants 2013-14',
    packageId: 'multicultural-grants-by-applicants-2013-2014',
    resourceId: null, // discover at runtime
    fy: '2013-14',
    fields: {
      recipient: 'Sponsor/Applicant Organisation',
      project: 'Project Name',
      description: null,
      region: 'Regions',
      amount: 'Grant in Dollars',
    },
  },
];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

const delay = ms => new Promise(r => setTimeout(r, ms));


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
  if (/multicultural|migrant|refugee|cald/.test(text)) return 'multicultural';
  if (/sport|recreation|arts|culture/.test(text)) return 'community_services';
  return 'community_services';
}

// ── Phase 1: Discover resource IDs for datasets without them ──

async function discoverResourceId(packageId) {
  const res = await fetch(`${CKAN_BASE}/package_show?id=${packageId}`, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research)' },
  });
  if (!res.ok) {
    log(`  Warning: package_show failed for ${packageId}: ${res.status}`);
    return null;
  }
  const pkg = await res.json();
  const csvResource = pkg.result.resources.find(r =>
    r.datastore_active || r.format?.toLowerCase() === 'csv'
  );
  return csvResource?.id || null;
}

// ── Phase 2: Fetch records from CKAN datastore ───────────

async function fetchRecords(resourceId, datasetName) {
  const records = [];
  let offset = 0;

  while (true) {
    const url = `${CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=1000&offset=${offset}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (research)' },
    });
    if (!res.ok) {
      log(`  Warning: fetch failed for ${datasetName} at offset ${offset}: ${res.status}`);
      break;
    }
    const data = await res.json();
    const batch = data.result?.records || [];
    records.push(...batch);

    if (batch.length < 1000) break;
    offset += 1000;
    await delay(300);
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

function transformRecord(rec, dataset) {
  const { fields, fy, packageId } = dataset;

  const recipientName = rec[fields.recipient] || '';
  const projectName = rec[fields.project] || '';
  const description = fields.description ? rec[fields.description] || null : null;
  const region = fields.region ? rec[fields.region] || null : null;
  const amount = parseAmount(rec[fields.amount]);

  if (!recipientName && !projectName) return null;
  if (amount === null) return null;

  const topics = classifyTopics(projectName, recipientName, description);

  return {
    source: SOURCE,
    source_url: `${SOURCE_URL}${packageId}`,
    source_statement_id: `sa-grants-${rec._id || ''}-${fy}`,
    recipient_name: recipientName.trim(),
    recipient_abn: null, // SA data has no ABNs
    program_name: projectName.trim(),
    amount_dollars: amount,
    financial_year: fy,
    state: 'SA',
    location: region?.trim() || null,
    sector: classifySector(projectName, recipientName),
    project_description: description?.trim() || null,
    topics: topics.length > 0 ? topics : null,
  };
}

// ── Phase 4: Match names to entities ─────────────────────

async function matchEntitiesByName(records) {
  const names = [...new Set(records.map(r => r.recipient_name).filter(Boolean))];
  if (names.length === 0) return records;

  log(`  Matching ${names.length} org names to gs_entities...`);

  // Batch name lookups — exact match on canonical_name (case-insensitive)
  const CHUNK = 200;
  const nameToEntityId = {};

  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    const nameList = chunk.map(n => `'${n.replace(/'/g, "''").toLowerCase()}'`).join(',');
    const matches = psql(`SELECT id, LOWER(canonical_name) as name FROM gs_entities WHERE LOWER(canonical_name) IN (${nameList})`);
    for (const m of matches) {
      nameToEntityId[m.name] = m.id;
    }
  }

  const matched = Object.keys(nameToEntityId).length;
  log(`  Matched ${matched}/${names.length} names (${(matched / names.length * 100).toFixed(1)}%)`);

  return records.map(r => ({
    ...r,
    gs_entity_id: nameToEntityId[r.recipient_name.toLowerCase()] || null,
  }));
}

// ── Phase 5: Upsert to justice_funding ───────────────────

function escSql(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function upsertRecords(records) {
  const BATCH_SIZE = 500;
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

    psql(sql);
    inserted += batch.length;
  }

  return { inserted };
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  try {
    // Check existing
    const existing = psql(`SELECT COUNT(*)::int as cnt FROM justice_funding WHERE source = '${SOURCE}'`);
    const existingCount = parseInt(existing[0]?.cnt || '0');
    log(`Existing SA grants records: ${existingCount}`);

    let allRecords = [];

    for (const dataset of DATASETS) {
      log(`\nFetching: ${dataset.name}...`);

      // Discover resource ID if needed
      let resourceId = dataset.resourceId;
      if (!resourceId) {
        resourceId = await discoverResourceId(dataset.packageId);
        if (!resourceId) {
          log(`  Skipping ${dataset.name} — no datastore resource found`);
          continue;
        }
        log(`  Discovered resource: ${resourceId}`);
      }

      // Fetch
      const raw = await fetchRecords(resourceId, dataset.name);
      log(`  Fetched ${raw.length} raw records`);

      // Transform
      const transformed = raw.map(r => transformRecord(r, dataset)).filter(Boolean);
      log(`  Transformed ${transformed.length} valid records`);
      allRecords.push(...transformed);

      await delay(500); // Be polite between datasets
    }

    log(`\nTotal records: ${allRecords.length}`);

    // Match entities by name
    allRecords = await matchEntitiesByName(allRecords);
    const linked = allRecords.filter(r => r.gs_entity_id).length;
    log(`Entity-linked: ${linked}/${allRecords.length} (${(linked / allRecords.length * 100).toFixed(1)}%)`);

    // Show sample
    log('\nSample records:');
    for (const r of allRecords.slice(0, 5)) {
      log(`  ${r.financial_year} | ${r.recipient_name.slice(0, 40)} | $${r.amount_dollars?.toLocaleString() || 'N/A'} | ${r.program_name.slice(0, 40)}`);
    }

    // Topic distribution
    const topicCounts = {};
    for (const r of allRecords) {
      for (const t of r.topics || []) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }
    if (Object.keys(topicCounts).length > 0) {
      log('\nTopic distribution:');
      for (const [t, c] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
        log(`  ${t}: ${c}`);
      }
    }

    if (DRY_RUN) {
      log(`\n[DRY RUN] Would upsert ${allRecords.length} records. Run with --live to insert.`);
      await logComplete(supabase, run.id, {
        items_found: allRecords.length,
        items_new: allRecords.length - existingCount,
        metadata: { dry_run: true, datasets: DATASETS.length, linked },
      });
    } else {
      log('\nUpserting records...');
      const result = await upsertRecords(allRecords);
      log(`Upserted ${result.inserted} records`);

      const newCount = psql(`SELECT COUNT(*)::int as cnt FROM justice_funding WHERE source = '${SOURCE}'`);
      const finalCount = parseInt(newCount[0]?.cnt || '0');
      log(`Final SA grants count: ${finalCount} (was ${existingCount})`);

      await logComplete(supabase, run.id, {
        items_found: allRecords.length,
        items_new: finalCount - existingCount,
        metadata: { datasets: DATASETS.length, linked, final_count: finalCount },
      });
    }
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err.stack);
    await logFailed(supabase, run.id, err.message);
    process.exit(1);
  }
}

main();
