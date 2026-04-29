import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const QPS_PAGE_URL = 'https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data';
const QPS_PDF_URL = 'https://open-crime-data.s3.ap-southeast-2.amazonaws.com/Crime%20Statistics/Persons%20Currently%20In%20Watchhouse%20Custody.pdf';
const JINA_READER_PREFIX = 'https://r.jina.ai/http://';

type AgeGroup = 'Adult' | 'Child';

type ParsedWatchhouseRow = {
  watchhouse_name: string;
  age_group: AgeGroup;
  total_in_custody: number;
  male: number;
  female: number;
  other_gender: number;
  first_nations: number;
  non_indigenous: number;
  other_status: number;
  custody_0_2_days: number;
  custody_3_7_days: number;
  custody_over_7_days: number;
  longest_days: number;
};

type ParsedSnapshot = {
  generatedAt: Date;
  sourceGeneratedDate: string;
  sourceGeneratedTime: string;
  totals: {
    total_people: number;
    total_adults: number;
    total_children: number;
    adult_first_nations: number;
    adult_non_indigenous: number;
    adult_other_status: number;
    child_first_nations: number;
    child_non_indigenous: number;
    child_other_status: number;
    adult_0_2_days: number;
    adult_3_7_days: number;
    adult_over_7_days: number;
    child_0_2_days: number;
    child_3_7_days: number;
    child_over_7_days: number;
    adult_longest_days: number;
    child_longest_days: number;
    child_watchhouse_count: number;
  };
  rows: ParsedWatchhouseRow[];
  rawText: string;
};

function isAuthorizedAutomationRequest(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  if (!expectedSecret) return true;
  return request.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

function normaliseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseGeneratedAt(text: string) {
  const generatedMatch = text.match(/Generated:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (generatedMatch) {
    const [, day, month, year, hour, minute] = generatedMatch;
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}:00`,
      generatedAt: new Date(`${year}-${month}-${day}T${hour}:${minute}:00+10:00`),
    };
  }

  const titleMatch = text.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{2}):(\d{2})/);
  if (!titleMatch) {
    throw new Error('Could not find generated timestamp in QPS watch-house PDF');
  }

  const [, rawDay, monthName, year, hour, minute] = titleMatch;
  const monthIndex = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(monthName.toLowerCase());
  if (monthIndex < 0) throw new Error(`Unknown generated month: ${monthName}`);

  const day = rawDay.padStart(2, '0');
  const month = String(monthIndex + 1).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:00`,
    generatedAt: new Date(`${year}-${month}-${day}T${hour}:${minute}:00+10:00`),
  };
}

function parseRow(line: string, previousWatchhouseName?: string): ParsedWatchhouseRow | null {
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
    age_group: ageGroup as AgeGroup,
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

function parseWatchhousePdfText(rawText: string): ParsedSnapshot {
  const { date, time, generatedAt } = parseGeneratedAt(rawText);
  const parsedRows: ParsedWatchhouseRow[] = [];
  let previousWatchhouseName: string | undefined;

  for (const line of rawText.split(/\r?\n/)) {
    const row = parseRow(line, previousWatchhouseName);
    if (!row) continue;
    parsedRows.push(row);
    previousWatchhouseName = row.watchhouse_name;
  }

  const adultTotal = parsedRows.find((row) => row.watchhouse_name === 'Queensland' && row.age_group === 'Adult');
  const childTotal = parsedRows.find((row) => row.watchhouse_name === 'Queensland' && row.age_group === 'Child');
  if (!adultTotal || !childTotal) {
    throw new Error('Could not find Queensland adult/child total rows in QPS watch-house PDF');
  }

  const locationRows = parsedRows.filter((row) => row.watchhouse_name !== 'Queensland');
  const childRows = locationRows.filter((row) => row.age_group === 'Child' && row.total_in_custody > 0);

  return {
    generatedAt,
    sourceGeneratedDate: date,
    sourceGeneratedTime: time,
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
    rows: locationRows,
    rawText,
  };
}

async function fetchAndParseSnapshot(): Promise<ParsedSnapshot & {
  fetchStatus: number;
  contentType: string;
  rawPdfSha256: string;
}> {
  let fetchStatus = 0;
  let contentType = 'application/pdf';
  let rawPdfSha256: string | null = null;

  try {
    const response = await fetch(QPS_PDF_URL, {
      headers: { 'User-Agent': 'CivicGraph/1.0 QLD watch-house monitor' },
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) {
      fetchStatus = response.status;
      contentType = response.headers.get('content-type') || contentType;
      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      rawPdfSha256 = createHash('sha256').update(pdfBytes).digest('hex');
    }
  } catch {
    // Fall through to text extraction; the source PDF fetch is best effort.
  }

  const textResponse = await fetch(`${JINA_READER_PREFIX}${QPS_PDF_URL}`, {
    headers: { 'User-Agent': 'CivicGraph/1.0 QLD watch-house monitor' },
    signal: AbortSignal.timeout(30000),
  });
  if (!textResponse.ok) {
    throw new Error(`QPS watch-house PDF text extraction failed: ${textResponse.status}`);
  }

  const rawText = await textResponse.text();
  const parsed = parseWatchhousePdfText(rawText);
  if (!rawPdfSha256) {
    rawPdfSha256 = createHash('sha256').update(rawText).digest('hex');
  }

  return {
    ...parsed,
    fetchStatus,
    contentType,
    rawPdfSha256,
  };
}

async function writeSnapshot(parsed: Awaited<ReturnType<typeof fetchAndParseSnapshot>>) {
  const db = getServiceSupabase();

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
      release_cadence: '6am and 6pm daily',
      parsed_rows: parsed.rows.length,
    },
  };

  const { data: existingByGeneratedAt, error: existingError } = await db
    .from('qld_watchhouse_snapshots')
    .select('id')
    .eq('source_generated_at', snapshotRecord.source_generated_at)
    .maybeSingle();

  if (existingError) throw existingError;

  const { data: snapshot, error: upsertError } = await db
    .from('qld_watchhouse_snapshots')
    .upsert(snapshotRecord, { onConflict: 'source_generated_at' })
    .select('id, source_generated_at')
    .single();

  if (upsertError) throw upsertError;

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

  return {
    snapshotId: snapshot.id,
    inserted: !existingByGeneratedAt,
    rowCount: rows.length,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAutomationRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true';

  try {
    const parsed = await fetchAndParseSnapshot();
    const writeResult = dryRun ? null : await writeSnapshot(parsed);

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      source_url: QPS_PAGE_URL,
      source_pdf_url: QPS_PDF_URL,
      source_generated_at: parsed.generatedAt.toISOString(),
      total_people: parsed.totals.total_people,
      total_adults: parsed.totals.total_adults,
      total_children: parsed.totals.total_children,
      child_first_nations: parsed.totals.child_first_nations,
      child_3_7_days: parsed.totals.child_3_7_days,
      child_over_7_days: parsed.totals.child_over_7_days,
      child_longest_days: parsed.totals.child_longest_days,
      child_watchhouse_count: parsed.totals.child_watchhouse_count,
      parsed_location_rows: parsed.rows.length,
      hash: parsed.rawPdfSha256,
      write: writeResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown watch-house refresh error',
      },
      { status: 500 },
    );
  }
}
