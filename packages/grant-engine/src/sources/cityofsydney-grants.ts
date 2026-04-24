/**
 * City of Sydney Grants Source Plugin
 *
 * Scrapes City of Sydney grants and funding pages from the official portal.
 * The main grants landing page already exposes direct program links in SSR HTML.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';
import { normalizeDate } from '../normalizer';

const CITY_OF_SYDNEY_URL = 'https://www.cityofsydney.nsw.gov.au/grants-sponsorships';
const CITY_OF_SYDNEY_BASE = 'https://www.cityofsydney.nsw.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const SYDNEY_SEED_PATHS = [
  '/grants-sponsorships',
  '/community-support-funding',
  '/cultural-support-funding',
  '/business-support-funding',
  '/environmental-support-funding',
];

const SYDNEY_SECTION_LANDING_PATHS = new Set([
  '/community-support-funding',
  '/cultural-support-funding',
  '/business-support-funding',
  '/environmental-support-funding',
]);

const SYDNEY_EXCLUDED_PATTERNS = [
  /\/$/,
  /approved-grants/i,
  /guidelines/i,
  /newsletter/i,
  /contact-us/i,
  /areas-of-service/i,
  /terms-conditions/i,
  /website-accessibility/i,
  /privacy/i,
  /careers/i,
  /request-city-records/i,
  /reconciliation/i,
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/aboriginal|torres strait|first nations|indigenous/.test(text)) cats.push('indigenous');
  if (/arts?|culture|creative|heritage|live work/.test(text)) cats.push('arts');
  if (/community|social|housing|inclusion|asylum|refugee/.test(text)) cats.push('community');
  if (/business|enterprise|economic|street banner/.test(text)) cats.push('enterprise');
  if (/environment|climate|sustainab|green|ecology/.test(text)) cats.push('regenerative');
  if (/education|student|training|school|scholarship/.test(text)) cats.push('education');
  if (/health|wellbeing|mental health/.test(text)) cats.push('health');
  if (/research|innovation/.test(text)) cats.push('research');

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

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function deriveApplicationStatus(deadline: string | undefined): GrantApplicationStatus | undefined {
  const normalized = normalizeDate(deadline);
  if (!normalized) return undefined;

  const [yearText, monthText, dayText] = normalized.split('-');
  const year = Number.parseInt(yearText || '', 10);
  const month = Number.parseInt(monthText || '', 10);
  const day = Number.parseInt(dayText || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }

  const closesAt = new Date(year, month - 1, day);
  closesAt.setHours(0, 0, 0, 0);
  return closesAt < startOfToday() ? 'closed' : 'open';
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
    return new URL(href, CITY_OF_SYDNEY_BASE).toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return SYDNEY_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isSectionLandingPath(pathname: string): boolean {
  return SYDNEY_SECTION_LANDING_PATHS.has(pathname);
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();

  if (isIgnoredPath(pathname)) return false;
  if (isSectionLandingPath(pathname)) return false;

  if (
    pathname.startsWith('/community-support-funding/') ||
    pathname.startsWith('/cultural-support-funding/') ||
    pathname.startsWith('/business-support-funding/') ||
    pathname.startsWith('/environmental-support-funding/')
  ) {
    return /grant|fund|funding|sponsorship|scholarship|bursary/.test(haystack);
  }

  return /grant|fund|funding|sponsorship|scholarship|bursary/.test(haystack);
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();
  const pathLeaf = pathname.split('/').filter(Boolean).at(-1) || '';
  const titleAndPathLeaf = `${title} ${pathLeaf}`.toLowerCase();

  if (isIgnoredPath(pathname)) return false;
  if (isSectionLandingPath(pathname)) return false;
  if (/success stories|approved grants|newsletter|contact us/.test(text)) return false;

  const hasSpecificGrantSignal = /grant|fund|funding|sponsorship|scholarship|bursary/.test(titleAndPathLeaf);
  const hasFinancialSupportSignal = /\$[0-9,]+|grant round|funding is available|applications?\s+(?:open|close|closed)|closing date|deadline|eligible|eligibility|sponsorship amounts?/.test(text);
  const hasGenericProgramSignal = /program/.test(titleAndPathLeaf);

  if (!hasSpecificGrantSignal) {
    return false;
  }

  if (hasGenericProgramSignal && !hasFinancialSupportSignal) {
    return false;
  }

  return hasFinancialSupportSignal || /apply|application|eligib|closing|deadline/.test(text);
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(CITY_OF_SYDNEY_URL);
  if (!html) return SYDNEY_SEED_PATHS.map(path => `${CITY_OF_SYDNEY_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(SYDNEY_SEED_PATHS.map(path => `${CITY_OF_SYDNEY_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== CITY_OF_SYDNEY_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createCityOfSydneyGrantsPlugin(): SourcePlugin {
  return {
    id: 'cityofsydney-grants',
    name: 'City of Sydney Grants',
    type: 'scraper',
    geography: ['AU-NSW'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[cityofsydney-grants] Scraping City of Sydney grants...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[cityofsydney-grants] Candidate pages: ${candidateUrls.length}`);

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
          $('title').text().replace(/\s*-\s*City of Sydney\s*$/i, '')
        );
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          $('main p').first().text() ||
          $('#main-content p').first().text()
        );
        const bodyText = compressWhitespace(
          $('main, [role="main"], #main-content').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText, pathname)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const amount = extractAmounts(bodyText);
        const categories = inferCategories(title, `${description} ${bodyText}`);
        const deadline = extractDeadline(bodyText);
        const applicationStatus = deriveApplicationStatus(deadline);

        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (categories.length > 0 && !categories.some(cat => queryLower.includes(cat))) continue;
        }

        if (query.keywords?.length) {
          const text = `${title} ${description} ${bodyText}`.toLowerCase();
          if (!query.keywords.some(keyword => text.includes(keyword.toLowerCase()))) continue;
        }

        if (query.status === 'open' && applicationStatus === 'closed') {
          continue;
        }

        yield {
          title: title.slice(0, 200),
          provider: 'City of Sydney',
          sourceUrl: url,
          amount: amount.min || amount.max ? amount : undefined,
          deadline,
          applicationStatus,
          description: (description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'cityofsydney-grants',
          geography: ['AU-NSW'],
        };
        yielded++;
      }

      console.log(`[cityofsydney-grants] Yielded ${yielded} grants`);
    },
  };
}
