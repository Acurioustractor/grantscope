/**
 * Charters Towers Regional Council Grants Source Plugin
 *
 * Scrapes current and upcoming Charters Towers council grant pages and yields
 * only the live rolling or upcoming grant programs.
 */

import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const COMMUNITY_GRANTS_URL =
  'https://www.charterstowers.qld.gov.au/Community/Scholarships-Grants-funding/Community-grants-programme';
const ATHLETE_SUPPORT_URL =
  'https://www.charterstowers.qld.gov.au/Community/Scholarships-Grants-funding/Financial-support-for-a-local-athlete';

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
  applicationStatus?: GrantApplicationStatus;
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Community Grants Programme',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: COMMUNITY_GRANTS_URL,
    marker: 'APPLY NOW',
    requiredSignals: [
      'Significant Dates',
      'Round 1 - Opens Friday, 1 May 2026. Closes Friday, 29 May 2026.',
      'Grant Limit A limit of up to $5,000 maximum in monetary value and/or in-kind support may be requested.',
      'Be a not for profit, incorporated community organisation',
    ],
    description:
      'Provides seed funding and in-kind support for eligible not-for-profit community organisations in the Charters Towers Region, with the 2026 round opening in May.',
    categories: ['community'],
    amount: { max: 5000 },
    deadline: '2026-05-29',
    applicationStatus: 'upcoming',
  },
  {
    title: 'Financial Support for a Local Athlete',
    pageUrl: ATHLETE_SUPPORT_URL,
    sourceUrl: ATHLETE_SUPPORT_URL,
    marker: 'Applications must be received prior to the competition.',
    requiredSignals: [
      'Applications must be received prior to the competition.',
      'Funding from this source has not exceeded $2,000 per applicant, per calendar year.',
      'Representing Australia Overseas - $2,000',
      'Applications for competitions that have already occurred will not be considered',
    ],
    description:
      'Provides progressive financial support for local athletes representing North Queensland, Queensland, or Australia, with applications accepted before the competition.',
    categories: ['sport', 'education'],
    amount: { max: 2000 },
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

  const endMarkers = ['Back to top', 'Contact Us'];
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

export function createChartersTowersGrantsPlugin(): SourcePlugin {
  return {
    id: 'charterstowers-grants',
    name: 'Charters Towers Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[charterstowers-grants] Scraping Charters Towers Regional Council grants...');

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
          provider: 'Charters Towers Regional Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.amount,
          deadline: definition.deadline,
          applicationStatus: definition.applicationStatus,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'charterstowers-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[charterstowers-grants] Yielded ${yielded} grants`);
    },
  };
}
