#!/usr/bin/env node
/**
 * Fetch and store the current Queensland Police watch-house custody snapshot.
 *
 * Source publishes a fixed current PDF at 6am and 6pm. This script preserves
 * history by parsing the current PDF text and upserting by generated timestamp.
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-qld-watchhouse-snapshot.mjs
 *   node --env-file=.env scripts/fetch-qld-watchhouse-snapshot.mjs --dry-run
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const QPS_PAGE_URL = 'https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data';
const QPS_PDF_URL = 'https://open-crime-data.s3.ap-southeast-2.amazonaws.com/Crime%20Statistics/Persons%20Currently%20In%20Watchhouse%20Custody.pdf';
const JINA_READER_PREFIX = 'https://r.jina.ai/http://';
const DRY_RUN = process.argv.includes('--dry-run');
const AGENT_ID = 'fetch-qld-watchhouse-snapshot';
const AGENT_NAME = 'Fetch QLD Watch-house Snapshot';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[qld-watchhouse] Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
  console.log(`[qld-watchhouse] ${message}`);
}

function normaliseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseGeneratedAt(text) {
  const generatedMatch = text.match(/Generated:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!generatedMatch) {
    throw new Error('Could not find generated timestamp in QPS watch-house PDF text');
  }

  const [, day, month, year, hour, minute] = generatedMatch;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:00`,
    generatedAt: new Date(`${year}-${month}-${day}T${hour}:${minute}:00+10:00`),
  };
}

function parseRow(line, previousWatchhouseName) {
  const cleaned = normaliseWhitespace(line);
  const match = cleaned.match(
    /^(.+?)?\s*(Adult|Child)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/,
  );
  if (!match) return null;

  const [
    ,
    rawWatchhouseName,
    ageGroup,
    total,
    male,
    female,
    otherGender,
    firstNations,
    nonIndigenous,
    otherStatus,
    zeroToTwoDays,
    threeToSevenDays,
    overSevenDays,
    longestDays,
  ] = match;

  const watchhouseName = rawWatchhouseName?.trim() || previousWatchhouseName;
  if (!watchhouseName || ['Age', 'Group', 'Custody'].includes(watchhouseName)) return null;

  return {
    watchhouse_name: watchhouseName,
    age_group: ageGroup,
    total_in_custody: Number(total),
    male: Number(male),
    female: Number(female),
    other_gender: Number(otherGender),
    first_nations: Number(firstNations),
    non_indigenous: Number(nonIndigenous),
    other_status: Number(otherStatus),
    custody_0_2_days: Number(zeroToTwoDays),
    custody_3_7_days: Number(threeToSevenDays),
    custody_over_7_days: Number(overSevenDays),
    longest_days: Number(longestDays),
  };
}

function parseSnapshotText(rawText) {
  const { date, time, generatedAt } = parseGeneratedAt(rawText);
  const rows = [];
  let previousWatchhouseName;

  for (const line of rawText.split(/\r?\n/)) {
    const row = parseRow(line, previousWatchhouseName);
    if (!row) continue;
    rows.push(row);
    previousWatchhouseName = row.watchhouse_name;
  }

  const adultTotal = rows.find((row) => row.watchhouse_name === 'Queensland' && row.age_group === 'Adult');
  const childTotal = rows.find((row) => row.watchhouse_name === 'Queensland' && row.age_group === 'Child');
  if (!adultTotal || !childTotal) {
    throw new Error('Could not find Queensland adult/child total rows in QPS watch-house PDF text');
  }

  const locationRows = rows.filter((row) => row.watchhouse_name !== 'Queensland');
  const childRows = locationRows.filter((row) => row.age_group === 'Child' && row.total_in_custody > 0);

  return {
    generatedAt,
    sourceGeneratedDate: date,
    sourceGeneratedTime: time,
    rows: locationRows,
    rawText,
    totals: {
      total_people: adultTotal.total_in_custody + childTotal.total_in_custody,
      total_adults: adultTotal.total_in_custody,
      total_children: childTotal.total_in_custody,
      adult_first_nations: adultTotal.first_nations,
      adult_non_indigenous: adultTotal.non_indigenous,
      adult_other_status: adultTotal.other_status,
      child_first_nations: childTotal.first_nations,
      child_non_indigenous: childTotal.non_indigenous,
      child_other_status: childTotal.other_status,
      adult_0_2_days: adultTotal.custody_0_2_days,
      adult_3_7_days: adultTotal.custody_3_7_days,
      adult_over_7_days: adultTotal.custody_over_7_days,
      child_0_2_days: childTotal.custody_0_2_days,
      child_3_7_days: childTotal.custody_3_7_days,
      child_over_7_days: childTotal.custody_over_7_days,
      adult_longest_days: adultTotal.longest_days,
      child_longest_days: childTotal.longest_days,
      child_watchhouse_count: childRows.length,
    },
  };
}

async function fetchSnapshot() {
  let fetchStatus = 0;
  let contentType = 'application/pdf';
  let rawPdfSha256 = null;
  try {
    const pdfResponse = await fetch(QPS_PDF_URL, {
      headers: { 'User-Agent': 'CivicGraph/1.0 QLD watch-house monitor' },
      signal: AbortSignal.timeout(20000),
    });
    if (pdfResponse.ok) {
      fetchStatus = pdfResponse.status;
      contentType = pdfResponse.headers.get('content-type') || contentType;
      const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
      rawPdfSha256 = createHash('sha256').update(pdfBytes).digest('hex');
    } else {
      log(`PDF fetch returned ${pdfResponse.status}; continuing with text extraction`);
    }
  } catch (error) {
    log(`PDF fetch failed; continuing with text extraction: ${error instanceof Error ? error.message : String(error)}`);
  }

  const textResponse = await fetch(`${JINA_READER_PREFIX}${QPS_PDF_URL}`, {
    headers: { 'User-Agent': 'CivicGraph/1.0 QLD watch-house monitor' },
    signal: AbortSignal.timeout(30000),
  });
  if (!textResponse.ok) throw new Error(`QPS PDF text extraction failed: ${textResponse.status}`);

  const parsed = parseSnapshotText(await textResponse.text());
  if (!rawPdfSha256) {
    rawPdfSha256 = createHash('sha256').update(parsed.rawText).digest('hex');
  }
  return {
    ...parsed,
    fetchStatus,
    contentType,
    rawPdfSha256,
  };
}

async function writeSnapshot(parsed) {
  const snapshotRecord = {
    source_url: QPS_PAGE_URL,
    source_pdf_url: QPS_PDF_URL,
    source_generated_at: parsed.generatedAt.toISOString(),
    source_generated_date: parsed.sourceGeneratedDate,
    source_generated_time: parsed.sourceGeneratedTime,
    fetched_at: new Date().toISOString(),
    fetch_status: parsed.fetchStatus,
    content_type: parsed.contentType,
    raw_pdf_sha256: parsed.rawPdfSha256,
    ...parsed.totals,
    raw_text: parsed.rawText,
    metadata: {
      parser: 'qld-watchhouse-pdf-v1',
      runner: 'scripts/fetch-qld-watchhouse-snapshot.mjs',
      release_cadence: '6am and 6pm daily',
      parsed_rows: parsed.rows.length,
    },
  };

  const { data: existing, error: existingError } = await db
    .from('qld_watchhouse_snapshots')
    .select('id')
    .eq('source_generated_at', snapshotRecord.source_generated_at)
    .maybeSingle();
  if (existingError) throw existingError;

  const { data: snapshot, error: snapshotError } = await db
    .from('qld_watchhouse_snapshots')
    .upsert(snapshotRecord, { onConflict: 'source_generated_at' })
    .select('id, source_generated_at')
    .single();
  if (snapshotError) throw snapshotError;

  const { error: deleteError } = await db
    .from('qld_watchhouse_snapshot_rows')
    .delete()
    .eq('snapshot_id', snapshot.id);
  if (deleteError) throw deleteError;

  const rows = parsed.rows.map((row) => ({
    snapshot_id: snapshot.id,
    source_generated_at: snapshot.source_generated_at,
    ...row,
  }));

  if (rows.length > 0) {
    const { error: rowsError } = await db.from('qld_watchhouse_snapshot_rows').insert(rows);
    if (rowsError) throw rowsError;
  }

  return { snapshotId: snapshot.id, inserted: !existing, rowCount: rows.length };
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const parsed = await fetchSnapshot();
    const write = DRY_RUN ? null : await writeSnapshot(parsed);

    log(JSON.stringify({
      dry_run: DRY_RUN,
      source_generated_at: parsed.generatedAt.toISOString(),
      total_people: parsed.totals.total_people,
      total_children: parsed.totals.total_children,
      child_first_nations: parsed.totals.child_first_nations,
      child_3_7_days: parsed.totals.child_3_7_days,
      child_over_7_days: parsed.totals.child_over_7_days,
      child_watchhouse_count: parsed.totals.child_watchhouse_count,
      parsed_location_rows: parsed.rows.length,
      write,
    }));

    if (!DRY_RUN) {
      await logComplete(db, run.id, {
        items_found: parsed.rows.length,
        items_new: write?.inserted ? 1 : 0,
        items_updated: write?.inserted ? 0 : 1,
      });
    }
  } catch (error) {
    if (!DRY_RUN) await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(`[qld-watchhouse] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
