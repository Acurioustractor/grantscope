/**
 * Toowoomba Regional Council Grants Source Plugin
 *
 * Scrapes explicit Toowoomba Regional Council grants pages and yields only the
 * current or upcoming grant streams that are clearly described on those pages.
 */

import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const COMMUNITY_GRANTS_URL = 'https://www.tr.qld.gov.au/Community/Grants-funding-and-scholarships/Community-Grants-Program';
const SPONSORSHIP_URL = 'https://www.tr.qld.gov.au/Community/Grants-funding-and-scholarships/Request-for-sponsorship';
const SHADE_TREES_URL = 'https://www.tr.qld.gov.au/Community/Grants-funding-and-scholarships/Shade-trees-and-shrubs-in-kind-grant';
const HERITAGE_URL = 'https://www.tr.qld.gov.au/Community/Grants-funding-and-scholarships/Heritage-Incentive-Grant';

type ProgramDefinition = {
  title: string;
  pageUrl: string;
  sourceUrl?: string;
  marker: string;
  markerOccurrence?: 'first' | 'last';
  requiredSignals: string[];
  description: string;
  categories: string[];
  amount?: { min?: number; max?: number };
  deadline?: string;
  applicationStatus?: GrantApplicationStatus;
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Community Grants Program - Micro Grant',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: `${COMMUNITY_GRANTS_URL}#micro-grant`,
    marker: 'Community Grants Program',
    markerOccurrence: 'last',
    requiredSignals: [
      'Micro grant for amounts up to $1,000',
      'open across the calendar year from 1 July 2026 until funds are expended',
    ],
    description: 'Supports smaller community projects through micro grants available across the 2026/27 funding year until funds are expended.',
    categories: ['community'],
    amount: { max: 1000 },
    applicationStatus: 'upcoming',
  },
  {
    title: 'Community Grants Program - Minor Grant',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: `${COMMUNITY_GRANTS_URL}#minor-grant`,
    marker: 'Community Grants Program',
    markerOccurrence: 'last',
    requiredSignals: [
      'Minor grant for amounts from $1,001 up to $10,000',
      'close at 5pm on Wednesday 12 August 2026',
    ],
    description: 'Supports community projects through the minor grants stream of Toowoomba Regional Council’s community grants program.',
    categories: ['community'],
    amount: { min: 1001, max: 10000 },
    deadline: '2026-08-12',
  },
  {
    title: 'Community Grants Program - Major Grant',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: `${COMMUNITY_GRANTS_URL}#major-grant`,
    marker: 'Community Grants Program',
    markerOccurrence: 'last',
    requiredSignals: [
      'Major grant for amounts over $10,001',
      'close at 5pm on Wednesday 12 August 2026',
    ],
    description: 'Supports larger community projects with additional co-contribution requirements through the major grants stream.',
    categories: ['community'],
    amount: { min: 10001 },
    deadline: '2026-08-12',
  },
  {
    title: 'Request for Sponsorship',
    pageUrl: SPONSORSHIP_URL,
    marker: 'Request for sponsorship',
    requiredSignals: [
      'Requests up to $4,999',
      'Requests of $5,000 and above',
      'Due to the number of successful submissions, available funding for the 2025/26 Sponsorship Program is very limited',
    ],
    description: 'Provides financial or in-kind sponsorship for events, projects, services, and activities that contribute to the liveability of the region.',
    categories: ['community', 'enterprise'],
  },
  {
    title: 'Shade Trees and Shrubs In-Kind Grant',
    pageUrl: SHADE_TREES_URL,
    marker: 'Shade trees and shrubs in-kind grant',
    requiredSignals: [
      'provides 30 free plants to eligible non-profit organisations each year',
      'Plants are distributed during the months of February - March and October - November',
    ],
    description: 'Provides 30 free plants to eligible non-profit organisations, subject to nursery stock availability.',
    categories: ['community', 'regenerative'],
  },
  {
    title: 'Heritage Incentive Grant',
    pageUrl: HERITAGE_URL,
    marker: 'Heritage Incentive Grant',
    requiredSignals: [
      'We assess applications on an ongoing basis throughout the year',
      'up to a maximum of $20,000 per project',
    ],
    description: 'Supports preservation and enhancement works for eligible heritage-listed buildings in the public realm.',
    categories: ['arts', 'community'],
    amount: { max: 20000 },
  },
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPageText(html: string, marker: string, markerOccurrence: 'first' | 'last' = 'first'): string {
  const text = compressWhitespace(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&rsquo;|&#8217;/gi, "'")
      .replace(/&amp;/gi, '&')
  );
  const start = markerOccurrence === 'last' ? text.lastIndexOf(marker) : text.indexOf(marker);
  const sliced = start >= 0 ? text.slice(start) : text;

  const endMarkers = ['Was this page helpful?', 'Back to top'];
  let end = sliced.length;
  for (const endMarker of endMarkers) {
    const idx = sliced.indexOf(endMarker);
    if (idx >= 0) end = Math.min(end, idx);
  }

  return compressWhitespace(sliced.slice(0, end));
}

async function fetchPageText(
  url: string,
  marker: string,
  markerOccurrence: 'first' | 'last' = 'first'
): Promise<string | null> {
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
    return extractPageText(html, marker, markerOccurrence);
  } catch {
    return null;
  }
}

export function createToowoombaGrantsPlugin(): SourcePlugin {
  return {
    id: 'toowoomba-grants',
    name: 'Toowoomba Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[toowoomba-grants] Scraping Toowoomba Regional Council grants...');

      const pageCache = new Map<string, string | null>();
      let yielded = 0;

      for (const definition of PROGRAMS) {
        const cacheKey = `${definition.pageUrl}|${definition.marker}|${definition.markerOccurrence || 'first'}`;
        if (!pageCache.has(cacheKey)) {
          pageCache.set(
            cacheKey,
            await fetchPageText(definition.pageUrl, definition.marker, definition.markerOccurrence)
          );
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
          provider: 'Toowoomba Regional Council',
          sourceUrl: definition.sourceUrl || definition.pageUrl,
          amount: definition.amount,
          deadline: definition.deadline,
          applicationStatus: definition.applicationStatus,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'toowoomba-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[toowoomba-grants] Yielded ${yielded} grants`);
    },
  };
}
