/**
 * City of Darwin Grants Source Plugin
 *
 * Scrapes official City of Darwin funding pages for current grant and sponsorship programs.
 * The landing page exposes direct links to stable program pages in server-rendered HTML.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const DARWIN_GRANTS_URL = 'https://www.darwin.nt.gov.au/community/programs/funding-opportunities';
const DARWIN_BASE = 'https://www.darwin.nt.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const DARWIN_SEED_PATHS = [
  '/community/programs/grants-sponsorship/community-grants',
  '/community/programs/grants-sponsorship/sponsorship-program',
  '/community/programs/grants-sponsorship/environment-and-climate-change-grants',
  '/community/programs/grants-sponsorship/reconciliation-week-naidoc-week-funding',
];

const DARWIN_EXCLUDED_PATTERNS = [
  /\/community\/programs\/funding-opportunities$/i,
  /\/community\/programs\/grants-sponsorship\/sponsorship-0$/i,
  /previously-successful-grants/i,
  /guidelines/i,
];

const MONTH_LOOKUP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|volunteer|neighbourhood/.test(text)) cats.push('community');
  if (/environment|climate|green|waste|recovery|sustainab/.test(text)) cats.push('regenerative');
  if (/naidoc|reconciliation|larrakia|first nations|indigenous/.test(text)) cats.push('indigenous');
  if (/arts?|culture|festival|history|heritage/.test(text)) cats.push('arts');
  if (/business|economic|tourism|place activation|sponsorship/.test(text)) cats.push('enterprise');

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

  return {};
}

function resolveDeadline(dayText: string, monthText: string, yearText?: string): { iso: string; time: number } | null {
  const day = parseInt(dayText, 10);
  const month = MONTH_LOOKUP[monthText.toLowerCase()];

  if (!Number.isFinite(day) || month === undefined) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let year = yearText ? parseInt(yearText, 10) : today.getFullYear();
  let candidate = new Date(year, month, day);

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  if (!yearText && candidate < today) {
    year += 1;
    candidate = new Date(year, month, day);
  }

  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    iso,
    time: candidate.getTime(),
  };
}

function extractDeadline(text: string): string | undefined {
  const candidates: Array<{ iso: string; time: number }> = [];
  const patterns = [
    /round\s+\d+\s*-\s*opens\s+\d{1,2}\s+\w+(?:\s+\d{4})?\s+and\s+closes?\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/ig,
    /applications?\s+open\s+\d{1,2}\s+\w+(?:\s+\d{4})?\s+and\s+close\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/ig,
    /(?:applications?\s+close|closes?|closing|deadline|due)\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/ig,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const resolved = resolveDeadline(match[1], match[2], match[3]);
      if (resolved) candidates.push(resolved);
    }
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => a.time - b.time);
  return candidates[0].iso;
}

function resolveAnnualWindow(openMonth: number, openDay: number, closeMonth: number, closeDay: number): GrantApplicationStatus {
  const today = startOfToday();
  const year = today.getFullYear();

  const openDate = new Date(year, openMonth, openDay);
  const closeDate = new Date(year, closeMonth, closeDay);

  if (today >= openDate && today <= closeDate) return 'open';
  return 'upcoming';
}

function inferApplicationStatus(pathname: string, bodyText: string): GrantApplicationStatus | undefined {
  const text = bodyText.toLowerCase();

  if (pathname.includes('/sponsorship-program') && /currently closed to new applications/.test(text)) {
    return 'closed';
  }

  if (pathname.includes('/environment-and-climate-change-grants')) {
    const match = text.match(/will open for applications here in (\w+)\s+(\d{4})/i);
    if (match) {
      const month = MONTH_LOOKUP[match[1].toLowerCase()];
      const year = Number.parseInt(match[2], 10);
      if (month !== undefined && Number.isFinite(year)) {
        const openDate = new Date(year, month, 1);
        return startOfToday() < openDate ? 'upcoming' : 'open';
      }
    }
  }

  if (
    pathname.includes('/community-grants') &&
    /opens 1 march and closes 31 march/.test(text) &&
    /opens 1 september and closes 30 september/.test(text)
  ) {
    const marchWindow = resolveAnnualWindow(2, 1, 2, 31);
    if (marchWindow === 'open') return 'open';
    return resolveAnnualWindow(8, 1, 8, 30);
  }

  if (
    pathname.includes('/reconciliation-week-naidoc-week-funding') &&
    /applications open 1 march and close 31 march/.test(text)
  ) {
    return resolveAnnualWindow(2, 1, 2, 31);
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
    const url = new URL(href, DARWIN_BASE);
    if (url.pathname === '/community/programs/grants-sponsorship/sponsorship-0') {
      url.pathname = '/community/programs/grants-sponsorship/sponsorship-program';
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return DARWIN_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();

  if (!pathname.startsWith('/community/programs/grants-sponsorship/')) return false;
  if (isIgnoredPath(pathname)) return false;

  return /grant|fund|funding|sponsorship|naidoc|reconciliation/.test(haystack);
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();

  if (isIgnoredPath(pathname)) return false;
  if (/404 page not found|we couldn't find the page/.test(text)) return false;

  const hasGrantSignal = /grant|funding|sponsorship/.test(text);
  const hasApplicationSignal = /apply|application|eligib|priority areas|assessment criteria|funding guidelines|currently closed to new applications/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(DARWIN_GRANTS_URL);
  if (!html) return DARWIN_SEED_PATHS.map(path => `${DARWIN_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(DARWIN_SEED_PATHS.map(path => `${DARWIN_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== DARWIN_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createDarwinCityGrantsPlugin(): SourcePlugin {
  return {
    id: 'darwin-city-grants',
    name: 'City of Darwin Grants',
    type: 'scraper',
    geography: ['AU-NT'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[darwin-city-grants] Scraping City of Darwin funding pages...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[darwin-city-grants] Candidate pages: ${candidateUrls.length}`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const url of candidateUrls) {
        const html = await fetchPage(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        const pathname = new URL(url).pathname;
        const title = (
          compressWhitespace($('h1').first().text()) ||
          compressWhitespace($('meta[property="og:title"]').attr('content') || '') ||
          compressWhitespace($('title').text().replace(/\s*\|\s*City of Darwin.*$/i, ''))
        );
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          $('main p').first().text() ||
          $('#main-content p').first().text()
        );
        const bodyText = compressWhitespace(
          $('main, #main-content, .node__content, .layout-content').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText, pathname)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const amount = pathname.includes('/sponsorship-program') ? {} : extractAmounts(bodyText);
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
          provider: 'City of Darwin',
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline: extractDeadline(bodyText),
          applicationStatus,
          description: (description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'darwin-city-grants',
          geography: ['AU-NT'],
        };
        yielded++;
      }

      console.log(`[darwin-city-grants] Yielded ${yielded} grants`);
    },
  };
}
