#!/usr/bin/env node

/**
 * Import official NDIS provider market datasets.
 *
 * Sources:
 *  - Active providers data
 *  - Market concentration data
 *
 * The script discovers the latest file URLs from the public provider datasets page so
 * we do not hardcode dated media URLs.
 *
 * Usage:
 *   node --env-file=.env scripts/import-ndis-provider-market.mjs
 *   node --env-file=.env scripts/import-ndis-provider-market.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_URL = 'https://dataresearch.ndis.gov.au/datasets/provider-datasets';
const USER_AGENT = 'GrantScope/1.0 (research; contact@act.place)';
const BATCH_SIZE = 1000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[import-ndis-provider-market] ${message}`);
}

function toText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseReportDate(value) {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/^(\d{1,2})([A-Z]{3})(\d{4})$/);
  if (!match) return null;
  const monthMap = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  };
  const day = match[1].padStart(2, '0');
  const month = monthMap[match[2]];
  const year = match[3];
  return month ? `${year}-${month}-${day}` : null;
}

function parsePercent(value) {
  if (!value) return null;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function asInt(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const num = Number.parseInt(text, 10);
  return Number.isFinite(num) ? num : null;
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function discoverDatasetLinks() {
  const html = await fetchText(PAGE_URL);
  const links = [...html.matchAll(/<a href="([^"]+)"[^>]*title="([^"]+)"/g)].map((match) => ({
    href: match[1].startsWith('http') ? match[1] : `https://dataresearch.ndis.gov.au${decodeHtml(match[1])}`,
    title: decodeHtml(match[2]).trim(),
  }));

  const active = links.find((link) => /^Active providers data as at /i.test(link.title));
  const concentration = links.find((link) => /^Market Concentration data/i.test(link.title));

  if (!active || !concentration) {
    throw new Error('Could not find NDIS provider dataset links on the provider datasets page');
  }

  return { active, concentration };
}

async function loadCsv(url) {
  const csvText = await fetchText(url);
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });
}

async function upsertRows(table, rows, onConflict) {
  if (DRY_RUN) {
    log(`[dry-run] Would upsert ${rows.length} rows into ${table}`);
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }
}

function mapActiveRows(records, source) {
  return records
    .map((row) => ({
      report_date: parseReportDate(row.RprtDt),
      state_code: toText(row.StateCd) || 'Unknown',
      service_district_name: toText(row.SrvcDstrctNm) || 'Unknown',
      disability_group_name: toText(row.DsbltyGrpNm) || 'Unknown',
      age_band: toText(row.AgeBnd) || 'Unknown',
      support_class: toText(row.SuppClass) || 'Unknown',
      provider_count: asInt(row.PrvdrCnt) ?? 0,
      source_page_url: PAGE_URL,
      source_file_url: source.href,
      source_file_title: source.title,
    }))
    .filter((row) => row.report_date);
}

function mapConcentrationRows(records, source) {
  return records
    .map((row) => ({
      report_date: parseReportDate(row.RprtDt),
      state_code: toText(row.StateCd) || 'Unknown',
      service_district_name: toText(row.SrvcDstrctNm) || 'Unknown',
      support_class: toText(row.SuppClass) || 'Unknown',
      payment_share_top10_pct: parsePercent(row.PymntShareOfTop10),
      payment_band: toText(row.PymntBnd),
      source_page_url: PAGE_URL,
      source_file_url: source.href,
      source_file_title: source.title,
    }))
    .filter((row) => row.report_date);
}

async function main() {
  log('Discovering official NDIS provider dataset links...');
  const { active, concentration } = await discoverDatasetLinks();
  log(`Active providers: ${active.title}`);
  log(`Market concentration: ${concentration.title}`);

  const [activeRecords, concentrationRecords] = await Promise.all([
    loadCsv(active.href),
    loadCsv(concentration.href),
  ]);

  const activeRows = mapActiveRows(activeRecords, active);
  const concentrationRows = mapConcentrationRows(concentrationRecords, concentration);

  log(`Parsed ${activeRows.length} active-provider rows`);
  log(`Parsed ${concentrationRows.length} concentration rows`);

  await upsertRows(
    'ndis_active_providers',
    activeRows,
    'report_date,state_code,service_district_name,disability_group_name,age_band,support_class'
  );
  await upsertRows(
    'ndis_market_concentration',
    concentrationRows,
    'report_date,state_code,service_district_name,support_class'
  );

  log(`Done. Active rows: ${activeRows.length}. Concentration rows: ${concentrationRows.length}.`);
}

main().catch((error) => {
  console.error('[import-ndis-provider-market] Fatal:', error.message);
  process.exit(1);
});
