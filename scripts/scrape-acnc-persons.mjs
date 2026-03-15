#!/usr/bin/env node

/**
 * ACNC Responsible Persons Scraper
 *
 * Scrapes board members / responsible persons from ACNC charity profiles.
 * Each charity has a public page at: acnc.gov.au/charity/charities/[ABN]/people
 *
 * Stores results in acnc_responsible_persons table.
 * This builds the PEOPLE LAYER — connecting humans to organisations.
 *
 * Rate limited to ~2 req/sec to be respectful.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-acnc-persons.mjs [--limit=N] [--offset=N]
 */

import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const OFFSET = parseInt(process.argv.find(a => a.startsWith('--offset='))?.split('=')[1] || '0');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function ensureTable() {
  // Check if table exists by trying a query
  const { error } = await db.from('acnc_responsible_persons').select('id').limit(1);
  if (error && error.message.includes('does not exist')) {
    log('Creating acnc_responsible_persons table...');
    const { writeFileSync } = await import('fs');
    const { execSync } = await import('child_process');
    const sql = `
      CREATE TABLE IF NOT EXISTS acnc_responsible_persons (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        charity_abn text NOT NULL,
        person_name text NOT NULL,
        position text,
        appointment_date date,
        cessation_date date,
        is_current boolean DEFAULT true,
        scraped_at timestamptz DEFAULT now(),
        UNIQUE(charity_abn, person_name, position)
      );
      CREATE INDEX IF NOT EXISTS idx_acnc_rp_abn ON acnc_responsible_persons(charity_abn);
      CREATE INDEX IF NOT EXISTS idx_acnc_rp_name ON acnc_responsible_persons USING gin (person_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_acnc_rp_current ON acnc_responsible_persons(is_current) WHERE is_current = true;
    `;
    writeFileSync('/tmp/acnc_rp.sql', sql);
    try {
      execSync(`source ${process.cwd()}/.env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f /tmp/acnc_rp.sql`, { shell: '/bin/bash', stdio: 'pipe' });
      log('Table created');
    } catch (e) {
      log(`Table creation failed: ${e.message}`);
      process.exit(1);
    }
  }
}

async function scrapeCharityPeople(abn) {
  const url = `https://www.acnc.gov.au/charity/charities/${abn}/people`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'CivicGraph/1.0 (research; https://civicgraph.io)',
        'Accept': 'text/html',
      }
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const html = await res.text();

    // Parse responsible persons from HTML
    // ACNC pages have a table with Name, Position, Date appointed
    const persons = [];

    // Look for table rows with person data
    // Pattern: <td>Name</td><td>Position</td><td>Date</td>
    const tableRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/gi;
    let match;
    while ((match = tableRegex.exec(html)) !== null) {
      const name = match[1].trim();
      const position = match[2].trim();
      const dateStr = match[3].trim();

      // Skip header rows
      if (name === 'Name' || name === 'name' || name.includes('Responsible')) continue;
      if (name.length < 2) continue;

      persons.push({
        charity_abn: abn,
        person_name: name,
        position: position || null,
        appointment_date: parseAcncDate(dateStr),
        is_current: true,
      });
    }

    // Also try JSON-LD or data attributes if table parsing fails
    if (persons.length === 0) {
      // Try alternative patterns — some pages use different HTML structure
      const altRegex = /class="[^"]*person[^"]*"[^>]*>[\s\S]*?<[^>]*>([^<]+)<[\s\S]*?<[^>]*>([^<]*)</gi;
      while ((match = altRegex.exec(html)) !== null) {
        const name = match[1].trim();
        const position = match[2].trim();
        if (name.length >= 2 && name !== 'Name') {
          persons.push({
            charity_abn: abn,
            person_name: name,
            position: position || null,
            is_current: true,
          });
        }
      }
    }

    return persons;
  } catch (e) {
    return null;
  }
}

function parseAcncDate(d) {
  if (!d) return null;
  // Format varies: "01/01/2020" or "1 Jan 2020" or "2020-01-01"
  const parts = d.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

async function main() {
  log('=== ACNC Responsible Persons Scraper ===');
  const t0 = Date.now();

  await ensureTable();

  // Get charity ABNs from acnc_charities
  log('Loading charity ABNs...');
  const PAGE = 5000;
  let charities = [];
  let offset = OFFSET;

  while (true) {
    const { data } = await db.from('acnc_charities')
      .select('abn, name')
      .not('abn', 'is', null)
      .order('abn')
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    charities = charities.concat(data);
    offset += PAGE;
    if (LIMIT && charities.length >= LIMIT) {
      charities = charities.slice(0, LIMIT);
      break;
    }
  }

  log(`${charities.length.toLocaleString()} charities to scrape`);

  // Skip already-scraped ABNs
  const { data: scraped } = await db.from('acnc_responsible_persons')
    .select('charity_abn')
    .limit(50000);
  const scrapedSet = new Set((scraped || []).map(r => r.charity_abn));
  const toScrape = charities.filter(c => !scrapedSet.has(c.abn));
  log(`${toScrape.length.toLocaleString()} remaining after skipping ${scrapedSet.size} already scraped`);

  let totalPersons = 0;
  let scraped_count = 0;
  let empty = 0;
  let errors = 0;

  for (const charity of toScrape) {
    const persons = await scrapeCharityPeople(charity.abn);

    if (persons === null) {
      errors++;
    } else if (persons.length === 0) {
      empty++;
    } else {
      // Upsert persons
      const { error } = await db.from('acnc_responsible_persons')
        .upsert(persons, { onConflict: 'charity_abn,person_name,position', ignoreDuplicates: true });

      if (error) {
        log(`  Upsert error for ${charity.abn}: ${error.message}`);
      } else {
        totalPersons += persons.length;
      }
    }

    scraped_count++;

    if (scraped_count % 100 === 0) {
      const rate = (scraped_count / ((Date.now() - t0) / 1000)).toFixed(1);
      log(`  [${scraped_count.toLocaleString()}/${toScrape.length.toLocaleString()}] persons=${totalPersons.toLocaleString()} empty=${empty} errors=${errors} (${rate}/s)`);
    }

    // Rate limit: ~2 req/sec
    await new Promise(r => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${totalPersons.toLocaleString()} persons from ${scraped_count.toLocaleString()} charities in ${elapsed} min`);
}

main().catch(e => { console.error(e); process.exit(1); });
