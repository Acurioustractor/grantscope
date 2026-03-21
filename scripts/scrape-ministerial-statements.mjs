#!/usr/bin/env node
/**
 * scrape-ministerial-statements.mjs
 *
 * Scrapes Queensland Ministerial Media Statements from statements.qld.gov.au
 * and inserts them into civic_ministerial_statements.
 *
 * Data source: https://statements.qld.gov.au
 * Format: HTML pages with JSON-LD structured data
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-ministerial-statements.mjs [--pages=5] [--dry-run] [--backfill]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'scrape-ministerial-statements';
const AGENT_NAME = 'QLD Ministerial Statements Scraper';
const BASE_URL = 'https://statements.qld.gov.au';
const JINA_PREFIX = 'https://r.jina.ai/';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const BACKFILL = process.argv.includes('--backfill');
const MAX_PAGES = parseInt(process.argv.find(a => a.startsWith('--pages='))?.split('=')[1] || '3');

// Justice/youth-justice keywords for filtering relevance
const JUSTICE_KEYWORDS = [
  'youth justice', 'juvenile', 'young offender', 'detention', 'watch house',
  'child safety', 'child protection', 'corrective services', 'prison',
  'indigenous', 'first nations', 'aboriginal', 'torres strait',
  'community safety', 'crime', 'criminal', 'sentencing', 'bail',
  'police', 'domestic violence', 'recidivism', 'rehabilitation',
  'justice reinvestment', 'closing the gap', 'funding', 'grant',
  'procurement', 'tender', 'budget', 'spending', 'million', 'billion',
  'program', 'initiative', 'strategy', 'reform', 'legislation',
  'housing', 'homelessness', 'mental health', 'drug', 'alcohol',
  'education', 'employment', 'training', 'social services',
];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Phase 1: Scrape statement listing pages ──────────────────────

async function fetchListingPage(pageIndex) {
  const url = `${BASE_URL}/?pageIndex=${pageIndex}`;
  log(`  Fetching listing page ${pageIndex}...`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
  });

  if (!res.ok) {
    log(`  Page ${pageIndex} returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  const statements = [];

  // Extract statement links — pattern: /statements/{id}
  const linkRegex = /href="\/statements\/(\d+)"/g;
  let match;
  const seen = new Set();
  while ((match = linkRegex.exec(html)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      statements.push({ source_id: match[1], source_url: `${BASE_URL}/statements/${match[1]}` });
    }
  }

  log(`  Found ${statements.length} statements on page ${pageIndex}`);
  return statements;
}

// ── Phase 2: Fetch individual statement details ──────────────────

async function fetchStatementDetail(sourceId) {
  const url = `${BASE_URL}/statements/${sourceId}`;

  // Use Jina Reader for clean markdown extraction
  const jinaUrl = `${JINA_PREFIX}${url}`;
  let html = '';
  let markdown = '';

  try {
    // Try Jina first for clean text
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)',
      },
    });
    if (jinaRes.ok) {
      markdown = await jinaRes.text();
    }
  } catch {
    // Fall back to direct HTML
  }

  // Also fetch raw HTML for JSON-LD extraction
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch {
    log(`  Failed to fetch ${sourceId}`);
    return null;
  }

  if (!html && !markdown) return null;

  // Extract JSON-LD structured data
  let jsonLd = null;
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try { jsonLd = JSON.parse(jsonLdMatch[1]); } catch { /* ignore */ }
  }

  // Extract headline
  const headline = jsonLd?.headline
    || html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]?.replace(/<[^>]*>/g, '').trim()
    || '';

  // Extract minister name from JSON-LD or meta tags
  const ministerName = extractMinisterName(html, jsonLd);

  // Extract portfolio
  const portfolio = extractPortfolio(html);

  // Extract published date
  const publishedAt = jsonLd?.datePublished
    || html.match(/datePublished['"]\s*content=['"](.*?)['"]/)?.[1]
    || null;

  // Extract body text (prefer Jina markdown, fall back to HTML extraction)
  const bodyText = markdown
    ? cleanMarkdown(markdown)
    : extractBodyText(html);

  return {
    source_id: sourceId,
    source_url: url,
    headline: headline.slice(0, 500),
    minister_name: ministerName,
    portfolio,
    published_at: publishedAt,
    body_text: bodyText,
    body_html: extractBodyHtml(html),
  };
}

function extractMinisterName(html, jsonLd) {
  // Try page content first — JSON-LD author is often just "The State of Queensland"
  const nameMatch = html.match(/The Honourable ([A-Z][a-zA-Z'-]+ [A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+)?)/);
  if (nameMatch) return `The Honourable ${nameMatch[1]}`;

  // Try meta tags
  const metaMatch = html.match(/content="The Honourable ([^"]+)"/);
  if (metaMatch) return `The Honourable ${metaMatch[1]}`;

  // Try JSON-LD author (skip generic publisher names)
  if (jsonLd?.author?.name && !jsonLd.author.name.includes('State of Queensland')) {
    return jsonLd.author.name;
  }

  return null;
}

function extractPortfolio(html) {
  // Look for portfolio/title patterns
  const portfolioMatch = html.match(/(?:Minister for|Treasurer|Premier|Attorney-General)[^<\n]*/i);
  return portfolioMatch ? portfolioMatch[0].trim().slice(0, 300) : null;
}

function extractBodyText(html) {
  // Extract main content area
  const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<div class="[^"]*content[^"]*">([\s\S]*?)<\/div>/i);

  if (!contentMatch) return '';

  return contentMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBodyHtml(html) {
  const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return match ? match[1].trim() : null;
}

function cleanMarkdown(md) {
  // Remove Jina metadata headers
  return md
    .replace(/^Title:.*\n/m, '')
    .replace(/^URL Source:.*\n/m, '')
    .replace(/^Markdown Content:.*\n/m, '')
    .trim();
}

// ── Phase 3: Extract entities for cross-linking ──────────────────

function extractEntities(text) {
  if (!text) return { amounts: [], orgs: [], programs: [], locations: [] };

  // Dollar amounts
  const amountRegex = /\$[\d,.]+\s*(?:million|billion|m|b|k)?/gi;
  const amounts = [...new Set((text.match(amountRegex) || []).map(a => a.trim()))];

  // QLD locations
  const qldLocations = [
    'Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns',
    'Toowoomba', 'Mackay', 'Rockhampton', 'Bundaberg', 'Hervey Bay',
    'Gladstone', 'Mount Isa', 'Ipswich', 'Logan', 'Redlands',
    'Moreton Bay', 'Palm Island', 'Cherbourg', 'Woorabinda', 'Yarrabah',
    'Doomadgee', 'Mornington Island', 'Thursday Island', 'Aurukun',
  ];
  const locations = qldLocations.filter(loc =>
    text.toLowerCase().includes(loc.toLowerCase())
  );

  // Program names (capitalized multi-word phrases near keywords)
  const programs = [];
  const progRegex = /(?:program|initiative|strategy|plan|scheme|fund|service)\s*(?:called|named|titled)?\s*['"]?([A-Z][A-Za-z\s-]{3,40})/gi;
  let m;
  while ((m = progRegex.exec(text)) !== null) {
    programs.push(m[1].trim());
  }

  return { amounts, orgs: [], programs, locations };
}

// ── Phase 4: Check for existing records ──────────────────────────

async function getExistingIds() {
  const { data, error } = await db
    .from('civic_ministerial_statements')
    .select('source_id');

  if (error) {
    log(`  Warning: couldn't fetch existing IDs: ${error.message}`);
    return new Set();
  }
  return new Set(data.map(r => r.source_id));
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  log(`Starting ${AGENT_NAME} (pages=${MAX_PAGES}, dry_run=${DRY_RUN}, backfill=${BACKFILL})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    // Get existing statement IDs to avoid re-scraping
    const existingIds = await getExistingIds();
    log(`${existingIds.size} statements already in DB`);

    // Phase 1: Collect statement URLs from listing pages
    let allStatements = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const stmts = await fetchListingPage(page);
      allStatements.push(...stmts);
      await delay(500); // polite rate limiting
    }

    // Deduplicate
    const uniqueMap = new Map();
    for (const s of allStatements) uniqueMap.set(s.source_id, s);
    allStatements = [...uniqueMap.values()];
    log(`Total unique statements found: ${allStatements.length}`);

    // Filter out already-scraped (unless backfill)
    const toScrape = BACKFILL
      ? allStatements
      : allStatements.filter(s => !existingIds.has(s.source_id));
    log(`New statements to scrape: ${toScrape.length}`);

    if (toScrape.length === 0) {
      log('Nothing new to scrape.');
      await logComplete(db, run.id, { items_found: allStatements.length, items_new: 0 });
      return;
    }

    // Phase 2: Fetch details for each new statement
    let inserted = 0;
    const errors = [];

    for (const stmt of toScrape) {
      try {
        const detail = await fetchStatementDetail(stmt.source_id);
        if (!detail || !detail.headline) {
          log(`  Skipped ${stmt.source_id} (no content)`);
          continue;
        }

        // Phase 3: Extract entities
        const entities = extractEntities(detail.body_text);

        const record = {
          source_id: detail.source_id,
          source_url: detail.source_url,
          headline: detail.headline,
          minister_name: detail.minister_name,
          portfolio: detail.portfolio,
          published_at: detail.published_at,
          body_text: detail.body_text,
          body_html: detail.body_html,
          mentioned_amounts: entities.amounts,
          mentioned_orgs: entities.orgs,
          mentioned_programs: entities.programs,
          mentioned_locations: entities.locations,
          jurisdiction: 'QLD',
        };

        if (DRY_RUN) {
          log(`  [DRY RUN] Would insert: ${detail.headline.slice(0, 80)}`);
          inserted++;
        } else {
          const { error } = await db
            .from('civic_ministerial_statements')
            .upsert(record, { onConflict: 'source_id' });

          if (error) {
            log(`  Error inserting ${stmt.source_id}: ${error.message}`);
            errors.push(error.message);
          } else {
            log(`  Inserted: ${detail.headline.slice(0, 80)}`);
            inserted++;
          }
        }

        await delay(800); // polite: ~1 req/sec
      } catch (err) {
        log(`  Error processing ${stmt.source_id}: ${err.message}`);
        errors.push(err.message);
      }
    }

    log(`\nDone. Inserted ${inserted}/${toScrape.length} statements.`);
    await logComplete(db, run.id, {
      items_found: allStatements.length,
      items_new: inserted,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      status: errors.length > 0 ? 'partial' : 'success',
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
