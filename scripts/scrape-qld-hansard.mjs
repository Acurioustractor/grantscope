#!/usr/bin/env node
/**
 * scrape-qld-hansard.mjs
 *
 * Scrapes QLD Parliamentary Hansard transcripts from predictable PDF URLs.
 * Uses the Parliament sitting calendar API to find sitting dates, then
 * downloads weekly PDFs from documents.parliament.qld.gov.au.
 *
 * Data source: Queensland Parliament (parliament.qld.gov.au)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-hansard.mjs [--days=30] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-qld-hansard';
const AGENT_NAME = 'QLD Hansard Scraper';
const JINA_PREFIX = 'https://r.jina.ai/';
const CALENDAR_API = 'https://data.parliament.qld.gov.au/api/v1/sittingCalendar';
const PDF_BASE = 'https://documents.parliament.qld.gov.au/events/han';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DAYS_BACK = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '30');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// Justice-relevant keywords for filtering speeches
const JUSTICE_KEYWORDS = [
  'youth justice', 'juvenile', 'detention', 'watch house', 'child safety',
  'corrective services', 'prison', 'indigenous', 'first nations', 'aboriginal',
  'crime', 'criminal', 'sentencing', 'bail', 'police', 'domestic violence',
  'recidivism', 'rehabilitation', 'justice reinvestment', 'closing the gap',
  'funding', 'budget', 'million', 'program', 'reform',
  'housing', 'homelessness', 'mental health', 'education', 'employment',
];

// ── Phase 1: Get sitting dates ────────────────────────────────────

async function getSittingDates() {
  log('Phase 1: Fetching sitting dates from Parliament API...');

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  // Try the API first
  const dates = new Set();

  try {
    const res = await fetch(CALENDAR_API, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CivicGraph/1.0 (research)' },
    });

    if (res.ok) {
      const data = await res.json();
      // API returns array of sitting date objects
      for (const entry of (Array.isArray(data) ? data : data.results || [])) {
        const d = entry.date || entry.sittingDate || entry.Date;
        if (d) {
          const parsed = new Date(d);
          if (parsed >= startDate && parsed <= today) {
            dates.add(parsed.toISOString().slice(0, 10));
          }
        }
      }
    } else {
      log(`  Calendar API returned ${res.status}, falling back to date generation`);
    }
  } catch (err) {
    log(`  Calendar API error: ${err.message}, falling back to date generation`);
  }

  // Fallback: generate dates for Tue-Thu (typical sitting days) in the range
  if (dates.size === 0) {
    log('  Using generated sitting dates (Tue-Thu)...');
    const cursor = new Date(startDate);
    while (cursor <= today) {
      const dow = cursor.getDay();
      if (dow >= 2 && dow <= 4) { // Tue, Wed, Thu
        dates.add(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Check which dates we already have
  const { data: existing } = await db
    .from('civic_hansard')
    .select('sitting_date')
    .in('sitting_date', [...dates]);

  const existingDates = new Set((existing || []).map(r => r.sitting_date));
  const newDates = [...dates].filter(d => !existingDates.has(d)).sort();

  log(`  ${dates.size} potential sitting dates, ${existingDates.size} already scraped, ${newDates.length} new`);
  return newDates;
}

// ── Phase 2: Download and parse PDFs via Jina ─────────────────────

async function fetchHansardForDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const pdfUrl = `${PDF_BASE}/${year}/${year}_${month}_${day}_WEEKLY.pdf`;

  log(`  Trying: ${pdfUrl}`);

  // First check if PDF exists with a HEAD request
  try {
    const headRes = await fetch(pdfUrl, { method: 'HEAD' });
    if (!headRes.ok) {
      log(`    PDF not found (${headRes.status}), skipping`);
      return null;
    }
  } catch {
    log(`    HEAD request failed, trying Jina anyway`);
  }

  // Use Jina Reader to extract text from PDF
  try {
    const jinaUrl = `${JINA_PREFIX}${pdfUrl}`;
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)',
      },
    });

    if (!res.ok) {
      log(`    Jina returned ${res.status}`);
      return null;
    }

    const text = await res.text();
    if (text.length < 100) {
      log(`    Content too short (${text.length} chars), skipping`);
      return null;
    }

    log(`    Got ${text.length} chars`);
    return { url: pdfUrl, text, date: dateStr, format: 'pdf' };
  } catch (err) {
    log(`    Fetch error: ${err.message}`);
    return null;
  }
}

// ── Phase 3: Parse speeches from transcript text ──────────────────

function parseSpeeches(transcript) {
  const { text, url, date, format } = transcript;
  const speeches = [];

  // QLD Hansard speaker patterns:
  // "Mr SPEAKER_NAME (Electorate—Party) (Role):"
  // "Hon. NAME (Electorate—LNP) (Minister for X):"
  const speakerRegex = /(?:^|\n)(?:(?:Hon\.?\s+)?(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)\s*\(([^)]+)\)(?:\s*\(([^)]+)\))?\s*:/gm;

  let match;
  const segments = [];

  while ((match = speakerRegex.exec(text)) !== null) {
    if (segments.length > 0) {
      segments[segments.length - 1].end = match.index;
    }
    segments.push({
      name: toTitleCase(match[1]),
      meta1: match[2],
      meta2: match[3] || null,
      start: match.index + match[0].length,
      end: text.length,
    });
  }

  // Also try simpler pattern for PDF extraction:
  // "LASTNAME (Electorate):" or "LASTNAME:" followed by text
  if (segments.length === 0) {
    const simpleRegex = /(?:^|\n)\s*([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)\s*(?:\(([^)]+)\))?\s*:/gm;
    while ((match = simpleRegex.exec(text)) !== null) {
      if (match[1].length > 2 && !['THE', 'AND', 'FOR', 'BUT', 'NOT', 'THIS', 'THAT'].includes(match[1])) {
        if (segments.length > 0) {
          segments[segments.length - 1].end = match.index;
        }
        segments.push({
          name: toTitleCase(match[1]),
          meta1: match[2] || null,
          meta2: null,
          start: match.index + match[0].length,
          end: text.length,
        });
      }
    }
  }

  for (const seg of segments) {
    const bodyText = text.slice(seg.start, seg.end).trim();
    if (bodyText.length < 30) continue;

    // Parse electorate and party
    const metaParts = (seg.meta1 || '').split('—');
    const electorate = metaParts[0]?.trim() || null;
    const party = metaParts[1]?.trim() || null;

    // Determine speech type
    let speechType = 'speech';
    const lowerBody = bodyText.toLowerCase().slice(0, 200);
    if (lowerBody.includes('i ask the minister') || lowerBody.includes('my question is')) {
      speechType = 'question';
    } else if (lowerBody.includes('i table') || lowerBody.includes('i thank the member for')) {
      speechType = 'answer';
    } else if (bodyText.length < 100) {
      speechType = 'interjection';
    }

    // Extract subject
    const firstLine = bodyText.split('\n')[0].trim();
    const subject = firstLine.length < 120 && firstLine.length > 5 ? firstLine : null;

    // Check justice relevance
    const fullText = `${subject || ''} ${bodyText}`.toLowerCase();
    const isJusticeRelevant = JUSTICE_KEYWORDS.some(kw => fullText.includes(kw));

    // Only keep justice-relevant speeches to avoid flooding the DB
    if (!isJusticeRelevant) continue;

    speeches.push({
      sitting_date: date,
      speaker_name: seg.name,
      speaker_party: party,
      speaker_electorate: electorate,
      speaker_role: seg.meta2,
      speech_type: speechType,
      subject,
      body_text: bodyText.slice(0, 50000),
      source_url: url,
      source_format: format,
      jurisdiction: 'QLD',
      scraped_at: new Date().toISOString(),
    });
  }

  // If no structured speeches found, insert as one block if justice-relevant
  if (speeches.length === 0 && text.length > 100) {
    const fullLower = text.toLowerCase();
    const isRelevant = JUSTICE_KEYWORDS.some(kw => fullLower.includes(kw));
    if (isRelevant) {
      speeches.push({
        sitting_date: date,
        speaker_name: 'UNSTRUCTURED',
        speech_type: 'transcript',
        body_text: text.slice(0, 50000),
        source_url: url,
        source_format: format,
        jurisdiction: 'QLD',
        scraped_at: new Date().toISOString(),
      });
    }
  }

  return speeches;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Phase 4: Insert records ───────────────────────────────────────

async function insertSpeeches(speeches) {
  let inserted = 0;
  const errors = [];

  for (const speech of speeches) {
    if (!speech.sitting_date) continue;

    try {
      if (DRY_RUN) {
        log(`    [DRY] ${speech.sitting_date} — ${speech.speaker_name}: ${speech.subject || '(no subject)'}`);
        inserted++;
        continue;
      }

      const { error } = await db
        .from('civic_hansard')
        .insert(speech);

      if (error) {
        if (error.code === '23505') {
          // duplicate — skip
        } else {
          log(`    Insert error: ${error.message}`);
          errors.push(error.message);
        }
      } else {
        inserted++;
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { inserted, errors };
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  log(`Starting ${AGENT_NAME} (days_back=${DAYS_BACK}, dry_run=${DRY_RUN})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    // Phase 1: Get sitting dates
    const dates = await getSittingDates();

    if (dates.length === 0) {
      log('No new sitting dates to process.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // Phase 2-4: Fetch, parse, insert for each date
    let totalSpeeches = 0;
    let totalInserted = 0;
    const allErrors = [];

    for (const dateStr of dates.slice(0, 10)) { // max 10 dates per run
      const transcript = await fetchHansardForDate(dateStr);
      if (!transcript) {
        await delay(500);
        continue;
      }

      const speeches = parseSpeeches(transcript);
      log(`  Parsed ${speeches.length} justice-relevant speeches for ${dateStr}`);
      totalSpeeches += speeches.length;

      const { inserted, errors } = await insertSpeeches(speeches);
      totalInserted += inserted;
      allErrors.push(...errors);

      await delay(2000); // be polite to Jina
    }

    log(`\nDone. ${dates.length} dates checked, ${totalSpeeches} speeches found, ${totalInserted} inserted.`);
    await logComplete(db, run.id, {
      items_found: totalSpeeches,
      items_new: totalInserted,
      dates_checked: dates.length,
      errors: allErrors.length > 0 ? allErrors.slice(0, 10) : undefined,
      status: allErrors.length > 0 ? 'partial' : 'success',
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
