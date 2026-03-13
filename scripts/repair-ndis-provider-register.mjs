#!/usr/bin/env node

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_STATUSES = ['Approved', 'Revoked', 'Banned'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanText(value) {
  return String(value ?? '').trim();
}

function getArg(name, fallback = null) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function log(message) {
  console.log(`[repair-ndis-provider-register] ${message}`);
}

async function fetchLatestStatusRows(statuses) {
  const { data: latestRows, error: latestError } = await supabase
    .from('ndis_registered_providers')
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1);

  if (latestError) {
    throw latestError;
  }

  const latestReportDate = latestRows?.[0]?.report_date || null;
  if (!latestReportDate) {
    return { latestReportDate: null, statuses: new Map() };
  }

  const rowsByStatus = new Map();

  for (const status of statuses) {
    const { count, error: countError } = await supabase
      .from('ndis_registered_providers')
      .select('provider_detail_id', { count: 'exact', head: true })
      .eq('report_date', latestReportDate)
      .eq('registration_status', status);

    if (countError) {
      throw countError;
    }

    const { data: pageRows, error: pageError } = await supabase
      .from('ndis_registered_providers')
      .select('source_page_number, source_summary_total')
      .eq('report_date', latestReportDate)
      .eq('registration_status', status)
      .order('source_page_number', { ascending: false })
      .limit(1);

    if (pageError) {
      throw pageError;
    }

    rowsByStatus.set(status, {
      rowCount: count ?? 0,
      maxPage: pageRows?.[0]?.source_page_number ?? -1,
      expectedRows: pageRows?.[0]?.source_summary_total ?? 0,
    });
  }

  return { latestReportDate, statuses: rowsByStatus };
}

async function probeStatusTotals(status) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [
        '--env-file=.env',
        'scripts/import-ndis-provider-register.mjs',
        `--statuses=${status}`,
        '--max-pages=1',
        '--dry-run',
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Dry-run probe failed for ${status}`));
        return;
      }

      const match = stdout.match(new RegExp(`${status}:\\s+([\\d,]+) providers across ([\\d,]+) pages`, 'i'));
      if (!match) {
        reject(new Error(`Could not parse dry-run output for ${status}`));
        return;
      }

      resolve({
        totalRows: Number.parseInt(match[1].replace(/,/g, ''), 10),
        totalPages: Number.parseInt(match[2].replace(/,/g, ''), 10),
      });
    });
  });
}

async function main() {
  const statuses = (getArg('--statuses', DEFAULT_STATUSES.join(',')) || DEFAULT_STATUSES.join(','))
    .split(',')
    .map((value) => cleanText(value))
    .filter(Boolean);
  const concurrency = Math.max(1, Number.parseInt(getArg('--concurrency', '4'), 10) || 4);
  const dryRun = process.argv.includes('--dry-run');

  const { latestReportDate, statuses: latestStatusRows } = await fetchLatestStatusRows(statuses);
  log(`Latest report date in DB: ${latestReportDate || 'none'}`);

  const incompleteStatuses = [];

  for (const status of statuses) {
    const expected = await probeStatusTotals(status);
    const actual = latestStatusRows.get(status) || { rowCount: 0, maxPage: -1, expectedRows: 0 };
    const importedPages = actual.maxPage + 1;
    const importedRows = actual.rowCount;
    const complete = expected.totalPages === 0 ? true : importedPages >= expected.totalPages;

    log(
      `${status}: expected ${expected.totalRows.toLocaleString('en-AU')} rows across ${expected.totalPages.toLocaleString('en-AU')} pages, ` +
      `current snapshot ${importedRows.toLocaleString('en-AU')} rows across ${Math.max(importedPages, 0).toLocaleString('en-AU')} pages`
    );

    if (!complete) {
      incompleteStatuses.push(status);
    }
  }

  if (!incompleteStatuses.length) {
    log('No incomplete statuses detected.');
    return;
  }

  log(`Incomplete statuses: ${incompleteStatuses.join(', ')}`);

  if (dryRun) {
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [
        '--env-file=.env',
        'scripts/import-ndis-provider-register.mjs',
        '--resume',
        `--concurrency=${concurrency}`,
        `--statuses=${incompleteStatuses.join(',')}`,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      }
    );

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Repair import exited with code ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(`[repair-ndis-provider-register] Fatal: ${error.message}`);
  process.exit(1);
});
