#!/usr/bin/env node

/**
 * Discover Public Grant Finder Links
 *
 * Reads public funding-finder landing pages from source_frontier and extracts
 * public outbound grant/funding links. It does not log in, bypass paywalls, or
 * scrape subscriber-only records. Discovered public source pages are re-seeded
 * into source_frontier for monitoring and later parser work.
 *
 * Usage:
 *   node --env-file=.env scripts/discover-public-grant-finder-links.mjs
 *   node --env-file=.env scripts/discover-public-grant-finder-links.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'discover-public-grant-finder-links';
const AGENT_NAME = 'Discover Public Grant Finder Links';
const DRY_RUN = process.argv.includes('--dry-run');
const NOW = new Date().toISOString();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOURCE_DISCOVERY_PATTERNS = [
  /grant/i,
  /funding/i,
  /sponsorship/i,
  /community[-\s]?investment/i,
  /foundation/i,
  /philanthrop/i,
  /grantguru/i,
  /smartysearch/i,
  /fundingcentre/i,
];

const IGNORE_DOMAINS = new Set([
  'facebook.com',
  'www.facebook.com',
  'twitter.com',
  'x.com',
  'www.linkedin.com',
  'www.youtube.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.googletagmanager.com',
  'code.jquery.com',
]);

const IGNORE_PATH_PATTERNS = [
  /\/login\b/i,
  /\/auth\//i,
  /\/register\b/i,
  /\/membership\b/i,
  /\/dashboard\b/i,
  /\/overview\b/i,
  /\/news\b/i,
  /\/drafter\b/i,
  /\/tools-resources\b/i,
  /\/privacy\b/i,
  /\/contact\b/i,
];

function shouldIgnoreUrl(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname;
  const full = url.toLowerCase();
  if (/auth|login|logout|settings|membership|dashboard/.test(full)) return true;
  if (IGNORE_PATH_PATTERNS.some(pattern => pattern.test(pathname))) return true;
  if (parsed.hostname === 'grantguru.com' && /^\/au\/?$/.test(pathname)) return true;
  return false;
}

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function canonicalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl || /^(mailto|tel|javascript):/i.test(rawUrl)) return null;

  try {
    const url = new URL(rawUrl, baseUrl);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^oc_lang$/i.test(key) || /^OC_EA_/i.test(key) || /^utm_/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    if (![...url.searchParams.keys()].length) {
      url.search = '';
    }
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = '';
    }
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return null;
  }
}

function domainFor(url) {
  return new URL(url).hostname.toLowerCase();
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinks(html, baseUrl) {
  const links = new Map();
  const parentUrl = canonicalizeUrl(baseUrl, baseUrl);
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const url = canonicalizeUrl(match[1], baseUrl);
    if (!url) continue;
    if (url === parentUrl) continue;

    const domain = domainFor(url);
    if (IGNORE_DOMAINS.has(domain)) continue;
    if (shouldIgnoreUrl(url)) continue;

    const label = stripHtml(match[2]);
    if (/^(main|home|contact|privacy|sitemap|login|sign up|register)$/i.test(label)) continue;
    const combined = `${url} ${label}`;
    if (!SOURCE_DISCOVERY_PATTERNS.some(pattern => pattern.test(combined))) continue;

    links.set(url, {
      url,
      label,
      domain,
    });
  }

  return [...links.values()];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GrantScope/1.0 public source discovery (contact: contact@act.place)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function buildFrontierRow(link, parent) {
  return {
    source_key: `grant-source:public-discovered:${shortHash(link.url)}`,
    source_kind: 'grant_source_page',
    source_name: link.label ? `${link.label.slice(0, 120)} public grant link` : `${link.domain} public grant link`,
    target_url: link.url,
    domain: link.domain,
    parser_hint: 'public-discovered-grant-link',
    owning_agent_id: 'grantscope-discovery',
    discovery_source: 'public-discovered-grant-link',
    cadence_hours: 72,
    priority: 5,
    enabled: true,
    change_detection: 'html',
    confidence: 'discovered',
    next_check_at: NOW,
    failure_count: 0,
    metadata: {
      seeded_by: AGENT_ID,
      seeded_at: NOW,
      parent_source_key: parent.source_key,
      parent_source_name: parent.source_name,
      parent_url: parent.target_url,
      link_label: link.label,
      source_policy: 'public pages only; no subscriber or login-gated scraping',
      roles: ['public-outbound-grant-link'],
    },
    updated_at: NOW,
  };
}

async function fetchFinderSources() {
  const { data, error } = await db
    .from('source_frontier')
    .select('source_key, source_name, target_url, parser_hint')
    .eq('source_kind', 'grant_source_page')
    .eq('enabled', true)
    .in('discovery_source', ['public-funding-finder', 'public-grantguru', 'public-smartysearch', 'public-smartysearch-client']);

  if (error) throw error;
  return data || [];
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const sources = await fetchFinderSources();
    console.log(`Public finder pages to scan: ${sources.length}`);

    const rowsByKey = new Map();
    let pagesFetched = 0;
    let pageErrors = 0;

    for (const source of sources) {
      try {
        const html = await fetchText(source.target_url);
        pagesFetched++;
        const links = extractLinks(html, source.target_url);
        console.log(`- ${source.source_name}: ${links.length} public grant/funding links`);
        for (const link of links) {
          const row = buildFrontierRow(link, source);
          rowsByKey.set(row.source_key, row);
        }
      } catch (error) {
        pageErrors++;
        console.warn(`- ${source.source_name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const rows = [...rowsByKey.values()];
    console.log(`Discovered public source links: ${rows.length}`);
    for (const row of rows.slice(0, 25)) {
      console.log(`  ${row.target_url}`);
    }
    if (rows.length > 25) console.log(`  ... and ${rows.length - 25} more`);

    if (!DRY_RUN && rows.length > 0) {
      const { error: deleteError } = await db
        .from('source_frontier')
        .delete()
        .eq('source_kind', 'grant_source_page')
        .eq('metadata->>seeded_by', AGENT_ID);
      if (deleteError) throw deleteError;

      const { error } = await db
        .from('source_frontier')
        .upsert(rows, { onConflict: 'source_key' });
      if (error) throw error;
    }

    await logComplete(db, run.id, {
      items_found: pagesFetched,
      items_new: rows.length,
      items_updated: pageErrors,
    });
  } catch (error) {
    await logFailed(db, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
