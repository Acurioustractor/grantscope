/**
 * VIC Grants Source Plugin
 *
 * Scrapes Victorian grants from vic.gov.au/grants.
 * The VIC portal is a JS-rendered SPA, so we use Firecrawl
 * (already in deps) for scraping. Falls back to direct HTTP attempt.
 *
 * URL: https://www.vic.gov.au/grants
 */

import * as cheerio from 'cheerio';
import type { SourcePlugin, DiscoveryQuery, RawGrant } from '../types.js';

const VIC_GRANTS_URL = 'https://www.vic.gov.au/grants';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/indigenous|first nations|aboriginal|torres strait/.test(text)) cats.push('indigenous');
  if (/arts?|cultur|creative|heritage/.test(text)) cats.push('arts');
  if (/health|wellbeing|medical|hospital/.test(text)) cats.push('health');
  if (/communit/.test(text)) cats.push('community');
  if (/environment|climate|water|sustainab|conservation/.test(text)) cats.push('regenerative');
  if (/business|enterprise|economic|industry|export/.test(text)) cats.push('enterprise');
  if (/education|training|school|university/.test(text)) cats.push('education');
  if (/justice|youth/.test(text)) cats.push('justice');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/disaster|recovery|flood|bushfire/.test(text)) cats.push('disaster_relief');
  if (/research|science|innovation/.test(text)) cats.push('research');
  if (/technolog|digital/.test(text)) cats.push('technology');
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

/** Try Firecrawl first (handles JS rendering) */
async function tryFirecrawl(): Promise<RawGrant[] | null> {
  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.log('[vic-grants] No FIRECRAWL_API_KEY, skipping Firecrawl');
      return null;
    }

    const firecrawl = new FirecrawlApp({ apiKey });
    console.log('[vic-grants] Scraping with Firecrawl...');

    const result = await firecrawl.scrape(VIC_GRANTS_URL, { formats: ['markdown', 'html'] });
    const html = result.html || '';
    const markdown = result.markdown || '';

    if (!html && !markdown) return null;

    const grants: RawGrant[] = [];

    if (html) {
      const $ = cheerio.load(html);
      const seen = new Set<string>();

      $('a[href*="/grants"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const title = $el.text().trim();

        if (!title || title.length < 5) return;
        if (seen.has(title.toLowerCase())) return;
        seen.add(title.toLowerCase());

        if (href === '/grants' || !href.includes('/')) return;
        if (/privacy|contact|sitemap|login|search/i.test(title)) return;

        const fullUrl = href.startsWith('http') ? href : `https://www.vic.gov.au${href}`;
        const parentText = $el.parent().text() || '';

        grants.push({
          title: title.slice(0, 200),
          provider: 'Victorian Government',
          sourceUrl: fullUrl,
          amount: extractAmounts(parentText),
          deadline: extractDeadline(parentText),
          description: parentText.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
          categories: inferCategories(title, parentText),
          sourceId: 'vic-grants',
          geography: ['AU-VIC'],
        });
      });
    }

    // Fallback: parse markdown
    if (grants.length === 0 && markdown) {
      const lines = markdown.split('\n');
      for (const line of lines) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (!linkMatch) continue;

        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        if (title.length < 5 || !url.includes('grant')) continue;

        const fullUrl = url.startsWith('http') ? url : `https://www.vic.gov.au${url}`;

        grants.push({
          title: title.slice(0, 200),
          provider: 'Victorian Government',
          sourceUrl: fullUrl,
          categories: inferCategories(title, line),
          sourceId: 'vic-grants',
          geography: ['AU-VIC'],
        });
      }
    }

    return grants.length > 0 ? grants : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[vic-grants] Firecrawl error: ${msg}`);
    return null;
  }
}

/** Fallback: direct HTTP (may not get JS-rendered content) */
async function tryDirectHTTP(): Promise<RawGrant[]> {
  const grants: RawGrant[] = [];

  try {
    console.log('[vic-grants] Trying direct HTTP fetch...');
    const res = await fetch(VIC_GRANTS_URL, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      console.error(`[vic-grants] HTTP ${res.status}`);
      return grants;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const seen = new Set<string>();

    // Look for any grant-like links
    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const title = $el.text().trim();

      if (!title || title.length < 5) return;
      if (!/grant|fund|program|subsid/i.test(title) && !/grant|fund/i.test(href)) return;
      if (/privacy|contact|login|search|menu/i.test(title)) return;
      if (seen.has(title.toLowerCase())) return;
      seen.add(title.toLowerCase());

      const fullUrl = href.startsWith('http') ? href : `https://www.vic.gov.au${href}`;
      const parentText = $el.closest('li, div, article').text() || '';

      grants.push({
        title: title.slice(0, 200),
        provider: 'Victorian Government',
        sourceUrl: fullUrl,
        amount: extractAmounts(parentText),
        deadline: extractDeadline(parentText),
        description: parentText.replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
        categories: inferCategories(title, parentText),
        sourceId: 'vic-grants',
        geography: ['AU-VIC'],
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vic-grants] Direct fetch error: ${msg}`);
  }

  return grants;
}

export function createVICGrantsPlugin(): SourcePlugin {
  return {
    id: 'vic-grants',
    name: 'VIC Grants & Programs',
    type: 'scraper',
    geography: ['AU-VIC'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[vic-grants] Fetching Victorian grants...');

      // Try Firecrawl first (handles JS SPA), fall back to direct HTTP
      let grants = await tryFirecrawl();
      if (!grants) {
        grants = await tryDirectHTTP();
      }

      console.log(`[vic-grants] Found ${grants.length} grants`);

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

      console.log(`[vic-grants] Yielded ${yielded} grants`);
    },
  };
}
