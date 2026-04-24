/**
 * Brisbane City Council Grants Source Plugin
 *
 * Scrapes official Brisbane City Council grants and sponsorship pages.
 * The main landing page exposes stable internal grant category URLs.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const BRISBANE_GRANTS_URL = 'https://www.brisbane.qld.gov.au/community-support-and-safety/grants-and-sponsorship';
const BRISBANE_BASE = 'https://www.brisbane.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const BRISBANE_SEED_PATHS = [
  '/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/community-grants',
  '/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/environment-grants',
  '/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/creative-and-history-grants',
  '/community-support-and-safety/grants-and-sponsorship/sponsorship',
];

const BRISBANE_EXCLUDED_PATTERNS = [
  /\/applying-for-a-grant$/i,
  /\/grants-and-sponsorship$/i,
  /grant-register/i,
  /tips/i,
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|housing|seniors|local/.test(text)) cats.push('community');
  if (/environment|climate|sustainab|green/.test(text)) cats.push('regenerative');
  if (/creative|history|arts?|culture|heritage/.test(text)) cats.push('arts');
  if (/business|economic/.test(text)) cats.push('enterprise');
  if (/sport|recreation|safer suburbs/.test(text)) cats.push('sport');
  if (/education|training|school/.test(text)) cats.push('education');

  return [...new Set(cats)];
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
  if (upToMatch) {
    return { max: parseInt(upToMatch[1].replace(/,/g, ''), 10) };
  }

  const singleMatch = text.match(/\$([0-9,]{4,})/);
  if (singleMatch) {
    return { max: parseInt(singleMatch[1].replace(/,/g, ''), 10) };
  }

  return {};
}

function extractDeadline(text: string): string | undefined {
  const patterns = [
    /(?:applications?\s+close|closes?|closing|deadline|due)[\s:]+(?:at\s+midnight\s+on\s+)?(?:\w+\s+)?(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function toAbsoluteUrl(href: string): string | null {
  try {
    return new URL(href, BRISBANE_BASE).toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return BRISBANE_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();
  if (!pathname.startsWith('/community-support-and-safety/grants-and-sponsorship/')) return false;
  if (isIgnoredPath(pathname)) return false;
  return /grant|fund|sponsorship|apply|community|environment|creative|history/.test(haystack);
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();
  if (isIgnoredPath(pathname)) return false;

  const hasGrantSignal = /grant|fund|sponsorship/.test(text);
  const hasApplicationSignal = /apply|application|eligib|grant round|open\/apply now|funding/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(BRISBANE_GRANTS_URL);
  if (!html) return BRISBANE_SEED_PATHS.map(path => `${BRISBANE_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(BRISBANE_SEED_PATHS.map(path => `${BRISBANE_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== BRISBANE_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createBrisbaneCityGrantsPlugin(): SourcePlugin {
  return {
    id: 'brisbane-city-grants',
    name: 'Brisbane City Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[brisbane-city-grants] Scraping Brisbane City Council grants...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[brisbane-city-grants] Candidate pages: ${candidateUrls.length}`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const url of candidateUrls) {
        const html = await fetchPage(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        const pathname = new URL(url).pathname;
        const title = compressWhitespace(
          $('h1').first().text() ||
          $('meta[property="og:title"]').attr('content') ||
          $('title').text().replace(/\s*\|\s*Brisbane City Council\s*$/i, '')
        );
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          $('main p').first().text() ||
          $('#main-content p').first().text()
        );
        const bodyText = compressWhitespace(
          $('main, #main-content').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText, pathname)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const amount = extractAmounts(bodyText);
        const categories = inferCategories(title, `${description} ${bodyText}`);

        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (categories.length > 0 && !categories.some(cat => queryLower.includes(cat))) continue;
        }

        if (query.keywords?.length) {
          const text = `${title} ${description} ${bodyText}`.toLowerCase();
          if (!query.keywords.some(keyword => text.includes(keyword.toLowerCase()))) continue;
        }

        yield {
          title: title.slice(0, 200),
          provider: 'Brisbane City Council',
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline: extractDeadline(bodyText),
          description: (description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'brisbane-city-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[brisbane-city-grants] Yielded ${yielded} grants`);
    },
  };
}
