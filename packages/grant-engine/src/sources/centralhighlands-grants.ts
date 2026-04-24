/**
 * Central Highlands Regional Council Grants Source Plugin
 *
 * Scrapes the live Central Highlands grants page and yields the current
 * community grants categories with their upcoming round timing.
 */

import type { DiscoveryQuery, GrantApplicationStatus, RawGrant, SourcePlugin } from '../types';

const BROWSER_UA = 'GrantScope/1.0 (research; contact@act.place)';

const GRANTS_URL = 'https://chrc.qld.gov.au/community-services/grants-and-funding/';

type ProgramDefinition = {
  title: string;
  sourceUrl: string;
  requiredSignals: string[];
  description: string;
  categories: string[];
  amount?: { min?: number; max?: number };
  deadline?: string;
  applicationStatus?: GrantApplicationStatus;
};

const PROGRAM_MARKER = 'Community Grants Program';

const PROGRAMS: ProgramDefinition[] = [
  {
    title: 'Community Grants Program - Community Assistance',
    sourceUrl: `${GRANTS_URL}#community-assistance`,
    requiredSignals: [
      'Community assistance – up to $5000',
      'Organisations with a community focus, not providing organised sport and recreation activities.',
      'Grants are offered twice a year.',
      'Round 2, 2026 1 August 15 September October Six months',
    ],
    description:
      'Supports community-focused organisations through Central Highlands Regional Council’s Community Assistance stream in the upcoming 2026 round.',
    categories: ['community'],
    amount: { max: 5000 },
    deadline: '2026-09-15',
    applicationStatus: 'upcoming',
  },
  {
    title: 'Community Grants Program - Sport and Recreation Assistance',
    sourceUrl: `${GRANTS_URL}#sport-recreation-assistance`,
    requiredSignals: [
      'Sport and recreation assistance – up to $5000',
      'Organisations providing organised sport and recreation activities.',
      'Grants are offered twice a year.',
      'Round 2, 2026 1 August 15 September October Six months',
    ],
    description:
      'Supports sport and recreation organisations through Central Highlands Regional Council’s upcoming 2026 community grants round.',
    categories: ['community', 'sport'],
    amount: { max: 5000 },
    deadline: '2026-09-15',
    applicationStatus: 'upcoming',
  },
  {
    title: 'Community Grants Program - Community Improvement',
    sourceUrl: `${GRANTS_URL}#community-improvement`,
    requiredSignals: [
      'Community improvement – up to $20,000',
      'Organisations with a focus on completing aspirations of their community in alignment with Council Strategic documents.',
      'Grants are offered twice a year.',
      'Round 2, 2026 1 August 15 September October Six months',
    ],
    description:
      'Supports larger community-improvement projects aligned to council strategy through the upcoming 2026 Central Highlands community grants round.',
    categories: ['community'],
    amount: { max: 20000 },
    deadline: '2026-09-15',
    applicationStatus: 'upcoming',
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

  const endMarkers = ['Was this page helpful?', 'Enquiries', 'Back to top'];
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

export function createCentralHighlandsGrantsPlugin(): SourcePlugin {
  return {
    id: 'centralhighlands-grants',
    name: 'Central Highlands Regional Council Grants',
    type: 'scraper',
    geography: ['AU-QLD'],

    async *discover(query: DiscoveryQuery): AsyncGenerator<RawGrant> {
      console.log('[centralhighlands-grants] Scraping Central Highlands Regional Council grants...');

      const text = await fetchPageText(GRANTS_URL, PROGRAM_MARKER);
      if (!text) {
        console.log('[centralhighlands-grants] Yielded 0 grants');
        return;
      }

      let yielded = 0;
      for (const definition of PROGRAMS) {
        if (!definition.requiredSignals.every(signal => text.includes(signal))) continue;

        const haystack = `${definition.title} ${definition.description} ${text}`.toLowerCase();
        if (query.keywords?.length && !query.keywords.some(keyword => haystack.includes(keyword.toLowerCase()))) continue;
        if (query.categories?.length) {
          const queryLower = query.categories.map(cat => cat.toLowerCase());
          if (!definition.categories.some(cat => queryLower.includes(cat))) continue;
        }

        yield {
          title: definition.title,
          provider: 'Central Highlands Regional Council',
          sourceUrl: definition.sourceUrl,
          amount: definition.amount,
          deadline: definition.deadline,
          applicationStatus: definition.applicationStatus,
          description: definition.description,
          categories: definition.categories,
          sourceId: 'centralhighlands-grants',
          geography: ['AU-QLD'],
        };
        yielded++;
      }

      console.log(`[centralhighlands-grants] Yielded ${yielded} grants`);
    },
  };
}
