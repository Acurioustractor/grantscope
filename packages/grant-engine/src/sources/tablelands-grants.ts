/**
 * Tablelands Regional Council Grants Source Plugin
 *
 * Scrapes official Tablelands Regional Council grant and sponsorship pages.
 * The landing page exposes direct program URLs and brief summaries for each stream.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const TABLELANDS_GRANTS_URL = 'https://www.trc.qld.gov.au/our-community/funding-grants/trc-grants/';
const TABLELANDS_BASE = 'https://www.trc.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const TABLELANDS_SEED_PATHS = [
  '/our-community/funding-grants/trc-grants/radf-grants/',
  '/our-community/funding-grants/trc-grants/trc-community-grants/',
  '/our-community/funding-grants/trc-grants/environment-grants/',
  '/our-community/funding-grants/trc-grants/youth-grants/',
  '/our-community/events/event-sponsorship/',
];

const TABLELANDS_EXCLUDED_PATTERNS = [
  /\/our-community\/funding-grants\/trc-grants\/$/i,
  /trc-grant-acquittal/i,
  /requests-letters-support/i,
  /guidelines/i,
];

const PROGRAM_PRESETS: Record<string, { description: string; amount?: { min?: number; max?: number } }> = {
  '/our-community/funding-grants/trc-grants/radf-grants/': {
    description: 'Supports quality arts and cultural experiences and builds local cultural capacity. Quick response grants are available year-round while funds last, with larger assessed rounds for major projects.',
    amount: { max: 6000 },
  },
  '/our-community/funding-grants/trc-grants/trc-community-grants/': {
    description: 'Supports activities that contribute to an active, inclusive, connected and empowered community.',
    amount: { max: 2000 },
  },
  '/our-community/funding-grants/trc-grants/environment-grants/': {
    description: 'Supports activities that contribute to a valued, managed and healthy environment.',
    amount: { max: 2000 },
  },
  '/our-community/funding-grants/trc-grants/youth-grants/': {
    description: 'Supports youth representing the region in sport, recreation, academic, arts, culture, leadership, and ambassadorship activities.',
    amount: { min: 250, max: 500 },
  },
  '/our-community/events/event-sponsorship/': {
    description: 'Provides in-kind and cash support to eligible event organisers delivering events in the Tablelands Regional Council area.',
  },
};

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/arts?|culture|heritage|radf/.test(text)) cats.push('arts');
  if (/community|volunteer|inclusive|connected/.test(text)) cats.push('community');
  if (/environment|climate|regeneration|healthy environment/.test(text)) cats.push('regenerative');
  if (/youth|academic|leadership|training/.test(text)) cats.push('education');
  if (/sport|recreation/.test(text)) cats.push('sport');
  if (/event|sponsorship|economic|tourism/.test(text)) cats.push('enterprise');

  return [...new Set(cats)];
}

function extractAmount(pathname: string): { min?: number; max?: number } | undefined {
  const preset = PROGRAM_PRESETS[pathname];
  return preset?.amount;
}

function inferApplicationStatus(pathname: string, bodyText: string): GrantApplicationStatus | undefined {
  const text = bodyText.toLowerCase();

  if (
    pathname === '/our-community/funding-grants/trc-grants/trc-community-grants/' ||
    pathname === '/our-community/funding-grants/trc-grants/environment-grants/' ||
    pathname === '/our-community/funding-grants/trc-grants/youth-grants/'
  ) {
    if (/fully expended|open in july|opens in july|opening in july/.test(text)) return 'upcoming';
  }

  if (pathname === '/our-community/funding-grants/trc-grants/radf-grants/') {
    if (/quick response grants are available year-round|year-round while funds last|applications are open/.test(text)) {
      return 'open';
    }
  }

  if (/applications closed|currently closed/.test(text)) return 'closed';

  return undefined;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
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
    const url = new URL(href, TABLELANDS_BASE);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isIgnoredPath(pathname: string): boolean {
  return TABLELANDS_EXCLUDED_PATTERNS.some(pattern => pattern.test(pathname));
}

function isGrantLikePath(pathname: string, text: string): boolean {
  const haystack = `${pathname} ${text}`.toLowerCase();

  if (isIgnoredPath(pathname)) return false;
  if (
    pathname.startsWith('/our-community/funding-grants/trc-grants/') ||
    pathname === '/our-community/events/event-sponsorship/'
  ) {
    return /grant|funding|sponsorship|community|environment|youth|radf|event/.test(haystack);
  }

  return false;
}

function looksLikeGrantPage(title: string, description: string, body: string, pathname: string): boolean {
  const text = `${title} ${description} ${body} ${pathname}`.toLowerCase();

  if (isIgnoredPath(pathname)) return false;
  const hasGrantSignal = /grant|funding|sponsorship|radf/.test(text);
  const hasApplicationSignal = /apply|application|eligible|open in july|fully expended|cash support|in-kind/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

async function collectCandidateUrls(): Promise<string[]> {
  const html = await fetchPage(TABLELANDS_GRANTS_URL);
  if (!html) return TABLELANDS_SEED_PATHS.map(path => `${TABLELANDS_BASE}${path}`);

  const $ = cheerio.load(html);
  const urls = new Set<string>(TABLELANDS_SEED_PATHS.map(path => `${TABLELANDS_BASE}${path}`));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = compressWhitespace($(el).text());
    const absolute = toAbsoluteUrl(href);
    if (!absolute) return;

    const url = new URL(absolute);
    if (url.origin !== TABLELANDS_BASE) return;
    if (!isGrantLikePath(url.pathname, text)) return;

    urls.add(url.toString());
  });

  return [...urls];
}

export function createTablelandsGrantsPlugin(): SourcePlugin {
  return {
    id: 'tablelands-grants',
    name: 'Tablelands Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[tablelands-grants] Scraping Tablelands Regional Council grants...');

      const candidateUrls = await collectCandidateUrls();
      console.log(`[tablelands-grants] Candidate pages: ${candidateUrls.length}`);

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
          compressWhitespace($('title').text().replace(/\s*-\s*TRC.*$/i, ''))
        );
        const preset = PROGRAM_PRESETS[pathname];
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          $('.entry-content p').first().text() ||
          $('article p').first().text() ||
          preset?.description ||
          ''
        );
        const bodyText = compressWhitespace(
          $('main, #content, .entry-content, article').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText, pathname)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const amount = extractAmount(pathname);
        const categories = inferCategories(title, `${description} ${preset?.description || ''} ${bodyText}`);
        const applicationStatus = inferApplicationStatus(pathname, bodyText);

        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (categories.length > 0 && !categories.some(cat => queryLower.includes(cat))) continue;
        }

        if (query.keywords?.length) {
          const text = `${title} ${description} ${preset?.description || ''} ${bodyText}`.toLowerCase();
          if (!query.keywords.some(keyword => text.includes(keyword.toLowerCase()))) continue;
        }

        yield {
          title: title.slice(0, 200),
          provider: 'Tablelands Regional Council',
          sourceUrl: url,
          amount,
          applicationStatus,
          description: (preset?.description || description || bodyText).slice(0, 500) || undefined,
          categories,
          sourceId: 'tablelands-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[tablelands-grants] Yielded ${yielded} grants`);
    },
  };
}
