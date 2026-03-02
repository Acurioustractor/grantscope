/**
 * NSW Grants Source Plugin
 *
 * Uses the NSW.gov.au Elasticsearch API to fetch all 1600+ grants.
 * The portal exposes an internal ES _search API at:
 *   POST /api/v1/elasticsearch/prod_content/_search
 * Filter by type: "grant" to get structured grant documents with
 * rich fields: grant_amount_max, grant_category, grant_audience, etc.
 *
 * Falls back to HTML scraping if the API is unavailable.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const NSW_GRANTS_URL = 'https://www.nsw.gov.au/grants-and-funding';
const NSW_ES_SEARCH = 'https://www.nsw.gov.au/api/v1/elasticsearch/prod_content/_search';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

interface NSWESHit {
  _source: {
    title?: string | string[];
    url?: string | string[];
    field_summary?: string | string[];
    content?: string | string[];
    grant_amount?: string | string[];
    grant_amount_max?: number | number[];
    grant_amount_single?: number | number[];
    grant_category?: string | string[];
    grant_audience?: string | string[];
    grant_is_ongoing?: boolean | boolean[];
    grant_dates_end?: string | string[];
    agency_name?: string | string[];
    name_topic?: string | string[];
    [key: string]: unknown;
  };
}

interface NSWESResponse {
  hits?: {
    total?: { value?: number } | number;
    hits?: NSWESHit[];
  };
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];
  if (/indigenous|first nations|aboriginal/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/research|science|stem/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
  if (/housing|infrastructure/.test(text)) cats.push('community');
  if (/agricult|farm|rural|regional/.test(text)) cats.push('regenerative');
  return cats;
}

function extractAmounts(text: string): { min?: number; max?: number } {
  const rangeMatch = text.match(/\$([0-9,]+)\s*(?:to|–|-)\s*\$([0-9,]+)/i);
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/,/g, ''), 10),
      max: parseInt(rangeMatch[2].replace(/,/g, ''), 10),
    };
  }
  const upToMatch = text.match(/up to \$([0-9,]+)/i);
  if (upToMatch) return { max: parseInt(upToMatch[1].replace(/,/g, ''), 10) };
  const singleMatch = text.match(/\$([0-9,]{4,})/);
  if (singleMatch) return { max: parseInt(singleMatch[1].replace(/,/g, ''), 10) };
  return {};
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /(?:closes?|closing|deadline|due|applications?\s+close)[\s:]*(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

/** Unwrap ES array fields — NSW stores most values as single-element arrays */
function unwrap(val: unknown): string {
  if (Array.isArray(val)) return String(val[0] ?? '');
  return String(val ?? '');
}

function unwrapNum(val: unknown): number | undefined {
  if (Array.isArray(val)) return typeof val[0] === 'number' ? val[0] : undefined;
  return typeof val === 'number' ? val : undefined;
}

function unwrapArr(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

/** Try the internal Elasticsearch _search API — structured data, 1600+ grants */
async function tryElasticsearchAPI(): Promise<RawGrant[] | null> {
  try {
    console.log('[nsw-grants] Trying Elasticsearch _search API...');

    const grants: RawGrant[] = [];
    const PAGE_SIZE = 200;
    let from = 0;

    while (true) {
      const body = {
        from,
        size: PAGE_SIZE,
        query: {
          term: { type: 'grant' },
        },
        sort: [{ utc_changed: { order: 'desc' } }],
        _source: [
          'title', 'url', 'field_summary', 'content',
          'grant_amount', 'grant_amount_max', 'grant_amount_single',
          'grant_category', 'grant_audience', 'grant_is_ongoing',
          'grant_dates_end', 'agency_name', 'name_topic',
        ],
      };

      const res = await fetch(NSW_ES_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
          'Accept': 'application/json',
          'Origin': 'https://www.nsw.gov.au',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.log(`[nsw-grants] ES API returned ${res.status}, falling back to HTML`);
        return null;
      }

      const data = await res.json() as NSWESResponse;
      const hits = data.hits?.hits || [];

      if (hits.length === 0) break;

      for (const hit of hits) {
        const src = hit._source;
        const title = unwrap(src.title);
        if (!title || title.length < 5) continue;

        const description = unwrap(src.field_summary) ||
          unwrap(src.content).slice(0, 500);

        const urlPath = unwrap(src.url);
        const url = urlPath ? `https://www.nsw.gov.au${urlPath}` : undefined;

        // Use structured grant amount fields when available
        const amountMax = unwrapNum(src.grant_amount_max) || unwrapNum(src.grant_amount_single);
        const amount = amountMax ? { max: amountMax } : extractAmounts(description);

        // Use structured categories from ES + inferred
        const esCategories = unwrapArr(src.grant_category).map(c => c.toLowerCase().replace(/_/g, ' '));
        const categories = [...new Set([
          ...inferCategories(title, description),
          ...esCategories,
        ])];

        // Deadline from structured field
        const endDate = unwrap(src.grant_dates_end);
        const deadline = endDate || extractDeadline(description);

        const agency = unwrap(src.agency_name);
        const provider = agency ? `NSW Government — ${agency}` : 'NSW Government';

        grants.push({
          title: title.slice(0, 200),
          provider,
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline: deadline || undefined,
          description: description.slice(0, 500) || undefined,
          categories,
          sourceId: 'nsw-grants',
          geography: ['AU-NSW'],
        });
      }

      const total = typeof data.hits?.total === 'object'
        ? (data.hits.total as { value?: number }).value || 0
        : (data.hits?.total as number) || 0;

      from += PAGE_SIZE;
      if (from >= total || hits.length < PAGE_SIZE) break;

      // Polite delay between pages
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[nsw-grants] ES API returned ${grants.length} grants`);
    return grants.length > 0 ? grants : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[nsw-grants] ES API error: ${msg}`);
    return null;
  }
}

/** Fallback: paginate through HTML listing pages */
async function scrapeHTMLPages(query: DiscoveryQuery): Promise<RawGrant[]> {
  console.log('[nsw-grants] Falling back to HTML scraping...');

  const grants: RawGrant[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < 50; page++) {
    try {
      const res = await fetch(`${NSW_GRANTS_URL}?page=${page}`, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;

      const html = await res.text();
      const $ = cheerio.load(html);

      let found = 0;

      // NSW uses card-like listing items
      $('a[href*="/grants-and-funding/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const title = $el.text().trim();

        if (!title || title.length < 5) return;
        if (seen.has(title.toLowerCase())) return;
        if (/grants-and-funding\/?$/.test(href)) return;
        if (/privacy|contact|sitemap|login/i.test(title)) return;

        seen.add(title.toLowerCase());
        found++;

        const context = $el.closest('li, div, article').text() || '';
        const fullUrl = href.startsWith('http') ? href : `https://www.nsw.gov.au${href}`;

        grants.push({
          title: title.slice(0, 200),
          provider: 'NSW Government',
          sourceUrl: fullUrl,
          amount: extractAmounts(context),
          deadline: extractDeadline(context),
          description: context.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
          categories: inferCategories(title, context),
          sourceId: 'nsw-grants',
          geography: ['AU-NSW'],
        });
      });

      if (found === 0) break;
    } catch {
      break;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return grants;
}

export function createNSWGrantsPlugin(): SourcePlugin {
  return {
    id: 'nsw-grants',
    name: 'NSW Grants & Funding',
    type: 'api',
    geography: ['AU-NSW'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[nsw-grants] Fetching NSW grants...');

      // Try ES _search API first (1600+ grants), fall back to HTML scraping
      let grants = await tryElasticsearchAPI();
      if (!grants) {
        grants = await scrapeHTMLPages(query);
      }

      console.log(`[nsw-grants] Found ${grants.length} grants`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const grant of grants) {
        const key = grant.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        if (query.categories?.length) {
          const queryLower = query.categories.map(c => c.toLowerCase());
          if (grant.categories?.length && !grant.categories.some(c => queryLower.includes(c))) continue;
        }

        if (query.keywords?.length) {
          const text = `${grant.title} ${grant.description || ''}`.toLowerCase();
          if (!query.keywords.some(k => text.includes(k.toLowerCase()))) continue;
        }

        yield grant;
        yielded++;
      }

      console.log(`[nsw-grants] Yielded ${yielded} grants`);
    },
  };
}
