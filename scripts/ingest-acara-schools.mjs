#!/usr/bin/env node
/**
 * ingest-acara-schools — Import ACARA My School data into CivicGraph
 *
 * Downloads and imports school profile + location data from ACARA's public datasets.
 * Links schools to gs_entities by postcode/LGA for cross-system analysis.
 *
 * Data source: https://www.acara.edu.au/contact-us/acara-data-access
 * Files:
 *   - School Profile 2025 (XLSX) — enrolments, ICSEA, LBOTE, SEA
 *   - School Location 2025 (XLSX) — lat/lng, LGA
 *
 * Usage:
 *   node scripts/ingest-acara-schools.mjs --profile path/to/SchoolProfile2025.xlsx --location path/to/SchoolLocation2025.xlsx
 *   node scripts/ingest-acara-schools.mjs --profile path/to/SchoolProfile2025.xlsx  # profile only
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Lazy-load xlsx (install if missing)
let XLSX;
try {
  XLSX = await import('xlsx');
} catch {
  console.log('Installing xlsx package...');
  execSync('npm install xlsx', { stdio: 'inherit' });
  XLSX = await import('xlsx');
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const profileIdx = args.indexOf('--profile');
const locationIdx = args.indexOf('--location');
const profilePath = profileIdx >= 0 ? args[profileIdx + 1] : null;
const locationPath = locationIdx >= 0 ? args[locationIdx + 1] : null;

if (!profilePath) {
  console.error('Usage: node scripts/ingest-acara-schools.mjs --profile <SchoolProfile.xlsx> [--location <SchoolLocation.xlsx>]');
  console.error('\nDownload from: https://www.acara.edu.au/contact-us/acara-data-access');
  process.exit(1);
}

function parseXlsx(filePath, preferSheet) {
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  // Prefer a specific sheet, or find the one with the most rows (skip data dictionaries)
  let sheetName = workbook.SheetNames[0];
  if (preferSheet) {
    const match = workbook.SheetNames.find(s => s.toLowerCase().includes(preferSheet.toLowerCase()));
    if (match) sheetName = match;
  } else {
    // Pick sheet with most data rows
    let maxRows = 0;
    for (const name of workbook.SheetNames) {
      if (/dictionary/i.test(name)) continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
      if (rows.length > maxRows) {
        maxRows = rows.length;
        sheetName = name;
      }
    }
  }
  console.log(`Using sheet: "${sheetName}"`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

function cleanStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

function cleanNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function ensureTable() {
  const dbPassword = process.env.DATABASE_PASSWORD;
  if (!dbPassword) {
    console.error('DATABASE_PASSWORD not set');
    process.exit(1);
  }

  const ddl = `
    CREATE TABLE IF NOT EXISTS acara_schools (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      acara_id text UNIQUE NOT NULL,
      school_name text NOT NULL,
      school_type text,
      school_sector text,
      state text,
      postcode text,
      suburb text,
      lga_name text,
      latitude float,
      longitude float,
      icsea_value int,
      total_enrolments int,
      indigenous_pct float,
      lbote_pct float,
      sea_quarter text,
      year int NOT NULL DEFAULT 2025,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_acara_schools_postcode ON acara_schools(postcode);
    CREATE INDEX IF NOT EXISTS idx_acara_schools_state ON acara_schools(state);
    CREATE INDEX IF NOT EXISTS idx_acara_schools_lga ON acara_schools(lga_name);
    CREATE INDEX IF NOT EXISTS idx_acara_schools_icsea ON acara_schools(icsea_value);
  `;

  try {
    execSync(
      `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${ddl.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 30000 }
    );
    console.log('Table acara_schools ready');
  } catch (e) {
    console.error('DDL error:', e.stderr || e.message);
    process.exit(1);
  }
}

async function ingestProfiles(rows) {
  console.log(`Processing ${rows.length} school profiles...`);

  // Common column name variations in ACARA XLSX files
  const getVal = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined) return row[k];
      // Case-insensitive
      const match = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g, '_') === k.toLowerCase().replace(/\s+/g, '_'));
      if (match) return row[match];
    }
    return null;
  };

  const records = rows.map(row => ({
    acara_id: String(cleanNum(getVal(row, 'ACARA SML ID', 'ACARA_SML_ID', 'School ID', 'ACARA ID')) || ''),
    school_name: cleanStr(getVal(row, 'School Name', 'School_Name', 'school_name')),
    school_type: cleanStr(getVal(row, 'School Type', 'School_Type', 'school_type')),
    school_sector: cleanStr(getVal(row, 'School Sector', 'School_Sector', 'Sector', 'sector')),
    state: cleanStr(getVal(row, 'State', 'state', 'State/Territory')),
    postcode: cleanStr(getVal(row, 'Postcode', 'postcode', 'Post Code')),
    suburb: cleanStr(getVal(row, 'Suburb', 'suburb', 'Town/Suburb')),
    icsea_value: cleanNum(getVal(row, 'ICSEA', 'ICSEA Value', 'ICSEA_Value', 'icsea_value')),
    total_enrolments: cleanNum(getVal(row, 'Total Enrolments', 'Total_Enrolments', 'total_enrolments')),
    indigenous_pct: cleanNum(getVal(row, 'Indigenous Enrolments (%)', 'Indigenous %', 'Indigenous_pct', '% Indigenous')),
    lbote_pct: cleanNum(getVal(row, 'Language Background Other Than English - Yes (%)', 'LBOTE %', 'LBOTE_pct')),
    sea_quarter: cleanStr(getVal(row, 'Bottom SEA Quarter (%)', 'SEA Quarter', 'SEA_Quarter')),
    year: cleanNum(getVal(row, 'Calendar Year')) || 2025,
  })).filter(r => r.acara_id && r.acara_id !== '0' && r.school_name);

  console.log(`${records.length} valid school records parsed`);

  // Upsert in batches
  const BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('acara_schools')
      .upsert(batch, { onConflict: 'acara_id' });

    if (error) {
      console.error(`Batch ${i}-${i + BATCH} error:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Upserted ${upserted} school profiles`);
  return upserted;
}

async function ingestLocations(rows) {
  console.log(`Processing ${rows.length} school locations...`);

  const getVal = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined) return row[k];
      const match = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g, '_') === k.toLowerCase().replace(/\s+/g, '_'));
      if (match) return row[match];
    }
    return null;
  };

  let updated = 0;
  const BATCH = 100;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      const acara_id = String(cleanNum(getVal(row, 'ACARA SML ID', 'ACARA_SML_ID', 'School ID', 'ACARA ID')) || '');
      if (!acara_id || acara_id === '0') continue;

      const updates = {};
      const lat = cleanNum(getVal(row, 'Latitude', 'latitude'));
      const lng = cleanNum(getVal(row, 'Longitude', 'longitude'));
      const lga = cleanStr(getVal(row, 'Local Government Area Name', 'LGA Name', 'LGA_Name', 'lga_name', 'LGA'));

      if (lat != null) updates.latitude = lat;
      if (lng != null) updates.longitude = lng;
      if (lga) updates.lga_name = lga;

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from('acara_schools')
          .update(updates)
          .eq('acara_id', acara_id);

        if (!error) updated++;
      }
    }
  }

  console.log(`Updated ${updated} school locations with lat/lng/LGA`);
  return updated;
}

async function run() {
  await ensureTable();

  // Ingest school profiles
  console.log(`\nReading ${profilePath}...`);
  const profileRows = parseXlsx(profilePath, 'SchoolProfile');
  const profileCount = await ingestProfiles(profileRows);

  // Optionally ingest locations
  if (locationPath) {
    console.log(`\nReading ${locationPath}...`);
    const locationRows = parseXlsx(locationPath, 'SchoolLocation');
    await ingestLocations(locationRows);
  }

  // Summary stats
  const { data: stats } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        COUNT(*)::int as total_schools,
        COUNT(DISTINCT state)::int as states,
        COUNT(DISTINCT postcode)::int as postcodes,
        COUNT(DISTINCT lga_name)::int as lgas,
        AVG(icsea_value)::int as avg_icsea,
        MIN(icsea_value)::int as min_icsea,
        MAX(icsea_value)::int as max_icsea,
        SUM(total_enrolments)::int as total_students
      FROM acara_schools
    `,
  });

  if (stats?.[0]) {
    const s = stats[0];
    console.log('\n=== ACARA Schools Summary ===');
    console.log(`Schools: ${s.total_schools}`);
    console.log(`States: ${s.states}`);
    console.log(`Postcodes: ${s.postcodes}`);
    console.log(`LGAs: ${s.lgas}`);
    console.log(`Total students: ${s.total_students?.toLocaleString()}`);
    console.log(`ICSEA range: ${s.min_icsea} - ${s.max_icsea} (avg ${s.avg_icsea})`);
  }

  console.log('\nDone! Schools can now be cross-referenced with child protection and youth justice data by postcode/LGA.');
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});
