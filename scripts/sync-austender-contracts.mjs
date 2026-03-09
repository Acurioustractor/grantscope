#!/usr/bin/env node

/**
 * Sync AusTender OCDS API → Supabase austender_contracts table
 * Source: api.tenders.gov.au (OCDS 1.1, no auth required)
 * Syncs by date range chunks (1 month at a time) to handle volume.
 *
 * Usage:
 *   node scripts/sync-austender-contracts.mjs [--dry-run] [--from=2024-01-01] [--to=2024-12-31] [--months=3] [--endpoint=published|modified]
 *
 * Default: last 3 months of contracts via contractPublished endpoint
 * Use --endpoint=modified for incremental syncs (contracts modified in date range)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'https://api.tenders.gov.au/ocds';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const endpointArg = process.argv.find(a => a.startsWith('--endpoint='))?.split('=')[1] || 'published';
const ENDPOINT = endpointArg === 'modified' ? 'contractLastModified' : 'contractPublished';

const fromArg = process.argv.find(a => a.startsWith('--from='))?.split('=')[1];
const toArg = process.argv.find(a => a.startsWith('--to='))?.split('=')[1];
const monthsArg = parseInt(process.argv.find(a => a.startsWith('--months='))?.split('=')[1] || '3');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[austender] ${msg}`); }

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(d) {
  return d.toISOString().split('T')[0] + 'T00:00:00Z';
}

function extractSupplierAbn(release) {
  const parties = release.parties || [];
  for (const party of parties) {
    if (party.roles?.includes('supplier')) {
      // Check additionalIdentifiers for ABN
      const ids = party.additionalIdentifiers || [];
      for (const id of ids) {
        if (id.scheme === 'AU-ABN' && id.id) {
          return id.id.replace(/\s/g, '');
        }
      }
      // Fallback: check identifier
      if (party.identifier?.scheme === 'AU-ABN') {
        return party.identifier.id?.replace(/\s/g, '') || null;
      }
    }
  }
  return null;
}

function extractBuyer(release) {
  // Try release.buyer first, then fall back to procuringEntity party
  const buyer = release.buyer || {};
  if (buyer.name) {
    return { name: buyer.name, id: buyer.id || null };
  }
  // Fall back to procuringEntity in parties
  const procuring = (release.parties || []).find(p => p.roles?.includes('procuringEntity'));
  return {
    name: procuring?.name || null,
    id: procuring?.id || null,
  };
}

function extractContract(release) {
  const contracts = release.contracts || [];
  const awards = release.awards || [];
  const tender = release.tender || {};

  // Get value from contracts, awards, or tender
  let value = null;
  let currency = 'AUD';
  if (contracts[0]?.value) {
    value = contracts[0].value.amount;
    currency = contracts[0].value.currency || 'AUD';
  } else if (awards[0]?.value) {
    value = awards[0].value.amount;
    currency = awards[0].value.currency || 'AUD';
  }

  // Get dates
  let startDate = contracts[0]?.period?.startDate || null;
  let endDate = contracts[0]?.period?.endDate || null;

  return { value, currency, startDate, endDate };
}

function mapRelease(release) {
  const buyer = extractBuyer(release);
  const supplierAbn = extractSupplierAbn(release);
  const contract = extractContract(release);

  // Get supplier name from parties
  const supplierParty = (release.parties || []).find(p => p.roles?.includes('supplier'));

  // Title/description: try contracts first, then tender, then awards
  const contracts = release.contracts || [];
  const tender = release.tender || {};
  const title = contracts[0]?.title || tender.title || null;
  const description = contracts[0]?.description || tender.description || null;
  // Category: try mainProcurementCategory, then UNSPSC code from items
  const unspsc = contracts[0]?.items?.[0]?.classification;
  const category = tender.mainProcurementCategory
    || unspsc?.description
    || (unspsc?.scheme === 'UNSPSC' && unspsc?.id ? `UNSPSC:${unspsc.id}` : null);

  return {
    ocid: release.ocid,
    release_id: release.id || null,
    title,
    description,
    contract_value: contract.value,
    currency: contract.currency,
    procurement_method: tender.procurementMethod || null,
    category,
    contract_start: contract.startDate ? contract.startDate.split('T')[0] : null,
    contract_end: contract.endDate ? contract.endDate.split('T')[0] : null,
    date_published: release.date || null,
    date_modified: release.date || null,
    buyer_name: buyer.name,
    buyer_id: buyer.id,
    supplier_name: supplierParty?.name || null,
    supplier_abn: supplierAbn,
    supplier_id: supplierParty?.id || null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'GrantScope/1.0 (+https://grantscope.au)' },
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const text = await res.text();
    // "No Records found" is a 400 but not an error — just empty
    if (res.status === 400 && text.includes('No Records found')) {
      return { releases: [], nextUrl: null };
    }
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    releases: data.releases || [],
    nextUrl: data.links?.next || null,
  };
}

async function fetchDateRange(startDate, endDate) {
  let url = `${API_BASE}/findByDates/${ENDPOINT}/${formatDate(startDate)}/${formatDate(endDate)}`;
  log(`  Fetching ${startDate.toISOString().split('T')[0]} → ${endDate.toISOString().split('T')[0]}...`);

  let allReleases = [];
  let pageNum = 1;

  while (url) {
    const { releases, nextUrl } = await fetchPage(url);
    allReleases.push(...releases);

    if (nextUrl) {
      pageNum++;
      log(`    Page ${pageNum}...`);
      url = nextUrl;
      await new Promise(r => setTimeout(r, 1000)); // Rate limit between pages
    } else {
      url = null;
    }
  }

  return allReleases;
}

async function main() {
  const endDate = toArg ? new Date(toArg) : new Date();
  const startDate = fromArg ? new Date(fromArg) : addMonths(endDate, -monthsArg);

  log(`Syncing AusTender contracts from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} via ${ENDPOINT}`);

  // Chunk by month
  let current = new Date(startDate);
  let totalFetched = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  while (current < endDate) {
    const chunkEnd = new Date(Math.min(addMonths(current, 1).getTime(), endDate.getTime()));

    try {
      const releases = await fetchDateRange(current, chunkEnd);
      log(`  Got ${releases.length} releases`);
      totalFetched += releases.length;

      if (releases.length > 0 && !DRY_RUN) {
        const mapped = releases.map(mapRelease).filter(r => r.ocid);

        // Deduplicate by ocid (API can return multiple releases for same contract)
        const deduped = [...new Map(mapped.map(r => [r.ocid, r])).values()];
        if (deduped.length < mapped.length) {
          log(`  Deduped: ${mapped.length} → ${deduped.length} (${mapped.length - deduped.length} duplicates)`);
        }

        // Batch upsert
        const BATCH_SIZE = 200;
        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from('austender_contracts').upsert(batch, { onConflict: 'ocid' });
          if (error) {
            console.error(`Batch error: ${error.message}`);
            totalErrors += batch.length;
            if (totalErrors <= BATCH_SIZE) console.error('Sample:', JSON.stringify(batch[0], null, 2));
          } else {
            totalInserted += batch.length;
          }
        }
      } else if (DRY_RUN && releases.length > 0) {
        const sample = mapRelease(releases[0]);
        log(`  DRY RUN sample: ${sample.ocid} | ${sample.supplier_name} | ABN: ${sample.supplier_abn} | $${sample.contract_value} | ${sample.buyer_name}`);
      }

      // Rate limit between chunks
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      log(`  Error for chunk: ${err.message}`);
      totalErrors++;
    }

    current = addMonths(current, 1);
  }

  log(`\nComplete: ${totalFetched} fetched, ${totalInserted} upserted, ${totalErrors} errors`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
