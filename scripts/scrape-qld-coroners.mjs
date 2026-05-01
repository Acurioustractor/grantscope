#!/usr/bin/env node
/**
 * scrape-qld-coroners.mjs
 *
 * Scrapes the QLD Coroners Court "Search findings" page via Playwright
 * (the page is JS-rendered) and inserts youth-justice-relevant inquest
 * findings into qld_coroners_findings.
 *
 * Source: https://www.coronerscourt.qld.gov.au/findings-upcoming-inquests/search-findings
 *
 * Strategy:
 *   1. Headless Chromium loads the search page; the search results hydrate
 *      via JS after networkidle.
 *   2. Click the "Next" pagination control until exhausted (~10 pages
 *      observed; ~10 findings per page).
 *   3. For each finding, capture the PDF URL + parent-card text block.
 *   4. Optional: fetch each PDF via Jina Reader for body extraction +
 *      metadata regex.
 *   5. Classify by youth-justice keywords; insert with dedupe.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-coroners.mjs [--limit=20] [--dry-run] [--no-pdf]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-qld-coroners';
const AGENT_NAME = 'QLD Coroners Court Findings Scraper';
const BASE_URL = 'https://www.coronerscourt.qld.gov.au';
const SEARCH_URL = `${BASE_URL}/findings-upcoming-inquests/search-findings`;
const JINA_PREFIX = 'https://r.jina.ai/';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const NO_PDF = process.argv.includes('--no-pdf');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '40');

const YJ_KEYWORDS = [
  'youth justice', 'youth detention', 'detention centre', 'detention center',
  'watchhouse', 'watch-house', 'watch house', 'police custody', 'in custody',
  'cleveland youth', 'brisbane youth detention', 'west moreton youth',
  'wacol youth remand', 'woodford youth', 'cairns youth detention',
  'juvenile', 'aged 17', 'aged 16', 'aged 15', 'aged 14', 'aged 13', 'aged 12',
];

const CUSTODY_KEYWORDS = [
  'in custody', 'detention', 'watchhouse', 'watch-house', 'police custody',
  'remand', 'cell', 'corrective services',
];

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

function classifyFinding(title, bodySnippet = '') {
  const t = (title + ' ' + bodySnippet).toLowerCase();
  const matched = YJ_KEYWORDS.filter(k => t.includes(k));
  return {
    isYJ: matched.length > 0,
    isInCustody: CUSTODY_KEYWORDS.some(k => t.includes(k)),
    matched,
  };
}

async function fetchPdfText(sourceUrl) {
  if (NO_PDF) return null;
  const jinaUrl = `${JINA_PREFIX}${sourceUrl}`;
  try {
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'User-Agent': 'CivicGraph/1.0' },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 12000);
  } catch {
    return null;
  }
}

function extractMetadata(bodyText, title) {
  const meta = {
    deceased_identifier: null,
    age_at_death: null,
    date_of_death: null,
    finding_date: null,
    coroner_name: null,
    location: null,
    cause_of_death_summary: null,
    recommendations_count: null,
  };

  // Pull deceased identifier from title pattern "death of NAME" or "deaths of A and B"
  const deceasedMatch = title.match(/death(?:s)? of ([A-Z][^,(]{2,80}?)(?:\s*\(|$|\s+\d)/i);
  if (deceasedMatch) meta.deceased_identifier = deceasedMatch[1].trim().slice(0, 200);

  if (!bodyText) return meta;

  const ageMatch = bodyText.match(/aged\s+(\d{1,3})/i);
  if (ageMatch) meta.age_at_death = parseInt(ageMatch[1], 10);

  const dodMatch = bodyText.match(/(?:died on|died|date of death)\s+(?:on\s+)?(\d{1,2}\s+\w+\s+\d{4})/i);
  if (dodMatch) {
    const d = new Date(dodMatch[1]);
    if (!isNaN(d.getTime())) meta.date_of_death = d.toISOString().slice(0, 10);
  }

  const fdMatch = bodyText.match(/(?:findings? delivered|date of findings|delivered on)[:\s-]*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (fdMatch) {
    const d = new Date(fdMatch[1]);
    if (!isNaN(d.getTime())) meta.finding_date = d.toISOString().slice(0, 10);
  }

  const corMatch = bodyText.match(/Coroner[:\s]+(?:Mr\s+|Ms\s+|Mrs\s+|Dr\s+)?([A-Z][A-Za-z'.,\- ]{2,40})/);
  if (corMatch) meta.coroner_name = corMatch[1].trim().slice(0, 100);

  const recMatch = bodyText.match(/(\d+)\s+recommendations?/i);
  if (recMatch) meta.recommendations_count = parseInt(recMatch[1], 10);

  const causeMatch = bodyText.match(/cause of death[:\s]+([^\n.]{10,200})/i);
  if (causeMatch) meta.cause_of_death_summary = causeMatch[1].trim().slice(0, 500);

  return meta;
}

async function getExistingSourceIds() {
  const { data } = await db.from('qld_coroners_findings').select('source_id');
  return new Set((data ?? []).map(r => r.source_id));
}

async function scrapeListing() {
  let pw, browser;
  try {
    pw = await import('playwright');
    browser = await pw.chromium.launch({ headless: true });
  } catch (e) {
    log(`FATAL: Playwright not installed: ${e.message}`);
    return [];
  }

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await delay(3000);

  const seen = new Set();
  const findings = [];
  let lastCount = 0;

  for (let attempt = 0; attempt < 25; attempt++) {
    const pageFindings = await page.$$eval('a', as =>
      as.map(a => ({
        href: a.href || '',
        // The PDF link itself has text "Findings PDF, NMB"; the title is in a sibling/parent.
        // Capture parent card text — typically a heading + a date + the link.
        parent: a.closest('article, .card, li, div[class*="result"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? '',
        text: a.textContent?.trim() ?? '',
      }))
      .filter(a => a.href.includes('.pdf') && /findings|inquest/i.test(a.href))
    );

    for (const f of pageFindings) {
      if (seen.has(f.href)) continue;
      seen.add(f.href);
      findings.push(f);
    }
    log(`  page ${attempt + 1}: ${findings.length} unique findings`);
    if (findings.length === lastCount) {
      // Try clicking Next
      const nextBtn = page.locator('a:has-text("Next"), button:has-text("Next"), a[aria-label="Next"], button[aria-label="Next"]').first();
      if (await nextBtn.count() === 0) { log('  no Next button'); break; }
      const isVisible = await nextBtn.isVisible().catch(() => false);
      if (!isVisible) { log('  Next not visible'); break; }
      await nextBtn.scrollIntoViewIfNeeded();
      await nextBtn.click().catch(() => {});
      await delay(2000);
    }
    lastCount = findings.length;
    if (findings.length >= LIMIT) break;
  }

  await browser.close();
  return findings;
}

function parseTitle(parent, href) {
  // The parent text typically contains: "Inquest into the death of NAME ... DD Month YYYY ... Findings PDF"
  // Pull the "Inquest into ..." sentence
  const inquestMatch = parent.match(/((?:Non-?inquest\s+findings?|Inquest\s+(?:findings?\s+)?into\s+the\s+death(?:s)? of)[^.]{3,120})/i);
  if (inquestMatch) return inquestMatch[1].trim();
  // Fallback: derive from URL slug
  const slug = href.split('/').pop().replace(/\.pdf$/i, '').replace(/-/g, ' ');
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

async function main() {
  log(`Starting ${AGENT_NAME} (limit=${LIMIT}, dry_run=${DRY_RUN}, no_pdf=${NO_PDF})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    const findings = await scrapeListing();
    if (findings.length === 0) {
      log('No findings extracted.');
      await logComplete(db, run, { items_found: 0, items_new: 0 });
      return;
    }

    const existing = await getExistingSourceIds();
    log(`${existing.size} findings already in DB`);

    let inserted = 0, skipped = 0, failed = 0, yjFlagged = 0;

    for (const f of findings.slice(0, LIMIT)) {
      const sourceId = f.href.split('/').pop().replace(/\.pdf$/i, '');
      if (existing.has(sourceId)) { skipped++; continue; }

      const title = parseTitle(f.parent, f.href);
      const cls = classifyFinding(title, f.parent);
      if (cls.isYJ) yjFlagged++;
      const bodyText = await fetchPdfText(f.href);
      const meta = extractMetadata(bodyText ?? '', title);

      const row = {
        source_id: sourceId,
        source_url: f.href,
        title,
        ...meta,
        is_youth_justice: cls.isYJ,
        is_in_custody: cls.isInCustody,
        topics: cls.matched.slice(0, 8),
        body_text: bodyText ? bodyText.slice(0, 20000) : null,
      };

      if (DRY_RUN) {
        log(`  [DRY] ${cls.isYJ ? '★' : ' '} ${title.slice(0, 75)}${cls.matched.length ? ` · {${cls.matched.slice(0, 3).join(',')}}` : ''}`);
        inserted++;
      } else {
        const { error } = await db.from('qld_coroners_findings').insert(row);
        if (error) {
          if (!/duplicate/i.test(error.message)) log(`  insert failed: ${error.message}`);
          failed++;
        } else {
          inserted++;
        }
      }

      await delay(NO_PDF ? 100 : 800);
    }

    log(`Done. inserted=${inserted}, skipped=${skipped}, failed=${failed}, YJ-flagged=${yjFlagged}/${findings.length}`);
    await logComplete(db, run, { items_found: findings.length, items_new: inserted });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, run, e.message);
    process.exit(1);
  }
}

main();
