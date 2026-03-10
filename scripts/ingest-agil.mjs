#!/usr/bin/env node

/**
 * Ingest AGIL (Australian Government Indigenous Programs & Policy Locations)
 *
 * Source: data/agil/agil_locations.csv + data/agil/agil_names.csv
 * Target: agil_locations table
 *
 * Usage: node --env-file=.env scripts/ingest-agil.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || null);
    return obj;
  });
}

function log(msg) {
  console.log(`[agil] ${msg}`);
}

async function main() {
  const started = Date.now();
  log('Starting AGIL ingestion...');

  const locationsCSV = readFileSync('data/agil/agil_locations.csv', 'utf-8');
  const namesCSV = readFileSync('data/agil/agil_names.csv', 'utf-8');

  const locations = parseCSV(locationsCSV);
  const names = parseCSV(namesCSV);

  log(`Parsed ${locations.length} locations, ${names.length} names`);

  // Build name map: lcode -> { preferred, alternates[] }
  const nameMap = {};
  for (const n of names) {
    if (!n.LCODE) continue;
    if (!nameMap[n.LCODE]) nameMap[n.LCODE] = { preferred: null, alternates: [] };
    if (n.NFLAG === 'P') {
      nameMap[n.LCODE].preferred = n.NAME;
    } else {
      nameMap[n.LCODE].alternates.push(n.NAME);
    }
  }

  // Build records
  const records = locations
    .filter(loc => loc.LCODE && nameMap[loc.LCODE]?.preferred)
    .map(loc => ({
      lcode: loc.LCODE,
      preferred_name: nameMap[loc.LCODE].preferred,
      alternate_names: nameMap[loc.LCODE].alternates,
      state: loc.STATE || null,
      latitude: loc.LATITUDE ? parseFloat(loc.LATITUDE) : null,
      longitude: loc.LONGITUDE ? parseFloat(loc.LONGITUDE) : null,
    }));

  log(`Built ${records.length} records with preferred names`);

  // Batch upsert
  const BATCH = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('agil_locations')
      .upsert(batch, { onConflict: 'lcode' });

    if (error) {
      log(`Batch error at ${i}: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  log(`Inserted ${inserted} locations (${errors} batch errors)`);

  // Log agent run
  const run = await logStart(supabase, 'agil-ingest', 'Ingest AGIL Locations');
  if (run) {
    await logComplete(supabase, run.id, {
      items_found: locations.length,
      items_new: inserted,
    });
  }

  log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
