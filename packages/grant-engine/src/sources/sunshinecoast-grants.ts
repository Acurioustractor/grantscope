/**
 * Sunshine Coast Council Grants Source Plugin
 *
 * Scrapes explicit Sunshine Coast Council grants and sponsorship program pages.
 * The grants-programs directory exposes stable child pages for each funding stream.
 */

import * as cheerio from 'cheerio';
import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const SUNSHINE_BASE = 'https://www.sunshinecoast.qld.gov.au';
const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const PROGRAM_PRESETS: Record<string, { description: string; amount?: { min?: number; max?: number } }> = {
  '/living-and-community/grants-and-funding/grants-programs/major-grants': {
    description: 'Project funding for not-for-profit community groups up to $15,000, and up to $30,000 for infrastructure projects.',
    amount: { max: 30000 },
  },
  '/living-and-community/grants-and-funding/grants-programs/minor-grants': {
    description: 'Project funding for not-for-profit community groups up to $3,000.',
    amount: { max: 3000 },
  },
  '/living-and-community/grants-and-funding/grants-programs/festive-and-commemorative-events-grants': {
    description: 'Funding for community-led Christmas, New Year, Australia Day, Anzac Day and Remembrance Day community events.',
    amount: { max: 15000 },
  },
  '/living-and-community/grants-and-funding/grants-programs/emergency-grants': {
    description: 'Funding to assist with an emergency or a significant impact caused by unforeseen circumstances.',
    amount: { max: 3000 },
  },
  '/living-and-community/grants-and-funding/grants-programs/environment-levy-grants': {
    description: 'Funding provided for not-for-profit community based organisations and private rural landholders under the environment levy.',
  },
  '/living-and-community/grants-and-funding/grants-programs/heritage-levy-funding': {
    description: 'Funding provided to not-for-profit community museums and heritage groups.',
    amount: { max: 7500 },
  },
  '/living-and-community/grants-and-funding/grants-programs/individual-development-grants': {
    description: 'Funding to support residents performing, competing or presenting at national or international competitions, conferences or events.',
    amount: { max: 2000 },
  },
  '/living-and-community/grants-and-funding/grants-programs/mayoral-and-councillor-discretionary-funding': {
    description: 'This program allows funds to be allocated at the Councillor’s discretion to not-for-profit organisations for community purposes.',
  },
  '/living-and-community/grants-and-funding/grants-programs/community-partnership-funding': {
    description: 'Operational funding for incorporated not-for-profit groups that provide key facilities or services to local communities.',
  },
  '/living-and-community/grants-and-funding/grants-programs/sports-field-maintenance-funding': {
    description: 'Funding towards the cost of maintaining sports fields in the region.',
  },
  '/living-and-community/grants-and-funding/grants-programs/recreation-trails-partnership-program': {
    description: 'Funding for community organisations contributing to the development, maintenance, and activation of publicly accessible trails and associated nature-based recreation infrastructure.',
    amount: { max: 15000 },
  },
  '/business/major-events-sponsorship-program': {
    description: 'Council aims to position the Sunshine Coast as Australia’s premier regional major events destination through event sponsorship support.',
  },
};

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inferCategories(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const cats: string[] = [];

  if (/community|partnership|discretionary/.test(text)) cats.push('community');
  if (/arts?|creative|heritage/.test(text)) cats.push('arts');
  if (/environment|levy|nature|trails/.test(text)) cats.push('regenerative');
  if (/individual development|competing|presenting|conference/.test(text)) cats.push('education');
  if (/sport|sports field/.test(text)) cats.push('sport');
  if (/events?|sponsorship|business/.test(text)) cats.push('enterprise');

  return [...new Set(cats)];
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

function looksLikeGrantPage(title: string, description: string, body: string): boolean {
  const text = `${title} ${description} ${body}`.toLowerCase();
  if (/^404\b|page not found|access denied|just a moment/.test(`${title} ${description}`.toLowerCase())) return false;
  return /grant|funding|sponsorship/.test(text);
}

export function createSunshineCoastGrantsPlugin(): SourcePlugin {
  return {
    id: 'sunshinecoast-grants',
    name: 'Sunshine Coast Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[sunshinecoast-grants] Scraping Sunshine Coast Council grants...');

      const candidateUrls = Object.keys(PROGRAM_PRESETS).map(path => `${SUNSHINE_BASE}${path}`);
      console.log(`[sunshinecoast-grants] Candidate pages: ${candidateUrls.length}`);

      const seen = new Set<string>();
      let yielded = 0;

      for (const url of candidateUrls) {
        const html = await fetchPage(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        const pathname = new URL(url).pathname;
        const preset = PROGRAM_PRESETS[pathname];
        const title = (
          compressWhitespace($('h1').first().text()) ||
          compressWhitespace($('meta[property="og:title"]').attr('content') || '') ||
          compressWhitespace($('title').text().replace(/\s*\|\s*Sunshine Coast Council.*$/i, ''))
        );
        const description = compressWhitespace(
          $('meta[name="description"]').attr('content') ||
          preset.description
        );
        const bodyText = compressWhitespace(
          $('main, [role="main"], body').text() ||
          $('body').text()
        );

        if (!title || title.length < 5) continue;
        if (!looksLikeGrantPage(title, description, bodyText)) continue;

        const dedupKey = `${title.toLowerCase()}|${pathname}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const categories = inferCategories(title, description);

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
          provider: 'Sunshine Coast Council',
          sourceUrl: url,
          amount: preset.amount,
          description: description.slice(0, 500) || undefined,
          categories,
          sourceId: 'sunshinecoast-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[sunshinecoast-grants] Yielded ${yielded} grants`);
    },
  };
}
