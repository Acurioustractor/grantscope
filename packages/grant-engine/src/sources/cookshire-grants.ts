/**
 * Cook Shire Council Grants Source Plugin
 *
 * Scrapes explicit Cook Shire Council grant and sponsorship program pages.
 * The grants directory links to a small set of stable program URLs.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const COOK_BASE = 'https://www.cook.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const PROGRAM_PRESETS: Record<string, { description: string; amount?: { min?: number; max?: number } }> = {
  '/community-economic-development-grants/': {
    description: 'Supports community and economic development projects that bring people together, improve facilities, protect the environment, and strengthen the local economy.',
    amount: { max: 6000 },
  },
  '/radf-funding/': {
    description: 'Regional Arts Development Fund support for arts, culture, and heritage projects in partnership with the Queensland Government.',
  },
  '/council_sponsorship/': {
    description: 'Supports community members, events, and initiatives that benefit Cook Shire, with funding available year-round.',
    amount: { max: 4000 },
  },
};

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|sponsorship|benefit|initiative/.test(text)) cats.push('community');
  if (/economic|business|tourism/.test(text)) cats.push('enterprise');
  if (/arts?|culture|heritage|radf/.test(text)) cats.push('arts');
  if (/environment/.test(text)) cats.push('regenerative');

  return [...new Set(cats)];
}

function extractContent($: cheerio.CheerioAPI): string {
  const selectors = [
    'article',
    '.entry-content',
    '.elementor-widget-theme-post-content',
    '.elementor-location-single',
    '.site-main',
  ];

  for (const selector of selectors) {
    const text = compressWhitespace($(selector).first().text());
    if (text) return text;
  }

  return compressWhitespace($('body').text());
}

function looksLikeGrantPage(title: string, description: string, body: string): boolean {
  const text = `${title} ${description} ${body}`.toLowerCase();
  if (/page not found|access denied|just a moment/.test(text)) return false;

  const hasGrantSignal = /grant|fund|sponsorship|radf/.test(text);
  const hasApplicationSignal = /apply|application|open|closing|guidelines|year-round|rounds? per year/.test(text);

  return hasGrantSignal && hasApplicationSignal;
}

function extractDeadline(pathname: string, body: string): string | undefined {
  if (pathname !== '/community-economic-development-grants/') return undefined;

  const patterns = [
    /closing\s+\w+\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    /(?:applications?\s+close|closes?|closing|deadline|due)[^.\n]*?(\d{1,2}\s+\w+\s+\d{4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }

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

export function createCookShireGrantsPlugin(): SourcePlugin {
  return {
    id: 'cookshire-grants',
    name: 'Cook Shire Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[cookshire-grants] Scraping Cook Shire Council grants...');

      const candidateUrls = Object.keys(PROGRAM_PRESETS).map(path => `${COOK_BASE}${path}`);
      console.log(`[cookshire-grants] Candidate pages: ${candidateUrls.length}`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const url of candidateUrls) {
        const html = await fetchPage(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        const pathname = new URL(url).pathname;
        const preset = PROGRAM_PRESETS[pathname];
        const title = compressWhitespace(
          $('h1').first().text() ||
          $('meta[property="og:title"]').attr('content') ||
          $('title').text().replace(/\s*\|\s*Cook Shire Council\s*$/i, '')
        );
        const bodyText = extractContent($);
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          preset.description
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

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
          provider: 'Cook Shire Council',
          sourceUrl: url,
          amount: preset.amount,
          deadline: extractDeadline(pathname, bodyText),
          description: description.slice(0, 500) || undefined,
          categories,
          sourceId: 'cookshire-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[cookshire-grants] Yielded ${yielded} grants`);
    },
  };
}
