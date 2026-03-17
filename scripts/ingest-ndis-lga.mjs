#!/usr/bin/env node
/**
 * Ingest NDIS participants-by-LGA data into lga_cross_system_stats.
 *
 * Source: https://dataresearch.ndis.gov.au/media/4237/download?attachment=
 * Columns: ReportDt, StateCd, RsdsInSrvcDstrctNm, LGANm2020, PrtcpntCnt
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ndis-lga.mjs [path-to-csv]
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const CSV_PATH = process.argv[2] || '/tmp/ndis-participants-lga.csv';

// --- Parse CSV ---
const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map(line => {
  const parts = line.split(',');
  return {
    reportDt: parts[0],
    stateCd: parts[1],
    district: parts[2],
    lgaName: parts[3],
    count: parts[4],
  };
});

// --- Find latest quarter ---
function parseDate(s) {
  // Format: 31MAR2025
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const day = parseInt(s.slice(0, 2));
  const mon = months[s.slice(2, 5)];
  const year = parseInt(s.slice(5));
  return new Date(year, mon, day);
}

const dates = [...new Set(rows.map(r => r.reportDt))].filter(d => d !== 'ReportDt');
dates.sort((a, b) => parseDate(b) - parseDate(a));
const latestQt = dates[0];
console.log(`Latest quarter: ${latestQt}`);

// --- Filter to latest quarter ---
const latest = rows.filter(r => r.reportDt === latestQt);
console.log(`Rows for latest quarter: ${latest.length}`);

// --- State disambiguator mapping (CSV uppercase -> DB format) ---
const stateDisambig = {
  'NSW': '(NSW)',
  'VIC': '(Vic.)',
  'QLD': '(Qld)',
  'SA': '(SA)',
  'WA': '(WA)',
  'TAS': '(Tas.)',
  'NT': '(NT)',
  'ACT': '(ACT)',
};

// LGA type suffixes used in CSV: (C), (A), (S), (RC), (DC), (T), (M), (B), (R), (RegC)
const lgaTypeSuffixes = new Set(['C', 'A', 'S', 'RC', 'DC', 'T', 'M', 'B', 'R', 'RegC', 'CFN']);

function cleanLgaName(name, stateCd) {
  // Extract trailing parenthetical tokens
  // e.g. "Central Coast (C) (NSW)" -> tokens: ["C", "NSW"], base: "Central Coast"
  const parenRegex = /\s*\(([^)]+)\)/g;
  const tokens = [];
  let match;
  while ((match = parenRegex.exec(name)) !== null) {
    tokens.push({ value: match[1], index: match.index, full: match[0] });
  }

  let base = name;
  let stateToken = null;

  // Process tokens from right to left
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i];
    if (lgaTypeSuffixes.has(tok.value)) {
      // Remove LGA type suffix
      base = base.replace(tok.full, '');
    } else if (['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(tok.value.toUpperCase().replace('.', ''))) {
      // State disambiguator -- convert to DB format
      stateToken = tok;
      base = base.replace(tok.full, '');
    }
  }

  base = base.trim();

  // Re-add state disambiguator in DB format if present
  if (stateToken) {
    const upperState = stateToken.value.toUpperCase().replace('.', '');
    const dbFormat = stateDisambig[upperState];
    if (dbFormat) {
      base = `${base} ${dbFormat}`;
    }
  }

  return base;
}

// --- Normalize names for fuzzy matching ---
// Handles: slash/hyphen, "Regional", "Shire", "City and", "City of", etc.
function normalizeForMatch(name) {
  let n = name.toLowerCase().replace(/\//g, '-');
  // Strip common suffixes
  n = n.replace(/\s+(regional|shire|city)\s*$/i, '');
  // Strip "the " prefix
  n = n.replace(/^the\s+/i, '');
  // Strip "greater " prefix
  n = n.replace(/^greater\s+/i, '');
  // Strip " city and dists" / " city and districts"
  n = n.replace(/\s+city and\s+\w+$/i, '');
  // Collapse whitespace
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

// Additional manual mappings for names that differ significantly
const manualMappings = {
  // CSV cleaned name -> DB lga_name (case-insensitive match)
  'Sutherland Shire': 'Sutherland',
  'The Hills Shire': 'The Hills',
  'Colac-Otway': 'Colac Otway',
  'Waratah/Wynyard': 'Waratah-Wynyard',
  'Break O\'Day': 'Break O\'Day',
  'Glamorgan/Spring Bay': 'Glamorgan-Spring Bay',
  'Orroroo/Carrieton': 'Orroroo-Carrieton',
};

// --- Build lookup: cleaned name -> total participants ---
// Some LGAs appear multiple times (e.g., same name in different states filtered by district)
// We aggregate by (cleaned name + state)
const lgaMap = new Map(); // key: "STATE|cleaned_name" -> count

for (const row of latest) {
  const count = parseInt(row.count);
  if (isNaN(count)) continue; // Skip suppressed "<11" values

  const cleaned = cleanLgaName(row.lgaName, row.stateCd);
  if (cleaned === 'Other' || cleaned.startsWith('MIS -') || cleaned.startsWith('ACT -')) continue;

  const key = `${row.stateCd}|${cleaned}`;
  lgaMap.set(key, (lgaMap.get(key) || 0) + count);
}

console.log(`Unique LGA entries (after cleaning): ${lgaMap.size}`);

// --- Connect to Supabase ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Fetch existing LGAs ---
const { data: existingLgas, error: fetchErr } = await supabase
  .from('lga_cross_system_stats')
  .select('id, lga_name, state');

if (fetchErr) {
  console.error('Failed to fetch LGAs:', fetchErr);
  process.exit(1);
}

console.log(`LGAs in database: ${existingLgas.length}`);

// --- State code mapping (CSV uses abbreviated codes) ---
const stateMap = {
  'NSW': 'NSW',
  'VIC': 'VIC',
  'QLD': 'QLD',
  'SA': 'SA',
  'WA': 'WA',
  'TAS': 'TAS',
  'NT': 'NT',
  'ACT': 'ACT',
};

// --- Match and update ---
let matched = 0;
let unmatched = [];
let updated = 0;
let errors = 0;

// Build DB lookup: "STATE|normalized_name" -> {id, lga_name}
const dbLookup = new Map();
for (const lga of existingLgas) {
  const key = `${lga.state}|${normalizeForMatch(lga.lga_name)}`;
  dbLookup.set(key, lga);
}

// Also build a name-only lookup for fallback
const dbNameLookup = new Map();
for (const lga of existingLgas) {
  const key = normalizeForMatch(lga.lga_name);
  if (!dbNameLookup.has(key)) {
    dbNameLookup.set(key, lga);
  }
}

for (const [csvKey, count] of lgaMap) {
  const [stateCd, cleanedName] = csvKey.split('|');
  const state = stateMap[stateCd] || stateCd;

  // Try manual mapping first
  const manualName = manualMappings[cleanedName];

  // Try exact state+name match
  let dbLga = dbLookup.get(`${state}|${normalizeForMatch(manualName || cleanedName)}`);

  // Fallback: name-only match
  if (!dbLga) {
    dbLga = dbNameLookup.get(normalizeForMatch(manualName || cleanedName));
  }

  if (!dbLga) {
    unmatched.push({ csvKey, cleanedName, state, count });
    continue;
  }

  matched++;

  const { error: updateErr } = await supabase
    .from('lga_cross_system_stats')
    .update({
      ndis_youth_participants: count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dbLga.id);

  if (updateErr) {
    console.error(`  Error updating ${dbLga.lga_name}:`, updateErr.message);
    errors++;
  } else {
    updated++;
  }
}

// --- Report ---
console.log('\n=== INGEST REPORT ===');
console.log(`Quarter: ${latestQt}`);
console.log(`CSV LGA entries: ${lgaMap.size}`);
console.log(`DB LGAs: ${existingLgas.length}`);
console.log(`Matched: ${matched}`);
console.log(`Updated: ${updated}`);
console.log(`Errors: ${errors}`);
console.log(`Unmatched: ${unmatched.length}`);

if (unmatched.length > 0) {
  console.log('\nUnmatched LGAs:');
  for (const u of unmatched.sort((a, b) => b.count - a.count)) {
    console.log(`  ${u.state} | ${u.cleanedName} (${u.count} participants)`);
  }
}

// Show top LGAs by participant count
console.log('\n=== TOP 15 LGAs BY NDIS PARTICIPANTS ===');
const topEntries = [...lgaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [key, count] of topEntries) {
  const [state, name] = key.split('|');
  console.log(`  ${state} | ${name}: ${count.toLocaleString()}`);
}
