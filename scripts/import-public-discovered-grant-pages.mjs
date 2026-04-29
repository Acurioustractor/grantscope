#!/usr/bin/env node

/**
 * Import Public Discovered Grant Pages
 *
 * Converts suitable public grant/funding pages discovered from public finder
 * landing pages into grant_opportunities. This imports only public pages that
 * look like actual grant/funding program pages, not login-gated finder results,
 * product pages, or subscriber databases.
 *
 * Usage:
 *   node --env-file=.env scripts/import-public-discovered-grant-pages.mjs
 *   node --env-file=.env scripts/import-public-discovered-grant-pages.mjs --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'import-public-discovered-grant-pages';
const AGENT_NAME = 'Import Public Discovered Grant Pages';
const DRY_RUN = process.argv.includes('--dry-run');
const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXCLUDED_DOMAINS = new Set([
  'grantguru.com',
  'www.fundingcentre.com.au',
  'explore.fundingcentre.com.au',
  'www.miragenews.com',
  'fsccmn.com',
]);

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function titleFromHtml(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeHtml(stripHtml(h1[1]));
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return decodeHtml(stripHtml(title[1])).replace(/\s+[|–-]\s+.*$/, '').trim();
  return null;
}

function descriptionFromHtml(html) {
  const meta = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']*)["']/i)
    || html.match(/<meta\s+content=["']([^"']*)["']\s+(?:name|property)=["'](?:description|og:description)["']/i);
  if (meta) return decodeHtml(meta[1]).trim().slice(0, 1000);
  return stripHtml(html).slice(0, 700);
}

function pageTextFromHtml(html) {
  return decodeHtml(stripHtml(html));
}

function normalizeDateCandidate(value) {
  if (!value) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const monthNames = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08', sep: '09',
    sept: '09', oct: '10', nov: '11', dec: '12',
  };

  const textDate = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (textDate) {
    const month = monthNames[textDate[2].toLowerCase()];
    if (month) return `${textDate[3]}-${month}-${textDate[1].padStart(2, '0')}`;
  }

  const slashDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slashDate) {
    return `${slashDate[3]}-${slashDate[2].padStart(2, '0')}-${slashDate[1].padStart(2, '0')}`;
  }

  return null;
}

function extractDeadline(text) {
  const patterns = [
    /\b(?:closes?|closing date|applications? close|deadline|due date)\s*(?:is|:|-)?\s*([^.;\n]{0,80}?\b\d{4}\b)/i,
    /\b(?:closes?|closing date|applications? close|deadline|due date)\s*(?:is|:|-)?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const date = normalizeDateCandidate(match?.[1]);
    if (date) return date;
  }

  return null;
}

function extractAmounts(text) {
  const cleaned = text.replace(/\s+/g, ' ');
  const range = cleaned.match(/\$([0-9][0-9,]{2,})\s*(?:to|-|–)\s*\$([0-9][0-9,]{2,})/i);
  if (range) {
    return {
      amount_min: Number.parseInt(range[1].replace(/,/g, ''), 10),
      amount_max: Number.parseInt(range[2].replace(/,/g, ''), 10),
    };
  }

  const upTo = cleaned.match(/(?:up to|maximum(?: of)?|grants? of up to)\s*\$([0-9][0-9,]{2,})/i);
  if (upTo) {
    return {
      amount_min: null,
      amount_max: Number.parseInt(upTo[1].replace(/,/g, ''), 10),
    };
  }

  const single = cleaned.match(/\$([0-9][0-9,]{3,})/);
  if (single) {
    return {
      amount_min: null,
      amount_max: Number.parseInt(single[1].replace(/,/g, ''), 10),
    };
  }

  return { amount_min: null, amount_max: null };
}

function extractEligibilitySummary(text) {
  const match = text.match(/\b(?:eligib(?:le|ility)|who can apply|applicants? must|open to)\b[^.]{0,420}/i);
  return match ? match[0].trim() : null;
}

function statusFromDeadline(deadline) {
  if (!deadline) return { application_status: 'open', status: 'open' };
  return deadline < TODAY
    ? { application_status: 'closed', status: 'closed' }
    : { application_status: 'open', status: 'open' };
}

function providerFromUrl(url) {
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  return hostname
    .replace(/\.(gov|com|org|net)\.au$/i, '')
    .replace(/\.(govt|gov|com|org|net)\.nz$/i, '')
    .replace(/\.(com|org|net)$/i, '')
    .split(/[.-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferCategories(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const categories = [];
  if (/aboriginal|first nations|indigenous|torres strait/.test(text)) categories.push('indigenous');
  if (/community|volunteer|not[-\s]?for[-\s]?profit|not for profit/.test(text)) categories.push('community');
  if (/business|enterprise|startup|economic/.test(text)) categories.push('enterprise');
  if (/arts?|creative|culture|heritage|event/.test(text)) categories.push('arts');
  if (/environment|climate|sustainab|biodiversity|landcare/.test(text)) categories.push('regenerative');
  if (/health|wellbeing|disability|aged care/.test(text)) categories.push('health');
  if (/youth|justice|legal/.test(text)) categories.push('justice');
  if (/technology|digital|innovation/.test(text)) categories.push('technology');
  if (/education|school|training|scholarship/.test(text)) categories.push('education');
  return [...new Set(categories)];
}

function isCandidateSource(row) {
  const url = new URL(row.target_url);
  if (EXCLUDED_DOMAINS.has(url.hostname.toLowerCase())) return false;
  const text = `${row.target_url} ${row.source_name || ''}`.toLowerCase();
  if (!/(grant|funding|sponsorship)/.test(text)) return false;
  if (/(finder|search|database|smartysearch|grantguru)/.test(text) && !/(community-grants|arts-and-culture-grants|business-facade|economic-activation|major-grants|minor-grants)/.test(text)) {
    return false;
  }
  return true;
}

function isUsableGrantPage(title, url) {
  const text = `${title || ''} ${url}`.toLowerCase();
  const titleText = String(title || '').trim();
  if (!/(grant|funding|sponsorship)/.test(text)) return false;
  if (/^(popular searches|find a grant|city of greater geelong|grants|search grants|grants and funding|grants and financial assistance|external funding opportunities|funding opportunities|business support and grants|business events|funding opportunities|other grants and incentives)$/i.test(titleText)) return false;
  if (/(tips? for applying|grant tips|peer assessors?|independent peers panel|advisory desk|sessions and resources|about our community grants|business events, programs and grants|smartygrants)/i.test(text)) return false;
  if (/(login|sign up|membership|dashboard|database|finder|search results)/.test(text)) return false;
  return true;
}

async function markObsoleteRows(currentSourceIds) {
  const { data, error } = await db
    .from('grant_opportunities')
    .select('id, source_id, name')
    .eq('source', 'public-discovered-grant-page');

  if (error) throw error;

  const obsoleteIds = (data || [])
    .filter(row => !currentSourceIds.has(row.source_id))
    .map(row => row.id);

  if (obsoleteIds.length === 0) return 0;

  const { error: updateError } = await db
    .from('grant_opportunities')
    .update({
      status: 'duplicate',
      application_status: 'closed',
      updated_at: NOW,
    })
    .in('id', obsoleteIds);

  if (updateError) throw updateError;
  return obsoleteIds.length;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GrantScope/1.0 public grant page import (contact: contact@act.place)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchSources() {
  const { data, error } = await db
    .from('source_frontier')
    .select('source_key, source_name, target_url, metadata')
    .eq('source_kind', 'grant_source_page')
    .eq('enabled', true)
    .eq('parser_hint', 'public-discovered-grant-link');

  if (error) throw error;
  return (data || []).filter(isCandidateSource);
}

async function main() {
  const run = DRY_RUN ? { id: null } : await logStart(db, AGENT_ID, AGENT_NAME);
  try {
    const sources = await fetchSources();
    console.log(`Candidate public grant pages: ${sources.length}`);

    const rows = [];
    let fetched = 0;
    let skipped = 0;
    let errors = 0;

    for (const source of sources) {
      try {
        const html = await fetchText(source.target_url);
        fetched++;
        const title = titleFromHtml(html) || source.source_name;
        if (!isUsableGrantPage(title, source.target_url)) {
          skipped++;
          continue;
        }
        const description = descriptionFromHtml(html);
        const pageText = pageTextFromHtml(html);
        const deadline = extractDeadline(pageText);
        const amounts = extractAmounts(pageText);
        const eligibilitySummary = extractEligibilitySummary(pageText);
        const statuses = statusFromDeadline(deadline);
        rows.push({
          name: title,
          provider: providerFromUrl(source.target_url),
          url: source.target_url,
          description,
          amount_min: amounts.amount_min,
          amount_max: amounts.amount_max,
          deadline,
          closes_at: deadline,
          categories: inferCategories(title, description),
          source: 'public-discovered-grant-page',
          source_id: shortHash(source.target_url),
          grant_type: 'open_opportunity',
          application_status: statuses.application_status,
          status: statuses.status,
          requirements_summary: eligibilitySummary,
          eligibility_criteria: eligibilitySummary ? { summary: eligibilitySummary } : null,
          discovery_method: 'public-discovered-grant-page',
          sources: [{
            pluginId: 'public-discovered-grant-page',
            foundAt: NOW,
            rawUrl: source.target_url,
            confidence: 'scraped',
          }],
          metadata: {
            source_frontier_key: source.source_key,
            source_policy: 'public pages only; no subscriber or login-gated scraping',
            extracted_deadline: deadline,
            extracted_amount_min: amounts.amount_min,
            extracted_amount_max: amounts.amount_max,
            extracted_eligibility_summary: eligibilitySummary,
          },
          updated_at: NOW,
        });
      } catch (error) {
        errors++;
        console.warn(`- ${source.target_url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`Prepared public grant rows: ${rows.length} (${fetched} fetched, ${skipped} skipped, ${errors} errors)`);
    for (const row of rows) {
      const bits = [
        row.deadline ? `deadline ${row.deadline}` : null,
        row.amount_max ? `max $${row.amount_max.toLocaleString()}` : null,
      ].filter(Boolean).join(', ');
      console.log(`- ${row.name} | ${row.provider}${bits ? ` | ${bits}` : ''}`);
    }

    let upserted = 0;
    let cleaned = 0;
    if (!DRY_RUN && rows.length > 0) {
      const { error } = await db
        .from('grant_opportunities')
        .upsert(rows, { onConflict: 'name,source_id', ignoreDuplicates: false });
      if (error) throw error;
      upserted = rows.length;
      cleaned = await markObsoleteRows(new Set(rows.map(row => row.source_id)));
      if (cleaned > 0) console.log(`Marked ${cleaned} obsolete public-discovered rows as duplicate`);
    }

    await logComplete(db, run.id, {
      items_found: sources.length,
      items_new: upserted,
      items_updated: cleaned,
      errors: errors ? [`${errors} fetch/import errors`] : [],
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
