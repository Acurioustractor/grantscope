#!/usr/bin/env node
/**
 * Ingest VIC Government OPEN grants from the vic.gov.au grants gateway.
 *
 * Source: Tide/SDP Elasticsearch proxy behind www.vic.gov.au (no auth).
 * The direct ES host is firewalled — MUST go through the /api/tide proxy.
 * Docs are type=grant; open = end date >= now OR field_node_on_going=true.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-vic-grants-open.mjs --dry-run
 *   node --env-file=.env scripts/ingest-vic-grants-open.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const ENDPOINT = 'https://www.vic.gov.au/api/tide/elasticsearch/content-vic__production__sapi_node/_search';
const FETCH_ATTEMPTS = 4;
const FETCH_TIMEOUT_MS = 30_000;

const first = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchGateway(body) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://www.vic.gov.au/grants',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        },
        body,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) return response;
      const detail = (await response.text()).slice(0, 300);
      const error = new Error(`ES proxy HTTP ${response.status}: ${detail}`);
      if (response.status < 500 && response.status !== 429) {
        error.retryable = false;
        throw error;
      }
      lastError = error;
    } catch (error) {
      if (error?.retryable === false) throw error;
      lastError = error;
      if (attempt === FETCH_ATTEMPTS) break;
    }
    const delay = 1_000 * (2 ** (attempt - 1));
    console.warn(`  gateway attempt ${attempt}/${FETCH_ATTEMPTS} failed; retrying in ${delay / 1000}s: ${lastError?.message || lastError}`);
    await sleep(delay);
  }
  const cause = lastError?.cause?.code || lastError?.code || lastError?.name || 'unknown';
  throw new Error(`VIC Grants Gateway unavailable after ${FETCH_ATTEMPTS} attempts (${cause}): ${lastError?.message || lastError}`);
}

// same taxonomy as import-gov-grants.mjs
function inferCategories(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const cats = [];
  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage|music|theatre|film/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|mental/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation|catchment/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export|innovation/.test(text)) cats.push('enterprise');
  if (/education|training|school|university|research|stem/.test(text)) cats.push('education');
  if (/justice|youth|safety/.test(text)) cats.push('justice');
  if (/disaster|recovery|flood|bushfire|drought/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/housing|homelessness|accommodation/.test(text)) cats.push('housing');
  if (/disability|inclusion|accessible/.test(text)) cats.push('disability');
  return cats.length > 0 ? cats : ['general'];
}

let activeRun = { id: null };

async function main() {
  if (!DRY_RUN) activeRun = await logStart(supabase, 'ingest-vic-grants-open', 'VIC Grants Gateway (Open)');
  console.log(`VIC open grants ingest — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const query = {
    size: 200,
    query: {
      bool: {
        filter: [{ terms: { type: ['grant'] } }],
        should: [
          { range: { field_node_dates_end_value: { gte: 'now' } } },
          { term: { field_node_on_going: true } },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [{ field_node_dates_end_value: { order: 'asc', missing: '_last' } }],
    _source: [
      'nid', 'title', 'url', 'field_node_dates_start_value', 'field_node_dates_end_value',
      'field_node_on_going', 'funding_level_from', 'funding_level_to',
      'field_department_agency_name', 'field_landing_page_summary',
      'field_topic_name', 'field_audience_name',
    ],
  };

  const res = await fetchGateway(JSON.stringify(query));
  const data = await res.json();
  const hits = data.hits?.hits || [];
  console.log(`${hits.length} open/ongoing grants returned (total matched: ${data.hits?.total?.value})`);

  const rows = hits.map((h) => {
    const s = h._source;
    const title = first(s.title);
    const summary = first(s.field_landing_page_summary);
    const endIso = first(s.field_node_dates_end_value);
    const deadline = endIso ? endIso.slice(0, 10) : null;
    const path = first(s.url);
    return {
      name: title,
      description: summary,
      deadline,
      closes_at: deadline,
      source: 'vic-grants-gateway',
      source_id: String(first(s.nid)),
      url: `https://www.vic.gov.au${path}`,
      provider: first(s.field_department_agency_name) || 'Victorian Government',
      amount_min: first(s.funding_level_from),
      amount_max: first(s.funding_level_to),
      categories: inferCategories(title || '', `${summary || ''} ${(s.field_topic_name || []).join(' ')}`),
      status: 'open',
      grant_type: 'government',
      geography: 'VIC',
      discovery_method: 'vic-tide-es-api',
      last_verified_at: new Date().toISOString(),
      metadata: {
        nid: first(s.nid),
        ongoing: first(s.field_node_on_going) === true,
        opens_at: first(s.field_node_dates_start_value),
        topics: s.field_topic_name || [],
        audience: s.field_audience_name || [],
      },
    };
  });

  if (DRY_RUN) {
    rows.slice(0, 10).forEach((r) =>
      console.log(`  ${r.deadline || 'ongoing '} | $${r.amount_min ?? '?'}-$${r.amount_max ?? '?'} | ${r.provider} | ${r.name?.slice(0, 60)}`)
    );
    console.log(`  ... ${rows.length} total. Dry run — not writing.`);
    return;
  }

  // The canonical table contract is one row per source/name. Refresh a
  // republished grant's URL and source_id instead of inserting a duplicate.
  const { error } = await supabase.from('grant_opportunities').upsert(rows, { onConflict: 'source,name', ignoreDuplicates: false });
  if (error) throw new Error(`upsert failed: ${error.message}`);
  console.log(`Upserted ${rows.length} rows (source=vic-grants-gateway)`);

  await logComplete(supabase, activeRun.id, { items_found: hits.length, items_new: rows.length });
}

main().catch(async (err) => {
  console.error(err);
  await logFailed(supabase, activeRun.id, err).catch(() => {});
  process.exit(1);
});
