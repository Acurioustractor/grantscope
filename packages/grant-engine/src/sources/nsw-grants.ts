/**
 * NSW Grants Source Plugin
 *
 * Uses the NSW.gov.au Elasticsearch API to fetch all 468+ grants.
 * The portal exposes an internal API at /api/v1/elasticsearch/prod_content
 * used by the grant-finder frontend.
 *
 * Falls back to HTML scraping if the API is unavailable.
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const NSW_GRANTS_URL = 'https://www.nsw.gov.au/grants-and-funding';
const NSW_ES_API = 'https://www.nsw.gov.au/api/v1/elasticsearch/prod_content';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

interface NSWESHit {
  _source: {
    title?: string;
    field_body_text_processed?: string;
    field_metatag_description?: string;
    url?: string;
    field_grant_status?: string;
    field_grant_audience?: string[];
    field_grant_category?: string[];
    field_landing_page_summary?: string;
    changed?: string;
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

/** Try the internal Elasticsearch API first — structured data, fast, all grants */
async function tryElasticsearchAPI(): Promise<RawGrant[] | null> {
  try {
    console.log('[nsw-grants] Trying Elasticsearch API...');

    const grants: RawGrant[] = [];
    const PAGE_SIZE = 100;
    let from = 0;

    while (true) {
      const body = {
        index: 'prod_content',
        body: {
          from,
          size: PAGE_SIZE,
          query: {
            bool: {
              must: [
                { term: { 'content_type': 'grant_finder' } },
              ],
            },
          },
          sort: [{ changed: { order: 'desc' } }],
        },
      };

      const res = await fetch(NSW_ES_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
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
        const title = src.title || '';
        if (!title || title.length < 5) continue;

        const description = src.field_landing_page_summary ||
          src.field_metatag_description ||
          src.field_body_text_processed?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) || '';

        const url = src.url
          ? `https://www.nsw.gov.au${src.url}`
          : undefined;

        const categories = [
          ...inferCategories(title, description),
          ...(src.field_grant_category || []).map((c: string) => c.toLowerCase()),
        ];

        const amounts = extractAmounts(description);
        const deadline = extractDeadline(description);

        grants.push({
          title: title.slice(0, 200),
          provider: 'NSW Government',
          sourceUrl: url,
          amount: amounts.min || amounts.max ? amounts : undefined,
          deadline,
          description: description.slice(0, 500) || undefined,
          categories: [...new Set(categories)],
          sourceId: 'nsw-grants',
          geography: ['AU-NSW'],
        });
      }

      const total = typeof data.hits?.total === 'object'
        ? data.hits.total.value || 0
        : data.hits?.total || 0;

      from += PAGE_SIZE;
      if (from >= total || hits.length < PAGE_SIZE) break;

      // Polite delay between pages
      await new Promise(r => setTimeout(r, 300));
    }

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

      // Try ES API first (all 468+ grants), fall back to HTML scraping
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
