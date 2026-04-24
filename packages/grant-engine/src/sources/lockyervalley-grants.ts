/**
 * Lockyer Valley Regional Council Grants Source Plugin
 *
 * Scrapes live Lockyer Valley grant pages and yields the grant programs that
 * are currently open or rolling.
 */

import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const MINOR_COMMUNITY_GRANTS_URL =
  'https://www.lockyervalley.qld.gov.au/our-council/grants-and-funding/minor-community-grants-program';
const RADF_GRANTS_URL =
  'https://www.lockyervalley.qld.gov.au/our-council/grants-and-funding/radf-grants';

type ProgramDefinition = {
  title: string;
  pageUrl: string;
  sourceUrl: string;
  marker: string;
  requiredSignals: string[];
  description: string;
  categories: string[];
  amount?: { min?: number; max?: number };
  deadline?: string;
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Minor Community Grants Program',
    pageUrl: MINOR_COMMUNITY_GRANTS_URL,
    sourceUrl: MINOR_COMMUNITY_GRANTS_URL,
    marker: "Council's Minor Community Grants Program is for non-recurrent grants up to $1000",
    requiredSignals: [
      "Council's Minor Community Grants Program is for non-recurrent grants up to $1000",
      'Funding applications will be accepted throughout the financial year under this category',
      'Requests must be provided in writing and set out details of the request and its purpose.',
    ],
    description:
      'Provides rolling minor community grants for not-for-profit organisations seeking support for projects or activities that contribute to the Lockyer Valley community.',
    categories: ['community'],
    amount: { max: 1000 },
  },
  {
    title: 'RADF Grants - Round 3',
    pageUrl: RADF_GRANTS_URL,
    sourceUrl: `${RADF_GRANTS_URL}#round-3`,
    marker: 'Rounds',
    requiredSignals: [
      'Round 3 for 2025-26 is open and closes at 10am on 24 April 2026 .',
      'Applications will only be accepted online via SmartyGrants .',
    ],
    description:
      'Supports arts and cultural projects through Lockyer Valley Regional Council’s open 2025-26 RADF Round 3.',
    categories: ['arts', 'community'],
    deadline: '2026-04-24',
  },
  {
    title: 'RADF Grants - Quick Response',
    pageUrl: RADF_GRANTS_URL,
    sourceUrl: `${RADF_GRANTS_URL}#quick-response`,
    marker: 'Rounds',
    requiredSignals: [
      'Quick Response applications are open and will close at midnight 12 June 2026 .',
      'Applications will only be accepted online via SmartyGrants .',
    ],
    description:
      'Provides quick-response arts funding through Lockyer Valley Regional Council’s open RADF quick response pathway.',
    categories: ['arts', 'community'],
    deadline: '2026-06-12',
  },
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPageText(html: string, marker: string): string {
  const text = compressWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&rsquo;|&#8217;/gi, "'")
      .replace(/&#8211;/g, '–')
      .replace(/&amp;/gi, '&')
  );

  const start = text.indexOf(marker);
  const sliced = start >= 0 ? text.slice(start) : text;

  const endMarkers = ['Share this', 'Resources Online Services'];
  let end = sliced.length;
  for (const endMarker of endMarkers) {
    const idx = sliced.indexOf(endMarker);
    if (idx >= 0) end = Math.min(end, idx);
  }

  return compressWhitespace(sliced.slice(0, end));
}

async function fetchPageText(url: string, marker: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    return extractPageText(html, marker);
  } catch {
    return null;
  }
}

export function createLockyerValleyGrantsPlugin(): SourcePlugin {
  return {
    id: 'lockyervalley-grants',
    name: 'Lockyer Valley Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[lockyervalley-grants] Scraping Lockyer Valley Regional Council grants...');

      const pageCache = new Map<string, string | null>();
      let yielded = 0;

      for (const definition of PROGRAMS) {
        const cacheKey = `${definition.pageUrl}|${definition.marker}`;
        if (!pageCache.has(cacheKey)) {
          pageCache.set(cacheKey, await fetchPageText(definition.pageUrl, definition.marker));
        }

        const text = pageCache.get(cacheKey);
        if (!text) continue;
        if (!definition.requiredSignals.every(signal => text.includes(signal))) continue;

        const haystack = `${definition.title} ${definition.description} ${text}`.toLowerCase();
        if (query.keywords?.length && !query.keywords.some(keyword => haystack.includes(keyword.toLowerCase()))) continue;
        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (!definition.categories.some(cat => queryLower.includes(cat))) continue;
        }

        yield {
          title: definition.title,
          provider: 'Lockyer Valley Regional Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.amount,
          deadline: definition.deadline,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'lockyervalley-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[lockyervalley-grants] Yielded ${yielded} grants`);
    },
  };
}
