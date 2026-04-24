/**
 * Scenic Rim Regional Council Grants Source Plugin
 *
 * Scrapes explicit Scenic Rim Regional Council grant pages and yields the
 * current program streams clearly described on those pages.
 */

import type { DiscoveryQuery, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const COMMUNITY_GRANTS_URL =
  'https://www.scenicrim.qld.gov.au/Our-Community/Community-and-Culture/Grants-Funding-and-Awards/Community-Grants-Program';
const RADF_URL =
  'https://www.scenicrim.qld.gov.au/Our-Community/Community-and-Culture/Grants-Funding-and-Awards/Regional-Arts-Development-Fund';
const EVENTS_SPONSORSHIP_URL =
  'https://www.scenicrim.qld.gov.au/Our-Community/Community-and-Culture/Grants-Funding-and-Awards/Regional-Events-Sponsorship-Program';

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
};

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Community Grants Program',
    pageUrl: COMMUNITY_GRANTS_URL,
    marker: 'Community Grants Program',
    markerOccurrence: 'last',
    requiredSignals: [
      'provides financial support to not-for-profit community groups for projects and events which benefit the region',
      "All application forms for current grants including in kind applications forms - click on the 'all applications' link below.",
    ],
    description:
      'Provides financial support to not-for-profit community groups for projects and events that benefit the Scenic Rim region.',
    categories: ['community'],
  },
  {
    title: 'RADF - Big Ideas Arts Grants',
    pageUrl: RADF_URL,
    sourceUrl: `${RADF_URL}#big-ideas-arts-grants`,
    marker: 'Regional Arts Development Fund',
    markerOccurrence: 'last',
    requiredSignals: [
      'Applications open 1 July 2025 via SmartyGrants.',
      'Big Ideas',
      'The Big Ideas RADF grant stream has a total of $52,500 to allocate across successful applicants.',
    ],
    description:
      'Supports larger creative projects through Scenic Rim’s Big Ideas arts grants stream within the 2025-2026 RADF program.',
    categories: ['arts'],
  },
  {
    title: 'RADF - Launch Pad Young Creatives Grants',
    pageUrl: RADF_URL,
    sourceUrl: `${RADF_URL}#launch-pad-young-creatives-grants`,
    marker: 'Regional Arts Development Fund',
    markerOccurrence: 'last',
    requiredSignals: [
      'Launch Pad grants are capped at $1,000.',
      'Emerging artists and producers aged 16-25 years.',
    ],
    description:
      'Supports emerging artists and producers aged 16-25 through Scenic Rim’s Launch Pad Young Creatives grants stream.',
    categories: ['arts', 'education'],
    amount: { max: 1000 },
  },
  {
    title: 'RADF - Express Lane Quick Response Grants',
    pageUrl: RADF_URL,
    sourceUrl: `${RADF_URL}#express-lane-quick-response-grants`,
    marker: 'Regional Arts Development Fund',
    markerOccurrence: 'last',
    requiredSignals: [
      'Express Lane Quick Response grants are capped at $1,000',
      '$1,500 for interstate.',
    ],
    description:
      'Supports quick-response creative opportunities through Scenic Rim’s Express Lane RADF stream, including interstate activity support.',
    categories: ['arts'],
    amount: { max: 1500 },
  },
  {
    title: 'Regional Events Sponsorship Program',
    pageUrl: EVENTS_SPONSORSHIP_URL,
    marker: 'Regional Events Sponsorship Program',
    markerOccurrence: 'last',
    requiredSignals: [
      'Regional Events Sponsorship Program is open for applications.',
      'Applications must be received at least 3-6 months before your event.',
    ],
    description:
      'Provides support for eligible events that activate the Scenic Rim and deliver economic outcomes for communities and businesses.',
    categories: ['community', 'enterprise'],
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

  const endMarkers = ['Back to top', 'Contact Us 82 Brisbane Street'];
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

export function createScenicRimGrantsPlugin(): SourcePlugin {
  return {
    id: 'scenicrim-grants',
    name: 'Scenic Rim Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[scenicrim-grants] Scraping Scenic Rim Regional Council grants...');

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
          provider: 'Scenic Rim Regional Council',
          sourceUrl: definition.sourceUrl || definition.pageUrl,
          amount: definition.amount,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'scenicrim-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[scenicrim-grants] Yielded ${yielded} grants`);
    },
  };
}
