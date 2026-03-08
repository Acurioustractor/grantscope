#!/usr/bin/env node

/**
 * Import ROGS (Report on Government Services) justice spending data
 * Source: Productivity Commission ROGS 2026
 * Covers: Corrections, Youth Justice, Police, Courts — all states, multi-year
 *
 * Usage:
 *   node scripts/import-rogs-justice.mjs [--dry-run] [--section=corrections|youth_justice|police|courts|all]
 *
 * Prerequisites:
 *   - CSV files in data/rogs-2025/ (downloaded from pc.gov.au)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *   - Migration 20260308_rogs_justice_spending.sql applied
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'rogs-2025');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const SECTION = process.argv.find(a => a.startsWith('--section='))?.split('=')[1] || 'all';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[rogs] ${msg}`); }

// Parse CSV line respecting quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Parse numeric value (handles '..' for not available, 'na', 'np', empty)
function parseNum(val) {
  if (!val || val === '..' || val === 'na' || val === 'np' || val === '–' || val === '-') return null;
  const cleaned = val.replace(/,/g, '').replace(/['"]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// CSV section configs — maps CSV columns to our schema
const SECTIONS = {
  corrections: {
    file: 'corrective-services.csv',
    section: 'corrections',
    // CSV columns: Table_Number,Year,Measure,Age,Sex,Indigenous_Status,CS_Type,Year_Dollars,
    //   Description1-5,Data_Source,Unit,NSW,Vic,Qld,WA,SA,Tas,ACT,NT,Aust
    parseRow(fields) {
      return {
        rogs_table: fields[0],
        financial_year: fields[1],
        measure: fields[2],
        age_group: fields[3],
        indigenous_status: fields[5],
        service_type: fields[6],
        year_dollars: fields[7],
        description1: fields[8],
        description2: fields[9],
        description3: fields[10],
        description4: fields[11],
        data_source: fields[13],
        unit: fields[14],
        nsw: parseNum(fields[15]),
        vic: parseNum(fields[16]),
        qld: parseNum(fields[17]),
        wa: parseNum(fields[18]),
        sa: parseNum(fields[19]),
        tas: parseNum(fields[20]),
        act: parseNum(fields[21]),
        nt: parseNum(fields[22]),
        aust: parseNum(fields[23]),
      };
    },
    // Filter to spending-related tables only (skip population/staffing tables)
    filterTable(tableNum) {
      return tableNum.startsWith('8A');
    }
  },

  youth_justice: {
    file: 'youth-justice.csv',
    section: 'youth_justice',
    // CSV columns: Table_Number,Year,Measure,Age,Sex,Indigenous_Status,Remoteness,Service_Type,
    //   Year_Dollars,Description1-6,Data_Source,Unit,NSW...Aust
    parseRow(fields) {
      return {
        rogs_table: fields[0],
        financial_year: fields[1],
        measure: fields[2],
        age_group: fields[3],
        indigenous_status: fields[5],
        service_type: fields[7],
        year_dollars: fields[8],
        description1: fields[9],
        description2: fields[10],
        description3: fields[11],
        description4: fields[12],
        data_source: fields[15],
        unit: fields[16],
        nsw: parseNum(fields[17]),
        vic: parseNum(fields[18]),
        qld: parseNum(fields[19]),
        wa: parseNum(fields[20]),
        sa: parseNum(fields[21]),
        tas: parseNum(fields[22]),
        act: parseNum(fields[23]),
        nt: parseNum(fields[24]),
        aust: parseNum(fields[25]),
      };
    },
    // Include spending + population + Indigenous overrepresentation
    filterTable(tableNum) {
      return ['17A.1', '17A.5', '17A.7', '17A.10'].includes(tableNum);
    }
  },

  police: {
    file: 'police.csv',
    section: 'police',
    // CSV columns: Table_Number,Year,Measure,Age,Sex,Indigenous_Status,Remoteness,Year_Dollars,
    //   Description1-7,Uncertainty,Data_Source,Unit,NSW...Aust
    parseRow(fields) {
      return {
        rogs_table: fields[0],
        financial_year: fields[1],
        measure: fields[2],
        age_group: fields[3],
        indigenous_status: fields[5],
        service_type: null,
        year_dollars: fields[7],
        description1: fields[8],
        description2: fields[9],
        description3: fields[10],
        description4: fields[11],
        data_source: fields[16],
        unit: fields[17],
        nsw: parseNum(fields[18]),
        vic: parseNum(fields[19]),
        qld: parseNum(fields[20]),
        wa: parseNum(fields[21]),
        sa: parseNum(fields[22]),
        tas: parseNum(fields[23]),
        act: parseNum(fields[24]),
        nt: parseNum(fields[25]),
        aust: parseNum(fields[26]),
      };
    },
    filterTable(tableNum) {
      return tableNum.startsWith('6A');
    }
  },

  courts: {
    file: 'courts.csv',
    section: 'courts',
    // CSV columns: Table_Number,Year,Measure,Indigenous_Status,Law_Enforced,Court_Type,Year_Dollars,
    //   Description1-6,Data_Source,Unit,NSW...Aust cts,Aust
    parseRow(fields) {
      return {
        rogs_table: fields[0],
        financial_year: fields[1],
        measure: fields[2],
        age_group: null,
        indigenous_status: fields[3],
        service_type: fields[5], // Court_Type
        year_dollars: fields[6],
        description1: fields[7],
        description2: fields[8],
        description3: fields[9],
        description4: fields[10],
        data_source: fields[13],
        unit: fields[14],
        nsw: parseNum(fields[15]),
        vic: parseNum(fields[16]),
        qld: parseNum(fields[17]),
        wa: parseNum(fields[18]),
        sa: parseNum(fields[19]),
        tas: parseNum(fields[20]),
        act: parseNum(fields[21]),
        nt: parseNum(fields[22]),
        // fields[23] is "Aust cts" (sometimes), fields[24] is "Aust"
        aust: parseNum(fields[24]) ?? parseNum(fields[23]),
      };
    },
    filterTable(tableNum) {
      return tableNum.startsWith('7A');
    }
  }
};

async function importSection(sectionKey) {
  const config = SECTIONS[sectionKey];
  const filePath = join(DATA_DIR, config.file);
  log(`\n━━━ Importing ${sectionKey.toUpperCase()} from ${config.file} ━━━`);

  const lines = [];
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    if (!line.trim()) continue;
    lines.push(line);
  }

  log(`Total rows: ${lines.length}`);

  const rows = [];
  let skipped = 0;

  for (const line of lines) {
    const fields = parseCSVLine(line);
    const tableNum = fields[0]?.replace(/"/g, '');

    if (!config.filterTable(tableNum)) {
      skipped++;
      continue;
    }

    const row = config.parseRow(fields.map(f => f.replace(/^"|"$/g, '')));
    row.rogs_section = config.section;

    // Skip rows where all state values are null
    const hasData = [row.nsw, row.vic, row.qld, row.wa, row.sa, row.tas, row.act, row.nt, row.aust]
      .some(v => v !== null);
    if (!hasData) {
      skipped++;
      continue;
    }

    rows.push(row);
  }

  log(`Rows to import: ${rows.length} (skipped ${skipped} non-matching/empty rows)`);

  if (DRY_RUN) {
    log('[DRY RUN] Would insert rows. Sample:');
    const sample = rows.slice(0, 3);
    for (const r of sample) {
      log(`  ${r.financial_year} | ${r.service_type || '—'} | ${r.description2 || r.description1} | ${r.unit} | Aust: ${r.aust}`);
    }
    return rows.length;
  }

  // Batch upsert (200 at a time)
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 200;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('rogs_justice_spending')
      .upsert(batch, {
        onConflict: 'rogs_table,financial_year,measure,service_type,description1,description2,description3,description4,unit',
        ignoreDuplicates: true
      });

    if (error) {
      log(`  ❌ Batch ${Math.floor(i/BATCH_SIZE)+1} error: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
      log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.length} rows`);
    }
  }

  log(`${sectionKey}: ${inserted} inserted, ${errors} errors`);
  return inserted;
}

async function printSummary() {
  log('\n━━━ JUSTICE SPENDING SUMMARY ━━━');

  // Youth justice spending
  const { data: yj } = await supabase
    .from('rogs_justice_spending')
    .select('*')
    .eq('rogs_section', 'youth_justice')
    .eq('rogs_table', '17A.10')
    .like('financial_year', '2024%')
    .eq('unit', "$'000")
    .in('description2', ['Detention-based services', 'Community-based services', 'Total expenditure'])
    .is('description3', null);

  if (yj?.length) {
    log('\nYouth Justice (2024-25):');
    for (const row of yj) {
      const austM = row.aust ? `$${(row.aust / 1000).toFixed(0)}M` : 'n/a';
      log(`  ${row.description2}: ${austM} nationally`);
    }
  }

  // Corrections spending
  const { data: corr } = await supabase
    .from('rogs_justice_spending')
    .select('*')
    .eq('rogs_section', 'corrections')
    .like('financial_year', '2023%')
    .eq('unit', "$'000")
    .like('description3', 'Total%')
    .in('service_type', ['Prison', 'Community correction']);

  if (corr?.length) {
    log('\nCorrections (2023-24):');
    for (const row of corr) {
      const austB = row.aust ? `$${(row.aust / 1000000).toFixed(1)}B` : 'n/a';
      log(`  ${row.service_type}: ${austB} nationally`);
    }
  }

  // Police spending
  const { data: pol } = await supabase
    .from('rogs_justice_spending')
    .select('*')
    .eq('rogs_section', 'police')
    .like('financial_year', '2024%')
    .eq('unit', '$m')
    .eq('description2', 'Recurrent expenditure')
    .eq('description3', 'Total recurrent expenditure');

  if (pol?.length) {
    log('\nPolice (2024-25):');
    for (const row of pol) {
      const austB = row.aust ? `$${(row.aust / 1000).toFixed(1)}B` : 'n/a';
      log(`  Total recurrent: ${austB} nationally`);
    }
  }

  // Total
  const { count: totalRows } = await supabase
    .from('rogs_justice_spending')
    .select('*', { count: 'exact', head: true });

  log(`\nTotal ROGS rows in database: ${totalRows}`);
}

async function main() {
  log('ROGS Justice Spending Importer');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Section: ${SECTION}`);

  const sections = SECTION === 'all'
    ? ['corrections', 'youth_justice', 'police', 'courts']
    : [SECTION];

  let totalImported = 0;
  for (const s of sections) {
    if (!SECTIONS[s]) {
      log(`Unknown section: ${s}`);
      continue;
    }
    totalImported += await importSection(s);
  }

  log(`\n════════════════════════════════`);
  log(`Total rows imported: ${totalImported}`);

  if (!DRY_RUN) {
    await printSummary();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
