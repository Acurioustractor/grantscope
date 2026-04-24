/**
 * Logan City Council Grants Source Plugin
 *
 * Scrapes official Logan City Council grant program pages.
 * The main grants page exposes direct links to each current program.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const LOGAN_GRANTS_URL = 'https://www.logan.qld.gov.au/community/grants';
const LOGAN_BASE = 'https://www.logan.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const LOGAN_SEED_PATHS = [
  '/community/grants/community-project-grants',
  '/community/grants/community-events-funding',
  '/community/grants/envirogrants',
  '/community/grants/investment-attraction-incentives-fund',
  '/community/grants/radf',
  '/community/grants/sport-and-recreation-funding',
  '/community/grants/community-benefit-fund',
  '/community/grants/tertiary-education-bursaries',
];

const LOGAN_EXCLUDED_PATTERNS = [
  /\/community\/grants$/i,
  /other-funding-opportunities/i,
  /contact/i,
  /grant-information-sessions/i,
  /help-and-resources/i,
  /recipients/i,
  /schools-and-pc-associations/i,
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|benefit|events?/.test(text)) cats.push('community');
  if (/enviro|environment|sustainab|green/.test(text)) cats.push('regenerative');
  if (/arts?|culture|heritage|radf/.test(text)) cats.push('arts');
  if (/investment|business|economic/.test(text)) cats.push('enterprise');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/youth|intergenerational|schools?|training/.test(text)) cats.push('education');

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

  const singleMatch = text.match(/\$([0-9,]{3,})/);
  if (singleMatch) {
    return { max: parseInt(singleMatch[1].replace(/,/g, ''), 10) };
  }

  return {};
}

function extractDeadline(text: string): string | undefined {
  const normalizeDateCandidate = (value: string): string => {
    return value
      .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '')
      .trim();
  };

  const closePatterns = [
    /(?:applications?\s+(?:for\s+the\s+\d{4}\/\d{4}\s+)?[^.]*?\s+close(?:d)?|closes?|closing|deadline|due)[^.\n]*?(\d{1,2}\s+\w+\s+\d{4})/i,
    /outcomes\s+(?:for[^.]*?)?\s+will\s+be\s+advised\s+by\s+(\w+\s+\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];

  for (const pattern of closePatterns) {
    const match = text.match(pattern);
    if (match) return normalizeDateCandidate(match[1]);
  }

  return undefined;
}

function inferApplicationStatus(pathname: string, bodyText: string): GrantApplicationStatus | undefined {
  const text = bodyText.toLowerCase();

  if (
    (pathname.includes('/community-project-grants') || pathname.includes('/community-events-funding')) &&
    /future rounds will open after 1 july 2026/.test(text) &&
    /applications for the 2025\/2026 .* are now closed/.test(text)
  ) {
    return 'upcoming';
  }

  if (/currently closed/.test(text)) return 'closed';

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
    const url = new URL(href, LOGAN_BASE);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return LOGAN_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();
  if (!pathname.startsWith('/community/grants/')) return false;
  if (isIgnoredPath(pathname)) return false;
  return /grant|fund|enviro|radf|benefit|investment|sport/.test(haystack);
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();
  if (isIgnoredPath(pathname)) return false;

  const hasGrantSignal = /grant|fund|enviro|radf/.test(text);
  const hasApplicationSignal = /apply|application|future rounds|outcomes|eligible|community grants policy/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(LOGAN_GRANTS_URL);
  if (!html) return LOGAN_SEED_PATHS.map(path => `${LOGAN_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(LOGAN_SEED_PATHS.map(path => `${LOGAN_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== LOGAN_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createLoganCityGrantsPlugin(): SourcePlugin {
  return {
    id: 'logan-city-grants',
    name: 'Logan City Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[logan-city-grants] Scraping Logan City Council grants...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[logan-city-grants] Candidate pages: ${candidateUrls.length}`);

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
          $('title').text().replace(/\s*\|\s*Logan City Council\s*$/i, '')
        );
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          $('main p').first().text() ||
          $('#main-content p').first().text()
        );
        const bodyText = compressWhitespace(
          $('main, #main-content, .oc-page-content').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText, pathname)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const amount = (
          pathname.includes('/community-benefit-fund') ||
          pathname.includes('/investment-attraction-incentives-fund')
        )
          ? {}
          : extractAmounts(bodyText);
        const categories = inferCategories(title, `${description} ${bodyText}`);
        const applicationStatus = inferApplicationStatus(pathname, bodyText);

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
          provider: 'Logan City Council',
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline: extractDeadline(bodyText),
          applicationStatus,
          description: (description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'logan-city-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[logan-city-grants] Yielded ${yielded} grants`);
    },
  };
}
