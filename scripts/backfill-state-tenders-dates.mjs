#!/usr/bin/env node
/**
 * backfill-state-tenders-dates.mjs
 *
 * The QLD departmental contract-disclosure rows in `state_tenders` (199K rows,
 * supplier ABNs present) carry NO dates at all, which makes them useless for a
 * buyer pack: you cannot show an agency its social-procurement story without
 * being able to say when any of it happened.
 *
 * The dates are recoverable. Each row's `source_url` points at the disclosure
 * file it came from, and the filename encodes the period that file covers
 * ("dcyjma-contract-disclosure-apr-may-2023.csv"). The source files themselves
 * sit behind Cloudflare, but we already stored the URLs.
 *
 * What this writes, and what it does NOT mean:
 *   published_date = the END of the period the disclosure file covers.
 *
 * That is "this contract appeared in a disclosure published as at this date".
 * It is NOT an award date, NOT a contract start, and NOT exact. `awarded_date`
 * is deliberately left null because we genuinely do not know it. Any surface
 * quoting these dates must say "disclosed as at", never "awarded on".
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-state-tenders-dates.mjs           # dry run
 *   node --env-file=.env scripts/backfill-state-tenders-dates.mjs --apply   # write
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${process.env.DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

if (!process.env.DATABASE_PASSWORD) {
  console.error('DATABASE_PASSWORD not set — run with --env-file=.env');
  process.exit(1);
}

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** Last calendar day of month m (1-indexed) in year y, as YYYY-MM-DD. */
function endOfMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Expand a 2-digit year to 4 digits. All this data is 2019+. */
function year4(y) {
  const n = parseInt(y, 10);
  return n >= 100 ? n : 2000 + n;
}

/**
 * Ordered rules, most specific first. Each returns the END of the covered
 * period plus a confidence. `low` means the filename is genuinely ambiguous
 * and a human should look before the date is used in anything outward-facing.
 */
const RULES = [
  // "18dec-2023-30apr-2024" — explicit day-month-year range
  {
    name: 'day-month-year range',
    re: new RegExp(`(\\d{1,2})(${MONTH_RE})-(\\d{4})-(\\d{1,2})(${MONTH_RE})-(\\d{4})`),
    end: (m) => {
      const day = parseInt(m[4], 10);
      const mon = MONTHS[m[5]];
      const y = year4(m[6]);
      return { date: new Date(Date.UTC(y, mon - 1, day)).toISOString().slice(0, 10), confidence: 'high' };
    },
  },
  // "dec-2021-jan-2022" — explicit month-year to month-year
  {
    name: 'month-year to month-year',
    re: new RegExp(`(${MONTH_RE})-(\\d{2,4})-(${MONTH_RE})-(\\d{2,4})`),
    end: (m) => ({ date: endOfMonth(year4(m[4]), MONTHS[m[3]]), confidence: 'high' }),
  },
  // "fy-2024-2025_oct-24", "fy-2024-2025-june-25", "fy2025-2026-jan-26"
  // Financial year with an explicit "up to this month" suffix — the suffix wins.
  {
    name: 'FY with month suffix',
    re: new RegExp(`fy-?\\d{4}-\\d{2,4}[-_](${MONTH_RE})-(\\d{2,4})`),
    end: (m) => ({ date: endOfMonth(year4(m[2]), MONTHS[m[1]]), confidence: 'high' }),
  },
  // "fy-2024-2025-q4-ytd" — YTD through a quarter of a stated FY (QLD FY = Jul-Jun)
  {
    name: 'FY quarter YTD',
    re: /fy-?(\d{4})-(\d{2,4})-q(\d)/,
    end: (m) => {
      const fyEnd = year4(m[2]);
      const q = parseInt(m[3], 10);
      // Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun
      const endMonth = [9, 12, 3, 6][q - 1];
      const y = q <= 2 ? fyEnd - 1 : fyEnd;
      return { date: endOfMonth(y, endMonth), confidence: 'high' };
    },
  },
  // "nov-24-apr-25" — 2-digit-year month range, cross-year
  {
    name: 'month-yy to month-yy',
    re: new RegExp(`(${MONTH_RE})-(\\d{2})-(${MONTH_RE})-(\\d{2})(?!\\d)`),
    end: (m) => ({ date: endOfMonth(year4(m[4]), MONTHS[m[3]]), confidence: 'high' }),
  },
  // "as-at-30th-june-2022"
  {
    name: 'as-at day month year',
    re: new RegExp(`as-at-(\\d{1,2})(?:st|nd|rd|th)?-(${MONTH_RE})-(\\d{4})`),
    end: (m) => ({
      date: new Date(Date.UTC(year4(m[3]), MONTHS[m[2]] - 1, parseInt(m[1], 10))).toISOString().slice(0, 10),
      confidence: 'high',
    }),
  },
  // "as-at-jun-2021"
  {
    name: 'as-at month year',
    re: new RegExp(`as-at-(${MONTH_RE})-(\\d{4})`),
    end: (m) => ({ date: endOfMonth(year4(m[2]), MONTHS[m[1]]), confidence: 'high' }),
  },
  // "apr-may-2023", "jul-sep-2021", "oct-mar-2023" — month range sharing one year.
  // If the end month is earlier than the start month the period crosses new year,
  // and the stated year belongs to the END month ("oct-mar-2023" = Oct 2022-Mar 2023).
  {
    name: 'month-month-year range',
    re: new RegExp(`(${MONTH_RE})-(${MONTH_RE})-(\\d{4})(?!-)`),
    end: (m) => ({ date: endOfMonth(year4(m[3]), MONTHS[m[2]]), confidence: 'high' }),
  },
  // "financial-year-2023-2024-ytd", "fy-2019-2020", "fy2022-23", "fy20-21"
  {
    name: 'financial year',
    re: /(?:financial-year-|fy-?)(\d{2,4})-(\d{2,4})/,
    end: (m) => ({ date: endOfMonth(year4(m[2]), 6), confidence: 'high' }),
  },
  // "dcsyw-contract-disclosure-2019-20", "doe-contracts-disclosure-2022-23"
  {
    name: 'bare financial year',
    re: /(?:^|[-_])(\d{4})-(\d{2})(?![\d-])/,
    end: (m) => ({ date: endOfMonth(year4(m[2]), 6), confidence: 'high' }),
  },
  // "dec2019", "june2020", "oct_2024", "apr-2024", "august-24", "jun-25"
  {
    name: 'single month',
    re: new RegExp(`(${MONTH_RE})[-_]?(\\d{2,4})(?![\\d-])`),
    end: (m) => ({ date: endOfMonth(year4(m[2]), MONTHS[m[1]]), confidence: 'high' }),
  },
  // "contract-disclosure-q1-2026" — quarter with a bare year. QLD publishes on
  // financial-year quarters, so Q1 2026 reads as FY2026 Q1 = Jul-Sep 2025. But a
  // calendar reading (Jan-Mar 2026) is defensible, so this is flagged low.
  {
    name: 'quarter with bare year',
    re: /q(\d)-(\d{4})/,
    end: (m) => {
      const q = parseInt(m[1], 10);
      const fyEnd = year4(m[2]);
      const endMonth = [9, 12, 3, 6][q - 1];
      const y = q <= 2 ? fyEnd - 1 : fyEnd;
      return { date: endOfMonth(y, endMonth), confidence: 'low' };
    },
  },
  // "qcs-disclosure-for-2020", "doe-contract-disclosure-report-2022" — bare
  // calendar year. Assume it covers to the end of that year.
  {
    name: 'bare year',
    re: /(?:^|[-_])(20\d{2})(?![\d-])/,
    end: (m) => ({ date: endOfMonth(year4(m[1]), 12), confidence: 'medium' }),
  },
];

function parsePeriodEnd(filename) {
  const f = filename.toLowerCase().replace(/\.csv$/, '');
  for (const rule of RULES) {
    const m = f.match(rule.re);
    if (m) {
      const { date, confidence } = rule.end(m);
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { date, confidence, rule: rule.name };
      }
    }
  }
  return null;
}

function runPsql(sql) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const sqlFile = `/tmp/st-dates-${stamp}.sql`;
  const outFile = `/tmp/st-dates-${stamp}.out`;
  writeFileSync(sqlFile, `\\t on\n\\a\n\\o ${outFile}\n${sql}\n\\o\n`);
  try {
    execSync(`psql "${CONN}" -v ON_ERROR_STOP=1 -f ${sqlFile}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return readFileSync(outFile, 'utf-8').trim();
  } catch (err) {
    throw new Error(`psql failed: ${err.stderr || err.message}`);
  } finally {
    try { unlinkSync(sqlFile); } catch {}
    try { unlinkSync(outFile); } catch {}
  }
}

function main() {
  console.log(`state_tenders date backfill — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const rows = runPsql(`
    SELECT source_url, COUNT(*)
    FROM state_tenders
    WHERE source LIKE 'qld_%disclosure' AND published_date IS NULL
    GROUP BY source_url ORDER BY source_url;
  `).split('\n').filter(Boolean).map((l) => {
    const [url, n] = l.split('|');
    return { url, n: Number(n), fname: url.replace(/^.*\//, '') };
  });

  if (rows.length === 0) {
    console.log('Nothing to do — no undated QLD disclosure rows.');
    return;
  }

  const parsed = [];
  const failed = [];
  for (const r of rows) {
    const p = parsePeriodEnd(r.fname);
    if (p) parsed.push({ ...r, ...p });
    else failed.push(r);
  }

  const byConfidence = { high: 0, medium: 0, low: 0 };
  let coveredRows = 0;
  for (const p of parsed) { byConfidence[p.confidence] += p.n; coveredRows += p.n; }

  console.log(`Files: ${rows.length} · parsed ${parsed.length} · unparsed ${failed.length}`);
  console.log(`Rows:  ${rows.reduce((a, r) => a + r.n, 0)} · covered ${coveredRows}`);
  console.log(`  high confidence   ${byConfidence.high}`);
  console.log(`  medium confidence ${byConfidence.medium}`);
  console.log(`  low confidence    ${byConfidence.low}  <- review before outward-facing use\n`);

  for (const p of parsed.filter((x) => x.confidence !== 'high')) {
    console.log(`  [${p.confidence}] ${p.fname} -> ${p.date}  (${p.rule})`);
  }
  if (failed.length) {
    console.log('\nUNPARSED — these stay null:');
    for (const f of failed) console.log(`  ${f.fname} (${f.n} rows)`);
  }

  if (!APPLY) {
    const show = process.argv.includes('--verbose') ? parsed.length : 12;
    console.log(`\n${show === parsed.length ? 'All' : 'Sample of'} parsed periods:`);
    for (const p of [...parsed].sort((a, b) => a.date.localeCompare(b.date)).slice(0, show)) {
      console.log(`  ${p.date}  ${p.fname.padEnd(64)} (${p.rule})`);
    }
    console.log('\nDry run — re-run with --apply to write published_date.');
    return;
  }

  const updates = parsed
    .map((p) => `UPDATE state_tenders SET published_date = '${p.date}T00:00:00Z', updated_at = now() WHERE source_url = '${p.url.replace(/'/g, "''")}' AND published_date IS NULL;`)
    .join('\n');

  runPsql(`BEGIN;\n${updates}\nCOMMIT;`);

  const after = runPsql(`
    SELECT COUNT(*) FILTER (WHERE published_date IS NOT NULL), COUNT(*)
    FROM state_tenders WHERE source LIKE 'qld_%disclosure';
  `);
  const [dated, total] = after.split('|');
  console.log(`\nDone. ${dated} of ${total} QLD disclosure rows now carry a disclosure period end.`);
}

main();
