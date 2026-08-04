#!/usr/bin/env node
/**
 * Fetch GrantConnect awarded grants (GA) as CSV.
 *
 * GrantConnect has no bulk file. The documented weekly export URL
 * (/reports/gaweeklyexport) now 404s, and the data.gov.au "Grants Awarded Data"
 * resource is a link to a help page rather than a file. What does work is the
 * published-report form, which returns an xlsx and caps every search at 50,000
 * rows — the report itself says to narrow the date range and run again.
 *
 * So this walks the period in monthly windows, well inside that cap at roughly
 * 15,000 awards a month, and writes one combined CSV keyed on GA ID.
 *
 * Usage:
 *   node scripts/fetch-grantconnect-awards.mjs --from=2024-07 --to=2026-06
 *   node scripts/fetch-grantconnect-awards.mjs --from=2025-07 --to=2026-06 --out=data/grantconnect/ga-fy26.csv
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname } from 'path';

const arg = (name, fallback) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const FROM = arg('from', '2024-07');
const TO = arg('to', '2026-06');
const OUT = arg('out', 'data/grantconnect/ga-weekly-export.csv');
const TMP = 'data/grantconnect/_window.xlsx';
const COOKIES = 'data/grantconnect/_session.cookies';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const BASE = 'https://www.grants.gov.au/Reports/GaPublishedDownload';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** GrantConnect wants d-MMM-yyyy. */
function gcDate(year, month, day) {
  // Zero-padded: the report silently ignores an unpadded day and falls back to
  // the full date range, which then trips the 50,000 row cap.
  return `${String(day).padStart(2, '0')}-${MONTHS[month - 1]}-${year}`;
}

function lastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function* windows(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    yield { start: gcDate(y, m, 1), end: gcDate(y, m, lastDay(y, m)), label: `${y}-${String(m).padStart(2, '0')}` };
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
}

mkdirSync(dirname(OUT), { recursive: true });

// The download endpoint only serves a workbook to a session that has been
// through the report form. A bare GET returns an HTML error page that openpyxl
// then rejects as "not a zip file".
function startSession() {
  execFileSync('curl', ['-sSL', '-m', '120', '-A', UA, '-c', COOKIES, '-o', '/dev/null',
    'https://www.grants.gov.au/reports/gapublishedform'], { stdio: ['ignore', 'ignore', 'pipe'] });
}
startSession();

// One row per GA ID. Windows are cut on publish date so overlap is unlikely,
// but a grant can be republished and we would rather drop a duplicate than
// double-count public money.
const byGaId = new Map();
let header = null;
let windowCount = 0;
let skipped = 0;

for (const w of windows(FROM, TO)) {
  const url = `${BASE}?AgencyStatus=0&DateType=Publish&DateStart=${w.start}&DateEnd=${w.end}&IsAggregate=false`;
  process.stdout.write(`${w.label} … `);
  try {
    execFileSync('curl', ['-sSL', '-m', '600', '-A', UA, '-b', COOKIES, '-c', COOKIES,
      '-H', 'Referer: https://www.grants.gov.au/Reports/GaPublishedShow',
      '-o', TMP, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    console.log(`fetch failed: ${error.message.slice(0, 80)}`);
    skipped += 1;
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(execFileSync('python3', ['-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(${JSON.stringify(TMP)}, read_only=True)
ws = wb[wb.sheetnames[0]]
rows = ws.iter_rows(values_only=True)
header, data, capped = None, [], False
for r in rows:
    vals = [c for c in r if c is not None]
    if not header:
        if vals and isinstance(vals[0], str) and 'returned more than' in vals[0]:
            capped = True
        if len(vals) >= 6:
            header = ['' if c is None else str(c).strip() for c in r]
        continue
    if all(c is None for c in r):
        continue
    data.append(['' if c is None else str(c) for c in r])
wb.close()
print(json.dumps({'header': header, 'rows': data, 'capped': capped}))
`], { maxBuffer: 1024 * 1024 * 512 }).toString());
  } catch (error) {
    console.log(`parse failed: ${String(error.message).slice(0, 80)}`);
    skipped += 1;
    continue;
  }

  if (!parsed.header) { console.log('no header — empty window'); continue; }
  if (!header) header = parsed.header;
  // A capped window is silently incomplete, which is worse than a loud failure.
  if (parsed.capped) console.log(`WARNING: hit the 50,000 cap — narrow this window`);

  const idIndex = header.findIndex(h => h.toLowerCase() === 'ga id');
  for (const row of parsed.rows) {
    const key = idIndex >= 0 ? row[idIndex] : row.join('|');
    if (!byGaId.has(key)) byGaId.set(key, row);
  }
  windowCount += 1;
  if (!parsed.capped) console.log(`${parsed.rows.length} awards (running total ${byGaId.size})`);
}

if (!header) {
  console.error('No data retrieved.');
  process.exit(1);
}

const escape = value => {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const lines = [header.map(escape).join(',')];
for (const row of byGaId.values()) lines.push(row.map(escape).join(','));
writeFileSync(OUT, lines.join('\n'), 'utf8');

console.log(`\nwindows fetched: ${windowCount}, skipped: ${skipped}`);
console.log(`unique awards: ${byGaId.size}`);
console.log(`written: ${OUT}`);
