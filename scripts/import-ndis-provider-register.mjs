#!/usr/bin/env node

/**
 * Import official NDIS Commission registered-provider rows.
 *
 * Uses the public Drupal AJAX view that powers the provider register search.
 *
 * Usage:
 *   node --env-file=.env scripts/import-ndis-provider-register.mjs
 *   node --env-file=.env scripts/import-ndis-provider-register.mjs --statuses=Approved
 *   node --env-file=.env scripts/import-ndis-provider-register.mjs --max-pages=25 --concurrency=3
 *   node --env-file=.env scripts/import-ndis-provider-register.mjs --dry-run
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_PAGE_URL = 'https://www.ndiscommission.gov.au/provider-registration/find-registered-provider';
const USER_AGENT = 'GrantScope/1.0 (research; contact@act.place)';
const DEFAULT_STATUSES = ['Approved', 'Revoked', 'Banned'];
const DEFAULT_CONCURRENCY = 4;
const UPSERT_BATCH_SIZE = 500;
const DEFAULT_CHECKPOINT_FILE = path.resolve(process.cwd(), 'tmp/ndis-provider-register-checkpoint.json');
const FETCH_RETRIES = 5;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[import-ndis-provider-register] ${message}`);
}

function getArg(name, fallback = null) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNull(value) {
  const text = cleanText(value);
  return text || null;
}

function normalizeAbn(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

function parseLongAuDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parsePositiveInt(value) {
  const text = String(value ?? '').replace(/[^\d]/g, '');
  if (!text) return null;
  const num = Number.parseInt(text, 10);
  return Number.isFinite(num) ? num : null;
}

function parseAddress(value) {
  const text = cleanText(value);
  if (!text) {
    return { headOfficeAddress: null, suburb: null, stateCode: null, postcode: null };
  }

  const match = text.match(/^(.*?),\s*([A-Z]{2,3}),\s*(\d{4})$/);
  if (match) {
    return {
      headOfficeAddress: text,
      suburb: cleanText(match[1]),
      stateCode: cleanText(match[2]),
      postcode: cleanText(match[3]),
    };
  }

  return {
    headOfficeAddress: text,
    suburb: null,
    stateCode: null,
    postcode: null,
  };
}

async function fetchText(url, extraHeaders = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          ...extraHeaders,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) {
        if (res.status >= 500 && attempt < FETCH_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return res.text();
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      const retryable =
        attempt < FETCH_RETRIES &&
        (/HTTP 5\d{2}/.test(message) ||
          /network/i.test(message) ||
          /timeout/i.test(message) ||
          /UND_ERR/i.test(message));
      if (!retryable) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

async function getViewConfig() {
  const html = await fetchText(BASE_PAGE_URL);
  const match = html.match(/<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not find Drupal settings on the NDIS provider register page');
  }

  const settings = JSON.parse(match[1]);
  const ajaxViews = settings.views?.ajaxViews;
  const view = ajaxViews ? Object.values(ajaxViews)[0] : null;

  if (!view) {
    throw new Error('Could not find Drupal AJAX view config for the NDIS provider register');
  }

  return {
    view,
    ajaxPageState: settings.ajaxPageState || {},
    reportDateFallback: parseResultSummary(html).reportDate || new Date().toISOString().slice(0, 10),
  };
}

async function getResumePage(status, reportDate) {
  const { data, error } = await supabase
    .from('ndis_registered_providers')
    .select('source_page_number')
    .eq('registration_status', status)
    .eq('report_date', reportDate)
    .order('source_page_number', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const maxPage = data?.[0]?.source_page_number;
  return Number.isInteger(maxPage) ? maxPage + 1 : 0;
}

async function readCheckpoint(checkpointFile) {
  if (!checkpointFile) return {};
  try {
    const raw = await fs.readFile(checkpointFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCheckpoint(checkpointFile, checkpoint) {
  if (!checkpointFile || DRY_RUN) return;
  await fs.mkdir(path.dirname(checkpointFile), { recursive: true });
  await fs.writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));
}

function buildAjaxUrl(config, status, page) {
  const params = new URLSearchParams({
    _wrapper_format: 'drupal_ajax',
    title: '',
    field_legal_name: '',
    field_abn_value: '',
    field_registration_status_value: status,
    view_name: config.view.view_name,
    view_display_id: config.view.view_display_id,
    view_args: config.view.view_args || 'all',
    view_path: config.view.view_path,
    view_base_path: config.view.view_base_path,
    view_dom_id: config.view.view_dom_id,
    pager_element: String(config.view.pager_element ?? 0),
    page: String(page),
    _drupal_ajax: '1',
  });

  for (const [key, value] of Object.entries(config.ajaxPageState)) {
    if (typeof value === 'string') {
      params.set(`ajax_page_state[${key}]`, value);
    }
  }

  return `https://www.ndiscommission.gov.au/views/ajax?${params.toString()}`;
}

function buildSearchUrl(status, page) {
  const params = new URLSearchParams({
    title: '',
    field_legal_name: '',
    field_abn_value: '',
    field_registration_status_value: status,
    page: String(page),
  });
  return `${BASE_PAGE_URL}?${params.toString()}`;
}

function parseResultSummary(text) {
  const summary = cleanText(text);
  const totalMatch = summary.match(/Showing\s+([\d,]+)\s+providers/i);
  const dateMatch = summary.match(/Data extracted on:\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i);

  return {
    totalCount: totalMatch ? parsePositiveInt(totalMatch[1]) : null,
    reportDate: dateMatch ? parseLongAuDate(dateMatch[1]) : null,
  };
}

function parseProviderRows(html, status, page) {
  const $ = cheerio.load(html);
  const { totalCount, reportDate } = parseResultSummary($('.result-summary').text());

  const rows = $('.view-content > .views-row')
    .map((_, element) => {
      const row = $(element);
      const detailHref = row.find('.see-more-link').attr('href') || '';
      const detailUrl = detailHref ? new URL(detailHref, BASE_PAGE_URL).toString() : null;
      const detailId = detailUrl ? new URL(detailUrl).searchParams.get('id') : null;
      const address = parseAddress(row.find('.views-field-field-head-office-address').text().replace(/^Head office address:\s*/i, ''));
      const website = toNull(row.find('.views-field-field-website a').attr('href') || row.find('.views-field-field-website').text().replace(/^Website:\s*/i, ''));
      const rowStatus = toNull(
        row.find('.views-field-field-registration-status .field-content').text() ||
        row.find('.views-field-field-registration-status').text().replace(/^Registration status:\s*/i, '')
      ) || status;

      if (!detailId) return null;

      return {
        report_date: reportDate,
        provider_detail_id: Number.parseInt(detailId, 10),
        provider_name: cleanText(row.find('h2.field-content').first().text()),
        legal_name: toNull(row.find('.views-field-field-legal-name .field-content').first().text()),
        abn: normalizeAbn(row.find('.views-field-field-abn').text().replace(/^ABN:\s*/i, '')),
        head_office_address: address.headOfficeAddress,
        suburb: address.suburb,
        state_code: address.stateCode,
        postcode: address.postcode,
        website,
        registration_status: rowStatus,
        source_page_url: BASE_PAGE_URL,
        source_detail_url: detailUrl,
        source_search_url: buildSearchUrl(status, page),
        source_page_number: page,
        source_summary_total: totalCount,
      };
    })
    .get()
    .filter(Boolean);

  return {
    reportDate,
    totalCount,
    rows,
  };
}

async function fetchPage(config, status, page) {
  try {
    const ajaxUrl = buildAjaxUrl(config, status, page);
    const payload = JSON.parse(await fetchText(ajaxUrl, {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE_PAGE_URL,
    }));
    const insert = payload.find((item) => item.command === 'insert');
    if (!insert?.data) {
      throw new Error(`Unexpected AJAX payload for status ${status} page ${page}`);
    }
    return parseProviderRows(insert.data, status, page);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (!/HTTP 5\d{2}/.test(message)) {
      throw error;
    }
    log(`FALLBACK ${status} page ${page + 1}: AJAX failed, trying HTML search page`);
    const html = await fetchText(buildSearchUrl(status, page), {
      Referer: BASE_PAGE_URL,
    });
    return parseProviderRows(html, status, page);
  }
}

async function upsertRows(rows) {
  if (DRY_RUN || !rows.length) {
    return;
  }

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('ndis_registered_providers')
      .upsert(batch, {
        onConflict: 'report_date,provider_detail_id',
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }
  }
}

async function runStatus(config, status, options) {
  log(`Fetching ${status} providers (page 1)...`);
  const firstPage = await fetchPage(config, status, 0);
  const totalCount = firstPage.totalCount ?? firstPage.rows.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / 10) : 0;
  const cappedPages = options.maxPages == null ? totalPages : Math.min(totalPages, options.maxPages);
  const reportDate = firstPage.reportDate || config.reportDateFallback;

  if (!reportDate) {
    throw new Error(`Could not parse report date for status ${status}`);
  }

  let effectiveStartPage = options.startPage;
  if (options.resume) {
    const resumePage = await getResumePage(status, reportDate);
    const checkpointPage = options.checkpoint?.statuses?.[status]?.reportDate === reportDate
      ? options.checkpoint.statuses[status].nextPage ?? 0
      : 0;
    effectiveStartPage = Math.max(options.startPage, resumePage, checkpointPage);
  }

  log(
    `${status}: ${totalCount.toLocaleString('en-AU')} providers across ${totalPages.toLocaleString('en-AU')} pages` +
    (effectiveStartPage > 0 ? ` (resuming from page ${effectiveStartPage + 1})` : '')
  );

  let importedRows = 0;
  const pageNumbers = [];
  if (options.pageNumbers?.length) {
    for (const page of options.pageNumbers) {
      if (page >= 0 && page < cappedPages) {
        pageNumbers.push(page);
      }
    }
  } else {
    for (let page = effectiveStartPage; page < cappedPages; page += 1) {
      pageNumbers.push(page);
    }
  }

  for (let i = 0; i < pageNumbers.length; i += options.concurrency) {
    const batchPages = pageNumbers.slice(i, i + options.concurrency);
    const batchResults = await Promise.all(batchPages.map((page) => (
      page === 0 ? Promise.resolve(firstPage) : fetchPage(config, status, page)
    )));
    const batchRows = batchResults.flatMap((result) => result.rows);
    await upsertRows(batchRows);
    importedRows += batchRows.length;
    if (options.checkpointFile) {
      options.checkpoint.statuses ||= {};
      options.checkpoint.statuses[status] = {
        reportDate,
        totalCount,
        totalPages,
        nextPage: batchPages[batchPages.length - 1] + 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCheckpoint(options.checkpointFile, options.checkpoint);
    }
    log(`${status}: imported page ${batchPages[batchPages.length - 1] + 1}/${cappedPages} (${importedRows.toLocaleString('en-AU')} rows)`);
  }

  if (options.checkpointFile) {
    options.checkpoint.statuses ||= {};
    options.checkpoint.statuses[status] = {
      reportDate,
      totalCount,
      totalPages,
      nextPage: cappedPages,
      complete: true,
      updatedAt: new Date().toISOString(),
    };
    await writeCheckpoint(options.checkpointFile, options.checkpoint);
  }

  return {
    reportDate,
    totalCount,
    totalPages,
    importedRows,
  };
}

async function main() {
  const statuses = (getArg('--statuses', DEFAULT_STATUSES.join(',')) || DEFAULT_STATUSES.join(','))
    .split(',')
    .map((value) => cleanText(value))
    .filter(Boolean);
  const concurrency = Math.max(1, Number.parseInt(getArg('--concurrency', String(DEFAULT_CONCURRENCY)), 10) || DEFAULT_CONCURRENCY);
  const maxPages = getArg('--max-pages') ? Number.parseInt(getArg('--max-pages'), 10) : null;
  const startPage = Math.max(0, Number.parseInt(getArg('--start-page', '0'), 10) || 0);
  const pageNumbers = (getArg('--pages', '') || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 0);
  const resume = process.argv.includes('--resume');
  const checkpointFile = getArg('--checkpoint-file', DEFAULT_CHECKPOINT_FILE);
  const checkpoint = await readCheckpoint(checkpointFile);

  const run = await logStart(supabase, 'import-ndis-provider-register', 'Import NDIS Provider Register');

  try {
    const config = await getViewConfig();
    let totalImported = 0;
    let totalFound = 0;
    const summaries = [];
    const errors = [];

    for (const status of statuses) {
      try {
        const summary = await runStatus(config, status, {
          concurrency,
          maxPages,
          startPage,
          pageNumbers,
          resume,
          checkpoint,
          checkpointFile,
        });
        summaries.push(summary);
        totalImported += summary.importedRows;
        totalFound += summary.totalCount;
      } catch (error) {
        const message = `[${status}] ${error.message}`;
        errors.push(message);
        log(`ERROR ${message}`);
      }
    }

    log(`Done. Imported ${totalImported.toLocaleString('en-AU')} provider rows across ${statuses.length} statuses.`);
    if (!summaries.length && errors.length) {
      throw new Error(errors.join(' | '));
    }

    await logComplete(supabase, run.id, {
      items_found: totalFound,
      items_new: totalImported,
      items_updated: 0,
      status: errors.length ? 'partial' : 'success',
      errors,
    });
  } catch (error) {
    await logFailed(supabase, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error('[import-ndis-provider-register] Fatal:', error.message);
  process.exit(1);
});
