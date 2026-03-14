#!/usr/bin/env node
/**
 * Import NSW BOCSAR LGA Crime Statistics
 *
 * Downloads and imports per-LGA crime statistics from BOCSAR (Bureau of Crime
 * Statistics and Research). 10-year time series of incident counts and rates
 * per 100,000 population across 60+ offence types for each NSW LGA.
 *
 * Source: https://bocsar.nsw.gov.au/statistics-dashboards/crime-and-policing/lga-excel-crime-tables.html
 *
 * Usage:
 *   node --env-file=.env scripts/import-bocsar-crime.mjs [--apply] [--download]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import XLSX from 'xlsx';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DOWNLOAD = process.argv.includes('--download');
const DATA_DIR = 'data/bocsar/lga';
const BASE_URL = 'https://bocsar.nsw.gov.au/content/dam/dcj/bocsar/documents/publications/lga';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const DELAY_MS = 300;

// BOCSAR LGA names (PascalCase, no spaces) — mapped from postcode_geo lga_name
// This list covers all 128 NSW LGAs on the BOCSAR site
const LGA_NAMES = [
  'Albury', 'ArmidaleDumaresq', 'Armidale', 'Ballina', 'Balranald', 'Bathurst', 'Bayside',
  'BegaValley', 'Bellingen', 'Berrigan', 'Blacktown', 'BlayneyShire', 'Bland', 'Bogan',
  'Bourke', 'BrewarrinaShire', 'BrokenHill', 'Burwood', 'Byron', 'Cabonne',
  'Camden', 'Campbelltown', 'CanadaBay', 'CanterburyBankstown', 'Carrathool',
  'CentralCoast', 'CentralDarlingShire', 'Cessnock', 'CityOfParramatta',
  'CityOfSydney', 'Clarence Valley', 'ClarenceValley', 'Coffs Harbour', 'CoffsHarbour',
  'Coolamon', 'Coonamble', 'Cowra', 'Cumberland',
  'Dubbo', 'DubboRegional', 'Dungog', 'EdwardRiver',
  'Eurobodalla', 'Fairfield', 'FederationShire', 'Forbes', 'GeorgesRiver',
  'Gilgandra', 'GlenInnes', 'Goulburn', 'GoulburnMulwaree',
  'GreaterHume', 'Griffith', 'Gunnedah', 'Gwydir',
  'Hawkesbury', 'HayShire', 'Hilltops', 'HornsbyShire', 'Hornsby',
  'HuntersHill', 'InnerWest', 'Inverell',
  'Junee', 'Kempsey', 'KuRingGai', 'Kyogle',
  'LachlanShire', 'LakeHaven', 'LakeMacquarie', 'Lane Cove', 'LaneCove', 'Leeton',
  'Lismore', 'Lithgow', 'Liverpool', 'LiverpoolPlains', 'Lockhart',
  'MaitlandCity', 'Maitland', 'MidCoast', 'MidWesternRegional',
  'Moree', 'MoreePlains', 'Mosman', 'Murray', 'MurrayRiver',
  'Murrumbidgee', 'Muswellbrook',
  'Nambucca', 'Narrabri', 'Narrandera', 'Narromine',
  'Newcastle', 'NorthernBeaches', 'NorthSydney', 'Oberon',
  'OrangeCity', 'Orange', 'Parkes', 'Penrith',
  'PortMacquarie', 'PortMacquarieHastings', 'PortStephens',
  'Queanbeyan', 'QueanbeyanPalerang', 'Randwick',
  'RichmondValley', 'Ryde',
  'Shellharbour', 'Shoalhaven', 'Singleton', 'SnowMonaro', 'SnowValleys', 'SnowMonaro',
  'Strathfield', 'Sutherland', 'SutherlandShire',
  'TamworthRegional', 'Temora', 'Tenterfield', 'TheHills', 'Tweed',
  'UpperHunter', 'UpperLachlan', 'Uralla',
  'Wagga', 'WaggaWagga', 'Walcha', 'Walgett', 'Warren', 'Warrumbungle',
  'Waverley', 'Weddin', 'Wentworth', 'Willoughby', 'Wingecarribee',
  'Wollondilly', 'Wollongong', 'Woollahra',
  'Yass', 'YassValley',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseOffenceSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Summary of offences'];
  if (!ws) return null;

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Find LGA name (row 4 typically)
  let lgaName = null;
  for (let i = 0; i < 10; i++) {
    const cell = data[i]?.[0];
    if (typeof cell === 'string' && cell.endsWith('Local Government Area')) {
      lgaName = cell.replace(' Local Government Area', '').trim();
      break;
    }
  }
  if (!lgaName) return null;

  // Find header row (has "Offence group")
  let headerIdx = -1;
  for (let i = 0; i < 15; i++) {
    if (data[i]?.[0]?.toString().includes('Offence group')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const headers = data[headerIdx];
  // Columns 6-15: incident counts (10 years)
  // Columns 16-25: rates per 100K (10 years)
  // Extract year periods from headers
  const years = [];
  for (let c = 6; c <= 15; c++) {
    const h = headers[c];
    if (h) years.push(h.toString().trim());
  }

  const rows = [];
  let currentGroup = null;

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 7) continue;

    const group = row[0]?.toString().trim();
    const offence = row[1]?.toString().trim();
    if (!offence) continue;
    if (group) currentGroup = group;

    const twoYearTrend = typeof row[2] === 'number' ? row[2] : null;
    const tenYearTrend = typeof row[3] === 'number' ? row[3] : null;
    const lgaRank = typeof row[4] === 'number' ? row[4] : null;
    const lgaRatio = typeof row[5] === 'number' ? row[5] : null;

    for (let y = 0; y < years.length; y++) {
      const incidents = row[6 + y];
      const rate = row[16 + y];

      if (incidents === undefined && rate === undefined) continue;

      const incidentNum = typeof incidents === 'number' ? incidents : null;
      const rateNum = typeof rate === 'number' ? rate : null;

      if (incidentNum === null && rateNum === null) continue;

      rows.push({
        lga_name: lgaName,
        state: 'NSW',
        offence_group: currentGroup,
        offence_type: offence,
        year_period: years[y],
        incidents: incidentNum,
        rate_per_100k: rateNum,
        two_year_trend_pct: y === years.length - 1 ? twoYearTrend : null,
        ten_year_trend_pct: y === years.length - 1 ? tenYearTrend : null,
        lga_rank: y === years.length - 1 ? lgaRank : null,
        source: 'bocsar-2025',
      });
    }
  }

  return { lgaName, rows };
}

async function main() {
  const run = await logStart(db, 'import-bocsar-crime', 'Import NSW BOCSAR LGA Crime Stats');

  try {
    console.log('=== NSW BOCSAR LGA Crime Statistics Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    // Phase 1: Download (if --download flag)
    if (DOWNLOAD) {
      console.log('\n--- Phase 1: Download LGA files ---');
      let downloaded = 0;
      let failed = 0;
      const tried = new Set();

      for (const name of LGA_NAMES) {
        if (tried.has(name)) continue;
        tried.add(name);

        const file = `${DATA_DIR}/${name}.xlsx`;
        if (existsSync(file)) {
          const size = readFileSync(file).length;
          if (size > 10000) { // Skip if already downloaded and valid
            downloaded++;
            continue;
          }
        }

        const url = `${BASE_URL}/${name}LGA.xlsx`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'CivicGraph Data Pipeline (civic transparency research)' },
          });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > 10000) {
              writeFileSync(file, buf);
              downloaded++;
              if (downloaded % 20 === 0) console.log(`  ${downloaded} downloaded...`);
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        await sleep(DELAY_MS);
      }
      console.log(`  ${downloaded} downloaded, ${failed} failed`);
    }

    // Phase 2: Parse all downloaded files
    console.log('\n--- Phase 2: Parse Excel files ---');
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));
    console.log(`  ${files.length} LGA files found`);

    let totalRows = 0;
    const allRows = [];
    const lgaSummary = {};

    for (const file of files) {
      let result;
      try {
        result = parseOffenceSheet(`${DATA_DIR}/${file}`);
      } catch (err) {
        console.log(`  Skipping ${file}: ${err.message}`);
        continue;
      }
      if (!result) continue;

      allRows.push(...result.rows);
      totalRows += result.rows.length;

      // Latest year summary for this LGA
      const latestRows = result.rows.filter(r => r.year_period?.includes('2024'));
      const dvAssault = latestRows.find(r => r.offence_type === 'Domestic violence related assault');
      lgaSummary[result.lgaName] = {
        count: result.rows.length,
        dvAssaultIncidents: dvAssault?.incidents,
        dvAssaultRate: dvAssault?.rate_per_100k,
      };
    }

    console.log(`  ${totalRows} total data points across ${Object.keys(lgaSummary).length} LGAs`);

    // Show top 10 DV assault rates
    const sorted = Object.entries(lgaSummary)
      .filter(([, v]) => v.dvAssaultRate)
      .sort((a, b) => (b[1].dvAssaultRate || 0) - (a[1].dvAssaultRate || 0));

    console.log('\n=== Highest DV Assault Rates per 100K (2024-25) ===');
    for (const [lga, data] of sorted.slice(0, 15)) {
      console.log(`  ${lga.padEnd(30)} | ${data.dvAssaultRate?.toFixed(0)?.padStart(6)} per 100K | ${data.dvAssaultIncidents} incidents`);
    }

    if (APPLY && allRows.length > 0) {
      console.log('\nClearing existing BOCSAR data...');
      const { error: delError } = await db
        .from('crime_stats_lga')
        .delete()
        .eq('source', 'bocsar-2025');
      if (delError) {
        // Table might not exist
        console.log(`  Note: ${delError.message}`);
        console.log('  Table may not exist yet — run the migration first.');
      } else {
        console.log('  ✅ Deleted existing records');
        console.log('Inserting to crime_stats_lga...');
        let inserted = 0;
        let errors = 0;

        for (let i = 0; i < allRows.length; i += 500) {
          const chunk = allRows.slice(i, i + 500);
          const { error } = await db
            .from('crime_stats_lga')
            .insert(chunk);

          if (error) {
            console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
            errors++;
          } else {
            inserted += chunk.length;
          }
        }

        console.log(`  ${inserted} inserted, ${errors} batch errors`);
      }
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: totalRows,
      items_new: totalRows,
      items_updated: APPLY ? totalRows : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
