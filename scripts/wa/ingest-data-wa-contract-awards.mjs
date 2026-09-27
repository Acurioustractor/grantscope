#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ROOT = resolve('data/wa-tenders/annual');
const DATASETS = [
  {
    year: '2021-22',
    dataset: 'cab2f08c-6776-4328-b4b3-776f1f88eb3a',
    resource: '2f29a5b8-ad39-465a-8374-84cbe5a2afc9',
    url: 'https://catalogue.data.wa.gov.au/dataset/cab2f08c-6776-4328-b4b3-776f1f88eb3a/resource/2f29a5b8-ad39-465a-8374-84cbe5a2afc9/download/tenders-wa-contract-award-details-2021-22-financial-year.csv',
  },
  {
    year: '2022-23',
    dataset: 'a66013f6-07db-433b-bc6a-984b249a1013',
    resource: '063fa676-4ae3-48dd-ad0b-0e207182abf8',
    url: 'https://catalogue.data.wa.gov.au/dataset/a66013f6-07db-433b-bc6a-984b249a1013/resource/063fa676-4ae3-48dd-ad0b-0e207182abf8/download/tenders-wa-contract-award-details-2022-23-financial-year.csv',
  },
  {
    year: '2023-24',
    dataset: '90b272e8-9ae0-4995-8dc9-86f8249b51d1',
    resource: '855378f8-0398-4a0a-a1c2-218816508ec9',
    url: 'https://catalogue.data.wa.gov.au/dataset/90b272e8-9ae0-4995-8dc9-86f8249b51d1/resource/855378f8-0398-4a0a-a1c2-218816508ec9/download/tenders-wa-contract-award-details-2023-24-financial-year.csv',
  },
];

const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function date(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00+08:00` : null;
}

function yes(value) {
  return String(value || '').trim().toLowerCase() === 'yes';
}

function regions(row) {
  return [
    ['Gascoyne', row.Gascoyne], ['Goldfields-Esperance', row.Goldfields_Esperance],
    ['Great Southern', row.Great_Southern], ['Kimberley', row.Kimberley],
    ['Mid West', row.Mid_West], ['Peel', row.Peel], ['Perth Metropolitan', row.Perth_Metropolitan],
    ['Pilbara', row.Pilbara], ['South West', row.South_West], ['Wheatbelt', row.Wheatbelt],
    ['Statewide', row.State_Wide], ['Interstate', row.Interstate], ['International', row.International],
  ].filter(([, value]) => yes(value)).map(([name]) => name);
}

async function acquire(dataset) {
  const path = resolve(ROOT, dataset.year, 'contracts.csv');
  await mkdir(resolve(ROOT, dataset.year), { recursive: true });
  const response = await fetch(dataset.url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 official WA open-data collector' },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${dataset.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, bytes);
  return { ...dataset, path, bytes: bytes.length, sha256: hash(bytes) };
}

function buildContracts(rows, dataset) {
  const grouped = new Map();
  for (const row of rows) {
    const key = [row.Public_Authority, row.Reference_Number, row.Title, row.Award_Date, row.Original_Contract_Value].join('|');
    const supplier = { name: row.Supplier_Name?.trim() || null, address: row.Supplier_Address?.trim() || null };
    if (!grouped.has(key)) grouped.set(key, { row, suppliers: [] });
    if (supplier.name && !grouped.get(key).suppliers.some((item) => item.name === supplier.name && item.address === supplier.address)) {
      grouped.get(key).suppliers.push(supplier);
    }
  }
  return [...grouped.entries()].map(([key, { row, suppliers }]) => {
    const category = [row.Type_of_Work, ...[1, 2, 3].map((index) => {
      const code = row[`UNSPSC_Code_${index}`];
      const title = row[`UNSPSC_Title_${index}`];
      return code || title ? `${code || ''} ${title || ''}`.trim() : null;
    })].filter(Boolean).join(' | ');
    const text = `${row.Public_Authority || ''} ${row.Title || ''} ${row.Description || ''}`;
    return {
      source: 'data-wa-tenders',
      source_id: `${dataset.year}:${hash(key).slice(0, 24)}`,
      source_reference: row.Reference_Number?.trim() || null,
      title: row.Title?.trim() || 'Untitled WA contract',
      description: row.Description?.trim() || null,
      contract_value: Number(row.Original_Contract_Value) || null,
      currency: 'AUD',
      status: 'awarded',
      category: category || null,
      state: 'WA',
      buyer_name: row.Public_Authority?.trim() || null,
      buyer_department: row.Public_Authority?.trim() || null,
      supplier_name: suppliers.map((item) => item.name).join(' | ') || null,
      suppliers,
      supplier_abn: null,
      closing_date: date(row.Closing_Date),
      awarded_date: date(row.Award_Date),
      commencement_date: date(row.Commencement_Date),
      expiry_date: date(row.Final_Expiry_Date) || date(row.Initial_Expiry_Date),
      published_date: null,
      is_justice_related: /justice|corrective|youth detention|court|prison/i.test(text),
      justice_keywords: ['justice', 'corrective', 'youth detention', 'court', 'prison'].filter((term) => text.toLowerCase().includes(term)),
      source_url: `https://catalogue.data.wa.gov.au/dataset/${dataset.dataset}`,
      regions: regions(row),
      procurement_method: row.Procurement_Method?.trim() || null,
      number_of_submissions: Number(row.Number_of_Submissions) || null,
      is_panel_contract: yes(row.Panel_Contract),
      dcsp_policy_applicable: null,
      aboriginal_participation_requirements: null,
    };
  });
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  await mkdir(ROOT, { recursive: true });
  const artifacts = [];
  const contracts = [];
  for (const dataset of DATASETS) {
    const artifact = await acquire(dataset);
    artifacts.push(artifact);
    const rows = parse(await readFile(artifact.path), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
    contracts.push(...buildContracts(rows, dataset));
  }
  const unique = new Set(contracts.map((row) => row.source_id));
  if (unique.size !== contracts.length) throw new Error(`Source ID collision: ${contracts.length} rows, ${unique.size} IDs`);

  const manifest = {
    fetched_at: new Date().toISOString(),
    licence: 'Creative Commons Attribution 4.0',
    publisher: 'WA Department of Treasury and Finance via Data WA',
    artifacts: artifacts.map(({ year, dataset, resource, url, path, bytes, sha256 }) => ({ year, dataset, resource, url, path, bytes, sha256 })),
    contracts: contracts.length,
    active_or_future: contracts.filter((row) => row.expiry_date && new Date(row.expiry_date) >= new Date()).length,
    kimberley: contracts.filter((row) => row.regions.includes('Kimberley')).length,
  };
  await writeFile(resolve(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (APPLY) {
    for (let index = 0; index < contracts.length; index += 500) {
      const { error } = await db.from('state_tenders').upsert(contracts.slice(index, index + 500), { onConflict: 'source,source_id' });
      if (error) throw error;
    }
    const { count, error } = await db.from('state_tenders').select('id', { count: 'exact', head: true }).eq('source', 'data-wa-tenders');
    if (error) throw error;
    if (count !== contracts.length) throw new Error(`Post-write mismatch: expected ${contracts.length}, found ${count}`);
    const now = new Date().toISOString();
    const { error: frontierError } = await db.from('source_frontier').upsert({
      source_key: 'wa-transition:data-wa-contract-awards',
      source_kind: 'wa_transition_evidence',
      source_name: 'Data WA annual Tenders WA contract award details',
      target_url: 'https://catalogue.data.wa.gov.au/dataset/?q=Tenders+WA+Contract+Award+Details',
      domain: 'catalogue.data.wa.gov.au',
      parser_hint: 'direct-ingestion',
      owning_agent_id: 'wa-acco-transition-frontier',
      discovery_source: 'data-wa-ckan-api',
      cadence_hours: 168,
      priority: 10,
      enabled: true,
      change_detection: 'file',
      confidence: 'high',
      last_checked_at: now,
      last_success_at: now,
      last_changed_at: now,
      last_http_status: 200,
      failure_count: 0,
      content_hash: hash(artifacts.map((artifact) => artifact.sha256).join('|')),
      metadata: {
        geography: 'AU-WA',
        lane: 'procurement-history',
        data_fit: 'direct-ingestion',
        evidence_status: 'official-open-data-ingested',
        licence: manifest.licence,
        publisher: manifest.publisher,
        financial_years: DATASETS.map((item) => item.year),
        contracts: manifest.contracts,
        active_or_future: manifest.active_or_future,
        kimberley: manifest.kimberley,
        collector: 'scripts/wa/ingest-data-wa-contract-awards.mjs',
        proves: 'Official annual Tenders WA award details, suppliers, regions, dates, values and procurement fields for the published financial years.',
        cannot_prove: 'Completeness beyond agency submissions, supplier ABNs, DCSP or APP flags, variations, expenditure realised, ACCO status, readiness or outcomes.',
      },
      updated_at: now,
    }, { onConflict: 'source_key' });
    if (frontierError) throw frontierError;
  }
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', manifest }, null, 2));
}

main().catch((error) => {
  console.error(`[data-wa-contract-awards] ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}`);
  process.exit(1);
});
