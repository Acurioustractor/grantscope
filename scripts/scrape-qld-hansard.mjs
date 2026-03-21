#!/usr/bin/env node
/**
 * scrape-qld-hansard.mjs
 *
 * Discovers and scrapes QLD Parliamentary Hansard transcripts.
 * The parliament.qld.gov.au site has restructured — we use web search
 * to discover current transcript URLs, then Jina Reader to extract content.
 *
 * Data source: Queensland Parliament (parliament.qld.gov.au)
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-hansard.mjs [--days=7] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-qld-hansard';
const AGENT_NAME = 'QLD Hansard Scraper';
const JINA_PREFIX = 'https://r.jina.ai/';
const JINA_SEARCH = 'https://s.jina.ai/';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DAYS_BACK = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '7');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// Justice-relevant keywords for filtering
const JUSTICE_KEYWORDS = [
  'youth justice', 'juvenile', 'detention', 'watch house', 'child safety',
  'corrective services', 'prison', 'indigenous', 'first nations', 'aboriginal',
  'crime', 'criminal', 'sentencing', 'bail', 'police', 'domestic violence',
  'recidivism', 'rehabilitation', 'justice reinvestment', 'closing the gap',
  'funding', 'budget', 'million', 'program', 'reform',
  'housing', 'homelessness', 'mental health', 'education', 'employment',
];

// ── Phase 1: Discover Hansard transcript URLs ────────────────────

async function discoverHansardUrls() {
  log('Phase 1: Discovering Hansard transcript URLs...');

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  const dateStr = startDate.toISOString().slice(0, 10);
  const queries = [
    `site:parliament.qld.gov.au hansard transcript ${today.getFullYear()}`,
    `site:parliament.qld.gov.au "record of proceedings" ${today.getFullYear()}`,
    `Queensland parliament hansard ${today.toLocaleString('en-AU', { month: 'long' })} ${today.getFullYear()}`,
  ];

  const urls = new Set();

  for (const query of queries) {
    try {
      // Use Jina Search (free, no API key needed)
      const searchUrl = `${JINA_SEARCH}${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)',
        },
      });

      if (res.ok) {
        const text = await res.text();
        // Extract URLs from Jina search results
        const urlRegex = /https?:\/\/[^\s"<>]+parliament\.qld\.gov\.au[^\s"<>]*/g;
        const matches = text.match(urlRegex) || [];
        for (const u of matches) {
          // Filter for hansard-like URLs
          if (u.includes('hansard') || u.includes('transcript') || u.includes('record-of-proceedings')) {
            urls.add(u.replace(/['")\]]+$/, '')); // clean trailing chars
          }
        }
      }

      await delay(1000);
    } catch (err) {
      log(`  Search error: ${err.message}`);
    }
  }

  // Also try Serper if available
  if (process.env.SERPER_API_KEY) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.SERPER_API_KEY,
        },
        body: JSON.stringify({
          q: `site:parliament.qld.gov.au hansard transcript ${today.getFullYear()}`,
          num: 10,
          gl: 'au',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        for (const result of data.organic || []) {
          if (result.link) urls.add(result.link);
        }
      }
    } catch (err) {
      log(`  Serper error: ${err.message}`);
    }
  }

  log(`  Discovered ${urls.size} potential Hansard URLs`);
  return [...urls];
}

// ── Phase 2: Fetch and parse transcript content ──────────────────

async function fetchTranscript(url) {
  log(`  Fetching: ${url}`);

  // Use Jina Reader for clean text extraction
  const jinaUrl = `${JINA_PREFIX}${url}`;
  try {
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
    return { url, text, format: 'html' };
  } catch (err) {
    log(`    Fetch error: ${err.message}`);
    return null;
  }
}

// ── Phase 3: Parse speeches from transcript text ─────────────────

function parseSpeeches(text, sourceUrl) {
  const speeches = [];

  // Extract sitting date from text
  const dateMatch = text.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  let sittingDate = null;
  if (dateMatch) {
    const months = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
                     july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
    const m = months[dateMatch[2].toLowerCase()];
    const d = dateMatch[1].padStart(2, '0');
    sittingDate = `${dateMatch[3]}-${m}-${d}`;
  }

  if (!sittingDate) {
    // Try ISO date
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) sittingDate = isoMatch[1];
  }

  // Split by speaker patterns
  // QLD Hansard typically has: "Mr SPEAKER_NAME (Electorate—Party) (Role):"
  // or "Hon. SPEAKER_NAME (Electorate—LNP) (Minister for X):"
  const speakerRegex = /(?:^|\n)(?:(?:Hon\.?\s+)?(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)\s*\(([^)]+)\)(?:\s*\(([^)]+)\))?\s*:/gm;

  let match;
  let lastEnd = 0;
  const segments = [];

  while ((match = speakerRegex.exec(text)) !== null) {
    if (segments.length > 0) {
      segments[segments.length - 1].end = match.index;
    }
    segments.push({
      name: toTitleCase(match[1]),
      meta1: match[2], // electorate—party or party
      meta2: match[3] || null, // role (if present)
      start: match.index + match[0].length,
      end: text.length,
    });
  }

  for (const seg of segments) {
    const bodyText = text.slice(seg.start, seg.end).trim();
    if (bodyText.length < 20) continue; // skip very short interjections

    // Parse electorate and party from meta1
    const metaParts = seg.meta1.split('—');
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

    // Extract subject (first line or heading before the speech)
    const firstLine = bodyText.split('\n')[0].trim();
    const subject = firstLine.length < 120 && firstLine.length > 5
      ? firstLine : null;

    speeches.push({
      sitting_date: sittingDate,
      speaker_name: seg.name,
      speaker_party: party,
      speaker_electorate: electorate,
      speaker_role: seg.meta2,
      speech_type: speechType,
      subject,
      body_text: bodyText.slice(0, 50000), // cap at 50K chars
      source_url: sourceUrl,
      source_format: 'html',
      jurisdiction: 'QLD',
    });
  }

  // If no structured speeches found, insert as one block
  if (speeches.length === 0 && text.length > 100 && sittingDate) {
    speeches.push({
      sitting_date: sittingDate,
      speaker_name: 'UNSTRUCTURED',
      speech_type: 'transcript',
      body_text: text.slice(0, 50000),
      source_url: sourceUrl,
      source_format: 'html',
      jurisdiction: 'QLD',
    });
  }

  return speeches;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Phase 4: Insert records ──────────────────────────────────────

async function insertSpeeches(speeches) {
  let inserted = 0;
  const errors = [];

  for (const speech of speeches) {
    if (!speech.sitting_date) continue;

    try {
      if (DRY_RUN) {
        log(`    [DRY RUN] ${speech.sitting_date} — ${speech.speaker_name}: ${speech.subject || '(no subject)'}`);
        inserted++;
        continue;
      }

      const { error } = await db
        .from('civic_hansard')
        .insert(speech);

      if (error) {
        if (error.code === '23505') {
          // duplicate — skip silently
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

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  log(`Starting ${AGENT_NAME} (days_back=${DAYS_BACK}, dry_run=${DRY_RUN})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    // Phase 1: Discover URLs
    const urls = await discoverHansardUrls();

    if (urls.length === 0) {
      log('No Hansard URLs discovered. Try increasing --days or check search providers.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // Phase 2 & 3: Fetch and parse each transcript
    let totalSpeeches = 0;
    let totalInserted = 0;
    const allErrors = [];

    for (const url of urls) {
      const transcript = await fetchTranscript(url);
      if (!transcript) continue;

      const speeches = parseSpeeches(transcript.text, url);
      log(`  Parsed ${speeches.length} speeches from ${url}`);
      totalSpeeches += speeches.length;

      // Phase 4: Insert
      const { inserted, errors } = await insertSpeeches(speeches);
      totalInserted += inserted;
      allErrors.push(...errors);

      await delay(1500); // be polite to Jina
    }

    log(`\nDone. Processed ${urls.length} transcripts, ${totalSpeeches} speeches, inserted ${totalInserted}.`);
    await logComplete(db, run.id, {
      items_found: totalSpeeches,
      items_new: totalInserted,
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
