#!/usr/bin/env node
/**
 * scrape-ministerial-diaries.mjs
 *
 * Scrapes QLD ministerial diary PDFs from cabinet.qld.gov.au.
 * Diaries are published retrospectively (month N published end of month N+1).
 *
 * URL pattern: cabinet.qld.gov.au/assets/diary/current/{slug}/{year}/{month}/{slug}.pdf
 * Exception: 2026+ uses /assets/diary/{year}/{month}/{slug}.pdf
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-ministerial-diaries.mjs [--dry-run] [--minister=laura-gerber]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JINA_PREFIX = 'https://r.jina.ai/';
const BASE = 'https://cabinet.qld.gov.au';
const DRY_RUN = process.argv.includes('--dry-run');
const MINISTER_FILTER = process.argv.find(a => a.startsWith('--minister='))?.split('=')[1];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// Youth justice relevant ministers
const MINISTERS = [
  { slug: 'laura-gerber', name: 'Laura Gerber', portfolio: 'Minister for Youth Justice and Minister for the Prevention of Domestic and Family Violence' },
  { slug: 'amanda-camm', name: 'Amanda Camm', portfolio: 'Minister for Child Safety, Minister for Seniors and Disability Services' },
  { slug: 'david-crisafulli', name: 'David Crisafulli', portfolio: 'Premier of Queensland' },
  { slug: 'fiona-simpson', name: 'Fiona Simpson', portfolio: 'Minister for Treaty, Minister for Aboriginal and Torres Strait Islander Partnerships' },
  { slug: 'john-paul-langbroek', name: 'John-Paul Langbroek', portfolio: 'Minister for Education and the Arts' },
  { slug: 'sam-oconnor', name: "Sam O'Connor", portfolio: 'Minister for Youth, Minister for the Environment and the Great Barrier Reef' },
  { slug: 'dan-purdie', name: 'Dan Purdie', portfolio: 'Minister for Police and Community Safety' },
];

// Generate month/year combinations to try
function getMonthsToScrape() {
  const months = [];
  const now = new Date();
  // Go back 14 months (diaries published retrospectively)
  for (let i = 2; i <= 15; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear().toString(),
      month: d.toLocaleString('en-AU', { month: 'long' }).toLowerCase(),
      monthNum: (d.getMonth() + 1).toString().padStart(2, '0'),
    });
  }
  return months;
}

function buildPdfUrls(slug, year, month) {
  // Two URL patterns observed on cabinet.qld.gov.au
  return [
    `${BASE}/ministers-portfolios/assets/diary/current/${slug}/${year}/${month}/${slug}.pdf`,
    `${BASE}/ministers-portfolios/assets/diary/${year}/${month}/${slug}.pdf`,
  ];
}

// Parse diary text into meetings
function parseDiaryMeetings(text, ministerName, portfolio, year, month) {
  const meetings = [];

  // QLD diary format from Jina Reader:
  // "12 January 2026  Commissioner, Queensland Corrective Services  Portfolio Matters"
  // Dates start lines, followed by whitespace-separated org and purpose
  // Multi-line entries: org text spans multiple lines before purpose keyword

  const lines = text.split('\n');

  // Known purpose keywords (appear at end of entry)
  const PURPOSE_KEYWORDS = [
    'Portfolio Matters', 'Cabinet Meeting', 'Pre-cabinet Briefing', 'Pre -cabinet Briefing',
    'Stakeholder Engagement', 'Community Engagement', 'Official Function',
    'Government Business', 'Ministerial Event', 'Site Visit', 'Community Cabinet',
    'Budget Matters', 'Legislative Matters', 'Policy Discussion', 'Briefing',
  ];

  let currentDate = null;
  let currentOrg = [];
  let currentPurpose = null;

  function flushMeeting() {
    if (currentDate && currentOrg.length > 0 && currentPurpose) {
      const orgText = currentOrg.join(' ').replace(/\s+/g, ' ').trim();
      // Skip header rows and footnotes
      if (orgText.length > 3 && !orgText.match(/^(Date of Meeting|Name of Organisation|Purpose of Meeting|Does not include|Ministerial Diary|Minister for|The Hon)/i)) {
        meetings.push({
          minister_name: ministerName,
          portfolio,
          meeting_date: currentDate,
          quarter: `${year}-Q${Math.ceil(parseInt(month) / 3)}`,
          who_met: orgText,
          organisation: orgText,
          purpose: currentPurpose,
          meeting_type: 'in-person',
          jurisdiction: 'QLD',
          scraped_at: new Date().toISOString(),
        });
      }
    }
    currentOrg = [];
    currentPurpose = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for date at start of line
    const dateMatch = line.match(/^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);

    if (dateMatch) {
      // Flush previous meeting
      flushMeeting();

      const monthNum = new Date(`${dateMatch[2]} 1, 2000`).getMonth() + 1;
      currentDate = `${dateMatch[3]}-${monthNum.toString().padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

      // Check if date range (skip "acting" entries)
      if (line.includes('–') && line.toLowerCase().includes('acting for')) {
        currentDate = null;
        continue;
      }

      // Rest of the line after the date may contain org + purpose
      const afterDate = line.replace(/^\d{1,2}\s+\w+\s+\d{4}\s*/, '').trim();
      if (afterDate) {
        // Check if purpose keyword is in this line
        const purposeFound = PURPOSE_KEYWORDS.find(p => afterDate.includes(p));
        if (purposeFound) {
          const orgPart = afterDate.replace(purposeFound, '').trim();
          if (orgPart) currentOrg.push(orgPart);
          currentPurpose = purposeFound.replace(' -', '-');
        } else {
          currentOrg.push(afterDate);
        }
      }
      continue;
    }

    // Not a date line — could be continuation of org or purpose
    if (currentDate) {
      const purposeFound = PURPOSE_KEYWORDS.find(p => line.includes(p));
      if (purposeFound) {
        // This line has (or is) the purpose
        const orgPart = line.replace(purposeFound, '').trim();
        if (orgPart) currentOrg.push(orgPart);
        currentPurpose = purposeFound.replace(' -', '-');
        // Purpose found means end of this entry
        flushMeeting();
      } else if (line.startsWith('>') || line.startsWith('1Does not') || line.startsWith('Ministerial Diary')) {
        // Footnote or header — skip
        continue;
      } else {
        // Continuation of org/person name
        currentOrg.push(line);
      }
    }
  }

  // Flush last entry
  flushMeeting();

  return meetings;
}

async function scrapeMinister(minister) {
  const months = getMonthsToScrape();
  let totalMeetings = 0;
  let totalInserted = 0;

  log(`\n── ${minister.name} (${minister.portfolio}) ──`);

  for (const { year, month, monthNum } of months) {
    const urls = buildPdfUrls(minister.slug, year, month);
    let text = null;
    let sourceUrl = null;

    for (const url of urls) {
      try {
        // Skip HEAD — IIS returns 404 for HEAD but 200 for GET
        const jinaRes = await fetch(`${JINA_PREFIX}${url}`, {
          headers: { 'Accept': 'text/plain', 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
        });
        if (!jinaRes.ok) continue;

        const content = await jinaRes.text();
        // Check it's actual diary content, not a 404 page
        if (content.length > 200 && !content.includes("can't find the page")) {
          text = content;
          sourceUrl = url;
          break;
        }
      } catch { continue; }
    }

    if (!text || text.length < 50) {
      continue;
    }

    log(`  ${month} ${year}: ${text.length} chars`);

    const meetings = parseDiaryMeetings(text, minister.name, minister.portfolio, year, monthNum);
    totalMeetings += meetings.length;
    log(`    Parsed ${meetings.length} meetings`);

    for (const meeting of meetings) {
      meeting.source_url = sourceUrl;
      meeting.source_file = `${minister.slug}-${year}-${month}.pdf`;

      if (DRY_RUN) {
        log(`    [DRY] ${meeting.meeting_date} — ${meeting.organisation}: ${meeting.purpose}`);
        totalInserted++;
        continue;
      }

      const { error } = await db.from('civic_ministerial_diaries').insert(meeting);
      if (error) {
        if (error.code !== '23505') log(`    Insert error: ${error.message}`);
      } else {
        totalInserted++;
      }
    }

    await delay(2000); // polite to Jina
  }

  log(`  Summary: ${totalMeetings} meetings found, ${totalInserted} inserted`);
  return { meetings: totalMeetings, inserted: totalInserted };
}

async function main() {
  log(`Starting Ministerial Diary Scraper (dry_run=${DRY_RUN})`);

  const ministers = MINISTER_FILTER
    ? MINISTERS.filter(m => m.slug === MINISTER_FILTER)
    : MINISTERS;

  if (ministers.length === 0) {
    log(`No minister found for slug: ${MINISTER_FILTER}`);
    process.exit(1);
  }

  let grandTotal = { meetings: 0, inserted: 0 };

  for (const minister of ministers) {
    const result = await scrapeMinister(minister);
    grandTotal.meetings += result.meetings;
    grandTotal.inserted += result.inserted;
  }

  log(`\nDone. ${grandTotal.meetings} meetings found, ${grandTotal.inserted} inserted across ${ministers.length} ministers.`);
}

main().catch(err => { console.error(err); process.exit(1); });
