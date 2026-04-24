/**
 * Whitsunday Regional Council Grants Source Plugin
 *
 * Scrapes the live Whitsunday grants directory page and yields the current
 * evergreen grant programs that are clearly described there.
 */

import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const GRANTS_URL =
  'https://www.whitsundayrc.qld.gov.au/Community-and-Environment/Our-Community/Grants-and-Community-Assistance';

type ProgramDefinition = {
  title: string;
  sourceUrl: string;
  marker: string;
  endMarker?: string;
  requiredSignals: string[];
  description: string;
  categories: string[];
  amount?: { min?: number; max?: number };
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Sport & Recreation Clubs Grant',
    sourceUrl: `${GRANTS_URL}#sport-recreation-clubs-grant`,
    marker: 'Sport & Recreation Clubs Grant',
    endMarker: 'Facility Management Grant',
    requiredSignals: [
      'This is available to sport & recreation clubs with funding based on participation levels.',
      'Available all year-round.',
    ],
    description:
      'Provides year-round support to sport and recreation clubs in the Whitsunday region, with funding based on participation levels.',
    categories: ['community', 'sport'],
  },
  {
    title: 'Facility Management Grant',
    sourceUrl: `${GRANTS_URL}#facility-management-grant`,
    marker: 'Facility Management Grant',
    endMarker: 'Special Projects Grant',
    requiredSignals: [
      'This is available to organisations that manage multi use sports facilities.',
      'Conditions apply.',
      'Available all year-round.',
    ],
    description:
      'Provides year-round support for organisations that manage multi-use sports facilities in the Whitsunday region.',
    categories: ['community', 'sport'],
  },
  {
    title: 'Facade Improvement Incentive',
    sourceUrl: `${GRANTS_URL}#facade-improvement-incentive`,
    marker: 'Facade Improvement Incentive',
    endMarker: 'Junior Elite Athlete Financial Support',
    requiredSignals: [
      'The purpose of the Facade Improvement Policy is to incentivise property and/or business owners',
      'maximum Council contribution of $3000 may be granted',
      'maximum Council contribution of $5000 may be granted',
      'Facade Improvement Policy',
      'Facade Improvement Application Form',
    ],
    description:
      'Supports eligible shopfront improvements in key Whitsunday town centres through matched facade-improvement funding.',
    categories: ['enterprise', 'community'],
    amount: { max: 5000 },
  },
  {
    title: 'Junior Elite Athlete Financial Support',
    sourceUrl: `${GRANTS_URL}#junior-elite-athlete-financial-support`,
    marker: 'Junior Elite Athlete Financial Support',
    endMarker: 'Major Events and Conferences Sponsorship Program',
    requiredSignals: [
      'Financial support for a Junior Elite Athlete is available for all residents who are 18 years or younger',
      'Applications must be received prior to the competition.',
      'Applications for competitions that have already occurred will NOT be considered.',
      'Financial Support for a Junior Elite Athlete - Application and Guidelines',
    ],
    description:
      'Provides pre-competition financial support for eligible junior athletes representing North Queensland, Queensland, Australia, or equivalent levels.',
    categories: ['sport', 'education'],
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
      .replace(/&amp;/gi, '&')
  );

  const start = text.indexOf(marker);
  const sliced = start >= 0 ? text.slice(start) : text;
  let end = sliced.length;

  if (endMarker) {
    const idx = sliced.indexOf(endMarker, marker.length);
    if (idx >= 0) end = Math.min(end, idx);
  }

  const fallbackEndMarkers = ['Was this page helpful?', 'Back to top'];
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

export function createWhitsundayGrantsPlugin(): SourcePlugin {
  return {
    id: 'whitsunday-grants',
    name: 'Whitsunday Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[whitsunday-grants] Scraping Whitsunday Regional Council grants...');

      const pageCache = new Map<string, string | null>();
      let yielded = 0;

      for (const definition of PROGRAMS) {
        const cacheKey = `${definition.marker}|${definition.endMarker || ''}`;
        if (!pageCache.has(cacheKey)) {
          pageCache.set(cacheKey, await fetchPageText(GRANTS_URL, definition.marker, definition.endMarker));
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
          provider: 'Whitsunday Regional Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.amount,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'whitsunday-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[whitsunday-grants] Yielded ${yielded} grants`);
    },
  };
}
