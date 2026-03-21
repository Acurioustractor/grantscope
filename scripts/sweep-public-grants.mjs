#!/usr/bin/env node
/**
 * sweep-public-grants.mjs
 *
 * Sweep publicly available Australian grant data sources and ingest into gs_relationships.
 * Phase 1: Process downloaded datasets (Creative Australia, Queensland Arts, ACNC top givers)
 *
 * Usage:
 *   node --env-file=.env scripts/sweep-public-grants.mjs [--dry-run] [--source=creative-australia|qld-arts|acnc-givers|all]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import XLSX from 'xlsx';

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE = (process.argv.find(a => a.startsWith('--source='))?.split('=')[1]) || 'all';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stats = { total: 0, matched: 0, inserted: 0, skipped: 0, errors: 0 };

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Pre-loaded entity cache ────────────────────────────────────────
let entityCache = null; // Map<normalizedName, entity>

function normalize(name) {
  return name.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/, '')
    .replace(/\s+(inc\.?|ltd\.?|limited|incorporated|pty|pty ltd|co\.?|corporation|association|foundation|trust)$/i, '')
    .replace(/[.,]/g, '');
}

async function loadEntityCache() {
  if (entityCache) return;
  log('  Loading entity cache (paginated via REST)...');
  entityCache = new Map();
  let total = 0;
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name, abn')
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const e of data) {
      const norm = normalize(e.canonical_name);
      entityCache.set(norm, e);
      const short = norm.replace(/\s+(inc|ltd|limited|incorporated|pty|association|foundation|trust)$/, '');
      if (short !== norm) entityCache.set(short, e);
    }
    total += data.length;
    from += PAGE;
    if (total % 10000 === 0) log(`    Loaded ${total} entities...`);
    if (data.length < PAGE) break;
  }
  log(`  Entity cache: ${entityCache.size} index entries from ${total} entities`);
}

async function findEntity(name) {
  if (!name || name.length < 3) return null;
  await loadEntityCache();

  const norm = normalize(name);

  // Try exact cache match
  if (entityCache.has(norm)) return entityCache.get(norm);

  // Try without common suffixes
  const short = norm.replace(/\s+(inc|ltd|limited|incorporated|pty|association|foundation|trust)$/, '');
  if (entityCache.has(short)) return entityCache.get(short);

  // Try fuzzy with pg_trgm (only for names > 5 chars to avoid noise)
  if (name.length > 5) {
    const clean = name.trim().replace(/'/g, "''");
    const { data: trgm } = await db.rpc('exec_sql', {
      query: `SELECT id, gs_id, canonical_name, abn, similarity(canonical_name, '${clean}') as sim
              FROM gs_entities
              WHERE canonical_name % '${clean}'
              AND similarity(canonical_name, '${clean}') > 0.5
              ORDER BY sim DESC LIMIT 1`
    });
    if (trgm?.length > 0) return trgm[0];
  }

  return null;
}

// ─── Known funder entities ──────────────────────────────────────────
const KNOWN_FUNDERS = {
  'creative_australia': { abn: '38392626187', name: 'Creative Australia' },
  'arts_queensland': { search: ['Arts Queensland', 'Department of Education Queensland'] },
};

// ─── Insert/dedupe helpers ──────────────────────────────────────────
async function checkExisting(sourceId, targetId, dataset, year) {
  const q = db.from('gs_relationships')
    .select('id')
    .eq('source_entity_id', sourceId)
    .eq('target_entity_id', targetId)
    .eq('dataset', dataset);
  if (year) q.eq('year', year);
  const { data } = await q.limit(1);
  return data?.length > 0;
}

async function insertGrant({ sourceId, targetId, amount, year, dataset, properties, sourceRecordId }) {
  const row = {
    source_entity_id: sourceId,
    target_entity_id: targetId,
    relationship_type: 'grant',
    amount: amount || null,
    year: year || null,
    dataset,
    properties: properties || {},
    source_record_id: sourceRecordId || `${year || 'na'}`,
  };
  const { error } = await db.from('gs_relationships').insert(row);
  if (error) {
    if (stats.errors <= 3) log(`  INSERT ERROR: ${error.message} | ${error.code} | ${dataset} year=${year} src=${sourceRecordId}`);
    throw new Error(error.message);
  }
}

// ─── Source: Creative Australia ──────────────────────────────────────
async function processCreativeAustralia() {
  log('═══ Creative Australia (12,755 grants) ═══');

  const filePath = '/tmp/creative-australia-grants.xlsx';
  if (!existsSync(filePath)) {
    log('  ✗ File not found. Download first.');
    return;
  }

  const wb = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  log(`  Loaded ${data.length} grants`);

  // Creative Australia (ABN 38392626187)
  const { data: caRows } = await db.from('gs_entities').select('id, gs_id, canonical_name').eq('abn', '38392626187').limit(1);
  const caEntity = caRows?.[0];
  const caId = caEntity?.id;
  log(`  Funder entity: ${caId ? `${caEntity.canonical_name} (${caEntity.gs_id})` : 'NOT FOUND'}`);

  // Check existing
  const { data: existing } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'creative_australia'`
  });
  log(`  Existing creative_australia edges: ${existing?.[0]?.cnt || 0}`);

  const stateMap = {
    'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
    'Western Australia': 'WA', 'South Australia': 'SA', 'Tasmania': 'TAS',
    'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT',
  };

  // Aggregate by recipient + year
  const byRecipient = new Map();
  for (const row of data) {
    const name = row['Name - Individual or Organisation'];
    const amount = row['$ Investment'] || 0;
    const program = row['Panel / Program'] || '';
    const state = stateMap[row['State (or Country)']] || row['State (or Country)'] || '';
    let year = null;
    if (row['Closing Date'] && typeof row['Closing Date'] === 'number') {
      year = new Date((row['Closing Date'] - 25569) * 86400 * 1000).getFullYear();
    }
    if (!name) continue;

    const key = `${name}|${year || ''}`;
    if (!byRecipient.has(key)) {
      byRecipient.set(key, { name, state, year, totalAmount: 0, grants: 0, programs: new Set() });
    }
    const rec = byRecipient.get(key);
    rec.totalAmount += amount;
    rec.grants++;
    if (program) rec.programs.add(program);
  }
  log(`  Unique recipient-year combinations: ${byRecipient.size}`);

  // Process only orgs (skip individuals — they won't match gs_entities)
  let matched = 0, unmatched = 0, inserted = 0;
  const unmatchedOrgs = [];
  let processed = 0;

  for (const [, rec] of byRecipient) {
    processed++;
    if (processed % 500 === 0) log(`  Progress: ${processed}/${byRecipient.size}`);

    stats.total++;
    const entity = await findEntity(rec.name);

    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN && caId) {
        try {
          const exists = await checkExisting(caId, entity.id, 'creative_australia', rec.year);
          if (!exists) {
            await insertGrant({
              sourceId: caId, targetId: entity.id, amount: rec.totalAmount,
              year: rec.year, dataset: 'creative_australia',
              properties: { programs: [...rec.programs], grant_count: rec.grants, state: rec.state },
              sourceRecordId: `ca-${rec.year || 'na'}-${rec.name.substring(0, 50)}`,
            });
            inserted++;
            stats.inserted++;
          } else { stats.skipped++; }
        } catch (e) {
          stats.errors++;
          if (stats.errors <= 5) log(`  Error: ${rec.name} → ${e.message}`);
        }
      }
    } else {
      unmatched++;
      if (rec.totalAmount > 50000) unmatchedOrgs.push({ name: rec.name, amount: rec.totalAmount });
    }
  }

  log(`  Matched: ${matched} | Unmatched: ${unmatched} | Inserted: ${inserted}`);
  if (unmatchedOrgs.length > 0) {
    unmatchedOrgs.sort((a, b) => b.amount - a.amount);
    log(`  Top unmatched orgs (>$50K):`);
    unmatchedOrgs.slice(0, 15).forEach(u => log(`    $${(u.amount / 1000).toFixed(0)}K | ${u.name}`));
  }
}

// ─── Source: Queensland Arts ────────────────────────────────────────
async function processQldArts() {
  log('═══ Queensland Arts Grants (2011-2019) ═══');

  const files = [
    { path: '/tmp/arts-grants-expenditure-2018-19.csv', year: 2018 },
    { path: '/tmp/arts-grants-expenditure-2017-18.csv', year: 2017 },
    { path: '/tmp/arts-grants-expenditure-2016-17.csv', year: 2016 },
    { path: '/tmp/arts-grants-expenditure-2014-15.csv', year: 2014 },
    { path: '/tmp/arts-grants-expenditure-2012-13.csv', year: 2012 },
    { path: '/tmp/arts-grants-expenditure-2011-12.csv', year: 2011 },
  ];

  let aqEntity = await findEntity('Arts Queensland');
  if (!aqEntity) aqEntity = await findEntity('Department of Education Queensland');
  const aqId = aqEntity?.id;
  log(`  Funder entity: ${aqId ? aqEntity.canonical_name : 'NOT FOUND'}`);

  let totalRows = 0, matched = 0, inserted = 0;

  for (const { path: filePath, year } of files) {
    if (!existsSync(filePath)) { log(`  ✗ Missing: ${filePath}`); continue; }

    const csv = readFileSync(filePath, 'utf8');
    const lines = csv.split('\n').filter(l => l.trim());
    log(`  ${filePath.split('/').pop()}: ${lines.length - 1} rows`);

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].match(/(?:"[^"]*"|[^,]*)(?:,|$)/g) || [];
      const cleanField = (idx) => (parts[idx] || '').replace(/^"|"$/g, '').replace(/,$/g, '').trim();

      const amount = parseFloat(cleanField(0).replace(/[$,]/g, '')) || 0;
      const program = cleanField(1);
      const name = cleanField(2);

      if (!name || name.length < 3) continue;
      totalRows++;
      stats.total++;

      const entity = await findEntity(name);
      if (entity) {
        matched++;
        stats.matched++;

        if (!DRY_RUN && aqId) {
          try {
            const exists = await checkExisting(aqId, entity.id, 'qld_arts_grants', year);
            if (!exists) {
              await insertGrant({
                sourceId: aqId, targetId: entity.id, amount,
                year, dataset: 'qld_arts_grants', properties: { program },
                sourceRecordId: `qld-${year}-${name.substring(0, 50)}`,
              });
              inserted++;
              stats.inserted++;
            } else { stats.skipped++; }
          } catch (e) { stats.errors++; }
        }
      }
    }
  }
  log(`  Total rows: ${totalRows} | Matched: ${matched} | Inserted: ${inserted}`);
}

// ─── Source: ACNC Top Givers Analysis ───────────────────────────────
async function processAcncTopGivers() {
  log('═══ ACNC Top Grant-Making Charities (analysis only) ═══');

  const filePath = '/tmp/acnc-2023-ais.csv';
  if (!existsSync(filePath)) { log('  ✗ File not found'); return; }

  const csv = readFileSync(filePath, 'utf8');
  const lines = csv.split('\n');

  const topGivers = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const parts = lines[i].match(/(?:"[^"]*"|[^,]*)(?:,|$)/g) || [];
    const abn = (parts[0] || '').replace(/[\",]/g, '').trim();
    const name = (parts[1] || '').replace(/[\",]/g, '').trim();
    const grant = parseFloat((parts[43] || '').replace(/[\",]/g, '')) || 0;
    if (grant > 1000000) topGivers.push({ abn, name, grant });
  }

  topGivers.sort((a, b) => b.grant - a.grant);
  log(`  Charities giving >$1M: ${topGivers.length}`);
  log(`  Total given: $${(topGivers.reduce((s, g) => s + g.grant, 0) / 1e9).toFixed(2)}B`);

  // Check how many in foundations table
  let inFoundations = 0, notInFoundations = [];
  for (const g of topGivers.slice(0, 100)) {
    const { data } = await db.from('foundations').select('name').eq('acnc_abn', g.abn).limit(1);
    if (data?.length) { inFoundations++; }
    else {
      const isUni = /university|monash|deakin|anu|unsw|uq|curtin|griffith|rmit|swinburne|uts/i.test(g.name);
      const isGov = /legal aid|commission|authority|government|council/i.test(g.name);
      const isPHN = /primary health|primary healthcare/i.test(g.name);
      if (!isUni && !isGov && !isPHN) {
        notInFoundations.push(g);
      }
    }
  }
  log(`  Top 100 givers in foundations table: ${inFoundations}`);
  log(`  Notable missing (non-uni, non-gov):`);
  notInFoundations.slice(0, 20).forEach(g =>
    log(`    $${(g.grant / 1e6).toFixed(1)}M | ${g.abn} | ${g.name}`)
  );
}

// ─── Source: NHMRC Medical Research Grants ──────────────────────────
async function processNhmrc() {
  log('═══ NHMRC Medical Research Grants (2013-2025) ═══');

  const files = [
    '/tmp/nhmrc/Summary-of-result-2025-app-round-22122025.xlsx',
    '/tmp/nhmrc/Summary-of-result-2024-app-round-100725.xlsx',
    '/tmp/nhmrc/Summary-of-result-2023-app-round-15122023.xlsx',
    '/tmp/nhmrc/1-summary_of_results_2022_app_round_24022023%20%281%29.xlsx',
    '/tmp/nhmrc/1.summary_of_results_2021_app_round_020222_1.xlsx',
    '/tmp/nhmrc/1.summary_of_results_2020_app_round_110221.xlsx',
    '/tmp/nhmrc/summary-of-results-2019-appround-07122019.xlsx',
    '/tmp/nhmrc/summary-of-results-2018-app-round-181212.xlsx',
    '/tmp/nhmrc/2017-application-round.xlsx',
    '/tmp/nhmrc/2016-application-round.xlsx',
    '/tmp/nhmrc/2015-application-round.xlsx',
    '/tmp/nhmrc/2014-application-round.xlsx',
    '/tmp/nhmrc/2013-application-round.xlsx',
  ];

  // Find NHMRC entity
  const { data: nhmrcRows } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%national health and medical research%')
    .limit(1);
  const nhmrcId = nhmrcRows?.[0]?.id;
  log(`  Funder entity: ${nhmrcId ? nhmrcRows[0].canonical_name : 'NOT FOUND'}`);

  // Check existing
  const { data: existing } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'nhmrc_grants'`
  });
  log(`  Existing nhmrc_grants edges: ${existing?.[0]?.cnt || 0}`);

  let totalGrants = 0, matched = 0, inserted = 0;
  await loadEntityCache();

  for (const filePath of files) {
    const decoded = decodeURIComponent(filePath);
    if (!existsSync(decoded) && !existsSync(filePath)) {
      log(`  ✗ Missing: ${filePath.split('/').pop()}`);
      continue;
    }
    const actualPath = existsSync(decoded) ? decoded : filePath;

    let wb;
    try { wb = XLSX.readFile(actualPath); } catch (e) { log(`  ✗ Cannot read: ${e.message}`); continue; }

    // Find the grants data sheet
    const grantSheet = wb.SheetNames.find(s =>
      /grants?\s*data|funded\s*grants|successful/i.test(s)
    ) || wb.SheetNames.find(s => /summary/i.test(s) && !/outcome/i.test(s));

    if (!grantSheet) {
      log(`  ✗ No grants sheet found in ${filePath.split('/').pop()}. Sheets: ${wb.SheetNames.join(', ')}`);
      continue;
    }

    const data = XLSX.utils.sheet_to_json(wb.Sheets[grantSheet]);
    log(`  ${filePath.split('/').pop()}: ${data.length} rows (sheet: ${grantSheet})`);

    for (const row of data) {
      // Find admin institution column (varies by year)
      const org = row['Administering Institution'] || row['Admin Institution'] ||
                  row['Administering_Institution'] || row['Institution'] || '';
      const amount = row['Total amount awarded'] || row['Total Budget'] ||
                     row['Grant Amount'] || row['Total Funding'] || 0;
      const year = row['Application Year'] || row['Year'] || row['Funding Year'];
      const scheme = row['Funding Scheme'] || row['Grant Type'] || row['Scheme'] || '';
      const title = row['Grant Title'] || row['Title'] || '';

      if (!org || typeof org !== 'string' || org.length < 3) continue;
      totalGrants++;
      stats.total++;

      const entity = await findEntity(org);
      if (entity) {
        matched++;
        stats.matched++;

        if (!DRY_RUN && nhmrcId) {
          try {
            await insertGrant({
              sourceId: nhmrcId, targetId: entity.id,
              amount: typeof amount === 'number' ? amount : 0,
              year, dataset: 'nhmrc_grants',
              properties: { scheme, title: title.substring(0, 200) },
              sourceRecordId: `nhmrc-${row['Application ID'] || `${year}-${org.substring(0, 30)}-${title.substring(0, 30)}`}`,
            });
            inserted++;
            stats.inserted++;
          } catch (e) { stats.skipped++; /* dupe via unique constraint */ }
        }
      }
    }
  }
  log(`  Total grants: ${totalGrants} | Matched: ${matched} | Inserted: ${inserted}`);
}

// ─── Source: ARC Research Grants ────────────────────────────────────
async function processArc() {
  log('═══ ARC Research Grants (34K+) ═══');

  const filePath = 'tmp/arc-grants.json';
  if (!existsSync(filePath)) { log('  ✗ File not found. Run download-arc-grants.mjs first.'); return; }

  const { grants } = JSON.parse(readFileSync(filePath, 'utf8'));
  log(`  Loaded ${grants.length} grants`);

  // Find ARC entity
  const { data: arcRows } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%australian research council%')
    .limit(1);
  const arcId = arcRows?.[0]?.id;
  log(`  Funder entity: ${arcId ? arcRows[0].canonical_name : 'NOT FOUND'}`);

  const { data: existing } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'arc_grants'`
  });
  log(`  Existing arc_grants edges: ${existing?.[0]?.cnt || 0}`);

  await loadEntityCache();

  // Aggregate by org + year (many grants per uni per year)
  const byOrgYear = new Map();
  for (const g of grants) {
    const key = `${g.org}|${g.year}`;
    if (!byOrgYear.has(key)) {
      byOrgYear.set(key, { org: g.org, year: g.year, totalAmount: 0, count: 0, schemes: new Set() });
    }
    const rec = byOrgYear.get(key);
    rec.totalAmount += g.amount || 0;
    rec.count++;
    if (g.scheme) rec.schemes.add(g.scheme);
  }
  log(`  Unique org-year combinations: ${byOrgYear.size}`);

  let matched = 0, inserted = 0;
  let processed = 0;

  for (const [, rec] of byOrgYear) {
    processed++;
    if (processed % 200 === 0) log(`  Progress: ${processed}/${byOrgYear.size}`);

    stats.total++;
    const entity = await findEntity(rec.org);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN && arcId) {
        try {
          const exists = await checkExisting(arcId, entity.id, 'arc_grants', rec.year);
          if (!exists) {
            await insertGrant({
              sourceId: arcId, targetId: entity.id, amount: rec.totalAmount,
              year: rec.year, dataset: 'arc_grants',
              properties: { schemes: [...rec.schemes], grant_count: rec.count },
              sourceRecordId: `arc-${rec.year}-${rec.org.substring(0, 50)}`,
            });
            inserted++;
            stats.inserted++;
          } else { stats.skipped++; }
        } catch (e) { stats.errors++; }
      }
    }
  }
  log(`  Matched: ${matched}/${byOrgYear.size} | Inserted: ${inserted}`);
}

// ─── Source: Helen Macpherson Smith Trust ────────────────────────────
async function processHmsTrust() {
  log('═══ Helen Macpherson Smith Trust (4,900+ grants since 1955) ═══');

  const filePath = '/tmp/hms-trust-grants.csv';
  if (!existsSync(filePath)) { log('  ✗ CSV not found. Download from hmstrust.org.au first.'); return; }

  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  log(`  Columns: ${header.join(', ')}`);

  // Parse CSV properly (handle quoted fields with commas)
  function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue; }
      if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += line[i];
    }
    fields.push(current.trim());
    return fields;
  }

  // Find HMS Trust entity
  const { data: hmsEntity } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%helen macpherson smith%')
    .limit(1);

  let hmsId = hmsEntity?.[0]?.id;
  if (!hmsId) {
    // Try broader search
    const { data: hms2 } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name')
      .ilike('canonical_name', '%macpherson smith%')
      .limit(1);
    hmsId = hms2?.[0]?.id;
  }
  if (!hmsId) { log('  ✗ Cannot find HMS Trust entity. Skipping.'); return; }
  log(`  Funder entity: ${hmsEntity?.[0]?.canonical_name || 'HMS Trust'} (${hmsEntity?.[0]?.gs_id || '?'})`);

  const { data: existingCount } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'hms_trust_grants'`
  });
  log(`  Existing hms_trust_grants edges: ${existingCount?.[0]?.cnt || 0}`);

  await loadEntityCache();

  let total = 0, matched = 0, inserted = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 3) continue;

    const orgName = fields[0]; // Organization Name
    const projectTitle = fields[1]; // Project Title
    const amountStr = fields[2]; // Grant Amount
    const subject = fields[3] || ''; // Subject (CLASSIE)
    const fiscalYear = fields[4]; // Fiscal Year
    const purpose = fields[5] || ''; // Funding Purpose

    if (!orgName || orgName.length < 3) continue;
    total++;
    stats.total++;

    const amount = parseInt(amountStr?.replace(/[^0-9]/g, '')) || 0;
    const year = parseInt(fiscalYear) || null;

    const entity = await findEntity(orgName);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN) {
        try {
          await insertGrant({
            sourceId: hmsId, targetId: entity.id,
            amount, year, dataset: 'hms_trust_grants',
            properties: {
              project: projectTitle?.substring(0, 200) || '',
              subject: subject?.substring(0, 100) || '',
              purpose: purpose?.substring(0, 300) || '',
            },
            sourceRecordId: `hms-${year || 'na'}-${orgName.substring(0, 40)}-${(projectTitle || '').substring(0, 30)}`,
          });
          inserted++;
          stats.inserted++;
        } catch (e) { stats.skipped++; /* dupe via unique constraint */ }
      }
    }

    if (total % 500 === 0) log(`  Progress: ${total}/${lines.length - 1} | Matched: ${matched}`);
  }
  log(`  Total: ${total} | Matched: ${matched} (${total ? ((matched/total)*100).toFixed(1) : 0}%) | Inserted: ${inserted}`);
}

// ─── Source: Lotterywest (WA) ────────────────────────────────────────
async function processLotterywest() {
  log('═══ Lotterywest WA Grants ($169M, 512 grants) ═══');

  const filePath = '/tmp/lotterywest-grants.json';
  if (!existsSync(filePath)) { log('  ✗ JSON not found. Download from Lotterywest API first.'); return; }

  const { grants } = JSON.parse(readFileSync(filePath, 'utf8'));
  log(`  Loaded ${grants.length} grants`);

  // Find Lotterywest entity
  const { data: lwEntity } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%lotterywest%')
    .limit(1);

  let lwId = lwEntity?.[0]?.id;
  if (!lwId) {
    // Try Lotteries Commission
    const { data: lw2 } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name')
      .ilike('canonical_name', '%lotteries commission%western%')
      .limit(1);
    lwId = lw2?.[0]?.id;
  }
  if (!lwId) { log('  ✗ Cannot find Lotterywest entity. Skipping.'); return; }
  log(`  Funder entity: ${lwEntity?.[0]?.canonical_name || 'Lotterywest'}`);

  const { data: existingCount } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'lotterywest_grants'`
  });
  log(`  Existing lotterywest_grants edges: ${existingCount?.[0]?.cnt || 0}`);

  await loadEntityCache();

  let total = 0, matched = 0, inserted = 0;

  for (const g of grants) {
    const orgName = g.organisation;
    if (!orgName || orgName.length < 3) continue;
    total++;
    stats.total++;

    const amount = parseInt(g.amount?.replace(/[^0-9]/g, '')) || 0;
    // Amount is in cents (has .00), convert
    const amountDollars = Math.round(amount / 100);
    const dateParts = g.date?.match(/(\d+)-(\w+)-(\d+)/);
    const year = dateParts ? parseInt(dateParts[3]) : null;

    const entity = await findEntity(orgName);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN) {
        try {
          await insertGrant({
            sourceId: lwId, targetId: entity.id,
            amount: amountDollars, year, dataset: 'lotterywest_grants',
            properties: {
              purpose: (g.purpose || '').substring(0, 300),
              location: g.location || '',
            },
            sourceRecordId: `lw-${g.date}-${orgName.substring(0, 50)}`,
          });
          inserted++;
          stats.inserted++;
        } catch (e) { stats.skipped++; }
      }
    }

    if (total % 100 === 0) log(`  Progress: ${total}/${grants.length} | Matched: ${matched}`);
  }

  log(`  Total: ${total} | Matched: ${matched} (${total ? ((matched/total)*100).toFixed(1) : 0}%) | Inserted: ${inserted}`);
}

// ─── Source: FRRR (Foundation for Rural & Regional Renewal) ─────────
async function processFrrr() {
  log('═══ FRRR Grants (5,500+ grants, 2015-2026) ═══');

  const filePath = '/tmp/frrr-grants.json';
  if (!existsSync(filePath)) { log('  ✗ JSON not found. Run scripts/scrape-frrr-grants.mjs first.'); return; }

  const { grants } = JSON.parse(readFileSync(filePath, 'utf8'));
  log(`  Loaded ${grants.length} grants`);

  // Find FRRR entity
  const { data: frrrEntity } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%foundation for rural and regional renewal%')
    .limit(1);

  const frrrId = frrrEntity?.[0]?.id;
  if (!frrrId) { log('  ✗ Cannot find FRRR entity. Skipping.'); return; }
  log(`  Funder entity: ${frrrEntity[0].canonical_name}`);

  const { data: existingCount } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'frrr_grants'`
  });
  log(`  Existing frrr_grants edges: ${existingCount?.[0]?.cnt || 0}`);

  await loadEntityCache();

  let total = 0, matched = 0, inserted = 0;

  for (const g of grants) {
    const orgName = g.organisation;
    if (!orgName || orgName.length < 3) continue;
    total++;
    stats.total++;

    const year = g.post_date ? parseInt(g.post_date.substring(0, 4)) : null;

    const entity = await findEntity(orgName);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN) {
        try {
          await insertGrant({
            sourceId: frrrId, targetId: entity.id,
            amount: g.amount || null, year, dataset: 'frrr_grants',
            properties: {
              project: (g.project || '').substring(0, 300),
              location: g.location || '',
              program: (g.post_title || '').substring(0, 200),
            },
            sourceRecordId: `frrr-${year || 'na'}-${orgName.substring(0, 50)}`,
          });
          inserted++;
          stats.inserted++;
        } catch (e) { stats.skipped++; }
      }
    }

    if (total % 500 === 0) log(`  Progress: ${total}/${grants.length} | Matched: ${matched}`);
  }

  log(`  Total: ${total} | Matched: ${matched} (${total ? ((matched/total)*100).toFixed(1) : 0}%) | Inserted: ${inserted}`);
}

// ─── Source: William Buckland Foundation ─────────────────────────────
async function processWilliamBuckland() {
  log('═══ William Buckland Foundation Grants (2020-2022) ═══');

  const filePath = '/tmp/wbf-grants.json';
  if (!existsSync(filePath)) { log('  ✗ JSON not found. Create from PDF extraction first.'); return; }

  const { grants } = JSON.parse(readFileSync(filePath, 'utf8'));
  log(`  Loaded ${grants.length} grants`);

  const { data: wbfEntity } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .eq('abn', '23196005019')
    .limit(1);

  const wbfId = wbfEntity?.[0]?.id;
  if (!wbfId) { log('  ✗ Cannot find William Buckland Foundation entity. Skipping.'); return; }
  log(`  Funder entity: ${wbfEntity[0].canonical_name}`);

  const { data: existingCount } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'wbf_grants'`
  });
  log(`  Existing wbf_grants edges: ${existingCount?.[0]?.cnt || 0}`);

  await loadEntityCache();

  let total = 0, matched = 0, inserted = 0;

  for (const g of grants) {
    const orgName = g.organisation;
    if (!orgName || orgName.length < 3) continue;
    total++;
    stats.total++;

    const entity = await findEntity(orgName);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN) {
        try {
          await insertGrant({
            sourceId: wbfId, targetId: entity.id,
            amount: g.amount || null, year: g.year, dataset: 'wbf_grants',
            properties: {
              project: (g.project || '').substring(0, 300),
              program: g.program || '',
            },
            sourceRecordId: `wbf-${g.year}-${orgName.substring(0, 50)}`,
          });
          inserted++;
          stats.inserted++;
        } catch (e) { stats.skipped++; }
      }
    }
  }

  log(`  Total: ${total} | Matched: ${matched} (${total ? ((matched/total)*100).toFixed(1) : 0}%) | Inserted: ${inserted}`);
}

// ─── Source: Westpac Group Foundations ────────────────────────────────
async function processWestpac() {
  log('═══ Westpac Group Foundations 2024 (85 recipients) ═══');

  const filePath = '/tmp/westpac-grants.json';
  if (!existsSync(filePath)) { log('  ✗ JSON not found.'); return; }

  const { grants } = JSON.parse(readFileSync(filePath, 'utf8'));
  log(`  Loaded ${grants.length} grants`);

  // Find Westpac Community Trust entity (ABN 53265036982) — the actual grant-making arm
  const { data: wpEntity } = await db.from('gs_entities')
    .select('id, gs_id, canonical_name')
    .ilike('canonical_name', '%westpac community trust%')
    .limit(1);

  let wpId = wpEntity?.[0]?.id;
  if (!wpId) { log('  ✗ Cannot find Westpac Community Trust entity. Skipping.'); return; }
  log(`  Funder entity: ${wpEntity?.[0]?.canonical_name}`);

  const { data: existingCount } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM gs_relationships WHERE dataset = 'westpac_foundation_grants'`
  });
  log(`  Existing westpac_foundation_grants edges: ${existingCount?.[0]?.cnt || 0}`);

  await loadEntityCache();

  let total = 0, matched = 0, inserted = 0;

  for (const g of grants) {
    const orgName = g.organisation;
    if (!orgName || orgName.length < 3) continue;
    total++;
    stats.total++;

    const entity = await findEntity(orgName);
    if (entity) {
      matched++;
      stats.matched++;

      if (!DRY_RUN) {
        try {
          await insertGrant({
            sourceId: wpId, targetId: entity.id,
            amount: null, year: g.year, dataset: 'westpac_foundation_grants',
            properties: {
              program: g.program || '',
              foundation: g.foundation || '',
            },
            sourceRecordId: `wp-${g.year}-${orgName.substring(0, 50)}`,
          });
          inserted++;
          stats.inserted++;
        } catch (e) { stats.skipped++; }
      }
    }
  }

  log(`  Total: ${total} | Matched: ${matched} (${total ? ((matched/total)*100).toFixed(1) : 0}%) | Inserted: ${inserted}`);
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  log(`╔══════════════════════════════════════════════════╗`);
  log(`║  Public Grants Data Sweep                       ║`);
  log(`║  ${DRY_RUN ? 'DRY RUN — no database writes' : 'LIVE — writing to database'}                   ║`);
  log(`╚══════════════════════════════════════════════════╝`);

  if (SOURCE === 'all' || SOURCE === 'creative-australia') await processCreativeAustralia();
  if (SOURCE === 'all' || SOURCE === 'qld-arts') await processQldArts();
  if (SOURCE === 'all' || SOURCE === 'nhmrc') await processNhmrc();
  if (SOURCE === 'all' || SOURCE === 'arc') await processArc();
  if (SOURCE === 'all' || SOURCE === 'acnc-givers') await processAcncTopGivers();
  if (SOURCE === 'all' || SOURCE === 'hms-trust') await processHmsTrust();
  if (SOURCE === 'all' || SOURCE === 'lotterywest') await processLotterywest();
  if (SOURCE === 'all' || SOURCE === 'frrr') await processFrrr();
  if (SOURCE === 'all' || SOURCE === 'wbf') await processWilliamBuckland();
  if (SOURCE === 'all' || SOURCE === 'westpac') await processWestpac();

  log(`═══ Summary ═══`);
  log(`  Total records: ${stats.total}`);
  log(`  Entity matches: ${stats.matched} (${stats.total ? ((stats.matched / stats.total) * 100).toFixed(1) : 0}%)`);
  log(`  Inserted: ${stats.inserted}`);
  log(`  Skipped (dupes): ${stats.skipped}`);
  log(`  Errors: ${stats.errors}`);
}

main().catch(console.error);
