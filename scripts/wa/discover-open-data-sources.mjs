#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const OUTPUT = resolve('data/wa-open-data/discovery.json');
const API = 'https://catalogue.data.wa.gov.au/api/3/action/package_search';
const SEARCHES = [
  'Aboriginal organisations',
  'Aboriginal business',
  'community services',
  'youth justice',
  'family domestic violence',
  'homelessness housing services',
  'mental health services',
  'child protection',
  'grants funding recipients',
  'procurement contracts suppliers',
  'Closing the Gap outcomes',
  'Kimberley services',
];

const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function scoreDataset(dataset) {
  const text = [dataset.title, dataset.notes, ...(dataset.tags || []).map((tag) => tag.display_name || tag.name)]
    .filter(Boolean).join(' ').toLowerCase();
  const resources = dataset.resources || [];
  const formats = [...new Set(resources.map((resource) => String(resource.format || '').toUpperCase()).filter(Boolean))];
  const signals = [];
  let score = 0;
  const add = (name, points, pattern) => {
    if (pattern.test(text)) {
      signals.push(name);
      score += points;
    }
  };
  add('stable_identifiers', 4, /\babn\b|organisation register|business register|supplier/);
  add('procurement_lineage', 4, /procurement|contract award|tender|service agreement/);
  add('service_scope', 3, /community service|youth justice|child protection|homeless|family and domestic violence|mental health/);
  add('aboriginal_alignment', 3, /aboriginal|indigenous|closing the gap/);
  add('place', 2, /location|postcode|local government|region|kimberley|spatial/);
  add('outcomes', 2, /outcome|performance|evaluation|indicator/);
  if (formats.some((format) => ['CSV', 'JSON', 'GEOJSON', 'XLSX', 'XML'].includes(format))) {
    signals.push('machine_readable');
    score += 3;
  }
  if (resources.some((resource) => resource.datastore_active)) {
    signals.push('ckan_datastore');
    score += 2;
  }
  return { score, signals, formats };
}

async function search(query) {
  const url = new URL(API);
  url.searchParams.set('q', query);
  url.searchParams.set('rows', '100');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 WA evidence source discovery' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Data WA CKAN returned HTTP ${response.status} for ${query}`);
  const body = await response.json();
  if (!body.success) throw new Error(`Data WA CKAN rejected search: ${query}`);
  return body.result.results;
}

async function main() {
  const found = new Map();
  for (const query of SEARCHES) {
    for (const dataset of await search(query)) {
      const current = found.get(dataset.id) || { dataset, matched_queries: [] };
      current.matched_queries.push(query);
      found.set(dataset.id, current);
    }
  }

  const datasets = [...found.values()].map(({ dataset, matched_queries }) => {
    const fit = scoreDataset(dataset);
    return {
      id: dataset.id,
      name: dataset.name,
      title: dataset.title,
      url: `https://catalogue.data.wa.gov.au/dataset/${dataset.name}`,
      publisher: dataset.organization?.title || null,
      licence: dataset.license_title || null,
      metadata_modified: dataset.metadata_modified || null,
      matched_queries: [...new Set(matched_queries)],
      fit_score: fit.score,
      fit_signals: fit.signals,
      formats: fit.formats,
      resources: (dataset.resources || []).map((resource) => ({
        id: resource.id,
        name: resource.name,
        format: resource.format || null,
        url: resource.url,
        datastore_active: Boolean(resource.datastore_active),
        last_modified: resource.last_modified || null,
      })),
    };
  }).sort((a, b) => b.fit_score - a.fit_score || a.title.localeCompare(b.title));

  const manifest = {
    generated_at: new Date().toISOString(),
    source: API,
    searches: SEARCHES,
    dataset_count: datasets.length,
    machine_readable_count: datasets.filter((dataset) => dataset.fit_signals.includes('machine_readable')).length,
    high_fit_count: datasets.filter((dataset) => dataset.fit_score >= 8).length,
    datasets,
  };
  await mkdir(resolve('data/wa-open-data'), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);

  if (APPLY) {
    const now = new Date().toISOString();
    const { error } = await db.from('source_frontier').upsert({
      source_key: 'wa-transition:data-wa-discovery',
      source_kind: 'wa_transition_evidence',
      source_name: 'Data WA CKAN source discovery',
      target_url: API,
      domain: 'catalogue.data.wa.gov.au',
      parser_hint: 'ckan-package-search',
      owning_agent_id: 'wa-acco-transition-frontier',
      discovery_source: 'data-wa-ckan-api',
      cadence_hours: 168,
      priority: 8,
      enabled: true,
      change_detection: 'content-hash',
      confidence: 'high',
      last_checked_at: now,
      last_success_at: now,
      last_changed_at: now,
      last_http_status: 200,
      failure_count: 0,
      content_hash: hash(JSON.stringify(datasets.map((dataset) => [dataset.id, dataset.metadata_modified, dataset.resources.map((resource) => resource.id)]))),
      metadata: {
        geography: 'AU-WA',
        lane: 'open-data-discovery',
        evidence_status: 'official-catalogue-index',
        dataset_count: manifest.dataset_count,
        machine_readable_count: manifest.machine_readable_count,
        high_fit_count: manifest.high_fit_count,
        searches: SEARCHES,
        artifact: 'data/wa-open-data/discovery.json',
        collector: 'scripts/wa/discover-open-data-sources.mjs',
        proves: 'Which official Data WA catalogue records match the search vocabulary and expose potentially reusable resources.',
        cannot_prove: 'Dataset completeness, record-level relevance, identity linkage, service quality, community authority, readiness or outcomes.',
      },
      updated_at: now,
    }, { onConflict: 'source_key' });
    if (error) throw error;
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'discovery-only',
    artifact: OUTPUT,
    dataset_count: manifest.dataset_count,
    machine_readable_count: manifest.machine_readable_count,
    high_fit_count: manifest.high_fit_count,
    top: datasets.slice(0, 20).map((dataset) => ({ title: dataset.title, score: dataset.fit_score, signals: dataset.fit_signals, formats: dataset.formats, url: dataset.url })),
  }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-open-data-discovery] ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}`);
  process.exit(1);
});
