#!/usr/bin/env node
/**
 * Import NHMRC Grants from downloaded XLSX files (2013-2025)
 *
 * Data source: https://www.nhmrc.gov.au/funding/data-research/outcomes-funding-rounds
 * Pre-downloaded to: data/nhmrc/nhmrc-{year}.xlsx
 *
 * Usage:
 *   node --env-file=.env scripts/import-nhmrc-grants.mjs [--apply] [--year=2025]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { readdirSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const YEAR_FILTER = process.argv.find(a => a.startsWith('--year='))?.split('=')[1];
const DATA_DIR = 'data/nhmrc';
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Normalize column names across the 3 format variants (2013, 2014-2024, 2025)
 */
function normalizeRow(row, headers, year) {
  const get = (...keys) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h && h.toString().toLowerCase().replace(/[_\s]+/g, ' ').trim() === k.toLowerCase());
      if (idx >= 0 && row[idx] != null) return row[idx];
    }
    return null;
  };

  const appId = get('app id', 'application id');
  const title = get('grant title', 'simplified title', 'scientific title');
  const cia = get('cia name', 'cia', 'chief investigator a (project lead)');
  const investigators = get('chief investigator team');
  const grantType = get('grant type', 'funding type', 'funding scheme');
  const subType = get('sub type', 'funding sub type', 'level stream or sub-type');
  const adminInst = get('admin institution', 'app admin institution', 'administering institution');
  const state = get('state', 'state or territory');
  const total = get('total', 'final budget rounded', 'total amount awarded');
  const broadArea = get('broad research area', 'main funding group');
  const forField = get('field of research', 'for category', 'fields of research');
  const startDate = get('start date', 'start year', 'grant start date');
  const endDate = get('end date', 'grant end date');
  const description = get('media summary', 'plain description');

  if (!appId) return null;

  // Parse funding amount
  let fundingAmount = null;
  if (total != null) {
    const val = typeof total === 'string' ? parseFloat(total.replace(/[$,]/g, '')) : total;
    if (!isNaN(val)) fundingAmount = val;
  }

  // Parse start year
  let commencementYear = null;
  if (startDate != null) {
    if (typeof startDate === 'number') {
      if (startDate > 2000 && startDate < 2100) {
        commencementYear = startDate;
      } else {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(startDate);
        commencementYear = d?.y || year;
      }
    } else {
      const match = startDate.toString().match(/(\d{4})/);
      if (match) commencementYear = parseInt(match[1]);
    }
  }
  if (!commencementYear) commencementYear = year;

  // Parse end date
  let endDateStr = null;
  if (endDate != null) {
    if (typeof endDate === 'number' && endDate > 30000) {
      const d = XLSX.SSF.parse_date_code(endDate);
      if (d) endDateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else if (typeof endDate === 'string') {
      const match = endDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) endDateStr = endDate;
    }
  }

  return {
    source: 'nhmrc',
    grant_code: `NHMRC-${appId}`,
    scheme_name: grantType || null,
    program: subType || null,
    title: title?.toString().slice(0, 5000) || null,
    lead_investigator: cia || null,
    investigators: investigators || null,
    admin_organisation: adminInst || null,
    funding_amount: fundingAmount,
    announced_amount: fundingAmount,
    commencement_year: commencementYear,
    end_date: endDateStr,
    status: 'Completed',
    field_of_research: (forField || broadArea || '').toString().slice(0, 500) || null,
    national_interest: description?.toString().slice(0, 5000) || null,
  };
}

async function main() {
  const run = await logStart(db, 'import-nhmrc-grants', 'Import NHMRC Research Grants from XLSX');

  try {
    console.log('=== NHMRC Grants Importer ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

    // Find all XLSX files
    const files = readdirSync(DATA_DIR)
      .filter(f => f.match(/^nhmrc-\d{4}\.xlsx$/))
      .sort();

    const allGrants = [];

    for (const file of files) {
      const year = parseInt(file.match(/(\d{4})/)[1]);
      if (YEAR_FILTER && year !== parseInt(YEAR_FILTER)) continue;

      const wb = XLSX.readFile(`${DATA_DIR}/${file}`);

      // Find the grants data sheet
      let sheetName = wb.SheetNames.find(s => s.includes('GRANTS') || s.includes('grants'));
      if (!sheetName) sheetName = wb.SheetNames.find(s => s.includes('App Data'));
      if (!sheetName) {
        console.log(`  ${year}: No grants sheet found, skipping`);
        continue;
      }

      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find header row (look for APP ID or Application ID)
      let headerIdx = 0;
      for (let i = 0; i < 15; i++) {
        if (raw[i]?.[0]?.toString().match(/^(APP|Application)\s*ID$/i)) {
          headerIdx = i;
          break;
        }
      }

      const headers = raw[headerIdx].map(h => h?.toString().replace(/[_\s]+/g, ' ').trim());
      const dataRows = raw.slice(headerIdx + 1).filter(r => r[0] != null);

      let yearGrants = 0;
      for (const row of dataRows) {
        const grant = normalizeRow(row, headers, year);
        if (grant) {
          allGrants.push(grant);
          yearGrants++;
        }
      }

      console.log(`  ${year}: ${yearGrants} grants from "${sheetName}"`);
    }

    console.log(`\n  Total: ${allGrants.length} grants across ${files.length} files`);

    // Dedupe by grant_code
    const seen = new Set();
    const unique = allGrants.filter(g => {
      if (seen.has(g.grant_code)) return false;
      seen.add(g.grant_code);
      return true;
    });
    console.log(`  ${unique.length} unique grants after dedup (${allGrants.length - unique.length} dupes)`);

    // Stats
    const totalFunding = unique.reduce((sum, g) => sum + (g.funding_amount || 0), 0);
    console.log(`  Total funding: $${(totalFunding / 1e9).toFixed(2)}B`);

    const schemeBreakdown = {};
    for (const g of unique) {
      const s = g.scheme_name || 'Unknown';
      schemeBreakdown[s] = (schemeBreakdown[s] || 0) + 1;
    }
    console.log('\n=== Scheme Breakdown ===');
    const sorted = Object.entries(schemeBreakdown).sort((a, b) => b[1] - a[1]);
    for (const [scheme, count] of sorted.slice(0, 15)) {
      console.log(`  ${count.toString().padStart(6)} | ${scheme}`);
    }

    if (APPLY && unique.length > 0) {
      console.log('\nUpserting to database...');
      let upserted = 0;
      let errors = 0;

      for (let i = 0; i < unique.length; i += 500) {
        const chunk = unique.slice(i, i + 500);
        const { error } = await db
          .from('research_grants')
          .upsert(chunk, { onConflict: 'source,grant_code' });

        if (error) {
          console.error(`  Error at batch ${Math.floor(i / 500) + 1}: ${error.message}`);
          errors++;
        } else {
          upserted += chunk.length;
        }
      }

      console.log(`  ${upserted} upserted, ${errors} batch errors`);
    }

    if (!APPLY) console.log('\n  (DRY RUN — use --apply to write)');

    await logComplete(db, run.id, {
      items_found: allGrants.length,
      items_new: unique.length,
      items_updated: APPLY ? unique.length : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
