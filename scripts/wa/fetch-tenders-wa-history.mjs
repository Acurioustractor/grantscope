#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';

const BASE = 'https://www.tenders.wa.gov.au';
const HOME = `${BASE}/watenders/index.do?empty=Y`;
const OUT_DIR = resolve('data/wa-tenders/history');

function arg(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

const from = arg('from');
const to = arg('to');
if (!/^\d{2}\/\d{2}\/\d{4}$/.test(from ?? '') || !/^\d{2}\/\d{2}\/\d{4}$/.test(to ?? '')) {
  throw new Error('Usage: fetch-tenders-wa-history.mjs --from=DD/MM/YYYY --to=DD/MM/YYYY');
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function nonce(html) {
  const match = html.match(/var nonce = "CSRFNONCE=([A-F0-9]+)"/);
  if (!match) throw new Error('Tenders WA CSRF nonce was not found');
  return match[1];
}

function cookieHeader(response) {
  return (response.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'CivicGraph/1.0 public WA procurement evidence collector',
      ...(options.headers ?? {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return { response, text: await response.text() };
}

function parseRows(html) {
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
      awarded_date: clean(cells.eq(4).text()),
      expiry_date: clean(cells.eq(5).text()),
      value: clean(cells.eq(6).text()),
    });
  });
  return {
    rows,
    message: clean($('.searchResultsMessage').text()) || null,
    validation: clean($('span.red').text()) || null,
  };
}

async function main() {
  const home = await request(HOME);
  const cookie = cookieHeader(home.response);
  const csrf = nonce(home.text);
  const searchPageUrl = `${BASE}/watenders/contract/list.action?action=contract-search&from=search&CSRFNONCE=${csrf}`;
  const searchPage = await request(searchPageUrl, { headers: { Cookie: cookie } });
  const searchCsrf = nonce(searchPage.text);
  const body = new URLSearchParams({
    sortBy: '',
    issuingBusinessIdForSort: '',
    isSearch: 'false',
    order: '',
    bySupplierId: '',
    viaSearchButton: 'true',
    workType: 'any',
    keywords: '',
    reference: '',
    contractTitle: '',
    publicAuthorityId: '-1',
    issuingBusinessId: '-1',
    regionId: '-1',
    supplierBusinessName: '',
    unspscCode1: '',
    unspscCode2: '',
    unspscCode3: '',
    value: '',
    closingDateFromString: '',
    closingDateToString: '',
    awardDateFromString: from,
    awardDateToString: to,
    startingDateFromString: '',
    startingDateToString: '',
    app: '2',
    dcsp: '2',
    vetAct: '2',
  });
  const resultUrl = `${BASE}/watenders/contract/list.action?CSRFNONCE=${searchCsrf}&noreset=yes&action=contract-search-submit`;
  const result = await request(resultUrl, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: searchPageUrl,
    },
    body,
  });
  const parsed = parseRows(result.text);
  if (parsed.validation) throw new Error(`Tenders WA validation failed: ${parsed.validation}`);
  const truncated = /results have been reduced|too many records/i.test(parsed.message ?? '');

  const slug = `${from.split('/').reverse().join('-')}_${to.split('/').reverse().join('-')}`;
  const directory = resolve(OUT_DIR, slug);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'results.html'), result.text);
  await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify({
    fetched_at: new Date().toISOString(),
    source_url: resultUrl.replace(/CSRFNONCE=[A-F0-9]+/, 'CSRFNONCE=[session]'),
    criteria: { award_date_from: from, award_date_to: to },
    result_sha256: sha256(result.text),
    result_bytes: Buffer.byteLength(result.text),
    result_message: parsed.message,
    complete: !truncated,
    contracts: parsed.rows,
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    award_date_from: from,
    award_date_to: to,
    contracts: parsed.rows.length,
    result_message: parsed.message,
    complete: !truncated,
    manifest: resolve(directory, 'manifest.json'),
  }, null, 2));
  if (truncated) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[tenders-wa-history] ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
