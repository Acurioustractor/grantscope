#!/usr/bin/env node

/**
 * Import Government Grants from data.gov.au & State Portals
 *
 * Sources:
 *   1. NSW grants-and-funding portal (direct HTTP scrape)
 *   2. QLD Arts grants expenditure CSVs (data.gov.au)
 *   3. Brisbane City Council grants recipients (data.gov.au)
 *   4. business.gov.au grants (existing source)
 *
 * Usage:
 *   node scripts/import-gov-grants.mjs                    # All sources
 *   node scripts/import-gov-grants.mjs --source=nsw       # NSW only
 *   node scripts/import-gov-grants.mjs --source=qld-arts  # QLD arts only
 *   node scripts/import-gov-grants.mjs --dry-run          # Preview only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SINGLE_SOURCE = sourceArg ? sourceArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, upserted: 0, errors: 0 };
let currentRunId = null;

// ─── Helpers ────────────────────────────────────────────────

function inferCategories(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const cats = [];
  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage|music|theatre|film/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|mental/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export|innovation/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|research|stem/.test(text)) cats.push('education');
  if (/justice|youth|safety/.test(text)) cats.push('justice');
  if (/disaster|recovery|flood|bushfire|drought/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/housing|homelessness|accommodation/.test(text)) cats.push('housing');
  if (/disability|inclusion|accessible/.test(text)) cats.push('disability');
  return cats.length > 0 ? cats : ['general'];
}

function extractAmounts(text) {
  if (!text) return {};
  const rangeMatch = text.match(/\$([0-9,]+)\s*(?:to|-)\s*\$([0-9,]+)/i);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
      max: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
    };
  }
  const upToMatch = text.match(/up to \$([0-9,]+)/i);
  if (upToMatch) return { max: parseInt(upToMatch[1].replace(/,/g, ''), 10) };
  const singleMatch = text.match(/\$([0-9,]{4,})/);
  if (singleMatch) return { max: parseInt(singleMatch[1].replace(/,/g, ''), 10) };
  return {};
}

function stableSlug(value) {
  const raw = String(value || '');
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }

  return `${normalized || 'record'}-${Math.abs(hash).toString(36)}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GrantScope/1.0 (research; contact@act.place)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function upsertGrants(grants, source) {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would upsert ${grants.length} grants from ${source}`);
    for (const g of grants.slice(0, 5)) {
      console.log(`    ${g.name} | ${g.provider} | ${g.url || 'no url'}`);
    }
    if (grants.length > 5) console.log(`    ... and ${grants.length - 5} more`);
    stats.total += grants.length;
    return;
  }

  const existingUrls = new Set();
  const PAGE_SIZE = 5000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: existing, error } = await supabase
      .from('grant_opportunities')
      .select('url')
      .not('url', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of existing || []) {
      if (row.url) existingUrls.add(row.url);
    }

    if (!existing || existing.length < PAGE_SIZE) {
      break;
    }
  }

  const filteredGrants = [];
  const seenUrls = new Set();
  const seenKeys = new Set();
  for (const grant of grants) {
    const dedupKey = `${grant.source_id}::${grant.name}`.toUpperCase();
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);
    if (grant.url && (existingUrls.has(grant.url) || seenUrls.has(grant.url))) continue;
    if (grant.url) seenUrls.add(grant.url);
    filteredGrants.push(grant);
  }

  // Batch upsert 500 at a time using the concrete unique index the table exposes.
  // Supabase/PostgREST cannot target the partial unique URL index.
  const BATCH_SIZE = 500;
  for (let i = 0; i < filteredGrants.length; i += BATCH_SIZE) {
    const batch = filteredGrants.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('grant_opportunities')
      .upsert(batch, { onConflict: 'name,source_id', ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch upsert error (${source}, offset ${i}): ${error.message}`);
      // Fallback: individual inserts for this batch only
      for (const g of batch) {
        try {
          const { error: singleErr } = await supabase
            .from('grant_opportunities')
            .upsert(g, { onConflict: 'name,source_id', ignoreDuplicates: false });
          if (singleErr) {
            if (/duplicate key value/i.test(singleErr.message)) {
              continue;
            }
            stats.errors++;
            if (stats.errors <= 3) console.error(`  Single upsert error: ${singleErr.message}`);
          } else {
            stats.upserted++;
          }
        } catch {
          stats.errors++;
        }
      }
    } else {
      stats.upserted += batch.length;
    }
  }
  stats.total += filteredGrants.length;
  console.log(`  Upserted ${filteredGrants.length} grants from ${source}`);
}

// ─── Source 1: NSW Grants Portal ────────────────────────────

async function scrapeNSW() {
  console.log('\n=== NSW Grants & Funding ===');
  const grantPaths = new Set();
  const skipPaths = new Set([
    '/grants-and-funding/personalisation-pilot',
    '/grants-and-funding/grants-administration-guide',
    '/grants-and-funding/regional-growth-fund',
  ]);

  // Collect grant URLs
  for (let page = 0; page < 50; page++) {
    try {
      const html = await fetchText(`https://www.nsw.gov.au/grants-and-funding?page=${page}`);
      const matches = [...html.matchAll(/href="(\/grants-and-funding\/[a-z0-9][a-z0-9-]+)"/g)];
      let found = 0;
      for (const m of matches) {
        if (!skipPaths.has(m[1]) && !grantPaths.has(m[1])) {
          grantPaths.add(m[1]);
          found++;
        }
      }
      if (found === 0) break;
    } catch { break; }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`  Found ${grantPaths.size} grant pages`);

  const grants = [];
  for (const path of grantPaths) {
    const url = `https://www.nsw.gov.au${path}`;
    try {
      const html = await fetchText(url);
      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
        : path.split('/').pop()?.replace(/-/g, ' ') || '';
      if (!title || title.length < 5) continue;

      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      const description = descMatch ? descMatch[1] : '';

      const fullText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const amounts = extractAmounts(fullText);
      const categories = inferCategories(title, fullText);

      grants.push({
        name: title,
        provider: 'NSW Government',
        url,
        description: description.slice(0, 1000),
        amount_min: amounts.min || null,
        amount_max: amounts.max || null,
        categories,
        source: 'nsw-grants',
        source_id: 'nsw-grants',
        grant_type: 'open_opportunity',
        discovered_by: 'import-gov-grants',
        discovery_method: 'scraper',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`  Error scraping ${url}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`  Scraped ${grants.length} grants`);
  await upsertGrants(grants, 'nsw-grants');
}

// ─── Source 2: QLD Arts Grants (data.gov.au CSVs) ───────────

async function importQLDArtsGrants() {
  console.log('\n=== QLD Arts Grants Expenditure ===');

  const csvUrls = [
    { year: '2018-19', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/943e08af-8fc3-497f-bd5c-9612e17aa031/download/final-open-data-grants-expenditure-01-07-2018-to-30-06-2019.csv' },
    { year: '2017-18', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/0a9cf808-ab93-4ee6-b848-74d5fca60d63/download/final-grant-expenditure-01-07-2017-to-30-06-2018.csv' },
    { year: '2016-17', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/ff45a70c-29b5-4fc8-8d21-bdf2c10cbf7c/download/grants-expenditure-2016-17.csv' },
    { year: '2014-15', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/82fac0cc-5811-49a2-b435-4e6c50fa5436/download/grant-expenditure-2014-15.csv' },
    { year: '2012-13', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/ab9e8270-6a98-4b9d-9546-cb9dfa7f9987/download/grants-expenditure-2012-13.csv' },
    { year: '2011-12', url: 'https://www.data.qld.gov.au/dataset/5f28f9b3-56ec-4995-8bfe-64c0191ed3ac/resource/b07b212f-9e19-4e86-8e36-2af71a3d6e7e/download/grant-expenditure-2011-12.csv' },
  ];

  const allGrants = [];

  for (const { year, url } of csvUrls) {
    try {
      console.log(`  Fetching ${year}...`);
      const csv = await fetchText(url);
      const records = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
      console.log(`  ${year}: ${records.length} records`);

      for (const row of records) {
        // QLD arts CSV columns: Amount, Funding Program, Company/Organisation/Individual, Date, Grant Purpose
        const name = row['Funding Program'] || row['Grant Name'] || row['Program Name'] || '';
        const recipient = row['Company/Organisation/Individual'] || row['Recipient'] || row['Organisation'] || '';
        const amount = row['Amount'] || row['Grant Amount'] || '';
        const description = row['Grant Purpose'] || row['Description'] || row['Purpose'] || '';

        if (!name && !recipient) continue;

        const title = name ? `${name} — ${recipient}` : `QLD Arts Grant to ${recipient}`;
        const amountNum = Math.round(parseFloat(String(amount).replace(/[$,]/g, '')));

        allGrants.push({
          name: `${title} (${year})`.slice(0, 500),
          provider: 'Arts Queensland',
          program: name || 'Arts Grants Expenditure',
          url: `https://www.data.qld.gov.au/dataset/arts-grants-expenditure#${stableSlug(`${year}-${recipient}-${name}-${amountNum}`)}`,
          description: `${description || ''} Recipient: ${recipient}. Year: ${year}.`.trim().slice(0, 1000),
          amount_min: isNaN(amountNum) ? null : amountNum,
          amount_max: isNaN(amountNum) ? null : amountNum,
          categories: ['arts'],
          source: 'qld-arts-data',
          source_id: 'qld-arts-data',
          grant_type: 'historical_award',
          discovered_by: 'import-gov-grants',
          discovery_method: 'data.gov.au',
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`  Error fetching ${year}: ${err.message}`);
    }
  }

  console.log(`  Total: ${allGrants.length} QLD arts grants`);
  await upsertGrants(allGrants, 'qld-arts');
}

// ─── Source 3: Brisbane Council Grants ──────────────────────

async function importBrisbaneGrants() {
  console.log('\n=== Brisbane City Council Grants ===');

  try {
    // Brisbane uses Open Data Portal with API
    const apiUrl = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/grants-recipients/records?limit=100';
    let offset = 0;
    const allGrants = [];

    while (true) {
      const url = `${apiUrl}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  Brisbane API error: HTTP ${res.status}`);
        break;
      }
      const data = await res.json();
      const records = data.results || [];
      if (records.length === 0) break;

      for (const r of records) {
        // Brisbane API fields: grant, organisation_recipient, project, amount_approved, grant_round, abn, group
        const grantName = r.grant || '';
        const recipient = r.organisation_recipient || '';
        const project = r.project || '';
        if (!grantName && !recipient) continue;

        const name = project ? `${grantName} — ${project}` : `${grantName} — ${recipient}`;
        const amountApproved = r.amount_approved ? Math.round(parseFloat(r.amount_approved)) : null;

        allGrants.push({
          name: `${name} (${r.grant_round || 'Brisbane'})`.slice(0, 500),
          provider: 'Brisbane City Council',
          program: grantName,
          url: `https://data.brisbane.qld.gov.au/explore/dataset/grants-recipients/table/#${stableSlug(`${r.index || ''}-${recipient}-${name}-${amountApproved || ''}`)}`,
          description: `${r.group || ''} grant. Recipient: ${recipient}. Project: ${project}. Round: ${r.grant_round || ''}.`.trim().slice(0, 1000),
          amount_min: amountApproved,
          amount_max: amountApproved,
          categories: inferCategories(name, `${r.group || ''} ${project}`),
          source: 'brisbane-grants',
          source_id: 'brisbane-grants',
          grant_type: 'historical_award',
          discovered_by: 'import-gov-grants',
          discovery_method: 'open-data-api',
          updated_at: new Date().toISOString(),
        });
      }

      offset += records.length;
      if (records.length < 100) break;
      console.log(`  Fetched ${offset} Brisbane records...`);
    }

    console.log(`  Total: ${allGrants.length} Brisbane grants`);
    await upsertGrants(allGrants, 'brisbane');
  } catch (err) {
    console.error(`  Brisbane import error: ${err.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, 'import-gov-grants', 'Import Gov Grants');
  currentRunId = run.id;

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Government Grants Importer               ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Source: ${SINGLE_SOURCE || 'all'}`);

  const sources = {
    'nsw': scrapeNSW,
    'qld-arts': importQLDArtsGrants,
    'brisbane': importBrisbaneGrants,
  };

  if (SINGLE_SOURCE) {
    const fn = sources[SINGLE_SOURCE];
    if (!fn) {
      console.error(`Unknown source: ${SINGLE_SOURCE}`);
      console.error(`Available: ${Object.keys(sources).join(', ')}`);
      process.exit(1);
    }
    await fn();
  } else {
    for (const [name, fn] of Object.entries(sources)) {
      try {
        await fn();
      } catch (err) {
        console.error(`\nFatal error in ${name}: ${err.message}`);
        stats.errors++;
      }
    }
  }

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log(`║  Results                                  ║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`  Total grants processed: ${stats.total}`);
  console.log(`  Upserted: ${stats.upserted}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('Done.');

  await logComplete(supabase, run.id, {
    items_found: stats.total,
    items_new: stats.upserted,
    items_updated: 0,
    status: stats.errors > 0 ? 'partial' : 'success',
    errors: stats.errors > 0 ? [`${stats.errors} import-gov-grants errors`] : [],
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  const message = err instanceof Error ? err.message : String(err);
  logFailed(supabase, currentRunId, message).catch(() => {});
  process.exit(1);
});
