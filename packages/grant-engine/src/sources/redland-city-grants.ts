/**
 * Redland City Council Grants Source Plugin
 *
 * Scrapes official Redland City Council grants and sponsorship pages.
 * The main grants page exposes direct links to each funding stream.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const REDLAND_GRANTS_URL = 'https://www.redland.qld.gov.au/Grants-and-sponsorship';
const REDLAND_BASE = 'https://www.redland.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const REDLAND_SEED_PATHS = [
  '/Grants-and-sponsorship/Rapid-Response-Grant',
  '/Grants-and-sponsorship/Community-Support-Grant',
  '/Grants-and-sponsorship/Build-and-Thrive-Grant',
  '/Grants-and-sponsorship/Community-Celebration-Grant',
  '/Grants-and-sponsorship/Events-Grant',
  '/Grants-and-sponsorship/Signature-Events-Attraction-and-Retention-Fund',
  '/Grants-and-sponsorship/Regional-Arts-Development-Fund',
  '/Grants-and-sponsorship/Local-Heritage-Grants',
  '/Grants-and-sponsorship/Mayor-and-Councillors-Community-Benefit-Fund-Program',
];

const REDLAND_EXCLUDED_PATTERNS = [
  /\/Grants-and-sponsorship$/i,
  /Awarded-grants/i,
  /Grant-Funding-Finder/i,
  /Grant-and-Sponsorship-Logo-Downloads-and-Guidelines/i,
  /Grant-workshops-and-assistance/i,
  /newsletter/i,
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

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|celebration|benefit|support/.test(text)) cats.push('community');
  if (/arts?|heritage|radf|creative|culture/.test(text)) cats.push('arts');
  if (/events?|tourism|attraction/.test(text)) cats.push('enterprise');
  if (/environment|conservation|indigiscapes|climate/.test(text)) cats.push('regenerative');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/business|thrive/.test(text)) cats.push('enterprise');

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

  const fromMatch = text.match(/from \$([0-9,]+)\s+to\s+\$([0-9,]+)/i);
  if (fromMatch) {
    return {
      min: parseInt(fromMatch[1].replace(/,/g, ''), 10),
      max: parseInt(fromMatch[2].replace(/,/g, ''), 10),
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
  return extractRoundInfo(text).deadline;
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseRoundDate(dayText: string, monthText: string, yearText?: string, fallbackYear?: number): Date | null {
  const month = MONTH_LOOKUP[monthText.toLowerCase()];
  const day = Number.parseInt(dayText, 10);
  const year = yearText ? Number.parseInt(yearText, 10) : fallbackYear;
  if (month === undefined || !Number.isFinite(day) || !year) return null;

  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function extractRoundInfo(text: string): { deadline?: string; applicationStatus?: GrantApplicationStatus } {
  const windows: Array<{ start: Date; end: Date }> = [];
  const pattern = /open(?:ed)?\s+from\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?\s+to\s+(\d{1,2})\s+(\w+)\s+(\d{4})/ig;

  for (const match of text.matchAll(pattern)) {
    const closeYear = Number.parseInt(match[6], 10);
    const closeMonth = MONTH_LOOKUP[match[5].toLowerCase()];
    const startMonth = MONTH_LOOKUP[match[2].toLowerCase()];
    if (closeMonth === undefined || startMonth === undefined || !Number.isFinite(closeYear)) continue;

    const inferredStartYear = match[3]
      ? Number.parseInt(match[3], 10)
      : (startMonth > closeMonth ? closeYear - 1 : closeYear);

    const start = parseRoundDate(match[1], match[2], match[3], inferredStartYear);
    const end = parseRoundDate(match[4], match[5], match[6], closeYear);
    if (!start || !end) continue;

    windows.push({ start, end });
  }

  if (windows.length > 0) {
    windows.sort((a, b) => a.start.getTime() - b.start.getTime());
    const today = startOfToday().getTime();
    const active = windows.find(window => today >= window.start.getTime() && today <= window.end.getTime());
    if (active) {
      return {
        deadline: toIsoDate(active.end),
        applicationStatus: 'open',
      };
    }

    const future = windows.find(window => window.start.getTime() > today);
    if (future) {
      return {
        deadline: toIsoDate(future.end),
        applicationStatus: 'upcoming',
      };
    }
  }

  const closePatterns = [
    /(?:applications?\s+close|closes?|closing|deadline|due)[^.\n]*?(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];

  for (const pattern of closePatterns) {
    const match = text.match(pattern);
    if (match) return { deadline: match[1] };
  }

  if (/applications are now closed|currently closed|closed for the \d{4}\/\d{2} program/i.test(text)) {
    return { applicationStatus: 'closed' };
  }

  return {};
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
    const url = new URL(href, REDLAND_BASE);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return REDLAND_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();
  if (!pathname.startsWith('/Grants-and-sponsorship/')) return false;
  if (isIgnoredPath(pathname)) return false;
  return /grant|fund|sponsorship|events?|heritage|arts|benefit/.test(haystack);
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();
  if (isIgnoredPath(pathname)) return false;

  const hasGrantSignal = /grant|fund|sponsorship/.test(text);
  const hasApplicationSignal = /apply|application|eligib|funding is available|round|outcomes|funding is available/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(REDLAND_GRANTS_URL);
  if (!html) return REDLAND_SEED_PATHS.map(path => `${REDLAND_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(REDLAND_SEED_PATHS.map(path => `${REDLAND_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== REDLAND_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createRedlandCityGrantsPlugin(): SourcePlugin {
  return {
    id: 'redland-city-grants',
    name: 'Redland City Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[redland-city-grants] Scraping Redland City Council grants...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[redland-city-grants] Candidate pages: ${candidateUrls.length}`);

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
          $('title').text().replace(/\s*\|\s*Redland City Council\s*$/i, '')
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

        const amount = extractAmounts(bodyText);
        const categories = inferCategories(title, `${description} ${bodyText}`);
        const roundInfo = extractRoundInfo(bodyText);

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
          provider: 'Redland City Council',
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline: roundInfo.deadline || extractDeadline(bodyText),
          applicationStatus: roundInfo.applicationStatus,
          description: (description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'redland-city-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[redland-city-grants] Yielded ${yielded} grants`);
    },
  };
}
