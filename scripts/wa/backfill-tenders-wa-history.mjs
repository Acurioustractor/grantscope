#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function arg(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

const from = arg('from');
const to = arg('to');
const apply = process.argv.includes('--apply');
if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? '')) {
  throw new Error('Usage: backfill-tenders-wa-history.mjs --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]');
}
if (from > to) throw new Error('--from must be on or before --to');

function eachDay(start, end) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const finish = new Date(`${end}T00:00:00Z`);
  while (cursor <= finish) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function portalDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function main() {
  const summary = {
    started_at: new Date().toISOString(),
    requested_from: from,
    requested_to: to,
    apply,
    complete_days: [],
    blocked_days: [],
    failed_days: [],
    contracts_discovered: 0,
    contracts_applied: 0,
  };

  for (const day of eachDay(from, to)) {
    const fetchResult = await run(process.execPath, [
      'scripts/wa/fetch-tenders-wa-history.mjs',
      `--from=${portalDate(day)}`,
      `--to=${portalDate(day)}`,
    ]);
    const manifestPath = resolve('data/wa-tenders/history', `${day}_${day}`, 'manifest.json');
    if (![0, 2].includes(fetchResult.code)) {
      summary.failed_days.push({ day, error: fetchResult.stderr.trim() || fetchResult.stdout.trim() });
      continue;
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!manifest.complete || fetchResult.code === 2) {
      summary.blocked_days.push({ day, contracts_returned: manifest.contracts.length, message: manifest.result_message });
      continue;
    }
    summary.complete_days.push({ day, contracts: manifest.contracts.length, manifest: manifestPath });
    summary.contracts_discovered += manifest.contracts.length;
    if (apply && manifest.contracts.length) {
      const ingestResult = await run(process.execPath, [
        '--env-file=.env',
        'scripts/wa/ingest-tenders-wa-history.mjs',
        `--manifest=${manifestPath}`,
        '--apply',
      ]);
      if (ingestResult.code !== 0) {
        summary.failed_days.push({ day, stage: 'detail-ingestion', error: ingestResult.stderr.trim() || ingestResult.stdout.trim() });
        summary.complete_days.pop();
        continue;
      }
      const ingestion = JSON.parse(ingestResult.stdout);
      summary.contracts_applied += ingestion.contracts;
    }
  }

  summary.finished_at = new Date().toISOString();
  const outDir = resolve('data/wa-tenders/history/backfills');
  await mkdir(outDir, { recursive: true });
  const output = resolve(outDir, `${from}_${to}.json`);
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, output }, null, 2));
  if (summary.blocked_days.length || summary.failed_days.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`[tenders-wa-backfill] ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
