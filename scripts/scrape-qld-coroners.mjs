#!/usr/bin/env node
/**
 * scrape-qld-coroners.mjs
 *
 * Scrapes the QLD Coroners Court "findings" search page and inserts youth-
 * justice-relevant inquest findings into qld_coroners_findings.
 *
 * Source: https://www.coronerscourt.qld.gov.au/findings-upcoming-inquests/search-findings
 *
 * STATUS: SKELETON — the QLD Coroners Court search page is single-page-app
 * (JavaScript-rendered), so Jina + plain fetch returns "0 results" before
 * the search component hydrates. To work, this scraper needs a Playwright
 * step that performs the search (or the site's underlying search-API URL).
 * The schema, dedup, classifier, and metadata extraction below are all
 * usable — the only missing piece is the listing fetcher. See TODO below.
 *
 * Filtering: a finding is flagged is_youth_justice=true if it mentions
 *   detention / watchhouse / police custody / under-18 / youth justice /
 *   the named QLD detention centres / Brisbane City Watchhouse / etc.
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-qld-coroners.mjs [--limit=10] [--dry-run]
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
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '20');

const YJ_KEYWORDS = [
  'youth justice', 'youth detention', 'detention centre', 'detention center',
  'watchhouse', 'watch-house', 'watch house', 'police custody', 'in custody',
  'cleveland youth', 'brisbane youth detention', 'west moreton youth',
  'wacol youth remand', 'woodford youth', 'cairns youth detention',
  'juvenile', 'aged 17', 'aged 16', 'aged 15', 'aged 14', 'aged 13', 'aged 12',
  'school student', 'youth', 'aboriginal child', 'indigenous child',
];

const CUSTODY_KEYWORDS = [
  'in custody', 'detention', 'watchhouse', 'watch-house', 'police custody',
  'remand', 'cell', 'corrective services',
];

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Phase 1: fetch the search/listing page via Jina (clean markdown) ───

async function fetchListing() {
  const url = `${JINA_PREFIX}${SEARCH_URL}`;
  log(`Fetching findings listing via Jina...`);
  const res = await fetch(url, {
    headers: { 'Accept': 'text/plain', 'User-Agent': 'CivicGraph/1.0 (research; civicgraph.au)' },
  });
  if (!res.ok) {
    log(`  Listing returned ${res.status}`);
    return [];
  }
  const md = await res.text();

  // Extract finding entries — Jina gives us markdown links like
  // [Inquest into the death of XYZ](https://www.coronerscourt.qld.gov.au/__data/assets/pdf_file/.../filename.pdf)
  const linkRegex = /\[([^\]]+?(?:death of|Inquest into|Inquest finding)[^\]]+?)\]\((https:\/\/[^)]+\.pdf)\)/gi;
  const findings = [];
  const seen = new Set();
  let m;
  while ((m = linkRegex.exec(md)) !== null) {
    const title = m[1].replace(/\s+/g, ' ').trim();
    const url = m[2];
    const sourceId = url.split('/').pop().replace(/\.pdf$/i, '');
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    findings.push({ source_id: sourceId, source_url: url, title });
  }
  log(`  Found ${findings.length} findings on listing page`);
  return findings.slice(0, LIMIT);
}

// ── Phase 2: classify each finding by YJ-relevance from title ──────────

function classifyFinding(title) {
  const t = title.toLowerCase();
  const matched = YJ_KEYWORDS.filter(k => t.includes(k));
  const isYJ = matched.length > 0;
  const isInCustody = CUSTODY_KEYWORDS.some(k => t.includes(k));
  return { isYJ, isInCustody, matched };
}

// ── Phase 3: extract minimal metadata from PDF via Jina ────────────────

async function fetchFindingDetail(sourceUrl) {
  // Jina can extract text from PDFs too
  const jinaUrl = `${JINA_PREFIX}${sourceUrl}`;
  try {
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'User-Agent': 'CivicGraph/1.0' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 10000); // first 10K chars; enough for headline + circumstances
  } catch (e) {
    log(`  Failed to fetch detail: ${e.message}`);
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
  if (!bodyText) return meta;

  // Deceased identifier — usually appears as "death of [Name]" in title or first paragraph
  const deceasedMatch = title.match(/death of ([A-Z][A-Z\s.,'-]+(?:[A-Z]\.|jr\.|sr\.)?)/i)
    || bodyText.match(/INQUEST INTO THE DEATH OF\s+([A-Z][A-Z\s.,'-]+)\s/);
  if (deceasedMatch) meta.deceased_identifier = deceasedMatch[1].trim().slice(0, 200);

  // Age
  const ageMatch = bodyText.match(/aged\s+(\d{1,3})/i);
  if (ageMatch) meta.age_at_death = parseInt(ageMatch[1], 10);

  // Date of death
  const dodMatch = bodyText.match(/died on\s+(\d{1,2}\s+\w+\s+\d{4})/i)
    || bodyText.match(/death.*?on\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (dodMatch) {
    const d = new Date(dodMatch[1]);
    if (!isNaN(d.getTime())) meta.date_of_death = d.toISOString().slice(0, 10);
  }

  // Finding/inquest date — often "Findings delivered on" or "Date of findings"
  const fdMatch = bodyText.match(/(?:findings? delivered|date of findings|delivered on)\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (fdMatch) {
    const d = new Date(fdMatch[1]);
    if (!isNaN(d.getTime())) meta.finding_date = d.toISOString().slice(0, 10);
  }

  // Coroner
  const corMatch = bodyText.match(/Coroner\s+([A-Z][A-Za-z'.,\- ]{2,40})/);
  if (corMatch) meta.coroner_name = corMatch[1].trim().slice(0, 100);

  // Recommendations count
  const recMatch = bodyText.match(/(\d+)\s+recommendations?/i);
  if (recMatch) meta.recommendations_count = parseInt(recMatch[1], 10);

  return meta;
}

// ── Phase 4: dedup + insert ────────────────────────────────────────────

async function getExistingSourceIds() {
  const { data } = await db.from('qld_coroners_findings').select('source_id');
  return new Set((data ?? []).map(r => r.source_id));
}

async function main() {
  log(`Starting ${AGENT_NAME} (limit=${LIMIT}, dry_run=${DRY_RUN})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const findings = await fetchListing();
    if (findings.length === 0) {
      log('No findings extracted from listing — page structure may have changed.');
      await logComplete(db, run, { items_found: 0, items_new: 0 });
      return;
    }

    const existing = await getExistingSourceIds();
    log(`${existing.size} findings already in DB`);

    for (const f of findings) {
      if (existing.has(f.source_id)) { skipped++; continue; }

      const cls = classifyFinding(f.title);
      const bodyText = await fetchFindingDetail(f.source_url);
      const meta = extractMetadata(bodyText ?? '', f.title);

      const row = {
        source_id: f.source_id,
        source_url: f.source_url,
        title: f.title,
        ...meta,
        is_youth_justice: cls.isYJ,
        is_in_custody: cls.isInCustody,
        topics: cls.matched.slice(0, 8),
        body_text: bodyText ? bodyText.slice(0, 20000) : null,
      };

      if (DRY_RUN) {
        log(`  [DRY] would insert: ${f.title.slice(0, 60)} · YJ=${cls.isYJ} · custody=${cls.isInCustody}`);
        inserted++;
      } else {
        const { error } = await db.from('qld_coroners_findings').insert(row);
        if (error) {
          log(`  insert failed: ${error.message}`);
          failed++;
        } else {
          inserted++;
        }
      }

      await delay(800); // polite rate-limit (PDF fetches via Jina are slow)
    }

    log(`Done. inserted=${inserted}, skipped=${skipped}, failed=${failed}`);
    await logComplete(db, run, { items_found: findings.length, items_new: inserted });
  } catch (e) {
    log(`FATAL: ${e.message}`);
    await logFailed(db, run, e.message);
    process.exit(1);
  }
}

main();
