#!/usr/bin/env node
/**
 * Ingest ABS Estimated Resident Population (ERP) by LGA into lga_cross_system_stats.
 * Source: ArcGIS FeatureServer (Digital Atlas of Australia)
 * Data: ABS ERP 2001-2023 by LGA (2023 boundaries)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const FEATURE_SERVICE = 'https://services-ap1.arcgis.com/ypkPEy1AmwPKGNNv/arcgis/rest/services/ABS_ERP_2001_2023_LGA/FeatureServer/0/query';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchPopulation() {
  const url = `${FEATURE_SERVICE}?where=1=1&outFields=lga_code_2023,lga_name_2023,erp_no_2023&returnGeometry=false&resultRecordCount=2000&f=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.features
    .map(f => f.attributes)
    .filter(a => a.erp_no_2023 != null && !a.lga_code_2023.startsWith('9') && a.lga_code_2023 !== 'ZZZZZ');
}

async function getDbLgas() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT lga_name, state FROM lga_cross_system_stats ORDER BY lga_name`
  });
  if (error) throw error;
  return data;
}

function buildNameMap(absRows) {
  // Map: lowercase name -> { name, population, code }
  const map = new Map();
  for (const row of absRows) {
    const name = row.lga_name_2023;
    const pop = row.erp_no_2023;
    const code = row.lga_code_2023;
    // Store by lowercase full name (includes state disambiguator if present)
    map.set(name.toLowerCase(), { name, pop, code });
  }
  return map;
}

// State code from LGA code prefix
function stateFromCode(code) {
  const prefix = code.charAt(0);
  const states = { '1': 'NSW', '2': 'VIC', '3': 'QLD', '4': 'SA', '5': 'WA', '6': 'TAS', '7': 'NT', '8': 'ACT' };
  return states[prefix] || null;
}

async function main() {
  console.log('Fetching ABS ERP data from ArcGIS...');
  const absRows = await fetchPopulation();
  console.log(`  Got ${absRows.length} LGAs with population`);

  console.log('Fetching DB LGAs...');
  const dbLgas = await getDbLgas();
  console.log(`  Got ${dbLgas.length} LGAs in lga_cross_system_stats`);

  const absMap = buildNameMap(absRows);

  let matched = 0;
  let unmatched = [];
  const updates = [];

  for (const dbRow of dbLgas) {
    const dbName = dbRow.lga_name;
    const dbState = dbRow.state;

    // Try exact match (lowercase)
    let abs = absMap.get(dbName.toLowerCase());

    // Try with state disambiguator: "Bayside" -> "Bayside (NSW)"
    if (!abs) {
      abs = absMap.get(`${dbName} (${dbState})`.toLowerCase());
    }

    // Try without common suffixes
    if (!abs) {
      const cleaned = dbName.replace(/ \(.*\)$/, '').toLowerCase();
      abs = absMap.get(cleaned);
      // Verify state matches if we found one
      if (abs && stateFromCode(abs.code) !== dbState) {
        abs = null;
      }
    }

    if (abs) {
      matched++;
      updates.push({ lga_name: dbName, state: dbState, population: abs.pop });
    } else {
      unmatched.push(`${dbName} (${dbState})`);
    }
  }

  console.log(`\nMatched: ${matched}/${dbLgas.length}`);
  if (unmatched.length > 0) {
    console.log(`Unmatched (${unmatched.length}):`);
    for (const u of unmatched) console.log(`  - ${u}`);
  }

  // Generate SQL file for psql execution
  const sqlFile = '/tmp/update-lga-population.sql';
  const lines = ['BEGIN;'];
  for (const u of updates) {
    const name = u.lga_name.replace(/'/g, "''");
    lines.push(`UPDATE lga_cross_system_stats SET population = ${u.population} WHERE lga_name = '${name}' AND state = '${u.state}';`);
  }
  lines.push('COMMIT;');
  lines.push("SELECT COUNT(*) as total, COUNT(population) as with_pop, SUM(population) as total_pop FROM lga_cross_system_stats;");

  const fs = await import('fs');
  fs.writeFileSync(sqlFile, lines.join('\n'));
  console.log(`\nGenerated SQL file: ${sqlFile} (${lines.length} statements)`);
  console.log('Run with: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f ' + sqlFile);
}

main().catch(console.error);
