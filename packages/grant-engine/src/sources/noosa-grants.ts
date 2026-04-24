/**
 * Noosa Shire Council Grants Source Plugin
 *
 * Scrapes live Noosa council grant pages and yields currently open rolling
 * grant programs with clear application details.
 */

import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const COMMUNITY_GRANTS_URL = 'https://www.noosa.qld.gov.au/Community/Grants/Community-Grants';
const ECONOMIC_DEVELOPMENT_GRANT_URL = 'https://www.noosa.qld.gov.au/Business/Grants/Economic-development-grant';

type ProgramDefinition = {
  title: string;
  pageUrl: string;
  sourceUrl: string;
  marker: string;
  endMarker?: string;
  requiredSignals: string[];
  description: string;
  categories: string[];
  amount?: { min?: number; max?: number };
  deadline?: string;
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Community Quick Response Grants',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: `${COMMUNITY_GRANTS_URL}#community-quick-response-grants`,
    marker: 'Community Quick Response Grants - OPEN NOW!',
    endMarker: 'Community Project Grants - Round 24 now closed',
    requiredSignals: [
      'Operating on a rolling basis, until the annual budget is exhausted.',
      'Community Quick Response Grants are designed to support eligible not-for-profit organisations responding to emergent or time-sensitive matters',
      'Round opens: 23 September 2025',
      'Funding Available: 23 September - 30 June 2026',
    ],
    description:
      'Provides rolling support for eligible not-for-profit organisations responding to emergent or time-sensitive matters in the Noosa community.',
    categories: ['community'],
    deadline: '2026-06-30',
  },
  {
    title: 'Individual Sports Development Grants',
    pageUrl: COMMUNITY_GRANTS_URL,
    sourceUrl: `${COMMUNITY_GRANTS_URL}#individual-sports-development-grants`,
    marker: 'Individual Sports Development Grants - OPEN NOW!',
    endMarker: 'Signature Community Event Grants',
    requiredSignals: [
      'Operating on a rolling basis, until the annual budget is exhausted.',
      'Individual Sport Development Grants aim to support Noosa Shire residents who have been selected to represent Queensland or Australia',
      'Round closes: 30 June 2026, or once all available grant funds have been expended.',
      'Funding Period: September 2025 to June 2026',
    ],
    description:
      'Supports Noosa Shire residents selected to represent Queensland or Australia at recognised national or international sporting competitions.',
    categories: ['sport', 'education'],
    deadline: '2026-06-30',
  },
  {
    title: 'Economic Development Grant',
    pageUrl: ECONOMIC_DEVELOPMENT_GRANT_URL,
    sourceUrl: ECONOMIC_DEVELOPMENT_GRANT_URL,
    marker: 'Economic Development Grant This Economic Development Grant Program is designed to support the delivery of projects',
    requiredSignals: [
      'This Grants Program operates on a rolling basis and is not subject to closing dates and application deadlines.',
      'They remain open until the end of the financial year, or until all of the allocated funding has been distributed.',
      'The minimum grant amount is $1000 and the maximum grant amount is $5000',
      'Applicants will be notified within 30 days of application',
    ],
    description:
      'Supports projects that strengthen the local business environment and economy in Noosa through a rolling economic development grants program.',
    categories: ['enterprise', 'community'],
    amount: { min: 1000, max: 5000 },
  },
];

function compressWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPageText(html: string, marker: string, endMarker?: string): string {
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
  let end = sliced.length;

  if (endMarker) {
    const idx = sliced.indexOf(endMarker, marker.length);
    if (idx >= 0) end = Math.min(end, idx);
  }

  const fallbackEndMarkers = ['Was this page helpful?', 'Contact Us'];
  for (const fallbackEndMarker of fallbackEndMarkers) {
    const idx = sliced.indexOf(fallbackEndMarker);
    if (idx >= 0) end = Math.min(end, idx);
  }

  return compressWhitespace(sliced.slice(0, end));
}

async function fetchPageText(url: string, marker: string, endMarker?: string): Promise<string | null> {
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
    return extractPageText(html, marker, endMarker);
  } catch {
    return null;
  }
}

export function createNoosaGrantsPlugin(): SourcePlugin {
  return {
    id: 'noosa-grants',
    name: 'Noosa Shire Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[noosa-grants] Scraping Noosa Shire Council grants...');

      const pageCache = new Map<string, string | null>();
      let yielded = 0;

      for (const definition of PROGRAMS) {
        const cacheKey = `${definition.pageUrl}|${definition.marker}|${definition.endMarker || ''}`;
        if (!pageCache.has(cacheKey)) {
          pageCache.set(
            cacheKey,
            await fetchPageText(definition.pageUrl, definition.marker, definition.endMarker)
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
          provider: 'Noosa Shire Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.amount,
          deadline: definition.deadline,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'noosa-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[noosa-grants] Yielded ${yielded} grants`);
    },
  };
}
