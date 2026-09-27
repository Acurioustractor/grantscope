#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

export const BASE = 'https://www.tenders.wa.gov.au';
export const HOME = `${BASE}/watenders/index.do?empty=Y`;
const OUT_DIR = resolve('data/wa-tenders/recent');
const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 1) : 25;
const db = APPLY
  ? createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  : null;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseMoney(value) {
  const match = clean(value).match(/\$([\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replaceAll(',', '')) : null;
}

function parseDate(value) {
  const text = clean(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T00:00:00+08:00`;
  const named = text.match(/^(\d{1,2}) ([A-Z][a-z]{2}), (\d{4})$/);
  if (!named) return null;
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  return `${named[3]}-${months[named[2]]}-${named[1].padStart(2, '0')}T00:00:00+08:00`;
}

const WA_REGIONS = [
  ['Perth Metropolitan', /Perth Metropolitan/i],
  ['Goldfields-Esperance', /Goldfields\/?Esperance/i],
  ['Great Southern', /Great Southern/i],
  ['South West', /South West/i],
  ['Mid West', /Mid West/i],
  ['Kimberley', /Kimberley/i],
  ['Gascoyne', /Gascoyne/i],
  ['Pilbara', /Pilbara/i],
  ['Wheatbelt', /Wheatbelt/i],
  ['Peel', /\bPeel\b/i],
];

function parseRegions(value) {
  const text = clean(value);
  if (!text) return [];
  return WA_REGIONS.filter(([, pattern]) => pattern.test(text)).map(([region]) => region);
}

export function cookieHeader(response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

export async function fetchText(url, cookie = '') {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CivicGraph/1.0 public WA procurement evidence collector',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return { text: await response.text(), cookie: cookieHeader(response) || cookie };
}

export function nonce(html) {
  const match = html.match(/var nonce = "CSRFNONCE=([A-F0-9]+)"/);
  if (!match) throw new Error('Tenders WA CSRF nonce was not found');
  return match[1];
}

function parseList(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $('#contractTable tbody tr').each((_, element) => {
    const cells = $(element).find('td');
    const href = cells.eq(1).find('a').attr('href') ?? '';
    const id = href.match(/[?&]id=(\d+)/)?.[1];
    if (!id) return;
    rows.push({
      id,
      reference: clean(cells.eq(1).text()),
      title: clean(cells.eq(2).text()),
      agency: clean(cells.eq(3).text()),
      awardedDate: clean(cells.eq(4).text()),
      expiryDate: clean(cells.eq(5).text()),
      value: clean(cells.eq(6).text()),
    });
  });
  if (!rows.length) throw new Error('No rows found in Tenders WA recently-awarded table');
  return rows;
}

export function parseDetail(html, listRow) {
  const $ = cheerio.load(html);
  const fields = new Map();
  $('table.view-contract').first().find('tr').each((_, row) => {
    const label = clean($(row).find('td.label').first().text());
    const value = clean($(row).find('td').eq(1).text());
    if (label && value && !fields.has(label)) fields.set(label, value);
  });
  const contractors = [];
  $('table.view-contract').slice(1).find('tr').each((_, row) => {
    const label = clean($(row).find('td.label').text());
    if (!/^\d+\)$/.test(label)) return;
    const contractor = clean($(row).find('td').eq(1).find('div').first().text());
    if (contractor) contractors.push(contractor);
  });
  const reference = fields.get('Reference Number') || listRow.reference;
  if (!reference || !fields.get('Title')) throw new Error(`Missing required contract fields for portal id ${listRow.id}`);
  const unspsc = [...fields.entries()]
    .filter(([key]) => key.startsWith('UNSPSC'))
    .map(([, value]) => value);
  return {
    source: 'tenders-wa',
    source_id: listRow.id,
    title: fields.get('Title'),
    description: fields.get('Description') || null,
    contract_value: parseMoney(fields.get('Original Contract Value') || listRow.value),
    currency: 'AUD',
    status: 'awarded',
    category: [fields.get('Type of Work'), ...unspsc].filter(Boolean).join(' | ') || null,
    state: 'WA',
    buyer_name: fields.get('Public Authority') || listRow.agency || null,
    buyer_department: fields.get('Public Authority') || listRow.agency || null,
    supplier_name: contractors.join(' | ') || null,
    suppliers: contractors.map((name) => ({ name })),
    supplier_abn: null,
    published_date: null,
    closing_date: parseDate(fields.get('Closing Date')),
    awarded_date: parseDate(fields.get('Award Date') || listRow.awardedDate),
    is_justice_related: /justice|corrective|youth detention|court|prison/i.test(
      `${fields.get('Public Authority') ?? ''} ${fields.get('Title') ?? ''} ${fields.get('Description') ?? ''}`,
    ),
    justice_keywords: [...new Set(
      ['justice', 'corrective', 'youth detention', 'court', 'prison'].filter((term) =>
        `${fields.get('Public Authority') ?? ''} ${fields.get('Title') ?? ''} ${fields.get('Description') ?? ''}`.toLowerCase().includes(term),
      ),
    )],
    source_url: `${BASE}/watenders/contract/view.action?id=${listRow.id}`,
    source_reference: reference,
    regions: parseRegions(fields.get('Region/s')),
    procurement_method: fields.get('Procurement Method') || null,
    commencement_date: parseDate(fields.get('Commencement Date')),
    expiry_date: parseDate(fields.get('Final Expiry Date') || listRow.expiryDate),
    number_of_submissions: Number(fields.get('Number of Submissions')) || null,
    is_panel_contract: fields.get('Panel Contract') === 'Yes',
    dcsp_policy_applicable: fields.get('DCSP Policy') === 'Applicable' ? true : null,
    aboriginal_participation_requirements: fields.get('Aboriginal Participation Requirements') || null,
  };
}

async function main() {
  await mkdir(resolve(OUT_DIR, 'details'), { recursive: true });
  const home = await fetchText(HOME);
  const listUrl = `${BASE}/watenders/contract/list.action?action=contract-view&CSRFNONCE=${nonce(home.text)}`;
  const list = await fetchText(listUrl, home.cookie);
  const listed = parseList(list.text);
  const selected = listed.slice(0, LIMIT);
  const records = [];
  const artifacts = [];

  for (let index = 0; index < selected.length; index += 4) {
    const batch = await Promise.all(selected.slice(index, index + 4).map(async (row) => {
      const url = `${BASE}/watenders/contract/view.action?id=${row.id}&CSRFNONCE=${nonce(list.text)}`;
      const detail = await fetchText(url, list.cookie);
      await writeFile(resolve(OUT_DIR, 'details', `${row.id}.html`), detail.text);
      return { record: parseDetail(detail.text, row), artifact: { id: row.id, sha256: sha256(detail.text), bytes: Buffer.byteLength(detail.text) } };
    }));
    for (const item of batch) {
      records.push(item.record);
      artifacts.push(item.artifact);
    }
  }

  await writeFile(resolve(OUT_DIR, 'list.html'), list.text);
  await writeFile(resolve(OUT_DIR, 'manifest.json'), `${JSON.stringify({
    fetched_at: new Date().toISOString(),
    source_url: listUrl.replace(/CSRFNONCE=[A-F0-9]+/, 'CSRFNONCE=[session]'),
    list_sha256: sha256(list.text),
    listed_rows: listed.length,
    collected_rows: records.length,
    artifacts,
    records,
  }, null, 2)}\n`);

  if (APPLY) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
    const { error } = await db.from('state_tenders').upsert(records, { onConflict: 'source,source_id' });
    if (error) throw error;
    const ids = records.map((record) => record.source_id);
    const { count, error: countError } = await db
      .from('state_tenders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'tenders-wa')
      .in('source_id', ids);
    if (countError) throw countError;
    if (count !== records.length) throw new Error(`Post-write mismatch: expected ${records.length}, found ${count}`);
    const now = new Date().toISOString();
    const awardedDates = records.map((record) => record.awarded_date).filter(Boolean).sort();
    const { error: frontierError } = await db
      .from('source_frontier')
      .update({
        last_checked_at: now,
        last_success_at: now,
        last_changed_at: now,
        last_http_status: 200,
        failure_count: 0,
        last_error: null,
        content_hash: sha256(list.text),
        metadata: {
          geography: 'AU-WA',
          lane: 'procurement',
          data_fit: 'portal-feasibility',
          evidence_status: 'current-window-ingested',
          proves: 'Advertised opportunities and published awards at or above applicable publication thresholds.',
          cannot_prove: 'Complete historical spend, contracts below publication thresholds, ACCO status or community outcomes.',
          jev_policy: 'public-text-review-queue-only',
          collector: 'scripts/wa/ingest-tenders-wa-recent.mjs',
          window_contracts: records.length,
          window_awarded_from: awardedDates[0] ?? null,
          window_awarded_to: awardedDates.at(-1) ?? null,
        },
        updated_at: now,
      })
      .eq('source_key', 'wa-transition:tenders-wa');
    if (frontierError) throw frontierError;
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    listed_rows: listed.length,
    collected_rows: records.length,
    with_supplier: records.filter((record) => record.supplier_name).length,
    with_value: records.filter((record) => record.contract_value != null).length,
    justice_related: records.filter((record) => record.is_justice_related).length,
    manifest: resolve(OUT_DIR, 'manifest.json'),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[tenders-wa] ${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}`);
    process.exit(1);
  });
}
